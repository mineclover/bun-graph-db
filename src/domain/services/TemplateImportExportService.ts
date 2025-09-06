/**
 * Template Import/Export Service
 * 
 * 템플릿의 JSON 내보내기/가져오기 기능을 담당하는 도메인 서비스
 */

import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import { QueryTemplate } from '../entities/QueryTemplate.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'
import type {
  TemplateExportFormat,
  TemplateImportResult,
  TemplateExportResult,
  TemplateImportOptions,
  TemplateExportOptions,
} from '@/core/types/TemplateExport.js'

export class TemplateImportExportService {
  constructor(private readonly templateRepository: IQueryTemplateRepository) {}

  /**
   * 템플릿을 JSON 형태로 내보내기
   */
  async exportTemplate(
    templateId: string,
    options: TemplateExportOptions = {}
  ): Promise<TemplateExportResult> {
    try {
      const template = await this.templateRepository.findById(templateId)
      
      if (!template) {
        return {
          success: false,
          errors: [`Template with ID '${templateId}' not found`],
        }
      }

      const exportFormat: TemplateExportFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        template: {
          // 기본 정보
          identifier: template.getIdentifier(),
          name: template.getName(),
          description: template.getDescription(),
          
          // 쿼리 정보
          query: template.getQueryText(),
          queryName: template.getQueryName(),
          operationType: template.getOperationType(),
          
          // 메타데이터
          variables: null, // QueryTemplate에는 variables 필드가 없음
          variablesSchema: template.getVariablesSchema(),
          defaultVariables: template.getDefaultVariables(),
          applicableTables: template.getApplicableTables(),
          complexityScore: template.getComplexityScore(),
          version: template.getVersion(),
          tags: template.getTags(),
        },
      }

      // 통계 정보 포함 여부
      if (options.includeStatistics) {
        exportFormat.template.statistics = {
          usageCount: template.getUsageCount(),
          avgExecutionTimeMs: template.getAvgExecutionTimeMs(),
          lastUsedAt: template.getLastUsedAt()?.toISOString() || null,
        }
      }

      // 버전 기반 파일명 생성 (타임스탬프 제거, 점을 하이픈으로 변경)
      const version = (template.getVersion() || '1-0-0').replace(/\./g, '-')
      const cleanIdentifier = template.getIdentifier().replace(/[^a-zA-Z0-9-]/g, '-').replace(/-\d+$/, '')
      const filename = `${cleanIdentifier}_v${version}.json`

      return {
        success: true,
        exportData: exportFormat,
        filename,
        errors: [],
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown export error'],
      }
    }
  }

  /**
   * 식별자로 템플릿을 JSON 형태로 내보내기
   */
  async exportTemplateByIdentifier(
    identifier: string,
    options: TemplateExportOptions = {}
  ): Promise<TemplateExportResult> {
    try {
      const template = await this.templateRepository.findByIdentifier(identifier)
      
      if (!template) {
        return {
          success: false,
          errors: [`Template with identifier '${identifier}' not found`],
        }
      }

      return this.exportTemplate(template.getId()!, options)
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown export error'],
      }
    }
  }

  /**
   * JSON 데이터로부터 템플릿 가져오기
   */
  async importTemplate(
    exportData: TemplateExportFormat,
    options: TemplateImportOptions = {}
  ): Promise<TemplateImportResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 버전 호환성 확인
      if (!this.isVersionCompatible(exportData.version)) {
        errors.push(`Unsupported export version: ${exportData.version}`)
        return { success: false, errors, warnings }
      }

      // 필수 필드 검증
      const validationErrors = this.validateImportData(exportData)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        return { success: false, errors, warnings }
      }

      let finalIdentifier = exportData.template.identifier

      // 기존 템플릿 존재 여부 확인
      const existingTemplate = await this.templateRepository.findByIdentifier(finalIdentifier)
      
      if (existingTemplate) {
        if (options.overwriteExisting) {
          warnings.push(`Overwriting existing template: ${finalIdentifier}`)
        } else if (options.generateNewIdentifier) {
          finalIdentifier = this.generateUniqueIdentifier(
            exportData.template.identifier,
            options.newIdentifierPrefix
          )
          warnings.push(`Generated new identifier: ${finalIdentifier}`)
        } else {
          errors.push(`Template with identifier '${finalIdentifier}' already exists`)
          return { success: false, errors, warnings }
        }
      }

      // 새 템플릿 생성
      const newTemplate = QueryTemplate.create(
        finalIdentifier,
        exportData.template.name,
        exportData.template.query,
        exportData.template.tags,
        {
          description: exportData.template.description,
          variablesSchema: exportData.template.variablesSchema,
          defaultVariables: exportData.template.defaultVariables,
          applicableTables: exportData.template.applicableTables,
          complexityScore: exportData.template.complexityScore,
          version: exportData.template.version,
        }
      )

      // 기존 템플릿 덮어쓰기 또는 새 템플릿 생성
      let createdTemplate: QueryTemplate
      
      if (existingTemplate && options.overwriteExisting) {
        // 업데이트 로직 (현재는 삭제 후 재생성)
        await this.templateRepository.delete(existingTemplate.getId()!)
        createdTemplate = await this.templateRepository.create(newTemplate)
      } else {
        createdTemplate = await this.templateRepository.create(newTemplate)
      }

      return {
        success: true,
        templateId: createdTemplate.getId()!,
        template: {
          id: createdTemplate.getId()!,
          identifier: createdTemplate.getIdentifier(),
          name: createdTemplate.getName(),
        },
        errors,
        warnings,
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown import error')
      return { success: false, errors, warnings }
    }
  }

  /**
   * JSON 문자열로부터 템플릿 가져오기
   */
  async importTemplateFromJSON(
    jsonString: string,
    options: TemplateImportOptions = {}
  ): Promise<TemplateImportResult> {
    try {
      const exportData = JSON.parse(jsonString) as TemplateExportFormat
      return this.importTemplate(exportData, options)
    } catch (parseError) {
      return {
        success: false,
        errors: ['Invalid JSON format'],
        warnings: [],
      }
    }
  }

  /**
   * 버전 호환성 확인
   */
  private isVersionCompatible(version: string): boolean {
    const supportedVersions = ['1.0.0']
    return supportedVersions.includes(version)
  }

  /**
   * Import 데이터 검증
   */
  private validateImportData(exportData: TemplateExportFormat): string[] {
    const errors: string[] = []

    if (!exportData.template) {
      errors.push('Missing template data')
      return errors
    }

    const template = exportData.template

    // 필수 필드 검증
    if (!template.identifier || template.identifier.trim() === '') {
      errors.push('Template identifier is required')
    }

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required')
    }

    if (!template.query || template.query.trim() === '') {
      errors.push('Template query is required')
    }

    if (!template.operationType || !['query', 'mutation', 'subscription'].includes(template.operationType)) {
      errors.push('Valid operation type is required (query, mutation, subscription)')
    }

    if (!template.tags || !Array.isArray(template.tags) || template.tags.length === 0) {
      errors.push('At least one tag is required')
    }

    // identifier 형식 검증
    if (template.identifier && !/^[a-z0-9-_]+$/.test(template.identifier)) {
      errors.push('Template identifier must contain only lowercase letters, numbers, hyphens, and underscores')
    }

    return errors
  }

  /**
   * 고유한 identifier 생성
   */
  private generateUniqueIdentifier(originalIdentifier: string, prefix?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const randomSuffix = Math.random().toString(36).substr(2, 4)
    
    if (prefix) {
      return `${prefix}-${originalIdentifier}-${timestamp}-${randomSuffix}`
    }
    
    return `${originalIdentifier}-import-${timestamp}-${randomSuffix}`
  }
}