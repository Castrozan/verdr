import { randomUUID } from "node:crypto";
import { readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, inspectArtifact, snapshotArtifact } from "./artifact.js";
import { createEnvironment, prepareOutput } from "./environment.js";
import {
  classifyResponse,
  reconcileCases,
  type CaseEvidence,
} from "./evidence.js";
import { runProcess } from "./process.js";
import { renderReport, type EvaluationReport } from "./report.js";
import { suiteSchema, type EvaluationCase, type Suite } from "./suite.js";

async function executeCase(
  suite: Suite,
  evaluation: EvaluationCase,
  output: string,
  index: number,
): Promise<CaseEvidence> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const { profile, workspace, environment } = await createEnvironment(
    suite.environment,
  );
  const rawArtifact = `raw/${index}.json`;
  const resultPath = join(output, rawArtifact);
  try {
    const worker = new URL(
      import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js",
      import.meta.url,
    );
    const args = worker.pathname.endsWith(".ts")
      ? ["--import", import.meta.resolve("tsx"), fileURLToPath(worker)]
      : [fileURLToPath(worker)];
    await runProcess(process.execPath, args, {
      cwd: workspace,
      env: environment,
      ...suite.limits,
      input: JSON.stringify({
        evaluation,
        root: suite.artifact.root,
        profile,
        workspace,
        resultPath,
        limits: suite.limits,
      }),
    });
    const raw = JSON.parse(await readFile(resultPath, "utf8")) as {
      results?: Parameters<typeof classifyResponse>[0][];
    };
    if (!Array.isArray(raw.results) || raw.results.length !== 1)
      throw new Error("Expected exactly one Promptfoo result");
    return {
      id: evaluation.id,
      kind: evaluation.kind,
      ...classifyResponse(raw.results[0]!),
      startedAt,
      durationMs: Math.round(performance.now() - started),
      rawArtifact,
    };
  } catch (error) {
    return {
      id: evaluation.id,
      kind: evaluation.kind,
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
      startedAt,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}

export async function runSuite(
  configuration: unknown,
  outputPath: string,
  basePath = process.cwd(),
): Promise<EvaluationReport> {
  if (process.platform !== "linux" && process.platform !== "darwin")
    throw new Error("Bounded execution currently supports Linux and macOS");
  const suite = suiteSchema.parse(configuration);
  suite.artifact.root = await realpath(resolve(basePath, suite.artifact.root));
  const output = await prepareOutput(outputPath, suite.artifact.root);
  const promptfooManifest = JSON.parse(
    await readFile(
      resolve(
        dirname(fileURLToPath(import.meta.resolve("promptfoo"))),
        "../../package.json",
      ),
      "utf8",
    ),
  ) as { version: string };
  const report: EvaluationReport = {
    schemaVersion: 1,
    runId: randomUUID(),
    name: suite.name,
    startedAt: new Date().toISOString(),
    completedAt: "",
    suiteDigest: digest(JSON.stringify(suite)),
    artifact: {
      root: suite.artifact.root,
      provenance: suite.artifact.provenance,
    },
    engine: { name: "promptfoo", version: promptfooManifest.version },
    gate: "fail",
    issues: [],
    cases: [],
    summary: {
      expected: suite.cases.length,
      pass: 0,
      fail: 0,
      error: 0,
      "not-run": 0,
    },
  };
  try {
    const initial = await inspectArtifact(suite);
    report.artifact.before = initial.digest;
    await writeFile(
      join(output, "artifact.json"),
      JSON.stringify(initial, null, 2),
      { flag: "wx" },
    );
    for (const [index, evaluation] of suite.cases.entries()) {
      report.cases.push(await executeCase(suite, evaluation, output, index));
      const current = await snapshotArtifact(suite.artifact.root, suite.limits);
      report.artifact.after = current.digest;
      if (current.digest !== initial.digest)
        throw new Error("Measured artifact changed during execution");
    }
  } catch (error) {
    report.issues.push(error instanceof Error ? error.message : String(error));
  }
  for (const evaluation of suite.cases) {
    if (!report.cases.some((item) => item.id === evaluation.id))
      report.cases.push({
        id: evaluation.id,
        kind: evaluation.kind,
        status: "not-run",
        reason: "Artifact gate prevented execution",
        startedAt: "",
        durationMs: 0,
      });
  }
  const reconciled = reconcileCases(suite.cases, report.cases);
  report.cases = reconciled.cases;
  report.issues.push(...reconciled.issues);
  for (const item of report.cases) report.summary[item.status]++;
  report.gate =
    report.issues.length === 0 &&
    report.summary.pass === report.summary.expected
      ? "pass"
      : "fail";
  report.completedAt = new Date().toISOString();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2),
    { flag: "wx" },
  );
  await writeFile(join(output, "index.html"), renderReport(report), {
    flag: "wx",
  });
  return report;
}
