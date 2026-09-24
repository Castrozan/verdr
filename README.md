# Verdr

A planned evaluation suite for the agent assets people actually install, with a combined view of instruction effectiveness and conventional test quality.

Verdr will use Promptfoo to run behavioral evaluations against generated packages and native harness installations. Existing test runners will retain ownership of conventional tests. Verdr will validate evidence, compare compatible runs, and report what was tested, what failed, and what remains unmeasured.

This repository currently contains the implementation plan and integration contract. The runner is not implemented.

- [Implementation plan](docs/implementation-plan.md)
- [Generated artifact contract](docs/artifact-contract.md)

Agent Plugins 1.0 supplies the portable package format. Complete packages can contain client extensions and additional resources; preserving a resource and executing it are separate capabilities.

Verdr is independent of any company evaluation package. Its implementation will use public dependencies and original code.
