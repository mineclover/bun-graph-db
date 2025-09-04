import type { Database } from 'bun:sqlite'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import type { AttributeTypeId, PaginationOptions, PaginatedResult } from '@/core/types/CommonTypes.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

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

export class SqliteAttributeTypeRepository implements IAttributeTypeRepository {
  constructor(private readonly db: Database) {}

  async save(attributeType: AttributeType): Promise<void> {
    const attributeTypeData = attributeType.toDatabase()
    
    if (attributeTypeData.id === null || attributeTypeData.id === 'null') {
      const query = `
        INSERT INTO attribute_types (identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      try {
        const result = this.db.run(query, [
          attributeTypeData.identifier,
          attributeTypeData.json_type,
          attributeTypeData.format,
          attributeTypeData.description,
          attributeTypeData.validation_schema,
          attributeTypeData.reference_config,
          attributeTypeData.default_value,
          attributeTypeData.examples,
          attributeTypeData.created_at,
          attributeTypeData.updated_at
        ])
        
        console.log('New attribute type created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save attribute type: ${error}`)
      }
    } else {
      const query = `
        UPDATE attribute_types 
        SET identifier = ?, json_type = ?, format = ?, description = ?, validation_schema = ?, reference_config = ?, default_value = ?, examples = ?, updated_at = ?
        WHERE id = ?
      `
      
      try {
        this.db.run(query, [
          attributeTypeData.identifier,
          attributeTypeData.json_type,
          attributeTypeData.format,
          attributeTypeData.description,
          attributeTypeData.validation_schema,
          attributeTypeData.reference_config,
          attributeTypeData.default_value,
          attributeTypeData.examples,
          attributeTypeData.updated_at,
          attributeTypeData.id
        ])
      } catch (error) {
        throw new DatabaseException(`Failed to update attribute type: ${error}`)
      }
    }
  }

  async findById(id: AttributeTypeId): Promise<AttributeType | null> {
    const query = `
      SELECT id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at
      FROM attribute_types
      WHERE id = ?
    `
    
    try {
      const row = this.db.query<AttributeTypeRow, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute type by id: ${error}`)
    }
  }

  async findByIdentifier(identifier: string): Promise<AttributeType | null> {
    const query = `
      SELECT id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at
      FROM attribute_types
      WHERE identifier = ?
    `
    
    try {
      const row = this.db.query<AttributeTypeRow, [string]>(query).get(identifier)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute type by identifier: ${error}`)
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<AttributeType>> {
    const { limit = 10, offset = 0 } = options
    
    const dataQuery = `
      SELECT id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at
      FROM attribute_types
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    
    const countQuery = `SELECT COUNT(*) as count FROM attribute_types`
    
    try {
      const rows = this.db.query<AttributeTypeRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0
      
      const attributeTypes = rows.map(row => this.mapRowToEntity(row))
      
      return {
        data: attributeTypes,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all attribute types: ${error}`)
    }
  }

  async findByJsonType(jsonType: string, options: PaginationOptions = {}): Promise<PaginatedResult<AttributeType>> {
    const { limit = 10, offset = 0 } = options
    
    const dataQuery = `
      SELECT id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at
      FROM attribute_types
      WHERE json_type = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    
    const countQuery = `SELECT COUNT(*) as count FROM attribute_types WHERE json_type = ?`
    
    try {
      const rows = this.db.query<AttributeTypeRow, [string, number, number]>(dataQuery).all(jsonType, limit, offset)
      const countResult = this.db.query<{ count: number }, [string]>(countQuery).get(jsonType)
      const total = countResult?.count || 0
      
      const attributeTypes = rows.map(row => this.mapRowToEntity(row))
      
      return {
        data: attributeTypes,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute types by json type: ${error}`)
    }
  }

  async delete(id: AttributeTypeId): Promise<void> {
    const query = `DELETE FROM attribute_types WHERE id = ?`
    
    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`Attribute type with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete attribute type: ${error}`)
    }
  }

  async exists(identifier: string): Promise<boolean> {
    const query = `SELECT 1 FROM attribute_types WHERE identifier = ? LIMIT 1`
    
    try {
      const row = this.db.query<{ 1: number }, [string]>(query).get(identifier)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check attribute type existence: ${error}`)
    }
  }

  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM attribute_types`
    
    try {
      const result = this.db.query<{ count: number }, []>(query).get()
      return result?.count || 0
    } catch (error) {
      throw new DatabaseException(`Failed to count attribute types: ${error}`)
    }
  }

  async saveMany(attributeTypes: AttributeType[]): Promise<void> {
    if (attributeTypes.length === 0) return
    
    const query = `
      INSERT OR REPLACE INTO attribute_types (id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    try {
      const stmt = this.db.prepare(query)
      
      this.db.transaction(() => {
        for (const attributeType of attributeTypes) {
          const attributeTypeData = attributeType.toDatabase()
          stmt.run(
            attributeTypeData.id,
            attributeTypeData.identifier,
            attributeTypeData.json_type,
            attributeTypeData.format,
            attributeTypeData.description,
            attributeTypeData.validation_schema,
            attributeTypeData.reference_config,
            attributeTypeData.default_value,
            attributeTypeData.examples,
            attributeTypeData.created_at,
            attributeTypeData.updated_at
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple attribute types: ${error}`)
    }
  }

  async findByIds(ids: AttributeTypeId[]): Promise<AttributeType[]> {
    if (ids.length === 0) return []
    
    const placeholders = ids.map(() => '?').join(',')
    const query = `
      SELECT id, identifier, json_type, format, description, validation_schema, reference_config, default_value, examples, created_at, updated_at
      FROM attribute_types
      WHERE id IN (${placeholders})
    `
    
    try {
      const rows = this.db.query<AttributeTypeRow, string[]>(query).all(...ids)
      return rows.map(row => this.mapRowToEntity(row))
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute types by ids: ${error}`)
    }
  }

  private mapRowToEntity(row: AttributeTypeRow): AttributeType {
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