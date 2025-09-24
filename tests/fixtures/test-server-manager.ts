/**
 * Test Server Manager
 * Manages isolated GraphQL servers for each test suite with proper port allocation
 */

import { createYoga } from 'graphql-yoga'
import type { YogaServerInstance } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder'
import { TestDatabaseFactory, type TestEnvironment } from './test-database-factory'

export interface TestServerInstance {
  readonly url: string
  readonly port: number
  readonly suiteName: string
  readonly testEnvironment: TestEnvironment
  readonly server: YogaServerInstance<any, any>
  readonly cleanup: () => Promise<void>
}

export class TestServerManager {
  private static instances: Map<string, TestServerInstance> = new Map()
  private static portCounter = 5500 // Test port range: 5500-5999

  /**
   * Start isolated GraphQL server for test suite
   */
  static async startServerForSuite(suiteName: string): Promise<TestServerInstance> {
    // Clean up existing instance if any
    if (TestServerManager.instances.has(suiteName)) {
      await TestServerManager.stopServerForSuite(suiteName)
    }

    // Create isolated database environment
    const testEnvironment = await TestDatabaseFactory.createTestEnvironment(
      `server-${suiteName}`,
      'integration'
    )

    // Allocate unique port
    const port = TestServerManager.allocatePort()

    // Set database path for this test server
    process.env.DATABASE_PATH = testEnvironment.databasePath

    // Create DI container with test database
    const container = await ContainerBootstrap.createContainer()

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

    // Start server
    const server = Bun.serve({
      fetch: yoga.fetch,
      port,
      hostname: '127.0.0.1',
    })

    const url = `http://127.0.0.1:${port}/graphql`

    // Wait for server to be ready
    await TestServerManager.waitForServer(url)

    const instance: TestServerInstance = {
      url,
      port,
      suiteName,
      testEnvironment,
      server: yoga,
      cleanup: async () => {
        server.stop()
        await testEnvironment.cleanup()
        TestServerManager.instances.delete(suiteName)
      },
    }

    TestServerManager.instances.set(suiteName, instance)
    return instance
  }

  /**
   * Stop server for specific test suite
   */
  static async stopServerForSuite(suiteName: string): Promise<void> {
    const instance = TestServerManager.instances.get(suiteName)
    if (instance) {
      await instance.cleanup()
    }
  }

  /**
   * Stop all test servers
   */
  static async stopAllServers(): Promise<void> {
    const cleanupPromises = Array.from(TestServerManager.instances.values()).map(
      instance => instance.cleanup()
    )
    await Promise.all(cleanupPromises)
    TestServerManager.instances.clear()
    TestServerManager.portCounter = 5500 // Reset port counter
  }

  /**
   * Get server instance for test suite
   */
  static getServerForSuite(suiteName: string): TestServerInstance | null {
    return TestServerManager.instances.get(suiteName) || null
  }

  /**
   * Create GraphQL request helper for test suite
   */
  static createRequestHelper(suiteName: string): (query: string, variables?: any) => Promise<any> {
    const instance = TestServerManager.instances.get(suiteName)
    if (!instance) {
      throw new Error(`No server instance found for suite: ${suiteName}`)
    }

    return async (query: string, variables?: any) => {
      const response = await fetch(instance.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
      }

      return response.json()
    }
  }

  /**
   * Allocate unique port for test server
   */
  private static allocatePort(): number {
    if (TestServerManager.portCounter > 5999) {
      throw new Error('Test server port range exhausted (5500-5999)')
    }
    return TestServerManager.portCounter++
  }

  /**
   * Wait for server to be ready
   */
  private static async waitForServer(url: string, maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
        })
        if (response.ok) {
          return
        }
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Server at ${url} did not become ready within ${maxRetries * 100}ms`)
  }
}

// Global cleanup on process exit
process.on('exit', () => {
  TestServerManager.stopAllServers()
})

process.on('SIGINT', async () => {
  await TestServerManager.stopAllServers()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await TestServerManager.stopAllServers()
  process.exit(0)
})