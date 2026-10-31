import { type NodeDto, fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  GraphTraversalService,
  type TraversalDirection,
} from '@/application/services/GraphTraversalService.js'
import { type AttributeTypeInfo, SearchQueryParser } from '@/application/services/SearchQueryParser.js'
import { loadTableAttributeTypeInfo } from '@/application/use-cases/nodes/SearchNodes.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { SearchQuery } from '@/domain/value-objects/SearchFilter.js'
import type { LexicalMatchRank } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { validateEmbeddingVector } from '@/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface HybridGraphFilter {
  anchorNodeIds: string[]
  maxDepth?: number
  direction?: TraversalDirection
  relationTypes?: string[]
  includeAnchors?: boolean
}

export interface HybridSearchWeights {
  fts?: number
  vector?: number
  graph?: number
}

export interface HybridSearchNodesInput {
  tableId: string
  textQuery?: string
  vector?: readonly number[]
  model?: string
  minVectorScore?: number
  filterQuery?: string
  conditions?: SearchQuery['conditions']
  graph?: HybridGraphFilter
  weights?: HybridSearchWeights
  rrfK?: number
  limit?: number
  offset?: number
}

export interface HybridSearchHitDto {
  node: NodeDto
  combinedScore: number
  ftsScore: number | null
  ftsRank: number | null
  vectorScore: number | null
  vectorRank: number | null
  hopDistance: number | null
}

export interface HybridSearchMetrics {
  eligibleCandidates: number
  graphCandidates: number | null
  lexicalCandidates: number
  vectorCandidates: number
  scannedVectors: number
  elapsedMs: number
}

export interface HybridSearchNodesOutput {
  results: HybridSearchHitDto[]
  total: number
  hasMore: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  metrics: HybridSearchMetrics
}

export interface IHybridNodeSearchRepository {
  filterNodeIds(
    tableId: TableId,
    searchQuery: SearchQuery,
    availableAttributes: AttributeTypeInfo[],
    restrictToNodeIds?: ReadonlySet<string>,
  ): string[] | Promise<string[]>
  countNodesInTable?(tableId: TableId): number | Promise<number>
  filterExistingNodeIdsInTable?(
    tableId: TableId,
    candidateIds: ReadonlySet<string>,
  ): string[] | Promise<string[]>
  rankLexicalMatches(
    tableId: TableId,
    text: string,
    limit: number,
    restrictToNodeIds?: ReadonlySet<string>,
  ): LexicalMatchRank[] | Promise<LexicalMatchRank[]>
  hydrateNodesByIds(
    orderedNodeIds: readonly string[],
  ):
    | Array<{ node: Node; attributes?: Record<string, unknown> }>
    | Promise<Array<{ node: Node; attributes?: Record<string, unknown> }>>
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 200
const DEFAULT_RRF_K = 60
const DEFAULT_WEIGHTS: Required<HybridSearchWeights> = {
  fts: 1.0,
  vector: 1.0,
  graph: 0.5,
}

export class HybridSearchNodesUseCase {
  private readonly graphTraversal: GraphTraversalService

  constructor(
    nodeRepository: INodeRepository,
    private readonly nodeSearchRepository: IHybridNodeSearchRepository,
    private readonly nodeEmbeddingRepository: INodeEmbeddingRepository,
    nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger,
    graphTraversal?: GraphTraversalService,
  ) {
    this.graphTraversal =
      graphTraversal ?? new GraphTraversalService(nodeRepository, nodeRelationRepository)
  }

  async execute(input: HybridSearchNodesInput): Promise<HybridSearchNodesOutput> {
    const startedAt = performance.now()
    this.validateInput(input)

    const tableId = input.tableId.trim() as TableId
    const table = await this.tableRepository.findById(tableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    const limit = input.limit ?? DEFAULT_LIMIT
    const offset = input.offset ?? 0
    const rrfK = input.rrfK ?? DEFAULT_RRF_K
    const weights: Required<HybridSearchWeights> = {
      fts: input.weights?.fts ?? DEFAULT_WEIGHTS.fts,
      vector: input.weights?.vector ?? DEFAULT_WEIGHTS.vector,
      graph: input.weights?.graph ?? DEFAULT_WEIGHTS.graph,
    }

    // Step 1: Optional N-hop graph neighborhood candidate set
    let hopDistances: Map<string, number> | null = null
    let graphCandidateSet: Set<string> | undefined
    if (input.graph) {
      const resolvedRelationTypeIds = await this.resolveRelationTypeIds(input.graph.relationTypes)
      const maxDepth = input.graph.maxDepth ?? 2
      const direction = normalizeDirection(input.graph.direction)
      const includeAnchors = input.graph.includeAnchors ?? false

      const rawDistances = await this.graphTraversal.connectedNodeDistances(
        input.graph.anchorNodeIds,
        maxDepth,
        direction,
        resolvedRelationTypeIds,
      )

      hopDistances = new Map<string, number>()
      for (const [nodeId, distance] of rawDistances) {
        if (!includeAnchors && distance === 0) continue
        hopDistances.set(nodeId, distance)
      }
      graphCandidateSet = new Set(hopDistances.keys())

      if (graphCandidateSet.size === 0) {
        return createEmptyOutput(offset, 0, performance.now() - startedAt)
      }
    }

    // Step 2: Table-scoped & typed attribute filter candidate set
    const hasTextQuery = Boolean(input.textQuery?.trim())
    const hasVectorQuery = Boolean(input.vector && input.vector.length > 0)
    const hasAttributeFilter =
      Boolean(input.filterQuery?.trim()) || Boolean(input.conditions && input.conditions.length > 0)

    let eligibleSet: Set<string> | undefined
    let eligibleCount = 0

    if (
      !hasAttributeFilter &&
      !graphCandidateSet &&
      (hasTextQuery || hasVectorQuery) &&
      typeof this.nodeSearchRepository.countNodesInTable === 'function'
    ) {
      // Unfiltered lexical/vector hybrid search: skip materializing every node ID
      // in the table into a JS Set; both FTS5 and vector slab are already table-scoped.
      eligibleCount = await this.nodeSearchRepository.countNodesInTable(tableId)
      if (eligibleCount === 0) {
        return createEmptyOutput(offset, null, performance.now() - startedAt)
      }
      eligibleSet = undefined
    } else if (
      !hasAttributeFilter &&
      graphCandidateSet &&
      typeof this.nodeSearchRepository.filterExistingNodeIdsInTable === 'function'
    ) {
      const eligibleNodeIds = await this.nodeSearchRepository.filterExistingNodeIdsInTable(
        tableId,
        graphCandidateSet,
      )
      if (eligibleNodeIds.length === 0) {
        return createEmptyOutput(offset, graphCandidateSet.size, performance.now() - startedAt)
      }
      eligibleSet = new Set(eligibleNodeIds)
      eligibleCount = eligibleSet.size
    } else {
      const attributeInfo = await loadTableAttributeTypeInfo(this.attributeRepository, tableId)
      const filterSearchQuery = this.buildFilterSearchQuery(input, attributeInfo)
      const eligibleNodeIds = await this.nodeSearchRepository.filterNodeIds(
        tableId,
        filterSearchQuery,
        attributeInfo,
        graphCandidateSet,
      )

      if (eligibleNodeIds.length === 0) {
        return createEmptyOutput(
          offset,
          graphCandidateSet ? graphCandidateSet.size : null,
          performance.now() - startedAt,
        )
      }

      eligibleSet = new Set(eligibleNodeIds)
      eligibleCount = eligibleSet.size
    }

    const poolLimit = Math.max((offset + limit) * 4, 100)

    // Step 3: Lexical FTS5 BM25 ranking + Persistent Float32Array vector similarity
    const [lexicalMatches, vectorResult] = await Promise.all([
      hasTextQuery
        ? this.nodeSearchRepository.rankLexicalMatches(
            tableId,
            input.textQuery ?? '',
            poolLimit,
            eligibleSet,
          )
        : Promise.resolve([]),
      hasVectorQuery
        ? this.nodeEmbeddingRepository.searchSimilar({
            tableId,
            queryVector: input.vector ?? [],
            limit: poolLimit,
            minScore: input.minVectorScore ?? -1,
            model: input.model,
            restrictToNodeIds: eligibleSet,
          })
        : Promise.resolve(null),
    ])

    const lexicalByNodeId = new Map(lexicalMatches.map((entry) => [entry.nodeId, entry]))
    const vectorByNodeId = new Map(
      (vectorResult?.hits ?? []).map((entry) => [String(entry.nodeId), entry]),
    )

    // Determine candidate union to rank via RRF
    const candidateIds = new Set<string>()
    if (hasTextQuery || hasVectorQuery) {
      for (const nodeId of lexicalByNodeId.keys()) candidateIds.add(nodeId)
      for (const nodeId of vectorByNodeId.keys()) candidateIds.add(nodeId)
    } else if (eligibleSet) {
      for (const nodeId of eligibleSet) candidateIds.add(nodeId)
    }

    if (candidateIds.size === 0) {
      return {
        results: [],
        total: 0,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: offset > 0,
        metrics: {
          eligibleCandidates: eligibleCount,
          graphCandidates: graphCandidateSet ? graphCandidateSet.size : null,
          lexicalCandidates: lexicalMatches.length,
          vectorCandidates: vectorResult?.hits.length ?? 0,
          scannedVectors: vectorResult?.metrics.scanned ?? 0,
          elapsedMs: performance.now() - startedAt,
        },
      }
    }

    // Step 4: Reciprocal Rank Fusion (RRF) across FTS + Vector + Graph Proximity
    const scoredCandidates: Array<{
      nodeId: string
      combinedScore: number
      ftsScore: number | null
      ftsRank: number | null
      vectorScore: number | null
      vectorRank: number | null
      hopDistance: number | null
    }> = []

    for (const nodeId of candidateIds) {
      const lexical = lexicalByNodeId.get(nodeId)
      const vectorHit = vectorByNodeId.get(nodeId)
      const hopDistance = hopDistances ? (hopDistances.get(nodeId) ?? null) : null

      let combinedScore = 0
      if (lexical && weights.fts > 0) {
        combinedScore += weights.fts / (rrfK + lexical.rank)
      }
      if (vectorHit && weights.vector > 0) {
        combinedScore += weights.vector / (rrfK + vectorHit.rank)
      }
      if (hopDistance !== null && weights.graph > 0) {
        combinedScore += weights.graph / (rrfK + hopDistance + 1)
      }

      scoredCandidates.push({
        nodeId,
        combinedScore,
        ftsScore: lexical ? lexical.bm25Score : null,
        ftsRank: lexical ? lexical.rank : null,
        vectorScore: vectorHit ? vectorHit.score : null,
        vectorRank: vectorHit ? vectorHit.rank : null,
        hopDistance,
      })
    }

    scoredCandidates.sort((left, right) => {
      if (right.combinedScore !== left.combinedScore) {
        return right.combinedScore - left.combinedScore
      }
      const leftVec = left.vectorScore ?? Number.NEGATIVE_INFINITY
      const rightVec = right.vectorScore ?? Number.NEGATIVE_INFINITY
      if (rightVec !== leftVec) return rightVec - leftVec

      const leftFts = left.ftsScore ?? Number.NEGATIVE_INFINITY
      const rightFts = right.ftsScore ?? Number.NEGATIVE_INFINITY
      if (rightFts !== leftFts) return rightFts - leftFts

      const leftHop = left.hopDistance ?? Number.POSITIVE_INFINITY
      const rightHop = right.hopDistance ?? Number.POSITIVE_INFINITY
      if (leftHop !== rightHop) return leftHop - rightHop

      return left.nodeId.localeCompare(right.nodeId)
    })

    const total = scoredCandidates.length
    const pageCandidates = scoredCandidates.slice(offset, offset + limit)
    const hydratedNodes = await this.nodeSearchRepository.hydrateNodesByIds(
      pageCandidates.map((entry) => entry.nodeId),
    )
    const hydratedById = new Map(
      hydratedNodes.map((entry) => [
        entry.node.getId(),
        nodeFromEntity(entry.node, entry.attributes || {}),
      ]),
    )

    const results: HybridSearchHitDto[] = pageCandidates.flatMap((candidate) => {
      const dto = hydratedById.get(candidate.nodeId)
      if (!dto) return []
      return [
        {
          node: {
            ...dto,
            relevanceScore: candidate.combinedScore,
            ...(candidate.hopDistance !== null ? { distance: candidate.hopDistance } : {}),
          },
          combinedScore: candidate.combinedScore,
          ftsScore: candidate.ftsScore,
          ftsRank: candidate.ftsRank,
          vectorScore: candidate.vectorScore,
          vectorRank: candidate.vectorRank,
          hopDistance: candidate.hopDistance,
        },
      ]
    })

    const elapsedMs = performance.now() - startedAt
    this.logger.info('Hybrid node search completed', {
      tableId,
      total,
      returned: results.length,
      elapsedMs,
    })

    return {
      results,
      total,
      hasMore: offset + limit < total,
      hasNextPage: offset + limit < total,
      hasPreviousPage: offset > 0,
      metrics: {
        eligibleCandidates: eligibleCount,
        graphCandidates: graphCandidateSet ? graphCandidateSet.size : null,
        lexicalCandidates: lexicalMatches.length,
        vectorCandidates: vectorResult?.hits.length ?? 0,
        scannedVectors: vectorResult?.metrics.scanned ?? 0,
        elapsedMs,
      },
    }
  }

  private buildFilterSearchQuery(
    input: HybridSearchNodesInput,
    attributeInfo: AttributeTypeInfo[],
  ): SearchQuery {
    const conditions: SearchQuery['conditions'] = []
    let textSearch: string | undefined

    if (input.filterQuery?.trim()) {
      const parser = new SearchQueryParser(attributeInfo)
      const parsed = parser.parse(input.filterQuery)
      conditions.push(...parsed.conditions)
      textSearch = parsed.textSearch
    }

    if (input.conditions && input.conditions.length > 0) {
      conditions.push(...input.conditions)
    }

    return {
      conditions,
      ...(textSearch ? { textSearch } : {}),
    }
  }

  private async resolveRelationTypeIds(
    relationTypes?: readonly string[],
  ): Promise<string[] | undefined> {
    if (!relationTypes) return undefined
    if (relationTypes.length === 0) return []

    const resolved = await Promise.all(
      relationTypes.map(async (token) => {
        const trimmed = token.trim()
        if (!trimmed) return null
        const byIdentifier = await this.relationTypeRepository.findByIdentifier(trimmed)
        if (byIdentifier) return byIdentifier.getId()
        const byId = await this.relationTypeRepository.findById(trimmed)
        return byId ? byId.getId() : null
      }),
    )

    return resolved.filter((id): id is string => id !== null)
  }

  private validateInput(input: HybridSearchNodesInput): void {
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (
      input.limit !== undefined &&
      (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT)
    ) {
      throw new ValidationException(`Limit must be an integer between 1 and ${MAX_LIMIT}`)
    }

    if (input.offset !== undefined && (!Number.isSafeInteger(input.offset) || input.offset < 0)) {
      throw new ValidationException('Offset must be a non-negative integer')
    }

    if (input.rrfK !== undefined && (!Number.isFinite(input.rrfK) || input.rrfK <= 0)) {
      throw new ValidationException('rrfK must be a positive finite number')
    }

    if (
      input.minVectorScore !== undefined &&
      (!Number.isFinite(input.minVectorScore) ||
        input.minVectorScore < -1 ||
        input.minVectorScore > 1)
    ) {
      throw new ValidationException('minVectorScore must be between -1 and 1')
    }

    if (input.vector !== undefined && input.vector.length > 0) {
      validateEmbeddingVector(input.vector)
    }

    if (input.weights) {
      for (const [key, value] of Object.entries(input.weights)) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
          throw new ValidationException(`Weight '${key}' must be a non-negative finite number`)
        }
      }
    }

    if (input.graph) {
      if (
        !Array.isArray(input.graph.anchorNodeIds) ||
        input.graph.anchorNodeIds.length === 0 ||
        input.graph.anchorNodeIds.some((id) => typeof id !== 'string' || !id.trim())
      ) {
        throw new ValidationException(
          'graph.anchorNodeIds must be a non-empty array of non-empty node IDs',
        )
      }
      if (
        input.graph.maxDepth !== undefined &&
        (!Number.isSafeInteger(input.graph.maxDepth) || input.graph.maxDepth < 0)
      ) {
        throw new ValidationException('graph.maxDepth must be a non-negative integer')
      }
      if (
        input.graph.direction !== undefined &&
        !['INCOMING', 'OUTGOING', 'BOTH'].includes(input.graph.direction)
      ) {
        throw new ValidationException(
          "graph.direction must be one of 'INCOMING', 'OUTGOING', or 'BOTH'",
        )
      }
    }
  }
}

function normalizeDirection(direction?: string): TraversalDirection {
  if (direction === 'INCOMING' || direction === 'OUTGOING' || direction === 'BOTH') {
    return direction
  }
  return 'BOTH'
}

function createEmptyOutput(
  offset: number,
  graphCandidates: number | null,
  elapsedMs: number,
): HybridSearchNodesOutput {
  return {
    results: [],
    total: 0,
    hasMore: false,
    hasNextPage: false,
    hasPreviousPage: offset > 0,
    metrics: {
      eligibleCandidates: 0,
      graphCandidates,
      lexicalCandidates: 0,
      vectorCandidates: 0,
      scannedVectors: 0,
      elapsedMs,
    },
  }
}
