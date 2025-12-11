import {
  type EnhancedSortOption,
  type SortContext,
  SortDirection,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export interface RelationshipParameters {
  relationshipTypes?: string[]
  direction?: 'incoming' | 'outgoing' | 'both'
  algorithm?: 'degree' | 'betweenness' | 'pagerank' | 'connection_strength'
  weightAttribute?: string
  maxDepth?: number
}

export class RelationshipSortStrategy extends SortStrategy {
  canHandle(field: string, _dataType: string): boolean {
    return (
      field.startsWith('_relationship_') ||
      field === '_connection_count' ||
      field === '_connection_strength' ||
      field === '_centrality' ||
      field === '_degree'
    )
  }

  buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    // Basic relationship count sorting
    return this.buildRelationshipCountSort(field, direction, context)
  }

  override buildEnhancedSortClause(sortOption: EnhancedSortOption, context: SortContext): SortResult {
    const field = sortOption.field
    const direction = sortOption.direction
    const params = this.parseRelationshipParameters(sortOption)

    // Build relationship-based sorting SQL based on field type
    switch (field) {
      case '_relationship_count':
      case '_connection_count':
      case '_degree':
        return this.buildRelationshipCountSort(field, direction, context, params)

      case '_connection_strength':
        return this.buildConnectionStrengthSort(direction, context, params)

      case '_centrality':
        return this.buildCentralitySort(direction, context, params)

      default:
        if (field.startsWith('_relationship_')) {
          return this.buildRelationshipCountSort(field, direction, context, params)
        }
        return { sqlClause: '', parameters: [] }
    }
  }

  getPriority(): number {
    return 85 // High priority for relationship fields
  }

  private parseRelationshipParameters(sortOption: EnhancedSortOption): RelationshipParameters {
    if (sortOption.customComparator) {
      try {
        return JSON.parse(sortOption.customComparator) as RelationshipParameters
      } catch {
        // Fall back to defaults
      }
    }

    return {
      direction: 'both',
      algorithm: 'degree',
      maxDepth: 1,
      relationshipTypes: [],
    }
  }

  private buildRelationshipCountSort(
    _field: string,
    direction: 'asc' | 'desc',
    _context: SortContext,
    params?: RelationshipParameters,
  ): SortResult {
    const parameters: any[] = []
    let relationTypeFilter = ''

    // Add relationship type filtering if specified
    if (params?.relationshipTypes && params.relationshipTypes.length > 0) {
      const placeholders = params.relationshipTypes.map(() => '?').join(',')
      relationTypeFilter = `AND rt.identifier IN (${placeholders})`
      parameters.push(...params.relationshipTypes)
    }

    // Build direction-specific query
    const relationshipDirection = params?.direction || 'both'
    let joinCondition = ''

    switch (relationshipDirection) {
      case 'incoming':
        joinCondition = 'nr.target_node_id = n.id'
        break
      case 'outgoing':
        joinCondition = 'nr.source_node_id = n.id'
        break
      default:
        joinCondition = '(nr.source_node_id = n.id OR nr.target_node_id = n.id)'
        break
    }

    const sqlClause = `
      (
        SELECT COUNT(*)
        FROM node_relations nr
        LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
        WHERE ${joinCondition} ${relationTypeFilter}
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildConnectionStrengthSort(
    direction: 'asc' | 'desc',
    _context: SortContext,
    params: RelationshipParameters,
  ): SortResult {
    const parameters: any[] = []
    let relationTypeFilter = ''

    if (params.relationshipTypes && params.relationshipTypes.length > 0) {
      const placeholders = params.relationshipTypes.map(() => '?').join(',')
      relationTypeFilter = `AND rt.identifier IN (${placeholders})`
      parameters.push(...params.relationshipTypes)
    }

    const relationshipDirection = params.direction || 'both'
    let joinCondition = ''

    switch (relationshipDirection) {
      case 'incoming':
        joinCondition = 'nr.target_node_id = n.id'
        break
      case 'outgoing':
        joinCondition = 'nr.source_node_id = n.id'
        break
      default:
        joinCondition = '(nr.source_node_id = n.id OR nr.target_node_id = n.id)'
        break
    }

    // Use a weight attribute or default to 1.0
    const weightExpression = params.weightAttribute ? `COALESCE(CAST(weight_attr.value AS REAL), 1.0)` : '1.0'

    let weightJoin = ''
    if (params.weightAttribute) {
      weightJoin = `
        LEFT JOIN node_attributes weight_attr ON nr.source_node_id = weight_attr.node_id
        LEFT JOIN attributes weight_def ON weight_attr.attribute_id = weight_def.id AND weight_def.identifier = ?
      `
      parameters.push(params.weightAttribute)
    }

    const sqlClause = `
      (
        SELECT SUM(${weightExpression})
        FROM node_relations nr
        LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
        ${weightJoin}
        WHERE ${joinCondition} ${relationTypeFilter}
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildCentralitySort(
    direction: 'asc' | 'desc',
    context: SortContext,
    params: RelationshipParameters,
  ): SortResult {
    const algorithm = params.algorithm || 'degree'

    switch (algorithm) {
      case 'degree':
        return this.buildDegreeCalculation(direction, context, params)

      case 'betweenness':
        return this.buildBetweennessCentrality(direction, context, params)

      case 'pagerank':
        return this.buildPageRankApproximation(direction, context, params)

      default:
        // Fall back to degree centrality
        return this.buildDegreeCalculation(direction, context, params)
    }
  }

  private buildDegreeCalculation(
    direction: 'asc' | 'desc',
    context: SortContext,
    params: RelationshipParameters,
  ): SortResult {
    // Degree centrality is just the relationship count
    return this.buildRelationshipCountSort('_degree', direction, context, params)
  }

  private buildBetweennessCentrality(
    direction: 'asc' | 'desc',
    _context: SortContext,
    _params: RelationshipParameters,
  ): SortResult {
    // Simplified betweenness centrality approximation
    // This is a complex calculation that would normally require iterative algorithms
    // For SQLite, we use a simplified heuristic based on 2-hop connections

    const sqlClause = `
      (
        SELECT COUNT(DISTINCT bridge.intermediate_node)
        FROM (
          SELECT nr1.target_node_id as intermediate_node
          FROM node_relations nr1
          JOIN node_relations nr2 ON nr1.target_node_id = nr2.source_node_id
          WHERE nr1.source_node_id = n.id AND nr2.target_node_id != n.id

          UNION

          SELECT nr1.source_node_id as intermediate_node
          FROM node_relations nr1
          JOIN node_relations nr2 ON nr1.source_node_id = nr2.target_node_id
          WHERE nr1.target_node_id = n.id AND nr2.source_node_id != n.id
        ) bridge
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  private buildPageRankApproximation(
    direction: 'asc' | 'desc',
    _context: SortContext,
    _params: RelationshipParameters,
  ): SortResult {
    // Simplified PageRank approximation using weighted degree
    // In a real implementation, this would require iterative calculation

    const sqlClause = `
      (
        SELECT
          COALESCE(
            (
              SELECT SUM(1.0 / source_degree.out_degree)
              FROM node_relations incoming_rel
              JOIN (
                SELECT nr_out.source_node_id, COUNT(*) as out_degree
                FROM node_relations nr_out
                GROUP BY nr_out.source_node_id
              ) source_degree ON incoming_rel.source_node_id = source_degree.source_node_id
              WHERE incoming_rel.target_node_id = n.id
            ),
            0.15
          )
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  /**
   * Static helper to create relationship sort options
   */
  static createRelationshipCountSort(
    relationshipTypes: string[] = [],
    direction: 'incoming' | 'outgoing' | 'both' = 'both',
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: RelationshipParameters = {
      relationshipTypes,
      direction,
      algorithm: 'degree',
    }

    return {
      field: '_relationship_count',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createConnectionStrengthSort(
    relationshipTypes: string[] = [],
    weightAttribute?: string,
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: RelationshipParameters = {
      relationshipTypes,
      direction: 'both',
      algorithm: 'connection_strength',
      weightAttribute,
    }

    return {
      field: '_connection_strength',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }

  static createCentralitySort(
    algorithm: 'degree' | 'betweenness' | 'pagerank' = 'degree',
    sortDirection: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: RelationshipParameters = {
      direction: 'both',
      algorithm,
    }

    return {
      field: '_centrality',
      direction: sortDirection,
      dataType: 'number',
      customComparator: JSON.stringify(parameters),
    }
  }
}
