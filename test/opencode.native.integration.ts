import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runSuite } from "../src/runner.js";
import { suiteSchema } from "../src/suite.js";

test("OpenCode discovers and invokes emitted skills but rejects corruption and denied execution despite an ambient skill", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-opencode-native-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(join(packageRoot, "skills/probe"), { recursive: true });
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "native-probe",
    }),
  );
  const skill = join(packageRoot, "skills/probe/SKILL.md");
  const content =
    "---\nname: probe\ndescription: Verify actual native skill loading.\n---\n\nVERDR_NATIVE_SENTINEL";
  await writeFile(skill, content);
  const configuration = {
    $schema: "https://opencode.ai/config.json",
    skills: { paths: [join(packageRoot, "skills")] },
  };
  await writeFile(
    join(artifact, "opencode.json"),
    JSON.stringify(configuration),
  );
  await mkdir(join(root, "ambient/skills/probe"), { recursive: true });
  await writeFile(join(root, "ambient/skills/probe/SKILL.md"), content);
  await writeFile(
    join(root, "ambient/opencode.json"),
    JSON.stringify({
      ...configuration,
      skills: { paths: [join(root, "ambient/skills")] },
    }),
  );
  const previousConfiguration = process.env.OPENCODE_CONFIG;
  process.env.OPENCODE_CONFIG = join(root, "ambient/opencode.json");
  context.after(() => {
    if (previousConfiguration === undefined) delete process.env.OPENCODE_CONFIG;
    else process.env.OPENCODE_CONFIG = previousConfiguration;
  });
  const nativeFields = {
    package: "plugin",
    configuration: "opencode.json",
    executable:
      process.env.VERDR_OPENCODE_EXECUTABLE ??
      resolve("node_modules/.bin/opencode"),
    assert: [{ type: "contains", value: "VERDR_NATIVE_SENTINEL" }],
  };
  const suite = {
    schemaVersion: 1,
    name: "OpenCode native contract",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/skills/probe/SKILL.md" }],
    },
    cases: [
      { ...nativeFields, id: "discovery", kind: "opencode-discovery" },
      {
        ...nativeFields,
        id: "invocation",
        kind: "opencode-skill",
        skill: "probe",
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/1.json"), "utf8"),
  );
  const evidence = raw.results[0].response.metadata;
  assert.match(raw.results[0].response.output, /^<skill_content/);
  assert.equal(evidence.execution, "native-debug-tool");
  assert.equal(evidence.adherence, "not-measured");
  assert.equal(evidence.skills.length, 1);
  assert.equal(
    evidence.host.baselineSkills.some(
      (item: { name: string }) => item.name === "probe",
    ),
    false,
  );
  await writeFile(skill, "VERDR_NATIVE_SENTINEL without required frontmatter");
  const corrupted = await runSuite(suite, join(root, "corrupted"));
  assert.equal(corrupted.gate, "fail");
  assert.equal(corrupted.cases[0]!.status, "fail");
  assert.match(corrupted.cases[1]!.reason, /exactly one native skill/);
  await writeFile(skill, content);
  await writeFile(
    join(artifact, "opencode.json"),
    JSON.stringify({ ...configuration, permission: { skill: "deny" } }),
  );
  const denied = await runSuite(suite, join(root, "denied"));
  assert.equal(denied.cases[0]!.status, "pass");
  assert.equal(denied.cases[1]!.status, "error");
  assert.equal(denied.gate, "fail");
  assert.equal(
    suiteSchema.safeParse({ ...suite, environment: ["OPENCODE_CONFIG"] })
      .success,
    false,
  );
});
