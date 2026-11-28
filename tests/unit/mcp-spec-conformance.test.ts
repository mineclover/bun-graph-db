import {
	BAGGAGE_META_KEY,
	CLIENT_CAPABILITIES_META_KEY,
	CLIENT_INFO_META_KEY,
	isCallToolResult,
	isJSONRPCErrorResponse,
	isSpecType,
	LATEST_PROTOCOL_VERSION,
	PROTOCOL_VERSION_META_KEY,
	SERVER_INFO_META_KEY,
	SUPPORTED_PROTOCOL_VERSIONS,
	specTypeSchemas,
	TRACEPARENT_META_KEY,
	TRACESTATE_META_KEY,
} from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getPresetBlueprint } from "@/application/blueprints/PresetBlueprints.js";
import type { ILogger } from "@/application/ports/ILogger.js";
import {
	createPortableGraphNode,
	type PortableGraphNode,
} from "@/infrastructure/container/PortableBootstrap.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import {
	LATEST_LEGACY_MCP_PROTOCOL_VERSION,
	LEGACY_MCP_PROTOCOL_VERSIONS,
	MCP_META_CLIENT_CAPABILITIES,
	MCP_META_CLIENT_INFO,
	MCP_META_PROTOCOL_VERSION,
	MCP_META_SERVER_INFO,
	MCP_TRACE_META_KEYS,
	MODERN_MCP_PROTOCOL_VERSION,
	SUPPORTED_MCP_PROTOCOL_VERSIONS,
} from "@/mcp/http-server/modern-protocol.js";

const silentLogger: ILogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {},
};

const modernMeta = {
	[PROTOCOL_VERSION_META_KEY]: MODERN_MCP_PROTOCOL_VERSION,
	[CLIENT_CAPABILITIES_META_KEY]: {},
	[CLIENT_INFO_META_KEY]: {
		name: "mcp-spec-conformance-test",
		version: "1.0.0",
	},
};

function expectValidSpec<T>(
	label: string,
	schema: {
		safeParse(
			input: unknown,
		): { success: true; data: T } | { success: false; error: unknown };
	},
	payload: unknown,
): T {
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		throw new Error(
			`${label} failed @modelcontextprotocol/server schema validation: ${JSON.stringify(parsed.error, null, 2)}`,
		);
	}
	return parsed.data;
}

describe("MCP SDK specification conformance (@modelcontextprotocol/server)", () => {
	let database: SqliteDatabase;
	let node: PortableGraphNode;

	beforeAll(async () => {
		database = new SqliteDatabase(":memory:");
		node = await createPortableGraphNode(database, {
			databaseLabel: ":mcp-spec-conformance:",
			logger: silentLogger,
		});
		await node.ia.applyBlueprint(getPresetBlueprint("knowledge"));
	});

	afterAll(async () => {
		await node.dispose();
		database.close();
	});

	test("protocol version constants and _meta keys match official MCP SDK", () => {
		for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
			if (version === "2024-10-07") {
				continue;
			}
			expect(SUPPORTED_MCP_PROTOCOL_VERSIONS).toContain(version);
			expect(LEGACY_MCP_PROTOCOL_VERSIONS).toContain(version);
		}

		expect(LATEST_LEGACY_MCP_PROTOCOL_VERSION).toBe(LATEST_PROTOCOL_VERSION);
		expect(MCP_META_PROTOCOL_VERSION).toBe(PROTOCOL_VERSION_META_KEY);
		expect(MCP_META_CLIENT_CAPABILITIES).toBe(CLIENT_CAPABILITIES_META_KEY);
		expect(MCP_META_CLIENT_INFO).toBe(CLIENT_INFO_META_KEY);
		expect(MCP_META_SERVER_INFO).toBe(SERVER_INFO_META_KEY);
		expect([...MCP_TRACE_META_KEYS]).toEqual([
			TRACEPARENT_META_KEY,
			TRACESTATE_META_KEY,
			BAGGAGE_META_KEY,
		]);
	});

	test("root /mcp conforms to LTS (2025-11-25) initialize, tools/list, tools/call, ping, and error schemas", async () => {
		const ltsHeaders = {
			"Content-Type": "application/json",
			"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		};

		const initRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: LATEST_PROTOCOL_VERSION,
						capabilities: {},
						clientInfo: {
							name: "mcp-spec-conformance-test",
							version: "1.0.0",
						},
					},
				}),
			}),
		);
		expect(initRes.status).toBe(200);
		const initBody = await initRes.json();
		const initEnvelope = expectValidSpec(
			"LTS initialize JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			initBody,
		);
		expectValidSpec(
			"LTS InitializeResult",
			specTypeSchemas.InitializeResult,
			initEnvelope.result,
		);
		expect(isSpecType.InitializeResult(initEnvelope.result)).toBe(true);

		const listRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 2,
					method: "tools/list",
				}),
			}),
		);
		expect(listRes.status).toBe(200);
		const listBody = await listRes.json();
		const listEnvelope = expectValidSpec(
			"LTS tools/list JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			listBody,
		);
		const listResult = expectValidSpec(
			"LTS ListToolsResult",
			specTypeSchemas.ListToolsResult,
			listEnvelope.result,
		) as { tools: unknown[] };
		expect(listResult.tools.length).toBeGreaterThan(0);
		for (const tool of listResult.tools) {
			expectValidSpec("Root Tool", specTypeSchemas.Tool, tool);
		}

		const rememberRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 3,
					method: "tools/call",
					params: {
						name: "memory-remember",
						arguments: {
							content: "MCP SDK spec conformance memory record",
							kind: "semantic",
							namespace: "spec-check",
						},
					},
				}),
			}),
		);
		expect(rememberRes.status).toBe(200);
		const rememberBody = await rememberRes.json();
		const rememberEnvelope = expectValidSpec(
			"LTS memory-remember JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			rememberBody,
		);
		expectValidSpec(
			"LTS memory-remember CallToolResult",
			specTypeSchemas.CallToolResult,
			rememberEnvelope.result,
		);
		expect(isCallToolResult(rememberEnvelope.result)).toBe(true);

		const recallRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 4,
					method: "tools/call",
					params: {
						name: "memory-recall",
						arguments: {
							query: "conformance memory record",
							namespace: "spec-check",
							limit: 5,
						},
					},
				}),
			}),
		);
		expect(recallRes.status).toBe(200);
		const recallBody = await recallRes.json();
		const recallEnvelope = expectValidSpec(
			"LTS memory-recall JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			recallBody,
		);
		expectValidSpec(
			"LTS memory-recall CallToolResult",
			specTypeSchemas.CallToolResult,
			recallEnvelope.result,
		);
		expect(isCallToolResult(recallEnvelope.result)).toBe(true);

		const pingRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 5,
					method: "ping",
				}),
			}),
		);
		expect(pingRes.status).toBe(200);
		const pingBody = await pingRes.json();
		const pingEnvelope = expectValidSpec(
			"LTS ping JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			pingBody,
		);
		expectValidSpec(
			"LTS EmptyResult",
			specTypeSchemas.EmptyResult,
			pingEnvelope.result,
		);

		const errorRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 6,
					method: "unknown/nonexistent",
				}),
			}),
		);
		const errorBody = await errorRes.json();
		expectValidSpec(
			"LTS unknown method JSONRPCErrorResponse",
			specTypeSchemas.JSONRPCErrorResponse,
			errorBody,
		);
		expect(isJSONRPCErrorResponse(errorBody)).toBe(true);
	});

	test("root /mcp conforms to Modern (2026-07-28) server/discover and stateless tools/call schemas", async () => {
		const discoverRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION,
					"Mcp-Method": "server/discover",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 10,
					method: "server/discover",
					params: {
						_meta: modernMeta,
					},
				}),
			}),
		);
		expect(discoverRes.status).toBe(200);
		const discoverBody = await discoverRes.json();
		const discoverEnvelope = expectValidSpec(
			"Modern server/discover JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			discoverBody,
		);
		expectValidSpec(
			"Modern DiscoverResult",
			specTypeSchemas.DiscoverResult,
			discoverEnvelope.result,
		);

		const callRes = await node.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION,
					"Mcp-Method": "tools/call",
					"Mcp-Name": "memory-recall",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 11,
					method: "tools/call",
					params: {
						_meta: modernMeta,
						name: "memory-recall",
						arguments: {
							query: "conformance memory record",
							namespace: "spec-check",
							limit: 5,
						},
					},
				}),
			}),
		);
		expect(callRes.status).toBe(200);
		const callBody = await callRes.json();
		const callEnvelope = expectValidSpec(
			"Modern tools/call JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			callBody,
		);
		expectValidSpec(
			"Modern CallToolResult",
			specTypeSchemas.CallToolResult,
			callEnvelope.result,
		);
		expect(isCallToolResult(callEnvelope.result)).toBe(true);
	});

	test("table sub-MCP /sub/:tableId/mcp conforms to InitializeResult, ListToolsResult, and Tool schemas", async () => {
		const ltsHeaders = {
			"Content-Type": "application/json",
			"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		};

		const initRes = await node.fetch(
			new Request("http://localhost/sub/ia_documents/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 20,
					method: "initialize",
					params: {
						protocolVersion: LATEST_PROTOCOL_VERSION,
						capabilities: {},
						clientInfo: {
							name: "mcp-spec-conformance-test",
							version: "1.0.0",
						},
					},
				}),
			}),
		);
		expect(initRes.status).toBe(200);
		const initBody = await initRes.json();
		const initEnvelope = expectValidSpec(
			"Table Sub-MCP initialize JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			initBody,
		);
		expectValidSpec(
			"Table Sub-MCP InitializeResult",
			specTypeSchemas.InitializeResult,
			initEnvelope.result,
		);

		const listRes = await node.fetch(
			new Request("http://localhost/sub/ia_documents/mcp", {
				method: "POST",
				headers: ltsHeaders,
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 21,
					method: "tools/list",
				}),
			}),
		);
		expect(listRes.status).toBe(200);
		const listBody = await listRes.json();
		const listEnvelope = expectValidSpec(
			"Table Sub-MCP tools/list JSONRPCResultResponse",
			specTypeSchemas.JSONRPCResultResponse,
			listBody,
		);
		const listResult = expectValidSpec(
			"Table Sub-MCP ListToolsResult",
			specTypeSchemas.ListToolsResult,
			listEnvelope.result,
		) as { tools: unknown[] };
		expect(listResult.tools.length).toBeGreaterThan(0);
		for (const tool of listResult.tools) {
			expectValidSpec("Table Sub-MCP Tool", specTypeSchemas.Tool, tool);
		}
	});
});
