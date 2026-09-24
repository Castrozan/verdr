# Verdr

Evaluate the agent assets people actually install.

Verdr consumes an emitted Agent Plugins package or bundle, checks its identity and required assets, and uses Promptfoo to evaluate emitted files, commands, injected instructions, installed package identity, and native Codex, Claude Code, OpenCode and Pi discovery. Every run produces JSON evidence and an HTML report. Missing assets, empty responses, timeouts, and modified artifacts fail the gate.

## Run

Use Node.js 22.22 or newer on Linux or macOS. Install dependencies and build:

```sh
npm ci
npm run build
node dist/cli.js run examples/standalone/suite.json --output results/standalone
```

Open `results/standalone/index.html`. The standalone fixture exercises the runner without Nix, dotfiles, credentials, or a model call. Its Echo provider checks integration mechanics and does not measure instruction effectiveness.

To evaluate the generated distribution fixture, supply the exact bundle from the producer:

```sh
node dist/cli.js run examples/generated-pack.json --artifact "$BUNDLE" --output results/generated-pack
```

This fixture requires Codex and Claude Code with the native plugin APIs exercised by the suite. Keep the generated bundle in place. Each native case installs the supplied marketplace into a fresh profile and checks the installed package hash. Codex records native skill origins. Claude records the session's loaded plugin root and namespaced commands and agents through Anthropic's official Agent SDK. System policy can still apply and is reported separately.

## Suite contract

`artifact.root` resolves relative to the suite file; `--artifact` overrides it relative to the caller's directory. Package roots and required assets are relative to that emitted root. The explicit required-file inventory can detect dropped resources; deriving it only from surviving output cannot.

| Case kind            | Executes                                                                                              | Claim                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `file`               | Reads the exact emitted file and applies Promptfoo assertions.                                        | Asset content.                                                                        |
| `command`            | Runs a trusted program with argument arrays in a fresh workspace.                                     | Declared command outcome.                                                             |
| `injected`           | Reads emitted instruction files and calls an existing Promptfoo provider.                             | Injected behavior; no native discovery claim.                                         |
| `pi-discovery`       | Loads the emitted registration through Pi’s SDK and Agent Plugins extension.                          | Native skill discovery with package origin.                                           |
| `pi-skill`           | Expands a discovered skill through Pi’s native follow-up queue API.                                   | Queued skill body and origin; no model consumption or adherence claim.                |
| `opencode-discovery` | Queries OpenCode with the emitted config file and filters skills by canonical package origin.         | Native skill discovery; no invocation claim.                                          |
| `opencode-mcp`       | Calls a configured package MCP tool through OpenCode’s native code-mode debug tool.                   | Native result and configuration origin; no model adherence or approval-loop claim.    |
| `opencode-skill`     | Invokes a discovered skill through OpenCode’s native debug tool.                                      | Returned skill body and verified origin; no model adherence or agent-loop hook claim. |
| `installed-identity` | Reads a producer-supplied installed package root and compares its full tree with the emitted package. | Installed bytes and executable permissions; no discovery or execution claim.          |
| `codex-discovery`    | Installs an emitted marketplace with Codex and queries its native APIs.                               | Installed identity and discovery; no invocation or adherence claim.                   |
| `codex-mcp`          | Calls a tool from the installed plugin through Codex’s native MCP control API.                        | Native tool result and plugin identity; no model adherence or approval-loop claim.    |
| `claude-discovery`   | Installs an emitted marketplace with Claude Code and queries the native session through its SDK.      | Installed identity and native discovery; no invocation or adherence claim.            |
| `claude-mcp`         | Calls a tool from the loaded plugin through Claude’s declared control protocol.                       | Native result and plugin origin; no model adherence or approval-loop claim.           |

`installed-identity` requires `package`, an absolute `installedRoot`, and `target` (`claude`, `codex`, `opencode`, `pi`, or `hermes`). It reads the existing installation without registering or repairing it. A root symlink may resolve to the emitted package; escaping links within a package fail containment. Corruption cannot fall back to another installed copy.

Codex and Claude discovery cases require `package`, `marketplace`, and `plugin`; `executable` defaults to `codex` or `claude`. The package must appear in `artifact.packages`. Claude consumes `.claude-plugin/marketplace.json` and the package's emitted `.claude-plugin/plugin.json`; Verdr does not generate either file. Use assertions on the expected namespaced components as well as the required-file inventory to detect components the native loader omits.

Claude can load a local marketplace package directly from its emitted directory even after caching it. Its evidence therefore distinguishes `installation` from `loading`, records both digests, and rejects an unexpected loaded root. The SDK probe submits no model prompt. MCP server statuses are observations, and a pending or listed server does not prove connectivity or tool execution. Hook execution is unmeasured. The baseline records native components visible before installation; system policy is inherited and not exhaustively enumerated.

`codex-mcp` requires the Codex discovery fields plus `server`, `tool`, and optional `arguments`. It verifies the discovered server’s native plugin identity before calling the tool. Assertions grade only the returned MCP result; tool errors and empty results fail before grading. The call uses an ephemeral native thread without a model turn and bypasses the ordinary approval loop. Suites must select tools whose effects are authorized. [Native MCP control API](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/app-server/src/request_processors/mcp_processor.rs#L529).

`claude-mcp` uses the Claude discovery fields plus `server`, `tool`, and optional `arguments`. Tool identifiers must contain only letters, digits, underscores, or hyphens. Verdr verifies the native server’s plugin origin, calls through the declared JSONL control protocol, checks connected tool inventory, and rechecks loaded and installed bytes. Native control errors, including server-declared MCP errors, fail before assertions grade the returned content. Claude may return content as text or blocks and omits `isError` on success. This control API makes no model turn and bypasses per-call approval. [Declared control protocol](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.280/sdk.d.ts).

OpenCode cases require `package` and the emitted `configuration` path; `executable` defaults to `opencode`. The config must select its own skill paths: Verdr points `OPENCODE_CONFIG` at it without generating replacement config or loading sibling directories implicitly. The bundle must remain immutable. `opencode-skill` also requires `skill`; `agent` defaults to `build`. Assertions grade the native tool’s returned body, with discovery and origin evidence in metadata. The debug interface makes no model call, honors deny rules, and bypasses ordinary agent-loop hooks; it does not establish adherence. [Native interface](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/cli/cmd/debug/agent.handler.ts).

`opencode-mcp` requires `server`, `tool`, and optional `arguments`. Verdr checks that the effective native configuration binds both `cwd` and `PLUGIN_ROOT` to the emitted package, rejects ambiguous server names, and verifies exactly one completed child call with the requested arguments. This proves configuration origin, not portable plugin ownership. Assertions grade only the returned value. Native MCP errors and truncated results fail. Code mode runs native child-tool hooks without a model loop; debug approval requests do not prompt. [Native code mode](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/tool/code-mode.ts).

Pi cases require `package`, the emitted `registration` path, and an absolute `runtimeModules` directory containing `@earendil-works/pi-coding-agent` and `pi-agent-plugins`. Verdr records both runtime versions and entrypoint hashes, loads the supplied extension in a fresh profile, and verifies discovered origins. `pi-skill` requires `skill`; assertions grade only the body expanded into Pi’s follow-up queue. The queue is cleared without starting a model turn. This does not exercise MCP, model consumption, hooks, or adherence. Both Pi profile variables are isolated. [Native queue API](https://github.com/earendil-works/pi/blob/v0.84.1/packages/coding-agent/docs/sdk.md#prompting-and-message-queueing).

Command arguments accept `{artifact}`, `{profile}`, and `{workspace}`. They never run through a shell. Provider credentials must be explicitly named in the suite's `environment` array; values stay in the caller's environment. Reserved profile and Node configuration variables cannot be inherited. Suites and provider configuration are trusted executable inputs; fresh profiles are not a security sandbox.

The runner executes cases sequentially, with one Promptfoo evaluation per case and caching disabled. Suite limits bound each case's wall time and output, plus artifact bytes and entry count. The schema caps suites at 100 cases. A provider may make internal calls; the runner does not yet enforce a monetary or token budget.

Output must be a new directory outside the measured artifact. Exit codes are `0` for a passing gate, `1` for failed or incomplete evidence, and `2` for invalid configuration or setup failure. Raw Promptfoo results and the artifact inventory remain beside the report. Temporary profiles are removed after execution.

## Verification and scope

```sh
npm run check
npm run build
npm test
npm run test:native
```

The native integration tests use Codex 0.155.1, selected through `VERDR_CODEX_EXECUTABLE` or `PATH`, and Claude Code 2.1.280, selected through `VERDR_CLAUDE_EXECUTABLE` or the pinned development dependency. They prove that valid ambient installations cannot rescue defective emitted assets. CI downloads the pinned Codex release with a checksum check and installs Claude through the public npm lockfile. OpenCode 1.18.32 comes from the pinned public development dependency or `VERDR_OPENCODE_EXECUTABLE`. Its native controls distinguish successful discovery from denied invocation. Pi tests use the pinned public SDK 0.84.1 and Agent Plugins loader 0.1.8, or an explicit `VERDR_PI_RUNTIME_MODULES` directory. These native tests require no model credentials.

The runner does not yet import JUnit, coverage, mutation, or flake history; compare historical evidence; calibrate judges; run paired instruction experiments; or evaluate composed installations. Native runtime support covers Codex and Claude Code discovery and MCP invocation, OpenCode skill and MCP invocation, and Pi skill discovery and queue expansion. The HTML report states these limits instead of presenting an overall quality score.

- [Implementation plan](docs/implementation-plan.md)
- [Generated artifact contract](docs/artifact-contract.md)
- Recorded producer integration observations: [Codex](evidence/integration-spike.json) and [Claude Code](evidence/claude-discovery.json).
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Agent Plugins 1.0 supplies the portable package format. Complete packages can contain client extensions and additional resources; preserving a resource and executing it are separate capabilities.

Verdr is independent of any company evaluation package. Its implementation will use public dependencies and original code.
