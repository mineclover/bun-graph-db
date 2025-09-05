#!/usr/bin/env bun

/**
 * Integration Test Runner for Bun Graph DB
 * Comprehensive test environment with server lifecycle management
 */

import { type ChildProcess, spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

interface TestRunnerConfig {
  serverPort: number
  serverStartupTimeout: number
  healthCheckRetries: number
  healthCheckInterval: number
  testTimeout: number
  cleanupTimeout: number
}

const DEFAULT_CONFIG: TestRunnerConfig = {
  serverPort: 4000,
  serverStartupTimeout: 30000, // 30 seconds
  healthCheckRetries: 15,
  healthCheckInterval: 2000, // 2 seconds
  testTimeout: 120000, // 2 minutes per test suite
  cleanupTimeout: 10000, // 10 seconds
}

export class GraphQLTestRunner {
  private config: TestRunnerConfig
  private serverProcess: ChildProcess | null = null
  private isServerReady = false
  private testClient: GraphQLTestClient | null = null

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the GraphQL server for testing
   */
  async startServer(): Promise<void> {
    console.log('🚀 Starting GraphQL server for testing...')

    // Check if server is already running
    if (await this.isPortInUse(this.config.serverPort)) {
      console.log(`✅ Server already running on port ${this.config.serverPort}`)
      this.isServerReady = true
      this.testClient = new GraphQLTestClient(`http://localhost:${this.config.serverPort}/graphql`)
      return
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup()
        reject(new Error(`Server startup timed out after ${this.config.serverStartupTimeout}ms`))
      }, this.config.serverStartupTimeout)

      // Start the server process
      this.serverProcess = spawn('bun', ['index.ts'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: this.config.serverPort.toString(),
          LOG_LEVEL: 'error', // Reduce log noise during tests
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let startupOutput = ''

      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        startupOutput += output

        // Look for server ready indicators
        if (output.includes('Server running') || output.includes('GraphQL server')) {
          console.log('📡 Server process started, checking health...')
          this.waitForServerHealth()
            .then(() => {
              clearTimeout(timeout)
              this.isServerReady = true
              resolve()
            })
            .catch((error) => {
              clearTimeout(timeout)
              reject(error)
            })
        }
      })

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString())
      })

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout)
        console.error('Failed to start server process:', error)
        reject(error)
      })

      this.serverProcess.on('exit', (code, signal) => {
        clearTimeout(timeout)
        if (code !== 0 && code !== null) {
          console.error('Server process exited with code:', code)
          console.error('Server startup output:', startupOutput)
          reject(new Error(`Server process exited with code ${code}`))
        }
      })
    })
  }

  /**
   * Wait for server to be healthy
   */
  private async waitForServerHealth(): Promise<void> {
    const client = new GraphQLTestClient(`http://localhost:${this.config.serverPort}/graphql`)

    for (let attempt = 1; attempt <= this.config.healthCheckRetries; attempt++) {
      try {
        console.log(`🔍 Health check attempt ${attempt}/${this.config.healthCheckRetries}`)

        const isHealthy = await client.healthCheck()
        if (isHealthy) {
          console.log('✅ Server is healthy and ready for testing')
          this.testClient = client
          return
        }
      } catch (error) {
        console.log(`❌ Health check ${attempt} failed:`, error.message)
      }

      if (attempt < this.config.healthCheckRetries) {
        await this.sleep(this.config.healthCheckInterval)
      }
    }

    throw new Error(`Server failed health checks after ${this.config.healthCheckRetries} attempts`)
  }

  /**
   * Stop the GraphQL server
   */
  async stopServer(): Promise<void> {
    if (!this.serverProcess) {
      return
    }

    console.log('🛑 Stopping GraphQL server...')

    return new Promise((resolve) => {
      const cleanup = () => {
        this.serverProcess = null
        this.isServerReady = false
        this.testClient = null
        resolve()
      }

      const timeout = setTimeout(() => {
        console.log('⚠️  Force killing server process...')
        this.serverProcess?.kill('SIGKILL')
        cleanup()
      }, this.config.cleanupTimeout)

      if (this.serverProcess) {
        this.serverProcess.on('exit', () => {
          clearTimeout(timeout)
          console.log('✅ Server stopped gracefully')
          cleanup()
        })

        // Try graceful shutdown first
        this.serverProcess.kill('SIGTERM')
      }
    })
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<void> {
    if (!this.isServerReady || !this.testClient) {
      throw new Error('Server is not ready. Call startServer() first.')
    }

    console.log('🧪 Running comprehensive GraphQL test suite...')

    // Set test timeout
    const originalTimeout = setTimeout(() => {
      throw new Error(`Test suite timed out after ${this.config.testTimeout}ms`)
    }, this.config.testTimeout)

    try {
      // Run the test file using Bun's test runner
      const testProcess = spawn('bun', ['test', 'test/graphql-comprehensive.test.ts'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          TEST_SERVER_URL: `http://localhost:${this.config.serverPort}/graphql`,
          NODE_ENV: 'test',
        },
      })

      const exitCode = await new Promise<number>((resolve) => {
        testProcess.on('exit', (code) => resolve(code || 0))
        testProcess.on('error', () => resolve(1))
      })

      clearTimeout(originalTimeout)

      if (exitCode !== 0) {
        throw new Error(`Test suite failed with exit code ${exitCode}`)
      }

      console.log('✅ All tests completed successfully!')
    } catch (error) {
      clearTimeout(originalTimeout)
      throw error
    }
  }

  /**
   * Run specific test file
   */
  async runTestFile(testFile: string): Promise<void> {
    if (!this.isServerReady) {
      throw new Error('Server is not ready. Call startServer() first.')
    }

    console.log(`🧪 Running test file: ${testFile}`)

    const testProcess = spawn('bun', ['test', testFile], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_SERVER_URL: `http://localhost:${this.config.serverPort}/graphql`,
        NODE_ENV: 'test',
      },
    })

    const exitCode = await new Promise<number>((resolve) => {
      testProcess.on('exit', (code) => resolve(code || 0))
      testProcess.on('error', () => resolve(1))
    })

    if (exitCode !== 0) {
      throw new Error(`Test file ${testFile} failed with exit code ${exitCode}`)
    }

    console.log(`✅ Test file ${testFile} completed successfully!`)
  }

  /**
   * Full test lifecycle: start server, run tests, stop server
   */
  async runFullTestSuite(): Promise<void> {
    try {
      await this.startServer()
      await this.runAllTests()
    } finally {
      await this.cleanup()
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopServer()
  }

  /**
   * Check if port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    const client = new GraphQLTestClient(`http://localhost:${port}/graphql`)
    try {
      return await client.healthCheck()
    } catch {
      return false
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get test client instance
   */
  getTestClient(): GraphQLTestClient | null {
    return this.testClient
  }

  /**
   * Check if server is ready
   */
  isReady(): boolean {
    return this.isServerReady && this.testClient !== null
  }
}

// CLI interface when run directly
if (import.meta.main) {
  const runner = new GraphQLTestRunner()

  const args = process.argv.slice(2)
  const command = args[0] || 'full'

  switch (command) {
    case 'start':
      await runner.startServer()
      console.log('Server started. Press Ctrl+C to stop.')
      process.on('SIGINT', async () => {
        await runner.cleanup()
        process.exit(0)
      })
      break

    case 'test': {
      const testFile = args[1]
      await runner.startServer()
      try {
        if (testFile) {
          await runner.runTestFile(testFile)
        } else {
          await runner.runAllTests()
        }
      } finally {
        await runner.cleanup()
      }
      break
    }

    case 'full':
    default:
      await runner.runFullTestSuite()
      break
  }
}

export default GraphQLTestRunner
