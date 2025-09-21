import type { ILogger } from '@/application/ports/ILogger.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  IQueryTemplateRepository,
  QueryTemplateUpdateData,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface UpdateQueryTemplateRequest {
  id: string
  name?: string
  description?: string
  queryText?: string
  inputSchema?: any
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: 'query' | 'mutation' | 'subscription'
  complexityScore?: number
  version?: string
  isActive?: boolean
  tags?: string[]
}

export interface UpdateQueryTemplateResponse {
  success: boolean
  template: QueryTemplate | null
  errors: Array<{
    message: string
    code: string
  }>
}

export class UpdateQueryTemplate {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: UpdateQueryTemplateRequest): Promise<UpdateQueryTemplateResponse> {
    try {
      this.logger.info('Updating query template', { id: request.id })

      // Validate request
      this.validateUpdateRequest(request)

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

      // Build update data (only include provided fields)
      const updateData: QueryTemplateUpdateData = {}

      if (request.name !== undefined) updateData.name = request.name
      if (request.description !== undefined) updateData.description = request.description
      if (request.queryText !== undefined) updateData.queryText = request.queryText
      if (request.inputSchema !== undefined)
        updateData.inputSchema = request.inputSchema
      if (request.defaultVariables !== undefined)
        updateData.defaultVariables = request.defaultVariables
      if (request.applicableTables !== undefined)
        updateData.applicableTables = request.applicableTables
      if (request.templateType !== undefined) updateData.templateType = request.templateType
      if (request.complexityScore !== undefined)
        updateData.complexityScore = request.complexityScore
      if (request.version !== undefined) updateData.version = request.version
      if (request.isActive !== undefined) updateData.isActive = request.isActive
      if (request.tags !== undefined) updateData.tags = request.tags

      // Validate specific constraints
      if (request.complexityScore !== undefined) {
        this.validateComplexityScore(request.complexityScore)
      }

      if (request.tags !== undefined) {
        this.validateTags(request.tags)
      }

      // If updating input schema or default variables, validate compatibility
      if (request.inputSchema !== undefined || request.defaultVariables !== undefined) {
        const updatedSchema =
          request.inputSchema !== undefined
            ? request.inputSchema
            : existingTemplate.getInputSchema()

        const updatedDefaults =
          request.defaultVariables !== undefined
            ? request.defaultVariables
            : existingTemplate.getDefaultVariables()

        if (updatedSchema && updatedDefaults) {
          // Create a temporary template to validate variables
          const tempTemplate = existingTemplate // Use existing as base for validation
          if (!tempTemplate.validateVariables(updatedDefaults)) {
            return {
              success: false,
              template: null,
              errors: [
                {
                  message: 'Default variables do not match the updated schema',
                  code: 'INVALID_DEFAULT_VARIABLES',
                },
              ],
            }
          }
        }
      }

      // Perform update
      const updatedTemplate = await this.queryTemplateRepository.update(request.id, updateData)

      if (!updatedTemplate) {
        return {
          success: false,
          template: null,
          errors: [
            {
              message: 'Failed to update template',
              code: 'UPDATE_FAILED',
            },
          ],
        }
      }

      this.logger.info('Query template updated successfully', {
        id: updatedTemplate.getId(),
        identifier: updatedTemplate.getIdentifier(),
      })

      return {
        success: true,
        template: updatedTemplate,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update query template', {
        error,
        id: request.id,
      })

      if (error instanceof ValidationException) {
        throw error
      }

      throw new ValidationException('Failed to update query template', {
        originalError: error,
      })
    }
  }

  private validateUpdateRequest(request: UpdateQueryTemplateRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new ValidationException('Template ID is required for update')
    }

    // Validate template type if provided
    if (
      request.templateType &&
      !['query', 'mutation', 'subscription'].includes(request.templateType)
    ) {
      throw new ValidationException('Template type must be query, mutation, or subscription')
    }

    // Validate name if provided
    if (request.name !== undefined && request.name.trim().length === 0) {
      throw new ValidationException('Template name cannot be empty')
    }

    // Validate query text if provided
    if (request.queryText !== undefined && request.queryText.trim().length === 0) {
      throw new ValidationException('Query text cannot be empty')
    }
  }

  private validateComplexityScore(score: number): void {
    if (score < 1 || score > 10) {
      throw new ValidationException('Complexity score must be between 1 and 10')
    }
  }

  private validateTags(tags: string[]): void {
    if (!tags || tags.length === 0) {
      throw new ValidationException('At least one tag is required')
    }

    for (const tag of tags) {
      if (!tag || tag.trim().length === 0) {
        throw new ValidationException('Tags cannot be empty')
      }
    }
  }
}
