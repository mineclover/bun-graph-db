import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { Logger } from '../../src/application/services/system-queries'
import { SystemQueries } from '../../src/application/services/system-queries'

describe('SystemQueries', () => {
  let systemQueries: SystemQueries
  let mockDb: any
  let mockLogger: Logger

  beforeEach(() => {
    // Mock database
    mockDb = {
      filename: './test.db',
      prepare: mock(() => ({
        all: mock(() => []),
        get: mock(() => ({ count: 0 })),
      })),
    }

    // Mock logger
    mockLogger = {
      log: mock(() => {}),
      error: mock(() => {}),
    }

    systemQueries = new SystemQueries(mockDb)
    systemQueries.setLogger(mockLogger)
  })

  describe('systemStats', () => {
    it('should return system statistics', async () => {
      const result = await systemQueries.systemStats()

      expect(result).toHaveProperty('cpuUsage')
      expect(result).toHaveProperty('memory')
      expect(result).toHaveProperty('cpuCount')
      expect(result).toHaveProperty('loadAverage')
      expect(result).toHaveProperty('uptime')
      expect(result).toHaveProperty('platform')

      expect(result.cpuUsage).toHaveProperty('user')
      expect(result.cpuUsage).toHaveProperty('system')
      expect(result.memory).toHaveProperty('heapUsed')
      expect(result.memory).toHaveProperty('heapTotal')
      expect(result.memory).toHaveProperty('rss')
      expect(result.memory).toHaveProperty('external')

      expect(typeof result.cpuCount).toBe('number')
      expect(Array.isArray(result.loadAverage)).toBe(true)
      expect(typeof result.uptime).toBe('number')
      expect(typeof result.platform).toBe('string')
    })

    it('should handle CPU usage calculation safely', async () => {
      const result = await systemQueries.systemStats()

      expect(result.cpuUsage.user).toBeGreaterThanOrEqual(0)
      expect(result.cpuUsage.system).toBeGreaterThanOrEqual(0)
      expect(typeof result.cpuUsage.percentage).toBe('number')
    })
  })

  describe('memoryStats', () => {
    it('should return memory statistics', async () => {
      const result = await systemQueries.memoryStats()

      expect(result).toHaveProperty('heapUsed')
      expect(result).toHaveProperty('heapTotal')
      expect(result).toHaveProperty('rss')
      expect(result).toHaveProperty('external')
      expect(result).toHaveProperty('heapUsagePercent')
      expect(result).toHaveProperty('memoryUsagePercent')
      expect(result).toHaveProperty('totalMemory')
      expect(result).toHaveProperty('freeMemory')

      expect(typeof result.heapUsed).toBe('number')
      expect(typeof result.heapTotal).toBe('number')
      expect(typeof result.rss).toBe('number')
      expect(typeof result.external).toBe('number')
      expect(typeof result.heapUsagePercent).toBe('number')
    })

    it('should calculate memory percentages correctly', async () => {
      const result = await systemQueries.memoryStats()

      expect(result.heapUsagePercent).toBeGreaterThanOrEqual(0)
      expect(result.heapUsagePercent).toBeLessThanOrEqual(100)
      expect(result.memoryUsagePercent).toBeGreaterThanOrEqual(0)
      expect(result.memoryUsagePercent).toBeLessThanOrEqual(200) // Cap at 200%
    })

    it('should handle zero memory values safely', async () => {
      const result = await systemQueries.memoryStats()

      // All values should be non-negative numbers
      expect(result.heapUsed).toBeGreaterThanOrEqual(0)
      expect(result.heapTotal).toBeGreaterThanOrEqual(0)
      expect(result.rss).toBeGreaterThanOrEqual(0)
      expect(result.external).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getDatabaseStats', () => {
    it('should return database statistics when DB is available', async () => {
      // Configure mock database to return sample data
      mockDb.prepare = mock((query: string) => {
        if (query.includes('table')) {
          return { all: () => [{ name: 'users' }, { name: 'posts' }] }
        }
        if (query.includes('index')) {
          return { all: () => [{ name: 'idx_users' }] }
        }
        if (query.includes('COUNT')) {
          return { get: () => ({ count: 100 }) }
        }
        return { all: () => [], get: () => ({ count: 0 }) }
      })

      const result = await systemQueries.getDatabaseStats()

      expect(result).toHaveProperty('tableCount')
      expect(result).toHaveProperty('totalRows')
      expect(result).toHaveProperty('indexCount')
      expect(result).toHaveProperty('databaseSize')
      expect(result).toHaveProperty('formattedSize')
      expect(result).toHaveProperty('avgRowsPerTable')
      expect(result).toHaveProperty('tables')
      expect(result).toHaveProperty('indices')
      expect(result).toHaveProperty('fileExists')

      expect(typeof result.tableCount).toBe('number')
      expect(typeof result.totalRows).toBe('number')
      expect(typeof result.indexCount).toBe('number')
      expect(typeof result.databaseSize).toBe('number')
      expect(typeof result.formattedSize).toBe('string')
      expect(Array.isArray(result.tables)).toBe(true)
      expect(Array.isArray(result.indices)).toBe(true)
    })

    it('should handle null database connection', async () => {
      systemQueries = new SystemQueries(null)

      const result = await systemQueries.getDatabaseStats()

      expect(result.error).toBeDefined()
      expect(result.tableCount).toBe(0)
      expect(result.totalRows).toBe(0)
      expect(result.indexCount).toBe(0)
      expect(result.fileExists).toBe(false)
    })

    it('should handle database query errors', async () => {
      mockDb.prepare = mock(() => {
        throw new Error('Database error')
      })

      const result = await systemQueries.getDatabaseStats()

      // Private helper methods catch and return empty arrays, so no error is propagated
      expect(result.error).toBeUndefined()
      expect(result.tableCount).toBe(0)
      expect(result.totalRows).toBe(0)
      expect(result.indexCount).toBe(0)
    })
  })

  describe('healthCheck', () => {
    it('should return health check results', async () => {
      const result = await systemQueries.healthCheck()

      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('memory')
      expect(result).toHaveProperty('cpu')
      expect(result).toHaveProperty('database')
      expect(result).toHaveProperty('timestamp')

      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status)
      expect(typeof result.score).toBe('number')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.timestamp).toBeInstanceOf(Date)

      expect(result.memory).toHaveProperty('status')
      expect(result.memory).toHaveProperty('usage')
      expect(result.cpu).toHaveProperty('status')
      expect(result.cpu).toHaveProperty('usage')
      expect(result.database).toHaveProperty('status')
      expect(result.database).toHaveProperty('connected')
    })

    it('should return unhealthy status when database is unavailable', async () => {
      systemQueries = new SystemQueries(null)

      const result = await systemQueries.healthCheck()

      expect(result.status).toBe('unhealthy')
      expect(result.database.connected).toBe(false)
      expect(result.database.status).toBe('unhealthy')
    })
  })

  describe('helper methods', () => {
    describe('formatBytes', () => {
      it('should format bytes correctly', () => {
        expect(systemQueries.formatBytes(0)).toBe('0 B')
        expect(systemQueries.formatBytes(1024)).toBe('1.00 KB')
        expect(systemQueries.formatBytes(1048576)).toBe('1.00 MB')
        expect(systemQueries.formatBytes(1073741824)).toBe('1.00 GB')
        expect(systemQueries.formatBytes(1099511627776)).toBe('1.00 TB')
      })

      it('should handle negative bytes', () => {
        expect(systemQueries.formatBytes(-1024)).toBe('1.00 KB')
        expect(systemQueries.formatBytes(-1048576)).toBe('1.00 MB')
      })

      it('should handle very large numbers', () => {
        const result = systemQueries.formatBytes(999999999999999)
        expect(result).toContain('TB')
      })
    })

    describe('safeDivide', () => {
      it('should divide numbers safely', () => {
        expect(systemQueries.safeDivide(10, 2)).toBe(5)
        expect(systemQueries.safeDivide(7, 3)).toBeCloseTo(2.33, 2)
        expect(systemQueries.safeDivide(0, 5)).toBe(0)
      })

      it('should handle division by zero', () => {
        expect(systemQueries.safeDivide(10, 0)).toBe(0)
        expect(systemQueries.safeDivide(0, 0)).toBe(0)
      })

      it('should handle invalid numbers', () => {
        expect(systemQueries.safeDivide(NaN, 5)).toBe(0)
        expect(systemQueries.safeDivide(10, NaN)).toBe(0)
        expect(systemQueries.safeDivide(Infinity, 5)).toBe(0)
        expect(systemQueries.safeDivide(10, Infinity)).toBe(0)
      })
    })

    describe('calculateRate', () => {
      it('should calculate rate per second', () => {
        expect(systemQueries.calculateRate(100, 1000)).toBe(100)
        expect(systemQueries.calculateRate(50, 500)).toBe(100)
        expect(systemQueries.calculateRate(200, 2000)).toBe(100)
      })

      it('should handle edge cases', () => {
        expect(systemQueries.calculateRate(10, 0)).toBe(10000)
        expect(systemQueries.calculateRate(0, 1000)).toBe(0)
      })
    })

    describe('calculatePercentage', () => {
      it('should calculate percentage correctly', () => {
        expect(systemQueries.calculatePercentage(50, 100)).toBe(50)
        expect(systemQueries.calculatePercentage(75, 100)).toBe(75)
        expect(systemQueries.calculatePercentage(25, 50)).toBe(50)
      })

      it('should handle edge cases', () => {
        expect(systemQueries.calculatePercentage(10, 0)).toBe(0)
        expect(systemQueries.calculatePercentage(-5, 100)).toBe(0)
        expect(systemQueries.calculatePercentage(0, 100)).toBe(0)
      })
    })

    describe('calculateMean', () => {
      it('should calculate mean of array', () => {
        expect(systemQueries.calculateMean([1, 2, 3, 4, 5])).toBe(3)
        expect(systemQueries.calculateMean([10, 20])).toBe(15)
        expect(systemQueries.calculateMean([100])).toBe(100)
      })

      it('should handle empty array', () => {
        expect(systemQueries.calculateMean([])).toBe(0)
      })

      it('should handle arrays with zeros', () => {
        expect(systemQueries.calculateMean([0, 0, 0])).toBe(0)
        expect(systemQueries.calculateMean([0, 5, 10])).toBe(5)
      })
    })

    describe('calculateStandardDeviation', () => {
      it('should calculate standard deviation', () => {
        expect(systemQueries.calculateStandardDeviation([1, 2, 3, 4, 5])).toBeCloseTo(1.41, 1)
        expect(systemQueries.calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(
          2.0,
          1
        )
      })

      it('should handle edge cases', () => {
        expect(systemQueries.calculateStandardDeviation([10])).toBe(0)
        expect(systemQueries.calculateStandardDeviation([])).toBe(0)
        expect(systemQueries.calculateStandardDeviation([5, 5, 5])).toBe(0)
      })
    })

    describe('calculatePercentile', () => {
      it('should calculate percentile correctly', () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        expect(systemQueries.calculatePercentile(values, 50)).toBe(5)
        expect(systemQueries.calculatePercentile(values, 90)).toBe(9)
        expect(systemQueries.calculatePercentile(values, 10)).toBe(1)
      })

      it('should handle edge cases', () => {
        expect(systemQueries.calculatePercentile([], 50)).toBe(0)
        expect(systemQueries.calculatePercentile([5], 50)).toBe(5)
        expect(systemQueries.calculatePercentile([1, 2], 100)).toBe(2)
      })
    })

    describe('calculateSuccessRate', () => {
      it('should calculate success rate with bounds', () => {
        expect(systemQueries.calculateSuccessRate(80, 100)).toBe(80)
        expect(systemQueries.calculateSuccessRate(90, 100)).toBe(90)
        expect(systemQueries.calculateSuccessRate(50, 50)).toBe(100)
      })

      it('should cap at 100% and floor at 0%', () => {
        expect(systemQueries.calculateSuccessRate(120, 100)).toBe(100)
        expect(systemQueries.calculateSuccessRate(-10, 100)).toBe(0)
        expect(systemQueries.calculateSuccessRate(150, 100)).toBe(100)
      })
    })

    describe('categorizeError', () => {
      it('should categorize errors correctly', () => {
        expect(systemQueries.categorizeError(new Error('EACCES: permission denied'))).toBe(
          'permission'
        )
        expect(systemQueries.categorizeError(new Error('ENOENT: file not found'))).toBe('not_found')
        expect(systemQueries.categorizeError(new Error('ENOMEM: out of memory'))).toBe('resource')
        expect(systemQueries.categorizeError(new Error('SQLITE_ERROR: syntax error'))).toBe(
          'database'
        )
        expect(systemQueries.categorizeError(new Error('Unknown error'))).toBe('unknown')
      })

      it('should handle non-Error objects', () => {
        expect(systemQueries.categorizeError('EACCES error')).toBe('permission')
        expect(systemQueries.categorizeError({ message: 'SQLITE issue' })).toBe('database')
        expect(systemQueries.categorizeError({ toString: () => 'ENOENT error' })).toBe('not_found')
      })
    })
  })

  describe('logger functionality', () => {
    it('should log safely when logger is available', () => {
      systemQueries.safeLog('Test message')
      systemQueries.safeLog('Error message', true)

      expect(mockLogger.log).toHaveBeenCalledWith('Test message')
      expect(mockLogger.error).toHaveBeenCalledWith('Error message')
    })

    it('should handle missing logger gracefully', () => {
      systemQueries.setLogger(null)

      // Should not throw when logger is null
      expect(() => systemQueries.safeLog('Test message')).not.toThrow()
      expect(() => systemQueries.safeLog('Error message', true)).not.toThrow()
    })

    it('should handle logger errors silently', () => {
      const failingLogger = {
        log: mock(() => {
          throw new Error('Logger failed')
        }),
        error: mock(() => {
          throw new Error('Logger failed')
        }),
      }
      systemQueries.setLogger(failingLogger)

      expect(() => systemQueries.safeLog('Test')).not.toThrow()
      expect(() => systemQueries.safeLog('Error', true)).not.toThrow()
    })
  })

  describe('error fallback methods', () => {
    it('should use default stats when systemStats fails completely', async () => {
      // Mock process methods to throw errors
      spyOn(process, 'cpuUsage').mockImplementation(() => {
        throw new Error('CPU error')
      })
      spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory error')
      })
      spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('Uptime error')
      })

      const sysResult = await systemQueries.systemStats()

      expect(sysResult.error).toBe('Memory error') // memoryUsage is called first
      expect(sysResult.cpuUsage.user).toBe(0)
      expect(sysResult.cpuUsage.system).toBe(0)
      expect(sysResult.cpuCount).toBe(1)
      expect(sysResult.platform).toBe(process.platform)
    })

    it('should use default stats when memoryStats fails completely', async () => {
      // Create a fresh instance to avoid interference from previous mocks
      const freshSystemQueries = new SystemQueries(mockDb)
      freshSystemQueries.setLogger(mockLogger)

      // Mock the private getMemoryUsage method to throw error
      spyOn(freshSystemQueries as any, 'getMemoryUsage').mockImplementation(() => {
        throw new Error('Memory error')
      })

      const result = await freshSystemQueries.memoryStats()

      expect(result.error).toBe('Memory error')
      expect(result.heapUsed).toBe(0)
      expect(result.heapTotal).toBe(0)
      expect(result.heapUsagePercent).toBe(0)
      expect(result.memoryUsagePercent).toBe(0)
    })

    it('should use default stats when healthCheck fails completely', async () => {
      spyOn(systemQueries, 'memoryStats').mockRejectedValue(new Error('Stats unavailable'))

      const result = await systemQueries.healthCheck()

      expect(result.status).toBe('unhealthy')
      expect(result.score).toBe(0)
      expect(result.error).toBe('Stats unavailable')
      expect(result.memory.status).toBe('unknown')
      expect(result.cpu.status).toBe('unknown')
      expect(result.database.status).toBe('disconnected')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle database without required methods', async () => {
      const emptyDb = {}
      systemQueries = new SystemQueries(emptyDb)

      const result = await systemQueries.getDatabaseStats()
      // Private helper methods catch and return empty arrays, so no error is propagated
      expect(result.error).toBeUndefined()
      expect(result.tableCount).toBe(0)
      expect(result.totalRows).toBe(0)
    })

    it('should handle database preparation errors gracefully', async () => {
      mockDb.prepare = mock(() => {
        throw new Error('SQL syntax error')
      })

      const result = await systemQueries.getDatabaseStats()
      // Private helper methods catch and return empty arrays, so no error is propagated
      expect(result.error).toBeUndefined()
      expect(result.tables).toEqual([])
      expect(result.indices).toEqual([])
      expect(result.tableCount).toBe(0)
    })

    it('should handle row counting errors per table', async () => {
      mockDb.prepare = mock((query: string) => {
        if (query.includes('table')) {
          return { all: () => [{ name: 'users' }, { name: 'bad_table' }] }
        }
        if (query.includes('COUNT') && query.includes('bad_table')) {
          throw new Error('Table corrupted')
        }
        if (query.includes('COUNT')) {
          return { get: () => ({ count: 50 }) }
        }
        return { all: () => [] }
      })

      const result = await systemQueries.getDatabaseStats()
      expect(result.totalRows).toBe(50) // Should only count successful tables
    })
  })
})
