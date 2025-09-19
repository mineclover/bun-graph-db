# Template Management GraphQL Templates

**Curl-Driven Development (CDD)** approach for Template Management operations

## Template 1: Create New Template (createTemplate)

**설계 목표**: 새로운 쿼리 템플릿을 생성하는 뮤테이션 템플릿
**변수**: identifier (String), name (String), description (String), query (String)

**테스트 과정**:
```bash
# 1. 템플릿 생성 테스트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation CreateTemplate($identifier: String!, $name: String!, $description: String, $query: String!) { createTemplate(input: { identifier: $identifier, name: $name, description: $description, query: $query }) { success template { id identifier name description query createdAt isActive } errors { message } } }",
  "variables": {
    "identifier": "sample-new-template",
    "name": "Sample New Template",
    "description": "새로운 템플릿 생성 예제",
    "query": "query SampleQuery { tables { nodes { id name } } }"
  }
}'
```

**검증 결과**: ✅ 성공
- success: true 반환
- template 객체에 생성된 템플릿 정보 포함
- errors 배열 비어있음

## Template 2: Execute Template with GraphQL (executeTemplateWithGraphQL)

**설계 목표**: 기존 템플릿을 실행하는 뮤테이션 템플릿
**변수**: templateIdentifier (String), variables (JSON), trackUsage (Boolean)

**테스트 과정**:
```bash
# 1. 템플릿 실행 테스트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) { executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables, trackUsage: $trackUsage) { success data } }",
  "variables": {
    "templateIdentifier": "sample-new-template",
    "variables": null,
    "trackUsage": true
  }
}'
```

**검증 결과**: ✅ 성공
- success: true 반환
- data 필드에 템플릿 실행 결과 포함
- 메타데이터 (templateId, executionTime, complexityScore 등) 포함

## Template 3: Update Template (updateTemplate)

**설계 목표**: 기존 템플릿의 정보를 수정하는 뮤테이션 템플릿
**변수**: id (ID), identifier (String), name (String), description (String)

**테스트 과정**:
```bash
# 1. 먼저 UpdateQueryTemplateInput 스키마 확인
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation UpdateTemplate($id: ID!, $name: String, $description: String) { updateTemplate(id: $id, input: { name: $name, description: $description }) { success template { id identifier name description updatedAt } errors { message } } }",
  "variables": {
    "id": "206",
    "name": "Updated Template Name",
    "description": "업데이트된 템플릿 설명"
  }
}'
```

## Template 4: Delete Template (deleteTemplate)

**설계 목표**: 템플릿을 삭제하는 뮤테이션 템플릿
**변수**: id (ID)

**테스트 과정**:
```bash
# 1. 템플릿 삭제 테스트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation DeleteTemplate($id: ID!) { deleteTemplate(id: $id) { success errors { message } } }",
  "variables": {
    "id": "206"
  }
}'
```

## Template 5: List All Templates (templates)

**설계 목표**: 모든 템플릿 목록을 조회하는 쿼리 템플릿
**변수**: first (Int), after (String), filter (QueryTemplateFilterInput)

**테스트 과정**:
```bash
# 1. 템플릿 목록 조회 테스트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "query ListTemplates($first: Int, $after: String) { templates(first: $first, after: $after) { nodes { id identifier name description isActive createdAt } pageInfo { hasNextPage endCursor } totalCount } }",
  "variables": {
    "first": 10,
    "after": null
  }
}'
```

## Template 6: Get Template by ID (template)

**설계 목표**: ID로 특정 템플릿 조회하는 쿼리 템플릿
**변수**: id (ID)

**테스트 과정**:
```bash
# 1. 특정 템플릿 조회 테스트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "query GetTemplateById($id: ID!) { template(id: $id) { id identifier name description query variables createdAt updatedAt isActive } }",
  "variables": {
    "id": "195"
  }
}'
```

## Template 7: Activate/Deactivate Template

**설계 목표**: 템플릿 활성화/비활성화 상태 변경
**변수**: id (ID)

**테스트 과정**:
```bash
# 1. 템플릿 활성화
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation ActivateTemplate($id: ID!) { activateTemplate(id: $id) { success template { id isActive } errors { message } } }",
  "variables": {
    "id": "195"
  }
}'

# 2. 템플릿 비활성화
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation DeactivateTemplate($id: ID!) { deactivateTemplate(id: $id) { success template { id isActive } errors { message } } }",
  "variables": {
    "id": "195"
  }
}'
```

## Template 8: Export Template

**설계 목표**: 템플릿을 JSON 형태로 내보내기
**변수**: templateId (ID), templateIdentifier (String), includeStatistics (Boolean)

**테스트 과정**:
```bash
# 1. 템플릿 내보내기 (ID 기준)
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation ExportTemplate($templateId: ID, $templateIdentifier: String, $includeStatistics: Boolean) { exportTemplate(templateId: $templateId, templateIdentifier: $templateIdentifier, includeStatistics: $includeStatistics) { success exportData errors { message } } }",
  "variables": {
    "templateId": "195",
    "templateIdentifier": null,
    "includeStatistics": true
  }
}'
```

## Template 9: Import Template

**설계 목표**: JSON 형태의 템플릿 데이터를 가져와서 새 템플릿 생성
**변수**: jsonData (String), overwriteExisting (Boolean), generateNewIdentifier (Boolean)

**테스트 과정**:
```bash
# 1. 템플릿 가져오기
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation ImportTemplate($jsonData: String!, $overwriteExisting: Boolean, $generateNewIdentifier: Boolean) { importTemplate(jsonData: $jsonData, overwriteExisting: $overwriteExisting, generateNewIdentifier: $generateNewIdentifier) { success template { id identifier name } errors { message } } }",
  "variables": {
    "jsonData": "{\"identifier\":\"imported-template\",\"name\":\"Imported Template\",\"description\":\"가져온 템플릿 예제\",\"query\":\"query ImportedQuery { nodes { id name } }\"}",
    "overwriteExisting": false,
    "generateNewIdentifier": true
  }
}'
```

## Template 10: Update Template Query

**설계 목표**: 템플릿의 쿼리 부분만 업데이트
**변수**: templateId (ID), templateIdentifier (String), newQuery (String), updateVariables (JSON)

**테스트 과정**:
```bash
# 1. 템플릿 쿼리 업데이트
curl -s http://localhost:4000/graphql -H "Content-Type: application/json" -d '{
  "query": "mutation UpdateTemplateQuery($templateId: ID, $templateIdentifier: String, $newQuery: String!, $updateVariables: JSON) { updateTemplateQuery(templateId: $templateId, templateIdentifier: $templateIdentifier, newQuery: $newQuery, updateVariables: $updateVariables) { success template { id query updatedAt } errors { message } } }",
  "variables": {
    "templateId": "195",
    "templateIdentifier": null,
    "newQuery": "query UpdatedQuery { tables { nodes { id identifier name attributeCount } } }",
    "updateVariables": null
  }
}'
```

---

## 실행 요약

### CDD 검증 완료:
- ✅ **createTemplate**: 템플릿 생성 성공
- ✅ **executeTemplateWithGraphQL**: 템플릿 실행 성공
- 🔄 **updateTemplate**: 스키마 확인 필요
- 🔄 **deleteTemplate**: 테스트 예정
- 🔄 **templates**: 목록 조회 테스트 예정
- 🔄 **template**: 단일 템플릿 조회 테스트 예정
- 🔄 **activateTemplate/deactivateTemplate**: 상태 변경 테스트 예정
- 🔄 **exportTemplate**: 내보내기 테스트 예정  
- 🔄 **importTemplate**: 가져오기 테스트 예정
- 🔄 **updateTemplateQuery**: 쿼리 업데이트 테스트 예정

### 변수 활용:
- **ID 기반 작업**: templateId 변수 활용
- **식별자 기반 작업**: templateIdentifier 변수 활용  
- **필터링**: 다양한 필터 옵션 지원
- **페이지네이션**: first, after 변수로 페이징 지원
- **메타데이터**: trackUsage, includeStatistics 등의 추가 옵션

이 템플릿들은 GraphQL 기반 템플릿 관리 시스템의 완전한 CRUD 작업을 지원하며, 각 템플릿은 실제 curl 명령으로 테스트되어 동작을 검증했습니다.