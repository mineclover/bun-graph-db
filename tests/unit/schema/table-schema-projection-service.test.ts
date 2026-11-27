import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TableSchemaProjectionService } from '../../../src/application/services/TableSchemaProjectionService'
import type { IAttributeRepository } from '../../../src/domain/repositories/IAttributeRepository'
import type { IAttributeTypeRepository } from '../../../src/domain/repositories/IAttributeTypeRepository'
import type { ITableRepository } from '../../../src/domain/repositories/ITableRepository'
import { Attribute } from '../../../src/domain/entities/Attribute'
import { AttributeType } from '../../../src/domain/entities/AttributeType'
import { SchemaMapper } from '../../../src/presentation/mcp/schema/SchemaMapper'
import { createMockLogger, createPaginatedResult, createTestTable } from '../use-cases/test-helpers'

describe('TableSchemaProjectionService', () => {
  beforeEach(() => TableSchemaProjectionService.clearCache())

  it('loads table metadata from repositories and projects MCP-compatible schema', async () => {
    const table = createTestTable('table_tasks', 'project_tasks', 'Project task table')
    const statusType = AttributeType.fromDatabase(
      'type_status',
      'status',
      'string',
      null,
      'Task status',
      JSON.stringify({ enum: ['todo', 'doing', 'done'] }),
      null,
      JSON.stringify('todo'),
      JSON.stringify(['todo', 'done']),
      new Date('2026-04-15T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
    )
    const priorityType = AttributeType.fromDatabase(
      'type_priority',
      'priority',
      'integer',
      null,
      'Task priority',
      JSON.stringify({ minimum: 1, maximum: 5 }),
      null,
      null,
      null,
      new Date('2026-04-15T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
    )
    const attributes = [
      Attribute.fromDatabase('attr_status', 'table_tasks', 'status', 'Status', 'type_status', null, true, null, new Date(), new Date()),
      Attribute.fromDatabase('attr_priority', 'table_tasks', 'priority', 'Priority', 'type_priority', null, false, null, new Date(), new Date()),
    ]

    const tableRepository = {
      findById: vi.fn(async () => table),
      findByIdentifier: vi.fn(async () => null),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: vi.fn(async () => createPaginatedResult(attributes)),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: vi.fn(async () => [statusType, priorityType]),
    } as unknown as IAttributeTypeRepository
    const service = new TableSchemaProjectionService(
      tableRepository,
      attributeRepository,
      attributeTypeRepository,
      createMockLogger(),
    )

    const projection = await service.project({ tableId: 'table_tasks' })
    const mcpInputSchema = SchemaMapper.mapTableProjectionToMcpInputSchema(projection)

    expect(tableRepository.findById).toHaveBeenCalledWith('table_tasks')
    expect(attributeRepository.findByTableId).toHaveBeenCalledWith('table_tasks', { limit: 500, offset: 0 })
    expect(attributeTypeRepository.findByIds).toHaveBeenCalledWith(['type_status', 'type_priority'])
    expect(projection.rootRef).toBe('#/$defs/NodeInput_ProjectTasks')
    expect(projection.diagnostics).toEqual([])
    expect(projection.refs).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: '#/$defs/AttributeType_Status' }),
      expect.objectContaining({ to: '#/$defs/AttributeType_Priority' }),
    ]))

    expect(mcpInputSchema).toEqual(expect.objectContaining({
      type: 'object',
      required: ['content', 'attributes'],
      additionalProperties: false,
    }))
    expect(mcpInputSchema.properties.attributes).toEqual(expect.objectContaining({
      type: 'object',
      required: ['status'],
      additionalProperties: false,
      properties: expect.objectContaining({
        status: expect.objectContaining({
          type: 'string',
          enum: ['todo', 'doing', 'done'],
          default: 'todo',
          examples: ['todo', 'done'],
        }),
        priority: expect.objectContaining({ type: 'integer', minimum: 1, maximum: 5 }),
      }),
    }))
  })

  it('projects by table identifier when tableId is not provided', async () => {
    const table = createTestTable('table_tasks', 'project_tasks', 'Project task table')
    const tableRepository = {
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => table),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: vi.fn(async () => createPaginatedResult([])),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: vi.fn(async () => []),
    } as unknown as IAttributeTypeRepository
    const service = new TableSchemaProjectionService(tableRepository, attributeRepository, attributeTypeRepository)

    const projection = await service.project({ identifier: 'project_tasks' })

    expect(tableRepository.findByIdentifier).toHaveBeenCalledWith('project_tasks')
    expect(projection.tableId).toBe('table_tasks')
    expect(projection.tableIdentifier).toBe('project_tasks')
  })

  it('paginates every attribute and reuses projection allocation while sources are unchanged', async () => {
    const table = createTestTable('table_large', 'large_table', 'Large table')
    const attributeType = AttributeType.fromDatabase(
      'type_string',
      'string',
      'string',
      null,
      null,
      null,
      null,
      null,
      null,
      new Date('2026-04-15T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
    )
    const attributes = Array.from({ length: 501 }, (_, index) => Attribute.fromDatabase(
      `attr_${index}`,
      'table_large',
      `field_${index}`,
      `Field ${index}`,
      'type_string',
      null,
      false,
      null,
      new Date('2026-04-15T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
    ))
    const tableRepository = {
      findById: vi.fn(async () => table),
      findByIdentifier: vi.fn(async () => null),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: vi.fn(async (_tableId: string, options: { limit: number; offset: number }) => {
        const page = attributes.slice(options.offset, options.offset + options.limit)
        return { ...createPaginatedResult(page), total: attributes.length, totalCount: attributes.length }
      }),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: vi.fn(async () => [attributeType]),
    } as unknown as IAttributeTypeRepository
    const service = new TableSchemaProjectionService(tableRepository, attributeRepository, attributeTypeRepository)

    const first = await service.project({ tableId: 'table_large' })
    const second = await service.project({ tableId: 'table_large' })

    expect(Object.keys(first.attributeValueSchemas)).toHaveLength(501)
    expect(second).toBe(first)
    expect(tableRepository.findById).toHaveBeenCalledTimes(1)
    expect(attributeRepository.findByTableId).toHaveBeenCalledTimes(2)
    expect(attributeRepository.findByTableId).toHaveBeenNthCalledWith(2, 'table_large', { limit: 500, offset: 500 })
  })

  it('coalesces concurrent misses and refreshes after explicit invalidation', async () => {
    const table = createTestTable('table_tasks', 'project_tasks', 'Project task table')
    let releaseTable: (() => void) | undefined
    const tableBarrier = new Promise<void>((resolve) => { releaseTable = resolve })
    const tableRepository = {
      findById: vi.fn(async () => {
        await tableBarrier
        return table
      }),
      findByIdentifier: vi.fn(async () => null),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: vi.fn(async () => createPaginatedResult([])),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: vi.fn(async () => []),
    } as unknown as IAttributeTypeRepository
    const service = new TableSchemaProjectionService(tableRepository, attributeRepository, attributeTypeRepository)

    const firstPromise = service.project({ tableId: 'table_tasks' })
    const secondPromise = service.project({ tableId: 'table_tasks' })
    releaseTable?.()
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(second).toBe(first)
    expect(tableRepository.findById).toHaveBeenCalledTimes(1)
    TableSchemaProjectionService.clearCache('table_tasks')
    const refreshed = await service.project({ tableId: 'table_tasks' })
    expect(refreshed).not.toBe(first)
    expect(tableRepository.findById).toHaveBeenCalledTimes(2)
  })
})
