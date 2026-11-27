import type {
  NodeId,
  NodeRelationId,
  PaginatedResult,
  PaginationOptions,
  RelationTypeId,
  TableId,
} from '@/core/types/CommonTypes.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'

export type GraphTraversalDirection = 'OUTGOING' | 'INCOMING' | 'BOTH'

export type NodeRelationAdjacency = ReadonlyMap<NodeId, NodeRelation[]>
export type NodeEdgeTargetAdjacency = ReadonlyMap<NodeId, NodeId[]>

export interface NodeRelationKeysetCursor {
  createdAt: string
  id: string
}

export interface NodeRelationKeysetPage {
  relations: NodeRelation[]
  nextCursor: NodeRelationKeysetCursor | null
}

export interface INodeRelationRepository {
  save(nodeRelation: NodeRelation): Promise<void>
  findById(id: NodeRelationId): Promise<NodeRelation | null>
  findByTableId(tableId: TableId, options?: PaginationOptions): Promise<PaginatedResult<NodeRelation>>
  findBySourceNodeIdPaginated(sourceNodeId: NodeId, options?: PaginationOptions): Promise<PaginatedResult<NodeRelation>>
  findByTargetNodeIdPaginated(targetNodeId: NodeId, options?: PaginationOptions): Promise<PaginatedResult<NodeRelation>>
  findByExternalIds(sourceExternalId: string, targetExternalId: string, tableId: TableId): Promise<NodeRelation | null>
  findBySourceExternalId(
    sourceExternalId: string,
    tableId: TableId,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<NodeRelation>>
  findByTargetExternalId(
    targetExternalId: string,
    tableId: TableId,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<NodeRelation>>
  findByRelationType(
    relationTypeId: RelationTypeId,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<NodeRelation>>
  findByNodeId(
    nodeId: NodeId,
    options?: PaginationOptions,
  ): Promise<{
    incoming: NodeRelation[]
    outgoing: NodeRelation[]
  }>
  update(nodeRelation: NodeRelation): Promise<void>
  delete(id: NodeRelationId): Promise<void>
  deleteByTableId(tableId: TableId): Promise<void>
  deleteBySourceNodeId(sourceNodeId: NodeId): Promise<void>
  deleteByTargetNodeId(targetNodeId: NodeId): Promise<void>
  exists(
    sourceExternalId: string,
    targetExternalId: string,
    tableId: TableId,
    relationTypeId: RelationTypeId,
  ): Promise<boolean>
  count(tableId?: TableId, relationTypeId?: RelationTypeId): Promise<number>

  // 그래프 탐색용 메서드들
  findBySourceNodeId(sourceNodeId: NodeId): Promise<NodeRelation[]>
  findByTargetNodeId(targetNodeId: NodeId): Promise<NodeRelation[]>
  /** Optional bulk read used by graph traversal; callers retain the per-node fallback. */
  findAdjacentByNodeIds?(
    nodeIds: readonly NodeId[],
    direction: GraphTraversalDirection,
    relationTypeIds?: readonly RelationTypeId[],
  ): Promise<NodeRelationAdjacency>
  /** Optional lightweight adjacency read returning only neighbor IDs without hydrating full entities. */
  findAdjacentEdgeTargetsByNodeIds?(
    nodeIds: readonly NodeId[],
    direction: GraphTraversalDirection,
    relationTypeIds?: readonly RelationTypeId[],
  ): Promise<NodeEdgeTargetAdjacency>
  findBySourceNodeIdAndRelationType(sourceNodeId: NodeId, relationTypeId: RelationTypeId): Promise<NodeRelation[]>
  findByTargetNodeIdAndRelationType(targetNodeId: NodeId, relationTypeId: RelationTypeId): Promise<NodeRelation[]>
  countBySourceNodeId(sourceNodeId: NodeId): Promise<number>
  countByTargetNodeId(targetNodeId: NodeId): Promise<number>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<NodeRelation>>
  findAllKeyset?(limit: number, cursor?: NodeRelationKeysetCursor): Promise<NodeRelationKeysetPage>
}
