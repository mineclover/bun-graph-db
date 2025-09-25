/**
 * GraphQL Yoga Helper for Comprehensive Tests
 * Creates in-process GraphQL server for testing
 */

import { createYoga } from 'graphql-yoga'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder'

/**
 * Create GraphQL Yoga instance for testing
 */
export async function createGraphQLYoga(container: DIContainer) {
  // Build GraphQL schema
  const schemaBuilder = new GraphQLSchemaBuilder(container)
  const schema = await schemaBuilder.build()

  // Create Yoga server instance
  const yoga = createYoga({
    schema,
    logging: false, // Disable logging for tests
    landingPage: false,
    cors: {
      origin: '*',
      credentials: true,
    },
    graphiql: false, // Disable GraphiQL in tests
  })

  return yoga
}

/**
 * Create GraphQL executor function with proper URL handling
 */
export function createGraphQLExecutor(yoga: any) {
  return async (query: string, variables?: any) => {
    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    return await response.json()
  }
}
