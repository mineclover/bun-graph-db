import type { Database } from 'bun:sqlite'
import type {
  AttributeId,
  AttributeTypeId,
  PaginatedResult,
  PaginationOptions,
  TableId,
} from '@/core/types/CommonTypes.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface AttributeRow {
  id: number
  table_id: number
  identifier: string
  attribute_type_id: number
  description: string | null
  is_required: boolean
  metadata: string | null
  created_at: string
  updated_at: string
}

interface AttributeTypeRow {
  id: number
  identifier: string
  json_type: string
  format: string | null
  description: string | null
  validation_schema: string | null
  reference_config: string | null
  default_value: string | null
  examples: string | null
  created_at: string
  updated_at: string
}

export class SqliteAttributeRepository implements IAttributeRepository {
  constructor(private readonly db: Database) {}

  async save(attribute: Attribute): Promise<void> {
    const attributeData = attribute.toDatabase()

    if (attributeData.id === null || attributeData.id === 'null') {
      const query = `
        INSERT INTO attributes (table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          attributeData.table_id,
          attributeData.identifier,
          attributeData.attribute_type_id,
          attributeData.description,
          attributeData.is_required,
          attributeData.metadata,
          attributeData.created_at,
          attributeData.updated_at,
        ])

        console.log('New attribute created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save attribute: ${error}`)
      }
    } else {
      const query = `
        UPDATE attributes 
        SET table_id = ?, identifier = ?, attribute_type_id = ?, description = ?, is_required = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `

      try {
        this.db.run(query, [
          attributeData.table_id,
          attributeData.identifier,
          attributeData.attribute_type_id,
          attributeData.description,
          attributeData.is_required,
          attributeData.metadata,
          attributeData.updated_at,
          attributeData.id,
        ])
      } catch (error) {
        throw new DatabaseException(`Failed to update attribute: ${error}`)
      }
    }
  }

  async findById(id: AttributeId): Promise<Attribute | null> {
    const query = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE id = ?
    `

    try {
      const row = this.db.query<AttributeRow, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute by id: ${error}`)
    }
  }

  async findByTableIdAndIdentifier(
    tableId: TableId,
    identifier: string
  ): Promise<Attribute | null> {
    const query = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE table_id = ? AND identifier = ?
    `

    try {
      const row = this.db.query<AttributeRow, [string, string]>(query).get(tableId, identifier)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute by table and identifier: ${error}`)
    }
  }

  async findByTableId(
    tableId: TableId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Attribute>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE table_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM attributes WHERE table_id = ?`

    try {
      const rows = this.db
        .query<AttributeRow, [string, number, number]>(dataQuery)
        .all(tableId, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(tableId)
      const total = countResult?.count || 0

      const attributes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: attributes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: attributes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find attributes by table id: ${error}`)
    }
  }

  async findByAttributeTypeId(
    attributeTypeId: AttributeTypeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Attribute>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE attribute_type_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM attributes WHERE attribute_type_id = ?`

    try {
      const rows = this.db
        .query<AttributeRow, [string, number, number]>(dataQuery)
        .all(attributeTypeId, limit, offset)
      const countResult = this.db
        .query<{ count: number }, [string]>(countQuery)
        .get(attributeTypeId)
      const total = countResult?.count || 0

      const attributes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: attributes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: attributes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find attributes by attribute type id: ${error}`)
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Attribute>> {
    const { limit = 10, offset = 0 } = options

    const dataQuery = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `SELECT COUNT(*) as count FROM attributes`

    try {
      const rows = this.db.query<AttributeRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0

      const attributes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: attributes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: attributes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all attributes: ${error}`)
    }
  }

  async delete(id: AttributeId): Promise<void> {
    const query = `DELETE FROM attributes WHERE id = ?`

    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`Attribute with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete attribute: ${error}`)
    }
  }

  async deleteByTableId(tableId: TableId): Promise<void> {
    const query = `DELETE FROM attributes WHERE table_id = ?`

    try {
      this.db.run(query, [tableId])
    } catch (error) {
      throw new DatabaseException(`Failed to delete attributes by table id: ${error}`)
    }
  }

  async exists(tableId: TableId, identifier: string): Promise<boolean> {
    const query = `SELECT 1 FROM attributes WHERE table_id = ? AND identifier = ? LIMIT 1`

    try {
      const row = this.db.query<{ 1: number }, [string, string]>(query).get(tableId, identifier)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check attribute existence: ${error}`)
    }
  }

  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM attributes`

    try {
      const result = this.db.query<{ count: number }, []>(query).get()
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count attributes: ${error}`)
    }
  }

  async countByTableId(tableId: TableId): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM attributes WHERE table_id = ?`

    try {
      const result = this.db.query<{ count: number }, [string]>(query).get(tableId)
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count attributes by table id: ${error}`)
    }
  }

  async saveMany(attributes: Attribute[]): Promise<void> {
    if (attributes.length === 0) return

    const query = `
      INSERT OR REPLACE INTO attributes (id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      const stmt = this.db.prepare(query)

      this.db.transaction(() => {
        for (const attribute of attributes) {
          const attributeData = attribute.toDatabase()
          stmt.run(
            attributeData.id,
            attributeData.table_id,
            attributeData.identifier,
            attributeData.attribute_type_id,
            attributeData.description,
            attributeData.is_required,
            attributeData.metadata,
            attributeData.created_at,
            attributeData.updated_at
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple attributes: ${error}`)
    }
  }

  async findByIds(ids: AttributeId[]): Promise<Attribute[]> {
    if (ids.length === 0) return []

    const placeholders = ids.map(() => '?').join(',')
    const query = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE id IN (${placeholders})
    `

    try {
      const rows = this.db.query<AttributeRow, string[]>(query).all(...ids)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find attributes by ids: ${error}`)
    }
  }

  async findRequiredByTableId(tableId: TableId): Promise<Attribute[]> {
    const query = `
      SELECT id, table_id, identifier, attribute_type_id, description, is_required, metadata, created_at, updated_at
      FROM attributes
      WHERE table_id = ? AND is_required = TRUE
      ORDER BY created_at ASC
    `

    try {
      const rows = this.db.query<AttributeRow, [string]>(query).all(tableId)
      return rows.map((row) => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find required attributes by table id: ${error}`)
    }
  }

  async getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null> {
    const query = `
      SELECT at.id, at.identifier, at.json_type, at.format, at.description,
             at.validation_schema, at.reference_config, at.default_value,
             at.examples, at.created_at, at.updated_at
      FROM attribute_types at
      INNER JOIN attributes a ON a.attribute_type_id = at.id
      WHERE a.id = ?
    `

    try {
      const row = this.db.query<AttributeTypeRow, [string]>(query).get(attributeId)
      return row ? this.mapAttributeTypeRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to get attribute type for attribute: ${error}`)
    }
  }

  private mapRowToEntity(row: AttributeRow): Attribute {
    return Attribute.fromDatabase(
      row.id.toString(),
      row.table_id.toString(),
      row.identifier,
      row.attribute_type_id.toString(),
      row.description,
      row.is_required,
      row.metadata,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }

  private mapAttributeTypeRowToEntity(row: AttributeTypeRow): AttributeType {
    return AttributeType.fromDatabase(
      row.id.toString(),
      row.identifier,
      row.json_type,
      row.format,
      row.description,
      row.validation_schema,
      row.reference_config,
      row.default_value,
      row.examples,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
