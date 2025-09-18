import { TestDatabase, type TestDatabaseOptions } from './test-database-setup';
import type { TestDatabaseManagerContract, DatabaseMetrics, TestDatabaseOptions as ContractOptions } from '../../../specs/003-specs-002-sqlite/contracts/test-database-contract';
import type { Database } from 'bun:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface DatabaseManagerOptions {
  maxDatabases?: number;
  autoCleanup?: boolean;
  tempDir?: string;
  defaultPragmas?: Record<string, any>;
}

export class TestDatabaseManager implements TestDatabaseManagerContract {
  private static instance: TestDatabaseManager | null = null;
  private databases: Map<string, TestDatabase> = new Map();
  private options: DatabaseManagerOptions;
  private cleanupHandlersRegistered: boolean = false;

  private constructor(options: DatabaseManagerOptions = {}) {
    this.options = {
      maxDatabases: options.maxDatabases || 50,
      autoCleanup: options.autoCleanup ?? true,
      tempDir: options.tempDir || path.join(__dirname, '../../temp-dbs'),
      defaultPragmas: options.defaultPragmas || {}
    };

    // Ensure temp directory exists
    if (!fs.existsSync(this.options.tempDir!)) {
      fs.mkdirSync(this.options.tempDir!, { recursive: true });
    }

    // Register cleanup handlers if auto-cleanup is enabled
    if (this.options.autoCleanup) {
      this.registerCleanupHandlers();
    }
  }

  static getInstance(options?: DatabaseManagerOptions): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager(options);
    }
    return TestDatabaseManager.instance;
  }

  static reset(): void {
    if (TestDatabaseManager.instance) {
      TestDatabaseManager.instance.cleanupAll();
      TestDatabaseManager.instance = null;
    }
  }

  async createDatabase(options?: TestDatabaseOptions): Promise<TestDatabase> {
    // Check if we've reached the max number of databases
    if (this.databases.size >= this.options.maxDatabases!) {
      // Clean up oldest databases if needed
      await this.cleanupOldest();
    }

    const db = new TestDatabase({
      ...options,
      tempDir: this.options.tempDir,
      pragmas: { ...this.options.defaultPragmas, ...options?.pragmas }
    });

    await db.setup();
    this.databases.set(db.id, db);

    return db;
  }

  async createInMemoryDatabase(options?: TestDatabaseOptions): Promise<TestDatabase> {
    return this.createDatabase({
      ...options,
      inMemory: true
    });
  }

  async createPersistentDatabase(options?: TestDatabaseOptions): Promise<TestDatabase> {
    return this.createDatabase({
      ...options,
      inMemory: false
    });
  }

  getDatabase(id: string): TestDatabase | undefined {
    return this.databases.get(id);
  }

  getAllDatabases(): TestDatabase[] {
    return Array.from(this.databases.values());
  }

  async removeDatabase(id: string): Promise<boolean> {
    const db = this.databases.get(id);
    if (!db) {
      return false;
    }

    await db.teardown();
    this.databases.delete(id);
    return true;
  }

  async cleanupAll(): Promise<void> {
    const promises = Array.from(this.databases.values()).map(db => db.teardown());
    await Promise.all(promises);
    this.databases.clear();

    // Clean up any orphaned database files
    await this.cleanupOrphanedFiles();
  }

  private async cleanupOldest(): Promise<void> {
    if (this.databases.size === 0) return;

    // Find the oldest database based on creation time
    let oldest: TestDatabase | null = null;
    let oldestTime = Date.now();

    for (const db of this.databases.values()) {
      const time = db.createdAt.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldest = db;
      }
    }

    if (oldest) {
      await this.removeDatabase(oldest.id);
    }
  }

  private async cleanupOrphanedFiles(): Promise<void> {
    if (!this.options.tempDir) return;

    try {
      const files = fs.readdirSync(this.options.tempDir);

      for (const file of files) {
        if (file.endsWith('.sqlite') || file.endsWith('.sqlite-wal') || file.endsWith('.sqlite-shm')) {
          const fullPath = path.join(this.options.tempDir, file);
          try {
            fs.unlinkSync(fullPath);
          } catch (error) {
            console.warn(`Could not delete orphaned file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Could not clean up orphaned files:', error);
    }
  }

  private registerCleanupHandlers(): void {
    if (this.cleanupHandlersRegistered) return;

    // Cleanup on process exit
    const cleanup = async () => {
      await this.cleanupAll();
    };

    process.on('exit', () => {
      // Synchronous cleanup on exit
      for (const db of this.databases.values()) {
        try {
          if (db.isConnected()) {
            db.getConnection().close();
          }
        } catch (_error) {
          // Ignore errors during emergency cleanup
        }
      }
    });

    // Async cleanup for other signals
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });

    this.cleanupHandlersRegistered = true;
  }

  getMetrics() {
    const databases = Array.from(this.databases.values());

    return {
      totalDatabases: this.databases.size,
      inMemoryCount: databases.filter(db => db.path === ':memory:').length,
      persistentCount: databases.filter(db => db.path !== ':memory:').length,
      totalSize: databases.reduce((sum, db) => sum + db.getSize(), 0),
      totalQueries: databases.reduce((sum, db) => sum + db.getMetrics().queryCount, 0),
      databases: databases.map(db => db.getMetrics())
    };
  }

  async runInTransaction<T>(
    databaseId: string,
    fn: (db: TestDatabase) => T
  ): Promise<T> {
    const db = this.getDatabase(databaseId);
    if (!db) {
      throw new Error(`Database ${databaseId} not found`);
    }

    return db.transaction(() => fn(db));
  }

  async runParallel<T>(
    count: number,
    fn: (db: TestDatabase, index: number) => Promise<T>
  ): Promise<T[]> {
    const databases = await Promise.all(
      Array.from({ length: count }, () => this.createInMemoryDatabase())
    );

    try {
      const results = await Promise.all(
        databases.map((db, index) => fn(db, index))
      );
      return results;
    } finally {
      // Cleanup all databases
      await Promise.all(databases.map(db => this.removeDatabase(db.id)));
    }
  }

  async benchmark<T>(
    name: string,
    fn: (db: TestDatabase) => Promise<T>,
    iterations: number = 10
  ): Promise<{
    name: string;
    iterations: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    times: number[];
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const db = await this.createInMemoryDatabase();
      const start = Date.now();

      try {
        await fn(db);
      } finally {
        await this.removeDatabase(db.id);
      }

      times.push(Date.now() - start);
    }

    return {
      name,
      iterations,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      times
    };
  }

  getTempDir(): string {
    return this.options.tempDir!;
  }

  setMaxDatabases(max: number): void {
    this.options.maxDatabases = max;
  }

  enableAutoCleanup(enabled: boolean): void {
    this.options.autoCleanup = enabled;
    if (enabled && !this.cleanupHandlersRegistered) {
      this.registerCleanupHandlers();
    }
  }

  // Contract interface implementations
  async createManaged(options?: ContractOptions): Promise<{
    path: string;
    db: Database;
    metrics: DatabaseMetrics;
    cleanup: () => Promise<void>;
  }> {
    const prefix = options?.prefix || 'managed';
    const testDb = await this.createDatabase({
      name: `${prefix}-${Date.now()}`,
      inMemory: false
    });

    // Initialize with system monitoring schema
    const db = await testDb.initializeSchema(testDb.path);

    const metrics: DatabaseMetrics = {
      fileSize: testDb.getSize(),
      connectionCount: 1, // Single connection per test database
      createdAt: testDb.createdAt,
      lastActivity: new Date()
    };

    return {
      path: testDb.path,
      db,
      metrics,
      cleanup: async () => {
        await this.removeDatabase(testDb.id);
      }
    };
  }

  getAllMetrics(): DatabaseMetrics[] {
    return Array.from(this.databases.values()).map(db => ({
      fileSize: db.getSize(),
      connectionCount: 1, // Single connection per test database
      createdAt: db.createdAt,
      lastActivity: new Date() // Update to track actual last activity if needed
    }));
  }
}

export default TestDatabaseManager;