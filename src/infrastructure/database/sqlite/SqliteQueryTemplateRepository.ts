import type { SQLQueryBindings } from './SqliteAdapter.js'
import { getMaxBindParams, type ISqliteDatabase } from './SqlitePort.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  FindTemplateExecutionsOptions,
  IQueryTemplateRepository,
  QueryTemplateUpdateData,
  SearchCriteria,
  TemplateExecutionRecord,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { DatabaseException, DomainException } from '@/shared/exceptions/DomainException.js'
import { BaseSqliteRepository } from './BaseSqliteRepository.js'

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

type SqliteParams = SQLQueryBindings[]

export class SqliteQueryTemplateRepository
  extends BaseSqliteRepository<QueryTemplate, string>
  implements IQueryTemplateRepository
{
  constructor(
    db: ISqliteDatabase,
    private readonly logger: ILogger,
  ) {
    super(db)
  }

  protected get tableName(): string {
    return 'templates'
  }

  // findById() - inherited from BaseSqliteRepository

  async findByIdentifier(identifier: string): Promise<QueryTemplate | null> {
    try {
      return await this.findByIdentifierField(identifier)
    } catch (error) {
      this.logger.error('Failed to find template by identifier', {
        identifier,
        ...toErrorMeta(error),
      })
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
      const params: SqliteParams = []

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

      // Tag filtering - only search valid JSON tags to prevent malformed JSON errors
      if (criteria.tags && criteria.tags.length > 0) {
        if (criteria.tagMatchMode === 'ALL') {
          // Must have all tags
          for (const tag of criteria.tags) {
            query += ` AND json_valid(tags) = 1 AND json_extract(tags, '$') LIKE ?`
            params.push(`%"${tag}"%`)
          }
        } else {
          // Must have at least one tag (ANY mode)
          const tagConditions = criteria.tags
            .map(() => `json_valid(tags) = 1 AND json_extract(tags, '$') LIKE ?`)
            .join(' OR ')
          query += ` AND (${tagConditions})`
          for (const tag of criteria.tags) {
            params.push(`%"${tag}"%`)
          }
        }
      }

      // System Queries filtering - search in query_text since most query_name fields are empty
      if (criteria.systemQueries && criteria.systemQueries.length > 0) {
        if (criteria.systemQueryMatchMode === 'ALL') {
          // Must have all system queries
          for (const systemQuery of criteria.systemQueries) {
            query += ` AND (query_text LIKE ? OR json_extract(query_name, '$') LIKE ?)`
            params.push(`%${systemQuery}%`, `%"${systemQuery}"%`)
          }
        } else {
          // Must have at least one system query (ANY mode)
          const systemQueryConditions = criteria.systemQueries
            .map(() => `(query_text LIKE ? OR json_extract(query_name, '$') LIKE ?)`)
            .join(' OR ')
          query += ` AND (${systemQueryConditions})`
          criteria.systemQueries.forEach((systemQuery) => {
            params.push(`%${systemQuery}%`, `%"${systemQuery}"%`)
          })
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
      const totalResult = this.db.query<{ total: number }, SqliteParams>(countQuery).get(...params)
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

      const rows = this.db.query<QueryTemplateRow, SqliteParams>(query).all(...params)

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
          row.updated_at,
        ),
      )

      return {
        items,
        total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
      }
    } catch (error) {
      this.logger.error('Failed to search templates', { criteria, ...toErrorMeta(error) })
      throw new DomainException('Failed to search templates', { code: 'DATABASE_ERROR' })
    }
  }

  async searchByQueryName(queryName: string): Promise<QueryTemplate[]> {
    try {
      const query = `
        SELECT * FROM templates
        WHERE json_extract(query_name, '$') LIKE ?
        OR query_text LIKE ?
        ORDER BY usage_count DESC
      `
      const searchPattern = `%"${queryName}"%`
      const queryTextPattern = `%${queryName}%`

      const rows = this.db.query<QueryTemplateRow, [string, string]>(query).all(searchPattern, queryTextPattern)

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
          row.operation_type || 'query',
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0.0',
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at,
        ),
      )
    } catch (error) {
      this.logger.error('Failed to search templates by query name', {
        queryName,
        ...toErrorMeta(error),
      })
      throw new DomainException('Failed to search templates by query name', {
        code: 'DATABASE_ERROR',
      })
    }
  }

  async searchByOperationType(operationType: string): Promise<QueryTemplate[]> {
    try {
      const query = `
        SELECT * FROM templates
        WHERE operation_type = ?
        ORDER BY usage_count DESC
      `

      const rows = this.db.query<QueryTemplateRow, [string]>(query).all(operationType)

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
          row.operation_type || 'query',
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0.0',
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at,
        ),
      )
    } catch (error) {
      this.logger.error('Failed to search templates by operation type', {
        operationType,
        ...toErrorMeta(error),
      })
      throw new DomainException('Failed to search templates by operation type', {
        code: 'DATABASE_ERROR',
      })
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
        data.updated_at,
      )
    } catch (error) {
      this.logger.error('Failed to create template', { template, ...toErrorMeta(error) })
      throw new DomainException('Failed to create template', { code: 'DATABASE_ERROR' })
    }
  }

  async update(id: string, updates: QueryTemplateUpdateData): Promise<QueryTemplate> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new DomainException('Template not found', { code: 'NOT_FOUND' })
      }

      // Create a new QueryTemplate instance with the updated values
      const updatedTemplate = new QueryTemplate(
        existing.getId(),
        existing.getIdentifier(),
        updates.name ?? existing.getName(),
        updates.description ?? existing.getDescription(),
        updates.queryText ?? existing.getQueryText(),
        existing.getQueryName(),
        existing.getOperationType(),
        updates.inputSchema ?? existing.getInputSchema(),
        updates.defaultVariables ?? existing.getDefaultVariables(),
        updates.applicableTables ?? existing.getApplicableTables(),
        updates.templateType ?? existing.getTemplateType(),
        updates.complexityScore ?? existing.getComplexityScore(),
        existing.getUsageCount(),
        existing.getLastUsedAt(),
        existing.getAvgExecutionTimeMs(),
        updates.version ?? existing.getVersion(),
        updates.isActive ?? existing.getIsActive(),
        updates.tags ?? existing.getTags(),
        existing.getCreatedAt(),
        new Date(),
      )

      const data = updatedTemplate.toDatabase()

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
        id,
      )

      // Return the updated template by querying from database to ensure consistency
      const result = await this.findById(id)
      if (!result) {
        throw new DomainException('Template not found after update', { code: 'UPDATE_ERROR' })
      }

      return result
    } catch (error) {
      this.logger.error('Failed to update template', { id, updates, ...toErrorMeta(error) })
      throw new DomainException('Failed to update template', { code: 'DATABASE_ERROR' })
    }
  }

  // Implement deleteById to match IQueryTemplateRepository signature (returns boolean instead of void)
  async deleteById(id: string): Promise<boolean> {
    const query = `DELETE FROM templates WHERE id = ?`

    try {
      const result = this.db.run(query, [id])
      return result.changes > 0
    } catch (error) {
      throw new DatabaseException(`Failed to delete query template: ${error}`)
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      // Try to find by ID first, then by identifier to get the actual database ID
      let template = await this.findById(id)
      if (!template) {
        template = await this.findByIdentifier(id)
      }
      if (!template) {
        // Silently return for non-existent templates
        return
      }

      const templateId = template.getId()
      if (!templateId) {
        throw new DomainException('Template ID is null', { code: 'INVALID_STATE' })
      }

      const query = `
        UPDATE templates
        SET usage_count = usage_count + 1,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(templateId)
    } catch (error) {
      this.logger.error('Failed to increment usage', { id, ...toErrorMeta(error) })
      throw new DomainException('Failed to increment usage', { code: 'DATABASE_ERROR' })
    }
  }

  async updateExecutionStats(id: string, executionTimeMs: number): Promise<void> {
    try {
      // Try to find by ID first, then by identifier to get the actual database ID
      let template = await this.findById(id)
      if (!template) {
        template = await this.findByIdentifier(id)
      }
      if (!template) {
        // Silently return for non-existent templates as per interface documentation
        return
      }

      const templateId = template.getId()
      if (!templateId) {
        throw new DomainException('Template ID is null', { code: 'INVALID_STATE' })
      }

      const validExecutionTime = Math.max(0, executionTimeMs)

      // Use atomic SQL update to avoid race conditions
      const query = `
        UPDATE templates
        SET usage_count = usage_count + 1,
            last_used_at = CURRENT_TIMESTAMP,
            avg_execution_time_ms = CASE
              WHEN usage_count = 0 THEN ?
              ELSE CAST((avg_execution_time_ms * usage_count + ?) / (usage_count + 1) AS INTEGER)
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(validExecutionTime, validExecutionTime, templateId)
    } catch (error) {
      this.logger.error('Failed to update execution stats', {
        id,
        executionTimeMs,
        ...toErrorMeta(error),
      })
      throw new DomainException('Failed to update execution stats', { code: 'DATABASE_ERROR' })
    }
  }

  async findByApplicableTable(tableName: string, includeUniversal: boolean = true): Promise<QueryTemplate[]> {
    try {
      let query = `
        SELECT * FROM templates
        WHERE is_active = 1
        AND (json_extract(applicable_tables, '$') LIKE ?`

      if (includeUniversal) {
        query += ` OR applicable_tables IS NULL`
      }

      query += `) ORDER BY usage_count DESC, created_at DESC`

      const searchPattern = `%"${tableName}"%`
      const rows = this.db.query<QueryTemplateRow, [string]>(query).all(searchPattern)

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
          row.operation_type || 'query',
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0',
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at,
        ),
      )
    } catch (error) {
      this.logger.error('Error finding templates by applicable table', {
        tableName,
        includeUniversal,
        ...toErrorMeta(error),
      })
      throw error
    }
  }

  async findTemplatesWithTableDependencies(): Promise<QueryTemplate[]> {
    try {
      const query = `
        SELECT * FROM templates
        WHERE is_active = 1
        AND applicable_tables IS NOT NULL
        AND applicable_tables != 'null'
        AND applicable_tables != '[]'
        ORDER BY created_at DESC
      `
      const rows = this.db.query<QueryTemplateRow, []>(query).all()

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
          row.operation_type || 'query',
          row.complexity_score || 0,
          row.usage_count || 0,
          row.last_used_at,
          row.avg_execution_time_ms,
          row.version || '1.0',
          Boolean(row.is_active),
          row.tags,
          row.created_at,
          row.updated_at,
        ),
      )
    } catch (error) {
      this.logger.error('Error finding templates with table dependencies', toErrorMeta(error))
      throw error
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
      const rows = this.db.query<QueryTemplateRow, [number]>(query).all(limit)

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
          row.updated_at,
        ),
      )
    } catch (error) {
      this.logger.error('Failed to find popular templates', { limit, ...toErrorMeta(error) })
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
      const _data = updatedTemplate.toDatabase()

      const query = `
        UPDATE templates 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      const stmt = this.db.prepare(query)
      stmt.run(isActive, id)

      return updatedTemplate
    } catch (error) {
      this.logger.error('Failed to update template status', { id, isActive, ...toErrorMeta(error) })
      throw new DomainException('Failed to update template status', { code: 'DATABASE_ERROR' })
    }
  }

  async recordExecution(
    input: Omit<TemplateExecutionRecord, 'id' | 'executedAt'> & { executedAt?: string },
  ): Promise<void> {
    if (!this.hasTemplateExecutionsTable()) {
      await this.updateExecutionStats(input.templateId, input.executionTimeMs)
      return
    }

    try {
      const executedAt = input.executedAt ?? new Date().toISOString()
      const variablesJson = input.variablesUsed ? JSON.stringify(input.variablesUsed) : null
      this.db.run(
        `INSERT INTO template_executions (
          template_id, executed_at, execution_time_ms, variables_used,
          result_count, success, error_message, user_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.templateId,
          executedAt,
          Math.max(0, Math.round(input.executionTimeMs)),
          variablesJson,
          Math.max(0, Math.trunc(input.resultCount)),
          input.success ? 1 : 0,
          input.errorMessage,
          input.userContext,
        ],
      )
    } catch (error) {
      this.logger.warn('Failed to record template execution log', {
        templateId: input.templateId,
        ...toErrorMeta(error),
      })
    }
  }

  async findExecutions(
    options: FindTemplateExecutionsOptions = {},
  ): Promise<{ items: TemplateExecutionRecord[]; totalCount: number }> {
    if (!this.hasTemplateExecutionsTable()) {
      return { items: [], totalCount: 0 }
    }

    const whereClauses: string[] = ['1=1']
    const params: SQLQueryBindings[] = []

    if (options.templateId) {
      whereClauses.push('template_id = ?')
      params.push(options.templateId)
    }

    const templateIds = options.templateIds?.filter(Boolean)
    const inlineLimit = getMaxBindParams(this.db, 12)
    const inlineTemplateFilter = Boolean(
      templateIds && templateIds.length > 0 && templateIds.length <= inlineLimit,
    )
    if (inlineTemplateFilter && templateIds) {
      whereClauses.push(`template_id IN (${templateIds.map(() => '?').join(',')})`)
      params.push(...templateIds)
    }

    if (options.start) {
      whereClauses.push('executed_at >= ?')
      params.push(options.start)
    }
    if (options.end) {
      whereClauses.push('executed_at <= ?')
      params.push(options.end)
    }
    if (options.successOnly === true) {
      whereClauses.push('success = 1')
    } else if (options.successOnly === false) {
      whereClauses.push('success = 0')
    }
    if (options.minExecutionTime !== undefined) {
      whereClauses.push('execution_time_ms >= ?')
      params.push(options.minExecutionTime)
    }
    if (options.maxExecutionTime !== undefined) {
      whereClauses.push('execution_time_ms <= ?')
      params.push(options.maxExecutionTime)
    }
    if (options.userContext) {
      whereClauses.push('user_context = ?')
      params.push(options.userContext)
    }

    const whereSql = whereClauses.join(' AND ')

    interface ExecutionRow {
      id: number
      template_id: number
      executed_at: string
      execution_time_ms: number
      variables_used: string | null
      result_count: number | null
      success: number | boolean
      error_message: string | null
      user_context: string | null
    }

    const mapExecutionRow = (row: ExecutionRow): TemplateExecutionRecord => {
      let variablesUsed: Record<string, unknown> | null = null
      if (row.variables_used) {
        try {
          const parsed = JSON.parse(row.variables_used)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            variablesUsed = parsed as Record<string, unknown>
          }
        } catch {
          variablesUsed = null
        }
      }
      return {
        id: String(row.id),
        templateId: String(row.template_id),
        executedAt: row.executed_at,
        executionTimeMs: Number(row.execution_time_ms ?? 0),
        variablesUsed,
        resultCount: Number(row.result_count ?? 0),
        success: Boolean(row.success),
        errorMessage: row.error_message,
        userContext: row.user_context,
      }
    }

    // If templateIds exceeded bind budget, fetch matching rows then post-filter cleanly.
    if (templateIds && templateIds.length > 0 && !inlineTemplateFilter) {
      const allowed = new Set(templateIds.map(String))
      const allRows = this.db
        .query<ExecutionRow, SqliteParams>(
          `SELECT * FROM template_executions WHERE ${whereSql} ORDER BY executed_at DESC, id DESC LIMIT 10000`,
        )
        .all(...params)
      const filtered = allRows.map(mapExecutionRow).filter((item) => allowed.has(item.templateId))
      const offset = Math.max(0, options.offset ?? 0)
      const limit = Math.max(1, options.limit ?? 100)
      return {
        items: filtered.slice(offset, offset + limit),
        totalCount: filtered.length,
      }
    }

    const countRow = this.db
      .query<{ count: number }, SqliteParams>(`SELECT COUNT(*) AS count FROM template_executions WHERE ${whereSql}`)
      .get(...params)
    const totalCount = Number(countRow?.count ?? 0)

    const limit = Math.max(1, options.limit ?? 100)
    const offset = Math.max(0, options.offset ?? 0)
    const rows = this.db
      .query<ExecutionRow, SqliteParams>(
        `SELECT * FROM template_executions WHERE ${whereSql} ORDER BY executed_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset)

    return {
      items: rows.map(mapExecutionRow),
      totalCount,
    }
  }

  private hasTemplateExecutionsTable(): boolean {
    const row = this.db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'template_executions'",
      )
      .get()
    return Boolean(row?.name)
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

  protected mapRowToEntity(row: QueryTemplateRow): QueryTemplate {
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
      row.updated_at,
    )
  }
}
