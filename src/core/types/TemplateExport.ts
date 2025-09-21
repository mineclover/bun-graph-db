/**
 * Template Export/Import Types
 *
 * JSON으로 내보내기/가져오기를 위한 타입 정의
 */

export interface TemplateExportFormat {
  version: string
  exportedAt: string
  template: {
    // 기본 정보
    identifier: string
    name: string
    description: string | null

    // 쿼리 정보
    query: string
    queryName: string[]
    operationType: 'query' | 'mutation' | 'subscription'

    // 메타데이터
    variables: Record<string, unknown> | null
    inputSchema: QueryVariablesSchema | null
    defaultVariables: Record<string, unknown> | null
    applicableTables: string[] | null
    complexityScore: number
    version: string
    tags: string[]
    isActive: boolean

    // 선택적 통계 정보 (export 시에만 포함)
    statistics?: {
      usageCount: number
      avgExecutionTimeMs: number
      lastUsedAt: string | null
    }
  }
}

export interface QueryVariablesSchema {
  type: string
  properties: Record<
    string,
    {
      type: string
      description?: string
      default?: unknown
      enum?: unknown[]
    }
  >
  required?: string[]
}

export interface TemplateImportResult {
  success: boolean
  templateId?: string
  template?: {
    id: string
    identifier: string
    name: string
  }
  errors: string[]
  warnings: string[]
}

export interface TemplateExportResult {
  success: boolean
  exportData?: TemplateExportFormat
  filename?: string
  errors: string[]
}

// Import 옵션
export interface TemplateImportOptions {
  overwriteExisting?: boolean // 기존 템플릿 덮어쓰기 여부
  preserveStatistics?: boolean // 통계 정보 보존 여부 (기본: false)
  generateNewIdentifier?: boolean // 새 identifier 생성 여부
  newIdentifierPrefix?: string // 새 identifier 접두사
}

// Export 옵션
export interface TemplateExportOptions {
  includeStatistics?: boolean // 통계 정보 포함 여부 (기본: false)
  includeMetadata?: boolean // 메타데이터 포함 여부 (기본: true)
  prettyPrint?: boolean // JSON 포맷팅 여부 (기본: true)
}

/**
 * Batch export types for multiple templates
 */
export interface ExportedTemplateInfo {
  templateId: string
  templateIdentifier: string
  templateName: string
  filename: string
  exportSuccess: boolean
  exportError?: string
}

export interface BatchTemplateExportResult {
  success: boolean
  exportedTemplates: ExportedTemplateInfo[]
  totalCount: number
  outputDirectory?: string
  errors: string[]
}

export interface BatchTemplateExportOptions extends TemplateExportOptions {
  outputDirectory?: string // 출력 디렉토리 (기본: exported-templates)
}
