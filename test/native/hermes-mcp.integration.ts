import assert from "node:assert/strict";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { digest } from "../../src/artifact.js";
import { runSuite } from "../../src/runner.js";

test("Hermes invokes only the selected native MCP server, cleans up children, and rejects errors and corrupt output despite an enabled ambient plugin", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-hermes-mcp-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(packageRoot, { recursive: true });
  await mkdir(join(artifact, ".hermes/plugins"), { recursive: true });
  await symlink("../../plugin", join(artifact, ".hermes/plugins/native-mcp"));
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "native-mcp",
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
  const opaqueFiles = {
    "__init__.py": 'raise RuntimeError("VERDR_OPAQUE_PYTHON_EXECUTED")\n',
    ".claude-plugin/mcp.json": "{foreign and unsupported",
    "skills/probe/SKILL.md":
      "---\nname: probe\ndescription: Native probe.\n---\nKeep this skill.\n",
    "instructions/AGENTS.md": "Retain the complete emitted package.\n",
    "agents/reviewer.md": "---\nname: reviewer\n---\nReview changes.\n",
    "hooks/hooks.json": '{"hooks":{}}\n',
    "workflows/review.yaml": "name: review\nsteps: []\n",
  };
  for (const [path, value] of Object.entries(opaqueFiles)) {
    await mkdir(dirname(join(packageRoot, path)), { recursive: true });
    await writeFile(join(packageRoot, path), value);
  }
  const suite = {
    schemaVersion: 1,
    name: "Hermes native MCP",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/server.mjs" }],
    },
    cases: [
      {
        id: "invoke",
        kind: "hermes-mcp",
        package: "plugin",
        registration: ".hermes/plugins/native-mcp",
        python:
          process.env.VERDR_HERMES_PYTHON ??
          resolve("results/hermes-environment/bin/python3"),
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
  for (const server of ["excluded", "probe"]) {
    const output = join(root, server);
    const positive = await runSuite(
      { ...suite, cases: [{ ...suite.cases[0], server }] },
      output,
    );
    assert.equal(positive.gate, "pass", JSON.stringify(positive));
    assert.equal(positive.artifact.before, positive.artifact.after);
    const raw = JSON.parse(await readFile(join(output, "raw/0.json"), "utf8"));
    const response = raw.results[0].response;
    const result = JSON.parse(response.output);
    assert.equal(result.result, "native:verified");
    assert.equal(result.structuredContent.token, "native:verified");
    const capabilities = result.structuredContent.clientCapabilities;
    assert.equal(Object.hasOwn(capabilities, "sampling"), false);
    assert.equal(Object.hasOwn(capabilities, "elicitation"), false);
    const serverProcessId = result.structuredContent.processId;
    assert.ok(Number.isSafeInteger(serverProcessId) && serverProcessId > 0);
    let serverSurvived = false;
    try {
      process.kill(serverProcessId, 0);
      process.kill(serverProcessId, "SIGKILL");
      serverSurvived = true;
    } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
    }
    assert.equal(serverSurvived, false, "Native MCP child survived");
    const metadata = response.metadata;
    assert.equal(metadata.target, "hermes");
    assert.equal(metadata.server.status, "connected");
    assert.match(
      metadata.server.name,
      new RegExp(`^agent-plugin-native-mcp-[0-9a-f]{8}__${server}$`),
    );
    const otherServer = server === "probe" ? "excluded" : "probe";
    assert.deepEqual(metadata.composition, {
      scope: "temporary-native-profile",
      selectedServer: metadata.server.name,
      disabledServers: [
        metadata.server.name.replace(/__(probe|excluded)$/, `__${otherServer}`),
      ],
      sampling: false,
      elicitation: false,
    });
    if (server === "excluded") {
      assert.equal(await readFile(startupMarker, "utf8"), "started");
      await rm(startupMarker);
    } else await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
    const snapshot = JSON.parse(
      await readFile(join(output, "artifact.json"), "utf8"),
    );
    for (const [path, value] of Object.entries(opaqueFiles)) {
      assert.equal(await readFile(join(packageRoot, path), "utf8"), value);
      assert.equal(
        snapshot.entries.find(
          (entry: { path: string }) => entry.path === `plugin/${path}`,
        ).sha256,
        digest(value),
      );
    }
  }
  const ambient = join(root, "ambient");
  const ambientRoot = join(ambient, "plugins/native-mcp");
  await mkdir(dirname(ambientRoot), { recursive: true });
  await cp(packageRoot, ambientRoot, { recursive: true });
  await writeFile(
    join(ambient, "config.yaml"),
    JSON.stringify({ plugins: { enabled: ["native-mcp"] } }),
  );
  const previous = process.env.HERMES_HOME;
  process.env.HERMES_HOME = ambient;
  context.after(() => {
    if (previous === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = previous;
  });
  await writeFile(
    behavior,
    JSON.stringify({ prefix: "native:", isError: true }),
  );
  const failedTool = await runSuite(suite, join(root, "tool-error"));
  assert.equal(failedTool.gate, "fail");
  assert.equal(failedTool.summary.pass, 0);
  await writeFile(join(packageRoot, "server.mjs"), "process.exit(0);\n");
  const corrupt = await runSuite(suite, join(root, "corrupt"));
  assert.equal(corrupt.gate, "fail");
  assert.equal(corrupt.summary.pass, 0);
  assert.equal(
    await readFile(join(ambientRoot, "server.mjs"), "utf8"),
    await readFile(new URL("mcp-server.mjs", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(ambientRoot, "behavior.json"), "utf8")),
    { prefix: "native:", isError: false },
  );
  await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
});
