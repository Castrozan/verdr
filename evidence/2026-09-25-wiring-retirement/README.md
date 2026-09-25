# Native OpenCode configuration acceptance, 2026-09-25

Verdr independently checked the activated successor for [wiring retirement issue 154](https://github.com/Castrozan/.dotfiles/issues/154). OpenCode now loads emitted plugin configuration through global `opencode.jsonc`, alongside preferences in global `opencode.json`; workspace overlays apply afterward. The producer removed duplicate MCP registration, skill-path reconstruction and an unused export. The generic launcher remains. This change required no Verdr adapter or origin-check modification.

| Exact subject            | Value                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Producer                 | [f3454814](https://github.com/Castrozan/.dotfiles/commit/f3454814f27dfd5e4c0ef18a9b0e516b94a74a94) |
| Bundle                   | `/nix/store/bj26rr9lvsxlh3f7csbn2ghcz1iyknnb-agent-plugin-bundle`                                  |
| Version                  | `1.0.0+279b80f98077`                                                                               |
| Complete digest          | `ff7cdacf92707b584eff1928abeab29298505b07928466cb3a12d48750e665ab`                                 |
| Canonical package digest | `65d199e8799983c412c7ca6bca045b24efbf433a222f7701a7440a831b78e324`                                 |
| Active system            | `/nix/store/23qp1innm6y2n6f6nqyj5w6w4ikv93bs-darwin-system-25.11.ebec37a`                          |
| Consumer implementation  | [81ed7063](https://github.com/Castrozan/verdr/tree/81ed7063add21fb175bbb98d4ed723e17c1e16a9)       |

The [selected receipt](receipt.json) records exact configuration roots, hashes, native skill origins and bounded outcomes. The [runnable suite](suite.json) pins this bundle and unwrapped OpenCode 1.18.32. A later producer source HEAD is not substituted for the measured deployment.

## Measured results

| Scope                            | Outcome                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Declared source preservation     | 54/54 artifacts and 383/383 files; 10,632,559 bytes and executable bits match                      |
| Complete bundle                  | 418 regular files, 10,645,096 bytes; before/after digest unchanged                                 |
| Complete canonical package       | 390 files, 530 entries, 10,640,261 bytes                                                           |
| Actual installed identity        | 5/5 roots match the complete package: Claude, Codex, OpenCode, Pi and Hermes                       |
| Actual native configuration      | 3/3 compositions pass: globals alone, declared interactive overlay, declared Betha overlay         |
| Actual native skill discovery    | 21/21 canonical origins: 19 global and two repository skills; built-in customize-opencode separate |
| Isolated selected MCP invocation | 1/1 SonarQube list_languages call with q=python contains key py, name Python                       |
| Existing-adapter suite           | 6/6 cases pass, zero failures/errors/not-run                                                       |
| Reused owned regressions         | 4/4 existing OpenCode tests and 13/13 owned composition checks pass                                |

The final package differs from independently checked predecessor b22/hc2 in exactly four identity metadata files. All payload bytes, shared executable bits, paths and symlink targets are unchanged. Earlier 4vj-to-409 changes include separately owned browser work: two test files added and one patch removed. Browser execution is outside this acceptance.

The inspected producer retirement receipt accounts for all 818 original mappings: 814 destinations remain present and four map to the same explicitly retired browser patch. Those intentional source retirements are separate from missing required assets; independent final inventory preservation found no missing current source file. Older 5ax, 4vj, 409 and hc2 receipts remain historical.

## Native composition and isolation

The actual global preferences file contains neither `mcp` nor `skills`. The actual global plugin layer equals the emitted `.opencode/opencode.jsonc` plus Chrome's 120000 ms timeout and SonarQube's 60000 ms timeout. All three native effective configurations preserve both server definitions, canonical skill paths and eight selected base preferences. The two declared overlays retain their instruction references. Configuration bytes remain unchanged after inspection.

Actual-profile queries preserve deployed `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=true`. Both MCP servers are disabled before live inspection. The macOS sandbox denies network and writes to all five native profiles and the dotfiles repository; only the exact OpenCode and Git executables may run. Native stdout is captured directly to files to avoid pipe truncation. Only selected fields are published; raw configuration and instruction bodies remain local.

The isolated invocation uses the complete emitted configuration and unchanged `opencode-mcp` adapter. Effective-config preflight disables `plugin.dotfiles.chrome-devtools` before startup. Native execution records exactly one completed `plugin_dotfiles_sonarqube.list_languages` call with `{"q":"python"}`. The returned body independently contains Python; additional languages are allowed. OpenCode provides native tool-error handling rather than an exposed literal `isError=false` envelope. No model or browser process ran, and no token contents were captured.

The 4/4 existing tests cover actual skill output, corruption and ambient-copy rejection, denied/truncated retrieval, MCP errors, excluded startup, managed override preflight and child cleanup. The 13/13 composition checks use an owned package and isolated HOME/XDG roots: a symlinked immutable projection merges with separate preferences and a workspace overlay, then native skill/MCP calls succeed. Missing/corrupt projection files, redirected origins and managed attempts to re-enable an excluded server fail; input bytes are preserved and the profile is removed.

An initial owned negative fixture used an invalid environment-only MCP overlay and failed native per-file validation before reaching its intended origin assertion. It was corrected to a complete native server declaration. An initial tightened live sandbox denied Git project discovery; the final boundary explicitly permits that exact Git binary. Neither was a producer runtime defect.

## Verification and limits

Producer final rebuild exited zero; independent acceptance bound the resulting system, bundle and all five installed roots. Exact-revision CI gates are [tests](https://github.com/Castrozan/.dotfiles/actions/runs/36151874452), [Nix](https://github.com/Castrozan/.dotfiles/actions/runs/36151874465), [evals](https://github.com/Castrozan/.dotfiles/actions/runs/36151874728) and [reports](https://github.com/Castrozan/.dotfiles/actions/runs/36151874471). The earlier retirement revision failed public Darwin evaluation; this successor includes the platform-forwarding fix and the separately owned Sonar complexity correction that held final publication. Follow the linked verdicts when assessing publication completion.

This narrow acceptance verifies OpenCode composition/discovery and isolated selected invocation, plus complete installed identity for all five targets. It does not repeat native invocation on the other four targets, establish browser behavior, measure model adherence or change Codex portable-hook support. Mandatory managed enforcement remains separate. No production registration or configuration was edited by the consumer.

## Repeat

Existing exact store outputs and the emitted SonarQube token-file binding are required. Use a fresh output directory; no source regeneration, package pruning or live registration change is performed.

```sh
npm ci
npm run build
verdr_node=/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node
"$verdr_node" dist/cli.js run evidence/2026-09-25-wiring-retirement/suite.json --output results/wiring-retirement-repeat
```

The suite covers five actual installed identities and one isolated invocation. Actual native profile composition and canonical discovery were inspected separately under the boundary above. The full artifact digest covers the complete package; an additional explicit hash selects mcp.json, while the independent preservation audit checks all 383 declared source files.
