import type { ISqliteDatabase } from '@/infrastructure/database/sqlite/SqlitePort.js'
import * as fs from 'node:fs'
import * as os from 'node:os'

interface DatabaseLike {
  prepare: (query: string) => {
    all: () => unknown[]
    get: () => unknown
  }
  filename?: string
}

interface MemoryUsageSnapshot {
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') {
      return message
    }
  }

  return String(error)
}

export interface Logger {
  log: (message: string) => void
  error: (message: string) => void
}

export interface SystemStats {
  cpuUsage: {
    user: number
    system: number
    percentage?: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
  }
  cpuCount: number
  loadAverage: number[]
  loadAveragePerCpu?: number[]
  uptime: number
  platform: string
  error?: string
}

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
  heapUsagePercent?: number
  memoryUsagePercent?: number
  totalMemory?: number
  freeMemory?: number
  error?: string
  errorCode?: string
  recoverySuggestion?: string
}

export interface DatabaseStats {
  tableCount: number
  totalRows: number
  indexCount: number
  databaseSize: number
  formattedSize: string
  avgRowsPerTable: number
  tables?: string[]
  indices?: string[]
  fileExists?: boolean
  error?: string
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  score: number
  memory: {
    status: string
    usage: number
  }
  cpu: {
    status: string
    usage: number
  }
  database: {
    status: string
    connected: boolean
  }
  timestamp: Date
  error?: string
}

export class SystemQueries {
  private db: ISqliteDatabase | DatabaseLike | null
  private logger: Logger | null = null
  private startTime = process.hrtime()

  constructor(db: ISqliteDatabase | DatabaseLike | null) {
    this.db = db
  }

  setLogger(logger: Logger | null): void {
    this.logger = logger
  }

  private safeLog(message: string, isError = false): void {
    try {
      if (this.logger) {
        if (isError) {
          this.logger.error(message)
        } else {
          this.logger.log(message)
        }
      } else if (isError && console.error) {
        console.error(message)
      }
    } catch (_error) {
      // Silently fail if logger fails
    }
  }

  async systemStats(_options?: { timeout?: number }): Promise<SystemStats> {
    try {
      const cpuUsage = this.getCpuUsage()
      const memoryUsage = process.memoryUsage()
      const cpuCount = this.getCpuCount()
      const loadAvg = this.getLoadAverage()

      return {
        cpuUsage: {
          user: cpuUsage.user || 0,
          system: cpuUsage.system || 0,
          percentage: this.calculateCpuPercentage(cpuUsage),
        },
        memory: {
          heapUsed: memoryUsage.heapUsed || 0,
          heapTotal: memoryUsage.heapTotal || 0,
          rss: memoryUsage.rss || 0,
          external: memoryUsage.external || 0,
        },
        cpuCount,
        loadAverage: loadAvg,
        loadAveragePerCpu: loadAvg.map((l) => l / Math.max(cpuCount, 1)),
        uptime: process.uptime(),
        platform: process.platform,
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      this.safeLog(`System stats error: ${message}`, true)
      return this.getDefaultSystemStats(message)
    }
  }

  async memoryStats(_options?: unknown): Promise<MemoryStats> {
    try {
      const memUsage = this.getMemoryUsage()
      const totalMem = this.getTotalMemory()
      const freeMem = this.getFreeMemory()

      const heapUsagePercent = memUsage.heapTotal > 0 ? (memUsage.heapUsed / memUsage.heapTotal) * 100 : 0
      const memoryUsagePercent = totalMem > 0 ? (memUsage.rss / totalMem) * 100 : 0

      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        heapUsagePercent: Math.max(0, Math.min(heapUsagePercent, 100)),
        memoryUsagePercent: Math.max(0, Math.min(memoryUsagePercent, 200)), // Cap at 200% for swap
        totalMemory: totalMem,
        freeMemory: freeMem,
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      this.safeLog(`Memory stats error: ${message}`, true)
      return this.getDefaultMemoryStats(message)
    }
  }

  async getDatabaseStats(_options?: unknown): Promise<DatabaseStats> {
    try {
      if (!this.db) {
        throw new Error('Database connection closed')
      }

      const tables = this.getDatabaseTables()
      const indices = this.getDatabaseIndices()
      const totalRows = this.getTotalRowCount(tables)
      const dbSize = this.getDatabaseSize()

      return {
        tableCount: tables.length,
        totalRows,
        indexCount: indices.length,
        databaseSize: dbSize,
        formattedSize: this.formatBytes(dbSize),
        avgRowsPerTable: tables.length > 0 ? totalRows / tables.length : 0,
        tables,
        indices,
        fileExists: true,
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      this.safeLog(`Database stats error: ${message}`, true)
      return this.getDefaultDatabaseStats(message)
    }
  }

  async healthCheck(_options?: unknown): Promise<HealthCheckResult> {
    try {
      const memStats = await this.memoryStats()
      const sysStats = await this.systemStats()
      const dbStats = await this.getDatabaseStats()

      const memoryScore = this.calculateMemoryScore(memStats)
      const cpuScore = this.calculateCpuScore(sysStats)
      const dbScore = dbStats.error ? 0 : 100

      const overallScore = (memoryScore + cpuScore + dbScore) / 3

      return {
        status: this.getHealthStatus(overallScore),
        score: overallScore,
        memory: {
          status: this.getComponentStatus(memoryScore),
          usage: memStats.memoryUsagePercent || 0,
        },
        cpu: {
          status: this.getComponentStatus(cpuScore),
          usage: sysStats.cpuUsage.percentage || 0,
        },
        database: {
          status: dbStats.error ? 'unhealthy' : 'healthy',
          connected: !dbStats.error,
        },
        timestamp: new Date(),
      }
    } catch (error: unknown) {
      return this.getDefaultHealthCheck(getErrorMessage(error))
    }
  }

  // Helper methods for safe operations

  private getCpuUsage(): { user: number; system: number } {
    try {
      const usage = process.cpuUsage()
      return {
        user: Math.max(0, usage.user || 0),
        system: Math.max(0, usage.system || 0),
      }
    } catch {
      return { user: 0, system: 0 }
    }
  }

  private getMemoryUsage(): MemoryUsageSnapshot {
    try {
      const usage = process.memoryUsage()
      return {
        heapUsed: Math.max(0, usage.heapUsed || 0),
        heapTotal: Math.max(0, usage.heapTotal || 0),
        rss: Math.max(0, usage.rss || 0),
        external: Math.max(0, usage.external || 0),
      }
    } catch {
      return { heapUsed: 0, heapTotal: 0, rss: 0, external: 0 }
    }
  }

  private getCpuCount(): number {
    try {
      const cpus = os.cpus()
      return cpus && cpus.length > 0 ? cpus.length : 1
    } catch {
      return 1
    }
  }

  private getLoadAverage(): number[] {
    try {
      return os.loadavg()
    } catch {
      return [0, 0, 0]
    }
  }

  private getTotalMemory(): number {
    try {
      return os.totalmem() || 0
    } catch {
      return 0
    }
  }

  private getFreeMemory(): number {
    try {
      return os.freemem() || 0
    } catch {
      return 0
    }
  }

  private getDatabaseTables(): string[] {
    if (!this.db) {
      return []
    }
    try {
      const result = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
      return result.map((r) => r.name)
    } catch {
      return []
    }
  }

  private getDatabaseIndices(): string[] {
    if (!this.db) {
      return []
    }
    try {
      const result = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
        .all() as Array<{ name: string }>
      return result.map((r) => r.name)
    } catch {
      return []
    }
  }

  private getTotalRowCount(tables: string[]): number {
    if (!this.db) {
      return 0
    }
    let total = 0
    for (const table of tables) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count?: number }
        total += result?.count || 0
      } catch {
        // Skip tables that can't be counted
      }
    }
    return total
  }

  private getDatabaseSize(): number {
    if (!this.db) {
      return 0
    }
    try {
      // Try to get database path from connection
      const dbPath = this.db.filename || './data/bun-graph-db.sqlite'
      const stats = fs.statSync(dbPath)
      return stats.size
    } catch {
      return 0
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
    return `${(Math.abs(bytes) / k ** i).toFixed(2)} ${sizes[i]}`
  }

  private calculateCpuPercentage(cpuUsage: { user: number; system: number }): number {
    try {
      const elapsed = process.hrtime(this.startTime)
      const elapsedMs = elapsed[0] * 1000 + elapsed[1] / 1000000

      if (elapsedMs <= 0) return 0

      const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000 // Convert to ms
      const percentage = (totalCpu / elapsedMs) * 100

      const cpuCount = this.getCpuCount()
      return Math.min(percentage, 100 * cpuCount) // Cap at 100% per CPU
    } catch {
      return 0
    }
  }

  private calculateMemoryScore(stats: MemoryStats): number {
    const usage = stats.memoryUsagePercent || 0
    if (usage < 50) return 100
    if (usage < 75) return 75
    if (usage < 90) return 50
    return 25
  }

  private calculateCpuScore(stats: SystemStats): number {
    const usage = stats.cpuUsage.percentage || 0
    if (usage < 50) return 100
    if (usage < 75) return 75
    if (usage < 90) return 50
    return 25
  }

  private getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= 75) return 'healthy'
    if (score >= 50) return 'degraded'
    return 'unhealthy'
  }

  private getComponentStatus(score: number): string {
    if (score >= 75) return 'healthy'
    if (score >= 50) return 'degraded'
    return 'unhealthy'
  }

  // Default/fallback methods for error cases

  private getDefaultSystemStats(error: string): SystemStats {
    return {
      cpuUsage: { user: 0, system: 0, percentage: 0 },
      memory: { heapUsed: 0, heapTotal: 0, rss: 0, external: 0 },
      cpuCount: 1,
      loadAverage: [0, 0, 0],
      uptime: 0,
      platform: process.platform,
      error,
    }
  }

  private getDefaultMemoryStats(error: string): MemoryStats {
    return {
      heapUsed: 0,
      heapTotal: 0,
      rss: 0,
      external: 0,
      heapUsagePercent: 0,
      memoryUsagePercent: 0,
      totalMemory: 0,
      freeMemory: 0,
      error,
    }
  }

  private getDefaultDatabaseStats(error: string): DatabaseStats {
    return {
      tableCount: 0,
      totalRows: 0,
      indexCount: 0,
      databaseSize: 0,
      formattedSize: '0 B',
      avgRowsPerTable: 0,
      tables: [],
      indices: [],
      fileExists: false,
      error,
    }
  }

  private getDefaultHealthCheck(error: string): HealthCheckResult {
    return {
      status: 'unhealthy',
      score: 0,
      memory: { status: 'unknown', usage: 0 },
      cpu: { status: 'unknown', usage: 0 },
      database: { status: 'disconnected', connected: false },
      timestamp: new Date(),
      error,
    }
  }

  // Division safety methods

  safeDivide(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || Number.isNaN(numerator)) return 0
    if (!Number.isFinite(denominator) || Number.isNaN(denominator) || denominator === 0) return 0

    const result = numerator / denominator
    return Number.isFinite(result) ? result : 0
  }

  calculateRate(count: number, timeMs: number): number {
    return this.safeDivide(count * 1000, Math.max(timeMs, 1))
  }

  calculateThroughput(bytes: number, timeMs: number): number {
    return this.safeDivide(bytes, Math.max(timeMs, 1))
  }

  calculateOpsPerSecond(operations: number, timeMs: number): number {
    if (timeMs <= 0) return 0
    return this.safeDivide(operations * 1000, Math.abs(timeMs))
  }

  calculatePercentage(value: number, total: number): number {
    if (total <= 0 || value < 0) return 0
    return this.safeDivide(value * 100, total)
  }

  calculateStandardDeviation(values: number[]): number {
    if (values.length <= 1) return 0
    const mean = this.calculateMean(values)
    const squaredDiffs = values.map((v) => (v - mean) ** 2)
    const avgSquaredDiff = this.safeDivide(
      squaredDiffs.reduce((a, b) => a + b, 0),
      values.length,
    )
    return Math.sqrt(avgSquaredDiff)
  }

  calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    return this.safeDivide(
      values.reduce((a, b) => a + b, 0),
      values.length,
    )
  }

  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }

  calculateCacheHitRatio(hits: number, attempts: number): number {
    return this.safeDivide(hits, attempts)
  }

  calculateSuccessRate(successes: number, total: number): number {
    return Math.min(100, Math.max(0, this.calculatePercentage(successes, total)))
  }

  calculateUtilization(used: number, capacity: number): number {
    return this.safeDivide(used, Math.max(capacity, 1))
  }

  calculateEfficiency(output: number, input: number): number {
    return this.safeDivide(output, Math.max(input, 1))
  }

  categorizeError(error: Error | unknown): string {
    const message = getErrorMessage(error)
    if (message.includes('EACCES')) return 'permission'
    if (message.includes('ENOENT')) return 'not_found'
    if (message.includes('ENOMEM')) return 'resource'
    if (message.includes('SQLITE')) return 'database'
    return 'unknown'
  }
}
