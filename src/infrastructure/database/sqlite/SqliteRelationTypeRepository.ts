import type { Database } from 'bun:sqlite'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { RelationTypeId, PaginationOptions, PaginatedResult } from '@/shared/types/common.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

interface RelationTypeRow {
  id: number
  identifier: string
  description: string | null
  category: string | null
  created_at: string
  updated_at: string
}

export class SqliteRelationTypeRepository implements IRelationTypeRepository {
  constructor(private readonly db: Database) {}

  async save(relationType: RelationType): Promise<void> {
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
          data.updated_at
        ])
        
        console.log('New relation type created with ID:', result.lastInsertRowid)
      } catch (error) {
        console.error('Save error:', error)
        throw new DatabaseException(`Failed to save relation type: ${error}`)
      }
    } else {
      await this.update(relationType)
    }
  }

  async findById(id: RelationTypeId): Promise<RelationType | null> {
    const query = `
      SELECT id, identifier, description, category, created_at, updated_at
      FROM relation_types
      WHERE id = ?
    `
    
    try {
      const row = this.db.query<RelationTypeRow, [string]>(query).get(id)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find relation type by id: ${error}`)
    }
  }

  async findByIdentifier(identifier: string): Promise<RelationType | null> {
    const query = `
      SELECT id, identifier, description, category, created_at, updated_at
      FROM relation_types
      WHERE identifier = ?
    `
    
    try {
      const row = this.db.query<RelationTypeRow, [string]>(query).get(identifier)
      return row ? this.mapRowToEntity(row) : null
    } catch (error) {
      throw new DatabaseException(`Failed to find relation type by identifier: ${error}`)
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<RelationType>> {
    const { limit = 10, offset = 0 } = options
    
    const dataQuery = `
      SELECT id, identifier, description, category, created_at, updated_at
      FROM relation_types
      ORDER BY identifier ASC
      LIMIT ? OFFSET ?
    `
    
    const countQuery = `SELECT COUNT(*) as count FROM relation_types`
    
    try {
      const rows = this.db.query<RelationTypeRow, [number, number]>(dataQuery).all(limit, offset)
      const countResult = this.db.query<{ count: number }, []>(countQuery).get()
      const total = countResult?.count || 0
      
      const relationTypes = rows.map(row => this.mapRowToEntity(row))
      
      return {
        data: relationTypes,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find all relation types: ${error}`)
    }
  }

  async update(relationType: RelationType): Promise<void> {
    const data = relationType.toDatabase()
    
    const query = `
      UPDATE relation_types 
      SET identifier = ?, description = ?, category = ?, updated_at = ?
      WHERE id = ?
    `
    
    try {
      const result = this.db.run(query, [
        data.identifier,
        data.description,
        data.category,
        data.updated_at,
        data.id
      ])
      
      if (result.changes === 0) {
        throw new DatabaseException(`RelationType with id ${data.id} not found for update`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to update relation type: ${error}`)
    }
  }

  async delete(id: RelationTypeId): Promise<void> {
    const query = `DELETE FROM relation_types WHERE id = ?`
    
    try {
      const result = this.db.run(query, [id])
      if (result.changes === 0) {
        throw new DatabaseException(`RelationType with id ${id} not found`)
      }
    } catch (error) {
      throw new DatabaseException(`Failed to delete relation type: ${error}`)
    }
  }

  async exists(identifier: string): Promise<boolean> {
    const query = `SELECT 1 FROM relation_types WHERE identifier = ? LIMIT 1`
    
    try {
      const row = this.db.query<{ 1: number }, [string]>(query).get(identifier)
      return row !== null
    } catch (error) {
      throw new DatabaseException(`Failed to check relation type existence: ${error}`)
    }
  }

  private mapRowToEntity(row: RelationTypeRow): RelationType {
    return RelationType.fromDatabase(
      row.id.toString(),
      row.identifier,
      row.description,
      row.category,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}