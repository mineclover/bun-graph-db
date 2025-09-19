/**
 * System Query Execution Contract
 *
 * Defines the interface and behavior contract for system monitoring query
 * execution including input validation, response format, and error handling.
 */

export interface SystemQueryExecutionContract {
  /**
   * Execute systemStats query and return complete system statistics
   * @returns Promise resolving to complete system statistics
   */
  executeSystemStats(): Promise<SystemStats>

  /**
   * Execute memoryStats query and return memory usage information
   * @returns Promise resolving to memory statistics
   */
  executeMemoryStats(): Promise<MemoryStats>

  /**
   * Execute healthCheck query and return system health status
   * @returns Promise resolving to health status
   */
  executeHealthCheck(): Promise<HealthStatus>
}

export interface SystemQueryValidationContract {
  /**
   * Validate systemStats response structure and content
   * @param stats - System statistics to validate
   * @returns Validation result with errors if any
   */
  validateSystemStats(stats: SystemStats): ValidationResult

  /**
   * Validate memoryStats response structure and content
   * @param stats - Memory statistics to validate
   * @returns Validation result with errors if any
   */
  validateMemoryStats(stats: MemoryStats): ValidationResult

  /**
   * Validate healthCheck response structure and content
   * @param status - Health status to validate
   * @returns Validation result with errors if any
   */
  validateHealthStatus(status: HealthStatus): ValidationResult
}

export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean
  /** List of validation error messages */
  errors: string[]
  /** List of validation warning messages */
  warnings: string[]
  /** Validation execution time in milliseconds */
  validationTime: number
}

/**
 * Expected response structure contracts for system queries
 */
export interface SystemStats {
  memory: MemoryStats
  process: ProcessStats
  database: DatabaseStats
  timestamp: Date
  uptime: number
}

export interface MemoryStats {
  used: number
  free: number
  total: number
  percentage: number
  heap: HeapStats
}

export interface HeapStats {
  used: number
  total: number
  external: number
  arrayBuffers: number
}

export interface ProcessStats {
  pid: number
  cpu: number
  version: string
  platform: string
  memoryDetails: ProcessMemoryDetails
}

export interface ProcessMemoryDetails {
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  heapEfficiency: number
  memoryPressure: 'low' | 'medium' | 'high'
}

export interface DatabaseStats {
  connectionCount: number
  queryCount: number
  averageQueryTime: number
}

export interface HealthStatus {
  status: string
  timestamp: Date
  database: boolean
  version: string
  memory: MemoryHealthStatus
}

export interface MemoryHealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  percentage: number
  message?: string
}

/**
 * Behavior contract defining expected system query behavior
 */
export const SystemQueryBehaviorContract = {
  /**
   * Performance requirements for system queries
   */
  performance: {
    /** Maximum execution time for systemStats query */
    maxSystemStatsTime: 200, // milliseconds
    /** Maximum execution time for memoryStats query */
    maxMemoryStatsTime: 200, // milliseconds
    /** Maximum execution time for healthCheck query */
    maxHealthCheckTime: 200, // milliseconds
    /** Maximum time for all queries to complete */
    maxTotalTime: 500, // milliseconds
  },

  /**
   * Data validation requirements
   */
  validation: {
    /** All numeric fields must be finite numbers */
    numericFieldsFinite: true,
    /** Percentage values must be 0-100 range */
    percentagesInRange: true,
    /** Timestamps must be recent (within 5 minutes) */
    timestampsRecent: true,
    /** Memory calculations must be consistent */
    memoryCalculationsConsistent: true,
  },

  /**
   * Error handling requirements
   */
  errorHandling: {
    /** Must handle system API failures gracefully */
    gracefulAPIFailures: true,
    /** Must provide meaningful error messages */
    meaningfulErrors: true,
    /** Must log errors appropriately */
    properLogging: true,
    /** HealthCheck must provide fallback response on error */
    healthCheckFallback: true,
  },

  /**
   * Response consistency requirements
   */
  consistency: {
    /** SystemStats and MemoryStats must return consistent memory data */
    memoryDataConsistent: true,
    /** Health status must reflect current memory usage */
    healthReflectsMemory: true,
    /** Database stats must reflect actual query activity */
    databaseStatsAccurate: true,
    /** Timestamps across queries must be synchronized */
    timestampsSynchronized: true,
  },

  /**
   * Health status threshold requirements
   */
  healthThresholds: {
    /** Memory healthy threshold (< 70%) */
    healthyThreshold: 70,
    /** Memory warning threshold (70-85%) */
    warningThreshold: 85,
    /** Memory critical threshold (≥ 85%) */
    criticalThreshold: 85,
    /** Overall health status calculation accuracy */
    statusCalculationAccurate: true,
  },
} as const

/**
 * Contract for system query test scenarios
 */
export interface SystemQueryTestScenarioContract {
  /**
   * Normal operation test scenarios
   */
  normalScenarios: {
    /** Test with typical system load */
    typicalLoad: TestScenario
    /** Test with minimal system load */
    minimalLoad: TestScenario
    /** Test with no database queries recorded */
    zeroQueries: TestScenario
  }

  /**
   * Edge case test scenarios
   */
  edgeCaseScenarios: {
    /** Test memory usage at health threshold boundaries */
    memoryThresholdBoundaries: TestScenario
    /** Test with very high query counts */
    highQueryCounts: TestScenario
    /** Test with zero/minimal uptime */
    zeroUptime: TestScenario
    /** Test CPU calculation edge cases */
    cpuCalculationEdges: TestScenario
  }

  /**
   * Error condition test scenarios
   */
  errorScenarios: {
    /** Test behavior when system APIs fail */
    systemAPIFailures: TestScenario
    /** Test division by zero protection */
    divisionByZero: TestScenario
    /** Test invalid memory calculation handling */
    invalidMemoryCalculations: TestScenario
    /** Test logger failure scenarios */
    loggerFailures: TestScenario
  }
}

export interface TestScenario {
  /** Unique identifier for the test scenario */
  id: string
  /** Human-readable description */
  description: string
  /** Setup conditions required for the scenario */
  setup: TestSetupConditions
  /** Expected outcomes and validation criteria */
  expectedOutcome: TestExpectedOutcome
  /** Performance requirements for this scenario */
  performanceRequirements: TestPerformanceRequirements
}

export interface TestSetupConditions {
  /** Mock conditions to apply */
  mockConditions?: Record<string, any>
  /** System state requirements */
  systemState?: 'normal' | 'stressed' | 'minimal'
  /** Database state requirements */
  databaseState?: 'empty' | 'populated' | 'high_activity'
}

export interface TestExpectedOutcome {
  /** Whether the query should succeed */
  shouldSucceed: boolean
  /** Expected response structure validation */
  responseValidation: string[]
  /** Expected performance characteristics */
  performanceExpectations: string[]
  /** Expected error conditions (if any) */
  expectedErrors?: string[]
}

export interface TestPerformanceRequirements {
  /** Maximum acceptable execution time */
  maxExecutionTime: number
  /** Maximum acceptable memory usage for test */
  maxMemoryUsage: number
  /** Minimum required accuracy for calculations */
  minCalculationAccuracy: number
}
