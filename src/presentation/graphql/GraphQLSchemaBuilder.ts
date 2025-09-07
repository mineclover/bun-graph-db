import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import { join } from 'path'
import type { DIContainer } from '../../infrastructure/container/DIContainer.js'
import {
  CommonTokens,
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
      queryTemplateFieldResolvers: await this.container.resolve(GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS),

      // Schema resolvers
      schemaResolvers: createSchemaResolvers({
        tableRepository: await this.container.resolve(RepositoryTokens.TABLE_REPOSITORY),
        schemaExportUseCase: await this.container.resolve(UseCaseTokens.SCHEMA_EXPORT_USE_CASE),
        schemaImportUseCase: await this.container.resolve(UseCaseTokens.SCHEMA_IMPORT_USE_CASE),
        logger: {
          info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
          warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
          error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
          debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data || ''),
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
        table: (_: any, args: any) => deps.tableQueries.table(_, args),
        tableByIdentifier: (_: any, args: any) => deps.tableQueries.tableByIdentifier(_, args),
        tables: (_: any, args: any) => deps.tableQueries.tables(_, args),

        // Attribute type queries
        attributeType: (_: any, args: any) => deps.attributeQueries.attributeType(_, args),
        attributeTypeByIdentifier: (_: any, args: any) =>
          deps.attributeQueries.attributeTypeByIdentifier(_, args),
        attributeTypes: (_: any) => deps.attributeQueries.attributeTypes(_),

        // Attribute queries
        attribute: (_: any, args: any) => deps.attributeQueries.attribute(_, args),
        attributeByIdentifier: (_: any, args: any) =>
          deps.attributeQueries.attributeByIdentifier(_, args),
        attributes: (_: any, args: any) => deps.attributeQueries.attributes(_, args),

        // Node queries
        node: (_: any, args: any) => deps.nodeQueries.node(_, args),
        nodeByContent: (_: any, args: any) => deps.nodeQueries.nodeByContent(_, args),
        nodes: (_: any, args: any) => deps.nodeQueries.nodes(_, args),
        searchNodes: (_: any, args: any) => deps.nodeQueries.searchNodes(_, args),

        // Relation queries
        relationType: (_: any, args: any) => deps.relationQueries.relationType(_, args),
        relationTypes: (_: any) => deps.relationQueries.relationTypes(_),
        nodeRelation: (_: any, args: any) => deps.relationQueries.nodeRelation(_, args),
        nodeRelations: (_: any, args: any) => deps.relationQueries.nodeRelations(_, args),
        searchRelatedNodes: (_: any, args: any) => deps.relationQueries.searchRelatedNodes(_, args),
        getDependencyChain: (_: any, args: any) => deps.relationQueries.getDependencyChain(_, args),

        // Template queries
        getTemplate: (_: any, args: any) => deps.templateQueries.getTemplate(_, args),
        getTemplateByIdentifier: (_: any, args: any) =>
          deps.templateQueries.getTemplateByIdentifier(_, args),
        searchTemplates: (_: any, args: any) => deps.templateQueries.searchTemplates(_, args),
        getPopularTemplates: (_: any, args: any) =>
          deps.templateQueries.getPopularTemplates(_, args),

        // Schema export queries
        exportTable: (_: any, args: any) => deps.schemaResolvers.Query.exportTable(_, args),
        exportAllTables: (_: any, args: any) => deps.schemaResolvers.Query.exportAllTables(_, args),
      },

      Mutation: {
        _empty: () => null,

        // Table mutations
        createTable: (_: any, args: any) => deps.tableMutations.createTable(_, args),
        updateTable: (_: any, args: any) => deps.tableMutations.updateTable(_, args),
        deleteTable: (_: any, args: any) => deps.tableMutations.deleteTable(_, args),

        // Attribute type mutations
        createAttributeType: (_: any, args: any) =>
          deps.attributeMutations.createAttributeType(_, args),
        updateAttributeType: (_: any, args: any) =>
          deps.attributeMutations.updateAttributeType(_, args),
        deleteAttributeType: (_: any, args: any) =>
          deps.attributeMutations.deleteAttributeType(_, args),

        // Attribute mutations
        createAttribute: (_: any, args: any) => deps.attributeMutations.createAttribute(_, args),
        updateAttribute: (_: any, args: any) => deps.attributeMutations.updateAttribute(_, args),
        deleteAttribute: (_: any, args: any) => deps.attributeMutations.deleteAttribute(_, args),

        // Node mutations
        createNode: (_: any, args: any) => deps.nodeMutations.createNode(_, args),
        updateNode: (_: any, args: any) => deps.nodeMutations.updateNode(_, args),
        deleteNode: (_: any, args: any) => deps.nodeMutations.deleteNode(_, args),
        setNodeAttribute: (_: any, args: any) => deps.nodeMutations.setNodeAttribute(_, args),

        // Relation mutations
        createRelationType: (_: any, args: any) =>
          deps.relationMutations.createRelationType(_, args),
        createRelation: (_: any, args: any) => deps.relationMutations.createRelation(_, args),
        deleteRelation: (_: any, args: any) => deps.relationMutations.deleteRelation(_, args),

        // Template mutations
        createTemplate: (_: any, args: any) => deps.templateMutations.createTemplate(_, args),
        updateTemplate: (_: any, args: any) => deps.templateMutations.updateTemplate(_, args),
        updateTemplateQuery: (_: any, args: any) => deps.templateMutations.updateTemplateQuery(_, args),
        deleteTemplate: (_: any, args: any) => deps.templateMutations.deleteTemplate(_, args),
        activateTemplate: (_: any, args: any) => deps.templateMutations.activateTemplate(_, args),
        deactivateTemplate: (_: any, args: any) =>
          deps.templateMutations.deactivateTemplate(_, args),
        executeTemplateWithGraphQL: (_: any, args: any, context: any) =>
          deps.templateMutations.executeTemplateWithGraphQL(_, args, context),
        exportTemplate: (_: any, args: any, context: any) =>
          deps.templateMutations.exportTemplate(_, args, context),
        importTemplate: (_: any, args: any, context: any) =>
          deps.templateMutations.importTemplate(_, args, context),

        // Schema import mutations
        importSchema: (_: any, args: any) => deps.schemaResolvers.Mutation.importSchema(_, args),
      },

      Subscription: {
        ...templateSubscriptionResolvers.Subscription,
      },

      // Field resolvers
      Table: {
        attributes: (parent: any) => deps.tableFieldResolvers.attributes(parent),
        tableNodes: (parent: any) => deps.tableFieldResolvers.tableNodes(parent),
        tableNodeCount: (parent: any) => deps.tableFieldResolvers.tableNodeCount(parent),
        attributeCount: (parent: any) => deps.tableFieldResolvers.attributeCount(parent),
      },

      Attribute: {
        attributeType: (parent: any) => deps.attributeFieldResolvers.attributeType(parent),
        table: (parent: any) => deps.attributeFieldResolvers.table(parent),
      },

      TableNode: {
        table: (parent: any) => deps.nodeFieldResolvers.table(parent),
        attributes: (parent: any) => deps.nodeFieldResolvers.attributes(parent),
        attributeCount: (parent: any) => deps.nodeFieldResolvers.attributeCount(parent),
        outgoingRelations: (parent: any) => deps.nodeFieldResolvers.outgoingRelations(parent),
        incomingRelations: (parent: any) => deps.nodeFieldResolvers.incomingRelations(parent),
        relationCount: (parent: any) => deps.nodeFieldResolvers.relationCount(parent),
      },

      NodeAttribute: {
        attribute: (parent: any) => deps.attributeFieldResolvers.attribute(parent),
      },

      NodeRelation: {
        table: (parent: any) => deps.relationFieldResolvers.table(parent),
        sourceNode: (parent: any) => deps.relationFieldResolvers.sourceNode(parent),
        targetNode: (parent: any) => deps.relationFieldResolvers.targetNode(parent),
        relationType: (parent: any) => deps.relationFieldResolvers.relationType(parent),
      },

      QueryTemplate: {
        query: (parent: any) => deps.queryTemplateFieldResolvers.query(parent),
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
