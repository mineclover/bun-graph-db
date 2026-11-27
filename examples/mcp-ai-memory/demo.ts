import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PassThrough } from "node:stream";
import type { PresetBlueprintName } from "../../src/application/blueprints/PresetBlueprints.js";
import { startMcpStdioServer } from "../../src/mcp/stdio/McpStdioServer.js";

function readFlag(args: readonly string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (!current) continue;
		if (current === name) return args[i + 1];
		if (current.startsWith(`${name}=`)) return current.slice(name.length + 1);
	}
	return undefined;
}

function createLineReader(stream: PassThrough) {
	let buffer = "";
	const queue: Array<Record<string, unknown>> = [];
	const waiters: Array<(msg: Record<string, unknown>) => void> = [];

	stream.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		let idx = buffer.indexOf("\n");
		while (idx >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (line) {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				const waiter = waiters.shift();
				if (waiter) waiter(parsed);
				else queue.push(parsed);
			}
			idx = buffer.indexOf("\n");
		}
	});

	return {
		next(timeoutMs = 10_000): Promise<Record<string, unknown>> {
			const queued = queue.shift();
			if (queued) return Promise.resolve(queued);
			return new Promise((resolvePromise, reject) => {
				const timer = setTimeout(
					() => reject(new Error("Timed out waiting for MCP stdio response")),
					timeoutMs,
				);
				waiters.push((msg) => {
					clearTimeout(timer);
					resolvePromise(msg);
				});
			});
		},
	};
}

const argv = process.argv.slice(2);
const databasePath = readFlag(argv, "--database-path") ?? ":memory:";
const presetRaw = readFlag(argv, "--preset") ?? "knowledge";
const preset: PresetBlueprintName =
	presetRaw === "product-spec" || presetRaw === "decision-log"
		? presetRaw
		: "knowledge";

if (databasePath !== ":memory:" && !databasePath.startsWith(":")) {
	mkdirSync(dirname(resolve(databasePath)), { recursive: true });
}

const input = new PassThrough();
const output = new PassThrough();
const stderrLogs: string[] = [];
const reader = createLineReader(output);

const server = await startMcpStdioServer({
	databasePath,
	preset,
	input,
	output,
	logger: (line) => stderrLogs.push(line),
});

try {
	const send = async (payload: Record<string, unknown>) => {
		input.write(`${JSON.stringify(payload)}\n`);
		return await reader.next();
	};

	const initRes = await send({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2026-07-28",
			capabilities: {},
			clientInfo: { name: "role1-mcp-demo", version: "1.0.0" },
		},
	});
	const negotiatedVersion = (initRes.result as { protocolVersion?: string })
		?.protocolVersion;

	const listRes = await send({
		jsonrpc: "2.0",
		id: 2,
		method: "tools/list",
		params: {},
	});
	const tools =
		(listRes.result as { tools?: Array<{ name: string }> })?.tools ?? [];

	const seedMemories = [
		{
			content:
				"ADR-001: Keep SQLite WASM + local file SQLite zero-dependency for deterministic offline knowledge recall.",
			kind: "semantic",
			topicPath: ["architecture", "storage"],
			importance: 0.96,
			tags: ["adr", "sqlite"],
		},
		{
			content:
				"MCP stdio bridge must keep stdout strictly JSON-RPC 2.0 while forwarding diagnostic logs to stderr.",
			kind: "procedural",
			topicPath: ["operations", "mcp"],
			importance: 0.93,
			tags: ["mcp", "stdio"],
		},
		{
			content:
				"Roadmap Q2: Expose Spec Lineage, OpenAPI projection, and Web Studio on unified local workspace DBs.",
			kind: "episodic",
			topicPath: ["product", "roadmap"],
			importance: 0.88,
			tags: ["roadmap", "studio"],
		},
	] as const;

	const storedIds: string[] = [];
	let rpcId = 3;
	for (const memory of seedMemories) {
		const res = await send({
			jsonrpc: "2.0",
			id: rpcId,
			method: "tools/call",
			params: {
				name: "memory-remember",
				arguments: memory,
			},
		});
		rpcId += 1;
		const resultObj = res.result as {
			isError?: boolean;
			structuredContent?: { memory?: { id?: string } };
		};
		if (resultObj?.isError) {
			throw new Error(`memory-remember failed: ${JSON.stringify(res)}`);
		}
		if (resultObj?.structuredContent?.memory?.id) {
			storedIds.push(resultObj.structuredContent.memory.id);
		}
	}

	const recallRes = await send({
		jsonrpc: "2.0",
		id: rpcId,
		method: "tools/call",
		params: {
			name: "memory-recall",
			arguments: {
				query: "JSON-RPC stdout stderr",
				topicPath: ["operations"],
			},
		},
	});
	rpcId += 1;
	const recallObj = recallRes.result as {
		isError?: boolean;
		structuredContent?: { hits?: Array<{ content?: string }> };
		content?: Array<{ text?: string }>;
	};
	if (recallObj?.isError) {
		throw new Error(`memory-recall failed: ${JSON.stringify(recallRes)}`);
	}

	const ctxRes = await send({
		jsonrpc: "2.0",
		id: rpcId,
		method: "tools/call",
		params: {
			name: "memory-context-window",
			arguments: {
				query: "SQLite offline architecture roadmap",
				maxTokens: 500,
			},
		},
	});
	rpcId += 1;
	const ctxObj = ctxRes.result as {
		isError?: boolean;
		structuredContent?: { promptContext?: string };
		content?: Array<{ text?: string }>;
	};
	if (ctxObj?.isError) {
		throw new Error(`memory-context-window failed: ${JSON.stringify(ctxRes)}`);
	}

	const auditRes = await send({
		jsonrpc: "2.0",
		id: rpcId,
		method: "tools/call",
		params: {
			name: "ia-audit",
			arguments: {},
		},
	});
	const auditObj = auditRes.result as {
		isError?: boolean;
		structuredContent?: { healthy?: boolean; issues?: unknown[] };
		content?: Array<{ text?: string }>;
	};
	if (auditObj?.isError) {
		throw new Error(`ia-audit failed: ${JSON.stringify(auditRes)}`);
	}

	const auditHealthy =
		auditObj?.structuredContent?.healthy ??
		JSON.stringify(auditObj).includes('"healthy":true');

	const summary = {
		role: "1-mcp-ai-memory-hub",
		databasePath,
		preset,
		negotiatedProtocolVersion: negotiatedVersion,
		exposedToolsCount: tools.length,
		memoriesStored: storedIds.length || seedMemories.length,
		recallMatched:
			(recallObj?.structuredContent?.hits?.length ?? 0) > 0 ||
			JSON.stringify(recallObj).includes("JSON-RPC 2.0"),
		contextWindowTokensRequested: 500,
		contextWindowBuilt:
			Boolean(ctxObj?.structuredContent?.promptContext) ||
			(ctxObj?.content?.[0]?.text?.length ?? 0) > 0,
		iaAuditHealthy: auditHealthy,
		stderrDiagnosticLines: stderrLogs.length,
		nextServeCommand:
			databasePath === ":memory:"
				? "pnpm run demo:mcp -- --database-path ./data/demo-agent-memory.sqlite && NODE_ENV=production BUN_GRAPH_DB_AUTH_REQUIRED=false node dist/cli/index.js serve --database-path ./data/demo-agent-memory.sqlite --port 8411"
				: `NODE_ENV=production BUN_GRAPH_DB_AUTH_REQUIRED=false node dist/cli/index.js serve --database-path ${databasePath} --port 8411`,
	};

	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
	await server.close();
}
