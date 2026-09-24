import assert from "node:assert/strict";
import { test } from "node:test";
import { runProcess } from "../src/process.js";

const options = {
  cwd: process.cwd(),
  env: process.env,
  timeoutMs: 1000,
  maxOutputBytes: 1000,
};

test("kills a nonterminating command at the execution bound", async () => {
  const started = performance.now();
  await assert.rejects(
    runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      ...options,
      timeoutMs: 200,
    }),
    /time limit/,
  );
  assert.ok(performance.now() - started < 3000);
});

test("rejects oversized output and nonzero command exits", async () => {
  await assert.rejects(
    runProcess(
      process.execPath,
      ["-e", "process.stdout.write('a'.repeat(2000))"],
      options,
    ),
    /output limit/,
  );
  await assert.rejects(
    runProcess(process.execPath, ["-e", "process.exit(7)"], options),
    /exited 7/,
  );
});
