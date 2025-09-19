/**
 * Template Performance Service
 * Implements 100% utilization of template performance tracking fields
 */

export class TemplatePerformanceService {
  constructor(private db: any) {}

  /**
   * Get comprehensive template performance analytics
   * Utilizes: usage_count, last_used_at, avg_execution_time_ms fields
   */
  async getTemplatePerformanceAnalytics(_filter?: any, _timeRange?: any) {
    // Main analytics query
    const analyticsQuery = `
      SELECT
        COUNT(*) as total_templates,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_templates,
        SUM(usage_count) as total_executions,
        AVG(avg_execution_time_ms) as average_execution_time,
        AVG(CASE WHEN usage_count > 0 THEN 100.0 ELSE 0 END) as success_rate
      FROM templates
      WHERE is_active = 1
    `

    // Performance distribution
    const distributionQuery = `
      SELECT
        COUNT(CASE WHEN avg_execution_time_ms < 50 THEN 1 END) as fast,
        COUNT(CASE WHEN avg_execution_time_ms >= 50 AND avg_execution_time_ms < 200 THEN 1 END) as medium,
        COUNT(CASE WHEN avg_execution_time_ms >= 200 THEN 1 END) as slow
      FROM templates
      WHERE is_active = 1 AND avg_execution_time_ms > 0
    `

    // Most used templates
    const mostUsedQuery = `
      SELECT
        t.*,
        CASE
          WHEN last_used_at > datetime('now', '-7 days') THEN 'INCREASING'
          WHEN last_used_at > datetime('now', '-30 days') THEN 'STABLE'
          ELSE 'DECREASING'
        END as trend
      FROM templates t
      WHERE t.is_active = 1 AND t.usage_count > 0
      ORDER BY t.usage_count DESC
      LIMIT 10
    `

    // Operation type distribution
    const operationStatsQuery = `
      SELECT
        operation_type,
        COUNT(*) as count,
        AVG(avg_execution_time_ms) as avg_execution_time,
        AVG(CASE WHEN usage_count > 0 THEN 100.0 ELSE 0 END) as success_rate
      FROM templates
      WHERE is_active = 1
      GROUP BY operation_type
    `

    try {
      const [analytics, distribution, mostUsed, operationStats] = await Promise.all([
        this.db.get(analyticsQuery),
        this.db.get(distributionQuery),
        this.db.all(mostUsedQuery),
        this.db.all(operationStatsQuery),
      ])

      return {
        totalTemplates: analytics.total_templates,
        activeTemplates: analytics.active_templates,
        totalExecutions: analytics.total_executions,
        averageExecutionTime: analytics.average_execution_time,
        successRate: analytics.success_rate,
        performanceDistribution: {
          fast: distribution.fast,
          medium: distribution.medium,
          slow: distribution.slow,
          percentiles: await this.calculatePercentiles(),
        },
        usagePatterns: {
          mostUsedTemplates: mostUsed.map((template: any) => ({
            template,
            usageCount: template.usage_count,
            avgExecutionTime: template.avg_execution_time_ms,
            lastUsed: template.last_used_at,
            trend: template.trend,
          })),
          operationTypeDistribution: operationStats.map((op: any) => ({
            operationType: op.operation_type,
            count: op.count,
            avgExecutionTime: op.avg_execution_time,
            successRate: op.success_rate,
          })),
          hourlyUsagePattern: await this.getHourlyUsagePattern(),
        },
        recentMetrics: await this.getRecentMetrics(),
      }
    } catch (error) {
      console.error('Error in getTemplatePerformanceAnalytics:', error)
      throw error
    }
  }

  /**
   * Get hot queries - high usage, good performance
   * Utilizes: usage_count, avg_execution_time_ms for ranking
   */
  async getHotQueries(params: {
    limit?: number
    performanceThreshold?: number
    usageThreshold?: number
  }) {
    const { limit = 10, performanceThreshold = 150, usageThreshold = 100 } = params

    const query = `
      SELECT
        t.*,
        -- Performance score: higher usage, lower execution time = better score
        (t.usage_count::float / (t.avg_execution_time_ms + 1)) as performance_score,
        ROW_NUMBER() OVER (ORDER BY t.usage_count DESC) as usage_rank,
        (t.usage_count::float / (t.avg_execution_time_ms + 1)) as efficiency_ratio,
        -- Recent executions from execution log
        COALESCE(recent.executions_24h, 0) as recent_executions,
        COALESCE(recent.success_rate, 100.0) as success_rate
      FROM templates t
      LEFT JOIN (
        SELECT
          te.template_id,
          COUNT(*) as executions_24h,
          COUNT(CASE WHEN te.success = 1 THEN 1 END) * 100.0 / COUNT(*) as success_rate
        FROM template_executions te
        WHERE te.executed_at > datetime('now', '-24 hours')
        GROUP BY te.template_id
      ) recent ON t.id = recent.template_id
      WHERE t.is_active = 1
        AND t.usage_count > ?
        AND t.avg_execution_time_ms <= ?
        AND t.avg_execution_time_ms > 0
      ORDER BY performance_score DESC
      LIMIT ?
    `

    try {
      const results = await this.db.all(query, [usageThreshold, performanceThreshold, limit])

      return results.map((row: any) => ({
        template: this.formatTemplate(row),
        performanceScore: row.performance_score,
        usageRank: row.usage_rank,
        efficiencyRatio: row.efficiency_ratio,
        recentExecutions: row.recent_executions,
        successRate: row.success_rate,
      }))
    } catch (error) {
      console.error('Error in getHotQueries:', error)
      throw error
    }
  }

  /**
   * Get template execution history
   * Utilizes: template_executions table for detailed tracking
   */
  async getTemplateExecutionHistory(templateId: string, pagination?: any, filter?: any) {
    const whereConditions = ['te.template_id = ?']
    const bindings = [templateId]

    if (filter?.successOnly) {
      whereConditions.push('te.success = 1')
    }

    if (filter?.minExecutionTime) {
      whereConditions.push('te.execution_time_ms >= ?')
      bindings.push(filter.minExecutionTime)
    }

    if (filter?.maxExecutionTime) {
      whereConditions.push('te.execution_time_ms <= ?')
      bindings.push(filter.maxExecutionTime)
    }

    const whereClause = whereConditions.join(' AND ')

    const query = `
      SELECT
        te.*,
        t.identifier,
        t.query_name,
        t.operation_type
      FROM template_executions te
      JOIN templates t ON te.template_id = t.id
      WHERE ${whereClause}
      ORDER BY te.executed_at DESC
      LIMIT ? OFFSET ?
    `

    const countQuery = `
      SELECT
        COUNT(*) as total,
        AVG(te.execution_time_ms) as avg_execution_time,
        COUNT(CASE WHEN te.success = 1 THEN 1 END) * 100.0 / COUNT(*) as success_rate
      FROM template_executions te
      WHERE ${whereClause}
    `

    try {
      const limit = pagination?.limit || 20
      const offset = pagination?.offset || 0

      const [executions, stats] = await Promise.all([
        this.db.all(query, [...bindings, limit, offset]),
        this.db.get(countQuery, bindings),
      ])

      return {
        edges: executions.map((execution: any) => ({
          node: {
            id: execution.id,
            template: this.formatTemplate(execution),
            executedAt: execution.executed_at,
            executionTimeMs: execution.execution_time_ms,
            variablesUsed: execution.variables_used ? JSON.parse(execution.variables_used) : null,
            resultCount: execution.result_count,
            success: Boolean(execution.success),
            errorMessage: execution.error_message,
            userContext: execution.user_context,
          },
          cursor: execution.id.toString(),
        })),
        totalCount: stats.total,
        averageExecutionTime: stats.avg_execution_time,
        successRate: stats.success_rate,
      }
    } catch (error) {
      console.error('Error in getTemplateExecutionHistory:', error)
      throw error
    }
  }

  /**
   * Get slow query analysis
   * Identifies performance bottlenecks using execution data
   */
  async getSlowQueries(params: { threshold?: number; limit?: number; timeRange?: any }) {
    const { threshold = 500, limit = 20, timeRange } = params

    let timeCondition = ''
    const bindings = [threshold]

    if (timeRange) {
      timeCondition = 'AND te.executed_at BETWEEN ? AND ?'
      bindings.push(timeRange.start, timeRange.end)
    }

    const query = `
      SELECT
        t.*,
        AVG(te.execution_time_ms) as avg_execution_time,
        MAX(te.execution_time_ms) as max_execution_time,
        COUNT(CASE WHEN te.execution_time_ms > ? THEN 1 END) as slow_execution_count,
        COUNT(te.id) as total_executions,
        (COUNT(CASE WHEN te.execution_time_ms > ? THEN 1 END) * 100.0 / COUNT(te.id)) as slow_execution_percentage
      FROM templates t
      JOIN template_executions te ON t.id = te.template_id
      WHERE te.execution_time_ms > ?
      ${timeCondition}
      GROUP BY t.id, t.identifier, t.query_name
      HAVING slow_execution_count > 0
      ORDER BY slow_execution_percentage DESC, avg_execution_time DESC
      LIMIT ?
    `

    try {
      const results = await this.db.all(query, [...bindings, threshold, threshold, limit])

      return results.map((row: any) => ({
        template: this.formatTemplate(row),
        averageExecutionTime: row.avg_execution_time,
        maxExecutionTime: row.max_execution_time,
        slowExecutionCount: row.slow_execution_count,
        totalExecutions: row.total_executions,
        slowExecutionPercentage: row.slow_execution_percentage,
        recentSlowdowns: [], // TODO: Implement if needed
        optimizationSuggestions: this.generateOptimizationSuggestions(row),
      }))
    } catch (error) {
      console.error('Error in getSlowQueries:', error)
      throw error
    }
  }

  private async calculatePercentiles() {
    // Calculate performance percentiles from execution data
    const query = `
      SELECT
        avg_execution_time_ms
      FROM templates
      WHERE is_active = 1 AND avg_execution_time_ms > 0
      ORDER BY avg_execution_time_ms
    `

    try {
      const results = await this.db.all(query)
      const times = results.map((r: any) => r.avg_execution_time_ms)

      if (times.length === 0) {
        return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
      }

      return {
        p50: this.percentile(times, 0.5),
        p75: this.percentile(times, 0.75),
        p90: this.percentile(times, 0.9),
        p95: this.percentile(times, 0.95),
        p99: this.percentile(times, 0.99),
      }
    } catch (error) {
      console.error('Error calculating percentiles:', error)
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
    }
  }

  private async getHourlyUsagePattern() {
    // Extract hour from last_used_at and aggregate
    const query = `
      SELECT
        CAST(strftime('%H', last_used_at) AS INTEGER) as hour,
        COUNT(*) as execution_count,
        AVG(avg_execution_time_ms) as avg_execution_time
      FROM templates
      WHERE last_used_at IS NOT NULL
      GROUP BY hour
      ORDER BY hour
    `

    try {
      return await this.db.all(query)
    } catch (error) {
      console.error('Error in getHourlyUsagePattern:', error)
      return []
    }
  }

  private async getRecentMetrics() {
    // Get performance metrics for different time windows
    const queries = {
      last24Hours: `
        SELECT
          COUNT(*) as total_executions,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(CASE WHEN success = 1 THEN 1 END) * 100.0 / COUNT(*) as success_rate,
          COUNT(DISTINCT template_id) as unique_templates
        FROM template_executions
        WHERE executed_at > datetime('now', '-24 hours')
      `,
      last7Days: `
        SELECT
          COUNT(*) as total_executions,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(CASE WHEN success = 1 THEN 1 END) * 100.0 / COUNT(*) as success_rate,
          COUNT(DISTINCT template_id) as unique_templates
        FROM template_executions
        WHERE executed_at > datetime('now', '-7 days')
      `,
      last30Days: `
        SELECT
          COUNT(*) as total_executions,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(CASE WHEN success = 1 THEN 1 END) * 100.0 / COUNT(*) as success_rate,
          COUNT(DISTINCT template_id) as unique_templates
        FROM template_executions
        WHERE executed_at > datetime('now', '-30 days')
      `,
    }

    try {
      const [last24Hours, last7Days, last30Days] = await Promise.all([
        this.db.get(queries.last24Hours),
        this.db.get(queries.last7Days),
        this.db.get(queries.last30Days),
      ])

      return { last24Hours, last7Days, last30Days }
    } catch (error) {
      console.error('Error in getRecentMetrics:', error)
      return {
        last24Hours: {
          totalExecutions: 0,
          avgExecutionTime: 0,
          successRate: 0,
          uniqueTemplates: 0,
        },
        last7Days: { totalExecutions: 0, avgExecutionTime: 0, successRate: 0, uniqueTemplates: 0 },
        last30Days: { totalExecutions: 0, avgExecutionTime: 0, successRate: 0, uniqueTemplates: 0 },
      }
    }
  }

  private formatTemplate(row: any) {
    return {
      id: row.id || row.template_id,
      identifier: row.identifier,
      queryName: row.query_name ? JSON.parse(row.query_name) : [],
      operationType: row.operation_type,
      usageCount: row.usage_count,
      avgExecutionTimeMs: row.avg_execution_time_ms,
      lastUsedAt: row.last_used_at,
    }
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0
    const index = Math.ceil(arr.length * p) - 1
    return arr[Math.max(0, Math.min(index, arr.length - 1))] || 0
  }

  private generateOptimizationSuggestions(template: any): string[] {
    const suggestions = []

    if (template.avg_execution_time > 1000) {
      suggestions.push('Consider adding database indexes for frequently queried fields')
    }

    if (template.complexity_score > 7) {
      suggestions.push('Break down complex query into smaller, composable queries')
    }

    if (template.operation_type === 'query' && template.avg_execution_time > 500) {
      suggestions.push('Add pagination to limit result set size')
    }

    if (template.slow_execution_percentage > 20) {
      suggestions.push('Review query structure for potential optimizations')
    }

    return suggestions
  }
}
