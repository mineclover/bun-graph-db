import { execute, GraphQLError, parse } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import {
  type CreateQueryTemplateInput,
  type ExecuteTemplateInput,
  type QueryTemplateDto,
  QueryTemplateDtoMapper,
  type SearchTemplatesInput,
  type UpdateQueryTemplateInput,
} from '@/presentation/dto/QueryTemplateDto.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class QueryTemplateResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    logger: ILogger,
    private readonly schema: any // GraphQL Schema instance
  ) {
    super()
    this.logger = logger
  }

  /**
   * 템플릿 기반 쿼리 실행
   * 템플릿을 로드하고, 변수를 적용한 후 실제 GraphQL 쿼리를 실행합니다
   */
  async executeTemplate(input: ExecuteTemplateInput, context: any): Promise<any> {
    this.logger.info('Executing template', {
      templateId: input.templateId,
      templateIdentifier: input.templateIdentifier,
    })

    // 1. 템플릿 로드
    const template = await this.loadTemplate(input.templateId, input.templateIdentifier)
    if (!template) {
      throw new GraphQLError('Template not found', {
        extensions: { code: 'TEMPLATE_NOT_FOUND' },
      })
    }

    // 2. 활성화 상태 확인
    if (!template.isActive) {
      throw new GraphQLError('Template is inactive', {
        extensions: { code: 'TEMPLATE_INACTIVE' },
      })
    }

    // 3. 변수 처리 및 검증
    const processedVariables = this.processVariables(
      template.defaultVariables,
      input.variables,
      template.variablesSchema,
      input.validateVariables !== false
    )

    // 4. 사용 통계 업데이트 (비동기, 실패 무시)
    if (input.trackUsage !== false) {
      this.trackUsage(template.id).catch((error) => {
        this.logger.warn('Failed to track template usage', { error })
      })
    }

    // 5. GraphQL 쿼리 실행
    try {
      const document = parse(template.queryText)

      const result = await execute({
        schema: this.schema,
        document,
        variableValues: processedVariables,
        contextValue: context,
      })

      // 6. 실행 결과 반환
      if (result.errors && result.errors.length > 0) {
        this.logger.error('Template execution errors', {
          templateId: template.id,
          errors: result.errors,
        })
        throw new GraphQLError('Template execution failed', {
          extensions: {
            code: 'TEMPLATE_EXECUTION_ERROR',
            errors: result.errors,
          },
        })
      }

      return result.data
    } catch (error) {
      this.logger.error('Failed to execute template', {
        templateId: template.id,
        error,
      })

      if (error instanceof GraphQLError) {
        throw error
      }

      throw new GraphQLError('Failed to execute template', {
        extensions: {
          code: 'TEMPLATE_EXECUTION_ERROR',
          originalError: error,
        },
      })
    }
  }

  /**
   * 템플릿 검색
   */
  async searchTemplates(input: SearchTemplatesInput): Promise<QueryTemplateDto[]> {
    this.logger.info('Searching templates', { input })

    // 검색 조건 구성
    const searchCriteria = {
      tags: input.tags,
      tagMatchMode: input.tagMatchMode || 'ANY',
      applicableToTable: input.applicableToTable,
      includeUniversal: input.includeUniversal !== false,
      templateType: input.templateType?.toLowerCase(),
      isActive: input.isActive,
      orderBy: input.orderBy || 'usage_count',
      orderDirection: input.orderDirection || 'DESC',
      limit: input.limit || 20,
      offset: input.offset || 0,
    }

    const result = await this.queryTemplateRepository.search(searchCriteria)
    return QueryTemplateDtoMapper.toDtoList(result.items)
  }

  /**
   * ID로 템플릿 조회
   */
  async getTemplate(id: string, context?: GraphQLContext): Promise<QueryTemplateDto | null> {
    this.validateArgs(
      { id },
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'getTemplate'
    )

    return this.handleQuery(
      async () => {
        const template = await this.queryTemplateRepository.findById(id)
        return template ? QueryTemplateDtoMapper.toDto(template) : null
      },
      'findTemplateById',
      { id }
    )
  }

  /**
   * Identifier로 템플릿 조회
   */
  async getTemplateByIdentifier(identifier: string): Promise<QueryTemplateDto | null> {
    const template = await this.queryTemplateRepository.findByIdentifier(identifier)
    return template ? QueryTemplateDtoMapper.toDto(template) : null
  }

  /**
   * 인기 템플릿 조회
   */
  async getPopularTemplates(limit: number = 10): Promise<QueryTemplateDto[]> {
    const templates = await this.queryTemplateRepository.findPopular(limit)
    return QueryTemplateDtoMapper.toDtoList(templates)
  }

  // Private helper methods

  private async loadTemplate(id?: string, identifier?: string): Promise<any> {
    if (id) {
      return await this.queryTemplateRepository.findById(id)
    }
    if (identifier) {
      return await this.queryTemplateRepository.findByIdentifier(identifier)
    }
    return null
  }

  private processVariables(
    defaultVariables: any,
    userVariables: any,
    schema: any,
    validate: boolean
  ): Record<string, any> {
    // 기본값과 사용자 입력 병합
    const merged = {
      ...(defaultVariables || {}),
      ...(userVariables || {}),
    }

    // 검증이 필요한 경우
    if (validate && schema) {
      this.validateVariables(merged, schema)
    }

    return merged
  }

  private validateVariables(variables: any, schema: any): void {
    // JSON Schema 검증 로직
    // 실제 구현에서는 ajv 같은 JSON Schema validator 사용
    if (!schema) return

    const required = schema.required || []
    for (const field of required) {
      if (!(field in variables)) {
        throw new GraphQLError(`Missing required variable: ${field}`, {
          extensions: { code: 'INVALID_VARIABLES' },
        })
      }
    }

    // 타입 검증 등 추가 검증 로직...
  }

  private async trackUsage(templateId: string): Promise<void> {
    try {
      await this.queryTemplateRepository.incrementUsage(templateId)
    } catch (error) {
      // 실패 무시
      this.logger.warn('Failed to track usage', { templateId, error })
    }
  }

  /**
   * 새 템플릿 생성
   */
  async createTemplate(input: CreateQueryTemplateInput): Promise<QueryTemplateDto> {
    this.logger.info('Creating template', { identifier: input.identifier })

    try {
      const template = QueryTemplateDtoMapper.createInputToEntity(input)
      const savedTemplate = await this.queryTemplateRepository.create(template)

      return QueryTemplateDtoMapper.toDto(savedTemplate)
    } catch (error) {
      this.logger.error('Failed to create template', {
        identifier: input.identifier,
        error,
      })
      throw new GraphQLError('Failed to create template', {
        extensions: { code: 'TEMPLATE_CREATION_FAILED' },
      })
    }
  }

  /**
   * 템플릿 업데이트
   */
  async updateTemplate(id: string, input: UpdateQueryTemplateInput): Promise<QueryTemplateDto> {
    this.logger.info('Updating template', { id })

    try {
      const template = await this.queryTemplateRepository.findById(id)
      if (!template) {
        throw new GraphQLError('Template not found', {
          extensions: { code: 'TEMPLATE_NOT_FOUND' },
        })
      }

      // Convert UpdateQueryTemplateInput to partial QueryTemplate entity update
      const updateData: Partial<QueryTemplate> = {
        // Map the input properties that can be updated
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.queryText && { queryText: input.queryText }),
        ...(input.variablesSchema !== undefined && { variablesSchema: input.variablesSchema }),
        ...(input.defaultVariables !== undefined && { defaultVariables: input.defaultVariables }),
        ...(input.applicableTables !== undefined && { applicableTables: input.applicableTables }),
        ...(input.templateType && { templateType: input.templateType }),
        ...(input.complexityScore !== undefined && { complexityScore: input.complexityScore }),
        ...(input.version && { version: input.version }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.tags !== undefined && { tags: input.tags }),
      } as Partial<QueryTemplate>

      const savedTemplate = await this.queryTemplateRepository.update(id, updateData)
      return QueryTemplateDtoMapper.toDto(savedTemplate)
    } catch (error) {
      this.logger.error('Failed to update template', { id, error })
      throw new GraphQLError('Failed to update template', {
        extensions: { code: 'TEMPLATE_UPDATE_FAILED' },
      })
    }
  }

  /**
   * 템플릿 삭제
   */
  async deleteTemplate(id: string): Promise<boolean> {
    this.logger.info('Deleting template', { id })

    try {
      const exists = await this.queryTemplateRepository.findById(id)
      if (!exists) {
        throw new GraphQLError('Template not found', {
          extensions: { code: 'TEMPLATE_NOT_FOUND' },
        })
      }

      await this.queryTemplateRepository.delete(id)
      return true
    } catch (error) {
      this.logger.error('Failed to delete template', { id, error })
      throw new GraphQLError('Failed to delete template', {
        extensions: { code: 'TEMPLATE_DELETION_FAILED' },
      })
    }
  }

  /**
   * 템플릿 활성화
   */
  async activateTemplate(id: string): Promise<QueryTemplateDto> {
    this.logger.info('Activating template', { id })

    try {
      const savedTemplate = await this.queryTemplateRepository.updateStatus(id, true)
      return QueryTemplateDtoMapper.toDto(savedTemplate)
    } catch (error) {
      this.logger.error('Failed to activate template', { id, error })
      throw new GraphQLError('Failed to activate template', {
        extensions: { code: 'TEMPLATE_ACTIVATION_FAILED' },
      })
    }
  }

  /**
   * 템플릿 비활성화
   */
  async deactivateTemplate(id: string): Promise<QueryTemplateDto> {
    this.logger.info('Deactivating template', { id })

    try {
      const savedTemplate = await this.queryTemplateRepository.updateStatus(id, false)
      return QueryTemplateDtoMapper.toDto(savedTemplate)
    } catch (error) {
      this.logger.error('Failed to deactivate template', { id, error })
      throw new GraphQLError('Failed to deactivate template', {
        extensions: { code: 'TEMPLATE_DEACTIVATION_FAILED' },
      })
    }
  }
}
