# Verdr

Evaluate the agent assets people actually install.

Verdr consumes an emitted Agent Plugins package or bundle, checks its identity and required assets, and uses Promptfoo to evaluate emitted files, commands, injected instructions, and native Codex discovery. Every run produces JSON evidence and an HTML report. Missing assets, empty responses, timeouts, and modified artifacts fail the gate.

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

This fixture requires Codex with the native plugin APIs exercised by the suite. Keep the generated bundle in place. Each native case installs the supplied marketplace into a fresh profile, checks the installed package hash, and records native skill origins. System policy can still apply and is reported separately.

## Suite contract

`artifact.root` resolves relative to the suite file; `--artifact` overrides it relative to the caller's directory. Package roots and required assets are relative to that emitted root. The explicit required-file inventory can detect dropped resources; deriving it only from surviving output cannot.

| Case kind         | Executes                                                                  | Claim                                                               |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `file`            | Reads the exact emitted file and applies Promptfoo assertions.            | Asset content.                                                      |
| `command`         | Runs a trusted program with argument arrays in a fresh workspace.         | Declared command outcome.                                           |
| `injected`        | Reads emitted instruction files and calls an existing Promptfoo provider. | Injected behavior; no native discovery claim.                       |
| `codex-discovery` | Installs an emitted marketplace with Codex and queries its native APIs.   | Installed identity and discovery; no invocation or adherence claim. |

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

The native integration test requires Codex 0.155.1, selected through `VERDR_CODEX_EXECUTABLE` or `PATH`. It proves that a valid ambient cached installation cannot rescue a corrupted emitted skill. CI downloads the pinned upstream release and verifies its checksum before this test.

This is the first executable slice of the plan. It does not yet import JUnit, coverage, mutation, or flake history; compare historical evidence; calibrate judges; run paired instruction experiments; or evaluate composed installations. Native runtime support is currently limited to Codex discovery. The HTML report states these limits instead of presenting an overall quality score.

- [Implementation plan](docs/implementation-plan.md)
- [Generated artifact contract](docs/artifact-contract.md)
- [Recorded producer integration observations](evidence/integration-spike.json)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Agent Plugins 1.0 supplies the portable package format. Complete packages can contain client extensions and additional resources; preserving a resource and executing it are separate capabilities.

Verdr is independent of any company evaluation package. Its implementation will use public dependencies and original code.
