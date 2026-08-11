import type { AttributeTypeId, PaginatedResult, PaginationOptions } from '@/core/types/CommonTypes.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import type {
  AttributeTypeUpdateData,
  IAttributeTypeRepository,
} from '@/domain/repositories/IAttributeTypeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { debugDatabase } from '@/shared/utils/debugLog.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

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

export class SqliteAttributeTypeRepository
  extends BaseSqliteRepository<AttributeType, AttributeTypeId>
  implements IAttributeTypeRepository
{
  protected get tableName(): string {
    return 'attribute_types'
  }

  async save(attributeType: AttributeType): Promise<void> {
    const attributeTypeData = attributeType.toDatabase()

    if (!attributeTypeData.id || attributeTypeData.id === 'null') {
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
          attributeTypeData.updated_at,
        ])

        debugDatabase('attribute type created', () => ({ id: result.lastInsertRowid }))
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
          attributeTypeData.id,
        ])
      } catch (error) {
        throw new DatabaseException(`Failed to update attribute type: ${error}`)
      }
    }
  }

  // findById() - inherited from BaseSqliteRepository

  async findByIdentifier(identifier: string): Promise<AttributeType | null> {
    return this.findByIdentifierField(identifier)
  }

  // findAll() - inherited from BaseSqliteRepository

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

      const attributeTypes = rows.map((row) => this.mapRowToEntity(row))

      return {
        nodes: attributeTypes,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        data: attributeTypes,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find attribute types by json type: ${error}`)
    }
  }

  // delete() - inherited from BaseSqliteRepository

  // exists() - inherited from BaseSqliteRepository

  // count() - inherited from BaseSqliteRepository

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
            attributeTypeData.updated_at,
          )
        }
      })()
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple attribute types: ${error}`)
    }
  }

  // findByIds() - inherited from BaseSqliteRepository

  async update(id: AttributeTypeId, updates: AttributeTypeUpdateData): Promise<AttributeType> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new DatabaseException(`AttributeType with id ${id} not found`)
    }

    // Create a new AttributeType instance with the updated values
    const updatedAttributeType = new AttributeType(
      existing.getId(),
      updates.identifier ?? existing.getIdentifier(),
      updates.jsonType ?? existing.getJsonType(),
      updates.format ?? existing.getFormat(),
      updates.description ?? existing.getDescription(),
      updates.validationSchema ? JSON.stringify(updates.validationSchema) : existing.getValidationSchema(),
      existing.getReferenceConfig(), // No update available for this
      updates.defaultValue !== undefined ? JSON.stringify(updates.defaultValue) : existing.getDefaultValue(),
      existing.getExamples(), // No update available for this
      existing.getCreatedAt(),
      existing.getUpdatedAt(),
    )

    const data = updatedAttributeType.toDatabase()
    const query = `
      UPDATE attribute_types
      SET identifier = ?, json_type = ?, format = ?, description = ?, validation_schema = ?, reference_config = ?, default_value = ?, examples = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    try {
      const result = this.db.run(query, [
        data.identifier,
        data.json_type,
        data.format,
        data.description,
        data.validation_schema,
        data.reference_config,
        data.default_value,
        data.examples,
        id,
      ])

      if (result.changes === 0) {
        throw new DatabaseException(`AttributeType with id ${id} not found for update`)
      }

      return updatedAttributeType
    } catch (error) {
      throw new DatabaseException(`Failed to update attribute type: ${error}`)
    }
  }

  protected mapRowToEntity(row: AttributeTypeRow): AttributeType {
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
      new Date(row.updated_at),
    )
  }
}
