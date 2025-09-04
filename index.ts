import { createYoga } from 'graphql-yoga'
import { GraphQLSchemaBuilder } from './src/presentation/graphql/GraphQLSchemaBuilder.js'
import { ContainerBootstrap } from './src/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens } from './src/infrastructure/container/tokens/CommonTokens.js'
import { graphqlConfig } from './src/config/graphql.js'
import type { ILogger } from './src/application/ports/ILogger.js'

// Initialize dependency container
const container = await ContainerBootstrap.createContainer()

// Build GraphQL schema with the new schema builder
const schemaBuilder = new GraphQLSchemaBuilder(container)
const schema = await schemaBuilder.build()

const logger = await container.resolve<ILogger>(CommonTokens.LOGGER)

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
    `
  },
  landingPage: false
})

const server = Bun.serve({
  fetch: yoga,
  port: graphqlConfig.port,
  hostname: '0.0.0.0',
})

logger.info(`🚀 Bun Graph DB Server ready at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`)
logger.info(`📊 GraphiQL available at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`)
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
