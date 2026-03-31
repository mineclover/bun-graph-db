import type { BaseEntityDto, DeleteOutput, GetManyInput, WithDescription } from '@/core/types/UseCaseTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

// Data Transfer Object for Node entity
export interface NodeDto extends BaseEntityDto, WithDescription {
  tableId: string
  content: string
  title: string | null
  metadata?: SafeJsonValue | null
  attributes?: Record<string, unknown> // Will be populated with node attribute values
}

export function fromEntity(node: Node, attributes?: Record<string, unknown>): NodeDto {
  return {
    id: String(node.getId()),
    tableId: String(node.getTableId()),
    content: node.getContent(),
    title: node.getTitle(),
    description: node.getDescription(),
    metadata: node.getParsedMetadata(),
    createdAt: node.getCreatedAt().toISOString(),
    updatedAt: node.getUpdatedAt().toISOString(),
    attributes,
  }
}

export function fromEntities(nodes: Node[]): NodeDto[] {
  return nodes.map((node) => fromEntity(node))
}

// Input DTOs for operations
export interface CreateNodeInput {
  tableId: string
  content: string
  title?: string
  description?: string
  metadata?: SafeJsonValue
  attributes?: Record<string, unknown>
}

export interface UpdateNodeInput {
  title?: string | null
  content?: string
  description?: string | null
  metadata?: SafeJsonValue
  attributes?: Record<string, unknown>
}

// Use generic GetManyInput with node-specific filters
export interface GetNodesInput
  extends GetManyInput<{
    tableId?: string
    search?: string
  }> {}

// Output DTOs for operations - using standard patterns
export interface CreateNodeOutput {
  node: NodeDto
}

export interface GetNodeOutput {
  node: NodeDto | null
}

export interface GetNodesOutput {
  nodes: NodeDto[]
  total: number
  hasMore: boolean
}

export interface UpdateNodeOutput {
  node: NodeDto
}

// Use generic DeleteOutput
export type DeleteNodeOutput = DeleteOutput

// NodeAttribute DTO
export interface NodeAttributeDto extends BaseEntityDto {
  nodeId: string
  attributeId: string
  value: SafeJsonValue | null
}

export function nodeAttributeFromEntity(nodeAttribute: NodeAttribute): NodeAttributeDto {
  return {
    id: nodeAttribute.getId() ? String(nodeAttribute.getId()) : '',
    nodeId: String(nodeAttribute.getNodeId()),
    attributeId: String(nodeAttribute.getAttributeId()),
    value: nodeAttribute.getParsedValue(),
    createdAt: nodeAttribute.getCreatedAt().toISOString(),
    updatedAt: nodeAttribute.getUpdatedAt().toISOString(),
  }
}

export function nodeAttributeFromEntities(nodeAttributes: NodeAttribute[]): NodeAttributeDto[] {
  return nodeAttributes.map((nodeAttribute) => nodeAttributeFromEntity(nodeAttribute))
}
