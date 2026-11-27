import { chunkValues, getMaxBindParams, type ISqliteDatabase } from './SqlitePort.js'
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
  relation_type_id: string
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
  constructor(private readonly db: ISqliteDatabase) {}

  async searchRelatedNodes(tableId: TableId, graphQuery: GraphQuery): Promise<PaginatedResult<RelatedNodeSearchResult>> {
    try {
      const reachableNodeIds =
        graphQuery.sourceNodeIds && graphQuery.sourceNodeIds.length > 0
          ? this.resolveReachableNodeIds(tableId, graphQuery.sourceNodeIds, graphQuery.relationFilters)
          : undefined

      if (reachableNodeIds !== undefined && reachableNodeIds.length === 0) {
        return {
          nodes: [],
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: (graphQuery.offset || 0) > 0,
          data: [],
          total: 0,
          hasMore: false,
        }
      }

      const { query, params } = this.buildRelatedNodesQuery(tableId, graphQuery, false, reachableNodeIds)
      const { query: countQuery, params: countParams } = this.buildRelatedNodesQuery(
        tableId,
        graphQuery,
        true,
        reachableNodeIds,
      )

      // Get total count
      const countResult = this.db.query<{ count: number }, SqliteParams>(countQuery).get(...countParams)
      const total = countResult?.count || 0

      // Get data rows (narrow node + optional first matching relation, no attributes Cartesian blowup)
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

      if (nodeMap.size > 0) {
        const pageNodeIds = [...nodeMap.keys()]
        const attrRows: Array<{
          node_id: string
          attribute_identifier: string
          attribute_value: string | null
        }> = []
        for (const chunk of chunkValues(pageNodeIds, getMaxBindParams(this.db))) {
          const chunkAttrRows = this.db
            .query<{ node_id: string; attribute_identifier: string; attribute_value: string | null }, string[]>(`
              SELECT CAST(nav.node_id AS TEXT) AS node_id,
                     a.identifier AS attribute_identifier,
                     nav.value AS attribute_value
              FROM node_attributes nav
              JOIN attributes a ON nav.attribute_id = a.id
              WHERE nav.node_id IN (${chunk.map(() => '?').join(',')})
              ORDER BY a.identifier ASC
            `)
            .all(...chunk)
          attrRows.push(...chunkAttrRows)
        }

        for (const attrRow of attrRows) {
          if (attrRow.attribute_value === null) continue
          const target = nodeMap.get(attrRow.node_id)
          if (target) {
            target.attributes[attrRow.attribute_identifier] = this.parseAttributeValue(
              attrRow.attribute_value,
            )
          }
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
      if (!startNodeIds.length || !endNodeIds.length || maxDepth < 0) {
        return []
      }

      const boundedDepth = Math.min(Math.floor(maxDepth), 32)
      if (boundedDepth === 0) {
        const endSet = new Set(endNodeIds.map(String))
        return startNodeIds
          .map(String)
          .filter((id) => endSet.has(id))
          .map((id) => ({ startNodeId: id, endNodeId: id, path: [id], length: 0 }))
      }

      const typeRefs = relationTypes && relationTypes.length > 0 ? relationTypes : []
      // Support both relation_types.identifier strings and numeric relation_types.id references
      const useJsonEndFilter =
        startNodeIds.length + endNodeIds.length + 2 + 2 * typeRefs.length > getMaxBindParams(this.db)
      const endFilterSql = useJsonEndFilter
        ? 'CAST(pf.current_node AS TEXT) IN (SELECT CAST(value AS TEXT) FROM json_each(?))'
        : `pf.current_node IN (${endNodeIds.map(() => '?').join(',')})`
      const endFilterParams: SqliteParams = useJsonEndFilter
        ? [JSON.stringify(endNodeIds.map(String))]
        : [...endNodeIds]
      const startChunkSize = useJsonEndFilter
        ? getMaxBindParams(this.db, 3 + 2 * typeRefs.length)
        : startNodeIds.length
      const relationFilter =
        typeRefs.length > 0
          ? `AND (rt.identifier IN (${typeRefs.map(() => '?').join(',')}) OR CAST(rt.id AS TEXT) IN (${typeRefs.map(() => '?').join(',')}))`
          : ''

      const collectedRows: Array<{
        startNodeId: string
        endNodeId: string
        path_json: string
        length: number
      }> = []

      for (const startChunk of chunkValues(startNodeIds, startChunkSize)) {
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
              AND n.id IN (${startChunk.map(() => '?').join(',')})
            
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
            CAST(pf.start_node AS TEXT) as startNodeId,
            CAST(pf.current_node AS TEXT) as endNodeId,
            pf.path as path_json,
            pf.depth as length
          FROM path_finder pf
          WHERE ${endFilterSql}
          ORDER BY pf.depth ASC
          LIMIT ${MAX_PATH_RESULTS}
        `

        const params = [
          tableId,
          ...startChunk,
          boundedDepth,
          ...typeRefs,
          ...typeRefs,
          ...endFilterParams,
        ]

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
        collectedRows.push(...rows)
      }

      if (startNodeIds.length > startChunkSize) {
        collectedRows.sort((a, b) => a.length - b.length)
        collectedRows.length = Math.min(collectedRows.length, MAX_PATH_RESULTS)
      }

      return collectedRows.map((row) => ({
        startNodeId: String(row.startNodeId),
        endNodeId: String(row.endNodeId),
        path: (JSON.parse(row.path_json) as unknown[]).map(String),
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
    maxDepth?: number,
  ): Promise<DependencyResult[]> {
    try {
      const effectiveMaxDepth =
        maxDepth === undefined ? MAX_DEPENDENCY_DEPTH : Math.min(Math.floor(maxDepth), 32)
      if (effectiveMaxDepth <= 0) {
        return []
      }

      const relationTypeRows = this.db
        .query<{ id: string; identifier: string }, []>(
          'SELECT CAST(id AS TEXT) AS id, identifier FROM relation_types',
        )
        .all()
      const relationIdentifierById = new Map<string, string>()
      const allowedRelationTypeIds: string[] = []
      const requestedRefs =
        relationTypes && relationTypes.length > 0 ? new Set(relationTypes.map(String)) : null

      for (const row of relationTypeRows) {
        relationIdentifierById.set(row.id, row.identifier)
        if (!requestedRefs || requestedRefs.has(row.identifier) || requestedRefs.has(row.id)) {
          allowedRelationTypeIds.push(row.id)
        }
      }

      if (requestedRefs && allowedRelationTypeIds.length === 0) {
        return []
      }

      const relationFilter =
        requestedRefs !== null
          ? `AND nr.relation_type_id IN (${allowedRelationTypeIds.map(() => '?').join(',')})`
          : ''

      const visited = new Set([String(nodeId)])
      let frontier = new Map<string, string[]>([[String(nodeId), []]])
      const results: DependencyResult[] = []
      const typeParamCount = requestedRefs !== null ? allowedRelationTypeIds.length : 0
      const legsMultiplier = direction === RelationDirection.BOTH ? 2 : 1
      const chunkSize = Math.max(
        1,
        Math.floor((getMaxBindParams(this.db) - legsMultiplier * (2 + typeParamCount)) / legsMultiplier),
      )

      for (let level = 1; level <= effectiveMaxDepth && frontier.size > 0; level += 1) {
        const allFrontierIds = [...frontier.keys()]
        const resolvedEdges: Array<{
          source_node_id: string
          target_node_id: string
          relation_identifier: string
        }> = []

        for (let offset = 0; offset < allFrontierIds.length; offset += chunkSize) {
          const frontierIds = allFrontierIds.slice(offset, offset + chunkSize)
          const placeholders = frontierIds.map(() => '?').join(',')

          if (direction === RelationDirection.BOTH) {
            const outParams: SqliteParams = [
              tableId,
              tableId,
              ...frontierIds,
              ...(requestedRefs !== null ? allowedRelationTypeIds : []),
            ]
            const inParams: SqliteParams = [
              tableId,
              tableId,
              ...frontierIds,
              ...(requestedRefs !== null ? allowedRelationTypeIds : []),
            ]
            const rawEdges = this.db
              .query<DependencyEdgeRow, SqliteParams>(`
                SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                       CAST(nr.target_node_id AS TEXT) AS target_node_id,
                       CAST(nr.relation_type_id AS TEXT) AS relation_type_id
                FROM node_relations nr
                CROSS JOIN nodes source_node ON source_node.id = nr.source_node_id
                CROSS JOIN nodes target_node ON target_node.id = nr.target_node_id
                WHERE source_node.table_id = ?
                  AND target_node.table_id = ?
                  AND nr.source_node_id IN (${placeholders})
                  ${relationFilter}
                UNION
                SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                       CAST(nr.target_node_id AS TEXT) AS target_node_id,
                       CAST(nr.relation_type_id AS TEXT) AS relation_type_id
                FROM node_relations nr
                CROSS JOIN nodes source_node ON source_node.id = nr.source_node_id
                CROSS JOIN nodes target_node ON target_node.id = nr.target_node_id
                WHERE source_node.table_id = ?
                  AND target_node.table_id = ?
                  AND nr.target_node_id IN (${placeholders})
                  ${relationFilter}
              `)
              .all(...outParams, ...inParams)

            for (const edge of rawEdges) {
              const identifier = relationIdentifierById.get(edge.relation_type_id)
              if (identifier !== undefined) {
                resolvedEdges.push({
                  source_node_id: edge.source_node_id,
                  target_node_id: edge.target_node_id,
                  relation_identifier: identifier,
                })
              }
            }
          } else {
            const edgeCondition =
              direction === RelationDirection.OUTGOING
                ? `nr.source_node_id IN (${placeholders})`
                : `nr.target_node_id IN (${placeholders})`
            const edgeParams: SqliteParams = [
              tableId,
              tableId,
              ...frontierIds,
              ...(requestedRefs !== null ? allowedRelationTypeIds : []),
            ]

            const rawEdges = this.db
              .query<DependencyEdgeRow, SqliteParams>(`
                SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                       CAST(nr.target_node_id AS TEXT) AS target_node_id,
                       CAST(nr.relation_type_id AS TEXT) AS relation_type_id
                FROM node_relations nr
                CROSS JOIN nodes source_node ON source_node.id = nr.source_node_id
                CROSS JOIN nodes target_node ON target_node.id = nr.target_node_id
                WHERE source_node.table_id = ?
                  AND target_node.table_id = ?
                  AND ${edgeCondition}
                  ${relationFilter}
              `)
              .all(...edgeParams)

            for (const edge of rawEdges) {
              const identifier = relationIdentifierById.get(edge.relation_type_id)
              if (identifier !== undefined) {
                resolvedEdges.push({
                  source_node_id: edge.source_node_id,
                  target_node_id: edge.target_node_id,
                  relation_identifier: identifier,
                })
              }
            }
          }
        }

        resolvedEdges.sort(
          (left, right) =>
            compareNumericTextIds(left.source_node_id, right.source_node_id) ||
            compareNumericTextIds(left.target_node_id, right.target_node_id) ||
            compareAsciiStrings(left.relation_identifier, right.relation_identifier),
        )

        const nextFrontier = new Map<string, string[]>()
        for (const edge of resolvedEdges) {
          const currentNodeIds =
            direction === RelationDirection.OUTGOING
              ? [edge.source_node_id]
              : direction === RelationDirection.INCOMING
                ? [edge.target_node_id]
                : [edge.source_node_id, edge.target_node_id]

          for (const currentNodeId of currentNodeIds) {
            const currentPath = frontier.get(currentNodeId)
            if (!currentPath) continue
            const nextNodeId =
              currentNodeId === edge.source_node_id ? edge.target_node_id : edge.source_node_id
            if (visited.has(nextNodeId)) continue
            visited.add(nextNodeId)
            nextFrontier.set(nextNodeId, [...currentPath, edge.relation_identifier])
          }
        }

        const orderedNext = [...nextFrontier.entries()].sort(([left], [right]) =>
          compareAsciiStrings(left, right),
        )
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

  private resolveReachableNodeIds(
    tableId: TableId,
    sourceNodeIds: readonly string[],
    relationFilters?: GraphQuery['relationFilters'],
  ): string[] {
    const seeds = [...new Set(sourceNodeIds.map(String).filter(Boolean))]
    if (seeds.length === 0) return []

    const primaryFilter = relationFilters?.[0]
    const direction = primaryFilter?.direction ?? RelationDirection.BOTH
    const rawDepth: number = primaryFilter?.depth ?? 1
    if (rawDepth === 0) return []
    const maxDepth = rawDepth < 0 ? 32 : Math.min(Math.floor(rawDepth), 32)

    const requestedRefs = new Set<string>()
    for (const filter of relationFilters ?? []) {
      for (const ref of filter.relationTypes ?? []) {
        requestedRefs.add(String(ref))
      }
    }

    let allowedRelationTypeIds: string[] | null = null
    if (requestedRefs.size > 0) {
      const relationTypeRows = this.db
        .query<{ id: string; identifier: string }, []>(
          'SELECT CAST(id AS TEXT) AS id, identifier FROM relation_types',
        )
        .all()
      allowedRelationTypeIds = relationTypeRows
        .filter((row) => requestedRefs.has(row.identifier) || requestedRefs.has(row.id))
        .map((row) => row.id)
      if (allowedRelationTypeIds.length === 0) return []
    }

    const typeFilterSql =
      allowedRelationTypeIds !== null
        ? `AND nr.relation_type_id IN (${allowedRelationTypeIds.map(() => '?').join(',')})`
        : ''
    const visited = new Set<string>(seeds)
    const discovered: string[] = []
    let frontier = [...seeds]
    const typeParamCount = allowedRelationTypeIds?.length ?? 0
    const legsMultiplier = direction === RelationDirection.BOTH ? 2 : 1
    const chunkSize = Math.max(
      1,
      Math.floor((getMaxBindParams(this.db) - legsMultiplier * (2 + typeParamCount)) / legsMultiplier),
    )

    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
      const nextFrontier: string[] = []
      for (let offset = 0; offset < frontier.length; offset += chunkSize) {
        const batch = frontier.slice(offset, offset + chunkSize)
        const placeholders = batch.map(() => '?').join(',')
        const typeParams = allowedRelationTypeIds ?? []

        let rows: Array<{ source_node_id: string; target_node_id: string }>
        if (direction === RelationDirection.BOTH) {
          rows = this.db
            .query<{ source_node_id: string; target_node_id: string }, SqliteParams>(`
              SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                     CAST(nr.target_node_id AS TEXT) AS target_node_id
              FROM node_relations nr
              JOIN nodes s ON s.id = nr.source_node_id
              JOIN nodes t ON t.id = nr.target_node_id
              WHERE s.table_id = ? AND t.table_id = ?
                AND nr.source_node_id IN (${placeholders})
                ${typeFilterSql}
              UNION
              SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                     CAST(nr.target_node_id AS TEXT) AS target_node_id
              FROM node_relations nr
              JOIN nodes s ON s.id = nr.source_node_id
              JOIN nodes t ON t.id = nr.target_node_id
              WHERE s.table_id = ? AND t.table_id = ?
                AND nr.target_node_id IN (${placeholders})
                ${typeFilterSql}
            `)
            .all(tableId, tableId, ...batch, ...typeParams, tableId, tableId, ...batch, ...typeParams)
        } else {
          const col = direction === RelationDirection.OUTGOING ? 'source_node_id' : 'target_node_id'
          rows = this.db
            .query<{ source_node_id: string; target_node_id: string }, SqliteParams>(`
              SELECT CAST(nr.source_node_id AS TEXT) AS source_node_id,
                     CAST(nr.target_node_id AS TEXT) AS target_node_id
              FROM node_relations nr
              JOIN nodes s ON s.id = nr.source_node_id
              JOIN nodes t ON t.id = nr.target_node_id
              WHERE s.table_id = ? AND t.table_id = ?
                AND nr.${col} IN (${placeholders})
                ${typeFilterSql}
            `)
            .all(tableId, tableId, ...batch, ...typeParams)
        }

        const batchSet = new Set(batch)
        for (const row of rows) {
          const candidates: string[] = []
          if ((direction === RelationDirection.OUTGOING || direction === RelationDirection.BOTH) && batchSet.has(row.source_node_id)) {
            candidates.push(row.target_node_id)
          }
          if ((direction === RelationDirection.INCOMING || direction === RelationDirection.BOTH) && batchSet.has(row.target_node_id)) {
            candidates.push(row.source_node_id)
          }
          for (const candidate of candidates) {
            if (!visited.has(candidate)) {
              visited.add(candidate)
              discovered.push(candidate)
              nextFrontier.push(candidate)
            }
          }
        }
      }
      frontier = nextFrontier
    }

    return discovered
  }

  private buildRelatedNodesQuery(
    tableId: TableId,
    graphQuery: GraphQuery,
    isCountQuery: boolean,
    reachableNodeIds?: readonly string[],
  ): { query: string; params: SqliteParams } {
    let scopeParams: SqliteParams = []
    let scopeCondition = ''
    if (reachableNodeIds) {
      if (reachableNodeIds.length <= getMaxBindParams(this.db, 24)) {
        scopeParams = [...reachableNodeIds]
        scopeCondition = ` AND n.id IN (${reachableNodeIds.map(() => '?').join(',')})`
      } else {
        scopeParams = [JSON.stringify(reachableNodeIds.map(String))]
        scopeCondition = ' AND CAST(n.id AS TEXT) IN (SELECT CAST(value AS TEXT) FROM json_each(?))'
      }
    }
    const applyRelationExistsFilter = reachableNodeIds === undefined
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
    const relationExistsClauses: string[] = []
    const relationMatchClauses: string[] = []
    if (graphQuery.relationFilters && graphQuery.relationFilters.length > 0) {
      for (const filter of graphQuery.relationFilters) {
        const hasTypes = Boolean(filter.relationTypes && filter.relationTypes.length > 0)
        const typeList = hasTypes ? (filter.relationTypes ?? []) : []
        const typeCondition = hasTypes
          ? `rt.identifier IN (${typeList.map(() => '?').join(',')})`
          : '1=1'
        const rtJoin = hasTypes
          ? 'JOIN relation_types rt ON nr.relation_type_id = rt.id'
          : ''

        if (filter.direction === RelationDirection.OUTGOING) {
          relationExistsClauses.push(
            `EXISTS (SELECT 1 FROM node_relations nr ${rtJoin} WHERE nr.source_node_id = n.id AND ${typeCondition})`,
          )
          relationMatchClauses.push(
            `(nr.edge_direction = 'OUTGOING' AND ${hasTypes ? typeCondition.replace(/rt\./g, 'nr.') : '1=1'})`,
          )
          relationFilterParams.push(...typeList)
        } else if (filter.direction === RelationDirection.INCOMING) {
          relationExistsClauses.push(
            `EXISTS (SELECT 1 FROM node_relations nr ${rtJoin} WHERE nr.target_node_id = n.id AND ${typeCondition})`,
          )
          relationMatchClauses.push(
            `(nr.edge_direction = 'INCOMING' AND ${hasTypes ? typeCondition.replace(/rt\./g, 'nr.') : '1=1'})`,
          )
          relationFilterParams.push(...typeList)
        } else {
          relationExistsClauses.push(
            `(EXISTS (SELECT 1 FROM node_relations nr ${rtJoin} WHERE nr.source_node_id = n.id AND ${typeCondition}) OR EXISTS (SELECT 1 FROM node_relations nr ${rtJoin} WHERE nr.target_node_id = n.id AND ${typeCondition}))`,
          )
          relationMatchClauses.push(
            `(${hasTypes ? typeCondition.replace(/rt\./g, 'nr.') : '1=1'})`,
          )
          relationFilterParams.push(...typeList, ...typeList)
        }
      }
    }

    const nodeFilterSql = nodeConditions.length > 0 ? ` AND ${nodeConditions.join(' AND ')}` : ''
    const relationExistsSql =
      applyRelationExistsFilter && relationExistsClauses.length > 0
        ? ` AND (${relationExistsClauses.join(' OR ')})`
        : ''
    const activeRelationFilterParams = applyRelationExistsFilter ? relationFilterParams : []

    if (isCountQuery) {
      return {
        query: `
          SELECT COUNT(*) as count
          FROM nodes n
          WHERE n.table_id = ?
            ${scopeCondition}
            ${nodeFilterSql}
            ${relationExistsSql}
        `,
        params: [tableId, ...scopeParams, ...nodeFilterParams, ...activeRelationFilterParams],
      }
    }

    const limit = graphQuery.limit || 10
    const offset = graphQuery.offset || 0
    const hydrationParams: SqliteParams = []
    if (graphQuery.relationFilters && graphQuery.relationFilters.length > 0) {
      for (const filter of graphQuery.relationFilters) {
        if (filter.relationTypes && filter.relationTypes.length > 0) {
          hydrationParams.push(...filter.relationTypes)
        }
      }
    }
    const relationMatchSql =
      relationMatchClauses.length > 0 ? ` AND (${relationMatchClauses.join(' OR ')})` : ''

    return {
      query: `
        WITH selected_nodes AS MATERIALIZED (
          SELECT n.id, n.table_id, n.content, n.title, n.description, n.created_at, n.updated_at
          FROM nodes n
          WHERE n.table_id = ?
            ${scopeCondition}
            ${nodeFilterSql}
            ${relationExistsSql}
          ORDER BY n.created_at DESC, n.id ASC
          LIMIT ? OFFSET ?
        ),
        selected_edges AS (
          SELECT 'OUTGOING' AS edge_direction,
                 nr.source_node_id AS anchor_node_id,
                 nr.source_node_id,
                 nr.target_node_id,
                 rt.identifier AS identifier,
                 nr.properties,
                 nr.strength,
                 nr.created_at
          FROM node_relations nr
          JOIN relation_types rt ON nr.relation_type_id = rt.id
          WHERE nr.source_node_id IN (SELECT id FROM selected_nodes)
          UNION ALL
          SELECT 'INCOMING' AS edge_direction,
                 nr.target_node_id AS anchor_node_id,
                 nr.source_node_id,
                 nr.target_node_id,
                 rt.identifier AS identifier,
                 nr.properties,
                 nr.strength,
                 nr.created_at
          FROM node_relations nr
          JOIN relation_types rt ON nr.relation_type_id = rt.id
          WHERE nr.target_node_id IN (SELECT id FROM selected_nodes)
        )
        SELECT
          selected.id as node_id, selected.table_id as node_table_id,
          selected.content as node_content, selected.title as node_title, selected.description as node_description,
          selected.created_at as node_created_at, selected.updated_at as node_updated_at,
          nr.source_node_id, nr.target_node_id, nr.identifier as relation_type_id,
          nr.properties as relation_properties, nr.strength as relation_strength,
          NULL as attribute_identifier, NULL as attribute_value
        FROM selected_nodes selected
        LEFT JOIN selected_edges nr
          ON nr.anchor_node_id = selected.id
          ${relationMatchSql}
        ORDER BY selected.created_at DESC, selected.id ASC, nr.created_at DESC, nr.identifier ASC
      `,
      params: [
        tableId,
        ...scopeParams,
        ...nodeFilterParams,
        ...activeRelationFilterParams,
        limit,
        offset,
        ...hydrationParams,
      ],
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

function compareAsciiStrings(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function compareNumericTextIds(left: string, right: string): number {
  if (left === right) return 0
  const leftNum = Number(left)
  const rightNum = Number(right)
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum) && leftNum !== rightNum) {
    return leftNum - rightNum
  }
  return left < right ? -1 : 1
}
