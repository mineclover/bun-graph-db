import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { createHeadlessGraphDb } from "../../src/core-sdk.js";
import { IndexedDbSnapshotStorage } from "../../src/infrastructure/database/sqlite/IndexedDbSnapshotStorage.js";
import { Database as SqliteDatabase } from "../../src/infrastructure/database/sqlite/SqliteAdapter.js";
import type { SqliteBindPrimitive } from "../../src/infrastructure/database/sqlite/SqlitePort.js";

function readFlag(args: readonly string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (!current) continue;
		if (current === name) return args[i + 1];
		if (current.startsWith(`${name}=`)) return current.slice(name.length + 1);
	}
	return undefined;
}

function createMemoryBackedIdbFactory(): IDBFactory {
	const databases = new Map<string, Map<string, Map<string, unknown>>>();

	function makeRequest<T>(executor: () => T): IDBRequest<T> {
		const request: Record<string, unknown> = {
			result: undefined,
			error: null,
			onsuccess: null,
			onerror: null,
			onupgradeneeded: null,
		};
		queueMicrotask(() => {
			try {
				request.result = executor();
				const handler = request.onsuccess as
					| ((ev: Event) => void)
					| null
					| undefined;
				handler?.({ target: request } as unknown as Event);
			} catch (err) {
				request.error = err;
				const errHandler = request.onerror as
					| ((ev: Event) => void)
					| null
					| undefined;
				errHandler?.({ target: request } as unknown as Event);
			}
		});
		return request as unknown as IDBRequest<T>;
	}

	return {
		open(name: string) {
			let storeMap = databases.get(name);
			const isUpgrade = !storeMap;
			if (!storeMap) {
				storeMap = new Map();
				databases.set(name, storeMap);
			}
			const db = {
				objectStoreNames: {
					contains: (storeName: string) => storeMap.has(storeName),
				},
				createObjectStore: (storeName: string) => {
					if (!storeMap.has(storeName)) storeMap.set(storeName, new Map());
					return {};
				},
				transaction: (storeName: string) => {
					const records =
						storeMap.get(storeName) ??
						(() => {
							const created = new Map<string, unknown>();
							storeMap.set(storeName, created);
							return created;
						})();
					const tx: Record<string, unknown> = {
						error: null,
						oncomplete: null,
						onerror: null,
						onabort: null,
						objectStore: () => ({
							put: (value: unknown, key?: string) =>
								makeRequest(() => {
									const resolvedKey =
										key ?? (value as { key?: string })?.key ?? "";
									records.set(resolvedKey, value);
									queueMicrotask(() =>
										(tx.oncomplete as ((e: Event) => void) | null)?.(
											{} as Event,
										),
									);
									return resolvedKey;
								}),
							get: (key: string) =>
								makeRequest(() => {
									const val = records.get(key);
									queueMicrotask(() =>
										(tx.oncomplete as ((e: Event) => void) | null)?.(
											{} as Event,
										),
									);
									return val;
								}),
							getAllKeys: () =>
								makeRequest(() => {
									const keys = Array.from(records.keys());
									queueMicrotask(() =>
										(tx.oncomplete as ((e: Event) => void) | null)?.(
											{} as Event,
										),
									);
									return keys;
								}),
							delete: (key: string) =>
								makeRequest(() => {
									records.delete(key);
									queueMicrotask(() =>
										(tx.oncomplete as ((e: Event) => void) | null)?.(
											{} as Event,
										),
									);
									return undefined;
								}),
						}),
					};
					return tx as unknown as IDBTransaction;
				},
				close: () => {},
			};

			const openReq: Record<string, unknown> = {
				result: db,
				error: null,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null,
			};
			queueMicrotask(() => {
				if (isUpgrade) {
					(openReq.onupgradeneeded as ((e: Event) => void) | null)?.({
						target: openReq,
					} as unknown as Event);
				}
				(openReq.onsuccess as ((e: Event) => void) | null)?.({
					target: openReq,
				} as unknown as Event);
			});
			return openReq as unknown as IDBOpenDBRequest;
		},
		cmp: (a: unknown, b: unknown) =>
			String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0,
		deleteDatabase: (name: string) => {
			databases.delete(name);
			return makeRequest(() => undefined) as unknown as IDBOpenDBRequest;
		},
		databases: async () =>
			Array.from(databases.keys()).map((name) => ({ name, version: 1 })),
	} as unknown as IDBFactory;
}

function createSqlJsContractOverSqlite() {
	const backing = new SqliteDatabase(":memory:");
	let lastChanges = 0;

	return {
		adapter: {
			exec(sql: string) {
				backing.exec(sql);
			},
			getRowsModified() {
				return lastChanges;
			},
			export() {
				return new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]);
			},
			prepare(sql: string, initialParams: readonly SqliteBindPrimitive[] = []) {
				let boundParams = [...initialParams];
				let rows: Array<Record<string, unknown>> | null = null;
				let cursor = -1;
				const isRead =
					/^\s*(?:SELECT|PRAGMA|EXPLAIN|WITH)\b|\bRETURNING\b/i.test(sql);

				const ensureExecuted = () => {
					if (rows !== null) return;
					const stmt = backing.query<
						Record<string, unknown>,
						SqliteBindPrimitive[]
					>(sql);
					if (isRead) {
						rows = stmt.all(...boundParams);
					} else {
						const res = stmt.run(...boundParams);
						lastChanges = Number(res.changes);
						rows = [];
					}
				};

				return {
					bind(
						values?:
							| readonly SqliteBindPrimitive[]
							| Record<string, SqliteBindPrimitive>,
					) {
						if (Array.isArray(values)) boundParams = [...values];
						rows = null;
						cursor = -1;
						return true;
					},
					step() {
						ensureExecuted();
						cursor += 1;
						return cursor < (rows?.length ?? 0);
					},
					getAsObject() {
						ensureExecuted();
						if (cursor < 0) cursor = 0;
						return rows?.[cursor] ?? {};
					},
					free() {
						return true;
					},
				};
			},
		},
		close() {
			backing.close();
		},
	};
}

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".d.ts": "text/plain; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".css": "text/css; charset=utf-8",
};

const argv = process.argv.slice(2);
if (argv.includes("--serve")) {
	const port = Number(readFlag(argv, "--port") ?? "8413");
	const repoRoot = resolve(import.meta.dirname, "../..");
	const demoHtmlPath = resolve(import.meta.dirname, "index.html");
	const distCoreDir = resolve(repoRoot, "dist/core");

	const server = createServer(async (req, res) => {
		const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
		try {
			if (urlPath === "/" || urlPath === "/index.html") {
				const html = await readFile(demoHtmlPath, "utf8");
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(html);
				return;
			}
			if (urlPath.startsWith("/dist/core/")) {
				const rel = normalize(urlPath.slice("/dist/core/".length)).replace(
					/^(\.\.[/\\])+/,
					"",
				);
				const target = resolve(distCoreDir, rel);
				if (!target.startsWith(distCoreDir)) {
					res.writeHead(403).end("Forbidden");
					return;
				}
				const body = await readFile(target);
				const ext = extname(target);
				res.writeHead(200, {
					"Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
				});
				res.end(body);
				return;
			}
			res.writeHead(404).end("Not Found");
		} catch (err) {
			res
				.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
				.end(err instanceof Error ? err.message : "Not Found");
		}
	});

	await new Promise<void>((resolvePromise) => {
		server.listen(port, "127.0.0.1", () => resolvePromise());
	});
	process.stderr.write(
		`Web Embedded Core Demo serving at http://127.0.0.1:${port}/\n`,
	);

	const shutdown = () => {
		server.close();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
} else {
	const storage = new IndexedDbSnapshotStorage({
		indexedDB: createMemoryBackedIdbFactory(),
		databaseName: "demo-web-embedded",
	});
	const { adapter, close } = createSqlJsContractOverSqlite();
	const db = await createHeadlessGraphDb({
		database: adapter,
		databaseLabel: "browser:demo",
		snapshotStorage: storage,
	});

	try {
		await db.applyPresetBlueprint("knowledge");
		await db.aiMemory.remember({
			content:
				"Offline web clients persist SQLite snapshots to IndexedDB after knowledge updates.",
			kind: "semantic",
			topicPath: ["web-embedded", "indexeddb"],
			importance: 0.91,
		});
		const outline = await db.ia.getOutline({ tableIdentifier: "ia_topics" });
		const recalled = await db.aiMemory.recall({
			query: "IndexedDB",
			topicPath: ["web-embedded"],
		});
		const audit = await db.ia.auditArchitecture();
		const snapshotMeta = await db.saveSnapshot("latest");
		const snapshotList = await storage.listSnapshots();

		process.stdout.write(
			`${JSON.stringify(
				{
					role: "3-web-embedded-offline-first",
					iaOutlineTable: outline.tableIdentifier,
					iaOutlineRoots: outline.roots.length,
					recalledHits: recalled.hits.length,
					iaAuditHealthy: audit.healthy,
					snapshotSavedKey: snapshotMeta.key,
					snapshotBytes: snapshotMeta.bytes,
					indexedDbSnapshots: snapshotList,
					nextServeCommand:
						"node --import tsx examples/web-embedded-ia-memory/demo.ts --serve --port 8413",
				},
				null,
				2,
			)}\n`,
		);
	} finally {
		await db.dispose();
		close();
	}
}
