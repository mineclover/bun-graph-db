# GraphQL 스키마 분석 및 누락된 연산 식별 보고서

## 📋 **요약**

템플릿 플로우 테스트에서 사용하려는 GraphQL 연산들이 현재 서버 스키마에 존재하지 않아 테스트가 실패하고 있습니다. 이 문서는 현재 스키마 분석 결과와 누락된 연산들을 식별하며, 추가가 필요한 이유를 명시합니다.

## 🔍 **현재 GraphQL 스키마 분석**

### **✅ 사용 가능한 연산들**

#### **테이블 관련**
- `createTable(input: CreateTableInput!): CreateTablePayload!` ✅
- `updateTable(id: ID!, input: UpdateTableInput!): UpdateTablePayload!` ✅
- `deleteTable(id: ID!, force: Boolean, cascadeDelete: Boolean): DeleteTablePayload!` ✅
- `table(id: ID!): Table` ✅
- `tables(filter: TablesFilter, pagination: TablesPagination): TablesConnection!` ✅

#### **노드 관련**
- `createNode(input: CreateNodeInput!): CreateNodePayload!` ✅
- `updateNode(id: ID!, input: UpdateNodeInput!): UpdateNodePayload!` ✅
- `deleteNode(id: ID!): DeleteNodePayload!` ✅
- `node(id: ID!): TableNode` ✅
- `nodes(filter: NodesFilter, pagination: NodesPagination): NodesConnection!` ✅
- `setNodeAttribute(input: SetNodeAttributeInput!): SetNodeAttributePayload!` ✅

#### **속성 관련**
- `createAttribute(input: CreateAttributeInput!): CreateAttributePayload!` ✅
- `updateAttribute(id: ID!, input: UpdateAttributeInput!): UpdateAttributePayload!` ✅
- `deleteAttribute(id: ID!): DeleteAttributePayload!` ✅
- `attribute(id: ID!): Attribute` ✅
- `attributes(filter: AttributesFilter, pagination: PaginationInput): AttributesConnection!` ✅

### **❌ 누락된 연산들 (템플릿에서 요구하는 것들)**

#### **1. `defineAttributes` 뮤테이션**
```graphql
# 템플릿에서 요구하는 형태
mutation DefineAttributes($tableId: ID!, $attributes: [AttributeInput!]!) {
  defineAttributes(tableId: $tableId, attributes: $attributes) {
    id
    name
    type
    required
    tableId
  }
}
```

**현재 스키마**: ❌ 존재하지 않음
**대안**: `createAttribute` 뮤테이션을 여러 번 호출해야 함

#### **2. `createNodeWithAttributes` 뮤테이션**
```graphql
# 템플릿에서 요구하는 형태
mutation CreateNodeWithAttributes($tableId: ID!, $attributes: JSON!) {
  createNodeWithAttributes(tableId: $tableId, attributes: $attributes) {
    id
    tableId
    attributes
    createdAt
  }
}
```

**현재 스키마**: ❌ 존재하지 않음
**대안**: `createNode` + `setNodeAttribute` 조합 사용

#### **3. `getNodeWithAttributes` 쿼리**
```graphql
# 템플릿에서 요구하는 형태
query GetNodeWithAttributes($nodeId: ID!) {
  getNodeWithAttributes(nodeId: $nodeId) {
    id
    tableId
    attributes
    createdAt
    updatedAt
  }
}
```

**현재 스키마**: ❌ 존재하지 않음
**대안**: `node(id: ID!)` 쿼리로 `attributes` 필드 조회

#### **4. `deleteNode` 뮤테이션 (파라미터 차이)**
```graphql
# 템플릿에서 요구하는 형태
mutation DeleteNode($nodeId: ID!) {
  deleteNode(nodeId: $nodeId) {
    success
    message
  }
}
```

**현재 스키마**: `deleteNode(id: ID!): DeleteNodePayload!` ✅
**문제**: 반환 타입이 다름 (`DeleteNodePayload` vs `{success, message}`)

## 🎯 **누락된 연산 추가가 필요한 이유**

### **1. 템플릿 플로우 테스트의 완전성**
- **목표**: 5단계 데이터베이스 라이프사이클 테스트
  - 테이블 생성 → 속성 정의 → 노드 생성(속성 포함) → 노드 조회 → 노드 삭제
- **현재 문제**: Step 2, 3, 4에서 사용하는 연산들이 존재하지 않음
- **영향**: 전체 플로우 테스트가 실패하여 시스템 검증 불가

### **2. 개발자 경험 (DX) 개선**
- **현재**: 복잡한 다중 호출 필요
  ```typescript
  // 현재 방식: 3번의 별도 호출
  await createAttribute({ tableId, name: "name", type: "string" })
  await createAttribute({ tableId, name: "email", type: "string" })
  await createAttribute({ tableId, name: "age", type: "integer" })
  ```
- **개선 후**: 단일 호출로 처리
  ```typescript
  // 개선된 방식: 1번의 호출
  await defineAttributes({ tableId, attributes: [...] })
  ```

### **3. 성능 최적화**
- **현재**: N+1 쿼리 문제 발생 가능
- **개선 후**: 배치 처리로 네트워크 오버헤드 감소

### **4. API 일관성**
- **현재**: 비슷한 기능이 다른 패턴으로 구현됨
- **개선 후**: 일관된 API 패턴 제공

## 🛠️ **구현 방안**

### **방안 1: 누락된 연산 추가 (권장)**

#### **1.1 `defineAttributes` 뮤테이션 추가**
```graphql
# 스키마에 추가할 내용
extend type Mutation {
  defineAttributes(tableId: ID!, attributes: [AttributeInput!]!): DefineAttributesPayload!
}

input AttributeInput {
  name: String!
  type: String!
  required: Boolean = false
}

type DefineAttributesPayload implements OperationResult {
  success: Boolean!
  attributes: [Attribute!]!
  errors: [Error!]!
}
```

**구현 위치**: `src/presentation/graphql/mutations/AttributeMutations.ts`
**리졸버**: `defineAttributes` 메서드 추가

#### **1.2 `createNodeWithAttributes` 뮤테이션 추가**
```graphql
# 스키마에 추가할 내용
extend type Mutation {
  createNodeWithAttributes(tableId: ID!, attributes: JSON!): CreateNodeWithAttributesPayload!
}

type CreateNodeWithAttributesPayload implements OperationResult {
  success: Boolean!
  node: TableNode
  errors: [Error!]!
}
```

**구현 위치**: `src/presentation/graphql/mutations/NodeMutations.ts`
**리졸버**: `createNodeWithAttributes` 메서드 추가

#### **1.3 `getNodeWithAttributes` 쿼리 추가**
```graphql
# 스키마에 추가할 내용
extend type Query {
  getNodeWithAttributes(nodeId: ID!): GetNodeWithAttributesPayload!
}

type GetNodeWithAttributesPayload {
  success: Boolean!
  node: TableNode
  errors: [Error!]!
}
```

**구현 위치**: `src/presentation/graphql/resolvers/NodeResolver.ts`
**리졸버**: `getNodeWithAttributes` 메서드 추가

### **방안 2: 기존 연산 활용 (임시 해결책)**

#### **2.1 템플릿 수정**
```yaml
# template-scenarios.yaml 수정
define_attributes:
  identifier: "test-define-attributes"
  name: "Define Table Attributes"
  description: "테이블에 속성 정의 테스트"
  query: |
    mutation CreateAttribute($input: CreateAttributeInput!) {
      createAttribute(input: $input) {
        success
        attribute {
          id
          name
          identifier
        }
        errors {
          message
          code
        }
      }
    }
  # 여러 번 호출하도록 템플릿 수정
```

#### **2.2 TemplateTestRunner 수정**
- 다중 호출을 처리하는 로직 추가
- 배치 처리 기능 구현

## 📊 **우선순위 및 영향도 분석**

### **높은 우선순위 (즉시 구현 필요)**
1. **`defineAttributes`** - 템플릿 플로우의 핵심 기능
2. **`createNodeWithAttributes`** - 노드 생성의 핵심 기능
3. **`getNodeWithAttributes`** - 노드 조회의 핵심 기능

### **중간 우선순위**
1. **`deleteNode` 반환 타입 통일** - API 일관성

### **낮은 우선순위**
1. **성능 최적화** - 현재 기능이 동작한 후 고려

## 🎯 **구현 계획**

### **Phase 1: 핵심 연산 추가 (1-2일)**
- [ ] `defineAttributes` 뮤테이션 구현
- [ ] `createNodeWithAttributes` 뮤테이션 구현
- [ ] `getNodeWithAttributes` 쿼리 구현
- [ ] 스키마 파일 업데이트

### **Phase 2: 테스트 및 검증 (1일)**
- [ ] 템플릿 플로우 테스트 실행
- [ ] 개별 연산 단위 테스트
- [ ] 성능 측정 및 최적화

### **Phase 3: 문서화 및 정리 (0.5일)**
- [ ] API 문서 업데이트
- [ ] 사용 예제 작성
- [ ] 변경사항 커밋

## 🔧 **기술적 세부사항**

### **의존성 주입 설정**
```typescript
// ContainerBootstrap.ts에 추가
container.bind<DefineAttributesUseCase>('DefineAttributesUseCase')
  .to(DefineAttributesUseCase)
  .inSingletonScope()
```

### **Use Case 구현**
```typescript
// src/application/use-cases/DefineAttributesUseCase.ts
export class DefineAttributesUseCase {
  async execute(input: DefineAttributesInput): Promise<DefineAttributesResult> {
    // 배치로 여러 속성 생성
    const attributes = await Promise.all(
      input.attributes.map(attr => 
        this.createAttributeUseCase.execute({
          tableId: input.tableId,
          identifier: attr.name,
          name: attr.name,
          attributeTypeId: await this.getAttributeTypeId(attr.type),
        })
      )
    )
    return { attributes }
  }
}
```

### **에러 처리**
```typescript
// 일관된 에러 처리 패턴
return {
  success: false,
  attributes: [],
  errors: [{
    message: 'Failed to create attributes',
    code: 'DEFINE_ATTRIBUTES_ERROR',
    field: 'attributes'
  }]
}
```

## 📈 **예상 효과**

### **개발 생산성 향상**
- 템플릿 작성 시간 50% 단축
- 테스트 코드 복잡도 감소
- API 사용성 개선

### **시스템 안정성 향상**
- 배치 처리로 트랜잭션 일관성 보장
- 네트워크 오류 감소
- 테스트 신뢰성 향상

### **유지보수성 향상**
- 일관된 API 패턴
- 명확한 에러 처리
- 재사용 가능한 컴포넌트

## 🚀 **결론**

템플릿 플로우 테스트의 성공적인 실행을 위해서는 **3개의 핵심 GraphQL 연산**이 추가로 구현되어야 합니다. 이는 단순한 기능 추가가 아니라 **개발자 경험 개선, 성능 최적화, API 일관성 확보**를 위한 전략적 결정입니다.

**권장사항**: Phase 1의 핵심 연산들을 우선 구현하여 템플릿 플로우 테스트가 정상 동작하도록 한 후, 점진적으로 개선해 나가는 것이 바람직합니다.

---

**문서 작성일**: 2025-09-06  
**작성자**: AI Assistant  
**검토 상태**: 대기 중  
**우선순위**: 높음
