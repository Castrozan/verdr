# Production candidate evidence, 2026-09-24

Medusa recorded these independent consumer checks during a migration across Claude, Codex, OpenCode, Pi and Hermes. The supplied bundle was an unpublished, undeployed candidate. Final installed profiles and producer revision were unavailable. These results do not establish deployment, model consumption or instruction adherence.

## Identities

| Subject                     | Measured identity                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer implementation     | [Verdr 801b1ab806c8d767ca61f565ca6b21ba7030534e](https://github.com/Castrozan/verdr/tree/801b1ab806c8d767ca61f565ca6b21ba7030534e), identical source tree to the Pi branch used for the first invocation |
| Public verification         | [Main CI 35963956337](https://github.com/Castrozan/verdr/actions/runs/35963956337), Node 22.22.2 and 24 passed                                                                                           |
| Candidate bundle            | `/nix/store/m8sl8lq238zdlg6q4d6vy2g59vc1x97r-agent-plugin-bundle`                                                                                                                                        |
| Package version             | `1.0.0+899fa52f618d`                                                                                                                                                                                     |
| Complete bundle digest      | `4f2b88e6b85d84346084a2bfe206ae94dae78d0b030eb921ebca685f5f677a0c`, unchanged before and after native cases                                                                                              |
| Producer published revision | Unknown for this candidate                                                                                                                                                                               |
| Pi runtime modules          | `/nix/store/djlflw98ki3s41l20rs4hi8yliiv4qzh-dotfiles-pi-plugin-loaders-node-modules-0.0.0/node_modules`                                                                                                 |
| Pi package versions         | SDK 0.84.1, pi-agent-plugins 0.1.8, pi-mcp-adapter 2.34.0                                                                                                                                                |
| Node executable             | `/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node`, version 22.22.2                                                                                                                   |
| Hermes interpreter          | `/nix/store/7nv87ahk1ll96dqdj1p31wf7al4n1z63-hermes-agent-env/bin/python3`                                                                                                                               |
| Hermes version and source   | 0.21.4, [upstream d337b736aa1e8ebecfab043842d13e4a2d2f48a3](https://github.com/NousResearch/hermes-agent/tree/d337b736aa1e8ebecfab043842d13e4a2d2f48a3)                                                  |

The bundle digest covers relative paths, file contents, entry kinds, executable permissions and symlink targets. The Pi runtime was independently checked after the producer identified it as the system-selected build. Its activation was still pending.

## Native candidate observations

| Check                                | Result                                                       | Scope and limit                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pi MCP                               | 1/1 passed; `isError=false`, language `py / Python` present  | Native plugin trust and MCP tool execution from a temporary profile; emitted package and native configuration preserved through shutdown |
| Hermes MCP                           | 1/1 passed; language `py / Python` present                   | Native portable plugin manager and tool registry; unchanged native JSON rendering retained                                               |
| Hermes discovery and skill retrieval | 2/2 passed; 19/19 intended skills at canonical package paths | Native discovery and `skill_view(preprocess=False)` for `humanize`; no model turn                                                        |
| Hermes shell hook                    | 2/2 synthetic cases passed                                   | Public `run_once`: `write_file` targeting `AGENTS.md` blocked, `module.py` allowed; neither target created                               |
| Missing Hermes hook command          | 1/1 rejected                                                 | A null parsed action cannot count as allow when native execution reports an error                                                        |

The published suite was repeated against the supplied candidate and passed 2/2 cases with zero errors and unchanged bundle identity. Both MCP cases call only `sonarqube.list_languages` with `{"q":"python"}`. Results include Python and IPython Notebooks. Token contents were neither read nor captured.

Pi clones the complete native configuration and changes only `dotfiles__chrome-devtools.disabled=true` before adapter startup. Hermes clones the complete portable server map, enables the selected SonarQube server, and disables sampling and elicitation. These are isolated invocation compositions; they do not prove live registration.

The Hermes hook check used the exact interpreter with `-I -B`, an isolated home, Hermes home and marker directory, and no `BASH_ENV` or `PYTHONPATH`. Both positive cases required exit 0, no native error, no timeout and the expected action. The complete bundle remained unchanged and the temporary profile was removed. Final deployed-command repetition belongs to the producer.

## Controls and inventory accounting

| Evidence                                   | Observed result                                                          | Acceptance boundary                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact Pi runtime, compiled consumer worker | 1/1 test passed                                                          | Enabled-server startup positive, pre-start exclusion, native tool error, corrupted emitted server with valid trusted ambient copy, configuration preservation and child cleanup |
| Exact Pi runtime, shutdown regression      | 1/1 test passed                                                          | A native shutdown-handler exception causes failure                                                                                                                              |
| Declared source preservation               | 54/54 declared artifacts, 382/382 source files, 10,624,040 bytes matched | Bytes and executable bits match source declarations; seven generated metadata files complete the 389-file package                                                               |
| Prior catalog                              | 818/818 rows accounted for; zero missing files or execute-bit changes    | 496 package mappings identical, 25 package mappings changed, 271 native files identical, 26 repository-scope files identical                                                    |
| Independent catalog controls               | 8/8 passed                                                               | Missing/corrupt emitted assets despite valid ambient copies, mode drift, unknown or ambiguous mappings, escaping symlinks, and canonical repository origins                     |

The 25 changed mappings require content review. All 26 repository-scope files still resolved to pre-activation origins. Matching bytes alone therefore cannot prove migration to the new package. The catalog contains no global `AGENTS.md` or `CLAUDE.md` entrypoints; deployed instruction projections require separate identity evidence. None of these counts proves that the intended source catalog is complete.

Public native tests cover discovery and MCP paths for all five harnesses. Earlier Claude, Codex and OpenCode candidate MCP positives preceded the stricter pre-start exclusion scope; final acceptance must repeat them with the published exclusions. Portable hooks, native bridge hooks, direct invocation and model adherence remain separate capabilities.

## Repeat the selected MCP cases

The [candidate suite](2026-09-24-candidate-mcp.json) pins the complete bundle digest, emitted MCP declaration and exact runtimes. It requires those supplied store paths and the existing emitted token-file binding. It does not generate, install or repair production packages.

```sh
npm ci
npm run build
/nix/store/jsknrd8z1i9d2dxz5bph6g2gickv5q2j-nodejs-22.22.2/bin/node dist/cli.js run evidence/2026-09-24-candidate-mcp.json --output results/candidate-mcp-repeat
```

Choose a fresh output directory. Raw local reports can contain private instruction bodies and are excluded from this publication. Final acceptance requires the activated bundle, published producer identity, actual installed profiles, complete intended inventory and repeated native checks against those exact outputs.
