import { join } from 'node:path'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLResolveInfo, GraphQLSchema } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { JsonExportService } from '@/domain/services/JsonExportService.js'
import type { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'
import type { DIContainer } from '../../infrastructure/container/DIContainer.js'
import { GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../../infrastructure/container/tokens/index.js'
import type {
  AttributeFieldResolvers,
  DocFieldResolvers,
  NodeFieldResolvers,
  QueryTemplateFieldResolvers,
  RelationFieldResolvers,
  RelationTypeFieldResolvers,
  TableFieldResolvers,
} from './field-resolvers/index.js'
import type {
  AttributeMutations,
  DocMutations,
  NodeMutations,
  RelationMutations,
  TableMutations,
  TemplateMutations,
} from './mutations/index.js'
import type { BackupMutations } from './mutations/BackupMutations.js'
// Import resolver classes
import type {
  AttributeQueries,
  DocQueries,
  JsonExportQueries,
  NodeQueries,
  RelationQueries,
  SystemQueries,
  TableQueries,
  TemplateQueries,
} from './queries/index.js'
import type { BackupQueries } from './queries/BackupQueries.js'
import type { JsonlBackupQueries } from './queries/JsonlBackupQueries.js'
import { createSchemaResolvers } from './resolvers/schema.js'
import type { TablePackageResolver } from './resolvers/TablePackageResolver.js'
import { templateSubscriptionResolvers } from './resolvers/TemplateSubscriptionResolver.js'
import {
  callFieldResolver,
  callFieldResolverWithFallback,
  callResolver,
  callStringMethod,
  castParent,
  castRootArgs as castArgs,
  getArrayValue,
  getNestedRecordValue,
  getNumberValue,
  getRecordValue,
  getStringValue,
} from './resolvers/resolver-helpers.js'
import { createRootResolvers } from './resolvers/root-resolvers.js'

type JsonExportQueriesBundle = {
  JsonExportQueries: typeof JsonExportQueries
  jsonExportService: JsonExportService
  logger: ILogger
}

type BackupQueriesBundle = {
  BackupQueries: typeof BackupQueries
  backupService: SQLiteBackupService
  logger: ILogger
}

type BackupMutationsBundle = {
  BackupMutations: typeof BackupMutations
  backupService: SQLiteBackupService
  logger: ILogger
}

type GraphQLResolverObject = Record<string, (...args: unknown[]) => unknown>
type DynamicResolverMap = Partial<Record<string, (...args: unknown[]) => unknown>>

type ExportResolversBundle = {
  Query: {
    getSupportedExportFormats: (...args: unknown[]) => unknown
    validateExportOptions: (...args: unknown[]) => unknown
    getExportHistory: (...args: unknown[]) => unknown
  }
  Mutation: {
    exportTableNodes: (...args: unknown[]) => unknown
    exportMultipleTables: (...args: unknown[]) => unknown
  }
  Table: {
    exportNodes: (...args: unknown[]) => unknown
    exportPreview: (...args: unknown[]) => unknown
  }
}

export interface GraphQLDependencies {
  // Query resolvers
  tableQueries: TableQueries
  nodeQueries: NodeQueries
  attributeQueries: AttributeQueries
  relationQueries: RelationQueries
  templateQueries: TemplateQueries
  docQueries: DocQueries
  systemQueries?: SystemQueries
  jsonExportQueries?: JsonExportQueriesBundle | null
  jsonlBackupQueries?: JsonlBackupQueries | null
  backupQueries?: BackupQueriesBundle | null
  // enhancedAttributeQueries?: any

  // Mutation resolvers
  tableMutations: TableMutations
  nodeMutations: NodeMutations
  attributeMutations: AttributeMutations
  relationMutations: RelationMutations
  templateMutations: TemplateMutations
  docMutations: DocMutations
  exportMutations: ExportResolversBundle
  backupMutations?: BackupMutationsBundle | null
  tablePackageResolver: TablePackageResolver
  systemResolver?: GraphQLResolverObject

  // Unified resolvers (Task 2.2 - Feature Flag Pattern)
  nodeResolver?: DynamicResolverMap
  tableResolver?: DynamicResolverMap
  docResolver?: DynamicResolverMap
  attributeResolver?: DynamicResolverMap
  relationResolver?: DynamicResolverMap
  queryTemplateResolver?: DynamicResolverMap

  // Field resolvers
  tableFieldResolvers: TableFieldResolvers
  nodeFieldResolvers: NodeFieldResolvers
  attributeFieldResolvers: AttributeFieldResolvers
  relationFieldResolvers: RelationFieldResolvers
  relationTypeFieldResolvers: RelationTypeFieldResolvers
  queryTemplateFieldResolvers: QueryTemplateFieldResolvers
  docFieldResolvers: DocFieldResolvers

  // Schema resolvers
  schemaResolvers: ReturnType<typeof createSchemaResolvers>
}

export class GraphQLSchemaBuilder {
  constructor(private container: DIContainer) {}

  async build(): Promise<GraphQLSchema> {
    const deps = await this.resolveDependencies()
    const schema = this.buildSchema(deps)
    return schema
  }

  private async resolveDependencies(): Promise<GraphQLDependencies> {
    // Query resolvers
    const tableQueries = (await this.container.resolve(GraphQLTokens.TABLE_QUERIES)) as TableQueries

    const nodeQueries = (await this.container.resolve(GraphQLTokens.NODE_QUERIES)) as NodeQueries

    const attributeQueries = (await this.container.resolve(GraphQLTokens.ATTRIBUTE_QUERIES)) as AttributeQueries

    const relationQueries = (await this.container.resolve(GraphQLTokens.RELATION_QUERIES)) as RelationQueries

    const templateQueries = (await this.container.resolve(GraphQLTokens.TEMPLATE_QUERIES)) as TemplateQueries

    const docQueries = (await this.container.resolve(GraphQLTokens.DOC_QUERIES)) as DocQueries

    const systemQueries = (await this.container.resolve(GraphQLTokens.SYSTEM_QUERIES)) as SystemQueries | undefined

    const jsonExportQueries = (await this.container.resolve(GraphQLTokens.JSON_EXPORT_QUERIES).catch(() => null)) as
      | JsonExportQueriesBundle
      | null

    const jsonlBackupQueries = (await this.container
      .resolve(GraphQLTokens.JSONL_BACKUP_QUERIES)
      .catch(() => null)) as JsonlBackupQueries | null

    const backupQueries = (await this.container.resolve(GraphQLTokens.BACKUP_QUERIES).catch(() => null)) as
      | BackupQueriesBundle
      | null

    // Mutation resolvers
    const tableMutations = (await this.container.resolve(GraphQLTokens.TABLE_MUTATIONS)) as TableMutations

    const nodeMutations = (await this.container.resolve(GraphQLTokens.NODE_MUTATIONS)) as NodeMutations

    const attributeMutations = (await this.container.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS)) as AttributeMutations

    const relationMutations = (await this.container.resolve(GraphQLTokens.RELATION_MUTATIONS)) as RelationMutations

    const templateMutations = (await this.container.resolve(GraphQLTokens.TEMPLATE_MUTATIONS)) as TemplateMutations

    const docMutations = (await this.container.resolve(GraphQLTokens.DOC_MUTATIONS)) as DocMutations

    const exportMutations = (await this.container.resolve(GraphQLTokens.EXPORT_MUTATIONS)) as ExportResolversBundle

    const backupMutations = (await this.container.resolve(GraphQLTokens.BACKUP_MUTATIONS).catch(() => null)) as
      | BackupMutationsBundle
      | null

    const tablePackageResolver = (await this.container.resolve(
      GraphQLTokens.TABLE_PACKAGE_RESOLVER,
    )) as TablePackageResolver

    // System resolver
    const systemResolver = (await this.container.resolve(GraphQLTokens.SYSTEM_RESOLVER)) as GraphQLResolverObject

    return {
      tableQueries,
      nodeQueries,
      attributeQueries,
      relationQueries,
      templateQueries,
      docQueries,
      systemQueries,
      jsonExportQueries,
      jsonlBackupQueries,
      backupQueries,
      tableMutations,
      nodeMutations,
      attributeMutations,
      relationMutations,
      templateMutations,
      docMutations,
      exportMutations,
      backupMutations,
      tablePackageResolver,
      systemResolver,

      // Unified resolvers (Task 2.2 - Feature Flag Pattern)
      // TEMP DISABLE ALL: Debugging server hang issue
      nodeResolver: undefined, // await this.container.resolve(GraphQLTokens.NODE_RESOLVER).catch(() => null),
      tableResolver: undefined, // await this.container.resolve(GraphQLTokens.TABLE_RESOLVER).catch(() => null),
      docResolver: undefined, // await this.container.resolve(GraphQLTokens.DOC_RESOLVER).catch(() => null),
      attributeResolver: undefined, // await this.container.resolve(GraphQLTokens.ATTRIBUTE_RESOLVER).catch(() => null),
      relationResolver: undefined, // await this.container.resolve(GraphQLTokens.RELATION_RESOLVER).catch(() => null),
      queryTemplateResolver: undefined, // await this.container.resolve(GraphQLTokens.QUERY_TEMPLATE_RESOLVER).catch(() => null),

      // Field resolvers
      tableFieldResolvers: await this.container.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS),
      nodeFieldResolvers: await this.container.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS),
      attributeFieldResolvers: await this.container.resolve(GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS),
      relationFieldResolvers: await this.container.resolve(GraphQLTokens.RELATION_FIELD_RESOLVERS),
      relationTypeFieldResolvers: await this.container.resolve(GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS),
      queryTemplateFieldResolvers: await this.container.resolve(GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS),
      docFieldResolvers: await this.container.resolve(GraphQLTokens.DOC_FIELD_RESOLVERS),

      // Schema resolvers
      schemaResolvers: await this.resolveSchemaResolvers(),
    }
  }

  private async resolveSchemaResolvers(): Promise<ReturnType<typeof createSchemaResolvers>> {
    const tableRepository = (await this.container.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository

    const schemaExportUseCase = (await this.container.resolve(UseCaseTokens.SCHEMA_EXPORT_USE_CASE)) as SchemaExportUseCase

    const schemaImportUseCase = (await this.container.resolve(UseCaseTokens.SCHEMA_IMPORT_USE_CASE)) as SchemaImportUseCase

    const schemaResolvers = createSchemaResolvers({
      tableRepository,
      schemaExportUseCase,
      schemaImportUseCase,
      logger: {
        info: (msg: string, data?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: Record<string, unknown>) => console.debug(`[DEBUG] ${msg}`, data || ''),
      },
    })
    return schemaResolvers
  }

  protected buildSchema(deps: GraphQLDependencies): GraphQLSchema {
    // Load GraphQL schema files from the new structure
    const typesArray = loadFilesSync(join(process.cwd(), 'src/presentation/graphql/schema'), {
      extensions: ['graphql'],
      recursive: true,
    })

    const typeDefs = mergeTypeDefs(typesArray)

    const resolvers = {
      // Custom scalars
      DateTime: DateTimeResolver,
      JSON: JSONResolver,

      // Root resolvers
      ...createRootResolvers(deps),

      Subscription: {
        ...templateSubscriptionResolvers.Subscription,
      },

      // Field resolvers
      TablesConnection: {
        tables: (parent: GraphQLParent) => getArrayValue(parent, 'tables') ?? getArrayValue(parent, 'nodes') ?? [],
      },

      RelatedNodesConnection: {
        totalConnections: (parent: GraphQLParent) =>
          getNumberValue(parent, 'totalConnections') ?? getNumberValue(parent, 'totalCount') ?? getArrayValue(parent, 'nodes')?.length ?? 0,
      },

      Table: {
        name: (parent: GraphQLParent) => getStringValue(parent, 'name') ?? getStringValue(parent, 'identifier'),
        attributes: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.attributes>[0],
            ReturnType<typeof deps.tableFieldResolvers.attributes>
          >(
            deps.tableResolver,
            'attributes_field',
            deps.tableFieldResolvers,
            'attributes',
            parent,
          ),
        attributeTypes: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.attributeTypes>[0],
            ReturnType<typeof deps.tableFieldResolvers.attributeTypes>
          >(
            deps.tableResolver,
            'attributeTypes_field',
            deps.tableFieldResolvers,
            'attributeTypes',
            parent,
          ),
        nodes: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.tableNodes>[0],
            ReturnType<typeof deps.tableFieldResolvers.tableNodes>
          >(
            deps.tableResolver,
            'tableNodes_field',
            deps.tableFieldResolvers,
            'tableNodes',
            parent,
          ),
        tableNodes: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.tableNodes>[0],
            ReturnType<typeof deps.tableFieldResolvers.tableNodes>
          >(
            deps.tableResolver,
            'tableNodes_field',
            deps.tableFieldResolvers,
            'tableNodes',
            parent,
          ),
        tableNodeCount: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.tableNodeCount>[0],
            ReturnType<typeof deps.tableFieldResolvers.tableNodeCount>
          >(
            deps.tableResolver,
            'tableNodeCount_field',
            deps.tableFieldResolvers,
            'tableNodeCount',
            parent,
          ),
        nodeCount: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.tableNodeCount>[0],
            ReturnType<typeof deps.tableFieldResolvers.tableNodeCount>
          >(
            deps.tableResolver,
            'tableNodeCount_field',
            deps.tableFieldResolvers,
            'tableNodeCount',
            parent,
          ),
        attributeCount: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.attributeCount>[0],
            ReturnType<typeof deps.tableFieldResolvers.attributeCount>
          >(
            deps.tableResolver,
            'attributeCount_field',
            deps.tableFieldResolvers,
            'attributeCount',
            parent,
          ),
        aiMetadata: (parent: GraphQLParent, args: Record<string, unknown>) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.tableFieldResolvers.aiMetadata>[0],
            ReturnType<typeof deps.tableFieldResolvers.aiMetadata>,
            [Parameters<typeof deps.tableFieldResolvers.aiMetadata>[1]]
          >(
            deps.tableResolver,
            'aiMetadata_field',
            deps.tableFieldResolvers,
            'aiMetadata',
            parent,
            castArgs<Parameters<typeof deps.tableFieldResolvers.aiMetadata>[1]>(args),
          ),
        mcpCommand: (parent: GraphQLParent) =>
          callFieldResolver<
            Parameters<typeof deps.tableFieldResolvers.mcpCommand>[0],
            ReturnType<typeof deps.tableFieldResolvers.mcpCommand>
          >(deps.tableFieldResolvers, 'mcpCommand', parent),
        // Export field resolvers
        exportNodes: (parent: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callFieldResolver<{ id: string }, ReturnType<typeof deps.exportMutations.Table.exportNodes>, [Record<string, unknown>, GraphQLContext]>(
            deps.exportMutations.Table,
            'exportNodes',
            parent,
            args,
            context,
          ) ?? deps.exportMutations.Table.exportNodes(castParent<{ id: string }>(parent), args, context),
        exportPreview: (parent: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callFieldResolver<{ id: string }, ReturnType<typeof deps.exportMutations.Table.exportPreview>, [Record<string, unknown>, GraphQLContext]>(
            deps.exportMutations.Table,
            'exportPreview',
            parent,
            args,
            context,
          ) ?? deps.exportMutations.Table.exportPreview(castParent<{ id: string }>(parent), args, context),
      },

      Attribute: {
        tableId: (parent: GraphQLParent) => getStringValue(parent, 'tableId'),
        required: (parent: GraphQLParent) =>
          callFieldResolver<
            Parameters<typeof deps.attributeFieldResolvers.required>[0],
            ReturnType<typeof deps.attributeFieldResolvers.required>
          >(deps.attributeFieldResolvers, 'required', parent),
        searchable: (parent: GraphQLParent) =>
          callFieldResolver<
            Parameters<typeof deps.attributeFieldResolvers.searchable>[0],
            ReturnType<typeof deps.attributeFieldResolvers.searchable>
          >(deps.attributeFieldResolvers, 'searchable', parent),
        attributeType: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.attributeFieldResolvers.attributeType>[0],
            ReturnType<typeof deps.attributeFieldResolvers.attributeType>
          >(
            deps.attributeResolver,
            'attributeType_field',
            deps.attributeFieldResolvers,
            'attributeType',
            parent,
          ),
        table: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.attributeFieldResolvers.table>[0],
            ReturnType<typeof deps.attributeFieldResolvers.table>
          >(deps.attributeResolver, 'table_field', deps.attributeFieldResolvers, 'table', parent),
      },

      TableNode: {
        relevanceScore: (parent: GraphQLParent) => getNumberValue(parent, 'relevanceScore') ?? 1,
        distance: (parent: GraphQLParent) => getNumberValue(parent, 'distance') ?? 0,
        tableId: (parent: GraphQLParent) => getStringValue(parent, 'tableId') ?? callStringMethod(parent, 'getTableId') ?? null,
        table: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.table>[0],
            ReturnType<typeof deps.nodeFieldResolvers.table>
          >(deps.nodeResolver, 'table_field', deps.nodeFieldResolvers, 'table', parent),
        attributes: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.attributes>[0],
            ReturnType<typeof deps.nodeFieldResolvers.attributes>
          >(
            deps.nodeResolver,
            'attributes_field',
            deps.nodeFieldResolvers,
            'attributes',
            parent,
          ),
        attributeCount: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.attributeCount>[0],
            ReturnType<typeof deps.nodeFieldResolvers.attributeCount>
          >(
            deps.nodeResolver,
            'attributeCount_field',
            deps.nodeFieldResolvers,
            'attributeCount',
            parent,
          ),
        outgoingRelations: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.outgoingRelations>[0],
            ReturnType<typeof deps.nodeFieldResolvers.outgoingRelations>
          >(
            deps.nodeResolver,
            'outgoingRelations_field',
            deps.nodeFieldResolvers,
            'outgoingRelations',
            parent,
          ),
        incomingRelations: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.incomingRelations>[0],
            ReturnType<typeof deps.nodeFieldResolvers.incomingRelations>
          >(
            deps.nodeResolver,
            'incomingRelations_field',
            deps.nodeFieldResolvers,
            'incomingRelations',
            parent,
          ),
        relations: async (parent: GraphQLParent) => {
          const outgoing =
            (await (callFieldResolverWithFallback<
              Parameters<typeof deps.nodeFieldResolvers.outgoingRelations>[0],
              ReturnType<typeof deps.nodeFieldResolvers.outgoingRelations>
            >(
              deps.nodeResolver,
              'outgoingRelations_field',
              deps.nodeFieldResolvers,
              'outgoingRelations',
              parent,
            ))) || []
          const incoming =
            (await (callFieldResolverWithFallback<
              Parameters<typeof deps.nodeFieldResolvers.incomingRelations>[0],
              ReturnType<typeof deps.nodeFieldResolvers.incomingRelations>
            >(
              deps.nodeResolver,
              'incomingRelations_field',
              deps.nodeFieldResolvers,
              'incomingRelations',
              parent,
            ))) || []
          return [...outgoing, ...incoming]
        },
        relationCount: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.relationCount>[0],
            ReturnType<typeof deps.nodeFieldResolvers.relationCount>
          >(
            deps.nodeResolver,
            'relationCount_field',
            deps.nodeFieldResolvers,
            'relationCount',
            parent,
          ),
        // Graph traversal field resolvers
        connectedNodes: (parent: GraphQLParent, args: Record<string, unknown>) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.connectedNodes>[0],
            ReturnType<typeof deps.nodeFieldResolvers.connectedNodes>,
            [Parameters<typeof deps.nodeFieldResolvers.connectedNodes>[1]]
          >(
            deps.nodeResolver,
            'connectedNodes_field',
            deps.nodeFieldResolvers,
            'connectedNodes',
            parent,
            castArgs<Parameters<typeof deps.nodeFieldResolvers.connectedNodes>[1]>(args),
          ),
        shortestPath: (parent: GraphQLParent, args: Record<string, unknown>) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.shortestPath>[0],
            ReturnType<typeof deps.nodeFieldResolvers.shortestPath>,
            [Parameters<typeof deps.nodeFieldResolvers.shortestPath>[1]]
          >(
            deps.nodeResolver,
            'shortestPath_field',
            deps.nodeFieldResolvers,
            'shortestPath',
            parent,
            castArgs<Parameters<typeof deps.nodeFieldResolvers.shortestPath>[1]>(args),
          ),
        neighborsByRelationType: (parent: GraphQLParent, args: Record<string, unknown>) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.neighborsByRelationType>[0],
            ReturnType<typeof deps.nodeFieldResolvers.neighborsByRelationType>,
            [Parameters<typeof deps.nodeFieldResolvers.neighborsByRelationType>[1]]
          >(
            deps.nodeResolver,
            'neighborsByRelationType_field',
            deps.nodeFieldResolvers,
            'neighborsByRelationType',
            parent,
            castArgs<Parameters<typeof deps.nodeFieldResolvers.neighborsByRelationType>[1]>(args),
          ),
      },

      SearchNodeResult: {
        node: (parent: GraphQLParent) => getRecordValue(parent)?.node ?? parent,
        table: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.nodeFieldResolvers.table>[0],
            ReturnType<typeof deps.nodeFieldResolvers.table>
          >(deps.nodeResolver, 'table_field', deps.nodeFieldResolvers, 'table', getRecordValue(parent)?.node ?? parent),
      },

      NodeAttribute: {
        attributeId: (parent: GraphQLParent) => getStringValue(parent, 'attributeId') ?? callStringMethod(parent, 'getAttributeId') ?? null,
        attribute: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.attributeFieldResolvers.nodeAttribute_attribute_field>[0],
            ReturnType<typeof deps.attributeFieldResolvers.nodeAttribute_attribute_field>
          >(
            deps.attributeResolver,
            'nodeAttribute_attribute_field',
            deps.attributeFieldResolvers,
            'nodeAttribute_attribute_field',
            parent,
          ),
        formattedValue: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.attributeFieldResolvers.nodeAttribute_formattedValue_field>[0],
            ReturnType<typeof deps.attributeFieldResolvers.nodeAttribute_formattedValue_field>
          >(
            deps.attributeResolver,
            'nodeAttribute_formattedValue_field',
            deps.attributeFieldResolvers,
            'nodeAttribute_formattedValue_field',
            parent,
          ),
      },

      NodeRelation: {
        fromNodeId: (parent: GraphQLParent) =>
          getStringValue(parent, 'fromNodeId') ?? getStringValue(parent, 'sourceNodeId') ?? callStringMethod(parent, 'getSourceNodeId') ?? null,
        toNodeId: (parent: GraphQLParent) =>
          getStringValue(parent, 'toNodeId') ?? getStringValue(parent, 'targetNodeId') ?? callStringMethod(parent, 'getTargetNodeId') ?? null,
        relationshipType: async (parent: GraphQLParent) => {
          const relationType =
            (await (callFieldResolverWithFallback<
              Parameters<typeof deps.relationFieldResolvers.relationType>[0],
              ReturnType<typeof deps.relationFieldResolvers.relationType>
            >(
              deps.relationResolver,
              'relationType_field',
              deps.relationFieldResolvers,
              'relationType',
              parent,
            ))) || null
          return getStringValue(relationType, 'identifier') ?? getStringValue(relationType, 'name') ?? ''
        },
        table: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.table>[0],
            ReturnType<typeof deps.relationFieldResolvers.table>
          >(deps.relationResolver, 'table_field', deps.relationFieldResolvers, 'table', parent),
        fromNode: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.sourceNode>[0],
            ReturnType<typeof deps.relationFieldResolvers.sourceNode>
          >(
            deps.relationResolver,
            'sourceNode_field',
            deps.relationFieldResolvers,
            'sourceNode',
            parent,
          ),
        toNode: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.targetNode>[0],
            ReturnType<typeof deps.relationFieldResolvers.targetNode>
          >(
            deps.relationResolver,
            'targetNode_field',
            deps.relationFieldResolvers,
            'targetNode',
            parent,
          ),
        sourceNode: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.sourceNode>[0],
            ReturnType<typeof deps.relationFieldResolvers.sourceNode>
          >(
            deps.relationResolver,
            'sourceNode_field',
            deps.relationFieldResolvers,
            'sourceNode',
            parent,
          ),
        targetNode: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.targetNode>[0],
            ReturnType<typeof deps.relationFieldResolvers.targetNode>
          >(
            deps.relationResolver,
            'targetNode_field',
            deps.relationFieldResolvers,
            'targetNode',
            parent,
          ),
        relationType: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationFieldResolvers.relationType>[0],
            ReturnType<typeof deps.relationFieldResolvers.relationType>
          >(
            deps.relationResolver,
            'relationType_field',
            deps.relationFieldResolvers,
            'relationType',
            parent,
          ),
      },

      RelationType: {
        name: (parent: GraphQLParent) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.relationTypeFieldResolvers.name>[0],
            ReturnType<typeof deps.relationTypeFieldResolvers.name>
          >(
            deps.relationResolver,
            'name_field',
            deps.relationTypeFieldResolvers,
            'name',
            parent,
          ),
      },

      SystemDatabaseStats: {
        connections: (parent: GraphQLParent) => getNumberValue(parent, 'connections') ?? getNumberValue(parent, 'connectionCount') ?? 0,
        queries: (parent: GraphQLParent) => getNumberValue(parent, 'queries') ?? getNumberValue(parent, 'queryCount') ?? 0,
      },

      SystemMemoryStats: {
        heapUsed: (parent: GraphQLParent) => getNumberValue(parent, 'heapUsed') ?? getNumberValue(getNestedRecordValue(parent, 'heap'), 'used') ?? 0,
      },

      TemplateExecutionResult: {
        executionTime: (parent: GraphQLParent) =>
          getNumberValue(parent, 'executionTime') ?? getNumberValue(getNestedRecordValue(parent, 'metadata'), 'executionTime') ?? 0,
      },

      QueryTemplate: {
        query: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.query>>(
            deps.queryTemplateResolver,
            'query_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.query(parent as QueryTemplate),
        queryName: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.queryName>>(
            deps.queryTemplateResolver,
            'queryName_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.queryName(parent as QueryTemplate),
        operationType: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.operationType>>(
            deps.queryTemplateResolver,
            'operationType_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.operationType(parent as QueryTemplate),
        variables: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.variables>>(
            deps.queryTemplateResolver,
            'variables_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.variables(parent as QueryTemplate),
        inputSchema: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.inputSchema>>(
            deps.queryTemplateResolver,
            'inputSchema_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.inputSchema(parent as QueryTemplate),
        defaultVariables: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.defaultVariables>>(
            deps.queryTemplateResolver,
            'defaultVariables_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.defaultVariables(parent as QueryTemplate),
        applicableTables: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.applicableTables>>(
            deps.queryTemplateResolver,
            'applicableTables_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.applicableTables(parent as QueryTemplate),
        complexityScore: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.complexityScore>>(
            deps.queryTemplateResolver,
            'complexityScore_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.complexityScore(parent as QueryTemplate),
        usageCount: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.usageCount>>(
            deps.queryTemplateResolver,
            'usageCount_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.usageCount(parent as QueryTemplate),
        lastUsedAt: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.lastUsedAt>>(
            deps.queryTemplateResolver,
            'lastUsedAt_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.lastUsedAt(parent as QueryTemplate),
        avgExecutionTimeMs: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.avgExecutionTimeMs>>(
            deps.queryTemplateResolver,
            'avgExecutionTimeMs_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.avgExecutionTimeMs(parent as QueryTemplate),
        version: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.version>>(
            deps.queryTemplateResolver,
            'version_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.version(parent as QueryTemplate),
        isActive: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.isActive>>(
            deps.queryTemplateResolver,
            'isActive_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.isActive(parent as QueryTemplate),
        tags: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.tags>>(
            deps.queryTemplateResolver,
            'tags_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.tags(parent as QueryTemplate),
        createdBy: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.createdBy>>(
            deps.queryTemplateResolver,
            'createdBy_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.createdBy(parent as QueryTemplate),
        createdAt: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.createdAt>>(
            deps.queryTemplateResolver,
            'createdAt_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.createdAt(parent as QueryTemplate),
        updatedAt: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.updatedAt>>(
            deps.queryTemplateResolver,
            'updatedAt_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.updatedAt(parent as QueryTemplate),
        isValid: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.isValid>>(
            deps.queryTemplateResolver,
            'isValid_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.isValid(parent as QueryTemplate),
        validationErrors: (parent: GraphQLParent) =>
          callResolver<ReturnType<typeof deps.queryTemplateFieldResolvers.validationErrors>>(
            deps.queryTemplateResolver,
            'validationErrors_field',
            parent as QueryTemplate,
          ) ??
          deps.queryTemplateFieldResolvers.validationErrors(parent as QueryTemplate),
      },

      Doc: {
        table: (
          parent: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) =>
          callFieldResolverWithFallback<
            Parameters<typeof deps.docFieldResolvers.table>[0],
            ReturnType<typeof deps.docFieldResolvers.table>,
            [
              Parameters<typeof deps.docFieldResolvers.table>[1],
              GraphQLContext,
              GraphQLResolveInfo,
            ]
          >(
            deps.docResolver,
            'table_field',
            deps.docFieldResolvers,
            'table',
            parent,
            castArgs<Parameters<typeof deps.docFieldResolvers.table>[1]>(args),
            context,
            info,
          ),
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    })

    // Set the schema reference in the template resolvers
    deps.templateQueries.setSchema(schema)
    deps.templateMutations.setSchema(schema)

    return schema
  }
}

// Keep the function export for backward compatibility
export function buildGraphQLSchema(deps: GraphQLDependencies): GraphQLSchema {
  const builder = new (class extends GraphQLSchemaBuilder {
    constructor() {
      super(null as unknown as DIContainer) // This is for backward compatibility only
    }

    override buildSchema(dependencies: GraphQLDependencies): GraphQLSchema {
      return super.buildSchema(dependencies)
    }
  })()

  return builder.buildSchema(deps)
}
