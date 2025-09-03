import type { GraphQLConfig } from '@/shared/types/common.js'

export const graphqlConfig: GraphQLConfig = {
  port: Number.parseInt(process.env.GRAPHQL_PORT || '4000'),
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true
  }
}

export const getGraphQLEndpoint = (): string => {
  return process.env.GRAPHQL_ENDPOINT || '/graphql'
}