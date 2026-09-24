import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runSuite } from "../src/runner.js";
import { createEnvironment } from "../src/environment.js";
import { runProcess } from "../src/process.js";

test("native installed discovery succeeds, then rejects corrupt output despite a valid ambient cached installation", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-native-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, ".agents/plugins/verdr-native-probe");
  await mkdir(join(packageRoot, "skills/probe/references"), {
    recursive: true,
  });
  await symlink(".agents/plugins/verdr-native-probe", join(artifact, "plugin"));
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "verdr-native-probe",
      version: "1.0.0",
    }),
  );
  const skill = join(packageRoot, "skills/probe/SKILL.md");
  await mkdir(join(packageRoot, ".claude-plugin"));
  await writeFile(join(packageRoot, ".claude-plugin/plugin.json"), "{broken");
  await writeFile(
    skill,
    "---\nname: probe\ndescription: Verify native fixture discovery.\n---\n\n### Task\n\nReturn the [fixture answer](references/answer.txt).\n",
  );
  await writeFile(
    join(packageRoot, "skills/probe/references/answer.txt"),
    "native-fixture",
  );
  await writeFile(
    join(artifact, ".agents/plugins/marketplace.json"),
    JSON.stringify({
      name: "verdr-native-marketplace",
      owner: { name: "Verdr" },
      plugins: [
        {
          name: "verdr-native-probe",
          source: {
            source: "local",
            path: "./.agents/plugins/verdr-native-probe",
          },
        },
      ],
    }),
  );
  const executable = process.env.VERDR_CODEX_EXECUTABLE || "codex";
  const suite = {
    schemaVersion: 1,
    name: "Native discovery",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/skills/probe/SKILL.md" }],
    },
    cases: [
      {
        id: "native",
        kind: "codex-discovery",
        package: "plugin",
        marketplace: ".agents/plugins/marketplace.json",
        plugin: "verdr-native-probe",
        executable,
        assert: [
          {
            type: "regex",
            value: '"skills":\\[\\{"name":"verdr-native-probe:probe"',
          },
        ],
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/0.json"), "utf8"),
  );
  const output = JSON.parse(raw.results[0].response.output);
  assert.equal(output.version, "codex-cli 0.155.1");
  assert.equal(output.installation.digest, output.installation.emittedDigest);
  assert.match(output.skills[0].path, /plugins\/cache\//);
  const ambient = await createEnvironment([]);
  context.after(() => rm(ambient.profile, { recursive: true, force: true }));
  const options = {
    cwd: ambient.workspace,
    env: ambient.environment,
    timeoutMs: 30_000,
    maxOutputBytes: 1_048_576,
  };
  await runProcess(
    executable,
    ["plugin", "marketplace", "add", artifact, "--json"],
    options,
  );
  await runProcess(
    executable,
    ["plugin", "add", "verdr-native-probe@verdr-native-marketplace", "--json"],
    options,
  );
  const previousHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = ambient.environment.CODEX_HOME;
  try {
    await writeFile(skill, "---\nname: [broken\n---\n");
    const negative = await runSuite(suite, join(root, "negative"));
    assert.equal(negative.gate, "fail");
    assert.equal(negative.summary.error, 1);
    assert.match(negative.cases[0]!.reason, /loading errors/);
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
  }
});
