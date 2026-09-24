# Implementation plan

## Outcome

Evaluate the generated instructions, resources, configuration, and native installation that a user receives. Combine this evidence with conventional test outcomes, coverage, mutation results, and run history without merging unlike measurements into one quality score.

The first consumer is the public dotfiles repository. A second, independent fixture repository must work without dotfiles paths, Nix, a marketplace service, or a hosted reporting service.

## Decisions

| Area           | Decision                                                                                                | Reason                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Execution      | Start with Promptfoo through its public API and existing agent providers.                               | It already supports coding agents and skill evaluation; custom SDK runners would duplicate that work.    |
| Package format | Accept Agent Plugins 1.0 and the generator's complete native output.                                    | The tested content must survive generation, composition, and harness delivery.                           |
| Implementation | One TypeScript library and CLI initially, with artifact readers and execution adapters at the boundary. | Keeps evidence rules independent of Promptfoo, Nix, and reporting transports.                            |
| Evidence       | Versioned JSON results referencing retained raw artifacts and content digests.                          | A verdict must identify exactly what it measured.                                                        |
| Reporting      | A local HTML overview and portable JSON; retain links to detailed native reports.                       | The CLI must work without a service and existing consumers should import the same evidence.              |
| Extensibility  | Add adapters for demonstrated producers and consumers.                                                  | Known integrations justify boundaries; a public plugin registry or universal test language does not yet. |
| Distribution   | Generation and installation remain outside Verdr.                                                       | The generator and eval suite must evolve independently without reproducing each other's rules.           |

Use separation of concerns, the dependency inversion principle, and ports and adapters for implementation. The domain owns the evidence contract; vendor SDK objects stay at the boundary.

## Parallel ownership

| Workstream      | Owns                                                                                                                                   | Does not own                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pack generation | Complete package preservation, native output generation, loader registration, generator contract tests, and its dotfiles verification. | Promptfoo configuration, evaluation assertions, evidence gates, or the combined quality report.                                          |
| Verdr           | Artifact intake, identity verification, execution against supplied outputs, conventional result import, comparisons, and reporting.    | Rewriting generator output, resolving package conflicts, changing generated instruction text, or editing the pack-generation workstream. |
| Integration     | A shared fixture, observed loader behavior, and the artifact contract.                                                                 | Concurrent edits to the same checkout or implicit transfer of ownership.                                                                 |

The workstreams exchange artifact roots, resolved component inventory, generation identity, target capabilities, and verification results. A change in the contract needs an explicit handoff before either side depends on it. Later dotfiles integration uses a separate worktree and a reserved set of files; the pack-generation session retains its current files and Git index.

## What gets tested

### Generated package

Run deterministic checks against the emitted package and its declared inventory: manifest conformance, resolved identifiers, expected files, references, executable resources, and declared configuration. Preserve opaque extensions. Unsupported interpretation must not cause deletion or silent success.

Instruction unit evals may inject generated instruction text to isolate its behavior. Such results are labeled as injected evaluations and cannot prove native discovery, registration, hooks, or installation behavior.

### Resolved installation

Run a real target harness in a fresh evaluation environment using the exact generated installation. Include package ordering, dependency selection, identifier conflicts, target configuration, and the same deployment rules used by the consumer.

Evaluate a single pack and an assembled set separately. The generator or deployment owner supplies composition; Verdr checks the resolved inventory and tests the resulting behavior. It does not invent a second dependency resolver.

Use deterministic, synthetic fixtures for discovery and resource checks. Record observed invocation separately from task completion. A file read is evidence of a file read; it does not establish adherence. Inspect task-produced files and final state independently of the agent's self-report.

Keep home configuration, installed plugin caches, retained sessions, and source trees outside the discovery path. Provider configuration must retain the production instruction surface: do not add prompting, structured-output constraints, or settings that accidentally replace the behavior being evaluated.

### Conventional tests

Existing runners execute unit, integration, E2E, platform, and performance tests. Verdr consumes machine-readable results, initially JUnit XML plus selected coverage formats. Preserve test identity, platform, skipped/error states, duration, repetitions, run identity, and links to raw artifacts.

Coverage and mutation tools own measurement. Start with coverage.py branch data and StrykerJS mutation reports for applicable code; other ecosystems remain explicitly unmeasured until supported. Reports must retain measured scope and exclusions. A missing report, empty discovery, malformed XML, or stale file cannot become a pass because the command exited zero.

## Delivery phases

| Phase                                | Deliverable                                                                                                                          | Exit evidence                                                                                                                          | Dependency                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1. Contract and integration spike    | Artifact reader, one public fixture, and a bounded Promptfoo execution against generated output.                                     | A valid case passes; a broken emitted asset is detected despite valid source; no hidden installed copy can rescue it.                  | Generator handoff; no generator rewrite.                   |
| 2. Evidence integrity                | Versioned result schema, expected-case inventory, identity checks, and comparison eligibility.                                       | Missing, stale, mismatched, truncated, errored, and insufficient evidence remain visible and cannot satisfy required gates.            | Phase 1.                                                   |
| 3. Behavioral evaluation             | Injected and native evaluation modes, instruction discovery/adherence/task checks, repeated trials, and target capability reporting. | Real runs on each claimed target; negative discovery controls; generated references, scripts, MCP, and supported extensions exercised. | Stable fixture and verified provider capabilities.         |
| 4. Conventional quality and overview | JUnit import, scoped coverage/mutation import, compatible history, HTML and JSON reporting.                                          | Known pass/fail/error fixtures reconcile with the native producers; drilldowns identify every contributing artifact.                   | Phase 2; parser and UI work can proceed alongside Phase 3. |
| 5. Adoption                          | Independent fixture consumer, dotfiles shadow runs, and gated promotion of measured artifacts.                                       | The same artifact digest is evaluated and deployed; inventories reconcile before replacing existing gates.                             | Phases 3 and 4; separate dotfiles integration ownership.   |

The first spike uses deterministic assertions and explicit call, time, concurrency, and output limits. It must establish provider behavior before expanding the case inventory or paying for a full judge-based run. The plan does not assume that an SDK exercises every CLI hook or client extension; use a CLI or app-server boundary when the behavior requires it.

## Evidence and comparison rules

Each planned case identifies the requirement, subject artifact, target harness, execution mode, required capabilities, evaluator, and expected evidence. Freeze the inventory before execution so missing results cannot disappear from the denominator.

Keep execution outcome and evidence validity separate. Passing, failing, skipped, errored, or cancelled execution can coexist with missing, stale, incompatible, or valid evidence. Unknown does not mean pass. A required unsupported capability blocks a release claim; an optional unsupported capability stays visible.

Record subject and installation digests, cases and assertions, harness version, model and generation settings, judge model and rubric, fixture/environment identity, timestamps, and invocation identity. Detect artifact changes during execution. Costs remain unknown when the producer does not report them reliably.

Compare only compatible profiles and show the compared population. Added, removed, changed, and unmeasured cases remain separate. Freshness applies to individual evidence, not merely the report header. Calibration evidence must match the actual judge and rubric. Repetitions remain visible; retries cannot erase failures.

For instruction effectiveness, run matched conditions with and without the generated instruction surface, keeping task, model, harness, and environment comparable. Report effect size, uncertainty, and sample count. Do not claim improvement from the existence of an experiment or from a nonsignificant result. Thresholds and minimum evidence requirements belong to the consumer's declared policy.

## Acceptance scenarios

| Scenario                                                                         | Required result                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Source is valid; generated metadata is invalid.                                  | Contract check fails before a behavioral success can hide the defect.                        |
| A referenced resource or executable is dropped during generation.                | The expected inventory or behavioral resource check fails.                                   |
| Composition shadows an identifier with another package's asset.                  | Resolved origin is reported and the assembled-installation expectation detects the mismatch. |
| An instruction exists only in source or a global installed cache.                | The fresh native test cannot use it to satisfy discovery.                                    |
| A complete package includes an extension the selected client cannot execute.     | The resource remains intact; execution support is reported independently.                    |
| A model endpoint errors or produces no usable response.                          | Execution records an error or missing evidence rather than a refusal-based pass.             |
| A new required case has no result, or an old result gets a new report timestamp. | Inventory or per-case freshness gate fails.                                                  |
| The judge profile changes but old calibration is supplied.                       | Calibration is incompatible; no current-calibration claim appears.                           |
| A command exits zero with absent, malformed, or pre-existing test XML.           | The conventional evidence gate rejects it.                                                   |
| The artifact is rebuilt or modified after evaluation.                            | Promotion requires matching identity or another evaluation.                                  |

## Community components and decision limits

| Component                                                                                                   | Intended use or alternative                                           | Remaining proof                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Promptfoo](https://www.promptfoo.dev/docs/guides/test-agent-skills/)                                       | Preferred behavioral runner and existing providers.                   | Exact native loading, isolation, artifact evidence, and error semantics in the first spike.                      |
| [Inspect AI](https://inspect.aisi.org.uk/agent-bridge.html)                                                 | Alternative if sandboxed external-agent evaluation dominates.         | Compare against the same fixture if Promptfoo fails a material requirement.                                      |
| [Assay](https://github.com/Rul1an/assay/blob/main/docs/use-cases/evidence-receipts-from-promptfoo-jsonl.md) | Candidate for evidence integrity features.                            | Its documented Promptfoo import is limited to selected binary equals results; prove coverage before adopting it. |
| [Allure](https://allurereport.org/docs/how-it-works/)                                                       | Detailed conventional reports and native result integrations.         | Preserve identities and avoid treating report generation as test execution.                                      |
| [SkillsBench](https://www.skillsbench.ai/blogs/skillsbench-1-1)                                             | Reference for paired instruction experiments and invocation tracking. | Adapt methodology to our own tasks; its benchmark scores are not our quality gate.                               |
| [Agent Plugins 1.0](https://agent-plugins.org/specification)                                                | Portable package contract and extension boundaries.                   | Native support must be exercised per client, version, and capability.                                            |

The research supports this direction, but does not establish runtime interoperability. Phase 1 is the decision gate for implementation scope. A fresh public implementation and synthetic fixtures will express the requirements; company source, private packages, ticket text, and proprietary fixtures are outside the repository.
