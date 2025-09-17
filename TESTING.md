# Testing Guide

This document provides comprehensive guidance for testing in the bun-graph-db project using our **Test Isolation Strategy**.

## 🎯 Overview

Our testing approach ensures complete isolation between test suites, enabling:
- ✅ **Parallel execution** without conflicts
- ✅ **Independent databases** per test suite
- ✅ **Automatic cleanup** and resource management
- ✅ **Consistent results** across multiple runs

## 🚀 Quick Start

### Run All Tests (Recommended)
```bash
npm run test:all:isolated
```

### Run by Category
```bash
# Fast unit tests with parallel execution
npm run test:unit:parallel

# Integration tests with isolated GraphQL servers
npm run test:integration

# Full end-to-end tests
npm run test:e2e

# Legacy tests (requires running server)
npm run test:legacy
```

### Cleanup Test Environment
```bash
# Normal cleanup
npm run test:cleanup

# Force cleanup with detailed output
npm run test:cleanup:force

# See what would be cleaned
npm run test:cleanup:dry
```

## 📋 Test Categories

### Unit Tests (`tests/unit/`, `tests/template-indexing/`)
- **Environment**: File-based SQLite databases (enforced for full isolation)
- **Execution**: Parallel by default with unique database paths
- **Purpose**: Fast feedback, isolated logic testing
- **Performance**: < 100ms per test, < 5s per suite
- **Migration Status**: ✅ All critical tests migrated to file-based isolation

```bash
npm run test:unit
npm run test:unit:parallel  # Explicit parallel execution
```

**Example test structure**:
```typescript
import { TestDatabaseFactory } from '../fixtures/test-database-factory'

describe('Component Unit Tests', () => {
  let testEnv: any

  beforeEach(async () => {
    testEnv = await TestDatabaseFactory.createTestEnvironment('test-suite-name')
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should work correctly', async () => {
    const db = testEnv.database.getConnection()

    // Example: Create test table
    db.exec(`CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)`)
    db.exec(`INSERT INTO test_table (name) VALUES ('test data')`)

    const result = db.prepare('SELECT * FROM test_table WHERE name = ?').get('test data')
    expect(result.name).toBe('test data')
  })
})
```

### Integration Tests (`tests/integration/`, isolated tests)
- **Environment**: File-based SQLite + isolated GraphQL servers (port range 5500-5999)
- **Execution**: Matrix parallel (each suite gets unique port)
- **Purpose**: API testing, component interaction
- **Performance**: < 1s per test, < 30s per suite
- **Server Management**: Automatic isolated server creation with TestDatabaseFactory schema

```bash
npm run test:integration
```

**Example test structure**:
```typescript
import { GraphQLTestServerManager } from '../fixtures/test-graphql-server'

const SUITE_NAME = 'api-integration-test'

describe('API Integration Tests', () => {
  let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

  beforeAll(async () => {
    const server = await GraphQLTestServerManager.startServerForSuite(SUITE_NAME)
    console.log(`✅ Server started at: ${server.url}`)

    graphqlRequest = GraphQLTestServerManager.createRequestHelper(SUITE_NAME)
  }, 15000)

  afterAll(async () => {
    await GraphQLTestServerManager.stopServerForSuite(SUITE_NAME)
  })

  test('should handle GraphQL requests', async () => {
    const result = await graphqlRequest('query { __schema { types { name } } }')
    expect(result.data).toBeDefined()
    expect(result.data.__schema.types).toBeDefined()
  })
})
```

### E2E Tests (`tests/e2e/`)
- **Environment**: Full isolation with seed data and mocks
- **Execution**: Sequential (recommended)
- **Purpose**: Complete workflow validation
- **Performance**: < 5s per test, < 2min per suite

```bash
npm run test:e2e
```

**Example test structure**:
```typescript
import { TestIsolationHelpers } from '../fixtures/test-isolation-helpers'

describe('End-to-End Tests', () => {
  let testContext: IsolatedTestContext

  beforeAll(async () => {
    testContext = await TestIsolationHelpers.setupE2ETest('test-suite-name', {
      seedData: true,
      mockExternalServices: false
    })
  })

  afterAll(async () => {
    await testContext.cleanup()
  })

  test('should complete full workflow', async () => {
    // Multi-step workflow test
  })
})
```

## 🔧 Test Utilities

### TestIsolationHelpers

Main utility for creating isolated test environments:

```typescript
// Unit test (in-memory database)
const context = await TestIsolationHelpers.setupUnitTest('suite-name')

// Integration test (database + GraphQL server)
const context = await TestIsolationHelpers.setupIntegrationTest('suite-name')

// E2E test (full isolation + options)
const context = await TestIsolationHelpers.setupE2ETest('suite-name', {
  seedData: true,
  mockExternalServices: true,
  enableLogging: true
})

// Always cleanup
await context.cleanup()
```

### Performance Helpers

```typescript
const perf = TestIsolationHelpers.createPerformanceHelper('suite-name')

await perf.measure('database-operation', async () => {
  // Your operation
})

perf.reportStats() // Shows performance breakdown
```

### Assertion Helpers

```typescript
const assert = TestIsolationHelpers.createAssertionHelpers()

// GraphQL assertions
const data = assert.assertGraphQLResponse(result)

// Database assertions
const record = assert.assertDatabaseRecord(db, 'table', { id: 1 })

// Performance assertions
assert.assertPerformance(actualMs, 100, 'operation-name')
```

## 📊 Performance Monitoring

### Built-in Metrics

All test runs automatically track:
- Execution time per test and suite
- Database operation counts
- Memory usage patterns
- Server startup/shutdown times

### Performance Targets

| Test Type | Individual | Suite | Parallel |
|-----------|------------|-------|----------|
| Unit | < 100ms | < 5s | ✅ Unlimited |
| Integration | < 1s | < 30s | ✅ Port isolation |
| E2E | < 5s | < 2min | ⚠️ Sequential recommended |

### Monitoring Commands

```bash
# View performance stats
npm run test:unit -- --verbose

# Generate performance report
npm run test:all:isolated -- --report

# Benchmark specific category
time npm run test:integration
```

## 🐛 Debugging

### Debug Mode

```bash
# Enable debug logging
DEBUG=test:* npm run test:unit

# Verbose test runner output
npm run test:integration -- --verbose

# Dry run to see what would happen
npm run test:cleanup:dry
```

### Common Issues

#### Port Conflicts
```bash
# Check for busy test ports
lsof -i :14000-14100

# Force cleanup
npm run test:cleanup:force
```

#### Database Locks
```bash
# Clean up leftover files
rm -f /tmp/bun-graph-db-tests/*.sqlite*

# Force cleanup with process termination
npm run test:cleanup:force
```

#### Memory Issues
```bash
# Run with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e

# Monitor memory usage
NODE_OPTIONS="--expose-gc" npm run test:unit
```

### Debugging Test Failures

1. **Check isolation environment**:
   ```bash
   npm run test:cleanup:dry  # See current state
   ```

2. **Run single test with debug**:
   ```bash
   DEBUG=test:* bun test tests/integration/specific-test.test.ts
   ```

3. **Inspect database state**:
   ```typescript
   // In your test
   const db = testContext.database!.database.getConnection()
   console.log(db.prepare('SELECT * FROM tables').all())
   ```

## 🔧 Migration Tools & CLI

The project includes sophisticated migration tools for converting legacy tests to the isolated testing strategy:

### MigrationService CLI

```bash
# Analyze migration feasibility
bun run src/migration-tools/cli/migration-cli.ts analyze tests/legacy/old-test.test.ts

# Execute migration with options
bun run src/migration-tools/cli/migration-cli.ts execute tests/legacy/old-test.test.ts --backup --performance-monitoring

# Validate migrated test
bun run src/migration-tools/cli/migration-cli.ts validate tests/migrated/new-test.test.ts --strict

# Generate migration report
bun run src/migration-tools/cli/migration-cli.ts report --format json
```

### Migration Features

- **Code Transformation**: Automatic conversion from `:memory:` to file-based databases
- **Performance Tolerance**: Adjusts timing expectations for file-based operations
- **Schema Compatibility**: Handles schema differences between test and production
- **Backup & Rollback**: Creates backups before migration with rollback capability
- **Validation**: Comprehensive validation of migrated test files
- **Batch Processing**: Support for migrating multiple test files simultaneously

## 🔄 CI/CD Integration

### GitHub Actions

Our `.github/workflows/test-isolation.yml` provides:
- **Parallel unit tests** across matrix
- **Isolated integration tests** with port management
- **Sequential E2E tests** with full validation
- **Performance benchmarking**
- **Automatic cleanup** and reporting

### Local CI Simulation

```bash
# Simulate unit test matrix
npm run test:unit:parallel

# Simulate integration test matrix
npm run test:integration

# Simulate full CI pipeline
npm run test:cleanup && \
npm run test:unit && \
npm run test:integration && \
npm run test:e2e
```

## 📝 Writing Tests

### Test Examples

#### Unit Test Example
```typescript
// tests/unit/template-creation-isolated.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { TestIsolationHelpers, type IsolatedTestContext } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'template-creation-isolated'
let testContext: IsolatedTestContext

describe('Template Creation - Isolated Unit Tests', () => {
  beforeAll(async () => {
    testContext = await TestIsolationHelpers.setupUnitTest(SUITE_NAME)
  })

  afterAll(async () => {
    await testContext.cleanup()
  })

  test('should create template with validation', async () => {
    const db = testContext.database!.database.getConnection()

    // Create templates table
    db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY,
        identifier TEXT UNIQUE,
        query_text TEXT,
        operation_type TEXT
      )
    `)

    // Test template creation
    const stmt = db.prepare('INSERT INTO templates (identifier, query_text, operation_type) VALUES (?, ?, ?)')
    const result = stmt.run('test-query', 'query { todos { id } }', 'query')

    expect(result.lastInsertRowid).toBeGreaterThan(0)
  })
})
```

#### Integration Test Example
```typescript
// tests/integration/doc-system-isolated.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { TestIsolationHelpers, type IsolatedTestContext } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'doc-system-isolated'
let testContext: IsolatedTestContext

describe('Doc System - Integration Tests', () => {
  beforeAll(async () => {
    testContext = await TestIsolationHelpers.setupIntegrationTest(SUITE_NAME)
  }, 30000)

  afterAll(async () => {
    await testContext.cleanup()
  })

  test('should create documentation via GraphQL API', async () => {
    const mutation = `
      mutation CreateDoc($input: CreateDocInput!) {
        createDoc(input: $input) {
          id
          tableId
          category
          content
        }
      }
    `

    const result = await testContext.graphqlRequest!(mutation, {
      input: {
        tableId: '58',
        category: 'USAGE',
        content: 'Test documentation content'
      }
    })

    expect(result.data.createDoc).toBeDefined()
    expect(result.data.createDoc.tableId).toBe('58')
    expect(result.data.createDoc.category).toBe('USAGE')
  })
})
```

#### E2E Test Example
```typescript
// tests/e2e/doc-system-e2e.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { TestIsolationHelpers, type IsolatedTestContext } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'doc-system-e2e'
let testContext: IsolatedTestContext

describe('Doc System - E2E Tests', () => {
  beforeAll(async () => {
    testContext = await TestIsolationHelpers.setupE2ETest(SUITE_NAME, {
      seedData: true,
      mockExternalServices: false
    })
  }, 45000)

  afterAll(async () => {
    await testContext.cleanup()
  })

  test('should support complete CRUD workflow', async () => {
    // 1. Create
    const createResult = await testContext.graphqlRequest!(`
      mutation CreateDoc($input: CreateDocInput!) {
        createDoc(input: $input) { id }
      }
    `, {
      input: { tableId: '58', category: 'E2E_TEST', content: 'E2E content' }
    })

    const docId = createResult.data.createDoc.id

    // 2. Read
    const readResult = await testContext.graphqlRequest!(`
      query GetDoc($id: ID!) {
        getDoc(id: $id) { id content }
      }
    `, { id: docId })

    expect(readResult.data.getDoc.content).toBe('E2E content')

    // 3. Update
    await testContext.graphqlRequest!(`
      mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
        updateDoc(id: $id, input: $input) { id }
      }
    `, { id: docId, input: { content: 'Updated content' } })

    // 4. Delete
    const deleteResult = await testContext.graphqlRequest!(`
      mutation DeleteDoc($id: ID!) {
        deleteDoc(id: $id) { success }
      }
    `, { id: docId })

    expect(deleteResult.data.deleteDoc.success).toBe(true)
  })
})
```

### Best Practices

1. **Use appropriate isolation level**:
   - Unit tests → In-memory DB
   - Integration tests → Server isolation
   - E2E tests → Full isolation with seed data

2. **Always cleanup**:
   ```typescript
   afterAll(async () => {
     await testContext.cleanup()
   })
   ```

3. **Use meaningful suite names**:
   ```typescript
   // Good
   await TestIsolationHelpers.setupUnitTest('user-authentication')

   // Bad
   await TestIsolationHelpers.setupUnitTest('test-1')
   ```

4. **Leverage performance helpers**:
   ```typescript
   const perf = TestIsolationHelpers.createPerformanceHelper('suite-name')
   await perf.measure('operation', async () => { /* test */ })
   ```

5. **Use assertion helpers**:
   ```typescript
   const helpers = TestIsolationHelpers.createAssertionHelpers()
   const data = helpers.assertGraphQLResponse(result)
   ```

### Migration from Legacy Tests

1. **Identify isolation needs**:
   - Database access → Unit test
   - GraphQL API → Integration test
   - Full workflow → E2E test

2. **Replace setup/teardown**:
   ```typescript
   // Before
   beforeAll(async () => {
     // Manual setup
   })

   // After
   beforeAll(async () => {
     testContext = await TestIsolationHelpers.setupIntegrationTest('suite-name')
   })
   ```

3. **Update test structure**:
   ```typescript
   // Before
   const response = await fetch('http://localhost:4000/graphql', ...)

   // After
   const result = await testContext.graphqlRequest!(query, variables)
   ```

## 📚 Resources

### Documentation
- [Test Isolation Strategy Documentation](./docs/TEST_ISOLATION_STRATEGY.md)
- [CI/CD Configuration](./.github/workflows/test-isolation.yml)

### Core APIs
- [TestIsolationHelpers API](./tests/fixtures/test-isolation-helpers.ts)
- [Test Database Factory](./tests/fixtures/test-database-factory.ts)
- [GraphQL Test Server Manager](./tests/fixtures/test-graphql-server.ts)

### Example Tests
- [Unit Test Example](./tests/template-indexing/template-creation.file-based-2025-09-17T19-09-39-484Z.test.ts) - Fast file-based database tests (45/45 tests ✅)
- [Integration Test Example](./tests/doc-system-isolated.test.ts) - GraphQL API with isolated server and schema fixes
- [Performance Test Example](./tests/template-indexing/performance-tracking.file-based-2025-09-17T19-06-19-946Z.test.ts) - Template performance with proper tolerance adjustments
- [Query Indexing Test](./tests/template-indexing/query-name-indexing.file-based-2025-09-17T19-09-12-913Z.test.ts) - Query indexing with extended schema
- [System Queries Isolated](./tests/system-queries-isolated.test.ts) - Unit test with database isolation

### Utilities
- [Test Cleanup Script](./scripts/test-cleanup.ts)
- [Enhanced Test Runner](./tests/test-runner.ts)

## 🎯 Migration Checklist

### From Legacy Tests to Isolated Tests

- [x] **Assess current test**: Identify what resources it uses (database, server, external services)
- [x] **Choose isolation level**:
  - Unit test (file-based DB) for pure logic ✅ All tests now use file-based SQLite
  - Integration test (DB + server) for API testing ✅ GraphQL server with port isolation (5500-5999)
  - E2E test (full isolation) for complete workflows
- [x] **Replace setup/teardown**:
  - Remove manual database setup ✅ TestDatabaseFactory handles all setup
  - Replace with `TestDatabaseFactory.createTestEnvironment()`
- [x] **Update test structure**:
  - Use `testEnv.database.getConnection()` for DB access ✅ Fixed connection method
  - Use `graphqlRequest` helper for API calls ✅ GraphQLTestServerManager provides helpers
- [x] **Add proper cleanup**:
  - Always call `await testEnv.cleanup()` in `afterAll` ✅ Implemented in all migrated tests
- [x] **Test parallel compatibility**:
  - Ensure no shared state between tests ✅ Unique database paths per suite
  - Verify unique suite names ✅ Enforced by TestDatabaseFactory
- [x] **Add performance monitoring**:
  - Use performance helpers if needed ✅ Built into migration system
  - Set appropriate timeouts ✅ Adjusted for file-based operations
- [x] **Update CI/CD**:
  - Add to appropriate test category in runner
  - Verify matrix execution works ✅ Port isolation enables parallel execution

### Migration Success Status

✅ **Template Indexing Tests**: 45/45 tests passing (100% success rate)
✅ **GraphQL Integration**: Schema compatibility fixed, port range corrected (5500-5999)
✅ **Database Schema**: Extended TestDatabaseFactory with comprehensive template schema
✅ **Performance Tolerance**: Adjusted timing expectations for file-based operations
✅ **CLI Tools**: Complete migration toolchain with analyze/execute/validate commands

### Migration Examples

**Before (Legacy)**:
```typescript
describe('Legacy Test', () => {
  beforeAll(async () => {
    // Manual server startup
    await startServer()
  })

  afterAll(async () => {
    // Manual cleanup
    await stopServer()
  })

  test('should work', async () => {
    const response = await fetch('http://localhost:4000/graphql', ...)
    // Test logic
  })
})
```

**After (Isolated)**:
```typescript
describe('Isolated Test', () => {
  let testContext: IsolatedTestContext

  beforeAll(async () => {
    testContext = await TestIsolationHelpers.setupIntegrationTest('suite-name')
  })

  afterAll(async () => {
    await testContext.cleanup()
  })

  test('should work', async () => {
    const result = await testContext.graphqlRequest!(query, variables)
    // Test logic
  })
})
```