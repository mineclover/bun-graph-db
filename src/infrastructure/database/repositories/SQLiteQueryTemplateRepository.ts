import type { Database } from 'bun:sqlite'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository, SearchCriteria } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

export class SQLiteQueryTemplateRepository implements IQueryTemplateRepository {
  constructor(
    private readonly db: Database,
    private readonly logger: ILogger
  ) {}

  async findById(id: string): Promise<QueryTemplate | null> {
    try {
      const query = `
        SELECT * FROM templates WHERE id = ?
      `
      const row = this.db.query(query).get(id) as any

      if (!row) return null

      return QueryTemplate.fromDatabase(
        row.id,
        row.identifier,
        row.name,
        row.description,
        row.query_text,
        row.variables_schema,
        row.default_variables,
        row.applicable_tables,
        row.template_type,
        row.complexity_score,
        row.usage_count,
        row.version,
        row.is_active,
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by id', { id, error })
      throw new DatabaseException('Failed to find template', error as Error)
    }
  }

  async findByIdentifier(identifier: string): Promise<QueryTemplate | null> {
    try {
      const query = `
        SELECT * FROM templates WHERE identifier = ?
      `
      const row = this.db.query(query).get(identifier) as any

      if (!row) return null

      return QueryTemplate.fromDatabase(
        row.id,
        row.identifier,
        row.name,
        row.description,
        row.query_text,
        row.variables_schema,
        row.default_variables,
        row.applicable_tables,
        row.template_type,
        row.complexity_score,
        row.usage_count,
        row.version,
        row.is_active,
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by identifier', { identifier, error })
      throw new DatabaseException('Failed to find template', error as Error)
    }
  }

  async search(criteria: SearchCriteria): Promise<QueryTemplate[]> {
    try {
      let query = `SELECT * FROM templates WHERE 1=1`
      const params: any[] = []

      // Active filter
      if (criteria.isActive !== undefined) {
        query += ` AND is_active = ?`
        params.push(criteria.isActive ? 1 : 0)
      }

      // Template type filter
      if (criteria.templateType) {
        query += ` AND template_type = ?`
        params.push(criteria.templateType)
      }

      // Tag filtering
      if (criteria.tags && criteria.tags.length > 0) {
        if (criteria.tagMatchMode === 'ALL') {
          // Must have all tags
          for (const tag of criteria.tags) {
            query += ` AND json_extract(tags, '$') LIKE ?`
            params.push(`%"${tag}"%`)
          }
        } else {
          // Must have at least one tag (ANY mode)
          const tagConditions = criteria.tags.map(() => `json_extract(tags, '$') LIKE ?`).join(' OR ')
          query += ` AND (${tagConditions})`
          criteria.tags.forEach(tag => params.push(`%"${tag}"%`))
        }
      }

      // Table filtering
      if (criteria.applicableToTable) {
        if (criteria.includeUniversal !== false) {
          query += ` AND (applicable_tables IS NULL OR json_extract(applicable_tables, '$') LIKE ?)`
          params.push(`%"${criteria.applicableToTable}"%`)
        } else {
          query += ` AND json_extract(applicable_tables, '$') LIKE ?`
          params.push(`%"${criteria.applicableToTable}"%`)
        }
      }

      // Ordering
      const orderBy = criteria.orderBy || 'usage_count'
      const orderDirection = criteria.orderDirection || 'DESC'
      const orderColumn = this.mapOrderByField(orderBy)
      query += ` ORDER BY ${orderColumn} ${orderDirection}`

      // Pagination
      if (criteria.limit) {
        query += ` LIMIT ?`
        params.push(criteria.limit)
        
        if (criteria.offset) {
          query += ` OFFSET ?`
          params.push(criteria.offset)
        }
      }

      const rows = this.db.query(query).all(...params) as any[]

      return rows.map(row => QueryTemplate.fromDatabase(
        row.id,
        row.identifier,
        row.name,
        row.description,
        row.query_text,
        row.variables_schema,
        row.default_variables,
        row.applicable_tables,
        row.template_type,
        row.complexity_score,
        row.usage_count,
        row.version,
        row.is_active,
        row.tags,
        row.created_at,
        row.updated_at
      ))
    } catch (error) {
      this.logger.error('Failed to search templates', { criteria, error })
      throw new DatabaseException('Failed to search templates', error as Error)
    }
  }

  async save(template: QueryTemplate): Promise<QueryTemplate> {
    try {
      const data = template.toDatabase()
      
      if (data.id) {
        // Update existing
        const query = `
          UPDATE templates SET
            name = ?,
            description = ?,
            query_text = ?,
            variables_schema = ?,
            default_variables = ?,
            applicable_tables = ?,
            template_type = ?,
            complexity_score = ?,
            usage_count = ?,
            version = ?,
            is_active = ?,
            tags = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        this.db.query(query).run(
          data.name,
          data.description,
          data.query_text,
          data.variables_schema,
          data.default_variables,
          data.applicable_tables,
          data.template_type,
          data.complexity_score,
          data.usage_count,
          data.version,
          data.is_active,
          data.tags,
          data.id
        )
        
        return template
      } else {
        // Insert new
        const query = `
          INSERT INTO templates (
            identifier, name, description, query_text,
            variables_schema, default_variables, applicable_tables,
            template_type, complexity_score, usage_count,
            version, is_active, tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        const result = this.db.query(query).run(
          data.identifier,
          data.name,
          data.description,
          data.query_text,
          data.variables_schema,
          data.default_variables,
          data.applicable_tables,
          data.template_type,
          data.complexity_score,
          data.usage_count,
          data.version,
          data.is_active,
          data.tags
        )
        
        // Return with the new ID
        return QueryTemplate.fromDatabase(
          result.lastInsertRowid as string,
          data.identifier,
          data.name,
          data.description,
          data.query_text,
          data.variables_schema,
          data.default_variables,
          data.applicable_tables,
          data.template_type,
          data.complexity_score,
          data.usage_count,
          data.version,
          data.is_active,
          data.tags,
          data.created_at,
          data.updated_at
        )
      }
    } catch (error) {
      this.logger.error('Failed to save template', { template, error })
      throw new DatabaseException('Failed to save template', error as Error)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const query = `DELETE FROM templates WHERE id = ?`
      const result = this.db.query(query).run(id)
      return result.changes > 0
    } catch (error) {
      this.logger.error('Failed to delete template', { id, error })
      throw new DatabaseException('Failed to delete template', error as Error)
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      const query = `
        UPDATE templates 
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      this.db.query(query).run(id)
    } catch (error) {
      this.logger.error('Failed to increment usage', { id, error })
      throw new DatabaseException('Failed to increment usage', error as Error)
    }
  }

  private mapOrderByField(field: string): string {
    const mappings: Record<string, string> = {
      'usage_count': 'usage_count',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'name': 'name',
      'complexity_score': 'complexity_score'
    }
    return mappings[field] || 'usage_count'
  }
}