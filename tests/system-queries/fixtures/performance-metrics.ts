export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: number;
  status?: 'good' | 'warning' | 'critical';
}

export interface PerformanceBenchmark {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  stdDeviation: number;
  throughput: number;
  metrics: PerformanceMetric[];
}

export interface PerformanceThresholds {
  maxQueryTime: number;
  maxSetupTime: number;
  maxMemoryUsage: number;
  maxCPUUsage: number;
  minThroughput: number;
}

export class PerformanceMetrics {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private benchmarks: PerformanceBenchmark[] = [];
  private thresholds: PerformanceThresholds;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      maxQueryTime: 200,
      maxSetupTime: 100,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxCPUUsage: 80,
      minThroughput: 100,
      ...thresholds
    };
  }

  recordMetric(name: string, value: number, unit: string, threshold?: number): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      threshold,
      status: this.determineStatus(value, threshold)
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
  }

  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>,
    expectedTime?: number
  ): Promise<{ result: T; duration: number; metric: PerformanceMetric }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Record timing metric
      this.recordMetric(
        `${name}_duration`,
        duration,
        'ms',
        expectedTime || this.thresholds.maxQueryTime
      );

      // Record memory metric
      this.recordMetric(
        `${name}_memory`,
        memoryDelta,
        'bytes',
        this.thresholds.maxMemoryUsage
      );

      const metric = this.getLatestMetric(`${name}_duration`)!;

      return { result, duration, metric };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(
        `${name}_error_duration`,
        duration,
        'ms',
        expectedTime || this.thresholds.maxQueryTime
      );

      throw error;
    }
  }

  async benchmark(
    operation: string,
    fn: () => Promise<void>,
    iterations: number = 10
  ): Promise<PerformanceBenchmark> {
    const times: number[] = [];
    const metrics: PerformanceMetric[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration, metric } = await this.measureOperation(
        `${operation}_bench_${i}`,
        fn
      );
      times.push(duration);
      metrics.push(metric);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate standard deviation
    const variance = times.reduce((acc, time) => {
      return acc + Math.pow(time - averageTime, 2);
    }, 0) / iterations;
    const stdDeviation = Math.sqrt(variance);

    // Calculate throughput (operations per second)
    const throughput = 1000 / averageTime;

    const benchmark: PerformanceBenchmark = {
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      stdDeviation,
      throughput,
      metrics
    };

    this.benchmarks.push(benchmark);
    return benchmark;
  }

  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  getLatestMetric(name: string): PerformanceMetric | undefined {
    const metrics = this.getMetrics(name);
    return metrics.length > 0 ? metrics[metrics.length - 1] : undefined;
  }

  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics);
  }

  getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  private determineStatus(value: number, threshold?: number): 'good' | 'warning' | 'critical' {
    if (!threshold) return 'good';

    if (value <= threshold * 0.7) return 'good';
    if (value <= threshold * 0.9) return 'warning';
    return 'critical';
  }

  validatePerformance(): {
    passed: boolean;
    failures: string[];
    warnings: string[];
    summary: any;
  } {
    const failures: string[] = [];
    const warnings: string[] = [];

    // Check all metrics against thresholds
    for (const [name, metricList] of this.metrics) {
      for (const metric of metricList) {
        if (metric.threshold && metric.value > metric.threshold) {
          failures.push(
            `${metric.name}: ${metric.value}${metric.unit} exceeds threshold ${metric.threshold}${metric.unit}`
          );
        } else if (metric.status === 'warning') {
          warnings.push(
            `${metric.name}: ${metric.value}${metric.unit} approaching threshold`
          );
        }
      }
    }

    // Check benchmarks
    for (const benchmark of this.benchmarks) {
      if (benchmark.averageTime > this.thresholds.maxQueryTime) {
        failures.push(
          `${benchmark.operation}: average time ${benchmark.averageTime.toFixed(2)}ms exceeds threshold ${this.thresholds.maxQueryTime}ms`
        );
      }

      if (benchmark.throughput < this.thresholds.minThroughput) {
        failures.push(
          `${benchmark.operation}: throughput ${benchmark.throughput.toFixed(2)} ops/sec below threshold ${this.thresholds.minThroughput} ops/sec`
        );
      }
    }

    const summary = this.generateSummary();

    return {
      passed: failures.length === 0,
      failures,
      warnings,
      summary
    };
  }

  generateSummary(): any {
    const metricCount = Array.from(this.metrics.values()).reduce(
      (total, metricList) => total + metricList.length,
      0
    );

    const statusCounts = {
      good: 0,
      warning: 0,
      critical: 0
    };

    for (const metricList of this.metrics.values()) {
      for (const metric of metricList) {
        statusCounts[metric.status || 'good']++;
      }
    }

    const avgBenchmarkTime = this.benchmarks.length > 0
      ? this.benchmarks.reduce((sum, b) => sum + b.averageTime, 0) / this.benchmarks.length
      : 0;

    const avgThroughput = this.benchmarks.length > 0
      ? this.benchmarks.reduce((sum, b) => sum + b.throughput, 0) / this.benchmarks.length
      : 0;

    return {
      totalMetrics: metricCount,
      statusCounts,
      benchmarks: {
        count: this.benchmarks.length,
        averageTime: avgBenchmarkTime,
        averageThroughput: avgThroughput
      },
      thresholds: this.thresholds
    };
  }

  reset(): void {
    this.metrics.clear();
    this.benchmarks = [];
  }

  exportData(): {
    metrics: { [key: string]: PerformanceMetric[] };
    benchmarks: PerformanceBenchmark[];
    thresholds: PerformanceThresholds;
    summary: any;
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      benchmarks: this.benchmarks,
      thresholds: this.thresholds,
      summary: this.generateSummary()
    };
  }

  static fromData(data: ReturnType<PerformanceMetrics['exportData']>): PerformanceMetrics {
    const metrics = new PerformanceMetrics(data.thresholds);

    // Restore metrics
    for (const [name, metricList] of Object.entries(data.metrics)) {
      metrics.metrics.set(name, metricList);
    }

    // Restore benchmarks
    metrics.benchmarks = data.benchmarks;

    return metrics;
  }
}

export class PerformanceProfiler {
  private startTimes: Map<string, number> = new Map();
  private metrics: PerformanceMetrics;

  constructor(metrics: PerformanceMetrics) {
    this.metrics = metrics;
  }

  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  end(label: string, threshold?: number): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      throw new Error(`No start time found for label: ${label}`);
    }

    const duration = performance.now() - startTime;
    this.metrics.recordMetric(label, duration, 'ms', threshold);
    this.startTimes.delete(label);

    return duration;
  }

  profile<T>(label: string, fn: () => T, threshold?: number): T {
    this.start(label);
    try {
      const result = fn();
      this.end(label, threshold);
      return result;
    } catch (error) {
      this.end(label, threshold);
      throw error;
    }
  }

  async profileAsync<T>(
    label: string,
    fn: () => Promise<T>,
    threshold?: number
  ): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label, threshold);
      return result;
    } catch (error) {
      this.end(label, threshold);
      throw error;
    }
  }
}

export default PerformanceMetrics;