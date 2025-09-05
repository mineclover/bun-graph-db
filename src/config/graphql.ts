import type { GraphQLConfig } from '@/core/types/CommonTypes.js'
import type { CliOptions } from '../utils/cli-parser.js'

export function createGraphQLConfig(cliOptions?: CliOptions): GraphQLConfig {
  // CLI options take precedence over environment variables
  const port = cliOptions?.port ?? Number.parseInt(process.env.GRAPHQL_PORT || '4000')
  const env = cliOptions?.env ?? process.env.NODE_ENV ?? 'development'

  return {
    port,
    introspection: env !== 'production',
    playground: env !== 'production',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        `http://localhost:${port}`,
      ],
      credentials: true,
    },
  }
}

// Legacy export for backward compatibility
export const graphqlConfig: GraphQLConfig = createGraphQLConfig()

export const getGraphQLEndpoint = (): string => {
  return process.env.GRAPHQL_ENDPOINT || '/graphql'
}
