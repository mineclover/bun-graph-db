import { describe, expect, test, vi } from 'vitest'
import { ExcelSchemaProjector } from '@/infrastructure/excel/ExcelSchemaProjector.js'
import {
  type ResolvedSyncTargetSelection,
  TabularSyncTargetRegistry,
} from '@/infrastructure/excel/TabularSyncTargetRegistry.js'
import type { TabularWritePlan } from '@/infrastructure/excel/gateways/TabularDestinationGateway.js'
import { TabularSyncPlanner } from '@/infrastructure/excel/sync/TabularSyncPlanner.js'
import { TabularSyncService } from '@/infrastructure/excel/sync/TabularSyncService.js'

function createService() {
  const registry = new TabularSyncTargetRegistry({
    defaultTargetId: 'google-main',
    targets: [
      {
        id: 'google-main',
        kind: 'google-sheets',
        spreadsheetId: 'spreadsheet-1',
      },
    ],
    routes: [
      {
        tableIdentifier: 'users',
        targetId: 'google-main',
        sheetName: 'Users',
      },
    ],
  })
  const writes: TabularWritePlan[] = []
  const gateway = {
    supports: vi.fn(() => true),
    supportsIncrementalWrite: vi.fn(async () => true),
    readRows: vi.fn(async () => []),
    writeSheet: vi.fn(async (plan: TabularWritePlan) => {
      writes.push(plan)
    }),
  }
  const service = new TabularSyncService(
    registry,
    new TabularSyncPlanner(registry, new ExcelSchemaProjector()),
    [gateway],
  )
  return { service, gateway, writes }
}

const attributes = [
  {
    identifier: 'email',
    dataType: 'email',
    required: true,
    searchable: true,
  },
]

function node(id: string, title: string) {
  return {
    id,
    title,
    content: `${title} content`,
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    attributes: { email: `${id}@example.com` },
  }
}

describe('TabularSyncService incremental snapshots', () => {
  test('patches one dirty node without another remote full read', async () => {
    const { service, gateway, writes } = createService()
    const initial = await service.sync({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes,
      nodes: [node('1', 'Alpha'), node('2', 'Beta')],
    })

    const incremental = await service.syncIncremental({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes,
      nodes: [node('1', 'Alpha Updated')],
      dirtyNodeIds: ['1'],
      revision: 2,
    })

    expect(initial.synced).toBe(true)
    expect(incremental?.synced).toBe(true)
    expect(incremental?.metrics).toEqual(
      expect.objectContaining({
        mode: 'incremental',
        remoteReadSkipped: true,
        previousRowCount: 2,
        nextRowCount: 2,
      }),
    )
    expect(incremental?.diffSummary).toEqual({
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 1,
    })
    expect(gateway.readRows).toHaveBeenCalledTimes(1)
    expect(writes).toHaveLength(2)
    expect(writes[1]?.previousRows).toHaveLength(2)
    expect(writes[1]?.rows.find((row) => row.__node_id === '1')?.__title)
      .toBe('Alpha Updated')
    expect(writes[1]?.rows.find((row) => row.__node_id === '2')?.__title)
      .toBe('Beta')
  })

  test('falls back before remote I/O when no successful snapshot exists', async () => {
    const { service, gateway, writes } = createService()

    const result = await service.syncIncremental({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes,
      nodes: [node('1', 'Alpha')],
      dirtyNodeIds: ['1'],
      revision: 1,
    })

    expect(result).toBeNull()
    expect(gateway.readRows).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  test('falls back when schema changes and skips a no-op patch write', async () => {
    const { service, gateway, writes } = createService()
    await service.sync({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes,
      nodes: [node('1', 'Alpha')],
    })

    const unchanged = await service.syncIncremental({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes,
      nodes: [node('1', 'Alpha')],
      dirtyNodeIds: ['1'],
      revision: 2,
    })
    const schemaChanged = await service.syncIncremental({
      tableId: 'table-1',
      tableIdentifier: 'users',
      attributes: [
        ...attributes,
        { identifier: 'role', dataType: 'string', required: false },
      ],
      nodes: [node('1', 'Alpha')],
      dirtyNodeIds: ['1'],
      revision: 3,
    })

    expect(unchanged?.metrics?.writeSkipped).toBe(true)
    expect(schemaChanged).toBeNull()
    expect(gateway.readRows).toHaveBeenCalledTimes(1)
    expect(writes).toHaveLength(1)
  })

  test('does not retain a failed full write as an incremental snapshot', async () => {
    const { service, gateway } = createService()
    gateway.writeSheet.mockImplementationOnce(async () => {
      throw new Error('quota exhausted')
    })

    await expect(
      service.sync({
        tableId: 'table-1',
        tableIdentifier: 'users',
        attributes,
        nodes: [node('1', 'Alpha')],
      }),
    ).rejects.toThrow('quota exhausted')

    expect(
      await service.syncIncremental({
        tableId: 'table-1',
        tableIdentifier: 'users',
        attributes,
        nodes: [node('1', 'Alpha Updated')],
        dirtyNodeIds: ['1'],
        revision: 2,
      }),
    ).toBeNull()
  })

  test('serializes tables that share one physical workbook', async () => {
    const registry = new TabularSyncTargetRegistry({
      defaultTargetId: 'workbook',
      targets: [
        {
          id: 'workbook',
          kind: 'excel-file',
          workbookPath: '/tmp/shared.xlsx',
        },
      ],
      routes: ['users', 'projects'].map((tableIdentifier) => ({
        tableIdentifier,
        targetId: 'workbook',
      })),
    })
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const reads: string[] = []
    const gateway = {
      supports: () => true,
      readRows: vi.fn(async (selected: ResolvedSyncTargetSelection) => {
        reads.push(selected.route.tableIdentifier)
        if (reads.length === 1) await firstGate
        return []
      }),
      writeSheet: vi.fn(async () => undefined),
    }
    const service = new TabularSyncService(
      registry,
      new TabularSyncPlanner(registry, new ExcelSchemaProjector()),
      [gateway],
    )

    const users = service.sync({
      tableIdentifier: 'users',
      attributes: [],
      nodes: [node('1', 'Alpha')],
    })
    const projects = service.sync({
      tableIdentifier: 'projects',
      attributes: [],
      nodes: [node('2', 'Beta')],
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(reads).toEqual(['users'])
    releaseFirst()
    await Promise.all([users, projects])
    expect(reads).toEqual(['users', 'projects'])
  })
})
