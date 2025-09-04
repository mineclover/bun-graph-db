import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/shared/types/common.js'
import type { RelationDirection } from '@/domain/value-objects/RelationQuery.js'

export interface SearchFilter {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'exists' | 'notExists'
  value?: any
  values?: any[]
}

export interface AggregationConfig {
  field: string
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct_count'
  groupBy?: string[]
}

export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

export interface AdvancedSearchInput {
  tableId: string
  filters?: SearchFilter[]
  relationFilters?: {
    relationTypes?: string[]
    direction?: RelationDirection
    depth?: number
    targetFilters?: SearchFilter[]
  }[]
  aggregations?: AggregationConfig[]
  sort?: SortConfig[]
  limit?: number
  offset?: number
  includeRelationCount?: boolean
  includeAttributes?: boolean
  timeRange?: {
    startDate?: Date
    endDate?: Date
  }
}

export interface SearchResult {
  nodes: Array<{
    id: string
    content: string
    title?: string
    tableId: string
    createdAt: Date
    updatedAt: Date
    relationCount?: number
    attributes?: Record<string, any>
    score?: number
  }>
  aggregations?: Record<string, any>
  totalCount: number
  hasNextPage: boolean
  executionTime: number
}

export class AdvancedSearchUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: AdvancedSearchInput): Promise<SearchResult> {
    const startTime = Date.now()
    
    try {
      this.logger.info('Executing advanced search', {
        tableId: input.tableId,
        filterCount: input.filters?.length || 0,
        relationFilterCount: input.relationFilters?.length || 0,
        aggregationCount: input.aggregations?.length || 0
      })

      // Validate table exists
      const table = await this.tableRepository.findById(input.tableId as TableId)
      if (!table) {
        throw new Error(`Table with id '${input.tableId}' not found`)
      }

      // Build base query with filters
      let whereConditions: string[] = ['1=1']
      let queryParams: any[] = []
      let paramIndex = 1

      // Apply filters
      if (input.filters) {
        for (const filter of input.filters) {
          const condition = this.buildFilterCondition(filter, paramIndex)
          whereConditions.push(condition.sql)
          queryParams.push(...condition.params)
          paramIndex += condition.params.length
        }
      }

      // Apply time range filter
      if (input.timeRange) {
        if (input.timeRange.startDate) {
          whereConditions.push(`created_at >= $${paramIndex}`)
          queryParams.push(input.timeRange.startDate.toISOString())
          paramIndex++
        }
        if (input.timeRange.endDate) {
          whereConditions.push(`created_at <= $${paramIndex}`)
          queryParams.push(input.timeRange.endDate.toISOString())
          paramIndex++
        }
      }

      // Build relation filters if specified
      let relationJoins = ''
      if (input.relationFilters && input.relationFilters.length > 0) {
        for (let i = 0; i < input.relationFilters.length; i++) {
          const relFilter = input.relationFilters[i]
          const alias = `rel${i}`
          
          relationJoins += `
            INNER JOIN node_relations ${alias} ON (
              (${alias}.source_node_id = nodes.id OR ${alias}.target_node_id = nodes.id)
              AND ${alias}.table_id = $${paramIndex}
            )`
          queryParams.push(input.tableId)
          paramIndex++

          if (relFilter.relationTypes && relFilter.relationTypes.length > 0) {
            const placeholders = relFilter.relationTypes.map(() => `$${paramIndex++}`).join(',')
            relationJoins += ` AND ${alias}.relation_type_id IN (${placeholders})`
            queryParams.push(...relFilter.relationTypes)
          }
        }
      }

      // Build aggregation queries
      const aggregations: Record<string, any> = {}
      if (input.aggregations && input.aggregations.length > 0) {
        for (const agg of input.aggregations) {
          const aggResult = await this.executeAggregation(agg, input.tableId, whereConditions, queryParams)
          aggregations[`${agg.field}_${agg.operation}`] = aggResult
        }
      }

      // Build main query
      let selectFields = `
        nodes.id,
        nodes.content,
        nodes.title,
        nodes.table_id as tableId,
        nodes.created_at as createdAt,
        nodes.updated_at as updatedAt
      `

      // Add relation count if requested
      if (input.includeRelationCount) {
        selectFields += `,
          (SELECT COUNT(*) FROM node_relations nr 
           WHERE nr.source_node_id = nodes.id OR nr.target_node_id = nodes.id) as relationCount`
      }

      // Build sort clause
      let sortClause = 'ORDER BY nodes.created_at DESC'
      if (input.sort && input.sort.length > 0) {
        const sortParts = input.sort.map(s => `nodes.${s.field} ${s.direction.toUpperCase()}`)
        sortClause = `ORDER BY ${sortParts.join(', ')}`
      }

      // Build pagination
      const limit = input.limit || 50
      const offset = input.offset || 0
      
      const mainQuery = `
        SELECT ${selectFields}
        FROM nodes
        ${relationJoins}
        WHERE nodes.table_id = $${paramIndex} AND ${whereConditions.join(' AND ')}
        GROUP BY nodes.id
        ${sortClause}
        LIMIT ${limit} OFFSET ${offset}
      `
      
      queryParams.push(input.tableId)

      // Execute main query
      const nodes = await this.nodeRepository.executeRawQuery(mainQuery, queryParams)

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT nodes.id) as total
        FROM nodes
        ${relationJoins}
        WHERE nodes.table_id = $${queryParams.length} AND ${whereConditions.join(' AND ')}
      `
      
      const countResult = await this.nodeRepository.executeRawQuery(countQuery, queryParams)
      const totalCount = countResult[0]?.total || 0

      // Process results
      const processedNodes = nodes.map((node: any) => ({
        id: node.id,
        content: node.content,
        title: node.title,
        tableId: node.tableId,
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(node.updatedAt),
        relationCount: node.relationCount || undefined,
        score: this.calculateRelevanceScore(node, input)
      }))

      const executionTime = Date.now() - startTime

      this.logger.info('Advanced search completed', {
        tableId: input.tableId,
        resultCount: processedNodes.length,
        totalCount,
        executionTime
      })

      return {
        nodes: processedNodes,
        aggregations: Object.keys(aggregations).length > 0 ? aggregations : undefined,
        totalCount,
        hasNextPage: (offset + limit) < totalCount,
        executionTime
      }

    } catch (error) {
      this.logger.error('Failed to execute advanced search', { input, error })
      throw error
    }
  }

  private buildFilterCondition(filter: SearchFilter, paramIndex: number): { sql: string, params: any[] } {
    const field = `nodes.${filter.field}`
    
    switch (filter.operator) {
      case 'eq':
        return { sql: `${field} = $${paramIndex}`, params: [filter.value] }
      case 'neq':
        return { sql: `${field} != $${paramIndex}`, params: [filter.value] }
      case 'gt':
        return { sql: `${field} > $${paramIndex}`, params: [filter.value] }
      case 'lt':
        return { sql: `${field} < $${paramIndex}`, params: [filter.value] }
      case 'gte':
        return { sql: `${field} >= $${paramIndex}`, params: [filter.value] }
      case 'lte':
        return { sql: `${field} <= $${paramIndex}`, params: [filter.value] }
      case 'contains':
        return { sql: `${field} LIKE $${paramIndex}`, params: [`%${filter.value}%`] }
      case 'startsWith':
        return { sql: `${field} LIKE $${paramIndex}`, params: [`${filter.value}%`] }
      case 'endsWith':
        return { sql: `${field} LIKE $${paramIndex}`, params: [`%${filter.value}`] }
      case 'in':
        if (!filter.values || filter.values.length === 0) {
          return { sql: '1=0', params: [] }
        }
        const placeholders = filter.values.map((_, i) => `$${paramIndex + i}`).join(',')
        return { sql: `${field} IN (${placeholders})`, params: filter.values }
      case 'notIn':
        if (!filter.values || filter.values.length === 0) {
          return { sql: '1=1', params: [] }
        }
        const notInPlaceholders = filter.values.map((_, i) => `$${paramIndex + i}`).join(',')
        return { sql: `${field} NOT IN (${notInPlaceholders})`, params: filter.values }
      case 'exists':
        return { sql: `${field} IS NOT NULL`, params: [] }
      case 'notExists':
        return { sql: `${field} IS NULL`, params: [] }
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`)
    }
  }

  private async executeAggregation(
    agg: AggregationConfig,
    tableId: string,
    whereConditions: string[],
    params: any[]
  ): Promise<any> {
    let aggregationSQL: string
    const field = agg.field === '*' ? '*' : `nodes.${agg.field}`

    switch (agg.operation) {
      case 'count':
        aggregationSQL = `COUNT(${field})`
        break
      case 'sum':
        aggregationSQL = `SUM(${field})`
        break
      case 'avg':
        aggregationSQL = `AVG(${field})`
        break
      case 'min':
        aggregationSQL = `MIN(${field})`
        break
      case 'max':
        aggregationSQL = `MAX(${field})`
        break
      case 'distinct_count':
        aggregationSQL = `COUNT(DISTINCT ${field})`
        break
      default:
        throw new Error(`Unsupported aggregation operation: ${agg.operation}`)
    }

    let selectClause = `SELECT ${aggregationSQL} as result`
    let groupByClause = ''

    if (agg.groupBy && agg.groupBy.length > 0) {
      const groupByFields = agg.groupBy.map(f => `nodes.${f}`).join(', ')
      selectClause = `SELECT ${groupByFields}, ${aggregationSQL} as result`
      groupByClause = `GROUP BY ${groupByFields}`
    }

    const query = `
      ${selectClause}
      FROM nodes
      WHERE nodes.table_id = $${params.length + 1} AND ${whereConditions.join(' AND ')}
      ${groupByClause}
    `

    const result = await this.nodeRepository.executeRawQuery(query, [...params, tableId])
    
    if (agg.groupBy && agg.groupBy.length > 0) {
      return result
    } else {
      return result[0]?.result || 0
    }
  }

  private calculateRelevanceScore(node: any, input: AdvancedSearchInput): number {
    // Simple relevance scoring based on available data
    let score = 1.0

    // Boost score for nodes with more relations
    if (node.relationCount) {
      score += Math.log(node.relationCount + 1) * 0.1
    }

    // Boost score for newer nodes
    const daysSinceCreation = (Date.now() - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, (30 - daysSinceCreation) / 30) * 0.2

    return Math.min(10, score)
  }
}