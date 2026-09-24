import { z } from "zod";
import { snapshotArtifact } from "../artifact.js";
import type { EvaluationCase, Suite } from "../suite/schema.js";
import { discoverClaudePlugin } from "./discovery.js";
import { queryClaudeControl } from "./protocol.js";

const serverStatus = z.object({
  mcpServers: z.array(
    z
      .object({
        name: z.string(),
        source: z.string().optional(),
        status: z.string(),
        tools: z.array(z.object({ name: z.string() }).passthrough()).optional(),
      })
      .passthrough(),
  ),
});
const normalize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_");

export async function callClaudeTool(
  evaluation: Extract<EvaluationCase, { kind: "claude-mcp" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const discovered = await discoverClaudePlugin(
    { ...evaluation, kind: "claude-discovery" },
    input,
  );
  const identity = z.object({ root: z.string(), digest: z.string() });
  const discovery = z
    .object({ installation: identity, loading: identity })
    .passthrough()
    .parse(JSON.parse(discovered.output));
  const serverName = `plugin:${evaluation.plugin}:${evaluation.server}`;
  const selectServer = (status: unknown) => {
    const servers = serverStatus.parse(status).mcpServers;
    const matches = servers.filter(
      (server) => normalize(server.name) === normalize(serverName),
    );
    if (
      matches.length !== 1 ||
      matches[0]!.name !== serverName ||
      matches[0]!.source !== "plugin"
    )
      throw new Error(
        "Native MCP server does not belong to the loaded Claude plugin",
      );
    return matches[0]!;
  };
  const invoked = await queryClaudeControl(
    evaluation.executable,
    input.workspace,
    input.limits,
    async (request) => {
      selectServer(await request({ subtype: "mcp_status" }));
      const result = z
        .object({
          content: z.union([z.string(), z.array(z.unknown())]),
          structuredContent: z.unknown().optional(),
        })
        .passthrough()
        .parse(
          await request({
            subtype: "mcp_call",
            tool: `mcp__${normalize(serverName)}__${evaluation.tool}`,
            arguments: evaluation.arguments,
          }),
        );
      const content =
        typeof result.content === "string"
          ? result.content.trim()
          : result.content;
      if (!content.length && result.structuredContent === undefined)
        throw new Error("Native Claude MCP tool returned no content");
      const server = selectServer(await request({ subtype: "mcp_status" }));
      if (
        server.status !== "connected" ||
        !server.tools?.some((tool) => tool.name === evaluation.tool)
      )
        throw new Error(
          "Native Claude MCP invocation lacks connected tool evidence",
        );
      return { result, server };
    },
  );
  for (const measured of [discovery.installation, discovery.loading])
    if (
      (await snapshotArtifact(measured.root, input.limits)).digest !==
      measured.digest
    )
      throw new Error("Native Claude package changed during invocation");
  return {
    output: JSON.stringify(invoked.result),
    metadata: {
      scope: "native-mcp-invocation",
      discovery,
      server: invoked.server,
      tool: evaluation.tool,
      execution: "claude-control-api",
      mcpErrorHandling: "native-control-error",
      modelConsumption: "not-measured",
      adherence: "not-measured",
      approvalLoop: "bypassed-by-native-control-api",
    },
  };
}
