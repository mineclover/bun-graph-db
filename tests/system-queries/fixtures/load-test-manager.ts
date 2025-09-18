export interface LoadTestConfig {
  name: string;
  type: 'constant' | 'ramp' | 'spike' | 'stress' | 'volume';
  duration: number;
  users?: number;
  rps?: number; // requests per second
  connections?: number;
  rampUpTime?: number;
  rampDownTime?: number;
}

export interface LoadTestResult {
  name: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  requestsPerSecond: number;
  errorsPerSecond: number;
  throughput: number;
  errorRate: number;
}

export interface ConnectionStormConfig {
  maxConnections: number;
  connectionRate: number; // connections per second
  duration: number;
  keepAliveTime?: number;
}

export class LoadTestManager {
  private activeTests: Map<string, LoadTestConfig> = new Map();
  private testResults: Map<string, LoadTestResult> = new Map();
  private testTimers: Map<string, NodeJS.Timeout> = new Map();
  private testIntervals: Map<string, NodeJS.Timeout> = new Map();

  async simulateHighQueryLoad(requestsPerSecond: number, duration: number = 60000): Promise<void> {
    const config: LoadTestConfig = {
      name: 'high-query-load',
      type: 'constant',
      duration,
      rps: requestsPerSecond
    };

    this.activeTests.set('high-query-load', config);

    // Simulate the load for the specified duration
    const timer = setTimeout(() => {
      this.stopTest('high-query-load');
    }, duration);

    this.testTimers.set('high-query-load', timer);
  }

  async simulateConnectionStorm(maxConnections: number): Promise<void> {
    const config: LoadTestConfig = {
      name: 'connection-storm',
      type: 'spike',
      duration: 30000, // 30 seconds
      connections: maxConnections
    };

    this.activeTests.set('connection-storm', config);

    // Simulate connection storm
    const timer = setTimeout(() => {
      this.stopTest('connection-storm');
    }, config.duration);

    this.testTimers.set('connection-storm', timer);
  }

  async simulateRampUpLoad(
    startRps: number,
    endRps: number,
    rampTime: number,
    sustainTime: number = 30000
  ): Promise<void> {
    const config: LoadTestConfig = {
      name: 'ramp-up-load',
      type: 'ramp',
      duration: rampTime + sustainTime,
      rps: endRps,
      rampUpTime: rampTime
    };

    this.activeTests.set('ramp-up-load', config);

    // Simulate gradual ramp-up
    let currentRps = startRps;
    const rpsIncrement = (endRps - startRps) / (rampTime / 1000);

    const rampInterval = setInterval(() => {
      currentRps = Math.min(currentRps + rpsIncrement, endRps);
      config.rps = currentRps;

      if (currentRps >= endRps) {
        clearInterval(rampInterval);
      }
    }, 1000);

    this.testIntervals.set('ramp-up-load', rampInterval as any);

    // Stop test after total duration
    const timer = setTimeout(() => {
      this.stopTest('ramp-up-load');
    }, config.duration);

    this.testTimers.set('ramp-up-load', timer);
  }

  async simulateSpikeTest(
    baselineRps: number,
    spikeRps: number,
    spikeDuration: number,
    totalDuration: number = 120000
  ): Promise<void> {
    const config: LoadTestConfig = {
      name: 'spike-test',
      type: 'spike',
      duration: totalDuration,
      rps: baselineRps
    };

    this.activeTests.set('spike-test', config);

    // Create spike after 25% of test duration
    const spikeStartTime = totalDuration * 0.25;

    const spikeTimer = setTimeout(() => {
      config.rps = spikeRps;

      // Return to baseline after spike duration
      const spikeEndTimer = setTimeout(() => {
        config.rps = baselineRps;
      }, spikeDuration);

      this.testTimers.set('spike-end', spikeEndTimer);
    }, spikeStartTime);

    this.testTimers.set('spike-start', spikeTimer);

    // Stop test after total duration
    const endTimer = setTimeout(() => {
      this.stopTest('spike-test');
    }, totalDuration);

    this.testTimers.set('spike-test', endTimer);
  }

  async simulateStressTest(maxRps: number, duration: number = 300000): Promise<void> {
    const config: LoadTestConfig = {
      name: 'stress-test',
      type: 'stress',
      duration,
      rps: maxRps
    };

    this.activeTests.set('stress-test', config);

    // Stress test runs at maximum load
    const timer = setTimeout(() => {
      this.stopTest('stress-test');
    }, duration);

    this.testTimers.set('stress-test', timer);
  }

  async simulateVolumeTest(users: number, duration: number = 3600000): Promise<void> {
    const config: LoadTestConfig = {
      name: 'volume-test',
      type: 'volume',
      duration,
      users,
      rps: users * 0.1 // Assume each user makes 0.1 requests per second
    };

    this.activeTests.set('volume-test', config);

    const timer = setTimeout(() => {
      this.stopTest('volume-test');
    }, duration);

    this.testTimers.set('volume-test', timer);
  }

  async simulateConnectionPoolStorm(poolSize: number, stormDuration: number = 30000): Promise<void> {
    const config: LoadTestConfig = {
      name: 'connection-pool-storm',
      type: 'spike',
      duration: stormDuration,
      connections: poolSize * 5 // Request 5x the pool size
    };

    this.activeTests.set('connection-pool-storm', config);

    const timer = setTimeout(() => {
      this.stopTest('connection-pool-storm');
    }, stormDuration);

    this.testTimers.set('connection-pool-storm', timer);
  }

  async stopTest(testName: string): Promise<LoadTestResult | undefined> {
    const config = this.activeTests.get(testName);
    if (!config) {
      return undefined;
    }

    // Generate test results
    const result = this.generateTestResult(config);
    this.testResults.set(testName, result);

    // Clean up test
    this.activeTests.delete(testName);

    // Clear timers
    const timer = this.testTimers.get(testName);
    if (timer) {
      clearTimeout(timer);
      this.testTimers.delete(testName);
    }

    const interval = this.testIntervals.get(testName);
    if (interval) {
      clearInterval(interval);
      this.testIntervals.delete(testName);
    }

    // Clear related timers
    const relatedTimers = [`${testName}-start`, `${testName}-end`, 'spike-start', 'spike-end'];
    for (const timerName of relatedTimers) {
      const relatedTimer = this.testTimers.get(timerName);
      if (relatedTimer) {
        clearTimeout(relatedTimer);
        this.testTimers.delete(timerName);
      }
    }

    return result;
  }

  async stopAllTests(): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];

    for (const testName of this.activeTests.keys()) {
      const result = await this.stopTest(testName);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }

  getTestConfig(testName: string): LoadTestConfig | undefined {
    return this.activeTests.get(testName);
  }

  getTestResult(testName: string): LoadTestResult | undefined {
    return this.testResults.get(testName);
  }

  getAllTestResults(): LoadTestResult[] {
    return Array.from(this.testResults.values());
  }

  isTestActive(testName: string): boolean {
    return this.activeTests.has(testName);
  }

  getCurrentLoadMetrics(): {
    activeTests: number;
    totalRps: number;
    totalConnections: number;
    estimatedLoad: 'low' | 'medium' | 'high' | 'critical';
  } {
    let totalRps = 0;
    let totalConnections = 0;

    for (const config of this.activeTests.values()) {
      totalRps += config.rps || 0;
      totalConnections += config.connections || 0;
    }

    let estimatedLoad: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (totalRps > 1000 || totalConnections > 500) {
      estimatedLoad = 'critical';
    } else if (totalRps > 500 || totalConnections > 200) {
      estimatedLoad = 'high';
    } else if (totalRps > 100 || totalConnections > 50) {
      estimatedLoad = 'medium';
    }

    return {
      activeTests: this.activeTests.size,
      totalRps,
      totalConnections,
      estimatedLoad
    };
  }

  private generateTestResult(config: LoadTestConfig): LoadTestResult {
    // Simulate realistic test results based on configuration
    const durationSeconds = config.duration / 1000;
    const targetRps = config.rps || 10;
    const totalRequests = Math.floor(targetRps * durationSeconds);

    // Simulate some failures based on load intensity
    const loadFactor = Math.min(targetRps / 100, 1); // Higher load = more failures
    const errorRate = Math.min(loadFactor * 0.05, 0.15); // Max 15% error rate
    const failedRequests = Math.floor(totalRequests * errorRate);
    const successfulRequests = totalRequests - failedRequests;

    // Simulate response times based on load
    const baseResponseTime = 50; // Base 50ms
    const loadPenalty = loadFactor * 200; // Up to 200ms penalty for high load
    const averageResponseTime = baseResponseTime + loadPenalty;

    const minResponseTime = Math.max(averageResponseTime * 0.5, 10);
    const maxResponseTime = averageResponseTime * 3;
    const p95ResponseTime = averageResponseTime * 2;

    const actualRps = totalRequests / durationSeconds;
    const errorsPerSecond = failedRequests / durationSeconds;
    const throughput = successfulRequests / durationSeconds;

    return {
      name: config.name,
      duration: config.duration,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      p95ResponseTime,
      requestsPerSecond: actualRps,
      errorsPerSecond,
      throughput,
      errorRate
    };
  }

  // Transform query results based on active load tests
  transformQueryResult(result: any, queryType: 'systemStats' | 'memoryStats' | 'healthCheck'): any {
    if (this.activeTests.size === 0) {
      return result;
    }

    let transformedResult = { ...result };
    const loadMetrics = this.getCurrentLoadMetrics();

    // Apply load-based transformations
    if (loadMetrics.estimatedLoad === 'critical') {
      transformedResult = this.applyCriticalLoadTransformation(transformedResult);
    } else if (loadMetrics.estimatedLoad === 'high') {
      transformedResult = this.applyHighLoadTransformation(transformedResult);
    } else if (loadMetrics.estimatedLoad === 'medium') {
      transformedResult = this.applyMediumLoadTransformation(transformedResult);
    }

    // Apply specific test transformations
    for (const [testName, config] of this.activeTests) {
      transformedResult = this.applyTestSpecificTransformation(
        transformedResult,
        testName,
        config,
        queryType
      );
    }

    return transformedResult;
  }

  private applyCriticalLoadTransformation(result: any): any {
    const transformed = { ...result };

    // High CPU and memory usage under critical load
    if (transformed.cpuUsage || transformed.cpu) {
      const cpu = transformed.cpuUsage || transformed.cpu;
      cpu.percentage = Math.min((cpu.percentage || 0) + 40, 95);
    }

    if (transformed.memory) {
      transformed.memory.usagePercentage = Math.min((transformed.memory.usagePercentage || 0) + 25, 90);
    }

    // Database performance degradation
    if (transformed.database) {
      transformed.database.responseTime = (transformed.database.responseTime || 50) + 500;
    }

    return transformed;
  }

  private applyHighLoadTransformation(result: any): any {
    const transformed = { ...result };

    if (transformed.cpuUsage || transformed.cpu) {
      const cpu = transformed.cpuUsage || transformed.cpu;
      cpu.percentage = Math.min((cpu.percentage || 0) + 25, 85);
    }

    if (transformed.memory) {
      transformed.memory.usagePercentage = Math.min((transformed.memory.usagePercentage || 0) + 15, 80);
    }

    if (transformed.database) {
      transformed.database.responseTime = (transformed.database.responseTime || 50) + 200;
    }

    return transformed;
  }

  private applyMediumLoadTransformation(result: any): any {
    const transformed = { ...result };

    if (transformed.cpuUsage || transformed.cpu) {
      const cpu = transformed.cpuUsage || transformed.cpu;
      cpu.percentage = Math.min((cpu.percentage || 0) + 10, 70);
    }

    if (transformed.memory) {
      transformed.memory.usagePercentage = Math.min((transformed.memory.usagePercentage || 0) + 5, 65);
    }

    if (transformed.database) {
      transformed.database.responseTime = (transformed.database.responseTime || 50) + 50;
    }

    return transformed;
  }

  private applyTestSpecificTransformation(
    result: any,
    testName: string,
    config: LoadTestConfig,
    _queryType: string
  ): any {
    const transformed = { ...result };

    switch (testName) {
      case 'connection-storm':
      case 'connection-pool-storm':
        return this.applyConnectionStormTransformation(transformed, config);

      case 'spike-test':
        return this.applySpikeTestTransformation(transformed, config);

      case 'stress-test':
        return this.applyStressTestTransformation(transformed, config);

      case 'volume-test':
        return this.applyVolumeTestTransformation(transformed, config);

      default:
        return transformed;
    }
  }

  private applyConnectionStormTransformation(result: any, config: LoadTestConfig): any {
    const transformed = { ...result };

    // Connection storms affect database pool
    if (transformed.database?.pool) {
      transformed.database.pool.leaked = config.connections! > 200;
      transformed.database.pool.available = Math.max(10 - Math.floor(config.connections! / 50), 0);
    } else if (transformed.database) {
      transformed.database.pool = {
        leaked: config.connections! > 200,
        available: Math.max(10 - Math.floor(config.connections! / 50), 0)
      };
    }

    return transformed;
  }

  private applySpikeTestTransformation(result: any, config: LoadTestConfig): any {
    const transformed = { ...result };

    // Spike tests show performance degradation during spikes
    if (config.rps! > 500) {
      if (transformed.performance) {
        transformed.performance.degraded = true;
        transformed.performance.reason = 'traffic spike';
      } else {
        transformed.performance = {
          degraded: true,
          reason: 'traffic spike'
        };
      }
    }

    return transformed;
  }

  private applyStressTestTransformation(result: any, config: LoadTestConfig): any {
    const transformed = { ...result };

    // Stress tests show throttling
    if (transformed.throttled !== undefined) {
      transformed.throttled = true;
    }

    // Add stress indicators
    if (transformed.error && config.rps! > 800) {
      transformed.error = 'throttle: high load detected';
    }

    return transformed;
  }

  private applyVolumeTestTransformation(result: any, config: LoadTestConfig): any {
    const transformed = { ...result };

    // Volume tests primarily affect memory usage
    if (transformed.memory) {
      const userMemoryImpact = (config.users! / 1000) * 10; // 10% per 1000 users
      transformed.memory.usagePercentage = Math.min(
        (transformed.memory.usagePercentage || 0) + userMemoryImpact,
        95
      );
    }

    return transformed;
  }
}

export default LoadTestManager;