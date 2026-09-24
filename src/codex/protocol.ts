import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { terminateProcess } from "../process.js";
import type { Suite } from "../suite.js";

export async function queryCodex(
  executable: string,
  workspace: string,
  limits: Suite["limits"],
  queries: { method: string; params: unknown }[],
): Promise<unknown[]> {
  const child = spawn(executable, ["app-server"], {
    cwd: workspace,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffered = "";
  const decoder = new StringDecoder("utf8");
  let bytes = 0;
  let identifier = 0;
  let failure: Error | undefined;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const fail = (error: Error) => {
    failure ??= error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    terminateProcess(child, false);
  };
  const timer = setTimeout(
    () => fail(new Error("Codex protocol time limit exceeded")),
    limits.timeoutMs,
  );
  const account = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > limits.maxOutputBytes)
      fail(new Error("Codex protocol output limit exceeded"));
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
        const message = JSON.parse(line) as {
          id?: number;
          result?: unknown;
          error?: unknown;
        };
        const request =
          message.id === undefined ? undefined : pending.get(message.id);
        if (!request) continue;
        pending.delete(message.id!);
        if (message.error)
          request.reject(
            new Error(`Codex protocol error: ${JSON.stringify(message.error)}`),
          );
        else request.resolve(message.result);
      } catch {
        fail(new Error("Invalid Codex protocol response"));
      }
    }
  });
  child.stderr.on("data", account);
  child.on("error", fail);
  child.on("exit", () => fail(new Error("Codex protocol process exited")));
  child.stdin.on("error", fail);
  const request = (method: string, params: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (failure) return reject(failure);
      const id = identifier++;
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  try {
    await request("initialize", {
      clientInfo: { name: "verdr", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
    const results: unknown[] = [];
    for (const query of queries)
      results.push(await request(query.method, query.params));
    return results;
  } finally {
    clearTimeout(timer);
    terminateProcess(child, false);
  }
}
