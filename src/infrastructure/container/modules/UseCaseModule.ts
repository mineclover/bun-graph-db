import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import { ExecuteTemplateWithSubscriptionUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithSubscriptionUseCase.js'
import { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'
import { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../tokens/index.js'

/**
 * Use case module - registers all application use cases
 */
export function registerUseCaseModule(container: DIContainer): void {
  // Table use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_TABLE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateTableUseCase(repository, simpleLogger)
    },
    [RepositoryTokens.TABLE_REPOSITORY]
  )

  container.registerSingleton(
    UseCaseTokens.DELETE_TABLE_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      const relationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new DeleteTableUseCase(
        tableRepository,
        nodeRepository,
        attributeRepository,
        relationRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    ]
  )

  // Attribute use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateAttributeTypeUseCase(repository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY]
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateAttributeUseCase(
        attributeRepository,
        attributeTypeRepository,
        tableRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ]
  )

  // Node use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_NODE_USE_CASE,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateNodeUseCase(
        nodeRepository,
        nodeAttributeRepository,
        tableRepository,
        attributeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_NODES_USE_CASE,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const nodeSearchRepository = await c.resolve(RepositoryTokens.NODE_SEARCH_REPOSITORY) as any
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new SearchNodesUseCase(nodeRepository, nodeSearchRepository, attributeRepository, tableRepository, simpleLogger)
    },
    [RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.NODE_SEARCH_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY]
  )

  // Relation use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_USE_CASE,
    async (c) => {
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as any
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as any
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateRelationUseCase(
        nodeRelationRepository,
        relationTypeRepository,
        nodeRepository,
        tableRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new CreateRelationTypeUseCase(repository, simpleLogger)
    },
    [RepositoryTokens.RELATION_TYPE_REPOSITORY]
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const relationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as any
      const graphRepository = await c.resolve(RepositoryTokens.GRAPH_REPOSITORY) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new SearchRelatedNodesUseCase(nodeRepository, relationRepository, graphRepository, tableRepository, simpleLogger)
    },
    [RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.NODE_RELATION_REPOSITORY, RepositoryTokens.GRAPH_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY]
  )

  // Import/Export use cases
  container.registerSingleton(
    UseCaseTokens.SCHEMA_EXPORT_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as any
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const relationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as any
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new SchemaExportUseCase(
        tableRepository,
        attributeTypeRepository,
        attributeRepository,
        nodeRepository,
        relationRepository,
        relationTypeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    UseCaseTokens.SCHEMA_IMPORT_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as any
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as any
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as any
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as any
      const relationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as any
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new SchemaImportUseCase(
        tableRepository,
        attributeTypeRepository,
        attributeRepository,
        nodeRepository,
        relationRepository,
        relationTypeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  // Query template use cases
  container.registerSingleton(
    UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new ExecuteQueryTemplateUseCase(queryTemplateRepository, simpleLogger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY]
  )

  container.registerSingleton(
    UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE,
    async (c) => {
      const executeQueryTemplateUseCase = await c.resolve(UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE) as any
      const graphqlSchema = await c.resolve(GraphQLTokens.GRAPHQL_SCHEMA) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new ExecuteTemplateWithGraphQLUseCase(executeQueryTemplateUseCase, graphqlSchema, simpleLogger)
    },
    [UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE, GraphQLTokens.GRAPHQL_SCHEMA]
  )

  container.registerSingleton(
    UseCaseTokens.EXECUTE_TEMPLATE_WITH_SUBSCRIPTION_USE_CASE,
    async (c) => {
      const executeTemplateWithGraphQLUseCase = await c.resolve(UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new ExecuteTemplateWithSubscriptionUseCase(executeTemplateWithGraphQLUseCase, simpleLogger)
    },
    [UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE]
  )
}
