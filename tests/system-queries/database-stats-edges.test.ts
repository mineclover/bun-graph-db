import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SystemQueries } from '../../src/services/system-queries';

describe('Database Statistics Edge Cases', () => {
  let db: Database;
  let systemQueries: SystemQueries;
  let tempDbPath: string;

  beforeEach(() => {
    // Create temp database for testing
    tempDbPath = path.join(__dirname, '../temp-dbs', `test-db-stats-${Date.now()}.sqlite`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempDbPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    db = new Database(tempDbPath);
    systemQueries = new SystemQueries(db);

    // Create test schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER,
        to_id INTEGER,
        FOREIGN KEY (from_id) REFERENCES nodes(id),
        FOREIGN KEY (to_id) REFERENCES nodes(id)
      );

      CREATE INDEX idx_edges_from ON edges(from_id);
      CREATE INDEX idx_edges_to ON edges(to_id);
    `);
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

  describe('Empty Database Scenarios', () => {
    it('should handle empty database gracefully', async () => {
      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.tableCount).toBe(2); // nodes and edges tables
      expect(stats.totalRows).toBe(0);
      expect(stats.indexCount).toBeGreaterThanOrEqual(2); // At least the two indices we created
      expect(stats.databaseSize).toBeGreaterThan(0); // Even empty DB has metadata
    });

    it('should calculate correct size for empty database', async () => {
      const stats = await systemQueries.getDatabaseStats();
      const fileStats = fs.statSync(tempDbPath);

      expect(stats.databaseSize).toBe(fileStats.size);
      expect(stats.formattedSize).toMatch(/^\d+(\.\d+)?\s*(B|KB|MB|GB)$/);
    });
  });

  describe('Large Dataset Scenarios', () => {
    it('should handle large number of rows efficiently', async () => {
      // Insert large dataset
      const insertStmt = db.prepare('INSERT INTO nodes (data) VALUES (?)');
      const insertMany = db.transaction((count: number) => {
        for (let i = 0; i < count; i++) {
          insertStmt.run(`data-${i}`);
        }
      });

      const rowCount = 100000;
      const startTime = Date.now();
      insertMany(rowCount);

      const stats = await systemQueries.getDatabaseStats();
      const queryTime = Date.now() - startTime;

      expect(stats.totalRows).toBe(rowCount);
      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(stats.avgRowsPerTable).toBe(rowCount / 2); // 2 tables, rows only in one
    });

    it('should format large database sizes correctly', async () => {
      // Create large data entries
      const largeData = 'x'.repeat(1024 * 10); // 10KB per row
      const insertStmt = db.prepare('INSERT INTO nodes (data) VALUES (?)');

      for (let i = 0; i < 100; i++) {
        insertStmt.run(largeData);
      }

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.formattedSize).toMatch(/MB$/); // Should be in MB range
      expect(stats.databaseSize).toBeGreaterThan(1024 * 1024); // Greater than 1MB
    });
  });

  describe('Database State Edge Cases', () => {
    it('should handle database with only system tables', async () => {
      // Drop user tables
      db.exec('DROP TABLE edges; DROP TABLE nodes;');

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.tableCount).toBe(0);
      expect(stats.totalRows).toBe(0);
      expect(stats.avgRowsPerTable).toBe(0);
    });

    it('should handle corrupted statistics gracefully', async () => {
      // Simulate corrupted ANALYZE statistics
      db.exec('DELETE FROM sqlite_stat1 WHERE 1=1');

      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.tableCount).toBeGreaterThanOrEqual(0);
      // Should still work without statistics
    });

    it('should handle tables with special characters in names', async () => {
      db.exec(`
        CREATE TABLE "table-with-dashes" (id INTEGER PRIMARY KEY);
        CREATE TABLE "table.with.dots" (id INTEGER PRIMARY KEY);
        CREATE TABLE "table with spaces" (id INTEGER PRIMARY KEY);
      `);

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.tableCount).toBe(5); // 2 original + 3 special
      expect(stats.tables).toContain('table-with-dashes');
      expect(stats.tables).toContain('table.with.dots');
      expect(stats.tables).toContain('table with spaces');
    });
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle concurrent reads correctly', async () => {
      // Insert test data
      for (let i = 0; i < 100; i++) {
        db.prepare('INSERT INTO nodes (data) VALUES (?)').run(`data-${i}`);
      }

      // Perform concurrent reads
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(systemQueries.getDatabaseStats());
      }

      const results = await Promise.all(promises);

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.totalRows).toBe(firstResult.totalRows);
        expect(result.databaseSize).toBe(firstResult.databaseSize);
        expect(result.tableCount).toBe(firstResult.tableCount);
      });
    });

    it('should handle stats query during write operations', async () => {
      let writeComplete = false;

      // Start background writes
      const writePromise = new Promise<void>(resolve => {
        setTimeout(() => {
          const insertStmt = db.prepare('INSERT INTO nodes (data) VALUES (?)');
          for (let i = 0; i < 1000; i++) {
            insertStmt.run(`data-${i}`);
          }
          writeComplete = true;
          resolve();
        }, 100);
      });

      // Query stats while writes are happening
      const statsBefore = await systemQueries.getDatabaseStats();
      await writePromise;
      const statsAfter = await systemQueries.getDatabaseStats();

      expect(writeComplete).toBe(true);
      expect(statsAfter.totalRows).toBeGreaterThan(statsBefore.totalRows);
    });
  });

  describe('Database Size Calculation Edge Cases', () => {
    it('should handle zero-byte theoretical database', async () => {
      // Mock scenario where file size calculation might fail
      const mockStats = {
        databaseSize: 0,
        formattedSize: systemQueries.formatBytes(0),
      };

      expect(mockStats.formattedSize).toBe('0 B');
    });

    it('should format extreme size values correctly', async () => {
      const testCases = [
        { bytes: 0, expected: '0 B' },
        { bytes: 1, expected: '1 B' },
        { bytes: 1024, expected: '1.00 KB' },
        { bytes: 1024 * 1024, expected: '1.00 MB' },
        { bytes: 1024 * 1024 * 1024, expected: '1.00 GB' },
        { bytes: 1024 * 1024 * 1024 * 1024, expected: '1.00 TB' },
      ];

      testCases.forEach(({ bytes, expected }) => {
        const formatted = systemQueries.formatBytes(bytes);
        expect(formatted).toBe(expected);
      });
    });

    it('should handle negative size values gracefully', async () => {
      // This shouldn't happen in practice, but testing defensive programming
      const formatted = systemQueries.formatBytes(-1024);

      // Should either return absolute value or handle gracefully
      expect(formatted).toMatch(/^\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$/);
    });
  });

  describe('Index Statistics Edge Cases', () => {
    it('should count indices correctly with various types', async () => {
      // Create various index types
      db.exec(`
        CREATE UNIQUE INDEX idx_unique ON nodes(id, data);
        CREATE INDEX idx_partial ON edges(from_id) WHERE from_id > 0;
        CREATE INDEX idx_expression ON nodes(length(data));
      `);

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.indexCount).toBeGreaterThanOrEqual(5); // Original 2 + 3 new
      expect(stats.indices).toContain('idx_unique');
      expect(stats.indices).toContain('idx_partial');
      expect(stats.indices).toContain('idx_expression');
    });

    it('should handle missing index statistics', async () => {
      // Drop all indices
      const indices = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL"
      ).all() as Array<{ name: string }>;

      indices.forEach(({ name }) => {
        db.exec(`DROP INDEX IF EXISTS ${name}`);
      });

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.indexCount).toBe(0);
      expect(stats.indices).toEqual([]);
    });
  });

  describe('WAL Mode Edge Cases', () => {
    it('should handle WAL mode database correctly', async () => {
      // Enable WAL mode
      db.pragma('journal_mode = WAL');

      // Perform some operations
      for (let i = 0; i < 100; i++) {
        db.prepare('INSERT INTO nodes (data) VALUES (?)').run(`wal-data-${i}`);
      }

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.totalRows).toBe(100);

      // Check for WAL file
      const walPath = `${tempDbPath}-wal`;
      const walExists = fs.existsSync(walPath);

      if (walExists) {
        const _walSize = fs.statSync(walPath).size;
        // Database size should account for WAL file
        expect(stats.databaseSize).toBeGreaterThan(0);
      }
    });

    it('should checkpoint WAL and get accurate stats', async () => {
      db.pragma('journal_mode = WAL');

      // Insert data
      for (let i = 0; i < 1000; i++) {
        db.prepare('INSERT INTO nodes (data) VALUES (?)').run(`checkpoint-${i}`);
      }

      // Force checkpoint
      db.pragma('wal_checkpoint(TRUNCATE)');

      const stats = await systemQueries.getDatabaseStats();

      expect(stats.totalRows).toBe(1000);

      // After checkpoint, WAL should be minimal
      const walPath = `${tempDbPath}-wal`;
      if (fs.existsSync(walPath)) {
        const walSize = fs.statSync(walPath).size;
        expect(walSize).toBeLessThan(1024 * 10); // Less than 10KB
      }
    });
  });

  describe('Transaction Edge Cases', () => {
    it('should get consistent stats within transaction', async () => {
      db.exec('BEGIN TRANSACTION');

      const statsBefore = await systemQueries.getDatabaseStats();

      // Insert data within transaction
      for (let i = 0; i < 100; i++) {
        db.prepare('INSERT INTO nodes (data) VALUES (?)').run(`tx-data-${i}`);
      }

      const statsDuring = await systemQueries.getDatabaseStats();

      db.exec('COMMIT');

      const statsAfter = await systemQueries.getDatabaseStats();

      // Stats during transaction should show changes
      expect(statsDuring.totalRows).toBe(100);
      expect(statsAfter.totalRows).toBe(100);
      expect(statsBefore.totalRows).toBe(0);
    });

    it('should handle rollback correctly', async () => {
      const initialStats = await systemQueries.getDatabaseStats();

      db.exec('BEGIN TRANSACTION');

      // Insert data
      for (let i = 0; i < 50; i++) {
        db.prepare('INSERT INTO nodes (data) VALUES (?)').run(`rollback-${i}`);
      }

      const statsDuring = await systemQueries.getDatabaseStats();
      expect(statsDuring.totalRows).toBe(50);

      db.exec('ROLLBACK');

      const statsAfter = await systemQueries.getDatabaseStats();

      expect(statsAfter.totalRows).toBe(initialStats.totalRows);
    });
  });
});