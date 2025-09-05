import type { Database } from 'bun:sqlite'
import type { IGraphRepository } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { NodeId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQuery, RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface RelatedNodeRow {
  node_id: string
  node_table_id: string
  node_content: string
  node_title: string | null
  node_description: string | null
  node_created_at: string
  node_updated_at: string
  source_node_id: string | null
  target_node_id: string | null
  relation_type_id: string | null
  relation_properties: string | null
  relation_strength: number | null
  attribute_identifier: string | null
  attribute_value: string | null
}

interface PathResult {
  startNodeId: string
  endNodeId: string
  path: string[]
  length: number
}

interface DependencyResult {
  nodeId: string
  level: number
  relationPath: string[]
}

export class SqliteGraphRepository implements IGraphRepository {
  constructor(private readonly db: Database) {}

  async searchRelatedNodes(
    tableId: TableId,
    graphQuery: GraphQuery
  ): Promise<PaginatedResult<any>> {
    try {
      const { query, params } = this.buildRelatedNodesQuery(tableId, graphQuery, false)
      const { query: countQuery, params: countParams } = this.buildRelatedNodesQuery(
        tableId,
        graphQuery,
        true
      )

      // Get total count
      const countResult = this.db.query<{ count: number }, any[]>(countQuery).get(...countParams)
      const total = countResult?.count || 0

      // Get data
      const rows = this.db.query<RelatedNodeRow, any[]>(query).all(...params)

      // Process results
      const nodeMap = new Map<string, any>()
      const relations = new Set<string>()

      for (const row of rows) {
        // Add node if not already present
        if (!nodeMap.has(row.node_id)) {
          nodeMap.set(row.node_id, {
            node: {
              id: row.node_id,
              tableId: row.node_table_id,
              content: row.node_content,
              title: row.node_title,
              description: row.node_description,
              createdAt: new Date(row.node_created_at),
              updatedAt: new Date(row.node_updated_at),
            },
            attributes: {},
          })
        }

        const nodeData = nodeMap.get(row.node_id)!

        // Add attribute if present
        if (row.attribute_identifier && row.attribute_value !== null) {
          nodeData.attributes[row.attribute_identifier] = this.parseAttributeValue(
            row.attribute_value
          )
        }

        // Add relation if present
        if (row.source_node_id && row.target_node_id && row.relation_type_id) {
          const relationKey = `${row.source_node_id}->${row.target_node_id}:${row.relation_type_id}`
          if (!relations.has(relationKey)) {
            relations.add(relationKey)
          }
        }
      }

      const data = Array.from(nodeMap.values()).map((item) => ({
        ...item,
        sourceNodeId: rows.find((r) => r.node_id === item.node.id)?.source_node_id,
        targetNodeId: rows.find((r) => r.node_id === item.node.id)?.target_node_id,
        relationTypeId: rows.find((r) => r.node_id === item.node.id)?.relation_type_id,
        properties: rows.find((r) => r.node_id === item.node.id)?.relation_properties
          ? JSON.parse(rows.find((r) => r.node_id === item.node.id)!.relation_properties!)
          : null,
        strength: rows.find((r) => r.node_id === item.node.id)?.relation_strength,
      }))

      const limit = graphQuery.limit || 10
      const offset = graphQuery.offset || 0

      return {
        data,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to search related nodes: ${error}`)
    }
  }

  async findPathsBetweenNodes(
    tableId: TableId,
    startNodeIds: string[],
    endNodeIds: string[],
    maxDepth: number = 3,
    relationTypes?: string[]
  ): Promise<PathResult[]> {
    try {
      if (!startNodeIds.length || !endNodeIds.length) {
        return []
      }

      // Build recursive CTE query for path finding
      const relationFilter =
        relationTypes && relationTypes.length > 0
          ? `AND rt.identifier IN (${relationTypes.map(() => '?').join(',')})`
          : ''

      const query = `
        WITH RECURSIVE path_finder AS (
          -- Base case: start nodes
          SELECT 
            n.id as current_node,
            n.id as start_node,
            json_array(n.id) as path,
            0 as depth
          FROM nodes n
          WHERE n.table_id = ? 
            AND n.id IN (${startNodeIds.map(() => '?').join(',')})
          
          UNION ALL
          
          -- Recursive case: follow relations
          SELECT 
            nr.target_node_id as current_node,
            pf.start_node,
            json_insert(pf.path, '$[' || (pf.depth + 1) || ']', nr.target_node_id) as path,
            pf.depth + 1
          FROM path_finder pf
          JOIN node_relations nr ON pf.current_node = nr.source_node_id
          JOIN relation_types rt ON nr.relation_type_id = rt.id
          WHERE pf.depth < ?
            AND json_extract(pf.path, '$[last]') != nr.target_node_id
            ${relationFilter}
        )
        SELECT 
          pf.start_node as startNodeId,
          pf.current_node as endNodeId,
          pf.path as path_json,
          pf.depth as length
        FROM path_finder pf
        WHERE pf.current_node IN (${endNodeIds.map(() => '?').join(',')})
        ORDER BY pf.depth ASC
        LIMIT 100
      `

      const params = [tableId, ...startNodeIds, maxDepth, ...(relationTypes || []), ...endNodeIds]

      const rows = this.db
        .query<
          {
            startNodeId: string
            endNodeId: string
            path_json: string
            length: number
          },
          any[]
        >(query)
        .all(...params)

      return rows.map((row) => ({
        startNodeId: row.startNodeId,
        endNodeId: row.endNodeId,
        path: JSON.parse(row.path_json),
        length: row.length,
      }))
    } catch (error) {
      throw new DatabaseException(`Failed to find paths between nodes: ${error}`)
    }
  }

  async getDependencyChain(
    tableId: TableId,
    nodeId: string,
    direction: RelationDirection = RelationDirection.INCOMING,
    relationTypes?: string[]
  ): Promise<DependencyResult[]> {
    try {
      const relationFilter =
        relationTypes && relationTypes.length > 0
          ? `AND rt.identifier IN (${relationTypes.map(() => '?').join(',')})`
          : ''

      // Build query based on direction
      const directionCondition =
        direction === RelationDirection.OUTGOING
          ? 'nr.source_node_id = ?'
          : direction === RelationDirection.INCOMING
            ? 'nr.target_node_id = ?'
            : '(nr.source_node_id = ? OR nr.target_node_id = ?)'

      const query = `
        WITH RECURSIVE dependency_chain AS (
          -- Base case: starting node
          SELECT 
            ? as node_id,
            0 as level,
            json_array() as relation_path
          
          UNION ALL
          
          -- Recursive case: follow dependencies
          SELECT 
            ${
              direction === RelationDirection.OUTGOING
                ? 'nr.target_node_id'
                : direction === RelationDirection.INCOMING
                  ? 'nr.source_node_id'
                  : 'CASE WHEN nr.source_node_id = dc.node_id THEN nr.target_node_id ELSE nr.source_node_id END'
            } as node_id,
            dc.level + 1,
            json_insert(dc.relation_path, '$[' || dc.level || ']', rt.identifier) as relation_path
          FROM dependency_chain dc
          JOIN node_relations nr ON ${directionCondition.replace('?', 'dc.node_id')}
          JOIN relation_types rt ON nr.relation_type_id = rt.id
          JOIN nodes n ON ${
            direction === RelationDirection.OUTGOING
              ? 'nr.target_node_id'
              : direction === RelationDirection.INCOMING
                ? 'nr.source_node_id'
                : 'CASE WHEN nr.source_node_id = dc.node_id THEN nr.target_node_id ELSE nr.source_node_id END'
          } = n.id
          WHERE n.table_id = ?
            AND dc.level < 10
            ${relationFilter}
        )
        SELECT DISTINCT
          node_id as nodeId,
          level,
          relation_path as relation_path_json
        FROM dependency_chain
        WHERE level > 0
        ORDER BY level ASC, node_id ASC
        LIMIT 100
      `

      const params =
        direction === RelationDirection.BOTH
          ? [nodeId, nodeId, nodeId, tableId, ...(relationTypes || [])]
          : [nodeId, nodeId, tableId, ...(relationTypes || [])]

      const rows = this.db
        .query<
          {
            nodeId: string
            level: number
            relation_path_json: string
          },
          any[]
        >(query)
        .all(...params)

      return rows.map((row) => ({
        nodeId: row.nodeId,
        level: row.level,
        relationPath: JSON.parse(row.relation_path_json),
      }))
    } catch (error) {
      throw new DatabaseException(`Failed to get dependency chain: ${error}`)
    }
  }

  private buildRelatedNodesQuery(
    tableId: TableId,
    graphQuery: GraphQuery,
    isCountQuery: boolean
  ): { query: string; params: any[] } {
    const params: any[] = [tableId]

    // Base query structure
    let query = isCountQuery
      ? 'SELECT COUNT(DISTINCT n.id) as count'
      : `SELECT DISTINCT 
          n.id as node_id, n.table_id as node_table_id,
          n.content as node_content, n.title as node_title, n.description as node_description,
          n.created_at as node_created_at, n.updated_at as node_updated_at,
          nr.source_node_id, nr.target_node_id, rt.identifier as relation_type_id,
          nr.properties as relation_properties, nr.strength as relation_strength,
          a.identifier as attribute_identifier, nav.value as attribute_value`

    query += `
      FROM nodes n
      LEFT JOIN node_relations nr ON (n.id = nr.source_node_id OR n.id = nr.target_node_id)
      LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
      LEFT JOIN node_attribute_values nav ON n.id = nav.node_id
      LEFT JOIN attributes a ON nav.attribute_id = a.id
      WHERE n.table_id = ?`

    // Add node filters
    if (graphQuery.nodeFilters) {
      for (const [field, value] of Object.entries(graphQuery.nodeFilters)) {
        query += ` AND EXISTS (
          SELECT 1 FROM node_attribute_values nav2
          JOIN attributes a2 ON nav2.attribute_id = a2.id
          WHERE nav2.node_id = n.id AND a2.identifier = ? AND nav2.value = ?
        )`
        params.push(field, value)
      }
    }

    // Add relation filters
    if (graphQuery.relationFilters && graphQuery.relationFilters.length > 0) {
      const relationConditions = graphQuery.relationFilters
        .map((filter) => {
          let condition = '1=1'

          if (filter.relationTypes && filter.relationTypes.length > 0) {
            condition += ` AND rt.identifier IN (${filter.relationTypes.map(() => '?').join(',')})`
            params.push(...filter.relationTypes)
          }

          if (filter.direction === RelationDirection.OUTGOING) {
            condition += ' AND n.id = nr.source_node_id'
          } else if (filter.direction === RelationDirection.INCOMING) {
            condition += ' AND n.id = nr.target_node_id'
          }

          return `(${condition})`
        })
        .join(' OR ')

      query += ` AND (${relationConditions})`
    }

    // Add sorting and pagination for data queries
    if (!isCountQuery) {
      query += ' ORDER BY n.created_at DESC'

      const limit = graphQuery.limit || 10
      const offset = graphQuery.offset || 0
      query += ` LIMIT ? OFFSET ?`
      params.push(limit, offset)
    }

    return { query, params }
  }

  private parseAttributeValue(value: string): any {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}
