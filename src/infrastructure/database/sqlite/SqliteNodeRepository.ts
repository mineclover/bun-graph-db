import type { SQLQueryBindings } from './SqliteAdapter.js'
import { getMaxBindParams } from './SqlitePort.js'
import type {
  NodeId,
  PaginatedResult,
  PaginationOptions,
  TableId,
} from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type {
  INodeRepository,
  NodeKeysetCursor,
  NodeKeysetPage,
} from '@/domain/repositories/INodeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { debugDatabase } from '@/shared/utils/debugLog.js'
import { stringifySafeJson, type SafeJsonValue } from '@/shared/utils/safeJson.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface NodeRow {
  id: number
  table_id: number
  content: string
  title: string | null
  description: string | null
  metadata: string | null
  created_at: string
  updated_at: string
}

type SqliteQueryRow = Record<string, unknown>
type SqliteRawQueryParams = SQLQueryBindings[]

export class SqliteNodeRepository extends BaseSqliteRepository<Node, NodeId> implements INodeRepository {
  protected get tableName(): string {
    return 'nodes'
  }

  // Note: This repository doesn't use 'identifier' field for exists()
  // Instead uses (tableId, content) combination

  async save(node: Node): Promise<void> {
    const nodeData = node.toDatabase()

    if (!nodeData.id || nodeData.id === 'null') {
      const query = `
        INSERT INTO nodes (table_id, content, title, description, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          nodeData.table_id,
          nodeData.content,
          nodeData.title,
          nodeData.description,
          nodeData.metadata,
          nodeData.created_at,
          nodeData.updated_at,
        ])

        debugDatabase('node created', () => ({ id: result.lastInsertRowid }))
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save node: ${error}`)
      }
    } else {
      const query = `
        UPDATE nodes 
        SET table_id = ?, content = ?, title = ?, description = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `

      try {
        this.db.run(query, [
          nodeData.table_id,
          nodeData.content,
          nodeData.title,
          nodeData.description,
          nodeData.metadata,
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
      SELECT id, table_id, content, title, description, metadata, created_at, updated_at
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

  async findByTableId(tableId: TableId, options: PaginationOptions = {}): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, metadata, created_at, updated_at
      FROM nodes
      WHERE table_id = ?
      ORDER BY created_at DESC, id ASC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM nodes WHERE table_id = ?`

    try {
      const rows = this.db.query<NodeRow, [string, number, number]>(dataQuery).all(tableId, limit, offset)
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

  async findByTableIdKeyset(
    tableId: TableId,
    limit: number,
    cursor?: NodeKeysetCursor,
  ): Promise<NodeKeysetPage> {
    try {
      const safeLimit = Math.max(1, limit)
      const rows = cursor
        ? this.db
            .query<NodeRow, [string, string, string, number | string, number]>(`
              SELECT id, table_id, content, title, description, metadata, created_at, updated_at
              FROM nodes
              WHERE table_id = ?
                AND (created_at < ? OR (created_at = ? AND id > ?))
              ORDER BY created_at DESC, id ASC
              LIMIT ?
            `)
            .all(
              tableId,
              cursor.createdAt,
              cursor.createdAt,
              Number.isSafeInteger(Number(cursor.id)) ? Number(cursor.id) : cursor.id,
              safeLimit,
            )
        : this.db
            .query<NodeRow, [string, number]>(`
              SELECT id, table_id, content, title, description, metadata, created_at, updated_at
              FROM nodes
              WHERE table_id = ?
              ORDER BY created_at DESC, id ASC
              LIMIT ?
            `)
            .all(tableId, safeLimit)

      const nodes = rows.map((row) => this.mapRowToEntity(row))
      const lastRow = rows.at(-1)
      return {
        nodes,
        nextCursor:
          lastRow && rows.length >= safeLimit
            ? { createdAt: lastRow.created_at, id: String(lastRow.id) }
            : null,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find nodes by table id keyset: ${error}`)
    }
  }

  async findExistingIds(ids: readonly NodeId[]): Promise<Set<NodeId>> {
    const existing = new Set<NodeId>()
    if (ids.length === 0) return existing

    const uniqueIds = [...new Set(ids)]
    const chunkSize = getMaxBindParams(this.db)
    try {
      for (let index = 0; index < uniqueIds.length; index += chunkSize) {
        const chunk = uniqueIds.slice(index, index + chunkSize)
        const placeholders = chunk.map(() => '?').join(',')
        const rows = this.db
          .query<{ id: string }, string[]>(
            `SELECT CAST(id AS TEXT) AS id FROM nodes WHERE id IN (${placeholders})`,
          )
          .all(...chunk)
        for (const row of rows) {
          existing.add(row.id)
        }
      }
      return existing
    } catch (error) {
      throw new DatabaseException(`Failed to check existing node IDs: ${error}`)
    }
  }

  override async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, metadata, created_at, updated_at
      FROM nodes
      ORDER BY created_at DESC, id ASC
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
      INSERT OR REPLACE INTO nodes (id, table_id, content, title, description, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            nodeData.metadata,
            nodeData.created_at,
            nodeData.updated_at,
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
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<Node>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, content, title, description, metadata, created_at, updated_at
      FROM nodes
      WHERE table_id = ? AND (content LIKE ? OR title LIKE ? OR description LIKE ?)
      ORDER BY created_at DESC, id ASC
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

  async executeRawQuery(query: string, params: SqliteRawQueryParams = []): Promise<SqliteQueryRow[]> {
    try {
      const rows = this.db.query<SqliteQueryRow, SqliteRawQueryParams>(query).all(...params)
      return rows
    } catch (error) {
      throw new DatabaseException(`Failed to execute raw query: ${error}`)
    }
  }

  async update(
    id: NodeId,
    updates: { content?: string; title?: string | null; description?: string | null; metadata?: SafeJsonValue },
  ): Promise<Node> {
    try {
      const updateFields: string[] = []
      const updateValues: SQLQueryBindings[] = []

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
      if (updates.metadata !== undefined) {
        updateFields.push('metadata = ?')
        updateValues.push(stringifySafeJson(updates.metadata))
      }

      if (updateFields.length === 0) {
        const existingNode = await this.findById(id)
        if (!existingNode) {
          throw new DatabaseException(`Node with id ${id} not found`)
        }
        return existingNode
      }

      updateFields.push('updated_at = ?')
      updateValues.push(new Date().toISOString(), id)

      const query = `
        UPDATE nodes
        SET ${updateFields.join(', ')}
        WHERE id = ?
        RETURNING id, table_id, content, title, description, metadata, created_at, updated_at
      `

      const updatedRow = this.db.query<NodeRow, SQLQueryBindings[]>(query).get(...updateValues)
      if (!updatedRow) {
        throw new DatabaseException(`Node with id ${id} not found`)
      }

      return this.mapRowToEntity(updatedRow)
    } catch (error) {
      if (error instanceof DatabaseException) throw error
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
      row.metadata ?? null,
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }
}
