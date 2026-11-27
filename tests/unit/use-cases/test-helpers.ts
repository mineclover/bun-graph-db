/**
 * Test helpers for creating properly structured domain entities
 */

import { type Mock, vi } from 'vitest'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeId, AttributeTypeId, NodeId, RelationTypeId, TableId } from '@/core/types/CommonTypes.js'
import type { PaginatedResult } from '@/core/types/CommonTypes.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import { Table } from '@/domain/entities/Table.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export type MockedMethods<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Return ? Mock<(...args: Args) => Return> : T[K]
}

export function createMockLogger(): MockedMethods<ILogger> {
  return {
    info: vi.fn(() => {}),
    warn: vi.fn(() => {}),
    error: vi.fn(() => {}),
    debug: vi.fn(() => {}),
  } satisfies MockedMethods<ILogger>
}

export function createPaginatedResult<T>(items: T[] = []): PaginatedResult<T> {
  return {
    nodes: items,
    totalCount: items.length,
    hasNextPage: false,
    hasPreviousPage: false,
    data: items,
  }
}

export function createTestTable(
  id: string = 'table-1',
  identifier: string = 'test-table',
  description: string | null = 'Test Table',
): Table {
  return Table.fromDatabase(id as TableId, identifier, description, new Date(), new Date())
}

export function createTestNode(
  id: string = 'node-1',
  tableId: string = 'table-1',
  content: string = 'Test Node',
  title?: string,
  description?: string,
): Node {
  return Node.fromDatabase(
    id as NodeId,
    tableId as TableId,
    content,
    title || null,
    description || null,
    new Date(),
    new Date(),
  )
}

export function createTestRelationType(
  id: string = 'rel-type-1',
  identifier: string = 'test-relation',
  name?: string,
  description?: string,
): RelationType {
  return RelationType.fromDatabase(
    id as RelationTypeId,
    identifier,
    name || 'Test Relation',
    description || null,
    new Date(),
    new Date(),
  )
}

export function createTestAttribute(
  id: string = 'attr-1',
  tableId: string = 'table-1',
  identifier: string = 'test-attr',
  name: string = 'Test Attribute',
  attributeTypeId: string = '1',
): Attribute {
  return Attribute.fromDatabase(
    id as AttributeId,
    tableId as TableId,
    identifier,
    name,
    attributeTypeId as unknown as AttributeTypeId,
    null, // description
    false, // isRequired
    null, // metadata
    new Date(),
    new Date(),
  )
}

export function createTestAttributeType(
  id: string = 'attr-type-1',
  identifier: string = 'string',
  jsonType: string = 'string',
  description?: string,
): AttributeType {
  return AttributeType.fromDatabase(
    id as AttributeTypeId,
    identifier,
    jsonType,
    null, // format
    description || null,
    null, // validationSchema
    null, // referenceConfig
    null, // defaultValue
    null, // examples
    new Date(),
    new Date(),
  )
}

export function createTestNodeRelation(
  id: string = 'relation-1',
  tableId: string = 'table-1',
  sourceNodeId: string | null = 'node-1',
  sourceExternalId: string = 'internal',
  targetNodeId: string | null = 'node-2',
  targetExternalId: string = 'internal',
  relationTypeId: string = 'rel-type-1',
  properties: Record<string, SafeJsonValue> | null = null,
  strength: number = 2,
): NodeRelation {
  return NodeRelation.fromDatabase(
    id,
    tableId as TableId,
    sourceNodeId as NodeId | null,
    sourceExternalId,
    targetNodeId as NodeId | null,
    targetExternalId,
    relationTypeId as RelationTypeId,
    properties ? JSON.stringify(properties) : null,
    strength,
    new Date(),
    new Date(),
  )
}
