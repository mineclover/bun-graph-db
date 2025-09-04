import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import type { QueryTemplateId } from '@/shared/types/common.js'

export interface ExecuteQueryTemplateInput {
  templateIdentifier: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
}

export interface ExecuteQueryTemplateOutput {
  queryText: string
  processedVariables: Record<string, unknown>
  metadata: {
    templateId: QueryTemplateId
    templateName: string
    complexityScore: number
    estimatedTokens?: number
    version: string
  }
}

export class ExecuteQueryTemplateUseCase {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: ExecuteQueryTemplateInput): Promise<ExecuteQueryTemplateOutput> {
    this.logger.info('Executing query template', { identifier: input.templateIdentifier })

    // 1. 템플릿 조회
    const template = await this.queryTemplateRepository.findByIdentifier(input.templateIdentifier)
    if (!template) {
      throw new NotFoundException(`Query template not found: ${input.templateIdentifier}`)
    }

    // 2. 활성화 및 비추천 상태 확인
    if (!template.getIsActive()) {
      throw new ValidationException(`Query template is inactive: ${input.templateIdentifier}`)
    }

    if (template.getIsDeprecated()) {
      this.logger.warn('Using deprecated query template', { 
        identifier: input.templateIdentifier,
        reason: template.getDeprecatedReason(),
        replacement: template.getReplacementTemplateId()
      })
    }

    // 3. Variables 처리
    const variables = { ...template.getDefaultVariables(), ...(input.variables || {}) }
    
    // 4. Variables 유효성 검사
    if (!template.validateVariables(variables)) {
      const required = template.getVariablesSchema().required || []
      throw new ValidationException(
        `Missing required variables: ${required.filter(field => !variables.hasOwnProperty(field)).join(', ')}`
      )
    }

    // 5. 사용 통계 업데이트 (선택적)
    if (input.trackUsage !== false) {
      try {
        const updatedTemplate = template.incrementUsage()
        await this.queryTemplateRepository.save(updatedTemplate)
      } catch (error) {
        // 통계 업데이트 실패는 쿼리 실행을 막지 않음
        this.logger.warn('Failed to update template usage statistics', { error })
      }
    }

    // 6. 결과 반환
    return {
      queryText: template.getQueryText(),
      processedVariables: variables,
      metadata: {
        templateId: template.getId()!,
        templateName: template.getName(),
        complexityScore: template.getMetadata().complexityScore,
        estimatedTokens: template.getMetadata().estimatedTokens,
        version: template.getVersion()
      }
    }
  }
}