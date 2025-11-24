import type { Database } from 'bun:sqlite'
import type {
  AttributeId,
  NodeId,
  PaginatedResult,
  PaginationOptions,
} from '@/core/types/CommonTypes.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface NodeAttributeRow {
  id: number
  node_id: number
  attribute_id: number
  value: string
  created_at: string
  updated_at: string
}

export class SqliteNodeAttributeRepository
  extends BaseSqliteRepository<NodeAttribute, string>
  implements INodeAttributeRepository
{
  constructor(db: Database) {
    super(db)
  }

  protected get tableName(): string {
    return 'node_attributes'
  }

  // Note: This repository doesn't use 'identifier' field
  // exists() uses (nodeId, attributeId) combination instead

  async save(nodeAttribute: NodeAttribute): Promise<void> {
    const data = nodeAttribute.toDatabase()

    if (!data.id) {
      const query = `
        INSERT INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          data.node_id,
          data.attribute_id,
          data.value,
          data.created_at,
          data.updated_at,
        ])

        console.log('New node attribute created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save node attribute: ${error}`)
      }
    } else {
      await this.update(nodeAttribute)
    }
  }

  // findById() - inherited from BaseSqliteRepository

  async findByNodeIdAndAttributeId(
    nodeId: NodeId,
    attributeId: AttributeId
  ): Promise<NodeAttribute | null> {
    const query = `
      SELECT id, node_id, attribute_id, value, created_at, updated_at
      FROM node_attributes
      WHERE node_id = ? AND attribute_id = ?
    `

    try {
      const row = this.db.query<NodeAttributeRow, [string, string]>(query).get(nodeId, attributeId)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find node attribute: ${error}`)
    }
  }

  async findByNodeId(nodeId: NodeId): Promise<NodeAttribute[]> {
    const query = `
      SELECT id, node_id, attribute_id, value, created_at, updated_at
      FROM node_attributes
      WHERE node_id = ?
      ORDER BY attribute_id
    `

    try {
      const rows = this.db.query<NodeAttributeRow, [string]>(query).all(nodeId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find node attributes: ${error}`)
    }
  }

  async findByAttributeId(
    attributeId: AttributeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<NodeAttribute>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, node_id, attribute_id, value, created_at, updated_at
      FROM node_attributes
      WHERE attribute_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM node_attributes WHERE attribute_id = ?`

    try {
      const rows = this.db
        .query<NodeAttributeRow, [string, number, number]>(dataQuery)
        .all(attributeId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(attributeId)
      const total = countResult?.count || 0

      const nodeAttributes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodeAttributes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodeAttributes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node attributes by attribute id: ${error}`)
    }
  }

  async update(nodeAttribute: NodeAttribute): Promise<void> {
    const data = nodeAttribute.toDatabase()

    const query = `
      UPDATE node_attributes 
      SET value = ?, updated_at = ?
      WHERE node_id = ? AND attribute_id = ?
    `

    try {
      const result = this.db.run(query, [
        data.value,
        data.updated_at,
        data.node_id,
        data.attribute_id,
      ])

      if (result.changes === 0) {
        throw new DatabaseException(`NodeAttribute not found for update`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to update node attribute: ${error}`)
    }
  }

  // delete() - inherited from BaseSqliteRepository

  async deleteByNodeId(nodeId: NodeId): Promise<void> {
    const query = `DELETE FROM node_attributes WHERE node_id = ?`

    try {
      this.db.run(query, [nodeId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete node attributes by node id: ${error}`)
    }
  }

  async deleteByAttributeId(attributeId: AttributeId): Promise<void> {
    const query = `DELETE FROM node_attributes WHERE attribute_id = ?`

    try {
      this.db.run(query, [attributeId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete node attributes by attribute id: ${error}`)
    }
  }

  // Note: This exists method has a different signature than the base class
  async existsByNodeAndAttribute(nodeId: NodeId, attributeId: AttributeId): Promise<boolean> {
    const query = `SELECT 1 FROM node_attributes WHERE node_id = ? AND attribute_id = ? LIMIT 1`

    try {
      const row = this.db.query<{ 1: number }, [string, string]>(query).get(nodeId, attributeId)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check node attribute existence: ${error}`)
    }
  }

  async saveMany(nodeAttributes: NodeAttribute[]): Promise<void> {
    if (nodeAttributes.length === 0) return

    const query = `
      INSERT OR REPLACE INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `

    try {
      const stmt = this.db.prepare(query)

      this.db.transaction(() => {
        for (const nodeAttribute of nodeAttributes) {
          const data = nodeAttribute.toDatabase()
          stmt.run(data.node_id, data.attribute_id, data.value, data.created_at, data.updated_at)
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple node attributes: ${error}`)
    }
  }

  async updateMany(nodeAttributes: NodeAttribute[]): Promise<void> {
    if (nodeAttributes.length === 0) return

    const query = `
      UPDATE node_attributes 
      SET value = ?, updated_at = ?
      WHERE node_id = ? AND attribute_id = ?
    `

    try {
      const stmt = this.db.prepare(query)

      this.db.transaction(() => {
        for (const nodeAttribute of nodeAttributes) {
          const data = nodeAttribute.toDatabase()
          stmt.run(data.value, data.updated_at, data.node_id, data.attribute_id)
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to update multiple node attributes: ${error}`)
    }
  }

  async countByNodeId(nodeId: NodeId): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM node_attributes WHERE node_id = ?`

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(nodeId)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count node attributes by node id: ${error}`)
    }
  }

  async setNodeAttribute(
    nodeId: NodeId,
    attributeId: AttributeId,
    value: any
  ): Promise<NodeAttribute> {
    try {
      const existing = await this.findByNodeIdAndAttributeId(nodeId, attributeId)

      if (existing) {
        const existingId = existing.getId()
        if (!existingId) {
          throw new DatabaseException('Existing node attribute has no ID')
        }
        const updated = NodeAttribute.fromDatabase(
          existingId,
          existing.getNodeId(),
          existing.getAttributeId(),
          value,
          existing.getCreatedAt(),
          new Date()
        )
        await this.update(updated)
        return updated
      } else {
        const newNodeAttribute = NodeAttribute.create(nodeId, attributeId, value)
        await this.save(newNodeAttribute)

        // After saving, fetch the saved entity with the database-assigned ID
        const savedNodeAttribute = await this.findByNodeIdAndAttributeId(nodeId, attributeId)
        if (!savedNodeAttribute) {
          throw new DatabaseException('Failed to retrieve saved node attribute')
        }
        return savedNodeAttribute
      }
    } catch (error) {
      throw new DatabaseException(`Failed to set node attribute: ${error}`)
    }
  }

  protected mapRowToEntity(row: NodeAttributeRow): NodeAttribute {
    return NodeAttribute.fromDatabase(
      row.id.toString(),
      row.node_id.toString(),
      row.attribute_id.toString(),
      row.value,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
