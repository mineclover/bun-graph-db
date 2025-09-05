import type { Database } from 'bun:sqlite'
import type { ILogger } from '@/application/ports/ILogger.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  IQueryTemplateRepository,
  SearchCriteria,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class SqliteQueryTemplateRepository implements IQueryTemplateRepository {
  constructor(
    private readonly db: Database,
    private readonly logger: ILogger
  ) {}

  async findById(id: string): Promise<QueryTemplate | null> {
    try {
      const query = `
        SELECT * FROM templates WHERE id = ?
      `
      const row = await this.connection.queryFirst(query, [id])

      if (!row) return null

      return QueryTemplate.fromDatabase(
        String(row.id),
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
        Boolean(row.is_active),
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by id', { id, error })
      throw new DomainException('Failed to find template', 'DATABASE_ERROR')
    }
  }

  async findByIdentifier(identifier: string): Promise<QueryTemplate | null> {
    try {
      const query = `
        SELECT * FROM templates WHERE identifier = ?
      `
      const row = await this.connection.queryFirst(query, [identifier])

      if (!row) return null

      return QueryTemplate.fromDatabase(
        String(row.id),
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
        Boolean(row.is_active),
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by identifier', { identifier, error })
      throw new DomainException('Failed to find template', 'DATABASE_ERROR')
    }
  }

  async search(criteria: SearchCriteria): Promise<{
    items: QueryTemplate[]
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
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
          const tagConditions = criteria.tags
            .map(() => `json_extract(tags, '$') LIKE ?`)
            .join(' OR ')
          query += ` AND (${tagConditions})`
          criteria.tags.forEach((tag) => params.push(`%"${tag}"%`))
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

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
      const totalResult = await this.connection.queryFirst(countQuery, params)
      const total = totalResult?.total || 0

      // Ordering
      const orderBy = criteria.orderBy || 'usage_count'
      const orderDirection = criteria.orderDirection || 'DESC'
      const orderColumn = this.mapOrderByField(orderBy)
      query += ` ORDER BY ${orderColumn} ${orderDirection}`

      // Pagination
      const limit = criteria.limit || 10
      const offset = criteria.offset || 0
      query += ` LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const rows = await this.connection.query(query, params)

      const items = rows.map((row) =>
        QueryTemplate.fromDatabase(
          String(row.id),
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
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at
        )
      )

      return {
        items,
        total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
      }
    } catch (error) {
      this.logger.error('Failed to search templates', { criteria, error })
      throw new DomainException('Failed to search templates', 'DATABASE_ERROR')
    }
  }

  async create(template: QueryTemplate): Promise<QueryTemplate> {
    try {
      const data = template.toDatabase()

      const query = `
        INSERT INTO templates (
          identifier, name, description, query_text,
          variables_schema, default_variables, applicable_tables,
          template_type, complexity_score, usage_count,
          version, is_active, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const result = this.db.run(query, [
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
      ])

      // Return with the new ID
      return QueryTemplate.fromDatabase(
        String(result.lastInsertRowid),
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
    } catch (error) {
      this.logger.error('Failed to create template', { template, error })
      throw new DomainException('Failed to create template', 'DATABASE_ERROR')
    }
  }

  async update(id: string, updates: Partial<QueryTemplate>): Promise<QueryTemplate> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new DomainException('Template not found', 'NOT_FOUND')
      }

      const data = existing.toDatabase()

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
      await this.connection.execute(query, [
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
        id,
      ])

      return existing
    } catch (error) {
      this.logger.error('Failed to update template', { id, updates, error })
      throw new DomainException('Failed to update template', 'DATABASE_ERROR')
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const query = `DELETE FROM templates WHERE id = ?`
      const result = this.db.run(query, [id])
      return result.changes > 0
    } catch (error) {
      this.logger.error('Failed to delete template', { id, error })
      throw new DomainException('Failed to delete template', 'DATABASE_ERROR')
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
      await this.connection.execute(query, [id])
    } catch (error) {
      this.logger.error('Failed to increment usage', { id, error })
      throw new DomainException('Failed to increment usage', 'DATABASE_ERROR')
    }
  }

  async findPopular(limit: number = 10): Promise<QueryTemplate[]> {
    try {
      const query = `
        SELECT * FROM templates 
        WHERE is_active = 1 
        ORDER BY usage_count DESC 
        LIMIT ?
      `
      const rows = this.db.query<any, [number]>(query).all(limit)

      return rows.map((row) =>
        QueryTemplate.fromDatabase(
          String(row.id),
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
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at
        )
      )
    } catch (error) {
      this.logger.error('Failed to find popular templates', { limit, error })
      throw new DomainException('Failed to find popular templates', 'DATABASE_ERROR')
    }
  }

  async updateStatus(id: string, isActive: boolean): Promise<QueryTemplate> {
    try {
      const template = await this.findById(id)
      if (!template) {
        throw new DomainException('Template not found', 'NOT_FOUND')
      }

      const updatedTemplate = isActive ? template.activate() : template.deactivate()
      const data = updatedTemplate.toDatabase()

      const query = `
        UPDATE templates 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      await this.connection.execute(query, [isActive, id])

      return updatedTemplate
    } catch (error) {
      this.logger.error('Failed to update template status', { id, isActive, error })
      throw new DomainException('Failed to update template status', 'DATABASE_ERROR')
    }
  }

  private mapOrderByField(field: string): string {
    const mappings: Record<string, string> = {
      usage_count: 'usage_count',
      created_at: 'created_at',
      updated_at: 'updated_at',
      name: 'name',
      complexity_score: 'complexity_score',
    }
    return mappings[field] || 'usage_count'
  }
}
