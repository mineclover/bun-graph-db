# Quickstart: System Query Testing Framework

## Overview
Quick guide to validate the System Query Testing Framework implementation with TDD principles and performance requirements.

## Prerequisites
- Bun runtime installed (v1.0+)
- SQLite support enabled
- Project dependencies installed (`bun install`)

## Quick Validation Steps

### 1. Verify Test Structure
```bash
# Check test directories exist
ls -la tests/system-queries/
ls -la tests/system-queries/fixtures/
ls -la tests/temp-dbs/
```

### 2. Run Contract Tests (Must Fail First)
```bash
# These should FAIL initially (RED phase of TDD)
bun test tests/system-queries/fixtures/test-database-contract.test.ts
bun test tests/system-queries/fixtures/system-query-contract.test.ts
bun test tests/system-queries/fixtures/system-query-validation.test.ts
```

### 3. Run Integration Tests (Must Fail First)
```bash
# These should also FAIL initially
bun test tests/system-queries/system-stats-integration.test.ts
bun test tests/system-queries/memory-stats-integration.test.ts
bun test tests/system-queries/health-check-integration.test.ts
```

### 4. Implement Test Infrastructure
After tests are failing properly, implement the infrastructure:

```bash
# Now tests should start passing (GREEN phase)
bun test tests/system-queries/fixtures/
```

### 5. Run Complete Test Suite
```bash
# Execute all system query tests
bun test tests/system-queries/

# With coverage reporting
bun test --coverage tests/system-queries/
```

### 6. Validate Performance Requirements
```bash
# Check execution times meet requirements
bun test tests/system-queries/ --reporter=verbose | grep "execution time"

# Performance requirements:
# - Query execution: <200ms
# - Database setup: <100ms
```

### 7. Run Parallel Tests
```bash
# Test parallel execution safety
bun test tests/system-queries/fixtures/test-database-contract.test.ts &
bun test tests/system-queries/fixtures/system-query-contract.test.ts &
bun test tests/system-queries/fixtures/system-query-validation.test.ts &
wait
```

### 8. Validate Edge Cases
```bash
# Run edge case tests
bun test tests/system-queries/memory-threshold-boundaries.test.ts
bun test tests/system-queries/cpu-calculation-edges.test.ts
bun test tests/system-queries/database-stats-edges.test.ts
```

### 9. Check Error Handling
```bash
# Run error scenario tests
bun test tests/system-queries/system-api-errors.test.ts
bun test tests/system-queries/division-by-zero.test.ts
bun test tests/system-queries/logger-failure.test.ts
```

### 10. Verify Cleanup
```bash
# Check no orphaned test databases
ls -la tests/temp-dbs/ | wc -l
# Should show only directory entries (. and ..)
```

## Success Criteria

✅ **TDD Compliance**:
- All tests fail before implementation
- Git history shows test commits before implementation
- Tests have clear, meaningful failure messages

✅ **Performance**:
- System query execution <200ms
- Database setup <100ms
- No memory leaks detected

✅ **Coverage**:
- 100% coverage of SystemQueries class methods
- All edge cases have corresponding tests
- All error scenarios tested

✅ **Isolation**:
- Tests run successfully in parallel
- No shared state between tests
- Complete cleanup after test execution

## Troubleshooting

### Tests Not Failing Initially
```bash
# Verify no implementation exists
ls -la tests/system-queries/fixtures/*.ts | grep -v test
# Should show no non-test files
```

### Performance Issues
```bash
# Run performance validation
bun test tests/system-queries/fixtures/performance-metrics.test.ts

# Check SQLite optimizations
grep -r "PRAGMA" tests/system-queries/
```

### Cleanup Issues
```bash
# Force cleanup of test databases
rm -f tests/temp-dbs/*.sqlite
```

### Debug Mode
```bash
# Run with debug output
DEBUG=1 bun test tests/system-queries/system-stats.test.ts --verbose
```

## Next Steps

After successful validation:
1. Review test coverage report
2. Document any performance optimizations made
3. Update CI/CD pipeline to include system query tests
4. Monitor test execution times in CI

## Commands Reference

```bash
# Run all tests
bun test tests/system-queries/

# Run specific category
bun test tests/system-queries/*integration*.test.ts
bun test tests/system-queries/*edge*.test.ts
bun test tests/system-queries/*error*.test.ts

# Coverage report
bun test --coverage tests/system-queries/

# Performance focus
bun test tests/system-queries/ --reporter=verbose
```