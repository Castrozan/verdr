import assert from "node:assert/strict";

export function assertNativeProcessExited(processId: number) {
  assert.ok(Number.isSafeInteger(processId) && processId > 0);
  let survived = false;
  try {
    process.kill(processId, 0);
    process.kill(processId, "SIGKILL");
    survived = true;
  } catch (error) {
    assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
  }
  assert.equal(survived, false, "Native MCP child survived");
}
