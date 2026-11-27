import { describe, expect, test } from "vitest";
import {
	createHeadlessGraphDb,
	type IndexedDbDatabaseLike,
	type IndexedDbFactoryLike,
	type IndexedDbObjectStoreLike,
	type IndexedDbOpenRequestLike,
	type IndexedDbRequestLike,
	IndexedDbSnapshotStorage,
	type IndexedDbTransactionLike,
	type SqliteWasmOo1DatabaseLike,
	type SqlJsDatabaseLike,
} from "@/core-sdk.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import type { SqliteBindPrimitive } from "@/infrastructure/database/sqlite/SqlitePort.js";

function createFakeIndexedDbFactory(): IndexedDbFactoryLike {
	const databases = new Map<string, Map<string, Map<string, unknown>>>();

	return {
		open(name: string): IndexedDbOpenRequestLike {
			let stores = databases.get(name);
			const needsUpgrade = !stores;
			if (!stores) {
				stores = new Map();
				databases.set(name, stores);
			}

			const db: IndexedDbDatabaseLike = {
				objectStoreNames: {
					contains(storeName: string) {
						return stores.has(storeName);
					},
				},
				createObjectStore(storeName: string) {
					const map = new Map<string, unknown>();
					stores.set(storeName, map);
					return makeStore(map);
				},
				transaction(storeNames: string | readonly string[]) {
					const storeName = Array.isArray(storeNames)
						? storeNames[0]
						: (storeNames as string);
					const map = stores.get(storeName) ?? new Map<string, unknown>();
					stores.set(storeName, map);
					const tx: IndexedDbTransactionLike = {
						objectStore: () => makeStore(map),
						oncomplete: null,
						onerror: null,
					};
					return tx;
				},
			};

			const req: IndexedDbOpenRequestLike = {
				result: db,
				error: null,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null,
			};

			queueMicrotask(() => {
				if (needsUpgrade) {
					req.onupgradeneeded?.({});
				}
				req.onsuccess?.({});
			});

			return req;
		},
	};

	function makeStore(map: Map<string, unknown>): IndexedDbObjectStoreLike {
		const emit = <T>(result: T): IndexedDbRequestLike<T> => {
			const req: IndexedDbRequestLike<T> = {
				result,
				error: null,
				onsuccess: null,
				onerror: null,
			};
			queueMicrotask(() => req.onsuccess?.({}));
			return req;
		};
		return {
			put(value: unknown) {
				const record = value as { key: string };
				map.set(record.key, value);
				return emit(record.key);
			},
			get(key: string) {
				return emit(map.get(key));
			},
			delete(key: string) {
				map.delete(key);
				return emit(undefined);
			},
			getAllKeys() {
				return emit([...map.keys()]);
			},
			getAll() {
				return emit([...map.values()]);
			},
		};
	}
}

function createSqlJsBackedAdapter(): SqlJsDatabaseLike {
	const backing = new SqliteDatabase(":memory:");
	let lastChanges = 0;

	return {
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
			const isRead = /^\s*(?:SELECT|PRAGMA|EXPLAIN|WITH)\b|\bRETURNING\b/i.test(
				sql,
			);

			const ensureExecuted = () => {
				if (rows !== null) return;
				const stmt = backing.query<
					Record<string, unknown>,
					SqliteBindPrimitive[]
				>(sql);
				if (isRead) {
					rows = stmt.all(...boundParams);
				} else {
					const result = stmt.run(...boundParams);
					lastChanges = result.changes;
					rows = [];
				}
			};

			return {
				bind(
					values?:
						| readonly SqliteBindPrimitive[]
						| Record<string, SqliteBindPrimitive>,
				) {
					if (Array.isArray(values)) {
						boundParams = [...values];
					}
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
	};
}

function createSqliteWasmOo1Adapter(): SqliteWasmOo1DatabaseLike {
	const backing = new SqliteDatabase(":memory:");
	let lastChanges = 0;

	return {
		exec({ sql, bind = [], rowMode, returnValue }) {
			const bindings = Array.isArray(bind)
				? (bind as SqliteBindPrimitive[])
				: [];
			if (returnValue === "resultRows") {
				const stmt = backing.query<
					Record<string, unknown>,
					SqliteBindPrimitive[]
				>(sql);
				const rows = stmt.all(...bindings);
				if (rowMode === "array") {
					return rows.map((row) => Object.values(row));
				}
				return rows;
			}
			if (bindings.length === 0) {
				backing.exec(sql);
				lastChanges = 0;
				return undefined;
			}
			const stmt = backing.query<
				Record<string, unknown>,
				SqliteBindPrimitive[]
			>(sql);
			const res = stmt.run(...bindings);
			lastChanges = res.changes;
			return undefined;
		},
		changes() {
			return lastChanges;
		},
		export() {
			return new Uint8Array([1, 2, 3, 4]);
		},
	};
}

describe("Headless Core SDK & IndexedDB Snapshot Storage", () => {
	test("stores, lists, reads, and deletes WASM SQLite snapshots in IndexedDbSnapshotStorage", async () => {
		const storage = new IndexedDbSnapshotStorage({
			indexedDB: createFakeIndexedDbFactory(),
			databaseName: "test-snapshots",
		});

		const payloadA = new Uint8Array([10, 20, 30]);
		const payloadB = new Uint8Array([40, 50, 60, 70]);

		const metaA = await storage.putSnapshot("workspace/a.sqlite", payloadA, {
			branch: "main",
		});
		expect(metaA.size).toBe(3);
		expect(metaA.customMetadata).toEqual({ branch: "main" });

		await storage.putSnapshot("other/b.sqlite", payloadB);

		const loaded = await storage.getSnapshot("workspace/a.sqlite");
		expect(loaded?.data).toEqual(payloadA);
		expect(loaded?.metadata?.customMetadata).toEqual({ branch: "main" });

		expect(await storage.listSnapshots("workspace/")).toEqual([
			"workspace/a.sqlite",
		]);
		expect(await storage.listSnapshots()).toEqual([
			"other/b.sqlite",
			"workspace/a.sqlite",
		]);

		await storage.deleteSnapshot("workspace/a.sqlite");
		expect(await storage.getSnapshot("workspace/a.sqlite")).toBeNull();
		expect(await storage.listSnapshots()).toEqual(["other/b.sqlite"]);
		await storage.close();
	});

	test("runs IA blueprint, zero-embedding queries, AI Memory, and snapshots cleanly on sql.js and sqlite-wasm contracts", async () => {
		const indexedStorage = new IndexedDbSnapshotStorage({
			indexedDB: createFakeIndexedDbFactory(),
		});

		const headlessSqlJs = await createHeadlessGraphDb({
			database: createSqlJsBackedAdapter(),
			databaseLabel: "web:sqljs-headless",
			snapshotStorage: indexedStorage,
		});

		try {
			const applied = await headlessSqlJs.applyPresetBlueprint("knowledge");
			expect(Object.keys(applied.tables)).toContain("ia_topics");
			expect(Object.keys(applied.tables)).toContain("ia_documents");

			const diff = await headlessSqlJs.ia.diffBlueprint(
				await headlessSqlJs.ia.exportBlueprint({ name: "knowledge-roundtrip" }),
			);
			expect(diff.upToDate).toBe(true);

			const structured = await headlessSqlJs.ia.queryStructured({
				tableIdentifier: "ia_documents",
				facets: "auto",
			});
			expect(structured.tableIdentifier).toBe("ia_documents");
			expect(structured.hits.length).toBeGreaterThanOrEqual(0);

			const outline = await headlessSqlJs.ia.getOutline({
				tableIdentifier: "ia_topics",
			});
			expect(outline.tableIdentifier).toBe("ia_topics");

			const audit = await headlessSqlJs.ia.auditArchitecture();
			expect(audit.healthy).toBe(true);

			const mem1 = await headlessSqlJs.aiMemory.remember({
				content: "Headless Core SDK runs without graphql or node built-ins.",
				kind: "semantic",
				topicPath: ["architecture", "headless"],
				importance: 0.95,
			});
			expect(mem1.memory.id).toBeTruthy();

			const recalled = await headlessSqlJs.aiMemory.recall({
				query: "Headless Core SDK",
				topicPath: ["architecture"],
			});
			expect(recalled.hits.length).toBeGreaterThanOrEqual(1);

			const ctx = await headlessSqlJs.aiMemory.getContextWindow({
				query: "Headless Core SDK",
				maxTokens: 400,
			});
			expect(ctx.promptContext).toContain("Headless Core SDK");

			const snapshotMeta = await headlessSqlJs.saveSnapshot("headless-latest", {
				engine: "sqljs",
			});
			expect(snapshotMeta.key).toBe("headless-latest");
			expect(snapshotMeta.bytes).toBeGreaterThan(0);
		} finally {
			await headlessSqlJs.dispose();
		}

		const headlessWasm = await createHeadlessGraphDb({
			database: createSqliteWasmOo1Adapter(),
			databaseLabel: "web:sqlite-wasm-oo1",
		});
		try {
			const created = await headlessWasm.createTable({
				identifier: "notes",
				description: "WASM notes",
			});
			const nodeRes = await headlessWasm.createNode({
				tableId: created.table.id,
				content: "Works cleanly on sqlite-wasm OO1",
			});
			const fetched = await headlessWasm.getNode(nodeRes.node.id);
			expect(fetched?.content).toBe("Works cleanly on sqlite-wasm OO1");
			const page = await headlessWasm.listTables();
			expect(page.nodes.some((t) => t.identifier === "notes")).toBe(true);
		} finally {
			await headlessWasm.dispose();
		}
	});
});
