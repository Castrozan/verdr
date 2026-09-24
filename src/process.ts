import { spawn, type ChildProcess } from "node:child_process";

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

export function runProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxOutputBytes: number;
    input?: string;
    group?: boolean;
  },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const group = options.group !== false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: group && process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
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
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (group) terminateProcess(child);
      if (failure) return reject(new Error(failure));
      if (code !== 0)
        return reject(
          new Error(
            `Command exited ${code ?? signal}: ${Buffer.concat(stderr).toString("utf8").slice(0, 1000)}`,
          ),
        );
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input);
  });
}
