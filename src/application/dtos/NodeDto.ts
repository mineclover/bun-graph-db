import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'

// Data Transfer Object for Node entity
export interface NodeDto {
  id: string
  tableId: string
  content: string
  title: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  attributes?: Record<string, any> // Will be populated with node attribute values
}

export class NodeDto {
  static fromEntity(node: Node, attributes?: Record<string, any>): NodeDto {
    return {
      id: node.getId(),
      tableId: node.getTableId(),
      content: node.getContent(),
      title: node.getTitle(),
      description: node.getDescription(),
      createdAt: node.getCreatedAt().toISOString(),
      updatedAt: node.getUpdatedAt().toISOString(),
      attributes
    }
  }

  static fromEntities(nodes: Node[]): NodeDto[] {
    return nodes.map(node => NodeDto.fromEntity(node))
  }
}

// Input DTOs for operations
export interface CreateNodeInput {
  tableId: string
  content: string
  title?: string
  description?: string
  attributes?: Record<string, any>
}

export interface UpdateNodeInput {
  title?: string | null
  content?: string
  description?: string | null
  attributes?: Record<string, any>
}

export interface GetNodesInput {
  limit?: number
  offset?: number
  tableId?: string
  search?: string
}

// Output DTOs for operations
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

export interface DeleteNodeOutput {
  success: boolean
}

// NodeAttribute DTO
export interface NodeAttributeDto {
  id: string | null
  nodeId: string
  attributeId: string
  value: any
  createdAt: string
  updatedAt: string
}

export class NodeAttributeDto {
  static fromEntity(nodeAttribute: NodeAttribute): NodeAttributeDto {
    return {
      id: nodeAttribute.getId(),
      nodeId: nodeAttribute.getNodeId(),
      attributeId: nodeAttribute.getAttributeId(),
      value: nodeAttribute.getParsedValue(),
      createdAt: nodeAttribute.getCreatedAt().toISOString(),
      updatedAt: nodeAttribute.getUpdatedAt().toISOString()
    }
  }

  static fromEntities(nodeAttributes: NodeAttribute[]): NodeAttributeDto[] {
    return nodeAttributes.map(nodeAttribute => NodeAttributeDto.fromEntity(nodeAttribute))
  }
}