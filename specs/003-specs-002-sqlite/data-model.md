# Data Model: System Query Testing Framework

## Overview
This document defines the data entities and relationships for comprehensive testing of system monitoring queries, focusing on test infrastructure, validation patterns, and performance metrics.

## Core Test Infrastructure Entities

### TestDatabase
Manages isolated SQLite database instances for testing.

**Properties**:
- `id: string` - Unique identifier (UUID)
- `path: string` - File system path to SQLite database
- `createdAt: Date` - Creation timestamp
- `isActive: boolean` - Connection status
- `config: TestDatabaseConfig` - Database configuration settings

**Relationships**:
- One-to-many with `TestCase`
- One-to-many with `TestResults`

### TestCase
Individual test scenario for system queries.

**Properties**:
- `id: string` - Unique test identifier
- `name: string` - Test name/description
- `category: TestCategory` - Test classification
- `queryType: SystemQueryType` - Target query type
- `scenario: string` - Test scenario description
- `expectedOutcome: ExpectedOutcome` - Expected results
- `mockConditions: MockCondition[]` - Simulated conditions

**Types**:
- `TestCategory`: 'contract' | 'integration' | 'edge_case' | 'error' | 'performance'
- `SystemQueryType`: 'systemStats' | 'memoryStats' | 'healthCheck'

### MockCondition
Simulated system states for testing.

**Properties**:
- `type: ConditionType` - Condition category
- `target: string` - System component to mock
- `value: any` - Mock value or behavior
- `duration?: number` - Duration for time-based conditions

**Types**:
- `ConditionType`: 'memory_pressure' | 'cpu_spike' | 'db_error' | 'api_failure' | 'logger_failure'

### TestResults
Execution results and validations.

**Properties**:
- `id: string` - Result identifier
- `testCaseId: string` - Associated test case
- `executionTime: number` - Total execution time (ms)
- `passed: boolean` - Test pass/fail status
- `actualResult: any` - Actual query response
- `expectedResult: any` - Expected query response
- `validationErrors: ValidationError[]` - Validation failures
- `performanceMetrics: PerformanceMetrics` - Performance data

### PerformanceMetrics
Performance measurements for test execution.

**Properties**:
- `queryExecutionTime: number` - Query execution duration (ms)
- `dbSetupTime: number` - Database initialization time (ms)
- `dbTeardownTime: number` - Database cleanup time (ms)
- `memoryBefore: number` - Memory usage before test (MB)
- `memoryAfter: number` - Memory usage after test (MB)
- `memoryPeak: number` - Peak memory usage (MB)

### ValidationError
Test validation failure details.

**Properties**:
- `field: string` - Field that failed validation
- `expected: any` - Expected value
- `actual: any` - Actual value
- `message: string` - Error description

## System Query Result Entities

### SystemStats
Complete system statistics response.

**Properties**:
- `timestamp: number` - Query execution timestamp
- `uptime: number` - System uptime (seconds)
- `memory: MemoryInfo` - Memory statistics
- `process: ProcessInfo` - Process statistics
- `database: DatabaseInfo` - Database statistics

### MemoryInfo
Memory usage statistics.

**Properties**:
- `heapUsed: number` - Heap memory used (bytes)
- `heapTotal: number` - Total heap size (bytes)
- `external: number` - External memory (bytes)
- `rss: number` - Resident set size (bytes)
- `arrayBuffers: number` - Array buffer memory (bytes)
- `percentage: number` - Memory usage percentage (0-100)

### ProcessInfo
Process-level statistics.

**Properties**:
- `pid: number` - Process ID
- `cpuUsage: CPUUsage` - CPU utilization
- `resourceUsage: ResourceUsage` - Resource consumption

### DatabaseInfo
Database performance metrics.

**Properties**:
- `tables: number` - Number of tables
- `nodes: number` - Total node count
- `relations: number` - Total relation count
- `queries: QueryStats` - Query execution statistics
- `size: number` - Database file size (bytes)

### HealthStatus
System health check response.

**Properties**:
- `status: 'healthy' | 'degraded' | 'unhealthy'` - Overall health
- `components: ComponentHealth[]` - Individual component status
- `checks: HealthCheck[]` - Health check results
- `timestamp: number` - Check execution timestamp

### ComponentHealth
Individual component health status.

**Properties**:
- `name: string` - Component name
- `status: 'healthy' | 'degraded' | 'unhealthy'` - Component status
- `message?: string` - Status description
- `metrics?: any` - Component-specific metrics

## Test Management Entities

### TestDatabaseManager
Singleton manager for test database lifecycle.

**Properties**:
- `activeDatabases: Map<string, TestDatabase>` - Active test databases
- `cleanupQueue: string[]` - Databases pending cleanup

**Methods**:
- `create()` - Create new test database
- `cleanup(id)` - Clean up specific database
- `cleanupAll()` - Clean up all databases
- `registerExitHandlers()` - Register process exit cleanup

### TestRunner
Orchestrates test execution.

**Properties**:
- `testCases: TestCase[]` - Test cases to execute
- `results: TestResults[]` - Execution results
- `config: TestRunnerConfig` - Runner configuration

**Methods**:
- `run()` - Execute all test cases
- `runParallel()` - Execute tests in parallel
- `generateReport()` - Create test report

## Validation Rules

### Performance Requirements
- Query execution: <200ms
- Database setup: <100ms
- Database teardown: <50ms
- Memory leak threshold: <5MB difference

### Data Integrity
- All numeric values must be non-negative
- Percentages must be 0-100
- Timestamps must be within test execution window
- UUIDs must be valid v4 format

### Test Isolation
- Each test must use unique database file
- No shared state between tests
- Complete cleanup after each test
- Parallel execution safety

## Entity Relationships

```
TestDatabaseManager (1) ─── (*) TestDatabase
TestDatabase (1) ─── (*) TestCase
TestCase (1) ─── (*) TestResults
TestCase (1) ─── (*) MockCondition
TestResults (1) ─── (1) PerformanceMetrics
TestResults (1) ─── (*) ValidationError
```

## State Transitions

### TestCase Lifecycle
```
Created → Setup → Executing → Validating → Complete → Cleanup
```

### TestDatabase Lifecycle
```
Created → Connected → Active → Closing → Cleaned
```

### Health Status Transitions
```
healthy ⟷ degraded ⟷ unhealthy
```