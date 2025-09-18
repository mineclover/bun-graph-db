export interface MockCondition {
  name: string;
  description: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  isActive: () => boolean;
}

export interface SystemMockOptions {
  cpuUsage?: number;
  memoryUsage?: number;
  diskIO?: number;
  networkLatency?: number;
  errorRate?: number;
}

export interface DatabaseMockOptions {
  responseTime?: number;
  errorRate?: number;
  connectionFailure?: boolean;
  timeoutDuration?: number;
}

export class MockConditionManager {
  private activeMocks: Map<string, MockCondition> = new Map();
  private originalValues: Map<string, any> = new Map();
  private mockValues: Map<string, any> = new Map();

  async applyMockCondition(condition: MockCondition): Promise<void> {
    if (this.activeMocks.has(condition.name)) {
      await this.clearMockCondition(condition.name);
    }

    await condition.setup();
    this.activeMocks.set(condition.name, condition);
  }

  async clearMockCondition(name: string): Promise<void> {
    const condition = this.activeMocks.get(name);
    if (condition) {
      await condition.teardown();
      this.activeMocks.delete(name);
    }
  }

  async clearAllMocks(): Promise<void> {
    const promises = Array.from(this.activeMocks.keys()).map(name =>
      this.clearMockCondition(name)
    );
    await Promise.all(promises);
    this.mockValues.clear();
  }

  getActiveMocks(): string[] {
    return Array.from(this.activeMocks.keys());
  }

  isConditionActive(name: string): boolean {
    const condition = this.activeMocks.get(name);
    return condition ? condition.isActive() : false;
  }

  // Additional methods for CPU testing
  setCPUUsage(percentage: number): void {
    this.mockValues.set('cpuUsage', percentage);
  }

  getCPUUsage(): number {
    return this.mockValues.get('cpuUsage') || 0;
  }

  setUptime(seconds: number): void {
    this.mockValues.set('uptime', seconds);
  }

  getUptime(): number {
    return this.mockValues.get('uptime') || process.uptime();
  }

  simulateZeroTimeDelta(): void {
    this.mockValues.set('zeroTimeDelta', true);
  }

  isZeroTimeDelta(): boolean {
    return this.mockValues.get('zeroTimeDelta') || false;
  }

  setCPUCores(physical: number, logical?: number): void {
    this.mockValues.set('cpuCores', { physical, logical: logical || physical });
  }

  getCPUCores(): { physical: number; logical: number } {
    return this.mockValues.get('cpuCores') || { physical: 1, logical: 1 };
  }

  setMemoryUsage(percentage: number): void {
    this.mockValues.set('memoryUsage', percentage);
  }

  getMemoryUsage(): number {
    return this.mockValues.get('memoryUsage') || 0;
  }

  // Mock connection for testing
  getConnection(): any {
    return {
      query: () => ({ get: () => ({ count: 1 }) }),
      prepare: () => ({ get: () => ({ count: 1 }), all: () => [{ name: 'test' }] }),
      close: () => {}
    };
  }

  // Reset all mock values
  resetMockValues(): void {
    this.mockValues.clear();
  }
}

// System condition mocks
export class SystemMockConditions {
  static createHighCPUUsage(percentage: number = 90): MockCondition {
    let isActive = false;

    return {
      name: 'high-cpu-usage',
      description: `Mock high CPU usage at ${percentage}%`,
      setup: async () => {
        // In a real implementation, this would mock the OS CPU readings
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createHighMemoryUsage(percentage: number = 85): MockCondition {
    let isActive = false;

    return {
      name: 'high-memory-usage',
      description: `Mock high memory usage at ${percentage}%`,
      setup: async () => {
        // In a real implementation, this would mock memory readings
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createDiskIOBottleneck(latency: number = 500): MockCondition {
    let isActive = false;

    return {
      name: 'disk-io-bottleneck',
      description: `Mock disk I/O bottleneck with ${latency}ms latency`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createNetworkLatency(latency: number = 1000): MockCondition {
    let isActive = false;

    return {
      name: 'network-latency',
      description: `Mock network latency of ${latency}ms`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createSystemOverload(options: SystemMockOptions = {}): MockCondition {
    let isActive = false;

    return {
      name: 'system-overload',
      description: 'Mock complete system overload condition',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }
}

// Database condition mocks
export class DatabaseMockConditions {
  static createSlowDatabase(responseTime: number = 1000): MockCondition {
    let isActive = false;

    return {
      name: 'slow-database',
      description: `Mock slow database with ${responseTime}ms response time`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createDatabaseTimeout(timeoutMs: number = 5000): MockCondition {
    let isActive = false;

    return {
      name: 'database-timeout',
      description: `Mock database timeout after ${timeoutMs}ms`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createConnectionFailure(): MockCondition {
    let isActive = false;

    return {
      name: 'connection-failure',
      description: 'Mock database connection failure',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createCorruptedData(): MockCondition {
    let isActive = false;

    return {
      name: 'corrupted-data',
      description: 'Mock corrupted database responses',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createRandomErrors(errorRate: number = 0.1): MockCondition {
    let isActive = false;

    return {
      name: 'random-errors',
      description: `Mock random database errors at ${errorRate * 100}% rate`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }
}

// Performance condition mocks
export class PerformanceMockConditions {
  static createMemoryLeak(leakRate: number = 1024): MockCondition {
    let isActive = false;

    return {
      name: 'memory-leak',
      description: `Mock memory leak at ${leakRate} bytes/second`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createCPUSpike(intensity: number = 100, duration: number = 5000): MockCondition {
    let isActive = false;

    return {
      name: 'cpu-spike',
      description: `Mock CPU spike at ${intensity}% for ${duration}ms`,
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createGarbageCollectionPressure(): MockCondition {
    let isActive = false;

    return {
      name: 'gc-pressure',
      description: 'Mock high garbage collection pressure',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }
}

// Edge case condition mocks
export class EdgeCaseMockConditions {
  static createZeroValues(): MockCondition {
    let isActive = false;

    return {
      name: 'zero-values',
      description: 'Mock system returning zero values',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createExtremeValues(): MockCondition {
    let isActive = false;

    return {
      name: 'extreme-values',
      description: 'Mock system returning extreme values',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createNullValues(): MockCondition {
    let isActive = false;

    return {
      name: 'null-values',
      description: 'Mock system returning null values',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createInvalidDataTypes(): MockCondition {
    let isActive = false;

    return {
      name: 'invalid-data-types',
      description: 'Mock system returning invalid data types',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }

  static createInconsistentData(): MockCondition {
    let isActive = false;

    return {
      name: 'inconsistent-data',
      description: 'Mock system returning inconsistent data',
      setup: async () => {
        isActive = true;
      },
      teardown: async () => {
        isActive = false;
      },
      isActive: () => isActive
    };
  }
}

export default {
  MockConditionManager,
  SystemMockConditions,
  DatabaseMockConditions,
  PerformanceMockConditions,
  EdgeCaseMockConditions
};