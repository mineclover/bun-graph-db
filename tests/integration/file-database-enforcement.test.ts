/**
 * Integration test for file-based SQLite enforcement
 * This test MUST FAIL until the implementation is created
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { TestDatabaseFactory, type TestEnvironment } from '../fixtures/test-database-factory'

// Import types and services (these will fail until implemented)
import type {
  FileBasedDatabaseFactory,
  MigrationService,
  TestContextManager,
  PerformanceMonitor
} from '../../src/migration-tools/services/MigrationService'

describe('File-Based SQLite Enforcement Integration', () => {
  let testEnv: TestEnvironment
  let fileBasedFactory: FileBasedDatabaseFactory
  let migrationService: MigrationService
  let contextManager: TestContextManager
  let performanceMonitor: PerformanceMonitor

  beforeEach(async () => {
    testEnv = await TestDatabaseFactory.createTestEnvironment('file-database-enforcement')

    // These will fail until implementations are created
    const { FileBasedDatabaseFactory } = await import('../../src/migration-tools/services/FileBasedDatabaseFactory')
    const { MigrationService } = await import('../../src/migration-tools/services/MigrationService')
    const { TestContextManager } = await import('../../src/migration-tools/services/TestContextManager')
    const { PerformanceMonitor } = await import('../../src/migration-tools/services/PerformanceMonitor')

    fileBasedFactory = new FileBasedDatabaseFactory()
    migrationService = new MigrationService(testEnv.database)
    contextManager = new TestContextManager(testEnv.database)
    performanceMonitor = new PerformanceMonitor(testEnv.database)
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  describe('file-based database creation enforcement', () => {
    it('should enforce file-based databases and reject in-memory requests', async () => {
      // Arrange: Configuration requesting file-based database
      const fileBasedConfig = {
        name: 'enforced-file-db',
        type: 'sqlite' as const,
        enforceFileBased: true,
        tempDirectory: '/tmp/bun-graph-db-tests',
        schemaVersion: 1
      }

      const options = {
        isolation: 'database' as const,
        cleanup: true,
        validation: true,
        performanceMonitoring: false
      }

      // Act: Create file-based environment
      const environment = await fileBasedFactory.createFileBasedEnvironment(fileBasedConfig, options)

      // Assert: File-based enforcement
      expect(environment.databasePath).not.toBe(':memory:')
      expect(environment.databasePath).not.toContain(':memory:')
      expect(environment.databasePath).toContain('/tmp/bun-graph-db-tests/')
      expect(environment.databasePath).toContain('.sqlite')

      // Test database operations to ensure it's working
      environment.connection.exec('CREATE TABLE enforcement_test (id INTEGER, data TEXT)')
      environment.connection.exec('INSERT INTO enforcement_test VALUES (1, "test")')

      const result = environment.connection.prepare('SELECT * FROM enforcement_test').get()
      expect(result).toEqual({ id: 1, data: 'test' })

      // Validate state
      const validation = await environment.validateState()
      expect(validation.isValid).toBe(true)
      expect(validation.databaseType).toBe('file-based')

      // Cleanup
      await environment.cleanup()
    })

    it('should reject attempts to create in-memory databases', async () => {
      // Arrange: Configuration attempting to request in-memory database
      const memoryConfig = {
        name: 'attempted-memory-db',
        type: 'sqlite',
        enforceFileBased: false, // Should conflict with factory purpose
        inMemory: true, // Should be rejected
        tempDirectory: '/tmp/bun-graph-db-tests'
      } as any

      const options = {
        isolation: 'database' as const,
        cleanup: true,
        validation: true,
        performanceMonitoring: false
      }

      // Act & Assert: Should reject in-memory configuration
      await expect(fileBasedFactory.createFileBasedEnvironment(memoryConfig, options))
        .rejects.toThrow('In-memory databases not supported by FileBasedDatabaseFactory')
    })

    it('should create unique file paths for concurrent environments', async () => {
      // Arrange: Multiple file-based configurations
      const configs = Array.from({ length: 5 }, (_, i) => ({
        name: `concurrent-file-db-${i}`,
        type: 'sqlite' as const,
        enforceFileBased: true,
        tempDirectory: '/tmp/bun-graph-db-tests',
        schemaVersion: 1
      }))

      const options = {
        isolation: 'database' as const,
        cleanup: true,
        validation: true,
        performanceMonitoring: false
      }

      // Act: Create multiple environments concurrently
      const environments = await Promise.all(
        configs.map(config => fileBasedFactory.createFileBasedEnvironment(config, options))
      )

      // Assert: Unique file paths
      expect(environments).toHaveLength(5)

      const databasePaths = environments.map(e => e.databasePath)
      const uniquePaths = new Set(databasePaths)
      expect(uniquePaths.size).toBe(5)

      // All should be file-based
      environments.forEach(env => {
        expect(env.databasePath).not.toBe(':memory:')
        expect(env.databasePath).toContain('/tmp/bun-graph-db-tests/')
        expect(env.databasePath).toContain('.sqlite')
      })

      // Test isolation by creating tables with same name
      await Promise.all(environments.map(async (env, i) => {
        env.connection.exec('CREATE TABLE same_name_table (id INTEGER, env_id INTEGER)')
        env.connection.exec(`INSERT INTO same_name_table VALUES (1, ${i})`)
      }))

      // Verify data isolation
      environments.forEach((env, i) => {
        const result = env.connection.prepare('SELECT * FROM same_name_table').get()
        expect(result).toEqual({ id: 1, env_id: i })
      })

      // Cleanup all
      await Promise.all(environments.map(e => e.cleanup()))
    })
  })

  describe('migration service file-based enforcement', () => {
    it('should enforce file-based databases in all migration operations', async () => {
      // Arrange: Migration target
      const target = {
        testFilePath: 'tests/unit/file-enforcement-test.test.ts',
        testType: 'unit' as const,
        migrationPriority: 'high' as const,
        complexity: 0.4,
        dependencies: ['file-database-system'],
        estimatedEffort: 'medium' as const
      }

      const options = {
        dryRun: false,
        validateOnly: false,
        createBackup: false,
        performanceMonitoring: true,
        enforceFileBased: true,
        fileBasedValidation: {
          strictMode: true,
          rejectMemoryUsage: true,
          validatePaths: true,
          auditCompliance: true
        }
      }

      // Act: Execute migration with file-based enforcement
      const migrationResult = await migrationService.executeMigration(target, options)

      // Assert: File-based enforcement in migration
      expect(migrationResult.success).toBe(true)
      expect(migrationResult.performanceMetrics.afterMetrics.databaseType).toBe('file-based')
      expect(migrationResult.performanceMetrics.afterMetrics.databasePath).not.toBe(':memory:')

      // Should include compliance audit
      expect(migrationResult.compliance).toBeDefined()
      expect(migrationResult.compliance.fileBasedEnforced).toBe(true)
      expect(migrationResult.compliance.memoryUsageDetected).toBe(false)
      expect(migrationResult.compliance.auditPassed).toBe(true)

      // Global validation should pass
      const validation = TestDatabaseFactory.validateFileBasedEnforcement()
      expect(validation.isValid).toBe(true)
      expect(validation.violations).toHaveLength(0)
    })

    it('should validate file-based requirements during migration analysis', async () => {
      // Arrange: Migration target for analysis
      const target = {
        testFilePath: 'tests/integration/file-validation-test.test.ts',
        testType: 'integration' as const,
        migrationPriority: 'high' as const,
        complexity: 0.6,
        dependencies: ['database-layer', 'validation-system'],
        estimatedEffort: 'high' as const
      }

      // Act: Analyze migration for file-based requirements
      const analysis = await migrationService.analyzeMigrationTarget(target)
      const validation = await migrationService.validateMigration(target, {
        checkFileExists: false,
        validateSyntax: false,
        checkDependencies: true,
        performanceCheck: true,
        strictMode: true
      })

      // Assert: File-based validation in analysis
      expect(analysis.fileBasedSupport).toBeDefined()
      expect(analysis.fileBasedSupport.required).toBe(true)
      expect(analysis.fileBasedSupport.compatible).toBe(true)

      expect(validation.databaseValidation).toBeDefined()
      expect(validation.databaseValidation.enforcesFileBased).toBe(true)
      expect(validation.databaseValidation.memoryUsageDetected).toBe(false)

      // Should recommend file-based approach
      expect(analysis.recommendations.some(r => r.includes('file-based'))).toBe(true)
    })
  })

  describe('context manager file-based enforcement', () => {
    it('should create file-based contexts and reject memory requests', async () => {
      // Arrange: Context configuration with file-based enforcement
      const config = {
        suiteName: 'file-based-context-test',
        testType: 'integration' as const,
        enforceFileBased: true,
        isolationLevel: 'full' as const,
        cleanupOnExit: true,
        databaseValidation: {
          enforceFileBased: true,
          rejectMemoryAttempts: true,
          validatePaths: true
        }
      }

      // Act: Create context with file-based enforcement
      const context = await contextManager.createTestContext(config)

      // Assert: File-based context enforcement
      expect(context.databasePath).not.toBe(':memory:')
      expect(context.databasePath).toContain('/tmp/bun-graph-db-tests/')

      // Should have validation metadata
      expect(context.validation).toBeDefined()
      expect(context.validation.fileBasedEnforced).toBe(true)
      expect(context.validation.memoryAttemptRejected).toBe(false) // No attempt made

      // Test database operations
      const db = context.database.getConnection()
      db.exec('CREATE TABLE context_test (id INTEGER, data TEXT)')
      db.exec('INSERT INTO context_test VALUES (1, "context-data")')

      const result = db.prepare('SELECT * FROM context_test').get()
      expect(result).toEqual({ id: 1, data: 'context-data' })

      // Cleanup
      await context.cleanup()
    })

    it('should warn when overriding memory preferences', async () => {
      // Arrange: Configuration with memory preference but file-based enforcement
      const config = {
        suiteName: 'memory-preference-override-test',
        testType: 'unit' as const,
        enforceFileBased: true, // This should override memory preference
        isolationLevel: 'database' as const,
        cleanupOnExit: true,
        preferMemory: true // This should be overridden
      }

      // Act: Create context with conflicting preferences
      const context = await contextManager.createTestContext(config)

      // Assert: Memory preference overridden
      expect(context.databasePath).not.toBe(':memory:')
      expect(context.databasePath).toContain('/tmp/bun-graph-db-tests/')

      // Should include warning about override
      expect(context.warnings).toBeDefined()
      expect(Array.isArray(context.warnings)).toBe(true)
      expect(context.warnings.some(w => w.includes('memory preference overridden'))).toBe(true)

      // Cleanup
      await context.cleanup()
    })
  })

  describe('performance monitoring with file-based enforcement', () => {
    it('should monitor file-based database performance', async () => {
      // Arrange: Performance monitoring configuration
      const target = {
        testFilePath: 'tests/integration/file-performance-test.test.ts',
        testType: 'integration' as const,
        migrationPriority: 'medium' as const,
        complexity: 0.5,
        dependencies: ['performance-framework'],
        estimatedEffort: 'medium' as const
      }

      const monitoringOptions = {
        trackMemory: false,
        trackCPU: false,
        trackIO: true, // Important for file-based operations
        trackDatabase: true,
        samplingInterval: 100,
        enableProfiling: false,
        databaseValidation: {
          enforceFileBased: true,
          trackConnections: true,
          trackQueries: true,
          validateIOPatterns: true
        }
      }

      // Act: Monitor file-based database operation
      const performanceResult = await performanceMonitor.measureExecution(
        'file-database-performance',
        async () => {
          return await migrationService.executeMigration(target, {
            dryRun: false,
            validateOnly: false,
            createBackup: false,
            performanceMonitoring: true,
            enforceFileBased: true
          })
        },
        monitoringOptions
      )

      // Assert: File-based performance monitoring
      expect(performanceResult.result.success).toBe(true)
      expect(performanceResult.databaseMetrics.connectionType).toBe('file-based')
      expect(performanceResult.databaseMetrics.queryCount).toBeGreaterThan(0)

      // File I/O should be detected
      expect(performanceResult.ioMetrics.readBytes).toBeGreaterThan(0)
      expect(performanceResult.ioMetrics.writeBytes).toBeGreaterThan(0)

      // Should validate I/O patterns consistent with file-based operations
      expect(performanceResult.databaseMetrics.ioPatternValidation).toBeDefined()
      expect(performanceResult.databaseMetrics.ioPatternValidation.consistentWithFileBased).toBe(true)
    })

    it('should detect and report any memory database usage attempts', async () => {
      // Arrange: Configuration to test detection capabilities
      const monitoringOptions = {
        trackMemory: true,
        trackCPU: false,
        trackIO: true,
        trackDatabase: true,
        samplingInterval: 50,
        enableProfiling: false,
        memoryDetection: {
          enabled: true,
          scanConnections: true,
          validatePaths: true,
          reportViolations: true
        }
      }

      // Act: Monitor for any memory database attempts
      const context = await contextManager.createTestContext({
        suiteName: 'memory-detection-test',
        testType: 'unit',
        enforceFileBased: true,
        isolationLevel: 'database',
        cleanupOnExit: true
      })

      const detectionResult = await performanceMonitor.measureExecution(
        'memory-detection-scan',
        async () => {
          // Perform normal database operations
          const db = context.database.getConnection()
          db.exec('CREATE TABLE detection_test (id INTEGER)')
          db.exec('INSERT INTO detection_test VALUES (1)')
          const result = db.prepare('SELECT * FROM detection_test').get()
          return result
        },
        monitoringOptions
      )

      // Assert: No memory database usage detected
      expect(detectionResult.result).toEqual({ id: 1 })
      expect(detectionResult.databaseMetrics.connectionType).toBe('file-based')

      // Memory detection should report clean results
      expect(detectionResult.memoryDetection).toBeDefined()
      expect(detectionResult.memoryDetection.memoryDatabasesDetected).toBe(false)
      expect(detectionResult.memoryDetection.violationsFound).toHaveLength(0)
      expect(detectionResult.memoryDetection.allConnectionsValidated).toBe(true)

      // Cleanup
      await context.cleanup()
    })
  })

  describe('system-wide file-based enforcement validation', () => {
    it('should validate file-based enforcement across all components', async () => {
      // Arrange: System-wide validation scenario
      const scenarios = [
        {
          component: 'file-database-factory',
          operation: async () => {
            return await fileBasedFactory.createFileBasedEnvironment({
              name: 'system-validation-factory',
              type: 'sqlite',
              enforceFileBased: true,
              tempDirectory: '/tmp/bun-graph-db-tests',
              schemaVersion: 1
            }, {
              isolation: 'database',
              cleanup: true,
              validation: true,
              performanceMonitoring: false
            })
          }
        },
        {
          component: 'context-manager',
          operation: async () => {
            return await contextManager.createTestContext({
              suiteName: 'system-validation-context',
              testType: 'unit',
              enforceFileBased: true,
              isolationLevel: 'database',
              cleanupOnExit: true
            })
          }
        },
        {
          component: 'migration-service',
          operation: async () => {
            return await migrationService.executeMigration({
              testFilePath: 'tests/unit/system-validation.test.ts',
              testType: 'unit',
              migrationPriority: 'medium',
              complexity: 0.3,
              dependencies: ['validation-framework'],
              estimatedEffort: 'medium'
            }, {
              dryRun: false,
              validateOnly: false,
              createBackup: false,
              performanceMonitoring: false,
              enforceFileBased: true
            })
          }
        }
      ]

      // Act: Execute system-wide validation
      const results = await Promise.all(
        scenarios.map(async scenario => {
          try {
            const result = await scenario.operation()
            return { component: scenario.component, result, success: true }
          } catch (error) {
            return { component: scenario.component, error, success: false }
          }
        })
      )

      // Assert: System-wide file-based enforcement
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)

      // Validate each component's file-based enforcement
      const [factoryResult, contextResult, migrationResult] = results

      // Factory result
      expect(factoryResult.result.databasePath).not.toBe(':memory:')
      expect(factoryResult.result.databasePath).toContain('/tmp/bun-graph-db-tests/')

      // Context result
      expect(contextResult.result.databasePath).not.toBe(':memory:')
      expect(contextResult.result.databasePath).toContain('/tmp/bun-graph-db-tests/')

      // Migration result
      expect(migrationResult.result.performanceMetrics.afterMetrics.databaseType).toBe('file-based')

      // Global validation
      const globalValidation = TestDatabaseFactory.validateFileBasedEnforcement()
      expect(globalValidation.isValid).toBe(true)
      expect(globalValidation.violations).toHaveLength(0)

      // Cleanup all components
      await factoryResult.result.cleanup()
      await contextResult.result.cleanup()
    })

    it('should maintain file-based enforcement under stress conditions', async () => {
      // Arrange: Stress test with multiple concurrent operations
      const stressOperations = Array.from({ length: 20 }, (_, i) => ({
        type: 'concurrent-stress',
        id: i,
        operation: async () => {
          const context = await contextManager.createTestContext({
            suiteName: `stress-test-${i}`,
            testType: 'unit',
            enforceFileBased: true,
            isolationLevel: 'database',
            cleanupOnExit: true
          })

          // Perform database operations
          const db = context.database.getConnection()
          db.exec(`CREATE TABLE stress_test_${i} (id INTEGER, data TEXT)`)

          for (let j = 0; j < 10; j++) {
            db.exec(`INSERT INTO stress_test_${i} VALUES (${j}, 'stress-data-${i}-${j}')`)
          }

          const count = db.prepare(`SELECT COUNT(*) as count FROM stress_test_${i}`).get()
          return { context, count }
        }
      }))

      // Act: Execute stress operations
      const stressResults = await Promise.all(
        stressOperations.map(op => op.operation())
      )

      // Assert: File-based enforcement under stress
      expect(stressResults).toHaveLength(20)

      stressResults.forEach((result, i) => {
        expect(result.count).toEqual({ count: 10 })
        expect(result.context.databasePath).not.toBe(':memory:')
        expect(result.context.databasePath).toContain('/tmp/bun-graph-db-tests/')
      })

      // Global validation should still pass
      const validation = TestDatabaseFactory.validateFileBasedEnforcement()
      expect(validation.isValid).toBe(true)
      expect(validation.violations).toHaveLength(0)

      // Cleanup all contexts
      await Promise.all(stressResults.map(result => result.context.cleanup()))

      // Final validation after cleanup
      const finalValidation = TestDatabaseFactory.validateFileBasedEnforcement()
      expect(finalValidation.isValid).toBe(true)
    })
  })
})