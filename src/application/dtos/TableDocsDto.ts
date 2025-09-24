import type { QueryTemplateDto } from '@/presentation/dto/QueryTemplateDto.js'
import type { AttributeDto } from './AttributeDto.js'
import type { NodeDto } from './NodeDto.js'
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
  generatedAt: string
}

export interface GetTableDocsInput {
  tableId?: string
  identifier?: string
  includeSampleNodes?: boolean
  includeUsageStats?: boolean
  includeRelatedTemplates?: boolean
  includeDocs?: boolean // Add docs collection option
  sampleLimit?: number
}

export interface GetTableDocsOutput {
  tableDocs: TableDocsDto | null
}
