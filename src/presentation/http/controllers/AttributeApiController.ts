import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  ApiResponse,
  AttributeData,
  NodeAttributeData,
  NodeAttributesData,
  TableAttributesData,
} from '../types/ApiResponseTypes.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'

export class AttributeApiController {
  constructor(private readonly logger: ILogger) {}

  async setNodeAttribute(req: Request, res: Response): Promise<void> {
    try {
      const { input } = req.body

      if (!input || !input.nodeId || !input.attributeId || input.value === undefined) {
        res.status(400).json({
          success: false,
          error: 'input with nodeId, attributeId, and value is required',
        })
        return
      }

      const { nodeId, attributeId, value } = input

      // TODO: Implement with actual use case
      const result: NodeAttributeData = {
        nodeId,
        attributeId,
        value,
        success: true,
      }

      const response: ApiResponse<NodeAttributeData> = {
        success: true,
        data: result,
      }
      res.json(response)
    } catch (error) {
      this.logger.error('Set node attribute error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Set node attribute failed',
      })
    }
  }

  async createAttribute(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, identifier, name, attributeTypeId = '1' } = req.body

      if (!tableId || !identifier || !name) {
        res.status(400).json({
          success: false,
          error: 'tableId, identifier, and name are required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result: AttributeData = {
        id: Date.now().toString(),
        tableId,
        identifier,
        name,
        attributeTypeId,
      }

      const response: ApiResponse<AttributeData> = {
        success: true,
        data: result,
      }
      res.json(response)
    } catch (error) {
      this.logger.error('Create attribute error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Create attribute failed',
      })
    }
  }

  async updateAttribute(req: Request, res: Response): Promise<void> {
    try {
      const { attributeId } = req.params
      const { identifier, name } = req.body

      if (!attributeId) {
        res.status(400).json({
          success: false,
          error: 'attributeId is required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        id: attributeId,
        identifier,
        name,
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Update attribute error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Update attribute failed',
      })
    }
  }

  async deleteAttribute(req: Request, res: Response): Promise<void> {
    try {
      const { attributeId } = req.params

      if (!attributeId) {
        res.status(400).json({
          success: false,
          error: 'attributeId is required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        id: attributeId,
        deleted: true,
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Delete attribute error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Delete attribute failed',
      })
    }
  }

  async getTableAttributes(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params

      if (!tableId) {
        res.status(400).json({
          success: false,
          error: 'tableId is required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result: TableAttributesData = {
        tableId,
        attributes: [],
      }

      const response: ApiResponse<TableAttributesData> = {
        success: true,
        data: result,
      }
      res.json(response)
    } catch (error) {
      this.logger.error('Get table attributes error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get table attributes failed',
      })
    }
  }

  async removeNodeAttribute(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, attributeId } = req.body

      if (!nodeId || !attributeId) {
        res.status(400).json({
          success: false,
          error: 'nodeId and attributeId are required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        nodeId,
        attributeId,
        removed: true,
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Remove node attribute error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Remove node attribute failed',
      })
    }
  }

  async updateNodeAttributeValue(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, attributeId, value } = req.body

      if (!nodeId || !attributeId || value === undefined) {
        res.status(400).json({
          success: false,
          error: 'nodeId, attributeId, and value are required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        nodeId,
        attributeId,
        value,
        updated: true,
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Update node attribute value error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Update node attribute value failed',
      })
    }
  }

  async getNodeAttributes(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params

      if (!nodeId) {
        res.status(400).json({
          success: false,
          error: 'nodeId is required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        nodeId,
        attributes: [],
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Get node attributes error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get node attributes failed',
      })
    }
  }
}
