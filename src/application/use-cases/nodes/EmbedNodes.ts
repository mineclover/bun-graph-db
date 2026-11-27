import type { ILogger } from '@/application/ports/ILogger.js'
import type { EmbeddingTaskType, IEmbeddingProvider } from '@/domain/ports/IEmbeddingProvider.js'
import type { Node } from '@/domain/entities/Node.js'
import {
  resolveEmbeddingColumnExecutionOptions,
  resolveTableColumnSchema,
} from '@/domain/value-objects/ColumnConfig.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type {
  INodeEmbeddingRepository,
  NodeEmbeddingRecord,
} from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface EmbedNodeOptions {
  attributeIdentifiers?: string[]
  includeTitle?: boolean
  includeContent?: boolean
  task?: EmbeddingTaskType
  model?: string
}

export interface EmbedTableNodesOptions {
  onlyMissing?: boolean
  batchSize?: number
  attributeIdentifiers?: string[]
  includeTitle?: boolean
  includeContent?: boolean
  task?: EmbeddingTaskType
  model?: string
}

export interface EmbedTableNodesResult {
  tableId: string
  model: string
  dimension: number
  processed: number
  embeddedCount: number
  skippedCount: number
  nodeIds: string[]
}

export class EmbedNodesUseCase {
  constructor(
    private readonly provider: IEmbeddingProvider,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeEmbeddingRepository: INodeEmbeddingRepository,
    private readonly attributeRepository?: IAttributeRepository,
    private readonly nodeAttributeRepository?: INodeAttributeRepository,
    private readonly logger?: ILogger,
  ) {}

  async embedText(
    text: string,
    task: EmbeddingTaskType = 'retrieval_query',
    title?: string | null,
  ) {
    return await this.provider.embed({ text, task, title })
  }

  async embedNode(
    nodeId: string,
    options: EmbedNodeOptions = {},
  ): Promise<NodeEmbeddingRecord> {
    const node = await this.nodeRepository.findById(nodeId)
    if (!node) {
      throw new NotFoundException(`Node with id '${nodeId}' not found`)
    }
    const text = await this.buildDocumentText(node, options)
    const result = await this.provider.embed({
      text,
      title: options.includeTitle === false ? null : node.getTitle(),
      task: options.task ?? 'retrieval_document',
    })
    return await this.nodeEmbeddingRepository.upsert({
      nodeId: String(node.getId()),
      tableId: String(node.getTableId()),
      vector: result.vector,
      model: options.model ?? result.model,
    })
  }

  async embedTableNodes(
    tableId: string,
    options: EmbedTableNodesOptions = {},
  ): Promise<EmbedTableNodesResult> {
    if (!tableId.trim()) {
      throw new ValidationException('tableId is required')
    }
    const batchSize = Math.max(1, options.batchSize ?? 32)
    const page = await this.nodeRepository.findByTableId(tableId, { limit: 10_000, offset: 0 })
    const allNodes = page.data ?? page.nodes ?? []

    const targetNodes: Node[] = []
    let skippedCount = 0
    for (const node of allNodes) {
      if (options.onlyMissing) {
        const existing = await this.nodeEmbeddingRepository.findByNodeId(String(node.getId()))
        if (existing) {
          skippedCount += 1
          continue
        }
      }
      targetNodes.push(node)
    }

    const embeddedNodeIds: string[] = []
    const modelId = options.model ?? this.provider.modelId

    const batchTask: EmbeddingTaskType = options.task ?? 'retrieval_document'
    const includeTitle = options.includeTitle !== false

    for (let i = 0; i < targetNodes.length; i += batchSize) {
      const slice = targetNodes.slice(i, i + batchSize)
      const inputs = await Promise.all(
        slice.map(async (node) => ({
          text: await this.buildDocumentText(node, options),
          title: includeTitle ? node.getTitle() : null,
          task: batchTask,
        })),
      )
      const embeddings = await this.provider.embedBatch(inputs)
      for (let j = 0; j < slice.length; j += 1) {
        const node = slice[j]
        const embedding = embeddings[j]
        if (!node || !embedding) continue
        await this.nodeEmbeddingRepository.upsert({
          nodeId: String(node.getId()),
          tableId: String(node.getTableId()),
          vector: embedding.vector,
          model: options.model ?? embedding.model,
        })
        embeddedNodeIds.push(String(node.getId()))
      }
    }

    this.logger?.info('Embedded table nodes', {
      tableId,
      model: modelId,
      embeddedCount: embeddedNodeIds.length,
      skippedCount,
    })

    return {
      tableId,
      model: modelId,
      dimension: this.provider.dimension,
      processed: allNodes.length,
      embeddedCount: embeddedNodeIds.length,
      skippedCount,
      nodeIds: embeddedNodeIds,
    }
  }

  async embedTableByColumnConfig(
    tableId: string,
    options: Omit<
      EmbedTableNodesOptions,
      'attributeIdentifiers' | 'includeTitle' | 'includeContent' | 'task'
    > = {},
  ): Promise<EmbedTableNodesResult & { enabledColumns: string[]; skippedReason?: string }> {
    if (!tableId.trim()) {
      throw new ValidationException('tableId is required')
    }
    if (!this.attributeRepository) {
      throw new ValidationException('attributeRepository is required for column-configured embedding')
    }

    const attrsPage = await this.attributeRepository.findByTableId(tableId, {
      limit: 500,
      offset: 0,
    })
    const attrs = attrsPage.data ?? attrsPage.nodes ?? []
    const profile = resolveTableColumnSchema(tableId, attrs)

    const resolved = resolveEmbeddingColumnExecutionOptions(profile, options.model)
    if (!resolved) {
      return {
        tableId,
        model: options.model ?? this.provider.modelId,
        dimension: this.provider.dimension,
        processed: 0,
        embeddedCount: 0,
        skippedCount: 0,
        nodeIds: [],
        enabledColumns: [],
        skippedReason: 'No column has embedding.enabled=true',
      }
    }

    const res = await this.embedTableNodes(tableId, {
      ...options,
      attributeIdentifiers: resolved.attributeIdentifiers,
      includeTitle: resolved.includeTitle,
      includeContent: resolved.includeContent,
      task: resolved.task,
      model: resolved.model,
    })

    return {
      ...res,
      enabledColumns: resolved.enabledColumns,
    }
  }

  private async buildDocumentText(
    node: Node,
    options: {
      attributeIdentifiers?: string[]
      includeContent?: boolean
    } = {},
  ): Promise<string> {
    const parts: string[] = []
    if (options.includeContent !== false) {
      parts.push(node.getContent())
      const desc = node.getDescription()
      if (desc && desc.trim().length > 0) {
        parts.push(desc.trim())
      }
    }

    const attributeIdentifiers = options.attributeIdentifiers

    if (
      attributeIdentifiers &&
      attributeIdentifiers.length > 0 &&
      this.nodeAttributeRepository &&
      this.attributeRepository
    ) {
      const attrs = await this.nodeAttributeRepository.findByNodeId(node.getId())
      if (attrs.length > 0) {
        const tableAttrs = await this.attributeRepository.findByTableId(node.getTableId(), {
          limit: 500,
          offset: 0,
        })
        const identifierById = new Map<string, string>()
        for (const attr of tableAttrs.data ?? tableAttrs.nodes ?? []) {
          identifierById.set(String(attr.getId()), attr.getIdentifier())
        }
        const wanted = new Set(attributeIdentifiers)
        for (const na of attrs) {
          const ident = identifierById.get(String(na.getAttributeId()))
          const val = na.getValue()
          if (ident && wanted.has(ident) && val !== null && val !== undefined) {
            parts.push(`${ident}: ${typeof val === 'string' ? val : JSON.stringify(val)}`)
          }
        }
      }
    }

    return parts.join('\n')
  }
}
