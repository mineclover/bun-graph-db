import type { NodeDto } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphHierarchyService } from '@/application/services/GraphHierarchyService.js'
import { resolveRelationTypeRefs } from '@/application/services/GraphTraversalService.js'
import {
  InformationArchitectureService,
  type IaOutlineResult,
  type InformationArchitectureBlueprint,
} from '@/application/services/InformationArchitectureService.js'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { EmbedNodesUseCase } from '@/application/use-cases/nodes/EmbedNodes.js'
import type { HybridSearchNodesUseCase } from '@/application/use-cases/nodes/HybridSearchNodes.js'
import type { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export const AI_MEMORY_TOPICS_TABLE = 'ai_memory_topics'
export const AI_MEMORIES_TABLE = 'ai_memories'

export type MemoryKind = 'working' | 'episodic' | 'semantic' | 'procedural'
export type MemoryStatus = 'active' | 'consolidated' | 'superseded' | 'archived'
export type MemoryRelationKind =
  | 'supersedes'
  | 'contradicts'
  | 'supports'
  | 'derivedFrom'
  | 'relatedTo'

export const DEFAULT_HALF_LIFE_DAYS: Record<MemoryKind, number> = {
  working: 1,
  episodic: 14,
  semantic: 180,
  procedural: 365,
}

export interface RememberInput {
  content: string
  summary?: string
  kind?: MemoryKind
  namespace?: string
  sessionId?: string
  topicPath?: string[]
  importance?: number
  confidence?: number
  halfLifeDays?: number
  tags?: string[]
  sourceRef?: string
  recordedAt?: string
  expiresAt?: string
  supersedesIds?: string[]
  links?: Array<{
    targetMemoryId: string
    type: MemoryRelationKind
  }>
}

export interface MemoryRecord {
  id: string
  tableId: string
  content: string
  summary: string | null
  kind: MemoryKind
  namespace: string
  sessionId: string
  importance: number
  confidence: number
  halfLifeDays: number
  accessCount: number
  lastAccessedAt: string
  recordedAt: string
  expiresAt: string
  status: MemoryStatus
  tags: string[]
  sourceRef: string
  topicPath: string[]
}

export interface RememberOutput {
  memory: MemoryRecord
  topicNodeId?: string
  embedded: boolean
  supersededIds: string[]
}

export interface RecallInput {
  query?: string
  vector?: readonly number[]
  namespace?: string
  sessionId?: string
  kinds?: MemoryKind[]
  topicPath?: string[]
  tags?: string[]
  tagMatchMode?: 'any' | 'all'
  anchorMemoryIds?: string[]
  includeSuperseded?: boolean
  includeExpired?: boolean
  minImportance?: number
  reinforce?: boolean
  now?: Date
  limit?: number
}

export interface RecallScoreBreakdown {
  combined: number
  hybrid: number
  ftsRank: number | null
  vectorScore: number | null
  hopDistance: number | null
  recency: number
  salience: number
}

export interface RecalledMemoryHit {
  memory: MemoryRecord
  score: RecallScoreBreakdown
}

export interface RecallOutput {
  hits: RecalledMemoryHit[]
  total: number
  namespace?: string
}

export interface ConsolidateInput {
  sourceMemoryIds: string[]
  content: string
  summary?: string
  kind?: Extract<MemoryKind, 'semantic' | 'procedural'>
  namespace?: string
  topicPath?: string[]
  importance?: number
  confidence?: number
  markSourcesAsSuperseded?: boolean
  recordedAt?: string
}

export interface ConsolidateOutput {
  memory: MemoryRecord
  derivedFromIds: string[]
  supersededIds: string[]
}

export interface ContextWindowInput {
  query?: string
  namespace?: string
  topicPath?: string[]
  kinds?: MemoryKind[]
  maxTokens?: number
  charsPerToken?: number
  limit?: number
  now?: Date
}

export interface ContextWindowOutput {
  promptContext: string
  estimatedTokens: number
  memories: RecalledMemoryHit[]
  truncated: boolean
}

export interface TimelineInput {
  namespace?: string
  sessionId?: string
  kind?: MemoryKind
  includeSuperseded?: boolean
  limit?: number
}

export interface MemoryStatsOutput {
  total: number
  byKind: Record<MemoryKind, number>
  byStatus: Record<MemoryStatus, number>
  embeddedCount: number
  topicCount: number
}

export interface AiMemoryServiceDeps {
  tableRepository: ITableRepository
  attributeTypeRepository: IAttributeTypeRepository
  attributeRepository: IAttributeRepository
  nodeRepository: INodeRepository
  nodeAttributeRepository: INodeAttributeRepository
  nodeRelationRepository: INodeRelationRepository
  relationTypeRepository: IRelationTypeRepository
  nodeEmbeddingRepository: INodeEmbeddingRepository
  docRepository: IDocRepository
  createTableUseCase: Pick<CreateTableUseCase, 'execute'>
  createAttributeUseCase: Pick<CreateAttributeUseCase, 'execute'>
  createNodeUseCase: Pick<CreateNodeUseCase, 'execute'>
  updateNodeUseCase: Pick<UpdateNodeUseCase, 'execute'>
  createRelationUseCase: Pick<CreateRelationUseCase, 'execute'>
  createDocUseCase: Pick<CreateDocUseCase, 'execute'>
  hybridSearchNodesUseCase: HybridSearchNodesUseCase
  hierarchyService: GraphHierarchyService
  schemaGate: NodeAttributeSchemaGate
  embedNodesUseCase?: EmbedNodesUseCase
  logger?: ILogger
}

function buildAiMemoryBlueprint(): InformationArchitectureBlueprint {
  return {
    name: 'ai-agent-memory-v1',
    version: '1.0.0',
    description:
      'First-class multi-signal AI Agent Memory subsystem (hierarchical topic tree + episodic/semantic/procedural/working memories).',
    relationTypes: [
      { identifier: 'parentOf', description: 'Topic taxonomy tree parent edge', category: 'hierarchy' },
      { identifier: 'belongsToTopic', description: 'Links a memory topic node to an AI memory node', category: 'semantic' },
      { identifier: 'supersedes', description: 'Marks newer memory as superseding older memory', category: 'semantic' },
      { identifier: 'contradicts', description: 'Conflicting fact/memory edge', category: 'semantic' },
      { identifier: 'supports', description: 'Corroborating memory edge', category: 'semantic' },
      { identifier: 'derivedFrom', description: 'Consolidated memory provenance edge', category: 'structural' },
      { identifier: 'relatedTo', description: 'Associative memory link', category: 'semantic' },
    ],
    tables: [
      {
        identifier: AI_MEMORY_TOPICS_TABLE,
        description: 'Hierarchical topic taxonomy tree for AI agent memory namespacing and subtree recall',
        hierarchy: { mode: 'TREE', relationType: 'parentOf' },
        attributes: [
          { identifier: 'slug', name: 'Topic Slug', typeIdentifier: 'string', isRequired: true },
          { identifier: 'full_path', name: 'Full Topic Path', typeIdentifier: 'string', isRequired: true },
        ],
      },
      {
        identifier: AI_MEMORIES_TABLE,
        description: 'Episodic, semantic, procedural, and working agent memories with temporal decay and salience scoring',
        attributes: [
          { identifier: 'memory_kind', name: 'Memory Kind', typeIdentifier: 'string', isRequired: true },
          { identifier: 'namespace', name: 'Namespace', typeIdentifier: 'string', isRequired: true },
          { identifier: 'session_id', name: 'Session ID', typeIdentifier: 'string', isRequired: false },
          { identifier: 'importance', name: 'Importance (0..1)', typeIdentifier: 'number', isRequired: true },
          { identifier: 'confidence', name: 'Confidence (0..1)', typeIdentifier: 'number', isRequired: true },
          { identifier: 'half_life_days', name: 'Decay Half-Life (Days)', typeIdentifier: 'number', isRequired: true },
          { identifier: 'access_count', name: 'Access Count', typeIdentifier: 'integer', isRequired: true },
          { identifier: 'last_accessed_at', name: 'Last Accessed ISO', typeIdentifier: 'string', isRequired: true },
          { identifier: 'recorded_at', name: 'Recorded At ISO', typeIdentifier: 'string', isRequired: true },
          { identifier: 'expires_at', name: 'Expires At ISO', typeIdentifier: 'string', isRequired: false },
          { identifier: 'status', name: 'Lifecycle Status', typeIdentifier: 'string', isRequired: true },
          { identifier: 'tags', name: 'Tags JSON', typeIdentifier: 'string', isRequired: false },
          { identifier: 'source_ref', name: 'Source Reference', typeIdentifier: 'string', isRequired: false },
          { identifier: 'topic_path', name: 'Topic Path JSON', typeIdentifier: 'string', isRequired: false },
        ],
      },
    ],
  }
}

function clampUnit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw !== 'string' || raw.trim().length === 0) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export class AiMemoryService {
  private readonly iaService: InformationArchitectureService
  private initialized = false
  private initializationPromise: Promise<{ topicsTableId: string; memoriesTableId: string }> | null =
    null
  private topicsTableId = ''
  private memoriesTableId = ''

  constructor(private readonly deps: AiMemoryServiceDeps) {
    this.iaService = new InformationArchitectureService(deps)
  }

  async ensureInitialized(): Promise<{ topicsTableId: string; memoriesTableId: string }> {
    if (this.initialized && this.topicsTableId && this.memoriesTableId) {
      return {
        topicsTableId: this.topicsTableId,
        memoriesTableId: this.memoriesTableId,
      }
    }
    if (this.initializationPromise) {
      return await this.initializationPromise
    }

    this.initializationPromise = (async () => {
      const applied = await this.iaService.applyBlueprint(buildAiMemoryBlueprint(), {
        embedNodes: false,
        validateHierarchies: true,
      })
      const topicsTableId = applied.tables[AI_MEMORY_TOPICS_TABLE]
      const memoriesTableId = applied.tables[AI_MEMORIES_TABLE]
      if (!topicsTableId || !memoriesTableId) {
        throw new Error('Failed to initialize AI memory tables')
      }
      this.topicsTableId = topicsTableId
      this.memoriesTableId = memoriesTableId
      this.initialized = true
      return { topicsTableId, memoriesTableId }
    })()

    try {
      return await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  async remember(input: RememberInput): Promise<RememberOutput> {
    const content = input.content?.trim()
    if (!content) {
      throw new ValidationException('Memory content cannot be empty')
    }

    const { memoriesTableId } = await this.ensureInitialized()
    const kind: MemoryKind = input.kind ?? 'episodic'
    const namespace = input.namespace?.trim() || 'default'
    const sessionId = input.sessionId?.trim() || 'default'
    const importance = clampUnit(input.importance ?? 0.6, 0.6)
    const confidence = clampUnit(input.confidence ?? 0.9, 0.9)
    const halfLifeDays =
      input.halfLifeDays !== undefined && input.halfLifeDays > 0
        ? input.halfLifeDays
        : DEFAULT_HALF_LIFE_DAYS[kind]
    const nowIso = input.recordedAt?.trim() || new Date().toISOString()
    const cleanTopicPath = (input.topicPath ?? []).map((s) => s.trim()).filter(Boolean)

    const nodeResult = await this.deps.createNodeUseCase.execute({
      tableId: memoriesTableId,
      content,
      title: input.summary?.trim() || content.slice(0, 72),
      description: input.summary?.trim() || undefined,
      attributes: {
        memory_kind: kind,
        namespace,
        session_id: sessionId,
        importance: String(importance),
        confidence: String(confidence),
        half_life_days: String(halfLifeDays),
        access_count: '1',
        last_accessed_at: nowIso,
        recorded_at: nowIso,
        expires_at: input.expiresAt?.trim() || '',
        status: 'active',
        tags: JSON.stringify(input.tags ?? []),
        source_ref: input.sourceRef?.trim() || '',
        topic_path: JSON.stringify(cleanTopicPath),
      },
    })

    const memoryId = nodeResult.node.id
    let topicNodeId: string | undefined
    if (cleanTopicPath.length > 0) {
      topicNodeId = await this.ensureTopicPath(cleanTopicPath)
      const belongsId = await this.getRelationTypeId('belongsToTopic')
      await this.deps.createRelationUseCase.execute({
        tableId: memoriesTableId,
        sourceNodeId: topicNodeId,
        targetNodeId: memoryId,
        relationTypeId: belongsId,
        strength: 4,
        confidence: 4,
      })
    }

    const supersededIds: string[] = []
    if (input.supersedesIds && input.supersedesIds.length > 0) {
      const supersedesRtId = await this.getRelationTypeId('supersedes')
      for (const oldId of input.supersedesIds) {
        const oldNode = await this.deps.nodeRepository.findById(oldId)
        if (!oldNode) continue
        await this.deps.updateNodeUseCase.execute(oldId, {
          tableId: memoriesTableId,
          attributes: { status: 'superseded' },
        })
        await this.deps.createRelationUseCase.execute({
          tableId: memoriesTableId,
          sourceNodeId: memoryId,
          targetNodeId: oldId,
          relationTypeId: supersedesRtId,
          strength: 4,
          confidence: 4,
        })
        supersededIds.push(oldId)
      }
    }

    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        const relTypeId = await this.getRelationTypeId(link.type)
        await this.deps.createRelationUseCase.execute({
          tableId: memoriesTableId,
          sourceNodeId: memoryId,
          targetNodeId: link.targetMemoryId,
          relationTypeId: relTypeId,
          strength: 3,
          confidence: 4,
        })
      }
    }

    let embedded = false
    if (this.deps.embedNodesUseCase) {
      await this.deps.embedNodesUseCase.embedNode(memoryId, {
        attributeIdentifiers: ['tags', 'topic_path', 'memory_kind'],
      })
      embedded = true
    }

    const loaded = await this.loadMemoryRecord(memoryId)
    if (!loaded) {
      throw new Error(`Created memory '${memoryId}' could not be reloaded`)
    }

    return {
      memory: loaded,
      ...(topicNodeId ? { topicNodeId } : {}),
      embedded,
      supersededIds,
    }
  }

  async recall(input: RecallInput = {}): Promise<RecallOutput> {
    const { memoriesTableId } = await this.ensureInitialized()
    const limit = Math.max(1, Math.min(100, input.limit ?? 10))
    const nowMs = (input.now ?? new Date()).getTime()
    const filterParts: string[] = []
    if (input.namespace?.trim()) {
      filterParts.push(`namespace:"${input.namespace.trim()}"`)
    }
    if (input.sessionId?.trim()) {
      filterParts.push(`session_id:"${input.sessionId.trim()}"`)
    }
    const filterQuery = filterParts.length > 0 ? filterParts.join(' AND ') : undefined

    let anchorIds = input.anchorMemoryIds ? [...input.anchorMemoryIds] : []
    let graphRelationTypes: string[] | undefined

    if (input.topicPath && input.topicPath.length > 0 && anchorIds.length === 0) {
      const cleanPath = input.topicPath.map((s) => s.trim()).filter(Boolean)
      const topicNode = await this.findTopicNodeByPath(cleanPath)
      if (!topicNode) {
        return { hits: [], total: 0, namespace: input.namespace }
      }
      const topicId = String(topicNode.getId())
      const descendants = await this.deps.hierarchyService.getDescendants(topicId, 'parentOf', 16)
      anchorIds = [topicId, ...descendants.entries.map((entry) => entry.node.id)]
      graphRelationTypes = ['belongsToTopic']
    }

    let rawHits: Array<{
      node: NodeDto
      combinedScore: number
      ftsRank: number | null
      vectorScore: number | null
      hopDistance: number | null
    }>

    const hasSignal =
      Boolean(input.query?.trim()) ||
      Boolean(input.vector && input.vector.length > 0) ||
      anchorIds.length > 0 ||
      Boolean(filterQuery)

    if (hasSignal) {
      const hybrid = await this.deps.hybridSearchNodesUseCase.execute({
        tableId: memoriesTableId,
        textQuery: input.query?.trim() || undefined,
        vector: input.vector,
        filterQuery,
        graph:
          anchorIds.length > 0
            ? {
                anchorNodeIds: anchorIds,
                direction: graphRelationTypes ? 'OUTGOING' : 'BOTH',
                maxDepth: graphRelationTypes ? 1 : 2,
                relationTypes: graphRelationTypes,
                includeAnchors: !graphRelationTypes,
              }
            : undefined,
        limit: 100,
        offset: 0,
      })
      rawHits = hybrid.results
    } else {
      const page = await this.deps.nodeRepository.findByTableId(memoriesTableId, {
        limit: 200,
        offset: 0,
      })
      const nodes = page.data ?? page.nodes ?? []
      rawHits = await Promise.all(
        nodes.map(async (node) => ({
          node: await this.nodeEntityToDtoWithAttrs(node.getId()),
          combinedScore: 0,
          ftsRank: null,
          vectorScore: null,
          hopDistance: null,
        })),
      )
    }

    const kindSet = input.kinds && input.kinds.length > 0 ? new Set(input.kinds) : null
    const filterTags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
    const tagMatchMode = input.tagMatchMode ?? 'all'
    const filteredCandidates: Array<{
      record: MemoryRecord
      hit: (typeof rawHits)[number]
    }> = []

    for (const hit of rawHits) {
      const record = this.dtoToMemoryRecord(hit.node)
      if (input.namespace && record.namespace !== input.namespace) continue
      if (input.sessionId && record.sessionId !== input.sessionId) continue
      if (kindSet && !kindSet.has(record.kind)) continue
      if (!input.includeSuperseded && (record.status === 'superseded' || record.status === 'archived')) {
        continue
      }
      if (
        !input.includeExpired &&
        record.expiresAt &&
        Number.isFinite(Date.parse(record.expiresAt)) &&
        Date.parse(record.expiresAt) <= nowMs
      ) {
        continue
      }
      if (input.minImportance !== undefined && record.importance < input.minImportance) {
        continue
      }
      if (filterTags.length > 0) {
        const recordTags = new Set(record.tags)
        const matchedTags =
          tagMatchMode === 'any'
            ? filterTags.some((tag) => recordTags.has(tag))
            : filterTags.every((tag) => recordTags.has(tag))
        if (!matchedTags) continue
      }
      filteredCandidates.push({ record, hit })
    }

    const maxHybridScore = filteredCandidates.reduce(
      (max, item) => Math.max(max, item.hit.combinedScore),
      0,
    )
    const scoredHits: RecalledMemoryHit[] = []

    for (const { record, hit } of filteredCandidates) {
      const refTimestamp = Date.parse(record.lastAccessedAt || record.recordedAt)
      const ageDays = Number.isFinite(refTimestamp)
        ? Math.max(0, (nowMs - refTimestamp) / 86_400_000)
        : 0
      const halfLife = Math.max(0.01, record.halfLifeDays)
      const recency = 0.5 ** (ageDays / halfLife)
      const salience = clampUnit(
        record.importance * record.confidence + Math.min(0.25, Math.log1p(record.accessCount) * 0.05),
        0.5,
      )
      const hybridSignal =
        maxHybridScore > 0 ? clampUnit(hit.combinedScore / maxHybridScore, 0) : 0
      const combined = 0.55 * hybridSignal + 0.25 * recency + 0.2 * salience

      scoredHits.push({
        memory: record,
        score: {
          combined,
          hybrid: hit.combinedScore,
          ftsRank: hit.ftsRank,
          vectorScore: hit.vectorScore,
          hopDistance: hit.hopDistance,
          recency,
          salience,
        },
      })
    }

    scoredHits.sort(
      (a, b) =>
        b.score.combined - a.score.combined ||
        b.memory.recordedAt.localeCompare(a.memory.recordedAt) ||
        a.memory.id.localeCompare(b.memory.id),
    )

    const sliced = scoredHits.slice(0, limit)
    if (input.reinforce !== false) {
      const accessIso = new Date(nowMs).toISOString()
      for (const hit of sliced) {
        const nextCount = hit.memory.accessCount + 1
        await this.deps.updateNodeUseCase.execute(hit.memory.id, {
          tableId: memoriesTableId,
          attributes: {
            access_count: String(nextCount),
            last_accessed_at: accessIso,
          },
        })
        hit.memory.accessCount = nextCount
        hit.memory.lastAccessedAt = accessIso
      }
    }

    return {
      hits: sliced,
      total: scoredHits.length,
      ...(input.namespace ? { namespace: input.namespace } : {}),
    }
  }

  async consolidate(input: ConsolidateInput): Promise<ConsolidateOutput> {
    if (!input.sourceMemoryIds || input.sourceMemoryIds.length === 0) {
      throw new ValidationException('sourceMemoryIds must be a non-empty array')
    }
    const { memoriesTableId } = await this.ensureInitialized()
    const markSuperseded = input.markSourcesAsSuperseded !== false

    const sourceRecords: MemoryRecord[] = []
    for (const srcId of input.sourceMemoryIds) {
      const rec = await this.loadMemoryRecord(srcId)
      if (!rec) {
        throw new NotFoundException(`Source memory '${srcId}' not found`)
      }
      sourceRecords.push(rec)
    }

    const firstSource = sourceRecords[0]
    const remembered = await this.remember({
      content: input.content,
      summary: input.summary,
      kind: input.kind ?? 'semantic',
      namespace: input.namespace ?? firstSource?.namespace ?? 'default',
      sessionId: firstSource?.sessionId ?? 'default',
      topicPath:
        input.topicPath ??
        (firstSource && firstSource.topicPath.length > 0 ? firstSource.topicPath : undefined),
      importance: input.importance ?? 0.9,
      confidence: input.confidence ?? 0.95,
      recordedAt: input.recordedAt,
      supersedesIds: markSuperseded ? input.sourceMemoryIds : undefined,
      links: markSuperseded
        ? undefined
        : input.sourceMemoryIds.map((targetMemoryId) => ({
            targetMemoryId,
            type: 'derivedFrom',
          })),
    })

    if (markSuperseded) {
      const derivedFromRtId = await this.getRelationTypeId('derivedFrom')
      for (const srcId of input.sourceMemoryIds) {
        await this.deps.createRelationUseCase.execute({
          tableId: memoriesTableId,
          sourceNodeId: remembered.memory.id,
          targetNodeId: srcId,
          relationTypeId: derivedFromRtId,
          strength: 4,
          confidence: 4,
        })
      }
    }

    return {
      memory: remembered.memory,
      derivedFromIds: [...input.sourceMemoryIds],
      supersededIds: remembered.supersededIds,
    }
  }

  async forget(
    memoryId: string,
    mode: 'archive' | 'delete' = 'archive',
  ): Promise<{ success: boolean; mode: 'archive' | 'delete'; memoryId: string }> {
    const { memoriesTableId } = await this.ensureInitialized()
    const existing = await this.deps.nodeRepository.findById(memoryId)
    if (!existing) {
      throw new NotFoundException(`Memory '${memoryId}' not found`)
    }
    if (mode === 'delete') {
      await this.deps.nodeEmbeddingRepository.deleteByNodeId(memoryId)
      await this.deps.nodeRepository.delete(memoryId)
    } else {
      await this.deps.updateNodeUseCase.execute(memoryId, {
        tableId: memoriesTableId,
        attributes: { status: 'archived' },
      })
    }
    return { success: true, mode, memoryId }
  }

  async pruneExpired(options: { now?: Date; mode?: 'archive' | 'delete' } = {}): Promise<{
    prunedCount: number
    prunedIds: string[]
  }> {
    const { memoriesTableId } = await this.ensureInitialized()
    const nowMs = (options.now ?? new Date()).getTime()
    const page = await this.deps.nodeRepository.findByTableId(memoriesTableId, {
      limit: 5000,
      offset: 0,
    })
    const nodes = page.data ?? page.nodes ?? []
    const prunedIds: string[] = []

    for (const node of nodes) {
      const rec = await this.loadMemoryRecord(String(node.getId()))
      if (!rec) continue
      if (rec.status === 'archived') continue
      if (!rec.expiresAt) continue
      const expMs = Date.parse(rec.expiresAt)
      if (Number.isFinite(expMs) && expMs <= nowMs) {
        await this.forget(rec.id, options.mode ?? 'archive')
        prunedIds.push(rec.id)
      }
    }

    return {
      prunedCount: prunedIds.length,
      prunedIds,
    }
  }

  async getContextWindow(input: ContextWindowInput = {}): Promise<ContextWindowOutput> {
    const maxTokens = Math.max(64, input.maxTokens ?? 1200)
    const charsPerToken = Math.max(1, input.charsPerToken ?? 4)
    const charBudget = maxTokens * charsPerToken

    const recalled = await this.recall({
      query: input.query,
      namespace: input.namespace,
      topicPath: input.topicPath,
      kinds: input.kinds,
      now: input.now,
      limit: input.limit ?? 30,
      reinforce: false,
    })

    const selected: RecalledMemoryHit[] = []
    const lines: string[] = []
    let usedChars = 0
    let truncated = false

    for (const hit of recalled.hits) {
      const m = hit.memory
      const topicLabel = m.topicPath.length > 0 ? m.topicPath.join('/') : 'general'
      const line = `- [${m.kind}] (${topicLabel}, imp=${m.importance.toFixed(2)}, score=${hit.score.combined.toFixed(3)}, id=${m.id}): ${m.content}`
      if (usedChars + line.length + 1 > charBudget) {
        truncated = true
        break
      }
      lines.push(line)
      selected.push(hit)
      usedChars += line.length + 1
    }

    const promptContext = lines.join('\n')
    return {
      promptContext,
      estimatedTokens: Math.ceil(promptContext.length / charsPerToken),
      memories: selected,
      truncated,
    }
  }

  async getTimeline(input: TimelineInput = {}): Promise<MemoryRecord[]> {
    const { memoriesTableId } = await this.ensureInitialized()
    const page = await this.deps.nodeRepository.findByTableId(memoriesTableId, {
      limit: 5000,
      offset: 0,
    })
    const nodes = page.data ?? page.nodes ?? []
    const records: MemoryRecord[] = []

    for (const node of nodes) {
      const rec = await this.loadMemoryRecord(String(node.getId()))
      if (!rec) continue
      if (input.namespace && rec.namespace !== input.namespace) continue
      if (input.sessionId && rec.sessionId !== input.sessionId) continue
      if (input.kind && rec.kind !== input.kind) continue
      if (!input.includeSuperseded && (rec.status === 'superseded' || rec.status === 'archived')) {
        continue
      }
      records.push(rec)
    }

    records.sort(
      (a, b) =>
        b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id),
    )
    return records.slice(0, input.limit ?? 50)
  }

  async getStats(namespace?: string): Promise<MemoryStatsOutput> {
    const { topicsTableId, memoriesTableId } = await this.ensureInitialized()
    const [memPage, topicCount] = await Promise.all([
      this.deps.nodeRepository.findByTableId(memoriesTableId, { limit: 10_000, offset: 0 }),
      this.deps.nodeRepository.countByTableId(topicsTableId),
    ])
    const nodes = memPage.data ?? memPage.nodes ?? []

    const byKind: Record<MemoryKind, number> = {
      working: 0,
      episodic: 0,
      semantic: 0,
      procedural: 0,
    }
    const byStatus: Record<MemoryStatus, number> = {
      active: 0,
      consolidated: 0,
      superseded: 0,
      archived: 0,
    }

    let total = 0
    let embeddedCount = 0
    for (const node of nodes) {
      const rec = await this.loadMemoryRecord(String(node.getId()))
      if (!rec) continue
      if (namespace && rec.namespace !== namespace) continue
      total += 1
      byKind[rec.kind] = (byKind[rec.kind] ?? 0) + 1
      byStatus[rec.status] = (byStatus[rec.status] ?? 0) + 1
      const emb = await this.deps.nodeEmbeddingRepository.findByNodeId(rec.id)
      if (emb) embeddedCount += 1
    }

    return {
      total,
      byKind,
      byStatus,
      embeddedCount,
      topicCount,
    }
  }

  async getTopicOutline(rootTopicPath?: string[]): Promise<IaOutlineResult> {
    await this.ensureInitialized()
    let rootNodeId: string | undefined
    if (rootTopicPath && rootTopicPath.length > 0) {
      const rootNode = await this.findTopicNodeByPath(rootTopicPath)
      if (!rootNode) {
        throw new NotFoundException(`AI memory topic '${rootTopicPath.join('/')}' not found`)
      }
      rootNodeId = String(rootNode.getId())
    }
    return await this.iaService.getOutline({
      tableIdentifier: AI_MEMORY_TOPICS_TABLE,
      relationType: 'parentOf',
      rootNodeId,
      countLinkedRelationTypes: ['belongsToTopic'],
    })
  }

  private async ensureTopicPath(segments: string[]): Promise<string> {
    const { topicsTableId } = await this.ensureInitialized()
    const parentOfId = await this.getRelationTypeId('parentOf')
    let parentId: string | undefined
    let currentFullPath = ''

    for (const segment of segments) {
      currentFullPath = currentFullPath ? `${currentFullPath}/${segment}` : segment
      let topicNode = await this.deps.nodeRepository.findByTableIdAndContent(
        topicsTableId,
        currentFullPath,
      )
      if (!topicNode) {
        const created = await this.deps.createNodeUseCase.execute({
          tableId: topicsTableId,
          content: currentFullPath,
          title: segment,
          attributes: {
            slug: segment,
            full_path: currentFullPath,
          },
        })
        topicNode = await this.deps.nodeRepository.findById(created.node.id)
      }
      if (!topicNode) {
        throw new Error(`Failed to persist AI memory topic '${currentFullPath}'`)
      }
      const topicId = String(topicNode.getId())
      if (parentId) {
        const { outgoing } = await this.deps.nodeRelationRepository.findByNodeId(parentId, {
          limit: 500,
          offset: 0,
        })
        const exists = outgoing.some(
          (r) =>
            String(r.getTargetNodeId()) === topicId &&
            String(r.getRelationTypeId()) === parentOfId,
        )
        if (!exists) {
          await this.deps.createRelationUseCase.execute({
            tableId: topicsTableId,
            sourceNodeId: parentId,
            targetNodeId: topicId,
            relationTypeId: parentOfId,
            strength: 4,
            confidence: 4,
          })
        }
      }
      parentId = topicId
    }

    if (!parentId) {
      throw new ValidationException('topicPath cannot be empty')
    }
    return parentId
  }

  private async findTopicNodeByPath(segments: string[]) {
    const clean = segments.map((s) => s.trim()).filter(Boolean)
    if (clean.length === 0) return null
    const { topicsTableId } = await this.ensureInitialized()
    return await this.deps.nodeRepository.findByTableIdAndContent(
      topicsTableId,
      clean.join('/'),
    )
  }

  private async getRelationTypeId(identifier: string): Promise<string> {
    const resolved = await resolveRelationTypeRefs(this.deps.relationTypeRepository, [identifier])
    const first = resolved?.ids[0]
    if (!first) {
      throw new NotFoundException(`Relation type '${identifier}' not found`)
    }
    return first
  }

  private async loadMemoryRecord(nodeId: string): Promise<MemoryRecord | null> {
    const node = await this.deps.nodeRepository.findById(nodeId)
    if (!node) return null
    const dto = await this.nodeEntityToDtoWithAttrs(nodeId)
    return this.dtoToMemoryRecord(dto)
  }

  private async nodeEntityToDtoWithAttrs(nodeId: string): Promise<NodeDto> {
    const node = await this.deps.nodeRepository.findById(nodeId)
    if (!node) {
      throw new NotFoundException(`Memory node '${nodeId}' not found`)
    }
    const [nodeAttrs, tableAttrs] = await Promise.all([
      this.deps.nodeAttributeRepository.findByNodeId(nodeId),
      this.deps.attributeRepository.findByTableId(node.getTableId(), {
        limit: 100,
        offset: 0,
      }),
    ])
    const identifierById = new Map<string, string>()
    for (const attr of tableAttrs.data ?? tableAttrs.nodes ?? []) {
      identifierById.set(String(attr.getId()), attr.getIdentifier())
    }
    const attributes: Record<string, unknown> = {}
    for (const na of nodeAttrs) {
      const ident = identifierById.get(String(na.getAttributeId()))
      if (ident) {
        attributes[ident] = na.getValue()
      }
    }
    return {
      id: String(node.getId()),
      tableId: String(node.getTableId()),
      content: node.getContent(),
      title: node.getTitle() ?? null,
      description: node.getDescription() ?? null,
      createdAt: node.getCreatedAt().toISOString(),
      updatedAt: node.getUpdatedAt().toISOString(),
      attributes,
    }
  }

  private dtoToMemoryRecord(dto: NodeDto): MemoryRecord {
    const attrs = (dto.attributes ?? {}) as Record<string, unknown>
    const kindRaw = String(attrs.memory_kind ?? 'episodic')
    const kind: MemoryKind =
      kindRaw === 'working' ||
      kindRaw === 'episodic' ||
      kindRaw === 'semantic' ||
      kindRaw === 'procedural'
        ? kindRaw
        : 'episodic'
    const statusRaw = String(attrs.status ?? 'active')
    const status: MemoryStatus =
      statusRaw === 'active' ||
      statusRaw === 'consolidated' ||
      statusRaw === 'superseded' ||
      statusRaw === 'archived'
        ? statusRaw
        : 'active'

    return {
      id: dto.id,
      tableId: dto.tableId,
      content: dto.content,
      summary: dto.description ?? dto.title ?? null,
      kind,
      namespace: String(attrs.namespace ?? 'default'),
      sessionId: String(attrs.session_id ?? 'default'),
      importance: clampUnit(Number(attrs.importance ?? 0.6), 0.6),
      confidence: clampUnit(Number(attrs.confidence ?? 0.9), 0.9),
      halfLifeDays: Math.max(0.01, Number(attrs.half_life_days ?? DEFAULT_HALF_LIFE_DAYS[kind])),
      accessCount: Math.max(0, Math.trunc(Number(attrs.access_count ?? 1))),
      lastAccessedAt: String(attrs.last_accessed_at ?? dto.updatedAt),
      recordedAt: String(attrs.recorded_at ?? dto.createdAt),
      expiresAt: String(attrs.expires_at ?? ''),
      status,
      tags: parseJsonStringArray(attrs.tags),
      sourceRef: String(attrs.source_ref ?? ''),
      topicPath: parseJsonStringArray(attrs.topic_path),
    }
  }
}
