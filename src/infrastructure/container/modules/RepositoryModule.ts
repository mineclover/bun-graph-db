import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeSearchRepository } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { SqliteQueryTemplateRepository } from '@/infrastructure/database/sqlite/SqliteQueryTemplateRepository.js'
import { SqliteRelationTypeRepository } from '@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository.js'
import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens, RepositoryTokens } from '../tokens/index.js'

// Simple console logger factory to avoid circular dependencies
const createSimpleLogger = () => ({
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
})

/**
 * Repository module - registers all repository implementations
 */
export function registerRepositoryModule(container: DIContainer): void {
  // Table repository
  container.registerSingleton(
    RepositoryTokens.TABLE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteTableRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Attribute type repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteAttributeTypeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Attribute repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteAttributeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Node repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.NODE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteNodeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Node attribute repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteNodeAttributeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Node relation repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.NODE_RELATION_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteNodeRelationRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Relation type repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.RELATION_TYPE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteRelationTypeRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Query template repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteQueryTemplateRepository(connection, createSimpleLogger())
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Node search repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.NODE_SEARCH_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteNodeSearchRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )

  // Graph repository (removed logger dependency to break circular reference)
  container.registerSingleton(
    RepositoryTokens.GRAPH_REPOSITORY,
    async (c) => {
      const connection = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as any
      return new SqliteGraphRepository(connection)
    },
    [DatabaseTokens.DATABASE_CONNECTION]
  )
}
