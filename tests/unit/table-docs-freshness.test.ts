import { describe, expect, mock, test } from 'bun:test'
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
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
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
        findById: mock(async () => table),
        findByIdentifier: mock(async () => table),
      } as unknown as ITableRepository,
      {
        findByTableId: mock(async () => emptyPage([attribute])),
      } as unknown as IAttributeRepository,
      {
        findById: mock(async () => attributeType),
        findByIdentifier: mock(async () => null),
      } as unknown as IAttributeTypeRepository,
      {
        findByTableId: mock(async () => emptyPage()),
        countByTableId: mock(async () => 0),
      } as unknown as INodeRepository,
      {
        findByNodeId: mock(async () => []),
      } as unknown as INodeAttributeRepository,
      {
        search: mock(async () => emptyTemplateSearch()),
        findByApplicableTable: mock(async () => []),
      } as unknown as IQueryTemplateRepository,
      {} as unknown as IRelationTypeRepository,
      {
        findByTableIds: mock(async () => []),
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
