#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runSuite } from "./runner.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string" },
      artifact: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    process.stdout.write(
      "Usage: verdr run SUITE.json --output FRESH_DIRECTORY [--artifact EMITTED_ROOT]\n",
    );
  } else {
    if (positionals.length !== 2 || positionals[0] !== "run" || !values.output)
      throw new Error(
        "Usage: verdr run SUITE.json --output FRESH_DIRECTORY [--artifact EMITTED_ROOT]",
      );
    const path = resolve(positionals[1]!);
    const configuration = JSON.parse(await readFile(path, "utf8"));
    if (values.artifact)
      configuration.artifact = {
        ...configuration.artifact,
        root: resolve(values.artifact),
      };
    const report = await runSuite(configuration, values.output, dirname(path));
    process.stdout.write(
      `${report.gate.toUpperCase()}: ${report.summary.pass}/${report.summary.expected} cases passed; ${report.summary.error} errors; ${report.summary["not-run"]} not run\n${resolve(values.output, "index.html")}\n`,
    );
    process.exitCode = report.gate === "pass" ? 0 : 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
