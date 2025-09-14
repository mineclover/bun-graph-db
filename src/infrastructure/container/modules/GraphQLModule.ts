import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import {
  AttributeFieldResolvers,
  NodeFieldResolvers,
  QueryTemplateFieldResolvers,
  RelationFieldResolvers,
  TableFieldResolvers,
} from '@/presentation/graphql/field-resolvers/index.js'
import { buildGraphQLSchema } from '@/presentation/graphql/GraphQLSchemaBuilder.js'
import {
  AttributeMutations,
  NodeMutations,
  RelationMutations,
  TableMutations,
  TemplateMutations,
} from '@/presentation/graphql/mutations/index.js'
import {
  AttributeQueries,
  NodeQueries,
  RelationQueries,
  SystemQueries,
  TableQueries,
  TemplateQueries,
} from '@/presentation/graphql/queries/index.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../tokens/index.js'

/**
 * GraphQL module - registers GraphQL resolvers and schema
 */
export function registerGraphQLModule(container: DIContainer): void {
  // Query resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_QUERIES,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableQueries(tableRepository, simpleLogger)
    },
    [RepositoryTokens.TABLE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_QUERIES,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository
      // Remove SearchNodesUseCase dependency to break circular reference
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new NodeQueries(nodeRepository, null, simpleLogger)
    },
    [RepositoryTokens.NODE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as IAttributeRepository
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as IAttributeTypeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new AttributeQueries(attributeRepository, attributeTypeRepository, simpleLogger)
    },
    [
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_QUERIES,
    async (c) => {
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as INodeRelationRepository
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as IRelationTypeRepository
      // Remove SearchRelatedNodesUseCase dependency to break circular reference
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new RelationQueries(
        nodeRelationRepository,
        relationTypeRepository,
        null,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_QUERIES,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY) as IQueryTemplateRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TemplateQueries(queryTemplateRepository, simpleLogger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.SYSTEM_QUERIES,
    async (c) => {
      const systemMonitoringUseCase = await c.resolve(UseCaseTokens.SYSTEM_MONITORING_USE_CASE) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new SystemQueries(systemMonitoringUseCase, simpleLogger)
    },
    [UseCaseTokens.SYSTEM_MONITORING_USE_CASE]
  )

  // Mutation resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_MUTATIONS,
    async (c) => {
      const createTableUseCase = await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE) as any
      const deleteTableUseCase = await c.resolve(UseCaseTokens.DELETE_TABLE_USE_CASE) as any
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableMutations(createTableUseCase, deleteTableUseCase, tableRepository, simpleLogger)
    },
    [
      UseCaseTokens.CREATE_TABLE_USE_CASE,
      UseCaseTokens.DELETE_TABLE_USE_CASE,
      RepositoryTokens.TABLE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_MUTATIONS,
    async (c) => {
      // Temporarily remove CreateNodeUseCase to break circular dependency
      // TODO: Restore proper use case integration after circular dependency is resolved
      const createNodeUseCase = null as any // Placeholder
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new NodeMutations(
        createNodeUseCase,
        nodeRepository,
        nodeAttributeRepository,
        simpleLogger
      )
    },
    [RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_MUTATIONS,
    async (c) => {
      const createAttributeTypeUseCase = await c.resolve(
        UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE
      ) as any
      const createAttributeUseCase = await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE) as any
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as IAttributeTypeRepository
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as IAttributeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new AttributeMutations(
        createAttributeTypeUseCase,
        createAttributeUseCase,
        attributeTypeRepository,
        attributeRepository,
        simpleLogger
      )
    },
    [
      UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_MUTATIONS,
    async (c) => {
      const createRelationUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE) as any
      const createRelationTypeUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE) as any
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as INodeRelationRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new RelationMutations(
        createRelationUseCase,
        createRelationTypeUseCase,
        nodeRelationRepository,
        simpleLogger
      )
    },
    [
      UseCaseTokens.CREATE_RELATION_USE_CASE,
      UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_MUTATIONS,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY) as IQueryTemplateRepository
      const executeQueryTemplateUseCase = await c.resolve(
        UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE
      ) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TemplateMutations(queryTemplateRepository, executeQueryTemplateUseCase, simpleLogger)
    },
    [
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE,
    ]
  )

  // Field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_FIELD_RESOLVERS,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as IAttributeRepository
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as IAttributeTypeRepository
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableFieldResolvers(attributeRepository, attributeTypeRepository, nodeRepository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_FIELD_RESOLVERS,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as any
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as INodeRelationRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new NodeFieldResolvers(
        nodeRepository,
        tableRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
    async (c) => {
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY) as IAttributeTypeRepository
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as IAttributeRepository
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new AttributeFieldResolvers(
        attributeTypeRepository,
        attributeRepository,
        tableRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as IRelationTypeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new RelationFieldResolvers(
        tableRepository,
        nodeRepository,
        relationTypeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS,
    async (c) => {
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new QueryTemplateFieldResolvers(simpleLogger)
    },
    []
  )

  // GraphQL Schema
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA,
    async (c) => {
      // Get all the resolver dependencies
      const tableQueries = await c.resolve(GraphQLTokens.TABLE_QUERIES) as any
      const nodeQueries = await c.resolve(GraphQLTokens.NODE_QUERIES) as any
      const attributeQueries = await c.resolve(GraphQLTokens.ATTRIBUTE_QUERIES) as any
      const relationQueries = await c.resolve(GraphQLTokens.RELATION_QUERIES) as any
      const templateQueries = await c.resolve(GraphQLTokens.TEMPLATE_QUERIES) as any
      const systemQueries = await c.resolve(GraphQLTokens.SYSTEM_QUERIES) as any

      const tableMutations = await c.resolve(GraphQLTokens.TABLE_MUTATIONS) as any
      const nodeMutations = await c.resolve(GraphQLTokens.NODE_MUTATIONS) as any
      const attributeMutations = await c.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS) as any
      const relationMutations = await c.resolve(GraphQLTokens.RELATION_MUTATIONS) as any
      const templateMutations = await c.resolve(GraphQLTokens.TEMPLATE_MUTATIONS) as any

      const tableFieldResolvers = await c.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS) as any
      const nodeFieldResolvers = await c.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS) as any
      const attributeFieldResolvers = await c.resolve(GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS) as any
      const relationFieldResolvers = await c.resolve(GraphQLTokens.RELATION_FIELD_RESOLVERS) as any
      const queryTemplateFieldResolvers = await c.resolve(GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS) as any

      return buildGraphQLSchema({
        // Queries
        tableQueries,
        nodeQueries,
        attributeQueries,
        relationQueries,
        templateQueries,
        systemQueries,
        // Mutations
        tableMutations,
        nodeMutations,
        attributeMutations,
        relationMutations,
        templateMutations,
        // Field resolvers
        tableFieldResolvers,
        nodeFieldResolvers,
        attributeFieldResolvers,
        relationFieldResolvers,
        queryTemplateFieldResolvers,
        // Schema resolvers (placeholder)
        schemaResolvers: {} as any,
      })
    },
    [
      // All the resolver dependencies
      GraphQLTokens.TABLE_QUERIES,
      GraphQLTokens.NODE_QUERIES,
      GraphQLTokens.ATTRIBUTE_QUERIES,
      GraphQLTokens.RELATION_QUERIES,
      GraphQLTokens.TEMPLATE_QUERIES,
      GraphQLTokens.SYSTEM_QUERIES,
      GraphQLTokens.TABLE_MUTATIONS,
      GraphQLTokens.NODE_MUTATIONS,
      GraphQLTokens.ATTRIBUTE_MUTATIONS,
      GraphQLTokens.RELATION_MUTATIONS,
      GraphQLTokens.TEMPLATE_MUTATIONS,
      GraphQLTokens.TABLE_FIELD_RESOLVERS,
      GraphQLTokens.NODE_FIELD_RESOLVERS,
      GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
      GraphQLTokens.RELATION_FIELD_RESOLVERS,
      GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS,
    ]
  )
}
