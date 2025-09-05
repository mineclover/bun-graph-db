import type { ILogger } from '@/application/ports/ILogger.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { ApplicationException } from '@/shared/exceptions/ApplicationException.js'

export interface DeleteQueryTemplateRequest {
  id: string
  force?: boolean // Allow deletion even if template is being used
}

export interface DeleteQueryTemplateResponse {
  success: boolean
  errors: Array<{
    message: string
    code: string
  }>
}

export class DeleteQueryTemplate {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: DeleteQueryTemplateRequest): Promise<DeleteQueryTemplateResponse> {
    try {
      this.logger.info('Deleting query template', { id: request.id, force: request.force })

      // Validate request
      this.validateDeleteRequest(request)

      // Check if template exists
      const existingTemplate = await this.queryTemplateRepository.findById(request.id)
      if (!existingTemplate) {
        return {
          success: false,
          errors: [
            {
              message: `Template with ID '${request.id}' not found`,
              code: 'TEMPLATE_NOT_FOUND'
            }
          ]
        }
      }

      // Check if template is actively used (unless force delete)
      if (!request.force && existingTemplate.getUsageCount() > 0) {
        this.logger.warn('Attempting to delete template with usage history', {
          id: request.id,
          usageCount: existingTemplate.getUsageCount()
        })

        return {
          success: false,
          errors: [
            {
              message: `Template '${existingTemplate.getIdentifier()}' has been used ${existingTemplate.getUsageCount()} times. Use force=true to delete anyway.`,
              code: 'TEMPLATE_IN_USE'
            }
          ]
        }
      }

      // Check if template is currently active (warn but allow deletion)
      if (existingTemplate.getIsActive() && !request.force) {
        this.logger.warn('Deleting active template', {
          id: request.id,
          identifier: existingTemplate.getIdentifier()
        })
      }

      // Perform soft delete by deactivating first, then hard delete
      if (existingTemplate.getIsActive()) {
        await this.queryTemplateRepository.updateStatus(request.id, false)
        this.logger.info('Template deactivated before deletion', { id: request.id })
      }

      // Perform actual deletion
      const deletionSuccess = await this.queryTemplateRepository.delete(request.id)

      if (!deletionSuccess) {
        return {
          success: false,
          errors: [
            {
              message: 'Failed to delete template',
              code: 'DELETE_FAILED'
            }
          ]
        }
      }

      this.logger.info('Query template deleted successfully', { 
        id: request.id,
        identifier: existingTemplate.getIdentifier(),
        wasActive: existingTemplate.getIsActive(),
        usageCount: existingTemplate.getUsageCount()
      })

      return {
        success: true,
        errors: []
      }

    } catch (error) {
      this.logger.error('Failed to delete query template', { 
        error, 
        id: request.id 
      })

      if (error instanceof ApplicationException) {
        throw error
      }

      throw new ApplicationException(
        'Failed to delete query template',
        'DELETE_TEMPLATE_FAILED',
        { originalError: error }
      )
    }
  }

  private validateDeleteRequest(request: DeleteQueryTemplateRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new ApplicationException(
        'Template ID is required for deletion',
        'MISSING_TEMPLATE_ID'
      )
    }
  }
}