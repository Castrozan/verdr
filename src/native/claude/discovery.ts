import { realpath } from "node:fs/promises";
import { snapshotArtifact } from "../../artifact.js";
import { prepareClaudeInstallation } from "./installation.js";
import { queryClaude } from "./session.js";
import type { EvaluationCase, Suite } from "../../suite/schema.js";

export async function discoverClaudePlugin(
  evaluation: Extract<EvaluationCase, { kind: "claude-discovery" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const prepared = await prepareClaudeInstallation(evaluation, input);
  const query = () =>
    queryClaude(
      evaluation.executable,
      input.workspace,
      prepared.environment,
      input.limits,
    );
  const baseline = await query();
  const prefix = `${evaluation.plugin}:`;
  if (
    baseline.plugins.some((plugin) => plugin.name === evaluation.plugin) ||
    [...baseline.commands, ...baseline.agents].some((component) =>
      component.name.startsWith(prefix),
    )
  )
    throw new Error(
      "Claude already discovers the requested namespace before installation",
    );
  const original = await snapshotArtifact(prepared.packageRoot, input.limits);
  const installedRoot = await prepared.install();
  const installation = await snapshotArtifact(installedRoot, input.limits);
  if (original.digest !== installation.digest)
    throw new Error(
      "Native installed package differs from the emitted package",
    );
  const discovered = await query();
  const plugins = discovered.plugins.filter(
    (plugin) => plugin.name === evaluation.plugin,
  );
  if (plugins.length !== 1 || plugins[0]!.source !== prepared.identifier)
    throw new Error("Claude did not load exactly the requested native plugin");
  const loadedRoot = await realpath(plugins[0]!.path);
  if (loadedRoot !== installedRoot && loadedRoot !== prepared.packageRoot)
    throw new Error(
      "Claude loaded the plugin from outside the measured package",
    );
  const loaded = await snapshotArtifact(loadedRoot, input.limits);
  if (
    loaded.digest !== original.digest ||
    (await snapshotArtifact(installedRoot, input.limits)).digest !==
      installation.digest
  )
    throw new Error("Native package changed during Claude discovery");
  const output = {
    scope: "native-discovery",
    harness: "claude-code",
    version: prepared.version,
    commands: discovered.commands.filter((component) =>
      component.name.startsWith(prefix),
    ),
    agents: discovered.agents.filter((component) =>
      component.name.startsWith(prefix),
    ),
    plugin: plugins[0],
    mcpServers: discovered.mcpServers.filter((server) =>
      server.name.startsWith(`plugin:${prefix}`),
    ),
    installation: {
      root: installedRoot,
      digest: installation.digest,
      emittedDigest: original.digest,
      entries: installation.entries,
    },
    loading: {
      root: loadedRoot,
      digest: loaded.digest,
      source:
        loadedRoot === prepared.packageRoot
          ? "emitted-package"
          : "installed-copy",
    },
    host: {
      isolation: "fresh-user-profile-with-inherited-system-policy",
      systemPolicy: "not-enumerated",
      baselinePlugins: baseline.plugins,
      baselineCommands: baseline.commands.map((component) => component.name),
      baselineAgents: baseline.agents.map((component) => component.name),
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
