import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { GraphQLSchema } from 'graphql'
import { join } from 'path'

// Import type definitions
import type {
  GraphQLParent,
  GraphQLContext,
  // Query argument types
  TableArgs,
  TableByIdentifierArgs,
  TablesArgs,
  AttributeArgs,
  AttributeByIdentifierArgs,
  AttributesArgs,
  NodeArgs,
  NodeByContentArgs,
  NodesArgs,
  SearchNodesArgs,
  NodeRelationArgs,
  NodeRelationsArgs,
  SearchRelatedNodesArgs,
  FindPathsBetweenNodesArgs,
  GetDependencyChainArgs,
  RelationTypeArgs,
  AnalyzeNodesArgs,
  GetPerformanceMetricsArgs,
  GetTestSuiteStatusArgs,
  AggregateDataArgs,
  GetSystemHealthArgs,
  AdvancedSearchArgs,
  ExportTableArgs,
  ExportAllTablesArgs,
  // Mutation argument types
  CreateTableArgs,
  UpdateTableArgs,
  DeleteTableArgs,
  CreateAttributeTypeArgs,
  UpdateAttributeTypeArgs,
  DeleteAttributeTypeArgs,
  CreateAttributeArgs,
  UpdateAttributeArgs,
  DeleteAttributeArgs,
  CreateNodeArgs,
  UpdateNodeArgs,
  DeleteNodeArgs,
  SetNodeAttributeArgs,
  CreateRelationArgs,
  DeleteRelationArgs,
  CreateRelationTypeArgs,
  CreateAlertRuleArgs,
  UpdateAlertRuleArgs,
  DeleteAlertRuleArgs,
  ClearCacheArgs,
  OptimizeDatabaseArgs,
  ImportSchemaArgs,
  // Parent types
  TableParent,
  AttributeParent,
  NodeParent,
  NodeRelationParent
} from './types/GraphQLTypes.js'

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
      table: (_: GraphQLParent, args: TableArgs) => tableResolver.table(args),
      tableByIdentifier: (_: GraphQLParent, args: TableByIdentifierArgs) => tableResolver.tableByIdentifier(args),
      tables: (_: GraphQLParent, args: TablesArgs) => tableResolver.tables(args),

      // Attribute type queries
      attributeType: (_: GraphQLParent, args: AttributeArgs) => attributeResolver.attributeType(args),
      attributeTypeByIdentifier: (_: GraphQLParent, args: AttributeByIdentifierArgs) => attributeResolver.attributeTypeByIdentifier(args),
      attributeTypes: (_: GraphQLParent) => attributeResolver.attributeTypes(),

      // Attribute queries
      attribute: (_: GraphQLParent, args: AttributeArgs) => attributeResolver.attribute(args),
      attributes: (_: GraphQLParent, args: AttributesArgs) => attributeResolver.attributes(args),

      // Node queries
      node: (_: GraphQLParent, args: NodeArgs) => nodeResolver.node(args),
      nodeByContent: (_: GraphQLParent, args: NodeByContentArgs) => nodeResolver.nodeByContent(args),
      nodes: (_: GraphQLParent, args: NodesArgs) => nodeResolver.nodes(args),
      searchNodes: (_: GraphQLParent, args: SearchNodesArgs) => nodeResolver.searchNodes(args),

      // Relation queries
      nodeRelation: (_: GraphQLParent, args: NodeRelationArgs) => relationResolver.nodeRelation(args),
      nodeRelations: (_: GraphQLParent, args: NodeRelationsArgs) => relationResolver.nodeRelations(args),
      relationTypes: (_: GraphQLParent) => relationResolver.relationTypes(),
      relationType: (_: GraphQLParent, args: RelationTypeArgs) => relationResolver.relationType(args),

      // Graph relationship queries
      searchRelatedNodes: (_: GraphQLParent, args: SearchRelatedNodesArgs) => relationResolver.searchRelatedNodes(args),
      findPathsBetweenNodes: (_: GraphQLParent, args: FindPathsBetweenNodesArgs) => relationResolver.findPathsBetweenNodes(args),
      getDependencyChain: (_: GraphQLParent, args: GetDependencyChainArgs) => relationResolver.getDependencyChain(args),

      // Analytics queries
      analyzeNodes: (_: GraphQLParent, args: AnalyzeNodesArgs) => analyticsResolver.analyzeNodes(args),
      getPerformanceMetrics: (_: GraphQLParent, args: GetPerformanceMetricsArgs) => analyticsResolver.getPerformanceMetrics(args),
      getTestSuiteStatus: (_: GraphQLParent, args: GetTestSuiteStatusArgs) => analyticsResolver.getTestSuiteStatus(args),
      aggregateData: (_: GraphQLParent, args: AggregateDataArgs) => analyticsResolver.aggregateData(args),
      getSystemHealth: (_: GraphQLParent, args: GetSystemHealthArgs) => analyticsResolver.getSystemHealth(args),

      // Advanced search queries
      advancedSearch: (_: GraphQLParent, args: AdvancedSearchArgs) => advancedSearchResolver.advancedSearch(args),
      getSearchPerformanceMetrics: (_: GraphQLParent, args: GetPerformanceMetricsArgs) => advancedSearchResolver.getPerformanceMetrics(args),
      getMonitoringMetrics: (_: GraphQLParent, args: GetPerformanceMetricsArgs) => advancedSearchResolver.getMonitoringMetrics(args),
      getSystemStatus: (_: GraphQLParent, args: GetSystemHealthArgs) => advancedSearchResolver.getSystemStatus(args),
      getAlertRules: (_: GraphQLParent) => advancedSearchResolver.getAlertRules({}),

      // Schema export queries
      exportTable: schemaResolvers.Query.exportTable,
      exportAllTables: schemaResolvers.Query.exportAllTables
    },

    Mutation: {
      _empty: () => null,

      // Table mutations
      createTable: (_: GraphQLParent, args: CreateTableArgs) => tableResolver.createTable(args),
      updateTable: (_: GraphQLParent, args: UpdateTableArgs) => tableResolver.updateTable(args),
      deleteTable: (_: GraphQLParent, args: DeleteTableArgs) => tableResolver.deleteTable(args),

      // Attribute type mutations
      createAttributeType: (_: GraphQLParent, args: CreateAttributeTypeArgs) => attributeResolver.createAttributeType(args),
      updateAttributeType: (_: GraphQLParent, args: UpdateAttributeTypeArgs) => attributeResolver.updateAttributeType(args),
      deleteAttributeType: (_: GraphQLParent, args: DeleteAttributeTypeArgs) => attributeResolver.deleteAttributeType(args),

      // Attribute mutations
      createAttribute: (_: GraphQLParent, args: CreateAttributeArgs) => attributeResolver.createAttribute(args),
      updateAttribute: (_: GraphQLParent, args: UpdateAttributeArgs) => attributeResolver.updateAttribute(args),
      deleteAttribute: (_: GraphQLParent, args: DeleteAttributeArgs) => attributeResolver.deleteAttribute(args),

      // Node mutations
      createNode: (_: GraphQLParent, args: CreateNodeArgs) => nodeResolver.createNode(args),
      updateNode: (_: GraphQLParent, args: UpdateNodeArgs) => nodeResolver.updateNode(args),
      deleteNode: (_: GraphQLParent, args: DeleteNodeArgs) => nodeResolver.deleteNode(args),
      setNodeAttribute: (_: GraphQLParent, args: SetNodeAttributeArgs) => nodeResolver.setNodeAttribute(args),

      // Relation mutations
      createRelation: (_: GraphQLParent, args: CreateRelationArgs) => relationResolver.createRelation(args),
      deleteRelation: (_: GraphQLParent, args: DeleteRelationArgs) => relationResolver.deleteRelation(args),
      createRelationType: (_: GraphQLParent, args: CreateRelationTypeArgs) => relationResolver.createRelationType(args),

      // Advanced search mutations
      createAlertRule: (_: GraphQLParent, args: CreateAlertRuleArgs) => advancedSearchResolver.createAlertRule(args),
      updateAlertRule: (_: GraphQLParent, args: UpdateAlertRuleArgs) => advancedSearchResolver.updateAlertRule(args),
      deleteAlertRule: (_: GraphQLParent, args: DeleteAlertRuleArgs) => advancedSearchResolver.deleteAlertRule(args),
      clearCache: (_: GraphQLParent, args: ClearCacheArgs) => advancedSearchResolver.clearCache(args),
      optimizeDatabase: (_: GraphQLParent, args: OptimizeDatabaseArgs) => advancedSearchResolver.optimizeDatabase(args),

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
      nodeCount: (parent: TableParent) => tableResolver.nodeCount(parent),
      attributeCount: (parent: TableParent) => tableResolver.attributeCount(parent)
      // TODO: Add relationship resolvers (attributes, nodes)
    },

    Attribute: {
      attributeType: (parent: AttributeParent) => attributeResolver.attributeType_field(parent),
      table: (parent: AttributeParent) => attributeResolver.table_field(parent)
    },

    Node: {
      table: (parent: NodeParent) => nodeResolver.table_field(parent),
      attributeCount: (parent: NodeParent) => nodeResolver.attributeCount_field(parent),
      outgoingRelations: (parent: NodeParent) => relationResolver.outgoingRelations_field(parent),
      incomingRelations: (parent: NodeParent) => relationResolver.incomingRelations_field(parent),
      relationCount: (parent: NodeParent) => relationResolver.relationCount_field(parent)
    },

    NodeRelation: {
      table: (parent: NodeRelationParent) => relationResolver.table_field(parent),
      sourceNode: (parent: NodeRelationParent) => relationResolver.sourceNode_field(parent),
      targetNode: (parent: NodeRelationParent) => relationResolver.targetNode_field(parent),
      relationType: (parent: NodeRelationParent) => relationResolver.relationType_field(parent)
    }
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers
  })
}