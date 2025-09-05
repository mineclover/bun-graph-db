# Template-Driven Test Architecture

## 개념

템플릿 시스템을 활용하여 모든 테스트 쿼리를 템플릿으로 관리하고 실행하는 테스트 아키텍처입니다. 이를 통해 테스트 코드를 간소화하고 재사용성을 높입니다.

## 핵심 원리

1. **모든 쿼리는 템플릿으로**: 반복적으로 사용되는 GraphQL 쿼리/뮤테이션을 템플릿으로 저장
2. **템플릿 실행 기반 테스트**: 직접 GraphQL 호출 대신 템플릿 실행을 통한 테스트
3. **변수 주입으로 다양한 시나리오**: 같은 템플릿에 다른 변수를 주입하여 다양한 테스트 케이스 생성
4. **템플릿 라이프사이클 관리**: 테스트 전용 템플릿의 생성/실행/정리 자동화

## 아키텍처 구조

```
Template-Driven Test Framework
├── Template Registry (테스트 템플릿 저장소)
│   ├── Query Templates (조회 템플릿)
│   ├── Mutation Templates (변경 템플릿)
│   └── Complex Scenario Templates (복합 시나리오 템플릿)
│
├── Template Executor (템플릿 실행기)
│   ├── Template Creation (템플릿 생성)
│   ├── Template Execution (템플릿 실행)
│   └── Result Validation (결과 검증)
│
├── Test Scenarios (테스트 시나리오)
│   ├── CRUD Operations (기본 CRUD)
│   ├── Business Logic Tests (비즈니스 로직)
│   └── Integration Tests (통합 테스트)
│
└── Template Lifecycle Manager (템플릿 생명주기 관리)
    ├── Setup (테스트 전 템플릿 준비)
    ├── Execution (테스트 실행)
    └── Cleanup (테스트 후 정리)
```

## 테스트 시나리오 분류

### 1. 기본 CRUD 템플릿
```yaml
templates:
  - identifier: "test-get-table"
    purpose: "테이블 조회 테스트"
    query: "query GetTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }"
    
  - identifier: "test-create-node"  
    purpose: "노드 생성 테스트"
    query: "mutation CreateNode($tableId: ID!, $content: String!, $title: String!) { createNode(input: { tableId: $tableId, content: $content, title: $title }) { id content title } }"
    
  - identifier: "test-search-nodes"
    purpose: "노드 검색 테스트"
    query: "query SearchNodes($tableId: ID!, $filter: NodeFilter) { nodes(tableId: $tableId, filter: $filter) { nodes { id content } totalCount } }"
```

### 2. 비즈니스 로직 템플릿
```yaml
templates:
  - identifier: "test-node-relationships"
    purpose: "노드 관계 테스트"
    query: "query NodeRelations($nodeId: ID!) { node(id: $nodeId) { relations { target { id } strength confidence } } }"
    
  - identifier: "test-attribute-operations" 
    purpose: "속성 관리 테스트"
    query: "mutation SetAttribute($nodeId: ID!, $attributeId: ID!, $value: JSON!) { setNodeAttribute(input: { nodeId: $nodeId, attributeId: $attributeId, value: $value }) { id value } }"
```

### 3. 성능 및 스케일 테스트 템플릿
```yaml
templates:
  - identifier: "test-bulk-operations"
    purpose: "대량 데이터 처리 테스트"
    query: "mutation BulkCreateNodes($input: [CreateNodeInput!]!) { bulkCreateNodes(input: $input) { success count errors } }"
    
  - identifier: "test-complex-search"
    purpose: "복합 검색 성능 테스트"  
    query: "query ComplexSearch($filters: SearchFilters!) { search(filters: $filters) { nodes { id content relations { target { id } } } performance { executionTime complexity } } }"
```

## 테스트 실행 패턴

### Pattern 1: 단일 템플릿 실행
```typescript
async function testSingleTemplate() {
  const template = await templateRegistry.get('test-get-table')
  const result = await templateExecutor.execute(template, { tableId: '1' })
  expect(result.success).toBe(true)
  expect(result.data.table).toBeDefined()
}
```

### Pattern 2: 템플릿 체인 실행
```typescript
async function testTemplateChain() {
  // 1. 테이블 생성
  const createResult = await templateExecutor.execute('test-create-table', { 
    identifier: 'test-table', 
    description: 'Test table' 
  })
  
  // 2. 노드 추가
  const nodeResult = await templateExecutor.execute('test-create-node', {
    tableId: createResult.data.createTable.id,
    content: 'Test node',
    title: 'Test'
  })
  
  // 3. 검증 쿼리
  const verifyResult = await templateExecutor.execute('test-get-table', {
    tableId: createResult.data.createTable.id
  })
  
  expect(verifyResult.data.table.nodeCount).toBe(1)
}
```

### Pattern 3: 매개변수 변형 테스트
```typescript
async function testParameterVariations() {
  const testCases = [
    { tableId: '1', expectedNodes: 5 },
    { tableId: '2', expectedNodes: 10 },
    { tableId: '3', expectedNodes: 0 }
  ]
  
  for (const testCase of testCases) {
    const result = await templateExecutor.execute('test-get-table', testCase)
    expect(result.data.table.nodeCount).toBe(testCase.expectedNodes)
  }
}
```

## 장점

1. **테스트 코드 간소화**: 복잡한 GraphQL 쿼리를 템플릿으로 추상화
2. **재사용성 증대**: 동일한 템플릿을 다양한 매개변수로 재사용
3. **유지보수성 향상**: 쿼리 변경 시 템플릿만 수정하면 모든 테스트에 적용
4. **일관성 보장**: 모든 테스트가 동일한 템플릿 실행 패턴 사용
5. **성능 최적화**: 템플릿 시스템의 캐싱과 최적화 기능 활용
6. **테스트 메타데이터**: 템플릿 실행 시간, 복잡도 등 자동 수집

## 구현 전략

1. **Phase 1**: 기본 템플릿 레지스트리 및 실행기 구현
2. **Phase 2**: 기존 테스트를 템플릿 기반으로 전환
3. **Phase 3**: 고급 기능 추가 (체인 실행, 성능 측정, 자동 정리)
4. **Phase 4**: CI/CD 통합 및 템플릿 기반 성능 모니터링

이 아키텍처를 통해 테스트 코드의 복잡성을 크게 줄이고, 템플릿 시스템의 이점을 최대한 활용할 수 있습니다.