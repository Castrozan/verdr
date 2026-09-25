# Native plugin launch retirement acceptance, 2026-09-25

Verdr independently checked the producer change for [issue 154](https://github.com/Castrozan/.dotfiles/issues/154) that retires the per-server Python MCP launcher. OpenCode now starts each plugin MCP server from native configuration: `command`, `cwd` and `environment` point at the canonical package, and plugin state lives under an explicit data root outside the immutable bundle. Claude now resolves relative plugin commands from the package root instead of the working directory. No Verdr adapter or origin check changed.

| Exact subject            | Value                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Producer implementation  | [a2484aa8](https://github.com/Castrozan/.dotfiles/commit/a2484aa846bf6f2999bb3ab2e3a0dd3d9e924c1b) |
| Activated producer       | [7feb0f67](https://github.com/Castrozan/.dotfiles/commit/7feb0f675dcd6b2d8b0a8e446e265d900211d4f0) |
| Activated bundle         | `/nix/store/lm0sqf68pqbimfkzd9fsya1pphgixp77-agent-plugin-bundle`                                  |
| Version                  | `1.0.0+13756e8c5a80`                                                                               |
| Complete digest          | `89b89f2131da3bf33cfc69122515a52affa7b6fb009c9ae9167843d381316375`                                 |
| Canonical package digest | `b6f543dac7d535ca7cb433e13bae679fc0b832cb684d9d367b8c8fce5c00706e`                                 |
| Active system            | `/nix/store/vhm9kd0qsslvz1wz3dln78wg7k1qfpl9-darwin-system-25.11.ebec37a`                          |
| OpenCode data root       | `~/.local/state/agent-plugins/opencode/dotfiles`                                                   |
| Consumer implementation  | [20643a6c](https://github.com/Castrozan/verdr/tree/20643a6cacfc2860aef510aa0bd3861da1b779d5)       |

The producer handed over bundle `narsrg2v` at version `1.0.0+7eb74df3a4ed`. A later lint-only regrouping in `7feb0f67` rebuilt the system, so the measured deployment is `lm0sqf68`. Its canonical package differs from `narsrg2v` in exactly four identity metadata files: both harness manifests, `plugin.json` and `artifact-inventory.json`. No file was added or removed, and every payload byte, executable bit and symlink target matches. The [selected receipt](receipt.json) records exact inputs and outcomes; the [runnable suite](suite.json) pins `lm0sqf68`.

## Measured results

| Scope                             | Outcome                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Fixture-v3 OpenCode native launch | 21/21 checks; 15 native commands, six owned server calls                                        |
| Fixture-v3 Claude command origin  | 11/11 checks; seven native commands, two control-protocol calls                                 |
| Declared source preservation      | 54/54 artifacts and 383/383 files; 10,632,559 bytes and executable bits match                   |
| Complete canonical package        | 390 files, 530 entries, 10,640,261 bytes                                                        |
| Actual installed identity         | 5/5 roots match the complete package: Claude, Codex, OpenCode, Pi and Hermes                    |
| Actual native configuration       | 3/3 compositions pass: globals alone, interactive overlay, Betha overlay                        |
| Actual native skill discovery     | 21/21 canonical origins: 19 global and two repository skills; built-in customize-opencode apart |
| Isolated selected MCP invocation  | 1/1 SonarQube `list_languages` call with `q=python` returns key `py`, name `Python`             |
| Existing-adapter suite            | 6/6 cases pass, zero failures, errors or not-run                                                |

## Fixture-v3 native behavior

The producer built three read-only, complete five-target bundles with the final packaged builder `rywr0rw4…-agent-plugin-build`: two revisions of `launch-probe` and one `other-probe`. Each package carries an owned `inspect` server in two forms. The `state` server runs with `cwd` set to its declared data directory. The `working` server runs from a `./working` directory that holds a wrong-origin `bin/server.mjs`, which exits 99 when loaded. Before and after every run, the complete bundle identities matched the supplied inventories.

OpenCode 1.18.32 results:

- With the declared data directory absent, native startup failed with `ENOENT` and OpenCode created no directory. After the deployment-equivalent `mkdir`, the same emitted configuration started.
- Both revisions of `launch-probe` shared one data directory and accumulated four tokens across them. `other-probe` kept its own two tokens.
- Literal quotes, shell syntax and the native `{env:…}` and `{file:…}` forms reached the server unchanged as argv and environment.
- Every call executed the canonical package server from both working directories; the shadow executable never ran.
- All six child processes were absent afterward, and all three temporary profiles were removed.

Claude 2.1.280 installed the complete emitted package into a temporary native profile, and the installed copy matched it. Through the no-model control protocol, both the `state` and `working` servers ran the canonical package server with the correct data argument and literal environment. `PLUGIN_ROOT` keeps the lexical `/tmp` alias while the process reports `/private/tmp`, and a successful control response omits `isError`; the assertions accept both native behaviors. Two earlier consumer attempts failed in Verdr's own driver, first on a sandbox-denied `tsx` subprocess and then on those two assertions. Neither was a producer defect.

## Actual deployment

The live global OpenCode plugin layer equals the emitted `.opencode/opencode.jsonc` plus Chrome's 120000 ms and SonarQube's 60000 ms timeouts, and the global preferences file contains neither `mcp` nor `skills`. The native effective configuration under all three scopes preserves both server definitions, canonical skill paths and eight selected base preferences. Inspection ran with both MCP servers disabled, network denied and writes denied to all five native profiles and the dotfiles repository. Configuration bytes were unchanged afterward.

The isolated invocation used the unchanged `opencode-mcp` adapter against the complete emitted configuration. Effective-config preflight disabled `plugin.dotfiles.chrome-devtools` before startup, and the run recorded exactly one `plugin_dotfiles_sonarqube.list_languages` call. No model turn or browser MCP process ran, and no token contents were captured.

## Verification and limits

Producer CI for `a2484aa8` passed evals and reports, and its Statix job failed on repeated attribute grouping; `7feb0f67` fixed that without a generator change. CI for `7feb0f67` passed: [tests](https://github.com/Castrozan/.dotfiles/actions/runs/36199308035), [Nix Lint](https://github.com/Castrozan/.dotfiles/actions/runs/36199308080), [evals](https://github.com/Castrozan/.dotfiles/actions/runs/36199308059) and [reports](https://github.com/Castrozan/.dotfiles/actions/runs/36199308067).

This acceptance covers native OpenCode launch, state and literal handling, Claude command origin, OpenCode composition and discovery, one isolated production invocation and complete installed identity for all five targets. It does not repeat native invocation on Codex, Pi or Hermes, exercise browser behavior, or measure model adherence. It does not claim that runtime `HOME` or `XDG_*` overrides relocate emitted paths: the data root is fixed at build time.

## Repeat

The exact store outputs and the emitted SonarQube token-file binding must exist. Use a fresh output directory; the run performs no source regeneration, package pruning or registration change.

```sh
npm ci
npm run build
verdr_node=/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node
"$verdr_node" dist/cli.js run evidence/2026-09-25-native-launch-retirement/suite.json --output results/native-launch-repeat
```

The fixture-v3 bundles are temporary producer inputs and are not reproducible from this repository alone.
