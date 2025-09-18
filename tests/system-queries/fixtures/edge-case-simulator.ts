export interface EdgeCaseConfig {
  type: 'zero' | 'extreme' | 'null' | 'undefined' | 'invalid' | 'inconsistent';
  duration?: number;
  intensity?: number;
  affectedComponents?: string[];
}

export class EdgeCaseSimulator {
  private activeSimulations: Map<string, EdgeCaseConfig> = new Map();
  private originalValues: Map<string, any> = new Map();

  async simulateZeroValues(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'zero',
      affectedComponents: components
    };

    this.activeSimulations.set('zero-values', config);
  }

  async simulateExtremeValues(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'extreme',
      affectedComponents: components,
      intensity: 100
    };

    this.activeSimulations.set('extreme-values', config);
  }

  async simulateNullValues(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'null',
      affectedComponents: components
    };

    this.activeSimulations.set('null-values', config);
  }

  async simulateUndefinedValues(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'undefined',
      affectedComponents: components
    };

    this.activeSimulations.set('undefined-values', config);
  }

  async simulateInvalidDataTypes(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: components
    };

    this.activeSimulations.set('invalid-data-types', config);
  }

  async simulateInconsistentData(components: string[] = ['memory', 'cpu', 'database']): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'inconsistent',
      affectedComponents: components
    };

    this.activeSimulations.set('inconsistent-data', config);
  }

  // Memory-specific edge cases
  async simulateMemoryDivisionByZero(): Promise<void> {
    await this.simulateZeroValues(['memory']);
  }

  async simulateExtremeMemoryValues(): Promise<void> {
    await this.simulateExtremeValues(['memory']);
  }

  async simulateNegativeMemoryValues(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['memory']
    };

    this.activeSimulations.set('negative-memory', config);
  }

  async simulateMemoryInconsistency(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'inconsistent',
      affectedComponents: ['memory']
    };

    this.activeSimulations.set('memory-inconsistency', config);
  }

  // CPU-specific edge cases
  async simulateCPUDivisionByZero(): Promise<void> {
    await this.simulateZeroValues(['cpu']);
  }

  async simulateExtremeCPUValues(): Promise<void> {
    await this.simulateExtremeValues(['cpu']);
  }

  async simulateNegativeCPUValues(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['cpu']
    };

    this.activeSimulations.set('negative-cpu', config);
  }

  async simulateInvalidLoadAverage(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['cpu']
    };

    this.activeSimulations.set('invalid-load-average', config);
  }

  // Health check edge cases
  async simulateInvalidScoreCalculation(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('invalid-score', config);
  }

  async simulateUndefinedComponentUsage(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'undefined',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('undefined-components', config);
  }

  async simulateNaNComponentUsage(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('nan-components', config);
  }

  async simulateInfiniteComponentUsage(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'extreme',
      affectedComponents: ['health'],
      intensity: Infinity
    };

    this.activeSimulations.set('infinite-components', config);
  }

  async simulateNegativeComponentUsage(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('negative-components', config);
  }

  async simulateEmptyComponentStatuses(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'null',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('empty-statuses', config);
  }

  async simulateInvalidStatusValues(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['health']
    };

    this.activeSimulations.set('invalid-statuses', config);
  }

  // Date/timestamp edge cases
  async simulateDateConstructorFailure(): Promise<void> {
    const config: EdgeCaseConfig = {
      type: 'invalid',
      affectedComponents: ['timestamp']
    };

    this.activeSimulations.set('date-constructor-failure', config);
  }

  // System API edge cases
  async simulateSystemAPIDivisionByZero(): Promise<void> {
    await this.simulateZeroValues(['system']);
  }

  async simulateSystemAPIExtremeValues(): Promise<void> {
    await this.simulateExtremeValues(['system']);
  }

  async simulateSystemAPINullValues(): Promise<void> {
    await this.simulateNullValues(['system']);
  }

  async simulateSystemAPIInvalidValues(): Promise<void> {
    await this.simulateInvalidDataTypes(['system']);
  }

  async simulateSystemAPIInconsistentValues(): Promise<void> {
    await this.simulateInconsistentData(['system']);
  }

  // Utility methods
  isSimulationActive(name: string): boolean {
    return this.activeSimulations.has(name);
  }

  getActiveSimulations(): string[] {
    return Array.from(this.activeSimulations.keys());
  }

  getSimulationConfig(name: string): EdgeCaseConfig | undefined {
    return this.activeSimulations.get(name);
  }

  async stopSimulation(name: string): Promise<void> {
    this.activeSimulations.delete(name);

    // Restore original values if stored
    const originalValue = this.originalValues.get(name);
    if (originalValue !== undefined) {
      // In a real implementation, this would restore the mocked values
      this.originalValues.delete(name);
    }
  }

  async stopAllSimulations(): Promise<void> {
    const simulations = Array.from(this.activeSimulations.keys());
    await Promise.all(simulations.map(name => this.stopSimulation(name)));
  }

  // Helper method to mock system values based on configuration
  private mockValue(originalValue: any, config: EdgeCaseConfig): any {
    switch (config.type) {
      case 'zero':
        return 0;

      case 'extreme':
        if (typeof originalValue === 'number') {
          return config.intensity === Infinity ? Infinity : (config.intensity || 999999999);
        }
        return originalValue;

      case 'null':
        return null;

      case 'undefined':
        return undefined;

      case 'invalid':
        if (typeof originalValue === 'number') {
          return config.intensity === Infinity ? Infinity : NaN;
        }
        if (typeof originalValue === 'string') {
          return 123; // Invalid type
        }
        if (Array.isArray(originalValue)) {
          return 'not-an-array'; // Invalid type
        }
        return 'invalid';

      case 'inconsistent':
        // Return values that don't make sense together
        return originalValue;

      default:
        return originalValue;
    }
  }

  // Method to apply edge case transformations to query results
  transformQueryResult(result: any, simulationName?: string): any {
    if (!simulationName) {
      // Apply all active simulations
      let transformedResult = result;
      for (const [name, config] of this.activeSimulations) {
        transformedResult = this.applyTransformation(transformedResult, config);
      }
      return transformedResult;
    }

    const config = this.activeSimulations.get(simulationName);
    if (!config) {
      return result;
    }

    return this.applyTransformation(result, config);
  }

  private applyTransformation(result: any, config: EdgeCaseConfig): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const transformed = { ...result };

    if (config.affectedComponents?.includes('memory') && transformed.memory) {
      transformed.memory = this.transformMemoryData(transformed.memory, config);
    }

    if (config.affectedComponents?.includes('cpu') && transformed.cpuUsage) {
      transformed.cpuUsage = this.transformCPUData(transformed.cpuUsage, config);
    }

    if (config.affectedComponents?.includes('health')) {
      transformed = this.transformHealthData(transformed, config);
    }

    if (config.affectedComponents?.includes('timestamp') && transformed.timestamp) {
      transformed.timestamp = this.transformTimestamp(transformed.timestamp, config);
    }

    return transformed;
  }

  private transformMemoryData(memory: any, config: EdgeCaseConfig): any {
    const transformed = { ...memory };

    switch (config.type) {
      case 'zero':
        transformed.totalMemory = 0;
        transformed.freeMemory = 0;
        transformed.usedMemory = 0;
        break;

      case 'extreme':
        transformed.totalMemory = Number.MAX_SAFE_INTEGER;
        transformed.usedMemory = Number.MAX_SAFE_INTEGER;
        break;

      case 'invalid':
        transformed.totalMemory = NaN;
        transformed.usagePercentage = -50;
        break;

      case 'inconsistent':
        transformed.totalMemory = 1000;
        transformed.freeMemory = 800;
        transformed.usedMemory = 500; // Should be 200
        break;
    }

    return transformed;
  }

  private transformCPUData(cpu: any, config: EdgeCaseConfig): any {
    const transformed = { ...cpu };

    switch (config.type) {
      case 'zero':
        transformed.percentage = 0;
        transformed.loadAverage = [0, 0, 0];
        break;

      case 'extreme':
        transformed.percentage = 999;
        transformed.loadAverage = [999, 999, 999];
        break;

      case 'invalid':
        transformed.percentage = NaN;
        transformed.loadAverage = 'not-an-array';
        break;
    }

    return transformed;
  }

  private transformHealthData(health: any, config: EdgeCaseConfig): any {
    const transformed = { ...health };

    switch (config.type) {
      case 'invalid':
        if (config.affectedComponents?.includes('health')) {
          transformed.score = NaN;
          if (transformed.memory) transformed.memory.usage = NaN;
          if (transformed.cpu) transformed.cpu.usage = NaN;
        }
        break;
    }

    return transformed;
  }

  private transformTimestamp(timestamp: any, config: EdgeCaseConfig): any {
    switch (config.type) {
      case 'invalid':
        return new Date('invalid-date');
      case 'null':
        return null;
      case 'undefined':
        return undefined;
      default:
        return timestamp;
    }
  }
}

export default EdgeCaseSimulator;