export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export interface SystemStatsValidationResult extends ValidationResult {
  data?: {
    platform: string;
    uptime: number;
    cpuUsage: {
      percentage: number;
      loadAverage: number[];
    };
    memory: {
      totalMemory: number;
      freeMemory: number;
      usedMemory: number;
      usagePercentage: number;
    };
    timestamp: Date;
  };
}

export interface MemoryStatsValidationResult extends ValidationResult {
  data?: {
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    memoryUsagePercent: number;
    heapUsagePercent: number;
    timestamp: Date;
  };
}

export interface HealthCheckValidationResult extends ValidationResult {
  data?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    timestamp: Date;
    database: {
      connected: boolean;
      responseTime: number;
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
    memory: {
      usage: number;
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
    cpu: {
      usage: number;
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
  };
}

export class SystemQueryValidator {
  static validateSystemStats(data: any): SystemStatsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!data) {
      errors.push('System stats data is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Platform validation
    if (typeof data.platform !== 'string' || data.platform.length === 0) {
      errors.push('Invalid platform: must be a non-empty string');
    }

    // Uptime validation with specific field name
    if (typeof data.uptime !== 'number') {
      errors.push('Invalid uptime: must be a number');
    } else if (data.uptime < 0) {
      errors.push('Invalid uptime: must be a non-negative number');
    }

    // CPU usage validation with detailed field checks
    if (!data.cpuUsage) {
      errors.push('Missing cpuUsage field');
    } else {
      // Validate user CPU time
      if (typeof data.cpuUsage.user !== 'number') {
        errors.push('Invalid cpuUsage.user: must be a number');
      } else if (data.cpuUsage.user < 0) {
        errors.push('Invalid cpuUsage.user: negative values not allowed');
      }

      // Validate system CPU time
      if (typeof data.cpuUsage.system !== 'number') {
        errors.push('Invalid cpuUsage.system: must be a number');
      } else if (data.cpuUsage.system < 0) {
        errors.push('Invalid cpuUsage.system: negative values not allowed');
      }

      // Validate CPU percentage
      if (typeof data.cpuUsage.percentage !== 'number') {
        errors.push('Invalid cpuUsage.percentage: must be a number');
      } else if (data.cpuUsage.percentage < 0) {
        errors.push('Invalid cpuUsage.percentage: negative values not allowed');
      } else if (data.cpuUsage.percentage > 100) {
        errors.push('Invalid cpuUsage.percentage: must not exceed 100');
      }

      // Validate load average array
      if (data.loadAverage !== undefined) {
        if (!Array.isArray(data.loadAverage)) {
          errors.push('Invalid loadAverage: must be an array');
        } else if (data.loadAverage.length !== 3) {
          errors.push('Invalid loadAverage: must have exactly 3 elements');
        } else {
          for (let i = 0; i < data.loadAverage.length; i++) {
            const load = data.loadAverage[i];
            if (typeof load !== 'number') {
              errors.push(`Invalid loadAverage[${i}]: must be a number`);
            } else if (load < 0) {
              errors.push(`Invalid loadAverage[${i}]: negative values not allowed`);
            }
          }
        }
      }
    }

    // Memory validation with detailed field checks
    if (!data.memory) {
      errors.push('Missing memory field');
    } else {
      // Validate heapUsed
      if (typeof data.memory.heapUsed !== 'number') {
        errors.push('Invalid memory.heapUsed: must be a number');
      } else if (data.memory.heapUsed < 0) {
        errors.push('Invalid memory.heapUsed: negative values not allowed');
      }

      // Validate heapTotal
      if (typeof data.memory.heapTotal !== 'number') {
        errors.push('Invalid memory.heapTotal: must be a number');
      } else if (data.memory.heapTotal < 0) {
        errors.push('Invalid memory.heapTotal: negative values not allowed');
      }

      // Validate rss
      if (typeof data.memory.rss !== 'number') {
        errors.push('Invalid memory.rss: must be a number');
      } else if (data.memory.rss < 0) {
        errors.push('Invalid memory.rss: negative values not allowed');
      }

      // Validate external
      if (typeof data.memory.external !== 'number') {
        errors.push('Invalid memory.external: must be a number');
      } else if (data.memory.external < 0) {
        errors.push('Invalid memory.external: negative values not allowed');
      }

      // Check heap consistency
      if (data.memory.heapUsed > data.memory.heapTotal) {
        errors.push('Invalid heap: heapUsed > heapTotal not allowed');
      }

      // Check memory consistency
      if (data.memory.totalMemory && data.memory.freeMemory && data.memory.usedMemory) {
        const calculatedUsed = data.memory.totalMemory - data.memory.freeMemory;
        const tolerance = data.memory.totalMemory * 0.05; // 5% tolerance

        if (Math.abs(calculatedUsed - data.memory.usedMemory) > tolerance) {
          warnings.push('Memory values may be inconsistent (used != total - free)');
        }
      }

      if (typeof data.memory.usagePercentage !== 'number' ||
          data.memory.usagePercentage < 0 || data.memory.usagePercentage > 100) {
        errors.push('Invalid memory usage percentage: must be between 0 and 100');
      }
    }

    // Timestamp validation
    if (!(data.timestamp instanceof Date) && typeof data.timestamp !== 'string') {
      errors.push('Invalid timestamp: must be Date or string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? data : undefined
    };
  }

  static validateMemoryStats(data: any): MemoryStatsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data) {
      errors.push('Memory stats data is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Validate memory fields
    const memoryFields = [
      'totalMemory', 'freeMemory', 'usedMemory',
      'heapUsed', 'heapTotal', 'external', 'arrayBuffers'
    ];

    for (const field of memoryFields) {
      if (typeof data[field] !== 'number' || data[field] < 0) {
        errors.push(`Invalid ${field}: must be a non-negative number`);
      }
    }

    // Validate percentages
    const percentageFields = ['memoryUsagePercent', 'heapUsagePercent'];
    for (const field of percentageFields) {
      if (typeof data[field] !== 'number' ||
          data[field] < 0 || data[field] > 100) {
        errors.push(`Invalid ${field}: must be between 0 and 100`);
      }
    }

    // Check heap consistency
    if (data.heapUsed > data.heapTotal) {
      errors.push('Heap used cannot be greater than heap total');
    }

    // Check total memory consistency
    if (data.usedMemory > data.totalMemory) {
      errors.push('Used memory cannot be greater than total memory');
    }

    // Timestamp validation
    if (!(data.timestamp instanceof Date) && typeof data.timestamp !== 'string') {
      errors.push('Invalid timestamp: must be Date or string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? data : undefined
    };
  }

  static validateHealthCheck(data: any): HealthCheckValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data) {
      errors.push('Health check data is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Validate status
    const validStatuses = ['healthy', 'degraded', 'unhealthy'];
    if (!validStatuses.includes(data.status)) {
      errors.push(`Invalid status: must be one of ${validStatuses.join(', ')}`);
    }

    // Validate score
    if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
      errors.push('Invalid score: must be between 0 and 100');
    }

    // Validate database health
    if (!data.database) {
      errors.push('Missing database health information');
    } else {
      if (typeof data.database.connected !== 'boolean') {
        errors.push('Database connected must be boolean');
      }

      if (typeof data.database.responseTime !== 'number' || data.database.responseTime < 0) {
        errors.push('Database response time must be non-negative number');
      }

      if (!validStatuses.includes(data.database.status)) {
        errors.push(`Invalid database status: must be one of ${validStatuses.join(', ')}`);
      }
    }

    // Validate memory health
    if (!data.memory) {
      errors.push('Missing memory health information');
    } else {
      if (typeof data.memory.usage !== 'number' ||
          data.memory.usage < 0 || data.memory.usage > 100) {
        errors.push('Memory usage must be between 0 and 100');
      }

      if (!validStatuses.includes(data.memory.status)) {
        errors.push(`Invalid memory status: must be one of ${validStatuses.join(', ')}`);
      }
    }

    // Validate CPU health
    if (!data.cpu) {
      errors.push('Missing CPU health information');
    } else {
      if (typeof data.cpu.usage !== 'number' ||
          data.cpu.usage < 0 || data.cpu.usage > 100) {
        errors.push('CPU usage must be between 0 and 100');
      }

      if (!validStatuses.includes(data.cpu.status)) {
        errors.push(`Invalid CPU status: must be one of ${validStatuses.join(', ')}`);
      }
    }

    // Timestamp validation
    if (!(data.timestamp instanceof Date) && typeof data.timestamp !== 'string') {
      errors.push('Invalid timestamp: must be Date or string');
    }

    // Cross-validation warnings
    if (data.status === 'healthy' && data.score < 75) {
      warnings.push('Status is healthy but score is below 75');
    }

    if (data.status === 'unhealthy' && data.score > 50) {
      warnings.push('Status is unhealthy but score is above 50');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? data : undefined
    };
  }

  static validateNumericRange(value: any, min: number, max: number, fieldName: string): string[] {
    const errors: string[] = [];

    if (typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
      return errors;
    }

    if (Number.isNaN(value)) {
      errors.push(`${fieldName} cannot be NaN`);
    }

    if (!Number.isFinite(value)) {
      errors.push(`${fieldName} must be finite`);
    }

    if (value < min) {
      errors.push(`${fieldName} must be >= ${min}`);
    }

    if (value > max) {
      errors.push(`${fieldName} must be <= ${max}`);
    }

    return errors;
  }

  static validateTimestamp(timestamp: any): string[] {
    const errors: string[] = [];

    if (!timestamp) {
      errors.push('Timestamp is required');
      return errors;
    }

    let date: Date;

    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      errors.push('Timestamp must be Date or string');
      return errors;
    }

    if (Number.isNaN(date.getTime())) {
      errors.push('Invalid timestamp format');
    }

    // Check if timestamp is reasonable (not too far in past/future)
    const now = Date.now();
    const timestampMs = date.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timestampMs < now - oneHour) {
      errors.push('Timestamp is more than 1 hour in the past');
    }

    if (timestampMs > now + oneHour) {
      errors.push('Timestamp is more than 1 hour in the future');
    }

    return errors;
  }
}

export default SystemQueryValidator;