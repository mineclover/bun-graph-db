# Quickstart Guide - Test Migration Strategy Implementation

## Overview
This guide provides step-by-step instructions for migrating legacy tests to the Test Isolation Strategy with file-based SQLite databases.

## Prerequisites
- Bun runtime installed
- Access to existing test files in the project
- Understanding of current Test Isolation Strategy (see TESTING.md)

## Quick Start Steps

### 1. Environment Setup
```bash
# Ensure Bun is available
bun --version

# Install dependencies if needed
bun install

# Verify current test infrastructure
bun run test:cleanup:dry
```

### 2. Migration Analysis
```bash
# Analyze current test landscape
find tests/ -name "*.test.ts" | head -10

# Identify simple unit tests for initial migration
ls tests/unit/
ls tests/template-indexing/
```

### 3. First Migration - Simple Unit Test

#### Step 3.1: Choose Target Test
Start with a simple unit test like `template-creation.test.ts`:
```bash
# Examine the test structure
cat tests/template-indexing/template-creation.test.ts | head -50
```

#### Step 3.2: Create Migration Workspace
```bash
# Create migration working directory
mkdir -p migration-workspace/001-template-creation
cd migration-workspace/001-template-creation
```

#### Step 3.3: Analyze Test Dependencies
```typescript
// Check what the test currently uses:
// - Database setup (beforeEach/afterEach)
// - External dependencies
// - Complex setup requirements
```

#### Step 3.4: Convert to File-Based SQLite
```typescript
// BEFORE (In-Memory Database):
beforeEach(() => {
  testDb = new Database(':memory:')
  // ...
})

// AFTER (File-Based Database):
let testContext: EnhancedTestContext

beforeAll(async () => {
  testContext = await EnhancedTestIsolationHelpers.setupUnitTestFileBased('template-creation-001')
})

afterAll(async () => {
  await testContext.cleanup()
})
```

### 4. Validation Process

#### Step 4.1: Run Original Test
```bash
# Run legacy test and capture results
bun test tests/template-indexing/template-creation.test.ts > legacy-results.txt
```

#### Step 4.2: Run Migrated Test
```bash
# Run migrated test and capture results
bun test migration-workspace/001-template-creation/template-creation-migrated.test.ts > migrated-results.txt
```

#### Step 4.3: Compare Results
```bash
# Compare functional equivalence
diff legacy-results.txt migrated-results.txt

# Check for file-based database creation
ls /tmp/bun-graph-db-tests/
```

### 5. Performance Verification

#### Step 5.1: Basic Performance Check
```typescript
// Measure execution time
const startTime = performance.now()
await runTest()
const executionTime = performance.now() - startTime

// Flag anomalies (>50% variance)
if (Math.abs(executionTime - baselineTime) / baselineTime > 0.5) {
  console.warn('Performance anomaly detected')
}
```

#### Step 5.2: Resource Cleanup Verification
```bash
# Before cleanup
ls /tmp/bun-graph-db-tests/

# After cleanup
bun run test:cleanup
ls /tmp/bun-graph-db-tests/

# Should be empty or only active test files
```

### 6. Parallel Execution Test

#### Step 6.1: Test Isolation
```bash
# Run multiple tests in parallel
bun test migration-workspace/001-template-creation/template-creation-migrated.test.ts &
bun test migration-workspace/002-another-test/another-migrated.test.ts &
wait

# Verify no conflicts occurred
echo "Exit codes: $? (should be 0 for success)"
```

### 7. Migration Documentation

#### Step 7.1: Document Migration
```typescript
// Create migration report
const migrationReport: MigrationReport = {
  targetFilePath: 'migration-workspace/001-template-creation/template-creation-migrated.test.ts',
  originalFilePath: 'tests/template-indexing/template-creation.test.ts',
  migrationDate: new Date().toISOString(),
  migrationDuration: executionTime,
  issuesEncountered: [
    'Had to update database setup from :memory: to file-based',
    'Required modification of cleanup logic'
  ],
  strategyImprovements: [
    'File-based approach enables better debugging',
    'Cleanup verification prevents resource accumulation'
  ]
}
```

## Expected Outcomes

### Success Criteria
- ✅ Migrated test produces same functional results as legacy test
- ✅ File-based SQLite database created in `/tmp/bun-graph-db-tests/`
- ✅ Test executes in isolation (parallel execution safe)
- ✅ Resources cleaned up properly (no file accumulation)
- ✅ Performance within acceptable variance (<50% difference)

### Failure Indicators
- ❌ Different test results between legacy and migrated
- ❌ In-memory database usage detected
- ❌ Test conflicts during parallel execution
- ❌ SQLite files accumulating in temp directory
- ❌ Significant performance regression (>50% slower)

## Troubleshooting

### Common Issues

#### 1. In-Memory Database Still Used
```bash
# Check for :memory: usage
grep -r ":memory:" migration-workspace/

# Fix: Update to file-based
# Change: new Database(':memory:')
# To: testContext.database.getConnection()
```

#### 2. File Path Conflicts
```bash
# Check for duplicate suite names
ls /tmp/bun-graph-db-tests/

# Fix: Use unique suite names
# Change: 'test-suite'
# To: 'template-creation-001'
```

#### 3. Cleanup Failures
```bash
# Manual cleanup if needed
bun run test:cleanup:force

# Check for locked files
lsof /tmp/bun-graph-db-tests/*.sqlite
```

#### 4. Port Conflicts (Integration Tests)
```bash
# Check for busy ports
lsof -i :14000-14100

# Fix: Ensure proper port allocation in TestIsolationHelpers
```

## Next Steps

### Progressive Migration Plan
1. **Phase 1**: Simple unit tests (like template-creation)
2. **Phase 2**: Integration tests (requiring GraphQL servers)
3. **Phase 3**: E2E tests (full workflow validation)

### Strategy Refinement
- Document lessons learned from each migration
- Update TestIsolationHelpers based on discoveries
- Enhance cleanup mechanisms for better resource management
- Improve validation tools for functional equivalence

### Automation Opportunities
- Create migration scripts for common patterns
- Build validation tools for automated comparison
- Implement monitoring for resource accumulation
- Develop rollback mechanisms for failed migrations

## Validation Checklist

After each migration, verify:
- [ ] Test results match legacy test functionally
- [ ] File-based SQLite database used (check file system)
- [ ] Parallel execution works without conflicts
- [ ] Resource cleanup removes all temporary files
- [ ] Performance variance within acceptable limits
- [ ] Migration report documented with lessons learned

## Support Resources
- TESTING.md - Current Test Isolation Strategy documentation
- TestIsolationHelpers API - Existing isolation patterns
- Migration API contracts - New migration-specific interfaces
- Performance monitoring tools - Basic success/failure tracking