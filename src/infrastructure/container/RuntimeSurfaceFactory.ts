import { TableSchemaLifecycleAspect } from '@/application/aspects/TableSchemaLifecycleAspect.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExternalResourceAccessResolver } from '@/application/security/AccessControl.js'
import { AiMemoryService } from '@/application/services/AiMemoryService.js'
import { GraphHierarchyService } from '@/application/services/GraphHierarchyService.js'
import { InformationArchitectureService } from '@/application/services/InformationArchitectureService.js'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import type { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { EmbedNodesUseCase } from '@/application/use-cases/nodes/EmbedNodes.js'
import type { HybridSearchNodesUseCase } from '@/application/use-cases/nodes/HybridSearchNodes.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
import type { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import type { IEmbeddingProvider } from '@/domain/ports/IEmbeddingProvider.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { McpHttpServer } from '@/mcp/http-server/McpHttpServer.js'
import type { FetchLike } from '@/models/GraphQLOperation.js'
import type { HttpExecutionHooks } from '@/presentation/http/aspects/HttpExecutionPipeline.js'
import { AttributeApiController } from '@/presentation/http/controllers/AttributeApiController.js'
import { GraphApiController } from '@/presentation/http/controllers/GraphApiController.js'
import { GraphDbApiController } from '@/presentation/http/controllers/GraphDbApiController.js'
import { McpToolController } from '@/presentation/http/controllers/McpToolController.js'
import { type BunApiRouter, createBunApiRouter } from '@/presentation/http/routes/BunApiRouter.js'
import { createTableMcpMiddleware } from '@/presentation/mcp/routes/mcp-routes.js'
import type { DIContainer } from './DIContainer.js'
import { CommonTokens, RepositoryTokens, UseCaseTokens } from './tokens/index.js'

export interface GraphDbRuntimeSurfaceOptions {
  graphqlEndpointUrl: string
  restApiBaseUrl: string
  port: number
  inProcessFetch: FetchLike
  internalBridgeToken?: string
  embeddingProvider?: IEmbeddingProvider
  httpHooks?: HttpExecutionHooks
}

export interface GraphDbRuntimeSurface {
  logger: ILogger
  tableRepository: ITableRepository
  nodeRepository: INodeRepository
  nodeRelationRepository: INodeRelationRepository
  schemaLifecycle: TableSchemaLifecycleAspect
  graphDbController: GraphDbApiController
  attributeController: AttributeApiController
  graphController: GraphApiController
  mcpToolController: McpToolController
  hierarchyService: GraphHierarchyService
  embedNodesUseCase?: EmbedNodesUseCase
  iaService: InformationArchitectureService
  aiMemoryService: AiMemoryService
  apiRouter: BunApiRouter
  mcpServer: McpHttpServer
  tableMcpMiddleware: ReturnType<typeof createTableMcpMiddleware>
  resourceAccessResolver: ExternalResourceAccessResolver
  dispose(): Promise<void>
}

/**
 * Unified composition root (SSOT) for all runtime surfaces (REST router,
 * HTTP controllers, IA/Memory services, root MCP & table MCP middleware, and
 * resource ownership resolver) shared identically across standalone `index.ts`,
 * Node/Worker `PortableBootstrap`, and Web Embedded deployments.
 */
export async function createGraphDbRuntimeSurface(
  container: DIContainer,
  options: GraphDbRuntimeSurfaceOptions,
): Promise<GraphDbRuntimeSurface> {
  const [
    logger,
    createTableUseCase,
    createAttributeUseCase,
    createNodeUseCase,
    updateNodeUseCase,
    createRelationUseCase,
    createDocUseCase,
    executeTemplateWithGraphQLUseCase,
    attributeTypeRepository,
    attributeRepository,
    docRepository,
    tableSchemaProjectionService,
    nodeAttributeSchemaGate,
    nodeAttributeRepository,
    getTableDocsUseCase,
    searchNodesUseCase,
    searchRelatedNodesUseCase,
    tableRepository,
    nodeRelationRepository,
    relationTypeRepository,
    queryTemplateRepository,
    nodeEmbeddingRepository,
    hybridSearchNodesUseCase,
    nodeRepository,
    resolvedLifecycle,
  ] = await Promise.all([
    container.resolve<ILogger>(CommonTokens.LOGGER),
    container.resolve<CreateTableUseCase>(UseCaseTokens.CREATE_TABLE_USE_CASE),
    container.resolve<CreateAttributeUseCase>(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE),
    container.resolve<CreateNodeUseCase>(UseCaseTokens.CREATE_NODE_USE_CASE),
    container.resolve<UpdateNodeUseCase>(UseCaseTokens.UPDATE_NODE_USE_CASE),
    container.resolve<CreateRelationUseCase>(UseCaseTokens.CREATE_RELATION_USE_CASE),
    container.resolve<CreateDocUseCase>(UseCaseTokens.CREATE_DOC_USE_CASE),
    container.resolve<ExecuteTemplateWithGraphQLUseCase>(
      UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE,
    ),
    container.resolve<IAttributeTypeRepository>(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY),
    container.resolve<IAttributeRepository>(RepositoryTokens.ATTRIBUTE_REPOSITORY),
    container.resolve<IDocRepository>(RepositoryTokens.DOC_REPOSITORY),
    container.resolve<TableSchemaProjectionService>(CommonTokens.TABLE_SCHEMA_PROJECTION_SERVICE),
    container.resolve<NodeAttributeSchemaGate>(CommonTokens.NODE_ATTRIBUTE_SCHEMA_GATE),
    container.resolve<INodeAttributeRepository>(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY),
    container.resolve<GetTableDocsUseCase>(UseCaseTokens.GET_TABLE_DOCS_USE_CASE),
    container.resolve<SearchNodesUseCase>(UseCaseTokens.SEARCH_NODES_USE_CASE),
    container.resolve<SearchRelatedNodesUseCase>(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE),
    container.resolve<ITableRepository>(RepositoryTokens.TABLE_REPOSITORY),
    container.resolve<INodeRelationRepository>(RepositoryTokens.NODE_RELATION_REPOSITORY),
    container.resolve<IRelationTypeRepository>(RepositoryTokens.RELATION_TYPE_REPOSITORY),
    container.resolve<IQueryTemplateRepository>(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY),
    container.resolve<INodeEmbeddingRepository>(RepositoryTokens.NODE_EMBEDDING_REPOSITORY),
    container.resolve<HybridSearchNodesUseCase>(UseCaseTokens.HYBRID_SEARCH_NODES_USE_CASE),
    container.resolve<INodeRepository>(RepositoryTokens.NODE_REPOSITORY),
    container
      .resolve<TableSchemaLifecycleAspect>(CommonTokens.TABLE_SCHEMA_LIFECYCLE_ASPECT)
      .catch(() => undefined),
  ])

  const schemaLifecycle =
    resolvedLifecycle ??
    new TableSchemaLifecycleAspect({
      logger,
      attributeRepository,
      attributeTypeRepository,
      queryTemplateRepository,
    })

  const graphDbController = new GraphDbApiController(
    logger,
    createTableUseCase,
    createNodeUseCase,
    updateNodeUseCase,
    searchNodesUseCase,
    createRelationUseCase,
    tableRepository,
    relationTypeRepository,
    queryTemplateRepository,
    executeTemplateWithGraphQLUseCase,
    nodeRepository,
    nodeAttributeRepository,
    attributeRepository,
    nodeRelationRepository,
    schemaLifecycle,
  )
  const attributeController = new AttributeApiController(
    createAttributeUseCase,
    attributeRepository,
    nodeAttributeRepository,
    logger,
    queryTemplateRepository,
    nodeAttributeSchemaGate,
    tableRepository,
    schemaLifecycle,
  )
  const graphController = new GraphApiController(
    logger,
    getTableDocsUseCase,
    searchNodesUseCase,
    searchRelatedNodesUseCase,
    tableRepository,
    nodeRelationRepository,
    options.port,
    tableSchemaProjectionService,
    options.inProcessFetch,
    options.internalBridgeToken,
    nodeAttributeSchemaGate,
    nodeEmbeddingRepository,
    hybridSearchNodesUseCase,
    nodeRepository,
    relationTypeRepository,
  )
  const mcpToolController = new McpToolController(
    logger,
    options.port,
    options.inProcessFetch,
    options.internalBridgeToken,
  )

  const hierarchyService = new GraphHierarchyService(
    nodeRepository,
    nodeRelationRepository,
    relationTypeRepository,
    tableRepository,
  )
  const embedNodesUseCase = options.embeddingProvider
    ? new EmbedNodesUseCase(
        options.embeddingProvider,
        nodeRepository,
        nodeEmbeddingRepository,
        attributeRepository,
        nodeAttributeRepository,
        logger,
      )
    : undefined

  const iaDeps = {
    tableRepository,
    attributeTypeRepository,
    attributeRepository,
    nodeRepository,
    nodeAttributeRepository,
    nodeRelationRepository,
    relationTypeRepository,
    nodeEmbeddingRepository,
    docRepository,
    createTableUseCase,
    createAttributeUseCase,
    createNodeUseCase,
    updateNodeUseCase,
    createRelationUseCase,
    createDocUseCase,
    hybridSearchNodesUseCase,
    hierarchyService,
    schemaGate: nodeAttributeSchemaGate,
    schemaLifecycle,
    embedNodesUseCase,
    logger,
  }
  const iaService = new InformationArchitectureService(iaDeps)
  const aiMemoryService = new AiMemoryService(iaDeps)

  const apiRouter = createBunApiRouter({
    logger,
    graphDbController,
    attributeController,
    graphController,
    mcpToolController,
    hooks: options.httpHooks,
  })

  const mcpServer = new McpHttpServer(
    options.graphqlEndpointUrl,
    options.restApiBaseUrl,
    options.internalBridgeToken,
    options.inProcessFetch,
    aiMemoryService,
    iaService,
  )
  await mcpServer.initialize()

  const tableMcpMiddleware = createTableMcpMiddleware({
    graphqlEndpoint: options.graphqlEndpointUrl,
    restApiBaseUrl: options.restApiBaseUrl,
    logger,
    projectionService: tableSchemaProjectionService,
    internalBridgeToken: options.internalBridgeToken,
    fetchImpl: options.inProcessFetch,
  })

  const resourceAccessResolver: ExternalResourceAccessResolver = {
    resolveNodeTableId: async (nodeId) => {
      const node = await nodeRepository.findById(nodeId)
      return node ? String(node.getTableId()) : undefined
    },
    resolveRelationTableId: async (relationId) => {
      const relation = await nodeRelationRepository.findById(relationId)
      return relation ? String(relation.getTableId()) : undefined
    },
    resolveTableIdentity: async (tableIdOrIdentifier) => {
      const table =
        (await tableRepository.findById(tableIdOrIdentifier)) ??
        (await tableRepository.findByIdentifier(tableIdOrIdentifier))
      return table ? { id: String(table.id), identifier: table.identifier } : undefined
    },
  }

  return {
    logger,
    tableRepository,
    nodeRepository,
    nodeRelationRepository,
    schemaLifecycle,
    graphDbController,
    attributeController,
    graphController,
    mcpToolController,
    hierarchyService,
    embedNodesUseCase,
    iaService,
    aiMemoryService,
    apiRouter,
    mcpServer,
    tableMcpMiddleware,
    resourceAccessResolver,
    async dispose(): Promise<void> {
      await Promise.all([mcpServer.close(), tableMcpMiddleware.close()])
    },
  }
}
