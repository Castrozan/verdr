import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { queryClaudeControl } from "../src/claude/protocol.js";

test("Claude control transmits only declared control frames and rejects dispatch errors and model turns", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-claude-control-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, "claude");
  const receipt = join(root, "requests.jsonl");
  const limits = {
    timeoutMs: 3000,
    maxOutputBytes: 10000,
    maxArtifactBytes: 10000,
    maxArtifactEntries: 100,
  };
  for (const mode of ["valid", "error", "model", "late-model"]) {
    await writeFile(receipt, "");
    await writeFile(
      executable,
      `#!${process.execPath}
const fs=require('node:fs');
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 fs.appendFileSync(${JSON.stringify(receipt)},line+'\\n');
 const message=JSON.parse(line);
 const mode=${JSON.stringify(mode)};
 const response={subtype:'success',request_id:message.request_id,response:{mcpServers:[]}};
 if(message.request.subtype!=='initialize'&&mode==='error') Object.assign(response,{subtype:'error',error:'native-dispatch-failure'});
 process.stdout.write(JSON.stringify(message.request.subtype!=='initialize'&&mode==='model'?{type:'assistant'}:{type:'control_response',response})+'\\n');
 if(message.request.subtype!=='initialize'&&mode==='late-model') process.stdout.write(JSON.stringify({type:'assistant'})+'\\n');
});
`,
      { mode: 0o755 },
    );
    const operation = queryClaudeControl(executable, root, limits, (request) =>
      request({ subtype: "mcp_status" }),
    );
    if (mode === "valid") assert.deepEqual(await operation, { mcpServers: [] });
    else
      await assert.rejects(
        operation,
        mode === "error" ? /native-dispatch-failure/ : /model-turn frame/,
      );
    const requests = (await readFile(receipt, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      requests.map((message) => message.type),
      ["control_request", "control_request"],
    );
    assert.deepEqual(
      requests.map((message) => message.request.subtype),
      ["initialize", "mcp_status"],
    );
  }
});
