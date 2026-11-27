/**
 * Test GraphQL Server
 * Starts isolated GraphQL server with test database for each test suite
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import type { GraphQLExecutionResult, GraphQLVariables } from '../../src/core/types/GraphQLTypes.js'
import { createTestEnvironment, type TestEnvironment } from './test-database-factory'

export interface TestGraphQLServer {
  url: string
  port: number
  database: TestEnvironment
  cleanup: () => Promise<void>
}

export type GraphQLRequestHelper = <TData = unknown>(
  query: string,
  variables?: GraphQLVariables,
) => Promise<GraphQLExecutionResult<TData>>

// Module state for GraphQL test server management
const servers: Map<string, TestGraphQLServer> = new Map()
const reservedPorts = new Set<number>()
const TEST_PORT_START = 5500
const TEST_PORT_END = 5999
const PORT_BLOCK_SIZE = 20
const PORT_BLOCK_COUNT = Math.floor((TEST_PORT_END - TEST_PORT_START + 1) / PORT_BLOCK_SIZE)
let nextPort = getInitialPortForProcess()

/**
 * Start GraphQL server with isolated database for test suite
 */
export async function startServerForSuite(suiteName: string): Promise<TestGraphQLServer> {
  // Check if server already exists
  if (servers.has(suiteName)) {
    await stopServerForSuite(suiteName)
  }

  // Create isolated database
  const database = await createTestEnvironment(suiteName)

  // Assign a machine-wide free port within the test range.
  const port = await allocatePort()
  const url = `http://localhost:${port}/graphql`

  // Start server with custom database path
  const serverProcess = spawn(process.execPath, ['--import', 'tsx', 'index.ts'], {
    env: {
      ...process.env,
      GRAPHQL_PORT: port.toString(),
      DATABASE_PATH: database.databasePath,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  serverProcess.stdout?.setEncoding('utf8')
  serverProcess.stderr?.setEncoding('utf8')
  serverProcess.stdout?.on('data', (chunk: string) => {
    stdout += chunk
  })
  serverProcess.stderr?.on('data', (chunk: string) => {
    stderr += chunk
  })

  const exitedPromise = new Promise<void>((resolveExit) => {
    serverProcess.once('close', () => resolveExit())
  })

  // Wait for server to be ready
  try {
    await waitForServer(url, 60000) // 60 second timeout for long serial test lanes
  } catch (error) {
    console.error('❌ Server failed to start:')
    console.error('STDOUT:', stdout)
    console.error('STDERR:', stderr)

    // Kill server process
    serverProcess.kill()
    await exitedPromise

    throw error
  }

  const server: TestGraphQLServer = {
    url,
    port,
    database,
    cleanup: async () => {
      // Kill server process
      serverProcess.kill()
      await exitedPromise

      // Cleanup database
      await database.cleanup()

      // Remove from registry
      servers.delete(suiteName)
      reservedPorts.delete(port)
    },
  }

  servers.set(suiteName, server)
  return server
}

/**
 * Wait for GraphQL server to be ready
 */
async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now()
  const testQuery = `
      query {
        __schema {
          types {
            name
          }
        }
      }
    `

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: testQuery,
        }),
      })

      if (response.ok) {
        return // Server is ready
      }
    } catch (_error) {
      // Server not ready yet, continue waiting
    }

    // Wait 100ms before next attempt
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`GraphQL server did not become ready within ${timeoutMs}ms`)
}

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

  throw new Error('Test port range exhausted (5500-5999). Too many concurrent test servers.')
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
 * Stop all test servers
 */
export async function stopAllServers(): Promise<void> {
  const cleanupPromises = Array.from(servers.values()).map((server) => server.cleanup())
  await Promise.all(cleanupPromises)
  servers.clear()
  reservedPorts.clear()
  nextPort = getInitialPortForProcess()
}

/**
 * Get existing server for suite
 */
export function getServerForSuite(suiteName: string): TestGraphQLServer | null {
  return servers.get(suiteName) || null
}

/**
 * Stop server for specific suite
 */
export async function stopServerForSuite(suiteName: string): Promise<void> {
  const server = servers.get(suiteName)
  if (server) {
    await server.cleanup()
  }
}

/**
 * Create GraphQL request helper for test suite
 */
export function createRequestHelper(suiteName: string) {
  const server = servers.get(suiteName)
  if (!server) {
    throw new Error(`No server found for suite: ${suiteName}`)
  }

  return async function graphqlRequest<TData = unknown>(query: string, variables?: GraphQLVariables) {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    const result = (await response.json()) as GraphQLExecutionResult<TData>

    if (!response.ok) {
      console.error('GraphQL Request Failed:', result)
      throw new Error(`GraphQL request failed: ${response.status}`)
    }

    // Log GraphQL errors for debugging
    if (result.errors) {
      console.error('GraphQL Response Errors:', JSON.stringify(result.errors, null, 2))
      console.error('GraphQL Query:', query)
      console.error('GraphQL Variables:', variables)
    }

    return result
  }
}

export function requireGraphQLData<TData>(result: GraphQLExecutionResult<TData>): TData {
  if (result.data === undefined) {
    throw new Error('GraphQL response did not include data')
  }

  return result.data
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
