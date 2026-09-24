import type { SDKControlRequest } from "@anthropic-ai/claude-agent-sdk";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { closeProcess } from "../process.js";
import type { Suite } from "../suite/schema.js";

export async function queryClaudeControl<Result>(
  executable: string,
  workspace: string,
  limits: Suite["limits"],
  query: (
    request: (body: SDKControlRequest["request"]) => Promise<unknown>,
  ) => Promise<Result>,
): Promise<Result> {
  const child = spawn(
    executable,
    [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--setting-sources",
      "user",
      "--no-session-persistence",
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        DISABLE_AUTOUPDATER: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let failure: Error | undefined;
  let closing = false;
  let identifier = 0;
  let bytes = 0;
  let buffered = "";
  const decoder = new StringDecoder("utf8");
  const fail = (error: Error) => {
    failure ??= error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  const timer = setTimeout(
    () => fail(new Error("Claude control time limit exceeded")),
    limits.timeoutMs,
  );
  const account = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > limits.maxOutputBytes)
      fail(new Error("Claude control output limit exceeded"));
  };
  child.stdout.on("data", (chunk: Buffer) => {
    account(chunk);
    if (failure) return;
    buffered += decoder.write(chunk);
    let newline: number;
    while ((newline = buffered.indexOf("\n")) !== -1) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        if (["assistant", "user", "result"].includes(message.type)) {
          fail(
            new Error(
              "Unexpected model-turn frame during native control evaluation",
            ),
          );
          return;
        }
        if (message.type === "control_request") {
          fail(new Error("Native Claude control requires interactive input"));
          return;
        }
        if (message.type !== "control_response") continue;
        const response = message.response;
        const request = pending.get(response.request_id);
        if (!request) continue;
        pending.delete(response.request_id);
        if (response.subtype === "error")
          request.reject(new Error(`Claude control error: ${response.error}`));
        else if (response.subtype === "success")
          request.resolve(response.response);
        else request.reject(new Error("Invalid Claude control response"));
      } catch {
        fail(new Error("Invalid Claude control JSON"));
      }
    }
  });
  child.stderr.on("data", account);
  child.on("error", fail);
  child.on("exit", () => {
    if (!closing) fail(new Error("Claude control process exited"));
  });
  child.stdin.on("error", fail);
  const request = (body: SDKControlRequest["request"]): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (failure) return reject(failure);
      const requestId = String(identifier++);
      pending.set(requestId, { resolve, reject });
      const message: SDKControlRequest = {
        type: "control_request",
        request_id: requestId,
        request: body,
      };
      child.stdin.write(JSON.stringify(message) + "\n");
    });
  try {
    await request({ subtype: "initialize" });
    return await query(request);
  } finally {
    closing = true;
    clearTimeout(timer);
    await closeProcess(child);
    if (failure) throw failure;
  }
}
