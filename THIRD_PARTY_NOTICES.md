# Third-party materials

The unmodified Agent Plugins 1.0 schemas in `src/schemas` come from [agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec), distributed under Apache License 2.0. Their license is retained in `src/schemas/LICENSE`. The canonical sources are [plugin.schema.json](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) and [mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json). Validation uses these local copies and never downloads schemas while inspecting a package.

Promptfoo, Ajv, Zod, and development dependencies retain their own licenses in their distributions. The lockfile identifies the dependency versions used by this repository.

Promptfoo is pinned to 0.122.1 because newer releases introduce `extract-zip` through the Codex Security provider, which this runner does not require. That dependency has an [unpatched archive symlink traversal advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). Upgrade once the dependency path is removed or patched, and rerun the artifact and native integration checks.
