import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluate, loadApiProvider } from "promptfoo";
import { containedPath } from "./artifact.js";
import { discoverCodexPlugin } from "./native/codex/discovery.js";
import { runProcess } from "./process.js";
import type { EvaluationCase, Suite } from "./suite/schema.js";

type WorkerInput = {
  evaluation: EvaluationCase;
  root: string;
  profile: string;
  workspace: string;
  resultPath: string;
  limits: Suite["limits"];
};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as WorkerInput;
const evaluation = input.evaluation;
const expand = (value: string) =>
  value
    .replaceAll("{artifact}", input.root)
    .replaceAll("{profile}", input.profile)
    .replaceAll("{workspace}", input.workspace);

async function execute() {
  if (evaluation.kind === "file")
    return {
      output: await readFile(
        await containedPath(input.root, evaluation.path),
        "utf8",
      ),
    };
  if (evaluation.kind === "installed-identity") {
    const { inspectInstallation } = await import("./installation.js");
    return inspectInstallation(evaluation, input);
  }
  if (evaluation.kind === "codex-discovery")
    return discoverCodexPlugin(evaluation, input);
  if (evaluation.kind === "codex-mcp") {
    const { callCodexTool } = await import("./native/codex/mcp.js");
    return callCodexTool(evaluation, input);
  }
  if (evaluation.kind === "claude-discovery") {
    const { discoverClaudePlugin } =
      await import("./native/claude/discovery.js");
    return discoverClaudePlugin(evaluation, input);
  }
  if (evaluation.kind === "claude-mcp") {
    const { callClaudeTool } = await import("./native/claude/mcp.js");
    return callClaudeTool(evaluation, input);
  }
  if (
    evaluation.kind === "opencode-discovery" ||
    evaluation.kind === "opencode-skill"
  ) {
    const { inspectOpenCode } = await import("./native/opencode/skills.js");
    return inspectOpenCode(evaluation, input);
  }
  if (evaluation.kind === "opencode-mcp") {
    const { callOpenCodeTool } = await import("./native/opencode/mcp.js");
    return callOpenCodeTool(evaluation, input);
  }
  if (evaluation.kind === "pi-discovery" || evaluation.kind === "pi-skill") {
    const { inspectPi } = await import("./native/pi/skills.js");
    return inspectPi(evaluation, input);
  }
  if (evaluation.kind === "pi-mcp") {
    const { callPiTool } = await import("./native/pi/mcp.js");
    return callPiTool(evaluation, input);
  }
  if (
    evaluation.kind === "hermes-discovery" ||
    evaluation.kind === "hermes-skill" ||
    evaluation.kind === "hermes-mcp"
  ) {
    const { inspectHermes } = await import("./native/hermes/skills.js");
    return inspectHermes(evaluation, input);
  }
  if (evaluation.kind === "command") {
    const result = await runProcess(
      expand(evaluation.command),
      evaluation.args.map(expand),
      { cwd: input.workspace, env: process.env, ...input.limits, group: false },
    );
    return {
      output: result.stdout,
      metadata: { stderr: result.stderr, scope: "command" },
    };
  }
  const instructions = await Promise.all(
    evaluation.instructionFiles.map(async (path) =>
      readFile(await containedPath(input.root, path), "utf8"),
    ),
  );
  const provider = await loadApiProvider(evaluation.provider.id, {
    options: { config: evaluation.provider.config },
  });
  const prompt = `${instructions.join("\n\n")}\n\n${evaluation.prompt}`;
  return provider.callApi(
    prompt,
    { vars: {}, prompt: { raw: prompt, label: evaluation.id } },
    { abortSignal: AbortSignal.timeout(input.limits.timeoutMs) },
  );
}

try {
  const record = await evaluate(
    {
      prompts: ["Evaluate the supplied emitted artifact"],
      providers: [
        {
          id: () => `verdr:${evaluation.kind}`,
          callApi: async () => {
            try {
              const response = await execute();
              if (
                Buffer.byteLength(JSON.stringify(response)) >
                input.limits.maxOutputBytes
              )
                return { error: "Provider output limit exceeded" };
              return response;
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
              };
            }
          },
        },
      ],
      tests: [{ description: evaluation.id, assert: evaluation.assert }],
      writeLatestResults: false,
      sharing: false,
    },
    {
      cache: false,
      maxConcurrency: 1,
      repeat: 1,
      maxEvalTimeMs: input.limits.timeoutMs,
    },
  );
  const summary = await record.toEvaluateSummary();
  const serialized = JSON.stringify(summary);
  if (Buffer.byteLength(serialized) > input.limits.maxOutputBytes)
    throw new Error("Raw evidence output limit exceeded");
  await writeFile(resolve(input.resultPath), serialized, {
    flag: "wx",
    mode: 0o600,
  });
  process.exit(0);
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
