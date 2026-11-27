import { createInterface } from "node:readline";
import {
	getPresetBlueprint,
	type PresetBlueprintName,
} from "@/application/blueprints/PresetBlueprints.js";
import type { IEmbeddingProvider } from "@/domain/ports/IEmbeddingProvider.js";
import {
	createPortableGraphNode,
	type PortableGraphNode,
} from "@/infrastructure/container/PortableBootstrap.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import {
	isModernProtocolVersion,
	LATEST_LEGACY_MCP_PROTOCOL_VERSION,
} from "@/mcp/http-server/modern-protocol.js";

export interface McpStdioTransportOptions {
	input: NodeJS.ReadableStream;
	output: NodeJS.WritableStream;
	handleMessage: (payload: string) => Promise<string | null>;
	logger?: (line: string) => void;
	onClose?: () => void | Promise<void>;
}

export interface McpStdioTransportHandle {
	close(): Promise<void>;
}

/**
 * Line-delimited JSON-RPC 2.0 transport over stdio (`stdin`/`stdout`).
 * Notifications (`id` omitted or server HTTP 202 / empty body) emit nothing on `stdout`.
 */
export function createMcpStdioTransport(
	options: McpStdioTransportOptions,
): McpStdioTransportHandle {
	const rl = createInterface({
		input: options.input,
		crlfDelay: Number.POSITIVE_INFINITY,
	});

	let closed = false;
	let pendingQueue: Promise<void> = Promise.resolve();

	const writeResponse = (jsonLine: string): void => {
		if (closed) return;
		const normalized = jsonLine.replace(/\r?\n$/, "");
		if (!normalized) return;
		options.output.write(`${normalized}\n`);
	};

	rl.on("line", (rawLine) => {
		const trimmed = rawLine.trim();
		if (!trimmed) return;

		pendingQueue = pendingQueue
			.then(async () => {
				try {
					const responseLine = await options.handleMessage(trimmed);
					if (responseLine !== null && responseLine.trim().length > 0) {
						writeResponse(responseLine);
					}
				} catch (error) {
					options.logger?.(
						`[mcp-stdio] unexpected handler failure: ${error instanceof Error ? error.message : String(error)}`,
					);
					writeResponse(
						JSON.stringify({
							jsonrpc: "2.0",
							id: null,
							error: {
								code: -32603,
								message: "Internal error",
								data: error instanceof Error ? error.message : String(error),
							},
						}),
					);
				}
			})
			.catch(() => {});
	});

	rl.on("close", () => {
		if (!closed) {
			closed = true;
			void pendingQueue.finally(() => options.onClose?.());
		}
	});

	return {
		async close(): Promise<void> {
			if (closed) return;
			closed = true;
			rl.close();
			await pendingQueue;
			await options.onClose?.();
		},
	};
}

export interface McpStdioServerOptions {
	databasePath?: string;
	tableId?: string;
	preset?: PresetBlueprintName;
	embeddingProvider?: IEmbeddingProvider;
	input?: NodeJS.ReadableStream;
	output?: NodeJS.WritableStream;
	logger?: (line: string) => void;
}

export interface McpStdioServerHandle {
	readonly node: PortableGraphNode;
	close(): Promise<void>;
}

export async function startMcpStdioServer(
	options: McpStdioServerOptions = {},
): Promise<McpStdioServerHandle> {
	const databasePath = options.databasePath?.trim() || ":memory:";
	const db = new SqliteDatabase(databasePath);
	const node = await createPortableGraphNode(db, {
		databaseLabel: databasePath,
		runMigrations: true,
		embeddingProvider: options.embeddingProvider,
	});

	if (options.preset) {
		await node.ia.applyBlueprint(getPresetBlueprint(options.preset));
	}

	const endpoint = options.tableId
		? `http://localhost/sub/${encodeURIComponent(options.tableId)}/mcp`
		: "http://localhost/mcp";
	let activeProtocolVersion: string | undefined;

	const cleanup = async (): Promise<void> => {
		await node.dispose();
		db.close();
	};

	const transport = createMcpStdioTransport({
		input: options.input ?? process.stdin,
		output: options.output ?? process.stdout,
		logger: options.logger ?? ((line) => process.stderr.write(`${line}\n`)),
		handleMessage: async (rawLine: string) => {
			let parsed: {
				id?: unknown;
				method?: unknown;
				params?: {
					name?: unknown;
					protocolVersion?: unknown;
					_meta?: { protocolVersion?: unknown };
				};
			};
			try {
				parsed = JSON.parse(rawLine) as typeof parsed;
			} catch {
				return JSON.stringify({
					jsonrpc: "2.0",
					id: null,
					error: {
						code: -32700,
						message: "Parse error: Invalid JSON",
					},
				});
			}

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Accept: "application/json",
			};
			const metaProtocolVersion =
				typeof parsed?.params?._meta?.protocolVersion === "string"
					? parsed.params._meta.protocolVersion
					: undefined;
			if (metaProtocolVersion && isModernProtocolVersion(metaProtocolVersion)) {
				headers["MCP-Protocol-Version"] = metaProtocolVersion;
				if (typeof parsed.method === "string") {
					headers["Mcp-Method"] = parsed.method;
				}
				if (
					parsed.method === "tools/call" &&
					typeof parsed.params?.name === "string"
				) {
					const toolName = parsed.params.name;
					const isPureAscii = /^[\x20-\x7e]+$/.test(toolName);
					headers["Mcp-Name"] = isPureAscii
						? toolName
						: `=?base64?${Buffer.from(toolName, "utf8").toString("base64")}?=`;
				}
			} else if (parsed?.method !== "initialize" && activeProtocolVersion) {
				headers["MCP-Protocol-Version"] = isModernProtocolVersion(
					activeProtocolVersion,
				)
					? LATEST_LEGACY_MCP_PROTOCOL_VERSION
					: activeProtocolVersion;
			}

			const response = await node.fetch(
				new Request(endpoint, {
					method: "POST",
					headers,
					body: rawLine,
				}),
			);

			const negotiatedHeader = response.headers.get("MCP-Protocol-Version");
			if (negotiatedHeader) {
				activeProtocolVersion = negotiatedHeader;
			}

			if (response.status === 202 || response.status === 204) {
				return null;
			}

			const bodyText = (await response.text()).trim();
			if (!bodyText) {
				return null;
			}

			if (parsed?.method === "initialize") {
				try {
					const parsedBody = JSON.parse(bodyText) as {
						result?: { protocolVersion?: unknown };
					};
					if (typeof parsedBody?.result?.protocolVersion === "string") {
						activeProtocolVersion = parsedBody.result.protocolVersion;
					}
				} catch {
					// Ignore non-JSON body inspection
				}
			}

			return bodyText;
		},
	});

	return {
		node,
		async close(): Promise<void> {
			await transport.close();
			await cleanup();
		},
	};
}

export async function runStdioFromCli(
	argv: string[] = process.argv.slice(2),
): Promise<McpStdioServerHandle> {
	let databasePath: string | undefined;
	let tableId: string | undefined;
	let preset: PresetBlueprintName | undefined;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--database-path" || arg === "-d") {
			databasePath = argv[++i];
		} else if (arg?.startsWith("--database-path=")) {
			databasePath = arg.slice("--database-path=".length);
		} else if (arg === "--table" || arg === "-t") {
			tableId = argv[++i];
		} else if (arg?.startsWith("--table=")) {
			tableId = arg.slice("--table=".length);
		} else if (arg === "--preset" || arg === "-p") {
			preset = argv[++i] as PresetBlueprintName | undefined;
		} else if (arg?.startsWith("--preset=")) {
			preset = arg.slice("--preset=".length) as PresetBlueprintName;
		}
	}

	const handle = await startMcpStdioServer({ databasePath, tableId, preset });
	const stop = async () => {
		await handle.close();
		process.exit(0);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	return handle;
}
