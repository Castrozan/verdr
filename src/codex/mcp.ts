import { z } from "zod";
import { snapshotArtifact } from "../artifact.js";
import type { EvaluationCase, Suite } from "../suite/schema.js";
import { discoverCodexPlugin } from "./discovery.js";
import { queryCodex } from "./protocol.js";

const serverStatus = z
  .object({
    name: z.string(),
    pluginId: z.string().nullable(),
    tools: z.record(z.string(), z.unknown()),
    toolsError: z.unknown().optional(),
  })
  .passthrough();

export async function callCodexTool(
  evaluation: Extract<EvaluationCase, { kind: "codex-mcp" }>,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const discovered = await discoverCodexPlugin(
    { ...evaluation, kind: "codex-discovery" },
    input,
  );
  const discovery = z
    .object({
      pluginId: z.string(),
      installation: z.object({ root: z.string(), digest: z.string() }),
    })
    .passthrough()
    .parse(JSON.parse(discovered.output));
  const invoked = await queryCodex(
    evaluation.executable,
    input.workspace,
    input.limits,
    async (request) => {
      const started = z.object({ thread: z.object({ id: z.string() }) }).parse(
        await request("thread/start", {
          cwd: input.workspace,
          ephemeral: true,
        }),
      );
      const threadId = started.thread.id;
      const servers: z.infer<typeof serverStatus>[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = z
          .object({
            data: z.array(serverStatus),
            nextCursor: z.string().nullable(),
          })
          .parse(await request("mcpServerStatus/list", { threadId, cursor }));
        servers.push(...page.data);
        cursor = page.nextCursor ?? undefined;
        if (cursor && cursors.has(cursor))
          throw new Error("Repeated native MCP inventory cursor");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      const selected = servers.filter(
        (server) => server.name === evaluation.server,
      );
      if (selected.length !== 1 || selected[0]!.pluginId !== discovery.pluginId)
        throw new Error(
          `Native MCP server does not belong to the installed plugin: expected ${evaluation.server} from ${discovery.pluginId}; observed ${JSON.stringify(servers.map(({ name, pluginId }) => ({ name, pluginId })))}`,
        );
      const server = selected[0]!;
      if (server.toolsError || !Object.hasOwn(server.tools, evaluation.tool))
        throw new Error("Native plugin MCP tool is unavailable");
      const result = z
        .object({
          content: z.array(z.unknown()),
          structuredContent: z.unknown().optional(),
          isError: z.boolean().optional(),
        })
        .passthrough()
        .parse(
          await request("mcpServer/tool/call", {
            threadId,
            server: server.name,
            tool: evaluation.tool,
            arguments: evaluation.arguments,
          }),
        );
      if (result.isError) throw new Error("Native MCP tool returned an error");
      if (!result.content.length && result.structuredContent === undefined)
        throw new Error("Native MCP tool returned no content");
      return { result, server };
    },
  );
  if (
    (await snapshotArtifact(discovery.installation.root, input.limits))
      .digest !== discovery.installation.digest
  )
    throw new Error("Native installed package changed during invocation");
  return {
    output: JSON.stringify(invoked.result),
    metadata: {
      scope: "native-mcp-invocation",
      discovery,
      server: invoked.server,
      tool: evaluation.tool,
      execution: "codex-app-server-control",
      modelConsumption: "not-measured",
      adherence: "not-measured",
      approvalLoop: "bypassed-by-native-control-api",
    },
  };
}
