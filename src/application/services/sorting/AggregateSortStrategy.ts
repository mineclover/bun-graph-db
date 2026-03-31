import {
  type EnhancedSortOption,
  type SortContext,
  SortDirection,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export interface AggregateParameters {
  aggregateFunction: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'stddev'
  sourceField: string
  groupBy?: 'related_nodes' | 'time_period' | 'attribute_value' | 'custom'
  timeWindow?: string // e.g., 'day', 'week', 'month', 'year'
  customGroupExpression?: string
  filterConditions?: Array<{
    field: string
    operator: string
    value: unknown
  }>
}

export class AggregateSortStrategy extends SortStrategy {
  canHandle(field: string, _dataType: string): boolean {
    return (
      field.startsWith('_aggregate_') ||
      field.startsWith('_agg_') ||
      field === '_count' ||
      field === '_sum' ||
      field === '_avg' ||
      field === '_min' ||
      field === '_max'
    )
  }

  buildSortClause(_field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    // Basic count aggregation as fallback
    return this.buildCountAggregate(direction, context)
  }

  override buildEnhancedSortClause(sortOption: EnhancedSortOption, context: SortContext): SortResult {
    const _field = sortOption.field
    const direction = sortOption.direction
    const params = this.parseAggregateParameters(sortOption)

    // Build aggregate-based sorting SQL
    return this.buildAggregateSort(params, direction, context)
  }

  getPriority(): number {
    return 75 // High priority for aggregate fields
  }

  private parseAggregateParameters(sortOption: EnhancedSortOption): AggregateParameters {
    if (sortOption.customComparator) {
      try {
        return JSON.parse(sortOption.customComparator) as AggregateParameters
      } catch {
        // Fall back to defaults
      }
    }

    // Extract simple parameters from field name
    const field = sortOption.field
    if (field === '_count') {
      return { aggregateFunction: 'count', sourceField: '*' }
    } else if (field === '_sum') {
      return { aggregateFunction: 'sum', sourceField: 'value' }
    } else if (field === '_avg') {
      return { aggregateFunction: 'avg', sourceField: 'value' }
    } else if (field === '_min') {
      return { aggregateFunction: 'min', sourceField: 'value' }
    } else if (field === '_max') {
      return { aggregateFunction: 'max', sourceField: 'value' }
    }

    return {
      aggregateFunction: 'count',
      sourceField: '*',
    }
  }

  private buildAggregateSort(params: AggregateParameters, direction: 'asc' | 'desc', context: SortContext): SortResult {
    const _aggregateFunction = params.aggregateFunction
    const _sourceField = params.sourceField

    switch (params.groupBy) {
      case 'related_nodes':
        return this.buildRelatedNodesAggregate(params, direction, context)

      case 'time_period':
        return this.buildTimeBasedAggregate(params, direction, context)

      case 'attribute_value':
        return this.buildAttributeBasedAggregate(params, direction, context)

      case 'custom':
        return this.buildCustomAggregate(params, direction, context)

      default:
        return this.buildSimpleAggregate(params, direction, context)
    }
  }

  private buildSimpleAggregate(
    params: AggregateParameters,
    direction: 'asc' | 'desc',
    _context: SortContext,
  ): SortResult {
    const parameters: unknown[] = []
    let aggregateExpression = ''
    let fromClause = ''
    let whereClause = 'WHERE agg_nav.node_id = n.id'

    // Build aggregate function expression
    switch (params.aggregateFunction) {
      case 'count':
        if (params.sourceField === '*') {
          aggregateExpression = 'COUNT(*)'
        } else {
          aggregateExpression = `COUNT(agg_nav.value)`
          whereClause += ' AND agg_nav.value IS NOT NULL'
        }
        break

      case 'sum':
        aggregateExpression = `SUM(CAST(agg_nav.value AS REAL))`
        whereClause += " AND agg_nav.value IS NOT NULL AND agg_nav.value != ''"
        break

      case 'avg':
        aggregateExpression = `AVG(CAST(agg_nav.value AS REAL))`
        whereClause += " AND agg_nav.value IS NOT NULL AND agg_nav.value != ''"
        break

      case 'min':
        aggregateExpression = `MIN(CAST(agg_nav.value AS REAL))`
        whereClause += " AND agg_nav.value IS NOT NULL AND agg_nav.value != ''"
        break

      case 'max':
        aggregateExpression = `MAX(CAST(agg_nav.value AS REAL))`
        whereClause += " AND agg_nav.value IS NOT NULL AND agg_nav.value != ''"
        break

      case 'median':
        // SQLite doesn't have native MEDIAN, use approximation
        aggregateExpression = `
          (
            SELECT agg_val FROM (
              SELECT CAST(agg_nav2.value AS REAL) as agg_val,
                     ROW_NUMBER() OVER (ORDER BY CAST(agg_nav2.value AS REAL)) as rn,
                     COUNT(*) OVER() as cnt
              FROM node_attributes agg_nav2
              WHERE agg_nav2.node_id = n.id AND agg_nav2.value IS NOT NULL
            ) WHERE rn = (cnt + 1) / 2
          )
        `
        break

      case 'stddev':
        // SQLite standard deviation approximation
        aggregateExpression = `
          SQRT(
            AVG(CAST(agg_nav.value AS REAL) * CAST(agg_nav.value AS REAL)) -
            AVG(CAST(agg_nav.value AS REAL)) * AVG(CAST(agg_nav.value AS REAL))
          )
        `
        whereClause += " AND agg_nav.value IS NOT NULL AND agg_nav.value != ''"
        break

      default:
        aggregateExpression = 'COUNT(*)'
        break
    }

    // Add source field filtering if not wildcard
    if (params.sourceField !== '*') {
      whereClause += ' AND agg_attr.identifier = ?'
      parameters.push(params.sourceField)
    }

    // Add filter conditions
    if (params.filterConditions) {
      for (const filter of params.filterConditions) {
        whereClause += ` AND ${this.buildFilterCondition(filter, parameters)}`
      }
    }

    fromClause =
      params.sourceField !== '*'
        ? 'FROM node_attributes agg_nav JOIN attributes agg_attr ON agg_nav.attribute_id = agg_attr.id'
        : 'FROM node_attributes agg_nav'

    const sqlClause = `
      COALESCE(
        (
          SELECT ${aggregateExpression}
          ${fromClause}
          ${whereClause}
        ),
        0
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildRelatedNodesAggregate(
    params: AggregateParameters,
    direction: 'asc' | 'desc',
    _context: SortContext,
  ): SortResult {
    const parameters: unknown[] = []

    // Add source field parameter
    if (params.sourceField !== '*') {
      parameters.push(params.sourceField)
    }

    const aggregateExpression = this.getAggregateExpression(params.aggregateFunction)
    const sourceFieldJoin =
      params.sourceField !== '*'
        ? 'JOIN attributes related_attr ON related_nav.attribute_id = related_attr.id AND related_attr.identifier = ?'
        : ''

    const sqlClause = `
      COALESCE(
        (
          SELECT ${aggregateExpression}
          FROM node_relations nr
          JOIN node_attributes related_nav ON (
            CASE
              WHEN nr.source_node_id = n.id THEN related_nav.node_id = nr.target_node_id
              ELSE related_nav.node_id = nr.source_node_id
            END
          )
          ${sourceFieldJoin}
          WHERE (nr.source_node_id = n.id OR nr.target_node_id = n.id)
            AND related_nav.value IS NOT NULL
            AND related_nav.value != ''
        ),
        0
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildTimeBasedAggregate(
    params: AggregateParameters,
    direction: 'asc' | 'desc',
    _context: SortContext,
  ): SortResult {
    const parameters: unknown[] = []
    const timeWindow = params.timeWindow || 'day'

    let timeGrouping = ''
    switch (timeWindow) {
      case 'hour':
        timeGrouping = "strftime('%Y-%m-%d %H', n.created_at)"
        break
      case 'day':
        timeGrouping = "strftime('%Y-%m-%d', n.created_at)"
        break
      case 'week':
        timeGrouping = "strftime('%Y-%W', n.created_at)"
        break
      case 'month':
        timeGrouping = "strftime('%Y-%m', n.created_at)"
        break
      case 'year':
        timeGrouping = "strftime('%Y', n.created_at)"
        break
      default:
        timeGrouping = "strftime('%Y-%m-%d', n.created_at)"
    }

    if (params.sourceField !== '*') {
      parameters.push(params.sourceField)
    }

    const aggregateExpression = this.getAggregateExpression(params.aggregateFunction)
    const sourceFieldJoin =
      params.sourceField !== '*'
        ? 'JOIN attributes time_attr ON time_nav.attribute_id = time_attr.id AND time_attr.identifier = ?'
        : ''

    const sqlClause = `
      COALESCE(
        (
          SELECT ${aggregateExpression}
          FROM nodes time_nodes
          LEFT JOIN node_attributes time_nav ON time_nodes.id = time_nav.node_id
          ${sourceFieldJoin}
          WHERE time_nodes.table_id = n.table_id
            AND ${timeGrouping} = strftime('${
              timeWindow === 'hour'
                ? '%Y-%m-%d %H'
                : timeWindow === 'week'
                  ? '%Y-%W'
                  : timeWindow === 'month'
                    ? '%Y-%m'
                    : timeWindow === 'year'
                      ? '%Y'
                      : '%Y-%m-%d'
            }', n.created_at)
        ),
        0
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildAttributeBasedAggregate(
    params: AggregateParameters,
    direction: 'asc' | 'desc',
    context: SortContext,
  ): SortResult {
    // Group by a specific attribute value and aggregate another attribute
    return this.buildSimpleAggregate(params, direction, context)
  }

  private buildCustomAggregate(
    params: AggregateParameters,
    direction: 'asc' | 'desc',
    context: SortContext,
  ): SortResult {
    if (!params.customGroupExpression) {
      return this.buildSimpleAggregate(params, direction, context)
    }

    const parameters: unknown[] = []
    const _aggregateExpression = this.getAggregateExpression(params.aggregateFunction)

    const sqlClause = `
      COALESCE(
        (
          ${params.customGroupExpression}
        ),
        0
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildCountAggregate(direction: 'asc' | 'desc', _context: SortContext): SortResult {
    const sqlClause = `
      (
        SELECT COUNT(*)
        FROM node_attributes count_nav
        WHERE count_nav.node_id = n.id
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  private getAggregateExpression(aggregateFunction: string): string {
    switch (aggregateFunction) {
      case 'count':
        return 'COUNT(*)'
      case 'sum':
        return 'SUM(CAST(related_nav.value AS REAL))'
      case 'avg':
        return 'AVG(CAST(related_nav.value AS REAL))'
      case 'min':
        return 'MIN(CAST(related_nav.value AS REAL))'
      case 'max':
        return 'MAX(CAST(related_nav.value AS REAL))'
      default:
        return 'COUNT(*)'
    }
  }

  private buildFilterCondition(
    filter: { field: string; operator: string; value: unknown },
    parameters: unknown[],
  ): string {
    const { field, operator, value } = filter

    switch (operator) {
      case 'equals':
        parameters.push(value)
        return `${field} = ?`
      case 'not_equals':
        parameters.push(value)
        return `${field} != ?`
      case 'gt':
        parameters.push(value)
        return `CAST(${field} AS REAL) > ?`
      case 'gte':
        parameters.push(value)
        return `CAST(${field} AS REAL) >= ?`
      case 'lt':
        parameters.push(value)
        return `CAST(${field} AS REAL) < ?`
      case 'lte':
        parameters.push(value)
        return `CAST(${field} AS REAL) <= ?`
      case 'contains':
        parameters.push(`%${value}%`)
        return `${field} LIKE ?`
      default:
        return '1=1' // No-op condition
    }
  }

  /**
   * Static helpers to create aggregate sort options
   */
  static createCountSort(
    sourceField: string = '*',
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: AggregateParameters = {
      aggregateFunction: 'count',
      sourceField,
    }

    return {
      field: '_count',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createSumSort(sourceField: string, sortDirection: SortDirection = SortDirection.DESC): EnhancedSortOption {
    const parameters: AggregateParameters = {
      aggregateFunction: 'sum',
      sourceField,
    }

    return {
      field: '_sum',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createAverageSort(sourceField: string, sortDirection: SortDirection = SortDirection.DESC): EnhancedSortOption {
    const parameters: AggregateParameters = {
      aggregateFunction: 'avg',
      sourceField,
    }

    return {
      field: '_avg',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createRelatedNodesAggregateSort(
    aggregateFunction: 'count' | 'sum' | 'avg' | 'min' | 'max',
    sourceField: string,
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: AggregateParameters = {
      aggregateFunction,
      sourceField,
      groupBy: 'related_nodes',
    }

    return {
      field: '_aggregate_related',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createTimeBasedAggregateSort(
    aggregateFunction: 'count' | 'sum' | 'avg',
    timeWindow: 'hour' | 'day' | 'week' | 'month' | 'year',
    sourceField: string = '*',
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: AggregateParameters = {
      aggregateFunction,
      sourceField,
      groupBy: 'time_period',
      timeWindow,
    }

    return {
      field: '_aggregate_time',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }
}
