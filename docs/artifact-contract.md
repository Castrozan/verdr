# Generated artifact contract

## Responsibility

The producer generates and, where required, composes the package installation. Verdr receives the result and evaluates it. Verdr never reconstructs an instruction from its authoring source to stand in for an emitted asset.

This document defines the integration requirements. It is not an additional Agent Plugins manifest schema. Evaluation metadata belongs in a sidecar outside the package, or in an invocation object, so the standard manifest remains unchanged.

## Required inputs

| Input                        | Meaning                                                                                                                   | Owner                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Artifact root                | Exact generated output, accessible at the paths used by generated configuration.                                          | Producer supplies; Verdr reads.                                     |
| Canonical package roots      | Complete package directories within the generated output.                                                                 | Producer identifies; Verdr validates containment.                   |
| Target installation paths    | Native configuration and discovery paths for each selected harness.                                                       | Producer/deployment adapter identifies.                             |
| Expected component inventory | Intended resolved identifiers, component kinds, source origins, required resources, and capabilities.                     | Consumer expectation plus producer resolution record.               |
| Generation identity          | Source revision or source digest, generator revision, dependency lock identity, selected targets, and composition inputs. | Producer supplies what is available; missing fields remain unknown. |
| Invocation identity          | Unique run identifier, start time, and raw artifact locations.                                                            | Verdr creates.                                                      |
| Evaluation policy            | Required cases and capabilities, freshness windows, evidence minimums, and release thresholds.                            | Consumer declares.                                                  |

An inventory inferred solely from surviving output cannot detect a dropped asset. Compare the consumer's intended inventory with the producer's resolved inventory and the observed output. For a composed installation, include conflict resolution, order, selected dependencies, and the origin of each effective identifier. The package standard is not a federation resolver.

## Artifact identity

Verdr computes content identity over deterministic relative paths, file contents, file kinds, executable permissions, and symlink targets. Record canonical package identity and generated installation identity separately because target adapters can produce additional files or configuration.

Validate resolved path containment before reading assets. Symlinks internal to an output tree must remain distinguishable from undeclared external inputs. Explicit runtime dependencies, such as Nix store executables, are declared environment inputs rather than silently treated as portable package content.

Keep the generated artifact immutable during evaluation. Mutable state and task-produced outputs belong outside it. Capture the artifact identity before and after execution and reject changes to the subject. A result contains the measured identity; deployment verifies that identity before promotion.

Some generated configuration embeds absolute paths. Preserve those paths when launching the harness. If installation must materialize a different tree, record the deployed tree identity and mapping as a distinct subject; do not claim byte-identical evaluation after relocation or rewriting.

## Two evaluation subjects

| Subject                      | Checks                                                                                                             | Claim limit                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Individual generated pack    | Emitted contract, complete resources, identifiers, executable behavior, and injected instruction behavior.         | Does not prove composed precedence or native discovery.                           |
| Resolved native installation | Actual loading, effective component origins, dependencies, conflicts, target-specific behavior, and task outcomes. | Claims apply only to exercised clients, versions, capabilities, and environments. |

Asset availability, native discovery, invocation, adherence, and task success are separate observations. The harness must have no fallback to the authoring source, an existing home installation, or a prior session.

Opaque client extensions remain present even where the runtime does not support them. A capability result is supported-and-exercised, unsupported, or unverified; presence alone cannot promote it to supported. Required unsupported or unverified capabilities prevent a release claim.

## Failure handling

Generation failure, an absent required artifact, identity mismatch, invalid generated configuration, missing evidence, or failed runtime setup must stop the affected gate. None can produce a passing behavioral score through empty output, skipped discovery, or reuse of an earlier result.

Optional targets can be omitted by policy, but reports retain the omitted scope. Partial runs retain every scheduled case and its outcome. Structured raw results take precedence over formatted console output.

## Initial producer integration

The producer is the public dotfiles [plugin-distribution module](https://github.com/Castrozan/.dotfiles/tree/cc645e98857c21cd4ef689a38a81274d0585b237/agent-harness/plugin-distribution). Its entrypoint is `agent-plugin-build SOURCE --output DESTINATION --target TARGET`, also exposed through a Nix `buildPlugin` function. Consume the CLI built from the same producer revision as the fixture; a previously installed CLI can implement an older contract.

The producer handoff defines `BUNDLE/plugin` as the canonical package entrypoint, resolving within the bundle to `.agents/plugins/NAME`. One invocation takes one already-resolved package. No targets means complete package delivery only; repeated target options add discovery adapters. Nix's default targets are Claude, Codex, OpenCode, Pi, and Hermes.

| Target   | Discovery input from the same build                            | Execution boundary to verify                                             |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Claude   | `BUNDLE/.claude-plugin/marketplace.json`                       | Native marketplace installation and enabled components.                  |
| Codex    | `BUNDLE/.agents/plugins/marketplace.json`                      | Native marketplace installation and supported client extensions.         |
| OpenCode | `BUNDLE/.opencode/opencode.jsonc` and generated skill links    | Configuration bridge; this does not execute arbitrary client extensions. |
| Pi       | `BUNDLE/.pi/plugins/NAME` pointing to the complete package     | Installed plugin/MCP loader versions and normal trust/enablement.        |
| Hermes   | `BUNDLE/.hermes/plugins/NAME` pointing to the complete package | An installed release with Agent Plugins support and normal enablement.   |

These are producer handoff requirements, not claims that Verdr has exercised every runtime. Package bytes include opaque extensions, arbitrary resources, and executables. Git metadata is excluded. Contained file symlinks are materialized; directory or external symlinks must be resolved by the producer's input preparation. Adapters may add files while preserving authored bytes.

Generation warnings and doctor diagnostics are retained as evidence and do not automatically invalidate the entire package. A failed installation subprocess still fails generation. Verdr evaluates the required emitted components and reports unsupported execution independently.

Installed native copies live outside the bundle. Capture their identity, effective configuration, loader version, and capability observations separately. The producer does not emit installation receipts; the evaluation invocation supplies this context through the actual deployment/loader path. Keep credentials and unrelated profile data out of records.

An isolated user profile can still inherit system-managed instructions and hooks. Record the effective host configuration and distinguish package behavior from host behavior; a fresh home directory alone does not establish isolation.

OpenCode embeds bundle paths and must consume the bundle in place. Its mutable plugin state is outside the bundle under the target profile's state directory. Each independent trial gets fresh state; persistence is exercised only by cases that declare it.

Source identity for a local CLI input consists of manifest identity and source bytes unless the caller supplies a pinned source reference. Nix adds derivation/store identity and locked renderer dependencies. Verdr records these inputs without inventing a source URL or commit. Composition order, merging, conflict policy, installation, and rollback belong to deployment, not this single-package builder.

The integration spike uses the producer's `__tests__/fixtures/portable-plugin` fixture, which includes client extension metadata as well as a skill, references, and an MCP server exposing the `distribution_echo` tool. Consume its freshly emitted output in place, check the intended and observed inventory, exercise a real native loader, and prove that corrupting generated output is detected while the original source remains valid. Check the producer's verification result for the pinned revision before the spike treats the revised contract as available.

The CLI may orchestrate a consumer-supplied generation command later, but building, measuring, and publishing are separate actions. An evaluation must not publish a package as a side effect.
