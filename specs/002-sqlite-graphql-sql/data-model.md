# Data Model: System Query Testing Framework

## Overview
This document defines the data entities and relationships for the System Query Testing Framework, focusing on test infrastructure entities and validation of existing system monitoring entities.

## Test Infrastructure Entities

### TestDatabase
Manages the lifecycle of isolated SQLite test databases.

**Properties**:
- `path: string` - Unique file path for the test database
- `id: string` - Unique identifier (UUID) for the test instance
- `createdAt: Date` - Database creation timestamp
- `isActive: boolean` - Whether database connection is active
- `pragmaSettings: PragmaConfig` - SQLite optimization settings

**Methods**:
- `create()` - Initialize database with schema
- `reset()` - Clear data while preserving schema
- `cleanup()` - Close connection and remove file
- `validate()` - Verify database integrity

**Relationships**:
- One-to-many with `SystemQueryTestCase`

### SystemQueryTestCase
Represents an individual test scenario for system monitoring queries.

**Properties**:
- `id: string` - Unique test case identifier
- `queryType: 'systemStats' | 'memoryStats' | 'healthCheck'` - Target system query
- `scenario: string` - Test scenario description
- `expectedBehavior: string` - Expected outcome description
- `testCategory: 'normal' | 'edge' | 'error'` - Test classification
- `mockConditions?: MockCondition[]` - System state simulation conditions

**Methods**:
- `execute()` - Run the test case
- `validate()` - Check test results against expectations
- `setup()` - Prepare test environment
- `teardown()` - Clean up test state

### MockCondition
Defines simulated system conditions for edge case testing.

**Properties**:
- `type: 'memory' | 'cpu' | 'query' | 'error'` - Condition category
- `parameter: string` - Specific parameter to mock
- `value: any` - Mock value or behavior
- `description: string` - Human-readable condition description

### TestResults
Captures test execution results and validation outcomes.

**Properties**:
- `testCaseId: string` - Reference to executed test case
- `executionTime: number` - Test execution duration (ms)
- `success: boolean` - Whether test passed
- `actualResult: any` - Actual system query response
- `expectedResult: any` - Expected system query response
- `validationErrors: string[]` - List of validation failures
- `performanceMetrics: PerformanceMetrics` - Performance measurements

### PerformanceMetrics
Performance measurements for system query testing.

**Properties**:
- `queryExecutionTime: number` - System query execution time (ms)
- `databaseSetupTime: number` - Test database setup time (ms)
- `memoryUsage: number` - Test memory consumption (MB)
- `cpuUsage: number` - Test CPU utilization (%)

## Existing System Monitoring Entities

### SystemStats
Complete system statistics returned by `systemStats` query.

**Properties**:
- `memory: MemoryStats` - Memory usage information
- `process: ProcessStats` - Process-specific statistics
- `database: DatabaseStats` - Database performance metrics
- `timestamp: Date` - Statistics collection timestamp
- `uptime: number` - System uptime in seconds

**Validation Rules**:
- All numeric fields must be non-negative
- Timestamp must be recent (within last 5 minutes for testing)
- Uptime must be positive
- Memory percentage must be 0-100

### MemoryStats
Memory usage statistics with heap information.

**Properties**:
- `used: number` - Used memory in MB
- `free: number` - Free memory in MB
- `total: number` - Total memory in MB
- `percentage: number` - Memory usage percentage (0-100)
- `heap: HeapStats` - Heap-specific memory information

**Validation Rules**:
- `used + free ≈ total` (within 5% tolerance for system overhead)
- `percentage = (used / total) * 100` (within 0.1% accuracy)
- All memory values must be positive
- Heap statistics must be consistent with process memory

### HeapStats
Heap-specific memory statistics.

**Properties**:
- `used: number` - Used heap memory in MB
- `total: number` - Total allocated heap in MB
- `external: number` - External C++ objects memory in MB
- `arrayBuffers: number` - ArrayBuffer memory in MB

**Validation Rules**:
- `used ≤ total`
- All values must be non-negative
- External + arrayBuffers should be reasonable relative to total

### ProcessStats
Process-specific system information.

**Properties**:
- `pid: number` - Process ID
- `cpu: number` - CPU usage percentage
- `version: string` - Runtime version
- `platform: string` - Operating system platform
- `memoryDetails: ProcessMemoryDetails` - Detailed memory breakdown

**Validation Rules**:
- PID must be positive integer
- CPU percentage typically 0-100 (can exceed on multi-core)
- Version must match expected format
- Platform must be valid OS identifier

### ProcessMemoryDetails
Detailed process memory information.

**Properties**:
- `rss: number` - Resident Set Size in MB
- `heapUsed: number` - Used heap memory in MB
- `heapTotal: number` - Total allocated heap in MB
- `external: number` - External C++ objects memory in MB
- `arrayBuffers: number` - ArrayBuffer memory in MB
- `heapEfficiency: number` - Heap efficiency percentage (0-100)
- `memoryPressure: 'low' | 'medium' | 'high'` - Memory pressure level

**Validation Rules**:
- All memory values must be non-negative
- `heapUsed ≤ heapTotal`
- `heapEfficiency = (heapUsed / heapTotal) * 100` when `heapTotal > 0`
- Memory pressure categories align with system thresholds

### DatabaseStats
Database performance and connection information.

**Properties**:
- `connectionCount: number` - Active database connections (always 1 for SQLite)
- `queryCount: number` - Total executed queries
- `averageQueryTime: number` - Average query execution time

**Validation Rules**:
- Connection count must equal 1 for SQLite
- Query count must be non-negative
- Average query time must be non-negative
- `averageQueryTime = totalQueryTime / queryCount` when `queryCount > 0`

### HealthStatus
Overall system health assessment.

**Properties**:
- `status: string` - Overall health status ('OK', 'UNHEALTHY', 'ERROR')
- `timestamp: Date` - Health check timestamp
- `database: boolean` - Database connectivity status
- `version: string` - System version ('1.0.0')
- `memory: MemoryHealthStatus` - Memory-specific health information

**Validation Rules**:
- Status must be one of defined values
- Timestamp must be recent
- Database must be true in normal operation
- Version must match expected constant

### MemoryHealthStatus
Memory-specific health status information.

**Properties**:
- `status: 'healthy' | 'warning' | 'critical'` - Memory health classification
- `percentage: number` - Memory usage percentage
- `message?: string` - Optional health status message

**Validation Rules**:
- Status thresholds: healthy (<70%), warning (70-85%), critical (≥85%)
- Percentage must match system memory percentage
- Message must be present for warning/critical status

## Entity Relationships

```
TestDatabase (1) ──→ (n) SystemQueryTestCase
SystemQueryTestCase (1) ──→ (1) TestResults
SystemQueryTestCase (1) ──→ (n) MockCondition
TestResults (1) ──→ (1) PerformanceMetrics

SystemStats (1) ──→ (1) MemoryStats
SystemStats (1) ──→ (1) ProcessStats
SystemStats (1) ──→ (1) DatabaseStats
ProcessStats (1) ──→ (1) ProcessMemoryDetails
HealthStatus (1) ──→ (1) MemoryHealthStatus
```

## State Transitions

### TestDatabase Lifecycle
```
Created → Active → Reset → Active → ... → Cleanup → Destroyed
```

### SystemQueryTestCase Execution
```
Initialized → Setup → Executing → Validating → Completed
                                           → Failed
```

### HealthStatus Transitions
```
healthy → warning → critical
   ↑         ↑         ↑
   └─────────┴─────────┘
   (based on memory percentage changes)
```

## Data Integrity Constraints

### Cross-Entity Validation
- SystemStats entities must have consistent timestamps within 100ms
- Memory values across MemoryStats and ProcessMemoryDetails must be correlated
- Health status must reflect current memory usage accurately
- Test database paths must be unique across concurrent tests
- Test case IDs must be unique within test suite execution