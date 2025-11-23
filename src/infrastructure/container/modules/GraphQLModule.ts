import type { GraphQLSchema } from 'graphql'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  AttributeFieldResolvers,
  DocFieldResolvers,
  NodeFieldResolvers,
  QueryTemplateFieldResolvers,
  RelationFieldResolvers,
  RelationTypeFieldResolvers,
  TableFieldResolvers,
} from '@/presentation/graphql/field-resolvers/index.js'
// NOTE: buildGraphQLSchema is imported dynamically in the GRAPHQL_SCHEMA factory
// to avoid module loading hang with circular dependencies
import {
  AttributeMutations,
  DocMutations,
  NodeMutations,
  RelationMutations,
  TableMutations,
  TemplateMutations,
} from '@/presentation/graphql/mutations/index.js'
import {
  AttributeQueries,
  DocQueries,
  EnhancedAttributeQueries,
  NodeQueries,
  RelationQueries,
  SystemQueries,
  TableQueries,
  TemplateQueries,
} from '@/presentation/graphql/queries/index.js'
import type { DIContainer } from '../DIContainer.js'
import { GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../tokens/index.js'

/**
 * GraphQL module - registers GraphQL resolvers and schema
 */
export function registerGraphQLModule(container: DIContainer): void {
  // Query resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_QUERIES,
    async (c) => {
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableQueries(tableRepository, c, simpleLogger)
    },
    [RepositoryTokens.TABLE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_QUERIES,
    async (c) => {
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      // Use lazy loading to resolve SearchNodesUseCase and break circular dependency
      const searchNodesUseCaseResolver = async (): Promise<SearchNodesUseCase | null> => {
        try {
          return (await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE)) as SearchNodesUseCase
        } catch (error) {
          console.warn('[GraphQLModule] SearchNodesUseCase not available:', error)
          return null
        }
      }
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new NodeQueries(nodeRepository, searchNodesUseCaseResolver, simpleLogger)
    },
    [RepositoryTokens.NODE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY
      )) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
      )) as IAttributeTypeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new AttributeQueries(attributeRepository, attributeTypeRepository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_QUERIES,
    async (c) => {
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY
      )) as IRelationTypeRepository
      // Remove SearchRelatedNodesUseCase dependency to break circular reference
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new RelationQueries(nodeRelationRepository, relationTypeRepository, null, simpleLogger)
    },
    [RepositoryTokens.NODE_RELATION_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_QUERIES,
    async (c) => {
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY
      )) as IQueryTemplateRepository
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
    GraphQLTokens.DOC_QUERIES,
    async (c) => {
      const docRepository = (await c.resolve(RepositoryTokens.DOC_REPOSITORY)) as IDocRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new DocQueries(docRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.SYSTEM_QUERIES,
    async (c) => {
      const systemMonitoringUseCase = (await c.resolve(
        UseCaseTokens.SYSTEM_MONITORING_USE_CASE
      )) as any
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

  container.registerSingleton(
    GraphQLTokens.ENHANCED_ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
      )) as IAttributeTypeRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new EnhancedAttributeQueries(attributeTypeRepository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY]
  )

  // Mutation resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_MUTATIONS,
    async (c) => {
      const createTableUseCase = (await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE)) as any
      const deleteTableUseCase = (await c.resolve(UseCaseTokens.DELETE_TABLE_USE_CASE)) as any
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableMutations(
        createTableUseCase,
        deleteTableUseCase,
        tableRepository,
        simpleLogger
      )
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
      // Use case integration temporarily disabled to resolve circular dependency in DI container
      const createNodeUseCase = null as any // Placeholder
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = (await c.resolve(
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY
      )) as any
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as any
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as any
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
    GraphQLTokens.ATTRIBUTE_MUTATIONS,
    async (c) => {
      const createAttributeTypeUseCase = (await c.resolve(
        UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE
      )) as any
      const createAttributeUseCase = (await c.resolve(
        UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE
      )) as any
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
      )) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY
      )) as IAttributeRepository
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
      const createRelationUseCase = (await c.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE)) as any
      const createRelationTypeUseCase = (await c.resolve(
        UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE
      )) as any
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY
      )) as IRelationTypeRepository
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
        relationTypeRepository,
        simpleLogger
      )
    },
    [
      UseCaseTokens.CREATE_RELATION_USE_CASE,
      UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_MUTATIONS,
    async (c) => {
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY
      )) as IQueryTemplateRepository
      const executeQueryTemplateUseCase = (await c.resolve(
        UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE
      )) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TemplateMutations(
        queryTemplateRepository,
        executeQueryTemplateUseCase,
        simpleLogger
      )
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY, UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE]
  )

  container.registerSingleton(
    GraphQLTokens.DOC_MUTATIONS,
    async (c) => {
      const createDocUseCase = (await c.resolve(UseCaseTokens.CREATE_DOC_USE_CASE)) as any
      const updateDocUseCase = (await c.resolve(UseCaseTokens.UPDATE_DOC_USE_CASE)) as any
      const deleteDocUseCase = (await c.resolve(UseCaseTokens.DELETE_DOC_USE_CASE)) as any
      const activateDocUseCase = (await c.resolve(UseCaseTokens.ACTIVATE_DOC_USE_CASE)) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new DocMutations(
        createDocUseCase,
        updateDocUseCase,
        deleteDocUseCase,
        activateDocUseCase,
        simpleLogger
      )
    },
    [
      UseCaseTokens.CREATE_DOC_USE_CASE,
      UseCaseTokens.UPDATE_DOC_USE_CASE,
      UseCaseTokens.DELETE_DOC_USE_CASE,
      UseCaseTokens.ACTIVATE_DOC_USE_CASE,
    ]
  )

  // System Resolver - Add SystemResolver for initialization mutations
  container.registerSingleton(
    GraphQLTokens.SYSTEM_RESOLVER,
    async (c) => {
      const { SystemResolver } = await import('@/presentation/graphql/resolvers/SystemResolver.js')
      return new SystemResolver(c)
    },
    []
  )

  // Node Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.NODE_RESOLVER,
    async (c) => {
      const { NodeResolver } = await import('@/presentation/graphql/resolvers/NodeResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createNodeUseCase = await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE).catch(() => null) as any
      const searchNodesUseCase = await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE).catch(() => null) as any

      // Resolve repositories
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as any
      const nodeRelationRepository = (await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)) as INodeRelationRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[NodeResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[NodeResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[NodeResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[NodeResolver] ${msg}`, data || ''),
      }

      return new NodeResolver(
        createNodeUseCase,
        searchNodesUseCase,
        nodeRepository,
        tableRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        attributeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ]
  )

  // Table Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_RESOLVER,
    async (c) => {
      const { TableResolver } = await import('@/presentation/graphql/resolvers/TableResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createTableUseCase = await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE).catch(() => null) as any

      // Resolve repositories
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)) as IAttributeTypeRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[TableResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[TableResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[TableResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[TableResolver] ${msg}`, data || ''),
      }

      return new TableResolver(
        createTableUseCase,
        tableRepository,
        nodeRepository,
        attributeRepository,
        attributeTypeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    ]
  )

  // Doc Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.DOC_RESOLVER,
    async (c) => {
      const { DocResolver } = await import('@/presentation/graphql/resolvers/DocResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createDocUseCase = await c.resolve(UseCaseTokens.CREATE_DOC_USE_CASE).catch(() => null) as any
      const updateDocUseCase = await c.resolve(UseCaseTokens.UPDATE_DOC_USE_CASE).catch(() => null) as any
      const deleteDocUseCase = await c.resolve(UseCaseTokens.DELETE_DOC_USE_CASE).catch(() => null) as any
      const activateDocUseCase = await c.resolve(UseCaseTokens.ACTIVATE_DOC_USE_CASE).catch(() => null) as any

      // Resolve repositories
      const docRepository = (await c.resolve(RepositoryTokens.DOC_REPOSITORY)) as IDocRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[DocResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[DocResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[DocResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DocResolver] ${msg}`, data || ''),
      }

      return new DocResolver(
        createDocUseCase,
        updateDocUseCase,
        deleteDocUseCase,
        activateDocUseCase,
        docRepository,
        simpleLogger
      )
    },
    [RepositoryTokens.DOC_REPOSITORY]
  )

  // Attribute Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_RESOLVER,
    async (c) => {
      const { AttributeResolver } = await import('@/presentation/graphql/resolvers/AttributeResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createAttributeTypeUseCase = await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE).catch(() => null) as any
      const createAttributeUseCase = await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE).catch(() => null) as any

      // Resolve repositories
      const attributeTypeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[AttributeResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[AttributeResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[AttributeResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[AttributeResolver] ${msg}`, data || ''),
      }

      return new AttributeResolver(
        createAttributeTypeUseCase,
        createAttributeUseCase,
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

  // Relation Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.RELATION_RESOLVER,
    async (c) => {
      const { RelationResolver } = await import('@/presentation/graphql/resolvers/RelationResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createRelationUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE).catch(() => null) as any
      const createRelationTypeUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE).catch(() => null) as any
      const searchRelatedNodesUseCase = await c.resolve(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE).catch(() => null) as any

      // Resolve repositories
      const nodeRelationRepository = (await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)) as IRelationTypeRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as any
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[RelationResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[RelationResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[RelationResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[RelationResolver] ${msg}`, data || ''),
      }

      return new RelationResolver(
        createRelationUseCase,
        createRelationTypeUseCase,
        searchRelatedNodesUseCase,
        nodeRelationRepository,
        relationTypeRepository,
        nodeRepository,
        nodeAttributeRepository,
        tableRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ]
  )

  // Query Template Resolver - Unified resolver (special: depends on GraphQLSchema)
  container.registerSingleton(
    GraphQLTokens.QUERY_TEMPLATE_RESOLVER,
    async (c) => {
      const { QueryTemplateResolver } = await import('@/presentation/graphql/resolvers/QueryTemplateResolver.js')

      // Resolve repositories
      const queryTemplateRepository = (await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY)) as IQueryTemplateRepository

      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[QueryTemplateResolver] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[QueryTemplateResolver] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[QueryTemplateResolver] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[QueryTemplateResolver] ${msg}`, data || ''),
      }

      // Schema will be set later via setSchema() method to avoid circular dependency
      const emptySchema = null as any

      return new QueryTemplateResolver(
        queryTemplateRepository,
        simpleLogger,
        emptySchema
      )
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY]
  )

  container.registerSingleton(
    GraphQLTokens.EXPORT_MUTATIONS,
    async (c) => {
      const tableNodesExportUseCase = (await c.resolve(UseCaseTokens.TABLE_NODES_EXPORT_USE_CASE)) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      const { ExportMutations } = await import('@/presentation/graphql/mutations/ExportMutations.js')
      const exportMutations = new ExportMutations(tableNodesExportUseCase, simpleLogger)

      const { createExportResolvers } = await import('@/presentation/graphql/resolvers/ExportResolvers.js')
      return createExportResolvers(exportMutations)
    },
    [UseCaseTokens.TABLE_NODES_EXPORT_USE_CASE]
  )

  // Table Package Resolver
  container.registerSingleton(GraphQLTokens.TABLE_PACKAGE_RESOLVER, async (c) => {
    // Import the resolver class at runtime to avoid circular dependencies
    const { TablePackageResolver } = await import(
      '@/presentation/graphql/resolvers/TablePackageResolver.js'
    )
    const { TablePackageTokens } = await import('../tokens/TablePackageTokens.js')

    const tablePackageService = await c.resolve(TablePackageTokens.TABLE_PACKAGE_SERVICE)

    // Import TablePackageService type for casting
    const { TablePackageService } = await import('@/domain/services/TablePackageService.js')
    const typedTablePackageService = tablePackageService as InstanceType<typeof TablePackageService>

    // Use simple console logger to avoid circular dependency
    const simpleLogger = {
      info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
      warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
      error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
      debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
    }

    return new TablePackageResolver(typedTablePackageService, simpleLogger)
  })

  // Field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_FIELD_RESOLVERS,
    async (c) => {
      const attributeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY
      )) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
      )) as IAttributeTypeRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const getTableDocsUseCase = (await c.resolve(UseCaseTokens.GET_TABLE_DOCS_USE_CASE)) as any
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new TableFieldResolvers(
        attributeRepository,
        attributeTypeRepository,
        nodeRepository,
        getTableDocsUseCase,
        simpleLogger
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      UseCaseTokens.GET_TABLE_DOCS_USE_CASE,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_FIELD_RESOLVERS,
    async (c) => {
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
      const nodeAttributeRepository = (await c.resolve(
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY
      )) as any
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY
      )) as any
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
        relationTypeRepository,
        simpleLogger
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
    async (c) => {
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
      )) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY
      )) as IAttributeRepository
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
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
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY
      )) as IRelationTypeRepository
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
    GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS,
    async (_c) => {
      // Use simple console logger to avoid circular dependency
      const simpleLogger = {
        info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
      }
      return new RelationTypeFieldResolvers(simpleLogger)
    },
    []
  )

  container.registerSingleton(
    GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS,
    async (_c) => {
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

  container.registerSingleton(
    GraphQLTokens.DOC_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = (await c.resolve(
        RepositoryTokens.TABLE_REPOSITORY
      )) as ITableRepository
      return new DocFieldResolvers(tableRepository)
    },
    [RepositoryTokens.TABLE_REPOSITORY]
  )

  // GraphQL Schema Builder
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA_BUILDER,
    async (c) => {
      const { GraphQLSchemaBuilder } = await import(
        '@/presentation/graphql/GraphQLSchemaBuilder.js'
      )
      return new GraphQLSchemaBuilder(c)
    },
    []
  )

  // GraphQL Executor
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_EXECUTOR,
    async (c) => {
      const { execute } = await import('graphql')
      const schema = (await c.resolve(GraphQLTokens.GRAPHQL_SCHEMA)) as GraphQLSchema

      return {
        executeSchema: async (query: string, variables?: any, context?: any) => {
          return execute({
            schema,
            document:
              typeof query === 'string' ? await (await import('graphql')).parse(query) : query,
            variableValues: variables,
            contextValue: context,
          })
        },
        getSchema: () => schema,
      }
    },
    [GraphQLTokens.GRAPHQL_SCHEMA]
  )

  // GraphQL Schema
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA,
    async (c) => {
      // Get all the resolver dependencies
      const tableQueries = (await c.resolve(GraphQLTokens.TABLE_QUERIES)) as any
      const nodeQueries = (await c.resolve(GraphQLTokens.NODE_QUERIES)) as any
      const attributeQueries = (await c.resolve(GraphQLTokens.ATTRIBUTE_QUERIES)) as any
      const relationQueries = (await c.resolve(GraphQLTokens.RELATION_QUERIES)) as any
      const templateQueries = (await c.resolve(GraphQLTokens.TEMPLATE_QUERIES)) as any
      const docQueries = (await c.resolve(GraphQLTokens.DOC_QUERIES)) as any
      const systemQueries = (await c.resolve(GraphQLTokens.SYSTEM_QUERIES)) as any
      // const enhancedAttributeQueries = (await c.resolve(GraphQLTokens.ENHANCED_ATTRIBUTE_QUERIES)) as any

      const tableMutations = (await c.resolve(GraphQLTokens.TABLE_MUTATIONS)) as any
      const nodeMutations = (await c.resolve(GraphQLTokens.NODE_MUTATIONS)) as any
      const attributeMutations = (await c.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS)) as any
      const relationMutations = (await c.resolve(GraphQLTokens.RELATION_MUTATIONS)) as any
      const templateMutations = (await c.resolve(GraphQLTokens.TEMPLATE_MUTATIONS)) as any
      const docMutations = (await c.resolve(GraphQLTokens.DOC_MUTATIONS)) as any
      const exportMutations = (await c.resolve(GraphQLTokens.EXPORT_MUTATIONS)) as any
      const tablePackageResolver = (await c.resolve(GraphQLTokens.TABLE_PACKAGE_RESOLVER)) as any
      const systemResolver = (await c.resolve(GraphQLTokens.SYSTEM_RESOLVER)) as any

      const tableFieldResolvers = (await c.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS)) as any
      const nodeFieldResolvers = (await c.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS)) as any
      const attributeFieldResolvers = (await c.resolve(
        GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS
      )) as any
      const relationFieldResolvers = (await c.resolve(
        GraphQLTokens.RELATION_FIELD_RESOLVERS
      )) as any
      const relationTypeFieldResolvers = (await c.resolve(
        GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS
      )) as any
      const queryTemplateFieldResolvers = (await c.resolve(
        GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS
      )) as any
      const docFieldResolvers = (await c.resolve(GraphQLTokens.DOC_FIELD_RESOLVERS)) as any

      // Dynamic import to avoid module loading hang
      const { buildGraphQLSchema } = await import('@/presentation/graphql/GraphQLSchemaBuilder.js')

      return buildGraphQLSchema({
        // Queries
        tableQueries,
        nodeQueries,
        attributeQueries,
        relationQueries,
        templateQueries,
        docQueries,
        systemQueries,
        // enhancedAttributeQueries,
        // Mutations
        tableMutations,
        nodeMutations,
        attributeMutations,
        relationMutations,
        templateMutations,
        docMutations,
        exportMutations,
        tablePackageResolver,
        systemResolver,
        // Field resolvers
        tableFieldResolvers,
        nodeFieldResolvers,
        attributeFieldResolvers,
        relationFieldResolvers,
        relationTypeFieldResolvers,
        queryTemplateFieldResolvers,
        docFieldResolvers,
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
      GraphQLTokens.DOC_QUERIES,
      GraphQLTokens.SYSTEM_QUERIES,
      // GraphQLTokens.ENHANCED_ATTRIBUTE_QUERIES,
      GraphQLTokens.TABLE_MUTATIONS,
      GraphQLTokens.NODE_MUTATIONS,
      GraphQLTokens.ATTRIBUTE_MUTATIONS,
      GraphQLTokens.RELATION_MUTATIONS,
      GraphQLTokens.TEMPLATE_MUTATIONS,
      GraphQLTokens.DOC_MUTATIONS,
      GraphQLTokens.EXPORT_MUTATIONS,
      GraphQLTokens.TABLE_PACKAGE_RESOLVER,
      GraphQLTokens.SYSTEM_RESOLVER,
      GraphQLTokens.TABLE_FIELD_RESOLVERS,
      GraphQLTokens.NODE_FIELD_RESOLVERS,
      GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
      GraphQLTokens.RELATION_FIELD_RESOLVERS,
      GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS,
      GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS,
      GraphQLTokens.DOC_FIELD_RESOLVERS,
      GraphQLTokens.GRAPHQL_SCHEMA_BUILDER,
    ]
  )
}
