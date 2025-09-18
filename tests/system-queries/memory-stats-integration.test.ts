/**
 * Memory Stats Integration Test
 *
 * CRITICAL: These tests MUST FAIL initially (TDD Red phase)
 * Tests the complete integration of memoryStats query execution
 * from GraphQL layer through use cases to database
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import type Database from 'bun:sqlite'
import type {
  SystemQueryExecutionContract,
} from '../../specs/002-sqlite-graphql-sql/contracts/system-query-contract'
import { SystemQueryBehaviorContract } from '../../specs/002-sqlite-graphql-sql/contracts/system-query-contract'

// These imports WILL FAIL - implementation not created yet (TDD Red phase)
import { TestDatabaseManager } from './fixtures/database-manager'
import { SystemQueries } from '@/presentation/graphql/queries/SystemQueries'
import { SystemMonitoringUseCase } from '@/application/use-cases/monitoring/SystemMonitoringUseCase'
import { SqliteConnection } from '@/infrastructure/database/sqlite/SqliteConnection'
import { SystemQueryValidator } from './fixtures/system-query-validation'

describe('MemoryStats Integration Test', () => {
  let _testDb: Database
  let dbManager: TestDatabaseManager
  let systemQueries: SystemQueryExecutionContract
  let validator: SystemQueryValidator
  let connection: SqliteConnection

  beforeAll(async () => {
    // This WILL FAIL - TestDatabaseManager not implemented yet
    dbManager = TestDatabaseManager.getInstance()
    const { db, path } = await dbManager.createManaged({
      prefix: 'memory-stats-integration',
      optimizeForTesting: true
    })
    _testDb = db

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
    test('should execute complete memoryStats query through all layers', async () => {
      // Measure total execution time
      const startTime = performance.now()

      const stats = await systemQueries.executeMemoryStats()

      const executionTime = performance.now() - startTime

      // Verify performance requirement
      expect(executionTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxMemoryStatsTime)

      // Validate response structure
      const validation = validator.validateMemoryStats(stats)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should return valid memory calculations', async () => {
      const stats = await systemQueries.executeMemoryStats()

      // Verify memory relationships
      expect(stats.used + stats.free).toBe(stats.total)
      expect(stats.used).toBeGreaterThan(0)
      expect(stats.free).toBeGreaterThanOrEqual(0)
      expect(stats.total).toBeGreaterThan(0)

      // Verify percentage calculation
      const expectedPercentage = (stats.used / stats.total) * 100
      expect(Math.abs(stats.percentage - expectedPercentage)).toBeLessThan(0.01)
    })

    test('should provide detailed heap statistics', async () => {
      const stats = await systemQueries.executeMemoryStats()

      // Verify heap stats are present
      expect(stats.heap).toBeDefined()
      expect(stats.heap.used).toBeGreaterThan(0)
      expect(stats.heap.total).toBeGreaterThan(0)
      expect(stats.heap.external).toBeGreaterThanOrEqual(0)
      expect(stats.heap.arrayBuffers).toBeGreaterThanOrEqual(0)

      // Verify heap relationships
      expect(stats.heap.used).toBeLessThanOrEqual(stats.heap.total)
      expect(stats.heap.used).toBeLessThanOrEqual(stats.used)
      expect(stats.heap.total).toBeLessThanOrEqual(stats.total)
    })

    test('should handle concurrent memory queries efficiently', async () => {
      // Create multiple concurrent executions
      const concurrentCount = 20
      const promises = Array.from({ length: concurrentCount }, () =>
        systemQueries.executeMemoryStats()
      )

      const startTime = performance.now()
      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime

      // All should succeed
      expect(results).toHaveLength(concurrentCount)
      results.forEach(stats => {
        const validation = validator.validateMemoryStats(stats)
        expect(validation.isValid).toBe(true)
      })

      // Total time should indicate parallelization benefit
      expect(totalTime).toBeLessThan(SystemQueryBehaviorContract.performance.maxMemoryStatsTime * 5)
    })

    test('should reflect memory changes during execution', async () => {
      const statsBefore = await systemQueries.executeMemoryStats()

      // Allocate some memory
      const largeArray = new Array(1000000).fill('test-data')

      const statsAfter = await systemQueries.executeMemoryStats()

      // Memory usage should have increased
      expect(statsAfter.used).toBeGreaterThan(statsBefore.used)
      expect(statsAfter.heap.used).toBeGreaterThan(statsBefore.heap.used)

      // Clean up
      largeArray.length = 0
    })

    test('should maintain percentage accuracy across different memory states', async () => {
      // Execute query multiple times
      const iterations = 10
      for (let i = 0; i < iterations; i++) {
        const stats = await systemQueries.executeMemoryStats()

        // Verify percentage is always in valid range
        expect(stats.percentage).toBeGreaterThanOrEqual(0)
        expect(stats.percentage).toBeLessThanOrEqual(100)

        // Verify percentage calculation accuracy
        const calculatedPercentage = (stats.used / stats.total) * 100
        expect(Math.abs(stats.percentage - calculatedPercentage)).toBeLessThan(0.01)
      }
    })

    test('should provide consistent memory totals', async () => {
      // Total memory should not change significantly during test
      const measurements = await Promise.all(
        Array.from({ length: 5 }, () => systemQueries.executeMemoryStats())
      )

      const totals = measurements.map(m => m.total)
      const minTotal = Math.min(...totals)
      const maxTotal = Math.max(...totals)

      // Total memory should be stable (within 1% variance)
      const variance = ((maxTotal - minTotal) / minTotal) * 100
      expect(variance).toBeLessThan(1)
    })

    test('should handle memory query during garbage collection', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Query should still succeed during GC
      const stats = await systemQueries.executeMemoryStats()

      // Validate results
      const validation = validator.validateMemoryStats(stats)
      expect(validation.isValid).toBe(true)

      // Values should still be reasonable
      expect(stats.used).toBeGreaterThan(0)
      expect(stats.percentage).toBeGreaterThan(0)
      expect(stats.percentage).toBeLessThan(100)
    })

    test('should track array buffer allocations correctly', async () => {
      const statsBefore = await systemQueries.executeMemoryStats()

      // Allocate array buffers
      const buffers = Array.from({ length: 10 }, () => new ArrayBuffer(1024 * 1024)) // 10MB

      const statsAfter = await systemQueries.executeMemoryStats()

      // Array buffer usage should have increased
      expect(statsAfter.heap.arrayBuffers).toBeGreaterThanOrEqual(statsBefore.heap.arrayBuffers)

      // Clean up
      buffers.length = 0
    })

    test('should provide valid external memory tracking', async () => {
      const stats = await systemQueries.executeMemoryStats()

      // External memory should be non-negative
      expect(stats.heap.external).toBeGreaterThanOrEqual(0)

      // External memory should be reasonable relative to heap
      expect(stats.heap.external).toBeLessThan(stats.heap.total * 10) // Sanity check
    })
  })
})