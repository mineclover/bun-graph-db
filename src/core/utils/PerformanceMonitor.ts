/**
 * Performance Monitor
 *
 * Lightweight performance tracking for operations with minimal overhead.
 * Supports timing, memory tracking, and aggregated metrics.
 */

/** Performance metric entry */
export interface PerformanceMetric {
  /** Operation name */
  operation: string
  /** Duration in milliseconds */
  durationMs: number
  /** Start timestamp */
  startedAt: number
  /** End timestamp */
  endedAt: number
  /** Memory usage delta (bytes) */
  memoryDelta?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Success status */
  success: boolean
  /** Error message if failed */
  error?: string
}

/** Aggregated metrics for an operation type */
export interface AggregatedMetrics {
  /** Operation name */
  operation: string
  /** Total invocations */
  count: number
  /** Total duration */
  totalDurationMs: number
  /** Average duration */
  avgDurationMs: number
  /** Minimum duration */
  minDurationMs: number
  /** Maximum duration */
  maxDurationMs: number
  /** P50 (median) duration */
  p50DurationMs: number
  /** P95 duration */
  p95DurationMs: number
  /** P99 duration */
  p99DurationMs: number
  /** Success rate (0-1) */
  successRate: number
  /** Last invocation timestamp */
  lastInvokedAt: number
}

/** Timer handle for manual stop */
export interface PerformanceTimer {
  /** Stop the timer and record the metric */
  stop: (metadata?: Record<string, unknown>) => PerformanceMetric
  /** Stop the timer with error */
  fail: (error: string, metadata?: Record<string, unknown>) => PerformanceMetric
  /** Get elapsed time without stopping */
  elapsed: () => number
}

/** Performance monitor configuration */
export interface PerformanceMonitorConfig {
  /** Enable/disable monitoring */
  enabled: boolean
  /** Maximum metrics to retain per operation */
  maxMetricsPerOperation: number
  /** Enable memory tracking (has overhead) */
  trackMemory: boolean
  /** Slow operation threshold (ms) */
  slowThresholdMs: number
  /** Callback for slow operations */
  onSlowOperation?: (metric: PerformanceMetric) => void
}

const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  maxMetricsPerOperation: 1000,
  trackMemory: false,
  slowThresholdMs: 1000,
}

/**
 * Performance Monitor class
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private config: PerformanceMonitorConfig

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): PerformanceTimer {
    const startedAt = performance.now()
    const startMemory = this.config.trackMemory ? this.getMemoryUsage() : undefined

    return {
      stop: (metadata?: Record<string, unknown>) => {
        return this.recordMetric(operation, startedAt, startMemory, true, undefined, metadata)
      },
      fail: (error: string, metadata?: Record<string, unknown>) => {
        return this.recordMetric(operation, startedAt, startMemory, false, error, metadata)
      },
      elapsed: () => performance.now() - startedAt,
    }
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const timer = this.startTimer(operation)
    try {
      const result = await fn()
      timer.stop(metadata)
      return result
    } catch (error) {
      timer.fail(error instanceof Error ? error.message : String(error), metadata)
      throw error
    }
  }

  /**
   * Measure a sync operation
   */
  measureSync<T>(operation: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const timer = this.startTimer(operation)
    try {
      const result = fn()
      timer.stop(metadata)
      return result
    } catch (error) {
      timer.fail(error instanceof Error ? error.message : String(error), metadata)
      throw error
    }
  }

  /**
   * Record a metric manually
   */
  private recordMetric(
    operation: string,
    startedAt: number,
    startMemory: number | undefined,
    success: boolean,
    error: string | undefined,
    metadata?: Record<string, unknown>
  ): PerformanceMetric {
    if (!this.config.enabled) {
      return {
        operation,
        durationMs: 0,
        startedAt,
        endedAt: startedAt,
        success,
        error,
        metadata,
      }
    }

    const endedAt = performance.now()
    const durationMs = endedAt - startedAt

    const metric: PerformanceMetric = {
      operation,
      durationMs,
      startedAt,
      endedAt,
      success,
      error,
      metadata,
    }

    if (this.config.trackMemory && startMemory !== undefined) {
      metric.memoryDelta = this.getMemoryUsage() - startMemory
    }

    this.storeMetric(operation, metric)

    // Check for slow operation
    if (durationMs > this.config.slowThresholdMs && this.config.onSlowOperation) {
      this.config.onSlowOperation(metric)
    }

    return metric
  }

  /**
   * Store metric with retention limit
   */
  private storeMetric(operation: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metric)

    // Enforce retention limit
    if (operationMetrics.length > this.config.maxMetricsPerOperation) {
      operationMetrics.shift()
    }
  }

  /**
   * Get aggregated metrics for an operation
   */
  getAggregatedMetrics(operation: string): AggregatedMetrics | null {
    const operationMetrics = this.metrics.get(operation)
    if (!operationMetrics || operationMetrics.length === 0) {
      return null
    }

    const durations = operationMetrics.map((m) => m.durationMs).sort((a, b) => a - b)
    const successCount = operationMetrics.filter((m) => m.success).length

    const lastMetric = operationMetrics[operationMetrics.length - 1]

    return {
      operation,
      count: operationMetrics.length,
      totalDurationMs: durations.reduce((sum, d) => sum + d, 0),
      avgDurationMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDurationMs: durations[0] ?? 0,
      maxDurationMs: durations[durations.length - 1] ?? 0,
      p50DurationMs: this.percentile(durations, 50),
      p95DurationMs: this.percentile(durations, 95),
      p99DurationMs: this.percentile(durations, 99),
      successRate: successCount / operationMetrics.length,
      lastInvokedAt: lastMetric?.endedAt ?? 0,
    }
  }

  /**
   * Get all aggregated metrics
   */
  getAllAggregatedMetrics(): AggregatedMetrics[] {
    const results: AggregatedMetrics[] = []
    for (const operation of this.metrics.keys()) {
      const aggregated = this.getAggregatedMetrics(operation)
      if (aggregated) {
        results.push(aggregated)
      }
    }
    return results.sort((a, b) => b.totalDurationMs - a.totalDurationMs)
  }

  /**
   * Get recent metrics for an operation
   */
  getRecentMetrics(operation: string, limit = 10): PerformanceMetric[] {
    const operationMetrics = this.metrics.get(operation)
    if (!operationMetrics) {
      return []
    }
    return operationMetrics.slice(-limit)
  }

  /**
   * Get slow operations above threshold
   */
  getSlowOperations(thresholdMs?: number): PerformanceMetric[] {
    const threshold = thresholdMs ?? this.config.slowThresholdMs
    const slowOps: PerformanceMetric[] = []

    for (const operationMetrics of this.metrics.values()) {
      for (const metric of operationMetrics) {
        if (metric.durationMs > threshold) {
          slowOps.push(metric)
        }
      }
    }

    return slowOps.sort((a, b) => b.durationMs - a.durationMs)
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): PerformanceMetric[] {
    const failed: PerformanceMetric[] = []

    for (const operationMetrics of this.metrics.values()) {
      for (const metric of operationMetrics) {
        if (!metric.success) {
          failed.push(metric)
        }
      }
    }

    return failed.sort((a, b) => b.endedAt - a.endedAt)
  }

  /**
   * Clear metrics for an operation or all operations
   */
  clearMetrics(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * Get summary report
   */
  getSummaryReport(): PerformanceSummaryReport {
    const allMetrics = this.getAllAggregatedMetrics()
    let totalOperations = 0
    let totalDuration = 0
    let totalSuccess = 0
    let totalFailure = 0

    for (const aggregated of allMetrics) {
      totalOperations += aggregated.count
      totalDuration += aggregated.totalDurationMs
      totalSuccess += Math.round(aggregated.count * aggregated.successRate)
      totalFailure += Math.round(aggregated.count * (1 - aggregated.successRate))
    }

    const slowOps = this.getSlowOperations()

    return {
      totalOperations,
      totalDurationMs: totalDuration,
      successRate: totalOperations > 0 ? totalSuccess / totalOperations : 1,
      operationTypes: allMetrics.length,
      slowOperationsCount: slowOps.length,
      topSlowOperations: slowOps.slice(0, 5),
      byOperation: allMetrics,
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceMonitorConfig {
    return { ...this.config }
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0
    const firstValue = sortedValues[0]
    if (sortedValues.length === 1 || firstValue === undefined) return firstValue ?? 0

    const index = (p / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower

    const lastValue = sortedValues[sortedValues.length - 1]
    if (upper >= sortedValues.length) return lastValue ?? 0

    const lowerValue = sortedValues[lower] ?? 0
    const upperValue = sortedValues[upper] ?? 0
    return lowerValue * (1 - weight) + upperValue * weight
  }

  /**
   * Get current memory usage (bytes)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
}

/** Summary report interface */
export interface PerformanceSummaryReport {
  totalOperations: number
  totalDurationMs: number
  successRate: number
  operationTypes: number
  slowOperationsCount: number
  topSlowOperations: PerformanceMetric[]
  byOperation: AggregatedMetrics[]
}

/** Global performance monitor instance */
let globalMonitor: PerformanceMonitor | null = null

/**
 * Get or create global performance monitor
 */
export function getPerformanceMonitor(
  config?: Partial<PerformanceMonitorConfig>
): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor(config)
  } else if (config) {
    globalMonitor.updateConfig(config)
  }
  return globalMonitor
}

/**
 * Reset global performance monitor
 */
export function resetPerformanceMonitor(): void {
  globalMonitor = null
}

/**
 * Decorator for measuring async methods
 */
export function measured(operationName?: string) {
  return <T extends (...args: unknown[]) => Promise<unknown>>(
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> => {
    const originalMethod = descriptor.value!
    const name = operationName || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const monitor = getPerformanceMonitor()
      return monitor.measure(name, () => originalMethod.apply(this, args))
    } as T

    return descriptor
  }
}
