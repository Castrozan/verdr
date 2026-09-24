import { spawn, type ChildProcess } from "node:child_process";
import { open } from "node:fs/promises";

export function terminateProcess(child: ChildProcess, group = true): void {
  if (!child.pid) return;
  try {
    process.kill(
      process.platform === "win32" || !group ? child.pid : -child.pid,
      "SIGKILL",
    );
  } catch {
    child.kill("SIGKILL");
  }
}

export async function runProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxOutputBytes: number;
    input?: string;
    group?: boolean;
    stdoutPath?: string;
  },
): Promise<{ stdout: string; stderr: string }> {
  const capture = options.stdoutPath
    ? await open(options.stdoutPath, "wx+", 0o600)
    : undefined;
  try {
    return await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const group = options.group !== false;
        const child = spawn(command, args, {
          cwd: options.cwd,
          env: options.env,
          detached: group && process.platform !== "win32",
          stdio: ["pipe", capture?.fd ?? "pipe", "pipe"],
        });
        let completed = false;
        let checkingSize = false;
        const captureTimer = capture
          ? setInterval(async () => {
              if (checkingSize || completed) return;
              checkingSize = true;
              try {
                const size = (await capture.stat()).size;
                if (!completed && size + bytes > options.maxOutputBytes)
                  stop("Execution output limit exceeded");
              } catch (error) {
                if (!completed) stop(String(error));
              } finally {
                checkingSize = false;
              }
            }, 100)
          : undefined;
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        let failure: string | undefined;
        const stop = (reason: string) => {
          failure ??= reason;
          terminateProcess(child, group);
        };
        const timer = setTimeout(
          () => stop("Execution time limit exceeded"),
          options.timeoutMs,
        );
        const collect = (chunks: Buffer[], chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > options.maxOutputBytes)
            stop("Execution output limit exceeded");
          else chunks.push(chunk);
        };
        child.stdout?.on("data", (chunk: Buffer) => collect(stdout, chunk));
        child.stderr?.on("data", (chunk: Buffer) => collect(stderr, chunk));
        child.on("error", (error) => {
          completed = true;
          clearTimeout(timer);
          clearInterval(captureTimer);
          reject(error);
        });
        child.on("close", async (code, signal) => {
          completed = true;
          clearTimeout(timer);
          clearInterval(captureTimer);
          if (group) terminateProcess(child);
          if (failure) return reject(new Error(failure));
          if (code !== 0)
            return reject(
              new Error(
                `Command exited ${code ?? signal}: ${Buffer.concat(stderr).toString("utf8").slice(0, 1000)}`,
              ),
            );
          try {
            if (capture) {
              const size = (await capture.stat()).size;
              if (size + bytes > options.maxOutputBytes)
                throw new Error("Execution output limit exceeded");
              const content = Buffer.alloc(size);
              const result = await capture.read(content, 0, size, 0);
              if (
                result.bytesRead !== size ||
                (await capture.stat()).size !== size
              )
                throw new Error("Captured output changed while reading");
              stdout.push(content);
            }
            resolve({
              stdout: Buffer.concat(stdout).toString("utf8"),
              stderr: Buffer.concat(stderr).toString("utf8"),
            });
          } catch (error) {
            reject(error);
          }
        });
        child.stdin?.on("error", () => undefined);
        child.stdin?.end(options.input);
      },
    );
  } finally {
    await capture?.close();
  }
}
