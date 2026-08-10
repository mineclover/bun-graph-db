import type { Database } from 'bun:sqlite'
import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'
import { buildMultiCriteriaSort, type SortOption } from '@/application/services/sorting/SortStrategyFactory.js'
import type { INodeSearchRepository } from '@/application/use-cases/nodes/SearchNodes.js'
import type { PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type { RangeValue, SearchFilter, SearchOperator, SearchQuery } from '@/domain/value-objects/SearchFilter.js'
import type { SortContext } from '@/domain/value-objects/SortStrategy.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { parseSafeJson, type SafeJsonValue } from '@/shared/utils/safeJson.js'

interface NodeWithAttributesRow {
  node_id: string
  node_table_id: string
  node_content: string
  node_title: string | null
  node_description: string | null
  node_metadata: string | null
  node_created_at: string
  node_updated_at: string
  attribute_id: string | null
  attribute_identifier: string | null
  attribute_value: string | null
  attribute_data_type: string | null
  relevance_score: number | null
}

export interface NodeSearchResult {
  node: Node
  attributes: Record<string, SafeJsonValue>
  relevanceScore?: number
}

type SqliteParam = string | number | boolean | null
type SqliteParams = SqliteParam[]

export class SqliteNodeSearchRepository implements INodeSearchRepository {
  constructor(private readonly db: Database) {}

  async searchNodes(
    tableId: TableId,
    searchQuery: SearchQuery,
    availableAttributes: AttributeTypeInfo[],
  ): Promise<PaginatedResult<NodeSearchResult>> {
    try {
      const fullTextIndexAvailable = this.hasFullTextIndex()
      // Build the SQL query from the search query
      const { query: dataQuery, params: dataParams } = this.buildSearchQuery(
        tableId,
        searchQuery,
        availableAttributes,
        false,
        fullTextIndexAvailable,
      )

      const { query: countQuery, params: countParams } = this.buildSearchQuery(
        tableId,
        searchQuery,
        availableAttributes,
        true,
        fullTextIndexAvailable,
      )

      // Execute count query
      const countResult = this.db.query<{ count: number }, SqliteParams>(countQuery).get(...countParams)
      const total = countResult?.count || 0

      // Execute data query
      const rows = this.db.query<NodeWithAttributesRow, SqliteParams>(dataQuery).all(...dataParams)

      // Group results by node
      const nodeMap = new Map<string, NodeSearchResult>()

      for (const row of rows) {
        if (!nodeMap.has(row.node_id)) {
          nodeMap.set(row.node_id, {
            node: Node.fromDatabase(
              row.node_id,
              row.node_table_id,
              row.node_content,
              row.node_title,
              row.node_description,
              row.node_metadata ?? null,
              new Date(row.node_created_at),
              new Date(row.node_updated_at),
            ),
            attributes: {},
            relevanceScore: row.relevance_score === null ? undefined : Math.max(0, -row.relevance_score),
          })
        }

        const nodeResult = nodeMap.get(row.node_id)
        if (!nodeResult) {
          continue
        }

        // Add attribute value if present
        if (row.attribute_identifier && row.attribute_value !== null) {
          nodeResult.attributes[row.attribute_identifier] = this.parseAttributeValue(
            row.attribute_value,
            row.attribute_data_type || 'string',
          )
        }
      }

      const data = Array.from(nodeMap.values())
      const limit = searchQuery.limit || 10
      const offset = searchQuery.offset || 0

      return {
        nodes: data,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to search nodes: ${error}`)
    }
  }

  private buildSearchQuery(
    tableId: TableId,
    searchQuery: SearchQuery,
    availableAttributes: AttributeTypeInfo[],
    isCountQuery: boolean,
    fullTextIndexAvailable: boolean,
  ): { query: string; params: SqliteParams } {
    const params: SqliteParams = [tableId]

    const usesFullTextSearch = fullTextIndexAvailable && this.usesTextSearch(searchQuery)

    // Base query structure
    let query = isCountQuery
      ? 'SELECT COUNT(DISTINCT n.id) as count'
      : `SELECT DISTINCT n.id as node_id, n.table_id as node_table_id, 
                n.content as node_content, n.title as node_title, n.description as node_description,
                n.metadata as node_metadata,
                n.created_at as node_created_at, n.updated_at as node_updated_at,
                a.id as attribute_id, a.identifier as attribute_identifier, 
                nav.value as attribute_value, at.json_type as attribute_data_type,
                ${usesFullTextSearch ? 'bm25(node_search_fts)' : 'NULL'} as relevance_score`

    query += `
      FROM nodes n
      LEFT JOIN node_attributes nav ON n.id = nav.node_id
      LEFT JOIN attributes a ON nav.attribute_id = a.id
      LEFT JOIN attribute_types at ON a.attribute_type_id = at.id
      ${usesFullTextSearch ? 'LEFT JOIN node_search_fts ON node_search_fts.node_id = n.id' : ''}
      WHERE n.table_id = ?`

    // Add search conditions
    if (searchQuery.conditions && searchQuery.conditions.length > 0) {
      const conditionClauses = searchQuery.conditions.map((condition) => {
        const filterClauses = condition.filters.map((filter) => {
          return this.buildFilterClause(filter, availableAttributes, params, fullTextIndexAvailable, tableId)
        })

        return `(${filterClauses.join(` ${condition.logicalOperator.toUpperCase()} `)})`
      })

      query += ` AND (${conditionClauses.join(' AND ')})`
    }

    // Add text search if present
    if (searchQuery.textSearch) {
      if (fullTextIndexAvailable) {
        query += ` AND n.id IN (SELECT node_id FROM node_search_fts WHERE table_id = ? AND node_search_fts MATCH ?)`
        params.push(tableId, this.toFtsQuery(searchQuery.textSearch))
      } else {
        query += ` AND (n.content LIKE ? OR nav.value LIKE ?)`
        params.push(`%${searchQuery.textSearch}%`, `%${searchQuery.textSearch}%`)
      }
    }

    // Add enhanced sorting for data queries using SortStrategyFactory
    if (!isCountQuery) {
      if (searchQuery.sortBy && searchQuery.sortBy.length > 0) {
        const sortOptions: SortOption[] = searchQuery.sortBy.map((sort) => ({
          field: sort.field,
          direction: sort.direction,
        }))

        const sortContext: SortContext = {
          availableAttributes,
          tableAlias: 'tables',
          nodeAlias: 'n',
          attributeAlias: 'nav',
        }

        const multiSortResult = buildMultiCriteriaSort(sortOptions, sortContext)

        if (multiSortResult.sqlClause) {
          query += ` ${multiSortResult.sqlClause}`
          for (const parameter of multiSortResult.parameters) {
            params.push(this.toSqliteParam(parameter))
          }
        } else {
          // Fallback to default sorting
          query += ' ORDER BY n.created_at DESC'
        }
      } else if (usesFullTextSearch) {
        query += ' ORDER BY bm25(node_search_fts), n.id ASC'
      } else {
        query += ' ORDER BY n.created_at DESC'
      }

      // Add pagination
      const limit = searchQuery.limit || 10
      const offset = searchQuery.offset || 0
      query += ` LIMIT ? OFFSET ?`
      params.push(limit, offset)
    }

    return { query, params }
  }

  private buildFilterClause(
    filter: SearchFilter,
    availableAttributes: AttributeTypeInfo[],
    params: SqliteParams,
    fullTextIndexAvailable: boolean,
    tableId: TableId,
  ): string {
    // Handle text search - search both content and attribute values
    if (filter.field === '_text_search') {
      if (fullTextIndexAvailable) {
        params.push(tableId, this.toFtsQuery(filter.value))
        return 'n.id IN (SELECT node_id FROM node_search_fts WHERE table_id = ? AND node_search_fts MATCH ?)'
      }
      params.push(`%${filter.value}%`, `%${filter.value}%`)
      return '(n.content LIKE ? OR nav.value LIKE ?)'
    }

    // Find attribute type
    const attributeInfo = availableAttributes.find((attr) => attr.identifier === filter.field)
    if (!attributeInfo) {
      throw new DatabaseException(`Unknown attribute: ${filter.field}`)
    }

    // Build filter based on operator
    const baseCondition = `(a.identifier = ? AND `
    params.push(filter.field)

    switch (filter.operator as SearchOperator) {
      case 'equals':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition}nav.value = ?)`

      case 'not_equals':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition}nav.value != ?)`

      case 'contains':
        params.push(`%${filter.value}%`)
        return `${baseCondition}nav.value LIKE ?)`

      case 'starts_with':
        params.push(`${filter.value}%`)
        return `${baseCondition}nav.value LIKE ?)`

      case 'ends_with':
        params.push(`%${filter.value}`)
        return `${baseCondition}nav.value LIKE ?)`

      case 'gt':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '>')})`

      case 'gte':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '>=')})`

      case 'lt':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '<')})`

      case 'lte':
        params.push(this.toSqliteParam(filter.value))
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '<=')})`

      case 'range': {
        if (!this.isRangeValue(filter.value)) {
          throw new DatabaseException(`Invalid range filter for ${filter.field}`)
        }

        const range = filter.value as RangeValue
        params.push(this.toSqliteParam(range.min), this.toSqliteParam(range.max))
        return `${baseCondition + this.buildRangeClause(attributeInfo.dataType)})`
      }

      case 'in': {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        const placeholders = values.map(() => '?').join(',')
        for (const value of values) {
          params.push(this.toSqliteParam(value))
        }
        return `${baseCondition}nav.value IN (${placeholders}))`
      }

      case 'not_in': {
        const notValues = Array.isArray(filter.value) ? filter.value : [filter.value]
        const notPlaceholders = notValues.map(() => '?').join(',')
        for (const value of notValues) {
          params.push(this.toSqliteParam(value))
        }
        return `${baseCondition}nav.value NOT IN (${notPlaceholders}))`
      }

      case 'is_null':
        return `${baseCondition}nav.value IS NULL)`

      case 'is_not_null':
        return `${baseCondition}nav.value IS NOT NULL)`

      default:
        throw new DatabaseException(`Unsupported operator: ${filter.operator}`)
    }
  }

  private hasFullTextIndex(): boolean {
    const result = this.db
      .query<{ name: string }, [string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('node_search_fts')
    return Boolean(result)
  }

  private usesTextSearch(searchQuery: SearchQuery): boolean {
    return Boolean(
      searchQuery.textSearch ||
        searchQuery.conditions.some((condition) => condition.filters.some((filter) => filter.field === '_text_search')),
    )
  }

  private toFtsQuery(value: unknown): string {
    const terms = String(value)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term.replaceAll('"', '""')}"`)

    return terms.length > 0 ? terms.join(' AND ') : '""'
  }

  private buildComparisonClause(dataType: string, operator: string): string {
    switch (dataType) {
      case 'number':
        return `CAST(nav.value AS REAL) ${operator} ?`
      case 'datetime':
        return `datetime(nav.value) ${operator} datetime(?)`
      case 'boolean':
        return `CAST(nav.value AS INTEGER) ${operator} ?`
      default:
        return `nav.value ${operator} ?`
    }
  }

  private buildRangeClause(dataType: string): string {
    switch (dataType) {
      case 'number':
        return 'CAST(nav.value AS REAL) BETWEEN ? AND ?'
      case 'datetime':
        return 'datetime(nav.value) BETWEEN datetime(?) AND datetime(?)'
      default:
        return 'nav.value BETWEEN ? AND ?'
    }
  }

  private parseAttributeValue(value: string, dataType: string): SafeJsonValue {
    switch (dataType) {
      case 'number': {
        const num = Number(value)
        return Number.isNaN(num) ? value : num
      }

      case 'boolean':
        if (value === 'true' || value === '1') {
          return true
        }
        if (value === 'false' || value === '0') {
          return false
        }
        return value

      case 'datetime':
        try {
          return new Date(value).toISOString()
        } catch {
          return value
        }

      case 'json':
        try {
          return parseSafeJson(value) ?? value
        } catch {
          return value
        }

      default:
        return value
    }
  }

  private isRangeValue(value: unknown): value is RangeValue {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    return 'min' in value && 'max' in value
  }

  private toSqliteParam(value: unknown): SqliteParam {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    return JSON.stringify(value)
  }
}
