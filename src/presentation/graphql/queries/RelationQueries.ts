import { fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import { nodeRelationFromEntities, nodeRelationFromEntity } from '@/application/dtos/RelationDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  GraphTraversalService,
  resolveRelationTypeRefs,
  type TraversalDirection,
} from '@/application/services/GraphTraversalService.js'
import type { IGraphRepository, SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type {
  GraphQLContext,
  GraphQLParent,
  NodeRelationArgs,
  NodeRelationsArgs,
  RelationTypeArgs,
  SearchRelatedNodesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class RelationQueries extends BaseResolver {
  protected logger: ILogger
  private readonly graphTraversal: GraphTraversalService

  constructor(
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly graphRepository: IGraphRepository | null,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase | null,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
    this.graphTraversal = new GraphTraversalService(nodeRepository, nodeRelationRepository)
  }

  async relationType(_: GraphQLParent, args: RelationTypeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Relation Type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation Type ID'),
      ],
      'relationType',
    )

    return this.handleQuery(
      async () => {
        return await this.relationTypeRepository.findById(args.id)
      },
      'findRelationTypeById',
      { id: args.id },
    )
  }

  async relationTypeByIdentifier(
    _: GraphQLParent,
    args: { identifier: string },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('identifier', 'Relation Type Identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Relation Type Identifier'),
      ],
      'relationTypeByIdentifier',
    )

    return this.handleQuery(
      async () => {
        return await this.relationTypeRepository.findByIdentifier(args.identifier)
      },
      'relationTypeByIdentifier',
      { identifier: args.identifier },
    )
  }

  async relationTypes(_: GraphQLParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleQuery(async () => {
      const result = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      return result.nodes || []
    }, 'findAllRelationTypes')
  }

  async nodeRelation(_: GraphQLParent, args: NodeRelationArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Node Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node Relation ID'),
      ],
      'nodeRelation',
    )

    return this.handleQuery(
      async () => {
        return await this.nodeRelationRepository.findById(args.id)
      },
      'findNodeRelationById',
      { id: args.id },
    )
  }

  async nodeRelations(_: GraphQLParent, args: NodeRelationsArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Note: The repository only accepts PaginationOptions, filter/sort are not supported here
        // Repository-level filtering may be implemented for performance optimization in future
        const result = await this.nodeRelationRepository.findAll(args.pagination || { limit: 10, offset: 0 })

        return {
          nodes: result.nodes,
          totalCount: result.totalCount,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAllNodeRelations',
      { args },
    )
  }

  async searchRelatedNodes(_: GraphQLParent, args: SearchRelatedNodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const filter = args.filter as
          | {
              sourceNodeId?: string
              relationTypeIds?: string[]
              relationTypeId?: string
              direction?: string
              maxDepth?: number
            }
          | undefined

        const sourceNodeId = filter?.sourceNodeId || ''
        const sourceNode = sourceNodeId ? await this.nodeRepository.findById(sourceNodeId) : null
        const tableId = sourceNode?.getTableId() || ''

        if (!tableId) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const directionStr = (filter?.direction || 'OUTGOING').toUpperCase()
        const maxDepth = filter?.maxDepth ?? 1
        if (maxDepth <= 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const requestedTypeRefs = filter?.relationTypeIds?.length
          ? filter.relationTypeIds
          : filter?.relationTypeId
            ? [filter.relationTypeId]
            : undefined
        const resolvedTypes = await resolveRelationTypeRefs(this.relationTypeRepository, requestedTypeRefs)
        if (resolvedTypes && resolvedTypes.ids.length === 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        if (!this.searchRelatedNodesUseCase) {
          const traversalDirection = normalizeTraversalDirection(directionStr)
          const traversal = await this.graphTraversal.connectedNodesWithDetails(
            sourceNodeId,
            maxDepth,
            traversalDirection,
            resolvedTypes?.ids,
          )
          const offset = Math.max(0, args.pagination?.offset ?? 0)
          const limit = Math.max(1, args.pagination?.limit ?? 10)
          const paged = traversal.nodes.slice(offset, offset + limit)
          return {
            nodes: paged.map(({ node, distance }) => ({ ...nodeFromEntity(node), distance })),
            relations: nodeRelationFromEntities(traversal.relations),
            totalCount: traversal.nodes.length,
            totalConnections: traversal.nodes.length,
            hasNextPage: offset + limit < traversal.nodes.length,
            hasPreviousPage: offset > 0,
          }
        }

        const mappedDirection =
          directionStr === 'INCOMING'
            ? RelationDirection.INCOMING
            : directionStr === 'BOTH'
              ? RelationDirection.BOTH
              : RelationDirection.OUTGOING

        const result = await this.searchRelatedNodesUseCase.execute({
          tableId,
          sourceNodeIds: [sourceNodeId],
          relationFilters: [
            {
              relationTypes: resolvedTypes?.identifiers,
              direction: mappedDirection,
              depth: maxDepth,
            },
          ],
          limit: args.pagination?.limit,
          offset: args.pagination?.offset,
        })

        // Hydrate NodeRelation DTOs matching the traversed edges for GraphQL NodeRelation type fields
        const nodeIdScope = [sourceNodeId, ...result.nodes.map((node) => node.id)]
        const traversalDirection = normalizeTraversalDirection(directionStr)
        const hydratedRelations = await this.loadHydratedRelations(
          nodeIdScope,
          traversalDirection,
          resolvedTypes?.ids,
        )

        return {
          nodes: result.nodes,
          relations: hydratedRelations,
          totalCount: result.totalCount,
          totalConnections: result.totalCount,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'searchRelatedNodes',
      { args },
    )
  }

  async getConnectedNodes(
    _: GraphQLParent,
    args: {
      input?: { nodeId: string; depth?: number; direction?: string; relationTypeIds?: string[] }
      nodeId?: string
      depth?: number
      direction?: string
      relationTypeIds?: string[]
    },
    _context?: GraphQLContext,
  ) {
    const normalized = {
      nodeId: args.input?.nodeId || args.nodeId || '',
      depth: args.input?.depth ?? args.depth ?? 1,
      direction: (args.input?.direction || args.direction || 'BOTH').toUpperCase(),
      relationTypeIds: args.input?.relationTypeIds || args.relationTypeIds || [],
    }

    this.validateArgs(
      normalized as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getConnectedNodes',
    )

    return this.handleQuery(
      async () => {
        if (normalized.depth <= 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const resolvedTypes = await resolveRelationTypeRefs(
          this.relationTypeRepository,
          normalized.relationTypeIds,
        )
        if (resolvedTypes && resolvedTypes.ids.length === 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const traversalDirection = normalizeTraversalDirection(normalized.direction)
        const { nodes: traversedNodes, relations } = await this.graphTraversal.connectedNodesWithDetails(
          normalized.nodeId,
          normalized.depth,
          traversalDirection,
          resolvedTypes?.ids,
        )

        const nodes = traversedNodes.map(({ node, distance }) => ({
          ...nodeFromEntity(node),
          distance,
        }))

        return {
          nodes,
          relations: nodeRelationFromEntities(relations),
          totalCount: nodes.length,
          totalConnections: nodes.length,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      'getConnectedNodes',
      normalized,
    )
  }

  async getDependencyChain(
    _: GraphQLParent,
    args: {
      input: { nodeId: string; direction?: string; maxDepth?: number; relationTypeIds?: string[] }
    },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args.input as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getDependencyChain',
    )

    return this.handleQuery(
      async () => {
        const maxDepth = args.input.maxDepth ?? 5
        if (maxDepth <= 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const sourceNode = await this.nodeRepository.findById(args.input.nodeId)
        if (!sourceNode || !this.graphRepository) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const resolvedTypes = await resolveRelationTypeRefs(
          this.relationTypeRepository,
          args.input.relationTypeIds,
        )
        if (resolvedTypes && resolvedTypes.identifiers.length === 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const directionUpper = (args.input.direction || 'OUTGOING').toUpperCase()
        const direction =
          directionUpper === 'INCOMING'
            ? RelationDirection.INCOMING
            : directionUpper === 'BOTH'
              ? RelationDirection.BOTH
              : RelationDirection.OUTGOING

        const dependencies = await this.graphRepository.getDependencyChain(
          sourceNode.getTableId(),
          args.input.nodeId,
          direction,
          resolvedTypes?.identifiers,
          maxDepth,
        )

        if (dependencies.length === 0) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            totalConnections: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const nodesById = await this.loadNodesByIdMap(dependencies.map((d) => d.nodeId))
        const dependencyNodes = dependencies.flatMap((dependency) => {
          const node = nodesById.get(dependency.nodeId)
          return node ? [{ ...nodeFromEntity(node), distance: dependency.level }] : []
        })

        const scopeIds = [args.input.nodeId, ...dependencies.map((d) => d.nodeId)]
        const scopeSet = new Set(scopeIds)
        const hydratedRelations = (
          await this.loadHydratedRelations(
            scopeIds,
            normalizeTraversalDirection(directionUpper),
            resolvedTypes?.ids,
          )
        ).filter(
          (relation) =>
            relation.sourceNodeId !== null &&
            relation.targetNodeId !== null &&
            scopeSet.has(relation.sourceNodeId) &&
            scopeSet.has(relation.targetNodeId),
        )

        return {
          nodes: dependencyNodes,
          relations: hydratedRelations,
          totalCount: dependencyNodes.length,
          totalConnections: dependencyNodes.length,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      'getDependencyChain',
      { input: args.input },
    )
  }

  async findPathsBetweenNodes(
    _: GraphQLParent,
    args: {
      input: {
        sourceNodeId: string
        targetNodeId: string
        maxDepth?: number
        relationTypeIds?: string[]
      }
    },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args.input as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'findPathsBetweenNodes',
    )

    return this.handleQuery(
      async () => {
        const maxDepth = args.input.maxDepth ?? 3
        const sourceNodeId = args.input.sourceNodeId
        const targetNodeId = args.input.targetNodeId

        const sourceNode = await this.nodeRepository.findById(sourceNodeId)
        if (!sourceNode || !this.graphRepository) return []

        const resolvedTypes = await resolveRelationTypeRefs(
          this.relationTypeRepository,
          args.input.relationTypeIds,
        )
        if (resolvedTypes && resolvedTypes.identifiers.length === 0) {
          return []
        }

        const storedPaths = await this.graphRepository.findPathsBetweenNodes(
          sourceNode.getTableId(),
          [sourceNodeId],
          [targetNodeId],
          maxDepth,
          resolvedTypes?.identifiers,
        )
        if (storedPaths.length === 0) return []

        const allNodeIds = new Set<string>()
        const prefixNodeIds = new Set<string>()
        for (const storedPath of storedPaths) {
          for (let index = 0; index < storedPath.path.length; index += 1) {
            const id = storedPath.path[index]
            if (id === undefined) continue
            allNodeIds.add(id)
            if (index < storedPath.path.length - 1) prefixNodeIds.add(id)
          }
        }

        const [nodesById, adjacency] = await Promise.all([
          this.loadNodesByIdMap([...allNodeIds]),
          prefixNodeIds.size > 0
            ? this.loadOutgoingAdjacency([...prefixNodeIds], resolvedTypes?.ids)
            : Promise.resolve(new Map<string, NodeRelation[]>()),
        ])

        const paths = storedPaths.map((storedPath) => {
          const nodes = storedPath.path.flatMap((id) => {
            const node = nodesById.get(id)
            return node ? [nodeFromEntity(node)] : []
          })
          const relations: NodeRelation[] = []
          let weightSum = 0
          for (let index = 0; index < storedPath.path.length - 1; index += 1) {
            const fromId = storedPath.path[index]
            const toId = storedPath.path[index + 1]
            if (fromId === undefined || toId === undefined) continue
            const match = (adjacency.get(fromId) ?? []).find(
              (candidate) => candidate.getTargetNodeId() === toId,
            )
            if (match !== undefined) {
              relations.push(match)
              weightSum += match.getStrength()
            }
          }
          return {
            nodes,
            relations: relations.map((relation) => nodeRelationFromEntity(relation)),
            length: storedPath.length,
            totalWeight: relations.length > 0 ? weightSum : storedPath.length,
          }
        })

        return paths.sort((left, right) => left.length - right.length)
      },
      'findPathsBetweenNodes',
      { input: args.input },
    )
  }

  private async loadNodesByIdMap(nodeIds: readonly string[]): Promise<Map<string, Node>> {
    const unique = [...new Set(nodeIds)]
    if (unique.length === 0) return new Map()
    const chunks: string[][] = []
    for (let index = 0; index < unique.length; index += 500) {
      chunks.push(unique.slice(index, index + 500))
    }
    const loaded = (await Promise.all(chunks.map((chunk) => this.nodeRepository.findByIds(chunk)))).flat()
    return new Map(loaded.map((node) => [node.getId(), node]))
  }

  private async loadOutgoingAdjacency(
    nodeIds: readonly string[],
    relationTypeIds?: readonly string[],
  ): Promise<Map<string, NodeRelation[]>> {
    if (typeof this.nodeRelationRepository.findAdjacentByNodeIds === 'function') {
      const merged = new Map<string, NodeRelation[]>()
      for (let index = 0; index < nodeIds.length; index += 64) {
        const batch = nodeIds.slice(index, index + 64)
        const loaded = await this.nodeRelationRepository.findAdjacentByNodeIds(batch, 'OUTGOING', relationTypeIds)
        for (const [key, value] of loaded) {
          merged.set(key, value)
        }
      }
      return merged
    }

    const fallback = new Map<string, NodeRelation[]>()
    await Promise.all(
      nodeIds.map(async (nodeId) => {
        const rels = await this.nodeRelationRepository.findBySourceNodeId(nodeId)
        fallback.set(
          nodeId,
          relationTypeIds && relationTypeIds.length > 0
            ? rels.filter((r) => relationTypeIds.includes(r.getRelationTypeId()))
            : rels,
        )
      }),
    )
    return fallback
  }

  private async loadHydratedRelations(
    nodeIds: readonly string[],
    direction: TraversalDirection,
    relationTypeIds?: readonly string[],
  ) {
    const unique = [...new Set(nodeIds)]
    if (unique.length === 0) return []
    const relationMap = new Map<string, NodeRelation>()

    if (typeof this.nodeRelationRepository.findAdjacentByNodeIds === 'function') {
      for (let index = 0; index < unique.length; index += 64) {
        const batch = unique.slice(index, index + 64)
        const loaded = await this.nodeRelationRepository.findAdjacentByNodeIds(batch, direction, relationTypeIds)
        for (const relations of loaded.values()) {
          for (const relation of relations) {
            relationMap.set(relation.getId(), relation)
          }
        }
      }
    }

    return nodeRelationFromEntities(Array.from(relationMap.values()))
  }
}

function normalizeTraversalDirection(direction: string): TraversalDirection {
  const upper = direction.toUpperCase()
  if (upper === 'INCOMING') return 'INCOMING'
  if (upper === 'OUTGOING') return 'OUTGOING'
  return 'BOTH'
}
