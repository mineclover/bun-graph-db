import type { ILogger } from '@/application/ports/ILogger.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { TabularSyncService } from '@/infrastructure/excel/sync/TabularSyncService.js'
import type {
  ExcelProjectableAttribute,
} from '@/infrastructure/excel/ExcelSchemaProjector.js'
import type { ExcelProjectableNode } from '@/infrastructure/excel/ExcelRowProjector.js'

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
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly syncService: TabularSyncService,
    private readonly logger: ILogger = createNoopLogger(),
  ) {}

  async previewByIdentifier(tableIdentifier: string) {
    const input = await this.buildSyncInput(tableIdentifier)
    return await this.syncService.preview(input)
  }

  async syncByIdentifier(tableIdentifier: string) {
    const input = await this.buildSyncInput(tableIdentifier)
    return await this.syncService.sync(input)
  }

  async clearByIdentifier(tableIdentifier: string) {
    return await this.syncService.sync({
      tableIdentifier,
      attributes: [],
      nodes: [],
    })
  }

  async buildSyncInput(tableIdentifier: string) {
    const table = await this.tableRepository.findByIdentifier(tableIdentifier)
    if (!table) {
      throw new Error(`Table '${tableIdentifier}' not found.`)
    }

    const attributesResult = await this.attributeRepository.findByTableId(table.id, {
      limit: 1000,
      offset: 0,
    })
    const attributes = attributesResult.data || []

    const projectedAttributes: ExcelProjectableAttribute[] = await Promise.all(
      attributes.map(async (attribute) => {
        const attributeType = await this.attributeRepository.getAttributeTypeForAttribute(
          attribute.getId(),
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
      }),
    )

    const nodesResult = await this.nodeRepository.findByTableId(table.id, {
      limit: 100000,
      offset: 0,
    })
    const nodes = nodesResult.data || []
    const attributeIdentifierById = new Map(
      attributes.map((attribute) => [attribute.getId(), attribute.getIdentifier()]),
    )

    const projectedNodes: ExcelProjectableNode[] = await Promise.all(
      nodes.map(async (node) => {
        const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(
          node.getId(),
        )
        const projectedAttributeMap = Object.fromEntries(
          nodeAttributes.map((nodeAttribute) => [
            attributeIdentifierById.get(nodeAttribute.getAttributeId()) ||
              nodeAttribute.getAttributeId(),
            nodeAttribute.getParsedValue(),
          ]),
        )

        return {
          id: String(node.getId()),
          title: node.getTitle(),
          content: node.getContent(),
          description: node.getDescription(),
          createdAt: node.getCreatedAt().toISOString(),
          updatedAt: node.getUpdatedAt().toISOString(),
          attributes: projectedAttributeMap,
        }
      }),
    )

    this.logger.info('Prepared tabular sync payload', {
      tableIdentifier,
      attributeCount: projectedAttributes.length,
      nodeCount: projectedNodes.length,
    })

    return {
      tableId: String(table.id),
      tableIdentifier: table.identifier,
      description: table.description || undefined,
      attributes: projectedAttributes,
      nodes: projectedNodes,
    }
  }
}
