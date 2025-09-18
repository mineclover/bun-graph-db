# Research Findings: System Query Testing Framework

## Overview
This document consolidates research findings for implementing comprehensive unit tests for system monitoring queries (systemStats, memoryStats, healthCheck) using file-based SQLite databases with isolated test environments.

## 1. Test Framework Strategy

### Decision: Bun Native Test Framework + File-based SQLite
**Rationale**:
- Existing codebase already uses Bun test framework successfully
- File-based testing provides realistic I/O performance validation
- Better simulation of production SQLite behavior compared to in-memory testing

**Alternatives Considered**:
- In-memory SQLite: Rejected due to user requirement for file-based testing
- Jest/Vitest: Rejected to maintain consistency with existing Bun testing infrastructure
- Mock-based testing: Rejected to ensure real system behavior validation

## 2. SQLite Database Lifecycle Management

### Decision: Unique Temporary Files with Robust Cleanup
**Implementation Pattern**:
```typescript
const createTestDatabasePath = (prefix = 'system-query') => {
  const uniqueId = randomUUID()
  return join(tmpdir(), `${prefix}-${uniqueId}.sqlite`)
}

class TestDatabaseManager {
  static create(): { path: string; cleanup: () => Promise<void> }
  static cleanupAll(): Promise<void>
}
```

**Rationale**:
- UUID-based naming prevents parallel test conflicts
- Centralized cleanup manager handles test failures gracefully
- Process exit handlers ensure no orphaned test files
- WAL mode optimization for better concurrent performance

**Alternatives Considered**:
- Process ID-based naming: Less collision-resistant than UUID
- Manual cleanup only: Risk of orphaned files on test failures
- Shared test database: Would violate test isolation requirements

## 3. System Query Testing Scope

### Decision: Comprehensive Parameter Coverage Testing
**Test Categories**:
1. **SystemQueries Class Methods** (3 methods, no parameters)
2. **SystemMonitoringUseCase Integration** (4 methods with state tracking)
3. **Error Handling Scenarios** (Exception cases, fallback responses)
4. **Edge Case Validation** (Boundary values, calculation errors)

**Rationale**:
- SystemQueries methods accept no parameters but have complex internal logic
- Real testing value comes from validating complete data structures and thresholds
- Error scenarios are critical for production reliability
- Edge cases reveal calculation vulnerabilities in current implementation

**Alternatives Considered**:
- Parameter-focused testing: Not applicable - methods accept no parameters
- Mock-heavy testing: Would miss real system integration issues
- GraphQL-only testing: Would miss direct method invocation edge cases

## 4. Test Database Schema and State Management

### Decision: Clean Schema + State Reset Pattern
**Implementation Approach**:
```typescript
beforeAll(): Create database + initialize schema
beforeEach(): Reset database state (clear data, keep schema)
afterEach(): Validate cleanup
afterAll(): Remove database file
```

**Rationale**:
- Each test gets clean state without schema recreation overhead
- File-based testing allows realistic performance measurement
- Schema persistence reduces setup time between tests
- State reset ensures test isolation without full database recreation

**Alternatives Considered**:
- Full database recreation per test: Too slow for comprehensive test suite
- Shared state between tests: Violates test isolation principles
- Transaction rollback: More complex and unnecessary for system query testing

## 5. System Query Edge Cases and Error Scenarios

### Decision: Boundary Condition and Error Resilience Testing
**Critical Test Scenarios Identified**:

#### Memory Statistics Edge Cases:
- **Threshold boundaries**: Exactly 70%, 85% memory usage for health status transitions
- **Division by zero protection**: `heapTotal = 0` in heap efficiency calculations
- **Memory pressure transitions**: 60% → 80% → 85%+ boundary testing
- **Negative memory calculations**: When `usedMemory > totalMemory`

#### Process Statistics Edge Cases:
- **CPU calculation overflow**: Long uptime causing microsecond overflow
- **Zero uptime handling**: Process just started scenarios
- **Platform variations**: Different OS platform behaviors (darwin, linux, win32)

#### Database Statistics Edge Cases:
- **Zero query scenarios**: Fresh system with no recorded queries
- **Query counter overflow**: After millions of queries (precision testing)
- **Race conditions**: Concurrent query recording and stat retrieval

#### Health Check Boundary Conditions:
- **Health status oscillation**: Memory usage fluctuating around thresholds
- **Error fallback behavior**: Exception handling with proper ERROR status response

**Rationale**:
- Current implementation has identified vulnerabilities in edge case handling
- Production systems will encounter these scenarios regularly
- Robust error handling is critical for system monitoring reliability

**Alternatives Considered**:
- Happy path testing only: Insufficient for production reliability
- Mock-based edge case simulation: Less realistic than actual boundary testing
- Manual edge case testing: Not sustainable for comprehensive coverage

## 6. Performance and Testing Infrastructure

### Decision: Realistic Performance Testing with Optimization
**Performance Targets**:
- System query execution: <200ms
- Test database setup/teardown: <100ms
- Overall test suite: <30 seconds for full coverage

**Optimization Strategies**:
```sql
PRAGMA journal_mode = WAL;     -- Better concurrent performance
PRAGMA synchronous = NORMAL;   -- Faster than FULL for testing
PRAGMA temp_store = MEMORY;    -- Keep temp data in memory
PRAGMA mmap_size = 268435456;  -- 256MB memory-mapped I/O
```

**Rationale**:
- File-based testing provides realistic I/O performance validation
- SQLite optimizations reduce test execution time without sacrificing realism
- Performance targets align with user expectations for system monitoring queries

**Alternatives Considered**:
- In-memory testing: User specifically requested file-based approach
- No performance optimization: Would result in slow test execution
- Unrealistic performance targets: <50ms targets would require in-memory testing

## 7. Test Environment and Dependencies

### Decision: Minimal Mocking with Real Dependencies
**Dependency Strategy**:
- **Real SQLite databases**: File-based with actual I/O
- **Real system APIs**: `process.memoryUsage()`, `process.cpuUsage()`
- **Mock Logger**: Controllable logging for test validation
- **Real SystemMonitoringUseCase**: Integration testing of business logic

**Rationale**:
- System monitoring requires real system interaction for accurate testing
- File-based SQLite testing provides realistic database behavior
- Minimal mocking reduces test brittleness and improves confidence
- Real dependencies catch integration issues that mocks would miss

**Alternatives Considered**:
- Heavy mocking: Would miss system integration edge cases
- No mocking: Logger output would interfere with test output
- Container-based testing: Overkill for unit-level system query testing

## 8. Implementation Structure

### Decision: Modular Test Organization with Shared Utilities
**Directory Structure**:
```
tests/system-queries/
├── fixtures/
│   ├── test-database-setup.ts      # Database lifecycle utilities
│   └── system-monitoring-mocks.ts  # Logger and edge case mocks
├── system-stats.test.ts            # systemStats comprehensive testing
├── memory-stats.test.ts            # memoryStats comprehensive testing
└── health-check.test.ts            # healthCheck comprehensive testing
```

**Rationale**:
- Separate test files for each system query enable parallel execution
- Shared fixtures reduce code duplication and ensure consistency
- Modular structure makes it easy to run individual test suites
- Clear separation between utilities and tests improves maintainability

**Alternatives Considered**:
- Single test file: Would be too large and prevent parallel execution
- No shared utilities: Would lead to code duplication and inconsistency
- Complex test hierarchy: Overkill for the focused scope of system query testing

## Next Phase Requirements

All research areas have been resolved:
- ✅ **Bun test framework patterns**: Setup/teardown hooks and async testing
- ✅ **SQLite lifecycle management**: Unique file creation and robust cleanup
- ✅ **System query analysis**: Complete method coverage and return types
- ✅ **Edge case identification**: Boundary conditions and error scenarios
- ✅ **Performance considerations**: File-based testing with optimization
- ✅ **Test environment strategy**: Minimal mocking with real dependencies

**Ready for Phase 1**: Design and contracts development with comprehensive test case specifications.