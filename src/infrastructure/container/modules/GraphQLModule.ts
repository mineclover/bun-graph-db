import type { DIContainer } from '../DIContainer.js'
import { GraphQLTokens, RepositoryTokens, UseCaseTokens, CommonTokens } from '../tokens/index.js'
import { 
  TableQueries, 
  NodeQueries, 
  AttributeQueries, 
  RelationQueries, 
  TemplateQueries 
} from '@/presentation/graphql/queries/index.js'
import { 
  TableMutations, 
  NodeMutations, 
  AttributeMutations, 
  RelationMutations, 
  TemplateMutations 
} from '@/presentation/graphql/mutations/index.js'
import { 
  TableFieldResolvers, 
  NodeFieldResolvers, 
  AttributeFieldResolvers, 
  RelationFieldResolvers 
} from '@/presentation/graphql/field-resolvers/index.js'
import { buildGraphQLSchema } from '@/presentation/graphql/GraphQLSchemaBuilder.js'

/**
 * GraphQL module - registers GraphQL resolvers and schema
 */
export function registerGraphQLModule(container: DIContainer): void {
  // Query resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_QUERIES,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const createTableUseCase = await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new TableQueries(tableRepository, createTableUseCase, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, UseCaseTokens.CREATE_TABLE_USE_CASE, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_QUERIES,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const searchNodesUseCase = await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new NodeQueries(nodeRepository, searchNodesUseCase, logger)
    },
    [RepositoryTokens.NODE_REPOSITORY, UseCaseTokens.SEARCH_NODES_USE_CASE, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new AttributeQueries(attributeRepository, attributeTypeRepository, logger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_QUERIES,
    async (c) => {
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)
      const searchRelatedNodesUseCase = await c.resolve(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new RelationQueries(nodeRelationRepository, relationTypeRepository, searchRelatedNodesUseCase, logger)
    },
    [RepositoryTokens.NODE_RELATION_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY, UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE, CommonTokens.LOGGER]
  )


  container.registerSingleton(
    GraphQLTokens.TEMPLATE_QUERIES,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY)
      const executeQueryTemplateUseCase = await c.resolve(UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new TemplateQueries(queryTemplateRepository, executeQueryTemplateUseCase, logger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY, UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE, CommonTokens.LOGGER]
  )

  // Mutation resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_MUTATIONS,
    async (c) => {
      const createTableUseCase = await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE)
      const deleteTableUseCase = await c.resolve(UseCaseTokens.DELETE_TABLE_USE_CASE)
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new TableMutations(createTableUseCase, deleteTableUseCase, tableRepository, logger)
    },
    [UseCaseTokens.CREATE_TABLE_USE_CASE, UseCaseTokens.DELETE_TABLE_USE_CASE, RepositoryTokens.TABLE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_MUTATIONS,
    async (c) => {
      const createNodeUseCase = await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new NodeMutations(createNodeUseCase, nodeRepository, nodeAttributeRepository, logger)
    },
    [UseCaseTokens.CREATE_NODE_USE_CASE, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_MUTATIONS,
    async (c) => {
      const createAttributeTypeUseCase = await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE)
      const createAttributeUseCase = await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE)
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new AttributeMutations(createAttributeTypeUseCase, createAttributeUseCase, attributeTypeRepository, attributeRepository, logger)
    },
    [UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE, UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_MUTATIONS,
    async (c) => {
      const createRelationUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE)
      const createRelationTypeUseCase = await c.resolve(UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE)
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new RelationMutations(createRelationUseCase, createRelationTypeUseCase, nodeRelationRepository, logger)
    },
    [UseCaseTokens.CREATE_RELATION_USE_CASE, UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE, RepositoryTokens.NODE_RELATION_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_MUTATIONS,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY)
      const executeQueryTemplateUseCase = await c.resolve(UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new TemplateMutations(queryTemplateRepository, executeQueryTemplateUseCase, logger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY, UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE, CommonTokens.LOGGER]
  )

  // Field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_FIELD_RESOLVERS,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new TableFieldResolvers(attributeRepository, nodeRepository, logger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.NODE_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new NodeFieldResolvers(tableRepository, nodeAttributeRepository, nodeRelationRepository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY, RepositoryTokens.NODE_RELATION_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
    async (c) => {
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new AttributeFieldResolvers(attributeTypeRepository, attributeRepository, tableRepository, logger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new RelationFieldResolvers(tableRepository, nodeRepository, relationTypeRepository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY, CommonTokens.LOGGER]
  )

  // GraphQL Schema
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA,
    async (c) => {
      // Get all the resolver dependencies
      const tableQueries = await c.resolve(GraphQLTokens.TABLE_QUERIES)
      const nodeQueries = await c.resolve(GraphQLTokens.NODE_QUERIES)
      const attributeQueries = await c.resolve(GraphQLTokens.ATTRIBUTE_QUERIES)
      const relationQueries = await c.resolve(GraphQLTokens.RELATION_QUERIES)
      const analyticsQueries = await c.resolve(GraphQLTokens.ANALYTICS_QUERIES)
      const templateQueries = await c.resolve(GraphQLTokens.TEMPLATE_QUERIES)
      
      const tableMutations = await c.resolve(GraphQLTokens.TABLE_MUTATIONS)
      const nodeMutations = await c.resolve(GraphQLTokens.NODE_MUTATIONS)
      const attributeMutations = await c.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS)
      const relationMutations = await c.resolve(GraphQLTokens.RELATION_MUTATIONS)
      const templateMutations = await c.resolve(GraphQLTokens.TEMPLATE_MUTATIONS)
      
      const tableFieldResolvers = await c.resolve(GraphQLTokens.TABLE_FIELD_RESOLVERS)
      const nodeFieldResolvers = await c.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS)
      const attributeFieldResolvers = await c.resolve(GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS)
      const relationFieldResolvers = await c.resolve(GraphQLTokens.RELATION_FIELD_RESOLVERS)

      return buildGraphQLSchema({
        // Queries
        tableQueries,
        nodeQueries,
        attributeQueries,
        relationQueries,
        analyticsQueries,
        templateQueries,
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
        relationFieldResolvers
      })
    },
    [
      // All the resolver dependencies
      GraphQLTokens.TABLE_QUERIES,
      GraphQLTokens.NODE_QUERIES,
      GraphQLTokens.ATTRIBUTE_QUERIES,
      GraphQLTokens.RELATION_QUERIES,
      GraphQLTokens.ANALYTICS_QUERIES,
      GraphQLTokens.TEMPLATE_QUERIES,
      GraphQLTokens.TABLE_MUTATIONS,
      GraphQLTokens.NODE_MUTATIONS,
      GraphQLTokens.ATTRIBUTE_MUTATIONS,
      GraphQLTokens.RELATION_MUTATIONS,
      GraphQLTokens.TEMPLATE_MUTATIONS,
      GraphQLTokens.TABLE_FIELD_RESOLVERS,
      GraphQLTokens.NODE_FIELD_RESOLVERS,
      GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
      GraphQLTokens.RELATION_FIELD_RESOLVERS
    ]
  )
}