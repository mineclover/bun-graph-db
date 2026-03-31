import { describe, expect, mock, test } from 'bun:test'
import { TabularTableSyncBridge } from '@/application/services/TabularTableSyncBridge.js'

describe('TabularTableSyncBridge', () => {
  test('buildSyncInput should map repositories to tabular payload', async () => {
    const tableRepository = {
      findByIdentifier: mock(async () => ({
        id: 'table-1',
        identifier: 'users',
        description: 'Users table',
      })),
    }

    const attributeRepository = {
      findByTableId: mock(async () => ({
        data: [
          {
            getId: () => 'attr-1',
            getIdentifier: () => 'email',
            getIsRequired: () => true,
            getParsedMetadata: () => ({ searchable: true }),
          },
        ],
      })),
      getAttributeTypeForAttribute: mock(async () => ({
        getIdentifier: () => 'email',
        getJsonType: () => 'string',
      })),
    }

    const nodeRepository = {
      findByTableId: mock(async () => ({
        data: [
          {
            getId: () => 'node-1',
            getTitle: () => 'Alpha',
            getContent: () => 'Alpha content',
            getDescription: () => 'Alpha description',
            getCreatedAt: () => new Date('2026-01-01T00:00:00.000Z'),
            getUpdatedAt: () => new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
      })),
    }

    const nodeAttributeRepository = {
      findByNodeId: mock(async () => [
        {
          getAttributeId: () => 'attr-1',
          getParsedValue: () => 'alpha@example.com',
        },
      ]),
    }

    const syncService = {
      preview: mock(async (input) => input),
      sync: mock(async (input) => ({
        synced: true,
        input,
      })),
    }

    const bridge = new TabularTableSyncBridge(
      tableRepository as never,
      attributeRepository as never,
      nodeRepository as never,
      nodeAttributeRepository as never,
      syncService as never,
    )

    const input = await bridge.buildSyncInput('users')

    expect(input.tableId).toBe('table-1')
    expect(input.tableIdentifier).toBe('users')
    expect(input.description).toBe('Users table')
    expect(input.attributes).toEqual([
      {
        identifier: 'email',
        dataType: 'email',
        required: true,
        searchable: true,
      },
    ])
    expect(input.nodes).toEqual([
      {
        id: 'node-1',
        title: 'Alpha',
        content: 'Alpha content',
        description: 'Alpha description',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        attributes: {
          email: 'alpha@example.com',
        },
      },
    ])
  })

  test('clearByIdentifier should sync empty rows and attributes', async () => {
    const syncService = {
      sync: mock(async (input) => input),
    }

    const bridge = new TabularTableSyncBridge(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      syncService as never,
    )

    const result = await bridge.clearByIdentifier('users')

    expect(syncService.sync).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      tableIdentifier: 'users',
      attributes: [],
      nodes: [],
    })
  })
})
