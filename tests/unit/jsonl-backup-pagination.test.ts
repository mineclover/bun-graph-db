import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonlBackupService } from '../../src/domain/services/JsonlBackupService'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('JsonlBackupService pagination', () => {
  test('streams every node page and batches attribute reads', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bun-graph-jsonl-'))
    temporaryDirectories.push(outputDir)
    const nodes = Array.from({ length: 501 }, (_, index) => fakeNode(String(index + 1)))
    const batchedNodeIds: string[][] = []
    const table = {
      id: 'table-1',
      identifier: 'tasks',
      description: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const attribute = {
      getId: () => 'attribute-1',
      getIdentifier: () => 'status',
      getName: () => 'Status',
      getAttributeTypeId: () => 'type-1',
      getDescription: () => null,
      getIsRequired: () => false,
    }
    const attributeType = {
      getId: () => 'type-1',
      getIdentifier: () => 'string',
    }

    const service = new JsonlBackupService(
      {
        findAll: async () => ({ data: [table], total: 1, nodes: [table], totalCount: 1 }),
      } as never,
      {
        findByTableId: async () => ({ data: [attribute], total: 1, nodes: [attribute], totalCount: 1 }),
      } as never,
      {
        findByIds: async () => [attributeType],
      } as never,
      {
        findByTableId: async (_tableId: string, options: { limit: number; offset: number }) => {
          const page = nodes.slice(options.offset, options.offset + options.limit)
          return { data: page, nodes: page, total: nodes.length, totalCount: nodes.length }
        },
      } as never,
      {
        findByNodeId: async () => {
          throw new Error('N+1 attribute lookup must not be used')
        },
        findByNodeIds: async (nodeIds: string[]) => {
          batchedNodeIds.push(nodeIds)
          return nodeIds.map((nodeId) => ({
            getNodeId: () => nodeId,
            getAttributeId: () => 'attribute-1',
            getValue: () => 'active',
          }))
        },
      } as never,
      {} as never,
      {} as never,
      {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    )

    const result = await service.export({
      outputDir,
      includeSchema: true,
      includeRelations: false,
    })

    expect(result.success).toBe(true)
    expect(result.stats.nodesExported).toBe(501)
    expect(batchedNodeIds.map((ids) => ids.length)).toEqual([500, 1])
    const lines = readFileSync(join(outputDir, 'tables', 'tasks.jsonl'), 'utf8').split('\n')
    expect(lines).toHaveLength(501)
    expect(JSON.parse(lines[500] ?? '{}')).toMatchObject({ _id: '501', status: 'active' })
  })

  test('imports large JSONL inputs line by line', async () => {
    const inputDir = mkdtempSync(join(tmpdir(), 'bun-graph-jsonl-import-'))
    temporaryDirectories.push(inputDir)
    mkdirSync(join(inputDir, 'tables'))
    const nodeLines = Array.from({ length: 501 }, (_, index) => JSON.stringify({
      _id: String(index + 1),
      _content: `node-${index + 1}`,
      _title: '',
      _createdAt: '2026-01-01T00:00:00.000Z',
      _updatedAt: '2026-01-01T00:00:00.000Z',
    }))
    const relationLines = Array.from({ length: 501 }, (_, index) => JSON.stringify({
      id: String(index + 1),
      fromNodeId: '1',
      toNodeId: '2',
      relationTypeId: '1',
      relationType: 'related',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    writeFileSync(join(inputDir, 'manifest.json'), JSON.stringify({
      version: '1.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'test',
      tables: [{ identifier: 'tasks', nodeCount: 501, file: 'tables/tasks.jsonl' }],
      hasRelations: true,
      hasSchema: false,
    }))
    writeFileSync(join(inputDir, 'tables', 'tasks.jsonl'), nodeLines.join('\n'))
    writeFileSync(join(inputDir, 'relations.jsonl'), relationLines.join('\n'))

    const service = new JsonlBackupService(
      { findByIdentifier: async () => ({ id: 'table-1', identifier: 'tasks' }) } as never,
      {} as never,
      {} as never,
      { findByTableIdAndContent: async () => fakeNode('existing') } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    )

    const result = await service.import({ inputDir, conflictResolution: 'skip', dryRun: false })

    expect(result.success).toBe(true)
    expect(result.stats.nodesSkipped).toBe(501)
    expect(result.stats.relationsImported).toBe(501)
  })

  test('keeps the last valid table file and manifest when a later page fails', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bun-graph-jsonl-atomic-'))
    temporaryDirectories.push(outputDir)
    mkdirSync(join(outputDir, 'tables'))
    const previousTable = '{"_id":"last-known-good"}'
    const previousManifest = '{"version":"previous"}'
    writeFileSync(join(outputDir, 'tables', 'tasks.jsonl'), previousTable)
    writeFileSync(join(outputDir, 'manifest.json'), previousManifest)
    const nodes = Array.from({ length: 500 }, (_, index) => fakeNode(String(index + 1)))
    const table = {
      id: 'table-1',
      identifier: 'tasks',
      description: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const service = new JsonlBackupService(
      { findAll: async () => ({ data: [table], total: 1 }) } as never,
      { findByTableId: async () => ({ data: [], total: 0 }) } as never,
      { findByIds: async () => [] } as never,
      {
        findByTableId: async (_tableId: string, options: { offset: number }) => {
          if (options.offset === 0) return { data: nodes, total: 501 }
          throw new Error('simulated second-page failure')
        },
      } as never,
      { findByNodeIds: async () => [] } as never,
      {} as never,
      {} as never,
      silentLogger(),
    )

    const result = await service.export({ outputDir, includeSchema: false, includeRelations: false })

    expect(result.success).toBe(false)
    expect(result.errors.join(' ')).toContain('simulated second-page failure')
    expect(readFileSync(join(outputDir, 'tables', 'tasks.jsonl'), 'utf8')).toBe(previousTable)
    expect(readFileSync(join(outputDir, 'manifest.json'), 'utf8')).toBe(previousManifest)
    expect(readdirSync(join(outputDir, 'tables')).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  test('treats a requested relation export failure as a failed snapshot', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bun-graph-jsonl-relations-'))
    temporaryDirectories.push(outputDir)
    const service = new JsonlBackupService(
      { findAll: async () => ({ data: [], total: 0 }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findAll: async () => { throw new Error('relation repository unavailable') } } as never,
      silentLogger(),
    )

    const result = await service.export({ outputDir, includeSchema: false, includeRelations: true })

    expect(result.success).toBe(false)
    expect(result.errors.join(' ')).toContain('relation repository unavailable')
    expect(result.warnings).toEqual([])
  })
})

function fakeNode(id: string) {
  return {
    getId: () => id,
    getTitle: () => `Node ${id}`,
    getContent: () => `content ${id}`,
    getCreatedAt: () => new Date('2026-01-01T00:00:00.000Z'),
    getUpdatedAt: () => new Date('2026-01-01T00:00:00.000Z'),
  }
}

function silentLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  }
}
