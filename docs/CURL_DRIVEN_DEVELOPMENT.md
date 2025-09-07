# Curl-Driven Development (CDD) 방법론

## 📋 개요

**Curl-Driven Development (CDD)**는 GraphQL API 개발에서 curl 명령어를 사용해 즉시 구현을 검증하는 개발 방법론입니다. 빠른 피드백 루프와 실제 사용성 검증을 통해 안정적이고 사용자 친화적인 API를 구축합니다.

## 🔄 CDD 개발 사이클

### 1. **Design** (설계)
```javascript
// 기능 설계
const featureSpec = {
  name: "Template Query Update",
  purpose: "템플릿의 쿼리만 업데이트하는 전용 뮤테이션",
  inputs: ["templateId", "newQuery", "updateVariables"],
  outputs: ["success", "template", "previousQuery", "errors"]
};
```

### 2. **Implement** (구현)
```typescript
// GraphQL 스키마 정의
updateTemplateQuery(
  templateId: ID
  templateIdentifier: String  
  newQuery: String!
  updateVariables: JSON
): UpdateTemplateQueryPayload!

// 리졸버 구현
async updateTemplateQuery(args) {
  // 구현 로직...
  return { success, template, previousQuery, errors };
}
```

### 3. **Test** (curl 검증)
```bash
# 즉시 검증
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { updateTemplateQuery(templateId: \"194\", newQuery: \"...\") { success previousQuery } }"}'
```

### 4. **Verify** (결과 분석)
```json
// 성공 응답 분석
{
  "data": {
    "updateTemplateQuery": {
      "success": true,
      "template": {"id": "194", "identifier": "..."},
      "previousQuery": "query OldQuery { ... }",
      "errors": []
    }
  }
}
```

### 5. **Document** (문서화)
```markdown
# 검증된 curl 명령어를 가이드에 추가
mutation UpdateTemplateQuery {
  updateTemplateQuery(templateId: "194", newQuery: "...") {
    success
    previousQuery
  }
}
```

## 🛠️ CDD 실무 적용 사례

### 사례 1: GraphQL 스키마 필드명 불일치 해결

#### 문제 발견
```bash
# 테스트 중 오류 발견
curl -X POST http://localhost:4000/graphql \
  -d '{"query": "mutation { updateTemplate(id: \"194\", input: { query: \"...\" }) { template { queryText } } }"}'

# 결과: {"errors":[{"message":"Cannot query field \"queryText\"..."}]}
```

#### 원인 분석
- GraphQL 스키마: `query` 필드
- TypeScript 구현: `queryText` 필드
- **필드명 불일치** 발견

#### 해결 구현
```typescript
// 필드 매핑 추가
if (args.input.query !== undefined) {
  updateData.queryText = args.input.query;  // GraphQL → TypeScript 매핑
}
```

#### 즉시 검증
```bash
# 수정된 코드 검증
curl -X POST http://localhost:4000/graphql \
  -d '{"query": "mutation { updateTemplate(id: \"194\", input: { query: \"...\" }) { success template { query } } }"}'

# 결과: {"data":{"updateTemplate":{"success":true,...}}} ✅
```

### 사례 2: 새 뮤테이션 리졸버 연결 누락

#### 문제 발견
```bash
# 새 뮤테이션 테스트
curl -X POST http://localhost:4000/graphql \
  -d '{"query": "mutation { updateTemplateQuery(...) { success } }"}'

# 결과: {"errors":[{"message":"Cannot return null for non-nullable field Mutation.updateTemplateQuery"}]}
```

#### 원인 분석  
- GraphQL 스키마: `updateTemplateQuery` 정의됨
- 리졸버 구현: 메서드 존재함
- **GraphQLSchemaBuilder**: 리졸버 매핑 누락

#### 해결 구현
```typescript
// GraphQLSchemaBuilder.ts에 리졸버 연결 추가
Mutation: {
  updateTemplate: (_: any, args: any) => deps.templateMutations.updateTemplate(_, args),
  updateTemplateQuery: (_: any, args: any) => deps.templateMutations.updateTemplateQuery(_, args), // 추가
}
```

#### 즉시 검증
```bash
# 연결 확인
curl -X POST http://localhost:4000/graphql \
  -d '{"query": "mutation { updateTemplateQuery(templateId: \"194\", newQuery: \"...\") { success previousQuery } }"}'

# 결과: {"data":{"updateTemplateQuery":{"success":true,...}}} ✅
```

## 🎯 CDD의 핵심 원칙

### 1. **즉시 검증 (Immediate Verification)**
```bash
# 구현 후 즉시 테스트 (30초 이내)
# 개발 → curl → 결과 확인 → 다음 단계
```

### 2. **실제 사용성 검증 (Real-world Usability)**
```bash
# 클라이언트 관점에서 API 테스트
# 복잡한 테스트 도구 없이 순수 HTTP 요청으로 검증
```

### 3. **문서화 자동화 (Documentation as Code)**
```bash
# 검증된 curl 명령어 = 실행 가능한 문서
# 개발자가 바로 복사해서 사용 가능
```

### 4. **점진적 구축 (Incremental Building)**
```bash
# 작은 기능 단위로 구현 → 검증 → 누적
# 대규모 리팩토링보다 안전한 점진적 개선
```

## 🚀 CDD 모범 사례

### curl 명령어 작성 규칙

#### ✅ Good Examples
```bash
# 1. 명확한 주석
# 템플릿 쿼리 업데이트 (롤백 지원)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { updateTemplateQuery(templateId: \"194\", newQuery: \"...\") { success previousQuery errors { message } } }"}'

# 2. 완전한 응답 필드
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: {...}) { success template { id identifier name } errors { message } } }"}'

# 3. 변수 사용 예제 포함
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation ExecuteTemplate($identifier: String!, $vars: JSON) { executeTemplateWithGraphQL(templateIdentifier: $identifier, variables: $vars) { success data } }", "variables": {"identifier": "my-template", "vars": {"limit": 10}}}'
```

#### ❌ Bad Examples
```bash
# 불완전한 응답 필드
curl localhost:4000/graphql -d '{"query": "mutation { updateTemplate(...) { success } }"}'

# 에러 처리 누락
curl localhost:4000/graphql -d '{"query": "mutation { createTemplate(...) { template { id } } }"}'

# 주석 없는 복잡한 쿼리
curl localhost:4000/graphql -d '{"query": "mutation{executeTemplateWithGraphQL(templateIdentifier:\"complex-query\"){success data metadata{executionTime}}}"}'
```

## 📊 CDD 효과 측정

### 개발 속도 지표
- **피드백 시간**: 구현 완료 → 검증 완료 (목표: <30초)
- **버그 발견 시간**: 구현 → 문제 발견 (목표: <1분)
- **문서화 자동화**: 검증된 curl → 가이드 문서 (목표: 100%)

### 품질 지표
- **API 일관성**: GraphQL 스키마 ↔ 실제 구현 일치율
- **사용성**: 첫 사용자가 curl만으로 API 사용 가능 여부
- **안정성**: 프로덕션 배포 전 모든 엔드포인트 curl 검증 완료

## 🔧 CDD 도구 및 환경 설정

### 개발 환경 요구사항
```bash
# 1. 실시간 서버 재로드
bun run dev --watch

# 2. GraphQL 서버 실행
# http://localhost:4000/graphql

# 3. curl 또는 HTTPie 설치
brew install curl httpie
```

### 자동화 스크립트 예제
```bash
#!/bin/bash
# test-api.sh - API 자동 검증 스크립트

echo "🚀 API 검증 시작..."

# 1. Health Check
echo "📊 Health Check"
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name } } }"}' | jq '.data'

# 2. Template Operations
echo "📋 Template Operations"  
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates(pagination: { limit: 3 }) { nodes { identifier name } } }"}' | jq '.data.searchTemplates.nodes'

# 3. CRUD Operations Test
echo "✏️ CRUD Test"
# Create → Read → Update → Delete 순서로 검증

echo "✅ 모든 API 검증 완료"
```

## 📚 관련 방법론

### Test-Driven Development (TDD)와의 비교
| 측면 | TDD | CDD |
|------|-----|-----|
| **검증 도구** | Unit Tests | curl + HTTP |
| **피드백 속도** | 중간 (컴파일 + 테스트 실행) | 빠름 (HTTP 요청) |
| **실제 사용성** | 간접적 | 직접적 |
| **문서화** | 별도 필요 | 자동 생성됨 |
| **적용 범위** | 코드 로직 | API 인터페이스 |

### API-First Development와의 관계
- **OpenAPI/Swagger**: 스키마 정의 → 구현
- **CDD**: 구현 → curl 검증 → 문서화
- **결합**: OpenAPI 스키마 + CDD 검증 = 완전한 API 개발

## 🎓 CDD 학습 경로

### 초급 (Basic)
1. **Simple Queries**: 단순 조회 쿼리 curl 작성
2. **Basic Mutations**: 생성/수정/삭제 뮤테이션 검증
3. **Error Handling**: 에러 응답 확인 및 처리

### 중급 (Intermediate)  
1. **Complex Queries**: 중첩 쿼리, 필터링, 페이지네이션
2. **Variable Usage**: GraphQL 변수 활용한 동적 쿼리
3. **Response Analysis**: 응답 구조 분석 및 최적화

### 고급 (Advanced)
1. **Performance Testing**: 성능 테스트를 위한 curl 스크립팅
2. **Automation**: CI/CD 파이프라인에 curl 검증 통합
3. **Documentation**: 자동 문서화 시스템 구축

## 🌟 결론

**Curl-Driven Development**는 GraphQL API 개발에서 매우 효과적인 방법론입니다:

- ✅ **빠른 피드백**: 30초 이내 구현 검증
- ✅ **실제 사용성**: 클라이언트 관점에서 API 테스트  
- ✅ **자동 문서화**: 검증된 curl = 실행 가능한 문서
- ✅ **점진적 개발**: 안전한 단계별 구축
- ✅ **높은 품질**: 실제 HTTP 요청으로 완전한 검증

이 방법론을 통해 더 안정적이고 사용자 친화적인 GraphQL API를 구축할 수 있습니다.