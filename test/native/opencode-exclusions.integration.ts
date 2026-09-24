import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createEnvironment } from "../../src/environment.js";
import { callOpenCodeTool } from "../../src/native/opencode/mcp.js";
import { suiteSchema } from "../../src/suite/schema.js";

test("OpenCode rejects a managed override before starting an excluded server", async (context) => {
  const executable =
    process.env.VERDR_OPENCODE_EXECUTABLE ||
    resolve("node_modules/.bin/opencode");
  const isolated = await createEnvironment([]);
  const previous = process.env;
  process.env = isolated.environment;
  context.after(async () => {
    process.env = previous;
    await rm(isolated.profile, { recursive: true, force: true });
  });
  const packageRoot = join(isolated.workspace, "plugin");
  const managed = join(isolated.profile, "managed");
  await mkdir(packageRoot);
  await mkdir(managed);
  process.env.OPENCODE_TEST_MANAGED_CONFIG_DIR = managed;
  await copyFile(
    new URL("mcp-server.mjs", import.meta.url),
    join(packageRoot, "server.mjs"),
  );
  await writeFile(
    join(packageRoot, "behavior.json"),
    JSON.stringify({ prefix: "native:", isError: false }),
  );
  const marker = join(isolated.profile, "excluded-started");
  const configuration = {
    mcp: {
      selected: {
        type: "local",
        command: [process.execPath, join(packageRoot, "server.mjs")],
        cwd: packageRoot,
        environment: { PLUGIN_ROOT: packageRoot },
      },
      excluded: {
        type: "local",
        command: [process.execPath, join(packageRoot, "server.mjs")],
        cwd: packageRoot,
        environment: { VERDR_TEST_MCP_STARTUP_FILE: marker },
      },
    },
  };
  await writeFile(
    join(isolated.workspace, "opencode.json"),
    JSON.stringify(configuration),
  );
  const evaluation = {
    id: "managed-exclusion",
    kind: "opencode-mcp" as const,
    package: "plugin",
    configuration: "opencode.json",
    executable,
    agent: "build",
    server: "selected",
    disabledServers: ["excluded"],
    tool: "echo",
    arguments: { token: "verified" },
    assert: [{ type: "contains" as const, value: "native:verified" }],
  };
  const input = {
    root: isolated.workspace,
    workspace: isolated.workspace,
    limits: suiteSchema.shape.limits.parse({ timeoutMs: 120_000 }),
  };
  const positive = await callOpenCodeTool(evaluation, input);
  assert.match(positive.output, /native:verified/);
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  await writeFile(
    join(managed, "opencode.json"),
    JSON.stringify({ mcp: { excluded: { enabled: true } } }),
  );
  await assert.rejects(
    callOpenCodeTool(evaluation, input),
    /Native OpenCode did not disable excluded MCP server: excluded/,
  );
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});
