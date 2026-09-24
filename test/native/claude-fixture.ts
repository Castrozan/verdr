import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export async function claudeFixture(context: {
  after: (callback: () => Promise<void>) => void;
}) {
  const root = await mkdtemp(join(tmpdir(), "verdr-claude-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  for (const directory of [
    ".claude-plugin",
    "plugin/.claude-plugin",
    "plugin/skills/probe/references",
    "plugin/agents",
    "plugin/commands",
    "plugin/com.example",
  ])
    await mkdir(join(artifact, directory), { recursive: true });
  const manifest = { name: "verdr-claude-probe", version: "1.0.0" };
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      ...manifest,
    }),
  );
  await writeFile(
    join(packageRoot, ".claude-plugin/plugin.json"),
    JSON.stringify(manifest),
  );
  await writeFile(
    join(packageRoot, "skills/probe/SKILL.md"),
    "---\nname: probe\ndescription: Verify emitted Claude discovery.\n---\n\n### Task\n\nRead [the answer](references/answer.txt).\n",
  );
  await writeFile(
    join(packageRoot, "skills/probe/references/answer.txt"),
    "fixture",
  );
  await writeFile(
    join(packageRoot, "agents/reviewer.md"),
    "---\nname: reviewer\ndescription: Review the fixture.\n---\n\n### Task\n\nRead the fixture.\n",
  );
  await writeFile(
    join(packageRoot, "commands/check.md"),
    "---\ndescription: Check the fixture.\n---\n\n### Task\n\nRead the fixture.\n",
  );
  await writeFile(
    join(packageRoot, "com.example/opaque.json"),
    '{"preserved":true}',
  );
  await writeFile(
    join(artifact, ".claude-plugin/marketplace.json"),
    JSON.stringify({
      name: "verdr-marketplace",
      owner: { name: "Verdr" },
      plugins: [{ name: manifest.name, source: "./plugin" }],
    }),
  );
  const executable =
    process.env.VERDR_CLAUDE_EXECUTABLE || resolve("node_modules/.bin/claude");
  const suite = {
    schemaVersion: 1,
    name: "Claude native discovery",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/skills/probe/references/answer.txt" }],
    },
    cases: [
      {
        id: "claude",
        kind: "claude-discovery",
        package: "plugin",
        marketplace: ".claude-plugin/marketplace.json",
        plugin: manifest.name,
        executable,
        assert: [
          { type: "contains", value: '"name":"verdr-claude-probe:probe"' },
        ],
      },
    ],
  };
  return { root, artifact, packageRoot, suite, executable };
}
