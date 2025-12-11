import type { PaginatedResult, TableId, TableSearchOptions } from '@/core/types/CommonTypes.js'
import { Table } from '@/domain/entities/Table.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface TableRow {
  id: number
  identifier: string
  description: string | null
  created_at: string
  updated_at: string
}

export class SqliteTableRepository extends BaseSqliteRepository<Table, TableId> implements ITableRepository {
  protected get tableName(): string {
    return 'tables'
  }

  async save(table: Table): Promise<Table> {
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

        // Return a new Table entity with the correct ID
        return Table.fromDatabase(
          String(result.lastInsertRowid),
          tableData.identifier,
          tableData.description,
          new Date(tableData.created_at),
          new Date(tableData.updated_at),
        )
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
        this.db.run(query, [tableData.identifier, tableData.description, tableData.updated_at, tableData.id])

        // Return the same table for updates
        return table
      } catch (error) {
        throw new DatabaseException(`Failed to update table: ${error}`)
      }
    }
  }

  // findById() - inherited from BaseSqliteRepository

  async findByIdentifier(identifier: string): Promise<Table | null> {
    return this.findByIdentifierField(identifier)
  }

  override async findAll(options: TableSearchOptions = {}): Promise<PaginatedResult<Table>> {
    const {
      limit = 10,
      offset = 0,
      search,
      createdAfter,
      createdBefore,
      sortBy = 'created_at',
      sortDirection = 'DESC',
    } = options

    // Build WHERE clause with filtering
    const whereConditions: string[] = []
    const queryParams: (string | number)[] = []

    if (search) {
      whereConditions.push('(identifier LIKE ? OR description LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    if (createdAfter) {
      whereConditions.push('created_at >= ?')
      queryParams.push(createdAfter)
    }

    if (createdBefore) {
      whereConditions.push('created_at <= ?')
      queryParams.push(createdBefore)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Validate and sanitize sort parameters
    const validSortFields = ['id', 'identifier', 'description', 'created_at', 'updated_at']
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at'
    const safeSortDirection = sortDirection === 'ASC' ? 'ASC' : 'DESC'

    const dataQuery = `
      SELECT id, identifier, description, created_at, updated_at
      FROM tables
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortDirection}
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM tables ${whereClause}`

    try {
      // Add limit and offset to query parameters
      const dataParams = [...queryParams, limit, offset]

      const rows = this.db.query<TableRow, any[]>(dataQuery).all(...dataParams)
      const countResult = this.db.query<{ count: number }, any[]>(countQuery).get(...queryParams)
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

  // delete() - inherited from BaseSqliteRepository

  // exists() - inherited from BaseSqliteRepository

  // count() - inherited from BaseSqliteRepository

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
            tableData.updated_at,
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple tables: ${error}`)
    }
  }

  // findByIds() - inherited from BaseSqliteRepository

  async update(id: TableId, updates: Partial<Table>): Promise<Table> {
    try {
      const existingTable = await this.findById(id)
      if (!existingTable) {
        throw new DatabaseException(`Table with id ${id} not found`)
      }

      const updateFields = []
      const updateValues = []

      if (updates.identifier !== undefined) {
        updateFields.push('identifier = ?')
        updateValues.push(updates.identifier)
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(updates.description)
      }

      if (updateFields.length === 0) {
        return existingTable
      }

      updateFields.push('updated_at = ?')
      updateValues.push(new Date().toISOString())
      updateValues.push(id)

      const query = `
        UPDATE tables 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `

      this.db.run(query, updateValues)

      const updatedTable = await this.findById(id)
      if (!updatedTable) {
        throw new DatabaseException(`Failed to retrieve updated table with id ${id}`)
      }

      return updatedTable
    } catch (error) {
      throw new DatabaseException(`Failed to update table: ${error}`)
    }
  }

  protected mapRowToEntity(row: TableRow): Table {
    return Table.fromDatabase(
      row.id.toString(),
      row.identifier,
      row.description,
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }

  // IRepositoryWithBatchOperations method implementation
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const placeholders = ids.map(() => '?').join(', ')
    const query = `DELETE FROM tables WHERE id IN (${placeholders})`

    try {
      this.db.run(query, ids)
    } catch (error) {
      throw new DatabaseException(`Failed to delete multiple tables: ${error}`)
    }
  }
}
