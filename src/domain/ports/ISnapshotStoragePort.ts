export interface SnapshotMetadata {
  size: number
  uploadedAt: string
  customMetadata?: Record<string, string>
}

export interface SnapshotObject {
  data: Uint8Array
  metadata?: SnapshotMetadata
}

/**
 * Storage port for full-graph/SQLite snapshots across single-node deployments
 * (in-memory tests, Cloudflare R2 buckets, or local filesystem adapters).
 */
export interface ISnapshotStoragePort {
  putSnapshot(
    key: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>,
  ): Promise<SnapshotMetadata>
  getSnapshot(key: string): Promise<SnapshotObject | null>
  deleteSnapshot(key: string): Promise<void>
  listSnapshots(prefix?: string): Promise<string[]>
}

export class InMemorySnapshotStorage implements ISnapshotStoragePort {
  private readonly store = new Map<
    string,
    { data: Uint8Array; metadata: SnapshotMetadata }
  >()

  async putSnapshot(
    key: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>,
  ): Promise<SnapshotMetadata> {
    const copy = new Uint8Array(data)
    const metadata: SnapshotMetadata = {
      size: copy.byteLength,
      uploadedAt: new Date().toISOString(),
      ...(customMetadata ? { customMetadata: { ...customMetadata } } : {}),
    }
    this.store.set(key, { data: copy, metadata })
    return {
      ...metadata,
      ...(metadata.customMetadata
        ? { customMetadata: { ...metadata.customMetadata } }
        : {}),
    }
  }

  async getSnapshot(key: string): Promise<SnapshotObject | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    return {
      data: new Uint8Array(entry.data),
      metadata: {
        ...entry.metadata,
        ...(entry.metadata.customMetadata
          ? { customMetadata: { ...entry.metadata.customMetadata } }
          : {}),
      },
    }
  }

  async deleteSnapshot(key: string): Promise<void> {
    this.store.delete(key)
  }

  async listSnapshots(prefix?: string): Promise<string[]> {
    const keys = [...this.store.keys()]
    const filtered = prefix ? keys.filter((k) => k.startsWith(prefix)) : keys
    return filtered.sort((a, b) => a.localeCompare(b))
  }
}

export interface CloudflareR2ObjectBodyLike {
  arrayBuffer(): Promise<ArrayBuffer>
  size?: number
  customMetadata?: Record<string, string>
  uploaded?: Date
}

export interface CloudflareR2ListObjectLike {
  key: string
}

export interface CloudflareR2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    options?: { customMetadata?: Record<string, string> },
  ): Promise<unknown>
  get(key: string): Promise<CloudflareR2ObjectBodyLike | null>
  delete(keys: string | string[]): Promise<void>
  list(options?: { prefix?: string }): Promise<{ objects: CloudflareR2ListObjectLike[] }>
}

export class R2BucketSnapshotStorage implements ISnapshotStoragePort {
  constructor(private readonly bucket: CloudflareR2BucketLike) {}

  async putSnapshot(
    key: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>,
  ): Promise<SnapshotMetadata> {
    await this.bucket.put(
      key,
      data,
      customMetadata ? { customMetadata } : undefined,
    )
    return {
      size: data.byteLength,
      uploadedAt: new Date().toISOString(),
      ...(customMetadata ? { customMetadata: { ...customMetadata } } : {}),
    }
  }

  async getSnapshot(key: string): Promise<SnapshotObject | null> {
    const object = await this.bucket.get(key)
    if (!object) return null
    const buffer = await object.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    return {
      data: bytes,
      metadata: {
        size: object.size ?? bytes.byteLength,
        uploadedAt: (object.uploaded ?? new Date()).toISOString(),
        ...(object.customMetadata
          ? { customMetadata: { ...object.customMetadata } }
          : {}),
      },
    }
  }

  async deleteSnapshot(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  async listSnapshots(prefix?: string): Promise<string[]> {
    const result = await this.bucket.list(prefix ? { prefix } : undefined)
    return result.objects.map((item) => item.key)
  }
}
