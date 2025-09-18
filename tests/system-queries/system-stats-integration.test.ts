/**
 * System Stats Integration Test
 *
 * CRITICAL: These tests MUST FAIL initially (TDD Red phase)
 * Tests the complete integration of systemStats query execution
 * from GraphQL layer through use cases to database
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import Database from 'bun:sqlite'
import type {
  SystemStats,
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

describe('SystemStats Integration Test', () => {
  let testDb: Database
  let dbManager: TestDatabaseManager
  let systemQueries: SystemQueryExecutionContract
  let validator: SystemQueryValidator
  let connection: SqliteConnection

  beforeAll(async () => {
    // This WILL FAIL - TestDatabaseManager not implemented yet
    dbManager = TestDatabaseManager.getInstance()
    const { db, path } = await dbManager.createManaged({
      prefix: 'system-stats-integration',
      optimizeForTesting: true
    })
    testDb = db

    // Setup connection and use case
    connection = SqliteConnection.getInstance()
    const useCase = new SystemMonitoringUseCase(connection)
    systemQueries = new SystemQueries(useCase)
    validator = new SystemQueryValidator()
  })

  afterAll(async () => {
    await dbManager.cleanupAll()
  })

  describe('Full Integration Flow', () => {
    test('should execute complete systemStats query through all layers', async () => {
      // Measure total execution time
      const startTime = performance.now()

      const stats = await systemQueries.executeSystemStats()

      const executionTime = performance.now() - startTime

      // Verify performance requirement
      expect(executionTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxSystemStatsTime)

      // Validate response structure
      const validation = validator.validateSystemStats(stats)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should return consistent data across multiple calls', async () => {
      // Execute query multiple times
      const [stats1, stats2, stats3] = await Promise.all([
        systemQueries.executeSystemStats(),
        systemQueries.executeSystemStats(),
        systemQueries.executeSystemStats()
      ])

      // Verify consistency
      expect(stats1.memory.total).toBe(stats2.memory.total)
      expect(stats2.memory.total).toBe(stats3.memory.total)

      // Verify timestamps are recent and close to each other
      const timestamps = [stats1.timestamp, stats2.timestamp, stats3.timestamp]
      const times = timestamps.map(t => t.getTime())
      const maxDiff = Math.max(...times) - Math.min(...times)

      // Timestamps should be within 100ms of each other
      expect(maxDiff).toBeLessThan(100)
    })

    test('should include accurate database statistics', async () => {
      // Execute some test queries
      testDb.query('SELECT 1').get()
      testDb.query('SELECT 2').get()
      testDb.query('SELECT 3').get()

      const stats = await systemQueries.executeSystemStats()

      // Verify database stats are present
      expect(stats.database).toBeDefined()
      expect(stats.database.connectionCount).toBeGreaterThan(0)
      expect(stats.database.queryCount).toBeGreaterThan(0)
      expect(stats.database.averageQueryTime).toBeGreaterThanOrEqual(0)
    })

    test('should calculate memory percentages correctly', async () => {
      const stats = await systemQueries.executeSystemStats()

      // Verify memory calculations
      const calculatedPercentage = (stats.memory.used / stats.memory.total) * 100
      expect(Math.abs(stats.memory.percentage - calculatedPercentage)).toBeLessThan(0.01)

      // Verify heap memory is subset of total memory
      expect(stats.memory.heap.used).toBeLessThanOrEqual(stats.memory.used)
      expect(stats.memory.heap.total).toBeLessThanOrEqual(stats.memory.total)
    })

    test('should handle concurrent query execution', async () => {
      // Create multiple concurrent executions
      const concurrentCount = 10
      const promises = Array.from({ length: concurrentCount }, () =>
        systemQueries.executeSystemStats()
      )

      const startTime = performance.now()
      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime

      // All should succeed
      expect(results).toHaveLength(concurrentCount)
      results.forEach(stats => {
        const validation = validator.validateSystemStats(stats)
        expect(validation.isValid).toBe(true)
      })

      // Total time should still be reasonable (not linear with count)
      expect(totalTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxSystemStatsTime * 3)
    })

    test('should provide accurate process information', async () => {
      const stats = await systemQueries.executeSystemStats()

      // Verify process information
      expect(stats.process.pid).toBe(process.pid)
      expect(stats.process.platform).toBe(process.platform)
      expect(stats.process.version).toBeDefined()
      expect(stats.process.cpu).toBeGreaterThanOrEqual(0)
      expect(stats.process.cpu).toBeLessThanOrEqual(100)

      // Verify memory details
      expect(stats.process.memoryDetails.rss).toBeGreaterThan(0)
      expect(stats.process.memoryDetails.heapUsed).toBeGreaterThan(0)
      expect(stats.process.memoryDetails.heapTotal).toBeGreaterThan(0)
      expect(stats.process.memoryDetails.heapEfficiency).toBeGreaterThanOrEqual(0)
      expect(stats.process.memoryDetails.heapEfficiency).toBeLessThanOrEqual(100)
    })

    test('should reflect current system uptime', async () => {
      const stats = await systemQueries.executeSystemStats()

      // Verify uptime is reasonable
      expect(stats.uptime).toBeGreaterThan(0)
      expect(stats.uptime).toBeLessThan(Number.MAX_SAFE_INTEGER)

      // Wait a bit and check uptime increases
      await new Promise(resolve => setTimeout(resolve, 100))
      const stats2 = await systemQueries.executeSystemStats()

      expect(stats2.uptime).toBeGreaterThan(stats.uptime)
    })

    test('should categorize memory pressure correctly', async () => {
      const stats = await systemQueries.executeSystemStats()
      const memoryPressure = stats.process.memoryDetails.memoryPressure

      // Verify memory pressure is categorized correctly
      if (stats.memory.percentage < 70) {
        expect(memoryPressure).toBe('low')
      } else if (stats.memory.percentage < 85) {
        expect(memoryPressure).toBe('medium')
      } else {
        expect(memoryPressure).toBe('high')
      }
    })
  })
})