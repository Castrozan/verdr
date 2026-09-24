import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runProcess } from "../src/process.js";

test("file capture preserves output from a CLI that exits before flushing its pipe", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-output-file-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const result = await runProcess(
    process.execPath,
    ["-e", "process.stdout.write('x'.repeat(200000)); process.exit(0)"],
    {
      cwd: root,
      env: process.env,
      timeoutMs: 5000,
      maxOutputBytes: 300000,
      stdoutPath: join(root, "output"),
    },
  );
  assert.equal(result.stdout.length, 200000);
  await assert.rejects(
    runProcess(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(200000)); process.exit(0)"],
      {
        cwd: root,
        env: process.env,
        timeoutMs: 5000,
        maxOutputBytes: 1000,
        stdoutPath: join(root, "oversized"),
      },
    ),
    /output limit/,
  );
});

test("file capture stops a continuing writer at the output bound", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-output-bound-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const started = performance.now();
  await assert.rejects(
    runProcess(
      process.execPath,
      ["-e", "setInterval(() => process.stdout.write('x'.repeat(4096)), 10)"],
      {
        cwd: root,
        env: process.env,
        timeoutMs: 5000,
        maxOutputBytes: 1000,
        stdoutPath: join(root, "output"),
      },
    ),
    /output limit/,
  );
  assert.ok(performance.now() - started < 3000);
});
