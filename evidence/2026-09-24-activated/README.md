# Activated production acceptance, 2026-09-24

Medusa independently evaluated Carmilla's activated migration across Claude, Codex, OpenCode, Pi and Hermes. Independent final acceptance passes within the scopes below. The deployed OpenCode environment is part of profile identity. All four producer CI workflows passed for the exact published revision.

| Identity                 | Evidence                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle                   | `/nix/store/5ax9bd536gi5rrs314py6baklsdp9168-agent-plugin-bundle`                                                                                                     |
| Version                  | `1.0.0+c052434cf2ca`                                                                                                                                                  |
| Complete digest          | `87d3837d362d62b7565c2c5881a9a847a9257500133c1f39c270a15b2681a4ee`                                                                                                    |
| Canonical package digest | `4fd7443acea475e392f8fe8f2cc2df64a0de456f3a27326da47a399592053893`                                                                                                    |
| Preservation             | 54/54 declared artifacts, 382/382 source files; bytes and executable bits match                                                                                       |
| Complete package         | 389 files, 10,633,108 bytes, including seven generated metadata files                                                                                                 |
| Complete bundle          | 417 regular files, 10,637,943 bytes                                                                                                                                   |
| Activated system         | `/nix/store/hv71ncxx9y9hkk0s5bfxz2cdxz95dyqr-darwin-system-25.11.ebec37a`                                                                                             |
| Producer revision        | [0bbd2470](https://github.com/Castrozan/.dotfiles/commit/0bbd2470ef410e62654a2ed6be5920a448f13a45)                                                                    |
| Consumer implementation  | [49caa267](https://github.com/Castrozan/verdr/tree/49caa2670a545740515e508a7f446c5aec83a539), [green CI](https://github.com/Castrozan/verdr/actions/runs/35970644516) |

The full digest includes paths, entry types, file bytes, executable bits and symlink targets. Compared with the prior ymq subject, 12 files changed and no file was added or removed. Source preservation independently covers all 382 declared files and 10,625,406 bytes; the prior digest is not reused. Every final consumer check preserved the new digest. Public producer source identifies the implementation; it does not invent provenance for private composition inputs.

## Actual profiles and isolated execution

| Target                                          | Actual-profile evidence                                                                                                                             | Isolated native execution on the complete final package    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Codex 0.155.1                                   | Enabled installed plugin; 19/19 intended enabled skills from final native cache; complete installed identity passes                                 | SonarQube MCP 1/1                                          |
| Claude 2.1.280                                  | Final package selected through stable source; 19/19 intended skills plus two packaged commands; zero loading errors; complete cache identity passes | SonarQube MCP 1/1                                          |
| OpenCode 1.18.32                                | 19/19 global and 2/2 repository skills resolve into the final package with the declared production environment                                      | Discovery and skill retrieval 2/2; SonarQube MCP 1/1       |
| Pi SDK 0.84.1, loader 0.1.8, MCP adapter 2.34.0 | Actual user plugin enabled/trusted at final root; SDK discovers 19/19 skills; zero diagnostics; installed identity passes                           | Discovery and skill queue expansion 2/2; SonarQube MCP 1/1 |
| Hermes 0.21.4                                   | Native directory-manifest scan selects final user package and configured load gate; installed identity passes                                       | Discovery and skill retrieval 2/2; SonarQube MCP 1/1       |

The suite passed 16/16 cases: five actual installed-tree identities, five isolated MCP invocations, and six isolated discovery/skill checks. Each MCP result independently contains language key `py`, name `Python`, from `sonarqube.list_languages({"q":"python"})`. IPython Notebooks is also present. Skill cases retrieve or expand `humanize` without a model turn. Actual native discovery was measured separately from complete installed identity.

Actual-profile queries ran under macOS write protection for the five profiles and repository, with network denied. OpenCode preserved the deployed `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=true` value, independently verified in session variables and the inherited environment. Claude used explicit runtime MCP denials, strict configuration and disabled hooks, returning zero MCP servers. Codex used disposable `CODEX_SQLITE_HOME`; its valid existing installation identity required a native read/write open, but bytes, mode, inode and modification time remained unchanged. Pi used native read-only registry scanning plus SDK skill loading, without extension initialization. Hermes actual evidence stops at native manifest discovery because full discovery writes configuration backups and MCP projections. Its full component checks therefore remain isolated.

Fresh MCP profiles retain established startup exclusions: Codex/Claude disable the plugin Chrome server; OpenCode disables `plugin.dotfiles.chrome-devtools` and checks its effective value; Pi clones the complete native configuration and only disables `dotfiles__chrome-devtools`; Hermes preserves its complete portable map, selects SonarQube and disables sampling/elicitation. No browser MCP or model call ran. No token contents were captured.

## Controls and migration accounting

Complete emitted-copy controls rejected changed digest, changed required source and missing required source before any of five native cases started, despite a valid ambient original. Copies of all five actual installed trees passed identity, then rejected changed bytes, a missing asset and a symlink to the valid ambient asset: 15/15 negatives. Original trees remained unchanged and temporary copies were removed.

The independent prior-catalog comparison accounts for 818/818 paths: 493 identical package mappings, 28 reviewed package changes, 271 identical retained native files, 20 identical repository files and six reviewed repository link/whitespace changes. There are no missing files or executable-bit changes. All 26 repository file origins and all four repository directory links resolve into the final package. Seven generated instruction/configuration files match expected bytes and executable bits. Both retired repository backup directories are absent from discovery. All 13 archived files match the supplied before snapshot in bytes and executable bits.

Hermes' actual configured pre-tool command passed independent native `run_once` cases 2/2 at its unchanged 10-second limit: an AGENTS.md write payload blocks, while module.py allows. Calls took 0.408s and 0.270s. No target file was written. A missing command was rejected, the bundle remained unchanged and the temporary profile was removed. Producer evidence retains two earlier approximately 10.6-second timeouts; no root cause is established. This is synthetic native dispatch, not post-tool or model adherence evidence.

Portable Codex hooks remain unsupported by its pinned portable loader; retained native hook policy is separate. Hermes portable discovery does not prove portable hook execution. Arbitrary foreign extensions and model adherence remain unmeasured.

## Composition controls and producer verification

The initial consumer OpenCode probe stripped every `OPENCODE_*` variable. In two processes, that altered composition selected a retained Claude synced `docs` skill over the packaged skill. Its SHA-256 is `a8ada0a3a3978536d2177fbc2bea71aa06f28818d2adb3980dd6e434488835be`; the intended package skill is `09ae801d14d53c9911b42ba53bfbc2c7a3e02c62d43bfd9d14f8726dee2915df`. Those failures are negative composition controls, not deployed-profile outcomes.

The declared production environment already sets `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=true`. Preserving that existing value produced 21/21 canonical origins: 19 global skills and two repository skills. No producer change, asset pruning or origin-check exception was required. Consumer profile identity includes this environment binding as well as configuration, registrations and package bytes.

Pinned OpenCode [scans external roots before explicit skills.paths](https://github.com/anomalyco/opencode/blob/545f51d26cc39a907d2867492d498d9607ea5fa4/packages/opencode/src/skill/index.ts#L185), then [loads collected paths concurrently](https://github.com/anomalyco/opencode/blob/545f51d26cc39a907d2867492d498d9607ea5fa4/packages/opencode/src/skill/index.ts#L235). Duplicate-name scan order does not establish precedence. The deployed native setting excludes the competing Claude skill scope before loading.

Producer [evals](https://github.com/Castrozan/.dotfiles/actions/runs/35982623447), [reports](https://github.com/Castrozan/.dotfiles/actions/runs/35982623454), [tests](https://github.com/Castrozan/.dotfiles/actions/runs/35982623506) and [Nix checks](https://github.com/Castrozan/.dotfiles/actions/runs/35982623459) all passed for `0bbd2470ef410e62654a2ed6be5920a448f13a45`.

## Repeat

The adjacent installed, MCP, OpenCode, Pi and Hermes suites pin the exact full digest and native runtimes. They preserve complete packages and require existing production store outputs and emitted token-file binding. Each suite's cases are identical to those exercised in the 16-case run. Public suites retain the complete bundle digest and select only the MCP file for an additional explicit file-hash check; the independent preservation audit checked all 382 declared source files.

```sh
npm ci
npm run build
verdr_node=/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node
"$verdr_node" dist/cli.js run evidence/2026-09-24-activated/installed.json --output results/final-installed
"$verdr_node" dist/cli.js run evidence/2026-09-24-activated/mcp.json --output results/final-mcp
"$verdr_node" dist/cli.js run evidence/2026-09-24-activated/opencode.json --output results/final-opencode
"$verdr_node" dist/cli.js run evidence/2026-09-24-activated/pi.json --output results/final-pi
"$verdr_node" dist/cli.js run evidence/2026-09-24-activated/hermes.json --output results/final-hermes
```

Use fresh output directories. Raw native reports include private instruction bodies and remain local. The suites cover installed identity and isolated native execution; actual-profile discovery and its declared environment remain independent acceptance gates.
