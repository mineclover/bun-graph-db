import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { GoogleToolsHttpSheetsAdapter } from '@/infrastructure/excel/adapters/GoogleToolsHttpSheetsAdapter.js'

describe('GoogleToolsHttpSheetsAdapter', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    let batchPayload: unknown = null

    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/sheets/spreadsheet-1')) {
        return Response.json({
          data: {
            id: 'spreadsheet-1',
            sheets: [{ title: 'Sheet1' }],
          },
        })
      }

      if (url.includes('/sheets/spreadsheet-1/batch')) {
        batchPayload = JSON.parse(String(init?.body || '{}'))
        ;(globalThis as unknown as { __batchPayload?: unknown }).__batchPayload = batchPayload
        return Response.json({ success: true })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete (globalThis as unknown as { __batchPayload?: unknown }).__batchPayload
  })

  test('patchSheet should batch update changed and added rows', async () => {
    const adapter = new GoogleToolsHttpSheetsAdapter({
      baseUrl: 'http://localhost:5678',
    })

    const patched = await adapter.patchSheet(
      'spreadsheet-1',
      'users',
      {
        tableIdentifier: 'users',
        sheetName: 'users',
        columns: [
          {
            columnName: '__node_id',
            sourceType: 'system',
            sourceKey: 'id',
            dataType: 'id',
            required: true,
            searchable: true,
            order: 0,
          },
          {
            columnName: '__title',
            sourceType: 'system',
            sourceKey: 'title',
            dataType: 'string',
            required: false,
            searchable: true,
            order: 1,
          },
        ],
      },
      [
        { __node_id: '1', __title: 'Alpha' },
        { __node_id: '2', __title: 'Beta' },
      ],
      [
        { __node_id: '1', __title: 'Alpha Updated' },
        { __node_id: '2', __title: 'Beta' },
        { __node_id: '3', __title: 'Gamma' },
      ],
      [
        {
          kind: 'changed',
          key: '1',
          changedColumns: ['__title'],
        },
        {
          kind: 'added',
          key: '3',
        },
      ],
    )

    expect(patched).toBe(true)

    const batchPayload = (globalThis as unknown as {
      __batchPayload?: { data?: Array<{ range: string; values: unknown[][] }> }
    }).__batchPayload

    expect(batchPayload?.data?.length).toBe(2)
    expect(batchPayload?.data?.[0]?.range).toBe("'Sheet1'!A2")
    expect(batchPayload?.data?.[1]?.range).toBe("'Sheet1'!A4")
  })

  test('patchSheet should fall back when rows are removed', async () => {
    const adapter = new GoogleToolsHttpSheetsAdapter({
      baseUrl: 'http://localhost:5678',
    })

    const patched = await adapter.patchSheet(
      'spreadsheet-1',
      'users',
      {
        tableIdentifier: 'users',
        sheetName: 'users',
        columns: [],
      },
      [{ __node_id: '1' }],
      [],
      [
        {
          kind: 'removed',
          key: '1',
        },
      ],
    )

    expect(patched).toBe(false)
  })
})
