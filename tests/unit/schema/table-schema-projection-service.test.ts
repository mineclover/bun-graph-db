import { describe, expect, it, mock } from 'bun:test'
import { TableSchemaProjectionService } from '../../../src/application/services/TableSchemaProjectionService'
import type { IAttributeRepository } from '../../../src/domain/repositories/IAttributeRepository'
import type { IAttributeTypeRepository } from '../../../src/domain/repositories/IAttributeTypeRepository'
import type { ITableRepository } from '../../../src/domain/repositories/ITableRepository'
import { Attribute } from '../../../src/domain/entities/Attribute'
import { AttributeType } from '../../../src/domain/entities/AttributeType'
import { SchemaMapper } from '../../../src/presentation/mcp/schema/SchemaMapper'
import { createMockLogger, createPaginatedResult, createTestTable } from '../use-cases/test-helpers'

describe('TableSchemaProjectionService', () => {
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
      null,
      null,
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
      findById: mock(async () => table),
      findByIdentifier: mock(async () => null),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: mock(async () => createPaginatedResult(attributes)),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: mock(async () => [statusType, priorityType]),
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
    expect(attributeRepository.findByTableId).toHaveBeenCalledWith('table_tasks', { limit: 1000, offset: 0 })
    expect(attributeTypeRepository.findByIds).toHaveBeenCalledWith(['type_status', 'type_priority'])
    expect(projection.rootRef).toBe('#/$defs/NodeInput_ProjectTasks')
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
        status: expect.objectContaining({ type: 'string', enum: ['todo', 'doing', 'done'] }),
        priority: expect.objectContaining({ type: 'integer', minimum: 1, maximum: 5 }),
      }),
    }))
  })

  it('projects by table identifier when tableId is not provided', async () => {
    const table = createTestTable('table_tasks', 'project_tasks', 'Project task table')
    const tableRepository = {
      findById: mock(async () => null),
      findByIdentifier: mock(async () => table),
    } as unknown as ITableRepository
    const attributeRepository = {
      findByTableId: mock(async () => createPaginatedResult([])),
    } as unknown as IAttributeRepository
    const attributeTypeRepository = {
      findByIds: mock(async () => []),
    } as unknown as IAttributeTypeRepository
    const service = new TableSchemaProjectionService(tableRepository, attributeRepository, attributeTypeRepository)

    const projection = await service.project({ identifier: 'project_tasks' })

    expect(tableRepository.findByIdentifier).toHaveBeenCalledWith('project_tasks')
    expect(projection.tableId).toBe('table_tasks')
    expect(projection.tableIdentifier).toBe('project_tasks')
  })
})
