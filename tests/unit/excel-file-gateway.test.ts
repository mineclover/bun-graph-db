import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as XLSX from 'xlsx'
import { ExcelFileGateway } from '@/infrastructure/excel/gateways/ExcelFileGateway.js'
import { TabularSyncTargetRegistry } from '@/infrastructure/excel/TabularSyncTargetRegistry.js'
import type { TabularWritePlan } from '@/infrastructure/excel/gateways/TabularDestinationGateway.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('ExcelFileGateway', () => {
  test('writes table and metadata sheets while preserving existing workbook sheets', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bun-graph-db-excel-'))
    temporaryDirectories.push(directory)
    const workbookPath = join(directory, 'sync.xlsx')
    const registry = new TabularSyncTargetRegistry({
      targets: [{ id: 'excel', kind: 'excel-file', workbookPath }],
      routes: [
        { tableIdentifier: 'users', targetId: 'excel' },
        { tableIdentifier: 'projects', targetId: 'excel' },
      ],
    })
    const gateway = new ExcelFileGateway()
    const usersSelection = registry.resolve('users')
    const projectsSelection = registry.resolve('projects')
    if (!usersSelection || !projectsSelection) throw new Error('Expected Excel sync selections')

    await gateway.verifyWritable(usersSelection)
    expect(await Bun.file(workbookPath).exists()).toBe(false)

    await gateway.writeSheet(createPlan(usersSelection, 'users', [{ __node_id: 'user-1', name: 'Ada' }]))
    await gateway.writeSheet(createPlan(projectsSelection, 'projects', [{ __node_id: 'project-1', name: 'Graph DB' }]))

    expect(await gateway.readRows(usersSelection)).toEqual([{ __node_id: 'user-1', name: 'Ada' }])
    expect(await gateway.readRows(projectsSelection)).toEqual([{ __node_id: 'project-1', name: 'Graph DB' }])

    const workbookBuffer = await Bun.file(workbookPath).arrayBuffer()
    expect(workbookBuffer.byteLength).toBeGreaterThan(0)

    const workbook = XLSX.read(workbookBuffer, { type: 'array' })
    const metadata = XLSX.utils.sheet_to_json<{ tableIdentifier: string }>(workbook.Sheets._tables, {
      defval: '',
    })
    expect(metadata.map((row) => row.tableIdentifier).sort()).toEqual(['projects', 'users'])
  })
})

function createPlan(
  selection: NonNullable<ReturnType<TabularSyncTargetRegistry['resolve']>>,
  tableIdentifier: string,
  rows: Array<Record<string, string>>,
): TabularWritePlan {
  const columns = [
    {
      columnName: '__node_id',
      sourceType: 'system' as const,
      sourceKey: 'id',
      dataType: 'string',
      required: true,
      searchable: false,
      order: 0,
    },
    {
      columnName: 'name',
      sourceType: 'attribute' as const,
      sourceKey: 'name',
      dataType: 'string',
      required: false,
      searchable: true,
      order: 1,
    },
  ]

  return {
    selection,
    schema: { tableIdentifier, sheetName: selection.sheetName, columns },
    previousRows: [],
    rows,
    diff: { added: rows.length, removed: 0, changed: 0, unchanged: 0, rows: [] },
    metadataUpdate: {
      metadataSheetName: '_tables',
      schemaSheetName: '_schema',
      tableRows: [{ tableIdentifier, sheetName: selection.sheetName, rowCount: rows.length }],
      schemaRows: columns.map((column) => ({ ...column, tableIdentifier, sheetName: selection.sheetName })),
    },
  }
}
