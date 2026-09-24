import { readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { digest } from "../../artifact.js";
import type { EvaluationCase, Suite } from "../../suite/schema.js";
import { loadPiPackage } from "./package.js";
import { openPiSession } from "./session.js";

export async function callPiTool(
  evaluation: Extract<EvaluationCase, { kind: "pi-mcp" }>,
  input: {
    root: string;
    profile: string;
    workspace: string;
    limits: Suite["limits"];
  },
) {
  if (evaluation.disabledServers.includes(evaluation.server))
    throw new Error("Requested MCP server is disabled by the evaluation");
  const loaded = await loadPiPackage(evaluation, input);
  const configurationPath = join(loaded.agentDirectory, "mcp.json");
  try {
    if (!loaded.session.extensionRunner.getCommand("plugin"))
      throw new Error("Native Pi plugin command is unavailable");
    await loaded.session.prompt(`/plugin trust ${loaded.manifest.name}`);
    loaded.assertHealthy();
  } finally {
    await loaded.close();
  }
  const configurationBytes = await readFile(configurationPath);
  const configuration = z
    .object({
      mcpServers: z.record(z.string(), z.record(z.string(), z.unknown())),
    })
    .passthrough()
    .parse(JSON.parse(configurationBytes.toString()));
  const server = z
    .object({ command: z.string(), args: z.array(z.string()).length(2) })
    .parse(configuration.mcpServers[evaluation.server]);
  const launcher = join(
    loaded.runtime.modules,
    "pi-agent-plugins/bin/stdio-launcher.mjs",
  );
  if ((await realpath(server.command)) !== (await realpath(process.execPath)))
    throw new Error("Pi MCP launcher does not use the native host executable");
  if ((await realpath(server.args[0]!)) !== (await realpath(launcher)))
    throw new Error("Pi MCP server does not use the native package launcher");
  const origin = z
    .object({ pluginRoot: z.string() })
    .parse(JSON.parse(Buffer.from(server.args[1]!, "base64url").toString()));
  if ((await realpath(origin.pluginRoot)) !== loaded.packageRoot)
    throw new Error("Native Pi MCP server has a different package origin");
  const invocationConfiguration = structuredClone(configuration);
  for (const name of evaluation.disabledServers) {
    const excluded = invocationConfiguration.mcpServers[name];
    if (!excluded) throw new Error("Excluded Pi MCP server is not registered");
    excluded.disabled = true;
  }
  const adapterRoot = join(loaded.runtime.modules, "pi-mcp-adapter");
  const adapterEntry = join(adapterRoot, "index.ts");
  const adapterVersion = z
    .object({ version: z.string().min(1) })
    .parse(
      JSON.parse(await readFile(join(adapterRoot, "package.json"), "utf8")),
    ).version;
  const configuredAdapter = join(loaded.agentDirectory, "configured-mcp.ts");
  await writeFile(
    configuredAdapter,
    `import { createMcpAdapter } from ${JSON.stringify(adapterEntry)};\nexport default createMcpAdapter(${JSON.stringify({ config: invocationConfiguration })});\n`,
    { flag: "wx", mode: 0o600 },
  );
  const active = await openPiSession(
    loaded.sdk,
    loaded.loaderEntry,
    loaded.agentDirectory,
    input.workspace,
    [configuredAdapter],
  );
  try {
    const tool = active.session.getToolDefinition("mcp");
    if (!tool) throw new Error("Native Pi MCP proxy tool is unavailable");
    const invoked = await tool.execute(
      "verdr-native-mcp",
      {
        server: evaluation.server,
        tool: evaluation.tool,
        args: evaluation.arguments,
      },
      AbortSignal.timeout(input.limits.timeoutMs),
      undefined,
      active.session.extensionRunner.createContext(),
    );
    active.assertHealthy();
    const details = z
      .object({
        server: z.literal(evaluation.server),
        tool: z.literal(evaluation.tool),
        error: z.unknown().optional(),
        mcpResult: z
          .object({
            isError: z.boolean().optional(),
            content: z.array(z.unknown()),
            structuredContent: z.unknown().optional(),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(invoked.details);
    if (details.error !== undefined || details.mcpResult.isError === true)
      throw new Error("Native Pi MCP tool returned an error");
    if (
      !details.mcpResult.content.length &&
      details.mcpResult.structuredContent === undefined
    )
      throw new Error("Native Pi MCP tool returned no content");
    return {
      output: JSON.stringify(details.mcpResult),
      metadata: {
        scope: "native-mcp-invocation",
        target: "pi",
        registration: loaded.registration,
        runtime: {
          ...loaded.runtime,
          adapter: {
            version: adapterVersion,
            entry: adapterEntry,
            sha256: digest(await readFile(adapterEntry)),
          },
        },
        server: {
          name: evaluation.server,
          packageRoot: origin.pluginRoot,
          launcher,
        },
        tool: evaluation.tool,
        execution: "pi-native-tool-definition",
        nativeConfigurationDigest: digest(configurationBytes),
        composition: {
          scope: "temporary-native-profile",
          disabledServers: evaluation.disabledServers,
        },
        modelConsumption: "not-measured",
        adherence: "not-measured",
        agentLoopHooks: "bypassed-by-direct-tool-execution",
      },
    };
  } finally {
    await active.close();
    if (!(await readFile(configurationPath)).equals(configurationBytes))
      throw new Error("Native Pi MCP configuration changed during invocation");
  }
}
