import type { DocId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import { Doc, type DocCategory } from '@/domain/entities/Doc.js'
import type {
  DocContentSearchOptions,
  DocContentSearchPagination,
  DocSearchOptions,
  IDocRepository,
} from '@/domain/repositories/IDocRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface DocRow {
  id: number
  table_id: number
  category: string
  version: number
  content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export class SqliteDocRepository extends BaseSqliteRepository<Doc, DocId> implements IDocRepository {
  protected get tableName(): string {
    return 'docs'
  }

  // Note: This repository doesn't have an 'identifier' field
  // so exists() and findByIdentifier() methods from base class are not applicable

  async save(doc: Doc): Promise<void> {
    const docData = doc.toDatabase()

    if (docData.id === null || docData.id === 'null') {
      // Insert new doc (let SQLite auto-generate ID)
      const query = `
        INSERT INTO docs (table_id, category, version, content, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          docData.table_id,
          docData.category,
          docData.version,
          docData.content,
          docData.is_active ? 1 : 0,
          docData.created_at.toISOString(),
          docData.updated_at.toISOString(),
        ])

        console.log('New doc created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save doc error:', error)
        throw new DatabaseException(`Failed to save doc: ${error}`)
      }
    } else {
      // Update existing doc
      const query = `
        UPDATE docs
        SET content = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `

      try {
        this.db.run(query, [docData.content, docData.is_active ? 1 : 0, docData.updated_at.toISOString(), docData.id])
      } catch (error) {
        throw new DatabaseException(`Failed to update doc: ${error}`)
      }
    }
  }

  // findById() - inherited from BaseSqliteRepository

  override async findAll(options: DocSearchOptions = {}): Promise<PaginatedResult<Doc>> {
    const {
      limit = 10,
      offset = 0,
      tableId,
      category,
      isActive,
      version,
      createdAfter,
      createdBefore,
      sortBy = 'created_at',
      sortDirection = 'DESC',
    } = options

    const whereClauses: string[] = []
    const params: any[] = []

    if (tableId) {
      whereClauses.push('table_id = ?')
      params.push(tableId)
    }

    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }

    if (isActive !== undefined) {
      whereClauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }

    if (version !== undefined) {
      whereClauses.push('version = ?')
      params.push(version)
    }

    if (createdAfter) {
      whereClauses.push('created_at >= ?')
      params.push(createdAfter.toISOString())
    }

    if (createdBefore) {
      whereClauses.push('created_at <= ?')
      params.push(createdBefore.toISOString())
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM docs ${whereClause}`
      const countResult = this.db.query<{ count: number }, any[]>(countQuery).get(...params)
      const totalCount = countResult?.count || 0

      // Get docs with pagination
      const dataQuery = `
        SELECT id, table_id, category, version, content, is_active, created_at, updated_at
        FROM docs
        ${whereClause}
        ORDER BY ${sortBy} ${sortDirection}
        LIMIT ? OFFSET ?
      `

      const rows = this.db.query<DocRow, any[]>(dataQuery).all(...params, limit, offset)

      return {
        nodes: rows.map((row) => this.mapRowToEntity(row)),
        totalCount,
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find docs: ${error}`)
    }
  }

  // delete() - inherited from BaseSqliteRepository

  async findByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc[]> {
    const query = `
      SELECT id, table_id, category, version, content, is_active, created_at, updated_at
      FROM docs
      WHERE table_id = ? AND category = ?
      ORDER BY version DESC
    `

    try {
      const rows = this.db.query<DocRow, [string, string]>(query).all(tableId, category)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find docs by table and category: ${error}`)
    }
  }

  async findActiveByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc | null> {
    const query = `
      SELECT id, table_id, category, version, content, is_active, created_at, updated_at
      FROM docs
      WHERE table_id = ? AND category = ? AND is_active = 1
      LIMIT 1
    `

    try {
      const row = this.db.query<DocRow, [string, string]>(query).get(tableId, category)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find active doc: ${error}`)
    }
  }

  async findVersionsByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc[]> {
    return this.findByTableAndCategory(tableId, category)
  }

  async searchDocs(options: DocSearchOptions): Promise<PaginatedResult<Doc>> {
    return this.findAll(options)
  }

  async searchByContent(
    options: DocContentSearchOptions,
    pagination?: DocContentSearchPagination,
  ): Promise<PaginatedResult<Doc>> {
    const { query, tableId, category, isActive } = options

    const { limit = 10, offset = 0 } = pagination || {}

    const whereClauses: string[] = ['content LIKE ?']
    const params: any[] = [`%${query}%`]

    if (tableId) {
      whereClauses.push('table_id = ?')
      params.push(tableId)
    }

    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }

    if (isActive !== undefined) {
      whereClauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`

    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM docs ${whereClause}`
      const countResult = this.db.query<{ count: number }, any[]>(countQuery).get(...params)
      const totalCount = countResult?.count || 0

      // Get docs with pagination
      const dataQuery = `
        SELECT id, table_id, category, version, content, is_active, created_at, updated_at
        FROM docs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `

      const rows = this.db.query<DocRow, any[]>(dataQuery).all(...params, limit, offset)

      return {
        nodes: rows.map((row) => this.mapRowToEntity(row)),
        totalCount,
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to search docs by content: ${error}`)
    }
  }

  async getLatestVersion(tableId: TableId, category: DocCategory): Promise<number> {
    const query = `
      SELECT MAX(version) as max_version
      FROM docs
      WHERE table_id = ? AND category = ?
    `

    try {
      const result = this.db.query<{ max_version: number | null }, [string, string]>(query).get(tableId, category)
      return result?.max_version || 0
    } catch (error) {
      throw new DatabaseException(`Failed to get latest version: ${error}`)
    }
  }

  async deactivateOthersInCategory(tableId: TableId, category: DocCategory, exceptId?: DocId): Promise<void> {
    let query = `
      UPDATE docs
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE table_id = ? AND category = ?
    `
    const params: any[] = [tableId, category]

    if (exceptId) {
      query += ' AND id != ?'
      params.push(exceptId)
    }

    try {
      this.db.run(query, params)
    } catch (error) {
      throw new DatabaseException(`Failed to deactivate docs: ${error}`)
    }
  }

  // Note: This exists method has a different signature than the base class
  // but is needed for doc-specific existence checks
  async existsByTableIdCategoryVersion(tableId: TableId, category: DocCategory, version: number): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM docs
      WHERE table_id = ? AND category = ? AND version = ?
    `

    try {
      const result = this.db.query<{ count: number }, [string, string, number]>(query).get(tableId, category, version)
      return (result?.count || 0) > 0
    } catch (error) {
      throw new DatabaseException(`Failed to check doc existence: ${error}`)
    }
  }

  override async count(tableId?: TableId): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM docs'
    const params: any[] = []

    if (tableId) {
      query += ' WHERE table_id = ?'
      params.push(tableId)
    }

    try {
      const result = this.db.query<{ count: number }, any[]>(query).get(...params)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count docs: ${error}`)
    }
  }

  async countByCategory(category: DocCategory): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM docs WHERE category = ?'

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(category)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count docs by category: ${error}`)
    }
  }

  async saveMany(docs: Doc[]): Promise<void> {
    const transaction = this.db.transaction(() => {
      for (const doc of docs) {
        this.save(doc)
      }
    })

    try {
      transaction()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple docs: ${error}`)
    }
  }

  // findByIds() - inherited from BaseSqliteRepository

  async findByTableIds(tableIds: TableId[]): Promise<Doc[]> {
    if (tableIds.length === 0) return []

    const placeholders = tableIds.map(() => '?').join(',')
    const query = `
      SELECT id, table_id, category, version, content, is_active, created_at, updated_at
      FROM docs
      WHERE table_id IN (${placeholders})
      ORDER BY table_id, category, version DESC
    `

    try {
      const rows = this.db.query<DocRow, string[]>(query).all(...tableIds)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find docs by table ids: ${error}`)
    }
  }

  protected mapRowToEntity(row: DocRow): Doc {
    return Doc.fromDatabase(
      row.id.toString(),
      row.table_id.toString(),
      row.category,
      row.version,
      row.content,
      Boolean(row.is_active),
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }
}
