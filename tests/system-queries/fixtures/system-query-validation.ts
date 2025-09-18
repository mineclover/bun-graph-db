/**
 * System Query Validation Implementation
 *
 * Implementation of SystemQueryValidationContract for testing system query responses.
 * Provides comprehensive validation for systemStats, memoryStats, and healthCheck responses.
 */

import type {
  SystemQueryValidationContract,
  ValidationResult,
  SystemStats,
  MemoryStats,
  HealthStatus
} from '../../../specs/003-specs-002-sqlite/contracts/system-query-contract.js';

export class SystemQueryValidator implements SystemQueryValidationContract {
  validateSystemStats(stats: SystemStats): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!stats) {
      return {
        isValid: false,
        errors: ['Input cannot be null or undefined'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    // Validate memory structure
    if (!stats.memory) {
      errors.push('Missing memory field');
    } else {
      if (typeof stats.memory.used !== 'number' || stats.memory.used < 0) {
        errors.push('memory.used must be a non-negative number');
      }
      if (typeof stats.memory.free !== 'number' || stats.memory.free < 0) {
        errors.push('memory.free must be a non-negative number');
      }
      if (typeof stats.memory.total !== 'number' || stats.memory.total <= 0) {
        errors.push('memory.total must be a positive number');
      }
      if (typeof stats.memory.percentage !== 'number' || stats.memory.percentage < 0 || stats.memory.percentage > 100) {
        errors.push('memory.percentage must be between 0-100');
      }

      // Check memory calculation consistency
      if (stats.memory.used && stats.memory.free && stats.memory.total) {
        const calculatedTotal = stats.memory.used + stats.memory.free;
        if (Math.abs(calculatedTotal - stats.memory.total) > stats.memory.total * 0.05) {
          errors.push('Memory calculation inconsistent: used + free should equal total');
        }
      }

      // Validate heap structure
      if (!stats.memory.heap) {
        errors.push('Missing memory.heap field');
      } else {
        if (typeof stats.memory.heap.used !== 'number' || stats.memory.heap.used < 0) {
          errors.push('memory.heap.used must be a non-negative number');
        }
        if (typeof stats.memory.heap.total !== 'number' || stats.memory.heap.total <= 0) {
          errors.push('memory.heap.total must be a positive number');
        }
        if (stats.memory.heap.used > stats.memory.heap.total) {
          errors.push('memory.heap.used cannot exceed memory.heap.total');
        }
      }
    }

    // Validate process structure
    if (!stats.process) {
      errors.push('Missing process field');
    } else {
      if (typeof stats.process.pid !== 'number' || stats.process.pid <= 0) {
        errors.push('process.pid must be a positive number');
      }
      if (typeof stats.process.cpu !== 'number' || stats.process.cpu < 0) {
        errors.push('process.cpu must be a non-negative number');
      }
      if (typeof stats.process.version !== 'string' || stats.process.version.length === 0) {
        errors.push('process.version must be a non-empty string');
      }
      if (typeof stats.process.platform !== 'string' || stats.process.platform.length === 0) {
        errors.push('process.platform must be a non-empty string');
      }

      // Validate memory details
      if (!stats.process.memoryDetails) {
        errors.push('Missing process.memoryDetails field');
      } else {
        const memoryFields = ['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers'];
        for (const field of memoryFields) {
          if (typeof (stats.process.memoryDetails as any)[field] !== 'number' || (stats.process.memoryDetails as any)[field] < 0) {
            errors.push(`process.memoryDetails.${field} must be a non-negative number`);
          }
        }

        if (typeof stats.process.memoryDetails.heapEfficiency !== 'number' ||
            stats.process.memoryDetails.heapEfficiency < 0 ||
            stats.process.memoryDetails.heapEfficiency > 1) {
          errors.push('process.memoryDetails.heapEfficiency must be between 0-1');
        }

        const validPressureValues = ['low', 'medium', 'high'];
        if (!validPressureValues.includes(stats.process.memoryDetails.memoryPressure)) {
          errors.push('process.memoryDetails.memoryPressure must be low, medium, or high');
        }
      }
    }

    // Validate database structure
    if (!stats.database) {
      errors.push('Missing database field');
    } else {
      if (typeof stats.database.connectionCount !== 'number' || stats.database.connectionCount < 0) {
        errors.push('database.connectionCount must be a non-negative number');
      }
      if (typeof stats.database.queryCount !== 'number' || stats.database.queryCount < 0) {
        errors.push('database.queryCount must be a non-negative number');
      }
      if (typeof stats.database.averageQueryTime !== 'number' || stats.database.averageQueryTime < 0) {
        errors.push('database.averageQueryTime must be a non-negative number');
      }
    }

    // Validate timestamp
    if (!stats.timestamp) {
      errors.push('Missing timestamp field');
    } else if (!(stats.timestamp instanceof Date)) {
      errors.push('timestamp must be a Date object');
    } else {
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - stats.timestamp.getTime());
      const fiveMinutes = 5 * 60 * 1000;
      if (timeDiff > fiveMinutes) {
        errors.push('timestamp must be within 5 minutes of current time');
      }
    }

    // Validate uptime
    if (typeof stats.uptime !== 'number' || stats.uptime < 0) {
      errors.push('uptime must be a non-negative number');
    }

    // Warning checks
    if (stats.memory && stats.memory.percentage > 90) {
      warnings.push('High memory usage detected (>90%)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }

  validateMemoryStats(stats: MemoryStats): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!stats) {
      return {
        isValid: false,
        errors: ['Input cannot be null or undefined'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    // Validate numeric fields
    const numericFields = ['used', 'free', 'total', 'percentage'];
    for (const field of numericFields) {
      const value = (stats as any)[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${field} must be a finite number`);
      } else if (value < 0) {
        errors.push(`${field} must be non-negative`);
      }
    }

    // Validate percentage range
    if (typeof stats.percentage === 'number' && (stats.percentage < 0 || stats.percentage > 100)) {
      errors.push('percentage must be between 0-100');
    }

    // Validate heap structure
    if (!stats.heap) {
      errors.push('Missing heap field');
    } else {
      const heapFields = ['used', 'total', 'external', 'arrayBuffers'];
      for (const field of heapFields) {
        const value = (stats.heap as any)[field];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          errors.push(`heap.${field} must be a non-negative finite number`);
        }
      }

      if (stats.heap.used > stats.heap.total) {
        errors.push('heap.used cannot exceed heap.total');
      }
    }

    // Consistency checks
    if (stats.used && stats.free && stats.total) {
      const calculatedTotal = stats.used + stats.free;
      if (Math.abs(calculatedTotal - stats.total) > stats.total * 0.01) {
        errors.push('used + free should equal total within 1% tolerance');
      }
    }

    if (stats.used && stats.total && stats.percentage) {
      const calculatedPercentage = (stats.used / stats.total) * 100;
      if (Math.abs(calculatedPercentage - stats.percentage) > 0.1) {
        errors.push('percentage calculation must match (used/total)*100');
      }
    }

    // Warning checks
    if (stats.percentage > 90) {
      warnings.push('low free memory detected');
    }
    if (stats.percentage > 95) {
      warnings.push('high memory usage detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }

  validateHealthStatus(status: HealthStatus): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!status) {
      return {
        isValid: false,
        errors: ['Input cannot be null or undefined'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    // Validate status
    const validStatuses = ['healthy', 'warning', 'critical'];
    if (!validStatuses.includes(status.status)) {
      errors.push(`status must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate percentage
    if (typeof status.percentage !== 'number' || status.percentage < 0 || status.percentage > 100) {
      errors.push('percentage must be between 0-100');
    }

    // Validate timestamp
    if (!status.timestamp) {
      errors.push('Missing timestamp field');
    } else if (!(status.timestamp instanceof Date)) {
      errors.push('timestamp must be a Date object');
    } else {
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - status.timestamp.getTime());
      const fiveMinutes = 5 * 60 * 1000;
      if (timeDiff > fiveMinutes) {
        errors.push('timestamp must be within 5 minutes of current time');
      }
    }

    // Validate database field
    if (typeof status.database !== 'boolean') {
      errors.push('database field must be boolean');
    }

    // Validate version
    if (typeof status.version !== 'string' || status.version.length === 0) {
      errors.push('version must be a non-empty string');
    }

    // Validate memory status
    if (!status.memory) {
      errors.push('Missing memory field');
    } else {
      if (!validStatuses.includes(status.memory.status)) {
        errors.push(`memory.status must be one of: ${validStatuses.join(', ')}`);
      }
      if (typeof status.memory.percentage !== 'number' ||
          status.memory.percentage < 0 ||
          status.memory.percentage > 100) {
        errors.push('memory.percentage must be between 0-100');
      }
    }

    // Consistency checks
    if (status.status === 'healthy' && status.percentage < 70) {
      errors.push('overall status healthy is inconsistent with low percentage');
    }
    if (status.status === 'critical' && status.percentage > 85) {
      errors.push('overall status critical is inconsistent with high percentage');
    }

    if (status.memory && status.memory.status === 'critical' && status.status === 'healthy') {
      errors.push('overall status inconsistent with memory status');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }

  // Additional validation methods for comprehensive testing
  validateResponseStructure(response: any, expectedStructure: Record<string, string>): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response) {
      return {
        isValid: false,
        errors: ['Response cannot be null or undefined'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    for (const [field, expectedType] of Object.entries(expectedStructure)) {
      if (!(field in response)) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }

      const actualType = expectedType === 'object' && response[field] instanceof Date ? 'object' : typeof response[field];
      if (actualType !== expectedType) {
        errors.push(`Field ${field} expected ${expectedType} but got ${actualType}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }

  validatePerformanceMetrics(metrics: any): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metrics) {
      return {
        isValid: false,
        errors: ['Metrics cannot be null or undefined'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    if (typeof metrics.executionTime !== 'number' || metrics.executionTime < 0) {
      errors.push('executionTime must be a non-negative number');
    } else if (metrics.executionTime > 200) {
      errors.push('execution time exceeds 200ms threshold');
    }

    if (typeof metrics.memoryUsage !== 'number' || metrics.memoryUsage < 0) {
      errors.push('memoryUsage must be a non-negative number');
    }

    if (typeof metrics.cpuUsage !== 'number' || metrics.cpuUsage < 0 || metrics.cpuUsage > 100) {
      errors.push('cpuUsage must be between 0-100');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }

  validateDataConsistency(data: any[]): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(data) || data.length === 0) {
      return {
        isValid: false,
        errors: ['Data must be a non-empty array'],
        warnings: [],
        validationTime: performance.now() - startTime
      };
    }

    // Look for memory data consistency across different query types
    const systemStatsData = data.find(d => d.type === 'systemStats');
    const memoryStatsData = data.find(d => d.type === 'memoryStats');

    if (systemStatsData && memoryStatsData) {
      const systemMemory = systemStatsData.memory;
      const memoryStats = memoryStatsData;

      if (systemMemory && typeof systemMemory.heapUsed === 'number' &&
          typeof memoryStats.heapUsed === 'number') {
        if (Math.abs(systemMemory.heapUsed - memoryStats.heapUsed) > 1000000) { // 1MB tolerance
          errors.push('memory data inconsistent between systemStats and memoryStats');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: performance.now() - startTime
    };
  }
}

export default SystemQueryValidator;