# NODE 템플릿 개선 리포트

**개선 일시**: 2025-09-19T03:19:00.934Z
**개선된 템플릿 수**: 2개

## 개선된 템플릿 목록

| 템플릿명 | 사용횟수 | 개선 내용 |
|---------|---------|----------|
| create-node-with-params | 736회 | Cannot query field "tableId" on type "TableNode" |
| update-node-with-params | 899회 | Variable "$input" got invalid value { title: "...", content: "..." }; Field "title" is not defined by type "UpdateNodeInput" |

## 개선 내용

### 1. create-node-with-params
- **문제**: TableNode에서 tableId 필드 쿼리 시도
- **해결**: CreateNodeInput 구조에 맞게 input 객체 사용
- **변경사항**:
  - 쿼리 구조를 `createNode(input: CreateNodeInput!)` 형태로 변경
  - 변수 스키마 재정의
  - 기본값 추가

### 2. update-node-with-params
- **문제**: UpdateNodeInput에 없는 title 필드 사용
- **해결**: content 필드만 사용하도록 수정
- **변경사항**:
  - 불필요한 title 필드 제거
  - content 필드만 포함한 input 구조
  - 변수 스키마 및 기본값 재정의

## 스키마 호환성

모든 NODE 템플릿이 현재 GraphQL 스키마와 호환되도록 수정되었습니다:
- ✅ TableNode 타입 필드 정확히 매칭
- ✅ Input 타입 구조 준수
- ✅ 변수 스키마 정의 완료
- ✅ 기본값 제공으로 테스트 가능

## 테스트 방법

```bash
# NODE 템플릿 테스트 실행
bun run scripts/test-templates.ts

# 개별 템플릿 테스트
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "...", "variables": {...}}'
```

---
*자동 생성됨 by improve-node-templates.ts*
