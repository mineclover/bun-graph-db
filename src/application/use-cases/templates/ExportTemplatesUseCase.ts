/**
 * Export Templates Use Case
 *
 * 여러 템플릿을 필터링하여 한번에 내보내는 유스케이스
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  BatchTemplateExportOptions,
  BatchTemplateExportResult,
  ExportedTemplateInfo,
} from '@/core/types/TemplateExport.js'
import type {
  IQueryTemplateRepository,
  SearchCriteria,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { TemplateImportExportService } from '@/domain/services/TemplateImportExportService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'

export interface ExportTemplatesRequest {
  filter?: {
    tags?: string[]
    tagMatchMode?: 'ANY' | 'ALL'
    isActive?: boolean
  }
  options?: BatchTemplateExportOptions
}

export class ExportTemplatesUseCase {
  private importExportService: TemplateImportExportService

  constructor(
    readonly templateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {
    this.importExportService = new TemplateImportExportService(templateRepository)
  }

  async execute(request: ExportTemplatesRequest): Promise<BatchTemplateExportResult> {
    const { filter = {}, options = {} } = request
    const outputDirectory = options.outputDirectory || 'exported-templates'

    try {
      this.logger.info('Starting batch template export', { filter, options })

      // Search for templates matching the filter directly from repository
      const searchCriteria: SearchCriteria = {
        tags: filter.tags,
        tagMatchMode: filter.tagMatchMode,
        isActive: filter.isActive,
        limit: 100,
        offset: 0,
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }

      const searchResult = await this.templateRepository.search(searchCriteria)
      const templates = searchResult.items
      this.logger.info(`Found ${templates.length} templates to export`)

      if (templates.length === 0) {
        return {
          success: true,
          exportedTemplates: [],
          totalCount: 0,
          outputDirectory,
          errors: [],
        }
      }

      // Ensure output directory exists
      if (!existsSync(outputDirectory)) {
        mkdirSync(outputDirectory, { recursive: true })
      }

      // Export each template
      const exportedTemplates: ExportedTemplateInfo[] = []
      const exportErrors: string[] = []

      for (const template of templates) {
        try {
          const exportResult = await this.importExportService.exportTemplate(template.getId()!, {
            includeStatistics: options.includeStatistics,
            includeMetadata: options.includeMetadata,
            prettyPrint: options.prettyPrint,
          })

          if (exportResult.success && exportResult.exportData && exportResult.filename) {
            // Write file to disk
            const filePath = join(outputDirectory, exportResult.filename)
            writeFileSync(filePath, JSON.stringify(exportResult.exportData, null, 2), 'utf-8')

            exportedTemplates.push({
              templateId: template.getId()!,
              templateIdentifier: template.getIdentifier(),
              templateName: template.getName(),
              filename: exportResult.filename,
              exportSuccess: true,
            })

            this.logger.debug('Template exported successfully', {
              templateId: template.getId(),
              filename: exportResult.filename,
            })
          } else {
            const errorMessage = exportResult.errors.join(', ')
            exportedTemplates.push({
              templateId: template.getId()!,
              templateIdentifier: template.getIdentifier(),
              templateName: template.getName(),
              filename: '',
              exportSuccess: false,
              exportError: errorMessage,
            })

            exportErrors.push(
              `Failed to export template ${template.getIdentifier()}: ${errorMessage}`
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          exportedTemplates.push({
            templateId: template.getId()!,
            templateIdentifier: template.getIdentifier(),
            templateName: template.getName(),
            filename: '',
            exportSuccess: false,
            exportError: errorMessage,
          })

          exportErrors.push(
            `Failed to export template ${template.getIdentifier()}: ${errorMessage}`
          )
          this.logger.error('Template export failed', {
            templateId: template.getId(),
            ...toErrorMeta(new Error(errorMessage)),
          })
        }
      }

      const successCount = exportedTemplates.filter((t) => t.exportSuccess).length
      const failureCount = exportedTemplates.filter((t) => !t.exportSuccess).length

      this.logger.info('Batch template export completed', {
        totalTemplates: templates.length,
        successCount,
        failureCount,
        outputDirectory,
      })

      return {
        success: failureCount === 0,
        exportedTemplates,
        totalCount: templates.length,
        outputDirectory,
        errors: exportErrors,
      }
    } catch (error) {
      this.logger.error('Unexpected error during batch template export', { ...toErrorMeta(error), request })

      return {
        success: false,
        exportedTemplates: [],
        totalCount: 0,
        outputDirectory,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      }
    }
  }
}
