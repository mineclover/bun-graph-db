/**
 * TestContextManager - Manages isolated test execution contexts
 */

import type {
  TestContext,
  IsolationLevel,
  TestContextType,
  ResourceLimits,
  ResourceUsage,
  ContextResources,
  CleanupResult,
  ValidationResult
} from '../models/TestContext'
import { TestContextValidator } from '../models/TestContext'

export interface ContextOptions {
  suiteName: string
  testType: TestContextType
  isolationLevel: IsolationLevel
  enforceFileBased: boolean
  cleanupOnExit: boolean
  resourceLimits?: ResourceLimits
  preferMemory?: boolean
}

export class TestContextManager {
  private activeContexts = new Map<string, TestContextImpl>()
  private contextCounter = 0
  private database: any

  constructor(database?: any) {
    this.database = database
  }

  static getInstance(): TestContextManager {
    return new TestContextManager()
  }

  /**
   * Creates a new isolated test context
   */
  async createTestContext(config: ContextOptions): Promise<TestContext> {
    // Validate configuration
    const validation = TestContextValidator.validateConfiguration(config)
    if (!validation.isValid) {
      throw new Error(`Invalid context configuration: ${validation.errors.join(', ')}`)
    }

    // Generate unique context ID
    const contextId = `ctx-${Date.now()}-${++this.contextCounter}`

    // Create database path with proper isolation
    const databasePath = this.generateDatabasePath(contextId, config)

    // Apply resource limits
    const resourceLimits = config.resourceLimits ||
      TestContextValidator.getDefaultResourceLimits(config.testType)

    // Create context implementation
    const context = new TestContextImpl({
      id: contextId,
      suiteName: config.suiteName,
      databasePath,
      isolationLevel: config.isolationLevel,
      testType: config.testType,
      enforceFileBased: config.enforceFileBased,
      resourceLimits,
      cleanupOnExit: config.cleanupOnExit
    })

    // Initialize context
    await context.initialize()

    // Register context
    this.activeContexts.set(contextId, context)

    return context
  }

  /**
   * Retrieves an existing context by ID
   */
  getContext(contextId: string): TestContext | null {
    return this.activeContexts.get(contextId) || null
  }

  /**
   * Lists all active contexts
   */
  listActiveContexts(): TestContext[] {
    return Array.from(this.activeContexts.values())
  }

  /**
   * Validates all active contexts
   */
  async validateAllContexts(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>()

    for (const [id, context] of this.activeContexts) {
      const validation = await context.validateState()
      results.set(id, validation)
    }

    return results
  }

  /**
   * Cleanup a specific context
   */
  async cleanupContext(contextId: string): Promise<CleanupResult> {
    const context = this.activeContexts.get(contextId)
    if (!context) {
      return {
        success: false,
        resourcesFreed: { files: 0, connections: 0, processes: 0, memoryBlocks: 0, tempDirectories: 0 },
        errors: [`Context ${contextId} not found`],
        cleanupTime: 0
      }
    }

    const result = await context.cleanup()
    this.activeContexts.delete(contextId)
    return result
  }

  /**
   * Cleanup all contexts
   */
  async cleanupAll(): Promise<Map<string, CleanupResult>> {
    const results = new Map<string, CleanupResult>()

    for (const [id, context] of this.activeContexts) {
      const result = await context.cleanup()
      results.set(id, result)
    }

    this.activeContexts.clear()
    return results
  }

  /**
   * Check for resource violations across all contexts
   */
  async checkResourceViolations(): Promise<{
    violations: Array<{contextId: string, violation: string, severity: 'warning' | 'error'}>
    overallHealth: 'healthy' | 'degraded' | 'critical'
  }> {
    const violations: Array<{contextId: string, violation: string, severity: 'warning' | 'error'}> = []

    for (const [id, context] of this.activeContexts) {
      const validation = await context.validateState()

      validation.errors.forEach(error => {
        violations.push({
          contextId: id,
          violation: error,
          severity: 'error'
        })
      })

      validation.warnings.forEach(warning => {
        violations.push({
          contextId: id,
          violation: warning,
          severity: 'warning'
        })
      })
    }

    const errorCount = violations.filter(v => v.severity === 'error').length
    const overallHealth = errorCount > 0 ? 'critical' :
                         violations.length > 5 ? 'degraded' : 'healthy'

    return { violations, overallHealth }
  }

  private generateDatabasePath(contextId: string, config: ContextOptions): string {
    if (config.enforceFileBased || !config.preferMemory) {
      return `/tmp/bun-graph-db-tests/${config.suiteName}-${contextId}.sqlite`
    }

    // Even if preferMemory is true, enforceFileBased takes precedence
    if (config.enforceFileBased) {
      return `/tmp/bun-graph-db-tests/${config.suiteName}-${contextId}.sqlite`
    }

    // This should be avoided, but if explicitly configured
    return ':memory:'
  }
}

class TestContextImpl implements TestContext {
  public readonly id: string
  public readonly suiteName: string
  public readonly database: any = null // Will be initialized
  public readonly databasePath: string
  public readonly isolationLevel: IsolationLevel
  public readonly testType: TestContextType
  public readonly enforceFileBased: boolean
  public readonly warnings: string[] = []
  public readonly createdAt: Date = new Date()
  public isCleanedUp: boolean = false

  public resources: ContextResources = {
    files: [],
    connections: [],
    processes: [],
    memoryBlocks: [],
    tempDirectories: []
  }

  public resourceUsage: ResourceUsage = {
    connectionCount: 0,
    fileCount: 0,
    memoryUsage: 0,
    executionTime: 0,
    ioOperations: 0
  }

  public resourceLimits?: ResourceLimits
  public metadata?: any

  constructor(config: {
    id: string
    suiteName: string
    databasePath: string
    isolationLevel: IsolationLevel
    testType: TestContextType
    enforceFileBased: boolean
    resourceLimits?: ResourceLimits
    cleanupOnExit: boolean
  }) {
    this.id = config.id
    this.suiteName = config.suiteName
    this.databasePath = config.databasePath
    this.isolationLevel = config.isolationLevel
    this.testType = config.testType
    this.enforceFileBased = config.enforceFileBased
    this.resourceLimits = config.resourceLimits

    // Validate file-based enforcement
    if (this.enforceFileBased && this.databasePath.includes(':memory:')) {
      this.warnings.push('File-based enforcement enabled but memory database path detected')
    }
  }

  async initialize(): Promise<void> {
    // Create temp directory if needed
    if (!this.databasePath.includes(':memory:')) {
      const dbDir = this.databasePath.substring(0, this.databasePath.lastIndexOf('/'))
      try {
        await Bun.$`mkdir -p ${dbDir}`
        this.resources.tempDirectories.push(dbDir)
      } catch (error) {
        this.warnings.push(`Failed to create database directory: ${error}`)
      }
    }
  }

  async allocateFile(filename: string): Promise<void> {
    if (this.resourceLimits?.maxFiles && this.resourceUsage.fileCount >= this.resourceLimits.maxFiles) {
      throw new Error(`File allocation limit exceeded: ${this.resourceLimits.maxFiles}`)
    }

    this.resources.files.push(filename)
    this.resourceUsage.fileCount++
  }

  async allocateConnection(connectionId: string): Promise<void> {
    if (this.resourceLimits?.maxConnections && this.resourceUsage.connectionCount >= this.resourceLimits.maxConnections) {
      throw new Error(`Connection allocation limit exceeded: ${this.resourceLimits.maxConnections}`)
    }

    this.resources.connections.push(connectionId)
    this.resourceUsage.connectionCount++
  }

  async allocateProcess(processId: string): Promise<void> {
    this.resources.processes.push(processId)
  }

  async validateState(): Promise<ValidationResult> {
    return TestContextValidator.validateContextState(this)
  }

  async cleanup(): Promise<CleanupResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let resourcesFreed = {
      files: 0,
      connections: 0,
      processes: 0,
      memoryBlocks: 0,
      tempDirectories: 0
    }

    try {
      // Cleanup files
      for (const file of this.resources.files) {
        try {
          await Bun.$`rm -f ${file}`
          resourcesFreed.files++
        } catch (error) {
          errors.push(`Failed to cleanup file ${file}: ${error}`)
        }
      }

      // Cleanup database file
      if (!this.databasePath.includes(':memory:')) {
        try {
          await Bun.$`rm -f ${this.databasePath}`
          resourcesFreed.files++
        } catch (error) {
          errors.push(`Failed to cleanup database ${this.databasePath}: ${error}`)
        }
      }

      // Cleanup temp directories
      for (const dir of this.resources.tempDirectories) {
        try {
          await Bun.$`rm -rf ${dir}`
          resourcesFreed.tempDirectories++
        } catch (error) {
          errors.push(`Failed to cleanup directory ${dir}: ${error}`)
        }
      }

      // Reset resources
      this.resources = {
        files: [],
        connections: [],
        processes: [],
        memoryBlocks: [],
        tempDirectories: []
      }

      this.resourceUsage = {
        connectionCount: 0,
        fileCount: 0,
        memoryUsage: 0,
        executionTime: 0,
        ioOperations: 0
      }

      this.isCleanedUp = true

      return {
        success: errors.length === 0,
        resourcesFreed,
        errors,
        cleanupTime: Date.now() - startTime
      }

    } catch (error) {
      errors.push(`Cleanup failed: ${error}`)
      return {
        success: false,
        resourcesFreed,
        errors,
        cleanupTime: Date.now() - startTime
      }
    }
  }
}