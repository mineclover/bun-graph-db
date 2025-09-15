import { createYoga } from 'graphql-yoga'
import type { ILogger } from './src/application/ports/ILogger.js'
import { createGraphQLConfig } from './src/config/graphql.js'
import { ContainerBootstrap } from './src/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens } from './src/infrastructure/container/tokens/CommonTokens.js'
import { GraphQLSchemaBuilder } from './src/presentation/graphql/GraphQLSchemaBuilder.js'
import {
  mergeWithEnvironment,
  parseCliArgs,
  printHelp,
  printVersion,
  validateOptions,
} from './src/utils/cli-parser.js'

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

// Initialize dependency container
const container = await ContainerBootstrap.createContainer()

// Build GraphQL schema with the new schema builder
const schemaBuilder = new GraphQLSchemaBuilder(container)
const schema = await schemaBuilder.build()

const logger = await container.resolve<ILogger>(CommonTokens.LOGGER)

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

// Import route handlers
import { createSchemaHandler } from './src/presentation/http/routes/SchemaRoutes.js'
import { createTemplateFileHandler } from './src/presentation/http/routes/TemplateFileRoutes.js'

// Create route handlers
const schemaHandler = await createSchemaHandler(container)
const templateFileHandler = await createTemplateFileHandler(container)

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

  // Handle GraphQL requests
  return yoga.fetch(request)
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
logger.info(`📋 Schema endpoints available:`)
logger.info(`   • SDL: http://localhost:${graphqlConfig.port}/schema`)
logger.info(`   • JSON: http://localhost:${graphqlConfig.port}/schema.json`)
logger.info(`   • Introspection: http://localhost:${graphqlConfig.port}/introspection.json`)
logger.info(`   • TypeScript: http://localhost:${graphqlConfig.port}/schema/typescript`)
logger.info('🏗️  Architecture: Hexagonal with Domain-Driven Design')
logger.info('🎯 Target: GraphQL → MCP conversion via mcp-graphql')

// Graceful shutdown
const shutdown = async () => {
  logger.info('🛑 Server shutting down...')

  try {
    server.stop()
    logger.info('✅ Server stopped successfully')
  } catch (error) {
    logger.error('❌ Error during shutdown', { error })
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
