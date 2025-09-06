import type { Database } from 'bun:sqlite'
import type { ILogger } from '@/application/ports/ILogger.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  IQueryTemplateRepository,
  SearchCriteria,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

interface QueryTemplateRow {
  id: number
  identifier: string
  name: string
  description: string | null
  query_text: string
  query_name: string | null
  operation_type: string | null
  variables_schema: string | null
  default_variables: string | null
  applicable_tables: string | null
  complexity_score: number | null
  usage_count: number | null
  last_used_at: string | null
  avg_execution_time_ms: number | null
  version: string | null
  is_active: number | boolean
  tags: string | null
  created_at: string
  updated_at: string
}

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
      const row = this.db.query<QueryTemplateRow, [string]>(query).get(id)

      if (!row) return null

      return QueryTemplate.fromDatabase(
        String(row.id),
        row.identifier,
        row.name,
        row.description,
        row.query_text,
        row.query_name,
        row.operation_type || 'query',
        row.variables_schema,
        row.default_variables,
        row.applicable_tables,
        row.operation_type || 'query', // Pass operation_type as templateType for compatibility
        row.complexity_score || 0,
        row.usage_count || 0,
        row.last_used_at,
        row.avg_execution_time_ms,
        row.version || '1.0',
        Boolean(row.is_active),
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by id', { id, error })
      throw new DomainException('Failed to find template', { code: 'DATABASE_ERROR' })
    }
  }

  async findByIdentifier(identifier: string): Promise<QueryTemplate | null> {
    try {
      const query = `
        SELECT * FROM templates WHERE identifier = ?
      `
      const row = this.db.query<QueryTemplateRow, [string]>(query).get(identifier)

      if (!row) return null

      return QueryTemplate.fromDatabase(
        String(row.id),
        row.identifier,
        row.name,
        row.description,
        row.query_text,
        row.query_name,
        row.operation_type || 'query',
        row.variables_schema,
        row.default_variables,
        row.applicable_tables,
        row.operation_type || 'query', // Pass operation_type as templateType for compatibility
        row.complexity_score || 0,
        row.usage_count || 0,
        row.last_used_at,
        row.avg_execution_time_ms,
        row.version || '1.0',
        Boolean(row.is_active),
        row.tags,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find template by identifier', { identifier, error })
      throw new DomainException('Failed to find template', { code: 'DATABASE_ERROR' })
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

      // Operation type filter (legacy templateType support)
      if (criteria.templateType) {
        query += ` AND operation_type = ?`
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
      const totalResult = this.db.query<{ total: number }, any[]>(countQuery).get(...params)
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

      const rows = this.db.query<QueryTemplateRow, any[]>(query).all(...params)

      const items = rows.map((row) =>
        QueryTemplate.fromDatabase(
          String(row.id),
          row.identifier,
          row.name,
          row.description,
          row.query_text,
          row.query_name,
          row.operation_type || 'query',
          row.variables_schema,
          row.default_variables,
          row.applicable_tables,
          row.operation_type || 'query', // Pass operation_type as templateType for compatibility
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0',
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
      throw new DomainException('Failed to search templates', { code: 'DATABASE_ERROR' })
    }
  }

  async create(template: QueryTemplate): Promise<QueryTemplate> {
    try {
      const data = template.toDatabase()

      const query = `
        INSERT INTO templates (
          identifier, name, description, query_text, query_name, operation_type,
          variables_schema, default_variables, applicable_tables,
          complexity_score, usage_count, last_used_at, avg_execution_time_ms,
          version, is_active, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const result = this.db.run(query, [
        data.identifier,
        data.name,
        data.description,
        data.query_text,
        data.query_name,
        data.operation_type,
        data.variables_schema,
        data.default_variables,
        data.applicable_tables,
        data.complexity_score,
        data.usage_count,
        data.last_used_at,
        data.avg_execution_time_ms,
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
        data.query_name,
        data.operation_type,
        data.variables_schema,
        data.default_variables,
        data.applicable_tables,
        data.operation_type || 'query', // Pass operation_type as templateType for compatibility
        data.complexity_score,
        data.usage_count,
        data.last_used_at,
        data.avg_execution_time_ms,
        data.version,
        data.is_active,
        data.tags,
        data.created_at,
        data.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to create template', { template, error })
      throw new DomainException('Failed to create template', { code: 'DATABASE_ERROR' })
    }
  }

  async update(id: string, updates: Partial<QueryTemplate>): Promise<QueryTemplate> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new DomainException('Template not found', { code: 'NOT_FOUND' })
      }

      const data = existing.toDatabase()

      const query = `
        UPDATE templates SET
          name = ?,
          description = ?,
          query_text = ?,
          query_name = ?,
          operation_type = ?,
          variables_schema = ?,
          default_variables = ?,
          applicable_tables = ?,
          complexity_score = ?,
          usage_count = ?,
          last_used_at = ?,
          avg_execution_time_ms = ?,
          version = ?,
          is_active = ?,
          tags = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(
        data.name,
        data.description,
        data.query_text,
        data.query_name,
        data.operation_type,
        data.variables_schema,
        data.default_variables,
        data.applicable_tables,
        data.complexity_score,
        data.usage_count,
        data.last_used_at,
        data.avg_execution_time_ms,
        data.version,
        data.is_active,
        data.tags,
        id
      )

      return existing
    } catch (error) {
      this.logger.error('Failed to update template', { id, updates, error })
      throw new DomainException('Failed to update template', { code: 'DATABASE_ERROR' })
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const query = `DELETE FROM templates WHERE id = ?`
      const result = this.db.run(query, [id])
      return result.changes > 0
    } catch (error) {
      this.logger.error('Failed to delete template', { id, error })
      throw new DomainException('Failed to delete template', { code: 'DATABASE_ERROR' })
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      const query = `
        UPDATE templates 
        SET usage_count = usage_count + 1,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(id)
    } catch (error) {
      this.logger.error('Failed to increment usage', { id, error })
      throw new DomainException('Failed to increment usage', { code: 'DATABASE_ERROR' })
    }
  }

  async updateExecutionStats(id: string, executionTimeMs: number): Promise<void> {
    try {
      // Get current stats to calculate new average
      const currentTemplate = await this.findById(id)
      if (!currentTemplate) {
        throw new DomainException('Template not found', { code: 'NOT_FOUND' })
      }
      
      const currentCount = currentTemplate.getUsageCount()
      const currentAvg = currentTemplate.getAvgExecutionTimeMs()
      const newCount = currentCount + 1
      const newAvg = currentCount > 0 
        ? Math.round((currentAvg * currentCount + executionTimeMs) / newCount)
        : executionTimeMs
      
      const query = `
        UPDATE templates 
        SET usage_count = ?,
            last_used_at = CURRENT_TIMESTAMP,
            avg_execution_time_ms = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(newCount, newAvg, id)
    } catch (error) {
      this.logger.error('Failed to update execution stats', { id, executionTimeMs, error })
      throw new DomainException('Failed to update execution stats', { code: 'DATABASE_ERROR' })
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
          row.query_name,
          row.operation_type || 'query',
          row.variables_schema,
          row.default_variables,
          row.applicable_tables,
          row.operation_type || 'query', // Pass operation_type as templateType for compatibility
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0',
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at
        )
      )
    } catch (error) {
      this.logger.error('Failed to find popular templates', { limit, error })
      throw new DomainException('Failed to find popular templates', { code: 'DATABASE_ERROR' })
    }
  }

  async updateStatus(id: string, isActive: boolean): Promise<QueryTemplate> {
    try {
      const template = await this.findById(id)
      if (!template) {
        throw new DomainException('Template not found', { code: 'NOT_FOUND' })
      }

      const updatedTemplate = isActive ? template.activate() : template.deactivate()
      const data = updatedTemplate.toDatabase()

      const query = `
        UPDATE templates 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(isActive, id)

      return updatedTemplate
    } catch (error) {
      this.logger.error('Failed to update template status', { id, isActive, error })
      throw new DomainException('Failed to update template status', { code: 'DATABASE_ERROR' })
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
