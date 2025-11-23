# Task 2.2 Day 4 Execution Plan - Performance & Testing

**Date**: 2025-11-23
**Task**: Validate Unified Resolver Performance & Functionality
**Status**: 📋 Planning Phase
**Estimated Duration**: ~2-3 hours

---

## 🎯 Objectives

### Primary Goals
✅ Verify server starts successfully with unified resolvers active
✅ Run complete integration test suite and confirm all tests pass
✅ Benchmark performance of unified resolvers vs old resolvers
✅ Validate GraphQL API functionality remains unchanged
✅ Document any issues or regressions

### Success Criteria
- Server starts without errors
- Health check endpoint responds correctly
- Integration tests: 24+ tests passing (target: 100%)
- No performance regressions (unified ≥ old resolver performance)
- GraphQL queries/mutations work correctly
- Zero breaking changes confirmed

---

## 📊 Current State

### What We Have
✅ All 113 resolver mappings activated with feature flag pattern
✅ 6/6 unified resolvers registered in DI container
✅ TypeScript compilation successful (no new errors)
✅ Code committed and pushed to remote

### What We Need to Verify
⚠️ Server startup with unified resolvers (not yet tested)
⚠️ Integration test suite execution (not run since Day 3)
⚠️ Performance comparison (baseline needed)
⚠️ API functionality validation (end-to-end testing)

---

## 🚀 Execution Strategy

### Phase 1: Server Startup Verification (~30 minutes)

**Goal**: Confirm server starts and initializes correctly

**Steps**:
1. **Start Server**
   ```bash
   bun run dev --port 4141
   ```
   - Wait for "Server running" message
   - Check for initialization errors
   - Verify DI container resolves all dependencies

2. **Health Check Test**
   ```bash
   curl -X POST http://localhost:4141/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"query{healthCheck{status database version}}"}'
   ```
   - Expected: `{"data":{"healthCheck":{"status":"ok","database":"connected","version":"..."}}}`

3. **System Status Test**
   ```bash
   curl -X POST http://localhost:4141/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"query{systemStatus{uptime memoryUsage}}"}'
   ```

4. **GraphQL Introspection**
   ```bash
   curl -X POST http://localhost:4141/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"query{__schema{queryType{name}}}"}'
   ```

**Expected Outcomes**:
- ✅ Server starts within 5 seconds
- ✅ No error messages in console
- ✅ Health check returns 200 OK
- ✅ All GraphQL queries respond correctly

**Potential Issues**:
- Resolver methods missing in unified resolvers
- DI dependency resolution failures
- Circular dependency errors
- Method signature mismatches

---

### Phase 2: Integration Test Suite (~45 minutes)

**Goal**: Run all integration tests and verify 100% pass rate

#### Test Categories

**1. System Queries Integration Tests**
```bash
bun test tests/integration/system-queries-integration.test.ts
```

**Expected**: 15/15 tests passing
- Health check queries
- System status queries
- Database connectivity

**2. Relation Queries Isolated Tests**
```bash
bun test tests/relation-queries-isolated.test.ts
```

**Expected**: 11/11 tests passing
- Relation type operations
- Node relation queries
- Dependency chain traversal

**3. Unit Tests (System Queries)**
```bash
bun test tests/unit/system-queries.test.ts
```

**Expected**: 40/40 tests passing
- Individual resolver method tests
- Edge case handling
- Error scenarios

**4. Full Test Suite**
```bash
bun test
```

**Expected**: 76/76 tests passing (or similar high pass rate)

#### Test Execution Strategy

**Sequential Testing** (recommended):
1. Run system-queries-integration first (fastest, most critical)
2. Run relation-queries-isolated (validates complex scenarios)
3. Run unit tests (comprehensive coverage)
4. Run full suite (catch any missed tests)

**Parallel Testing** (if time-constrained):
```bash
bun test --concurrent
```

#### Failure Analysis Protocol

**If tests fail**:
1. **Identify Failing Test**
   - Note test name and error message
   - Check if failure is related to unified resolvers

2. **Root Cause Analysis**
   - Compare unified resolver method vs old resolver method
   - Check method signatures match
   - Verify parameter passing

3. **Fix Strategy**
   - Option A: Fix unified resolver method
   - Option B: Temporarily disable unified resolver for that specific method
   - Option C: Update test expectations if API intentionally changed

4. **Retest After Fix**
   - Run failing test again
   - Run full suite to check for side effects

---

### Phase 3: Performance Benchmarking (~45 minutes)

**Goal**: Measure and compare unified resolver performance

#### Benchmark Scenarios

**Scenario 1: Simple Query Performance**
```graphql
query BenchmarkSimple {
  healthCheck {
    status
    database
    version
  }
}
```

**Metrics**:
- Avg response time (ms)
- P50, P95, P99 latencies
- Throughput (queries/second)

**Scenario 2: Complex Query Performance**
```graphql
query BenchmarkComplex {
  tables {
    nodes {
      id
      identifier
      attributes {
        id
        name
      }
      tableNodes {
        id
        title
      }
    }
  }
}
```

**Metrics**:
- Query execution time
- Database query count
- Memory usage

**Scenario 3: Mutation Performance**
```graphql
mutation BenchmarkMutation {
  createNode(input: {
    tableId: "test-table"
    title: "Benchmark Node"
    content: "Performance test"
  }) {
    success
    node { id }
  }
}
```

**Metrics**:
- Mutation execution time
- Transaction overhead
- Database write performance

#### Benchmarking Tools

**Option 1: Manual Timing**
```bash
for i in {1..100}; do
  time curl -X POST http://localhost:4141/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"..."}'
done
```

**Option 2: Apache Bench (ab)**
```bash
ab -n 1000 -c 10 -p query.json -T application/json \
  http://localhost:4141/graphql
```

**Option 3: Custom Benchmark Script**
```typescript
// benchmark.ts
const iterations = 1000;
const results = [];

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  await fetch('http://localhost:4141/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '...' })
  });
  const end = performance.now();
  results.push(end - start);
}

console.log('Avg:', results.reduce((a, b) => a + b) / results.length);
console.log('P50:', percentile(results, 50));
console.log('P95:', percentile(results, 95));
console.log('P99:', percentile(results, 99));
```

#### Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Health Check | <5ms | <10ms | >10ms |
| Simple Query | <20ms | <50ms | >50ms |
| Complex Query | <100ms | <200ms | >200ms |
| Simple Mutation | <30ms | <100ms | >100ms |
| Throughput | >500 q/s | >200 q/s | <200 q/s |

---

### Phase 4: API Functionality Validation (~30 minutes)

**Goal**: End-to-end validation of GraphQL API

#### Test Cases

**1. Table Operations**
```graphql
# Create table
mutation {
  createTable(input: {
    identifier: "test-day4"
    description: "Day 4 validation test"
  }) {
    success
    table { id identifier }
  }
}

# Query table
query {
  tableByIdentifier(identifier: "test-day4") {
    id
    identifier
    description
  }
}

# Update table
mutation {
  updateTable(input: {
    id: "..."
    description: "Updated description"
  }) {
    success
  }
}
```

**2. Node Operations**
```graphql
# Create node
mutation {
  createNode(input: {
    tableId: "..."
    title: "Test Node"
    content: "Day 4 test"
  }) {
    success
    node { id title }
  }
}

# Query nodes
query {
  nodes(tableId: "...") {
    id
    title
    content
  }
}

# Search nodes
query {
  searchNodes(tableId: "...", searchQuery: {
    textSearch: "test"
    limit: 10
  }) {
    nodes {
      node { id title }
    }
  }
}
```

**3. Attribute Operations**
```graphql
# Create attribute type
mutation {
  createAttributeType(input: {
    identifier: "test-attr"
    name: "Test Attribute"
    dataType: "string"
  }) {
    success
    attributeType { id }
  }
}

# Create attribute
mutation {
  createAttribute(input: {
    tableId: "..."
    identifier: "test-attr"
    name: "Test"
    attributeTypeId: "..."
  }) {
    success
  }
}
```

**4. Relation Operations**
```graphql
# Create relation type
mutation {
  createRelationType(input: {
    identifier: "test-relation"
    name: "Test Relation"
  }) {
    success
  }
}

# Create relation
mutation {
  createRelation(input: {
    fromNodeId: "..."
    toNodeId: "..."
    relationshipType: "test-relation"
  }) {
    success
  }
}
```

**5. Template Operations**
```graphql
# Create template
mutation {
  createTemplate(input: {
    identifier: "test-template-day4"
    name: "Day 4 Test Template"
    query: "query { healthCheck { status } }"
    tags: ["test", "day4"]
  }) {
    success
    template { id }
  }
}

# Execute template
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "test-template-day4"
    variables: {}
  ) {
    success
    data
  }
}
```

**6. Doc Operations**
```graphql
# Create doc
mutation {
  createDoc(input: {
    tableId: "..."
    title: "Test Doc"
    content: "Day 4 documentation test"
    docType: "guide"
  }) {
    success
    doc { id }
  }
}

# Query docs
query {
  getDocs(tableId: "...") {
    id
    title
    content
  }
}
```

#### Validation Checklist

For each operation:
- ✅ Request succeeds (no errors)
- ✅ Response matches expected schema
- ✅ Data is persisted correctly
- ✅ Field resolvers work correctly
- ✅ Related entities are accessible

---

## 📋 Testing Checklist

### Pre-Testing Setup
- [ ] Stop any running dev servers
- [ ] Clear any test database data (if needed)
- [ ] Verify git branch is correct
- [ ] Ensure latest code is compiled

### Phase 1: Server Startup
- [ ] Server starts without errors
- [ ] Health check responds correctly
- [ ] System status available
- [ ] GraphQL introspection works
- [ ] No console errors or warnings

### Phase 2: Integration Tests
- [ ] System queries integration (15 tests)
- [ ] Relation queries isolated (11 tests)
- [ ] Unit tests system queries (40 tests)
- [ ] Full test suite (76+ tests)
- [ ] All tests passing or issues documented

### Phase 3: Performance Benchmarks
- [ ] Simple query benchmark
- [ ] Complex query benchmark
- [ ] Mutation benchmark
- [ ] Results meet target metrics
- [ ] No performance regressions

### Phase 4: API Validation
- [ ] Table operations validated
- [ ] Node operations validated
- [ ] Attribute operations validated
- [ ] Relation operations validated
- [ ] Template operations validated
- [ ] Doc operations validated

### Documentation
- [ ] Performance metrics documented
- [ ] Test results recorded
- [ ] Issues/bugs logged
- [ ] Day 4 completion summary created

---

## ⚠️ Risk Mitigation

### Potential Issues & Solutions

**Issue**: Server fails to start
- **Cause**: DI dependency resolution failure
- **Solution**: Check GraphQLModule.ts registrations, verify all dependencies available
- **Fallback**: Temporarily disable problematic unified resolver

**Issue**: Tests fail with "method not found"
- **Cause**: Method name mismatch between unified and old resolvers
- **Solution**: Check unified resolver method naming (e.g., `_field` suffix)
- **Fallback**: Update method name or use old resolver temporarily

**Issue**: Performance regression
- **Cause**: Additional overhead in unified resolver pattern
- **Solution**: Profile code, optimize hot paths
- **Fallback**: Document performance characteristics, optimize in Day 5

**Issue**: API behavior changed
- **Cause**: Unified resolver logic differs from old resolver
- **Solution**: Review unified resolver implementation, align with old behavior
- **Fallback**: Update tests if change is intentional

---

## 📊 Expected Outcomes

### Optimistic Scenario (90% probability)
- ✅ Server starts successfully
- ✅ 95%+ tests pass
- ✅ Performance on par or better
- ✅ API functionality validated
- ✅ Ready for Day 5 cleanup

### Realistic Scenario (8% probability)
- ✅ Server starts successfully
- ⚠️ 80-95% tests pass (minor issues)
- ⚠️ Performance similar (±10%)
- ✅ Core API functionality works
- 📝 Minor fixes needed before Day 5

### Pessimistic Scenario (2% probability)
- ⚠️ Server starts with warnings
- ❌ <80% tests pass (major issues)
- ❌ Performance regression >10%
- ⚠️ API issues discovered
- 🔧 Significant fixes required

---

## 📝 Documentation Requirements

### Performance Report Template
```markdown
# Day 4 Performance Benchmarks

## Test Environment
- Date: 2025-11-23
- Bun Version: ...
- Node Count: ...
- Database Size: ...

## Results

### Simple Query (healthCheck)
- Avg: X ms
- P50: X ms
- P95: X ms
- P99: X ms

### Complex Query (tables with relations)
- Avg: X ms
- P50: X ms
- P95: X ms

### Mutation (createNode)
- Avg: X ms
- P50: X ms

## Comparison
- Unified vs Old: X% difference
- Assessment: [Better/Same/Worse]
```

### Test Results Template
```markdown
# Day 4 Test Results

## Integration Tests
- System Queries: X/15 passing
- Relation Queries: X/11 passing
- Unit Tests: X/40 passing
- Full Suite: X/76 passing

## Issues Found
1. [Issue description]
   - Test: ...
   - Error: ...
   - Fix: ...
```

---

## 🎯 Success Definition

**Day 4 Complete When**:
✅ Server starts and runs without errors
✅ Health check endpoint responding correctly
✅ Integration tests: ≥90% passing (target: 100%)
✅ Performance: No significant regressions
✅ API validation: All core operations working
✅ Day 4 completion document created
✅ Ready to proceed to Day 5 cleanup

---

**Next Steps After Day 4**:
- **If successful**: Proceed to Day 5 (cleanup old resolvers)
- **If issues found**: Fix critical issues, retest, then proceed
- **If major problems**: Revert to feature flag OFF, investigate thoroughly

---

**Document Owner**: Claude Code Framework
**Created**: 2025-11-23
**Status**: Ready for execution
**Estimated Time**: 2-3 hours
