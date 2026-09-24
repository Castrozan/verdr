import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  containedPath,
  containsPath,
  digest,
  snapshotArtifact,
} from "../../artifact.js";
import { runProcess } from "../../process.js";
import { queryCodex } from "./protocol.js";
import { installedPackages } from "./installation.js";
import type { EvaluationCase, Suite } from "../../suite/schema.js";

const skillsResponse = z
  .object({
    data: z.array(
      z
        .object({
          skills: z.array(
            z.object({ name: z.string(), path: z.string() }).passthrough(),
          ),
          errors: z.array(z.unknown()).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export async function discoverCodexPlugin(
  evaluation: Extract<EvaluationCase, { kind: "codex-discovery" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const packageRoot = await containedPath(input.root, evaluation.package);
  const marketplacePath = await containedPath(
    input.root,
    evaluation.marketplace,
  );
  const marketplace = z
    .object({
      name: z.string().min(1),
      plugins: z.array(
        z.object({
          name: z.string(),
          source: z.object({ source: z.literal("local"), path: z.string() }),
        }),
      ),
    })
    .parse(JSON.parse(await readFile(marketplacePath, "utf8")));
  if (
    marketplacePath !==
    (await containedPath(input.root, ".agents/plugins/marketplace.json"))
  )
    throw new Error(
      "Codex discovery requires the emitted native marketplace location",
    );
  for (const entry of marketplace.plugins)
    await containedPath(input.root, entry.source.path);
  const entry = marketplace.plugins.filter(
    (plugin) => plugin.name === evaluation.plugin,
  );
  if (
    entry.length !== 1 ||
    (await containedPath(input.root, entry[0]!.source.path)) !== packageRoot
  )
    throw new Error(
      "Marketplace does not resolve the requested emitted package",
    );
  const execute = async (args: string[]) =>
    runProcess(evaluation.executable, args, {
      cwd: input.workspace,
      env: process.env,
      ...input.limits,
      group: false,
    });
  const version = (await execute(["--version"])).stdout.trim();
  const baseline = skillsResponse.parse(
    await queryCodex(
      evaluation.executable,
      input.workspace,
      input.limits,
      (request) =>
        request("skills/list", { cwds: [input.workspace], forceReload: true }),
    ),
  );
  await execute(["plugin", "marketplace", "add", input.root, "--json"]);
  await execute([
    "plugin",
    "add",
    `${evaluation.plugin}@${marketplace.name}`,
    "--json",
  ]);
  const installed = await installedPackages(
    join(process.env.CODEX_HOME!, "plugins", "cache"),
  );
  if (installed.length !== 1)
    throw new Error(
      "Expected exactly one installed portable package in the fresh profile",
    );
  const installedRoot = await realpath(installed[0]!);
  const original = await snapshotArtifact(packageRoot, input.limits);
  const installation = await snapshotArtifact(installedRoot, input.limits);
  if (original.digest !== installation.digest)
    throw new Error(
      "Native installed package differs from the emitted package",
    );
  const [detail, loadedSkills, hooks] = await queryCodex(
    evaluation.executable,
    input.workspace,
    input.limits,
    async (request) => [
      await request("plugin/read", {
        marketplacePath,
        pluginName: evaluation.plugin,
      }),
      await request("skills/list", {
        cwds: [input.workspace],
        forceReload: true,
      }),
      await request("hooks/list", { cwds: [input.workspace] }),
    ],
  );
  const listing = skillsResponse.parse(loadedSkills);
  if (
    (await snapshotArtifact(installedRoot, input.limits)).digest !==
    installation.digest
  )
    throw new Error("Native installed package changed during discovery");
  if (listing.data.some((item) => item.errors?.length))
    throw new Error("Native skill discovery reported loading errors");
  const skills = listing.data
    .flatMap((item) => item.skills)
    .filter((skill) => containsPath(installedRoot, skill.path));
  for (const skill of skills) await containedPath(installedRoot, skill.path);
  const hostFiles: { path: string; sha256: string }[] = [];
  for (const path of [
    "/etc/codex/config.toml",
    "/etc/codex/requirements.toml",
  ]) {
    try {
      hostFiles.push({ path, sha256: digest(await readFile(path)) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const output = {
    scope: "native-discovery",
    pluginId: `${evaluation.plugin}@${marketplace.name}`,
    version,
    skills,
    plugin: detail,
    hooks,
    installation: {
      root: installedRoot,
      digest: installation.digest,
      emittedDigest: original.digest,
      entries: installation.entries,
    },
    host: {
      isolation: "fresh-user-profile-with-inherited-system-policy",
      files: hostFiles,
      baselineSkills: baseline.data.flatMap((item) => item.skills),
    },
    execution: "not-measured",
  };
  return {
    output: JSON.stringify(output),
    metadata: {
      scope: "native-discovery",
      installationDigest: installation.digest,
    },
  };
}
