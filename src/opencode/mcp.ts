import { randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { containedPath, digest } from "../artifact.js";
import { runProcess } from "../process.js";
import type { EvaluationCase, Suite } from "../suite/schema.js";

export async function callOpenCodeTool(
  evaluation: Extract<EvaluationCase, { kind: "opencode-mcp" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  if (evaluation.disabledServers.includes(evaluation.server))
    throw new Error("Requested MCP server is disabled by the evaluation");
  const packageRoot = await containedPath(input.root, evaluation.package);
  const configuration = await containedPath(
    input.root,
    evaluation.configuration,
  );
  const execute = (args: string[]) =>
    runProcess(evaluation.executable, args, {
      cwd: input.workspace,
      env: {
        ...process.env,
        OPENCODE_CONFIG: configuration,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          mcp: Object.fromEntries(
            evaluation.disabledServers.map((server) => [
              server,
              { enabled: false },
            ]),
          ),
        }),
        OPENCODE_DISABLE_AUTOUPDATE: "1",
        OPENCODE_DISABLE_MODELS_FETCH: "1",
        OPENCODE_EXPERIMENTAL_CODE_MODE: "1",
      },
      ...input.limits,
      group: false,
      stdoutPath: join(input.workspace, `opencode-${randomUUID()}.json`),
    });
  const version = (await execute(["--version"])).stdout.trim();
  const effective = z
    .object({ mcp: z.record(z.string(), z.unknown()) })
    .parse(JSON.parse((await execute(["debug", "config"])).stdout));
  const normalize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const serverName = normalize(evaluation.server);
  if (
    Object.keys(effective.mcp).filter((name) => normalize(name) === serverName)
      .length !== 1
  )
    throw new Error("Native OpenCode MCP server is missing or ambiguous");
  const server = z
    .object({
      type: z.literal("local"),
      enabled: z.boolean().optional(),
      cwd: z.string(),
      environment: z.object({ PLUGIN_ROOT: z.string() }),
    })
    .parse(effective.mcp[evaluation.server]);
  if (
    server.enabled === false ||
    (await realpath(server.cwd)) !== packageRoot ||
    (await realpath(server.environment.PLUGIN_ROOT)) !== packageRoot
  )
    throw new Error(
      "Native OpenCode MCP configuration does not bind the emitted package",
    );
  const toolPath = `${serverName}.${evaluation.tool}`;
  const code = `return await tools[${JSON.stringify(serverName)}][${JSON.stringify(evaluation.tool)}](${JSON.stringify(evaluation.arguments)})`;
  const response = z
    .object({
      tool: z.literal("execute"),
      input: z.object({ code: z.literal(code) }),
      result: z.object({
        output: z.string().min(1),
        metadata: z.object({
          truncated: z.boolean(),
          error: z.boolean().optional(),
          toolCalls: z.array(
            z.object({
              tool: z.string(),
              status: z.string(),
              input: z.unknown(),
            }),
          ),
        }),
      }),
    })
    .parse(
      JSON.parse(
        (
          await execute([
            "debug",
            "agent",
            evaluation.agent,
            "--tool",
            "execute",
            "--params",
            JSON.stringify({ code }),
          ])
        ).stdout,
      ),
    );
  const { metadata, output } = response.result;
  if (metadata.truncated || metadata.error || !output.trim())
    throw new Error(
      "Native OpenCode MCP result is empty, truncated, or failed",
    );
  const calls = metadata.toolCalls;
  if (
    calls.length !== 1 ||
    calls[0]!.tool !== toolPath ||
    calls[0]!.status !== "completed" ||
    !isDeepStrictEqual(calls[0]!.input, evaluation.arguments)
  )
    throw new Error(
      "Native OpenCode execution did not prove the requested MCP call",
    );
  return {
    output,
    metadata: {
      scope: "native-mcp-invocation",
      target: "opencode",
      version,
      configuration: {
        path: configuration,
        sha256: digest(await readFile(configuration)),
      },
      packageRoot,
      origin: "native-configuration-package-root",
      server: evaluation.server,
      tool: evaluation.tool,
      calls,
      execution: "native-debug-code-mode",
      composition: {
        scope: "native-inline-configuration",
        disabledServers: evaluation.disabledServers,
      },
      mcpErrorHandling: "native-tool-error",
      modelConsumption: "not-measured",
      adherence: "not-measured",
      hooks: "native-child-tool-hooks-run-without-model-loop",
      approvalLoop: "debug-asks-do-not-prompt",
    },
  };
}
