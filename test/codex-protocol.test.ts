import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { queryCodex } from "../src/codex/protocol.js";

test("Codex protocol bounds terminate an unresponsive process even when graceful shutdown stalls", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-codex-protocol-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, "codex");
  for (const mode of ["overflow", "timeout"]) {
    await writeFile(
      executable,
      `#!${process.execPath}
setInterval(() => undefined, 1000);
process.stdin.on('data', () => { if (${JSON.stringify(mode)} === 'overflow') process.stderr.write('x'.repeat(20000)); });
`,
      { mode: 0o755 },
    );
    const started = performance.now();
    await assert.rejects(
      queryCodex(
        executable,
        root,
        {
          timeoutMs: mode === "overflow" ? 3000 : 300,
          maxOutputBytes: 10000,
          maxArtifactBytes: 10000,
          maxArtifactEntries: 100,
        },
        (request) => request("skills/list", {}),
      ),
      mode === "overflow" ? /output limit/ : /time limit/,
    );
    assert.ok(performance.now() - started < 5000);
  }
});
