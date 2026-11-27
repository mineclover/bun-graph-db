import { chunkValues, getMaxBindParams, type ISqliteDatabase } from './SqlitePort.js'
import type { PaginatedResult, PaginationOptions } from '@/core/types/CommonTypes.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

/**
 * Base repository class for SQLite operations
 * Provides common CRUD functionality to reduce code duplication across repositories
 *
 * @template TEntity - Domain entity type
 * @template TId - Entity ID type (must extend string)
 */
export abstract class BaseSqliteRepository<TEntity, TId extends string> {
  constructor(protected readonly db: ISqliteDatabase) {}

  /**
   * Table name in the database
   * Must be implemented by subclasses
   */
  protected abstract get tableName(): string

  /**
   * Primary key field name (default: 'id')
   * Can be overridden by subclasses if needed
   */
  protected get idField(): string {
    return 'id'
  }

  /**
   * Identifier field name for uniqueness checks (default: 'identifier')
   * Can be overridden by subclasses if needed
   */
  protected get identifierField(): string {
    return 'identifier'
  }

  /**
   * Map database row to domain entity
   * Must be implemented by subclasses
   */
  protected abstract mapRowToEntity(row: unknown): TEntity

  /**
   * Find entity by ID
   * Common implementation for all repositories
   */
  async findById(id: TId): Promise<TEntity | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.idField} = ?`

    try {
      const row = this.db.query<unknown, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find ${this.tableName} by id: ${error}`)
    }
  }

  /**
   * Find all entities with basic pagination
   * Can be overridden by subclasses for complex filtering/sorting
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<TEntity>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName}`

    try {
      const rows = this.db.query<unknown, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0

      const entities = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: entities,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        // Additional fields for compatibility with existing repositories
        data: entities,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all ${this.tableName}: ${error}`)
    }
  }

  /**
   * Delete entity by ID
   * Common implementation for all repositories
   */
  async delete(id: TId): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.idField} = ?`

    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`${this.tableName} with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete ${this.tableName}: ${error}`)
    }
  }

  /**
   * Check if entity exists by identifier
   * Common implementation for all repositories
   */
  async exists(identifier: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE ${this.identifierField} = ? LIMIT 1`

    try {
      const row = this.db.query<{ 1: number }, [string]>(query).get(identifier)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check ${this.tableName} existence: ${error}`)
    }
  }

  /**
   * Find entity by identifier field
   * Common implementation for repositories that have identifier field
   */
  protected async findByIdentifierField(identifier: string): Promise<TEntity | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.identifierField} = ?`

    try {
      const row = this.db.query<unknown, [string]>(query).get(identifier)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find ${this.tableName} by ${this.identifierField}: ${error}`)
    }
  }

  /**
   * Count total entities
   * Common implementation for all repositories
   */
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName}`

    try {
      const result = this.db.query<{ count: number }, []>(query).get()
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count ${this.tableName}: ${error}`)
    }
  }

  /**
   * Find entities by multiple IDs
   * Common implementation for all repositories
   */
  async findByIds(ids: TId[]): Promise<TEntity[]> {
    if (ids.length === 0) return []

    try {
      const chunks = chunkValues(ids, getMaxBindParams(this.db))
      const entities: TEntity[] = []
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',')
        const query = `SELECT * FROM ${this.tableName} WHERE ${this.idField} IN (${placeholders})`
        const rows = this.db.query<unknown, string[]>(query).all(...chunk)
        for (const row of rows) {
          entities.push(this.mapRowToEntity(row))
        }
      }
      return entities
    } catch (error) {
      throw new DatabaseException(`Failed to find ${this.tableName} by ids: ${error}`)
    }
  }
}
