# Third-party materials

The unmodified Agent Plugins 1.0 schemas in `src/schemas` come from [agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec), distributed under Apache License 2.0. Their license is retained in `src/schemas/LICENSE`. The canonical sources are [plugin.schema.json](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) and [mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json). Validation uses these local copies and never downloads schemas while inspecting a package.

Promptfoo, Ajv, Zod, and development dependencies retain their own licenses in their distributions. The lockfile identifies the dependency versions used by this repository.

Claude discovery uses the public [Anthropic Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) and the native CLI's [plugin commands](https://code.claude.com/docs/en/plugins-reference#cli-commands-reference). The SDK supplies discovery control; MCP invocation uses its exported control request types with the native CLI’s JSONL transport. The SDK and the Claude Code development dependency retain Anthropic's licensing terms in their distributions. The native discovery probe uses `reloadPlugins()` without submitting a model prompt; it does not run Claude's separate plugin evaluation suite.

Promptfoo is pinned to 0.122.1 because newer releases introduce `extract-zip` through the Codex Security provider, which this runner does not require. That dependency has an [unpatched archive symlink traversal advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). Upgrade once the dependency path is removed or patched, and rerun the artifact and native integration checks.

Hermes native tests install the public [Hermes Agent](https://github.com/NousResearch/hermes-agent/tree/d337b736aa1e8ebecfab043842d13e4a2d2f48a3) source with its upstream Python dependency lock. Verdr calls native plugin and skill APIs; Hermes code is not vendored here. Runtime distributions retain their own licenses.
