import { join } from 'node:path'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLResolveInfo, GraphQLSchema } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import type { GraphQLContext, GraphQLParent, NodeParent } from '@/core/types/GraphQLTypes.js'
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

    type RootResolverArgs = Record<string, unknown>
    type RootArgsMapper<TArgs> = (args: TArgs) => TArgs

    const callResolver = <T>(resolver: unknown, method: string, ...args: unknown[]): T | undefined => {
      if (!resolver || (typeof resolver !== 'object' && typeof resolver !== 'function')) {
        return undefined
      }

      const candidate = (resolver as Record<string, unknown>)[method]
      if (typeof candidate !== 'function') {
        return undefined
      }

      return Reflect.apply(candidate, resolver, args) as T
    }

    const castArgs = <T>(value: RootResolverArgs): T => value as unknown as T
    const castParent = <T>(value: GraphQLParent): T => value as T
    const getInput = (value: RootResolverArgs) => (value as { input?: RootResolverArgs }).input
    const normalizeRootArgs = <TArgs>(
      args: RootResolverArgs,
      mapArgs?: RootArgsMapper<TArgs>,
    ): TArgs => {
      const typedArgs = castArgs<TArgs>(args)
      return mapArgs ? mapArgs(typedArgs) : typedArgs
    }
    const callRootResolver = <TArgs = RootResolverArgs, TResult = unknown, TContext = GraphQLContext>(
      resolver: unknown,
      method: string,
      parent: GraphQLParent,
      args: RootResolverArgs,
      context?: TContext,
      info?: GraphQLResolveInfo,
      mapArgs?: RootArgsMapper<TArgs>,
    ): TResult | undefined => {
      const typedArgs = normalizeRootArgs(args, mapArgs)
      return callResolver<TResult>(resolver, method, parent, typedArgs, context, info)
    }
    const callRootResolverWithFallback = <
      TArgs = RootResolverArgs,
      TResult = unknown,
      TContext = GraphQLContext,
    >(
      primaryResolver: unknown,
      primaryMethod: string,
      fallbackResolver: unknown,
      fallbackMethod: string,
      parent: GraphQLParent,
      args: RootResolverArgs,
      context?: TContext,
      info?: GraphQLResolveInfo,
      mapArgs?: RootArgsMapper<TArgs>,
    ): TResult | undefined =>
      callRootResolver<TArgs, TResult, TContext>(primaryResolver, primaryMethod, parent, args, context, info, mapArgs) ??
      callRootResolver<TArgs, TResult, TContext>(fallbackResolver, fallbackMethod, parent, args, context, info, mapArgs)
    const withPaginationInput = <
      TArgs extends { input?: RootResolverArgs; pagination?: RootResolverArgs },
    >(
      args: TArgs,
    ): TArgs => ({
      ...args,
      pagination: args.pagination ?? getInput(args),
    })
    const callFieldResolver = <TParent, TResult = unknown, TArgs extends unknown[] = []>(
      resolver: unknown,
      method: string,
      parent: GraphQLParent,
      ...args: TArgs
    ): TResult | undefined => callResolver<TResult>(resolver, method, castParent<TParent>(parent), ...args)
    const callFieldResolverWithFallback = <TParent, TResult = unknown, TArgs extends unknown[] = []>(
      primaryResolver: unknown,
      primaryMethod: string,
      fallbackResolver: unknown,
      fallbackMethod: string,
      parent: GraphQLParent,
      ...args: TArgs
    ): TResult | undefined =>
      callFieldResolver<TParent, TResult, TArgs>(primaryResolver, primaryMethod, parent, ...args) ??
      callFieldResolver<TParent, TResult, TArgs>(fallbackResolver, fallbackMethod, parent, ...args)
    const getRecordValue = (value: unknown): Record<string, unknown> | null =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? castParent<Record<string, unknown>>(value)
        : null
    const getStringValue = (value: unknown, key: string): string | undefined => {
      const candidate = getRecordValue(value)?.[key]
      return typeof candidate === 'string' ? candidate : undefined
    }
    const getNumberValue = (value: unknown, key: string): number | undefined => {
      const candidate = getRecordValue(value)?.[key]
      return typeof candidate === 'number' ? candidate : undefined
    }
    const getArrayValue = (value: unknown, key: string): unknown[] | undefined => {
      const candidate = getRecordValue(value)?.[key]
      return Array.isArray(candidate) ? candidate : undefined
    }
    const getNestedRecordValue = (value: unknown, key: string): Record<string, unknown> | null => {
      const candidate = getRecordValue(value)?.[key]
      return getRecordValue(candidate)
    }
    const callStringMethod = (value: unknown, key: string): string | null | undefined => {
      const record = getRecordValue(value)
      if (!record) {
        return undefined
      }

      const candidate = record[key]
      if (typeof candidate !== 'function') {
        return undefined
      }

      const result = Reflect.apply(candidate, record, [])
      return typeof result === 'string' || result === null ? result : undefined
    }

    const resolvers = {
      // Custom scalars
      DateTime: DateTimeResolver,
      JSON: JSONResolver,

      // Root resolvers
      Query: {
        _schema: () => null, // Required placeholder
        // Table queries
        table: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'table', _, args) ?? callResolver(deps.tableQueries, 'table', _, args),
        tableByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'tableByIdentifier', _, args) ??
          callResolver(deps.tableQueries, 'tableByIdentifier', _, args),
        tables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'tables', _, args) ?? callResolver(deps.tableQueries, 'tables', _, args),
        getTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'tables', _, {
            pagination: (args as { input?: Record<string, unknown> }).input,
          }) ??
          callResolver(deps.tableQueries, 'tables', _, {
            pagination: (args as { input?: Record<string, unknown> }).input,
          }),
        searchTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'searchTables', _, args) ??
          callResolver(deps.tableQueries, 'searchTables', _, args),
        tableDocumentation: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'tableDocumentation', _, args) ??
          callResolver(deps.tableQueries, 'tableDocumentation', _, args),
        tableOpenApiProjection: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.tableResolver, 'tableOpenApiProjection', _, args) ??
          callResolver(deps.tableQueries, 'tableOpenApiProjection', _, args),

        // Attribute type queries
        attributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.attributeResolver, 'attributeType', _, args) ??
          callResolver(deps.attributeQueries, 'attributeType', _, args),
        attributeTypeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.attributeResolver, 'attributeTypeByIdentifier', _, args) ??
          callResolver(deps.attributeQueries, 'attributeTypeByIdentifier', _, args),
        attributeTypes: (_: GraphQLParent) =>
          callResolver(deps.attributeResolver, 'attributeTypes', _) ??
          callResolver(deps.attributeQueries, 'attributeTypes', _),

        // Attribute queries
        attribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.attributeResolver, 'attribute', _, args) ??
          callResolver(deps.attributeQueries, 'attribute', _, args),
        attributeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.attributeResolver, 'attributeByIdentifier', _, args) ??
          callResolver(deps.attributeQueries, 'attributeByIdentifier', _, args),
        attributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.attributeResolver, 'attributes', _, args) ??
          callResolver(deps.attributeQueries, 'attributes', _, args),

        // Node queries
        node: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.nodeResolver, 'node', _, castArgs<{ id: string }>(args)) ??
          deps.nodeQueries.node(_, castArgs<{ id: string }>(args)),
        nodeByContent: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.nodeResolver, 'nodeByContent', _, castArgs<{ tableId: string; content: string }>(args)) ??
          deps.nodeQueries.nodeByContent(_, castArgs<{ tableId: string; content: string }>(args)),
        getNodeAttributes: async (_: GraphQLParent, args: Record<string, unknown>) => ({
          attributes:
            (await (callResolver(
              deps.nodeResolver,
              'attributes_field',
              castParent<NodeParent>({
                id: String(args.nodeId || ''),
                tableId: '',
                content: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 0,
              }),
            ) ||
              deps.nodeFieldResolvers.attributes(
                castParent<NodeParent>({
                  id: String(args.nodeId || ''),
                  tableId: '',
                  content: '',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  version: 0,
                }),
              ))) || [],
        }),
        nodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.nodeResolver, 'nodes', _, castArgs<Record<string, unknown>>(args)) ??
          deps.nodeQueries.nodes(_, castArgs<Record<string, unknown>>(args)),
        searchNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.nodeResolver, 'searchNodes', _, castArgs<Record<string, unknown>>(args)) ??
          deps.nodeQueries.searchNodes(_, castArgs<Record<string, unknown>>(args)),
        searchNodesByAttribute: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          deps.nodeQueries.searchNodesByAttribute(_, castArgs<Record<string, unknown>>(args), context),

        // Relation queries
        relationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.relationResolver, 'relationType', _, castArgs<{ id: string }>(args)) ??
          deps.relationQueries.relationType(_, castArgs<{ id: string }>(args)),
        relationTypes: (_: GraphQLParent) =>
          callResolver(deps.relationResolver, 'relationTypes', _) ?? deps.relationQueries.relationTypes(_),
        nodeRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.relationResolver, 'nodeRelation', _, castArgs<{ id: string }>(args)) ??
          deps.relationQueries.nodeRelation(_, castArgs<{ id: string }>(args)),
        nodeRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.relationResolver, 'nodeRelations', _, castArgs<Record<string, unknown>>(args)) ??
          deps.relationQueries.nodeRelations(_, castArgs<Record<string, unknown>>(args)),
        searchRelatedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(deps.relationResolver, 'searchRelatedNodes', _, castArgs<Record<string, unknown>>(args)) ??
          deps.relationQueries.searchRelatedNodes(_, castArgs<Record<string, unknown>>(args)),
        getConnectedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.getConnectedNodes(
            _,
            castArgs<{
              input?: { nodeId: string; depth?: number; direction?: string; relationTypeIds?: string[] }
              nodeId?: string
              depth?: number
              direction?: string
              relationTypeIds?: string[]
            }>(args),
          ),
        findPathsBetweenNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.findPathsBetweenNodes(
            _,
            castArgs<{
              input: { sourceNodeId: string; targetNodeId: string; maxDepth?: number; relationTypeIds?: string[] }
            }>(args),
          ),
        getDependencyChain: (_: GraphQLParent, args: Record<string, unknown>) =>
          callResolver(
            deps.relationResolver,
            'getDependencyChain',
            _,
            castArgs<{ input: { nodeId: string; direction?: string; maxDepth?: number; relationTypeIds?: string[] } }>(
              args,
            ),
          ) ??
          deps.relationQueries.getDependencyChain(
            _,
            castArgs<{ input: { nodeId: string; direction?: string; maxDepth?: number; relationTypeIds?: string[] } }>(
              args,
            ),
          ),

        // Enhanced relation analytics (stub implementation)
        relationAnalytics: (_: GraphQLParent, _args: Record<string, unknown>) => ({
          totalRelations: 0,
          internalRelations: 0,
          externalRelations: 0,
          relationTypeDistribution: [],
          strengthDistribution: {
            invalid: 0,
            autoGenerated: 0,
            uncertain: 0,
            confident: 0,
            veryStrong: 0,
          },
          confidenceDistribution: {
            probablyWrong: 0,
            autoGenerated: 0,
            uncertainButValid: 0,
            confident: 0,
            verified: 0,
          },
          tableConnectivity: [],
          networkMetrics: {
            density: 0,
            clustering: 0,
            averagePathLength: 0,
            mostConnectedNodes: [],
            isolatedNodes: 0,
          },
        }),

        // Template queries
        getTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateQueries['getTemplate']>[1]>(
            deps.queryTemplateResolver,
            'getTemplate',
            deps.templateQueries,
            'getTemplate',
            _,
            args,
          ),
        getTemplateByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateQueries['getTemplateByIdentifier']>[1]>(
            deps.queryTemplateResolver,
            'getTemplateByIdentifier',
            deps.templateQueries,
            'getTemplateByIdentifier',
            _,
            args,
          ),
        searchTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateQueries['searchTemplates']>[1]>(
            deps.queryTemplateResolver,
            'searchTemplates',
            deps.templateQueries,
            'searchTemplates',
            _,
            args,
            undefined,
            undefined,
            withPaginationInput,
          ),
        getPopularTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateQueries['getPopularTemplates']>[1]>(
            deps.queryTemplateResolver,
            'getPopularTemplates',
            deps.templateQueries,
            'getPopularTemplates',
            _,
            args,
          ),

        // Table dependency queries
        templatesByTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateQueries['templatesByTable']>[1]>(
            deps.queryTemplateResolver,
            'templatesByTable',
            deps.templateQueries,
            'templatesByTable',
            _,
            args,
          ),
        // Template execution (delegated to mutations)
        executeTemplate: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['executeTemplate']>[1]>(
            deps.queryTemplateResolver,
            'executeTemplate',
            deps.templateMutations,
            'executeTemplate',
            _,
            args,
            context,
          ),

        // InputSchema validation
        validateInputSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TemplateQueries['validateInputSchema']>[1]>(
            deps.templateQueries,
            'validateInputSchema',
            _,
            args,
          ),

        // Runtime data validation
        validateData: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TemplateQueries['validateData']>[1]>(deps.templateQueries, 'validateData', _, args),

        // Doc queries
        getDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocQueries['getDoc']>[1]>(
            deps.docResolver,
            'getDoc',
            deps.docQueries,
            'getDoc',
            _,
            args,
          ),
        getActiveDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocQueries['getActiveDoc']>[1]>(
            deps.docResolver,
            'getActiveDoc',
            deps.docQueries,
            'getActiveDoc',
            _,
            args,
          ),
        getDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocQueries['getDocs']>[1]>(
            deps.docResolver,
            'getDocs',
            deps.docQueries,
            'getDocs',
            _,
            args,
          ),
        getDocVersions: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocQueries['getDocVersions']>[1]>(
            deps.docResolver,
            'getDocVersions',
            deps.docQueries,
            'getDocVersions',
            _,
            args,
          ),
        searchDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocQueries['searchDocs']>[1]>(
            deps.docResolver,
            'searchDocs',
            deps.docQueries,
            'searchDocs',
            _,
            args,
          ),

        // Essential system queries only
        healthCheck: (_: GraphQLParent, _args: Record<string, unknown>) => deps.systemQueries?.healthCheck() || null,
        systemStats: (_: GraphQLParent, _args: Record<string, unknown>) => deps.systemQueries?.systemStats() || null,
        systemStatus: (_: GraphQLParent, _args: Record<string, unknown>) => deps.systemResolver?.systemStatus?.() || null,
        tabularSyncConfigs: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemQueries?.tabularSyncConfigs?.() || [],
        tabularSyncConfig: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.systemQueries?.tabularSyncConfig?.(castArgs<{ configKey?: string | null }>(args)) || null,
        tabularSyncStatus: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.systemQueries?.tabularSyncStatus?.(
            castArgs<{
              limit?: number | null
              tableIdentifier?: string | null
              status?: string | null
              mode?: string | null
              windowPreset?: string | null
              createdAfter?: string | null
              createdBefore?: string | null
            }>(args),
          ) || null,
        tabularSyncSummary: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.systemQueries?.tabularSyncSummary?.(
            castArgs<{
              limit?: number | null
              tableIdentifier?: string | null
              status?: string | null
              mode?: string | null
              windowPreset?: string | null
              createdAfter?: string | null
              createdBefore?: string | null
            }>(args),
          ) || [],

        // Schema export queries
        exportTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<typeof deps.schemaResolvers.Query.exportTable>[1]>(
            deps.schemaResolvers.Query,
            'exportTable',
            _,
            args,
          ),
        exportAllTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<typeof deps.schemaResolvers.Query.exportAllTables>[1]>(
            deps.schemaResolvers.Query,
            'exportAllTables',
            _,
            args,
          ),

        // Table Package queries
        validateTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['validateTablePackage']>[1]>(
            deps.tablePackageResolver,
            'validateTablePackage',
            _,
            args,
          ),
        analyzeTableDependencies: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['analyzeTableDependencies']>[1]>(
            deps.tablePackageResolver,
            'analyzeTableDependencies',
            _,
            args,
          ),
        getImportSession: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['getImportSession']>[1]>(
            deps.tablePackageResolver,
            'getImportSession',
            _,
            args,
          ),

        // Export queries
        getSupportedExportFormats: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<typeof deps.exportMutations.Query.getSupportedExportFormats>[1]>(
            deps.exportMutations.Query,
            'getSupportedExportFormats',
            _,
            args,
          ),
        validateExportOptions: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolver<Parameters<typeof deps.exportMutations.Query.validateExportOptions>[1]>(
            deps.exportMutations.Query,
            'validateExportOptions',
            _,
            args,
            context,
          ),
        getExportHistory: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolver<Parameters<typeof deps.exportMutations.Query.getExportHistory>[1]>(
            deps.exportMutations.Query,
            'getExportHistory',
            _,
            args,
            context,
          ),

        // JSON Export queries
        exportTableJson: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) => {
          if (!deps.jsonExportQueries) {
            throw new Error('JsonExportQueries not available')
          }
          const { JsonExportQueries, jsonExportService, logger } = deps.jsonExportQueries
          return callRootResolver<
            { tableId: string; options?: Record<string, unknown> },
            unknown,
            { jsonExportService: JsonExportService; logger: ILogger }
          >(JsonExportQueries, 'exportTableJson', _, args, { jsonExportService, logger }, info)
        },

        // JSONL Backup queries
        inspectJsonlBackup: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.jsonlBackupQueries?.inspectJsonlBackup(_, args as { inputDir: string }) || null,

        // SQLite Backup queries
        listBackups: (_: GraphQLParent, args: Record<string, unknown>, _context: GraphQLContext, info: GraphQLResolveInfo) => {
          if (!deps.backupQueries) {
            throw new Error('BackupQueries not available')
          }
          const { BackupQueries, backupService, logger } = deps.backupQueries
          return callRootResolver<
            { filter?: { type?: 'FILE' | 'TABLE' | 'ALL'; createdAfter?: string; createdBefore?: string } },
            unknown,
            { backupService: SQLiteBackupService; logger: ILogger }
          >(BackupQueries, 'listBackups', _, args, { backupService, logger }, info)
        },
        backupMetrics: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) => {
          if (!deps.backupQueries) {
            throw new Error('BackupQueries not available')
          }
          const { BackupQueries, backupService, logger } = deps.backupQueries
          return callRootResolver<
            RootResolverArgs,
            unknown,
            { backupService: SQLiteBackupService; logger: ILogger }
          >(BackupQueries, 'backupMetrics', _, args, { backupService, logger }, info)
        },
      },

      Mutation: {
        _schema: () => null, // Required placeholder

        // Table mutations
        createTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TableMutations['createTable']>[1]>(
            deps.tableResolver,
            'createTable',
            deps.tableMutations,
            'createTable',
            _,
            args,
          ),
        batchCreateTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TableMutations['batchCreateTables']>[1]>(
            deps.tableMutations,
            'batchCreateTables',
            _,
            args,
          ),
        updateTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TableMutations['updateTable']>[1]>(
            deps.tableResolver,
            'updateTable',
            deps.tableMutations,
            'updateTable',
            _,
            args,
          ),
        batchDeleteTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TableMutations['batchDeleteTables']>[1]>(
            deps.tableMutations,
            'batchDeleteTables',
            _,
            args,
          ),
        deleteTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TableMutations['deleteTable']>[1]>(
            deps.tableResolver,
            'deleteTable',
            deps.tableMutations,
            'deleteTable',
            _,
            args,
          ),

        // Attribute type mutations
        createAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['createAttributeType']>[1]>(
            deps.attributeResolver,
            'createAttributeType',
            deps.attributeMutations,
            'createAttributeType',
            _,
            args,
          ),
        updateAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['updateAttributeType']>[1]>(
            deps.attributeResolver,
            'updateAttributeType',
            deps.attributeMutations,
            'updateAttributeType',
            _,
            args,
          ),
        deleteAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['deleteAttributeType']>[1]>(
            deps.attributeResolver,
            'deleteAttributeType',
            deps.attributeMutations,
            'deleteAttributeType',
            _,
            args,
          ),

        // Attribute mutations
        createAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['createAttribute']>[1]>(
            deps.attributeResolver,
            'createAttribute',
            deps.attributeMutations,
            'createAttribute',
            _,
            args,
          ),
        batchCreateAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<AttributeMutations['batchCreateAttributes']>[1]>(
            deps.attributeMutations,
            'batchCreateAttributes',
            _,
            args,
          ),
        updateAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['updateAttribute']>[1]>(
            deps.attributeResolver,
            'updateAttribute',
            deps.attributeMutations,
            'updateAttribute',
            _,
            args,
          ),
        deleteAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<AttributeMutations['deleteAttribute']>[1]>(
            deps.attributeResolver,
            'deleteAttribute',
            deps.attributeMutations,
            'deleteAttribute',
            _,
            args,
          ),

        // Node mutations
        createNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['createNode']>[1]>(
            deps.nodeResolver,
            'createNode',
            deps.nodeMutations,
            'createNode',
            _,
            args,
          ),
        batchCreateNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchCreateNodes']>[1]>(deps.nodeMutations, 'batchCreateNodes', _, args),
        batchCreateNodesTransactional: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchCreateNodesTransactional']>[1]>(
            deps.nodeMutations,
            'batchCreateNodesTransactional',
            _,
            args,
          ),
        batchCreateNodesWithProgress: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchCreateNodesWithProgress']>[1]>(
            deps.nodeMutations,
            'batchCreateNodesWithProgress',
            _,
            args,
          ),
        batchUpdateNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchUpdateNodes']>[1]>(deps.nodeMutations, 'batchUpdateNodes', _, args),
        updateNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['updateNode']>[1]>(
            deps.nodeResolver,
            'updateNode',
            deps.nodeMutations,
            'updateNode',
            _,
            args,
          ),
        deleteNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['deleteNode']>[1]>(
            deps.nodeResolver,
            'deleteNode',
            deps.nodeMutations,
            'deleteNode',
            _,
            args,
          ),
        setNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['setNodeAttribute']>[1]>(
            deps.nodeResolver,
            'setNodeAttribute',
            deps.nodeMutations,
            'setNodeAttribute',
            _,
            args,
          ),
        removeNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['removeNodeAttribute']>[1]>(
            deps.nodeResolver,
            'removeNodeAttribute',
            deps.nodeMutations,
            'removeNodeAttribute',
            _,
            args,
          ),
        updateNodeAttributeValue: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['updateNodeAttributeValue']>[1]>(
            deps.nodeResolver,
            'updateNodeAttributeValue',
            deps.nodeMutations,
            'updateNodeAttributeValue',
            _,
            args,
          ),
        createNodeWithAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['createNodeWithAttributes']>[1]>(
            deps.nodeResolver,
            'createNodeWithAttributes',
            deps.nodeMutations,
            'createNodeWithAttributes',
            _,
            args,
          ),
        createPersonNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['createPersonNode']>[1]>(
            deps.nodeResolver,
            'createPersonNode',
            deps.nodeMutations,
            'createPersonNode',
            _,
            args,
          ),
        setNodeAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['setNodeAttributes']>[1]>(
            deps.nodeResolver,
            'setNodeAttributes',
            deps.nodeMutations,
            'setNodeAttributes',
            _,
            args,
          ),
        setNodeAttributesByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<NodeMutations['setNodeAttributesByIdentifier']>[1]>(
            deps.nodeResolver,
            'setNodeAttributesByIdentifier',
            deps.nodeMutations,
            'setNodeAttributesByIdentifier',
            _,
            args,
          ),
        batchSetNodeAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchSetNodeAttributes']>[1]>(
            deps.nodeMutations,
            'batchSetNodeAttributes',
            _,
            args,
          ),
        batchOperationWithRollback: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<NodeMutations['batchOperationWithRollback']>[1]>(
            deps.nodeMutations,
            'batchOperationWithRollback',
            _,
            args,
          ),

        // Relation mutations
        createRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<RelationMutations['createRelationType']>[1]>(
            deps.relationResolver,
            'createRelationType',
            deps.relationMutations,
            'createRelationType',
            _,
            args,
          ),
        updateRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<RelationMutations['updateRelationType']>[1]>(
            deps.relationResolver,
            'updateRelationType',
            deps.relationMutations,
            'updateRelationType',
            _,
            args,
          ),
        deleteRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<RelationMutations['deleteRelationType']>[1]>(
            deps.relationResolver,
            'deleteRelationType',
            deps.relationMutations,
            'deleteRelationType',
            _,
            args,
          ),
        createRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<RelationMutations['createRelation']>[1]>(
            deps.relationResolver,
            'createRelation',
            deps.relationMutations,
            'createRelation',
            _,
            args,
          ),
        batchCreateRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<RelationMutations['batchCreateRelations']>[1]>(
            deps.relationMutations,
            'batchCreateRelations',
            _,
            args,
          ),
        deleteRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<RelationMutations['deleteRelation']>[1]>(
            deps.relationResolver,
            'deleteRelation',
            deps.relationMutations,
            'deleteRelation',
            _,
            args,
          ),

        // Template mutations
        createTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['createTemplate']>[1]>(
            deps.queryTemplateResolver,
            'createTemplate',
            deps.templateMutations,
            'createTemplate',
            _,
            args,
          ),
        updateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['updateTemplate']>[1]>(
            deps.queryTemplateResolver,
            'updateTemplate',
            deps.templateMutations,
            'updateTemplate',
            _,
            args,
          ),
        updateTemplateQuery: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['updateTemplateQuery']>[1]>(
            deps.queryTemplateResolver,
            'updateTemplateQuery',
            deps.templateMutations,
            'updateTemplateQuery',
            _,
            args,
          ),
        deleteTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['deleteTemplate']>[1]>(
            deps.queryTemplateResolver,
            'deleteTemplate',
            deps.templateMutations,
            'deleteTemplate',
            _,
            args,
          ),
        activateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['activateTemplate']>[1]>(
            deps.queryTemplateResolver,
            'activateTemplate',
            deps.templateMutations,
            'activateTemplate',
            _,
            args,
          ),
        deactivateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['deactivateTemplate']>[1]>(
            deps.queryTemplateResolver,
            'deactivateTemplate',
            deps.templateMutations,
            'deactivateTemplate',
            _,
            args,
          ),
        executeTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['executeTemplate']>[1]>(
            deps.queryTemplateResolver,
            'executeTemplate',
            deps.templateMutations,
            'executeTemplate',
            _,
            args,
          ),
        executeTemplateWithGraphQL: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['executeTemplateWithGraphQL']>[1]>(
            deps.queryTemplateResolver,
            'executeTemplateWithGraphQL',
            deps.templateMutations,
            'executeTemplateWithGraphQL',
            _,
            args,
            context,
          ),
        exportTemplate: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['exportTemplate']>[1]>(
            deps.queryTemplateResolver,
            'exportTemplate',
            deps.templateMutations,
            'exportTemplate',
            _,
            args,
            context,
          ),
        exportTemplates: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['exportTemplates']>[1]>(
            deps.queryTemplateResolver,
            'exportTemplates',
            deps.templateMutations,
            'exportTemplates',
            _,
            args,
            context,
          ),
        importTemplate: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolverWithFallback<Parameters<TemplateMutations['importTemplate']>[1]>(
            deps.queryTemplateResolver,
            'importTemplate',
            deps.templateMutations,
            'importTemplate',
            _,
            args,
            context,
          ),

        // Doc mutations
        createDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocMutations['createDoc']>[1]>(
            deps.docResolver,
            'createDoc',
            deps.docMutations,
            'createDoc',
            _,
            args,
          ),
        updateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocMutations['updateDoc']>[1]>(
            deps.docResolver,
            'updateDoc',
            deps.docMutations,
            'updateDoc',
            _,
            args,
          ),
        deleteDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocMutations['deleteDoc']>[1]>(
            deps.docResolver,
            'deleteDoc',
            deps.docMutations,
            'deleteDoc',
            _,
            args,
          ),
        activateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocMutations['activateDoc']>[1]>(
            deps.docResolver,
            'activateDoc',
            deps.docMutations,
            'activateDoc',
            _,
            args,
          ),
        createDocVersion: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolverWithFallback<Parameters<DocMutations['createDocVersion']>[1]>(
            deps.docResolver,
            'createDocVersion',
            deps.docMutations,
            'createDocVersion',
            _,
            args,
          ),

        // System initialization mutations
        initializeSystem: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<{ input: RootResolverArgs }>(deps.systemResolver, 'initializeSystem', _, args) || null,
        saveTabularSyncConfig: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<{ input: { configKey: string; config: Record<string, unknown>; active?: boolean } }>(
            deps.systemResolver,
            'saveTabularSyncConfig',
            _,
            args,
          ) || null,
        activateTabularSyncConfig: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<{ configKey: string }>(deps.systemResolver, 'activateTabularSyncConfig', _, args) || null,
        resyncTabularSyncTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<{ tableIdentifier: string }>(deps.systemResolver, 'resyncTabularSyncTable', _, args) || null,

        // Schema import mutations
        importSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<typeof deps.schemaResolvers.Mutation.importSchema>[1]>(
            deps.schemaResolvers.Mutation,
            'importSchema',
            _,
            args,
          ),

        // Table Package mutations
        exportTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['exportTablePackage']>[1]>(
            deps.tablePackageResolver,
            'exportTablePackage',
            _,
            args,
          ),
        importTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['importTablePackage']>[1]>(
            deps.tablePackageResolver,
            'importTablePackage',
            _,
            args,
          ),
        batchImportTablePackages: (_: GraphQLParent, args: Record<string, unknown>) =>
          callRootResolver<Parameters<TablePackageResolver['batchImportTablePackages']>[1]>(
            deps.tablePackageResolver,
            'batchImportTablePackages',
            _,
            args,
          ),

        // Export mutations
        exportTableNodes: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolver<Parameters<typeof deps.exportMutations.Mutation.exportTableNodes>[1]>(
            deps.exportMutations.Mutation,
            'exportTableNodes',
            _,
            args,
            context,
          ),
        exportMultipleTables: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
          callRootResolver<Parameters<typeof deps.exportMutations.Mutation.exportMultipleTables>[1]>(
            deps.exportMutations.Mutation,
            'exportMultipleTables',
            _,
            args,
            context,
          ),

        // JSONL Backup mutations
        exportJsonl: async (_: GraphQLParent, args: Record<string, unknown>) => {
          if (!deps.jsonlBackupQueries) {
            throw new Error('JSONL backup service not available')
          }
          return deps.jsonlBackupQueries.exportJsonl(_, args)
        },
        importJsonl: async (_: GraphQLParent, args: Record<string, unknown>) => {
          if (!deps.jsonlBackupQueries) {
            throw new Error('JSONL backup service not available')
          }
          return deps.jsonlBackupQueries.importJsonl(_, args as {
            input: {
              inputDir: string
              tableIdentifiers?: string[]
              conflictResolution: 'SKIP' | 'OVERWRITE' | 'MERGE'
              validateSchema?: boolean
              dryRun?: boolean
            }
          })
        },

        // SQLite Backup mutations
        backupDatabase: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) => {
          if (!deps.backupMutations) {
            throw new Error('BackupMutations not available')
          }
          const { BackupMutations, backupService, logger } = deps.backupMutations
          return callRootResolver<
            { input?: Record<string, unknown> },
            unknown,
            { backupService: SQLiteBackupService; logger: ILogger }
          >(BackupMutations, 'backupDatabase', _, args, { backupService, logger }, info)
        },
        restoreDatabase: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) => {
          if (!deps.backupMutations) {
            throw new Error('BackupMutations not available')
          }
          const { BackupMutations, backupService, logger } = deps.backupMutations
          return callRootResolver<
            { input: import('@/core/types/DatabaseBackup.js').SQLiteRestoreOptions },
            unknown,
            { backupService: SQLiteBackupService; logger: ILogger }
          >(BackupMutations, 'restoreDatabase', _, args, { backupService, logger }, info)
        },
        applyRetentionPolicy: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: GraphQLResolveInfo,
        ) => {
          if (!deps.backupMutations) {
            throw new Error('BackupMutations not available')
          }
          const { BackupMutations, backupService, logger } = deps.backupMutations
          return callRootResolver<
            { policy: import('@/core/types/DatabaseBackup.js').BackupRetentionPolicy },
            unknown,
            { backupService: SQLiteBackupService; logger: ILogger }
          >(BackupMutations, 'applyRetentionPolicy', _, args, { backupService, logger }, info)
        },
      },

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
