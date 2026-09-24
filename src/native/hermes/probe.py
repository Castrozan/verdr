import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from pathlib import Path

request = json.load(sys.stdin)
package_root = Path(request["packageRoot"]).resolve(strict=True)
registration = Path(request["registration"]).resolve(strict=True)
if registration != package_root:
    raise RuntimeError("Hermes registration does not resolve the emitted package")
profile = Path(os.environ["HERMES_HOME"])
plugin_name = json.loads((package_root / "plugin.json").read_text())["name"]
if not isinstance(plugin_name, str) or Path(plugin_name).name != plugin_name:
    raise RuntimeError("Invalid Hermes package name")
(profile / "plugins").mkdir()
(profile / "plugins" / plugin_name).symlink_to(registration, target_is_directory=True)
(profile / "config.yaml").write_text(
    json.dumps({"plugins": {"enabled": [plugin_name]}})
)

import hermes_cli.plugins
import tools.skills_tool

hermes_cli.plugins.discover_plugins()
manager = hermes_cli.plugins.get_plugin_manager()
plugins = manager.list_plugins()
selected_plugins = [plugin for plugin in plugins if plugin["key"] == plugin_name]
if (
    len(selected_plugins) != 1
    or not selected_plugins[0]["enabled"]
    or selected_plugins[0]["error"]
    or selected_plugins[0]["source"] != "user"
):
    raise RuntimeError("Hermes native package is missing, disabled, or failed")
skills = []
for discovered in manager.list_plugin_skill_metadata():
    path = manager.find_plugin_skill(discovered["name"])
    if path is None:
        continue
    path = path.resolve(strict=True)
    if not path.is_relative_to(package_root):
        continue
    skills.append(
        {
            "name": discovered["name"],
            "description": discovered["description"],
            "filePath": str(path),
        }
    )
evidence = {
    "scope": "native-discovery",
    "target": "hermes",
    "registration": str(registration),
    "plugins": plugins,
    "skills": skills,
    "runtime": {
        "version": importlib.metadata.version("hermes-agent"),
        "pythonVersion": platform.python_version(),
        "modules": [
            {
                "name": module.__name__,
                "path": str(Path(module.__file__).resolve()),
                "sha256": hashlib.sha256(
                    Path(module.__file__).read_bytes()
                ).hexdigest(),
            }
            for module in (hermes_cli.plugins, tools.skills_tool)
        ],
    },
    "host": {
        "isolation": "fresh-user-profile",
        "projectDiscovery": False,
        "bundledPlugins": "empty-directory",
    },
    "execution": "not-measured",
    "modelConsumption": "not-measured",
    "adherence": "not-measured",
    "agentLoopHooks": "not-measured",
    "portableHooks": "unsupported-by-native-portable-loader",
}
output = None
if request.get("skill"):
    selected = [
        skill
        for skill in skills
        if skill["name"].rsplit(":", 1)[-1] == request["skill"]
    ]
    if len(selected) != 1:
        raise RuntimeError(
            "Expected exactly one native Hermes skill from the emitted package"
        )
    skill = selected[0]
    result = json.loads(tools.skills_tool.skill_view(skill["name"], preprocess=False))
    if (
        result.get("success") is not True
        or result.get("name") != skill["name"]
        or not isinstance(result.get("content"), str)
        or not result["content"].strip()
    ):
        raise RuntimeError(
            "Native Hermes skill invocation failed or returned no content"
        )
    current_path = manager.find_plugin_skill(skill["name"])
    if current_path is None or current_path.resolve(strict=True) != Path(
        skill["filePath"]
    ):
        raise RuntimeError("Native Hermes skill origin changed during invocation")
    output = result["content"]
    evidence.update(
        {
            "scope": "native-skill-invocation",
            "execution": "hermes-skill-view",
            "invocation": {
                "name": skill["name"],
                "filePath": skill["filePath"],
                "preprocessing": False,
                "readinessStatus": result.get("readiness_status"),
            },
        }
    )
print(json.dumps({"output": output or json.dumps(evidence), "metadata": evidence}))
