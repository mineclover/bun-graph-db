import type { ILogger } from '@/application/ports/ILogger.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface CreateQueryTemplateRequest {
  identifier: string
  name: string
  queryText: string
  tags: string[]
  description?: string
  variablesSchema?: any
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: 'query' | 'mutation' | 'subscription'
  complexityScore?: number
  version?: string
}

export interface CreateQueryTemplateResponse {
  success: boolean
  template: QueryTemplate | null
  errors: Array<{
    message: string
    code: string
  }>
}

export class CreateQueryTemplate {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: CreateQueryTemplateRequest): Promise<CreateQueryTemplateResponse> {
    try {
      this.logger.info('Creating query template', { identifier: request.identifier })

      // Check for existing template with same identifier
      const existing = await this.queryTemplateRepository.findByIdentifier(request.identifier)
      if (existing) {
        return {
          success: false,
          template: null,
          errors: [
            {
              message: `Template with identifier '${request.identifier}' already exists`,
              code: 'TEMPLATE_ALREADY_EXISTS',
            },
          ],
        }
      }

      // Create template entity
      const template = QueryTemplate.create(
        request.identifier,
        request.name,
        request.queryText,
        request.tags,
        {
          description: request.description,
          variablesSchema: request.variablesSchema,
          defaultVariables: request.defaultVariables,
          applicableTables: request.applicableTables,
          templateType: request.templateType,
          complexityScore: request.complexityScore,
          version: request.version,
        }
      )

      // Validate variables if provided
      if (request.defaultVariables && !template.validateVariables(request.defaultVariables)) {
        return {
          success: false,
          template: null,
          errors: [
            {
              message: 'Default variables do not match the provided schema',
              code: 'INVALID_DEFAULT_VARIABLES',
            },
          ],
        }
      }

      // Save to repository
      const savedTemplate = await this.queryTemplateRepository.create(template)

      this.logger.info('Query template created successfully', {
        id: savedTemplate.getId(),
        identifier: savedTemplate.getIdentifier(),
      })

      return {
        success: true,
        template: savedTemplate,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create query template', {
        error,
        identifier: request.identifier,
      })

      if (error instanceof ValidationException) {
        throw error
      }

      throw new ValidationException('Failed to create query template', {
        originalError: error,
      })
    }
  }
}
