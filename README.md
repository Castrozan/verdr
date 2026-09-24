# Verdr

Evaluate the agent assets people actually install.

Verdr consumes an emitted Agent Plugins package or bundle, checks its identity and required assets, and uses Promptfoo to evaluate emitted files, commands, injected instructions, installed package identity, and native Codex and Claude Code discovery. Every run produces JSON evidence and an HTML report. Missing assets, empty responses, timeouts, and modified artifacts fail the gate.

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

| Case kind            | Executes                                                                                              | Claim                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `file`               | Reads the exact emitted file and applies Promptfoo assertions.                                        | Asset content.                                                               |
| `command`            | Runs a trusted program with argument arrays in a fresh workspace.                                     | Declared command outcome.                                                    |
| `injected`           | Reads emitted instruction files and calls an existing Promptfoo provider.                             | Injected behavior; no native discovery claim.                                |
| `installed-identity` | Reads a producer-supplied installed package root and compares its full tree with the emitted package. | Installed bytes and executable permissions; no discovery or execution claim. |
| `codex-discovery`    | Installs an emitted marketplace with Codex and queries its native APIs.                               | Installed identity and discovery; no invocation or adherence claim.          |
| `claude-discovery`   | Installs an emitted marketplace with Claude Code and queries the native session through its SDK.      | Installed identity and native discovery; no invocation or adherence claim.   |

`installed-identity` requires `package`, an absolute `installedRoot`, and `target` (`claude`, `codex`, `opencode`, `pi`, or `hermes`). It reads the existing installation without registering or repairing it. A root symlink may resolve to the emitted package; escaping links within a package fail containment. Corruption cannot fall back to another installed copy.

Both native cases require `package`, `marketplace`, and `plugin`; `executable` defaults to `codex` or `claude`. The package must appear in `artifact.packages`. Claude consumes `.claude-plugin/marketplace.json` and the package's emitted `.claude-plugin/plugin.json`; Verdr does not generate either file. Use assertions on the expected namespaced components as well as the required-file inventory to detect components the native loader omits.

Claude can load a local marketplace package directly from its emitted directory even after caching it. Its evidence therefore distinguishes `installation` from `loading`, records both digests, and rejects an unexpected loaded root. The SDK probe submits no model prompt. MCP server statuses are observations, and a pending or listed server does not prove connectivity or tool execution. Hook execution is unmeasured. The baseline records native components visible before installation; system policy is inherited and not exhaustively enumerated.

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

The native integration tests use Codex 0.155.1, selected through `VERDR_CODEX_EXECUTABLE` or `PATH`, and Claude Code 2.1.280, selected through `VERDR_CLAUDE_EXECUTABLE` or the pinned development dependency. They prove that valid ambient installations cannot rescue defective emitted assets. CI downloads the pinned Codex release with a checksum check and installs Claude through the public npm lockfile. Neither discovery test requires model credentials.

The runner does not yet import JUnit, coverage, mutation, or flake history; compare historical evidence; calibrate judges; run paired instruction experiments; or evaluate composed installations. Native runtime support covers Codex and Claude Code discovery. The HTML report states these limits instead of presenting an overall quality score.

- [Implementation plan](docs/implementation-plan.md)
- [Generated artifact contract](docs/artifact-contract.md)
- Recorded producer integration observations: [Codex](evidence/integration-spike.json) and [Claude Code](evidence/claude-discovery.json).
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Agent Plugins 1.0 supplies the portable package format. Complete packages can contain client extensions and additional resources; preserving a resource and executing it are separate capabilities.

Verdr is independent of any company evaluation package. Its implementation will use public dependencies and original code.
