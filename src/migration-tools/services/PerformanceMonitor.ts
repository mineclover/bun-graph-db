/**
 * PerformanceMonitor - Monitors and analyzes test performance
 */

import type {
  PerformanceMetrics,
  PerformanceMeasurement,
  PerformanceComparison,
  AnomalyDetection,
  DatabasePerformance
} from '../models/PerformanceComparison'

export interface MonitoringOptions {
  /** Whether to track memory usage */
  trackMemory: boolean

  /** Whether to track CPU usage */
  trackCPU: boolean

  /** Whether to track I/O operations */
  trackIO: boolean

  /** Whether to track database operations */
  trackDatabase: boolean

  /** Sampling interval in milliseconds */
  samplingInterval: number

  /** Whether to enable profiling */
  enableProfiling: boolean
}

export interface PerformanceReport extends PerformanceMetrics {
  /** Name of the operation */
  operationName: string

  /** Timestamp when measurement was taken */
  timestamp: Date

  /** Result of the operation */
  result: any

  /** I/O specific metrics */
  ioMetrics: {
    reads: number
    writes: number
    totalBytes: number
  }

  /** Database specific metrics */
  databaseMetrics: {
    connections: number
    queries: number
    transactions: number
  }
}

export interface MonitoringConfig {
  /** Whether to enable detailed monitoring */
  enableDetailed: boolean

  /** Sample rate for metrics collection (0.0 to 1.0) */
  sampleRate: number

  /** Whether to detect anomalies */
  enableAnomalyDetection: boolean

  /** Baseline performance thresholds */
  baselineThresholds?: {
    maxExecutionTime?: number
    maxMemoryUsage?: number
    maxDatabaseConnections?: number
  }
}

export interface PerformanceSnapshot {
  timestamp: Date
  metrics: PerformanceMetrics
  context: {
    testType: string
    suiteName: string
    phase: string
  }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private measurements = new Map<string, PerformanceMeasurement[]>()
  private snapshots: PerformanceSnapshot[] = []
  private config: MonitoringConfig
  private activeTimers = new Map<string, number>()
  private database: any

  constructor(database?: any, config: MonitoringConfig = {
    enableDetailed: true,
    sampleRate: 1.0,
    enableAnomalyDetection: true
  }) {
    this.database = database
    this.config = config
  }

  static getInstance(config?: MonitoringConfig): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor(undefined, config)
    }
    return this.instance
  }

  /**
   * Measures execution of an operation and returns performance report
   */
  async measureExecution<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: MonitoringOptions
  ): Promise<PerformanceReport> {
    const startTime = performance.now()
    const startMemory = options.trackMemory ? this.getCurrentMemoryUsage() : 0
    const startCpu = options.trackCPU ? this.getCurrentCpuUsage() : 0

    let result: T
    let executionError: Error | null = null

    try {
      result = await operation()
    } catch (error) {
      executionError = error as Error
      throw error
    } finally {
      const endTime = performance.now()
      const endMemory = options.trackMemory ? this.getCurrentMemoryUsage() : 0
      const endCpu = options.trackCPU ? this.getCurrentCpuUsage() : 0

      const report: PerformanceReport = {
        operationName,
        timestamp: new Date(),
        result: result!,
        executionTime: endTime - startTime,
        memoryUsage: endMemory,
        cpuUsage: endCpu - startCpu,
        ioOperations: options.trackIO ? 1 : 0, // Simplified
        databaseConnections: options.trackDatabase ? 1 : 0, // Simplified
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        ioMetrics: {
          reads: options.trackIO ? 1 : 0,
          writes: options.trackIO ? 1 : 0,
          totalBytes: options.trackIO ? 1024 : 0 // Estimated
        },
        databaseMetrics: {
          connections: options.trackDatabase ? 1 : 0,
          queries: options.trackDatabase ? 1 : 0,
          transactions: options.trackDatabase ? 1 : 0
        }
      }

      return report
    }
  }

  /**
   * Starts monitoring a performance measurement
   */
  startMeasurement(measurementId: string, context?: any): void {
    const startTime = performance.now()
    const startMemory = this.getCurrentMemoryUsage()

    this.activeTimers.set(measurementId, startTime)

    if (!this.measurements.has(measurementId)) {
      this.measurements.set(measurementId, [])
    }

    const measurement: PerformanceMeasurement = {
      id: measurementId,
      startTime: new Date(),
      endTime: new Date(), // Will be updated on end
      duration: 0, // Will be calculated on end
      metrics: {
        executionTime: 0,
        memoryUsage: startMemory,
        cpuUsage: this.getCurrentCpuUsage(),
        ioOperations: 0,
        databaseConnections: 0,
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      context: context || {},
      anomalies: []
    }

    this.measurements.get(measurementId)!.push(measurement)
  }

  /**
   * Ends a performance measurement
   */
  endMeasurement(measurementId: string): PerformanceMeasurement | null {
    const startTime = this.activeTimers.get(measurementId)
    if (!startTime) {
      return null
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    const endMemory = this.getCurrentMemoryUsage()

    this.activeTimers.delete(measurementId)

    const measurements = this.measurements.get(measurementId)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const measurement = measurements[measurements.length - 1]
    measurement.endTime = new Date()
    measurement.duration = duration
    measurement.metrics.executionTime = duration
    measurement.metrics.memoryUsage = endMemory

    // Detect anomalies if enabled
    if (this.config.enableAnomalyDetection) {
      measurement.anomalies = this.detectAnomalies(measurementId, measurement)
    }

    return measurement
  }

  /**
   * Records a performance snapshot
   */
  recordSnapshot(context: { testType: string; suiteName: string; phase: string }): PerformanceSnapshot {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      metrics: {
        executionTime: 0, // Will be aggregated
        memoryUsage: this.getCurrentMemoryUsage(),
        cpuUsage: this.getCurrentCpuUsage(),
        ioOperations: 0,
        databaseConnections: 0,
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      context
    }

    this.snapshots.push(snapshot)
    return snapshot
  }

  /**
   * Compares performance between baseline and current measurements
   */
  comparePerformance(
    baselineId: string,
    currentId: string
  ): PerformanceComparison | null {
    const baselineMeasurements = this.measurements.get(baselineId)
    const currentMeasurements = this.measurements.get(currentId)

    if (!baselineMeasurements || !currentMeasurements) {
      return null
    }

    const baselineMetrics = this.aggregateMetrics(baselineMeasurements)
    const currentMetrics = this.aggregateMetrics(currentMeasurements)

    return this.createComparison(baselineMetrics, currentMetrics)
  }

  /**
   * Analyzes database performance impact
   */
  analyzeDatabasePerformance(
    memoryBasedId: string,
    fileBasedId: string
  ): DatabasePerformance | null {
    const memoryMeasurements = this.measurements.get(memoryBasedId)
    const fileMeasurements = this.measurements.get(fileBasedId)

    if (!memoryMeasurements || !fileMeasurements) {
      return null
    }

    const memoryMetrics = this.aggregateMetrics(memoryMeasurements)
    const fileMetrics = this.aggregateMetrics(fileMeasurements)

    const comparison = this.createComparison(memoryMetrics, fileMetrics)

    return {
      memoryBased: {
        averageQueryTime: memoryMetrics.executionTime / Math.max(memoryMeasurements.length, 1),
        connectionOverhead: memoryMetrics.databaseConnections * 0.1, // Estimate
        memoryFootprint: memoryMetrics.memoryUsage,
        ioLatency: 0 // Memory has no I/O latency
      },
      fileBased: {
        averageQueryTime: fileMetrics.executionTime / Math.max(fileMeasurements.length, 1),
        connectionOverhead: fileMetrics.databaseConnections * 0.2, // Higher overhead
        memoryFootprint: fileMetrics.memoryUsage,
        ioLatency: fileMetrics.ioOperations * 0.5 // Estimate I/O latency
      },
      comparison: {
        queryTimeIncrease: comparison.regressions.executionTimeIncrease,
        memoryDifference: comparison.regressions.memoryIncrease - comparison.improvements.memoryReduction,
        ioOverhead: comparison.regressions.ioOverhead,
        overallImpact: comparison.overallScore
      },
      recommendation: this.generateDatabaseRecommendation(comparison)
    }
  }

  /**
   * Detects performance anomalies
   */
  detectAnomalies(measurementId: string, current: PerformanceMeasurement): AnomalyDetection[] {
    const measurements = this.measurements.get(measurementId) || []
    if (measurements.length < 2) {
      return [] // Need at least 2 measurements for comparison
    }

    const anomalies: AnomalyDetection[] = []
    const recent = measurements.slice(-10) // Last 10 measurements
    const baseline = this.aggregateMetrics(recent.slice(0, -1)) // Exclude current

    // Check execution time anomaly
    const executionTimeIncrease = ((current.metrics.executionTime - baseline.executionTime) / baseline.executionTime) * 100
    if (executionTimeIncrease > 50) { // >50% increase
      anomalies.push({
        type: 'execution_time_spike',
        severity: executionTimeIncrease > 200 ? 'critical' : 'high',
        description: `Execution time increased by ${executionTimeIncrease.toFixed(1)}%`,
        baseline: baseline.executionTime,
        current: current.metrics.executionTime,
        threshold: baseline.executionTime * 1.5,
        recommendation: 'Investigate performance bottlenecks'
      })
    }

    // Check memory anomaly
    const memoryIncrease = ((current.metrics.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage) * 100
    if (memoryIncrease > 50) {
      anomalies.push({
        type: 'memory_spike',
        severity: memoryIncrease > 100 ? 'critical' : 'high',
        description: `Memory usage increased by ${memoryIncrease.toFixed(1)}%`,
        baseline: baseline.memoryUsage,
        current: current.metrics.memoryUsage,
        threshold: baseline.memoryUsage * 1.5,
        recommendation: 'Check for memory leaks'
      })
    }

    return anomalies
  }

  /**
   * Gets all measurements for a specific ID
   */
  getMeasurements(measurementId: string): PerformanceMeasurement[] {
    return this.measurements.get(measurementId) || []
  }

  /**
   * Gets all performance snapshots
   */
  getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Clears all measurements and snapshots
   */
  clear(): void {
    this.measurements.clear()
    this.snapshots.splice(0)
    this.activeTimers.clear()
  }

  private getCurrentMemoryUsage(): number {
    try {
      return process.memoryUsage().heapUsed
    } catch {
      return 0
    }
  }

  private getCurrentCpuUsage(): number {
    try {
      // Simple CPU usage estimation
      return process.cpuUsage().user / 1000000 // Convert to seconds
    } catch {
      return 0
    }
  }

  private aggregateMetrics(measurements: PerformanceMeasurement[]): PerformanceMetrics {
    if (measurements.length === 0) {
      return {
        executionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        ioOperations: 0,
        databaseConnections: 0,
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    }

    const totals = measurements.reduce((acc, m) => ({
      executionTime: acc.executionTime + m.metrics.executionTime,
      memoryUsage: acc.memoryUsage + m.metrics.memoryUsage,
      cpuUsage: acc.cpuUsage + m.metrics.cpuUsage,
      ioOperations: acc.ioOperations + m.metrics.ioOperations,
      databaseConnections: acc.databaseConnections + m.metrics.databaseConnections,
      networkRequests: acc.networkRequests + m.metrics.networkRequests,
      cacheHits: acc.cacheHits + m.metrics.cacheHits,
      cacheMisses: acc.cacheMisses + m.metrics.cacheMisses
    }), {
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      ioOperations: 0,
      databaseConnections: 0,
      networkRequests: 0,
      cacheHits: 0,
      cacheMisses: 0
    })

    const count = measurements.length
    return {
      executionTime: totals.executionTime / count,
      memoryUsage: totals.memoryUsage / count,
      cpuUsage: totals.cpuUsage / count,
      ioOperations: totals.ioOperations / count,
      databaseConnections: totals.databaseConnections / count,
      networkRequests: totals.networkRequests / count,
      cacheHits: totals.cacheHits / count,
      cacheMisses: totals.cacheMisses / count
    }
  }

  private createComparison(baseline: PerformanceMetrics, current: PerformanceMetrics): PerformanceComparison {
    const calculateImprovement = (baseline: number, current: number): number => {
      if (baseline === 0) return 0
      return Math.max(0, ((baseline - current) / baseline) * 100)
    }

    const calculateRegression = (baseline: number, current: number): number => {
      if (baseline === 0) return 0
      return Math.max(0, ((current - baseline) / baseline) * 100)
    }

    const comparison: PerformanceComparison = {
      baseline: {
        executionTime: baseline.executionTime,
        memoryUsage: baseline.memoryUsage,
        ioOperations: baseline.ioOperations,
        databaseConnections: baseline.databaseConnections
      },
      migrated: {
        executionTime: current.executionTime,
        memoryUsage: current.memoryUsage,
        ioOperations: current.ioOperations,
        databaseConnections: current.databaseConnections
      },
      improvements: {
        executionTimeReduction: calculateImprovement(baseline.executionTime, current.executionTime),
        memoryReduction: calculateImprovement(baseline.memoryUsage, current.memoryUsage),
        ioEfficiency: calculateImprovement(baseline.ioOperations, current.ioOperations),
        databaseEfficiency: calculateImprovement(baseline.databaseConnections, current.databaseConnections)
      },
      regressions: {
        executionTimeIncrease: calculateRegression(baseline.executionTime, current.executionTime),
        memoryIncrease: calculateRegression(baseline.memoryUsage, current.memoryUsage),
        ioOverhead: calculateRegression(baseline.ioOperations, current.ioOperations),
        databaseOverhead: calculateRegression(baseline.databaseConnections, current.databaseConnections)
      },
      overallScore: 0 // Will be calculated
    }

    // Calculate overall score
    const improvementScore = (
      comparison.improvements.executionTimeReduction +
      comparison.improvements.memoryReduction +
      comparison.improvements.ioEfficiency +
      comparison.improvements.databaseEfficiency
    ) / 4

    const regressionPenalty = (
      comparison.regressions.executionTimeIncrease +
      comparison.regressions.memoryIncrease +
      comparison.regressions.ioOverhead +
      comparison.regressions.databaseOverhead
    ) / 4

    comparison.overallScore = Math.max(0, Math.min(1, (100 + improvementScore - regressionPenalty) / 100))

    return comparison
  }

  private generateDatabaseRecommendation(comparison: PerformanceComparison): string {
    const score = comparison.overallScore

    if (score >= 0.8) {
      return 'File-based database migration successful with minimal performance impact'
    } else if (score >= 0.6) {
      return 'File-based database migration acceptable, monitor performance closely'
    } else if (score >= 0.4) {
      return 'File-based database migration has moderate performance impact, consider optimization'
    } else {
      return 'File-based database migration has significant performance impact, optimization required'
    }
  }
}