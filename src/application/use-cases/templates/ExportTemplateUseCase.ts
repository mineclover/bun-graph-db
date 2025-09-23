/**
 * Export Template Use Case
 *
 * 템플릿을 JSON 형태로 내보내는 유스케이스
 */

import type { ILogger } from '@/application/ports/ILogger.js'
import type { TemplateExportOptions, TemplateExportResult } from '@/core/types/TemplateExport.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { TemplateImportExportService } from '@/domain/services/TemplateImportExportService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'

export interface ExportTemplateRequest {
  templateId?: string
  templateIdentifier?: string
  options?: TemplateExportOptions
}

export class ExportTemplateUseCase {
  private importExportService: TemplateImportExportService

  constructor(
    readonly templateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {
    this.importExportService = new TemplateImportExportService(templateRepository)
  }

  async execute(request: ExportTemplateRequest): Promise<TemplateExportResult> {
    const { templateId, templateIdentifier, options = {} } = request

    try {
      this.logger.info('Exporting template', { templateId, templateIdentifier })

      // ID 또는 식별자 중 하나는 필수
      if (!templateId && !templateIdentifier) {
        return {
          success: false,
          errors: ['Either templateId or templateIdentifier is required'],
        }
      }

      // ID로 내보내기
      if (templateId) {
        const result = await this.importExportService.exportTemplate(templateId, options)

        if (result.success) {
          this.logger.info('Template exported successfully', {
            templateId,
            filename: result.filename,
            includeStatistics: options.includeStatistics,
          })
        } else {
          this.logger.error('Template export failed', { templateId, errors: result.errors })
        }

        return result
      }

      // 식별자로 내보내기
      if (templateIdentifier) {
        const result = await this.importExportService.exportTemplateByIdentifier(
          templateIdentifier,
          options
        )

        if (result.success) {
          this.logger.info('Template exported successfully', {
            templateIdentifier,
            filename: result.filename,
            includeStatistics: options.includeStatistics,
          })
        } else {
          this.logger.error('Template export failed', {
            templateIdentifier,
            errors: result.errors,
          })
        }

        return result
      }

      // 이론적으로 도달할 수 없는 코드
      return {
        success: false,
        errors: ['Invalid request parameters'],
      }
    } catch (error) {
      this.logger.error('Unexpected error during template export', {
        ...toErrorMeta(error),
        request,
      })

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      }
    }
  }
}
