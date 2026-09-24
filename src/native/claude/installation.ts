import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { containedPath } from "../../artifact.js";
import { runProcess } from "../../process.js";
import type { EvaluationCase, Suite } from "../../suite/schema.js";

const installedPlugins = z.array(
  z
    .object({
      id: z.string(),
      enabled: z.boolean(),
      installPath: z.string(),
      errors: z.array(z.string()).optional(),
    })
    .passthrough(),
);

export async function prepareClaudeInstallation(
  evaluation: Extract<EvaluationCase, { kind: "claude-discovery" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const packageRoot = await containedPath(input.root, evaluation.package);
  const marketplacePath = await containedPath(
    input.root,
    evaluation.marketplace,
  );
  if (
    marketplacePath !==
    (await containedPath(input.root, ".claude-plugin/marketplace.json"))
  )
    throw new Error(
      "Claude discovery requires the emitted native marketplace location",
    );
  const marketplace = z
    .object({
      name: z.string().min(1),
      plugins: z.array(z.object({ name: z.string(), source: z.string() })),
    })
    .parse(JSON.parse(await readFile(marketplacePath, "utf8")));
  for (const entry of marketplace.plugins)
    await containedPath(input.root, entry.source);
  const entries = marketplace.plugins.filter(
    (entry) => entry.name === evaluation.plugin,
  );
  if (
    entries.length !== 1 ||
    (await containedPath(input.root, entries[0]!.source)) !== packageRoot
  )
    throw new Error(
      "Marketplace does not resolve the requested emitted package",
    );
  const manifest = z
    .object({ name: z.literal(evaluation.plugin) })
    .parse(
      JSON.parse(
        await readFile(
          await containedPath(packageRoot, ".claude-plugin/plugin.json"),
          "utf8",
        ),
      ),
    );
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_AUTOUPDATER: "1",
  };
  const execute = (args: string[]) =>
    runProcess(evaluation.executable, args, {
      cwd: input.workspace,
      env: environment,
      ...input.limits,
      group: false,
    });
  const identifier = `${manifest.name}@${marketplace.name}`;
  const version = (await execute(["--version"])).stdout.trim();
  const baselinePlugins = installedPlugins.parse(
    JSON.parse((await execute(["plugin", "list", "--json"])).stdout),
  );
  if (
    baselinePlugins.some((plugin) => plugin.id.split("@")[0] === manifest.name)
  )
    throw new Error(
      "Claude plugin is already present before native installation",
    );
  return {
    packageRoot,
    identifier,
    version,
    environment,
    install: async () => {
      await execute(["plugin", "validate", packageRoot, "--json"]);
      await execute(["plugin", "marketplace", "add", input.root]);
      await execute(["plugin", "install", identifier]);
      const plugins = installedPlugins.parse(
        JSON.parse((await execute(["plugin", "list", "--json"])).stdout),
      );
      const installed = plugins.filter((plugin) => plugin.id === identifier);
      if (
        installed.length !== 1 ||
        !installed[0]!.enabled ||
        installed[0]!.errors?.length
      )
        throw new Error(
          "Claude native installation is missing, disabled, ambiguous, or reports loading errors",
        );
      return containedPath(
        join(environment.CLAUDE_CONFIG_DIR!, "plugins/cache"),
        installed[0]!.installPath,
      );
    },
  };
}
