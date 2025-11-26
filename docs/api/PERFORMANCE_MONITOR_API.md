# Performance Monitor API Reference

Lightweight performance tracking utility for operations with minimal overhead.

## Overview

The Performance Monitor provides:
- Operation timing with high precision
- Memory usage tracking (optional)
- Aggregated metrics with percentiles (p50, p95, p99)
- Slow operation detection and callbacks
- Global singleton instance management

## Table of Contents

- [Quick Start](#quick-start)
- [Core Types](#core-types)
- [API Reference](#api-reference)
- [Usage Patterns](#usage-patterns)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Quick Start

```typescript
import { getPerformanceMonitor } from '@/core/utils/PerformanceMonitor'

// Get global monitor instance
const monitor = getPerformanceMonitor()

// Measure async operation
const result = await monitor.measure('database-query', async () => {
  return await db.query('SELECT * FROM users')
})

// Get aggregated metrics
const metrics = monitor.getAggregatedMetrics('database-query')
console.log(`Avg: ${metrics.avgDurationMs}ms, P95: ${metrics.p95DurationMs}ms`)
```

## Core Types

### PerformanceMetric

Individual operation measurement.

```typescript
interface PerformanceMetric {
  operation: string      // Operation name
  durationMs: number     // Duration in milliseconds
  startedAt: number      // Start timestamp
  endedAt: number        // End timestamp
  memoryDelta?: number   // Memory usage delta (bytes)
  metadata?: Record<string, unknown>  // Additional metadata
  success: boolean       // Success status
  error?: string         // Error message if failed
}
```

### AggregatedMetrics

Statistical summary for an operation type.

```typescript
interface AggregatedMetrics {
  operation: string       // Operation name
  count: number           // Total invocations
  totalDurationMs: number // Total duration
  avgDurationMs: number   // Average duration
  minDurationMs: number   // Minimum duration
  maxDurationMs: number   // Maximum duration
  p50DurationMs: number   // P50 (median) duration
  p95DurationMs: number   // P95 duration
  p99DurationMs: number   // P99 duration
  successRate: number     // Success rate (0-1)
  lastInvokedAt: number   // Last invocation timestamp
}
```

### PerformanceTimer

Manual timer handle.

```typescript
interface PerformanceTimer {
  stop: (metadata?: Record<string, unknown>) => PerformanceMetric
  fail: (error: string, metadata?: Record<string, unknown>) => PerformanceMetric
  elapsed: () => number  // Get elapsed time without stopping
}
```

### PerformanceMonitorConfig

Configuration options.

```typescript
interface PerformanceMonitorConfig {
  enabled: boolean               // Enable/disable monitoring (default: true)
  maxMetricsPerOperation: number // Max metrics to retain (default: 1000)
  trackMemory: boolean           // Enable memory tracking (default: false)
  slowThresholdMs: number        // Slow operation threshold (default: 1000)
  onSlowOperation?: (metric: PerformanceMetric) => void  // Slow op callback
}
```

## API Reference

### PerformanceMonitor Class

#### startTimer(operation: string): PerformanceTimer

Start a manual timer for an operation.

```typescript
const timer = monitor.startTimer('file-upload')
// ... perform operation
const metric = timer.stop({ filename: 'data.csv' })

// Or on failure
const metric = timer.fail('Upload timeout')
```

#### measure<T>(operation: string, fn: () => Promise<T>, metadata?): Promise<T>

Measure an async operation automatically.

```typescript
const users = await monitor.measure('fetch-users', async () => {
  return await api.getUsers()
}, { endpoint: '/users' })
```

#### measureSync<T>(operation: string, fn: () => T, metadata?): T

Measure a synchronous operation.

```typescript
const hash = monitor.measureSync('compute-hash', () => {
  return crypto.createHash('sha256').update(data).digest('hex')
})
```

#### getAggregatedMetrics(operation: string): AggregatedMetrics | null

Get aggregated statistics for an operation.

```typescript
const metrics = monitor.getAggregatedMetrics('database-query')
if (metrics) {
  console.log(`Count: ${metrics.count}`)
  console.log(`Avg: ${metrics.avgDurationMs.toFixed(2)}ms`)
  console.log(`P95: ${metrics.p95DurationMs.toFixed(2)}ms`)
}
```

#### getAllAggregatedMetrics(): AggregatedMetrics[]

Get all operation metrics sorted by total duration.

```typescript
const allMetrics = monitor.getAllAggregatedMetrics()
allMetrics.forEach(m => {
  console.log(`${m.operation}: ${m.count} calls, ${m.avgDurationMs.toFixed(2)}ms avg`)
})
```

#### getRecentMetrics(operation: string, limit?: number): PerformanceMetric[]

Get recent individual metrics for an operation.

```typescript
const recent = monitor.getRecentMetrics('api-call', 10)
recent.forEach(m => {
  console.log(`${m.durationMs}ms - ${m.success ? 'OK' : m.error}`)
})
```

#### getSlowOperations(thresholdMs?: number): PerformanceMetric[]

Get operations exceeding threshold (default: config.slowThresholdMs).

```typescript
const slowOps = monitor.getSlowOperations(500)
console.log(`Found ${slowOps.length} operations over 500ms`)
```

#### getFailedOperations(): PerformanceMetric[]

Get all failed operations.

```typescript
const failures = monitor.getFailedOperations()
failures.forEach(f => {
  console.log(`${f.operation}: ${f.error}`)
})
```

#### clearMetrics(operation?: string): void

Clear metrics for specific operation or all.

```typescript
monitor.clearMetrics('test-operation')  // Clear specific
monitor.clearMetrics()                   // Clear all
```

#### getSummaryReport(): PerformanceSummaryReport

Get comprehensive summary report.

```typescript
const report = monitor.getSummaryReport()
console.log(`Total: ${report.totalOperations} operations`)
console.log(`Success rate: ${(report.successRate * 100).toFixed(1)}%`)
console.log(`Slow operations: ${report.slowOperationsCount}`)
```

#### updateConfig(config: Partial<PerformanceMonitorConfig>): void

Update configuration dynamically.

```typescript
monitor.updateConfig({
  slowThresholdMs: 500,
  trackMemory: true
})
```

### Global Functions

#### getPerformanceMonitor(config?): PerformanceMonitor

Get or create global singleton instance.

```typescript
// First call creates instance with config
const monitor = getPerformanceMonitor({ slowThresholdMs: 500 })

// Subsequent calls return same instance, optionally update config
const sameMonitor = getPerformanceMonitor({ trackMemory: true })
```

#### resetPerformanceMonitor(): void

Reset global instance (useful for testing).

```typescript
resetPerformanceMonitor()
const freshMonitor = getPerformanceMonitor()
```

## Usage Patterns

### Service Layer Integration

```typescript
class UserService {
  private monitor = getPerformanceMonitor()

  async findById(id: string): Promise<User> {
    return this.monitor.measure('UserService.findById', async () => {
      return await this.repository.findById(id)
    }, { userId: id })
  }
}
```

### Manual Timer with Error Handling

```typescript
const timer = monitor.startTimer('complex-operation')
try {
  await step1()
  await step2()
  await step3()
  timer.stop({ steps: 3 })
} catch (error) {
  timer.fail(error.message, { failedAt: 'step2' })
  throw error
}
```

### Progress Tracking

```typescript
const timer = monitor.startTimer('batch-process')

for (let i = 0; i < items.length; i++) {
  await processItem(items[i])

  // Check progress without stopping
  if (timer.elapsed() > 30000) {
    console.log(`Processing slow, ${i}/${items.length} complete`)
  }
}

timer.stop({ itemCount: items.length })
```

### Slow Operation Alerts

```typescript
const monitor = new PerformanceMonitor({
  slowThresholdMs: 1000,
  onSlowOperation: (metric) => {
    logger.warn(`Slow operation detected: ${metric.operation}`, {
      duration: metric.durationMs,
      metadata: metric.metadata
    })
  }
})
```

## Configuration

### Default Configuration

```typescript
const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  maxMetricsPerOperation: 1000,
  trackMemory: false,
  slowThresholdMs: 1000
}
```

### Memory Tracking

Enable memory tracking for memory-intensive operations:

```typescript
const monitor = new PerformanceMonitor({ trackMemory: true })

const timer = monitor.startTimer('memory-intensive-op')
// ... allocate memory
const metric = timer.stop()

console.log(`Memory delta: ${metric.memoryDelta} bytes`)
```

### Disabling Monitoring

For production with minimal overhead:

```typescript
const monitor = new PerformanceMonitor({ enabled: false })
// All timing calls become no-ops with minimal overhead
```

## Best Practices

1. **Naming Conventions**
   - Use hierarchical names: `ServiceName.methodName`
   - Include context: `database.query.users`, `api.call.external`

2. **Metadata Usage**
   - Include relevant context for debugging
   - Keep metadata lightweight to avoid memory overhead

3. **Threshold Tuning**
   - Set `slowThresholdMs` based on operation type
   - Use `onSlowOperation` for real-time alerting

4. **Memory Management**
   - Set appropriate `maxMetricsPerOperation` for long-running services
   - Call `clearMetrics()` periodically if needed

5. **Production Configuration**
   - Consider `enabled: false` for extremely hot paths
   - Use `trackMemory: false` unless specifically needed
