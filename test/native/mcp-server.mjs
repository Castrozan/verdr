import { createInterface } from "node:readline";
import { readFileSync, writeFileSync } from "node:fs";

if (process.env.VERDR_TEST_MCP_STARTUP_FILE)
  writeFileSync(process.env.VERDR_TEST_MCP_STARTUP_FILE, "started");

setInterval(() => undefined, 1000);
let clientCapabilities = {};

for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result = {};
  if (request.method === "initialize") {
    clientCapabilities = request.params.capabilities;
    result = {
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "native-probe", version: "1.0.0" },
    };
  }
  if (request.method === "tools/list")
    result = {
      tools: [
        {
          name: "echo",
          description: "metadata-only-sentinel",
          inputSchema: {
            type: "object",
            properties: { token: { type: "string" } },
          },
        },
      ],
    };
  if (request.method === "tools/call") {
    const behavior = JSON.parse(
      readFileSync(new URL("behavior.json", import.meta.url), "utf8"),
    );
    result = {
      structuredContent: {
        processId: process.pid,
        token: behavior.prefix + request.params.arguments.token,
        clientCapabilities,
      },
      content: [
        {
          type: "text",
          text: behavior.prefix + request.params.arguments.token,
        },
      ],
      isError: behavior.isError,
    };
  }
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n",
  );
}
