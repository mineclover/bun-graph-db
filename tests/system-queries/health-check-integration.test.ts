/**
 * Health Check Integration Test
 *
 * CRITICAL: These tests MUST FAIL initially (TDD Red phase)
 * Tests the complete integration of healthCheck query execution
 * from GraphQL layer through use cases to database
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import Database from 'bun:sqlite'
import type {
  HealthStatus,
  SystemQueryExecutionContract,
  ValidationResult
} from '../../specs/002-sqlite-graphql-sql/contracts/system-query-contract'
import { SystemQueryBehaviorContract } from '../../specs/002-sqlite-graphql-sql/contracts/system-query-contract'

// These imports WILL FAIL - implementation not created yet (TDD Red phase)
import { TestDatabaseManager } from './fixtures/database-manager'
import { SystemQueries } from '@/presentation/graphql/queries/SystemQueries'
import { SystemMonitoringUseCase } from '@/application/use-cases/monitoring/SystemMonitoringUseCase'
import { SqliteConnection } from '@/infrastructure/database/sqlite/SqliteConnection'
import { SystemQueryValidator } from './fixtures/system-query-validation'
import { MockConditionManager } from './fixtures/mock-conditions'

describe('HealthCheck Integration Test', () => {
  let testDb: Database
  let dbManager: TestDatabaseManager
  let systemQueries: SystemQueryExecutionContract
  let validator: SystemQueryValidator
  let connection: SqliteConnection
  let mockManager: MockConditionManager

  beforeAll(async () => {
    // This WILL FAIL - TestDatabaseManager not implemented yet
    dbManager = TestDatabaseManager.getInstance()
    const { db, path } = await dbManager.createManaged({
      prefix: 'health-check-integration',
      optimizeForTesting: true
    })
    testDb = db

    // Setup connection and use case
    connection = SqliteConnection.getInstance()
    const useCase = new SystemMonitoringUseCase(connection)
    systemQueries = new SystemQueries(useCase)
    validator = new SystemQueryValidator()
    mockManager = new MockConditionManager()
  })

  beforeEach(() => {
    // Reset mock conditions before each test
    mockManager.reset()
  })

  afterAll(async () => {
    await dbManager.cleanupAll()
  })

  describe('Full Integration Flow', () => {
    test('should execute complete healthCheck query through all layers', async () => {
      // Measure total execution time
      const startTime = performance.now()

      const status = await systemQueries.executeHealthCheck()

      const executionTime = performance.now() - startTime

      // Verify performance requirement
      expect(executionTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxHealthCheckTime)

      // Validate response structure
      const validation = validator.validateHealthStatus(status)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should return accurate health status based on memory usage', async () => {
      const status = await systemQueries.executeHealthCheck()

      // Verify health status structure
      expect(status.status).toMatch(/healthy|degraded/)
      expect(status.database).toBe(true) // Database should be healthy in test
      expect(status.version).toBeDefined()
      expect(status.timestamp).toBeInstanceOf(Date)

      // Verify memory health status
      expect(status.memory).toBeDefined()
      expect(status.memory.percentage).toBeGreaterThanOrEqual(0)
      expect(status.memory.percentage).toBeLessThanOrEqual(100)
      expect(['healthy', 'warning', 'critical']).toContain(status.memory.status)
    })

    test('should categorize memory health correctly at thresholds', async () => {
      // Test healthy threshold (<70%)
      mockManager.setMemoryUsage(50) // 50% usage
      const healthyStatus = await systemQueries.executeHealthCheck()
      expect(healthyStatus.memory.status).toBe('healthy')
      expect(healthyStatus.status).toBe('healthy')

      // Test warning threshold (70-85%)
      mockManager.setMemoryUsage(75) // 75% usage
      const warningStatus = await systemQueries.executeHealthCheck()
      expect(warningStatus.memory.status).toBe('warning')
      expect(warningStatus.status).toBe('degraded')

      // Test critical threshold (≥85%)
      mockManager.setMemoryUsage(90) // 90% usage
      const criticalStatus = await systemQueries.executeHealthCheck()
      expect(criticalStatus.memory.status).toBe('critical')
      expect(criticalStatus.status).toBe('degraded')
    })

    test('should handle boundary conditions correctly', async () => {
      const thresholds = SystemQueryBehaviorContract.healthThresholds

      // Test exactly at 70% boundary
      mockManager.setMemoryUsage(thresholds.healthyThreshold)
      const boundary70 = await systemQueries.executeHealthCheck()
      expect(boundary70.memory.status).toBe('warning')

      // Test just below 70%
      mockManager.setMemoryUsage(thresholds.healthyThreshold - 0.01)
      const below70 = await systemQueries.executeHealthCheck()
      expect(below70.memory.status).toBe('healthy')

      // Test exactly at 85% boundary
      mockManager.setMemoryUsage(thresholds.criticalThreshold)
      const boundary85 = await systemQueries.executeHealthCheck()
      expect(boundary85.memory.status).toBe('critical')

      // Test just below 85%
      mockManager.setMemoryUsage(thresholds.criticalThreshold - 0.01)
      const below85 = await systemQueries.executeHealthCheck()
      expect(below85.memory.status).toBe('warning')
    })

    test('should include meaningful messages for each health state', async () => {
      // Test healthy state
      mockManager.setMemoryUsage(30)
      const healthy = await systemQueries.executeHealthCheck()
      if (healthy.memory.message) {
        expect(healthy.memory.message).toContain('normal')
      }

      // Test warning state
      mockManager.setMemoryUsage(75)
      const warning = await systemQueries.executeHealthCheck()
      expect(warning.memory.message).toBeDefined()
      expect(warning.memory.message).toContain('warning')

      // Test critical state
      mockManager.setMemoryUsage(95)
      const critical = await systemQueries.executeHealthCheck()
      expect(critical.memory.message).toBeDefined()
      expect(critical.memory.message).toContain('critical')
    })

    test('should verify database connectivity', async () => {
      const status = await systemQueries.executeHealthCheck()

      // Database should be healthy
      expect(status.database).toBe(true)

      // Test with database error simulation
      mockManager.simulateDatabaseError()
      const errorStatus = await systemQueries.executeHealthCheck()
      expect(errorStatus.database).toBe(false)
      expect(errorStatus.status).toBe('degraded')
    })

    test('should handle concurrent health checks efficiently', async () => {
      // Create multiple concurrent executions
      const concurrentCount = 15
      const promises = Array.from({ length: concurrentCount }, () =>
        systemQueries.executeHealthCheck()
      )

      const startTime = performance.now()
      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime

      // All should succeed
      expect(results).toHaveLength(concurrentCount)
      results.forEach(status => {
        const validation = validator.validateHealthStatus(status)
        expect(validation.isValid).toBe(true)
      })

      // Total time should indicate parallelization
      expect(totalTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxHealthCheckTime * 3)
    })

    test('should provide consistent version information', async () => {
      // Execute multiple times
      const checks = await Promise.all([
        systemQueries.executeHealthCheck(),
        systemQueries.executeHealthCheck(),
        systemQueries.executeHealthCheck()
      ])

      // Version should be consistent
      const versions = checks.map(c => c.version)
      expect(new Set(versions).size).toBe(1)
      expect(versions[0]).toBeDefined()
      expect(versions[0].length).toBeGreaterThan(0)
    })

    test('should update timestamp for each execution', async () => {
      const status1 = await systemQueries.executeHealthCheck()

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10))

      const status2 = await systemQueries.executeHealthCheck()

      // Timestamps should be different
      expect(status2.timestamp.getTime()).toBeGreaterThan(status1.timestamp.getTime())

      // Timestamps should be recent
      const now = Date.now()
      expect(now - status2.timestamp.getTime()).toBeLessThan(1000) // Within 1 second
    })

    test('should gracefully degrade when system under stress', async () => {
      // Simulate high memory usage
      mockManager.setMemoryUsage(95)
      mockManager.simulateHighCPU(90)

      const status = await systemQueries.executeHealthCheck()

      // Should still return valid response
      const validation = validator.validateHealthStatus(status)
      expect(validation.isValid).toBe(true)

      // Should indicate degraded state
      expect(status.status).toBe('degraded')
      expect(status.memory.status).toBe('critical')
    })

    test('should provide fallback health status on partial failures', async () => {
      // Simulate partial system API failure
      mockManager.simulatePartialAPIFailure(['memory'])

      const status = await systemQueries.executeHealthCheck()

      // Should still return a valid response
      expect(status).toBeDefined()
      expect(status.status).toBeDefined()
      expect(status.timestamp).toBeInstanceOf(Date)
      expect(status.version).toBeDefined()

      // Should indicate degradation due to missing data
      if (status.memory.percentage === 0) {
        expect(status.memory.message).toContain('unavailable')
      }
    })
  })
})