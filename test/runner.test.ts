import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runSuite } from "../src/runner.js";

async function fixture(context: {
  after: (callback: () => Promise<void>) => void;
}) {
  const root = await mkdtemp(join(tmpdir(), "verdr-runner-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, "emitted");
  await mkdir(join(artifact, "plugin"), { recursive: true });
  await writeFile(
    join(artifact, "plugin/plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "example",
    }),
  );
  await writeFile(join(artifact, "plugin/result.txt"), "emitted value");
  const suite = {
    schemaVersion: 1,
    name: "Runner <proof>",
    artifact: {
      root: artifact,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/result.txt" }],
    },
    cases: [
      {
        id: "emitted",
        kind: "file",
        path: "plugin/result.txt",
        assert: [{ type: "equals", value: "emitted value" }],
      },
    ],
  };
  return { root, artifact, suite };
}

test("uses real Promptfoo assertions on emitted bytes and retains raw evidence", async (context) => {
  const { root, suite } = await fixture(context);
  const report = await runSuite(suite, join(root, "report"));
  assert.equal(report.gate, "pass", JSON.stringify(report));
  assert.equal(report.summary.pass, 1);
  assert.equal(report.artifact.before, report.artifact.after);
  const raw = JSON.parse(
    await readFile(join(root, "report/raw/0.json"), "utf8"),
  );
  assert.equal(raw.results[0].response.output, "emitted value");
  const html = await readFile(join(root, "report/index.html"), "utf8");
  assert.ok(html.includes("Runner &lt;proof&gt;"));
  await assert.rejects(runSuite(suite, join(root, "report")), /EEXIST/);
});

test("corrupt output cannot be rescued by an intact source", async (context) => {
  const { root, artifact, suite } = await fixture(context);
  await writeFile(join(root, "source.txt"), "emitted value");
  await writeFile(join(artifact, "plugin/result.txt"), "corrupted output");
  const report = await runSuite(suite, join(root, "report"));
  assert.equal(report.gate, "fail");
  assert.equal(report.cases[0]?.status, "fail");
});

test("rejects empty output even when not-contains would pass", async (context) => {
  const { root, artifact, suite } = await fixture(context);
  await writeFile(join(artifact, "plugin/result.txt"), "");
  suite.cases[0]!.assert = [{ type: "not-contains", value: "bad" }];
  const report = await runSuite(suite, join(root, "report"));
  assert.equal(report.gate, "fail");
  assert.equal(report.cases[0]?.status, "error");
});

test("missing inventory blocks all scheduled cases without dropping their denominator", async (context) => {
  const { root, artifact, suite } = await fixture(context);
  await rm(join(artifact, "plugin/result.txt"));
  const report = await runSuite(suite, join(root, "report"));
  assert.equal(report.gate, "fail");
  assert.equal(report.summary.expected, 1);
  assert.equal(report.summary["not-run"], 1);
});

test("evidence cannot be written into the measured artifact", async (context) => {
  const { artifact, suite } = await fixture(context);
  await assert.rejects(
    runSuite(suite, join(artifact, "report")),
    /outside the measured artifact/,
  );
});

test("a killed worker produces an error rather than a missing passing case", async (context) => {
  const { root, suite } = await fixture(context);
  const report = await runSuite(
    { ...suite, limits: { timeoutMs: 100 } },
    join(root, "report"),
  );
  assert.equal(report.gate, "fail");
  assert.equal(report.summary.error, 1);
  assert.match(report.cases[0]!.reason, /time limit/);
});

test("artifact mutation fails the gate and prevents subsequent execution", async (context) => {
  const { root, suite } = await fixture(context);
  const report = await runSuite(
    {
      ...suite,
      cases: [
        {
          id: "mutator",
          kind: "command",
          command: process.execPath,
          args: [
            "-e",
            "require('node:fs').writeFileSync(process.argv[1], 'changed'); process.stdout.write('ok')",
            "{artifact}/plugin/result.txt",
          ],
          assert: [{ type: "equals", value: "ok" }],
        },
        suite.cases[0],
      ],
    },
    join(root, "report"),
  );
  assert.equal(report.gate, "fail");
  assert.match(report.issues.join(" "), /changed during execution/);
  assert.equal(report.summary.expected, 2);
  assert.equal(report.summary["not-run"], 1);
});
