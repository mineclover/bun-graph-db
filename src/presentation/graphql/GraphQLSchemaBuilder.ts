import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import { join } from 'path'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { DIContainer } from '../../infrastructure/container/DIContainer.js'
import {
  GraphQLTokens,
  RepositoryTokens,
  UseCaseTokens,
} from '../../infrastructure/container/tokens/index.js'
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
import { createSchemaResolvers } from './resolvers/schema.js'
import type { TablePackageResolver } from './resolvers/TablePackageResolver.js'
import { templateSubscriptionResolvers } from './resolvers/TemplateSubscriptionResolver.js'

export interface GraphQLDependencies {
  // Query resolvers
  tableQueries: TableQueries
  nodeQueries: NodeQueries
  attributeQueries: AttributeQueries
  relationQueries: RelationQueries
  templateQueries: TemplateQueries
  docQueries: DocQueries
  systemQueries?: SystemQueries
  jsonExportQueries?: {
    JsonExportQueries: typeof JsonExportQueries
    jsonExportService: any
    logger: any
  }
  jsonlBackupQueries?: any
  // enhancedAttributeQueries?: any

  // Mutation resolvers
  tableMutations: TableMutations
  nodeMutations: NodeMutations
  attributeMutations: AttributeMutations
  relationMutations: RelationMutations
  templateMutations: TemplateMutations
  docMutations: DocMutations
  exportMutations: any
  tablePackageResolver: TablePackageResolver
  systemResolver?: any

  // Unified resolvers (Task 2.2 - Feature Flag Pattern)
  nodeResolver?: any // Optional unified NodeResolver for progressive migration
  tableResolver?: any // Optional unified TableResolver for progressive migration
  docResolver?: any // Optional unified DocResolver for progressive migration
  attributeResolver?: any // Optional unified AttributeResolver for progressive migration
  relationResolver?: any // Optional unified RelationResolver for progressive migration
  queryTemplateResolver?: any // Optional unified QueryTemplateResolver for progressive migration

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

    const attributeQueries = (await this.container.resolve(
      GraphQLTokens.ATTRIBUTE_QUERIES
    )) as AttributeQueries

    const relationQueries = (await this.container.resolve(
      GraphQLTokens.RELATION_QUERIES
    )) as RelationQueries

    const templateQueries = (await this.container.resolve(
      GraphQLTokens.TEMPLATE_QUERIES
    )) as TemplateQueries

    const docQueries = (await this.container.resolve(GraphQLTokens.DOC_QUERIES)) as DocQueries

    const systemQueries = (await this.container.resolve(GraphQLTokens.SYSTEM_QUERIES)) as
      | SystemQueries
      | undefined

    const jsonExportQueries = (await this.container
      .resolve(GraphQLTokens.JSON_EXPORT_QUERIES)
      .catch(() => null)) as any

    const jsonlBackupQueries = (await this.container
      .resolve(GraphQLTokens.JSONL_BACKUP_QUERIES)
      .catch(() => null)) as any

    // Mutation resolvers
    const tableMutations = (await this.container.resolve(
      GraphQLTokens.TABLE_MUTATIONS
    )) as TableMutations

    const nodeMutations = (await this.container.resolve(
      GraphQLTokens.NODE_MUTATIONS
    )) as NodeMutations

    const attributeMutations = (await this.container.resolve(
      GraphQLTokens.ATTRIBUTE_MUTATIONS
    )) as AttributeMutations

    const relationMutations = (await this.container.resolve(
      GraphQLTokens.RELATION_MUTATIONS
    )) as RelationMutations

    const templateMutations = (await this.container.resolve(
      GraphQLTokens.TEMPLATE_MUTATIONS
    )) as TemplateMutations

    const docMutations = (await this.container.resolve(GraphQLTokens.DOC_MUTATIONS)) as DocMutations

    const exportMutations = (await this.container.resolve(GraphQLTokens.EXPORT_MUTATIONS)) as any

    const tablePackageResolver = (await this.container.resolve(
      GraphQLTokens.TABLE_PACKAGE_RESOLVER
    )) as TablePackageResolver

    // System resolver
    const systemResolver = (await this.container.resolve(GraphQLTokens.SYSTEM_RESOLVER)) as any

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
      tableMutations,
      nodeMutations,
      attributeMutations,
      relationMutations,
      templateMutations,
      docMutations,
      exportMutations,
      tablePackageResolver,
      systemResolver,

      // Unified resolvers (Task 2.2 - Feature Flag Pattern)
      // TEMP DISABLE ALL: Debugging server hang issue
      nodeResolver: null, // await this.container.resolve(GraphQLTokens.NODE_RESOLVER).catch(() => null),
      tableResolver: null, // await this.container.resolve(GraphQLTokens.TABLE_RESOLVER).catch(() => null),
      docResolver: null, // await this.container.resolve(GraphQLTokens.DOC_RESOLVER).catch(() => null),
      attributeResolver: null, // await this.container.resolve(GraphQLTokens.ATTRIBUTE_RESOLVER).catch(() => null),
      relationResolver: null, // await this.container.resolve(GraphQLTokens.RELATION_RESOLVER).catch(() => null),
      queryTemplateResolver: null, // await this.container.resolve(GraphQLTokens.QUERY_TEMPLATE_RESOLVER).catch(() => null),

      // Field resolvers
      tableFieldResolvers: await this.container.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS),
      nodeFieldResolvers: await this.container.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS),
      attributeFieldResolvers: await this.container.resolve(
        GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS
      ),
      relationFieldResolvers: await this.container.resolve(GraphQLTokens.RELATION_FIELD_RESOLVERS),
      relationTypeFieldResolvers: await this.container.resolve(
        GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS
      ),
      queryTemplateFieldResolvers: await this.container.resolve(
        GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS
      ),
      docFieldResolvers: await this.container.resolve(GraphQLTokens.DOC_FIELD_RESOLVERS),

      // Schema resolvers
      schemaResolvers: await this.resolveSchemaResolvers(),
    }
  }

  private async resolveSchemaResolvers(): Promise<any> {
    const tableRepository = (await this.container.resolve(RepositoryTokens.TABLE_REPOSITORY)) as any

    const schemaExportUseCase = (await this.container.resolve(
      UseCaseTokens.SCHEMA_EXPORT_USE_CASE
    )) as any

    const schemaImportUseCase = (await this.container.resolve(
      UseCaseTokens.SCHEMA_IMPORT_USE_CASE
    )) as any

    const schemaResolvers = createSchemaResolvers({
      tableRepository,
      schemaExportUseCase,
      schemaImportUseCase,
      logger: {
        info: (msg: string, data?: Record<string, unknown>) =>
          console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg: string, data?: Record<string, unknown>) =>
          console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg: string, data?: Record<string, unknown>) =>
          console.error(`[ERROR] ${msg}`, data || ''),
        debug: (msg: string, data?: Record<string, unknown>) =>
          console.debug(`[DEBUG] ${msg}`, data || ''),
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
      Query: {
        _schema: () => null, // Required placeholder
        // Table queries
        table: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.table(_, args as any) || deps.tableQueries.table(_, args as any),
        tableByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.tableByIdentifier(_, args as any) ||
          deps.tableQueries.tableByIdentifier(_, args as any),
        tables: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.tables(_, args as any) || deps.tableQueries.tables(_, args as any),
        searchTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.searchTables(_, args as any) ||
          deps.tableQueries.searchTables(_, args as any),
        tableDocumentation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.tableDocumentation(_, args as any) ||
          deps.tableQueries.tableDocumentation(_, args as any),

        // Attribute type queries
        attributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.attributeType(_, args as any) ||
          deps.attributeQueries.attributeType(_, args as any),
        attributeTypeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.attributeTypeByIdentifier(_, args as any) ||
          deps.attributeQueries.attributeTypeByIdentifier(_, args as any),
        attributeTypes: (_: GraphQLParent) =>
          deps.attributeResolver?.attributeTypes(_) || deps.attributeQueries.attributeTypes(_),

        // Attribute queries
        attribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.attribute(_, args as any) ||
          deps.attributeQueries.attribute(_, args as any),
        attributeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.attributeByIdentifier(_, args as any) ||
          deps.attributeQueries.attributeByIdentifier(_, args as any),
        attributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.attributes(_, args as any) ||
          deps.attributeQueries.attributes(_, args as any),

        // Node queries
        node: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.node(_, args as any) || deps.nodeQueries.node(_, args as any),
        nodeByContent: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.nodeByContent(_, args as any) ||
          deps.nodeQueries.nodeByContent(_, args as any),
        nodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.nodes(_, args as any) || deps.nodeQueries.nodes(_, args as any),
        searchNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.searchNodes(_, args as any) ||
          deps.nodeQueries.searchNodes(_, args as any),

        // Relation queries
        relationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.relationType(_, args as any) ||
          deps.relationQueries.relationType(_, args as any),
        relationTypes: (_: GraphQLParent) =>
          deps.relationResolver?.relationTypes(_) || deps.relationQueries.relationTypes(_),
        nodeRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.nodeRelation(_, args as any) ||
          deps.relationQueries.nodeRelation(_, args as any),
        nodeRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.nodeRelations(_, args as any) ||
          deps.relationQueries.nodeRelations(_, args as any),
        searchRelatedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.searchRelatedNodes(_, args as any) ||
          deps.relationQueries.searchRelatedNodes(_, args as any),
        getDependencyChain: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.getDependencyChain(_, args as any) ||
          deps.relationQueries.getDependencyChain(_, args as any),

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
          deps.queryTemplateResolver?.getTemplate(_, args as any) ||
          deps.templateQueries.getTemplate(_, args as any),
        getTemplateByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.getTemplateByIdentifier(_, args as any) ||
          deps.templateQueries.getTemplateByIdentifier(_, args as any),
        searchTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.searchTemplates(_, args as any) ||
          deps.templateQueries.searchTemplates(_, args as any),
        getPopularTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.getPopularTemplates(_, args as any) ||
          deps.templateQueries.getPopularTemplates(_, args as any),

        // Table dependency queries
        templatesByTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.templatesByTable(_, args as any) ||
          deps.templateQueries.templatesByTable(_, args as any),
        // Template execution (delegated to mutations)
        executeTemplate: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) =>
          deps.queryTemplateResolver?.executeTemplate(_, args as any, context) ||
          deps.templateMutations.executeTemplate(_, args as any, context),

        // InputSchema validation
        validateInputSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.validateInputSchema(_, args as any),

        // Runtime data validation
        validateData: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.validateData(_, args as any),

        // Doc queries
        getDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.getDoc(_, args as any) || deps.docQueries.getDoc(_, args as any),
        getActiveDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.getActiveDoc(_, args as any) ||
          deps.docQueries.getActiveDoc(_, args as any),
        getDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.getDocs(_, args as any) || deps.docQueries.getDocs(_, args as any),
        getDocVersions: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.getDocVersions(_, args as any) ||
          deps.docQueries.getDocVersions(_, args as any),
        searchDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.searchDocs(_, args as any) ||
          deps.docQueries.searchDocs(_, args as any),

        // Essential system queries only
        healthCheck: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemQueries?.healthCheck() || null,
        systemStatus: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemResolver?.systemStatus() || null,

        // Schema export queries
        exportTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Query.exportTable(_, args as any),
        exportAllTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Query.exportAllTables(_, args as any),

        // Table Package queries
        validateTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.validateTablePackage(_, args as any),
        analyzeTableDependencies: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.analyzeTableDependencies(_, args as any),
        getImportSession: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.getImportSession(_, args as any),

        // Export queries
        getSupportedExportFormats: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.exportMutations.Query.getSupportedExportFormats(_, args as any),
        validateExportOptions: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Query.validateExportOptions(_, args as any, context),
        getExportHistory: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Query.getExportHistory(_, args as any, context),

        // JSON Export queries
        exportTableJson: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          _context: GraphQLContext,
          info: any
        ) => {
          if (!deps.jsonExportQueries) {
            throw new Error('JsonExportQueries not available')
          }
          const { JsonExportQueries, jsonExportService, logger } = deps.jsonExportQueries
          return JsonExportQueries.exportTableJson(
            _,
            args as any,
            { jsonExportService, logger },
            info
          )
        },

        // JSONL Backup queries
        inspectJsonlBackup: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.jsonlBackupQueries?.inspectJsonlBackup(_, args) || null,
      },

      Mutation: {
        _schema: () => null, // Required placeholder

        // Table mutations
        createTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.createTable(_, args as any) ||
          deps.tableMutations.createTable(_, args as any),
        updateTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.updateTable(_, args as any) ||
          deps.tableMutations.updateTable(_, args as any),
        deleteTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableResolver?.deleteTable(_, args as any) ||
          deps.tableMutations.deleteTable(_, args as any),

        // Attribute type mutations
        createAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.createAttributeType(_, args as any) ||
          deps.attributeMutations.createAttributeType(_, args as any),
        updateAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.updateAttributeType(_, args as any) ||
          deps.attributeMutations.updateAttributeType(_, args as any),
        deleteAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.deleteAttributeType(_, args as any) ||
          deps.attributeMutations.deleteAttributeType(_, args as any),

        // Attribute mutations
        createAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.createAttribute(_, args as any) ||
          deps.attributeMutations.createAttribute(_, args as any),
        updateAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.updateAttribute(_, args as any) ||
          deps.attributeMutations.updateAttribute(_, args as any),
        deleteAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeResolver?.deleteAttribute(_, args as any) ||
          deps.attributeMutations.deleteAttribute(_, args as any),

        // Node mutations
        createNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.createNode(_, args as any) ||
          deps.nodeMutations.createNode(_, args as any),
        updateNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.updateNode(_, args as any) ||
          deps.nodeMutations.updateNode(_, args as any),
        deleteNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.deleteNode(_, args as any) ||
          deps.nodeMutations.deleteNode(_, args as any),
        setNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.setNodeAttribute(_, args as any) ||
          deps.nodeMutations.setNodeAttribute(_, args as any),
        removeNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.removeNodeAttribute(_, args as any) ||
          deps.nodeMutations.removeNodeAttribute(_, args as any),
        updateNodeAttributeValue: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.updateNodeAttributeValue(_, args as any) ||
          deps.nodeMutations.updateNodeAttributeValue(_, args as any),
        createNodeWithAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.createNodeWithAttributes(_, args as any) ||
          deps.nodeMutations.createNodeWithAttributes(_, args as any),
        createPersonNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.createPersonNode(_, args as any) ||
          deps.nodeMutations.createPersonNode(_, args as any),
        setNodeAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.setNodeAttributes(_, args as any) ||
          deps.nodeMutations.setNodeAttributes(_, args as any),
        setNodeAttributesByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeResolver?.setNodeAttributesByIdentifier(_, args as any) ||
          deps.nodeMutations.setNodeAttributesByIdentifier(_, args as any),

        // Relation mutations
        createRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.createRelationType(_, args as any) ||
          deps.relationMutations.createRelationType(_, args as any),
        updateRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.updateRelationType(_, args as any) ||
          deps.relationMutations.updateRelationType(_, args as any),
        deleteRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.deleteRelationType(_, args as any) ||
          deps.relationMutations.deleteRelationType(_, args as any),
        createRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.createRelation(_, args as any) ||
          deps.relationMutations.createRelation(_, args as any),
        deleteRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationResolver?.deleteRelation(_, args as any) ||
          deps.relationMutations.deleteRelation(_, args as any),

        // Template mutations
        createTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.createTemplate(_, args as any) ||
          deps.templateMutations.createTemplate(_, args as any),
        updateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.updateTemplate(_, args as any) ||
          deps.templateMutations.updateTemplate(_, args as any),
        updateTemplateQuery: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.updateTemplateQuery(_, args as any) ||
          deps.templateMutations.updateTemplateQuery(_, args as any),
        deleteTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.deleteTemplate(_, args as any) ||
          deps.templateMutations.deleteTemplate(_, args as any),
        activateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.activateTemplate(_, args as any) ||
          deps.templateMutations.activateTemplate(_, args as any),
        deactivateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.deactivateTemplate(_, args as any) ||
          deps.templateMutations.deactivateTemplate(_, args as any),
        executeTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.queryTemplateResolver?.executeTemplate(_, args as any) ||
          deps.templateMutations.executeTemplate(_, args as any),
        executeTemplateWithGraphQL: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) =>
          deps.queryTemplateResolver?.executeTemplateWithGraphQL(_, args as any, context) ||
          deps.templateMutations.executeTemplateWithGraphQL(_, args as any, context),
        exportTemplate: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) =>
          deps.queryTemplateResolver?.exportTemplate(_, args, context) ||
          deps.templateMutations.exportTemplate(_, args, context),
        exportTemplates: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) =>
          deps.queryTemplateResolver?.exportTemplates(_, args, context) ||
          deps.templateMutations.exportTemplates(_, args, context),
        importTemplate: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) =>
          deps.queryTemplateResolver?.importTemplate(_, args, context) ||
          deps.templateMutations.importTemplate(_, args, context),

        // Doc mutations
        createDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.createDoc(_, args as any) ||
          deps.docMutations.createDoc(_, args as any),
        updateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.updateDoc(_, args as any) ||
          deps.docMutations.updateDoc(_, args as any),
        deleteDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.deleteDoc(_, args as any) ||
          deps.docMutations.deleteDoc(_, args as any),
        activateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.activateDoc(_, args as any) ||
          deps.docMutations.activateDoc(_, args as any),
        createDocVersion: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.docResolver?.createDocVersion(_, args as any) ||
          deps.docMutations.createDocVersion(_, args as any),

        // System initialization mutations
        initializeSystem: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.systemResolver?.initializeSystem(_, args as any) || null,

        // Schema import mutations
        importSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Mutation.importSchema(_, args as any),

        // Table Package mutations
        exportTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.exportTablePackage(_, args as any),
        importTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.importTablePackage(_, args as any),
        batchImportTablePackages: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tablePackageResolver.batchImportTablePackages(_, args as any),

        // Export mutations
        exportTableNodes: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Mutation.exportTableNodes(_, args as any, context),
        exportMultipleTables: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Mutation.exportMultipleTables(_, args as any, context),

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
          return deps.jsonlBackupQueries.importJsonl(_, args)
        },
      },

      Subscription: {
        ...templateSubscriptionResolvers.Subscription,
      },

      // Field resolvers
      Table: {
        attributes: (parent: GraphQLParent) =>
          deps.tableResolver?.attributes_field(parent as any) ||
          deps.tableFieldResolvers.attributes(parent as any),
        attributeTypes: (parent: GraphQLParent) =>
          deps.tableResolver?.attributeTypes_field(parent as any) ||
          deps.tableFieldResolvers.attributeTypes(parent as any),
        tableNodes: (parent: GraphQLParent) =>
          deps.tableResolver?.tableNodes_field(parent as any) ||
          deps.tableFieldResolvers.tableNodes(parent as any),
        tableNodeCount: (parent: GraphQLParent) =>
          deps.tableResolver?.tableNodeCount_field(parent as any) ||
          deps.tableFieldResolvers.tableNodeCount(parent as any),
        attributeCount: (parent: GraphQLParent) =>
          deps.tableResolver?.attributeCount_field(parent as any) ||
          deps.tableFieldResolvers.attributeCount(parent as any),
        aiMetadata: (parent: GraphQLParent) =>
          deps.tableResolver?.aiMetadata_field(parent as any) ||
          deps.tableFieldResolvers.aiMetadata(parent as any),
        mcpCommand: (parent: GraphQLParent) => deps.tableFieldResolvers.mcpCommand(parent as any),
        // Export field resolvers
        exportNodes: (
          parent: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Table.exportNodes(parent as any, args as any, context),
        exportPreview: (
          parent: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.exportMutations.Table.exportPreview(parent as any, args as any, context),
      },

      Attribute: {
        attributeType: (parent: GraphQLParent) =>
          deps.attributeResolver?.attributeType_field(parent as any) ||
          deps.attributeFieldResolvers.attributeType(parent as any),
        table: (parent: GraphQLParent) =>
          deps.attributeResolver?.table_field(parent as any) ||
          deps.attributeFieldResolvers.table(parent as any),
      },

      TableNode: {
        table: (parent: GraphQLParent) =>
          deps.nodeResolver?.table_field(parent as any) ||
          deps.nodeFieldResolvers.table(parent as any),
        attributes: (parent: GraphQLParent) =>
          deps.nodeResolver?.attributes_field(parent as any) ||
          deps.nodeFieldResolvers.attributes(parent as any),
        attributeCount: (parent: GraphQLParent) =>
          deps.nodeResolver?.attributeCount_field(parent as any) ||
          deps.nodeFieldResolvers.attributeCount(parent as any),
        outgoingRelations: (parent: GraphQLParent) =>
          deps.nodeResolver?.outgoingRelations_field(parent as any) ||
          deps.nodeFieldResolvers.outgoingRelations(parent as any),
        incomingRelations: (parent: GraphQLParent) =>
          deps.nodeResolver?.incomingRelations_field(parent as any) ||
          deps.nodeFieldResolvers.incomingRelations(parent as any),
        relationCount: (parent: GraphQLParent) =>
          deps.nodeResolver?.relationCount_field(parent as any) ||
          deps.nodeFieldResolvers.relationCount(parent as any),
        // Graph traversal field resolvers
        connectedNodes: (parent: GraphQLParent, args: any) =>
          deps.nodeResolver?.connectedNodes_field(parent as any, args) ||
          deps.nodeFieldResolvers.connectedNodes(parent as any, args),
        shortestPath: (parent: GraphQLParent, args: any) =>
          deps.nodeResolver?.shortestPath_field(parent as any, args) ||
          deps.nodeFieldResolvers.shortestPath(parent as any, args),
        neighborsByRelationType: (parent: GraphQLParent, args: any) =>
          deps.nodeResolver?.neighborsByRelationType_field(parent as any, args) ||
          deps.nodeFieldResolvers.neighborsByRelationType(parent as any, args),
      },

      NodeAttribute: {
        attribute: (parent: GraphQLParent) =>
          deps.attributeResolver?.nodeAttribute_attribute_field(parent as any) ||
          deps.attributeFieldResolvers.nodeAttribute_attribute_field(parent as any),
        formattedValue: (parent: GraphQLParent) =>
          deps.attributeResolver?.nodeAttribute_formattedValue_field(parent as any) ||
          deps.attributeFieldResolvers.nodeAttribute_formattedValue_field(parent as any),
      },

      NodeRelation: {
        table: (parent: GraphQLParent) =>
          deps.relationResolver?.table_field(parent as any) ||
          deps.relationFieldResolvers.table(parent as any),
        sourceNode: (parent: GraphQLParent) =>
          deps.relationResolver?.sourceNode_field(parent as any) ||
          deps.relationFieldResolvers.sourceNode(parent as any),
        targetNode: (parent: GraphQLParent) =>
          deps.relationResolver?.targetNode_field(parent as any) ||
          deps.relationFieldResolvers.targetNode(parent as any),
        relationType: (parent: GraphQLParent) =>
          deps.relationResolver?.relationType_field(parent as any) ||
          deps.relationFieldResolvers.relationType(parent as any),
      },

      RelationType: {
        name: (parent: GraphQLParent) =>
          deps.relationResolver?.name_field(parent as any) ||
          deps.relationTypeFieldResolvers.name(parent as any),
      },

      QueryTemplate: {
        query: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.query_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.query(parent as QueryTemplate),
        queryName: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.queryName_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.queryName(parent as QueryTemplate),
        operationType: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.operationType_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.operationType(parent as QueryTemplate),
        variables: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.variables_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.variables(parent as QueryTemplate),
        inputSchema: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.inputSchema_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.inputSchema(parent as QueryTemplate),
        defaultVariables: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.defaultVariables_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.defaultVariables(parent as QueryTemplate),
        applicableTables: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.applicableTables_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.applicableTables(parent as QueryTemplate),
        complexityScore: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.complexityScore_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.complexityScore(parent as QueryTemplate),
        usageCount: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.usageCount_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.usageCount(parent as QueryTemplate),
        lastUsedAt: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.lastUsedAt_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.lastUsedAt(parent as QueryTemplate),
        avgExecutionTimeMs: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.avgExecutionTimeMs_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.avgExecutionTimeMs(parent as QueryTemplate),
        version: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.version_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.version(parent as QueryTemplate),
        isActive: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.isActive_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.isActive(parent as QueryTemplate),
        tags: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.tags_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.tags(parent as QueryTemplate),
        createdBy: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.createdBy_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.createdBy(parent as QueryTemplate),
        createdAt: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.createdAt_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.createdAt(parent as QueryTemplate),
        updatedAt: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.updatedAt_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.updatedAt(parent as QueryTemplate),
        isValid: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.isValid_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.isValid(parent as QueryTemplate),
        validationErrors: (parent: GraphQLParent) =>
          deps.queryTemplateResolver?.validationErrors_field(parent as QueryTemplate) ||
          deps.queryTemplateFieldResolvers.validationErrors(parent as QueryTemplate),
      },

      Doc: {
        table: (parent: GraphQLParent, args: any, context: any, info: any) =>
          deps.docResolver?.table_field(parent as any, args, context, info) ||
          deps.docFieldResolvers.table(parent as any, args, context, info),
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
      super(null as any) // This is for backward compatibility only
    }

    override buildSchema(dependencies: GraphQLDependencies): GraphQLSchema {
      return super.buildSchema(dependencies)
    }
  })()

  return builder.buildSchema(deps)
}
