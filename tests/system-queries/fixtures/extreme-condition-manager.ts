export interface ExtremeConditionConfig {
  type: 'resource' | 'performance' | 'system' | 'network' | 'disk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration?: number;
  parameters?: Record<string, any>;
}

export interface SystemOverloadConfig {
  memoryPressure?: 'low' | 'medium' | 'high' | 'critical';
  cpuUtilization?: number;
  diskIOSaturation?: boolean;
  networkLatency?: number;
}

export interface ZeroUsageScenario {
  memoryUsage: number;
  cpuUsage: number;
  databaseResponseTime: number;
}

export interface MaximumUsageScenario {
  memoryUsage: number;
  cpuUsage: number;
  databaseResponseTime: number;
}

export interface MixedExtremeStates {
  memory: {
    usage: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  cpu: {
    usage: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  database: {
    connected: boolean;
    responseTime: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export interface ConflictingComponentStatuses {
  memory: {
    usage: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  cpu: {
    usage: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  database: {
    connected: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export class ExtremeConditionManager {
  private activeConditions: Map<string, ExtremeConditionConfig> = new Map();
  private conditionTimers: Map<string, NodeJS.Timeout> = new Map();
  private baselineMetrics: Map<string, any> = new Map();

  async simulateZeroUsageScenario(scenario: ZeroUsageScenario): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'low',
      parameters: scenario
    };

    this.activeConditions.set('zero-usage', config);
  }

  async simulateMaximumUsageScenario(scenario: MaximumUsageScenario): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'critical',
      parameters: scenario
    };

    this.activeConditions.set('maximum-usage', config);
  }

  async simulateMixedExtremeStates(states: MixedExtremeStates): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'medium',
      parameters: states
    };

    this.activeConditions.set('mixed-extreme-states', config);
  }

  async simulateConflictingComponentStatuses(statuses: ConflictingComponentStatuses): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'medium',
      parameters: statuses
    };

    this.activeConditions.set('conflicting-statuses', config);
  }

  async simulateSystemOverload(overloadConfig: SystemOverloadConfig): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'resource',
      severity: 'critical',
      parameters: overloadConfig
    };

    this.activeConditions.set('system-overload', config);
  }

  async simulateHighConcurrencyStress(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'performance',
      severity: 'high',
      parameters: {
        concurrentConnections: 1000,
        requestRate: 500
      }
    };

    this.activeConditions.set('high-concurrency-stress', config);
  }

  async simulateMemoryExhaustionDuringCheck(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'resource',
      severity: 'critical',
      parameters: {
        memoryPressure: 'critical',
        availableMemory: 1024 * 1024 // 1MB
      }
    };

    this.activeConditions.set('memory-exhaustion', config);
  }

  async simulateSystemClockAdjustment(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'medium',
      parameters: {
        clockSkew: 3600000, // 1 hour
        direction: 'forward'
      }
    };

    this.activeConditions.set('clock-adjustment', config);
  }

  async simulateExtremeTimestamps(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'system',
      severity: 'low',
      parameters: {
        timestampType: 'extreme',
        pastDate: new Date('1970-01-01'),
        futureDate: new Date('2099-12-31')
      }
    };

    this.activeConditions.set('extreme-timestamps', config);
  }

  async simulateResourceExhaustion(resourceType: 'memory' | 'cpu' | 'disk' | 'network'): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'resource',
      severity: 'critical',
      parameters: {
        resourceType,
        exhaustionLevel: 95
      }
    };

    this.activeConditions.set(`${resourceType}-exhaustion`, config);
  }

  async simulateNetworkPartition(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'network',
      severity: 'critical',
      parameters: {
        connectivity: false,
        latency: Infinity
      }
    };

    this.activeConditions.set('network-partition', config);
  }

  async simulateDiskFailure(): Promise<void> {
    const config: ExtremeConditionConfig = {
      type: 'disk',
      severity: 'critical',
      parameters: {
        readFailure: true,
        writeFailure: true,
        ioLatency: 10000
      }
    };

    this.activeConditions.set('disk-failure', config);
  }

  async simulateTemporaryCondition(
    conditionName: string,
    config: ExtremeConditionConfig,
    durationMs: number
  ): Promise<void> {
    this.activeConditions.set(conditionName, config);

    // Set timer to automatically remove condition
    const timer = setTimeout(() => {
      this.removeCondition(conditionName);
    }, durationMs);

    this.conditionTimers.set(conditionName, timer);
  }

  async removeCondition(conditionName: string): Promise<void> {
    this.activeConditions.delete(conditionName);

    const timer = this.conditionTimers.get(conditionName);
    if (timer) {
      clearTimeout(timer);
      this.conditionTimers.delete(conditionName);
    }
  }

  async resetToDefaults(): Promise<void> {
    // Clear all timers
    for (const timer of this.conditionTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all conditions
    this.activeConditions.clear();
    this.conditionTimers.clear();

    // Restore baseline metrics if available
    this.baselineMetrics.clear();
  }

  isConditionActive(conditionName: string): boolean {
    return this.activeConditions.has(conditionName);
  }

  getActiveConditions(): string[] {
    return Array.from(this.activeConditions.keys());
  }

  getConditionConfig(conditionName: string): ExtremeConditionConfig | undefined {
    return this.activeConditions.get(conditionName);
  }

  getAllConditionConfigs(): Map<string, ExtremeConditionConfig> {
    return new Map(this.activeConditions);
  }

  async captureBaseline(): Promise<void> {
    // In a real implementation, this would capture current system metrics
    // as baseline for comparison during extreme condition simulation
    this.baselineMetrics.set('memory', {
      total: process.memoryUsage().heapTotal,
      used: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    });

    this.baselineMetrics.set('performance', {
      startTime: Date.now(),
      nodeVersion: process.version,
      platform: process.platform
    });
  }

  getBaseline(metricType: string): any {
    return this.baselineMetrics.get(metricType);
  }

  // Method to transform system query results based on active conditions
  transformSystemQueryResult(result: any, queryType: 'systemStats' | 'memoryStats' | 'healthCheck'): any {
    let transformedResult = { ...result };

    for (const [conditionName, config] of this.activeConditions) {
      transformedResult = this.applyConditionTransformation(
        transformedResult,
        conditionName,
        config,
        queryType
      );
    }

    return transformedResult;
  }

  private applyConditionTransformation(
    result: any,
    conditionName: string,
    config: ExtremeConditionConfig,
    queryType: string
  ): any {
    const transformed = { ...result };

    switch (conditionName) {
      case 'zero-usage':
        return this.applyZeroUsageTransformation(transformed, config.parameters);

      case 'maximum-usage':
        return this.applyMaximumUsageTransformation(transformed, config.parameters);

      case 'mixed-extreme-states':
        return this.applyMixedExtremeStatesTransformation(transformed, config.parameters);

      case 'conflicting-statuses':
        return this.applyConflictingStatusesTransformation(transformed, config.parameters);

      case 'system-overload':
        return this.applySystemOverloadTransformation(transformed, config.parameters);

      case 'memory-exhaustion':
        return this.applyMemoryExhaustionTransformation(transformed, config.parameters);

      case 'clock-adjustment':
        return this.applyClockAdjustmentTransformation(transformed, config.parameters);

      case 'extreme-timestamps':
        return this.applyExtremeTimestampsTransformation(transformed, config.parameters);

      default:
        return transformed;
    }
  }

  private applyZeroUsageTransformation(result: any, params: ZeroUsageScenario): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usagePercentage = params.memoryUsage;
      transformed.memory.usedMemory = 0;
    }

    if (transformed.cpuUsage) {
      transformed.cpuUsage.percentage = params.cpuUsage;
    }

    if (transformed.database) {
      transformed.database.responseTime = params.databaseResponseTime;
    }

    return transformed;
  }

  private applyMaximumUsageTransformation(result: any, params: MaximumUsageScenario): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usagePercentage = params.memoryUsage;
      transformed.memory.usedMemory = transformed.memory.totalMemory;
      transformed.memory.freeMemory = 0;
    }

    if (transformed.cpuUsage) {
      transformed.cpuUsage.percentage = params.cpuUsage;
      transformed.cpuUsage.loadAverage = [99.9, 99.9, 99.9];
    }

    if (transformed.database) {
      transformed.database.responseTime = params.databaseResponseTime;
    }

    return transformed;
  }

  private applyMixedExtremeStatesTransformation(result: any, params: MixedExtremeStates): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usage = params.memory.usage;
      transformed.memory.status = params.memory.status;
    }

    if (transformed.cpu || transformed.cpuUsage) {
      const cpu = transformed.cpu || transformed.cpuUsage;
      cpu.usage = params.cpu.usage;
      cpu.status = params.cpu.status;
    }

    if (transformed.database) {
      transformed.database.connected = params.database.connected;
      transformed.database.responseTime = params.database.responseTime;
      transformed.database.status = params.database.status;
    }

    return transformed;
  }

  private applyConflictingStatusesTransformation(result: any, params: ConflictingComponentStatuses): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usage = params.memory.usage;
      transformed.memory.status = params.memory.status;
    }

    if (transformed.cpu || transformed.cpuUsage) {
      const cpu = transformed.cpu || transformed.cpuUsage;
      cpu.usage = params.cpu.usage;
      cpu.status = params.cpu.status;
    }

    if (transformed.database) {
      transformed.database.connected = params.database.connected;
      transformed.database.status = params.database.status;
    }

    return transformed;
  }

  private applySystemOverloadTransformation(result: any, params: SystemOverloadConfig): any {
    const transformed = { ...result };

    if (params.memoryPressure === 'critical' && transformed.memory) {
      transformed.memory.usagePercentage = 98;
      transformed.memory.freeMemory = transformed.memory.totalMemory * 0.02;
    }

    if (params.cpuUtilization && (transformed.cpuUsage || transformed.cpu)) {
      const cpu = transformed.cpuUsage || transformed.cpu;
      cpu.percentage = params.cpuUtilization;
      cpu.loadAverage = [params.cpuUtilization / 10, params.cpuUtilization / 10, params.cpuUtilization / 10];
    }

    if (params.networkLatency && transformed.database) {
      transformed.database.responseTime = params.networkLatency;
    }

    return transformed;
  }

  private applyMemoryExhaustionTransformation(result: any, params: any): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usagePercentage = 99;
      transformed.memory.freeMemory = params.availableMemory || 1024 * 1024;
      transformed.memory.usedMemory = transformed.memory.totalMemory - transformed.memory.freeMemory;
    }

    return transformed;
  }

  private applyClockAdjustmentTransformation(result: any, params: any): any {
    const transformed = { ...result };

    if (transformed.timestamp) {
      const adjustment = params.clockSkew || 0;
      const direction = params.direction === 'forward' ? 1 : -1;
      const adjustedTime = new Date(transformed.timestamp.getTime() + (adjustment * direction));
      transformed.timestamp = adjustedTime;
    }

    return transformed;
  }

  private applyExtremeTimestampsTransformation(result: any, params: any): any {
    const transformed = { ...result };

    if (transformed.timestamp) {
      // Randomly choose extreme past or future
      const useExtremePast = Math.random() < 0.5;
      transformed.timestamp = useExtremePast ? params.pastDate : params.futureDate;
    }

    return transformed;
  }
}

export default ExtremeConditionManager;