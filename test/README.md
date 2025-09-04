# Test Documentation

Streamlined testing environment for Bun Graph DB with essential tests only.

## Test Architecture

### 🏗️ **Simplified Test Structure**

```
test/
├── utils/                      # Test utilities and shared components
│   ├── GraphQLTestClient.ts    # Full-featured GraphQL test client
│   └── TestDataFixtures.ts     # Test data generation for different domains
├── unified-test-runner.ts      # Unified test management system
├── test-runner.ts              # Bun GraphQL integration tests with server management
├── graphql-comprehensive.test.ts # Bun comprehensive GraphQL API tests
├── performance.test.ts         # Jest performance and bulk operations tests
├── relationships.test.ts       # Jest relationship quality system tests
├── setup.ts                    # Jest test setup and configuration
└── README.md                   # This documentation
```

### 🧪 **Test Types**

1. **Bun Native Tests** - Fast, modern testing with built-in TypeScript support
2. **Jest Integration Tests** - Legacy comprehensive integration tests
3. **GraphQL API Tests** - Complete API validation with real server
4. **Performance Tests** - Large dataset and performance validation
5. **Domain Tests** - E-commerce, project management, knowledge graph scenarios

## Quick Start

### 🚀 **Run All Tests**

```bash
# Run complete unified test suite (recommended)
bun run test

# Alternative: Run all tests with detailed output
bun test/unified-test-runner.ts all
```

### 📋 **List Available Test Suites**

```bash
bun run test:list
```

Output:
```
📋 Available test suites:

  bun-comprehensive: Bun comprehensive GraphQL integration tests
    Command: bun test/test-runner.ts full
    Timeout: 120s

  jest-performance: Performance and bulk operations tests
    Command: jest --testPathPattern=performance.test.ts --runInBand
    Timeout: 120s

  jest-relationships: Relationship quality system tests
    Command: jest --testPathPattern=relationships.test.ts --runInBand
    Timeout: 90s

  bun-unit: Bun native unit tests
    Command: bun test --coverage
    Timeout: 60s
```

## Test Categories

### ⚡ **Bun Native Tests**

Fast, modern tests using Bun's built-in test runner:

```bash
# Run Bun unit tests with coverage
bun run test:bun

# Full GraphQL integration tests with server management
bun run test:integration
```

### 🔍 **GraphQL Query Validation**

Dedicated GraphQL API query testing (separate from integration tests):

```bash
# Validate all GraphQL queries and mutations
bun run test:queries

# Run validation with detailed analytics
bun run test:query-analytics
```

### 🧪 **Jest Specialized Tests**

Focused Jest tests for specific functionality:

```bash
# Performance and bulk operations testing
bun run test:performance

# Relationship quality system testing
bun run test:relationships
```

### 🎯 **Unified Test Management**

```bash
# Run all tests with detailed reporting
bun run test

# Run specific test suite
bun run test:specific jest-performance
bun run test:specific bun-comprehensive

# Generate coverage reports
bun run test:coverage
```

## Test Utilities

### 📡 **GraphQLTestClient**

Full-featured GraphQL client for testing:

```typescript
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

const client = new GraphQLTestClient()

// Health check
const isHealthy = await client.healthCheck()

// Create test data
const tableId = await client.createTable('test-table', 'Description')
const nodeId = await client.createNode(tableId, 'Test Node', 'Node description')

// Track created resources for cleanup
const context = client.getContext()
console.log('Created resources:', context)
```

### 🗂️ **TestDataFixtures**

Pre-built test data for different domains:

```typescript
import { TestDataFixtures } from './utils/TestDataFixtures.js'

const fixtures = new TestDataFixtures(client)

// Create complete test environments
const ecommerce = await fixtures.createECommerceEnvironment()
const project = await fixtures.createProjectManagementEnvironment()
const knowledge = await fixtures.createKnowledgeGraphEnvironment()
const performance = await fixtures.createPerformanceTestData() // 100 nodes, 200 relations
```

## Coverage and Reporting

### 📊 **Generate Coverage Reports**

```bash
# Generate unified coverage for all test runners
bun run test:coverage
```

Coverage reports are generated in:
- `coverage/` - Bun test coverage
- `coverage/jest/` - Jest test coverage

### 📈 **Test Report Format**

The unified test runner provides detailed reporting:

```
📊 TEST SUITE SUMMARY
============================================================
Total Suites: 6
Passed: 5
Failed: 1
Total Duration: 125.43s
Success Rate: 83.3%

❌ Failed Suites:
  - jest-integration: Exit code: 1

✅ SOME TESTS FAILED
============================================================
```

## Configuration

### ⚙️ **Jest Configuration** (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.ts',
    '!**/graphql-comprehensive.test.ts', // Bun-specific
    '!**/test-runner.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1 // Sequential execution
}
```

### 🔧 **Test Environment Variables**

```bash
NODE_ENV=test              # Test environment
TEST_SERVER_URL=http://...  # GraphQL server URL for integration tests
```

## Writing Tests

### ✅ **Bun Native Test Example**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

describe('My Feature Tests', () => {
  let client: GraphQLTestClient

  beforeAll(async () => {
    client = new GraphQLTestClient()
    await client.healthCheck()
  })

  test('should create and retrieve data', async () => {
    const tableId = await client.createTable('test', 'Test table')
    expect(tableId).toBeTruthy()
    
    const result = await client.getTable(tableId)
    expect(result.data.table.identifier).toBe('test')
  })
})
```

### 🧪 **Jest Integration Test Example**

```typescript
import { describe, test, expect, beforeAll } from '@jest/globals'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

describe('Integration Tests', () => {
  let client: GraphQLTestClient

  beforeAll(async () => {
    client = new GraphQLTestClient()
  })

  test('should handle complex scenarios', async () => {
    // Test implementation
  })
})
```

## Best Practices

### 🎯 **Test Guidelines**

1. **Use appropriate test runner**:
   - **Bun tests**: Fast unit tests, simple integration tests
   - **Jest tests**: Complex integration tests, legacy compatibility
   - **Query Validator**: Dedicated GraphQL API schema validation

2. **Query Testing Strategy**:
   - Use **Query Validator** for comprehensive API validation
   - Separate query testing from business logic testing
   - Focus on schema compliance and expected field validation
   - Use test:queries for CI/CD GraphQL API validation

3. **Resource management**:
   - Always use `GraphQLTestClient` for resource tracking
   - Clean up created resources in test teardown
   - Use unique identifiers to avoid conflicts

4. **Test isolation**:
   - Each test should be independent
   - Use fixtures for consistent test data
   - Clear context between tests

5. **Performance considerations**:
   - Run integration tests sequentially (`maxWorkers: 1`)
   - Use appropriate timeouts for different test types
   - Monitor test execution time

### 🚨 **Common Issues**

1. **Server not running**: Ensure GraphQL server is running on port 4000
2. **Port conflicts**: Check if other services are using port 4000
3. **Test timeouts**: Increase timeout for slow operations
4. **Resource cleanup**: Always clean up test resources to avoid conflicts

## CI/CD Integration

### 🔄 **GitHub Actions Example**

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Start GraphQL server
        run: bun run dev &
        
      - name: Wait for server
        run: sleep 5
        
      - name: Run unified test suite
        run: bun run test
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### 🔍 **Debug Test Issues**

```bash
# Check test server connectivity
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"query { health { status } }"}' \
  http://localhost:4000/graphql

# Run tests with verbose output
DEBUG=* bun run test:integration

# Run specific failing test
bun test/unified-test-runner.ts run jest-integration
```

### 📝 **Common Error Solutions**

- **GraphQL 400 errors**: Check schema/resolver mismatches
- **Connection refused**: Ensure server is running
- **Test timeout**: Increase timeout in Jest config or test suite
- **Resource conflicts**: Use unique identifiers and proper cleanup