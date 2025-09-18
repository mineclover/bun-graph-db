import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SystemQueries } from '../../src/services/system-queries';

describe('System API Failures Error Handling', () => {
  let db: Database;
  let systemQueries: SystemQueries;
  let tempDbPath: string;

  beforeEach(() => {
    // Create temp database for testing
    tempDbPath = path.join(__dirname, '../temp-dbs', `test-api-errors-${Date.now()}.sqlite`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempDbPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    db = new Database(tempDbPath);
    systemQueries = new SystemQueries(db);
  });

  afterEach(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('Process Memory API Failures', () => {
    it('should handle process.memoryUsage() failure gracefully', async () => {
      // Mock process.memoryUsage to throw error
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => {
        throw new Error('Memory API failure');
      };

      try {
        const stats = await systemQueries.memoryStats();

        // Should return safe defaults
        expect(stats).toBeDefined();
        expect(stats.heapUsed).toBe(0);
        expect(stats.heapTotal).toBe(0);
        expect(stats.rss).toBe(0);
        expect(stats.external).toBe(0);
        expect(stats.error).toContain('Memory API failure');
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    it('should handle partial memory data corruption', async () => {
      // Mock process.memoryUsage to return invalid data
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        rss: -1000, // Invalid negative value
        heapTotal: NaN, // Not a number
        heapUsed: Infinity, // Infinite value
        external: undefined as any, // Undefined value
        arrayBuffers: 1024,
      });

      try {
        const stats = await systemQueries.memoryStats();

        // Should sanitize invalid values
        expect(stats).toBeDefined();
        expect(stats.rss).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(stats.heapTotal)).toBe(true);
        expect(Number.isFinite(stats.heapUsed)).toBe(true);
        expect(Number.isFinite(stats.external)).toBe(true);
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });

  describe('Process CPU API Failures', () => {
    it('should handle process.cpuUsage() failure gracefully', async () => {
      // Mock process.cpuUsage to throw error
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = () => {
        throw new Error('CPU API failure');
      };

      try {
        const stats = await systemQueries.systemStats();

        // Should return safe defaults
        expect(stats).toBeDefined();
        expect(stats.cpuUsage).toBeDefined();
        expect(stats.cpuUsage.user).toBe(0);
        expect(stats.cpuUsage.system).toBe(0);
        expect(stats.error).toContain('CPU API failure');
      } finally {
        process.cpuUsage = originalCpuUsage;
      }
    });

    it('should handle invalid CPU usage data', async () => {
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = () => ({
        user: -5000000, // Negative microseconds
        system: NaN as any, // Not a number
      });

      try {
        const stats = await systemQueries.systemStats();

        // Should sanitize invalid values
        expect(stats).toBeDefined();
        expect(stats.cpuUsage.user).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(stats.cpuUsage.system)).toBe(true);
      } finally {
        process.cpuUsage = originalCpuUsage;
      }
    });
  });

  describe('OS Module API Failures', () => {
    it('should handle os.cpus() failure', async () => {
      // Mock os.cpus to throw error
      const originalCpus = os.cpus;
      (os as any).cpus = () => {
        throw new Error('OS CPU info unavailable');
      };

      try {
        const stats = await systemQueries.systemStats();

        expect(stats).toBeDefined();
        expect(stats.cpuCount).toBe(1); // Should default to 1
        expect(stats.error).toContain('OS CPU info unavailable');
      } finally {
        (os as any).cpus = originalCpus;
      }
    });

    it('should handle os.totalmem() failure', async () => {
      const originalTotalmem = os.totalmem;
      (os as any).totalmem = () => {
        throw new Error('Total memory unavailable');
      };

      try {
        const stats = await systemQueries.memoryStats();

        expect(stats).toBeDefined();
        expect(stats.totalMemory).toBe(0);
        expect(stats.memoryUsagePercent).toBe(0);
        expect(stats.error).toContain('Total memory unavailable');
      } finally {
        (os as any).totalmem = originalTotalmem;
      }
    });

    it('should handle os.freemem() failure', async () => {
      const originalFreemem = os.freemem;
      (os as any).freemem = () => {
        throw new Error('Free memory unavailable');
      };

      try {
        const stats = await systemQueries.memoryStats();

        expect(stats).toBeDefined();
        expect(stats.freeMemory).toBe(0);
        expect(stats.error).toContain('Free memory unavailable');
      } finally {
        (os as any).freemem = originalFreemem;
      }
    });

    it('should handle os.loadavg() failure', async () => {
      const originalLoadavg = os.loadavg;
      (os as any).loadavg = () => {
        throw new Error('Load average unavailable');
      };

      try {
        const stats = await systemQueries.systemStats();

        expect(stats).toBeDefined();
        expect(stats.loadAverage).toEqual([0, 0, 0]);
        expect(stats.error).toContain('Load average unavailable');
      } finally {
        (os as any).loadavg = originalLoadavg;
      }
    });

    it('should handle empty CPU array from os.cpus()', async () => {
      const originalCpus = os.cpus;
      (os as any).cpus = () => [];

      try {
        const stats = await systemQueries.systemStats();

        expect(stats).toBeDefined();
        expect(stats.cpuCount).toBe(1); // Should default to 1
      } finally {
        (os as any).cpus = originalCpus;
      }
    });
  });

  describe('File System API Failures', () => {
    it('should handle fs.statSync() failure for database file', async () => {
      // Mock fs.statSync to throw error
      const originalStatSync = fs.statSync;
      (fs as any).statSync = () => {
        throw new Error('File stat failed');
      };

      try {
        const stats = await systemQueries.getDatabaseStats();

        expect(stats).toBeDefined();
        expect(stats.databaseSize).toBe(0);
        expect(stats.formattedSize).toBe('0 B');
        expect(stats.error).toContain('File stat failed');
      } finally {
        (fs as any).statSync = originalStatSync;
      }
    });

    it('should handle permission denied errors', async () => {
      const originalStatSync = fs.statSync;
      (fs as any).statSync = () => {
        const error: any = new Error('EACCES: permission denied');
        error.code = 'EACCES';
        throw error;
      };

      try {
        const stats = await systemQueries.getDatabaseStats();

        expect(stats).toBeDefined();
        expect(stats.databaseSize).toBe(0);
        expect(stats.error).toContain('permission denied');
      } finally {
        (fs as any).statSync = originalStatSync;
      }
    });

    it('should handle file not found errors', async () => {
      const originalStatSync = fs.statSync;
      (fs as any).statSync = () => {
        const error: any = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        throw error;
      };

      try {
        const stats = await systemQueries.getDatabaseStats();

        expect(stats).toBeDefined();
        expect(stats.databaseSize).toBe(0);
        expect(stats.fileExists).toBe(false);
        expect(stats.error).toContain('no such file');
      } finally {
        (fs as any).statSync = originalStatSync;
      }
    });
  });

  describe('Database Connection Failures', () => {
    it('should handle database connection closure gracefully', async () => {
      // Close database connection
      db.close();

      try {
        const stats = await systemQueries.getDatabaseStats();

        expect(stats).toBeDefined();
        expect(stats.error).toContain('database');
        expect(stats.tableCount).toBe(0);
      } catch (error: any) {
        // If it throws, the error should be about database being closed
        expect(error.message).toContain('database');
      }
    });

    it('should handle corrupted database file', async () => {
      // Write garbage to database file
      fs.writeFileSync(tempDbPath, 'corrupted data');

      // Try to reconnect
      try {
        const corruptDb = new Database(tempDbPath);
        const corruptQueries = new SystemQueries(corruptDb);
        const stats = await corruptQueries.getDatabaseStats();

        expect(stats).toBeDefined();
        expect(stats.error).toBeDefined();
      } catch (error: any) {
        // Expected to fail
        expect(error.message).toContain('database');
      }
    });

    it('should handle locked database', async () => {
      // Simulate database lock
      db.exec('BEGIN EXCLUSIVE TRANSACTION');

      // Create another connection that will be blocked
      const db2 = new Database(tempDbPath);
      const systemQueries2 = new SystemQueries(db2);

      try {
        // Set a short timeout
        db2.pragma('busy_timeout = 100');

        const stats = await systemQueries2.getDatabaseStats();

        // Might succeed or fail depending on timing
        expect(stats).toBeDefined();
      } catch (error: any) {
        expect(error.message).toContain('locked');
      } finally {
        db2.close();
        db.exec('ROLLBACK');
      }
    });
  });

  describe('Concurrent API Failures', () => {
    it('should handle multiple simultaneous API failures', async () => {
      // Mock multiple APIs to fail
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;
      const originalCpus = os.cpus;

      process.memoryUsage = () => {
        throw new Error('Memory failure');
      };
      process.cpuUsage = () => {
        throw new Error('CPU failure');
      };
      (os as any).cpus = () => {
        throw new Error('OS failure');
      };

      try {
        const [memStats, sysStats] = await Promise.all([
          systemQueries.memoryStats(),
          systemQueries.systemStats(),
        ]);

        // Both should handle failures gracefully
        expect(memStats).toBeDefined();
        expect(sysStats).toBeDefined();
        expect(memStats.error).toBeDefined();
        expect(sysStats.error).toBeDefined();
      } finally {
        process.memoryUsage = originalMemoryUsage;
        process.cpuUsage = originalCpuUsage;
        (os as any).cpus = originalCpus;
      }
    });

    it('should continue working after transient API failures', async () => {
      let callCount = 0;
      const originalMemoryUsage = process.memoryUsage;

      // Fail first 2 calls, then succeed
      process.memoryUsage = function() {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Transient failure');
        }
        return originalMemoryUsage.call(process);
      };

      try {
        // First call - should fail
        const stats1 = await systemQueries.memoryStats();
        expect(stats1.error).toContain('Transient failure');

        // Second call - should fail
        const stats2 = await systemQueries.memoryStats();
        expect(stats2.error).toContain('Transient failure');

        // Third call - should succeed
        const stats3 = await systemQueries.memoryStats();
        expect(stats3.error).toBeUndefined();
        expect(stats3.heapUsed).toBeGreaterThan(0);
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });

  describe('Error Message Quality', () => {
    it('should provide meaningful error messages', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => {
        throw new Error('ENOMEM: Cannot allocate memory');
      };

      try {
        const stats = await systemQueries.memoryStats();

        expect(stats.error).toBeDefined();
        expect(stats.error).toContain('ENOMEM');
        expect(stats.error).toContain('memory');
        expect(stats.errorCode).toBe('ENOMEM');
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    it('should categorize error types correctly', async () => {
      const testCases = [
        { error: new Error('EACCES'), category: 'permission' },
        { error: new Error('ENOENT'), category: 'not_found' },
        { error: new Error('ENOMEM'), category: 'resource' },
        { error: new Error('SQLITE_BUSY'), category: 'database' },
        { error: new Error('Unknown error'), category: 'unknown' },
      ];

      for (const testCase of testCases) {
        const category = systemQueries.categorizeError(testCase.error);
        expect(category).toBe(testCase.category);
      }
    });

    it('should include recovery suggestions in errors', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => {
        const error: any = new Error('Out of memory');
        error.code = 'ENOMEM';
        throw error;
      };

      try {
        const stats = await systemQueries.memoryStats();

        expect(stats.error).toBeDefined();
        expect(stats.recoverySuggestion).toBeDefined();
        expect(stats.recoverySuggestion).toContain('memory');
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });

  describe('Timeout and Performance Under Failure', () => {
    it('should timeout long-running failed operations', async () => {
      // Mock a hanging operation
      const originalStatSync = fs.statSync;
      (fs as any).statSync = () => {
        // Simulate a hanging operation
        const start = Date.now();
        while (Date.now() - start < 10000) {
          // Busy wait for 10 seconds
        }
        throw new Error('Timeout');
      };

      try {
        const startTime = Date.now();
        const promise = systemQueries.getDatabaseStats({ timeout: 1000 });

        // Should timeout within 1.5 seconds (1s timeout + overhead)
        await expect(promise).rejects.toThrow('timeout');
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(1500);
      } finally {
        (fs as any).statSync = originalStatSync;
      }
    });

    it('should degrade gracefully under high failure rate', async () => {
      let failureCount = 0;
      const originalMemoryUsage = process.memoryUsage;

      // Fail 80% of calls
      process.memoryUsage = function() {
        if (Math.random() < 0.8) {
          failureCount++;
          throw new Error('Random failure');
        }
        return originalMemoryUsage.call(process);
      };

      try {
        const results = [];
        for (let i = 0; i < 10; i++) {
          const stats = await systemQueries.memoryStats();
          results.push(stats);
        }

        // At least some should have failed
        const failures = results.filter(r => r.error !== undefined);
        expect(failures.length).toBeGreaterThan(0);

        // But all should return valid structure
        results.forEach(stats => {
          expect(stats).toBeDefined();
          expect(stats.heapUsed).toBeDefined();
          expect(stats.heapTotal).toBeDefined();
        });
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });
});