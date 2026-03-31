import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'
import type { AttributeData, NodeAttributeData, TableAttributesData } from '../types/ApiResponseTypes.js'
import { ResponseHelper } from '../utils/responseHelpers.js'

type AttributeBodyRequest<TBody> = Request<Record<string, string>, unknown, TBody>
type AttributeRequest<TParams extends object, TBody = unknown> = Request<TParams, unknown, TBody>

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
  attributeTypeId?: string
  description?: string
  isRequired?: boolean
  metadata?: object | null
}

interface UpdateAttributeParams {
  attributeId?: string
}

interface UpdateAttributeBody {
  description?: string | null
  isRequired?: boolean
  metadata?: object | null
}

interface TableParams {
  tableId?: string
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
  private responseHelper: ResponseHelper

  constructor(
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    readonly logger: ILogger,
  ) {
    this.responseHelper = new ResponseHelper(logger)
  }

  async setNodeAttribute(req: AttributeBodyRequest<SetNodeAttributeBody>, res: Response): Promise<void> {
    try {
      const { input } = req.body

      if (!input?.nodeId || !input.attributeId || input.value === undefined) {
        this.responseHelper.validationError(res, 'input with nodeId, attributeId, and value is required')
        return
      }

      const { nodeId, attributeId, value } = input

      // Use repository to set node attribute
      const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
        nodeId as NodeId,
        attributeId as AttributeId,
        value,
      )

      const result: NodeAttributeData = {
        nodeId: nodeAttribute.getNodeId(),
        attributeId: nodeAttribute.getAttributeId(),
        value: nodeAttribute.getValue(),
        success: true,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Set node attribute')
    }
  }

  async createAttribute(req: AttributeBodyRequest<CreateAttributeBody>, res: Response): Promise<void> {
    try {
      const { tableId, identifier, attributeTypeId = '1', description, isRequired = false, metadata } = req.body

      if (!tableId || !identifier) {
        this.responseHelper.validationError(res, 'tableId and identifier are required')
        return
      }

      // Use CreateAttributeUseCase to create attribute
      const createResult = await this.createAttributeUseCase.execute({
        tableId: tableId as TableId,
        identifier,
        attributeTypeId: attributeTypeId as AttributeId,
        description,
        isRequired,
        metadata: metadata ?? undefined,
      })

      const result: AttributeData = {
        id: createResult.attribute.id,
        tableId: createResult.attribute.tableId,
        identifier: createResult.attribute.identifier,
        name: createResult.attribute.name,
        attributeTypeId: createResult.attribute.attributeTypeId,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Create attribute')
    }
  }

  async updateAttribute(
    req: AttributeRequest<UpdateAttributeParams, UpdateAttributeBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { attributeId } = req.params
      const { description, isRequired, metadata } = req.body

      if (!attributeId) {
        this.responseHelper.validationError(res, 'attributeId is required')
        return
      }

      // Use attribute repository to update attribute
      const attribute = await this.attributeRepository.findById(attributeId as AttributeId)
      if (!attribute) {
        this.responseHelper.notFound(res, `Attribute with id ${attributeId}`)
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

      if (metadata !== undefined) {
        const metadataString = metadata ? JSON.stringify(metadata) : null
        updatedAttribute = updatedAttribute.updateMetadata(metadataString)
      }

      await this.attributeRepository.save(updatedAttribute)

      const result = {
        id: updatedAttribute.getId(),
        identifier: updatedAttribute.getIdentifier(),
        name: updatedAttribute.getName(),
        description: updatedAttribute.getDescription(),
        isRequired: updatedAttribute.getIsRequired(),
        metadata: updatedAttribute.getParsedMetadata(),
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Update attribute')
    }
  }

  async deleteAttribute(req: AttributeRequest<UpdateAttributeParams>, res: Response): Promise<void> {
    try {
      const { attributeId } = req.params

      if (!attributeId) {
        this.responseHelper.validationError(res, 'attributeId is required')
        return
      }

      // Use attribute repository to delete attribute
      const attribute = await this.attributeRepository.findById(attributeId as AttributeId)
      if (!attribute) {
        this.responseHelper.notFound(res, `Attribute with id ${attributeId}`)
        return
      }

      await this.attributeRepository.delete(attributeId)

      const result = {
        id: attributeId,
        deleted: true,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Delete attribute')
    }
  }

  async getTableAttributes(req: AttributeRequest<TableParams>, res: Response): Promise<void> {
    try {
      const { tableId } = req.params

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }

      // Use attribute repository to get table attributes
      const attributesResult = await this.attributeRepository.findByTableId(tableId as TableId)
      const attributes = attributesResult.data || []

      const result: TableAttributesData = {
        tableId,
        attributes: attributes.map((attr) => ({
          id: attr.getId(),
          identifier: attr.getIdentifier(),
          name: attr.getName() || attr.getIdentifier(),
          attributeTypeId: attr.getAttributeTypeId(),
          tableId: attr.getTableId(),
        })),
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get table attributes')
    }
  }

  async removeNodeAttribute(req: AttributeBodyRequest<RemoveNodeAttributeBody>, res: Response): Promise<void> {
    try {
      const { nodeId, attributeId } = req.body

      if (!nodeId || !attributeId) {
        this.responseHelper.validationError(res, 'nodeId and attributeId are required')
        return
      }

      // Use node attribute repository to remove node attribute
      const nodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        nodeId as NodeId,
        attributeId as AttributeId,
      )

      if (!nodeAttribute) {
        this.responseHelper.notFound(res, `Node attribute for nodeId: ${nodeId}, attributeId: ${attributeId}`)
        return
      }

      const nodeAttributeId = nodeAttribute.getId()
      if (!nodeAttributeId) {
        this.responseHelper.error(res, 500, 'Node attribute ID is null', 'Remove node attribute')
        return
      }
      await this.nodeAttributeRepository.delete(nodeAttributeId)

      const result = {
        nodeId,
        attributeId,
        removed: true,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Remove node attribute')
    }
  }

  async updateNodeAttributeValue(
    req: AttributeBodyRequest<UpdateNodeAttributeValueBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { nodeId, attributeId, value } = req.body

      if (!nodeId || !attributeId || value === undefined) {
        this.responseHelper.validationError(res, 'nodeId, attributeId, and value are required')
        return
      }

      // Use node attribute repository to update node attribute value
      const nodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        nodeId as NodeId,
        attributeId as AttributeId,
      )

      if (!nodeAttribute) {
        this.responseHelper.notFound(res, `Node attribute for nodeId: ${nodeId}, attributeId: ${attributeId}`)
        return
      }

      nodeAttribute.updateValue(value)
      await this.nodeAttributeRepository.update(nodeAttribute)

      const result = {
        nodeId,
        attributeId,
        value: nodeAttribute.getValue(),
        updated: true,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Update node attribute value')
    }
  }

  async getNodeAttributes(req: AttributeRequest<NodeParams>, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params

      if (!nodeId) {
        this.responseHelper.validationError(res, 'nodeId is required')
        return
      }

      // Use node attribute repository to get node attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(nodeId as NodeId)

      const result = {
        nodeId,
        attributes: nodeAttributes.map((nodeAttr) => ({
          id: nodeAttr.getId(),
          nodeId: nodeAttr.getNodeId(),
          attributeId: nodeAttr.getAttributeId(),
          value: nodeAttr.getValue(),
        })),
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get node attributes')
    }
  }
}
