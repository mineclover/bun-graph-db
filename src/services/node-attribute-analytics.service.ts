/**
 * Node Attribute Analytics Service
 * Implements 100% utilization of the normalized node_attributes schema
 */

export class NodeAttributeAnalyticsService {
  constructor(private db: any) {}

  /**
   * Get comprehensive analytics for node attributes
   * Utilizes: node_attributes, attributes, attribute_types, nodes tables
   */
  async getNodeAttributeAnalytics(params: {
    tableId?: string
    attributeIdentifier?: string
    filter?: any
  }) {
    const { tableId, attributeIdentifier } = params

    // Build dynamic WHERE clause
    const conditions = []
    const bindings: any[] = []

    if (tableId) {
      conditions.push('n.table_id = ?')
      bindings.push(tableId)
    }

    if (attributeIdentifier) {
      conditions.push('a.identifier = ?')
      bindings.push(attributeIdentifier)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Main analytics query - utilizing all normalized tables
    const analyticsQuery = `
      SELECT
        COUNT(DISTINCT n.id) as total_nodes,
        COUNT(na.id) as total_attributes,
        COUNT(na.id) * 100.0 / COUNT(DISTINCT n.id) as completeness_percentage
      FROM nodes n
      LEFT JOIN node_attributes na ON n.id = na.node_id
      LEFT JOIN attributes a ON na.attribute_id = a.id
      LEFT JOIN attribute_types at ON a.attribute_type_id = at.id
      ${whereClause}
    `

    // Attribute statistics - leveraging attribute_types for validation
    const attributeStatsQuery = `
      SELECT
        a.id as attribute_id,
        a.identifier,
        COUNT(na.value) as total_values,
        COUNT(DISTINCT na.value) as unique_values,
        COUNT(CASE WHEN na.value IS NULL THEN 1 END) as null_values,
        (COUNT(na.value) * 100.0 / COUNT(n.id)) as completeness_rate,
        at.json_type as data_type
      FROM attributes a
      LEFT JOIN node_attributes na ON a.id = na.attribute_id
      LEFT JOIN nodes n ON na.node_id = n.id AND n.table_id = a.table_id
      LEFT JOIN attribute_types at ON a.attribute_type_id = at.id
      ${whereClause.replace('n.table_id', 'a.table_id')}
      GROUP BY a.id, a.identifier, at.json_type
      ORDER BY completeness_rate DESC
    `

    // Type distribution - utilizing attribute_types table
    const typeDistributionQuery = `
      SELECT
        at.id as type_id,
        at.identifier,
        at.json_type,
        COUNT(na.id) as usage_count,
        AVG(CAST(usage_per_node.cnt AS FLOAT)) as average_values_per_node
      FROM attribute_types at
      LEFT JOIN attributes a ON at.id = a.attribute_type_id
      LEFT JOIN node_attributes na ON a.id = na.attribute_id
      LEFT JOIN (
        SELECT na2.node_id, COUNT(*) as cnt
        FROM node_attributes na2
        GROUP BY na2.node_id
      ) usage_per_node ON na.node_id = usage_per_node.node_id
      GROUP BY at.id, at.identifier, at.json_type
      HAVING usage_count > 0
      ORDER BY usage_count DESC
    `

    try {
      const [analytics, attributeStats, typeDistribution] = await Promise.all([
        this.db.get(analyticsQuery, bindings),
        this.db.all(attributeStatsQuery, bindings),
        this.db.all(typeDistributionQuery),
      ])

      return {
        totalNodes: analytics?.total_nodes || 0,
        totalAttributes: analytics?.total_attributes || 0,
        completenessPercentage: analytics?.completeness_percentage || 0,
        attributeStats: attributeStats.map((stat: any) => ({
          attributeId: stat.attribute_id,
          identifier: stat.identifier,
          totalValues: stat.total_values,
          uniqueValues: stat.unique_values,
          nullValues: stat.null_values,
          completenessRate: stat.completeness_rate,
          dataType: stat.data_type,
        })),
        typeDistribution: typeDistribution.map((type: any) => ({
          typeId: type.type_id,
          identifier: type.identifier,
          jsonType: type.json_type,
          usageCount: type.usage_count,
          averageValuesPerNode: type.average_values_per_node || 0,
        })),
      }
    } catch (error) {
      console.error('Error in getNodeAttributeAnalytics:', error)
      throw error
    }
  }

  /**
   * Get attribute value distribution
   * Demonstrates normalized storage benefits
   */
  async getAttributeValueDistribution(attributeId: string, _groupBy: string = 'VALUE') {
    const baseQuery = `
      SELECT
        na.value,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (
          SELECT COUNT(*)
          FROM node_attributes na2
          WHERE na2.attribute_id = ?
        ) as percentage
      FROM node_attributes na
      WHERE na.attribute_id = ?
      GROUP BY na.value
      ORDER BY count DESC
      LIMIT 20
    `

    try {
      const results = await this.db.all(baseQuery, [attributeId, attributeId])

      return results.map((row: any) => ({
        value: row.value,
        count: row.count,
        percentage: row.percentage,
        nodes: [], // TODO: Implement node loading if needed
      }))
    } catch (error) {
      console.error('Error in getAttributeValueDistribution:', error)
      throw error
    }
  }

  /**
   * Search nodes by attributes using normalized storage
   * Utilizes proper joins across normalized tables
   */
  async searchNodesByAttribute(filter: any, pagination?: any) {
    // Build dynamic query based on attribute filters
    const { attributeFilters, logicalOperator = 'AND', tableIds } = filter

    let query = `
      SELECT DISTINCT n.id, n.content, n.table_id, n.created_at
      FROM nodes n
    `

    const joins: string[] = []
    const conditions: string[] = []
    const bindings: any[] = []

    // Add joins and conditions for each attribute filter
    attributeFilters.forEach((attrFilter: any, index: number) => {
      const alias = `na${index}`
      const attrAlias = `a${index}`

      joins.push(`
        JOIN node_attributes ${alias} ON n.id = ${alias}.node_id
        JOIN attributes ${attrAlias} ON ${alias}.attribute_id = ${attrAlias}.id
      `)

      conditions.push(`${attrAlias}.identifier = ?`)
      bindings.push(attrFilter.attributeIdentifier)

      // Add value condition based on operator
      switch (attrFilter.operator) {
        case 'EQUALS':
          conditions.push(`${alias}.value = ?`)
          bindings.push(attrFilter.value)
          break
        case 'CONTAINS':
          conditions.push(`${alias}.value LIKE ?`)
          bindings.push(`%${attrFilter.value}%`)
          break
        case 'GREATER_THAN':
          conditions.push(`CAST(${alias}.value AS REAL) > ?`)
          bindings.push(parseFloat(attrFilter.value))
          break
        // Add more operators as needed
      }
    })

    if (tableIds?.length) {
      conditions.push(`n.table_id IN (${tableIds.map(() => '?').join(', ')})`)
      bindings.push(...tableIds)
    }

    query += joins.join(' ')

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(` ${logicalOperator} `)}`
    }

    // Add pagination
    if (pagination) {
      query += ` LIMIT ? OFFSET ?`
      bindings.push(pagination.limit || 10, pagination.offset || 0)
    }

    try {
      const results = await this.db.all(query, bindings)
      return {
        nodes: results,
        totalCount: results.length, // TODO: Implement proper count query
      }
    } catch (error) {
      console.error('Error in searchNodesByAttribute:', error)
      throw error
    }
  }

  /**
   * Get attribute completeness analysis
   * Utilizes is_required field from attributes table
   */
  async getAttributeCompleteness(tableId: string) {
    // Get all nodes for the table
    const nodesQuery = `
      SELECT COUNT(*) as total_nodes
      FROM nodes
      WHERE table_id = ?
    `

    // Get attributes completeness
    const completenessQuery = `
      SELECT
        a.id as attribute_id,
        a.identifier,
        a.is_required,
        COUNT(na.value) as filled_count,
        (
          SELECT COUNT(*)
          FROM nodes n2
          WHERE n2.table_id = a.table_id
        ) - COUNT(na.value) as empty_count,
        COUNT(na.value) * 100.0 / (
          SELECT COUNT(*)
          FROM nodes n3
          WHERE n3.table_id = a.table_id
        ) as completeness_rate
      FROM attributes a
      LEFT JOIN node_attributes na ON a.id = na.attribute_id
      LEFT JOIN nodes n ON na.node_id = n.id AND n.table_id = a.table_id
      WHERE a.table_id = ?
      GROUP BY a.id, a.identifier, a.is_required
      ORDER BY a.is_required DESC, completeness_rate DESC
    `

    try {
      const [nodesResult, completenessResults] = await Promise.all([
        this.db.get(nodesQuery, [tableId]),
        this.db.all(completenessQuery, [tableId]),
      ])

      const totalNodes = nodesResult?.total_nodes || 0
      const requiredAttributes = completenessResults.filter((attr: any) => attr.is_required)
      const optionalAttributes = completenessResults.filter((attr: any) => !attr.is_required)

      // Calculate complete nodes (nodes with all required attributes)
      const completeNodesQuery = `
        SELECT COUNT(DISTINCT n.id) as complete_nodes
        FROM nodes n
        WHERE n.table_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM attributes a
          WHERE a.table_id = n.table_id
          AND a.is_required = 1
          AND NOT EXISTS (
            SELECT 1
            FROM node_attributes na
            WHERE na.node_id = n.id
            AND na.attribute_id = a.id
          )
        )
      `

      const completeNodesResult = await this.db.get(completeNodesQuery, [tableId])
      const completeNodes = completeNodesResult?.complete_nodes || 0

      return {
        tableId,
        totalNodes,
        totalRequiredAttributes: requiredAttributes.length,
        totalOptionalAttributes: optionalAttributes.length,
        completeNodes,
        incompleteNodes: totalNodes - completeNodes,
        completenessRate: totalNodes > 0 ? (completeNodes / totalNodes) * 100 : 0,
        attributeCompleteness: completenessResults.map((attr: any) => ({
          attributeId: attr.attribute_id,
          identifier: attr.identifier,
          isRequired: Boolean(attr.is_required),
          filledCount: attr.filled_count,
          emptyCount: attr.empty_count,
          completenessRate: attr.completeness_rate,
        })),
      }
    } catch (error) {
      console.error('Error in getAttributeCompleteness:', error)
      throw error
    }
  }
}
