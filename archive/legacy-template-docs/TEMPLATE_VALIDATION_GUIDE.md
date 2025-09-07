# 템플릿 검증 및 Export 가이드

GraphQL 템플릿의 자동 검증, 수정, 그리고 export를 위한 통합 시스템입니다.

## 🎯 목표

1. **Proactive Validation**: 오류 발생 전에 미리 검증
2. **Automated Fixes**: 일반적인 문제들 자동 수정
3. **Consistent Export**: 검증된 템플릿만 export
4. **Developer Experience**: 단순하고 직관적인 워크플로우

## 📋 시스템 구성요소

### 1. TemplateValidator (`scripts/template-validator.ts`)
- **GraphQL 스키마 동적 로드**: 실시간 스키마 introspection
- **쿼리 검증**: 구문 분석 및 스키마 호환성 검사
- **실행 테스트**: 실제 쿼리 실행으로 동작 확인
- **자동 Export**: 검증 통과 시 템플릿 파일 생성

### 2. TemplateFixer (`scripts/template-fixer.ts`)
- **패턴 기반 자동 수정**: 일반적인 문제들 자동 감지 및 수정
- **일괄 처리**: 여러 템플릿 동시 수정
- **검증 통합**: 수정 후 자동 검증 및 export

## 🚀 사용 방법

### 기본 명령어

```bash
# 단일 템플릿 검증 및 export
bun run template:validate-single search-templates-advanced

# 여러 템플릿 일괄 검증
bun run template:validate-batch search-templates-advanced list-nodes-by-table

# 자동 수정 및 export
bun run template:fix-and-export batch
```

### 고급 사용법

```bash
# 환경변수로 설정 변경
GRAPHQL_ENDPOINT=http://localhost:4001/graphql bun run template:validate-single my-template

# 출력 디렉토리 변경
TEMPLATE_OUTPUT_DIR=./custom-templates bun run template:validate-batch template1 template2
```

## 📝 워크플로우 예시

### 1. 새 템플릿 검증 워크플로우

```bash
# 1단계: 개별 템플릿 검증
bun run template:validate-single search-templates-advanced

# 결과 예시:
# 🔍 템플릿 검증 시작: search-templates-advanced
# ✅ GraphQL 스키마 로드 완료
# 📋 쿼리 검증 완료: ✅ 통과
# 🧪 실행 테스트 완료: ✅ 성공
# 📁 Export 완료: ./demo/templates/search-templates-advanced_v1-0-0.json
# ✅ 검증 및 Export 완료!
```

### 2. 문제 해결 워크플로우

```bash
# 1단계: 자동 수정 시도
bun run template:fix-and-export fix search-templates-advanced

# 결과 예시:
# 🔧 템플릿 자동 수정 시작: search-templates-advanced
# 📋 GraphQL 스키마 로드 완료
# 🎯 수정 패턴 적용: Relay 스타일 pagination을 offset 방식으로 변환
# 🎯 수정 패턴 적용: 잘못된 변수 타입 자동 교정
# ✅ 템플릿 수정 완료: relay-to-offset-pagination, variable-type-correction
# 📁 Export 완료: ./demo/templates/search-templates-advanced_v1-0-0.json
```

### 3. 일괄 처리 워크플로우

```bash
# 모든 주요 템플릿 검증 및 export
bun run template:validate-batch \
  search-templates-advanced \
  list-nodes-by-table \
  get-table-schema \
  list-tables-with-pagination

# 또는 자동 수정 포함 일괄 처리
bun run template:fix-and-export batch
```

## 🔧 자동 수정 기능

### 지원하는 수정 패턴

1. **Relay → Offset Pagination 변환**
   ```graphql
   # 수정 전
   query($first: Int!, $after: String) {
     searchTemplates(first: $first, after: $after) {
       nodes { ... }
       hasNextPage
     }
   }
   
   # 수정 후  
   query($limit: Int, $offset: Int) {
     searchTemplates(pagination: {limit: $limit, offset: $offset}) {
       templates { ... }
       hasMore
     }
   }
   ```

2. **변수 타입 자동 교정**
   ```graphql
   # 수정 전: $templateId: String!
   # 수정 후: $templateId: ID!
   ```

3. **필드명 자동 교정**
   ```graphql
   # 수정 전: nodes { ... }
   # 수정 후: templates { ... }
   ```

4. **SearchTemplates 쿼리 구조 자동 변환**
   - 잘못된 매개변수 구조를 올바른 `$filter`, `$pagination`, `$sort` 형태로 변환

## 📊 검증 결과 해석

### 성공 사례
```
✅ search-templates-advanced: 검증 통과
   - 쿼리 구문: 통과
   - 스키마 호환성: 통과  
   - 실행 테스트: 통과
   - Export: 완료
```

### 실패 사례 및 해결
```
❌ my-template: 검증 실패
   오류: Unknown argument "first" on field "searchTemplates"
   
→ 해결: bun run template:fix-and-export fix my-template
```

### 경고 사례
```
⚠️ slow-template: 성능 경고
   - 실행 시간: 1500ms (권장: <1000ms)
   - 제안: 인덱스 최적화 검토 필요
```

## 🎛️ 설정 옵션

### 환경변수

```bash
# GraphQL 엔드포인트 (기본값: http://localhost:4000/graphql)
GRAPHQL_ENDPOINT=http://localhost:4001/graphql

# 템플릿 출력 디렉토리 (기본값: ./demo/templates) 
TEMPLATE_OUTPUT_DIR=./custom-output

# 검증 모드 설정
TEMPLATE_VALIDATE_VARIABLES=true
TEMPLATE_VALIDATE_QUERY=true
TEMPLATE_AUTO_FIX=false
```

### 설정 파일 예시 (`template-validator.config.json`)

```json
{
  "graphqlEndpoint": "http://localhost:4000/graphql",
  "outputDir": "./demo/templates",
  "validateVariables": true,
  "validateQuery": true,
  "autoFix": true,
  "fixPatterns": {
    "relayPagination": true,
    "variableTypes": true,
    "fieldNames": true
  }
}
```

## 🛠️ 커스텀 수정 패턴 추가

새로운 수정 패턴을 추가하려면 `TemplateFixer` 클래스의 `initializeFixPatterns` 메서드를 확장:

```typescript
{
  name: 'my-custom-fix',
  description: '커스텀 문제 해결',
  detect: (query, variables) => {
    // 문제 감지 로직
    return query.includes('problematic-pattern');
  },
  fix: (query, variables) => {
    // 수정 로직
    const fixedQuery = query.replace('problematic-pattern', 'fixed-pattern');
    return { query: fixedQuery, variables };
  }
}
```

## 📈 CI/CD 통합

### GitHub Actions 예시

```yaml
name: Template Validation
on: [push, pull_request]

jobs:
  validate-templates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run dev &  # GraphQL 서버 시작
      - run: sleep 10      # 서버 시작 대기
      - run: bun run template:validate-batch search-templates-advanced list-nodes-by-table
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# 변경된 템플릿 파일 검증
changed_templates=$(git diff --cached --name-only | grep "demo/templates" | cut -d'_' -f1 | sort -u)

if [ -n "$changed_templates" ]; then
  echo "🔍 변경된 템플릿 검증 중..."
  for template in $changed_templates; do
    bun run template:validate-single "$template" || exit 1
  done
fi
```

## 🐛 문제 해결

### 일반적인 문제들

1. **GraphQL 서버 연결 실패**
   ```bash
   # 서버 상태 확인
   curl -X POST http://localhost:4000/graphql -d '{"query":"query{__typename}"}'
   
   # 다른 포트 시도
   GRAPHQL_ENDPOINT=http://localhost:4001/graphql bun run template:validate-single my-template
   ```

2. **스키마 불일치**
   ```bash
   # 스키마 새로고침
   bun run schema:update
   
   # 수동 수정 시도
   bun run template:fix-and-export fix my-template
   ```

3. **Export 권한 오류**
   ```bash
   # 출력 디렉토리 권한 확인
   ls -la demo/templates/
   
   # 디렉토리 생성
   mkdir -p demo/templates/
   ```

## 📋 체크리스트

### 새 템플릿 추가시
- [ ] 기본 구문 검사: `bun run template:validate-single <name>`
- [ ] 실행 테스트: 실제 변수로 테스트
- [ ] 성능 확인: 1초 이내 실행 확인
- [ ] Export 검증: demo/templates에 파일 생성 확인

### 템플릿 수정시
- [ ] 자동 수정 시도: `bun run template:fix-and-export fix <name>`
- [ ] 수동 검증: 수정 후 재검증
- [ ] 백업 확인: 이전 버전 보관
- [ ] 문서 업데이트: 변경사항 기록

## 🔄 주기적인 유지보수

```bash
# 주간 일괄 검증 (cron job 예시)
0 2 * * 1 cd /path/to/project && bun run template:validate-batch search-templates-advanced list-nodes-by-table get-table-schema list-tables-with-pagination

# 월간 전체 템플릿 정리
bun run template:fix-and-export batch
```

이 시스템으로 템플릿 품질을 자동으로 관리하고, 일관된 export 프로세스를 유지할 수 있습니다.