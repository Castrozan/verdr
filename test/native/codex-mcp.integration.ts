import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runSuite } from "../../src/runner.js";
import { createEnvironment } from "../../src/environment.js";
import { runProcess } from "../../src/process.js";

test("Codex calls the installed MCP tool, rejects tool errors, and cannot use an ambient valid copy", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-codex-mcp-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(packageRoot, { recursive: true });
  await mkdir(join(artifact, ".agents/plugins"), { recursive: true });
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "verdr-mcp",
      version: "1.0.0",
    }),
  );
  await writeFile(
    join(artifact, ".agents/plugins/marketplace.json"),
    JSON.stringify({
      name: "verdr-mcp-marketplace",
      owner: { name: "Verdr" },
      plugins: [
        { name: "verdr-mcp", source: { source: "local", path: "./plugin" } },
      ],
    }),
  );
  await copyFile(
    new URL("mcp-server.mjs", import.meta.url),
    join(packageRoot, "server.mjs"),
  );
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
      },
    }),
  );
  const executable = process.env.VERDR_CODEX_EXECUTABLE || "codex";
  const suite = {
    schemaVersion: 1,
    name: "Codex native MCP",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/server.mjs" }],
    },
    cases: [
      {
        id: "invoke",
        kind: "codex-mcp",
        package: "plugin",
        marketplace: ".agents/plugins/marketplace.json",
        plugin: "verdr-mcp",
        executable,
        server: "probe",
        tool: "echo",
        arguments: { token: "verified" },
        assert: [
          { type: "contains", value: "native:verified" },
          { type: "not-contains", value: "metadata-only-sentinel" },
        ],
      },
    ],
  };
  const positive = await runSuite(suite, join(root, "positive"));
  assert.equal(positive.gate, "pass", JSON.stringify(positive));
  const raw = JSON.parse(
    await readFile(join(root, "positive/raw/0.json"), "utf8"),
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
  assert.equal(
    raw.results[0].response.metadata.server.pluginId,
    "verdr-mcp@verdr-mcp-marketplace",
  );
  assert.equal(raw.results[0].response.metadata.adherence, "not-measured");
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
    ["plugin", "marketplace", "add", artifact, "--json"],
    options,
  );
  await runProcess(
    executable,
    ["plugin", "add", "verdr-mcp@verdr-mcp-marketplace", "--json"],
    options,
  );
  const previousHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = ambient.environment.CODEX_HOME;
  try {
    await writeFile(
      behavior,
      JSON.stringify({ prefix: "native:", isError: true }),
    );
    const toolError = await runSuite(suite, join(root, "tool-error"));
    assert.equal(toolError.gate, "fail");
    assert.match(toolError.cases[0]!.reason, /tool returned an error/);
    await writeFile(join(packageRoot, "server.mjs"), "process.exit(0);\n");
    const corrupt = await runSuite(suite, join(root, "corrupt"));
    assert.equal(corrupt.gate, "fail");
    assert.match(corrupt.cases[0]!.reason, /unavailable|does not belong/);
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
  }
});
