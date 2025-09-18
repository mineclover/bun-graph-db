export interface StressTestConfig {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'combined';
  intensity: number; // 0-100
  duration?: number; // milliseconds
  pattern?: 'constant' | 'spike' | 'gradual' | 'random';
}

export interface SystemOverloadOptions {
  cpuUtilization: number;
  memoryPressure: number;
  ioSaturation: boolean;
}

export interface ResponseTimeSpikeConfig {
  baseTime: number;
  spikeTime: number;
  spikeFrequency: number; // 0-1
}

export interface ThresholdBreachConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  responseTimeThreshold: number;
}

export class PerformanceStressSimulator {
  private activeStressors: Map<string, StressTestConfig> = new Map();
  private stressTimers: Map<string, NodeJS.Timeout> = new Map();
  private baselineMetrics: Map<string, any> = new Map();

  async simulateSystemOverload(options: SystemOverloadOptions): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: Math.max(options.cpuUtilization, options.memoryPressure),
      pattern: 'constant'
    };

    this.activeStressors.set('system-overload', config);

    // Simulate high CPU usage
    if (options.cpuUtilization > 0) {
      await this.simulateCpuSaturation(options.cpuUtilization);
    }

    // Simulate memory pressure
    if (options.memoryPressure > 0) {
      await this.simulateMemoryPressure(options.memoryPressure);
    }

    // Simulate I/O saturation
    if (options.ioSaturation) {
      await this.simulateIOSaturation();
    }
  }

  async simulateCpuSaturation(percentage: number): Promise<void> {
    const config: StressTestConfig = {
      type: 'cpu',
      intensity: percentage,
      pattern: 'constant'
    };

    this.activeStressors.set('cpu-saturation', config);
  }

  async simulateMemoryPressure(percentage: number): Promise<void> {
    const config: StressTestConfig = {
      type: 'memory',
      intensity: percentage,
      pattern: 'gradual'
    };

    this.activeStressors.set('memory-pressure', config);
  }

  async simulateIOSaturation(): Promise<void> {
    const config: StressTestConfig = {
      type: 'io',
      intensity: 95,
      pattern: 'constant'
    };

    this.activeStressors.set('io-saturation', config);
  }

  async simulateSlowSystemResponses(delayMs: number): Promise<void> {
    const config: StressTestConfig = {
      type: 'network',
      intensity: 100,
      duration: delayMs,
      pattern: 'constant'
    };

    this.activeStressors.set('slow-responses', config);
  }

  async simulateResponseTimeSpikes(spikeConfig: ResponseTimeSpikeConfig): Promise<void> {
    const config: StressTestConfig = {
      type: 'network',
      intensity: (spikeConfig.spikeTime / spikeConfig.baseTime) * 10,
      pattern: 'spike'
    };

    this.activeStressors.set('response-spikes', config);

    // Store spike configuration for later use
    this.baselineMetrics.set('spike-config', spikeConfig);
  }

  async simulateCascadingDegradation(): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: 50,
      pattern: 'gradual'
    };

    this.activeStressors.set('cascading-degradation', config);

    // Start with low intensity and gradually increase
    let currentIntensity = 10;
    const increaseInterval = setInterval(() => {
      currentIntensity += 10;
      config.intensity = Math.min(currentIntensity, 90);

      if (currentIntensity >= 90) {
        clearInterval(increaseInterval);
      }
    }, 1000);

    this.stressTimers.set('cascading-degradation-timer', increaseInterval as any);
  }

  async simulateVariableSystemLoad(): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: 30,
      pattern: 'random'
    };

    this.activeStressors.set('variable-load', config);

    // Randomly vary the load every 500ms
    const variationInterval = setInterval(() => {
      config.intensity = Math.random() * 80 + 10; // 10-90%
    }, 500);

    this.stressTimers.set('variable-load-timer', variationInterval as any);
  }

  async simulateHighStress(): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: 85,
      pattern: 'constant'
    };

    this.activeStressors.set('high-stress', config);
  }

  async simulateThresholdBreaches(thresholds: ThresholdBreachConfig): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: 100,
      pattern: 'spike'
    };

    this.activeStressors.set('threshold-breaches', config);
    this.baselineMetrics.set('breach-thresholds', thresholds);

    // Simulate CPU threshold breach
    if (thresholds.cpuThreshold) {
      await this.simulateCpuSaturation(thresholds.cpuThreshold + 10);
    }

    // Simulate memory threshold breach
    if (thresholds.memoryThreshold) {
      await this.simulateMemoryPressure(thresholds.memoryThreshold + 10);
    }

    // Simulate response time threshold breach
    if (thresholds.responseTimeThreshold) {
      await this.simulateSlowSystemResponses(thresholds.responseTimeThreshold + 500);
    }
  }

  async simulateGradualDegradation(durationMs: number): Promise<void> {
    const config: StressTestConfig = {
      type: 'combined',
      intensity: 10,
      duration: durationMs,
      pattern: 'gradual'
    };

    this.activeStressors.set('gradual-degradation', config);

    const steps = 10;
    const stepDuration = durationMs / steps;
    let currentStep = 0;

    const degradationInterval = setInterval(() => {
      currentStep++;
      config.intensity = (currentStep / steps) * 80 + 10; // 10% to 90%

      if (currentStep >= steps) {
        clearInterval(degradationInterval);
      }
    }, stepDuration);

    this.stressTimers.set('gradual-degradation-timer', degradationInterval as any);
  }

  async simulateRandomFailure(): Promise<void> {
    const failureTypes = ['cpu-spike', 'memory-leak', 'io-timeout', 'network-error'];
    const randomType = failureTypes[Math.floor(Math.random() * failureTypes.length)];

    const config: StressTestConfig = {
      type: 'combined',
      intensity: Math.random() * 50 + 25, // 25-75%
      duration: Math.random() * 2000 + 500, // 500-2500ms
      pattern: 'spike'
    };

    this.activeStressors.set(`random-failure-${randomType}`, config);

    // Auto-remove after duration
    if (config.duration) {
      setTimeout(() => {
        this.stopStressor(`random-failure-${randomType}`);
      }, config.duration);
    }
  }

  async resetStress(): Promise<void> {
    // Clear all timers
    for (const timer of this.stressTimers.values()) {
      clearInterval(timer);
    }

    // Clear all stressors
    this.activeStressors.clear();
    this.stressTimers.clear();
  }

  async stopStressor(name: string): Promise<void> {
    this.activeStressors.delete(name);

    const timer = this.stressTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.stressTimers.delete(name);
    }
  }

  isStressorActive(name: string): boolean {
    return this.activeStressors.has(name);
  }

  getActiveStressors(): string[] {
    return Array.from(this.activeStressors.keys());
  }

  getCurrentStressLevel(): number {
    if (this.activeStressors.size === 0) {
      return 0;
    }

    // Calculate combined stress level
    let totalIntensity = 0;
    for (const config of this.activeStressors.values()) {
      totalIntensity += config.intensity;
    }

    return Math.min(totalIntensity / this.activeStressors.size, 100);
  }

  getStressMetrics(): {
    activeStressors: number;
    averageIntensity: number;
    peakIntensity: number;
    stressTypes: string[];
  } {
    const intensities = Array.from(this.activeStressors.values()).map(s => s.intensity);
    const types = Array.from(this.activeStressors.values()).map(s => s.type);

    return {
      activeStressors: this.activeStressors.size,
      averageIntensity: intensities.length > 0 ? intensities.reduce((a, b) => a + b, 0) / intensities.length : 0,
      peakIntensity: intensities.length > 0 ? Math.max(...intensities) : 0,
      stressTypes: Array.from(new Set(types))
    };
  }

  // Transform query results based on active stress conditions
  transformQueryResult(result: any, queryType: 'systemStats' | 'memoryStats' | 'healthCheck'): any {
    if (this.activeStressors.size === 0) {
      return result;
    }

    let transformedResult = { ...result };

    for (const [stressorName, config] of this.activeStressors) {
      transformedResult = this.applyStressTransformation(
        transformedResult,
        stressorName,
        config,
        queryType
      );
    }

    return transformedResult;
  }

  private applyStressTransformation(
    result: any,
    stressorName: string,
    config: StressTestConfig,
    queryType: string
  ): any {
    const transformed = { ...result };

    switch (config.type) {
      case 'cpu':
        return this.applyCPUStress(transformed, config, stressorName);

      case 'memory':
        return this.applyMemoryStress(transformed, config, stressorName);

      case 'io':
        return this.applyIOStress(transformed, config, stressorName);

      case 'network':
        return this.applyNetworkStress(transformed, config, stressorName);

      case 'combined':
        return this.applyCombinedStress(transformed, config, stressorName);

      default:
        return transformed;
    }
  }

  private applyCPUStress(result: any, config: StressTestConfig, stressorName: string): any {
    const transformed = { ...result };

    if (transformed.cpuUsage || transformed.cpu) {
      const cpu = transformed.cpuUsage || transformed.cpu;
      cpu.percentage = Math.min(config.intensity, 100);
      cpu.loadAverage = [
        config.intensity / 10,
        config.intensity / 10,
        config.intensity / 10
      ];
    }

    // Add performance impact for health checks
    if (transformed.performance && stressorName.includes('cpu')) {
      transformed.performance = {
        ...transformed.performance,
        impacted: true,
        reason: 'cpu saturation',
        degraded: config.intensity > 80
      };
    }

    return transformed;
  }

  private applyMemoryStress(result: any, config: StressTestConfig, stressorName: string): any {
    const transformed = { ...result };

    if (transformed.memory) {
      const memoryUsagePercent = Math.min(config.intensity, 99);
      transformed.memory.usagePercentage = memoryUsagePercent;
      transformed.memory.usedMemory = (transformed.memory.totalMemory * memoryUsagePercent) / 100;
      transformed.memory.freeMemory = transformed.memory.totalMemory - transformed.memory.usedMemory;

      // Add memory pressure indicators
      if (memoryUsagePercent > 90) {
        transformed.memory.memoryPressure = 'critical';
      } else if (memoryUsagePercent > 75) {
        transformed.memory.memoryPressure = 'high';
      }
    }

    return transformed;
  }

  private applyIOStress(result: any, config: StressTestConfig, stressorName: string): any {
    const transformed = { ...result };

    // Add I/O performance indicators
    if (transformed.performance) {
      transformed.performance = {
        ...transformed.performance,
        io: {
          bottleneck: true,
          latency: config.intensity * 10,
          throughput: Math.max(100 - config.intensity, 10)
        }
      };
    }

    return transformed;
  }

  private applyNetworkStress(result: any, config: StressTestConfig, stressorName: string): any {
    const transformed = { ...result };

    // Apply response time delays for database connections
    if (transformed.database) {
      const baseResponseTime = transformed.database.responseTime || 50;
      transformed.database.responseTime = baseResponseTime + (config.intensity * 10);
    }

    // Handle response time spikes
    if (stressorName === 'response-spikes') {
      const spikeConfig = this.baselineMetrics.get('spike-config') as ResponseTimeSpikeConfig;
      if (spikeConfig && Math.random() < spikeConfig.spikeFrequency) {
        if (transformed.database) {
          transformed.database.responseTime = spikeConfig.spikeTime;
        }
        // Add performance degradation indicator
        if (transformed.performance) {
          transformed.performance.degraded = true;
        }
      }
    }

    return transformed;
  }

  private applyCombinedStress(result: any, config: StressTestConfig, stressorName: string): any {
    let transformed = { ...result };

    // Apply stress to all components proportionally
    const cpuConfig = { ...config, type: 'cpu' as const };
    const memoryConfig = { ...config, type: 'memory' as const, intensity: config.intensity * 0.8 };
    const networkConfig = { ...config, type: 'network' as const, intensity: config.intensity * 0.6 };

    transformed = this.applyCPUStress(transformed, cpuConfig, stressorName);
    transformed = this.applyMemoryStress(transformed, memoryConfig, stressorName);
    transformed = this.applyNetworkStress(transformed, networkConfig, stressorName);

    // Add overall performance metrics
    if (transformed.performance) {
      transformed.performance = {
        ...transformed.performance,
        stress: config.intensity > 70 ? 'high' : config.intensity > 40 ? 'medium' : 'low',
        score: Math.max(100 - config.intensity, 10),
        recommendations: config.intensity > 70 ? ['reduce load', 'scale resources'] : []
      };
    }

    // Add threshold breach indicators
    if (stressorName === 'threshold-breaches') {
      const thresholds = this.baselineMetrics.get('breach-thresholds') as ThresholdBreachConfig;
      if (thresholds && transformed.thresholds) {
        transformed.thresholds = {
          breached: true,
          violations: [
            {
              metric: 'cpu',
              threshold: thresholds.cpuThreshold,
              actual: transformed.cpuUsage?.percentage || 0,
              severity: 'critical'
            },
            {
              metric: 'memory',
              threshold: thresholds.memoryThreshold,
              actual: transformed.memory?.usagePercentage || 0,
              severity: 'warning'
            },
            {
              metric: 'responseTime',
              threshold: thresholds.responseTimeThreshold,
              actual: transformed.database?.responseTime || 0,
              severity: 'critical'
            }
          ].filter(v => v.actual > v.threshold)
        };
      }
    }

    return transformed;
  }
}

export default PerformanceStressSimulator;