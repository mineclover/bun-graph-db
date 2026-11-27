import { TableSchemaLifecycleAspect } from '@/application/aspects/TableSchemaLifecycleAspect.js'
import type { HttpControllerRequest as Request, HttpControllerResponse as Response } from '../adapters/BunControllerAdapter.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  type ColumnConfig,
  extractColumnConfig,
  mergeColumnConfigIntoMetadata,
  resolveTableColumnSchema,
} from '@/domain/value-objects/ColumnConfig.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'
import type {
  AttributeData,
  NodeAttributeData,
  TableAttributesData,
} from '../types/ApiResponseTypes.js'
import {
  sendError,
  sendHandleError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from '../utils/responseHelpers.js'

type AttributeBodyRequest<TBody> = Request<Record<string, string>, TBody>
type AttributeRequest<TParams extends object, TBody = unknown> = Request<TParams, TBody>

interface SetNodeAttributeBody {
  input?: {
    nodeId?: string
    attributeId?: string
    value?: SafeJsonValue
  }
}

interface CreateAttributeBody {
  tableId?: string
  identifier?: string
  name?: string
  attributeTypeId?: string
  description?: string
  isRequired?: boolean
  metadata?: object | null
  options?: ColumnConfig
  columnConfig?: ColumnConfig
}

interface UpdateAttributeParams {
  attributeId?: string
}

interface UpdateAttributeBody {
  description?: string | null
  isRequired?: boolean
  metadata?: object | null
  options?: ColumnConfig
  columnConfig?: ColumnConfig
}

interface TableParams {
  tableId?: string
}

interface ConfigureTableColumnParams {
  tableId?: string
  attributeIdentifier?: string
}

interface ConfigureTableColumnBody {
  config?: ColumnConfig
}

interface NodeParams {
  nodeId?: string
}

interface RemoveNodeAttributeBody {
  nodeId?: string
  attributeId?: string
}

interface UpdateNodeAttributeValueBody {
  nodeId?: string
  attributeId?: string
  value?: string
}

export class AttributeApiController {
  private readonly lifecycle: TableSchemaLifecycleAspect

  constructor(
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    readonly logger: ILogger,
    private readonly queryTemplateRepository?: IQueryTemplateRepository,
    private readonly schemaGate?: NodeAttributeSchemaGate,
    private readonly tableRepository?: ITableRepository,
    schemaLifecycle?: TableSchemaLifecycleAspect,
  ) {
    this.lifecycle =
      schemaLifecycle ??
      new TableSchemaLifecycleAspect({
        logger: this.logger,
        attributeRepository: this.attributeRepository,
        queryTemplateRepository: this.queryTemplateRepository,
      })
  }

  private handleSchemaScopedError(res: Response, error: unknown, operation: string): void {
    if (error instanceof ValidationException) {
      sendValidationError(res, error.message)
      return
    }
    if (error instanceof NotFoundException) {
      sendNotFound(res, error.message)
      return
    }
    sendHandleError(res, this.logger, error, operation)
  }

  async setNodeAttribute(
    req: AttributeBodyRequest<SetNodeAttributeBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { input } = req.body

      if (!input?.nodeId || !input.attributeId || input.value === undefined) {
        sendValidationError(res, 'input with nodeId, attributeId, and value is required')
        return
      }

      const { nodeId, attributeId, value } = input
      let resolvedAttributeId = attributeId as AttributeId
      let serializedOrRawValue: SafeJsonValue = value

      if (this.schemaGate) {
        const { normalized } = await this.schemaGate.validateAndNormalizePatch(nodeId, [
          { attributeIdOrIdentifier: attributeId, value },
        ])
        const target = normalized[0]
        if (target) {
          resolvedAttributeId = target.attributeId
          serializedOrRawValue = target.canonicalValue
        }
      }

      // Use repository to set node attribute
      const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
        nodeId as NodeId,
        resolvedAttributeId,
        serializedOrRawValue,
      )

      const result: NodeAttributeData = {
        nodeId: nodeAttribute.getNodeId(),
        attributeId: nodeAttribute.getAttributeId(),
        value: nodeAttribute.getValue(),
        success: true,
      }

      sendSuccess(res, result)
    } catch (error) {
      this.handleSchemaScopedError(res, error, 'Set node attribute')
    }
  }

  async createAttribute(
    req: AttributeBodyRequest<CreateAttributeBody>,
    res: Response,
  ): Promise<void> {
    try {
      const {
        tableId,
        identifier,
        name,
        attributeTypeId = '1',
        description,
        isRequired = false,
        metadata,
        options,
        columnConfig,
      } = req.body

      if (!tableId || !identifier) {
        sendValidationError(res, 'tableId and identifier are required')
        return
      }

      const columnCfg = options ?? columnConfig
      const effectiveMetadata =
        columnCfg !== undefined
          ? mergeColumnConfigIntoMetadata(metadata, columnCfg)
          : (metadata ?? undefined)

      // Use CreateAttributeUseCase to create attribute (omit undefined optional fields to keep DTO calls clean)
      const createResult = await this.createAttributeUseCase.execute({
        tableId: tableId as TableId,
        identifier,
        ...(name !== undefined ? { name } : {}),
        attributeTypeId: attributeTypeId as AttributeId,
        description,
        isRequired,
        metadata: effectiveMetadata,
      })

      const createdAttr = createResult.attribute
      const result: AttributeData = {
        id: createdAttr.id,
        tableId: createdAttr.tableId,
        identifier: createdAttr.identifier,
        name: createdAttr.name,
        attributeTypeId: createdAttr.attributeTypeId,
        ...(createdAttr.description !== undefined ? { description: createdAttr.description } : {}),
        ...(createdAttr.isRequired !== undefined ? { isRequired: Boolean(createdAttr.isRequired) } : {}),
        ...(createdAttr.metadata !== undefined
          ? {
              metadata: createdAttr.metadata,
              columnConfig: extractColumnConfig(createdAttr.metadata) ?? null,
            }
          : {}),
      }

      await this.lifecycle.onTableSchemaChanged(createdAttr.tableId, 'createAttribute', {
        markTemplatesStale: false,
      })

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create attribute')
    }
  }

  async updateAttribute(
    req: AttributeRequest<UpdateAttributeParams, UpdateAttributeBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { attributeId } = req.params
      const { description, isRequired, metadata, options, columnConfig } = req.body

      if (!attributeId) {
        sendValidationError(res, 'attributeId is required')
        return
      }

      // Use attribute repository to update attribute
      const attribute = await this.attributeRepository.findById(
        attributeId as AttributeId,
      )
      if (!attribute) {
        sendNotFound(res, `Attribute with id ${attributeId}`)
        return
      }

      let updatedAttribute = attribute

      // Update attribute properties using available methods
      if (description !== undefined) {
        updatedAttribute = updatedAttribute.updateDescription(description)
      }

      if (isRequired !== undefined) {
        updatedAttribute = updatedAttribute.updateRequiredStatus(isRequired)
      }

      const columnCfg = options ?? columnConfig
      if (columnCfg !== undefined) {
        const baseMeta = metadata !== undefined ? metadata : updatedAttribute.getParsedMetadata()
        const merged = mergeColumnConfigIntoMetadata(baseMeta, columnCfg)
        updatedAttribute = updatedAttribute.updateMetadata(merged ? JSON.stringify(merged) : null)
      } else if (metadata !== undefined) {
        const metadataString = metadata ? JSON.stringify(metadata) : null
        updatedAttribute = updatedAttribute.updateMetadata(metadataString)
      }

      await this.attributeRepository.save(updatedAttribute)

      const parsedMeta = updatedAttribute.getParsedMetadata()
      const result = {
        id: updatedAttribute.getId(),
        identifier: updatedAttribute.getIdentifier(),
        name: updatedAttribute.getName(),
        description: updatedAttribute.getDescription(),
        isRequired: Boolean(updatedAttribute.getIsRequired()),
        metadata: parsedMeta,
        columnConfig: extractColumnConfig(parsedMeta) ?? null,
      }

      await this.lifecycle.onTableSchemaChanged(attribute.getTableId(), 'updateAttribute')

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Update attribute')
    }
  }

  async deleteAttribute(
    req: AttributeRequest<UpdateAttributeParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { attributeId } = req.params

      if (!attributeId) {
        sendValidationError(res, 'attributeId is required')
        return
      }

      // Use attribute repository to delete attribute
      const attribute = await this.attributeRepository.findById(
        attributeId as AttributeId,
      )
      if (!attribute) {
        sendNotFound(res, `Attribute with id ${attributeId}`)
        return
      }

      await this.attributeRepository.delete(attributeId)

      const result = {
        id: attributeId,
        deleted: true,
      }

      await this.lifecycle.onTableSchemaChanged(attribute.getTableId(), 'deleteAttribute')

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Delete attribute')
    }
  }

  private async resolveTableRef(
    tableIdOrIdentifier: string,
  ): Promise<{ id: TableId; identifier?: string }> {
    if (!this.tableRepository) {
      return { id: tableIdOrIdentifier as TableId }
    }
    const table =
      (await this.tableRepository.findById(tableIdOrIdentifier as TableId)) ??
      (await this.tableRepository.findByIdentifier(tableIdOrIdentifier))
    if (!table) {
      throw new NotFoundException(`Table '${tableIdOrIdentifier}' not found`)
    }
    return { id: table.id, identifier: table.identifier }
  }

  async getTableAttributes(
    req: AttributeRequest<TableParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { tableId } = req.params

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      const resolved = await this.resolveTableRef(tableId)

      // Use attribute repository to get table attributes
      const attributesResult = await this.attributeRepository.findByTableId(
        resolved.id,
        { limit: 500, offset: 0 },
      )
      const attributes = attributesResult.data ?? attributesResult.nodes ?? []

      const result: TableAttributesData = {
        tableId: String(resolved.id),
        attributes: attributes.map((attr) => {
          const parsedMetadata = attr.getParsedMetadata()
          return {
            id: attr.getId(),
            identifier: attr.getIdentifier(),
            name: attr.getName() || attr.getIdentifier(),
            attributeTypeId: attr.getAttributeTypeId(),
            tableId: attr.getTableId(),
            description: attr.getDescription(),
            isRequired: Boolean(attr.getIsRequired()),
            metadata: parsedMetadata,
            columnConfig: extractColumnConfig(parsedMetadata) ?? null,
          }
        }),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table attributes')
    }
  }

  async getTableColumns(
    req: AttributeRequest<TableParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { tableId } = req.params
      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      const resolved = await this.resolveTableRef(tableId)
      const attributesResult = await this.attributeRepository.findByTableId(
        resolved.id,
        { limit: 500, offset: 0 },
      )
      const attributes = attributesResult.data ?? attributesResult.nodes ?? []
      const profile = resolveTableColumnSchema(
        String(resolved.id),
        attributes,
        resolved.identifier,
      )
      sendSuccess(res, profile)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table columns')
    }
  }

  async configureTableColumn(
    req: AttributeRequest<ConfigureTableColumnParams, ConfigureTableColumnBody | ColumnConfig>,
    res: Response,
  ): Promise<void> {
    try {
      const { tableId, attributeIdentifier } = req.params
      if (!tableId || !attributeIdentifier) {
        sendValidationError(res, 'tableId and attributeIdentifier are required')
        return
      }

      const bodyObj = req.body as Record<string, unknown> | undefined
      const rawConfig =
        bodyObj && typeof bodyObj === 'object' && !Array.isArray(bodyObj) && 'config' in bodyObj
          ? bodyObj.config
          : req.body

      if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
        sendValidationError(res, 'Column config object is required')
        return
      }

      const resolved = await this.resolveTableRef(tableId)
      let attribute = await this.attributeRepository.findByTableIdAndIdentifier(
        resolved.id,
        attributeIdentifier,
      )
      if (!attribute) {
        const byId = await this.attributeRepository.findById(attributeIdentifier as AttributeId)
        if (byId && String(byId.getTableId()) === String(resolved.id)) {
          attribute = byId
        }
      }
      if (!attribute) {
        sendNotFound(res, `Attribute '${attributeIdentifier}' in table '${tableId}'`)
        return
      }

      const merged = mergeColumnConfigIntoMetadata(
        attribute.getParsedMetadata(),
        rawConfig as ColumnConfig,
      )
      const updated = attribute.updateMetadata(merged ? JSON.stringify(merged) : null)
      await this.attributeRepository.save(updated)

      await this.lifecycle.onTableSchemaChanged(String(resolved.id), 'configureTableColumn')

      sendSuccess(res, {
        tableId: String(resolved.id),
        column: {
          id: updated.getId(),
          identifier: updated.getIdentifier(),
          name: updated.getName(),
          description: updated.getDescription(),
          attributeTypeId: updated.getAttributeTypeId(),
          isRequired: Boolean(updated.getIsRequired()),
          config: extractColumnConfig(updated.getParsedMetadata()) ?? {},
        },
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Configure table column')
    }
  }

  async removeNodeAttribute(
    req: AttributeBodyRequest<RemoveNodeAttributeBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { nodeId, attributeId } = req.body

      if (!nodeId || !attributeId) {
        sendValidationError(res, 'nodeId and attributeId are required')
        return
      }

      let resolvedAttributeId = attributeId as AttributeId
      if (this.schemaGate) {
        const removal = await this.schemaGate.validateRemoval(nodeId, attributeId)
        resolvedAttributeId = removal.resolvedAttributeId
      }

      // Use node attribute repository to remove node attribute
      const nodeAttribute =
        await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
          nodeId as NodeId,
          resolvedAttributeId,
        )

      if (!nodeAttribute) {
        sendNotFound(res, `Node attribute for nodeId: ${nodeId}, attributeId: ${attributeId}`)
        return
      }

      const nodeAttributeId = nodeAttribute.getId()
      if (!nodeAttributeId) {
        sendError(res, this.logger, 500, 'Node attribute ID is null', 'Remove node attribute')
        return
      }
      await this.nodeAttributeRepository.delete(nodeAttributeId)

      const result = {
        nodeId,
        attributeId: resolvedAttributeId,
        removed: true,
      }

      sendSuccess(res, result)
    } catch (error) {
      this.handleSchemaScopedError(res, error, 'Remove node attribute')
    }
  }

  async updateNodeAttributeValue(
    req: AttributeBodyRequest<UpdateNodeAttributeValueBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { nodeId, attributeId, value } = req.body

      if (!nodeId || !attributeId || value === undefined) {
        sendValidationError(res, 'nodeId, attributeId, and value are required')
        return
      }

      let resolvedAttributeId = attributeId as AttributeId
      let nextValue = value
      if (this.schemaGate) {
        const { normalized } = await this.schemaGate.validateAndNormalizePatch(nodeId, [
          { attributeIdOrIdentifier: attributeId, value },
        ])
        const target = normalized[0]
        if (target) {
          resolvedAttributeId = target.attributeId
          nextValue = target.canonicalValue
        }
      }

      // Use node attribute repository to update node attribute value
      const nodeAttribute =
        await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
          nodeId as NodeId,
          resolvedAttributeId,
        )

      if (!nodeAttribute) {
        sendNotFound(res, `Node attribute for nodeId: ${nodeId}, attributeId: ${attributeId}`)
        return
      }

      nodeAttribute.updateValue(nextValue)
      await this.nodeAttributeRepository.update(nodeAttribute)

      const result = {
        nodeId,
        attributeId: resolvedAttributeId,
        value: nodeAttribute.getValue(),
        updated: true,
      }

      sendSuccess(res, result)
    } catch (error) {
      this.handleSchemaScopedError(res, error, 'Update node attribute value')
    }
  }

  async getNodeAttributes(
    req: AttributeRequest<NodeParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { nodeId } = req.params

      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }

      // Use node attribute repository to get node attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(
        nodeId as NodeId,
      )

      const result = {
        nodeId,
        attributes: nodeAttributes.map((nodeAttr) => ({
          id: nodeAttr.getId(),
          nodeId: nodeAttr.getNodeId(),
          attributeId: nodeAttr.getAttributeId(),
          value: nodeAttr.getValue(),
        })),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get node attributes')
    }
  }
}
