import type { RelationTypeId } from '@/core/types/CommonTypes.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

interface RelationTypeRow {
  id: number
  identifier: string
  description: string | null
  category: string | null
  created_at: string
  updated_at: string
}

export class SqliteRelationTypeRepository
  extends BaseSqliteRepository<RelationType, RelationTypeId>
  implements IRelationTypeRepository
{
  protected get tableName(): string {
    return 'relation_types'
  }

  async save(relationType: RelationType): Promise<RelationType | undefined> {
    const data = relationType.toDatabase()

    if (!data.id) {
      const query = `
        INSERT INTO relation_types (identifier, description, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `

      try {
        const result = this.db.run(query, [
          data.identifier,
          data.description,
          data.category,
          data.created_at,
          data.updated_at,
        ])

        console.log('New relation type created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save relation type: ${error}`)
      }
    } else {
      await this.update(relationType)
    }
    return undefined
  }

  // findById() - inherited from BaseSqliteRepository

  async findByIdentifier(identifier: string): Promise<RelationType | null> {
    return this.findByIdentifierField(identifier)
  }

  // findAll() - inherited from BaseSqliteRepository
  // Note: Base class uses 'created_at DESC' ordering, original used 'identifier ASC'
  // If specific ordering is critical, this can be overridden

  async update(relationType: RelationType): Promise<void> {
    const data = relationType.toDatabase()

    const query = `
      UPDATE relation_types 
      SET identifier = ?, description = ?, category = ?, updated_at = ?
      WHERE id = ?
    `

    try {
      const result = this.db.run(query, [data.identifier, data.description, data.category, data.updated_at, data.id])

      if (result.changes === 0) {
        throw new DatabaseException(`RelationType with id ${data.id} not found for update`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to update relation type: ${error}`)
    }
  }

  // delete() - inherited from BaseSqliteRepository

  // exists() - inherited from BaseSqliteRepository

  protected mapRowToEntity(row: RelationTypeRow): RelationType {
    return RelationType.fromDatabase(
      row.id.toString(),
      row.identifier,
      row.description,
      row.category,
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }

  // IRepositoryWithBatchOperations method implementations
  async saveMany(relationTypes: RelationType[]): Promise<void> {
    if (relationTypes.length === 0) return

    const query = `
      INSERT INTO relation_types (identifier, description, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `

    try {
      for (const relationType of relationTypes) {
        const data = relationType.toDatabase()
        this.db.run(query, [data.identifier, data.description, data.category, data.created_at, data.updated_at])
      }
    } catch (error) {
      throw new DatabaseException(`Failed to save multiple relation types: ${error}`)
    }
  }

  async deleteMany(ids: RelationTypeId[]): Promise<void> {
    if (ids.length === 0) return

    const placeholders = ids.map(() => '?').join(', ')
    const query = `DELETE FROM relation_types WHERE id IN (${placeholders})`

    try {
      this.db.run(query, ids)
    } catch (error) {
      throw new DatabaseException(`Failed to delete multiple relation types: ${error}`)
    }
  }
}
