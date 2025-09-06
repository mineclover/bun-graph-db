# Test Suite

## Overview

**단위 테스트(Unit Tests) 전용 디렉토리**

이 디렉토리는 GraphQL 쿼리 템플릿 인덱싱 기능의 단위 테스트만을 포함합니다. 
모든 테스트는 실제 서버 없이 메모리 데이터베이스를 사용하여 독립적으로 실행됩니다.

**⚠️ 중요**: 데모 코드나 실제 서버 테스트는 `/demo` 디렉토리를 사용하세요.

## Test Structure

```
tests/
├── template-indexing/          # Template indexing and query name functionality
│   ├── graphql-parsing.test.ts       # ✅ GraphQL parser functionality (15 tests)
│   ├── template-creation.test.ts     # ✅ Template creation with auto-parsing (14 tests)
│   ├── query-name-indexing.test.ts   # 🔧 Query name indexing and search (needs repository fixes)
│   └── performance-tracking.test.ts  # 🔧 Performance tracking functionality (needs repository fixes)
├── integration/               # 📋 Integration tests (planned)
│   ├── database-integration.test.ts  # Database schema and operations
│   └── repository-integration.test.ts # Repository layer integration
├── unit/                      # 📋 Unit tests (planned)
│   ├── entities/             # Entity tests
│   └── utils/                # Utility function tests
├── fixtures/                 # 📁 Test data and fixtures
│   ├── sample-queries.ts     # Sample GraphQL queries for testing
│   └── test-templates.ts     # Test template definitions
└── test-runner.ts            # 🚀 Custom test runner with detailed reporting
```

**Legend:**
- ✅ **Working** - Tests pass successfully  
- 🔧 **Needs Fixes** - Repository/Schema compatibility issues
- 📋 **Planned** - Future implementation
- 📁 **Supporting** - Data and utilities
- 🚀 **Tool** - Test infrastructure

## Test Categories

### 1. Template Indexing Tests (`template-indexing/`)

#### ✅ GraphQL Parsing (`graphql-parsing.test.ts`) - **15 tests passing**
- **Purpose**: Test GraphQL SDL parsing functionality
- **Status**: 🟢 **All tests passing** 
- **Coverage**: 
  - Query name extraction from SDL
  - Operation type detection (query/mutation/subscription)
  - Complexity score calculation
  - Syntax validation and error handling
  - Variable extraction
- **Key Features**:
  - Tests multiple GraphQL operation types
  - Anonymous query handling
  - Complex nested query parsing
  - Error handling for malformed queries
  - Performance validation (<100ms for 100 parses)

#### ✅ Template Creation (`template-creation.test.ts`) - **14 tests passing**
- **Purpose**: Test template creation with automatic parsing
- **Status**: 🟢 **All tests passing**
- **Coverage**:
  - QueryTemplate.create() with auto-parsing
  - Database serialization (toDatabase())
  - Schema field population (query_name, operation_type)
  - Legacy compatibility (templateType vs operationType)
  - Performance tracking methods (immutable pattern)
- **Key Features**:
  - Automatic complexity score calculation
  - Query name extraction during creation
  - Backwards compatibility validation
  - Input validation and error handling

#### 🔧 Query Name Indexing (`query-name-indexing.test.ts`) - **Needs Repository Fixes**
- **Purpose**: Test query name indexing and search functionality
- **Status**: 🔴 **Blocked by Repository/Schema compatibility issues**
- **Issues**:
  - Repository expects `template_type` field (removed from schema)
  - Schema differences between test setup and Repository implementation
- **Planned Coverage**:
  - Database index utilization
  - Query performance with indexes
  - Search by query name/operation type
  - Performance benchmarking (<0.1ms target)

#### 🔧 Performance Tracking (`performance-tracking.test.ts`) - **Needs Repository Fixes**
- **Purpose**: Test execution time tracking and statistics
- **Status**: 🔴 **Blocked by Repository/Schema compatibility issues**
- **Issues**:
  - Same Repository/Schema compatibility problems
  - Need to align test database schema with actual implementation
- **Planned Coverage**:
  - updateExecutionStats() method
  - Repository-level performance updates
  - Statistical accuracy validation

### 2. Integration Tests (`integration/`)

#### Database Integration (`database-integration.test.ts`)
- **Purpose**: Test complete database operations end-to-end
- **Coverage**:
  - Schema migration validation
  - Index creation and utilization
  - CRUD operations with new fields
  - Data consistency checks

#### Repository Integration (`repository-integration.test.ts`)
- **Purpose**: Test repository layer with real database
- **Coverage**:
  - SqliteQueryTemplateRepository functionality
  - Search operations with new schema
  - Performance tracking integration
  - Error handling and recovery

### 3. Unit Tests (`unit/`)

#### Entity Tests (`unit/entities/`)
- **Purpose**: Test domain entity logic in isolation
- **Coverage**:
  - QueryTemplate entity methods
  - Business logic validation
  - State transitions
  - Data transformation

#### Utility Tests (`unit/utils/`)
- **Purpose**: Test utility functions
- **Coverage**:
  - GraphQLParser utility methods
  - Helper functions
  - Error handling

## Test Data and Fixtures

### Sample Queries (`fixtures/sample-queries.ts`)
```typescript
export const sampleQueries = {
  simpleQuery: `query GetUser($id: ID!) { node(id: $id) { id content } }`,
  complexQuery: `query ListUsers($filter: NodesFilter) { ... }`,
  mutation: `mutation CreateUser($input: CreateNodeInput!) { ... }`,
  anonymousQuery: `{ health { status } }`
}
```

### Test Templates (`fixtures/test-templates.ts`)
```typescript
export const testTemplates = [
  {
    identifier: 'test-simple-query',
    queryText: sampleQueries.simpleQuery,
    expectedQueryName: 'GetUser',
    expectedOperationType: 'query',
    expectedComplexity: 2
  }
]
```

## Running Tests

### ✅ Working Tests (Recommended)
```bash
# Custom test runner - runs all working tests with detailed reporting
bun run test:templates template-indexing

# Individual working tests
bun test tests/template-indexing/graphql-parsing.test.ts        # 15 tests ✅
bun test tests/template-indexing/template-creation.test.ts      # 14 tests ✅

# Run both working tests together
bun test tests/template-indexing/graphql-parsing.test.ts tests/template-indexing/template-creation.test.ts
```

### 🔧 Tests Needing Fixes (Currently Blocked)
```bash
# These require Repository/Schema compatibility fixes
bun test tests/template-indexing/query-name-indexing.test.ts    # ❌ Repository issues
bun test tests/template-indexing/performance-tracking.test.ts   # ❌ Repository issues
```

### Test Runner Options
```bash
# Custom test runner with detailed output and performance insights
bun run test:templates                    # Run all available tests
bun run test:templates template-indexing  # Run template-indexing category
bun run test:templates --help             # Show available options
```

### Current Test Status Summary
```
✅ Passing: 29 tests (15 + 14)
❌ Blocked: ~60 tests (repository compatibility issues)  
🎯 Success Rate: 100% for implemented functionality
⚡ Performance: All tests complete in <120ms
```

## Test Performance Targets

### ✅ Currently Achieved (Working Tests)
- **GraphQL Parsing Performance**: <100ms for 100 query parses
- **Template Creation Performance**: <50ms per test suite
- **Auto-parsing Accuracy**: 100% correct operation type detection
- **Error Handling Coverage**: All syntax error cases handled
- **Legacy Compatibility**: Full backwards compatibility verified

### 🎯 Target Performance (When Repository Fixed)
- **Query name search**: <0.1ms (index-optimized)
- **Operation type search**: <0.1ms (index-optimized)  
- **Composite index search**: <0.1ms (multi-field optimization)
- **Performance sorting**: <0.1ms (dedicated indexes)

### ✅ Current Functionality Coverage
- **GraphQL parsing**: 100% operation types covered (query/mutation/subscription)
- **Template creation**: All auto-parsing features working
- **Entity validation**: Input validation and error handling complete
- **Immutable patterns**: Performance tracking with immutable updates

### 🔧 Pending Coverage (Repository Fixes Needed)
- **Database indexing**: All indexes validated
- **Performance tracking**: Complete statistics flow
- **Schema migration**: Zero data loss validation
- **Index utilization**: EXPLAIN QUERY PLAN verification

## Maintenance Notes

### ✅ Current Working Tests
1. **GraphQL Parsing Tests**: Fully implemented and passing
2. **Template Creation Tests**: Complete with all edge cases covered
3. **Custom Test Runner**: Provides detailed reporting and performance insights

### 🔧 Repository/Schema Issues to Fix
1. **Schema Alignment**: Update Repository to match current core/schema.sql
   - Remove references to `template_type` (use `operation_type` instead)
   - Ensure all schema fields match between Repository and actual schema
2. **Logger Dependencies**: Ensure Repository constructors include logger parameter
3. **Test Database Setup**: Align test schemas with production schema exactly

### Adding New Tests
1. Create test file in appropriate category directory
2. Follow naming convention: `feature-name.test.ts`
3. Use proper QueryTemplate.create() syntax:
   ```typescript
   QueryTemplate.create(identifier, name, queryText, tags, options)
   ```
4. Update test-runner.ts to include new tests
5. Add any new fixtures to `fixtures/` directory

### Test Data Management
- Use consistent test identifiers with meaningful prefixes
- Include required `tags` parameter in all QueryTemplate.create() calls
- Use proper schema with all required fields
- Provide logger parameter to Repository constructors

### Working Test Guidelines
✅ **Successful patterns to follow:**
- Use fixtures from `fixtures/sample-queries.ts` and `fixtures/test-templates.ts`
- Follow the parameter order: `identifier, name, queryText, tags, options`
- Test immutable patterns (methods return new instances)
- Include both positive and negative test cases

❌ **Common issues to avoid:**
- Missing `tags` parameter in QueryTemplate.create()
- Schema mismatches between test and Repository
- Missing logger in Repository constructor
- Expecting mutable behavior from immutable methods