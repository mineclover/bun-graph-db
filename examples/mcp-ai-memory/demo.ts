import { PassThrough } from "node:stream";
import { startMcpStdioServer } from "../../src/mcp/stdio/McpStdioServer.js";

const input = new PassThrough();
const output = new PassThrough();

output.on("data", (chunk: Buffer) => {
	process.stdout.write(`[MCP Response] ${chunk.toString("utf8")}`);
});

const server = await startMcpStdioServer({
	databasePath: ":memory:",
	preset: "knowledge",
	input,
	output,
});

input.write(
	`${JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2026-07-28",
			capabilities: {},
			clientInfo: { name: "demo", version: "1.0.0" },
		},
	})}\n`,
);

input.write(
	`${JSON.stringify({
		jsonrpc: "2.0",
		id: 2,
		method: "tools/call",
		params: {
			name: "memory-remember",
			arguments: {
				content: "Graph memory works cleanly over MCP stdio.",
				kind: "episodic",
				topicPath: ["mcp"],
			},
		},
	})}\n`,
);

await new Promise((resolve) => setTimeout(resolve, 250));
await server.close();
