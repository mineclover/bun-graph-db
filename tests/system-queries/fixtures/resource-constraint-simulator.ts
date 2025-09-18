export interface ResourceConstraint {
  type: 'memory' | 'cpu' | 'disk' | 'network' | 'file_descriptors';
  severity: 'low' | 'medium' | 'high' | 'critical';
  parameters: Record<string, any>;
  duration?: number;
}

export class ResourceConstraintSimulator {
  private activeConstraints: Map<string, ResourceConstraint> = new Map();
  private constraintTimers: Map<string, NodeJS.Timeout> = new Map();

  async simulateMemoryExhaustion(percentage: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'memory',
      severity: percentage > 95 ? 'critical' : percentage > 85 ? 'high' : 'medium',
      parameters: {
        exhaustionLevel: percentage,
        availableMemory: process.memoryUsage().heapTotal * ((100 - percentage) / 100)
      }
    };

    this.activeConstraints.set('memory-exhaustion', constraint);
  }

  async simulateFileDescriptorExhaustion(): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'file_descriptors',
      severity: 'high',
      parameters: {
        maxFileDescriptors: 1024,
        usedFileDescriptors: 1020,
        availableFileDescriptors: 4
      }
    };

    this.activeConstraints.set('file-descriptor-exhaustion', constraint);
  }

  async simulateBandwidthConstraints(bandwidthKbps: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'network',
      severity: bandwidthKbps < 10 ? 'critical' : bandwidthKbps < 100 ? 'high' : 'medium',
      parameters: {
        bandwidthKbps,
        latency: Math.max(1000 / bandwidthKbps, 10),
        packetLoss: bandwidthKbps < 50 ? 0.05 : 0.01
      }
    };

    this.activeConstraints.set('bandwidth-constraints', constraint);
  }

  async simulateDiskIOBottleneck(): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'disk',
      severity: 'high',
      parameters: {
        readLatency: 1000,
        writeLatency: 1500,
        throughput: 10 * 1024 * 1024, // 10 MB/s
        queueDepth: 100
      }
    };

    this.activeConstraints.set('disk-io-bottleneck', constraint);
  }

  async simulateSwapPressure(): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'memory',
      severity: 'high',
      parameters: {
        swapUsed: 2 * 1024 * 1024 * 1024, // 2GB
        swapTotal: 4 * 1024 * 1024 * 1024, // 4GB
        swapPressure: 'high',
        memoryPressure: 'critical'
      }
    };

    this.activeConstraints.set('swap-pressure', constraint);
  }

  async simulateCPUThrottling(throttlePercentage: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'cpu',
      severity: throttlePercentage > 50 ? 'high' : 'medium',
      parameters: {
        throttlePercentage,
        availableCPU: 100 - throttlePercentage,
        thermalThrottling: throttlePercentage > 70
      }
    };

    this.activeConstraints.set('cpu-throttling', constraint);
  }

  async simulateDiskSpaceExhaustion(availableSpaceBytes: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'disk',
      severity: availableSpaceBytes < 100 * 1024 * 1024 ? 'critical' : 'high', // < 100MB critical
      parameters: {
        availableSpaceBytes,
        totalSpaceBytes: 10 * 1024 * 1024 * 1024, // 10GB total
        usagePercentage: ((10 * 1024 * 1024 * 1024 - availableSpaceBytes) / (10 * 1024 * 1024 * 1024)) * 100
      }
    };

    this.activeConstraints.set('disk-space-exhaustion', constraint);
  }

  async simulateNetworkPartition(duration?: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'network',
      severity: 'critical',
      parameters: {
        connectivity: false,
        latency: Infinity,
        packetLoss: 1.0
      },
      duration
    };

    this.activeConstraints.set('network-partition', constraint);

    if (duration) {
      const timer = setTimeout(() => {
        this.removeConstraint('network-partition');
      }, duration);

      this.constraintTimers.set('network-partition', timer);
    }
  }

  async simulatePortExhaustion(): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'network',
      severity: 'high',
      parameters: {
        availablePorts: 10,
        totalPorts: 65535,
        usedPorts: 65525
      }
    };

    this.activeConstraints.set('port-exhaustion', constraint);
  }

  async simulateTemporaryNetworkCongestion(duration: number): Promise<void> {
    const constraint: ResourceConstraint = {
      type: 'network',
      severity: 'medium',
      parameters: {
        latency: 2000,
        packetLoss: 0.1,
        jitter: 500
      },
      duration
    };

    this.activeConstraints.set('network-congestion', constraint);

    const timer = setTimeout(() => {
      this.removeConstraint('network-congestion');
    }, duration);

    this.constraintTimers.set('network-congestion', timer);
  }

  async removeConstraint(constraintName: string): Promise<void> {
    this.activeConstraints.delete(constraintName);

    const timer = this.constraintTimers.get(constraintName);
    if (timer) {
      clearTimeout(timer);
      this.constraintTimers.delete(constraintName);
    }
  }

  async removeConstraints(): Promise<void> {
    // Clear all timers
    for (const timer of this.constraintTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all constraints
    this.activeConstraints.clear();
    this.constraintTimers.clear();
  }

  isConstraintActive(constraintName: string): boolean {
    return this.activeConstraints.has(constraintName);
  }

  getActiveConstraints(): string[] {
    return Array.from(this.activeConstraints.keys());
  }

  getConstraintConfig(constraintName: string): ResourceConstraint | undefined {
    return this.activeConstraints.get(constraintName);
  }

  getAllConstraintConfigs(): Map<string, ResourceConstraint> {
    return new Map(this.activeConstraints);
  }

  getResourceUsageSummary(): {
    memory: { constrained: boolean; severity?: string };
    cpu: { constrained: boolean; severity?: string };
    disk: { constrained: boolean; severity?: string };
    network: { constrained: boolean; severity?: string };
    fileDescriptors: { constrained: boolean; severity?: string };
  } {
    const summary = {
      memory: { constrained: false },
      cpu: { constrained: false },
      disk: { constrained: false },
      network: { constrained: false },
      fileDescriptors: { constrained: false }
    } as any;

    for (const [_name, constraint] of this.activeConstraints) {
      switch (constraint.type) {
        case 'memory':
          summary.memory.constrained = true;
          summary.memory.severity = constraint.severity;
          break;
        case 'cpu':
          summary.cpu.constrained = true;
          summary.cpu.severity = constraint.severity;
          break;
        case 'disk':
          summary.disk.constrained = true;
          summary.disk.severity = constraint.severity;
          break;
        case 'network':
          summary.network.constrained = true;
          summary.network.severity = constraint.severity;
          break;
        case 'file_descriptors':
          summary.fileDescriptors.constrained = true;
          summary.fileDescriptors.severity = constraint.severity;
          break;
      }
    }

    return summary;
  }

  // Transform query results based on active constraints
  transformQueryResult(result: any, queryType: 'systemStats' | 'memoryStats' | 'healthCheck'): any {
    if (this.activeConstraints.size === 0) {
      return result;
    }

    let transformedResult = { ...result };

    for (const [constraintName, constraint] of this.activeConstraints) {
      transformedResult = this.applyConstraintTransformation(
        transformedResult,
        constraintName,
        constraint,
        queryType
      );
    }

    return transformedResult;
  }

  private applyConstraintTransformation(
    result: any,
    constraintName: string,
    constraint: ResourceConstraint,
    _queryType: string
  ): any {
    const transformed = { ...result };

    switch (constraintName) {
      case 'memory-exhaustion':
        return this.applyMemoryExhaustionTransformation(transformed, constraint);

      case 'file-descriptor-exhaustion':
        return this.applyFileDescriptorTransformation(transformed, constraint);

      case 'bandwidth-constraints':
        return this.applyBandwidthConstraintTransformation(transformed, constraint);

      case 'disk-io-bottleneck':
        return this.applyDiskIOTransformation(transformed, constraint);

      case 'swap-pressure':
        return this.applySwapPressureTransformation(transformed, constraint);

      case 'cpu-throttling':
        return this.applyCPUThrottlingTransformation(transformed, constraint);

      case 'network-partition':
        return this.applyNetworkPartitionTransformation(transformed, constraint);

      case 'network-congestion':
        return this.applyNetworkCongestionTransformation(transformed, constraint);

      default:
        return transformed;
    }
  }

  private applyMemoryExhaustionTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    if (transformed.memory) {
      transformed.memory.usagePercentage = constraint.parameters.exhaustionLevel;
      transformed.memory.freeMemory = constraint.parameters.availableMemory;
      transformed.memory.usedMemory = transformed.memory.totalMemory - transformed.memory.freeMemory;

      if (constraint.parameters.exhaustionLevel > 95) {
        transformed.memory.memoryPressure = 'critical';
      }
    }

    if (transformed.heapUsagePercent) {
      transformed.heapUsagePercent = Math.min(constraint.parameters.exhaustionLevel + 5, 100);
    }

    // Add error indication for extreme cases
    if (constraint.parameters.exhaustionLevel > 98) {
      transformed.error = 'memory exhaustion critical';
    }

    return transformed;
  }

  private applyFileDescriptorTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    // Add to health check if available
    if (transformed.database && constraint.parameters.availableFileDescriptors < 10) {
      transformed.database.status = 'unhealthy';
      transformed.database.error = 'EMFILE: too many open files';
    }

    if (transformed.warnings) {
      transformed.warnings.push('file descriptor exhaustion detected');
    } else if (Array.isArray(transformed.warnings)) {
      transformed.warnings = ['file descriptor exhaustion detected'];
    }

    return transformed;
  }

  private applyBandwidthConstraintTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    // Simulate network impact on database connections
    if (transformed.database) {
      const baseResponseTime = transformed.database.responseTime || 50;
      transformed.database.responseTime = baseResponseTime + constraint.parameters.latency;
    }

    // Add network health information
    if (transformed.network) {
      transformed.network.bandwidth = constraint.parameters.bandwidthKbps;
      transformed.network.status = constraint.parameters.bandwidthKbps < 100 ? 'degraded' : 'healthy';
    } else {
      transformed.network = {
        bandwidth: constraint.parameters.bandwidthKbps,
        status: constraint.parameters.bandwidthKbps < 100 ? 'degraded' : 'healthy'
      };
    }

    return transformed;
  }

  private applyDiskIOTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    // Impact database response time
    if (transformed.database) {
      const ioDelay = Math.max(constraint.parameters.readLatency, constraint.parameters.writeLatency);
      transformed.database.responseTime = (transformed.database.responseTime || 50) + ioDelay;

      if (transformed.database.responseTime > 1000) {
        transformed.database.status = 'degraded';
        transformed.database.error = 'disk I/O slow response';
      }
    }

    // Add performance metrics
    if (transformed.performance) {
      transformed.performance.io = {
        bottleneck: true,
        readLatency: constraint.parameters.readLatency,
        writeLatency: constraint.parameters.writeLatency,
        throughput: constraint.parameters.throughput
      };
    }

    return transformed;
  }

  private applySwapPressureTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    if (transformed.memory || result.memoryUsagePercent) {
      if (transformed.memory) {
        transformed.memory.memoryUsagePercent = Math.min(transformed.memory.usagePercentage + 15, 99);
      }

      // Add swap information
      transformed.swap = {
        used: constraint.parameters.swapUsed,
        total: constraint.parameters.swapTotal,
        pressure: constraint.parameters.swapPressure
      };

      if (transformed.warnings) {
        transformed.warnings.push('high swap pressure detected');
      }
    }

    return transformed;
  }

  private applyCPUThrottlingTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    if (transformed.cpuUsage || transformed.cpu) {
      const cpu = transformed.cpuUsage || transformed.cpu;

      // Reduce apparent CPU usage due to throttling
      cpu.percentage = Math.min(cpu.percentage || 0, constraint.parameters.availableCPU);

      if (constraint.parameters.thermalThrottling) {
        cpu.throttled = true;
        cpu.throttleReason = 'thermal';
      }
    }

    return transformed;
  }

  private applyNetworkPartitionTransformation(result: any, _constraint: ResourceConstraint): any {
    const transformed = { ...result };

    // Database connection will fail
    if (transformed.database) {
      transformed.database.connected = false;
      transformed.database.status = 'unhealthy';
      transformed.database.error = 'network partition - unable to connect';
      transformed.database.responseTime = 0;
    }

    // Add network status
    transformed.network = {
      connectivity: false,
      status: 'disconnected',
      error: 'network partition detected'
    };

    return transformed;
  }

  private applyNetworkCongestionTransformation(result: any, constraint: ResourceConstraint): any {
    const transformed = { ...result };

    // Add latency to database connections
    if (transformed.database) {
      transformed.database.responseTime = (transformed.database.responseTime || 50) + constraint.parameters.latency;
    }

    // Add network performance metrics
    transformed.network = {
      ...transformed.network,
      latency: constraint.parameters.latency,
      packetLoss: constraint.parameters.packetLoss,
      jitter: constraint.parameters.jitter,
      status: 'degraded'
    };

    return transformed;
  }
}

export default ResourceConstraintSimulator;