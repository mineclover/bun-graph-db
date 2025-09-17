/**
 * PerformanceComparison model - Represents performance metrics and comparisons
 */

// Core performance metrics interface
export interface PerformanceMetrics {
  readonly executionTime: number // milliseconds
  readonly memoryUsage: number // MB
  readonly cpuUsage: number // percentage
  readonly ioOperations: number // count
  readonly databaseConnections: number // count
}

// Performance measurement with metadata
export interface PerformanceMeasurement extends PerformanceMetrics {
  readonly timestamp: Date
  readonly testName: string
  readonly environment: string
  readonly version: string
}

// Anomaly detection configuration
export interface AnomalyDetection {
  readonly enabled: boolean
  readonly thresholds: {
    readonly executionTime: number // percentage variance
    readonly memoryUsage: number // percentage variance
    readonly cpuUsage: number // percentage variance
  }
  readonly sensitivity: 'low' | 'medium' | 'high'
}

// Database-specific performance metrics
export interface DatabasePerformance {
  readonly connectionTime: number // milliseconds
  readonly queryTime: number // milliseconds
  readonly transactionCount: number
  readonly lockWaitTime: number // milliseconds
}

export interface PerformanceBaseline {
  /** Test execution time in milliseconds */
  executionTime: number

  /** Memory usage metrics */
  memory: {
    /** Peak memory usage in bytes */
    peak: number

    /** Average memory usage in bytes */
    average: number

    /** Memory usage at end of test */
    final: number

    /** Memory allocated for database */
    database: number
  }

  /** CPU usage metrics */
  cpu: {
    /** User CPU time in milliseconds */
    user: number

    /** System CPU time in milliseconds */
    system: number

    /** CPU utilization percentage */
    utilization: number
  }

  /** I/O operation metrics */
  io: {
    /** Number of read operations */
    reads: number

    /** Number of write operations */
    writes: number

    /** Total bytes read */
    bytesRead: number

    /** Total bytes written */
    bytesWritten: number

    /** I/O wait time in milliseconds */
    waitTime: number
  }

  /** Database-specific metrics */
  database: {
    /** Database type ('file-based' | 'memory') */
    type: 'file-based' | 'memory'

    /** Number of database connections */
    connections: number

    /** Number of SQL queries executed */
    queries: number

    /** Number of transactions */
    transactions: number

    /** Connection establishment time */
    connectionTime: number

    /** Total query execution time */
    queryTime: number
  }

  /** Resource utilization */
  resources: {
    /** Number of file handles used */
    fileHandles: number

    /** Number of network connections */
    networkConnections: number

    /** Temporary files created */
    tempFiles: number

    /** Peak thread count */
    threads: number
  }

  /** Test-specific metrics */
  test: {
    /** Number of test cases executed */
    testCases: number

    /** Number of assertions */
    assertions: number

    /** Setup time in milliseconds */
    setupTime: number

    /** Teardown time in milliseconds */
    teardownTime: number
  }
}

export interface PerformanceDelta {
  /** Absolute change in value */
  absolute: number

  /** Percentage change (positive = increase, negative = decrease) */
  percentage: number

  /** Whether the change is significant (>10% change) */
  significant: boolean

  /** Whether the change is beneficial or detrimental */
  beneficial: boolean
}

export interface PerformanceThresholds {
  /** Maximum acceptable execution time increase (percentage) */
  maxExecutionTimeIncrease: number

  /** Maximum acceptable memory increase (percentage) */
  maxMemoryIncrease: number

  /** Maximum acceptable I/O overhead (percentage) */
  maxIOIncrease: number

  /** Minimum required performance improvement (percentage) */
  minImprovement: number

  /** Anomaly detection threshold (standard deviations) */
  anomalyThreshold: number
}

export interface PerformanceAnomaly {
  /** Anomaly identifier */
  id: string

  /** Metric that triggered the anomaly */
  metric: string

  /** Observed value */
  observedValue: number

  /** Expected value based on baseline */
  expectedValue: number

  /** Deviation from expected (in standard deviations) */
  deviation: number

  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /** Description of the anomaly */
  description: string

  /** Possible causes */
  possibleCauses: string[]

  /** Recommended actions */
  recommendations: string[]
}

export interface PerformanceComparison {
  /** Comparison identifier */
  id: string

  /** Baseline performance metrics (before migration) */
  baseline: PerformanceBaseline

  /** Current performance metrics (after migration) */
  current: PerformanceBaseline

  /** Performance deltas for each metric */
  deltas: {
    executionTime: PerformanceDelta
    memoryPeak: PerformanceDelta
    memoryAverage: PerformanceDelta
    cpuUser: PerformanceDelta
    cpuSystem: PerformanceDelta
    ioReads: PerformanceDelta
    ioWrites: PerformanceDelta
    ioBytes: PerformanceDelta
    databaseConnections: PerformanceDelta
    databaseQueries: PerformanceDelta
    databaseConnectionTime: PerformanceDelta
  }

  /** Overall performance score (0.0 to 1.0, higher is better) */
  overallScore: number

  /** Performance trends */
  trends: {
    /** Overall trend direction */
    direction: 'improving' | 'degrading' | 'stable'

    /** Confidence in trend assessment */
    confidence: number

    /** Key performance indicators */
    keyMetrics: {
      metric: string
      trend: 'up' | 'down' | 'stable'
      impact: 'positive' | 'negative' | 'neutral'
    }[]
  }

  /** Performance thresholds used for evaluation */
  thresholds: PerformanceThresholds

  /** Detected anomalies */
  anomalies: PerformanceAnomaly[]

  /** Performance recommendations */
  recommendations: {
    /** Recommendation identifier */
    id: string

    /** Recommendation priority */
    priority: 'low' | 'medium' | 'high' | 'critical'

    /** Recommendation description */
    description: string

    /** Expected impact if implemented */
    expectedImpact: string

    /** Implementation effort required */
    effort: 'minimal' | 'low' | 'medium' | 'high'
  }[]

  /** File-based database impact analysis */
  fileBasedImpact: {
    /** Whether migration improved file I/O patterns */
    improvedIO: boolean

    /** File system usage efficiency */
    fsEfficiency: number

    /** Database file size impact */
    fileSizeImpact: PerformanceDelta

    /** Persistence benefits gained */
    persistenceBenefits: string[]

    /** File-based specific recommendations */
    fileBasedRecommendations: string[]
  }

  /** Comparison metadata */
  metadata: {
    /** When the comparison was performed */
    timestamp: Date

    /** Environment information */
    environment: string

    /** Test configuration */
    testConfig: any

    /** Measurement duration */
    measurementDuration: number

    /** Number of measurement samples */
    sampleCount: number
  }
}

export class PerformanceComparisonBuilder {
  private comparison: Partial<PerformanceComparison>

  constructor() {
    this.comparison = {
      id: this.generateComparisonId(),
      deltas: {
        executionTime: { value: 0, percentage: 0, significance: 'none', threshold: 0.05 },
        memoryPeak: { value: 0, percentage: 0, significance: 'none', threshold: 0.1 },
        memoryAverage: { value: 0, percentage: 0, significance: 'none', threshold: 0.1 },
        cpuUser: { value: 0, percentage: 0, significance: 'none', threshold: 0.1 },
        cpuSystem: { value: 0, percentage: 0, significance: 'none', threshold: 0.1 },
        ioRead: { value: 0, percentage: 0, significance: 'none', threshold: 0.15 },
        ioWrite: { value: 0, percentage: 0, significance: 'none', threshold: 0.15 },
        networkLatency: { value: 0, percentage: 0, significance: 'none', threshold: 0.2 },
        databaseQueryTime: { value: 0, percentage: 0, significance: 'none', threshold: 0.2 },
        databaseConnectionTime: { value: 0, percentage: 0, significance: 'none', threshold: 0.3 }
      },
      overallScore: 0.5,
      trends: {
        direction: 'stable',
        confidence: 0.5,
        keyMetrics: []
      },
      thresholds: this.getDefaultThresholds(),
      anomalies: [],
      recommendations: [],
      fileBasedImpact: {
        improvedIO: false,
        fsEfficiency: 0.5,
        fileSizeImpact: { absolute: 0, percentage: 0, significant: false, beneficial: false },
        persistenceBenefits: [],
        fileBasedRecommendations: []
      },
      metadata: {
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
        testConfig: {},
        measurementDuration: 0,
        sampleCount: 1
      }
    }
  }

  private generateComparisonId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 6)
    return `perf-comparison-${timestamp}-${random}`
  }

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      maxExecutionTimeIncrease: 20, // 20% max increase
      maxMemoryIncrease: 30, // 30% max increase
      maxIOIncrease: 50, // 50% max I/O increase
      minImprovement: 5, // 5% minimum improvement to be considered beneficial
      anomalyThreshold: 2.0 // 2 standard deviations
    }
  }

  setBaseline(baseline: PerformanceBaseline): this {
    this.comparison.baseline = baseline
    return this
  }

  setCurrent(current: PerformanceBaseline): this {
    this.comparison.current = current
    this.calculateDeltas()
    this.calculateOverallScore()
    this.analyzeTrends()
    this.detectAnomalies()
    this.generateRecommendations()
    this.analyzeFileBasedImpact()
    return this
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): this {
    this.comparison.thresholds = { ...this.comparison.thresholds!, ...thresholds }
    return this
  }

  private calculateDeltas(): void {
    if (!this.comparison.baseline || !this.comparison.current) return

    const baseline = this.comparison.baseline
    const current = this.comparison.current

    this.comparison.deltas = {
      executionTime: this.calculateDelta(baseline.executionTime, current.executionTime, false),
      memoryPeak: this.calculateDelta(baseline.memory.peak, current.memory.peak, false),
      memoryAverage: this.calculateDelta(baseline.memory.average, current.memory.average, false),
      cpuUser: this.calculateDelta(baseline.cpu.user, current.cpu.user, false),
      cpuSystem: this.calculateDelta(baseline.cpu.system, current.cpu.system, false),
      ioReads: this.calculateDelta(baseline.io.reads, current.io.reads, true),
      ioWrites: this.calculateDelta(baseline.io.writes, current.io.writes, true),
      ioBytes: this.calculateDelta(baseline.io.bytesRead + baseline.io.bytesWritten,
                                  current.io.bytesRead + current.io.bytesWritten, true),
      databaseConnections: this.calculateDelta(baseline.database.connections, current.database.connections, true),
      databaseQueries: this.calculateDelta(baseline.database.queries, current.database.queries, true),
      databaseConnectionTime: this.calculateDelta(baseline.database.connectionTime, current.database.connectionTime, false)
    }
  }

  private calculateDelta(baseline: number, current: number, increaseCanBeBeneficial: boolean): PerformanceDelta {
    const absolute = current - baseline
    const percentage = baseline === 0 ? 0 : (absolute / baseline) * 100
    const significant = Math.abs(percentage) > 10

    let beneficial: boolean
    if (increaseCanBeBeneficial) {
      // For metrics like database queries or I/O, increase might be beneficial if it indicates more work done
      beneficial = Math.abs(percentage) < 10 // Stable is good
    } else {
      // For metrics like execution time or memory, decrease is beneficial
      beneficial = percentage < 0
    }

    return {
      absolute,
      percentage,
      significant,
      beneficial
    }
  }

  private calculateOverallScore(): void {
    if (!this.comparison.deltas) return

    const deltas = this.comparison.deltas
    let score = 0.5 // Start with neutral score

    // Execution time impact (30% weight)
    if (deltas.executionTime.beneficial) {
      score += 0.3 * Math.min(Math.abs(deltas.executionTime.percentage) / 50, 1)
    } else if (deltas.executionTime.significant) {
      score -= 0.3 * Math.min(Math.abs(deltas.executionTime.percentage) / 50, 1)
    }

    // Memory impact (25% weight)
    const memoryScore = (deltas.memoryPeak.beneficial ? 1 : -1) *
                       Math.min(Math.abs(deltas.memoryPeak.percentage) / 50, 1)
    score += 0.25 * memoryScore

    // I/O efficiency (20% weight)
    const ioScore = Math.abs(deltas.ioBytes.percentage) < 20 ? 1 : -0.5
    score += 0.2 * ioScore

    // Database efficiency (15% weight)
    if (deltas.databaseConnectionTime.beneficial) {
      score += 0.15
    } else if (deltas.databaseConnectionTime.percentage > 20) {
      score -= 0.15
    }

    // CPU efficiency (10% weight)
    const cpuScore = (deltas.cpuUser.beneficial ? 1 : -1) *
                    Math.min(Math.abs(deltas.cpuUser.percentage) / 50, 1)
    score += 0.1 * cpuScore

    this.comparison.overallScore = Math.max(0, Math.min(1, score))
  }

  private analyzeTrends(): void {
    if (!this.comparison.deltas) return

    const deltas = this.comparison.deltas
    const significantChanges = Object.entries(deltas).filter(([_, delta]) => delta.significant)
    const beneficialChanges = significantChanges.filter(([_, delta]) => delta.beneficial)
    const detrimentalChanges = significantChanges.filter(([_, delta]) => !delta.beneficial)

    let direction: 'improving' | 'degrading' | 'stable'
    let confidence: number

    if (beneficialChanges.length > detrimentalChanges.length) {
      direction = 'improving'
      confidence = Math.min((beneficialChanges.length / significantChanges.length) * 0.8 + 0.2, 1)
    } else if (detrimentalChanges.length > beneficialChanges.length) {
      direction = 'degrading'
      confidence = Math.min((detrimentalChanges.length / significantChanges.length) * 0.8 + 0.2, 1)
    } else {
      direction = 'stable'
      confidence = 0.7
    }

    const keyMetrics = significantChanges.map(([metric, delta]) => ({
      metric,
      trend: delta.percentage > 0 ? 'up' as const : 'down' as const,
      impact: delta.beneficial ? 'positive' as const : 'negative' as const
    }))

    this.comparison.trends = {
      direction,
      confidence,
      keyMetrics
    }
  }

  private detectAnomalies(): void {
    if (!this.comparison.baseline || !this.comparison.current) return

    const anomalies: PerformanceAnomaly[] = []
    const threshold = this.comparison.thresholds!.anomalyThreshold

    // Check execution time anomaly
    const execTimeDelta = this.comparison.deltas!.executionTime
    if (Math.abs(execTimeDelta.percentage) > threshold * 50) { // 50% per standard deviation
      anomalies.push({
        id: 'execution-time-anomaly',
        metric: 'executionTime',
        observedValue: this.comparison.current.executionTime,
        expectedValue: this.comparison.baseline.executionTime,
        deviation: Math.abs(execTimeDelta.percentage) / 50,
        severity: Math.abs(execTimeDelta.percentage) > 100 ? 'critical' : 'high',
        description: `Execution time changed by ${execTimeDelta.percentage.toFixed(1)}%`,
        possibleCauses: [
          'File-based database I/O overhead',
          'Increased test complexity',
          'Resource contention',
          'Environment changes'
        ],
        recommendations: [
          'Investigate I/O patterns',
          'Profile database operations',
          'Check for resource leaks',
          'Validate test environment consistency'
        ]
      })
    }

    // Check memory anomaly
    const memoryDelta = this.comparison.deltas!.memoryPeak
    if (Math.abs(memoryDelta.percentage) > threshold * 30) { // 30% per standard deviation
      anomalies.push({
        id: 'memory-usage-anomaly',
        metric: 'memoryPeak',
        observedValue: this.comparison.current.memory.peak,
        expectedValue: this.comparison.baseline.memory.peak,
        deviation: Math.abs(memoryDelta.percentage) / 30,
        severity: Math.abs(memoryDelta.percentage) > 60 ? 'high' : 'medium',
        description: `Peak memory usage changed by ${memoryDelta.percentage.toFixed(1)}%`,
        possibleCauses: [
          'File-based database caching',
          'Memory leaks',
          'Increased buffer sizes',
          'Test data changes'
        ],
        recommendations: [
          'Analyze memory allocation patterns',
          'Check for memory leaks',
          'Review database connection pooling',
          'Optimize buffer usage'
        ]
      })
    }

    this.comparison.anomalies = anomalies
  }

  private generateRecommendations(): void {
    const recommendations: PerformanceComparison['recommendations'] = []

    if (!this.comparison.deltas) return

    // Execution time recommendations
    if (this.comparison.deltas.executionTime.percentage > 20) {
      recommendations.push({
        id: 'optimize-execution-time',
        priority: 'high',
        description: 'Execution time increased significantly. Consider optimizing database operations.',
        expectedImpact: 'Reduce execution time by 10-30%',
        effort: 'medium'
      })
    }

    // Memory recommendations
    if (this.comparison.deltas.memoryPeak.percentage > 30) {
      recommendations.push({
        id: 'optimize-memory-usage',
        priority: 'medium',
        description: 'Memory usage increased substantially. Review memory allocation patterns.',
        expectedImpact: 'Reduce memory usage by 15-25%',
        effort: 'low'
      })
    }

    // I/O recommendations
    if (this.comparison.deltas.ioBytes.percentage > 50) {
      recommendations.push({
        id: 'optimize-io-operations',
        priority: 'medium',
        description: 'I/O operations increased significantly. Consider batching or caching strategies.',
        expectedImpact: 'Improve I/O efficiency by 20-40%',
        effort: 'medium'
      })
    }

    // Database connection recommendations
    if (this.comparison.deltas.databaseConnectionTime.percentage > 25) {
      recommendations.push({
        id: 'optimize-database-connections',
        priority: 'high',
        description: 'Database connection time increased. Implement connection pooling or optimization.',
        expectedImpact: 'Reduce connection overhead by 30-50%',
        effort: 'high'
      })
    }

    this.comparison.recommendations = recommendations
  }

  private analyzeFileBasedImpact(): void {
    if (!this.comparison.baseline || !this.comparison.current) return

    const baseline = this.comparison.baseline
    const current = this.comparison.current

    // Check if migration to file-based improved I/O patterns
    const improvedIO = current.database.type === 'file-based' &&
                      baseline.database.type === 'memory' &&
                      current.io.writes > 0 // File-based should have write operations

    // Calculate file system efficiency
    let fsEfficiency = 0.5
    if (current.database.type === 'file-based') {
      // File-based should show consistent I/O patterns
      const ioRatio = current.io.bytesWritten / Math.max(current.io.bytesRead, 1)
      fsEfficiency = Math.min(1.0, Math.max(0.3, 1.0 - Math.abs(ioRatio - 1.0))) // Optimal ratio is around 1:1
    }

    // Calculate file size impact (estimate based on I/O)
    const fileSizeImpact = this.calculateDelta(
      baseline.io.bytesWritten,
      current.io.bytesWritten,
      false
    )

    // Identify persistence benefits
    const persistenceBenefits: string[] = []
    if (current.database.type === 'file-based') {
      persistenceBenefits.push('Data persistence across test runs')
      persistenceBenefits.push('Better integration testing capabilities')
      persistenceBenefits.push('Realistic production-like behavior')

      if (current.io.writes > baseline.io.writes) {
        persistenceBenefits.push('Enhanced data durability')
      }
    }

    // Generate file-based specific recommendations
    const fileBasedRecommendations: string[] = []
    if (current.database.type === 'file-based') {
      if (current.database.connectionTime > baseline.database.connectionTime * 1.5) {
        fileBasedRecommendations.push('Consider connection pooling for file-based databases')
      }

      if (current.io.waitTime > 100) { // More than 100ms I/O wait
        fileBasedRecommendations.push('Optimize file I/O operations with batching')
      }

      fileBasedRecommendations.push('Implement database file cleanup in test teardown')
      fileBasedRecommendations.push('Consider using WAL mode for better concurrency')
    }

    this.comparison.fileBasedImpact = {
      improvedIO,
      fsEfficiency,
      fileSizeImpact,
      persistenceBenefits,
      fileBasedRecommendations
    }
  }

  build(): PerformanceComparison {
    if (!this.comparison.baseline || !this.comparison.current) {
      throw new Error('Both baseline and current performance metrics are required')
    }

    return this.comparison as PerformanceComparison
  }
}