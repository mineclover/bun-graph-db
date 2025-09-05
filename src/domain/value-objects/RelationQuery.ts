// Relationship query value objects for advanced graph traversal

export enum RelationDirection {
  OUTGOING = 'outgoing',
  INCOMING = 'incoming',
  BOTH = 'both',
}

export enum RelationDepth {
  DIRECT = 1,
  TWO_HOPS = 2,
  THREE_HOPS = 3,
  UNLIMITED = -1,
}

export interface RelationFilter {
  relationTypes?: string[]
  properties?: Record<string, any>
  direction: RelationDirection
  depth: RelationDepth
}

export interface PathQuery {
  startNodeIds?: string[]
  endNodeIds?: string[]
  relationTypes?: string[]
  maxDepth?: number
  shortestPath?: boolean
}

export interface RelationAggregation {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field?: string
  groupBy?: string[]
}

export interface GraphQuery {
  nodeFilters?: Record<string, any>
  relationFilters?: RelationFilter[]
  pathQueries?: PathQuery[]
  aggregations?: RelationAggregation[]
  limit?: number
  offset?: number
}

export class GraphQueryBuilder {
  private query: GraphQuery = {}

  static create(): GraphQueryBuilder {
    return new GraphQueryBuilder()
  }

  addNodeFilter(field: string, value: any): this {
    if (!this.query.nodeFilters) {
      this.query.nodeFilters = {}
    }
    this.query.nodeFilters[field] = value
    return this
  }

  addRelationFilter(filter: RelationFilter): this {
    if (!this.query.relationFilters) {
      this.query.relationFilters = []
    }
    this.query.relationFilters.push(filter)
    return this
  }

  addPathQuery(pathQuery: PathQuery): this {
    if (!this.query.pathQueries) {
      this.query.pathQueries = []
    }
    this.query.pathQueries.push(pathQuery)
    return this
  }

  addAggregation(aggregation: RelationAggregation): this {
    if (!this.query.aggregations) {
      this.query.aggregations = []
    }
    this.query.aggregations.push(aggregation)
    return this
  }

  setLimit(limit: number): this {
    this.query.limit = limit
    return this
  }

  setOffset(offset: number): this {
    this.query.offset = offset
    return this
  }

  build(): GraphQuery {
    return { ...this.query }
  }
}

// Relationship search patterns
export interface RelationSearchPattern {
  pattern: string
  direction: RelationDirection
  depth?: number
  relationTypes?: string[]
}

export class RelationSearchPatternParser {
  static parse(pattern: string): RelationSearchPattern[] {
    const patterns: RelationSearchPattern[] = []

    // Pattern: node1 -[DEPENDS_ON]-> node2
    const directionalPattern = /(\w+)\s*-\[([^\]]+)\]->\s*(\w+)/g
    let match = directionalPattern.exec(pattern)

    if (match && match[2]) {
      patterns.push({
        pattern: match[0],
        direction: RelationDirection.OUTGOING,
        relationTypes: [match[2]],
      })
    }

    // Pattern: node1 <-[DEPENDS_ON]- node2
    const incomingPattern = /(\w+)\s*<-\[([^\]]+)\]-\s*(\w+)/g
    match = incomingPattern.exec(pattern)

    if (match && match[2]) {
      patterns.push({
        pattern: match[0],
        direction: RelationDirection.INCOMING,
        relationTypes: [match[2]],
      })
    }

    // Pattern: node1 -[*2]-> (depth 2)
    const depthPattern = /(\w+)\s*-\[\*(\d+)\]->\s*(\w+)/g
    match = depthPattern.exec(pattern)

    if (match && match[2]) {
      patterns.push({
        pattern: match[0],
        direction: RelationDirection.OUTGOING,
        depth: parseInt(match[2]),
      })
    }

    return patterns
  }
}
