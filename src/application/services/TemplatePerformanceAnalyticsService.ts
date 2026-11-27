import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  IQueryTemplateRepository,
  TemplateExecutionRecord,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { NotFoundException } from '@/shared/exceptions/DomainException.js'

export interface TemplatePerformanceFilterInput {
  operationTypes?: Array<'QUERY' | 'MUTATION' | 'SUBSCRIPTION'>
  performanceCategories?: Array<'FAST' | 'MEDIUM' | 'SLOW'>
  usageRange?: { min?: number | null; max?: number | null }
  complexityRange?: { min?: number | null; max?: number | null }
  onlyActive?: boolean
}

export interface TimeRangeInput {
  start: string | Date
  end: string | Date
}

export interface ExecutionHistoryFilterInput {
  successOnly?: boolean
  minExecutionTime?: number
  maxExecutionTime?: number
  userContext?: string
}

export interface RecommendationContextInput {
  currentTemplate?: string
  tableIds?: string[]
  operationType?: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
  userRole?: string
  performanceRequirement?: 'REAL_TIME' | 'INTERACTIVE' | 'BATCH' | 'BACKGROUND'
}

export type TimeGranularityKind = 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'

const MAX_SCAN_TEMPLATES = 1000
const MAX_SCAN_EXECUTIONS = 10_000

export class TemplatePerformanceAnalyticsService {
  constructor(private readonly queryTemplateRepository: IQueryTemplateRepository) {}

  async getTemplatePerformanceAnalytics(
    filter: TemplatePerformanceFilterInput = {},
    timeRange?: TimeRangeInput,
  ) {
    const allTemplates = await this.loadAllTemplates()
    const filteredTemplates = filterTemplates(allTemplates, filter)
    const templateIds = filteredTemplates
      .map((t) => t.getId())
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    const executions = await this.loadExecutions({
      templateIds,
      start: timeRange ? toIsoString(timeRange.start) : undefined,
      end: timeRange ? toIsoString(timeRange.end) : undefined,
      limit: MAX_SCAN_EXECUTIONS,
    })

    const totalTemplates = filteredTemplates.length
    const activeTemplates = filteredTemplates.filter((t) => t.getIsActive()).length
    const executionTimes =
      executions.length > 0
        ? executions.map((e) => e.executionTimeMs)
        : filteredTemplates.filter((t) => t.getUsageCount() > 0).map((t) => t.getAvgExecutionTimeMs())

    const totalExecutions =
      executions.length > 0
        ? executions.length
        : filteredTemplates.reduce((sum, t) => sum + t.getUsageCount(), 0)
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, ms) => sum + ms, 0) / executionTimes.length
        : 0
    const successCount = executions.filter((e) => e.success).length
    const successRate =
      executions.length > 0 ? (successCount / executions.length) * 100 : totalExecutions > 0 ? 100 : 0

    let fast = 0
    let medium = 0
    let slow = 0
    for (const ms of executionTimes) {
      if (ms < 50) fast += 1
      else if (ms <= 200) medium += 1
      else slow += 1
    }

    const sortedTimes = [...executionTimes].sort((a, b) => a - b)
    const percentiles = {
      p50: computePercentile(sortedTimes, 50),
      p75: computePercentile(sortedTimes, 75),
      p90: computePercentile(sortedTimes, 90),
      p95: computePercentile(sortedTimes, 95),
      p99: computePercentile(sortedTimes, 99),
    }

    const executionsByTemplate = groupExecutionsByTemplate(executions)

    const mostUsedTemplates = [...filteredTemplates]
      .sort((a, b) => b.getUsageCount() - a.getUsageCount())
      .slice(0, 10)
      .map((template) => {
        const tid = String(template.getId() ?? '')
        const exList = executionsByTemplate.get(tid) ?? []
        const avgMs =
          exList.length > 0
            ? exList.reduce((sum, e) => sum + e.executionTimeMs, 0) / exList.length
            : template.getAvgExecutionTimeMs()
        return {
          template,
          usageCount: Math.max(template.getUsageCount(), exList.length),
          avgExecutionTime: avgMs,
          lastUsed: template.getLastUsedAt() ?? template.getUpdatedAt(),
          trend: inferUsageTrend(exList),
        }
      })

    const opMap = new Map<string, { count: number; timeSum: number; successCount: number; execCount: number }>()
    for (const template of filteredTemplates) {
      const opType = template.getOperationType().toUpperCase()
      const entry = opMap.get(opType) ?? { count: 0, timeSum: 0, successCount: 0, execCount: 0 }
      entry.count += 1
      const tid = String(template.getId() ?? '')
      const exList = executionsByTemplate.get(tid) ?? []
      if (exList.length > 0) {
        entry.execCount += exList.length
        entry.timeSum += exList.reduce((sum, e) => sum + e.executionTimeMs, 0)
        entry.successCount += exList.filter((e) => e.success).length
      } else if (template.getUsageCount() > 0) {
        entry.execCount += template.getUsageCount()
        entry.timeSum += template.getAvgExecutionTimeMs() * template.getUsageCount()
        entry.successCount += template.getUsageCount()
      }
      opMap.set(opType, entry)
    }

    const operationTypeDistribution = [...opMap.entries()].map(([operationType, stats]) => ({
      operationType,
      count: stats.count,
      avgExecutionTime: stats.execCount > 0 ? stats.timeSum / stats.execCount : 0,
      successRate: stats.execCount > 0 ? (stats.successCount / stats.execCount) * 100 : 100,
    }))

    const hourMap = new Map<number, { count: number; timeSum: number }>()
    for (const ex of executions) {
      const hour = new Date(ex.executedAt).getUTCHours()
      const bucket = hourMap.get(hour) ?? { count: 0, timeSum: 0 }
      bucket.count += 1
      bucket.timeSum += ex.executionTimeMs
      hourMap.set(hour, bucket)
    }
    const hourlyUsagePattern = [...hourMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, bucket]) => ({
        hour,
        executionCount: bucket.count,
        avgExecutionTime: bucket.count > 0 ? bucket.timeSum / bucket.count : 0,
      }))

    const nowMs = Date.now()
    const recentMetrics = {
      last24Hours: summarizeExecutionWindow(executions, nowMs - 24 * 60 * 60 * 1000),
      last7Days: summarizeExecutionWindow(executions, nowMs - 7 * 24 * 60 * 60 * 1000),
      last30Days: summarizeExecutionWindow(executions, nowMs - 30 * 24 * 60 * 60 * 1000),
    }

    return {
      totalTemplates,
      activeTemplates,
      totalExecutions,
      averageExecutionTime,
      successRate,
      performanceDistribution: {
        fast,
        medium,
        slow,
        percentiles,
      },
      usagePatterns: {
        mostUsedTemplates,
        operationTypeDistribution,
        hourlyUsagePattern,
      },
      recentMetrics,
    }
  }

  async getHotQueries(limit = 10, performanceThreshold = 150, usageThreshold = 100) {
    const allTemplates = await this.loadAllTemplates()
    const active = allTemplates.filter((t) => t.getIsActive())
    const templateIds = active
      .map((t) => t.getId())
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    const executions = await this.loadExecutions({ templateIds, limit: MAX_SCAN_EXECUTIONS })
    const executionsByTemplate = groupExecutionsByTemplate(executions)

    const ranked = active
      .map((template) => {
        const tid = String(template.getId() ?? '')
        const exList = executionsByTemplate.get(tid) ?? []
        const usageCount = Math.max(template.getUsageCount(), exList.length)
        const avgMs =
          exList.length > 0
            ? exList.reduce((sum, e) => sum + e.executionTimeMs, 0) / exList.length
            : template.getAvgExecutionTimeMs()
        if (usageCount < usageThreshold || avgMs > performanceThreshold || usageCount <= 0) {
          return null
        }
        const okCount = exList.filter((e) => e.success).length
        const successRate = exList.length > 0 ? (okCount / exList.length) * 100 : 100
        const efficiencyRatio = usageCount / Math.max(1, avgMs)
        const performanceScore = Number((efficiencyRatio * (successRate / 100)).toFixed(4))
        return {
          template,
          performanceScore,
          efficiencyRatio,
          recentExecutions: exList.length > 0 ? exList.length : usageCount,
          successRate,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, Math.max(1, limit))

    return ranked.map((entry, index) => ({
      ...entry,
      usageRank: index + 1,
    }))
  }

  async getTemplateExecutionHistory(
    templateIdOrIdentifier: string,
    pagination: { limit?: number; offset?: number } = {},
    filter: ExecutionHistoryFilterInput = {},
  ) {
    let template = await this.queryTemplateRepository.findById(templateIdOrIdentifier)
    if (!template) {
      template = await this.queryTemplateRepository.findByIdentifier(templateIdOrIdentifier)
    }
    if (!template?.getId()) {
      throw new NotFoundException(`Query template '${templateIdOrIdentifier}' not found`)
    }

    const templateId = String(template.getId())
    const { items, totalCount } = this.queryTemplateRepository.findExecutions
      ? await this.queryTemplateRepository.findExecutions({
          templateId,
          successOnly: filter.successOnly,
          minExecutionTime: filter.minExecutionTime,
          maxExecutionTime: filter.maxExecutionTime,
          userContext: filter.userContext,
          limit: pagination.limit ?? 20,
          offset: pagination.offset ?? 0,
        })
      : { items: [], totalCount: 0 }

    const edges = items.map((record) => ({
      node: {
        id: record.id,
        template,
        executedAt: new Date(record.executedAt),
        executionTimeMs: record.executionTimeMs,
        variablesUsed: record.variablesUsed,
        resultCount: record.resultCount,
        success: record.success,
        errorMessage: record.errorMessage,
        userContext: record.userContext,
      },
      cursor: Buffer.from(`exec:${record.id}`).toString('base64'),
    }))

    const averageExecutionTime =
      items.length > 0
        ? items.reduce((sum, e) => sum + e.executionTimeMs, 0) / items.length
        : 0
    const successRate =
      items.length > 0
        ? (items.filter((e) => e.success).length / items.length) * 100
        : 100

    return {
      edges,
      totalCount,
      averageExecutionTime,
      successRate,
    }
  }

  async getTemplatePerformanceTrends(
    templateIds: string[] | undefined,
    timeRange: TimeRangeInput,
    granularity: TimeGranularityKind = 'HOUR',
  ) {
    const startIso = toIsoString(timeRange.start)
    const endIso = toIsoString(timeRange.end)
    const scopedTemplateIds =
      templateIds && templateIds.length > 0
        ? templateIds
        : (await this.loadAllTemplates())
            .map((t) => t.getId())
            .filter((id): id is string => typeof id === 'string' && id.length > 0)

    const executions = await this.loadExecutions({
      templateIds: scopedTemplateIds,
      start: startIso,
      end: endIso,
      limit: MAX_SCAN_EXECUTIONS,
    })

    const grouped = new Map<
      string,
      { templateId: string; bucketTs: number; count: number; timeSum: number; successCount: number }
    >()

    for (const ex of executions) {
      const bucketTs = alignTimestampToGranularity(Date.parse(ex.executedAt), granularity)
      const key = `${ex.templateId}:${bucketTs}`
      const entry = grouped.get(key) ?? {
        templateId: ex.templateId,
        bucketTs,
        count: 0,
        timeSum: 0,
        successCount: 0,
      }
      entry.count += 1
      entry.timeSum += ex.executionTimeMs
      if (ex.success) entry.successCount += 1
      grouped.set(key, entry)
    }

    const byTemplate = new Map<string, typeof grouped extends Map<string, infer V> ? V[] : never>()
    for (const entry of grouped.values()) {
      const list = byTemplate.get(entry.templateId) ?? []
      list.push(entry)
      byTemplate.set(entry.templateId, list)
    }

    const trends: Array<{
      templateId: string
      timestamp: Date
      executionCount: number
      averageExecutionTime: number
      successRate: number
      movingAverage: number
    }> = []

    for (const [tid, list] of byTemplate) {
      list.sort((a, b) => a.bucketTs - b.bucketTs)
      const windowAvgs: number[] = []
      for (const item of list) {
        const avg = item.count > 0 ? item.timeSum / item.count : 0
        windowAvgs.push(avg)
        const slice = windowAvgs.slice(-3)
        const movingAverage = slice.reduce((sum, v) => sum + v, 0) / slice.length
        trends.push({
          templateId: tid,
          timestamp: new Date(item.bucketTs),
          executionCount: item.count,
          averageExecutionTime: avg,
          successRate: item.count > 0 ? (item.successCount / item.count) * 100 : 100,
          movingAverage,
        })
      }
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  async getSlowQueries(threshold = 500, limit = 20, timeRange?: TimeRangeInput) {
    const allTemplates = await this.loadAllTemplates()
    const templateById = new Map(
      allTemplates
        .filter((t) => Boolean(t.getId()))
        .map((t) => [String(t.getId()), t]),
    )

    const executions = await this.loadExecutions({
      start: timeRange ? toIsoString(timeRange.start) : undefined,
      end: timeRange ? toIsoString(timeRange.end) : undefined,
      limit: MAX_SCAN_EXECUTIONS,
    })
    const executionsByTemplate = groupExecutionsByTemplate(executions)

    const results: Array<{
      template: QueryTemplate
      averageExecutionTime: number
      maxExecutionTime: number
      slowExecutionCount: number
      totalExecutions: number
      slowExecutionPercentage: number
      recentSlowdowns: Array<{
        id: string
        template: QueryTemplate
        executedAt: Date
        executionTimeMs: number
        variablesUsed: Record<string, unknown> | null
        resultCount: number
        success: boolean
        errorMessage: string | null
        userContext: string | null
      }>
      optimizationSuggestions: string[]
    }> = []

    for (const [tid, template] of templateById) {
      const exList = executionsByTemplate.get(tid) ?? []
      const slowRecords = exList.filter((e) => e.executionTimeMs >= threshold)
      const avgTime =
        exList.length > 0
          ? exList.reduce((sum, e) => sum + e.executionTimeMs, 0) / exList.length
          : template.getAvgExecutionTimeMs()
      const maxTime =
        exList.length > 0 ? Math.max(...exList.map((e) => e.executionTimeMs)) : avgTime
      const totalExecutions = exList.length > 0 ? exList.length : template.getUsageCount()

      if (slowRecords.length === 0 && avgTime < threshold) continue

      const slowCount = slowRecords.length > 0 ? slowRecords.length : totalExecutions > 0 ? 1 : 0
      const suggestions: string[] = []
      if (template.getComplexityScore() >= 7) {
        suggestions.push('Reduce nested traversal depth or split into focused pagination queries')
      }
      if (!template.getApplicableTables() || template.getApplicableTables()?.length === 0) {
        suggestions.push('Scope template to specific applicableTables or pass explicit tableId filters')
      }
      if (suggestions.length === 0) {
        suggestions.push('Add indexed attribute filters or tighten pagination limits')
      }

      results.push({
        template,
        averageExecutionTime: avgTime,
        maxExecutionTime: maxTime,
        slowExecutionCount: slowCount,
        totalExecutions,
        slowExecutionPercentage: totalExecutions > 0 ? (slowCount / totalExecutions) * 100 : 0,
        recentSlowdowns: slowRecords.slice(0, 5).map((r) => ({
          id: r.id,
          template,
          executedAt: new Date(r.executedAt),
          executionTimeMs: r.executionTimeMs,
          variablesUsed: r.variablesUsed,
          resultCount: r.resultCount,
          success: r.success,
          errorMessage: r.errorMessage,
          userContext: r.userContext,
        })),
        optimizationSuggestions: suggestions,
      })
    }

    return results
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
      .slice(0, Math.max(1, limit))
  }

  async getTemplateRecommendations(context: RecommendationContextInput = {}, limit = 5) {
    const allTemplates = await this.loadAllTemplates()
    const currentId = context.currentTemplate?.trim()
    const budgetMs =
      context.performanceRequirement === 'REAL_TIME'
        ? 50
        : context.performanceRequirement === 'INTERACTIVE'
          ? 200
          : context.performanceRequirement === 'BATCH'
            ? 1000
            : Number.POSITIVE_INFINITY

    const referenceTables = new Set(context.tableIds ?? [])
    let referenceComplexity: number | null = null
    let currentAvgMs = 0

    if (currentId) {
      const current = allTemplates.find(
        (t) => String(t.getId()) === currentId || t.getIdentifier() === currentId,
      )
      if (current) {
        referenceComplexity = current.getComplexityScore()
        currentAvgMs = current.getAvgExecutionTimeMs()
        for (const tbl of current.getApplicableTables() ?? []) {
          referenceTables.add(tbl)
        }
      }
    }

    const recommendations = allTemplates
      .filter((t) => {
        if (!t.getIsActive()) return false
        if (currentId && (String(t.getId()) === currentId || t.getIdentifier() === currentId)) {
          return false
        }
        if (context.operationType && t.getOperationType().toUpperCase() !== context.operationType) {
          return false
        }
        return true
      })
      .map((template) => {
        const tables = template.getApplicableTables() ?? []
        const overlapCount = tables.filter((tbl) => referenceTables.has(tbl)).length
        const similarityScore =
          referenceTables.size > 0
            ? overlapCount / referenceTables.size
            : tables.length === 0
              ? 0.5
              : 0.25

        const avgMs = template.getAvgExecutionTimeMs()
        const meetsBudget = avgMs <= budgetMs ? 1 : 0.2
        const baselineMs = currentAvgMs > 0 ? currentAvgMs : 100
        const performanceAdvantage = Math.max(0, (baselineMs - avgMs) / Math.max(1, baselineMs))

        const complexityPenalty =
          referenceComplexity !== null
            ? Math.max(0, 1 - Math.abs(template.getComplexityScore() - referenceComplexity) * 0.1)
            : 0.5
        const popularityBoost = Math.min(1, template.getUsageCount() / 20)

        const score =
          similarityScore * 0.4 +
          meetsBudget * 0.25 +
          popularityBoost * 0.2 +
          complexityPenalty * 0.15

        const reason =
          overlapCount > 0
            ? 'SIMILAR_PATTERN'
            : performanceAdvantage > 0.3
              ? 'BETTER_PERFORMANCE'
              : popularityBoost >= 0.5
                ? 'POPULAR_CHOICE'
                : referenceComplexity !== null
                  ? 'COMPLEXITY_MATCH'
                  : 'RECENT_IMPROVEMENT'

        return {
          template,
          score: Number(score.toFixed(4)),
          reason,
          similarityScore: Number(similarityScore.toFixed(4)),
          performanceAdvantage: Number(performanceAdvantage.toFixed(4)),
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit))

    return recommendations
  }

  private async loadAllTemplates(): Promise<QueryTemplate[]> {
    const page = await this.queryTemplateRepository.search({
      limit: MAX_SCAN_TEMPLATES,
      offset: 0,
    })
    return page.items
  }

  private async loadExecutions(options: {
    templateIds?: string[]
    start?: string
    end?: string
    limit?: number
  }): Promise<TemplateExecutionRecord[]> {
    if (!this.queryTemplateRepository.findExecutions) return []
    const res = await this.queryTemplateRepository.findExecutions(options)
    return res.items
  }
}

function toIsoString(input: string | Date): string {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString()
}

function filterTemplates(
  templates: readonly QueryTemplate[],
  filter: TemplatePerformanceFilterInput,
): QueryTemplate[] {
  return templates.filter((t) => {
    if (filter.onlyActive !== false && !t.getIsActive()) return false
    if (
      filter.operationTypes &&
      filter.operationTypes.length > 0 &&
      !filter.operationTypes.includes(t.getOperationType().toUpperCase() as 'QUERY' | 'MUTATION' | 'SUBSCRIPTION')
    ) {
      return false
    }
    if (filter.performanceCategories && filter.performanceCategories.length > 0) {
      const avg = t.getAvgExecutionTimeMs()
      const cat = avg < 50 ? 'FAST' : avg <= 200 ? 'MEDIUM' : 'SLOW'
      if (!filter.performanceCategories.includes(cat)) return false
    }
    if (filter.usageRange) {
      const u = t.getUsageCount()
      if (filter.usageRange.min !== null && filter.usageRange.min !== undefined && u < filter.usageRange.min) {
        return false
      }
      if (filter.usageRange.max !== null && filter.usageRange.max !== undefined && u > filter.usageRange.max) {
        return false
      }
    }
    if (filter.complexityRange) {
      const c = t.getComplexityScore()
      if (
        filter.complexityRange.min !== null &&
        filter.complexityRange.min !== undefined &&
        c < filter.complexityRange.min
      ) {
        return false
      }
      if (
        filter.complexityRange.max !== null &&
        filter.complexityRange.max !== undefined &&
        c > filter.complexityRange.max
      ) {
        return false
      }
    }
    return true
  })
}

function groupExecutionsByTemplate(
  executions: readonly TemplateExecutionRecord[],
): Map<string, TemplateExecutionRecord[]> {
  const map = new Map<string, TemplateExecutionRecord[]>()
  for (const ex of executions) {
    const list = map.get(ex.templateId) ?? []
    list.push(ex)
    map.set(ex.templateId, list)
  }
  return map
}

function summarizeExecutionWindow(
  executions: readonly TemplateExecutionRecord[],
  sinceMs: number,
) {
  const subset = executions.filter((e) => Date.parse(e.executedAt) >= sinceMs)
  const totalExecutions = subset.length
  const avgExecutionTime =
    totalExecutions > 0
      ? subset.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalExecutions
      : 0
  const successRate =
    totalExecutions > 0
      ? (subset.filter((e) => e.success).length / totalExecutions) * 100
      : 100
  const uniqueTemplates = new Set(subset.map((e) => e.templateId)).size
  return {
    totalExecutions,
    avgExecutionTime,
    successRate,
    uniqueTemplates,
  }
}

function inferUsageTrend(executions: readonly TemplateExecutionRecord[]): 'INCREASING' | 'STABLE' | 'DECREASING' {
  if (executions.length < 4) return 'STABLE'
  const sorted = [...executions].sort((a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt))
  const mid = Math.floor(sorted.length / 2)
  const older = sorted.slice(0, mid)
  const newer = sorted.slice(mid)
  const avgOlder = older.reduce((s, e) => s + e.executionTimeMs, 0) / older.length
  const avgNewer = newer.reduce((s, e) => s + e.executionTimeMs, 0) / newer.length
  if (newer.length > older.length) return 'INCREASING'
  if (avgNewer < avgOlder * 0.8) return 'INCREASING'
  if (avgNewer > avgOlder * 1.2) return 'DECREASING'
  return 'STABLE'
}

function computePercentile(sortedValues: readonly number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sortedValues.length) - 1),
  )
  return sortedValues[idx] ?? 0
}

function alignTimestampToGranularity(timestampMs: number, granularity: TimeGranularityKind): number {
  const d = new Date(timestampMs)
  if (granularity === 'MINUTE') {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())
  }
  if (granularity === 'HOUR') {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours())
  }
  if (granularity === 'DAY') {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  if (granularity === 'WEEK') {
    const day = d.getUTCDay()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}
