import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { containsPath } from "./artifact.js";

export async function prepareOutput(
  output: string,
  artifact: string,
): Promise<string> {
  const destination = resolve(output);
  let ancestor = destination;
  while (true) {
    try {
      const canonical = await realpath(ancestor);
      const projected = resolve(canonical, relative(ancestor, destination));
      if (containsPath(await realpath(artifact), projected))
        throw new Error(
          "Evidence output must be outside the measured artifact",
        );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination, { mode: 0o700 });
  await mkdir(join(destination, "raw"));
  return realpath(destination);
}

export async function createEnvironment(allow: string[]): Promise<{
  profile: string;
  workspace: string;
  environment: NodeJS.ProcessEnv;
}> {
  const profile = await mkdtemp(join(tmpdir(), "verdr-profile-"));
  const workspace = join(profile, "workspace");
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: "C.UTF-8",
    HOME: profile,
    CODEX_HOME: join(profile, "codex"),
    CLAUDE_CONFIG_DIR: join(profile, "claude"),
    XDG_CONFIG_HOME: join(profile, "config"),
    XDG_CACHE_HOME: join(profile, "cache"),
    XDG_STATE_HOME: join(profile, "state"),
    XDG_DATA_HOME: join(profile, "data"),
    TMPDIR: join(profile, "tmp"),
    PROMPTFOO_DISABLE_TELEMETRY: "1",
    PROMPTFOO_DISABLE_UPDATE: "1",
    PROMPTFOO_CACHE_ENABLED: "false",
    PROMPTFOO_CONFIG_DIR: join(profile, "promptfoo"),
    PROMPTFOO_DISABLE_PROGRESS_BAR: "1",
    PROMPTFOO_LOG_LEVEL: "error",
  };
  for (const path of [
    workspace,
    ...Object.entries(environment)
      .filter(
        ([name]) =>
          [
            "HOME",
            "CODEX_HOME",
            "CLAUDE_CONFIG_DIR",
            "TMPDIR",
            "PROMPTFOO_CONFIG_DIR",
          ].includes(name) || name.startsWith("XDG_"),
      )
      .map(([, value]) => value!),
  ])
    await mkdir(path, { recursive: true });
  for (const name of allow)
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  return { profile, workspace, environment };
}
