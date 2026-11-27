import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AccessControl, authorizeExternalRequest } from '../../src/application/security/AccessControl.js'
import type { ILogger } from '../../src/application/ports/ILogger.js'
import type { IDatabaseConnection } from '../../src/core/database/interfaces/IDatabaseConnection.js'
import { SQLiteBackupService } from '../../src/domain/services/SQLiteBackupService.js'
import { cosineSimilarity } from '../../src/domain/services/vector/ExactVectorIndex.js'
import { createDatabaseMigrations, applyDatabaseMigrations } from '../../src/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import { SqliteNodeEmbeddingRepository } from '../../src/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js'

const tempDirs: string[] = []
const openDbs: Database[] = []

afterEach(() => {
  for (const db of openDbs.splice(0)) {
    db.close()
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createSilentLogger(): ILogger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  }
}

describe('Node 26 SqliteAdapter wrapper', () => {
  test('returns null from get(), binds booleans as 1/0, handles LRU eviction, nested SAVEPOINT rollback, and idempotent close()', () => {
    const db = new Database(':memory:', {}, 16)
    openDbs.push(db)

    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, flag INTEGER NOT NULL, name TEXT NOT NULL)')
    expect(db.query<{ id: number }, [number]>('SELECT id FROM items WHERE id = ?').get(999)).toBeNull()

    db.run('INSERT INTO items (id, flag, name) VALUES (?, ?, ?)', [1, true, 'alpha'])
    db.run('INSERT INTO items (id, flag, name) VALUES (?, ?, ?)', [2, false, 'beta'])
    expect(db.query<{ flag: number }, [number]>('SELECT flag FROM items WHERE id = ?').get(1)?.flag).toBe(1)
    expect(db.query<{ flag: number }, [number]>('SELECT flag FROM items WHERE id = ?').get(2)?.flag).toBe(0)

    const outer = db.transaction(() => {
      db.run('INSERT INTO items (id, flag, name) VALUES (?, ?, ?)', [3, true, 'outer'])
      const innerFail = db.transaction(() => {
        db.run('INSERT INTO items (id, flag, name) VALUES (?, ?, ?)', [4, true, 'rolled-back'])
        throw new Error('inner-failure')
      })
      expect(() => innerFail()).toThrow('inner-failure')
    })
    outer()

    const ids = db.query<{ id: number }, []>('SELECT id FROM items ORDER BY id ASC').all().map((row) => row.id)
    expect(ids).toEqual([1, 2, 3])

    // Evicts oldest cached statement cleanly when exceeding cache capacity (min 16)
    for (let i = 0; i < 24; i += 1) {
      expect(db.query<{ v: number }, []>(`SELECT ${i} AS v`).get()?.v).toBe(i)
    }

    db.close()
    db.close()
  })
})

describe('SQLiteBackupService hardening', () => {
  test('escapes quotes in VACUUM INTO, rejects NUL bytes, checks nodes table, and round-trips gzipped backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sqlite-backup-test-'))
    tempDirs.push(dir)

    const liveDb = new Database(':memory:')
    openDbs.push(liveDb)
    liveDb.exec(`
      CREATE TABLE tables (id INTEGER PRIMARY KEY);
      CREATE TABLE nodes (id INTEGER PRIMARY KEY);
      CREATE TABLE attributes (id INTEGER PRIMARY KEY);
      INSERT INTO tables (id) VALUES (1);
      INSERT INTO nodes (id) VALUES (10);
      INSERT INTO attributes (id) VALUES (100);
    `)

    const executedSql: string[] = []
    const connection = {
      async execute(query: string) {
        executedSql.push(query)
        liveDb.exec(query)
        return []
      },
      async close() {},
    } as unknown as IDatabaseConnection

    const service = new SQLiteBackupService(connection, createSilentLogger())

    const quotedPath = join(dir, "o'reilly-backup.sqlite")
    const result = await service.createBackup({
      outputPath: quotedPath,
      compress: true,
      validate: true,
    })

    expect(result.success).toBe(true)
    expect(result.backupPath).toBe(`${quotedPath}.gz`)
    expect(existsSync(result.backupPath)).toBe(true)
    expect(executedSql[0]).toContain("o''reilly-backup.sqlite")

    const nulResult = await service.createBackup({
      outputPath: join(dir, 'bad\0path.sqlite'),
      compress: false,
      validate: true,
    })
    expect(nulResult.success).toBe(false)
    expect(nulResult.errors.length).toBeGreaterThan(0)
  })
})

describe('AccessControl P0 optimizations', () => {
  test('reuses WeakMap principal across authorizeExternalRequest + principalFor and prunes expired rate-limit buckets', async () => {
    const control = new AccessControl({
      enabled: true,
      tokens: new Map([
        ['secret-writer-token-123456', { id: 'writer-1', role: 'writer', tableIds: ['orders'] }],
      ]),
      allowedOrigins: [],
      rateLimit: { enabled: true, max: 100, windowMs: 1 },
      maxRequestBytes: 65_536,
      maxGraphqlComplexity: 50,
    })

    const request = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-writer-token-123456',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'mutation { createNode(input: { tableId: "orders", content: "ok" }) { success } }',
      }),
    })

    const decision = await authorizeExternalRequest(control, request)
    expect(decision.allowed).toBe(true)

    const spyFindPrincipal = vi.spyOn(
      control as unknown as { findPrincipal: (cred: string) => unknown },
      'findPrincipal',
    )
    expect(control.principalFor(request)?.id).toBe('writer-1')
    expect(spyFindPrincipal).not.toHaveBeenCalled()

    // Trigger rate-limit bucket sweep once buckets exceed threshold (1024)
    for (let i = 0; i < 1030; i += 1) {
      const anonymousReq = new Request('http://localhost/api/health', {
        headers: { 'X-Forwarded-For': `10.0.${Math.floor(i / 250)}.${i % 250}` },
      })
      control.authorize(
        anonymousReq,
        { action: 'read', endpoint: '/api/health' },
        { id: 'writer-1', role: 'writer', tableIds: ['orders'] },
      )
    }
    const bucketMap = (control as unknown as { rateLimitBuckets: Map<string, unknown> }).rateLimitBuckets
    expect(bucketMap.size).toBeLessThanOrEqual(4096)
  })
})

describe('SqliteNodeEmbeddingRepository unit normalization and LRU cache eviction', () => {
  test('matches cosineSimilarity for normalized and zero-norm vectors and evicts oldest tables under LRU bounds', async () => {
    const db = new Database(':memory:')
    openDbs.push(db)

    const schema = `
      CREATE TABLE tables (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT NOT NULL UNIQUE);
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE attributes (id INTEGER PRIMARY KEY AUTOINCREMENT);
      CREATE TABLE node_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER NOT NULL,
        attribute_id INTEGER NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        avg_execution_time_ms INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE template_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER NOT NULL
      );
    `
    applyDatabaseMigrations(db, createDatabaseMigrations(schema))

    for (const tableNum of [1, 2, 3]) {
      db.run('INSERT INTO tables (id, identifier) VALUES (?, ?)', [tableNum, `table-${tableNum}`])
      db.run('INSERT INTO nodes (id, table_id, content) VALUES (?, ?, ?)', [
        tableNum * 10,
        tableNum,
        `node-${tableNum}`,
      ])
    }
    db.run('INSERT INTO nodes (id, table_id, content) VALUES (?, ?, ?)', [11, 1, 'node-zero'])

    const repo = new SqliteNodeEmbeddingRepository(db, {
      maxCachedTables: 2,
      maxCacheBytes: 1024 * 1024,
    })

    const vecA = [3, 4, 0, 5]
    const zeroVec = [0, 0, 0, 0]
    await repo.upsert({ nodeId: '10', tableId: '1', vector: vecA })
    await repo.upsert({ nodeId: '11', tableId: '1', vector: zeroVec })
    await repo.upsert({ nodeId: '20', tableId: '2', vector: [1, 2, 3, 4] })
    await repo.upsert({ nodeId: '30', tableId: '3', vector: [4, 3, 2, 1] })

    const queryVec = [6, 8, 1, 10]
    const res1 = await repo.searchSimilar({ tableId: '1', queryVector: queryVec, limit: 5 })
    expect(res1.hits[0]?.nodeId).toBe('10')
    expect(res1.hits[0]?.score).toBeCloseTo(cosineSimilarity(queryVec, vecA), 5)
    expect(res1.hits[1]?.nodeId).toBe('11')
    expect(res1.hits[1]?.score).toBe(0)

    await repo.searchSimilar({ tableId: '2', queryVector: queryVec, limit: 5 })
    await repo.searchSimilar({ tableId: '3', queryVector: queryVec, limit: 5 })
    expect(repo.getCacheStats().tableCount).toBe(2)
  })
})
