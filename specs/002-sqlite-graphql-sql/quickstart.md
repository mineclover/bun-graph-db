# Quickstart Guide: System Query Testing Framework

## Overview
This guide demonstrates how to set up and run comprehensive tests for system monitoring queries (systemStats, memoryStats, healthCheck) using file-based SQLite databases with isolated test environments.

## Prerequisites
- Bun runtime installed and configured
- Existing bun-graph-db project setup
- Access to system monitoring APIs (process.memoryUsage, etc.)

## Quick Start

### 1. Run the Complete Test Suite
```bash
# Run all system query tests
bun test tests/system-queries/

# Run specific system query tests
bun test tests/system-queries/system-stats.test.ts
bun test tests/system-queries/memory-stats.test.ts
bun test tests/system-queries/health-check.test.ts

# Run with verbose output
bun test --verbose tests/system-queries/

# Run with coverage
bun test --coverage tests/system-queries/
```

### 2. Test Database Management
```typescript
import { createTestDatabase } from './fixtures/test-database-setup'

// Create isolated test database
const testDb = await createTestDatabase()
console.log('Test database created at:', testDb.path)

// Initialize with schema
await testDb.initializeSchema()

// Clean up when done
await testDb.cleanup()
```

### 3. Basic System Query Testing
```typescript
import { SystemQueries } from '@/presentation/graphql/queries/SystemQueries'
import { SystemMonitoringUseCase } from '@/application/use-cases/monitoring/SystemMonitoringUseCase'

// Setup test environment
const logger = new MockLogger()
const useCase = new SystemMonitoringUseCase(logger)
const systemQueries = new SystemQueries(useCase, logger)

// Test systemStats query
const stats = await systemQueries.systemStats()
console.log('System stats:', stats)

// Validate response structure
expect(stats).toHaveProperty('memory')
expect(stats).toHaveProperty('process')
expect(stats).toHaveProperty('database')
expect(stats.timestamp).toBeInstanceOf(Date)
```

## Test Scenarios

### Normal Operation Tests
Test system queries under typical operating conditions:

```typescript
describe('Normal Operation', () => {
  test('systemStats returns complete data structure', async () => {
    const stats = await systemQueries.systemStats()

    // Validate all required fields are present
    expect(stats.memory.used).toBeGreaterThan(0)
    expect(stats.memory.percentage).toBeGreaterThanOrEqual(0)
    expect(stats.memory.percentage).toBeLessThanOrEqual(100)
    expect(stats.process.pid).toBeGreaterThan(0)
    expect(stats.database.connectionCount).toBe(1) // SQLite always 1
  })

  test('memoryStats provides detailed memory breakdown', async () => {
    const memory = await systemQueries.memoryStats()

    // Validate memory calculations are consistent
    expect(memory.used + memory.free).toBeCloseTo(memory.total, 0)
    expect(memory.heap.used).toBeLessThanOrEqual(memory.heap.total)
    expect(memory.percentage).toBeCloseTo((memory.used / memory.total) * 100, 1)
  })

  test('healthCheck returns appropriate status', async () => {
    const health = await systemQueries.healthCheck()

    // Validate health status logic
    expect(['OK', 'UNHEALTHY', 'ERROR']).toContain(health.status)
    expect(health.database).toBe(true)
    expect(health.version).toBe('1.0.0')
    expect(['healthy', 'warning', 'critical']).toContain(health.memory.status)
  })
})
```

### Edge Case Tests
Test boundary conditions and edge cases:

```typescript
describe('Edge Cases', () => {
  test('memory threshold boundaries', async () => {
    // Mock memory usage at exactly 70% (healthy/warning boundary)
    const mockMemoryUsage = jest.spyOn(process, 'memoryUsage')
    mockMemoryUsage.mockReturnValue(/* memory at 70% */)

    const health = await systemQueries.healthCheck()
    expect(health.memory.status).toBe('warning')
  })

  test('zero query count handling', async () => {
    // Reset query statistics
    useCase.resetQueryStats()

    const stats = await systemQueries.systemStats()
    expect(stats.database.queryCount).toBe(0)
    expect(stats.database.averageQueryTime).toBe(0)
  })

  test('high CPU usage calculation', async () => {
    // Test CPU calculation with long uptime
    const stats = await systemQueries.systemStats()
    expect(stats.process.cpu).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(stats.process.cpu)).toBe(true)
  })
})
```

### Error Handling Tests
Test error conditions and exception handling:

```typescript
describe('Error Handling', () => {
  test('graceful handling of system API failures', async () => {
    // Mock system API failure
    const mockMemoryUsage = jest.spyOn(process, 'memoryUsage')
    mockMemoryUsage.mockImplementation(() => { throw new Error('System API failure') })

    // systemStats and memoryStats should re-throw
    await expect(systemQueries.systemStats()).rejects.toThrow()

    // healthCheck should return error status
    const health = await systemQueries.healthCheck()
    expect(health.status).toBe('ERROR')
    expect(health.database).toBe(false)
  })

  test('logger failure does not affect core functionality', async () => {
    // Mock logger failure
    const mockLogger = {
      info: jest.fn(() => { throw new Error('Logger failure') }),
      error: jest.fn(() => { throw new Error('Logger failure') }),
      debug: jest.fn(() => { throw new Error('Logger failure') })
    }

    const systemQueries = new SystemQueries(useCase, mockLogger)

    // Should still return valid results
    const stats = await systemQueries.systemStats()
    expect(stats).toBeDefined()
    expect(stats.memory).toBeDefined()
  })
})
```

## Performance Testing

### Response Time Validation
```typescript
describe('Performance Requirements', () => {
  test('systemStats executes within 200ms', async () => {
    const startTime = performance.now()
    await systemQueries.systemStats()
    const executionTime = performance.now() - startTime

    expect(executionTime).toBeLessThan(200)
  })

  test('all queries complete within 500ms total', async () => {
    const startTime = performance.now()

    await Promise.all([
      systemQueries.systemStats(),
      systemQueries.memoryStats(),
      systemQueries.healthCheck()
    ])

    const totalTime = performance.now() - startTime
    expect(totalTime).toBeLessThan(500)
  })
})
```

### Database Performance Testing
```typescript
describe('Database Performance', () => {
  test('test database setup completes within 100ms', async () => {
    const startTime = performance.now()
    const testDb = await createTestDatabase()
    const setupTime = performance.now() - startTime

    expect(setupTime).toBeLessThan(100)
    await testDb.cleanup()
  })

  test('database cleanup completes within 50ms', async () => {
    const testDb = await createTestDatabase()

    const startTime = performance.now()
    await testDb.cleanup()
    const cleanupTime = performance.now() - startTime

    expect(cleanupTime).toBeLessThan(50)
  })
})
```

## Validation and Debugging

### Data Structure Validation
```typescript
// Validate complete systemStats structure
const validateSystemStats = (stats: SystemStats) => {
  expect(stats).toMatchObject({
    memory: {
      used: expect.any(Number),
      free: expect.any(Number),
      total: expect.any(Number),
      percentage: expect.any(Number),
      heap: {
        used: expect.any(Number),
        total: expect.any(Number),
        external: expect.any(Number),
        arrayBuffers: expect.any(Number)
      }
    },
    process: {
      pid: expect.any(Number),
      cpu: expect.any(Number),
      version: expect.any(String),
      platform: expect.any(String),
      memoryDetails: {
        rss: expect.any(Number),
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        external: expect.any(Number),
        arrayBuffers: expect.any(Number),
        heapEfficiency: expect.any(Number),
        memoryPressure: expect.stringMatching(/^(low|medium|high)$/)
      }
    },
    database: {
      connectionCount: 1,
      queryCount: expect.any(Number),
      averageQueryTime: expect.any(Number)
    },
    timestamp: expect.any(Date),
    uptime: expect.any(Number)
  })
}
```

### Test Debugging
```typescript
// Enable detailed logging for debugging
const debugLogger = {
  info: (message: string, data?: any) => console.log('INFO:', message, data),
  error: (message: string, data?: any) => console.error('ERROR:', message, data),
  debug: (message: string, data?: any) => console.debug('DEBUG:', message, data)
}

// Create debug-enabled system queries
const debugSystemQueries = new SystemQueries(useCase, debugLogger)

// Run with detailed output
const stats = await debugSystemQueries.systemStats()
console.log('Detailed system stats:', JSON.stringify(stats, null, 2))
```

## Common Issues and Solutions

### Database File Conflicts
```bash
# Issue: Test database files already exist
# Solution: Ensure cleanup is called in afterEach/afterAll
Error: EBUSY: resource busy or locked, open 'test-db-12345.sqlite'

# Fix: Add proper cleanup in test teardown
afterEach(async () => {
  if (testDb) {
    await testDb.cleanup()
  }
})
```

### Memory Calculation Inconsistencies
```typescript
// Issue: Memory percentages don't match expected values
// Solution: Account for system overhead and rounding
expect(memory.percentage).toBeCloseTo((memory.used / memory.total) * 100, 1)
```

### Performance Test Failures
```bash
# Issue: Tests fail due to slow system performance
# Solution: Adjust performance thresholds for CI environments
const MAX_EXECUTION_TIME = process.env.CI ? 500 : 200 // Allow more time in CI
```

## Next Steps

1. **Run the complete test suite** to validate system monitoring functionality
2. **Review test results** to identify any edge cases or performance issues
3. **Customize test scenarios** based on specific system monitoring requirements
4. **Integrate with CI/CD pipeline** for automated system monitoring validation
5. **Monitor test performance** and adjust thresholds as needed for different environments