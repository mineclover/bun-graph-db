import type { QueryTemplateDto } from '@/presentation/dto/QueryTemplateDto.js'
import type { AttributeDto } from './AttributeDto.js'
import type { NodeDto } from './NodeDto.js'
import type { TableDto } from './TableDto.js'

export interface TableDocsDto {
  table: TableDto
  schema: {
    attributes: AttributeDto[]
    attributeCount: number
  }
  sampleNodes?: NodeDto[]
  relatedTemplates?: QueryTemplateDto[]
  usageStats?: {
    totalNodes: number
    lastActivity: string | null
    createdToday: number
    updatedToday: number
  }
  documentation?: {
    description: string
    usageExamples: string[]
    bestPractices: string[]
  }
  generatedAt: string
}

export interface GetTableDocsInput {
  tableId?: string
  identifier?: string
  includeSampleNodes?: boolean
  includeUsageStats?: boolean
  includeRelatedTemplates?: boolean
  sampleLimit?: number
}

export interface GetTableDocsOutput {
  tableDocs: TableDocsDto | null
}
