import type { QueryTemplate } from '../entities/QueryTemplate.js'

export interface SearchCriteria {
  tags?: string[]
  tagMatchMode?: 'ANY' | 'ALL'
  applicableToTable?: string
  includeUniversal?: boolean
  templateType?: string
  isActive?: boolean
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface IQueryTemplateRepository {
  findById(id: string): Promise<QueryTemplate | null>
  findByIdentifier(identifier: string): Promise<QueryTemplate | null>
  search(criteria: SearchCriteria): Promise<{
    items: QueryTemplate[]
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }>
  create(template: QueryTemplate): Promise<QueryTemplate>
  update(id: string, updates: Partial<QueryTemplate>): Promise<QueryTemplate>
  delete(id: string): Promise<boolean>
  incrementUsage(id: string): Promise<void>
  findPopular(limit?: number): Promise<QueryTemplate[]>
  updateStatus(id: string, isActive: boolean): Promise<QueryTemplate>
}
