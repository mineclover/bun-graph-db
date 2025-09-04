import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { NodeId, AttributeId, PaginationOptions, PaginatedResult } from '@/shared/types/common.js'

export interface INodeAttributeRepository {
  save(nodeAttribute: NodeAttribute): Promise<void>
  findById(id: string): Promise<NodeAttribute | null>
  findByNodeIdAndAttributeId(nodeId: NodeId, attributeId: AttributeId): Promise<NodeAttribute | null>
  findByNodeId(nodeId: NodeId): Promise<NodeAttribute[]>
  findByAttributeId(attributeId: AttributeId, options?: PaginationOptions): Promise<PaginatedResult<NodeAttribute>>
  update(nodeAttribute: NodeAttribute): Promise<void>
  delete(id: string): Promise<void>
  deleteByNodeId(nodeId: NodeId): Promise<void>
  deleteByAttributeId(attributeId: AttributeId): Promise<void>
  exists(nodeId: NodeId, attributeId: AttributeId): Promise<boolean>
  saveMany(nodeAttributes: NodeAttribute[]): Promise<void>
  updateMany(nodeAttributes: NodeAttribute[]): Promise<void>
}