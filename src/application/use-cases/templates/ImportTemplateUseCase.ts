/**
 * Import Template Use Case
 *
 * JSON 데이터로부터 템플릿을 가져오는 유스케이스
 */

import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  TemplateExportFormat,
  TemplateImportOptions,
  TemplateImportResult,
} from '@/core/types/TemplateExport.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { TemplateImportExportService } from '@/domain/services/TemplateImportExportService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'

export interface ImportTemplateRequest {
  jsonData?: TemplateExportFormat
  jsonString?: string
  options?: TemplateImportOptions
}

export class ImportTemplateUseCase {
  private importExportService: TemplateImportExportService

  constructor(
    readonly templateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {
    this.importExportService = new TemplateImportExportService(templateRepository)
  }

  async execute(request: ImportTemplateRequest): Promise<TemplateImportResult> {
    const { jsonData, jsonString, options = {} } = request

    try {
      this.logger.info('Importing template', {
        hasJsonData: !!jsonData,
        hasJsonString: !!jsonString,
        options,
      })

      // JSON 데이터 또는 JSON 문자열 중 하나는 필수
      if (!jsonData && !jsonString) {
        return {
          success: false,
          errors: ['Either jsonData or jsonString is required'],
          warnings: [],
        }
      }

      let result: TemplateImportResult

      // JSON 데이터 객체로부터 가져오기
      if (jsonData) {
        result = await this.importExportService.importTemplate(jsonData, options)
      }
      // JSON 문자열로부터 가져오기
      else if (jsonString) {
        result = await this.importExportService.importTemplateFromJSON(jsonString, options)
      } else {
        // 이론적으로 도달할 수 없는 코드
        return {
          success: false,
          errors: ['Invalid request parameters'],
          warnings: [],
        }
      }

      if (result.success) {
        this.logger.info('Template imported successfully', {
          templateId: result.templateId,
          templateIdentifier: result.template?.identifier,
          templateName: result.template?.name,
          warnings: result.warnings,
        })

        // 경고가 있으면 로그에 기록
        if (result.warnings.length > 0) {
          this.logger.warn('Template import completed with warnings', {
            warnings: result.warnings,
          })
        }
      } else {
        this.logger.error('Template import failed', {
          errors: result.errors,
          warnings: result.warnings,
        })
      }

      return result
    } catch (error) {
      this.logger.error('Unexpected error during template import', {
        ...toErrorMeta(error),
        request,
      })

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
      }
    }
  }
}
