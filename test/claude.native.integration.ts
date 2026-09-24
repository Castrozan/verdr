import assert from "node:assert/strict";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createEnvironment } from "../src/environment.js";
import { runProcess } from "../src/process.js";
import { runSuite } from "../src/runner.js";
import { claudeFixture } from "./claude-fixture.js";

test("Claude discovers emitted skills, commands and agents, then rejects dropped skills despite a valid ambient installation", async (context) => {
  const { root, artifact, packageRoot, suite, executable } =
    await claudeFixture(context);
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/0.json"), "utf8"),
  );
  const output = JSON.parse(raw.results[0].response.output);
  assert.equal(output.version, "2.1.280 (Claude Code)");
  assert.equal(output.installation.digest, output.installation.emittedDigest);
  assert.equal(output.loading.digest, output.installation.emittedDigest);
  assert.equal(output.loading.source, "emitted-package");
  assert.match(output.installation.root, /plugins\/cache\//);
  assert.ok(
    output.commands.some(
      (item: { name: string }) => item.name === "verdr-claude-probe:check",
    ),
  );
  assert.ok(
    output.agents.some(
      (item: { name: string }) => item.name === "verdr-claude-probe:reviewer",
    ),
  );
  assert.ok(
    output.installation.entries.some(
      (item: { path: string }) => item.path === "com.example/opaque.json",
    ),
  );
  assert.equal(output.execution, "not-measured");
  assert.equal(positive.artifact.before, positive.artifact.after);

  const ambient = await createEnvironment([]);
  context.after(() => rm(ambient.profile, { recursive: true, force: true }));
  const pristine = join(root, "pristine");
  await cp(artifact, pristine, { recursive: true });
  const options = {
    cwd: ambient.workspace,
    env: ambient.environment,
    timeoutMs: 30_000,
    maxOutputBytes: 1_048_576,
  };
  await runProcess(
    executable,
    ["plugin", "marketplace", "add", pristine],
    options,
  );
  await runProcess(
    executable,
    ["plugin", "install", "verdr-claude-probe@verdr-marketplace"],
    options,
  );
  const previous = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = ambient.environment.CLAUDE_CONFIG_DIR;
  try {
    await rm(join(packageRoot, "skills/probe/SKILL.md"));
    const missing = await runSuite(suite, join(root, "missing"));
    assert.equal(missing.gate, "fail");
    assert.equal(missing.summary.expected, 1);
    assert.equal(missing.summary.pass, 0);
    assert.equal(missing.cases[0]!.status, "fail");
    await writeFile(join(packageRoot, ".claude-plugin/plugin.json"), "{broken");
    const invalid = await runSuite(suite, join(root, "invalid"));
    assert.equal(invalid.gate, "fail");
    assert.equal(invalid.summary.error, 1);
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previous;
  }
});
