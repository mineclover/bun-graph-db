import type {
	ISnapshotStoragePort,
	SnapshotMetadata,
	SnapshotObject,
} from "@/domain/ports/ISnapshotStoragePort.js";

export interface IndexedDbRequestLike<T = unknown> {
	result: T;
	error: unknown;
	onsuccess: ((event: unknown) => void) | null;
	onerror: ((event: unknown) => void) | null;
}

export interface IndexedDbOpenRequestLike
	extends IndexedDbRequestLike<IndexedDbDatabaseLike> {
	onupgradeneeded: ((event: unknown) => void) | null;
}

export interface IndexedDbObjectStoreLike {
	put(value: unknown, key?: string): IndexedDbRequestLike;
	get(key: string): IndexedDbRequestLike;
	delete(key: string): IndexedDbRequestLike;
	getAllKeys?(): IndexedDbRequestLike<unknown[]>;
	getAll?(): IndexedDbRequestLike<unknown[]>;
}

export interface IndexedDbTransactionLike {
	objectStore(name: string): IndexedDbObjectStoreLike;
	oncomplete: ((event: unknown) => void) | null;
	onerror: ((event: unknown) => void) | null;
	onabort?: ((event: unknown) => void) | null;
}

export interface IndexedDbDatabaseLike {
	objectStoreNames: { contains(name: string): boolean };
	createObjectStore(
		name: string,
		options?: { keyPath?: string },
	): IndexedDbObjectStoreLike;
	transaction(
		storeNames: string | readonly string[],
		mode?: "readonly" | "readwrite",
	): IndexedDbTransactionLike;
	close?(): void;
}

export interface IndexedDbFactoryLike {
	open(name: string, version?: number): IndexedDbOpenRequestLike;
}

export interface IndexedDbSnapshotStorageOptions {
	indexedDB?: IndexedDbFactoryLike;
	databaseName?: string;
	storeName?: string;
	version?: number;
}

interface StoredSnapshotRecord {
	key: string;
	data: Uint8Array;
	metadata: SnapshotMetadata;
}

function resolveDefaultIndexedDbFactory(): IndexedDbFactoryLike {
	const globalFactory = (globalThis as { indexedDB?: IndexedDbFactoryLike })
		.indexedDB;
	if (!globalFactory || typeof globalFactory.open !== "function") {
		throw new Error(
			"IndexedDB is not available in this environment. Pass options.indexedDB explicitly outside a browser.",
		);
	}
	return globalFactory;
}

function awaitRequest<T>(request: IndexedDbRequestLike<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(
				request.error instanceof Error
					? request.error
					: new Error(String(request.error ?? "IndexedDB request failed")),
			);
	});
}

function toUint8Array(value: unknown): Uint8Array {
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (Array.isArray(value)) {
		return new Uint8Array(value as number[]);
	}
	throw new Error("Stored IndexedDB snapshot record is missing binary bytes");
}

/**
 * Zero-dependency browser IndexedDB snapshot adapter implementing `ISnapshotStoragePort`.
 * Persists full WASM SQLite database byte snapshots cleanly across page reloads.
 */
export class IndexedDbSnapshotStorage implements ISnapshotStoragePort {
	private readonly factory: IndexedDbFactoryLike;
	private readonly databaseName: string;
	private readonly storeName: string;
	private readonly version: number;
	private dbPromise: Promise<IndexedDbDatabaseLike> | undefined;

	constructor(options: IndexedDbSnapshotStorageOptions = {}) {
		this.factory = options.indexedDB ?? resolveDefaultIndexedDbFactory();
		this.databaseName = options.databaseName ?? "bun-graph-db-snapshots";
		this.storeName = options.storeName ?? "snapshots";
		this.version = options.version ?? 1;
	}

	private openDatabase(): Promise<IndexedDbDatabaseLike> {
		if (this.dbPromise) return this.dbPromise;
		this.dbPromise = new Promise<IndexedDbDatabaseLike>((resolve, reject) => {
			const openReq = this.factory.open(this.databaseName, this.version);
			openReq.onupgradeneeded = () => {
				const db = openReq.result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName, { keyPath: "key" });
				}
			};
			openReq.onsuccess = () => resolve(openReq.result);
			openReq.onerror = () => {
				this.dbPromise = undefined;
				reject(
					openReq.error instanceof Error
						? openReq.error
						: new Error(String(openReq.error ?? "IndexedDB open failed")),
				);
			};
		});
		return this.dbPromise;
	}

	async putSnapshot(
		key: string,
		data: Uint8Array,
		customMetadata?: Record<string, string>,
	): Promise<SnapshotMetadata> {
		const db = await this.openDatabase();
		const payload = new Uint8Array(data);
		const metadata: SnapshotMetadata = {
			size: payload.byteLength,
			uploadedAt: new Date().toISOString(),
			...(customMetadata ? { customMetadata: { ...customMetadata } } : {}),
		};
		const tx = db.transaction(this.storeName, "readwrite");
		const store = tx.objectStore(this.storeName);
		await awaitRequest(
			store.put({
				key,
				data: payload,
				metadata,
			} satisfies StoredSnapshotRecord),
		);
		return metadata;
	}

	async getSnapshot(key: string): Promise<SnapshotObject | null> {
		const db = await this.openDatabase();
		const tx = db.transaction(this.storeName, "readonly");
		const store = tx.objectStore(this.storeName);
		const raw = (await awaitRequest(store.get(key))) as
			| StoredSnapshotRecord
			| undefined;
		if (!raw) return null;
		return {
			data: toUint8Array(raw.data),
			metadata: raw.metadata,
		};
	}

	async listSnapshots(prefix?: string): Promise<string[]> {
		const db = await this.openDatabase();
		const tx = db.transaction(this.storeName, "readonly");
		const store = tx.objectStore(this.storeName);

		const keys: string[] = [];
		if (typeof store.getAllKeys === "function") {
			const rawKeys = (await awaitRequest(store.getAllKeys())) as unknown[];
			for (const rawKey of rawKeys ?? []) {
				const key = String(rawKey);
				if (!prefix || key.startsWith(prefix)) {
					keys.push(key);
				}
			}
		} else if (typeof store.getAll === "function") {
			const rows = (await awaitRequest(
				store.getAll(),
			)) as StoredSnapshotRecord[];
			for (const row of rows ?? []) {
				if (!row?.key) continue;
				if (!prefix || row.key.startsWith(prefix)) {
					keys.push(row.key);
				}
			}
		}

		return keys.sort((a, b) => a.localeCompare(b));
	}

	async deleteSnapshot(key: string): Promise<void> {
		const db = await this.openDatabase();
		const tx = db.transaction(this.storeName, "readwrite");
		const store = tx.objectStore(this.storeName);
		await awaitRequest(store.delete(key));
	}

	async close(): Promise<void> {
		if (!this.dbPromise) return;
		const db = await this.dbPromise;
		this.dbPromise = undefined;
		db.close?.();
	}
}
