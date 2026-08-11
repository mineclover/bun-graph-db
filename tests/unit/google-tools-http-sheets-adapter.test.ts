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

  test('retries 429 and 503 responses using capped Retry-After delays', async () => {
    const delays: number[] = []
    let batchAttempts = 0
    const fetchImpl = mock(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        expect(init?.signal).toBeInstanceOf(AbortSignal)

        if (url.endsWith('/sheets/spreadsheet-1')) {
          return Response.json({
            data: {
              id: 'spreadsheet-1',
              sheets: [{ title: 'Sheet1' }],
            },
          })
        }

        if (url.includes('/sheets/spreadsheet-1/batch')) {
          batchAttempts += 1
          if (batchAttempts === 1) {
            return new Response('quota limited', {
              status: 429,
              headers: { 'retry-after': '30' },
            })
          }
          if (batchAttempts === 2) {
            return new Response('temporarily unavailable', {
              status: 503,
              headers: { 'retry-after': '0.25' },
            })
          }
          return Response.json({ success: true })
        }

        throw new Error(`Unexpected fetch: ${url}`)
      },
    ) as typeof fetch
    const adapter = new GoogleToolsHttpSheetsAdapter({
      baseUrl: 'http://localhost:5678',
      fetch: fetchImpl,
      maxRetries: 2,
      maxRetryDelayMs: 1_000,
      sleep: async (delayMs) => {
        delays.push(delayMs)
      },
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
        ],
      },
      [{ __node_id: '1' }],
      [{ __node_id: '1' }],
      [
        {
          kind: 'changed',
          key: '1',
          changedColumns: ['__node_id'],
        },
      ],
    )

    expect(patched).toBe(true)
    expect(batchAttempts).toBe(3)
    expect(delays).toEqual([1_000, 250])
  })

  test('aborts an HTTP attempt when its request timeout elapses', async () => {
    let observedSignal: AbortSignal | null = null
    const fetchImpl = mock(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) {
            reject(new Error('Expected an AbortSignal'))
            return
          }
          observedSignal = signal
          const rejectWithAbort = () => reject(signal.reason)
          if (signal.aborted) {
            rejectWithAbort()
          } else {
            signal.addEventListener('abort', rejectWithAbort, { once: true })
          }
        }),
    ) as typeof fetch
    const adapter = new GoogleToolsHttpSheetsAdapter({
      baseUrl: 'http://localhost:5678',
      fetch: fetchImpl,
      requestTimeoutMs: 5,
      maxRetries: 0,
    })

    await expect(adapter.readSheet('spreadsheet-1', 'users')).rejects.toThrow(
      'timed out after 5ms',
    )
    expect(observedSignal?.aborted).toBe(true)
  })

  test('reports the non-atomic clear-write boundary for durable compensation', async () => {
    const writeMethods: string[] = []
    const fetchImpl = mock(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/sheets/spreadsheet-1')) {
          return Response.json({
            data: {
              id: 'spreadsheet-1',
              sheets: [{ title: 'Sheet1' }],
            },
          })
        }
        if (url.includes('/sheets/spreadsheet-1/values')) {
          writeMethods.push(init?.method ?? 'GET')
          if (init?.method === 'DELETE') {
            return new Response(null, { status: 204 })
          }
          return new Response('write failed', { status: 500 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      },
    ) as typeof fetch
    const adapter = new GoogleToolsHttpSheetsAdapter({
      baseUrl: 'http://localhost:5678',
      fetch: fetchImpl,
      maxRetries: 0,
    })

    await expect(
      adapter.replaceSheet('spreadsheet-1', 'users', [['__node_id'], ['1']]),
    ).rejects.toThrow(
      'non-atomic replacement was interrupted after clear; the sheet may remain empty until the durable full-sync retry succeeds',
    )
    expect(writeMethods).toEqual(['DELETE', 'POST'])
  })
})
