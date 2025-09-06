import type { GraphQLConfig } from '@/core/types/CommonTypes.js'
import type { CliOptions } from '../utils/cli-parser.js'
import { getPortConfiguration, PortManager } from '@/core/config/PortConfiguration.js'

export function createGraphQLConfig(cliOptions?: CliOptions): GraphQLConfig {
  // CLI options take precedence over environment variables
  const env = cliOptions?.env ?? process.env.NODE_ENV ?? 'development'
  
  // Use PortManager for consistent port configuration
  const portConfig = getPortConfiguration(
    cliOptions?.port,
    process.env.GRAPHQL_PORT,
    env
  )
  
  // Log port configuration on startup
  if (process.env.NODE_ENV !== 'test') {
    console.log('\n📍 Port Configuration:')
    console.log(PortManager.formatPortInfo(portConfig))
    console.log('')
  }

  return {
    port: portConfig.http,
    websocketPort: portConfig.websocket, // For explicit WebSocket configuration
    introspection: env !== 'production',
    playground: env !== 'production',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
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
