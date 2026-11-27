import { describe, expect, test, vi } from 'vitest'
import { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

function emptyPage<T>(data: T[] = []) {
  return {
    data,
    nodes: data,
    totalCount: data.length,
    hasNextPage: false,
    hasPreviousPage: false,
  }
}

function createLogger() {
  return {
    info: vi.fn(() => {}),
    warn: vi.fn(() => {}),
    error: vi.fn(() => {}),
    debug: vi.fn(() => {}),
  }
}

function emptyTemplateSearch(): Awaited<ReturnType<IQueryTemplateRepository['search']>> {
  return {
    items: [],
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  }
}

describe('table docs schema freshness', () => {
  test('changes projection freshness metadata when an attribute type changes', async () => {
    const now = new Date('2026-04-16T00:00:00.000Z')
    const table = Table.fromDatabase('table_docs', 'docs_table', 'Docs table', now, now)
    const attribute = Attribute.fromDatabase(
      'attr_priority',
      'table_docs',
      'priority',
      'Priority',
      'type_priority',
      'Priority field',
      true,
      null,
      now,
      now,
    )
    let attributeType = AttributeType.fromDatabase(
      'type_priority',
      'priority_type',
      'string',
      null,
      'Priority type',
      '{"minLength":1}',
      null,
      null,
      null,
      now,
      now,
    )

    const useCase = new GetTableDocsUseCase(
      {
        findById: vi.fn(async () => table),
        findByIdentifier: vi.fn(async () => table),
      } as unknown as ITableRepository,
      {
        findByTableId: vi.fn(async () => emptyPage([attribute])),
      } as unknown as IAttributeRepository,
      {
        findById: vi.fn(async () => attributeType),
        findByIdentifier: vi.fn(async () => null),
      } as unknown as IAttributeTypeRepository,
      {
        findByTableId: vi.fn(async () => emptyPage()),
        countByTableId: vi.fn(async () => 0),
      } as unknown as INodeRepository,
      {
        findByNodeId: vi.fn(async () => []),
      } as unknown as INodeAttributeRepository,
      {
        search: vi.fn(async () => emptyTemplateSearch()),
        findByApplicableTable: vi.fn(async () => []),
      } as unknown as IQueryTemplateRepository,
      {} as unknown as IRelationTypeRepository,
      {
        findByTableIds: vi.fn(async () => []),
      } as unknown as IDocRepository,
      createLogger(),
    )

    const before = await useCase.execute({
      tableId: 'table_docs',
      includeAiMetadata: true,
      includeRelatedTemplates: true,
    })

    attributeType = AttributeType.fromDatabase(
      'type_priority',
      'priority_type',
      'number',
      null,
      'Priority type',
      '{"minimum":0}',
      null,
      null,
      null,
      now,
      new Date('2026-04-16T00:01:00.000Z'),
    )

    const after = await useCase.execute({
      tableId: 'table_docs',
      includeAiMetadata: true,
      includeRelatedTemplates: true,
    })

    expect(before.tableDocs?.schema.projectionVersionHash).toBeDefined()
    expect(after.tableDocs?.schema.projectionVersionHash).toBeDefined()
    expect(after.tableDocs?.schema.projectionVersionHash).not.toBe(before.tableDocs?.schema.projectionVersionHash)
    expect(after.tableDocs?.aiMetadata?.schemaInfo.projectionVersionHash).toBe(
      after.tableDocs?.schema.projectionVersionHash,
    )
  })
})
