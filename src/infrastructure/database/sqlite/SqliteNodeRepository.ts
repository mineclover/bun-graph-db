import type {
  NodeId,
  PaginatedResult,
  PaginationOptions,
  TableId,
} from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface NodeRow {
  id: number
  table_id: number
  content: string
  title: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export class SqliteNodeRepository
  extends BaseSqliteRepository<Node, NodeId>
  implements INodeRepository
{
  protected get tableName(): string {
    return 'nodes'
  }

  // Note: This repository doesn't use 'identifier' field for exists()
  // Instead uses (tableId, content) combination

  async save(node: Node): Promise<void> {
    const nodeData = node.toDatabase()

    if (nodeData.id === null || nodeData.id === 'null') {
      const query = `
        INSERT INTO nodes (table_id, content, title, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          nodeData.table_id,
          nodeData.content,
          nodeData.title,
          nodeData.description,
          nodeData.created_at,
          nodeData.updated_at,
        ])

        console.log('New node created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save node: ${error}`)
      }
    } else {
      const query = `
        UPDATE nodes 
        SET table_id = ?, content = ?, title = ?, description = ?, updated_at = ?
        WHERE id = ?
      `

      try {
        this.db.run(query, [
          nodeData.table_id,
          nodeData.content,
          nodeData.title,
          nodeData.description,
          nodeData.updated_at,
          nodeData.id,
        ])
      } catch (error) {
        throw new DatabaseException(`Failed to update node: ${error}`)
      }
    }
  }

  // findById() - inherited from BaseSqliteRepository

  async findByTableIdAndContent(tableId: TableId, content: string): Promise<Node | null> {
    const query = `
      SELECT id, table_id, content, title, description, created_at, updated_at
      FROM nodes
      WHERE table_id = ? AND content = ?
    `

    try {
      const row = this.db.query<NodeRow, [string, string]>(query).get(tableId, content)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find node by table and content: ${error}`)
    }
  }

  async findByTableId(
    tableId: TableId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, created_at, updated_at
      FROM nodes
      WHERE table_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM nodes WHERE table_id = ?`

    try {
      const rows = this.db
        .query<NodeRow, [string, number, number]>(dataQuery)
        .all(tableId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(tableId)
      const total = countResult?.count || 0

      const nodes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find nodes by table id: ${error}`)
    }
  }

  override async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, created_at, updated_at
      FROM nodes
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM nodes`

    try {
      const rows = this.db.query<NodeRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0

      const nodes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all nodes: ${error}`)
    }
  }

  // delete() - inherited from BaseSqliteRepository

  async deleteByTableId(tableId: TableId): Promise<void> {
    const query = `DELETE FROM nodes WHERE table_id = ?`

    try {
      this.db.run(query, [tableId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete nodes by table id: ${error}`)
    }
  }

  // Note: This exists method has a different signature than the base class
  async existsByTableIdAndContent(tableId: TableId, content: string): Promise<boolean> {
    const query = `SELECT 1 FROM nodes WHERE table_id = ? AND content = ? LIMIT 1`

    try {
      const row = this.db.query<{ 1: number }, [string, string]>(query).get(tableId, content)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check node existence: ${error}`)
    }
  }

  // count() - inherited from BaseSqliteRepository

  async countByTableId(tableId: TableId): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM nodes WHERE table_id = ?`

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(tableId)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count nodes by table id: ${error}`)
    }
  }

  async saveMany(nodes: Node[]): Promise<void> {
    if (nodes.length === 0) return

    const query = `
      INSERT OR REPLACE INTO nodes (id, table_id, content, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    try {
      const stmt = this.db.prepare(query)

      this.db.transaction(() => {
        for (const node of nodes) {
          const nodeData = node.toDatabase()
          stmt.run(
            nodeData.id,
            nodeData.table_id,
            nodeData.content,
            nodeData.title,
            nodeData.description,
            nodeData.created_at,
            nodeData.updated_at
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple nodes: ${error}`)
    }
  }

  // findByIds() - inherited from BaseSqliteRepository

  async searchByContent(
    tableId: TableId,
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, created_at, updated_at
      FROM nodes
      WHERE table_id = ? AND (content LIKE ? OR title LIKE ? OR description LIKE ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `
      SELECT COUNT(*) as count FROM nodes 
      WHERE table_id = ? AND (content LIKE ? OR title LIKE ? OR description LIKE ?)
    `

    const searchPattern = `%${searchTerm}%`

    try {
      const rows = this.db
        .query<NodeRow, [string, string, string, string, number, number]>(dataQuery)
        .all(tableId, searchPattern, searchPattern, searchPattern, limit, offset)
      const countResult = this.db
        .query<{ count: number }, [string, string, string, string]>(countQuery)
        .get(tableId, searchPattern, searchPattern, searchPattern)
      const total = countResult?.count || 0

      const nodes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: nodes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: nodes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to search nodes: ${error}`)
    }
  }

  async executeRawQuery(query: string, params: any[] = []): Promise<any[]> {
    try {
      const rows = this.db.query<any, any[]>(query).all(...params)
      return rows
    } catch (error) {
      throw new DatabaseException(`Failed to execute raw query: ${error}`)
    }
  }

  async update(
    id: NodeId,
    updates: { content?: string; title?: string | null; description?: string | null }
  ): Promise<Node> {
    try {
      const existingNode = await this.findById(id)
      if (!existingNode) {
        throw new DatabaseException(`Node with id ${id} not found`)
      }

      const updateFields = []
      const updateValues = []

      if (updates.content !== undefined) {
        updateFields.push('content = ?')
        updateValues.push(updates.content)
      }
      if (updates.title !== undefined) {
        updateFields.push('title = ?')
        updateValues.push(updates.title)
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(updates.description)
      }

      if (updateFields.length === 0) {
        return existingNode
      }

      updateFields.push('updated_at = ?')
      updateValues.push(new Date().toISOString())
      updateValues.push(id)

      const query = `
        UPDATE nodes 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `

      this.db.run(query, updateValues)

      const updatedNode = await this.findById(id)
      if (!updatedNode) {
        throw new DatabaseException(`Failed to retrieve updated node with id ${id}`)
      }

      return updatedNode
    } catch (error) {
      throw new DatabaseException(`Failed to update node: ${error}`)
    }
  }

  protected mapRowToEntity(row: NodeRow): Node {
    return Node.fromDatabase(
      row.id.toString(),
      row.table_id.toString(),
      row.content,
      row.title,
      row.description,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
