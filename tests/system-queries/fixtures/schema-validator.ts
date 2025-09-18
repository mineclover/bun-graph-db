import { Database } from 'bun:sqlite';
import type { DatabaseValidationContract } from '../../../specs/003-specs-002-sqlite/contracts/test-database-contract';

export class SchemaValidator implements DatabaseValidationContract {
  private readonly requiredTables = [
    'system_stats',
    'memory_stats',
    'health_checks'
  ];

  private readonly requiredIndexes = [
    'idx_system_stats_timestamp',
    'idx_memory_stats_timestamp',
    'idx_health_checks_timestamp',
    'idx_health_checks_service'
  ];

  private readonly requiredColumns = {
    system_stats: [
      'id', 'timestamp', 'cpu_usage', 'memory_usage', 'disk_usage', 'uptime'
    ],
    memory_stats: [
      'id', 'timestamp', 'total_memory', 'free_memory', 'used_memory', 'buffer_cache'
    ],
    health_checks: [
      'id', 'timestamp', 'service_name', 'status', 'response_time', 'error_message'
    ]
  };

  validateSchema(db: Database): {
    isValid: boolean;
    missingTables: string[];
    missingIndexes: string[];
    schemaErrors: string[];
  } {
    const missingTables: string[] = [];
    const missingIndexes: string[] = [];
    const schemaErrors: string[] = [];

    try {
      // Check required tables exist
      const existingTables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      const tableNames = existingTables.map(t => t.name);

      for (const table of this.requiredTables) {
        if (!tableNames.includes(table)) {
          missingTables.push(table);
        }
      }

      // Check required indexes exist
      const existingIndexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      const indexNames = existingIndexes.map(i => i.name);

      for (const index of this.requiredIndexes) {
        if (!indexNames.includes(index)) {
          missingIndexes.push(index);
        }
      }

      // Validate table schemas
      for (const [tableName, requiredColumns] of Object.entries(this.requiredColumns)) {
        if (tableNames.includes(tableName)) {
          try {
            const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
              cid: number;
              name: string;
              type: string;
              notnull: number;
              dflt_value: any;
              pk: number;
            }>;

            const columnNames = columns.map(c => c.name);

            for (const requiredColumn of requiredColumns) {
              if (!columnNames.includes(requiredColumn)) {
                schemaErrors.push(`Table ${tableName} missing required column: ${requiredColumn}`);
              }
            }
          } catch (error) {
            schemaErrors.push(`Failed to validate schema for table ${tableName}: ${error}`);
          }
        }
      }

      // Test basic queries to ensure schema is functional
      try {
        for (const table of this.requiredTables) {
          if (tableNames.includes(table)) {
            db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
          }
        }
      } catch (error) {
        schemaErrors.push(`Schema functionality test failed: ${error}`);
      }

    } catch (error) {
      schemaErrors.push(`Schema validation failed: ${error}`);
    }

    return {
      isValid: missingTables.length === 0 && missingIndexes.length === 0 && schemaErrors.length === 0,
      missingTables,
      missingIndexes,
      schemaErrors
    };
  }

  validateCleanState(db: Database): {
    isEmpty: boolean;
    tableRowCounts: Record<string, number>;
    nonEmptyTables: string[];
  } {
    const tableRowCounts: Record<string, number> = {};
    const nonEmptyTables: string[] = [];

    try {
      // Get all user tables
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      // Count rows in each table
      for (const table of tables) {
        try {
          const result = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number };
          const count = result.count;
          tableRowCounts[table.name] = count;

          if (count > 0) {
            nonEmptyTables.push(table.name);
          }
        } catch (error) {
          // If we can't count rows, consider it non-empty for safety
          tableRowCounts[table.name] = -1; // Indicate error
          nonEmptyTables.push(table.name);
        }
      }
    } catch (error) {
      // If we can't list tables, consider database non-empty
      return {
        isEmpty: false,
        tableRowCounts: { error: -1 },
        nonEmptyTables: ['unknown']
      };
    }

    return {
      isEmpty: nonEmptyTables.length === 0,
      tableRowCounts,
      nonEmptyTables
    };
  }

  validatePerformance(db: Database): {
    meetsRequirements: boolean;
    queryResponseTime: number;
    connectionTime: number;
    performanceIssues: string[];
  } {
    const performanceIssues: string[] = [];
    let queryResponseTime = 0;
    let connectionTime = 0;

    try {
      // Test connection time
      const connectionStartTime = performance.now();
      db.prepare('SELECT 1').get();
      connectionTime = performance.now() - connectionStartTime;

      if (connectionTime > 10) { // 10ms threshold for connection
        performanceIssues.push(`Connection time ${connectionTime.toFixed(2)}ms exceeds 10ms threshold`);
      }

      // Test query response time
      const queryStartTime = performance.now();

      // Run a series of test queries
      db.prepare('SELECT COUNT(*) FROM sqlite_master').get();

      for (const table of this.requiredTables) {
        try {
          db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
        } catch (error) {
          // Table might not exist, skip
        }
      }

      queryResponseTime = performance.now() - queryStartTime;

      if (queryResponseTime > 50) { // 50ms threshold for queries
        performanceIssues.push(`Query response time ${queryResponseTime.toFixed(2)}ms exceeds 50ms threshold`);
      }

      // Test transaction performance
      const transactionStartTime = performance.now();
      const transaction = db.transaction(() => {
        for (let i = 0; i < 10; i++) {
          db.prepare('SELECT 1').get();
        }
      });
      transaction();
      const transactionTime = performance.now() - transactionStartTime;

      if (transactionTime > 20) { // 20ms threshold for transactions
        performanceIssues.push(`Transaction time ${transactionTime.toFixed(2)}ms exceeds 20ms threshold`);
      }

      // Check pragma settings for performance
      const journalMode = db.prepare('PRAGMA journal_mode').get() as any;
      const synchronous = db.prepare('PRAGMA synchronous').get() as any;
      const cacheSize = db.prepare('PRAGMA cache_size').get() as any;

      if (journalMode?.journal_mode !== 'wal') {
        performanceIssues.push('Journal mode is not WAL (Write-Ahead Logging)');
      }

      if (synchronous?.synchronous > 1) { // NORMAL=1, FULL=2
        performanceIssues.push('Synchronous mode is not optimized for testing');
      }

      if (cacheSize?.cache_size < 1000) {
        performanceIssues.push('Cache size is too small for optimal performance');
      }

    } catch (error) {
      performanceIssues.push(`Performance validation failed: ${error}`);
      queryResponseTime = 999; // Indicate failure
      connectionTime = 999;
    }

    return {
      meetsRequirements: performanceIssues.length === 0,
      queryResponseTime,
      connectionTime,
      performanceIssues
    };
  }

  // Additional utility methods for comprehensive validation
  validateIndexes(db: Database, tableName: string): {
    hasRequiredIndexes: boolean;
    missingIndexes: string[];
    indexPerformance: Record<string, number>;
  } {
    const missingIndexes: string[] = [];
    const indexPerformance: Record<string, number> = {};

    try {
      // Get indexes for the table
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%'
      `).all(tableName) as Array<{ name: string }>;

      const indexNames = indexes.map(i => i.name);

      // Check required indexes based on table
      const requiredForTable = this.requiredIndexes.filter(idx =>
        idx.includes(tableName.replace('_', '-'))
      );

      for (const requiredIndex of requiredForTable) {
        if (!indexNames.includes(requiredIndex)) {
          missingIndexes.push(requiredIndex);
        }
      }

      // Test index performance
      for (const index of indexes) {
        try {
          const startTime = performance.now();
          db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM ${tableName} WHERE timestamp > datetime('now', '-1 hour')`).all();
          indexPerformance[index.name] = performance.now() - startTime;
        } catch (error) {
          indexPerformance[index.name] = 999; // Indicate error
        }
      }

    } catch (error) {
      missingIndexes.push(`Failed to validate indexes: ${error}`);
    }

    return {
      hasRequiredIndexes: missingIndexes.length === 0,
      missingIndexes,
      indexPerformance
    };
  }

  validateDataTypes(db: Database, tableName: string): {
    correctTypes: boolean;
    typeErrors: string[];
  } {
    const typeErrors: string[] = [];

    try {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      // Define expected types for each table
      const expectedTypes: Record<string, Record<string, string>> = {
        system_stats: {
          id: 'INTEGER',
          timestamp: 'DATETIME',
          cpu_usage: 'REAL',
          memory_usage: 'REAL',
          disk_usage: 'REAL',
          uptime: 'INTEGER'
        },
        memory_stats: {
          id: 'INTEGER',
          timestamp: 'DATETIME',
          total_memory: 'INTEGER',
          free_memory: 'INTEGER',
          used_memory: 'INTEGER',
          buffer_cache: 'INTEGER'
        },
        health_checks: {
          id: 'INTEGER',
          timestamp: 'DATETIME',
          service_name: 'TEXT',
          status: 'TEXT',
          response_time: 'REAL',
          error_message: 'TEXT'
        }
      };

      const expected = expectedTypes[tableName];
      if (expected) {
        for (const column of columns) {
          const expectedType = expected[column.name];
          if (expectedType && column.type.toUpperCase() !== expectedType) {
            typeErrors.push(
              `Column ${column.name} has type ${column.type}, expected ${expectedType}`
            );
          }
        }
      }

    } catch (error) {
      typeErrors.push(`Failed to validate data types: ${error}`);
    }

    return {
      correctTypes: typeErrors.length === 0,
      typeErrors
    };
  }
}

export default SchemaValidator;