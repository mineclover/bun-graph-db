# 템플릿 기반 데이터 뮤테이션 워크플로우

## 🎯 전체 프로세스 개요

**목표**: JSON으로 정의한 템플릿을 사용해서 대용량 데이터를 체계적으로 생성/수정하는 시스템

## 🔄 상세 워크플로우

### **Step 1: 템플릿 정의** (서버 불필요)

JSON 파일로 재사용 가능한 뮤테이션 템플릿 정의:

```json
{
  "identifier": "create-user-with-profile",
  "name": "Create User with Profile",
  "templateType": "MUTATION",
  "queryText": "mutation CreateUserProfile($tableId: String!, $username: String!, $email: String!, $fullName: String!) { createNode(input: { tableId: $tableId, content: $username, title: $fullName }) { success data { id content } } setEmailAttr: setNodeAttribute(nodeId: $nodeId, attributeId: $emailAttrId, value: $email) { node { id } } }",
  "variablesSchema": {
    "type": "object",
    "properties": {
      "tableId": { "type": "string" },
      "username": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "fullName": { "type": "string" }
    },
    "required": ["tableId", "username", "email"]
  },
  "tags": ["user", "profile", "create"],
  "complexityScore": 4
}
```

### **Step 2: 템플릿 Import** (서버 필요)

```bash
# 1. 서버 시작
bun run dev

# 2. 템플릿을 서버 데이터베이스에 저장
npm run template:import
```

### **Step 3: 데이터셋 준비** (서버 불필요)

```bash
# 대용량 테스트 데이터 생성
npm run dataset:generate

# 생성된 데이터 확인
npm run dataset:stats
```

### **Step 4: 템플릿을 통한 데이터 뮤테이션** (서버 필요)

#### 방법 1: GraphQL 직접 호출
```graphql
mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
  executeTemplate(input: $input) {
    success
    data
    errors { message }
  }
}

# Variables:
{
  "input": {
    "templateIdentifier": "create-user-with-profile",
    "variables": {
      "tableId": "user-table-id",
      "username": "john_doe",
      "email": "john@example.com",
      "fullName": "John Doe"
    },
    "trackUsage": true,
    "validateVariables": true
  }
}
```

#### 방법 2: 프로그래밍 방식 (테스트에서 활용)
```typescript
// 테스트 코드에서
const executeResponse = await fetch('http://localhost:4000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
        executeTemplate(input: $input)
      }
    `,
    variables: {
      input: {
        templateIdentifier: 'create-user-with-profile',
        variables: {
          tableId: testTableId,
          username: userData.username,
          email: userData.email,
          fullName: userData.fullName
        }
      }
    }
  })
})
```

#### 방법 3: 대용량 배치 처리
```typescript
// 데이터셋의 여러 사용자를 템플릿으로 일괄 생성
const users = await datasetHelper.loadFixtures('social', 'medium')
const userNodes = users.fixtures.tables.users

for (const user of userNodes) {
  await executeTemplate('create-user-with-profile', {
    tableId: testTableId,
    username: user.attributes?.username || user.content,
    email: user.attributes?.email || `${user.content}@example.com`,
    fullName: user.attributes?.fullName || user.title
  })
}
```

## 🎯 실제 활용 시나리오

### **시나리오 1: E-commerce 제품 대량 등록**
```bash
# 1. 제품 등록 템플릿 정의
vim datasets/templates/mutations/product-bulk-create.json

# 2. 템플릿 import
npm run template:import

# 3. 제품 데이터셋 준비 (1만개 제품)
npm run dataset:generate

# 4. 템플릿으로 제품 일괄 등록
bun test test/template-based-node-mutations.test.ts
```

### **시나리오 2: 사용자 관계 네트워크 구축**
```typescript
// 1. 사용자 생성 템플릿 실행
await executeTemplate('create-user', userVariables)

// 2. 관계 생성 템플릿 실행  
await executeTemplate('create-friendship', {
  sourceUserId: user1.id,
  targetUserId: user2.id,
  relationshipType: 'follows'
})

// 3. 대용량 소셜 그래프 구축
for (const relationship of socialDataset.relations) {
  await executeTemplate('create-social-relation', relationship)
}
```

## 📊 **프로세스의 핵심 장점**

### **1. 재사용성**
- ✅ 한번 정의한 템플릿으로 무제한 데이터 생성
- ✅ 다양한 환경(개발/테스트/프로덕션)에서 동일한 템플릿 사용

### **2. 일관성**
- ✅ 템플릿 스키마로 데이터 형식 보장
- ✅ 변수 검증으로 오류 사전 방지

### **3. 확장성**
- ✅ 소규모(100개) ~ 대용량(10만개+) 데이터 처리
- ✅ 복잡한 관계형 데이터 구조 지원

### **4. 추적성**
- ✅ 템플릿 사용 통계 자동 수집
- ✅ 실행 결과 및 오류 로깅

## 🧪 **테스트 시나리오 예시**

```typescript
// 실제 테스트 코드에서의 활용
describe('Template-based Data Creation', () => {
  test('should create 1000 users using template', async () => {
    const userDataset = await datasetHelper.loadFixtures('social', 'medium')
    const createdUsers = []
    
    for (const userData of userDataset.fixtures.tables.users.slice(0, 1000)) {
      const result = await executeTemplate('create-user-with-profile', {
        tableId: testTableId,
        username: userData.attributes?.username,
        email: userData.attributes?.email,
        fullName: userData.title
      })
      
      if (result.success) {
        createdUsers.push(result.data)
      }
    }
    
    expect(createdUsers.length).toBe(1000)
    console.log(`✅ Successfully created ${createdUsers.length} users via template`)
  })
})
```

## 🔧 **추가 도구들**

```bash
# 템플릿 관리
npm run template:list         # 사용 가능한 템플릿 목록
npm run template:validate     # 템플릿 문법 검증
npm run template:complexity   # 복잡도 분석

# 데이터셋 관리  
npm run dataset:generate      # 테스트 데이터 생성
npm run dataset:stats         # 데이터 통계
npm run dataset:list          # 사용 가능한 데이터셋

# 전체 워크플로우
npm run template:import       # 템플릿 → 서버 import
bun test test/template-based-node-mutations.test.ts  # 템플릿 실행 테스트
```

이 프로세스를 통해 **JSON 템플릿 정의 → 서버 Import → 대용량 데이터 뮤테이션**의 완전 자동화된 워크플로우가 구현됩니다! 🚀