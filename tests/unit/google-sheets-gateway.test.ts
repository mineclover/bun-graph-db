import { describe, expect, mock, test } from 'bun:test'
import type { ResolvedSyncTargetSelection } from '@/infrastructure/excel/TabularSyncTargetRegistry.js'
import type { GoogleSheetsPatchCapableAdapter } from '@/infrastructure/excel/adapters/GoogleSheetsAdapter.js'
import { GoogleSheetsGateway } from '@/infrastructure/excel/gateways/GoogleSheetsGateway.js'
import type { TabularWritePlan } from '@/infrastructure/excel/gateways/TabularDestinationGateway.js'

function selection(
  primaryKeyColumn = '__node_id',
): ResolvedSyncTargetSelection {
  return {
    target: {
      id: 'google-main',
      kind: 'google-sheets',
      spreadsheetId: 'spreadsheet-1',
      spreadsheetUrl: undefined as unknown as string,
      authMode: 'service-account',
      accessMode: 'google-drive-api',
      transport: 'google-tools-http',
      cliCommand: 'gwk',
      adapterKind: undefined as unknown as 'google-tools-submodule',
      googleToolsSubmodulePath: undefined as unknown as string,
      googleToolsBaseUrl: 'http://localhost:5678',
      pipeBuilderWorkspacePath: undefined as unknown as string,
      tableAdapterPackagePath: undefined as unknown as string,
      serviceAccountKeyFile: undefined as unknown as string,
      oauthTokenFile: undefined as unknown as string,
      displayName: 'google-main',
      enabled: true,
    },
    route: {
      tableIdentifier: 'users',
      targetId: 'google-main',
      enabled: true,
      sheetName: 'users',
      primaryKeyColumn,
      diffMode: 'summary',
    },
    sheetName: 'users',
  }
}

function plan(
  selected = selection(),
  columns = ['__node_id', '__title'],
): TabularWritePlan {
  const previousRows = [{ __node_id: '1', __title: 'Alpha' }]
  const rows = [{ __node_id: '1', __title: 'Alpha Updated' }]
  return {
    selection: selected,
    schema: {
      tableIdentifier: 'users',
      sheetName: 'users',
      columns: columns.map((columnName, order) => ({
        columnName,
        sourceType: 'system',
        sourceKey: columnName === '__node_id' ? 'id' : 'title',
        dataType: columnName === '__node_id' ? 'id' : 'string',
        required: columnName === '__node_id',
        searchable: true,
        order,
      })),
    },
    previousRows,
    rows,
    diff: {
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 0,
      rows: [
        {
          kind: 'changed',
          key: '1',
          before: previousRows[0],
          after: rows[0],
          changedColumns: ['__title'],
        },
      ],
    },
    metadataUpdate: {
      metadataSheetName: '_tables',
      schemaSheetName: '_schema',
      tableRows: [],
      schemaRows: [],
    },
  }
}

function adapter(values: Array<Array<string | number | boolean | null>>) {
  return {
    readSheet: mock(async () => ({ values })),
    replaceSheet: mock(async () => undefined),
    patchSheet: mock(async () => true),
  } satisfies GoogleSheetsPatchCapableAdapter
}

describe('GoogleSheetsGateway', () => {
  test('readRows should throw when spreadsheetId is missing', async () => {
    const gateway = new GoogleSheetsGateway({
      readSheet: async () => ({ values: [] }),
      replaceSheet: async () => undefined,
    })
    const missingSpreadsheet = selection()
    missingSpreadsheet.target.spreadsheetId = undefined as unknown as string

    await expect(gateway.readRows(missingSpreadsheet)).rejects.toThrow(
      'missing spreadsheetId',
    )
  })

  test('uses full replacement for a blank sheet so the header is written', async () => {
    const sheetsAdapter = adapter([])
    const gateway = new GoogleSheetsGateway(sheetsAdapter)
    const selected = selection()

    expect(await gateway.readRows(selected)).toEqual([])
    await gateway.writeSheet(plan(selected))

    expect(sheetsAdapter.patchSheet).not.toHaveBeenCalled()
    expect(sheetsAdapter.replaceSheet).toHaveBeenCalledWith(
      'spreadsheet-1',
      'users',
      [
        ['__node_id', '__title'],
        ['1', 'Alpha Updated'],
      ],
    )
    expect(await gateway.supportsIncrementalWrite(selected)).toBe(true)
  })

  test('patches only after observing an exact schema header', async () => {
    const sheetsAdapter = adapter([
      ['__node_id', '__title'],
      ['1', 'Alpha'],
    ])
    const gateway = new GoogleSheetsGateway(sheetsAdapter)
    const selected = selection()

    await gateway.readRows(selected)
    await gateway.writeSheet(plan(selected))

    expect(sheetsAdapter.patchSheet).toHaveBeenCalledTimes(1)
    expect(sheetsAdapter.replaceSheet).not.toHaveBeenCalled()
  })

  test('does not spend a write quota request when the verified sheet is unchanged', async () => {
    const sheetsAdapter = adapter([
      ['__node_id', '__title'],
      ['1', 'Alpha'],
    ])
    const gateway = new GoogleSheetsGateway(sheetsAdapter)
    const selected = selection()
    await gateway.readRows(selected)
    const unchangedPlan = plan(selected)
    unchangedPlan.rows = unchangedPlan.previousRows
    unchangedPlan.diff = {
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 1,
      rows: [],
    }

    await gateway.writeSheet(unchangedPlan)

    expect(sheetsAdapter.patchSheet).not.toHaveBeenCalled()
    expect(sheetsAdapter.replaceSheet).not.toHaveBeenCalled()
  })

  test('falls back on schema drift and rejects custom-key incremental writes', async () => {
    const sheetsAdapter = adapter([
      ['__node_id', '__title'],
      ['1', 'Alpha'],
    ])
    const gateway = new GoogleSheetsGateway(sheetsAdapter)
    const selected = selection()
    await gateway.readRows(selected)

    await gateway.writeSheet(
      plan(selected, ['__node_id', '__title', '__content']),
    )

    expect(sheetsAdapter.patchSheet).not.toHaveBeenCalled()
    expect(sheetsAdapter.replaceSheet).toHaveBeenCalledTimes(1)
    expect(
      await gateway.supportsIncrementalWrite(selection('custom_id')),
    ).toBe(false)
  })

  test('propagates patch errors without destructive replacement fallback', async () => {
    const sheetsAdapter = adapter([
      ['__node_id', '__title'],
      ['1', 'Alpha'],
    ])
    sheetsAdapter.patchSheet.mockImplementationOnce(async () => {
      throw new Error('quota exhausted')
    })
    const gateway = new GoogleSheetsGateway(sheetsAdapter)
    const selected = selection()
    await gateway.readRows(selected)

    await expect(gateway.writeSheet(plan(selected))).rejects.toThrow(
      'quota exhausted',
    )
    expect(sheetsAdapter.replaceSheet).not.toHaveBeenCalled()
  })
})
