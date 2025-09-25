/**
 * Test GraphQL Server
 * Starts isolated GraphQL server with test database for each test suite
 */

import { spawn } from 'bun'
import { createTestEnvironment, type TestEnvironment } from './test-database-factory'

export interface TestGraphQLServer {
  url: string
  port: number
  database: TestEnvironment
  cleanup: () => Promise<void>
}

// Module state for GraphQL test server management
const servers: Map<string, TestGraphQLServer> = new Map()
let portCounter = 5500 // Start from 5500 within test range (5000-5999)

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

  // Assign unique port within test range (5000-5999)
  const port = portCounter++
  if (port > 5999) {
    throw new Error('Test port range exhausted (5500-5999). Too many concurrent test servers.')
  }
  const url = `http://localhost:${port}/graphql`

  // Start server with custom database path
  const serverProcess = spawn(['bun', 'run', 'index.ts'], {
    env: {
      ...process.env,
      GRAPHQL_PORT: port.toString(),
      DATABASE_PATH: database.databasePath,
      NODE_ENV: 'test',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Wait for server to be ready
  try {
    await waitForServer(url, 10000) // 10 second timeout
  } catch (error) {
    // Capture server output for debugging
    const stdout = await new Response(serverProcess.stdout).text()
    const stderr = await new Response(serverProcess.stderr).text()

    console.error('❌ Server failed to start:')
    console.error('STDOUT:', stdout)
    console.error('STDERR:', stderr)

    // Kill server process
    serverProcess.kill()
    await serverProcess.exited

    throw error
  }

  const server: TestGraphQLServer = {
    url,
    port,
    database,
    cleanup: async () => {
      // Kill server process
      serverProcess.kill()
      await serverProcess.exited

      // Cleanup database
      await database.cleanup()

      // Remove from registry
      servers.delete(suiteName)
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
 * Stop all test servers
 */
export async function stopAllServers(): Promise<void> {
  const cleanupPromises = Array.from(servers.values()).map((server) => server.cleanup())
  await Promise.all(cleanupPromises)
  servers.clear()
}

/**
 * Create GraphQL request helper for test suite
 */
export function createRequestHelper(suiteName: string) {
  const server = servers.get(suiteName)
  if (!server) {
    throw new Error(`No server found for suite: ${suiteName}`)
  }

  return async function graphqlRequest(query: string, variables?: Record<string, any>) {
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

    const result = await response.json()

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
