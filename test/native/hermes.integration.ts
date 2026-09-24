import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { runSuite } from "../../src/runner.js";
import { suiteSchema } from "../../src/suite/schema.js";

test("Hermes discovers canonical emitted skills, returns native content, and rejects corruption and redirected registration despite a valid ambient profile", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-hermes-native-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, ".agents/plugins/native-probe");
  const registration = join(artifact, ".hermes/plugins/native-probe");
  await mkdir(join(packageRoot, "skills/probe/references"), {
    recursive: true,
  });
  await mkdir(dirname(registration), { recursive: true });
  await symlink(".agents/plugins/native-probe", join(artifact, "plugin"));
  await symlink("../../plugin", registration);
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "native-probe",
      version: "1.0.0",
      extensions: { "com.example": { opaque: true } },
    }),
  );
  const skill = join(packageRoot, "skills/probe/SKILL.md");
  const content =
    "---\nname: probe\ndescription: Verify native skill loading.\n---\n\nVERDR_NATIVE_SKILL_BODY\n";
  await writeFile(skill, content);
  const opaqueFiles = {
    "__init__.py": 'raise RuntimeError("VERDR_OPAQUE_PYTHON_EXECUTED")\n',
    ".claude-plugin/plugin.json": "{foreign and unsupported",
    "instructions/AGENTS.md": "Retain the complete emitted package.\n",
    "agents/reviewer.md": "---\nname: reviewer\n---\nReview changes.\n",
    "hooks/hooks.json": '{"hooks":{}}\n',
    "workflows/review.yaml": "name: review\nsteps: []\n",
    "skills/probe/references/answer.txt": "native fixture reference\n",
  };
  for (const [path, value] of Object.entries(opaqueFiles)) {
    await mkdir(dirname(join(packageRoot, path)), { recursive: true });
    await writeFile(join(packageRoot, path), value);
  }
  const ambient = join(root, "ambient");
  await mkdir(join(ambient, "plugins"), { recursive: true });
  await cp(packageRoot, join(ambient, "plugins/native-probe"), {
    recursive: true,
  });
  await writeFile(
    join(ambient, "config.yaml"),
    JSON.stringify({ plugins: { enabled: ["native-probe"] } }),
  );
  const previous = process.env.HERMES_HOME;
  process.env.HERMES_HOME = ambient;
  context.after(() => {
    if (previous === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = previous;
  });
  const nativeFields = {
    package: "plugin",
    registration: ".hermes/plugins/native-probe",
    python:
      process.env.VERDR_HERMES_PYTHON ??
      resolve("results/hermes-environment/bin/python3"),
  };
  const suite = {
    schemaVersion: 1,
    name: "Hermes native contract",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/skills/probe/SKILL.md" }],
    },
    cases: [
      {
        ...nativeFields,
        id: "discovery",
        kind: "hermes-discovery",
        assert: [{ type: "contains", value: ":probe" }],
      },
      {
        ...nativeFields,
        id: "invocation",
        kind: "hermes-skill",
        skill: "probe",
        assert: [{ type: "contains", value: content }],
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  assert.equal(positive.artifact.before, positive.artifact.after);
  for (const index of [0, 1]) {
    const raw = JSON.parse(
      await readFile(join(root, `positive/raw/${index}.json`), "utf8"),
    );
    const response = raw.results[0].response;
    const metadata = response.metadata;
    assert.equal(metadata.target, "hermes");
    assert.equal(metadata.modelConsumption, "not-measured");
    assert.equal(metadata.adherence, "not-measured");
    assert.equal(metadata.skills.length, 1);
    assert.match(
      metadata.skills[0].name,
      /^agent-plugin-native-probe-[0-9a-f]{8}:probe$/,
    );
    assert.equal(metadata.skills[0].filePath, await realpath(skill));
    if (index === 1)
      assert.equal(
        response.output,
        `[Bundle context: This skill is part of the '${metadata.skills[0].name.split(":")[0]}' plugin.]\n\n${content}`,
      );
  }
  const snapshot = JSON.parse(
    await readFile(join(root, "positive/artifact.json"), "utf8"),
  );
  for (const [path, value] of Object.entries(opaqueFiles)) {
    assert.equal(await readFile(join(packageRoot, path), "utf8"), value);
    assert.ok(
      snapshot.entries.some(
        (entry: { path: string }) =>
          entry.path === `.agents/plugins/native-probe/${path}`,
      ),
    );
  }
  const metadataOnly = await runSuite(
    {
      ...suite,
      cases: [
        {
          ...suite.cases[1],
          assert: [{ type: "contains", value: "hermes" }],
        },
      ],
    },
    join(root, "metadata-only"),
  );
  assert.equal(metadataOnly.gate, "fail");
  assert.equal(metadataOnly.cases[0]!.status, "fail");
  await writeFile(skill, "---\nname: [broken\n---\nVERDR_NATIVE_SKILL_BODY\n");
  const corrupted = await runSuite(suite, join(root, "corrupted"));
  assert.equal(corrupted.gate, "fail");
  assert.equal(corrupted.summary.pass, 0);
  assert.equal(
    await readFile(
      join(ambient, "plugins/native-probe/skills/probe/SKILL.md"),
      "utf8",
    ),
    content,
  );
  await writeFile(skill, content);
  await cp(packageRoot, join(artifact, "other-plugin"), { recursive: true });
  await rm(registration);
  await symlink("../../other-plugin", registration);
  const redirected = await runSuite(suite, join(root, "redirected"));
  assert.equal(redirected.gate, "fail");
  assert.equal(redirected.summary.pass, 0);
  for (const result of redirected.cases)
    assert.match(result.reason, /registration.*package/i);
  assert.equal(
    suiteSchema.safeParse({ ...suite, environment: ["HERMES_HOME"] }).success,
    false,
  );
});
