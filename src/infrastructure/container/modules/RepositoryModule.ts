import { SQLiteQueryTemplateRepository } from '@/infrastructure/database/repositories/SQLiteQueryTemplateRepository.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeSearchRepository } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { SqliteRelationTypeRepository } from '@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, DatabaseTokens, RepositoryTokens } from '../tokens/index.js'

/**
 * Repository module - registers all repository implementations
 */
export function registerRepositoryModule(container: DIContainer): void {
  // Table repository
  container.registerSingleton(
    RepositoryTokens.TABLE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteTableRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Attribute type repository
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteAttributeTypeRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Attribute repository
  container.registerSingleton(
    RepositoryTokens.ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteAttributeRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Node repository
  container.registerSingleton(
    RepositoryTokens.NODE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteNodeRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Node attribute repository
  container.registerSingleton(
    RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteNodeAttributeRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Node relation repository
  container.registerSingleton(
    RepositoryTokens.NODE_RELATION_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteNodeRelationRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Relation type repository
  container.registerSingleton(
    RepositoryTokens.RELATION_TYPE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteRelationTypeRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Query template repository
  container.registerSingleton(
    RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SQLiteQueryTemplateRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Node search repository
  container.registerSingleton(
    RepositoryTokens.NODE_SEARCH_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteNodeSearchRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )

  // Graph repository
  container.registerSingleton(
    RepositoryTokens.GRAPH_REPOSITORY,
    async (c) => {
      const connection = await c.resolve(DatabaseTokens.DATABASE_CONNECTION)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SqliteGraphRepository(connection, logger)
    },
    [DatabaseTokens.DATABASE_CONNECTION, CommonTokens.LOGGER]
  )
}
