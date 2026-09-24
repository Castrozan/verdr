export type CaseEvidence = {
  id: string;
  kind: string;
  status: "pass" | "fail" | "error" | "not-run";
  reason: string;
  startedAt: string;
  durationMs: number;
  rawArtifact?: string;
};

export function reconcileCases(
  expected: { id: string; kind: string }[],
  observed: CaseEvidence[],
): { cases: CaseEvidence[]; issues: string[] } {
  const issues: string[] = [];
  const expectedIds = new Set(expected.map((item) => item.id));
  for (const result of observed)
    if (!expectedIds.has(result.id))
      issues.push(`Unexpected result: ${result.id}`);
  const cases = expected.map((item): CaseEvidence => {
    const matches = observed.filter((result) => result.id === item.id);
    if (matches.length !== 1 || matches[0]?.kind !== item.kind) {
      issues.push(`Expected exactly one matching result: ${item.id}`);
      return {
        ...item,
        status: "error",
        reason: "Missing, duplicate, or incompatible evidence",
        startedAt: "",
        durationMs: 0,
      };
    }
    return matches[0]!;
  });
  return { cases, issues };
}

export function classifyResponse(result: {
  success?: boolean;
  error?: string;
  response?: { output?: unknown; error?: string };
  gradingResult?: { reason?: string; pass?: boolean };
}): Pick<CaseEvidence, "status" | "reason"> {
  if (result.response?.error)
    return { status: "error", reason: result.response.error };
  const output = result.response?.output;
  if (
    output === undefined ||
    output === null ||
    (typeof output === "string" && output.trim() === "")
  )
    return {
      status: "error",
      reason: result.error || "Provider returned no usable output",
    };
  if (result.success === true && result.gradingResult?.pass === true)
    return {
      status: "pass",
      reason: result.gradingResult?.reason || "Assertions passed",
    };
  if (result.gradingResult?.pass === false)
    return {
      status: "fail",
      reason:
        result.gradingResult.reason || result.error || "Assertions failed",
    };
  return {
    status: "error",
    reason: result.error || "Missing assertion evidence",
  };
}
