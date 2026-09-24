# Built production bundle evidence, 2026-09-24

Medusa independently evaluated the exact emitted bundle for Carmilla’s migration across Claude, Codex, OpenCode, Pi and Hermes. This subject supersedes the earlier `m8sl` candidate. Activation and published producer provenance were still pending. These results establish isolated emitted-package behavior; actual installed profiles and model adherence remain unverified.

## Identity

| Subject                      | Measured identity                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bundle                       | `/nix/store/br6d3pqcig9d9lcaklk56sc1qfghv6g4-agent-plugin-bundle`                                                                                                              |
| Canonical package            | `plugin` resolves to `.agents/plugins/dotfiles`                                                                                                                                |
| Version                      | `1.0.0+d38c500fa3e3`                                                                                                                                                           |
| Complete bundle digest       | `e66126ec18d1d21adb14f4b98771ea266ad0e5d081a7bd9d4ce3b248f0aac831`                                                                                                             |
| Complete bundle              | 417 regular files, 10,637,957 bytes                                                                                                                                            |
| Canonical package            | 389 files, 10,633,122 bytes                                                                                                                                                    |
| Declared source preservation | 54/54 artifacts, 382/382 files, 10,625,420 bytes and executable bits match; seven generated metadata files complete the package                                                |
| Consumer implementation      | [b35f58afdf56a40a7e7483f7aaf1b5722d5b4f66](https://github.com/Castrozan/verdr/tree/b35f58afdf56a40a7e7483f7aaf1b5722d5b4f66), including the effective OpenCode exclusion check |
| Consumer verification        | [PR16 CI](https://github.com/Castrozan/verdr/actions/runs/35969219638), Node 22.22.2 and 24 passed                                                                             |
| Producer published revision  | Unavailable for this production composition                                                                                                                                    |

The digest covers relative paths, entry kinds, file contents, executable bits and symlink targets. Every native run preserved it. Source preservation validates declared mappings; it does not prove the intended catalog is complete. The supplied runtimes are Codex 0.155.1, Claude 2.1.280, OpenCode 1.18.32, Pi SDK 0.84.1 with pi-agent-plugins 0.1.8 and pi-mcp-adapter 2.34.0, and Hermes 0.21.4. The suites pin their exact store paths.

## Native outcomes

| Target   | Discovery                                        | Supported execution exercised                                 | Boundary                                                          |
| -------- | ------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Codex    | 19/19 intended skills                            | SonarQube MCP 1/1 passed                                      | Native app-server call through the isolated installed plugin      |
| Claude   | 19/19 intended commands plus two native commands | SonarQube MCP 1/1 passed                                      | Native control transport and plugin-owned server                  |
| OpenCode | 19/19 intended package skills                    | Native skill retrieval 1/1 and SonarQube MCP 1/1 passed       | Debug skill/tool APIs; MCP repeated after effective-exclusion fix |
| Pi       | 19/19 intended package skills                    | Native skill queue expansion 1/1 and SonarQube MCP 1/1 passed | Expansion reaches the queue; no model consumption claim           |
| Hermes   | 19/19 intended package skills                    | Native skill retrieval 1/1 and SonarQube MCP 1/1 passed       | `skill_view(preprocess=False)` and native registry invocation     |

The five MCP cases and six separate discovery/skill cases passed with zero errors or unrun cases. Every MCP result independently contained language key `py`, name `Python`, from `sonarqube.list_languages({"q":"python"})`. IPython Notebooks was also returned. No token contents were captured. The skill retrieval/expansion cases used `humanize`.

Codex and Claude exclude `chrome-devtools` before startup. OpenCode disables `plugin.dotfiles.chrome-devtools` and verifies the effective configuration before code-mode execution. Pi clones its full native configuration, changes only `dotfiles__chrome-devtools.disabled=true`, and preserves the generated configuration through shutdown. Hermes clones the complete portable map, enables only SonarQube, and disables sampling and elicitation. These temporary compositions do not establish live registration.

Hermes synthetic native shell-hook checks passed 2/2 through the supplied interpreter: a `write_file` payload targeting `AGENTS.md` was blocked and one targeting `module.py` was allowed. Neither target was created. Native error, timeout and exit status were checked; a missing command was rejected, the bundle stayed unchanged, and the temporary profile was removed. This proves synthetic `run_once` behavior, not agent-loop dispatch or a model turn. Producer-owned Pi/OpenCode bridge checks require their own final deployed receipts.

## Independent controls and migration accounting

| Check                                                     | Observed result                                              | Limit                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Complete copied bundle                                    | Exact digest matched before corruption                       | Only consumer-owned copies were modified                                                                                |
| Corrupt complete digest                                   | Rejected before all five native cases                        | Valid original and ambient config could not conceal corruption                                                          |
| Corrupt required source file, without whole-bundle digest | Rejected before all five native cases                        | Independent expected-file identity was enforced                                                                         |
| Missing required source file, without whole-bundle digest | Rejected before all five native cases                        | No native execution; temporary copy removed                                                                             |
| OpenCode managed override                                 | Native regression failed before the fix and passed afterward | Harmless fixture server never starts when its requested exclusion is overridden                                         |
| Existing OpenCode controls                                | Passed                                                       | Enabled startup, exclusion, native errors, corrupt emitted server with valid ambient copy, origin and cleanup           |
| Prior catalog                                             | 818/818 rows accounted for, zero missing or mode changes     | 493 package mappings identical, 28 changed, 271 retained native files identical, 26 retained repository files identical |

The 28 changed package mappings were reviewed: 22 change link targets or whitespace, three change only core-skill description frontmatter, two update authoring directives to managed plugin paths/names, and one adds managed Codex cache recognition with manifest validation. All 26 repository paths still resolve to old stores. Their intended new destinations match prior bytes for 20/26; the other six contain link/whitespace changes. This is pre-activation accounting, not successful migration. The catalog omits global `AGENTS.md`/`CLAUDE.md` entrypoints, which require separate deployed identity checks.

Portable hooks are unsupported by the pinned Codex portable loader; its managed native hook policy remains separate. Hermes portable discovery does not establish portable hook execution. Arbitrary foreign extensions and model adherence are unmeasured. Missing execution evidence never counts as successful execution.

## Repeat against these exact inputs

The [MCP suite](2026-09-24-built-mcp.json) and skill suites for [OpenCode](2026-09-24-built-opencode.json), [Pi](2026-09-24-built-pi.json), and [Hermes](2026-09-24-built-hermes.json) pin the unchanged complete bundle and supplied runtimes. They require the existing store paths and emitted token-file binding. They do not regenerate packages or change production profiles.

```sh
npm ci
npm run build
verdr_node=/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node
"$verdr_node" dist/cli.js run evidence/2026-09-24-built-mcp.json --output results/built-mcp-repeat
"$verdr_node" dist/cli.js run evidence/2026-09-24-built-opencode.json --output results/built-opencode-repeat
"$verdr_node" dist/cli.js run evidence/2026-09-24-built-pi.json --output results/built-pi-repeat
"$verdr_node" dist/cli.js run evidence/2026-09-24-built-hermes.json --output results/built-hermes-repeat
```

Use fresh output directories. Raw reports contain private instruction bodies and stay local. Final acceptance requires activation, actual installed roots/native profiles, published producer identity and green CI, final catalog/instruction projection checks, and final deployed hook receipts.
