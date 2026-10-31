import type { DefinitionNode, DocumentNode, ExecutionResult, OperationDefinitionNode } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { randomUUID } from 'node:crypto'
import type { ILogger } from './src/application/ports/ILogger'
import { AccessControl, authorizeExternalRequest } from './src/application/security/AccessControl'
import type { CreateAttributeUseCase } from './src/application/use-cases/attributes/CreateAttribute'
import type { CreateNodeUseCase } from './src/application/use-cases/nodes/CreateNode'
import type { HybridSearchNodesUseCase } from './src/application/use-cases/nodes/HybridSearchNodes'
import type { SearchNodesUseCase } from './src/application/use-cases/nodes/SearchNodes'
import type { UpdateNodeUseCase } from './src/application/use-cases/nodes/UpdateNode'
import type { ExecuteTemplateWithGraphQLUseCase } from './src/application/use-cases/query-templates/ExecuteTemplateWithGraphQL'
import type { CreateRelationUseCase } from './src/application/use-cases/relations/CreateRelation'
import type { SearchRelatedNodesUseCase } from './src/application/use-cases/relations/SearchRelatedNodes'
import type { CreateTableUseCase } from './src/application/use-cases/tables/CreateTable'
import type { GetTableDocsUseCase } from './src/application/use-cases/tables/GetTableDocs'
import type { TableSchemaProjectionService } from './src/application/services/TableSchemaProjectionService'
import { setDatabasePath } from './src/config/database'
import { createGraphQLConfig } from './src/config/graphql'
import type { AutoPersistenceService } from './src/domain/services/AutoPersistenceService'
import type { IAttributeRepository } from './src/domain/repositories/IAttributeRepository'
import type { INodeAttributeRepository } from './src/domain/repositories/INodeAttributeRepository'
import type { INodeEmbeddingRepository } from './src/domain/repositories/INodeEmbeddingRepository'
import type { INodeRelationRepository } from './src/domain/repositories/INodeRelationRepository'
import type { INodeRepository } from './src/domain/repositories/INodeRepository'
import type { IQueryTemplateRepository } from './src/domain/repositories/IQueryTemplateRepository'
import type { IRelationTypeRepository } from './src/domain/repositories/IRelationTypeRepository'
import type { ITableRepository } from './src/domain/repositories/ITableRepository'
import { createContainer, disposeContainer } from './src/infrastructure/container/ContainerBootstrap'
import { CommonTokens } from './src/infrastructure/container/tokens/CommonTokens'
import { UseCaseTokens } from './src/infrastructure/container/tokens/UseCaseTokens'
import { GraphQLSchemaBuilder } from './src/presentation/graphql/GraphQLSchemaBuilder'
import { toErrorMeta } from './src/presentation/http/utils/errorHelpers.js'
import { mergeWithEnvironment, parseCliArgs, printHelp, printVersion, validateOptions } from './src/utils/cli-parser'

// Parse CLI arguments
const { options, unknown } = parseCliArgs()
const finalOptions = mergeWithEnvironment(options)

// Handle help and version flags
if (finalOptions.help) {
  printHelp()
  process.exit(0)
}

if (finalOptions.version) {
  printVersion()
  process.exit(0)
}

// Validate options
try {
  validateOptions(finalOptions)
} catch (error) {
  console.error('❌ Invalid options:', error instanceof Error ? error.message : error)
  console.error('Use --help for usage information')
  process.exit(1)
}

// Warn about unknown arguments
if (unknown.length > 0) {
  console.warn('⚠️  Unknown arguments:', unknown.join(' '))
}

// Set environment variable if provided via CLI
if (finalOptions.env) {
  process.env.NODE_ENV = finalOptions.env
}

// Set database path if provided via CLI
if (finalOptions.databasePath) {
  setDatabasePath(finalOptions.databasePath)
}

// Port availability check function
const checkPortAvailable = async (port: number): Promise<boolean> => {
  try {
    // Try to bind to the port temporarily
    const testServer = Bun.serve({
      port,
      hostname: '127.0.0.1',
      fetch: () => new Response('test'),
    })
    testServer.stop()
    return true
  } catch (_error) {
    return false
  }
}

// Initialize dependency container
const container = await createContainer()

// Build GraphQL schema with the new schema builder
const schemaBuilder = new GraphQLSchemaBuilder(container)
const schema = await schemaBuilder.build()

const logger = await container.resolve<ILogger>(CommonTokens.LOGGER)
const accessControl = AccessControl.fromEnvironment(process.env, logger)
const internalBridgeToken = process.env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN?.trim()
if (accessControl.isAuthenticationRequired() && (!internalBridgeToken || internalBridgeToken.length < 32)) {
  throw new Error(
    'BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN must be a non-empty high-entropy (32+ character) token when authentication is enabled.',
  )
}
const nodeRepositoryForAccess = await container.resolve<INodeRepository>(RepositoryTokens.NODE_REPOSITORY)

// Initialize AutoPersistenceService
const autoPersistence = await container.resolve<AutoPersistenceService>(CommonTokens.AUTO_PERSISTENCE_SERVICE)
const persistenceResult = await autoPersistence.initialize()
if (persistenceResult.restored) {
  logger.info(`📂 Auto-restored from: ${persistenceResult.backupPath}`)
} else if (persistenceResult.error) {
  logger.warn(`⚠️ Auto-restore skipped: ${persistenceResult.error}`)
}

// Create GraphQL config with CLI options
const graphqlConfig = createGraphQLConfig(finalOptions)

const yoga = createYoga({
  schema,
  context: async ({ request }) => ({
    requestId: request.headers.get('x-request-id') || randomUUID(),
    startTime: new Date(),
    requestCache: new Map(),
    principal: accessControl.principalFor(request),
  }),
  logging: {
    debug: (...args) => logger.debug('GraphQL Debug', { args }),
    info: (...args) => logger.info('GraphQL Info', { args }),
    warn: (...args) => logger.warn('GraphQL Warning', { args }),
    error: (...args) => logger.error('GraphQL Error', { args }),
  },
  plugins: [
    {
      // Auto-save hook: mark dirty after successful mutations
      onExecute() {
        return {
          onExecuteDone({
            result,
            args,
          }: {
            result: ExecutionResult
            args: { document: DocumentNode }
          }) {
            // Check if this was a mutation and successful
            const operationType = args.document.definitions.find(
              (def: DefinitionNode): def is OperationDefinitionNode => def.kind === 'OperationDefinition',
            )
            if (operationType?.operation === 'mutation') {
              // Skip backup-related mutations to avoid recursive saves
              const queryText = args.document.loc?.source?.body || ''
              const isBackupMutation =
                queryText.includes('backupDatabase') ||
                queryText.includes('restoreDatabase') ||
                queryText.includes('exportJsonl') ||
                queryText.includes('importJsonl')
              if (isBackupMutation) {
                return
              }

              // Check if result has no errors
              const hasErrors = Array.isArray(result.errors) && result.errors.length > 0
              if (!hasErrors) {
                autoPersistence.markDirty()
              }
            }
          },
        }
      },
    },
  ],
  cors: graphqlConfig.cors,
  graphiql: {
    title: 'Bun Graph DB - GraphQL API',
    defaultQuery: `
      # Welcome to Bun Graph DB GraphQL API
      # This API provides access to the SQLite-based graph database
      
      query HealthCheck {
        healthCheck {
          status
          timestamp
          database
          version
          memory {
            status
            percentage
            message
          }
        }
      }
      
      query GetTables {
        tables {
          nodes {
            id
            identifier
            description
            createdAt
            updatedAt
            tableNodeCount
            attributeCount
          }
          totalCount
          hasNextPage
        }
      }
    `,
  },
  landingPage: false,
})

import { RepositoryTokens } from './src/infrastructure/container/tokens/RepositoryTokens'
import { McpHttpServer } from './src/mcp/http-server/McpHttpServer'
import type { FetchLike } from './src/models/GraphQLOperation'
import { AttributeApiController } from './src/presentation/http/controllers/AttributeApiController'
import { GraphApiController } from './src/presentation/http/controllers/GraphApiController'
// Import controllers
import { GraphDbApiController } from './src/presentation/http/controllers/GraphDbApiController'
import { McpToolController } from './src/presentation/http/controllers/McpToolController'
import { createBunApiRouter } from './src/presentation/http/routes/BunApiRouter'
// Import table MCP routes
import { createTableMcpMiddleware } from './src/presentation/mcp/routes/mcp-routes'

type OptionalRouteHandler = (request: Request) => Promise<Response | null>

let requestHandler!: (request: Request) => Promise<Response>
const inProcessFetch: FetchLike = async (input, init) => {
  const internalRequest = input instanceof Request ? input : new Request(String(input), init)
  return await requestHandler(internalRequest)
}

// Resolve dependencies from container in parallel
const [
  createTableUseCase,
  createAttributeUseCase,
  createNodeUseCase,
  updateNodeUseCase,
  createRelationUseCase,
  executeTemplateWithGraphQLUseCase,
  attributeRepository,
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
] = (await Promise.all([
  container.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE),
  container.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE),
  container.resolve(UseCaseTokens.CREATE_NODE_USE_CASE),
  container.resolve(UseCaseTokens.UPDATE_NODE_USE_CASE),
  container.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE),
  container.resolve(UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE),
  container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY),
  container.resolve(CommonTokens.TABLE_SCHEMA_PROJECTION_SERVICE),
  container.resolve(CommonTokens.NODE_ATTRIBUTE_SCHEMA_GATE),
  container.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY),
  container.resolve(UseCaseTokens.GET_TABLE_DOCS_USE_CASE),
  container.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE),
  container.resolve(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE),
  container.resolve(RepositoryTokens.TABLE_REPOSITORY),
  container.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY),
  container.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY),
  container.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY),
  container.resolve(RepositoryTokens.NODE_EMBEDDING_REPOSITORY),
  container.resolve(UseCaseTokens.HYBRID_SEARCH_NODES_USE_CASE),
]))

// Create controllers
const graphDbController = new GraphDbApiController(
  logger,
  createTableUseCase as CreateTableUseCase | undefined,
  createNodeUseCase as CreateNodeUseCase | undefined,
  updateNodeUseCase as UpdateNodeUseCase | undefined,
  searchNodesUseCase as SearchNodesUseCase | undefined,
  createRelationUseCase as CreateRelationUseCase | undefined,
  tableRepository as ITableRepository | undefined,
  relationTypeRepository as IRelationTypeRepository | undefined,
  queryTemplateRepository as IQueryTemplateRepository | undefined,
  executeTemplateWithGraphQLUseCase as ExecuteTemplateWithGraphQLUseCase | undefined,
)
const attributeController = new AttributeApiController(
  createAttributeUseCase as CreateAttributeUseCase,
  attributeRepository as IAttributeRepository,
  nodeAttributeRepository as INodeAttributeRepository,
  logger,
  queryTemplateRepository as IQueryTemplateRepository,
  nodeAttributeSchemaGate as import('./src/application/services/NodeAttributeSchemaGate').NodeAttributeSchemaGate,
)
const graphController = new GraphApiController(
  logger,
  getTableDocsUseCase as GetTableDocsUseCase,
  searchNodesUseCase as SearchNodesUseCase,
  searchRelatedNodesUseCase as SearchRelatedNodesUseCase,
  tableRepository as ITableRepository,
  nodeRelationRepository as INodeRelationRepository,
  graphqlConfig.port,
  tableSchemaProjectionService as TableSchemaProjectionService,
  inProcessFetch,
  internalBridgeToken,
  nodeAttributeSchemaGate as import('./src/application/services/NodeAttributeSchemaGate').NodeAttributeSchemaGate,
  nodeEmbeddingRepository as INodeEmbeddingRepository,
  hybridSearchNodesUseCase as HybridSearchNodesUseCase,
)
const _mcpToolController = new McpToolController(
  logger,
  graphqlConfig.port,
  inProcessFetch,
  internalBridgeToken,
)

let schemaHandlerPromise: Promise<OptionalRouteHandler> | undefined
const getSchemaHandler = (): Promise<OptionalRouteHandler> => {
  if (!schemaHandlerPromise) {
    schemaHandlerPromise = import('./src/presentation/http/routes/SchemaRoutes').then(({ createSchemaHandler }) =>
      createSchemaHandler(container),
    )
  }
  return schemaHandlerPromise
}

let templateFileHandlerPromise: Promise<OptionalRouteHandler> | undefined
const getTemplateFileHandler = (): Promise<OptionalRouteHandler> => {
  if (!templateFileHandlerPromise) {
    templateFileHandlerPromise = import('./src/presentation/http/routes/TemplateFileRoutes').then(
      ({ createTemplateFileHandler }) => createTemplateFileHandler(container),
    )
  }
  return templateFileHandlerPromise
}

let tabularSyncHandlerPromise: Promise<OptionalRouteHandler> | undefined
const getTabularSyncHandler = (): Promise<OptionalRouteHandler> => {
  if (!tabularSyncHandlerPromise) {
    tabularSyncHandlerPromise = Promise.all([
      import('./src/presentation/http/routes/TabularSyncRoutes'),
      container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE),
      container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE),
      container.resolve(CommonTokens.TABULAR_SYNC_HOOK),
    ]).then(([{ createTabularSyncHandler }, configStore, activationService, syncHook]) =>
      createTabularSyncHandler(configStore as never, logger, syncHook as never, activationService as never),
    )
  }
  return tabularSyncHandlerPromise
}

// Create MCP HTTP server with in-process transport dispatch
const mcpServer = new McpHttpServer(
  `http://localhost:${graphqlConfig.port}/graphql`,
  `http://localhost:${graphqlConfig.port}/api`,
  internalBridgeToken,
  inProcessFetch,
)
await mcpServer.initialize()

// Create table MCP middleware with in-process transport dispatch
const tableMcpMiddleware = createTableMcpMiddleware({
  graphqlEndpoint: `http://localhost:${graphqlConfig.port}/graphql`,
  restApiBaseUrl: `http://localhost:${graphqlConfig.port}/api`,
  logger,
  projectionService: tableSchemaProjectionService as TableSchemaProjectionService,
  internalBridgeToken,
  fetchImpl: inProcessFetch,
})

const apiRouter = createBunApiRouter({
  logger,
  graphDbController,
  attributeController,
  graphController,
  mcpToolController: _mcpToolController,
})

const typedTableRepositoryForAccess = tableRepository as ITableRepository

// Combined request handler
requestHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const pathname = url.pathname

  const accessDecision = await authorizeExternalRequest(
    accessControl,
    request,
    (toolName, argumentsValue) => mcpServer.resolveToolAccess(toolName, argumentsValue),
    {
      resolveNodeTableId: async (nodeId) => {
        const node = await nodeRepositoryForAccess.findById(nodeId)
        return node ? String(node.getTableId()) : undefined
      },
      resolveTableIdentity: async (tableIdOrIdentifier) => {
        const table =
          (await typedTableRepositoryForAccess.findById(tableIdOrIdentifier)) ??
          (await typedTableRepositoryForAccess.findByIdentifier(tableIdOrIdentifier))
        return table ? { id: String(table.id), identifier: table.identifier } : undefined
      },
    },
  )
  if (!accessDecision.allowed) {
    return accessControl.responseFor(accessDecision)
  }

  // Serve static HTML for root path
  if (pathname === '/') {
    try {
      const htmlFile = await Bun.file('./public/index.html')
      return new Response(await htmlFile.text(), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        },
      })
    } catch (error) {
      logger.error('Failed to serve index.html', { error })
      return new Response('Frontend not available', { status: 404 })
    }
  }

  // Handle template file routes lazily on matching paths
  if (pathname.startsWith('/api/template-files')) {
    const templateFileResponse = await (await getTemplateFileHandler())(request)
    if (templateFileResponse) {
      return templateFileResponse
    }
  }

  // Handle tabular sync management routes lazily on matching paths
  if (pathname === '/tabular-sync' || pathname.startsWith('/api/tabular-sync')) {
    const tabularSyncResponse = await (await getTabularSyncHandler())(request)
    if (tabularSyncResponse) {
      return tabularSyncResponse
    }
  }

  // Handle schema routes lazily on matching paths
  if (
    pathname === '/schema' ||
    pathname.startsWith('/schema/') ||
    pathname === '/schema.json' ||
    pathname === '/introspection.json' ||
    pathname === '/introspection'
  ) {
    const schemaResponse = await (await getSchemaHandler())(request)
    if (schemaResponse) {
      return schemaResponse
    }
  }

  // Handle table MCP requests - must come before general MCP handler
  const tableMcpResponse = await tableMcpMiddleware(request, accessDecision.principal)
  if (tableMcpResponse) {
    return tableMcpResponse
  }

  // Handle REST API requests
  if (pathname.startsWith('/api/')) {
    return await apiRouter(request)
  }

  // Handle MCP requests
  if (pathname === '/mcp' && request.method === 'POST') {
    return await mcpServer.handleRequest(request, accessDecision.principal)
  }

  // Handle GraphQL requests
  return yoga.fetch(request)
}

// Check if port is available before starting server
if (!(await checkPortAvailable(graphqlConfig.port))) {
  console.error(`❌ Port ${graphqlConfig.port} is already in use`)
  console.error('💡 Try a different port with --port option or stop the conflicting process')

  // Show processes using the port (if lsof is available)
  try {
    const proc = Bun.spawn(['lsof', '-ti', `:${graphqlConfig.port}`])
    const output = await new Response(proc.stdout).text()
    if (output.trim()) {
      console.error(`🔍 Process(es) using port ${graphqlConfig.port}: ${output.trim().split('\n').join(', ')}`)
    }
  } catch {
    // lsof might not be available on all systems
  }

  process.exit(1)
}

const server = Bun.serve({
  fetch: requestHandler,
  port: graphqlConfig.port,
  hostname: finalOptions.host || '0.0.0.0',
})

logger.info(`🚀 Bun Graph DB Server ready at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`)
logger.info(`📊 GraphiQL available at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`)
logger.info(`🔌 MCP Protocol available at http://localhost:${graphqlConfig.port}/mcp`)
logger.info(`📋 Schema endpoints available:`)
logger.info(`   • SDL: http://localhost:${graphqlConfig.port}/schema`)
logger.info(`   • JSON: http://localhost:${graphqlConfig.port}/schema.json`)
logger.info(`   • Introspection: http://localhost:${graphqlConfig.port}/introspection.json`)
logger.info(`   • TypeScript: http://localhost:${graphqlConfig.port}/schema/typescript`)
logger.info('🏗️  Architecture: Hexagonal with Domain-Driven Design')
logger.info('🎯 Features: GraphQL API + Template Engine + MCP Proxy')

// Graceful shutdown
const shutdown = async () => {
  logger.info('🛑 Server shutting down...')

  try {
    // 0. Auto-backup before shutdown
    logger.info('💾 Performing auto-backup...')
    const backupResult = await autoPersistence.shutdown()
    if (backupResult.backed) {
      logger.info(`✅ Auto-backup completed: ${backupResult.backupPath}`)
    } else if (backupResult.error) {
      logger.warn(`⚠️ Auto-backup failed: ${backupResult.error}`)
    }

    // 1. Stop accepting new connections first
    logger.info('🔌 Stopping HTTP server...')

    // Bun server.stop() is synchronous, but we wrap it for consistency
    await new Promise<void>((resolve, reject) => {
      try {
        server.stop()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    logger.info('✅ HTTP server stopped')

    // 2. Close root and table-scoped MCP lifecycle state before releasing DI.
    logger.info('🔌 Stopping MCP servers...')
    const mcpShutdown = await Promise.allSettled([mcpServer.close(), tableMcpMiddleware.close()])
    const mcpShutdownFailures = mcpShutdown.filter((result) => result.status === 'rejected')
    if (mcpShutdownFailures.length > 0) {
      throw new Error(`Failed to stop ${mcpShutdownFailures.length} MCP server lifecycle(s).`)
    }
    logger.info('✅ MCP servers stopped')

    // 3. Release DI-owned SQLite connections and disposable singletons.
    await disposeContainer()
    logger.info('✅ Database connections closed')

    logger.info('✅ Graceful shutdown completed')
  } catch (error) {
    logger.error('❌ Error during shutdown', toErrorMeta(error))
    process.exit(1)
  }

  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', { error })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Rejection', { reason })
  process.exit(1)
})
