import { spawn, type ChildProcess } from "node:child_process";
import {
  query,
  type Query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { terminateProcess } from "../process.js";
import type { Suite } from "../suite.js";

const namedComponent = z
  .object({ name: z.string(), description: z.string() })
  .passthrough();
const discovery = z.object({
  commands: z.array(namedComponent),
  agents: z.array(namedComponent),
  plugins: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      source: z.string().optional(),
      version: z.string().optional(),
    }),
  ),
  mcpServers: z.array(z.object({ name: z.string(), status: z.string() })),
  error_count: z.number().int().nonnegative(),
});

export async function queryClaude(
  executable: string,
  workspace: string,
  environment: NodeJS.ProcessEnv,
  limits: Suite["limits"],
) {
  let child: ChildProcess | undefined;
  let bytes = 0;
  let failure: Error | undefined;
  let finish!: () => void;
  const idle = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function* prompt(): AsyncGenerator<SDKUserMessage> {
    await idle;
  }
  const abortController = new AbortController();
  const stop = (reason: string) => {
    failure ??= new Error(reason);
    if (child) terminateProcess(child, false);
    abortController.abort();
  };
  const timer = setTimeout(
    () => stop("Claude session time limit exceeded"),
    limits.timeoutMs,
  );
  const account = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > limits.maxOutputBytes)
      stop("Claude session output limit exceeded");
  };
  let session: Query | undefined;
  try {
    session = query({
      prompt: prompt(),
      options: {
        cwd: workspace,
        env: environment,
        pathToClaudeCodeExecutable: executable,
        settingSources: ["user"],
        persistSession: false,
        abortController,
        spawnClaudeCodeProcess: (options) => {
          const claudeProcess = spawn(options.command, options.args, {
            cwd: workspace,
            env: { ...environment, CLAUDE_CODE_ENTRYPOINT: "sdk-ts" },
            stdio: ["pipe", "pipe", "pipe"],
          });
          child = claudeProcess;
          claudeProcess.stdout.on("data", account);
          claudeProcess.stderr.on("data", account);
          return claudeProcess;
        },
      },
    });
    const result = discovery.parse(await session.reloadPlugins());
    if (failure) throw failure;
    if (result.error_count)
      throw new Error(
        `Claude native discovery reported ${result.error_count} loading errors`,
      );
    return result;
  } catch (error) {
    throw failure ?? error;
  } finally {
    clearTimeout(timer);
    finish();
    session?.close();
    if (child) terminateProcess(child, false);
  }
}
