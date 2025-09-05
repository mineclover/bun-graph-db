import type { Database } from 'bun:sqlite'
import type { PaginatedResult, PaginationOptions, TableId } from '@/core/types/CommonTypes.js'
import { Table } from '@/domain/entities/Table.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface TableRow {
  id: number
  identifier: string
  description: string | null
  created_at: string
  updated_at: string
}

export class SqliteTableRepository implements ITableRepository {
  constructor(private readonly db: Database) {}

  async save(table: Table): Promise<void> {
    const tableData = table.toDatabase()

    if (tableData.id === null || tableData.id === 'null') {
      // Insert new table (let SQLite auto-generate ID)
      const query = `
        INSERT INTO tables (identifier, description, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          tableData.identifier,
          tableData.description,
          tableData.created_at,
          tableData.updated_at,
        ])

        console.log('New table created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save table: ${error}`)
      }
    } else {
      // Update existing table
      const query = `
        UPDATE tables 
        SET identifier = ?, description = ?, updated_at = ?
        WHERE id = ?
      `

      try {
        this.db.run(query, [
          tableData.identifier,
          tableData.description,
          tableData.updated_at,
          tableData.id,
        ])
      } catch (error) {
        throw new DatabaseException(`Failed to update table: ${error}`)
      }
    }
  }

  async findById(id: TableId): Promise<Table | null> {
    const query = `
      SELECT id, identifier, description, created_at, updated_at
      FROM tables
      WHERE id = ?
    `

    try {
      const row = this.db.query<TableRow, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find table by id: ${error}`)
    }
  }

  async findByIdentifier(identifier: string): Promise<Table | null> {
    const query = `
      SELECT id, identifier, description, created_at, updated_at
      FROM tables
      WHERE identifier = ?
    `

    try {
      const row = this.db.query<TableRow, [string]>(query).get(identifier)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find table by identifier: ${error}`)
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Table>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, identifier, description, created_at, updated_at
      FROM tables
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM tables`

    try {
      const rows = this.db.query<TableRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0

      const tables = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: tables,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: tables,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all tables: ${error}`)
    }
  }

  async delete(id: TableId): Promise<void> {
    const query = `DELETE FROM tables WHERE id = ?`

    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`Table with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete table: ${error}`)
    }
  }

  async exists(identifier: string): Promise<boolean> {
    const query = `SELECT 1 FROM tables WHERE identifier = ? LIMIT 1`

    try {
      const row = this.db.query<{ 1: number }, [string]>(query).get(identifier)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check table existence: ${error}`)
    }
  }

  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM tables`

    try {
      const result = this.db.query<{ count: number }, []>(query).get()
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count tables: ${error}`)
    }
  }

  async saveMany(tables: Table[]): Promise<void> {
    if (tables.length === 0) return

    const query = `
      INSERT OR REPLACE INTO tables (id, identifier, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `

    try {
      const stmt = this.db.prepare(query)

      this.db.transaction(() => {
        for (const table of tables) {
          const tableData = table.toDatabase()
          stmt.run(
            tableData.id,
            tableData.identifier,
            tableData.description,
            tableData.created_at,
            tableData.updated_at
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple tables: ${error}`)
    }
  }

  async findByIds(ids: TableId[]): Promise<Table[]> {
    if (ids.length === 0) return []

    const placeholders = ids.map(() => '?').join(',')
    const query = `
      SELECT id, identifier, description, created_at, updated_at
      FROM tables
      WHERE id IN (${placeholders})
    `

    try {
      const rows = this.db.query<TableRow, string[]>(query).all(...ids)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find tables by ids: ${error}`)
    }
  }

  private mapRowToEntity(row: TableRow): Table {
    return Table.fromDatabase(
      row.id.toString(),
      row.identifier,
      row.description,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
