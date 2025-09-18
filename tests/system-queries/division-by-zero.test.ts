import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SystemQueries } from '../../src/services/system-queries';

describe('Division by Zero Protection', () => {
  let db: Database;
  let systemQueries: SystemQueries;
  let tempDbPath: string;

  beforeEach(() => {
    // Create temp database for testing
    tempDbPath = path.join(__dirname, '../temp-dbs', `test-division-${Date.now()}.sqlite`);

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

  describe('CPU Usage Percentage Calculations', () => {
    it('should handle zero elapsed time in CPU percentage calculation', async () => {
      // Mock process.hrtime to return zero elapsed time
      const originalHrtime = process.hrtime;
      const _callCount = 0;

      (process as any).hrtime = (start?: [number, number]) => {
        if (start) {
          // Return zero elapsed time
          return [0, 0];
        }
        return originalHrtime.call(process);
      };

      try {
        const stats = await systemQueries.systemStats();

        // Should not crash and return safe defaults
        expect(stats).toBeDefined();
        expect(stats.cpuUsage.percentage).toBe(0);
        expect(Number.isNaN(stats.cpuUsage.percentage)).toBe(false);
        expect(Number.isFinite(stats.cpuUsage.percentage)).toBe(true);
      } finally {
        (process as any).hrtime = originalHrtime;
      }
    });

    it('should handle zero CPU count in percentage calculation', async () => {
      // Mock os.cpus to return empty array
      const originalCpus = os.cpus;
      (os as any).cpus = () => [];

      try {
        const stats = await systemQueries.systemStats();

        // Should use default CPU count of 1
        expect(stats).toBeDefined();
        expect(stats.cpuCount).toBe(1);
        expect(Number.isFinite(stats.cpuUsage.percentage)).toBe(true);
      } finally {
        (os as any).cpus = originalCpus;
      }
    });

    it('should cap CPU percentage at reasonable maximum', async () => {
      // Mock process.cpuUsage to return extremely high values
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = () => ({
        user: Number.MAX_SAFE_INTEGER,
        system: Number.MAX_SAFE_INTEGER,
      });

      try {
        const stats = await systemQueries.systemStats();

        // Should cap at reasonable percentage (e.g., 100% * CPU count)
        expect(stats).toBeDefined();
        expect(stats.cpuUsage.percentage).toBeLessThanOrEqual(100 * stats.cpuCount);
        expect(Number.isFinite(stats.cpuUsage.percentage)).toBe(true);
      } finally {
        process.cpuUsage = originalCpuUsage;
      }
    });

    it('should handle negative elapsed time gracefully', async () => {
      // Mock process.hrtime to return negative elapsed time (clock skew scenario)
      const originalHrtime = process.hrtime;

      (process as any).hrtime = (start?: [number, number]) => {
        if (start) {
          // Return negative elapsed time
          return [-1, 0];
        }
        return originalHrtime.call(process);
      };

      try {
        const stats = await systemQueries.systemStats();

        // Should handle negative time and return safe defaults
        expect(stats).toBeDefined();
        expect(stats.cpuUsage.percentage).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(stats.cpuUsage.percentage)).toBe(true);
      } finally {
        (process as any).hrtime = originalHrtime;
      }
    });
  });

  describe('Memory Usage Percentage Calculations', () => {
    it('should handle zero total memory', async () => {
      // Mock os.totalmem to return 0
      const originalTotalmem = os.totalmem;
      (os as any).totalmem = () => 0;

      try {
        const stats = await systemQueries.memoryStats();

        // Should not crash and return safe defaults
        expect(stats).toBeDefined();
        expect(stats.memoryUsagePercent).toBe(0);
        expect(Number.isNaN(stats.memoryUsagePercent)).toBe(false);
      } finally {
        (os as any).totalmem = originalTotalmem;
      }
    });

    it('should handle heap usage percentage when heapTotal is zero', async () => {
      // Mock process.memoryUsage to return zero heapTotal
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        rss: 1024,
        heapTotal: 0,
        heapUsed: 100, // Impossible but testing defense
        external: 0,
        arrayBuffers: 0,
      });

      try {
        const stats = await systemQueries.memoryStats();

        // Should handle gracefully
        expect(stats).toBeDefined();
        expect(stats.heapUsagePercent).toBe(0);
        expect(Number.isNaN(stats.heapUsagePercent)).toBe(false);
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    it('should handle memory usage greater than total memory', async () => {
      // Mock scenarios where RSS > total memory (can happen with swap)
      const originalMemoryUsage = process.memoryUsage;
      const originalTotalmem = os.totalmem;

      process.memoryUsage = () => ({
        rss: 8 * 1024 * 1024 * 1024, // 8GB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        heapUsed: 512 * 1024 * 1024, // 512MB
        external: 0,
        arrayBuffers: 0,
      });

      (os as any).totalmem = () => 4 * 1024 * 1024 * 1024; // 4GB

      try {
        const stats = await systemQueries.memoryStats();

        // Should cap percentage at reasonable maximum
        expect(stats).toBeDefined();
        expect(stats.memoryUsagePercent).toBeLessThanOrEqual(200); // Allow for swap
        expect(Number.isFinite(stats.memoryUsagePercent)).toBe(true);
      } finally {
        process.memoryUsage = originalMemoryUsage;
        (os as any).totalmem = originalTotalmem;
      }
    });
  });

  describe('Average Calculations', () => {
    it('should handle average with zero count', async () => {
      // Create empty database
      const stats = await systemQueries.getDatabaseStats();

      // avgRowsPerTable with 0 tables
      if (stats.tableCount === 0) {
        expect(stats.avgRowsPerTable).toBe(0);
        expect(Number.isNaN(stats.avgRowsPerTable)).toBe(false);
      }
    });

    it('should handle load average division safely', async () => {
      // Mock os.loadavg to return zeros
      const originalLoadavg = os.loadavg;
      (os as any).loadavg = () => [0, 0, 0];

      try {
        const stats = await systemQueries.systemStats();

        expect(stats).toBeDefined();
        expect(stats.loadAverage).toEqual([0, 0, 0]);
        // Load average per CPU should handle zero CPUs
        expect(stats.loadAveragePerCpu).toBeDefined();
        stats.loadAveragePerCpu.forEach(avg => {
          expect(Number.isFinite(avg)).toBe(true);
        });
      } finally {
        (os as any).loadavg = originalLoadavg;
      }
    });
  });

  describe('Rate Calculations', () => {
    it('should handle zero time interval in rate calculations', async () => {
      // Test query rate calculation with zero elapsed time
      const mockMetrics = {
        queryCount: 100,
        elapsedTime: 0, // Zero elapsed time
      };

      const rate = systemQueries.calculateRate(mockMetrics.queryCount, mockMetrics.elapsedTime);

      expect(Number.isNaN(rate)).toBe(false);
      expect(Number.isFinite(rate)).toBe(true);
      expect(rate).toBe(0); // Should return 0 or Infinity based on implementation
    });

    it('should handle throughput calculation with zero duration', async () => {
      const throughput = systemQueries.calculateThroughput(1000000, 0);

      expect(Number.isNaN(throughput)).toBe(false);
      expect(Number.isFinite(throughput)).toBe(true);
    });

    it('should handle operations per second with negative time', async () => {
      const opsPerSec = systemQueries.calculateOpsPerSecond(1000, -1000);

      expect(opsPerSec).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(opsPerSec)).toBe(true);
    });
  });

  describe('Statistical Calculations', () => {
    it('should handle standard deviation with single value', async () => {
      const values = [42];
      const stdDev = systemQueries.calculateStandardDeviation(values);

      expect(stdDev).toBe(0); // StdDev of single value is 0
      expect(Number.isNaN(stdDev)).toBe(false);
    });

    it('should handle standard deviation with empty array', async () => {
      const values: number[] = [];
      const stdDev = systemQueries.calculateStandardDeviation(values);

      expect(Number.isNaN(stdDev)).toBe(false);
      expect(stdDev).toBe(0);
    });

    it('should handle mean calculation with empty array', async () => {
      const values: number[] = [];
      const mean = systemQueries.calculateMean(values);

      expect(Number.isNaN(mean)).toBe(false);
      expect(mean).toBe(0);
    });

    it('should handle percentile calculation with empty array', async () => {
      const values: number[] = [];
      const p95 = systemQueries.calculatePercentile(values, 95);

      expect(Number.isNaN(p95)).toBe(false);
      expect(p95).toBe(0);
    });
  });

  describe('Ratio and Proportion Calculations', () => {
    it('should handle cache hit ratio with zero attempts', async () => {
      const ratio = systemQueries.calculateCacheHitRatio(0, 0);

      expect(Number.isNaN(ratio)).toBe(false);
      expect(ratio).toBe(0);
    });

    it('should handle success rate with zero total', async () => {
      const rate = systemQueries.calculateSuccessRate(0, 0);

      expect(Number.isNaN(rate)).toBe(false);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    });

    it('should handle utilization with zero capacity', async () => {
      const utilization = systemQueries.calculateUtilization(100, 0);

      expect(Number.isNaN(utilization)).toBe(false);
      expect(Number.isFinite(utilization)).toBe(true);
    });

    it('should handle efficiency with zero input', async () => {
      const efficiency = systemQueries.calculateEfficiency(100, 0);

      expect(Number.isNaN(efficiency)).toBe(false);
      expect(Number.isFinite(efficiency)).toBe(true);
    });
  });

  describe('Health Check Score Calculations', () => {
    it('should handle health score with all zero metrics', async () => {
      // Mock all system APIs to return zeros
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;
      const originalTotalmem = os.totalmem;

      process.memoryUsage = () => ({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      });

      process.cpuUsage = () => ({
        user: 0,
        system: 0,
      });

      (os as any).totalmem = () => 0;

      try {
        const health = await systemQueries.healthCheck();

        expect(health).toBeDefined();
        expect(health.score).toBeGreaterThanOrEqual(0);
        expect(health.score).toBeLessThanOrEqual(100);
        expect(Number.isNaN(health.score)).toBe(false);
      } finally {
        process.memoryUsage = originalMemoryUsage;
        process.cpuUsage = originalCpuUsage;
        (os as any).totalmem = originalTotalmem;
      }
    });

    it('should calculate weighted health score safely', async () => {
      const components = {
        memory: { score: 0, weight: 0 },
        cpu: { score: 0, weight: 0 },
        database: { score: 0, weight: 0 },
      };

      const totalWeight = Object.values(components).reduce((sum, c) => sum + c.weight, 0);

      // This would normally cause division by zero
      const weightedScore = totalWeight === 0 ?
        50 : // Default score when no weights
        Object.values(components).reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;

      expect(Number.isNaN(weightedScore)).toBe(false);
      expect(Number.isFinite(weightedScore)).toBe(true);
    });
  });

  describe('Edge Cases in Mathematical Operations', () => {
    it('should handle Infinity in calculations', async () => {
      const result1 = systemQueries.safeDivide(Number.MAX_VALUE, Number.MIN_VALUE);
      expect(Number.isFinite(result1)).toBe(true);

      const result2 = systemQueries.safeDivide(1, 0);
      expect(Number.isNaN(result2)).toBe(false);
      expect(result2).toBe(0); // Or whatever the safe default is
    });

    it('should handle NaN propagation', async () => {
      const nanValue = NaN;

      const result1 = systemQueries.safeDivide(nanValue, 10);
      expect(Number.isNaN(result1)).toBe(false);
      expect(result1).toBe(0);

      const result2 = systemQueries.safeDivide(10, nanValue);
      expect(Number.isNaN(result2)).toBe(false);
      expect(result2).toBe(0);
    });

    it('should handle very small denominators', async () => {
      const epsilon = Number.EPSILON;

      const result = systemQueries.safeDivide(1, epsilon);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle negative zero', async () => {
      const negZero = -0;

      const result = systemQueries.safeDivide(1, negZero);
      expect(Number.isNaN(result)).toBe(false);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe('Compound Division Scenarios', () => {
    it('should handle nested division operations safely', async () => {
      // (a / b) / c where b or c could be zero
      const a = 100;
      const b = 0;
      const c = 0;

      const intermediate = systemQueries.safeDivide(a, b);
      const final = systemQueries.safeDivide(intermediate, c);

      expect(Number.isNaN(final)).toBe(false);
      expect(Number.isFinite(final)).toBe(true);
    });

    it('should handle division in array operations', async () => {
      const values = [10, 20, 30, 0, 50];
      const divisor = 0;

      const normalized = values.map(v => systemQueries.safeDivide(v, divisor));

      normalized.forEach(n => {
        expect(Number.isNaN(n)).toBe(false);
        expect(Number.isFinite(n)).toBe(true);
      });
    });

    it('should handle division in reduce operations', async () => {
      const values = [0, 0, 0, 0];

      const _average = values.reduce((sum, v) => sum + v, 0) / values.length;
      const safeAverage = systemQueries.safeDivide(
        values.reduce((sum, v) => sum + v, 0),
        values.length
      );

      expect(Number.isNaN(safeAverage)).toBe(false);
      expect(safeAverage).toBe(0);
    });
  });

  describe('Real-world Division Scenarios', () => {
    it('should handle database with no tables safely', async () => {
      // Drop all tables
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all() as Array<{ name: string }>;

      tables.forEach(({ name }) => {
        if (!name.startsWith('sqlite_')) {
          db.exec(`DROP TABLE IF EXISTS ${name}`);
        }
      });

      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.avgRowsPerTable).toBe(0);
      expect(Number.isNaN(stats.avgRowsPerTable)).toBe(false);
    });

    it('should handle query timing with instant execution', async () => {
      // Mock instant query execution
      const startTime = process.hrtime();
      const endTime = process.hrtime(startTime);

      const elapsedMs = endTime[0] * 1000 + endTime[1] / 1000000;
      const queriesPerSecond = elapsedMs === 0 ? 0 : 1000 / elapsedMs;

      expect(Number.isFinite(queriesPerSecond)).toBe(true);
    });

    it('should handle percentage calculation with edge values', async () => {
      const testCases = [
        { value: 0, total: 0, expected: 0 },
        { value: 100, total: 0, expected: 0 },
        { value: 0, total: 100, expected: 0 },
        { value: -10, total: 100, expected: 0 },
        { value: 100, total: -100, expected: 0 },
      ];

      testCases.forEach(({ value, total, expected }) => {
        const percentage = systemQueries.calculatePercentage(value, total);
        expect(percentage).toBe(expected);
        expect(Number.isNaN(percentage)).toBe(false);
      });
    });
  });
});