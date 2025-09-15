import { join } from 'node:path'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { GraphQLContext, GraphQLParent, JsonValue } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { DIContainer } from '../../infrastructure/container/DIContainer.js'
import {
  GraphQLTokens,
  RepositoryTokens,
  UseCaseTokens,
} from '../../infrastructure/container/tokens/index.js'
import type {
  AttributeFieldResolvers,
  NodeFieldResolvers,
  QueryTemplateFieldResolvers,
  RelationFieldResolvers,
  TableFieldResolvers,
} from './field-resolvers/index.js'
import type {
  AttributeMutations,
  NodeMutations,
  RelationMutations,
  TableMutations,
  TemplateMutations,
} from './mutations/index.js'
// Import resolver classes
import type {
  AttributeQueries,
  NodeQueries,
  RelationQueries,
  SystemQueries,
  TableQueries,
  TemplateQueries,
} from './queries/index.js'
import { createSchemaResolvers } from './resolvers/schema.js'
import { templateSubscriptionResolvers } from './resolvers/TemplateSubscriptionResolver.js'

export interface GraphQLDependencies {
  // Query resolvers
  tableQueries: TableQueries
  nodeQueries: NodeQueries
  attributeQueries: AttributeQueries
  relationQueries: RelationQueries
  templateQueries: TemplateQueries
  systemQueries?: SystemQueries

  // Mutation resolvers
  tableMutations: TableMutations
  nodeMutations: NodeMutations
  attributeMutations: AttributeMutations
  relationMutations: RelationMutations
  templateMutations: TemplateMutations

  // Field resolvers
  tableFieldResolvers: TableFieldResolvers
  nodeFieldResolvers: NodeFieldResolvers
  attributeFieldResolvers: AttributeFieldResolvers
  relationFieldResolvers: RelationFieldResolvers
  queryTemplateFieldResolvers: QueryTemplateFieldResolvers

  // Schema resolvers
  schemaResolvers: ReturnType<typeof createSchemaResolvers>
}

export class GraphQLSchemaBuilder {
  constructor(private container: DIContainer) {}

  async build(): Promise<GraphQLSchema> {
    const deps = await this.resolveDependencies()
    return this.buildSchema(deps)
  }

  private async resolveDependencies(): Promise<GraphQLDependencies> {
    return {
      // Query resolvers
      tableQueries: await this.container.resolve(GraphQLTokens.TABLE_QUERIES),
      nodeQueries: await this.container.resolve(GraphQLTokens.NODE_QUERIES),
      attributeQueries: await this.container.resolve(GraphQLTokens.ATTRIBUTE_QUERIES),
      relationQueries: await this.container.resolve(GraphQLTokens.RELATION_QUERIES),
      templateQueries: await this.container.resolve(GraphQLTokens.TEMPLATE_QUERIES),
      systemQueries: await this.container.resolve(GraphQLTokens.SYSTEM_QUERIES),

      // Mutation resolvers
      tableMutations: await this.container.resolve(GraphQLTokens.TABLE_MUTATIONS),
      nodeMutations: await this.container.resolve(GraphQLTokens.NODE_MUTATIONS),
      attributeMutations: await this.container.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS),
      relationMutations: await this.container.resolve(GraphQLTokens.RELATION_MUTATIONS),
      templateMutations: await this.container.resolve(GraphQLTokens.TEMPLATE_MUTATIONS),

      // Field resolvers
      tableFieldResolvers: await this.container.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS),
      nodeFieldResolvers: await this.container.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS),
      attributeFieldResolvers: await this.container.resolve(
        GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS
      ),
      relationFieldResolvers: await this.container.resolve(GraphQLTokens.RELATION_FIELD_RESOLVERS),
      queryTemplateFieldResolvers: await this.container.resolve(
        GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS
      ),

      // Schema resolvers
      schemaResolvers: createSchemaResolvers({
        tableRepository: await this.container.resolve(RepositoryTokens.TABLE_REPOSITORY),
        schemaExportUseCase: await this.container.resolve(UseCaseTokens.SCHEMA_EXPORT_USE_CASE),
        schemaImportUseCase: await this.container.resolve(UseCaseTokens.SCHEMA_IMPORT_USE_CASE),
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
      }),
    }
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
        // Health check
        health: () => ({
          status: 'OK',
          timestamp: new Date(),
          database: true,
          version: '1.0.0',
        }),

        // Table queries
        table: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableQueries.table(_, args as any),
        tableByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableQueries.tableByIdentifier(_, args as any),
        tables: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableQueries.tables(_, args as any),

        // Attribute type queries
        attributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeQueries.attributeType(_, args as any),
        attributeTypeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeQueries.attributeTypeByIdentifier(_, args as any),
        attributeTypes: (_: GraphQLParent) => deps.attributeQueries.attributeTypes(_),

        // Attribute queries
        attribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeQueries.attribute(_, args as any),
        attributeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeQueries.attributeByIdentifier(_, args as any),
        attributes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeQueries.attributes(_, args as any),

        // Node queries
        node: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeQueries.node(_, args as any),
        nodeByContent: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeQueries.nodeByContent(_, args as any),
        nodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeQueries.nodes(_, args as any),
        searchNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeQueries.searchNodes(_, args as any),

        // Relation queries
        relationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.relationType(_, args as any),
        relationTypes: (_: GraphQLParent) => deps.relationQueries.relationTypes(_),
        nodeRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.nodeRelation(_, args as any),
        nodeRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.nodeRelations(_, args as any),
        searchRelatedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.searchRelatedNodes(_, args as any),
        getDependencyChain: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationQueries.getDependencyChain(_, args as any),

        // Template queries
        getTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.getTemplate(_, args as any),
        getTemplateByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.getTemplateByIdentifier(_, args as any),
        searchTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.searchTemplates(_, args as any),
        getPopularTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateQueries.getPopularTemplates(_, args as any),

        // System monitoring queries
        systemStats: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemQueries?.systemStats() || null,
        memoryStats: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemQueries?.memoryStats() || null,
        healthCheck: (_: GraphQLParent, _args: Record<string, unknown>) =>
          deps.systemQueries?.healthCheck() || null,

        // Schema export queries
        exportTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Query.exportTable(_, args as any),
        exportAllTables: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Query.exportAllTables(_, args as any),
      },

      Mutation: {
        _empty: () => null,

        // Table mutations
        createTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableMutations.createTable(_, args as any),
        updateTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableMutations.updateTable(_, args as any),
        deleteTable: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.tableMutations.deleteTable(_, args as any),

        // Attribute type mutations
        createAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.createAttributeType(_, args as any),
        updateAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.updateAttributeType(_, args as any),
        deleteAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.deleteAttributeType(_, args as any),

        // Attribute mutations
        createAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.createAttribute(_, args as any),
        updateAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.updateAttribute(_, args as any),
        deleteAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.attributeMutations.deleteAttribute(_, args as any),

        // Node mutations
        createNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeMutations.createNode(_, args as any),
        updateNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeMutations.updateNode(_, args as any),
        deleteNode: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeMutations.deleteNode(_, args as any),
        setNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.nodeMutations.setNodeAttribute(_, args as any),

        // Relation mutations
        createRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationMutations.createRelationType(_, args as any),
        createRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationMutations.createRelation(_, args as any),
        deleteRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.relationMutations.deleteRelation(_, args as any),

        // Template mutations
        createTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.createTemplate(_, args as any),
        updateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.updateTemplate(_, args as any),
        updateTemplateQuery: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.updateTemplateQuery(_, args as any),
        deleteTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.deleteTemplate(_, args as any),
        activateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.activateTemplate(_, args as any),
        deactivateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.templateMutations.deactivateTemplate(_, args as any),
        executeTemplateWithGraphQL: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.templateMutations.executeTemplateWithGraphQL(_, args as any, context),
        exportTemplate: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.templateMutations.exportTemplate(_, args, context),
        importTemplate: (
          _: GraphQLParent,
          args: Record<string, unknown>,
          context: GraphQLContext
        ) => deps.templateMutations.importTemplate(_, args, context),

        // Schema import mutations
        importSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
          deps.schemaResolvers.Mutation.importSchema(_, args as any),
      },

      Subscription: {
        ...templateSubscriptionResolvers.Subscription,
      },

      // Field resolvers
      Table: {
        attributes: (parent: GraphQLParent) => deps.tableFieldResolvers.attributes(parent as any),
        attributeTypes: (parent: GraphQLParent) =>
          deps.tableFieldResolvers.attributeTypes(parent as any),
        tableNodes: (parent: GraphQLParent) => deps.tableFieldResolvers.tableNodes(parent as any),
        tableNodeCount: (parent: GraphQLParent) =>
          deps.tableFieldResolvers.tableNodeCount(parent as any),
        attributeCount: (parent: GraphQLParent) =>
          deps.tableFieldResolvers.attributeCount(parent as any),
      },

      Attribute: {
        attributeType: (parent: GraphQLParent) =>
          deps.attributeFieldResolvers.attributeType(parent as any),
        table: (parent: GraphQLParent) => deps.attributeFieldResolvers.table(parent as any),
      },

      TableNode: {
        table: (parent: GraphQLParent) => deps.nodeFieldResolvers.table(parent as any),
        attributes: (parent: GraphQLParent) => deps.nodeFieldResolvers.attributes(parent as any),
        attributeCount: (parent: GraphQLParent) =>
          deps.nodeFieldResolvers.attributeCount(parent as any),
        outgoingRelations: (parent: GraphQLParent) =>
          deps.nodeFieldResolvers.outgoingRelations(parent as any),
        incomingRelations: (parent: GraphQLParent) =>
          deps.nodeFieldResolvers.incomingRelations(parent as any),
        relationCount: (parent: GraphQLParent) =>
          deps.nodeFieldResolvers.relationCount(parent as any),
      },

      NodeAttribute: {
        attribute: (parent: GraphQLParent) => deps.attributeFieldResolvers.attribute(parent as any),
      },

      NodeRelation: {
        table: (parent: GraphQLParent) => deps.relationFieldResolvers.table(parent as any),
        sourceNode: (parent: GraphQLParent) =>
          deps.relationFieldResolvers.sourceNode(parent as any),
        targetNode: (parent: GraphQLParent) =>
          deps.relationFieldResolvers.targetNode(parent as any),
        relationType: (parent: GraphQLParent) =>
          deps.relationFieldResolvers.relationType(parent as any),
      },

      QueryTemplate: {
        query: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.query(parent as QueryTemplate),
        queryName: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.queryName(parent as QueryTemplate),
        operationType: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.operationType(parent as QueryTemplate),
        variables: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.variables(parent as QueryTemplate),
        variablesSchema: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.variablesSchema(parent as QueryTemplate),
        defaultVariables: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.defaultVariables(parent as QueryTemplate),
        applicableTables: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.applicableTables(parent as QueryTemplate),
        complexityScore: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.complexityScore(parent as QueryTemplate),
        usageCount: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.usageCount(parent as QueryTemplate),
        lastUsedAt: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.lastUsedAt(parent as QueryTemplate),
        avgExecutionTimeMs: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.avgExecutionTimeMs(parent as QueryTemplate),
        version: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.version(parent as QueryTemplate),
        isActive: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.isActive(parent as QueryTemplate),
        tags: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.tags(parent as QueryTemplate),
        createdBy: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.createdBy(parent as QueryTemplate),
        createdAt: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.createdAt(parent as QueryTemplate),
        updatedAt: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.updatedAt(parent as QueryTemplate),
        isValid: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.isValid(parent as QueryTemplate),
        validationErrors: (parent: GraphQLParent) =>
          deps.queryTemplateFieldResolvers.validationErrors(parent as QueryTemplate),
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
