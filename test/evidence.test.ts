import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyResponse,
  reconcileCases,
  type CaseEvidence,
} from "../src/evidence.js";

test("missing and duplicate results remain in the expected denominator", () => {
  const first: CaseEvidence = {
    id: "a",
    kind: "file",
    status: "pass",
    reason: "ok",
    startedAt: new Date().toISOString(),
    durationMs: 1,
  };
  const expected = [
    { id: "a", kind: "file" },
    { id: "b", kind: "file" },
  ];
  const missing = reconcileCases(expected, [first]);
  assert.equal(missing.cases.length, 2);
  assert.equal(missing.cases[1]?.status, "error");
  assert.equal(
    reconcileCases(expected, [first, first]).cases[0]?.status,
    "error",
  );
});

test("an empty or errored provider response cannot pass a negative assertion", () => {
  assert.equal(
    classifyResponse({ success: true, response: { output: "ok" } }).status,
    "error",
  );
  assert.equal(
    classifyResponse({ success: true, response: { output: "" } }).status,
    "error",
  );
  assert.equal(
    classifyResponse({
      success: true,
      response: { output: "ok", error: "network error" },
    }).status,
    "error",
  );
  assert.equal(
    classifyResponse({
      success: false,
      response: { output: "wrong" },
      gradingResult: { reason: "mismatch", pass: false },
    }).status,
    "fail",
  );
});
