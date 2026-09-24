import type { CaseEvidence } from "./evidence.js";

export type EvaluationReport = {
  schemaVersion: 1;
  runId: string;
  name: string;
  startedAt: string;
  completedAt: string;
  suiteDigest: string;
  artifact: {
    root: string;
    before?: string;
    after?: string;
    provenance: Record<string, string>;
  };
  engine: { name: "promptfoo"; version: string };
  gate: "pass" | "fail";
  issues: string[];
  cases: CaseEvidence[];
  summary: Record<CaseEvidence["status"], number> & { expected: number };
};

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderReport(report: EvaluationReport): string {
  const rows = report.cases
    .map(
      (item) =>
        `<tr><td>${escape(item.id)}</td><td>${escape(item.kind)}</td><td class="${item.status}">${item.status}</td><td>${escape(item.reason)}</td><td>${item.durationMs} ms</td><td>${item.rawArtifact ? `<a href="${escape(item.rawArtifact)}">Raw evidence</a>` : "No evidence"}</td></tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(report.name)} | Verdr</title>
<style>body{font:16px system-ui,sans-serif;margin:3rem auto;padding:0 1.5rem;max-width:1100px;background:#f8faf9;color:#192b2a}h1{font-size:2.4rem}h2{margin-top:2rem}code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;padding:.8rem;border-bottom:1px solid #d5dedb;vertical-align:top}th{font-size:.8rem;text-transform:uppercase}.pass{color:#086441}.fail,.error{color:#a22222}.not-run{color:#685514}a{color:#175e77}.summary{padding:1rem;background:#e7efeb}li{margin:.4rem 0}</style></head>
<body><p>VERDR / ARTIFACT EVALUATION</p><h1>${escape(report.name)}</h1><p class="summary"><strong class="${report.gate}">Gate: ${report.gate}</strong> · ${report.summary.pass}/${report.summary.expected} cases passed · ${report.summary.fail} failed · ${report.summary.error} errors · ${report.summary["not-run"]} not run</p>
<p>Run ${escape(report.runId)} · ${escape(report.completedAt)} · Promptfoo ${escape(report.engine.version)}</p>
<h2>Artifact identity</h2><p>Before: <code>${escape(report.artifact.before ?? "Unavailable")}</code><br>After: <code>${escape(report.artifact.after ?? "Unavailable")}</code></p>
${report.issues.length ? `<h2>Gate failures</h2><ul>${report.issues.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul>` : ""}
<h2>Case evidence</h2><table><thead><tr><th>Case</th><th>Scope</th><th>Result</th><th>Reason</th><th>Duration</th><th>Artifact</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Claim limits</h2><p>File checks measure emitted bytes. Injected evaluations do not prove native loading. Native discovery does not prove invocation, adherence, or task success. Commands run trusted suite programs; the fresh profile is not a security sandbox. Conventional quality imports and cross-run comparisons are not measured by this runner.</p><p><a href="report.json">Machine-readable report</a></p></body></html>`;
}
