from copy import deepcopy
from pathlib import Path
import json

from hermes_cli.plugins import collect_directory_manifests
from tools.mcp_tool_discovery import get_mcp_status, register_mcp_servers
from tools.mcp_tool_lifecycle import shutdown_mcp_servers
from tools.mcp_tool_schema import mcp_prefixed_tool_name
from tools.registry import registry


def invoke(manager, package_root, request):
    manifests = [
        manifest
        for manifest in collect_directory_manifests()
        if manifest.portable
        and manifest.source == "user"
        and manifest.path
        and Path(manifest.path).resolve(strict=True) == package_root
    ]
    if len(manifests) != 1:
        raise RuntimeError("Expected one native Hermes portable package manifest")
    server_name = f"{manifests[0].skill_namespace}__{request['server']}"
    servers = deepcopy(manager.get_portable_mcp_servers())
    if server_name not in servers:
        raise RuntimeError("Hermes MCP server is missing from the emitted package")
    selected = servers[server_name]
    if (
        "command" in selected
        and Path(selected.get("env", {}).get("PLUGIN_ROOT", "")).resolve(strict=True)
        != package_root
    ):
        raise RuntimeError("Native Hermes MCP server has a different package origin")
    for name, configuration in servers.items():
        configuration["enabled"] = name == server_name
    selected["sampling"] = {**selected.get("sampling", {}), "enabled": False}
    selected["elicitation"] = {**selected.get("elicitation", {}), "enabled": False}
    tool_name = mcp_prefixed_tool_name(server_name, request["tool"])
    try:
        registered = register_mcp_servers(servers)
        entry = registry.get_entry(tool_name)
        if (
            tool_name not in registered
            or entry is None
            or entry.toolset != f"mcp-{server_name}"
        ):
            raise RuntimeError("Requested native Hermes MCP tool is not registered")
        output = registry.dispatch(tool_name, request["arguments"])
        if not isinstance(output, str) or not output.strip():
            raise RuntimeError("Native Hermes MCP tool returned no content")
        result = json.loads(output)
        if not isinstance(result, dict) or "error" in result:
            raise RuntimeError("Native Hermes MCP tool returned an error")
        if not result.get("result") and not result.get("structuredContent"):
            raise RuntimeError("Native Hermes MCP tool returned no content")
        status = get_mcp_status(servers)
        connected = [server for server in status if server["name"] == server_name]
        if len(connected) != 1 or connected[0]["status"] != "connected":
            raise RuntimeError("Native Hermes MCP server lacks connected evidence")
        if any(
            server["status"] != "disabled"
            for server in status
            if server["name"] != server_name
        ):
            raise RuntimeError("Unselected Hermes MCP server escaped isolation")
        return output, {
            "scope": "native-mcp-invocation",
            "execution": "hermes-native-registry",
            "server": connected[0],
            "tool": {"name": request["tool"], "registeredName": tool_name},
            "composition": {
                "scope": "temporary-native-profile",
                "selectedServer": server_name,
                "disabledServers": sorted(
                    name for name in servers if name != server_name
                ),
                "sampling": False,
                "elicitation": False,
            },
            "mcpErrorHandling": "native-rendered-error",
            "agentLoopHooks": "bypassed-by-native-registry",
        }
    finally:
        shutdown_mcp_servers(timeout=15.0)
