# Third-party materials

The unmodified Agent Plugins 1.0 schemas in `src/schemas` come from [agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec), distributed under Apache License 2.0. Their license is retained in `src/schemas/LICENSE`. The canonical sources are [plugin.schema.json](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) and [mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json). Validation uses these local copies and never downloads schemas while inspecting a package.

Promptfoo, Ajv, Zod, and development dependencies retain their own licenses in their distributions. The lockfile identifies the dependency versions used by this repository.

Claude discovery uses the public [Anthropic Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) and the native CLI's [plugin commands](https://code.claude.com/docs/en/plugins-reference#cli-commands-reference). The SDK supplies the session protocol; Verdr does not implement a parallel Claude protocol. The SDK and the Claude Code development dependency retain Anthropic's licensing terms in their distributions. The native discovery probe uses `reloadPlugins()` without submitting a model prompt; it does not run Claude's separate plugin evaluation suite.

Promptfoo is pinned to 0.122.1 because newer releases introduce `extract-zip` through the Codex Security provider, which this runner does not require. That dependency has an [unpatched archive symlink traversal advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). Upgrade once the dependency path is removed or patched, and rerun the artifact and native integration checks.
