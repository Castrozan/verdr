import assert from "node:assert/strict";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createEnvironment } from "../../src/environment.js";
import { runProcess } from "../../src/process.js";
import { runSuite } from "../../src/runner.js";
import { claudeFixture } from "./claude-fixture.js";

test("Claude invokes its plugin MCP, rejects server error flags, and ignores a valid ambient copy when emitted code is corrupt", async (context) => {
  const fixture = await claudeFixture(context);
  const { root, packageRoot, artifact, executable } = fixture;
  await copyFile(
    new URL("mcp-server.mjs", import.meta.url),
    join(packageRoot, "server.mjs"),
  );
  const startupMarker = join(root, "excluded-started");
  const behavior = join(packageRoot, "behavior.json");
  await writeFile(
    behavior,
    JSON.stringify({ prefix: "native:", isError: false }),
  );
  await writeFile(
    join(packageRoot, "mcp.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        probe: {
          type: "stdio",
          command: "node",
          args: ["${PLUGIN_ROOT}/server.mjs"],
        },
        excluded: {
          type: "stdio",
          command: "node",
          args: ["${PLUGIN_ROOT}/server.mjs"],
          env: { VERDR_TEST_MCP_STARTUP_FILE: startupMarker },
        },
      },
    }),
  );
  await writeFile(
    join(packageRoot, ".claude-plugin/mcp.json"),
    JSON.stringify({
      mcpServers: {
        probe: {
          type: "stdio",
          command: "node",
          args: ["${CLAUDE_PLUGIN_ROOT}/server.mjs"],
        },
        excluded: {
          type: "stdio",
          command: "node",
          args: ["${CLAUDE_PLUGIN_ROOT}/server.mjs"],
          env: { VERDR_TEST_MCP_STARTUP_FILE: startupMarker },
        },
      },
    }),
  );
  await writeFile(
    join(packageRoot, ".claude-plugin/plugin.json"),
    JSON.stringify({
      name: "verdr-claude-probe",
      version: "1.0.0",
      mcpServers: "./.claude-plugin/mcp.json",
    }),
  );
  const suite = {
    ...fixture.suite,
    cases: [
      {
        ...fixture.suite.cases[0],
        id: "invoke",
        kind: "claude-mcp",
        server: "probe",
        disabledServers: ["excluded"],
        tool: "echo",
        arguments: { token: "verified" },
        assert: [
          { type: "contains", value: "native:verified" },
          { type: "not-contains", value: "metadata-only-sentinel" },
        ],
      },
    ],
  };
  const unrestricted = await runSuite(
    { ...suite, cases: [{ ...suite.cases[0], disabledServers: [] }] },
    join(root, "unrestricted"),
  );
  assert.equal(unrestricted.gate, "pass", JSON.stringify(unrestricted));
  assert.equal(await readFile(startupMarker, "utf8"), "started");
  await rm(startupMarker);
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/0.json"), "utf8"),
  );
  assert.equal(raw.results[0].response.metadata.server.source, "plugin");
  assert.equal(raw.results[0].response.metadata.server.status, "connected");
  assert.deepEqual(
    raw.results[0].response.metadata.composition.disabledServers,
    suite.cases[0]!.disabledServers,
  );
  const serverProcessId = JSON.parse(raw.results[0].response.output)
    .structuredContent.processId;
  let serverSurvived = false;
  try {
    process.kill(serverProcessId, 0);
    process.kill(serverProcessId, "SIGKILL");
    serverSurvived = true;
  } catch (error) {
    assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
  }
  assert.equal(
    serverSurvived,
    false,
    "Native MCP server survived the evaluation profile",
  );
  const ambient = await createEnvironment([]);
  context.after(() => rm(ambient.profile, { recursive: true, force: true }));
  const options = {
    cwd: ambient.workspace,
    env: ambient.environment,
    timeoutMs: 30000,
    maxOutputBytes: 1048576,
  };
  await runProcess(
    executable,
    ["plugin", "marketplace", "add", artifact],
    options,
  );
  await runProcess(
    executable,
    ["plugin", "install", "verdr-claude-probe@verdr-marketplace"],
    options,
  );
  const previousProfile = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = ambient.environment.CLAUDE_CONFIG_DIR;
  try {
    await writeFile(
      behavior,
      JSON.stringify({ prefix: "native:", isError: true }),
    );
    const failedTool = await runSuite(suite, join(root, "tool-error"));
    assert.equal(failedTool.gate, "fail");
    assert.match(failedTool.cases[0]!.reason, /Claude control error/);
    await writeFile(join(packageRoot, "server.mjs"), "process.exit(0);\n");
    const corrupt = await runSuite(suite, join(root, "corrupt"));
    assert.equal(corrupt.gate, "fail");
    assert.match(
      corrupt.cases[0]!.reason,
      /Claude control error|does not belong/,
    );
    await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
  } finally {
    if (previousProfile === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previousProfile;
  }
});
