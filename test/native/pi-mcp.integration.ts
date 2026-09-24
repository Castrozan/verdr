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
import { assertNativeProcessExited } from "./process.js";

test("Pi invokes its native MCP adapter, excludes servers before startup, and rejects errors and corrupt output despite a trusted ambient plugin", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-pi-mcp-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  const packageRoot = join(artifact, "plugin");
  await mkdir(packageRoot, { recursive: true });
  await mkdir(join(artifact, ".pi/plugins"), { recursive: true });
  await symlink("../../plugin", join(artifact, ".pi/plugins/native-mcp"));
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "native-mcp",
      version: "1.0.0",
    }),
  );
  const server = join(packageRoot, "server.mjs");
  await copyFile(new URL("mcp-server.mjs", import.meta.url), server);
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
    name: "Pi native MCP",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/server.mjs" }],
    },
    cases: [
      {
        id: "invoke",
        kind: "pi-mcp",
        package: "plugin",
        registration: ".pi/plugins/native-mcp",
        runtimeModules:
          process.env.VERDR_PI_RUNTIME_MODULES ?? resolve("node_modules"),
        server: "native-mcp__probe",
        tool: "echo",
        arguments: { token: "verified" },
        disabledServers: ["native-mcp__excluded"],
        assert: [
          { type: "contains", value: "native:verified" },
          { type: "not-contains", value: "metadata-only-sentinel" },
        ],
      },
    ],
  };
  for (const disabledServers of [[], ["native-mcp__excluded"]]) {
    const output = join(
      root,
      disabledServers.length ? "excluded" : "unrestricted",
    );
    const positive = await runSuite(
      { ...suite, cases: [{ ...suite.cases[0], disabledServers }] },
      output,
    );
    assert.equal(positive.gate, "pass", JSON.stringify(positive));
    assert.equal(positive.artifact.before, positive.artifact.after);
    const raw = JSON.parse(await readFile(join(output, "raw/0.json"), "utf8"));
    const response = raw.results[0].response;
    const result = JSON.parse(response.output);
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.token, "native:verified");
    for (const capability of ["sampling", "elicitation"])
      assert.equal(
        capability in result.structuredContent.clientCapabilities,
        false,
      );
    assert.deepEqual(result.content, [
      { type: "text", text: "native:verified" },
    ]);
    assertNativeProcessExited(result.structuredContent.processId);
    assert.equal(response.metadata.target, "pi");
    assert.equal(response.metadata.modelConsumption, "not-measured");
    assert.equal(response.metadata.adherence, "not-measured");
    assert.deepEqual(response.metadata.composition, {
      scope: "temporary-native-profile",
      disabledServers,
    });
    if (disabledServers.length)
      await assert.rejects(readFile(startupMarker), { code: "ENOENT" });
    else {
      assert.equal(await readFile(startupMarker, "utf8"), "started");
      await rm(startupMarker);
    }
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
  await mkdir(join(ambient, "agent-plugins"));
  await writeFile(
    join(ambient, "agent-plugins/state.json"),
    JSON.stringify({ disabled: [], trusted: ["user:native-mcp"] }),
  );
  const variables = ["PI_AGENT_DIR", "PI_CODING_AGENT_DIR"];
  const previous = variables.map((name) => process.env[name]);
  for (const name of variables) process.env[name] = ambient;
  context.after(() => {
    for (const [index, name] of variables.entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  });
  await writeFile(
    behavior,
    JSON.stringify({ prefix: "native:", isError: true }),
  );
  const failedTool = await runSuite(suite, join(root, "tool-error"));
  assert.equal(failedTool.gate, "fail");
  assert.equal(failedTool.summary.pass, 0);
  await writeFile(server, "process.exit(0);\n");
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
