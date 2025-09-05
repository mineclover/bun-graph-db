// Search filter value objects for advanced node querying

export enum SearchOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  RANGE = 'range',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
}

export interface SearchFilter {
  field: string
  operator: SearchOperator
  value: any
  valueType: 'string' | 'number' | 'datetime' | 'json' | 'boolean'
}

export interface RangeValue {
  min: number | string
  max: number | string
}

export interface SearchCondition {
  filters: SearchFilter[]
  logicalOperator: LogicalOperator
}

export interface SearchQuery {
  conditions: SearchCondition[]
  textSearch?: string
  sortBy?: {
    field: string
    direction: 'asc' | 'desc'
  }[]
  limit?: number
  offset?: number
}

export class SearchQueryBuilder {
  private conditions: SearchCondition[] = []
  private textSearch?: string
  private sortBy: { field: string; direction: 'asc' | 'desc' }[] = []
  private limit?: number
  private offset?: number

  addFilter(
    field: string,
    operator: SearchOperator,
    value: any,
    valueType: string = 'string'
  ): this {
    const filter: SearchFilter = { field, operator, value, valueType: valueType as any }

    if (this.conditions.length === 0) {
      this.conditions.push({
        filters: [filter],
        logicalOperator: LogicalOperator.AND,
      })
    } else {
      // Add to the last condition
      const lastCondition = this.conditions[this.conditions.length - 1]
      if (lastCondition) {
        lastCondition.filters.push(filter)
      }
    }

    return this
  }

  addCondition(logicalOperator: LogicalOperator = LogicalOperator.AND): this {
    if (this.conditions.length > 0) {
      this.conditions.push({
        filters: [],
        logicalOperator,
      })
    }
    return this
  }

  setTextSearch(text: string): this {
    this.textSearch = text
    return this
  }

  addSort(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sortBy.push({ field, direction })
    return this
  }

  setLimit(limit: number): this {
    this.limit = limit
    return this
  }

  setOffset(offset: number): this {
    this.offset = offset
    return this
  }

  build(): SearchQuery {
    return {
      conditions: this.conditions.filter((condition) => condition.filters.length > 0),
      textSearch: this.textSearch,
      sortBy: this.sortBy.length > 0 ? this.sortBy : undefined,
      limit: this.limit,
      offset: this.offset,
    }
  }

  static create(): SearchQueryBuilder {
    return new SearchQueryBuilder()
  }
}
