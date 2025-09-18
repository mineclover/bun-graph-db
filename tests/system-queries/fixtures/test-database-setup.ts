import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { TestDatabaseContract, } from '../../../specs/003-specs-002-sqlite/contracts/test-database-contract';

export interface TestDatabaseOptions {
  name?: string;
  inMemory?: boolean;
  tempDir?: string;
  pragmas?: Record<string, any>;
  schema?: string;
}

export class TestDatabase implements TestDatabaseContract {
  private db: Database | null = null;
  private _id: string;
  private _path: string;
  private _inMemory: boolean;
  private _startTime: number;
  private _queries: string[] = [];

  public readonly id: string;
  public readonly name: string;
  public readonly path: string;
  public readonly createdAt: Date;

  constructor(options: TestDatabaseOptions = {}) {
    this._id = `test-db-${crypto.randomBytes(8).toString('hex')}`;
    this.id = this._id;
    this.name = options.name || this._id;
    this._inMemory = options.inMemory ?? false;

    if (this._inMemory) {
      this._path = ':memory:';
    } else {
      const tempDir = options.tempDir || path.join(__dirname, '../../temp-dbs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      this._path = path.join(tempDir, `${this._id}.sqlite`);
    }

    this.path = this._path;
    this.createdAt = new Date();
    this._startTime = Date.now();
  }

  async initialize(): Promise<void> {
    await this.setup();
  }

  async setup(): Promise<void> {
    try {
      // Create database connection
      this.db = new Database(this._path);

      // Apply default pragmas for performance
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA cache_size = 10000');
      this.db.exec('PRAGMA temp_store = MEMORY');

      // Apply custom pragmas if provided
      if (this.db) {
        // Default schema if needed
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS test_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }
    } catch (error) {
      await this.teardown();
      throw new Error(`Failed to setup test database: ${error}`);
    }
  }

  async teardown(): Promise<void> {
    try {
      if (this.db) {
        // Close connection
        this.db.close();
        this.db = null;
      }

      // Delete file if not in-memory
      if (!this._inMemory && fs.existsSync(this._path)) {
        fs.unlinkSync(this._path);

        // Also clean up WAL and SHM files if they exist
        const walPath = `${this._path}-wal`;
        const shmPath = `${this._path}-shm`;

        if (fs.existsSync(walPath)) {
          fs.unlinkSync(walPath);
        }
        if (fs.existsSync(shmPath)) {
          fs.unlinkSync(shmPath);
        }
      }
    } catch (error) {
      console.error(`Error during teardown of ${this._id}:`, error);
    }
  }

  getConnection(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call setup() first.');
    }
    return this.db;
  }

  exec(sql: string): void {
    const db = this.getConnection();
    this._queries.push(sql);
    db.exec(sql);
  }

  prepare<_T = any>(sql: string): any {
    const db = this.getConnection();
    this._queries.push(sql);
    return db.prepare(sql);
  }

  query<T = any>(sql: string, ...params: any[]): T[] {
    const db = this.getConnection();
    this._queries.push(sql);
    return db.prepare(sql).all(...params) as T[];
  }

  run(sql: string, ...params: any[]): void {
    const db = this.getConnection();
    this._queries.push(sql);
    db.prepare(sql).run(...params);
  }

  transaction<T>(fn: () => T): T {
    const db = this.getConnection();
    return db.transaction(fn)();
  }

  getMetrics() {
    return {
      id: this._id,
      name: this.name,
      path: this._path,
      inMemory: this._inMemory,
      queryCount: this._queries.length,
      elapsedMs: Date.now() - this._startTime,
      createdAt: this.createdAt,
      isConnected: this.db !== null
    };
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get all tables except sqlite system tables
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;

    // Drop all tables
    for (const table of tables) {
      this.db.exec(`DROP TABLE IF EXISTS "${table.name}"`);
    }

    // Recreate default schema
    await this.setup();
  }

  async clone(): Promise<TestDatabase> {
    const clone = new TestDatabase({
      name: `${this.name}-clone`,
      inMemory: this._inMemory,
      tempDir: path.dirname(this._path)
    });

    await clone.setup();

    // If not in-memory, copy the database file
    if (!this._inMemory && this.db) {
      const backup = await this.db.backup(clone._path);
      await backup.step(-1);
      backup.close();
    }

    return clone;
  }

  enableQueryLogging(_enabled: boolean = true): void {
    // This would enable logging of all queries for debugging
    // Implementation depends on specific needs
  }

  getQueryLog(): string[] {
    return [...this._queries];
  }

  clearQueryLog(): void {
    this._queries = [];
  }

  async checkpoint(): Promise<void> {
    if (this.db) {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    }
  }

  getSize(): number {
    if (this._inMemory) {
      return 0;
    }

    try {
      const stats = fs.statSync(this._path);
      return stats.size;
    } catch {
      return 0;
    }
  }

  exists(): boolean {
    if (this._inMemory) {
      return this.db !== null;
    }
    return fs.existsSync(this._path);
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  // Contract interface implementations
  async createTestDatabase(): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const testDb = new TestDatabase({
      name: `test-${crypto.randomBytes(8).toString('hex')}`,
      inMemory: false
    });

    await testDb.setup();

    return {
      path: testDb.path,
      cleanup: async () => {
        await testDb.teardown();
      }
    };
  }

  async initializeSchema(dbPath: string): Promise<Database> {
    const db = new Database(dbPath);

    // Apply SQLite optimizations for testing
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA cache_size = 10000');
    db.exec('PRAGMA temp_store = MEMORY');

    // Create system monitoring schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        cpu_usage REAL,
        memory_usage REAL,
        disk_usage REAL,
        uptime INTEGER
      );

      CREATE TABLE IF NOT EXISTS memory_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_memory INTEGER,
        free_memory INTEGER,
        used_memory INTEGER,
        buffer_cache INTEGER
      );

      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        service_name TEXT NOT NULL,
        status TEXT NOT NULL,
        response_time REAL,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_system_stats_timestamp ON system_stats(timestamp);
      CREATE INDEX IF NOT EXISTS idx_memory_stats_timestamp ON memory_stats(timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_name);
    `);

    return db;
  }

  async resetDatabase(db: Database): Promise<void> {
    const startTime = performance.now();

    try {
      // Get all user tables (exclude sqlite system tables)
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      // Clear data from all tables (preserve schema)
      db.transaction(() => {
        for (const table of tables) {
          db.exec(`DELETE FROM "${table.name}"`);
        }
      })();

      // Vacuum to reclaim space
      db.exec('VACUUM');

      const duration = performance.now() - startTime;
      if (duration > 50) {
        console.warn(`Database reset took ${duration}ms, exceeds 50ms threshold`);
      }
    } catch (error) {
      throw new Error(`Failed to reset database: ${error}`);
    }
  }

  async validateDatabase(db: Database): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check required tables exist
      const requiredTables = ['system_stats', 'memory_stats', 'health_checks'];
      const existingTables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      const tableNames = existingTables.map(t => t.name);

      for (const table of requiredTables) {
        if (!tableNames.includes(table)) {
          errors.push(`Missing required table: ${table}`);
        }
      }

      // Check required indexes exist
      const requiredIndexes = [
        'idx_system_stats_timestamp',
        'idx_memory_stats_timestamp',
        'idx_health_checks_timestamp',
        'idx_health_checks_service'
      ];

      const existingIndexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      const indexNames = existingIndexes.map(i => i.name);

      for (const index of requiredIndexes) {
        if (!indexNames.includes(index)) {
          errors.push(`Missing required index: ${index}`);
        }
      }

      // Test basic functionality
      try {
        db.prepare('SELECT 1 as test').get();
      } catch (error) {
        errors.push(`Database connectivity test failed: ${error}`);
      }

    } catch (error) {
      errors.push(`Database validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getStats() {
    if (!this.db) {
      return null;
    }

    const pageCount = this.db.prepare('PRAGMA page_count').get() as any;
    const pageSize = this.db.prepare('PRAGMA page_size').get() as any;
    const tableCount = this.db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
    ).get() as any;

    return {
      pageCount: pageCount?.page_count || 0,
      pageSize: pageSize?.page_size || 0,
      tableCount: tableCount?.count || 0,
      totalSize: (pageCount?.page_count || 0) * (pageSize?.page_size || 0),
      queryCount: this._queries.length
    };
  }
}

export default TestDatabase;