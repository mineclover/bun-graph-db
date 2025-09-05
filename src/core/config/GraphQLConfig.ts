/**
 * GraphQL configuration
 */

export interface GraphQLConfig {
  playground: boolean
  introspection: boolean
  cors: {
    origin: string | string[] | boolean
    credentials: boolean
  }
  cache: {
    enabled: boolean
    ttl: number
  }
  rateLimit: {
    enabled: boolean
    max: number
    windowMs: number
  }
  complexity: {
    maximumComplexity: number
    maximumDepth: number
  }
}

export const createGraphQLConfig = (env: Record<string, string | undefined>): GraphQLConfig => {
  const isDevelopment = env.NODE_ENV !== 'production'

  return {
    playground: isDevelopment || env.GRAPHQL_PLAYGROUND === 'true',
    introspection: isDevelopment || env.GRAPHQL_INTROSPECTION === 'true',
    cors: {
      origin: env.CORS_ORIGIN ? JSON.parse(env.CORS_ORIGIN) : true,
      credentials: env.CORS_CREDENTIALS !== 'false',
    },
    cache: {
      enabled: env.GRAPHQL_CACHE_ENABLED !== 'false',
      ttl: parseInt(env.GRAPHQL_CACHE_TTL || '300'),
    },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED === 'true',
      max: parseInt(env.RATE_LIMIT_MAX || '1000'),
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '900000'),
    },
    complexity: {
      maximumComplexity: parseInt(env.GRAPHQL_MAX_COMPLEXITY || '1000'),
      maximumDepth: parseInt(env.GRAPHQL_MAX_DEPTH || '10'),
    },
  }
}
