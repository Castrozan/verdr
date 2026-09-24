import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runSuite } from "../../src/runner.js";
import { suiteSchema } from "../../src/suite/schema.js";

test("Pi discovers and expands exact emitted skills without a model turn and rejects corrupt output despite ambient plugins", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-pi-native-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(join(packageRoot, "skills/probe"), { recursive: true });
  await mkdir(join(artifact, ".pi/plugins"), { recursive: true });
  await symlink("../../plugin", join(artifact, ".pi/plugins/native.probe"));
  const manifest = JSON.stringify({
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: "native.probe",
  });
  await writeFile(join(packageRoot, "plugin.json"), manifest);
  const skill = join(packageRoot, "skills/probe/SKILL.md");
  const content =
    "---\nname: probe\ndescription: Exercise native Pi expansion.\n---\n\nVERDR_PI_NATIVE_SENTINEL";
  await writeFile(skill, content);
  const ambient = join(root, "ambient");
  await mkdir(join(ambient, "plugins/native.probe/skills/probe"), {
    recursive: true,
  });
  await writeFile(join(ambient, "plugins/native.probe/plugin.json"), manifest);
  await writeFile(
    join(ambient, "plugins/native.probe/skills/probe/SKILL.md"),
    content,
  );
  const previous = [process.env.PI_AGENT_DIR, process.env.PI_CODING_AGENT_DIR];
  process.env.PI_AGENT_DIR = ambient;
  process.env.PI_CODING_AGENT_DIR = ambient;
  context.after(() => {
    for (const [index, name] of [
      "PI_AGENT_DIR",
      "PI_CODING_AGENT_DIR",
    ].entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  });
  const nativeFields = {
    package: "plugin",
    registration: ".pi/plugins/native.probe",
    runtimeModules:
      process.env.VERDR_PI_RUNTIME_MODULES ?? resolve("node_modules"),
    assert: [{ type: "contains", value: '"name":"probe"' }],
  };
  const suite = {
    schemaVersion: 1,
    name: "Pi native contract",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/skills/probe/SKILL.md" }],
    },
    cases: [
      { ...nativeFields, id: "discovery", kind: "pi-discovery" },
      {
        ...nativeFields,
        id: "expansion",
        kind: "pi-skill",
        skill: "probe",
        assert: [{ type: "contains", value: "VERDR_PI_NATIVE_SENTINEL" }],
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/1.json"), "utf8"),
  );
  assert.match(raw.results[0].response.output, /^<skill name="probe"/);
  assert.equal(
    raw.results[0].response.metadata.execution,
    "native-skill-expansion-queued",
  );
  assert.equal(raw.results[0].response.metadata.adherence, "not-measured");
  assert.equal(raw.results[0].response.metadata.host.baselineSkills.length, 0);
  await writeFile(skill, "VERDR_PI_NATIVE_SENTINEL without frontmatter");
  const negative = await runSuite(suite, join(root, "negative"));
  assert.equal(negative.gate, "fail");
  assert.equal(negative.summary.pass, 0);
  for (const name of ["PI_AGENT_DIR", "PI_CODING_AGENT_DIR"])
    assert.equal(
      suiteSchema.safeParse({ ...suite, environment: [name] }).success,
      false,
    );
});
