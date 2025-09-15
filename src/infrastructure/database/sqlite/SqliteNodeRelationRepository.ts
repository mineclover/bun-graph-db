import type { Database } from 'bun:sqlite'
import type {
  NodeId,
  NodeRelationId,
  PaginatedResult,
  PaginationOptions,
  RelationTypeId,
  TableId,
} from '@/core/types/CommonTypes.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface NodeRelationRow {
  id: number
  table_id: number
  source_node_id: number | null
  source_external_id: string
  target_node_id: number | null
  target_external_id: string
  relation_type_id: number
  properties: string | null
  strength: number
  created_at: string
  updated_at: string
}

export class SqliteNodeRelationRepository implements INodeRelationRepository {
  constructor(private readonly db: Database) {}

  async save(nodeRelation: NodeRelation): Promise<void> {
    const data = nodeRelation.toDatabase()

    if (!data.id) {
      const query = `
        INSERT INTO node_relations (
          table_id, source_node_id, source_external_id, 
          target_node_id, target_external_id, relation_type_id, 
          properties, strength, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          data.table_id,
          data.source_node_id,
          data.source_external_id,
          data.target_node_id,
          data.target_external_id,
          data.relation_type_id,
          data.properties,
          data.strength,
          data.created_at,
          data.updated_at,
        ])

        console.log('New node relation created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save node relation: ${error}`)
      }
    } else {
      await this.update(nodeRelation)
    }
  }

  async findById(id: NodeRelationId): Promise<NodeRelation | null> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE id = ?
    `

    try {
      const row = this.db.query<NodeRelationRow, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find node relation by id: ${error}`)
    }
  }

  async findByTableId(
    tableId: TableId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE table_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE table_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, number, number]>(dataQuery)
        .all(tableId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(tableId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by table id: ${error}`)
    }
  }

  async findBySourceNodeIdPaginated(
    sourceNodeId: NodeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_node_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE source_node_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, number, number]>(dataQuery)
        .all(sourceNodeId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(sourceNodeId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by source node id: ${error}`)
    }
  }

  async findByTargetNodeIdPaginated(
    targetNodeId: NodeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE target_node_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE target_node_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, number, number]>(dataQuery)
        .all(targetNodeId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(targetNodeId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by target node id: ${error}`)
    }
  }

  async findByExternalIds(
    sourceExternalId: string,
    targetExternalId: string,
    tableId: TableId
  ): Promise<NodeRelation | null> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_external_id = ? AND target_external_id = ? AND table_id = ?
    `

    try {
      const row = this.db
        .query<NodeRelationRow, [string, string, string]>(query)
        .get(sourceExternalId, targetExternalId, tableId)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find node relation by external ids: ${error}`)
    }
  }

  async findBySourceExternalId(
    sourceExternalId: string,
    tableId: TableId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_external_id = ? AND table_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE source_external_id = ? AND table_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, string, number, number]>(dataQuery)
        .all(sourceExternalId, tableId, limit, offset)
      const countResult = this.db
        .query<{ count: number }, [string, string]>(countQuery)
        .get(sourceExternalId, tableId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by source external id: ${error}`)
    }
  }

  async findByTargetExternalId(
    targetExternalId: string,
    tableId: TableId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE target_external_id = ? AND table_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE target_external_id = ? AND table_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, string, number, number]>(dataQuery)
        .all(targetExternalId, tableId, limit, offset)
      const countResult = this.db
        .query<{ count: number }, [string, string]>(countQuery)
        .get(targetExternalId, tableId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by target external id: ${error}`)
    }
  }

  async findByRelationType(
    relationTypeId: RelationTypeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE relation_type_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations WHERE relation_type_id = ?`

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, number, number]>(dataQuery)
        .all(relationTypeId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(relationTypeId)
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeRelations,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeRelations,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by relation type: ${error}`)
    }
  }

  async findByNodeId(
    nodeId: NodeId,
    options: PaginationOptions = {}
  ): Promise<{
    incoming: NodeRelation[]
    outgoing: NodeRelation[]
  }> {
    const { limit = 100, offset = 0 } = options

    const outgoingQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_node_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const incomingQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE target_node_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    try {
      const outgoingRows = this.db
        .query<NodeRelationRow, [string, number, number]>(outgoingQuery)
        .all(nodeId, limit, offset)
      const incomingRows = this.db
        .query<NodeRelationRow, [string, number, number]>(incomingQuery)
        .all(nodeId, limit, offset)

      return {
        outgoing: outgoingRows.map((row) => this.mapRowToEntity(row)),
        incoming: incomingRows.map((row) => this.mapRowToEntity(row)),
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by node id: ${error}`)
    }
  }

  async update(nodeRelation: NodeRelation): Promise<void> {
    const data = nodeRelation.toDatabase()

    const query = `
      UPDATE node_relations 
      SET table_id = ?, source_node_id = ?, source_external_id = ?, 
          target_node_id = ?, target_external_id = ?, relation_type_id = ?, 
          properties = ?, strength = ?, updated_at = ?
      WHERE id = ?
    `

    try {
      const result = this.db.run(query, [
        data.table_id,
        data.source_node_id,
        data.source_external_id,
        data.target_node_id,
        data.target_external_id,
        data.relation_type_id,
        data.properties,
        data.strength,
        data.updated_at,
        data.id,
      ])

      if (result.changes === 0) {
        throw new DatabaseException(`NodeRelation with id ${data.id} not found for update`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to update node relation: ${error}`)
    }
  }

  async delete(id: NodeRelationId): Promise<void> {
    const query = `DELETE FROM node_relations WHERE id = ?`

    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`NodeRelation with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete node relation: ${error}`)
    }
  }

  async deleteByTableId(tableId: TableId): Promise<void> {
    const query = `DELETE FROM node_relations WHERE table_id = ?`

    try {
      this.db.run(query, [tableId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete node relations by table id: ${error}`)
    }
  }

  async deleteBySourceNodeId(sourceNodeId: NodeId): Promise<void> {
    const query = `DELETE FROM node_relations WHERE source_node_id = ?`

    try {
      this.db.run(query, [sourceNodeId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete node relations by source node id: ${error}`)
    }
  }

  async deleteByTargetNodeId(targetNodeId: NodeId): Promise<void> {
    const query = `DELETE FROM node_relations WHERE target_node_id = ?`

    try {
      this.db.run(query, [targetNodeId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete node relations by target node id: ${error}`)
    }
  }

  async exists(
    sourceExternalId: string,
    targetExternalId: string,
    tableId: TableId,
    relationTypeId: RelationTypeId
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM node_relations 
      WHERE source_external_id = ? AND target_external_id = ? 
        AND table_id = ? AND relation_type_id = ?
      LIMIT 1
    `

    try {
      const row = this.db
        .query<{ 1: number }, [string, string, string, string]>(query)
        .get(sourceExternalId, targetExternalId, tableId, relationTypeId)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check node relation existence: ${error}`)
    }
  }

  async count(tableId?: TableId, relationTypeId?: RelationTypeId): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM node_relations`
    const params: string[] = []

    if (tableId || relationTypeId) {
      query += ` WHERE `
      const conditions: string[] = []

      if (tableId) {
        conditions.push(`table_id = ?`)
        params.push(tableId)
      }

      if (relationTypeId) {
        conditions.push(`relation_type_id = ?`)
        params.push(relationTypeId)
      }

      query += conditions.join(` AND `)
    }

    try {
      const result = this.db.query<{ count: number }, string[]>(query).get(...params)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count node relations: ${error}`)
    }
  }

  // Simple array-returning overloads for graph traversal
  async findBySourceNodeId(sourceNodeId: NodeId): Promise<NodeRelation[]> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_node_id = ?
      ORDER BY created_at DESC
    `

    try {
      const rows = this.db.query<NodeRelationRow, [string]>(query).all(sourceNodeId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by source node id: ${error}`)
    }
  }

  async findByTargetNodeId(targetNodeId: NodeId): Promise<NodeRelation[]> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE target_node_id = ?
      ORDER BY created_at DESC
    `

    try {
      const rows = this.db.query<NodeRelationRow, [string]>(query).all(targetNodeId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find node relations by target node id: ${error}`)
    }
  }

  async findBySourceNodeIdAndRelationType(
    sourceNodeId: NodeId,
    relationTypeId: RelationTypeId
  ): Promise<NodeRelation[]> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE source_node_id = ? AND relation_type_id = ?
      ORDER BY created_at DESC
    `

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, string]>(query)
        .all(sourceNodeId, relationTypeId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(
        `Failed to find node relations by source node id and relation type: ${error}`
      )
    }
  }

  async findByTargetNodeIdAndRelationType(
    targetNodeId: NodeId,
    relationTypeId: RelationTypeId
  ): Promise<NodeRelation[]> {
    const query = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      WHERE target_node_id = ? AND relation_type_id = ?
      ORDER BY created_at DESC
    `

    try {
      const rows = this.db
        .query<NodeRelationRow, [string, string]>(query)
        .all(targetNodeId, relationTypeId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(
        `Failed to find node relations by target node id and relation type: ${error}`
      )
    }
  }

  async countBySourceNodeId(sourceNodeId: NodeId): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM node_relations WHERE source_node_id = ?`

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(sourceNodeId)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count node relations by source node id: ${error}`)
    }
  }

  async countByTargetNodeId(targetNodeId: NodeId): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM node_relations WHERE target_node_id = ?`

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(targetNodeId)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count node relations by target node id: ${error}`)
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<NodeRelation>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, source_node_id, source_external_id, 
             target_node_id, target_external_id, relation_type_id, 
             properties, strength, created_at, updated_at
      FROM node_relations
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_relations`

    try {
      const rows = this.db.query<NodeRelationRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0

      const nodeRelations = rows.map((row) => this.mapRowToEntity(row))

      return {
        data: nodeRelations,
        nodes: nodeRelations,
        total,
        hasMore: offset + limit < total,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all node relations: ${error}`)
    }
  }

  private mapRowToEntity(row: NodeRelationRow): NodeRelation {
    return NodeRelation.fromDatabase(
      row.id.toString(),
      row.table_id.toString(),
      row.source_node_id?.toString() || null,
      row.source_external_id,
      row.target_node_id?.toString() || null,
      row.target_external_id,
      row.relation_type_id.toString(),
      row.properties,
      row.strength,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
