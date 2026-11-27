import type { AccessControl } from '@/application/security/AccessControl.js'
import type { AiMemoryService } from '@/application/services/AiMemoryService.js'
import type { InformationArchitectureService } from '@/application/services/InformationArchitectureService.js'
import type { EmbedNodesUseCase } from '@/application/use-cases/nodes/EmbedNodes.js'
import type { IEmbeddingProvider } from '@/domain/ports/IEmbeddingProvider.js'
import type { ISnapshotStoragePort } from '@/domain/ports/ISnapshotStoragePort.js'
import {
  createPortableGraphNode,
  type PortableGraphNode,
} from '@/infrastructure/container/PortableBootstrap.js'
import type { ISqliteDatabase } from '@/infrastructure/database/sqlite/SqlitePort.js'
import {
  type SqlJsDatabaseLike,
  type SqliteWasmOo1DatabaseLike,
  WebSqliteDatabase,
  wrapWebSqliteDatabase,
} from '@/infrastructure/database/sqlite/WebSqliteAdapter.js'

export interface EmbeddedWebGraphDbOptions {
  database: ISqliteDatabase | SqlJsDatabaseLike | SqliteWasmOo1DatabaseLike
  databaseLabel?: string
  runMigrations?: boolean
  embeddingProvider?: IEmbeddingProvider
  snapshotStorage?: ISnapshotStoragePort
  accessControl?: AccessControl
  internalBridgeToken?: string
}

export interface EmbeddedWebGraphDb {
  readonly node: PortableGraphNode
  readonly database: ISqliteDatabase
  readonly ia: InformationArchitectureService
  readonly aiMemory: AiMemoryService
  readonly embedNodes?: EmbedNodesUseCase
  fetch: PortableGraphNode['fetch']
  executeGraphQL: PortableGraphNode['executeGraphQL']
  exportDatabaseBytes(): Uint8Array | null
  saveSnapshot(key: string, customMetadata?: Record<string, string>): Promise<{ key: string; bytes: number }>
  dispose(): Promise<void>
}

/**
 * Browser / Web-embedded entrypoint wrapping a synchronous Web SQLite engine
 * (`sql.js` or `@sqlite.org/sqlite-wasm` OO1) with full GraphQL, REST, MCP (`2026-07-28`),
 * Information Architecture, `google/embeddinggemma-2` auto-embedding, and 5-signal AI Memory.
 */
export async function createEmbeddedWebGraphDb(
  options: EmbeddedWebGraphDbOptions,
): Promise<EmbeddedWebGraphDb> {
  const database = wrapWebSqliteDatabase(options.database, {
    filename: options.databaseLabel,
  })
  const node = await createPortableGraphNode(database, {
    databaseLabel: options.databaseLabel ?? ':web-embedded:',
    runMigrations: options.runMigrations,
    snapshotStorage: options.snapshotStorage,
    embeddingProvider: options.embeddingProvider,
    accessControl: options.accessControl,
    internalBridgeToken: options.internalBridgeToken,
  })

  return {
    node,
    database,
    ia: node.ia,
    aiMemory: node.aiMemory,
    embedNodes: node.embedNodes,
    fetch: node.fetch,
    executeGraphQL: node.executeGraphQL,
    exportDatabaseBytes(): Uint8Array | null {
      if (database instanceof WebSqliteDatabase) {
        return database.exportBytes()
      }
      return null
    },
    async saveSnapshot(
      key: string,
      customMetadata?: Record<string, string>,
    ): Promise<{ key: string; bytes: number }> {
      if (!options.snapshotStorage) {
        throw new Error('snapshotStorage is not configured for saveSnapshot()')
      }
      const bytes = database instanceof WebSqliteDatabase ? database.exportBytes() : null
      if (!bytes) {
        throw new Error('Underlying web SQLite driver does not expose export() bytes')
      }
      const meta = await options.snapshotStorage.putSnapshot(key, bytes, customMetadata)
      return { key, bytes: meta.size }
    },
    async dispose(): Promise<void> {
      await node.dispose()
      database.close?.()
    },
  }
}
