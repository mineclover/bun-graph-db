import type { AttributeId, NodeId } from '@/core/types/CommonTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export interface NodeAttributeMutation {
  attributeId: AttributeId
  value: string
}

export interface NodeAttributeBatchWrite {
  nodeId: NodeId
  attributeId: AttributeId
  value: string
}

export interface NodeFieldMutation {
  content?: string
  title?: string | null
  description?: string | null
  metadata?: SafeJsonValue
}

/** Atomic write boundary for a node and its EAV attributes. */
export interface INodeMutationRepository {
  create(node: Node, attributes: readonly NodeAttributeMutation[]): Promise<Node>
  createMany?(
    entries: ReadonlyArray<{ node: Node; attributes: readonly NodeAttributeMutation[] }>,
  ): Promise<Node[]>
  update(
    id: NodeId,
    fields: NodeFieldMutation,
    attributes: readonly NodeAttributeMutation[],
  ): Promise<Node>
  upsertAttributesBatch?(entries: readonly NodeAttributeBatchWrite[]): Promise<NodeAttribute[]>
}
