import type { QueryTemplateDto } from './QueryTemplateDto.js'
import type { AttributeDto } from './AttributeDto.js'
import type { TableDto } from './TableDto.js'

export interface DocDto {
  id: string
  title: string
  content: string
  type: 'usage' | 'guide' | 'example' | 'spec' | 'general'
  createdAt: string
  updatedAt: string
}

export interface TableDocsDto {
  table: TableDto
  schema: {
    attributes: AttributeDto[]
    attributeCount: number
  }
  docs?: {
    usage?: DocDto
    guide?: DocDto
    example?: DocDto
    spec?: DocDto
    general?: DocDto
    allDocs: DocDto[]
    docCount: number
  }
  relatedTemplates?: QueryTemplateDto[]
  aiMetadata?: {
    // AI가 이해할 수 있는 구조화된 정보
    schemaInfo: {
      dataTypes: { [key: string]: string } // attribute -> dataType mapping
      requiredFields: string[] // 필수 속성들
      searchableFields: string[] // 검색 가능한 속성들
      relationshipCapabilities: string[] // 가능한 관계 타입들
    }
    usagePatterns: {
      commonQueries: { pattern: string; description: string; example: string }[]
      templateRecommendations: { templateId: string; useCase: string }[]
      queryComplexity: 'simple' | 'moderate' | 'complex'
    }
    sampleData?: {
      nodes: Array<{
        id: string
        content: string
        attributes: { [key: string]: any }
      }>
      relationships: Array<{
        from: string
        to: string
        type: string
      }>
    }
  }
  generatedAt: string
}

export interface GetTableDocsInput {
  tableId?: string
  identifier?: string
  includeSampleNodes?: boolean
  includeUsageStats?: boolean
  includeRelatedTemplates?: boolean
  includeDocs?: boolean // Add docs collection option
  includeAiMetadata?: boolean // AI-friendly 메타데이터 포함 여부
  sampleLimit?: number
}

export interface GetTableDocsOutput {
  tableDocs: TableDocsDto | null
}
