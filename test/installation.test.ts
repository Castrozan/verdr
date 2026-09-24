import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runSuite } from "../src/runner.js";
import { suiteSchema } from "../src/suite.js";

test("measures installed bytes independently of intact emitted and ambient packages", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-installation-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "installed-probe",
    }),
  );
  await writeFile(join(packageRoot, "opaque.txt"), "preserved");
  const installedRoot = join(root, "installed");
  await cp(packageRoot, installedRoot, { recursive: true });
  await cp(packageRoot, join(root, "ambient"), { recursive: true });
  const suite = {
    schemaVersion: 1,
    name: "Installed identity",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/opaque.txt" }],
    },
    cases: [
      {
        id: "installed",
        kind: "installed-identity",
        package: "plugin",
        installedRoot,
        target: "pi",
        assert: [{ type: "contains", value: '"scope":"installed-identity"' }],
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/0.json"), "utf8"),
  );
  const evidence = JSON.parse(raw.results[0].response.output);
  assert.equal(evidence.installed.digest, evidence.emitted.digest);
  assert.equal(evidence.execution, "not-measured");
  await writeFile(join(installedRoot, "opaque.txt"), "corrupted");
  const negative = await runSuite(suite, join(root, "corrupt"));
  assert.equal(negative.gate, "fail");
  assert.match(negative.cases[0]!.reason, /differs from the emitted/);
  await rm(join(installedRoot, "opaque.txt"));
  await symlink(
    join(packageRoot, "opaque.txt"),
    join(installedRoot, "opaque.txt"),
  );
  const escaped = await runSuite(suite, join(root, "escape"));
  assert.equal(escaped.gate, "fail");
  assert.match(escaped.cases[0]!.reason, /escapes artifact/);
  await rm(installedRoot, { recursive: true });
  await symlink(packageRoot, installedRoot);
  const linked = await runSuite(suite, join(root, "linked"));
  assert.equal(linked.gate, "pass", JSON.stringify(linked));
  assert.equal(
    suiteSchema.safeParse({
      ...suite,
      cases: [{ ...suite.cases[0], package: "undeclared" }],
    }).success,
    false,
  );
  assert.equal(
    suiteSchema.safeParse({
      ...suite,
      cases: [{ ...suite.cases[0], installedRoot: "relative" }],
    }).success,
    false,
  );
});
