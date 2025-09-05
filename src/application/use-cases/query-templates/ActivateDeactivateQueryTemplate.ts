import type { ILogger } from '@/application/ports/ILogger.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface ActivateDeactivateQueryTemplateRequest {
  id: string
  activate: boolean
}

export interface ActivateDeactivateQueryTemplateResponse {
  success: boolean
  template: QueryTemplate | null
  errors: Array<{
    message: string
    code: string
  }>
}

export class ActivateDeactivateQueryTemplate {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(
    request: ActivateDeactivateQueryTemplateRequest
  ): Promise<ActivateDeactivateQueryTemplateResponse> {
    try {
      const action = request.activate ? 'Activating' : 'Deactivating'
      this.logger.info(`${action} query template`, { id: request.id })

      // Validate request
      this.validateRequest(request)

      // Check if template exists
      const existingTemplate = await this.queryTemplateRepository.findById(request.id)
      if (!existingTemplate) {
        return {
          success: false,
          template: null,
          errors: [
            {
              message: `Template with ID '${request.id}' not found`,
              code: 'TEMPLATE_NOT_FOUND',
            },
          ],
        }
      }

      // Check if template is already in the desired state
      const currentlyActive = existingTemplate.getIsActive()
      if (currentlyActive === request.activate) {
        const state = request.activate ? 'active' : 'inactive'
        this.logger.info(`Template is already ${state}`, {
          id: request.id,
          identifier: existingTemplate.getIdentifier(),
        })

        return {
          success: true,
          template: existingTemplate,
          errors: [],
        }
      }

      // Perform activation/deactivation using repository method
      const updatedTemplate = await this.queryTemplateRepository.updateStatus(
        request.id,
        request.activate
      )

      if (!updatedTemplate) {
        const action = request.activate ? 'activate' : 'deactivate'
        return {
          success: false,
          template: null,
          errors: [
            {
              message: `Failed to ${action} template`,
              code: request.activate ? 'ACTIVATION_FAILED' : 'DEACTIVATION_FAILED',
            },
          ],
        }
      }

      const actionCompleted = request.activate ? 'activated' : 'deactivated'
      this.logger.info(`Query template ${actionCompleted} successfully`, {
        id: updatedTemplate.getId(),
        identifier: updatedTemplate.getIdentifier(),
        isActive: updatedTemplate.getIsActive(),
      })

      return {
        success: true,
        template: updatedTemplate,
        errors: [],
      }
    } catch (error) {
      const action = request.activate ? 'activate' : 'deactivate'
      this.logger.error(`Failed to ${action} query template`, {
        error,
        id: request.id,
      })

      if (error instanceof ValidationException) {
        throw error
      }

      throw new ValidationException(
        `Failed to ${action} query template`,
        { originalError: error }
      )
    }
  }

  async activate(id: string): Promise<ActivateDeactivateQueryTemplateResponse> {
    return this.execute({ id, activate: true })
  }

  async deactivate(id: string): Promise<ActivateDeactivateQueryTemplateResponse> {
    return this.execute({ id, activate: false })
  }

  private validateRequest(request: ActivateDeactivateQueryTemplateRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new ValidationException('Template ID is required for activation/deactivation')
    }

    if (typeof request.activate !== 'boolean') {
      throw new ValidationException('Activate flag must be a boolean value')
    }
  }
}
