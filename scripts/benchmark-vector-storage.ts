#!/usr/bin/env bun

import { Database } from 'bun:sqlite'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { ExactVectorIndex } from '@/domain/services/vector/ExactVectorIndex.js'

const SIZES = [100, 1_000, 5_000]
const DIMENSION = 64
const REPEATS = 5

interface TimingSummary {
  medianMs: number
  p95Ms: number
}

interface BenchmarkRow {
  size: number
  vectorExact: TimingSummary
  vectorScanned: number
  adjacencyBulk: TimingSummary
  adjacencyPerNode: TimingSummary
  adjacencyBulkRows: number
  adjacencyPerNodeRows: number
}

function summarize(samples: number[]): TimingSummary {
  const sorted = [...samples].sort((left, right) => left - right)
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
  }
}

async function measure(operation: () => void | Promise<void>): Promise<TimingSummary> {
  for (let index = 0; index < 2; index += 1) await operation()
  const samples: number[] = []
  for (let index = 0; index < REPEATS; index += 1) {
    const started = performance.now()
    await operation()
    samples.push(performance.now() - started)
  }
  return summarize(samples)
}

function vectorFor(index: number, dimension: number): number[] {
  return Array.from({ length: dimension }, (_, component) => Math.sin((index + 1) * (component + 1) * 0.017))
}

function createRelationDatabase(size: number): Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE node_relations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      source_node_id TEXT,
      source_external_id TEXT NOT NULL,
      target_node_id TEXT,
      target_external_id TEXT NOT NULL,
      relation_type_id TEXT NOT NULL,
      properties TEXT,
      strength INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  const insert = db.prepare(`
    INSERT INTO node_relations (
      id, table_id, source_node_id, source_external_id, target_node_id, target_external_id,
      relation_type_id, properties, strength, created_at, updated_at
    ) VALUES (?, 'table', ?, 'internal', ?, 'internal', 'type', NULL, 1, '2026-01-01', '2026-01-01')
  `)
  for (let sourceIndex = 0; sourceIndex < size; sourceIndex += 1) {
    for (let edgeIndex = 0; edgeIndex < 4; edgeIndex += 1) {
      insert.run(`edge-${sourceIndex}-${edgeIndex}`, `source-${sourceIndex}`, `target-${sourceIndex}-${edgeIndex}`)
    }
  }
  return db
}

async function run(): Promise<BenchmarkRow[]> {
  const rows: BenchmarkRow[] = []
  for (const size of SIZES) {
    const index = new ExactVectorIndex(DIMENSION)
    for (let item = 0; item < size; item += 1) index.upsert(`doc-${item}`, vectorFor(item, DIMENSION))
    const vectorQuery = vectorFor(size + 1, DIMENSION)
    let vectorScanned = 0
    const vectorExact = await measure(() => {
      const result = index.search(vectorQuery, 10)
      vectorScanned = result.metrics.scanned
    })

    const db = createRelationDatabase(size)
    const repository = new SqliteNodeRelationRepository(db)
    const frontier = Array.from({ length: Math.min(64, size) }, (_, item) => `source-${item}`)
    let adjacencyBulkRows = 0
    let adjacencyPerNodeRows = 0
    const adjacencyBulk = await measure(async () => {
      const result = await repository.findAdjacentByNodeIds(frontier, 'OUTGOING')
      adjacencyBulkRows = [...result.values()].reduce((count, relations) => count + relations.length, 0)
    })
    const adjacencyPerNode = await measure(async () => {
      const result = await Promise.all(frontier.map((nodeId) => repository.findBySourceNodeId(nodeId)))
      adjacencyPerNodeRows = result.reduce((count, relations) => count + relations.length, 0)
    })
    db.close()

    rows.push({
      size,
      vectorExact,
      vectorScanned,
      adjacencyBulk,
      adjacencyPerNode,
      adjacencyBulkRows,
      adjacencyPerNodeRows,
    })
  }
  return rows
}

if (import.meta.main) {
  console.log(JSON.stringify({
    schemaVersion: 'bun-graph-db.vector-storage-benchmark.v1',
    dimension: DIMENSION,
    repeats: REPEATS,
    sizes: SIZES,
    note: 'Exact vector scan and SQLite in-memory adjacency only; this is not a Kuzu or disk benchmark.',
    rows: await run(),
  }, null, 2))
}
