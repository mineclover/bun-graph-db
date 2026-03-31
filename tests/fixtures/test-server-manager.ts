/**
 * Test Server Manager
 * Manages isolated GraphQL servers for each test suite with proper port allocation
 */

import type { YogaServerInstance } from 'graphql-yoga'
import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:net'
import { createContainer } from '../../src/infrastructure/container/ContainerBootstrap'
import { McpHttpServer } from '../../src/mcp/http-server/McpHttpServer'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder'
import { createTestEnvironment, type TestEnvironment } from './test-database-factory'

export interface TestServerInstance {
  readonly url: string
  readonly port: number
  readonly suiteName: string
  readonly testEnvironment: TestEnvironment
  readonly server: YogaServerInstance<any, any>
  readonly mcpServer: McpHttpServer
  readonly cleanup: () => Promise<void>
}

// Module-level state for test server instances
const serverInstances: Map<string, TestServerInstance> = new Map()
const reservedPorts = new Set<number>()
const TEST_PORT_START = 5500
const TEST_PORT_END = 5999
const PORT_BLOCK_SIZE = 20
const PORT_BLOCK_COUNT = Math.floor((TEST_PORT_END - TEST_PORT_START + 1) / PORT_BLOCK_SIZE)
let nextPort = getInitialPortForProcess()

/**
 * Start isolated GraphQL server for test suite
 */
export async function startServerForSuite(suiteName: string): Promise<TestServerInstance> {
  // Clean up existing instance if any
  if (serverInstances.has(suiteName)) {
    await stopServerForSuite(suiteName)
  }

  // Create isolated database environment
  const testEnvironment = await createTestEnvironment(`server-${suiteName}`, 'integration')

  // Allocate unique port
  const port = await allocatePort()

  // Set database path for this test server
  process.env.DATABASE_PATH = testEnvironment.databasePath

  // Create DI container with test database
  const container = await createContainer()

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

  // Create MCP HTTP server
  const mcpServer = new McpHttpServer(`http://127.0.0.1:${port}/graphql`, `http://127.0.0.1:${port}/api`)
  await mcpServer.initialize()

  // Combined request handler for both GraphQL and MCP
  const requestHandler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Handle MCP requests
    if (pathname === '/mcp' && request.method === 'POST') {
      return await mcpServer.handleRequest(request)
    }

    // Handle GraphQL requests
    return yoga.fetch(request)
  }

  // Start server
  const server = Bun.serve({
    fetch: requestHandler,
    port,
    hostname: '127.0.0.1',
  })

  const url = `http://127.0.0.1:${port}/graphql`

  // Wait for server to be ready
  await waitForServer(url)

  const instance: TestServerInstance = {
    url,
    port,
    suiteName,
    testEnvironment,
    server: yoga,
    mcpServer,
    cleanup: async () => {
      server.stop()
      await testEnvironment.cleanup()
      serverInstances.delete(suiteName)
      reservedPorts.delete(port)
    },
  }

  serverInstances.set(suiteName, instance)
  return instance
}

/**
 * Stop server for specific test suite
 */
export async function stopServerForSuite(suiteName: string): Promise<void> {
  const instance = serverInstances.get(suiteName)
  if (instance) {
    await instance.cleanup()
  }
}

/**
 * Stop all test servers
 */
export async function stopAllServers(): Promise<void> {
  const cleanupPromises = Array.from(serverInstances.values()).map((instance) => instance.cleanup())
  await Promise.all(cleanupPromises)
  serverInstances.clear()
  reservedPorts.clear()
  nextPort = getInitialPortForProcess()
}

/**
 * Get server instance for test suite
 */
export function getServerForSuite(suiteName: string): TestServerInstance | null {
  return serverInstances.get(suiteName) || null
}

/**
 * Create GraphQL request helper for test suite
 */
export function createRequestHelper(suiteName: string): (query: string, variables?: any) => Promise<any> {
  const instance = serverInstances.get(suiteName)
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
async function allocatePort(): Promise<number> {
  for (let i = 0; i <= TEST_PORT_END - TEST_PORT_START; i++) {
    const candidate = TEST_PORT_START + ((nextPort - TEST_PORT_START + i) % (TEST_PORT_END - TEST_PORT_START + 1))
    if (reservedPorts.has(candidate)) {
      continue
    }

    if (await isPortAvailable(candidate)) {
      reservedPorts.add(candidate)
      nextPort = candidate + 1 > TEST_PORT_END ? TEST_PORT_START : candidate + 1
      return candidate
    }
  }

  throw new Error('Test server port range exhausted (5500-5999)')
}

function getInitialPortForProcess(): number {
  const processBlock = (process.pid % PORT_BLOCK_COUNT) * PORT_BLOCK_SIZE
  return TEST_PORT_START + processBlock
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

/**
 * Wait for server to be ready
 */
async function waitForServer(url: string, maxRetries = 10): Promise<void> {
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
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Server at ${url} did not become ready within ${maxRetries * 100}ms`)
}

// Global cleanup on process exit
process.on('exit', () => {
  stopAllServers()
})

process.on('SIGINT', async () => {
  await stopAllServers()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await stopAllServers()
  process.exit(0)
})
