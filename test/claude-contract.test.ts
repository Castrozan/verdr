import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { prepareClaudeInstallation } from "../src/claude/installation.js";
import { suiteSchema } from "../src/suite/schema.js";
import { claudeFixture } from "./native/claude-fixture.js";

test("Claude discovery requires a declared package and refuses profile inheritance", async (context) => {
  const { suite } = await claudeFixture(context);
  assert.throws(
    () =>
      suiteSchema.parse({
        ...suite,
        artifact: { ...suite.artifact, packages: ["another"] },
      }),
    /declared artifact package/,
  );
  assert.throws(
    () => suiteSchema.parse({ ...suite, environment: ["CLAUDE_CONFIG_DIR"] }),
    /Reserved isolation/,
  );
});

test("Claude marketplace selection cannot redirect evaluation to another package or external source", async (context) => {
  const { root, artifact, suite } = await claudeFixture(context);
  await mkdir(join(artifact, "another"));
  const parsed = suiteSchema.parse(suite);
  const evaluation = parsed.cases[0]!;
  assert.equal(evaluation.kind, "claude-discovery");
  if (evaluation.kind !== "claude-discovery")
    throw new Error("Expected Claude case");
  for (const source of ["./another", "../outside"]) {
    await mkdir(join(root, "outside"), { recursive: true });
    await writeFile(
      join(artifact, ".claude-plugin/marketplace.json"),
      JSON.stringify({
        name: "verdr-marketplace",
        plugins: [{ name: "verdr-claude-probe", source }],
      }),
    );
    await assert.rejects(
      prepareClaudeInstallation(evaluation, {
        root: artifact,
        workspace: root,
        limits: parsed.limits,
      }),
      source === "./another" ? /requested emitted package/ : /escapes artifact/,
    );
  }
});
