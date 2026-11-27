// Import only non-problematic repositories at top level
import type { ISqliteDatabase } from '@/infrastructure/database/sqlite/SqlitePort.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteDocRepository } from '@/infrastructure/database/sqlite/SqliteDocRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { SqliteNodeEmbeddingRepository } from '@/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js'
import { SqliteNodeMutationRepository } from '@/infrastructure/database/sqlite/SqliteNodeMutationRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeSearchRepository } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { SqliteRelationTypeRepository } from '@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js'
import { debugApplication } from '@/shared/utils/debugLog.js'
// NOTE: SqliteTableRepository and SqliteQueryTemplateRepository are imported dynamically in factories
// to avoid module loading hang when imported together

import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens, RepositoryTokens } from '../tokens/index.js'

// Simple console logger factory to avoid circular dependencies
const createSimpleLogger = () => ({
  info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data || ''),
  debug: (msg: string, data?: unknown) => debugApplication(msg, data ? () => data : undefined),
})

/**
 * Repository module - registers all repository implementations
 *
 * Uses dynamic imports for SqliteTableRepository and SqliteQueryTemplateRepository
 * to avoid Bun module loader hang when both are imported together at top level.
 */
export function registerRepositoryModule(container: DIContainer): void {
  // Table repository - DYNAMIC IMPORT to avoid module loading hang
  container.registerSingleton(
    RepositoryTokens.TABLE_REPOSITORY,
    async (c) => {
      const { SqliteTableRepository } = await import('@/infrastructure/database/sqlite/SqliteTableRepository.js')
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteTableRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Attribute type repository
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteAttributeTypeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Attribute repository
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteAttributeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Node repository
  container.registerSingleton(
    RepositoryTokens.NODE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  container.registerSingleton(
    RepositoryTokens.NODE_MUTATION_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeMutationRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Node attribute repository
  container.registerSingleton(
    RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeAttributeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Node relation repository
  container.registerSingleton(
    RepositoryTokens.NODE_RELATION_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeRelationRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Relation type repository
  container.registerSingleton(
    RepositoryTokens.RELATION_TYPE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteRelationTypeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Query template repository - DYNAMIC IMPORT to avoid module loading hang
  container.registerSingleton(
    RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
    async (c) => {
      const { SqliteQueryTemplateRepository } = await import(
        '@/infrastructure/database/sqlite/SqliteQueryTemplateRepository.js'
      )
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteQueryTemplateRepository(connection, createSimpleLogger())
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Node search repository
  container.registerSingleton(
    RepositoryTokens.NODE_SEARCH_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeSearchRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Node embedding repository
  container.registerSingleton(
    RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteNodeEmbeddingRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Graph repository
  container.registerSingleton(
    RepositoryTokens.GRAPH_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteGraphRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  // Doc repository
  container.registerSingleton(
    RepositoryTokens.DOC_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as ISqliteDatabase
      return new SqliteDocRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )
}
