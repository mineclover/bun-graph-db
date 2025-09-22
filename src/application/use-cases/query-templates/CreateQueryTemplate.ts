import type { ILogger } from '@/application/ports/ILogger.js'
import { type OperationType, QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'

export interface CreateQueryTemplateRequest {
  identifier: string
  name: string
  queryText: string
  tags: string[]
  description?: string
  inputSchema?: any
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: OperationType
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

  async execute(request: CreateQueryTemplateRequest): Promise<QueryTemplate> {
    try {
      this.logger.info('Creating query template', {
        identifier: request.identifier,
        name: request.name,
      })

      // Create the template entity
      const template = QueryTemplate.create(
        request.identifier,
        request.name,
        request.queryText,
        request.tags,
        {
          description: request.description,
          inputSchema: request.inputSchema,
          defaultVariables: request.defaultVariables,
          applicableTables: request.applicableTables,
          templateType: request.templateType,
          complexityScore: request.complexityScore,
          version: request.version,
        }
      )

      // Save the template
      const saved = await this.queryTemplateRepository.create(template)

      this.logger.info('Query template created successfully', {
        id: saved.getId(),
        identifier: saved.getIdentifier(),
      })

      return saved
    } catch (error) {
      this.logger.error('Failed to create query template', {
        error: error instanceof Error ? error.message : String(error),
        request,
      })
      throw error
    }
  }
}
