import type { ILogger } from '@/application/ports/ILogger.js'
import type { PaginatedResult } from '@/core/types/CommonTypes.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type {
  IncrementalTabularSyncInput,
  TabularSyncService,
} from '@/infrastructure/excel/sync/TabularSyncService.js'
import type {
  ExcelProjectableAttribute,
} from '@/infrastructure/excel/ExcelSchemaProjector.js'
import type { ExcelProjectableNode } from '@/infrastructure/excel/ExcelRowProjector.js'

const ATTRIBUTE_PAGE_SIZE = 500
const ATTRIBUTE_TYPE_BATCH_SIZE = 500
const NODE_PAGE_SIZE = 500
const NODE_ATTRIBUTE_BATCH_SIZE = 500

interface PageCollection<T> {
  items: T[]
  pages: number
}

interface SyncInputContext {
  tableId: string
  tableIdentifier: string
  description?: string
  attributes: ExcelProjectableAttribute[]
  attributeIdentifierById: Map<string, string>
  attributePages: number
  attributeTypeBatches: number
}

function createNoopLogger(): ILogger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
}

export class TabularTableSyncBridge {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly syncService: TabularSyncService,
    private readonly logger: ILogger = createNoopLogger(),
  ) {}

  supportsIdentifier(tableIdentifier: string): boolean {
    return this.syncService.supportsIdentifier(tableIdentifier)
  }

  async previewByIdentifier(tableIdentifier: string) {
    if (!this.supportsIdentifier(tableIdentifier)) {
      return null
    }
    const input = await this.buildSyncInput(tableIdentifier)
    return await this.syncService.preview(input)
  }

  async syncByIdentifier(tableIdentifier: string) {
    if (!this.supportsIdentifier(tableIdentifier)) {
      return await this.syncService.sync({
        tableIdentifier,
        attributes: [],
        nodes: [],
      })
    }
    const input = await this.buildSyncInput(tableIdentifier)
    return await this.syncService.sync(input)
  }

  /**
   * Attempts a dirty-node patch from the last successful in-process snapshot.
   * A cold process, schema change, or non-patch-capable destination returns to
   * the full snapshot path before performing any remote write.
   */
  async syncDirtyByIdentifier(
    tableIdentifier: string,
    dirtyNodeIds: readonly string[],
    revision?: number,
  ) {
    if (!this.supportsIdentifier(tableIdentifier)) {
      return await this.syncService.sync({
        tableIdentifier,
        attributes: [],
        nodes: [],
      })
    }
    const uniqueDirtyNodeIds = [...new Set(dirtyNodeIds.filter(Boolean))]
    if (uniqueDirtyNodeIds.length === 0) {
      return await this.syncByIdentifier(tableIdentifier)
    }

    const startedAt = performance.now()
    const context = await this.buildSyncInputContext(tableIdentifier)
    const foundNodes = await this.loadNodesByIds(uniqueDirtyNodeIds)
    const dirtyNodes = foundNodes.filter(
      (node) => String(node.getTableId()) === context.tableId,
    )
    const nodeAttributes = await this.loadNodeAttributes(
      dirtyNodes.map((node) => String(node.getId())),
    )
    const projectedNodes = this.projectNodes(
      dirtyNodes,
      nodeAttributes,
      context.attributeIdentifierById,
    )
    const incrementalInput: IncrementalTabularSyncInput = {
      tableId: context.tableId,
      tableIdentifier: context.tableIdentifier,
      description: context.description,
      attributes: context.attributes,
      nodes: projectedNodes,
      dirtyNodeIds: uniqueDirtyNodeIds,
      revision,
    }
    const incrementalResult = await this.syncService.syncIncremental(
      incrementalInput,
    )

    if (incrementalResult) {
      this.logger.info('Prepared incremental tabular sync payload', {
        tableIdentifier,
        revision,
        dirtyNodeCount: uniqueDirtyNodeIds.length,
        projectedNodeCount: projectedNodes.length,
        attributePages: context.attributePages,
        attributeTypeBatches: context.attributeTypeBatches,
        nodeAttributeBatches: Math.ceil(
          dirtyNodes.length / NODE_ATTRIBUTE_BATCH_SIZE,
        ),
        preparationMs: Math.round(performance.now() - startedAt),
      })
      return incrementalResult
    }

    this.logger.debug('Incremental tabular sync unavailable; using full snapshot', {
      tableIdentifier,
      revision,
      dirtyNodeCount: uniqueDirtyNodeIds.length,
    })
    return await this.syncByIdentifier(tableIdentifier)
  }

  async clearByIdentifier(tableIdentifier: string) {
    return await this.syncService.sync({
      tableIdentifier,
      attributes: [],
      nodes: [],
    })
  }

  async buildSyncInput(tableIdentifier: string) {
    const startedAt = performance.now()
    const context = await this.buildSyncInputContext(tableIdentifier)
    const nodeCollection = await collectAllPages(
      (offset, limit) =>
        this.nodeRepository.findByTableId(context.tableId, { limit, offset }),
      NODE_PAGE_SIZE,
      (node) => String(node.getId()),
    )
    const nodeAttributes = await this.loadNodeAttributes(
      nodeCollection.items.map((node) => String(node.getId())),
    )
    const projectedNodes = this.projectNodes(
      nodeCollection.items,
      nodeAttributes,
      context.attributeIdentifierById,
    )
    const nodeAttributeBatches = Math.ceil(
      nodeCollection.items.length / NODE_ATTRIBUTE_BATCH_SIZE,
    )

    this.logger.info('Prepared tabular sync payload', {
      tableIdentifier,
      attributeCount: context.attributes.length,
      nodeCount: projectedNodes.length,
      attributePages: context.attributePages,
      attributeTypeBatches: context.attributeTypeBatches,
      nodePages: nodeCollection.pages,
      nodeAttributeBatches,
      preparationMs: Math.round(performance.now() - startedAt),
    })

    return {
      tableId: context.tableId,
      tableIdentifier: context.tableIdentifier,
      description: context.description,
      attributes: context.attributes,
      nodes: projectedNodes,
    }
  }

  private async buildSyncInputContext(
    tableIdentifier: string,
  ): Promise<SyncInputContext> {
    const table = await this.tableRepository.findByIdentifier(tableIdentifier)
    if (!table) {
      throw new Error(`Table '${tableIdentifier}' not found.`)
    }

    const attributeCollection = await collectAllPages(
      (offset, limit) =>
        this.attributeRepository.findByTableId(table.id, { limit, offset }),
      ATTRIBUTE_PAGE_SIZE,
      (attribute) => String(attribute.getId()),
    )
    const attributeTypeIds = [
      ...new Set(
        attributeCollection.items.map((attribute) =>
          attribute.getAttributeTypeId(),
        ),
      ),
    ]
    const attributeTypes: AttributeType[] = []
    for (
      let offset = 0;
      offset < attributeTypeIds.length;
      offset += ATTRIBUTE_TYPE_BATCH_SIZE
    ) {
      attributeTypes.push(
        ...(await this.attributeTypeRepository.findByIds(
          attributeTypeIds.slice(offset, offset + ATTRIBUTE_TYPE_BATCH_SIZE),
        )),
      )
    }
    const attributeTypeById = new Map(
      attributeTypes.map((attributeType) => [
        String(attributeType.getId()),
        attributeType,
      ]),
    )
    const projectedAttributes: ExcelProjectableAttribute[] =
      attributeCollection.items.map((attribute) => {
        const attributeType = attributeTypeById.get(
          String(attribute.getAttributeTypeId()),
        )
        const metadata = attribute.getParsedMetadata() as
          | { searchable?: boolean }
          | null

        return {
          identifier: attribute.getIdentifier(),
          dataType:
            attributeType?.getIdentifier() ||
            attributeType?.getJsonType() ||
            'string',
          required: attribute.getIsRequired(),
          searchable: metadata?.searchable === true,
        }
      })

    return {
      tableId: String(table.id),
      tableIdentifier: table.identifier,
      description: table.description || undefined,
      attributes: projectedAttributes,
      attributeIdentifierById: new Map(
        attributeCollection.items.map((attribute) => [
          String(attribute.getId()),
          attribute.getIdentifier(),
        ]),
      ),
      attributePages: attributeCollection.pages,
      attributeTypeBatches: Math.ceil(
        attributeTypeIds.length / ATTRIBUTE_TYPE_BATCH_SIZE,
      ),
    }
  }

  private async loadNodeAttributes(
    nodeIds: readonly string[],
  ): Promise<NodeAttribute[]> {
    const nodeAttributes: NodeAttribute[] = []
    for (let offset = 0; offset < nodeIds.length; offset += NODE_ATTRIBUTE_BATCH_SIZE) {
      const batch = nodeIds.slice(offset, offset + NODE_ATTRIBUTE_BATCH_SIZE)
      nodeAttributes.push(
        ...(await this.nodeAttributeRepository.findByNodeIds(batch)),
      )
    }
    return nodeAttributes.flat()
  }

  private async loadNodesByIds(nodeIds: readonly string[]): Promise<Node[]> {
    const nodes: Node[] = []
    for (let offset = 0; offset < nodeIds.length; offset += NODE_PAGE_SIZE) {
      nodes.push(
        ...(await this.nodeRepository.findByIds(
          nodeIds.slice(offset, offset + NODE_PAGE_SIZE),
        )),
      )
    }
    return nodes
  }

  private projectNodes(
    nodes: readonly Node[],
    nodeAttributes: readonly NodeAttribute[],
    attributeIdentifierById: ReadonlyMap<string, string>,
  ): ExcelProjectableNode[] {
    const attributesByNodeId = new Map<string, NodeAttribute[]>()
    for (const nodeAttribute of nodeAttributes) {
      const nodeId = String(nodeAttribute.getNodeId())
      const existing = attributesByNodeId.get(nodeId) ?? []
      existing.push(nodeAttribute)
      attributesByNodeId.set(nodeId, existing)
    }

    return nodes.map((node) => ({
      id: String(node.getId()),
      title: node.getTitle(),
      content: node.getContent(),
      description: node.getDescription(),
      createdAt: node.getCreatedAt().toISOString(),
      updatedAt: node.getUpdatedAt().toISOString(),
      attributes: Object.fromEntries(
        (attributesByNodeId.get(String(node.getId())) ?? []).map(
          (nodeAttribute) => [
            attributeIdentifierById.get(
              String(nodeAttribute.getAttributeId()),
            ) || String(nodeAttribute.getAttributeId()),
            nodeAttribute.getParsedValue(),
          ],
        ),
      ),
    }))
  }
}

async function collectAllPages<T>(
  loadPage: (offset: number, limit: number) => Promise<PaginatedResult<T>>,
  pageSize: number,
  getKey: (item: T) => string,
): Promise<PageCollection<T>> {
  const itemsByKey = new Map<string, T>()
  let offset = 0
  let pages = 0

  while (true) {
    const result = await loadPage(offset, pageSize)
    const page = result.data ?? result.nodes ?? result.items ?? []
    pages++

    if (page.length === 0) {
      return { items: [...itemsByKey.values()], pages }
    }

    const uniqueCountBeforePage = itemsByKey.size
    for (const item of page) {
      itemsByKey.set(getKey(item), item)
    }
    if (itemsByKey.size === uniqueCountBeforePage) {
      throw new Error(
        `Repository pagination made no unique progress at offset ${offset}.`,
      )
    }
    offset += page.length

    const hasMore = result.hasMore ?? result.hasNextPage
    const total = result.total ?? result.totalCount
    if (hasMore === false) {
      return { items: [...itemsByKey.values()], pages }
    }
    if (hasMore !== true && Number.isFinite(total) && offset >= total) {
      return { items: [...itemsByKey.values()], pages }
    }
    if (hasMore === undefined && !Number.isFinite(total) && page.length < pageSize) {
      return { items: [...itemsByKey.values()], pages }
    }
  }
}
