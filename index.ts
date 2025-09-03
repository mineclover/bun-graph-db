import { createYoga } from 'graphql-yoga'
import { schema } from './src/graphql/schema.js'
import { logger } from './src/utils/logger.js'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 4000

const yoga = createYoga({
  schema,
  logging: {
    debug: (...args) => logger.debug('GraphQL Debug', args),
    info: (...args) => logger.info('GraphQL Info', args),
    warn: (...args) => logger.warn('GraphQL Warning', args),
    error: (...args) => logger.error('GraphQL Error', args),
  },
  cors: {
    origin: '*',
    credentials: true,
  },
  graphiql: {
    title: 'Bun GraphQL API',
  },
})

const server = Bun.serve({
  fetch: yoga,
  port: PORT,
  hostname: '0.0.0.0',
})

logger.info(`🚀 Server ready at http://localhost:${PORT}${yoga.graphqlEndpoint}`)
logger.info(`📊 GraphiQL available at http://localhost:${PORT}${yoga.graphqlEndpoint}`)

process.on('SIGINT', () => {
  logger.info('Server shutting down...')
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('Server shutting down...')
  server.stop()
  process.exit(0)
})
