# ✏️ GraphQL Mutations Reference

Mutation은 데이터를 생성, 수정, 삭제하는 쓰기 연산입니다. 트랜잭션 처리와 검증이 적용되며 연관 데이터가 자동으로 업데이트됩니다.

## 🗂️ 테이블 관리

### `createTable` - 테이블 생성

**설명**: 새로운 테이블을 생성하고 스키마를 설정합니다.

**타입**: `CreateTablePayload!`

**파라미터**:
- `input: CreateTableInput!` - 테이블 생성 정보

#### 예제

```graphql
mutation CreateTable($input: CreateTableInput!) {
  createTable(input: $input) {
    success
    table {
      id
      identifier
      name
      description
      createdAt
      nodeCount
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "identifier": "users_table",
    "name": "사용자 테이블",
    "description": "시스템 사용자 정보를 관리하는 테이블",
    "attributeTypes": [
      {
        "name": "email",
        "dataType": "STRING",
        "isRequired": true,
        "validation": {
          "pattern": "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$"
        }
      },
      {
        "name": "age",
        "dataType": "NUMBER",
        "isRequired": false,
        "defaultValue": "0"
      }
    ]
  }
}
```

**응답 예시**:
```json
{
  "data": {
    "createTable": {
      "success": true,
      "table": {
        "id": "table_123",
        "identifier": "users_table",
        "name": "사용자 테이블",
        "description": "시스템 사용자 정보를 관리하는 테이블",
        "createdAt": "2025-09-06T12:00:00.000Z",
        "nodeCount": 0
      },
      "errors": []
    }
  }
}
```

### `updateTable` - 테이블 수정

**설명**: 기존 테이블의 메타데이터를 수정합니다.

**타입**: `UpdateTablePayload!`

**파라미터**:
- `input: UpdateTableInput!` - 테이블 수정 정보

#### 예제

```graphql
mutation UpdateTable($input: UpdateTableInput!) {
  updateTable(input: $input) {
    success
    table {
      id
      name
      description
      updatedAt
    }
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "table_123",
    "name": "고급 사용자 테이블",
    "description": "확장된 사용자 프로필 정보 관리"
  }
}
```

### `deleteTable` - 테이블 삭제

**설명**: 테이블과 관련된 모든 데이터를 삭제합니다.

**타입**: `DeleteTablePayload!`

**파라미터**:
- `input: DeleteTableInput!` - 삭제할 테이블 정보

#### 예제

```graphql
mutation DeleteTable($input: DeleteTableInput!) {
  deleteTable(input: $input) {
    success
    deletedId
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "table_123",
    "confirmDeletion": true
  }
}
```

---

## 🔗 노드 관리

### `createNode` - 노드 생성

**설명**: 테이블에 새로운 노드를 생성하고 속성을 설정합니다.

**타입**: `CreateNodePayload!`

**파라미터**:
- `input: CreateNodeInput!` - 노드 생성 정보

#### 예제

**기본 노드 생성**:
```graphql
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      createdAt
      
      # 생성된 속성들
      attributes {
        id
        name
        value
        type {
          name
          dataType
        }
      }
      
      # 테이블 정보
      table {
        id
        name
      }
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "tableId": "table_123",
    "content": "김철수 사용자 프로필",
    "attributes": [
      {
        "name": "email",
        "value": "kimcs@example.com"
      },
      {
        "name": "age",
        "value": "28"
      }
    ]
  }
}
```

**속성과 관계를 포함한 노드 생성**:
```graphql
mutation CreateNodeWithRelations($input: CreateNodeWithRelationsInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      
      # 생성된 속성
      attributes {
        name
        value
      }
      
      # 생성된 관계들
      outgoingRelations {
        id
        strength
        confidence
        targetNode {
          id
          content
        }
        type {
          name
        }
      }
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "tableId": "table_123",
    "content": "프로젝트 매니저",
    "attributes": [
      {
        "name": "role",
        "value": "manager"
      }
    ],
    "relations": [
      {
        "targetNodeId": "node_456",
        "relationTypeId": "relation_type_1",
        "strength": 0.9,
        "confidence": 0.85,
        "description": "직접 관리 관계"
      }
    ]
  }
}
```

### `updateNode` - 노드 수정

**설명**: 기존 노드의 내용과 속성을 수정합니다.

**타입**: `UpdateNodePayload!`

**파라미터**:
- `input: UpdateNodeInput!` - 노드 수정 정보

#### 예제

```graphql
mutation UpdateNode($input: UpdateNodeInput!) {
  updateNode(input: $input) {
    success
    node {
      id
      content
      updatedAt
      
      # 수정된 속성들
      attributes {
        name
        value
      }
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "node_123",
    "content": "김철수 시니어 사용자",
    "attributes": [
      {
        "name": "age",
        "value": "29"
      },
      {
        "name": "level",
        "value": "senior"
      }
    ]
  }
}
```

### `deleteNode` - 노드 삭제

**설명**: 노드와 관련된 모든 관계를 삭제합니다.

**타입**: `DeleteNodePayload!`

**파라미터**:
- `input: DeleteNodeInput!` - 삭제할 노드 정보

#### 예제

```graphql
mutation DeleteNode($input: DeleteNodeInput!) {
  deleteNode(input: $input) {
    success
    deletedId
    affectedRelations  # 삭제된 관계 수
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "node_123",
    "deleteRelations": true
  }
}
```

---

## 🕸️ 관계 관리

### `createRelation` - 관계 생성

**설명**: 두 노드 간의 관계를 생성합니다.

**타입**: `CreateRelationPayload!`

**파라미터**:
- `input: CreateRelationInput!` - 관계 생성 정보

#### 예제

```graphql
mutation CreateRelation($input: CreateRelationInput!) {
  createRelation(input: $input) {
    success
    relation {
      id
      strength
      confidence
      description
      createdAt
      
      # 관계 타입
      type {
        id
        name
        description
      }
      
      # 연결된 노드들
      sourceNode {
        id
        content
      }
      targetNode {
        id
        content
      }
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "sourceNodeId": "node_123",
    "targetNodeId": "node_456",
    "relationTypeId": "relation_type_1",
    "strength": 0.8,
    "confidence": 0.9,
    "description": "협업 관계",
    "metadata": {
      "duration": "6개월",
      "frequency": "매일"
    }
  }
}
```

### `updateRelation` - 관계 수정

**설명**: 기존 관계의 강도, 신뢰도, 설명을 수정합니다.

**타입**: `UpdateRelationPayload!`

**파라미터**:
- `input: UpdateRelationInput!` - 관계 수정 정보

#### 예제

```graphql
mutation UpdateRelation($input: UpdateRelationInput!) {
  updateRelation(input: $input) {
    success
    relation {
      id
      strength
      confidence
      description
      updatedAt
    }
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "relation_123",
    "strength": 0.95,
    "confidence": 0.92,
    "description": "강화된 협업 관계"
  }
}
```

### `deleteRelation` - 관계 삭제

**설명**: 특정 관계를 삭제합니다.

**타입**: `DeleteRelationPayload!`

**파라미터**:
- `input: DeleteRelationInput!` - 삭제할 관계 정보

#### 예제

```graphql
mutation DeleteRelation($input: DeleteRelationInput!) {
  deleteRelation(input: $input) {
    success
    deletedId
    errors {
      message
      code
    }
  }
}
```

---

## 🏷️ 속성 관리

### `createAttributeType` - 속성 타입 생성

**설명**: 테이블의 새로운 속성 타입을 생성합니다.

**타입**: `CreateAttributeTypePayload!`

**파라미터**:
- `input: CreateAttributeTypeInput!` - 속성 타입 생성 정보

#### 예제

```graphql
mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
  createAttributeType(input: $input) {
    success
    attributeType {
      id
      name
      description
      dataType
      isRequired
      defaultValue
      validation
      
      # 테이블 정보
      table {
        id
        name
      }
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "tableId": "table_123",
    "name": "phone",
    "description": "사용자 전화번호",
    "dataType": "STRING",
    "isRequired": false,
    "validation": {
      "pattern": "^\\+?[1-9]\\d{1,14}$",
      "maxLength": 20
    }
  }
}
```

### `updateAttribute` - 속성 수정

**설명**: 노드의 속성 값을 수정합니다.

**타입**: `UpdateAttributePayload!`

**파라미터**:
- `input: UpdateAttributeInput!` - 속성 수정 정보

#### 예제

```graphql
mutation UpdateAttribute($input: UpdateAttributeInput!) {
  updateAttribute(input: $input) {
    success
    attribute {
      id
      name
      value
      updatedAt
      
      # 속성 타입 정보
      type {
        name
        dataType
        validation
      }
      
      # 소유 노드
      node {
        id
        content
      }
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "attribute_123",
    "value": "+82-10-1234-5678"
  }
}
```

---

## 📋 템플릿 관리

### `createTemplate` - 템플릿 생성

**설명**: 재사용 가능한 쿼리 템플릿을 생성합니다.

**타입**: `CreateQueryTemplatePayload!`

**파라미터**:
- `input: CreateQueryTemplateInput!` - 템플릿 생성 정보

#### 예제

```graphql
mutation CreateTemplate($input: CreateQueryTemplateInput!) {
  createTemplate(input: $input) {
    success
    template {
      id
      identifier
      name
      description
      queryText
      version
      isActive
      
      # 메타데이터
      complexityScore
      estimatedTokens
      category
      tags
      
      # 변수 정보
      defaultVariables
      variableSchema
      
      createdAt
    }
    errors {
      message
      code
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "identifier": "user-activity-report",
    "name": "사용자 활동 리포트",
    "description": "특정 기간 동안의 사용자 활동을 분석하는 템플릿",
    "queryText": "query UserActivityReport($tableId: ID!, $startDate: String!, $endDate: String!) { nodes(filter: { tableId: $tableId, createdAt: { gte: $startDate, lte: $endDate } }) { nodes { id content createdAt attributes { name value } } } }",
    "category": "analytics",
    "tags": ["user", "activity", "report"],
    "defaultVariables": {
      "tableId": "users_table",
      "startDate": "2025-09-01",
      "endDate": "2025-09-06"
    },
    "variableSchema": {
      "tableId": {
        "type": "ID",
        "required": true,
        "description": "분석할 테이블 ID"
      },
      "startDate": {
        "type": "String",
        "required": true,
        "format": "ISO-8601",
        "description": "분석 시작 날짜"
      },
      "endDate": {
        "type": "String",
        "required": true,
        "format": "ISO-8601",
        "description": "분석 종료 날짜"
      }
    }
  }
}
```

### `updateTemplate` - 템플릿 수정

**설명**: 기존 쿼리 템플릿을 수정합니다.

**타입**: `UpdateQueryTemplatePayload!`

**파라미터**:
- `input: UpdateQueryTemplateInput!` - 템플릿 수정 정보

#### 예제

```graphql
mutation UpdateTemplate($input: UpdateQueryTemplateInput!) {
  updateTemplate(input: $input) {
    success
    template {
      id
      identifier
      name
      queryText
      version
      isActive
      updatedAt
    }
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "template_123",
    "name": "고급 사용자 활동 리포트",
    "queryText": "query EnhancedUserActivityReport($tableId: ID!, $startDate: String!, $endDate: String!, $includeRelations: Boolean = false) { nodes(filter: { tableId: $tableId, createdAt: { gte: $startDate, lte: $endDate } }) { nodes { id content createdAt attributes { name value } relations @include(if: $includeRelations) { strength confidence targetNode { id content } } } } }",
    "version": "2.0",
    "isActive": true
  }
}
```

### `executeTemplate` - 템플릿 실행 (Mutation)

**설명**: 쿼리 템플릿을 실행합니다. 사용량 통계가 추적됩니다.

**타입**: `ExecuteQueryTemplatePayload!`

**파라미터**:
- `input: ExecuteQueryTemplateInput!` - 실행 설정

#### 예제

```graphql
mutation ExecuteTemplate(
  $templateId: String!,
  $variables: JSON
) {
  executeTemplate(
    input: {
      templateIdentifier: $templateId
      variables: $variables
      trackUsage: true
    }
  ) {
    success
    data          # 실행 결과 데이터 (JSON)
    errors {
      message
      code
      field
    }
    
    # 메타데이터
    metadata {
      templateId
      templateName
      executionTime
      complexityScore
      usedVariables   # 실제 사용된 변수들
      cacheHit        # 캐시에서 가져왔는지 여부
    }
  }
}
```

**Variables**:
```json
{
  "templateId": "user-activity-report",
  "variables": {
    "tableId": "users_table",
    "startDate": "2025-09-01T00:00:00.000Z",
    "endDate": "2025-09-06T23:59:59.999Z",
    "includeRelations": true
  }
}
```

### `deleteTemplate` - 템플릿 삭제

**설명**: 쿼리 템플릿을 삭제합니다.

**타입**: `DeleteQueryTemplatePayload!`

**파라미터**:
- `input: DeleteQueryTemplateInput!` - 삭제할 템플릿 정보

#### 예제

```graphql
mutation DeleteTemplate($input: DeleteQueryTemplateInput!) {
  deleteTemplate(input: $input) {
    success
    deletedId
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "id": "template_123"
  }
}
```

---

## 📚 문서 관리

### `createDoc` - 문서 생성

**설명**: 테이블에 새로운 문서를 생성합니다.

**타입**: `CreateDocPayload!`

**파라미터**:
- `input: CreateDocInput!` - 문서 생성 정보

#### 예제

```graphql
mutation CreateDoc($input: CreateDocInput!) {
  createDoc(input: $input) {
    success
    doc {
      id
      category
      version
      content
      isActive
      createdAt

      # 테이블 정보
      table {
        id
        identifier
        name
      }
    }
    errors {
      message
      field
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "tableId": "table_123",
    "category": "USAGE",
    "content": "이 테이블은 사용자 정보를 관리하기 위한 테이블입니다. 다음과 같은 기능을 제공합니다:\n\n1. 사용자 기본 정보 저장\n2. 사용자 속성 관리\n3. 사용자 간 관계 설정",
    "version": 1
  }
}
```

**응답 예시**:
```json
{
  "data": {
    "createDoc": {
      "success": true,
      "doc": {
        "id": "doc_123",
        "category": "USAGE",
        "version": 1,
        "content": "이 테이블은 사용자 정보를 관리하기 위한 테이블입니다...",
        "isActive": true,
        "createdAt": "2025-09-16T12:00:00.000Z",
        "table": {
          "id": "table_123",
          "identifier": "users_table",
          "name": "사용자 테이블"
        }
      },
      "errors": []
    }
  }
}
```

### `updateDoc` - 문서 수정

**설명**: 기존 문서의 내용이나 상태를 수정합니다.

**타입**: `UpdateDocPayload!`

**파라미터**:
- `id: ID!` - 문서 ID
- `input: UpdateDocInput!` - 수정할 정보

#### 예제

```graphql
mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
  updateDoc(id: $id, input: $input) {
    success
    doc {
      id
      content
      isActive
      updatedAt
    }
    errors {
      message
      field
    }
  }
}
```

**Variables**:
```json
{
  "id": "doc_123",
  "input": {
    "content": "업데이트된 사용자 테이블 사용법:\n\n1. 사용자 기본 정보 저장\n2. 사용자 속성 관리\n3. 사용자 간 관계 설정\n4. 사용자 권한 관리 (NEW)",
    "isActive": true
  }
}
```

### `deleteDoc` - 문서 삭제

**설명**: 문서를 영구적으로 삭제합니다.

**타입**: `DeleteDocPayload!`

**파라미터**:
- `id: ID!` - 삭제할 문서 ID

#### 예제

```graphql
mutation DeleteDoc($id: ID!) {
  deleteDoc(id: $id) {
    success
    errors {
      message
    }
  }
}
```

**Variables**:
```json
{
  "id": "doc_123"
}
```

### `activateDoc` - 문서 활성화

**설명**: 특정 문서를 활성 상태로 설정하고, 같은 카테고리의 다른 문서들은 비활성화합니다.

**타입**: `ActivateDocPayload!`

**파라미터**:
- `id: ID!` - 활성화할 문서 ID

#### 예제

```graphql
mutation ActivateDoc($id: ID!) {
  activateDoc(id: $id) {
    success
    doc {
      id
      isActive
      category
      version
      content
    }
    errors {
      message
    }
  }
}
```

**Variables**:
```json
{
  "id": "doc_456"
}
```

**비즈니스 규칙**:
- 한 테이블의 같은 카테고리에는 하나의 활성 문서만 존재할 수 있습니다
- 문서를 활성화하면 같은 카테고리의 다른 모든 문서는 자동으로 비활성화됩니다

### 문서 관리 워크플로우 예제

**새 버전 생성 및 활성화**:
```graphql
# 1. 새 버전 생성
mutation CreateNewVersion {
  createDoc(input: {
    tableId: "table_123"
    category: "USAGE"
    content: "개선된 사용법 문서..."
    version: 2
  }) {
    success
    doc {
      id
      version
      isActive
    }
  }
}

# 2. 새 버전 활성화
mutation ActivateNewVersion {
  activateDoc(id: "new_doc_id") {
    success
    doc {
      isActive
      version
    }
  }
}
```

**카테고리별 문서 관리**:
```graphql
# 사용법, 가이드, 예제 문서를 각각 생성
mutation CreateDocumentationSet {
  usage: createDoc(input: {
    tableId: "table_123"
    category: "USAGE"
    content: "테이블 사용법..."
  }) {
    success
    doc { id category }
  }

  guide: createDoc(input: {
    tableId: "table_123"
    category: "GUIDE"
    content: "단계별 가이드..."
  }) {
    success
    doc { id category }
  }

  example: createDoc(input: {
    tableId: "table_123"
    category: "EXAMPLE"
    content: "실제 사용 예제..."
  }) {
    success
    doc { id category }
  }
}
```

---

## 📊 대량 데이터 처리

### `bulkCreateNodes` - 노드 대량 생성

**설명**: 여러 노드를 한 번에 생성합니다.

**타입**: `BulkCreateNodesPayload!`

**파라미터**:
- `input: BulkCreateNodesInput!` - 대량 생성 정보

#### 예제

```graphql
mutation BulkCreateNodes($input: BulkCreateNodesInput!) {
  bulkCreateNodes(input: $input) {
    success
    createdCount
    failedCount
    
    # 생성된 노드들
    nodes {
      id
      content
      createdAt
    }
    
    # 처리 결과
    results {
      success
      nodeId
      error {
        message
        code
      }
    }
    
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "tableId": "users_table",
    "nodes": [
      {
        "content": "사용자 A",
        "attributes": [
          {"name": "email", "value": "userA@example.com"},
          {"name": "age", "value": "25"}
        ]
      },
      {
        "content": "사용자 B", 
        "attributes": [
          {"name": "email", "value": "userB@example.com"},
          {"name": "age", "value": "30"}
        ]
      }
    ]
  }
}
```

### `bulkUpdateNodes` - 노드 대량 수정

**설명**: 여러 노드를 한 번에 수정합니다.

**타입**: `BulkUpdateNodesPayload!`

**파라미터**:
- `input: BulkUpdateNodesInput!` - 대량 수정 정보

#### 예제

```graphql
mutation BulkUpdateNodes($input: BulkUpdateNodesInput!) {
  bulkUpdateNodes(input: $input) {
    success
    updatedCount
    failedCount
    
    results {
      success
      nodeId
      error {
        message
        code
      }
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "updates": [
      {
        "nodeId": "node_123",
        "content": "업데이트된 사용자 A",
        "attributes": [
          {"name": "status", "value": "active"}
        ]
      },
      {
        "nodeId": "node_456", 
        "content": "업데이트된 사용자 B",
        "attributes": [
          {"name": "status", "value": "inactive"}
        ]
      }
    ]
  }
}
```

---

## 📤 데이터 가져오기/내보내기

### `importData` - 데이터 가져오기

**설명**: 외부 데이터를 시스템으로 가져옵니다.

**타입**: `ImportDataPayload!`

**파라미터**:
- `input: ImportDataInput!` - 가져오기 설정

#### 예제

```graphql
mutation ImportData($input: ImportDataInput!) {
  importData(input: $input) {
    success
    importId
    
    # 가져오기 결과
    summary {
      totalRecords
      successfulRecords  
      failedRecords
      tablesCreated
      nodesCreated
      relationsCreated
    }
    
    # 처리 상세
    details {
      tableName
      recordsProcessed
      recordsSucceeded
      recordsFailed
      errors {
        row
        message
        code
      }
    }
    
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "format": "JSON",
    "data": {
      "tables": [
        {
          "identifier": "imported_users",
          "name": "가져온 사용자들",
          "nodes": [
            {
              "content": "가져온 사용자 1",
              "attributes": [
                {"name": "source", "value": "external_system"}
              ]
            }
          ]
        }
      ]
    },
    "options": {
      "createMissingTables": true,
      "updateExistingNodes": false,
      "validateData": true
    }
  }
}
```

### `exportData` - 데이터 내보내기

**설명**: 시스템 데이터를 외부 형식으로 내보냅니다.

**타입**: `ExportDataPayload!`

**파라미터**:
- `input: ExportDataInput!` - 내보내기 설정

#### 예제

```graphql
mutation ExportData($input: ExportDataInput!) {
  exportData(input: $input) {
    success
    exportId
    downloadUrl     # 다운로드 URL
    
    # 내보내기 결과
    summary {
      totalTables
      totalNodes
      totalRelations
      fileSize        # bytes
      format
    }
    
    errors {
      message
      code
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "format": "JSON",
    "tableIds": ["table_123", "table_456"],
    "options": {
      "includeRelations": true,
      "includeAttributes": true,
      "compressOutput": false
    }
  }
}
```

---

## 🚀 성능 최적화 팁

### 1. **트랜잭션 활용**
```graphql
# ✅ 좋은 예 - 관련 작업들을 하나의 mutation으로 처리
mutation CreateUserWithProfile($userData: CreateNodeInput!, $profileData: CreateNodeInput!) {
  createUser: createNode(input: $userData) {
    success
    node { id }
  }
  createProfile: createNode(input: $profileData) {
    success  
    node { id }
  }
}

# ❌ 피해야 할 예 - 여러 개의 분리된 mutation 호출
# (네트워크 오버헤드와 트랜잭션 경계 문제)
```

### 2. **에러 처리 패턴**
```graphql
# 에러 정보를 충분히 요청
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
    }
    errors {
      message    # 사용자 친화적 메시지
      code       # 프로그래밍적 처리용 코드
      field      # 문제가 발생한 필드
    }
  }
}
```

### 3. **대량 처리 최적화**
```graphql
# 대량 데이터는 벌크 연산 사용
mutation ProcessManyNodes {
  bulkCreate: bulkCreateNodes(input: { ... }) {
    success
    createdCount
  }
  
  bulkUpdate: bulkUpdateNodes(input: { ... }) {
    success
    updatedCount  
  }
}
```

### 4. **선택적 필드 요청**
```graphql
# ✅ 필요한 필드만 요청
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id        # 필수
      content   # 필수
      # attributes는 생략 (필요시에만 요청)
    }
  }
}
```

---

## 🔒 보안 및 검증

### 데이터 검증
- 모든 입력 데이터는 스키마 검증을 거칩니다
- 속성 타입의 validation 규칙이 자동 적용됩니다
- SQL Injection 등 보안 위협이 자동 차단됩니다

### 에러 처리
- 비즈니스 규칙 위반: `success: false` + 상세 에러 정보
- 권한 오류: GraphQL 인증 레이어에서 차단
- 데이터 무결성 오류: 트랜잭션 롤백으로 일관성 보장

### 성능 제한
- 대량 처리는 배치 크기 제한 (기본값: 1000개)
- 깊은 중첩 쿼리는 복잡도 점수로 제한
- 타임아웃 설정으로 장시간 실행 방지

---

**다음**: [Subscription 연산 문서](./subscriptions.md) →  
**이전**: [Query 연산 문서](./queries.md) ←