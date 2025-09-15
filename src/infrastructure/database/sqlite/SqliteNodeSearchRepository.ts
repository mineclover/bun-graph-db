import type { Database } from 'bun:sqlite'
import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'
import type { INodeSearchRepository } from '@/application/use-cases/nodes/SearchNodes.js'
import type { PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type { SearchOperator, SearchQuery } from '@/domain/value-objects/SearchFilter.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface NodeWithAttributesRow {
  node_id: string
  node_table_id: string
  node_content: string
  node_title: string | null
  node_description: string | null
  node_created_at: string
  node_updated_at: string
  attribute_id: string | null
  attribute_identifier: string | null
  attribute_value: string | null
  attribute_data_type: string | null
}

export interface NodeSearchResult {
  node: Node
  attributes: Record<string, any>
}

export class SqliteNodeSearchRepository implements INodeSearchRepository {
  constructor(private readonly db: Database) {}

  async searchNodes(
    tableId: TableId,
    searchQuery: SearchQuery,
    availableAttributes: AttributeTypeInfo[]
  ): Promise<PaginatedResult<NodeSearchResult>> {
    try {
      // Build the SQL query from the search query
      const { query: dataQuery, params: dataParams } = this.buildSearchQuery(
        tableId,
        searchQuery,
        availableAttributes,
        false
      )

      const { query: countQuery, params: countParams } = this.buildSearchQuery(
        tableId,
        searchQuery,
        availableAttributes,
        true
      )

      // Execute count query
      const countResult = this.db.query<{ count: number }, any[]>(countQuery).get(...countParams)
      const total = countResult?.count || 0

      // Execute data query
      const rows = this.db.query<NodeWithAttributesRow, any[]>(dataQuery).all(...dataParams)

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
              new Date(row.node_created_at),
              new Date(row.node_updated_at)
            ),
            attributes: {},
          })
        }

        const nodeResult = nodeMap.get(row.node_id)!

        // Add attribute value if present
        if (row.attribute_identifier && row.attribute_value !== null) {
          nodeResult.attributes[row.attribute_identifier] = this.parseAttributeValue(
            row.attribute_value,
            row.attribute_data_type || 'string'
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
    isCountQuery: boolean
  ): { query: string; params: any[] } {
    const params: any[] = [tableId]

    // Base query structure
    let query = isCountQuery
      ? 'SELECT COUNT(DISTINCT n.id) as count'
      : `SELECT DISTINCT n.id as node_id, n.table_id as node_table_id, 
                n.content as node_content, n.title as node_title, n.description as node_description,
                n.created_at as node_created_at, n.updated_at as node_updated_at,
                a.id as attribute_id, a.identifier as attribute_identifier, 
                nav.value as attribute_value, at.json_type as attribute_data_type`

    query += `
      FROM nodes n
      LEFT JOIN node_attribute_values nav ON n.id = nav.node_id
      LEFT JOIN attributes a ON nav.attribute_id = a.id
      LEFT JOIN attribute_types at ON a.attribute_type_id = at.id
      WHERE n.table_id = ?`

    // Add search conditions
    if (searchQuery.conditions && searchQuery.conditions.length > 0) {
      const conditionClauses = searchQuery.conditions.map((condition) => {
        const filterClauses = condition.filters.map((filter) => {
          return this.buildFilterClause(filter, availableAttributes, params)
        })

        return `(${filterClauses.join(` ${condition.logicalOperator.toUpperCase()} `)})`
      })

      query += ` AND (${conditionClauses.join(' AND ')})`
    }

    // Add text search if present
    if (searchQuery.textSearch) {
      query += ` AND nav.value LIKE ?`
      params.push(`%${searchQuery.textSearch}%`)
    }

    // Add sorting for data queries
    if (!isCountQuery) {
      if (searchQuery.sortBy && searchQuery.sortBy.length > 0) {
        const sortClauses = searchQuery.sortBy.map((sort) => {
          if (sort.field === 'created_at') {
            return `n.created_at ${sort.direction.toUpperCase()}`
          } else if (sort.field === 'updated_at') {
            return `n.updated_at ${sort.direction.toUpperCase()}`
          } else {
            // For attribute-based sorting, we need a more complex query
            return `nav.value ${sort.direction.toUpperCase()}`
          }
        })
        query += ` ORDER BY ${sortClauses.join(', ')}`
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
    filter: any,
    availableAttributes: AttributeTypeInfo[],
    params: any[]
  ): string {
    // Handle text search
    if (filter.field === '_text_search') {
      params.push(`%${filter.value}%`)
      return 'nav.value LIKE ?'
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
        params.push(filter.value)
        return `${baseCondition}nav.value = ?)`

      case 'not_equals':
        params.push(filter.value)
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
        params.push(filter.value)
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '>')})`

      case 'gte':
        params.push(filter.value)
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '>=')})`

      case 'lt':
        params.push(filter.value)
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '<')})`

      case 'lte':
        params.push(filter.value)
        return `${baseCondition + this.buildComparisonClause(attributeInfo.dataType, '<=')})`

      case 'range': {
        const range = filter.value as { min: any; max: any }
        params.push(range.min, range.max)
        return `${baseCondition + this.buildRangeClause(attributeInfo.dataType)})`
      }

      case 'in': {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        const placeholders = values.map(() => '?').join(',')
        params.push(...values)
        return `${baseCondition}nav.value IN (${placeholders}))`
      }

      case 'not_in': {
        const notValues = Array.isArray(filter.value) ? filter.value : [filter.value]
        const notPlaceholders = notValues.map(() => '?').join(',')
        params.push(...notValues)
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

  private parseAttributeValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'number': {
        const num = Number(value)
        return Number.isNaN(num) ? value : num
      }

      case 'boolean':
        return value === 'true' || value === '1'

      case 'datetime':
        try {
          return new Date(value).toISOString()
        } catch {
          return value
        }

      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }

      default:
        return value
    }
  }
}
