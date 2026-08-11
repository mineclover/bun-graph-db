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
            getAttributeTypeId: () => 'type-email',
            getIdentifier: () => 'email',
            getIsRequired: () => true,
            getParsedMetadata: () => ({ searchable: true }),
          },
        ],
      })),
    }
    const attributeTypeRepository = {
      findByIds: mock(async () => [
        {
          getId: () => 'type-email',
          getIdentifier: () => 'email',
          getJsonType: () => 'string',
        },
      ]),
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
      findByNodeIds: mock(async () => [
        {
          getNodeId: () => 'node-1',
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
      attributeTypeRepository as never,
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
    expect(nodeAttributeRepository.findByNodeIds).toHaveBeenCalledTimes(1)
    expect(nodeAttributeRepository.findByNodeIds).toHaveBeenCalledWith([
      'node-1',
    ])
    expect(attributeTypeRepository.findByIds).toHaveBeenCalledWith([
      'type-email',
    ])
  })

  test('reads every repository page and batches attribute types and node attributes without N+1 queries', async () => {
    const tableRepository = {
      findByIdentifier: mock(async () => ({
        id: 'table-1',
        identifier: 'users',
        description: null,
      })),
    }
    const firstAttribute = {
      getId: () => 'attr-1',
      getAttributeTypeId: () => 'type-email',
      getIdentifier: () => 'email',
      getIsRequired: () => false,
      getParsedMetadata: () => null,
    }
    const secondAttribute = {
      getId: () => 'attr-2',
      getAttributeTypeId: () => 'type-role',
      getIdentifier: () => 'role',
      getIsRequired: () => false,
      getParsedMetadata: () => null,
    }
    const attributeOffsets: number[] = []
    const attributeRepository = {
      findByTableId: mock(async (_tableId: string, options: { offset: number }) => {
        attributeOffsets.push(options.offset)
        return options.offset === 0
          ? { data: [firstAttribute], total: 2, hasMore: true }
          : { items: [secondAttribute], totalCount: 2, hasNextPage: false }
      }),
    }
    const findAttributeTypesByIds = mock(async () => [
      {
        getId: () => 'type-role',
        getIdentifier: () => 'role',
        getJsonType: () => 'string',
      },
      {
        getId: () => 'type-email',
        getIdentifier: () => 'email',
        getJsonType: () => 'string',
      },
    ])
    const nodes = Array.from({ length: 501 }, (_, index) => ({
      getId: () => `node-${index}`,
      getTitle: () => `Node ${index}`,
      getContent: () => `Content ${index}`,
      getDescription: () => null,
      getCreatedAt: () => new Date('2026-01-01T00:00:00.000Z'),
      getUpdatedAt: () => new Date('2026-01-02T00:00:00.000Z'),
    }))
    const nodeOffsets: number[] = []
    const nodeRepository = {
      findByTableId: mock(async (_tableId: string, options: { offset: number }) => {
        nodeOffsets.push(options.offset)
        return options.offset === 0
          ? { data: nodes.slice(0, 300), total: 501, hasMore: true }
          : { nodes: nodes.slice(300), totalCount: 501, hasNextPage: false }
      }),
    }
    const attributeBatches: string[][] = []
    const nodeAttributeRepository = {
      findByNodeIds: mock(async (nodeIds: string[]) => {
        attributeBatches.push(nodeIds)
        return nodeIds.map((nodeId) => ({
          getNodeId: () => nodeId,
          getAttributeId: () => 'attr-1',
          getParsedValue: () => `${nodeId}@example.com`,
        }))
      }),
    }
    const logger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }
    const bridge = new TabularTableSyncBridge(
      tableRepository as never,
      attributeRepository as never,
      { findByIds: findAttributeTypesByIds } as never,
      nodeRepository as never,
      nodeAttributeRepository as never,
      {} as never,
      logger as never,
    )

    const input = await bridge.buildSyncInput('users')

    expect(attributeOffsets).toEqual([0, 1])
    expect(findAttributeTypesByIds).toHaveBeenCalledTimes(1)
    expect(findAttributeTypesByIds).toHaveBeenCalledWith([
      'type-email',
      'type-role',
    ])
    expect(nodeOffsets).toEqual([0, 300])
    expect(input.attributes).toHaveLength(2)
    expect(input.nodes).toHaveLength(501)
    expect(attributeBatches).toHaveLength(2)
    expect(attributeBatches[0]).toHaveLength(500)
    expect(attributeBatches[1]).toEqual(['node-500'])
    expect(logger.info).toHaveBeenCalledWith(
      'Prepared tabular sync payload',
      expect.objectContaining({
        attributePages: 2,
        nodePages: 2,
        nodeAttributeBatches: 2,
      }),
    )
  })

  test('fails closed when a repository page ignores the advancing offset', async () => {
    const repeatedAttribute = {
      getId: () => 'attr-1',
      getIdentifier: () => 'email',
      getIsRequired: () => false,
      getParsedMetadata: () => null,
    }
    const bridge = new TabularTableSyncBridge(
      {
        findByIdentifier: mock(async () => ({
          id: 'table-1',
          identifier: 'users',
          description: null,
        })),
      } as never,
      {
        findByTableId: mock(async () => ({
          data: [repeatedAttribute],
          total: 2,
          hasMore: true,
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await expect(bridge.buildSyncInput('users')).rejects.toThrow(
      'pagination made no unique progress',
    )
  })

  test('builds a dirty-node patch without reading the full node snapshot', async () => {
    const findByTableId = mock(async () => {
      throw new Error('full node scan should not run')
    })
    const findByIds = mock(async () => [
      {
        getId: () => 'node-1',
        getTableId: () => 'table-1',
        getTitle: () => 'Alpha Updated',
        getContent: () => 'Alpha content',
        getDescription: () => null,
        getCreatedAt: () => new Date('2026-01-01T00:00:00.000Z'),
        getUpdatedAt: () => new Date('2026-01-03T00:00:00.000Z'),
      },
    ])
    const syncIncremental = mock(async (input) => ({
      synced: true,
      input,
    }))
    const sync = mock(async () => ({ synced: true }))
    const bridge = new TabularTableSyncBridge(
      {
        findByIdentifier: mock(async () => ({
          id: 'table-1',
          identifier: 'users',
          description: null,
        })),
      } as never,
      {
        findByTableId: mock(async () => ({
          data: [
            {
              getId: () => 'attr-1',
              getAttributeTypeId: () => 'type-email',
              getIdentifier: () => 'email',
              getIsRequired: () => false,
              getParsedMetadata: () => null,
            },
          ],
          total: 1,
          hasMore: false,
        })),
      } as never,
      { findByIds: mock(async () => []) } as never,
      { findByIds, findByTableId } as never,
      {
        findByNodeIds: mock(async () => [
          {
            getNodeId: () => 'node-1',
            getAttributeId: () => 'attr-1',
            getParsedValue: () => 'alpha@example.com',
          },
        ]),
      } as never,
      {
        supportsIdentifier: () => true,
        syncIncremental,
        sync,
      } as never,
    )

    const result = await bridge.syncDirtyByIdentifier(
      'users',
      ['node-1'],
      2,
    )

    expect(result.synced).toBe(true)
    expect(findByIds).toHaveBeenCalledWith(['node-1'])
    expect(findByTableId).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    expect(syncIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        dirtyNodeIds: ['node-1'],
        revision: 2,
        nodes: [
          expect.objectContaining({
            id: 'node-1',
            title: 'Alpha Updated',
            attributes: { email: 'alpha@example.com' },
          }),
        ],
      }),
    )
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
