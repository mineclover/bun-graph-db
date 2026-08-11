import type { Database } from 'bun:sqlite'
import type { IGraphRepository } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type { GraphQuery } from '@/domain/value-objects/RelationQuery.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

type SqliteParams = Array<string | number | boolean | null>

const MAX_PATH_RESULTS = 100
const MAX_DEPENDENCY_DEPTH = 10
const MAX_DEPENDENCY_RESULTS = 100

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

interface DependencyEdgeRow {
  source_node_id: string
  target_node_id: string
  relation_identifier: string
}

interface RelatedNodeSearchResult {
  node: Node
  attributes: Record<string, unknown>
  sourceNodeId?: string
  targetNodeId?: string
  relationTypeId?: string
  properties?: Record<string, SafeJsonValue>
  strength?: number
}

export class SqliteGraphRepository implements IGraphRepository {
  constructor(private readonly db: Database) {}

  async searchRelatedNodes(tableId: TableId, graphQuery: GraphQuery): Promise<PaginatedResult<RelatedNodeSearchResult>> {
    try {
      const { query, params } = this.buildRelatedNodesQuery(tableId, graphQuery, false)
      const { query: countQuery, params: countParams } = this.buildRelatedNodesQuery(tableId, graphQuery, true)

      // Get total count
      const countResult = this.db.query<{ count: number }, SqliteParams>(countQuery).get(...countParams)
      const total = countResult?.count || 0

      // Get data
      const rows = this.db.query<RelatedNodeRow, SqliteParams>(query).all(...params)

      // Process results
      const nodeMap = new Map<string, RelatedNodeSearchResult>()

      for (const row of rows) {
        // Add node if not already present
        if (!nodeMap.has(row.node_id)) {
          nodeMap.set(row.node_id, {
            node: Node.fromDatabase(
              row.node_id,
              row.node_table_id,
              row.node_content,
              row.node_title,
              row.node_description,
              null,
              new Date(row.node_created_at),
              new Date(row.node_updated_at),
            ),
            attributes: {},
          })
        }

        const nodeData = nodeMap.get(row.node_id)
        if (!nodeData) {
          continue
        }

        // Add attribute if present
        if (row.attribute_identifier && row.attribute_value !== null) {
          nodeData.attributes[row.attribute_identifier] = this.parseAttributeValue(row.attribute_value)
        }

        // The SQL order makes the first matching relation deterministic. Keep
        // it while the rows are already being grouped instead of rescanning all
        // joined rows once per node.
        if (
          nodeData.sourceNodeId === undefined &&
          row.source_node_id &&
          row.target_node_id &&
          row.relation_type_id
        ) {
          nodeData.sourceNodeId = row.source_node_id
          nodeData.targetNodeId = row.target_node_id
          nodeData.relationTypeId = row.relation_type_id
          nodeData.properties = row.relation_properties
            ? (JSON.parse(row.relation_properties) as Record<string, SafeJsonValue>)
            : undefined
          nodeData.strength = row.relation_strength ?? undefined
        }
      }

      const data = Array.from(nodeMap.values())

      const limit = graphQuery.limit || 10
      const offset = graphQuery.offset || 0

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
      throw new DatabaseException(`Failed to search related nodes: ${error}`)
    }
  }

  async findPathsBetweenNodes(
    tableId: TableId,
    startNodeIds: string[],
    endNodeIds: string[],
    maxDepth: number = 3,
    relationTypes?: string[],
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
            AND NOT EXISTS (
              SELECT 1
              FROM json_each(pf.path) AS visited
              WHERE CAST(visited.value AS TEXT) = CAST(nr.target_node_id AS TEXT)
            )
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
        LIMIT ${MAX_PATH_RESULTS}
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
          SqliteParams
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
    relationTypes?: string[],
  ): Promise<DependencyResult[]> {
    try {
      const visited = new Set([String(nodeId)])
      let frontier = new Map<string, string[]>([[String(nodeId), []]])
      const results: DependencyResult[] = []

      for (let level = 1; level <= MAX_DEPENDENCY_DEPTH && frontier.size > 0; level += 1) {
        const frontierIds = [...frontier.keys()]
        const placeholders = frontierIds.map(() => '?').join(',')
        const edgeCondition = direction === RelationDirection.OUTGOING
          ? `nr.source_node_id IN (${placeholders})`
          : direction === RelationDirection.INCOMING
            ? `nr.target_node_id IN (${placeholders})`
            : `(nr.source_node_id IN (${placeholders}) OR nr.target_node_id IN (${placeholders}))`
        const relationFilter = relationTypes && relationTypes.length > 0
          ? `AND rt.identifier IN (${relationTypes.map(() => '?').join(',')})`
          : ''
        const edgeParams: SqliteParams = [tableId, tableId, ...frontierIds]
        if (direction === RelationDirection.BOTH) edgeParams.push(...frontierIds)
        edgeParams.push(...(relationTypes ?? []))

        const edges = this.db.query<DependencyEdgeRow, SqliteParams>(`
          SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                 CAST(nr.target_node_id AS TEXT) AS target_node_id,
                 rt.identifier AS relation_identifier
          FROM node_relations nr
          JOIN relation_types rt ON rt.id = nr.relation_type_id
          JOIN nodes source_node ON source_node.id = nr.source_node_id
          JOIN nodes target_node ON target_node.id = nr.target_node_id
          WHERE source_node.table_id = ?
            AND target_node.table_id = ?
            AND ${edgeCondition}
            ${relationFilter}
          ORDER BY nr.source_node_id ASC, nr.target_node_id ASC, rt.identifier ASC
        `).all(...edgeParams)

        const nextFrontier = new Map<string, string[]>()
        for (const edge of edges) {
          const currentNodeIds = direction === RelationDirection.OUTGOING
            ? [edge.source_node_id]
            : direction === RelationDirection.INCOMING
              ? [edge.target_node_id]
              : [edge.source_node_id, edge.target_node_id]

          for (const currentNodeId of currentNodeIds) {
            const currentPath = frontier.get(currentNodeId)
            if (!currentPath) continue
            const nextNodeId = currentNodeId === edge.source_node_id
              ? edge.target_node_id
              : edge.source_node_id
            if (visited.has(nextNodeId)) continue
            visited.add(nextNodeId)
            nextFrontier.set(nextNodeId, [...currentPath, edge.relation_identifier])
          }
        }

        const orderedNext = [...nextFrontier.entries()].sort(([left], [right]) => left.localeCompare(right))
        for (const [nextNodeId, relationPath] of orderedNext) {
          results.push({ nodeId: nextNodeId, level, relationPath })
          if (results.length >= MAX_DEPENDENCY_RESULTS) return results
        }
        frontier = new Map(orderedNext)
      }

      return results
    } catch (error) {
      throw new DatabaseException(`Failed to get dependency chain: ${error}`)
    }
  }

  private buildRelatedNodesQuery(
    tableId: TableId,
    graphQuery: GraphQuery,
    isCountQuery: boolean,
  ): { query: string; params: SqliteParams } {
    const nodeFilterParams: SqliteParams = []
    const nodeConditions: string[] = []
    if (graphQuery.nodeFilters) {
      for (const [field, value] of Object.entries(graphQuery.nodeFilters)) {
        nodeConditions.push(`EXISTS (
          SELECT 1 FROM node_attributes nav2
          JOIN attributes a2 ON nav2.attribute_id = a2.id
          WHERE nav2.node_id = n.id AND a2.identifier = ? AND nav2.value = ?
        )`)
        nodeFilterParams.push(
          field,
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value
            : JSON.stringify(value),
        )
      }
    }

    const relationFilterParams: SqliteParams = []
    const relationConditions: string[] = []
    if (graphQuery.relationFilters && graphQuery.relationFilters.length > 0) {
      for (const filter of graphQuery.relationFilters) {
        const conditions = ['1=1']
        if (filter.relationTypes && filter.relationTypes.length > 0) {
          conditions.push(`rt.identifier IN (${filter.relationTypes.map(() => '?').join(',')})`)
          relationFilterParams.push(...filter.relationTypes)
        }
        if (filter.direction === RelationDirection.OUTGOING) {
          conditions.push('n.id = nr.source_node_id')
        } else if (filter.direction === RelationDirection.INCOMING) {
          conditions.push('n.id = nr.target_node_id')
        }
        relationConditions.push(`(${conditions.join(' AND ')})`)
      }
    }

    const nodeFilterSql = nodeConditions.length > 0 ? ` AND ${nodeConditions.join(' AND ')}` : ''
    const relationFilterSql = relationConditions.length > 0 ? ` AND (${relationConditions.join(' OR ')})` : ''
    const filterParams: SqliteParams = [tableId, ...nodeFilterParams, ...relationFilterParams]

    if (isCountQuery) {
      return {
        query: `
          SELECT COUNT(DISTINCT n.id) as count
          FROM nodes n
          LEFT JOIN node_relations nr ON (n.id = nr.source_node_id OR n.id = nr.target_node_id)
          LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
          WHERE n.table_id = ?
            ${nodeFilterSql}
            ${relationFilterSql}
        `,
        params: filterParams,
      }
    }

    const limit = graphQuery.limit || 10
    const offset = graphQuery.offset || 0
    const hydrationFilterParams = relationConditions.length > 0 ? relationFilterParams : []

    return {
      query: `
        WITH selected_nodes AS (
          SELECT DISTINCT n.id, n.created_at
          FROM nodes n
          LEFT JOIN node_relations nr ON (n.id = nr.source_node_id OR n.id = nr.target_node_id)
          LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
          WHERE n.table_id = ?
            ${nodeFilterSql}
            ${relationFilterSql}
          ORDER BY n.created_at DESC, n.id ASC
          LIMIT ? OFFSET ?
        )
        SELECT DISTINCT
          n.id as node_id, n.table_id as node_table_id,
          n.content as node_content, n.title as node_title, n.description as node_description,
          n.created_at as node_created_at, n.updated_at as node_updated_at,
          nr.source_node_id, nr.target_node_id, rt.identifier as relation_type_id,
          nr.properties as relation_properties, nr.strength as relation_strength,
          a.identifier as attribute_identifier, nav.value as attribute_value
        FROM selected_nodes selected
        JOIN nodes n ON n.id = selected.id
        LEFT JOIN node_relations nr ON (n.id = nr.source_node_id OR n.id = nr.target_node_id)
        LEFT JOIN relation_types rt ON nr.relation_type_id = rt.id
        LEFT JOIN node_attributes nav ON n.id = nav.node_id
        LEFT JOIN attributes a ON nav.attribute_id = a.id
        WHERE 1=1
          ${relationFilterSql}
        ORDER BY selected.created_at DESC, n.id ASC, nr.created_at DESC, rt.identifier ASC, a.identifier ASC
      `,
      params: [...filterParams, limit, offset, ...hydrationFilterParams],
    }
  }

  private parseAttributeValue(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}
