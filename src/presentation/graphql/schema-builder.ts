import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { GraphQLSchema } from 'graphql'
import { join } from 'path'

// Import resolvers
import { TableResolver } from './resolvers/TableResolver.js'
import { AttributeResolver } from './resolvers/AttributeResolver.js'
import { NodeResolver } from './resolvers/NodeResolver.js'
import { RelationResolver } from './resolvers/RelationResolver.js'
import { AnalyticsResolver } from './resolvers/AnalyticsResolver.js'
import { AdvancedSearchResolver } from './resolvers/AdvancedSearchResolver.js'
import { createSchemaResolvers } from './resolvers/schema.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { NodeAnalyticsUseCase } from '@/application/use-cases/analytics/NodeAnalyticsUseCase.js'
import type { AdvancedSearchUseCase } from '@/application/use-cases/search/AdvancedSearchUseCase.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import type { ILogger } from '@/application/ports/ILogger.js'

interface ResolverDependencies {
  tableRepository: ITableRepository
  attributeTypeRepository: IAttributeTypeRepository
  attributeRepository: IAttributeRepository
  nodeRepository: INodeRepository
  nodeAttributeRepository: INodeAttributeRepository
  nodeRelationRepository: INodeRelationRepository
  relationTypeRepository: IRelationTypeRepository
  createTableUseCase: CreateTableUseCase
  createAttributeTypeUseCase: CreateAttributeTypeUseCase
  createAttributeUseCase: CreateAttributeUseCase
  createNodeUseCase: CreateNodeUseCase
  searchNodesUseCase: SearchNodesUseCase
  createRelationUseCase: CreateRelationUseCase
  createRelationTypeUseCase: CreateRelationTypeUseCase
  searchRelatedNodesUseCase: SearchRelatedNodesUseCase
  nodeAnalyticsUseCase: NodeAnalyticsUseCase
  advancedSearchUseCase: AdvancedSearchUseCase
  schemaExportUseCase: SchemaExportUseCase
  schemaImportUseCase: SchemaImportUseCase
  logger: ILogger
}

export function buildGraphQLSchema(deps: ResolverDependencies): GraphQLSchema {
  // Load GraphQL schema files
  const typesArray = loadFilesSync(join(process.cwd(), 'src/presentation/graphql/schemas'), {
    extensions: ['graphql']
  })
  
  const typeDefs = mergeTypeDefs(typesArray)

  // Create resolver instances
  const tableResolver = new TableResolver(
    deps.createTableUseCase,
    deps.tableRepository,
    deps.logger
  )

  const attributeResolver = new AttributeResolver(
    deps.createAttributeTypeUseCase,
    deps.createAttributeUseCase,
    deps.attributeTypeRepository,
    deps.attributeRepository,
    deps.tableRepository,
    deps.logger
  )

  const nodeResolver = new NodeResolver(
    deps.createNodeUseCase,
    deps.searchNodesUseCase,
    deps.nodeRepository,
    deps.nodeAttributeRepository,
    deps.attributeRepository,
    deps.tableRepository,
    deps.logger
  )

  const relationResolver = new RelationResolver(
    deps.createRelationUseCase,
    deps.createRelationTypeUseCase,
    deps.searchRelatedNodesUseCase,
    deps.nodeRelationRepository,
    deps.relationTypeRepository,
    deps.nodeRepository,
    deps.tableRepository,
    deps.logger
  )

  const analyticsResolver = new AnalyticsResolver(
    deps.nodeAnalyticsUseCase,
    deps.nodeRepository,
    deps.nodeRelationRepository,
    deps.tableRepository,
    deps.logger
  )

  const advancedSearchResolver = new AdvancedSearchResolver(
    deps.advancedSearchUseCase,
    deps.nodeRepository,
    deps.tableRepository,
    deps.logger
  )

  const schemaResolvers = createSchemaResolvers({
    tableRepository: deps.tableRepository,
    schemaExportUseCase: deps.schemaExportUseCase,
    schemaImportUseCase: deps.schemaImportUseCase,
    logger: deps.logger
  })

  const resolvers = {
    // Custom scalars
    DateTime: DateTimeResolver,
    JSON: JSONResolver,

    // Root resolvers
    Query: {
      // Health check
      health: () => ({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: true, // TODO: implement actual health check
        version: '1.0.0'
      }),

      // Table queries
      table: (_: unknown, args: any) => tableResolver.table(args),
      tableByIdentifier: (_: unknown, args: any) => tableResolver.tableByIdentifier(args),
      tables: (_: unknown, args: any) => tableResolver.tables(args),

      // Attribute type queries
      attributeType: (_: unknown, args: any) => attributeResolver.attributeType(args),
      attributeTypeByIdentifier: (_: unknown, args: any) => attributeResolver.attributeTypeByIdentifier(args),
      attributeTypes: (_: unknown, args: any) => attributeResolver.attributeTypes(),

      // Attribute queries
      attribute: (_: unknown, args: any) => attributeResolver.attribute(args),
      attributes: (_: unknown, args: any) => attributeResolver.attributes(args),

      // Node queries
      node: (_: unknown, args: any) => nodeResolver.node(args),
      nodeByContent: (_: unknown, args: any) => nodeResolver.nodeByContent(args),
      nodes: (_: unknown, args: any) => nodeResolver.nodes(args),
      searchNodes: (_: unknown, args: any) => nodeResolver.searchNodes(args),

      // Relation queries
      nodeRelation: (_: unknown, args: any) => relationResolver.nodeRelation(args),
      nodeRelations: (_: unknown, args: any) => relationResolver.nodeRelations(args),
      relationTypes: (_: unknown, args: any) => relationResolver.relationTypes(),
      relationType: (_: unknown, args: any) => relationResolver.relationType(args),

      // Graph relationship queries
      searchRelatedNodes: (_: unknown, args: any) => relationResolver.searchRelatedNodes(args),
      findPathsBetweenNodes: (_: unknown, args: any) => relationResolver.findPathsBetweenNodes(args),
      getDependencyChain: (_: unknown, args: any) => relationResolver.getDependencyChain(args),

      // Analytics queries
      analyzeNodes: (_: unknown, args: any) => analyticsResolver.analyzeNodes(args),
      getPerformanceMetrics: (_: unknown, args: any) => analyticsResolver.getPerformanceMetrics(args),
      getTestSuiteStatus: (_: unknown, args: any) => analyticsResolver.getTestSuiteStatus(args),
      aggregateData: (_: unknown, args: any) => analyticsResolver.aggregateData(args),
      getSystemHealth: (_: unknown, args: any) => analyticsResolver.getSystemHealth(args),

      // Advanced search queries
      advancedSearch: (_: unknown, args: any) => advancedSearchResolver.advancedSearch(args),
      getSearchPerformanceMetrics: (_: unknown, args: any) => advancedSearchResolver.getPerformanceMetrics(args),
      getMonitoringMetrics: (_: unknown, args: any) => advancedSearchResolver.getMonitoringMetrics(args),
      getSystemStatus: (_: unknown, args: any) => advancedSearchResolver.getSystemStatus(args),
      getAlertRules: (_: unknown, args: any) => advancedSearchResolver.getAlertRules(args),

      // Schema export queries
      exportTable: schemaResolvers.Query.exportTable,
      exportAllTables: schemaResolvers.Query.exportAllTables
    },

    Mutation: {
      _empty: () => null,

      // Table mutations
      createTable: (_: unknown, args: any) => tableResolver.createTable(args),
      updateTable: (_: unknown, args: any) => tableResolver.updateTable(args),
      deleteTable: (_: unknown, args: any) => tableResolver.deleteTable(args),

      // Attribute type mutations
      createAttributeType: (_: unknown, args: any) => attributeResolver.createAttributeType(args),
      updateAttributeType: (_: unknown, args: any) => attributeResolver.updateAttributeType(args),
      deleteAttributeType: (_: unknown, args: any) => attributeResolver.deleteAttributeType(args),

      // Attribute mutations
      createAttribute: (_: unknown, args: any) => attributeResolver.createAttribute(args),
      updateAttribute: (_: unknown, args: any) => attributeResolver.updateAttribute(args),
      deleteAttribute: (_: unknown, args: any) => attributeResolver.deleteAttribute(args),

      // Node mutations
      createNode: (_: unknown, args: any) => nodeResolver.createNode(args),
      updateNode: (_: unknown, args: any) => nodeResolver.updateNode(args),
      deleteNode: (_: unknown, args: any) => nodeResolver.deleteNode(args),
      setNodeAttribute: (_: unknown, args: any) => nodeResolver.setNodeAttribute(args),

      // Relation mutations
      createRelation: (_: unknown, args: any) => relationResolver.createRelation(args),
      deleteRelation: (_: unknown, args: any) => relationResolver.deleteRelation(args),
      createRelationType: (_: unknown, args: any) => relationResolver.createRelationType(args),

      // Advanced search mutations
      createAlertRule: (_: unknown, args: any) => advancedSearchResolver.createAlertRule(args),
      updateAlertRule: (_: unknown, args: any) => advancedSearchResolver.updateAlertRule(args),
      deleteAlertRule: (_: unknown, args: any) => advancedSearchResolver.deleteAlertRule(args),
      clearCache: (_: unknown, args: any) => advancedSearchResolver.clearCache(args),
      optimizeDatabase: (_: unknown, args: any) => advancedSearchResolver.optimizeDatabase(args),

      // Schema import mutations
      importSchema: schemaResolvers.Mutation.importSchema
    },

    Subscription: {
      // TODO: Implement subscriptions
      tableCreated: {
        subscribe: () => {
          // Placeholder
        }
      }
    },

    // Field resolvers
    Table: {
      nodeCount: (parent: any) => tableResolver.nodeCount(parent),
      attributeCount: (parent: any) => tableResolver.attributeCount(parent)
      // TODO: Add relationship resolvers (attributes, nodes)
    },

    Attribute: {
      attributeType: (parent: any) => attributeResolver.attributeType_field(parent),
      table: (parent: any) => attributeResolver.table_field(parent)
    },

    Node: {
      table: (parent: any) => nodeResolver.table_field(parent),
      attributeCount: (parent: any) => nodeResolver.attributeCount_field(parent),
      outgoingRelations: (parent: any) => relationResolver.outgoingRelations_field(parent),
      incomingRelations: (parent: any) => relationResolver.incomingRelations_field(parent),
      relationCount: (parent: any) => relationResolver.relationCount_field(parent)
    },

    NodeRelation: {
      table: (parent: any) => relationResolver.table_field(parent),
      sourceNode: (parent: any) => relationResolver.sourceNode_field(parent),
      targetNode: (parent: any) => relationResolver.targetNode_field(parent),
      relationType: (parent: any) => relationResolver.relationType_field(parent)
    }
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers
  })
}