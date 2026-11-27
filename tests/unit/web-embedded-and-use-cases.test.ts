import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { createKnowledgeArchitectureBlueprint } from '@/application/blueprints/PresetBlueprints.js'
import { createEmbeddedWebGraphDb } from '@/presentation/web/EmbeddedWebGraphDb.js'
import {
  type SqlJsDatabaseLike,
  type SqlJsStatementLike,
  type SqliteWasmOo1DatabaseLike,
  type WebKeyValueStorageLike,
  WebKeyValueSnapshotStorage,
  WebSqliteDatabase,
} from '@/infrastructure/database/sqlite/WebSqliteAdapter.js'
import type { SqliteBindPrimitive } from '@/infrastructure/database/sqlite/SqlitePort.js'
import {
  EmbeddingGemma2Provider,
  createDeterministicHashEmbeddingBackend,
} from '@/infrastructure/embeddings/EmbeddingGemma2Provider.js'

function toNodeSqlInput(val: unknown): SQLInputValue {
  if (val === undefined || val === null) return null
  if (typeof val === 'boolean') return val ? 1 : 0
  if (
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'bigint' ||
    ArrayBuffer.isView(val)
  ) {
    return val as SQLInputValue
  }
  return String(val)
}

/**
 * In-memory sql.js structural test harness backed by real SQLite (`node:sqlite`).
 */
function createSqlJsHarness(): SqlJsDatabaseLike & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  let lastModified = 0

  return {
    raw,
    prepare(sql: string, initialParams?: readonly SqliteBindPrimitive[]): SqlJsStatementLike {
      const stmt = raw.prepare(sql)
      let bound: SQLInputValue[] = (initialParams ?? []).map(toNodeSqlInput)
      let rows: Record<string, unknown>[] | null = null
      let cursorIndex = -1

      const isRowQuery =
        /^\s*(?:select|pragma|with|explain)\b/i.test(sql) || /\breturning\b/i.test(sql)

      return {
        bind(values) {
          if (Array.isArray(values)) {
            bound = values.map(toNodeSqlInput)
          } else if (values && typeof values === 'object') {
            bound = Object.values(values).map(toNodeSqlInput)
          }
          rows = null
          cursorIndex = -1
          return true
        },
        step() {
          if (rows === null) {
            if (isRowQuery) {
              rows = stmt.all(...bound) as Record<string, unknown>[]
            } else {
              const info = stmt.run(...bound)
              lastModified = Number(info.changes)
              rows = []
            }
          }
          cursorIndex += 1
          return cursorIndex < rows.length
        },
        getAsObject() {
          return (rows?.[cursorIndex] ?? {}) as Record<string, unknown>
        },
        free() {
          return true
        },
      }
    },
    exec(sql: string) {
      raw.exec(sql)
    },
    getRowsModified() {
      return lastModified
    },
    export() {
      return new TextEncoder().encode('sqljs-snapshot-stub')
    },
    close() {
      raw.close()
    },
  }
}

/**
 * In-memory @sqlite.org/sqlite-wasm OO1 structural test harness backed by real SQLite (`node:sqlite`).
 */
function createSqliteWasmOo1Harness(): SqliteWasmOo1DatabaseLike & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  let lastChanges = 0

  return {
    raw,
    exec(options) {
      const bindings = Array.isArray(options.bind)
        ? options.bind.map(toNodeSqlInput)
        : options.bind && typeof options.bind === 'object'
          ? Object.values(options.bind).map(toNodeSqlInput)
          : []
      const isRowQuery =
        options.returnValue === 'resultRows' ||
        /^\s*(?:select|pragma|with|explain)\b/i.test(options.sql)
      if (bindings.length === 0 && !isRowQuery) {
        raw.exec(options.sql)
        lastChanges = 0
        return this
      }
      const stmt = raw.prepare(options.sql)
      if (isRowQuery) {
        return stmt.all(...bindings)
      }
      const info = stmt.run(...bindings)
      lastChanges = Number(info.changes)
      return this
    },
    changes() {
      return lastChanges
    },
    export() {
      return new TextEncoder().encode('sqlite-wasm-snapshot-stub')
    },
    close() {
      raw.close()
    },
  }
}

function createMemoryKv(): WebKeyValueStorageLike {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => {
      store.set(key, val)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    keys: () => [...store.keys()],
  }
}

describe('Web Embedded SQLite, Information Architecture, & AI Agent Memory', () => {
  test('supports both sql.js and sqlite-wasm OO1 drivers + WebKeyValueSnapshotStorage', async () => {
    for (const driver of [createSqlJsHarness(), createSqliteWasmOo1Harness()]) {
      const db = new WebSqliteDatabase(driver)
      expect(db.driver).toBe('web-sqlite')
      expect(db.supportsFilePragmas).toBe(false)

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, vec BLOB)')
      const blob = new Uint8Array([1, 2, 3, 4])

      // Nested savepoint transaction test
      const outer = db.transaction(() => {
        const res = db
          .prepare('INSERT INTO items (name, vec) VALUES ($name, $vec)')
          .run({ name: 'kept', vec: blob })
        expect(res.changes).toBe(1)
        expect(Number(res.lastInsertRowid)).toBe(1)

        try {
          db.transaction(() => {
            db.run('INSERT INTO items (name, vec) VALUES (?, ?)', ['rolled-back', blob])
            throw new Error('force-savepoint-rollback')
          })()
        } catch {
          // Expected savepoint rollback
        }
      })
      outer()

      const rows = db.query<{ name: string; vec: Uint8Array }>('SELECT name, vec FROM items').all()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.name).toBe('kept')
      expect(new Uint8Array(rows[0]?.vec ?? [])).toEqual(blob)
      expect(db.exportBytes()?.length).toBeGreaterThan(0)
      db.close()
    }

    const kv = createMemoryKv()
    const snapshots = new WebKeyValueSnapshotStorage(kv)
    const sample = new Uint8Array([10, 20, 30, 40])
    await snapshots.putSnapshot('web/main.db', sample, { env: 'browser' })
    expect(await snapshots.listSnapshots('web/')).toEqual(['web/main.db'])
    const loaded = await snapshots.getSnapshot('web/main.db')
    expect(loaded?.data).toEqual(sample)
    expect(loaded?.metadata?.customMetadata?.env).toBe('browser')
    await snapshots.deleteSnapshot('web/main.db')
    expect(await snapshots.listSnapshots()).toEqual([])
  })

  test('runs EmbeddedWebGraphDb end-to-end with Information Architecture blueprint + EmbeddingGemma-2 + faceted subtree query', async () => {
    const provider = new EmbeddingGemma2Provider({
      dimension: 256,
      dtype: 'q4',
      backend: createDeterministicHashEmbeddingBackend(768),
    })
    const snapshotStorage = new WebKeyValueSnapshotStorage(createMemoryKv())

    const webDb = await createEmbeddedWebGraphDb({
      database: createSqlJsHarness(),
      databaseLabel: ':web:ia-demo:',
      embeddingProvider: provider,
      snapshotStorage,
    })

    try {
      const blueprint = createKnowledgeArchitectureBlueprint()
      const applied = await webDb.ia.applyBlueprint(blueprint)
      expect(applied.tables.ia_topics).toBeDefined()
      expect(applied.tables.ia_documents).toBeDefined()
      expect(applied.tables.ia_concepts).toBeDefined()
      expect(applied.hierarchyValidations.ia_topics?.valid).toBe(true)
      expect(applied.hierarchyValidations.ia_concepts?.valid).toBe(true)
      expect(applied.conformanceReports.ia_documents?.valid).toBe(true)
      expect(applied.embeddedNodeCount).toBe(10)

      // Applying the same blueprint twice must be idempotent
      const secondApply = await webDb.ia.applyBlueprint(blueprint)
      expect(secondApply.relationsCreated).toBe(0)

      // Faceted + subtree-scoped IA structured query (descendants under topic_ai in ia_topics)
      const topicQuery = await webDb.ia.queryStructured({
        tableIdentifier: 'ia_topics',
        underNodeKey: 'topic_ai',
        includeRoot: false,
        textQuery: 'Matryoshka Retrieval',
        facets: ['slug'],
        includeBreadcrumbs: true,
        includeRelated: {
          relationTypes: ['belongsToTopic'],
          direction: 'OUTGOING',
          maxDepth: 1,
        },
      })
      expect(topicQuery.hits).toHaveLength(1)
      expect(topicQuery.hits[0]?.breadcrumbs?.map((b) => b.title)).toEqual([
        'Engineering Knowledge',
        'AI and Embeddings',
        'EmbeddingGemma-2',
      ])
      expect(topicQuery.hits[0]?.related?.[0]?.title).toBe('EmbeddingGemma-2 MRL Retrieval Guide')
      expect(topicQuery.facets.slug?.[0]).toEqual({ value: 'embeddinggemma-2', count: 1 })

      // Faceted typed document catalog search using EmbeddingGemma-2 auto-vectorization
      const docQuery = await webDb.ia.queryStructured({
        tableIdentifier: 'ia_documents',
        filterQuery: 'domain:ai AND status:published AND priority:>88',
        textQuery: '5-Signal Agent Memory cosine similarity',
        facets: ['audience', 'status'],
      })
      expect(docQuery.hits.length).toBeGreaterThanOrEqual(1)
      expect(docQuery.hits[0]?.node.title).toBe('5-Signal Agent Memory Architecture')
      expect(docQuery.facets.status?.[0]).toEqual({ value: 'published', count: docQuery.hits.length })

      const saved = await webDb.saveSnapshot('ia-snapshot-1', { version: '1' })
      expect(saved.bytes).toBeGreaterThan(0)

      const inspection = await webDb.ia.inspectArchitecture()
      expect(inspection.totalTables).toBeGreaterThanOrEqual(3)
    } finally {
      await webDb.dispose()
    }
  })

  test('runs 5-signal AI Agent Memory lifecycle and exposes memory-* MCP 2026-07-28 tools', async () => {
    const provider = new EmbeddingGemma2Provider({
      dimension: 256,
      dtype: 'q4',
      backend: createDeterministicHashEmbeddingBackend(768),
    })

    const webDb = await createEmbeddedWebGraphDb({
      database: createSqliteWasmOo1Harness(),
      databaseLabel: ':web:ai-memory:',
      embeddingProvider: provider,
    })

    try {
      const now = new Date('2026-11-27T12:00:00.000Z')
      const oneHourAgo = new Date(now.getTime() - 3_600_000).toISOString()
      const twentyDaysAgo = new Date(now.getTime() - 20 * 86_400_000).toISOString()
      const pastIso = new Date(now.getTime() - 60_000).toISOString()

      const memOldWorking = await webDb.aiMemory.remember({
        content: 'User briefly tested port 4000 before migrating to port 4141 in Node 26.',
        kind: 'working',
        namespace: 'assistant',
        topicPath: ['infra', 'runtime'],
        importance: 0.5,
        recordedAt: twentyDaysAgo,
      })
      const memRecentPref = await webDb.aiMemory.remember({
        content: 'User prefers EmbeddingGemma-2 with 256D Matryoshka vectors in browser IndexedDB.',
        kind: 'semantic',
        namespace: 'assistant',
        topicPath: ['ai', 'embeddings'],
        importance: 0.95,
        confidence: 0.98,
        tags: ['embeddinggemma-2', 'web'],
        recordedAt: oneHourAgo,
      })
      const memExpired = await webDb.aiMemory.remember({
        content: 'Temporary scratch OTP token expired immediately.',
        kind: 'working',
        namespace: 'assistant',
        topicPath: ['security'],
        expiresAt: pastIso,
      })
      expect(memRecentPref.embedded).toBe(true)

      // 1. Recall fused with temporal decay & excludes expired
      const recalled = await webDb.aiMemory.recall({
        query: 'EmbeddingGemma 256D browser embeddings',
        namespace: 'assistant',
        topicPath: ['ai'],
        now,
      })
      expect(recalled.hits.length).toBeGreaterThanOrEqual(1)
      expect(recalled.hits[0]?.memory.id).toBe(memRecentPref.memory.id)
      expect(recalled.hits[0]?.memory.accessCount).toBe(2)
      expect(recalled.hits.some((h) => h.memory.id === memExpired.memory.id)).toBe(false)

      // Old working memory with 1-day half-life has decayed recency vs 1-hour semantic memory
      const workingRecalled = await webDb.aiMemory.recall({
        namespace: 'assistant',
        now,
        includeExpired: false,
      })
      const oldHit = workingRecalled.hits.find((h) => h.memory.id === memOldWorking.memory.id)
      const prefHit = workingRecalled.hits.find((h) => h.memory.id === memRecentPref.memory.id)
      expect(prefHit && oldHit && prefHit.score.recency > oldHit.score.recency).toBe(true)

      // 2. Consolidate working memories into procedural rule (supersedes old working memory)
      const consolidated = await webDb.aiMemory.consolidate({
        sourceMemoryIds: [memOldWorking.memory.id],
        content: 'Default dev server port is always 4141 under Node 26 + pnpm.',
        kind: 'procedural',
        namespace: 'assistant',
        topicPath: ['infra', 'runtime'],
        recordedAt: oneHourAgo,
      })
      expect(consolidated.supersededIds).toEqual([memOldWorking.memory.id])

      const afterConsolidate = await webDb.aiMemory.recall({
        query: 'dev server port 4141',
        namespace: 'assistant',
        now,
      })
      expect(afterConsolidate.hits.some((h) => h.memory.id === memOldWorking.memory.id)).toBe(false)
      expect(afterConsolidate.hits[0]?.memory.id).toBe(consolidated.memory.id)

      // 3. Context Window assembly & Prune Expired
      const ctx = await webDb.aiMemory.getContextWindow({
        query: 'EmbeddingGemma port 4141',
        namespace: 'assistant',
        maxTokens: 300,
        now,
      })
      expect(ctx.promptContext).toContain('[semantic]')
      expect(ctx.estimatedTokens).toBeLessThanOrEqual(300)

      const pruned = await webDb.aiMemory.pruneExpired({ now })
      expect(pruned.prunedIds).toContain(memExpired.memory.id)

      const timeline = await webDb.aiMemory.getTimeline({ namespace: 'assistant' })
      expect(timeline.length).toBe(2)

      const stats = await webDb.aiMemory.getStats('assistant')
      expect(stats.embeddedCount).toBeGreaterThanOrEqual(2)
      expect(stats.byStatus.superseded).toBe(1)
      expect(stats.byStatus.archived).toBe(1)

      // 4. MCP 2026-07-28 tools/list & tools/call for AI Memory
      const modernHeaders = {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'memory-remember',
      }
      const modernMeta = {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
      }

      const mcpRemember = await webDb.fetch(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: modernHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'mem-1',
            method: 'tools/call',
            params: {
              _meta: modernMeta,
              name: 'memory-remember',
              arguments: {
                content: 'MCP 2026-07-28 stateless memory persistence works in Web SQLite.',
                kind: 'semantic',
                namespace: 'assistant',
                topicPath: ['mcp', 'protocol'],
                importance: 0.9,
              },
            },
          }),
        }),
      )
      expect(mcpRemember.status).toBe(200)
      const mcpRememberJson = (await mcpRemember.json()) as {
        result: { isError: boolean; structuredContent?: { memory?: { id: string } } }
      }
      expect(mcpRememberJson.result.isError).toBe(false)
      expect(mcpRememberJson.result.structuredContent?.memory?.id).toBeTruthy()

      const mcpRecall = await webDb.fetch(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: { ...modernHeaders, 'Mcp-Name': 'memory-recall' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'mem-2',
            method: 'tools/call',
            params: {
              _meta: modernMeta,
              name: 'memory-recall',
              arguments: {
                query: 'MCP 2026-07-28 stateless memory',
                namespace: 'assistant',
                limit: 3,
              },
            },
          }),
        }),
      )
      const mcpRecallJson = (await mcpRecall.json()) as {
        result: { isError: boolean; structuredContent?: { hits?: Array<{ memory: { content: string } }> } }
      }
      expect(mcpRecallJson.result.isError).toBe(false)
      expect(mcpRecallJson.result.structuredContent?.hits?.[0]?.memory.content).toContain(
        'MCP 2026-07-28 stateless memory persistence',
      )
    } finally {
      await webDb.dispose()
    }
  })

  test('has zero static top-level Node built-in imports in src/embedded.ts transitive graph', () => {
    const repoRoot = resolve(process.cwd())
    const nodeBuiltins = new Set([
      'assert',
      'buffer',
      'child_process',
      'crypto',
      'events',
      'fs',
      'fs/promises',
      'http',
      'https',
      'net',
      'os',
      'path',
      'sqlite',
      'stream',
      'tls',
      'url',
      'util',
      'zlib',
    ])

    const resolveRelativeImport = (fromFile: string, specifier: string): string | null => {
      const target = specifier.startsWith('@/')
        ? join(repoRoot, 'src', specifier.slice(2))
        : resolve(dirname(fromFile), specifier)
      const candidates = [
        target.replace(/\.js$/, '.ts'),
        `${target}.ts`,
        join(target, 'index.ts'),
        target,
      ]
      for (const candidate of candidates) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return candidate
        }
      }
      return null
    }

    const visited = new Set<string>()
    const violations: Array<{ file: string; specifier: string }> = []
    const importRe = /(?:import|export)\s+(?!type\b)(?:[\s\S]*?\bfrom\s*)?['"]([^'"]+)['"]/g

    const visit = (file: string) => {
      if (visited.has(file)) return
      visited.add(file)
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(importRe)) {
        const specifier = match[1]
        if (!specifier) continue
        if (specifier.startsWith('node:') || nodeBuiltins.has(specifier)) {
          violations.push({
            file: relative(repoRoot, file),
            specifier,
          })
          continue
        }
        if (specifier.startsWith('.') || specifier.startsWith('@/')) {
          const next = resolveRelativeImport(file, specifier)
          if (next) visit(next)
        }
      }
    }

    visit(join(repoRoot, 'src', 'embedded.ts'))
    expect(visited.size).toBeGreaterThan(20)
    expect(violations).toEqual([])
  })
})
