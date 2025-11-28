import { createYoga } from 'graphql-yoga'
import type { ILogger } from './src/application/ports/ILogger'
import { setDatabasePath } from './src/config/database'
import { createGraphQLConfig } from './src/config/graphql'
import type { AutoPersistenceService } from './src/domain/services/AutoPersistenceService'
import { createContainer } from './src/infrastructure/container/ContainerBootstrap'
import { CommonTokens } from './src/infrastructure/container/tokens/CommonTokens'
import { UseCaseTokens } from './src/infrastructure/container/tokens/UseCaseTokens'
import { GraphQLSchemaBuilder } from './src/presentation/graphql/GraphQLSchemaBuilder'
import { toErrorMeta } from './src/presentation/http/utils/errorHelpers.js'
import {
  mergeWithEnvironment,
  parseCliArgs,
  printHelp,
  printVersion,
  validateOptions,
} from './src/utils/cli-parser'

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

// Initialize AutoPersistenceService
const autoPersistence = await container.resolve<AutoPersistenceService>(
  CommonTokens.AUTO_PERSISTENCE_SERVICE
)
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
          onExecuteDone({ result, args }: { result: any; args: any }) {
            // Check if this was a mutation and successful
            const operationType = args.document.definitions.find(
              (def: any) => def.kind === 'OperationDefinition'
            ) as any
            if (operationType?.operation === 'mutation') {
              // Check if result has no errors
              const hasErrors = 'errors' in result && result.errors?.length > 0
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
        health {
          status
          timestamp
          database
          version
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
            nodeCount
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
import { AttributeApiController } from './src/presentation/http/controllers/AttributeApiController'
import { GraphApiController } from './src/presentation/http/controllers/GraphApiController'
// Import controllers
import { GraphDbApiController } from './src/presentation/http/controllers/GraphDbApiController'
import { McpToolController } from './src/presentation/http/controllers/McpToolController'
// Import route handlers
import { createSchemaHandler } from './src/presentation/http/routes/SchemaRoutes'
import { createTemplateFileHandler } from './src/presentation/http/routes/TemplateFileRoutes'
// Import table MCP routes
import { createTableMcpMiddleware } from './src/presentation/mcp/routes/mcp-routes'

// Resolve dependencies from container in parallel
const [
  createAttributeUseCase,
  attributeRepository,
  nodeAttributeRepository,
  getTableDocsUseCase,
  searchNodesUseCase,
  searchRelatedNodesUseCase,
  tableRepository,
  nodeRelationRepository,
] = (await Promise.all([
  container.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE),
  container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY),
  container.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY),
  container.resolve(UseCaseTokens.GET_TABLE_DOCS_USE_CASE),
  container.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE),
  container.resolve(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE),
  container.resolve(RepositoryTokens.TABLE_REPOSITORY),
  container.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY),
])) as any[]

// Create controllers
const graphDbController = new GraphDbApiController(logger)
const attributeController = new AttributeApiController(
  createAttributeUseCase,
  attributeRepository,
  nodeAttributeRepository,
  logger
)
const graphController = new GraphApiController(
  logger,
  getTableDocsUseCase,
  searchNodesUseCase,
  searchRelatedNodesUseCase,
  tableRepository,
  nodeRelationRepository,
  graphqlConfig.port
)
const _mcpToolController = new McpToolController(logger, graphqlConfig.port)

// Create route handlers in parallel
const [schemaHandler, templateFileHandler] = await Promise.all([
  createSchemaHandler(container),
  createTemplateFileHandler(container),
])

// Create MCP HTTP server with REST API base URL
const mcpServer = new McpHttpServer(
  `http://localhost:${graphqlConfig.port}/graphql`,
  `http://localhost:${graphqlConfig.port}/api`
)
await mcpServer.initialize()

// Create table MCP middleware
const tableMcpMiddleware = createTableMcpMiddleware({
  graphqlEndpoint: `http://localhost:${graphqlConfig.port}/graphql`,
  restApiBaseUrl: `http://localhost:${graphqlConfig.port}/api`,
  logger,
})

// Direct API route handler without Express
const handleApiRequest = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method

  try {
    // Parse request body for POST/PUT requests
    let body: any = {}
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }

    // Create request and response objects compatible with controllers
    const req: any = {
      method,
      url: pathname + url.search,
      path: pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      params: {},
      headers: Object.fromEntries(request.headers.entries()),
      body,
    }

    let responseData: any
    let statusCode = 200

    const res: any = {
      status: (code: number) => {
        statusCode = code
        return res
      },
      json: (data: any) => {
        responseData = data
      },
      send: (data: any) => {
        responseData = data
      },
    }

    // Route matching and execution
    if (method === 'GET' && pathname === '/api/health') {
      logger.info('Health check endpoint called')
      // Simple direct response to test the framework first
      responseData = {
        success: true,
        data: {
          status: 'OK',
          timestamp: new Date().toISOString(),
          database: 'Connected',
          version: '1.0.0',
        },
      }
    } else if (method === 'GET' && pathname === '/api/stats') {
      await graphDbController.systemStats(req, res)
    } else if (method === 'POST' && pathname === '/api/tables') {
      await graphDbController.createTable(req, res)
    } else if (method === 'GET' && pathname === '/api/tables/search') {
      await graphDbController.searchTables(req, res)
    } else if (method === 'GET' && pathname === '/api/tables') {
      await graphController.getTables(req, res)
    } else if (method === 'GET' && pathname === '/api/tables/docs') {
      await graphController.getTableDocs(req, res)
    } else if (method === 'POST' && pathname === '/api/nodes') {
      await graphDbController.createNode(req, res)
    } else if (method === 'GET' && pathname === '/api/nodes/search') {
      await graphDbController.searchNodes(req, res)
    } else if (method === 'POST' && pathname === '/api/relations') {
      await graphDbController.createRelation(req, res)
    } else if (method === 'POST' && pathname === '/api/templates') {
      await graphDbController.createTemplate(req, res)
    } else if (method === 'GET' && pathname === '/api/templates/search') {
      await graphDbController.searchTemplates(req, res)
    } else if (method === 'POST' && pathname === '/api/templates/execute') {
      await graphDbController.executeTemplateWithGraphQL(req, res)
    } else if (method === 'POST' && pathname === '/api/attributes') {
      await attributeController.createAttribute(req, res)
    } else if (
      method === 'GET' &&
      pathname.startsWith('/api/nodes/') &&
      pathname.endsWith('/attributes')
    ) {
      // Extract nodeId from path like /api/nodes/123/attributes
      const nodeId = pathname.split('/')[3]
      req.params.nodeId = nodeId
      await attributeController.getNodeAttributes(req, res)
    } else if (
      method === 'POST' &&
      pathname.startsWith('/api/tables/') &&
      pathname.endsWith('/export')
    ) {
      // Extract tableId from path like /api/tables/123/export
      const tableId = pathname.split('/')[3]
      req.params.tableId = tableId
      await graphController.exportTableWithNodes(req, res)

      // MCP Tool Operations (Bridge between GraphQL and local services)
    } else if (method === 'GET' && pathname === '/api/mcp-tools') {
      await _mcpToolController.listMcpTools(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/call') {
      await _mcpToolController.callMcpTool(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/bulk-import-templates') {
      await _mcpToolController.bulkImportTemplates(req, res)
    } else if (method === 'GET' && pathname === '/api/mcp-tools/list-available-templates') {
      await _mcpToolController.listAvailableTemplates(req, res)
    } else if (method === 'GET' && pathname === '/api/mcp-tools/import-status') {
      await _mcpToolController.getImportStatus(req, res)

      // New template management tools
    } else if (method === 'POST' && pathname === '/api/mcp-tools/create-template') {
      await _mcpToolController.createTemplate(req, res)
    } else if (method === 'PUT' && pathname === '/api/mcp-tools/update-template') {
      await _mcpToolController.updateTemplate(req, res)
    } else if (method === 'DELETE' && pathname === '/api/mcp-tools/delete-template') {
      await _mcpToolController.deleteTemplate(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/validate-template') {
      await _mcpToolController.validateTemplate(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/search-templates') {
      await _mcpToolController.searchTemplates(req, res)
    } else if (method === 'GET' && pathname === '/api/mcp-tools/get-template-metadata') {
      await _mcpToolController.getTemplateMetadata(req, res)

      // System initialization tools
    } else if (method === 'POST' && pathname === '/api/mcp-tools/initialize-system') {
      await _mcpToolController.initializeSystem(req, res)
    } else if (method === 'GET' && pathname === '/api/mcp-tools/get-system-status') {
      await _mcpToolController.getSystemStatus(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/quick-reset') {
      await _mcpToolController.quickReset(req, res)
    } else if (method === 'POST' && pathname === '/api/mcp-tools/setup-demo') {
      await _mcpToolController.setupDemo(req, res)
    } else {
      return new Response('Not Found', { status: 404 })
    }

    // Return response
    return new Response(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    logger.error('API request error:', toErrorMeta(error))
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Combined request handler
const requestHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const pathname = url.pathname

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

  // Handle template file routes first
  const templateFileResponse = await templateFileHandler(request)
  if (templateFileResponse) {
    return templateFileResponse
  }

  // Handle schema routes second
  const schemaResponse = await schemaHandler(request)
  if (schemaResponse) {
    return schemaResponse
  }

  // Handle table MCP requests - must come before general MCP handler
  const tableMcpResponse = await tableMcpMiddleware(request)
  if (tableMcpResponse) {
    return tableMcpResponse
  }

  // Handle REST API requests
  if (pathname.startsWith('/api/')) {
    return await handleApiRequest(request)
  }

  // Handle MCP requests
  if (pathname === '/mcp' && request.method === 'POST') {
    return await mcpServer.handleRequest(request)
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
      console.error(
        `🔍 Process(es) using port ${graphqlConfig.port}: ${output.trim().split('\n').join(', ')}`
      )
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

logger.info(
  `🚀 Bun Graph DB Server ready at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`
)
logger.info(
  `📊 GraphiQL available at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`
)
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

    // 2. Close MCP server connections if available
    if (mcpServer) {
      logger.info('🔌 Stopping MCP server...')
      // Note: Add proper cleanup method to McpHttpServer if available
      logger.info('✅ MCP server stopped')
    }

    // 3. Close any database connections (if needed in the future)
    // await database?.close()
    // logger.info('✅ Database connections closed')

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
