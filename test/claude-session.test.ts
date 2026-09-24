import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { queryClaude } from "../src/native/claude/session.js";

async function fakeClaude(
  context: { after: (callback: () => Promise<void>) => void },
  mode: string,
) {
  const root = await mkdtemp(join(tmpdir(), "verdr-claude-session-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, "claude");
  const workspace = join(root, "workspace");
  await mkdir(workspace);
  const receipt = join(root, "requests.jsonl");
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require('node:fs');
const readline = require('node:readline');
const mode = ${JSON.stringify(mode)};
readline.createInterface({input: process.stdin}).on('line', line => {
  fs.appendFileSync(${JSON.stringify(receipt)}, line + '\\n');
  const request = JSON.parse(line);
  if (mode === 'timeout') return;
  if (mode === 'overflow') { process.stderr.write('x'.repeat(20000)); return; }
  const response = request.request.subtype === 'initialize'
    ? {commands: [], agents: [], models: []}
    : {commands: [], agents: [], plugins: [], mcpServers: [], error_count: mode === 'load-error' ? 1 : 0};
  if (mode === 'invalid' && request.request.subtype !== 'initialize') delete response.plugins;
  process.stdout.write(JSON.stringify({type: 'control_response', response: {subtype: 'success', request_id: request.request_id, response}}) + '\\n');
});
`,
    { mode: 0o755 },
  );
  return { executable, workspace, receipt };
}

const limits = {
  timeoutMs: 3000,
  maxOutputBytes: 10000,
  maxArtifactBytes: 10000,
  maxArtifactEntries: 100,
};

test("Claude discovery exchanges only control requests and never submits a model prompt", async (context) => {
  const { executable, workspace, receipt } = await fakeClaude(context, "valid");
  const result = await queryClaude(
    executable,
    workspace,
    { PATH: process.env.PATH },
    limits,
  );
  assert.equal(result.error_count, 0);
  const requests = (await readFile(receipt, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    requests.map((request) => request.type),
    ["control_request", "control_request"],
  );
  assert.deepEqual(
    requests.map((request) => request.request.subtype),
    ["initialize", "reload_plugins"],
  );
});

test("Claude loading errors and incompatible evidence cannot become a discovery pass", async (context) => {
  for (const mode of ["load-error", "invalid"]) {
    const { executable, workspace } = await fakeClaude(context, mode);
    await assert.rejects(
      queryClaude(executable, workspace, { PATH: process.env.PATH }, limits),
      mode === "load-error" ? /loading errors/ : /plugins/,
    );
  }
});

test("Claude protocol bounds include stderr and a nonresponding native process", async (context) => {
  for (const mode of ["overflow", "timeout"]) {
    const { executable, workspace } = await fakeClaude(context, mode);
    const started = performance.now();
    await assert.rejects(
      queryClaude(
        executable,
        workspace,
        { PATH: process.env.PATH },
        { ...limits, timeoutMs: mode === "overflow" ? 3000 : 300 },
      ),
      mode === "overflow" ? /output limit/ : /time limit/,
    );
    assert.ok(performance.now() - started < 3000);
  }
});
