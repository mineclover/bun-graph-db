import { createServer } from "node:http";
import workerDefault, {
	GraphNodeDurableObject,
	type WorkerEnv,
} from "../../deploy/cloudflare/worker.js";
import type {
	CloudflareR2BucketLike,
	CloudflareR2ObjectLike,
} from "../../src/domain/ports/ISnapshotStoragePort.js";
import type {
	DoSqlStorageCursor,
	DoStorageLike,
} from "../../src/infrastructure/database/sqlite/DoSqliteAdapter.js";
import { Database as SqliteDatabase } from "../../src/infrastructure/database/sqlite/SqliteAdapter.js";
import type { SqliteBindPrimitive } from "../../src/infrastructure/database/sqlite/SqlitePort.js";
import type {
	DurableObjectNamespaceLike,
	DurableObjectStubLike,
} from "../../src/presentation/cloudflare/CloudflareSingleNodeWorker.js";

function readFlag(args: readonly string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (!current) continue;
		if (current === name) return args[i + 1];
		if (current.startsWith(`${name}=`)) return current.slice(name.length + 1);
	}
	return undefined;
}

function createLocalDoStorage(): {
	storage: DoStorageLike;
	close(): void;
} {
	const db = new SqliteDatabase(":memory:");
	const storage: DoStorageLike = {
		sql: {
			exec<TRow = Record<string, unknown>>(
				query: string,
				...bindings: unknown[]
			): DoSqlStorageCursor<TRow> {
				const trimmed = query.trim();
				const typedBindings = bindings as SqliteBindPrimitive[];
				const isRead = /^(?:SELECT|PRAGMA|EXPLAIN|WITH)\b|\bRETURNING\b/i.test(
					trimmed,
				);

				let rows: TRow[] = [];
				let rowsWritten = 0;

				if (typedBindings.length === 0 && !isRead && trimmed.includes(";")) {
					db.exec(query);
				} else if (isRead) {
					const stmt = db.query<TRow, SqliteBindPrimitive[]>(query);
					rows = stmt.all(...typedBindings);
				} else {
					const stmt = db.query<TRow, SqliteBindPrimitive[]>(query);
					const res = stmt.run(...typedBindings);
					rowsWritten = Number(res.changes);
				}

				const resultRows = rows;
				return {
					toArray: () => resultRows,
					one: () => {
						const first = resultRows[0];
						if (!first)
							throw new Error("Expected one row from DO SQLite query");
						return first;
					},
					rowsRead: resultRows.length,
					rowsWritten,
					[Symbol.iterator]: () => resultRows[Symbol.iterator](),
				};
			},
		},
		transactionSync<T>(callback: () => T): T {
			return db.transaction(callback)();
		},
	};
	return { storage, close: () => db.close() };
}

function createMemoryR2Bucket(): CloudflareR2BucketLike {
	const objects = new Map<
		string,
		{ data: Uint8Array; customMetadata?: Record<string, string> }
	>();
	return {
		async put(key, value, options) {
			const bytes =
				typeof value === "string"
					? new TextEncoder().encode(value)
					: value instanceof Uint8Array
						? value
						: new Uint8Array(value);
			objects.set(key, {
				data: bytes,
				customMetadata: options?.customMetadata,
			});
			return {
				key,
				size: bytes.byteLength,
				etag: `etag-${key}`,
				uploaded: new Date(),
				customMetadata: options?.customMetadata,
			};
		},
		async get(key): Promise<CloudflareR2ObjectLike | null> {
			const found = objects.get(key);
			if (!found) return null;
			return {
				key,
				size: found.data.byteLength,
				customMetadata: found.customMetadata,
				async arrayBuffer() {
					return found.data.slice().buffer;
				},
			};
		},
		async list(options) {
			const prefix = options?.prefix ?? "";
			const matched = Array.from(objects.entries())
				.filter(([k]) => !prefix || k.startsWith(prefix))
				.map(([key, entry]) => ({
					key,
					size: entry.data.byteLength,
					customMetadata: entry.customMetadata,
				}));
			return { objects: matched, truncated: false };
		},
		async delete(keys) {
			const list = Array.isArray(keys) ? keys : [keys];
			for (const key of list) objects.delete(key);
		},
	};
}

const ADMIN_TOKEN = "cf-demo-admin-token-32chars-minimum-01";
const READER_TOKEN = "cf-demo-reader-token-32chars-minimum-2";
const INTERNAL_BRIDGE_TOKEN = "cf-demo-internal-bridge-token-32chars-0";

const tenantStorages = new Map<
	string,
	{
		doInstance: GraphNodeDurableObject;
		close: () => void;
	}
>();

const r2Bucket = createMemoryR2Bucket();

const env: WorkerEnv = {
	NODE_ENV: "production",
	BUN_GRAPH_DB_AUTH_REQUIRED: "true",
	BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
		[ADMIN_TOKEN]: { id: "cf-admin", role: "admin", tableIds: ["*"] },
		[READER_TOKEN]: { id: "cf-reader", role: "reader", tableIds: ["*"] },
	}),
	BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN: INTERNAL_BRIDGE_TOKEN,
	DEFAULT_NODE_KEY: "workspace-alpha",
	GRAPH_NODE_HEADER: "x-graph-node-id",
	SNAPSHOT_BUCKET: r2Bucket,
	GRAPH_NODE: {
		idFromName: (name: string) => name,
		get: (id: unknown): DurableObjectStubLike => {
			const name = String(id);
			let entry = tenantStorages.get(name);
			if (!entry) {
				const local = createLocalDoStorage();
				const doInstance = new GraphNodeDurableObject(
					{
						storage: local.storage,
						id: { toString: () => name, name },
					},
					env,
				);
				entry = { doInstance, close: local.close };
				tenantStorages.set(name, entry);
			}
			return {
				async fetch(input, init) {
					const req =
						input instanceof Request ? input : new Request(String(input), init);
					return await entry.doInstance.fetch(req);
				},
			};
		},
	} satisfies DurableObjectNamespaceLike,
};

async function runVerification() {
	const alphaHeaders = {
		"x-graph-node-id": "workspace-alpha",
		Authorization: `Bearer ${ADMIN_TOKEN}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};
	const betaHeaders = {
		"x-graph-node-id": "workspace-beta",
		Authorization: `Bearer ${ADMIN_TOKEN}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	const initAlpha = await workerDefault.fetch(
		new Request("https://edge.example/mcp", {
			method: "POST",
			headers: alphaHeaders,
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "cf-demo", version: "1.0.0" },
				},
			}),
		}),
		env,
	);
	if (initAlpha.status !== 200) {
		throw new Error(`Alpha init failed: ${initAlpha.status}`);
	}

	const rememberAlpha = await workerDefault.fetch(
		new Request("https://edge.example/mcp", {
			method: "POST",
			headers: { ...alphaHeaders, "MCP-Protocol-Version": "2025-11-25" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: {
					name: "memory-remember",
					arguments: {
						content: "Alpha tenant secret roadmap note on Cloudflare DO.",
						kind: "semantic",
						topicPath: ["tenant", "alpha"],
					},
				},
			}),
		}),
		env,
	);
	if (rememberAlpha.status !== 200) {
		throw new Error(`Alpha remember failed: ${rememberAlpha.status}`);
	}

	const recallAlpha = await workerDefault.fetch(
		new Request("https://edge.example/mcp", {
			method: "POST",
			headers: { ...alphaHeaders, "MCP-Protocol-Version": "2025-11-25" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "memory-recall",
					arguments: { query: "Alpha tenant secret" },
				},
			}),
		}),
		env,
	);
	const alphaRecallText = await recallAlpha.text();

	const recallBeta = await workerDefault.fetch(
		new Request("https://edge.example/mcp", {
			method: "POST",
			headers: { ...betaHeaders, "MCP-Protocol-Version": "2025-11-25" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 4,
				method: "tools/call",
				params: {
					name: "memory-recall",
					arguments: { query: "Alpha tenant secret" },
				},
			}),
		}),
		env,
	);
	const betaRecallText = await recallBeta.text();

	const readerHealth = await workerDefault.fetch(
		new Request("https://edge.example/health", {
			headers: {
				"x-graph-node-id": "workspace-alpha",
				Authorization: `Bearer ${READER_TOKEN}`,
			},
		}),
		env,
	);
	const readerMetrics = await workerDefault.fetch(
		new Request("https://edge.example/metrics", {
			headers: {
				"x-graph-node-id": "workspace-alpha",
				Authorization: `Bearer ${READER_TOKEN}`,
			},
		}),
		env,
	);
	const adminMetrics = await workerDefault.fetch(
		new Request("https://edge.example/metrics", {
			headers: {
				"x-graph-node-id": "workspace-alpha",
				Authorization: `Bearer ${ADMIN_TOKEN}`,
			},
		}),
		env,
	);
	const auditLogRes = await workerDefault.fetch(
		new Request("https://edge.example/api/audit-log", {
			headers: {
				"x-graph-node-id": "workspace-alpha",
				Authorization: `Bearer ${ADMIN_TOKEN}`,
			},
		}),
		env,
	);
	const studioRes = await workerDefault.fetch(
		new Request("https://edge.example/studio", {
			headers: { "x-graph-node-id": "workspace-alpha" },
		}),
		env,
	);

	return {
		role: "4-cloudflare-do-edge-hub",
		alphaTenantMatched: alphaRecallText.includes("Alpha tenant secret"),
		betaTenantIsolated: !betaRecallText.includes("Alpha tenant secret"),
		readerHealthStatus: readerHealth.status,
		readerMetricsBlockedStatus: readerMetrics.status,
		adminMetricsStatus: adminMetrics.status,
		adminAuditLogStatus: auditLogRes.status,
		studioStatus: studioRes.status,
	};
}

const argv = process.argv.slice(2);
const serveMode = argv.includes("--serve");
const port = Number(readFlag(argv, "--port") ?? "8414");

const verification = await runVerification();
if (
	!verification.alphaTenantMatched ||
	!verification.betaTenantIsolated ||
	verification.readerMetricsBlockedStatus !== 403 ||
	verification.adminMetricsStatus !== 200 ||
	verification.studioStatus !== 200
) {
	throw new Error(
		`DO worker verification failed: ${JSON.stringify(verification)}`,
	);
}

process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);

if (serveMode) {
	const server = createServer(async (req, res) => {
		const url = `http://127.0.0.1:${port}${req.url ?? "/"}`;
		const chunks: Buffer[] = [];
		for await (const chunk of req) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const headers = new Headers();
		for (const [k, v] of Object.entries(req.headers)) {
			if (typeof v === "string") headers.set(k, v);
			else if (Array.isArray(v)) headers.set(k, v.join(", "));
		}
		const method = req.method ?? "GET";
		const webReq = new Request(url, {
			method,
			headers,
			body:
				method === "GET" || method === "HEAD"
					? undefined
					: Buffer.concat(chunks),
		});
		const webRes = await workerDefault.fetch(webReq, env);
		res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
		res.end(Buffer.from(await webRes.arrayBuffer()));
	});

	await new Promise<void>((resolvePromise) => {
		server.listen(port, "127.0.0.1", () => resolvePromise());
	});
	process.stderr.write(
		`Cloudflare DO Multi-Tenant Simulator serving on http://127.0.0.1:${port}/studio (admin token: ${ADMIN_TOKEN})\n`,
	);

	const shutdown = () => {
		server.close();
		for (const entry of tenantStorages.values()) entry.close();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
} else {
	for (const entry of tenantStorages.values()) entry.close();
}
