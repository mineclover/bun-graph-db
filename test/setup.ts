// Jest setup file for test environment configuration

import { beforeAll, afterAll } from '@jest/globals'

beforeAll(async () => {
  // Ensure the GraphQL server is running
  console.log('🧪 Setting up integration tests...')
  console.log('📊 GraphQL API should be running at http://localhost:4000/graphql')
  
  // Add a small delay to ensure server is ready
  await new Promise(resolve => setTimeout(resolve, 2000))
})

afterAll(async () => {
  console.log('🧹 Cleaning up after tests...')
  // Add cleanup logic if needed
})