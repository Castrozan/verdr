import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectOpenCode } from "../src/opencode/skills.js";

test("skill invocation assertions receive only the returned tool body", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-opencode-output-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, "plugin");
  await mkdir(packageRoot);
  const location = join(packageRoot, "SKILL.md");
  await writeFile(location, "discovered text");
  await writeFile(join(root, "opencode.json"), "{}");
  const executable = join(root, "native-protocol-fixture");
  const discovery = [
    {
      name: "probe",
      description: "probe",
      location,
      content: "discovered text",
    },
  ];
  const invocation = {
    tool: "skill",
    input: { name: "probe" },
    result: {
      output: "different invoked text",
      metadata: { name: "probe", dir: packageRoot, truncated: false },
    },
  };
  await writeFile(
    executable,
    `#!/usr/bin/env node
const value = process.argv.includes("--version") ? "1.18.32" : process.argv.includes("--tool") ? ${JSON.stringify(invocation)} : ${JSON.stringify(discovery)};
process.stdout.write(JSON.stringify(value));
`,
    { mode: 0o755 },
  );
  const response = await inspectOpenCode(
    {
      kind: "opencode-skill",
      id: "probe",
      package: "plugin",
      configuration: "opencode.json",
      executable,
      skill: "probe",
      agent: "build",
      assert: [{ type: "contains", value: "discovered text" }],
    },
    {
      root,
      workspace: root,
      limits: {
        timeoutMs: 5000,
        maxOutputBytes: 10000,
        maxArtifactBytes: 10000,
        maxArtifactEntries: 100,
      },
    },
  );
  assert.equal(response.output, "different invoked text");
  assert.equal(response.output.includes("discovered text"), false);
  assert.equal(response.metadata.skills[0]!.location, await realpath(location));
});
