import assert from "node:assert/strict";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runSuite } from "../../src/runner.js";

test("OpenCode invokes the configured package MCP and rejects errors, corrupt servers, and redirected package origins", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-opencode-mcp-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "verdr-opencode-mcp",
      version: "1.0.0",
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
  const startupMarker = join(root, "excluded-started");
  const configuration = {
    $schema: "https://opencode.ai/config.json",
    mcp: {
      "plugin.verdr.excluded": {
        type: "local",
        command: ["node", join(packageRoot, "server.mjs")],
        cwd: packageRoot,
        environment: { VERDR_TEST_MCP_STARTUP_FILE: startupMarker },
      },
      "plugin.verdr.probe": {
        type: "local",
        command: ["node", join(packageRoot, "server.mjs")],
        cwd: packageRoot,
        environment: { PLUGIN_ROOT: packageRoot },
      },
    },
  };
  const configPath = join(artifact, "opencode.jsonc");
  await writeFile(configPath, JSON.stringify(configuration));
  const suite = {
    schemaVersion: 1,
    name: "OpenCode native MCP",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/server.mjs" }],
    },
    cases: [
      {
        id: "invoke",
        kind: "opencode-mcp",
        package: "plugin",
        configuration: "opencode.jsonc",
        executable:
          process.env.VERDR_OPENCODE_EXECUTABLE ||
          resolve("node_modules/.bin/opencode"),
        server: "plugin.verdr.probe",
        disabledServers: ["plugin.verdr.excluded"],
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
  assert.equal(raw.results[0].response.metadata.calls[0].status, "completed");
  assert.equal(
    raw.results[0].response.metadata.origin,
    "native-configuration-package-root",
  );
  assert.deepEqual(
    raw.results[0].response.metadata.composition.disabledServers,
    suite.cases[0]!.disabledServers,
  );
  const serverProcessId = JSON.parse(raw.results[0].response.output).processId;
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
  const ambient = join(root, "ambient.json");
  const ambientRoot = join(root, "ambient-plugin");
  await cp(packageRoot, ambientRoot, { recursive: true });
  const ambientConfiguration = structuredClone(configuration);
  ambientConfiguration.mcp["plugin.verdr.probe"].command = [
    "node",
    join(ambientRoot, "server.mjs"),
  ];
  ambientConfiguration.mcp["plugin.verdr.probe"].cwd = ambientRoot;
  ambientConfiguration.mcp["plugin.verdr.probe"].environment.PLUGIN_ROOT =
    ambientRoot;
  await writeFile(ambient, JSON.stringify(ambientConfiguration));
  const previousConfig = process.env.OPENCODE_CONFIG;
  process.env.OPENCODE_CONFIG = ambient;
  try {
    await writeFile(
      behavior,
      JSON.stringify({ prefix: "native:", isError: true }),
    );
    const failedTool = await runSuite(suite, join(root, "tool-error"));
    assert.equal(failedTool.gate, "fail");
    assert.match(failedTool.cases[0]!.reason, /Command exited/);
    await writeFile(join(packageRoot, "server.mjs"), "process.exit(0);\n");
    const corrupt = await runSuite(suite, join(root, "corrupt"));
    assert.equal(corrupt.gate, "fail");
    assert.match(corrupt.cases[0]!.reason, /Command exited/);
    configuration.mcp["plugin.verdr.probe"].environment.PLUGIN_ROOT = root;
    await writeFile(configPath, JSON.stringify(configuration));
    const redirected = await runSuite(suite, join(root, "redirected"));
    assert.equal(redirected.gate, "fail");
    assert.match(
      redirected.cases[0]!.reason,
      /does not bind the emitted package/,
    );
    await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
  } finally {
    if (previousConfig === undefined) delete process.env.OPENCODE_CONFIG;
    else process.env.OPENCODE_CONFIG = previousConfig;
  }
});
