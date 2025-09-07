# 실용적인 템플릿 관리 가이드

## 📋 검증된 실무 경험 기반 가이드

이 문서는 실제 `localhost:4000` 환경에서 템플릿 관리 시스템을 검증한 경험을 바탕으로 **실용성과 안정성**을 중심으로 작성되었습니다.

## 🎯 핵심 원칙: 지나친 최적화 경계

### ❌ 피해야 할 과도한 최적화
- **복잡한 JSON 이스케이핑**: curl에서 중첩 JSON 처리는 에러 위험 높음
- **과도한 자동화**: 모든 것을 자동화하려 하지 말고 핵심 기능에 집중
- **완벽한 스키마 검증**: 기본적인 구문 검증으로 충분
- **실시간 동기화**: 필요시 수동 sync로도 충분

### ✅ 실용적인 접근법
- **파일 기반 작업**: JSON 파일 직접 조작이 더 안전하고 예측 가능
- **단계별 검증**: 한 번에 하나씩, 각 단계 검증 후 진행
- **수동 확인 지점**: 중요한 변경사항은 사람이 확인
- **간단한 도구**: 복잡한 기능보다 안정적인 기본 기능

## 🔄 표준 템플릿 작업 루프 (2025-09-07 검증됨)

### **핵심 워크플로우**: 서버 작업 → 검증 & Export
1. **서버에서 템플릿 작업** (GraphQL 뮤테이션으로 생성/수정)
2. **검증 및 Export**: `bun run template:validate-single {template-name}`

### **구체적인 단계별 진행:**
```bash
# 1. 서버 상태 확인
bun run template:check-server

# 2. 백업 생성 (중요한 변경시 권장)
bun run template:backup
# → 저장 위치: demo/templates-backup-YYYYMMDD-HHMMSS/

# 3. 서버에서 템플릿 작업 (createTemplate, updateTemplate 등)

# 4. 검증 + 자동 Export (핵심!)
bun run template:validate-single {template-name}
# → 결과: demo/templates/{template-name}_v1-0-0.json

# 5. 필요시 복원 가이드 확인
bun run template:restore
```

**검증된 안전장치:**
- ✅ **스키마 호환성**: GraphQL 스키마와 템플릿 일치 확인
- ✅ **실행 테스트**: 실제 쿼리 실행으로 동작 검증
- ✅ **자동 백업**: 타임스탬프 기반 백업 디렉토리 생성
- ✅ **완전한 메타데이터**: variables, variablesSchema, defaultVariables 포함

## 🛠️ 검증된 워크플로우

### 1. 기본 템플릿 관리 워크플로우

```bash
# 1. 서버 상태 확인 (필수 첫 단계)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name } } }"}' | jq '.data'

# 2. 기존 템플릿 목록 확인
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates(pagination: { limit: 10 }) { nodes { identifier name usageCount } } }"}' | jq '.data.searchTemplates.nodes'

# 3. 특정 템플릿 실행 테스트
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-health-check\") { success data } }"}' | jq '.data.executeTemplateWithGraphQL.success'
```

### 2. 템플릿 검증 및 Export 시스템 (검증 완료)

#### **A. 개별 템플릿 검증** (권장, 안전)
```bash
# 템플릿 검증 + 자동 Export (스키마 호환성 검증)
bun run template:validate-single {template-identifier}

# 예시: 핵심 템플릿들 검증
bun run template:validate-single search-templates-advanced
bun run template:validate-single list-nodes-by-table
bun run template:validate-single get-table-schema
bun run template:validate-single list-tables-with-pagination
bun run template:validate-single test-health-check
```

**검증된 결과 (2025-09-07 기준):**
- ✅ **5개 핵심 템플릿 100% 검증 통과**
- ✅ GraphQL 스키마 호환성 확인 (Relay → offset pagination 수정 완료)
- ✅ 자동 Export: `demo/templates/{template-identifier}_v1-0-0.json`
- ✅ 실행 시간: 37-57ms (매우 빠름)
- ✅ 완전한 변수 정보 포함 (variables, variablesSchema, defaultVariables)

#### **B. 배치 테스트 시스템**
```bash
# curl-tester를 활용한 배치 테스트 (추가 검증용)
bun demo/curl-tester.ts --batch basic/     # 기본 템플릿들
bun demo/curl-tester.ts --batch advanced/  # 고급 템플릿들

# 전체 테스트 (신중하게 사용)
bun demo/curl-tester.ts --all
```

**배치 테스트 결과:**
- ✅ 파일 자동 생성: `demo/results/`
- ✅ 표준 명명 규칙: `{template-name}_v1-0-0_result.json`
- ✅ 실행 메타데이터: 시간, 통계, 에러 정보

### 3. 서버에서 템플릿 작업 (검증된 쿼리들)

#### **A. 새 템플릿 생성** 
```bash
# 기본 템플릿 생성
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"my-new-template\", name: \"My New Template\", description: \"템플릿 설명\", query: \"query { __typename }\" }) { success template { id identifier name } errors { message } } }"}' | jq '.'

# 변수가 있는 템플릿 생성
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"my-query-template\", name: \"My Query Template\", description: \"변수가 있는 템플릿\", query: \"query MyQuery($tableId: ID!) { tableById(id: $tableId) { id identifier name } }\" }) { success template { id identifier } errors { message } } }"}' | jq '.'
```

#### **B. 기존 템플릿 수정**
```bash
# 템플릿 쿼리 수정
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { updateTemplate(identifier: \"my-template\", input: { query: \"query { __schema { queryType { name } } }\" }) { success template { identifier name query } errors { message } } }"}' | jq '.'

# 템플릿 이름/설명 수정
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { updateTemplate(identifier: \"my-template\", input: { name: \"Updated Template Name\", description: \"업데이트된 설명\" }) { success template { identifier name description } errors { message } } }"}' | jq '.'
```

#### **C. 템플릿 조회**
```bash
# 특정 템플릿 조회
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { templateByIdentifier(identifier: \"search-templates-advanced\") { id identifier name description query operationType isActive } }"}' | jq '.'

# 템플릿 목록 조회
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates(pagination: { limit: 5 }) { templates { identifier name description isActive usageCount } totalCount } }"}' | jq '.'
```

#### **D. 템플릿 실행 테스트**
```bash
# 변수 없는 템플릿 실행
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-health-check\") { success data metadata { executionTime } } }"}' | jq '.'

# 변수가 있는 템플릿 실행
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"get-table-schema\", variables: { \"tableIdentifier\": \"test-table\", \"includeNodes\": true, \"nodeSampleLimit\": 3 }) { success data errors } }"}' | jq '.'
```

**주요 주의사항:**
- `tags` 필드는 현재 스키마에서 지원하지 않음
- 쿼리는 유효한 GraphQL 구문이어야 함
- 식별자는 프로젝트 내 고유해야 함
- 변수가 있는 쿼리는 올바른 GraphQL 변수 구문 사용 (`$변수명: 타입!`)

## 📁 파일 관리 시스템 (검증된 구조)

### 폴더 구조
```
demo/
├── templates/          # Export된 템플릿 백업
│   ├── test-health-check_v1-0-0.json
│   └── validation-test-template_manual.json
├── results/            # 실행 결과 기록
│   ├── test-health-check_v1-0-0_result.json
│   └── health-check-dataset-test_v1-0-0_result.json
└── datasets/           # 테스트 데이터셋
    ├── basic/
    ├── advanced/
    └── mutations/
```

### 템플릿 파일 구조 (표준)
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-09-06T18:25:10.815Z",
  "template": {
    "identifier": "template-name",
    "name": "Human Readable Name",
    "description": "Clear description",
    "query": "query MyQuery($param: String!) { ... }",
    "operationType": "query",
    "variables": {
      "param": "example-value"
    },
    "variablesSchema": {
      "param": {
        "type": "string",
        "description": "매개변수 설명",
        "required": true,
        "example": "example-value"
      }
    },
    "defaultVariables": {
      "param": "example-value"
    },
    "complexityScore": 3,
    "statistics": {
      "usageCount": 176,
      "avgExecutionTimeMs": 0,
      "lastUsedAt": "2025-09-06T09:25:10.000Z"
    }
  }
}
```

### 결과 파일 구조 (표준)
```json
{
  "execution": { "success": true, "executionTimeMs": 37 },
  "result": { "data": {...}, "error": null },
  "metadata": { 
    "resultType": "success", 
    "dataSize": 712,
    "serverUrl": "http://localhost:4000/graphql",
    "generatedBy": "curl-template-tester"
  }
}
```

## 🔄 템플릿 동기화 전략

### 현실적인 접근법
1. **수동 트리거**: 자동 동기화보다 필요시 수동 실행
2. **배치 처리**: 한 번에 여러 템플릿 처리
3. **점진적 업데이트**: 전체 재생성보다 변경분만 업데이트
4. **안전장치**: 백업 후 변경, 롤백 가능

### 검증이 필요한 시점
- 새로운 템플릿 추가 시
- 기존 템플릿 쿼리 변경 시  
- 서버 스키마 업데이트 후
- 정기적인 상태 점검 (주 1회 정도)

## ⚠️ 실무에서 발견된 주의사항

### JSON 이스케이핑 문제
```bash
# ❌ 복잡한 중첩 JSON은 curl에서 에러 위험
curl -d '{"query": "mutation { importTemplate(jsonData: \"{\\\"complex\\\": \\\"nested\\\"}\") { ... } }"}'

# ✅ 파일 기반 접근이 안전
cat template.json | jq -c '.' > import_ready.json
# 별도 스크립트에서 파일 내용 읽어서 처리
```

### 스키마 필드 불일치
```bash
# ❌ 존재하지 않는 필드 조회시 에러
curl -d '{"query": "mutation { createTemplate(input: { tags: [...] }) { ... } }"}'
# Error: Field "tags" is not defined

# ✅ 기본 필드만 사용
curl -d '{"query": "mutation { createTemplate(input: { identifier, name, query }) { ... } }"}'
```

### 성능 고려사항
- 단일 템플릿 작업: 37-57ms (매우 빠름)
- 배치 작업: 템플릿당 0.5초 대기 (서버 부하 고려)
- Export 작업: 즉시 완료되지만 파일 저장 시간 추가

## 🛡️ 안전장치 및 에러 처리

### 필수 확인사항
```bash
# 1. 서버 상태 확인 (패키지 명령어 사용)
bun run template:check-server
# 예상 결과: {"errors":[{"message":"Must provide query string.","extensions":{"code":"BAD_REQUEST"}}]}
# → 이 에러 메시지가 나오면 서버가 정상 작동 중

# 2. 템플릿 변경 전 백업 생성
bun run template:backup
# 실행 결과: demo/templates → demo/templates-backup-YYYYMMDD-HHMMSS/ 복사
# 예시: demo/templates-backup-20250907-111741/

# 3. 템플릿 검증 (변경 전/후 필수)
bun run template:validate-single {template-identifier}
# 예시: bun run template:validate-single search-templates-advanced

# 4. 복원 방법 확인 (필요시)
bun run template:restore
# 사용법 가이드 출력: cp -r demo/templates-backup-YYYYMMDD-HHMMSS demo/templates
```

#### **백업 시스템 세부사항**
**백업 파일 구조:**
```bash
demo/templates-backup-20250907-111741/  # 타임스탬프 기반 디렉토리명
├── search-templates-advanced_v1-0-0.json
├── list-nodes-by-table_v1-0-0.json
├── get-table-schema_v1-0-0.json
└── ... (모든 템플릿 파일들)
```

**복원 방법:**
```bash
# 1. 백업 디렉토리 확인
ls -la demo/templates-backup-*

# 2. 특정 백업으로 복원
cp -r demo/templates-backup-20250907-111741 demo/templates

# 3. 복원 후 검증
bun run template:validate-single {template-name}
```

**검증된 안전장치들:**
- ✅ **타임스탬프 백업**: `YYYYMMDD-HHMMSS` 형식으로 고유한 백업 디렉토리 생성
- ✅ **전체 디렉토리 복사**: `demo/templates/` 전체를 안전하게 백업
- ✅ **스키마 호환성 검증**: GraphQL 스키마와 템플릿 호환성 확인  
- ✅ **실행 테스트**: 실제 쿼리 실행으로 동작 검증
- ✅ **자동 Export**: 검증 통과시에만 파일 저장

### 에러 패턴 인식
- **"Cannot query field"**: 스키마 필드명 불일치
- **"POST body sent invalid JSON"**: JSON 이스케이핑 문제
- **"Template not found"**: 존재하지 않는 템플릿 식별자

## 🎯 권장 개발 워크플로우

### ✅ 표준 템플릿 작업 루프 (2025-09-07 최종 검증)

#### **핵심 2단계: 서버 작업 → 검증 & Export**

**Phase 1: 준비 및 서버 작업**
```bash
# 1. 서버 상태 확인
bun run template:check-server

# 2. 백업 생성 (중요한 변경시)
bun run template:backup
# → 결과: demo/templates-backup-YYYYMMDD-HHMMSS/

# 3. 서버에서 템플릿 작업
# createTemplate, updateTemplate, 또는 executeTemplateWithGraphQL 사용
# (위의 "서버에서 템플릿 작업" 섹션 참조)
```

**Phase 2: 검증 및 Export**
```bash
# 4. 검증 + 자동 Export (핵심!)
bun run template:validate-single {template-identifier}
# 예시: bun run template:validate-single my-new-template

# → 자동 결과:
# ✅ 템플릿 발견: Template Name
# ✅ 실행 테스트 통과  
# 📁 Export 완료: demo/templates/{template-identifier}_v1-0-0.json
```

**선택사항: 추가 검증**
```bash
# 5. 배치 테스트 (선택사항)
bun demo/curl-tester.ts {template-file}.json

# 6. 복원 (문제 발생시)
cp -r demo/templates-backup-YYYYMMDD-HHMMSS demo/templates
```

#### **완전 자동화된 워크플로우**
이 루프는 **서버 → 검증 → Export**의 **자동화된 흐름**으로:
- ✅ 스키마 호환성 자동 검증
- ✅ 실행 테스트 자동 수행
- ✅ 성공시 자동 Export (실패시 중단)
- ✅ 완전한 메타데이터 자동 생성

### 문제 해결 접근법
1. **단계별 확인**: 각 단계마다 결과 확인
2. **로그 분석**: jq로 응답 구조 파악
3. **단순화**: 복잡한 쿼리를 단순한 형태로 분해
4. **수동 검증**: 자동화 실패시 수동으로 확인

## 📚 다음 단계 개발 방향

### 실용적인 도구 개발 계획
1. ✅ **파일 기반 Import 도구**: JSON 이스케이핑 문제 해결 완료
2. ✅ **동기화 스크립트**: 기존 export 파일들 최신 상태로 업데이트 완료
3. ✅ **배치 Export**: 여러 템플릿 일괄 내보내기 완료
4. ✅ **변수 의존성 확장**: 템플릿별 변수 정보 완전 구조화 완료
5. ✅ **기본 관리 템플릿**: searchTemplates, createTemplate, executeTemplateWithGraphQL 등 기본 작업용 템플릿 완료
6. **상태 점검 도구**: 정기적인 템플릿 상태 확인
7. **변수 유효성 검증**: 스키마 기반 변수값 검증 도구

### 확장하지 않을 것들
- 실시간 동기화 (복잡성 대비 효용 낮음)
- 완전 자동화된 Import (에러 위험 높음)
- 복잡한 스키마 검증 (기본 검증으로 충분)
- 과도한 성능 최적화 (현재 성능 충분)

## 🎯 템플릿 기반 안정적 조회 및 사용

### 왜 템플릿을 사용해야 하는가?
- ✅ **일관된 쿼리 구조**: 스키마 변경에도 안정적
- ✅ **검증된 쿼리**: 이미 작동하는 것이 확인된 쿼리 사용
- ✅ **재사용성**: 동일한 패턴의 반복 작업 최소화
- ✅ **유지보수성**: 중앙화된 쿼리 관리
- ✅ **안전성**: 직접 쿼리보다 템플릿 실행이 더 안전

### 핵심 관리 템플릿들

#### 1. **템플릿 목록 조회** (`search-templates-advanced`)
```bash
# 기본 템플릿 검색 (권장)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\", variables: { \"pagination\": { \"limit\": 10 } }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'

# 특정 태그로 필터링
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\", variables: { \"filter\": { \"tags\": [\"server\"] } }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'
```

#### 2. **시스템 상태 확인** (`test-health-check`)
```bash
# 헬스체크 (변수 없음)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-health-check\") { success data metadata { executionTime } } }"}' | jq '.data.executeTemplateWithGraphQL'
```

#### 3. **테이블 관리** (`list-tables-with-pagination`)
```bash
# 페이지네이션으로 테이블 목록
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"list-tables-with-pagination\", variables: { \"limit\": 5, \"offset\": 0 }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'
```

#### 4. **노드 검색** (`test-search-nodes`)
```bash
# 노드 검색 (필터와 제한)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-search-nodes\", variables: { \"filter\": \"\", \"limit\": 10 }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'
```

#### 5. **변수가 있는 템플릿 실행 예시**
```bash
# 테이블 스키마 조회 (복합 변수)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"get-table-schema\", variables: { \"tableIdentifier\": \"test-table\", \"includeNodes\": true, \"nodeSampleLimit\": 3 }) { success data errors } }"}' | jq '.'

# 테이블별 노드 목록 (페이지네이션)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"list-nodes-by-table\", variables: { \"tableIdentifier\": \"test-table\", \"pagination\": { \"limit\": 5, \"offset\": 0 } }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'

# 고급 템플릿 검색 (필터 및 정렬)
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\", variables: { \"filter\": { \"isActive\": true }, \"pagination\": { \"limit\": 5 }, \"sort\": [{ \"field\": \"usageCount\", \"direction\": \"DESC\" }] }) { success data } }"}' | jq '.data.executeTemplateWithGraphQL.data'
```

### 템플릿 기반 워크플로우 패턴

#### **안전한 개발 패턴**
1. **기존 템플릿 확인**: `search-templates-advanced`로 사용 가능한 템플릿 조회
2. **변수 스키마 확인**: 템플릿 파일의 `variablesSchema`로 필요한 변수 파악
3. **변수 검증**: `defaultVariables`를 기준으로 올바른 변수값 준비
4. **템플릿 실행**: `executeTemplateWithGraphQL`로 안전한 실행
5. **결과 검증**: `success` 필드로 성공/실패 확인
6. **에러 처리**: `errors` 필드로 상세 에러 정보 확인

#### **배치 작업 패턴**
```bash
# 1. 템플릿 목록 확인
TEMPLATES=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\") { data } }"}')

# 2. 각 템플릿별 작업 수행
echo $TEMPLATES | jq -r '.data.executeTemplateWithGraphQL.data.searchTemplates.nodes[].identifier' | while read template; do
  echo "Processing: $template"
  # 템플릿별 작업 수행
done
```

### 실용적인 도구 사용법

#### **Export 도구** - 백업 및 버전 관리용
```bash
# 모든 활성 템플릿 export (변수 정보 포함)
bun scripts/template-export.ts all --output ./backups/$(date +%Y%m%d)

# 특정 템플릿만 export
bun scripts/template-export.ts templates test-health-check search-templates-advanced
```

#### **Import 도구** - 안전한 템플릿 복구
```bash
# 단일 파일 import (충돌시 새 ID 생성)
bun scripts/template-import.ts file ./backups/my-template.json --generate-id

# 디렉토리 일괄 import (기존 템플릿 덮어쓰기)
bun scripts/template-import.ts dir ./backups/templates --overwrite

# 변수 정보가 포함된 템플릿 검증 및 import
bun scripts/template-import.ts validate ./templates/ --check-variables
```

#### **검증 시스템** - 배포 전 안전 확인
```bash
# 템플릿 파일 유효성 검사 (변수 스키마 포함)
bun scripts/template-import.ts validate ./templates/

# 변수 의존성 분석
find demo/templates -name "*.json" -exec grep -l '$' {} \; | xargs -I {} sh -c 'echo "=== {} ==="; cat "{}" | jq -r ".template.query" | grep -o "\$[a-zA-Z][a-zA-Z0-9_]*" | sort -u'

# curl-tester로 실제 실행 테스트
bun demo/curl-tester.ts --batch basic/
```

## 🔧 템플릿 변수 의존성 확장 가이드

### 템플릿에 변수 정보 추가하기

#### 1. **기본 변수 구조**
모든 변수가 필요한 템플릿은 다음 3가지 섹션을 포함해야 합니다:

```json
{
  "template": {
    "variables": {
      // 실제 실행에 사용할 변수값들
      "tableId": "1",
      "filter": "검색어"
    },
    "variablesSchema": {
      // 변수들의 스키마 정의 (타입, 설명, 검증 규칙)
      "tableId": {
        "type": "ID!",
        "description": "조회할 테이블의 고유 ID",
        "required": true,
        "example": "1"
      },
      "filter": {
        "type": "string",
        "description": "검색 필터 텍스트"
      }
    },
    "defaultVariables": {
      // 기본값들 (variables와 동일한 구조)
      "tableId": "1",
      "filter": ""
    }
  }
}
```

#### 2. **변수 타입별 확장 패턴**

##### **단일 값 변수**
```json
"variables": { "tableId": "1" },
"variablesSchema": {
  "tableId": {
    "type": "ID!",
    "description": "테이블 식별자",
    "required": true,
    "example": "1"
  }
},
"defaultVariables": { "tableId": "1" }
```

##### **객체 타입 변수** (pagination, input 등)
```json
"variables": {
  "pagination": { "limit": 20, "offset": 0 }
},
"variablesSchema": {
  "pagination": {
    "type": "object",
    "description": "페이지네이션 옵션",
    "properties": {
      "limit": {
        "type": "integer",
        "description": "페이지당 결과 개수",
        "minimum": 1,
        "maximum": 100,
        "default": 20
      },
      "offset": {
        "type": "integer",
        "description": "건너뛸 결과 개수",
        "minimum": 0,
        "default": 0
      }
    }
  }
},
"defaultVariables": {
  "pagination": { "limit": 20, "offset": 0 }
}
```

##### **복합 입력 객체** (mutation input)
```json
"variables": {
  "input": {
    "identifier": "test-table",
    "description": "테스트 테이블"
  }
},
"variablesSchema": {
  "input": {
    "type": "object",
    "description": "테이블 생성 입력",
    "required": true,
    "properties": {
      "identifier": {
        "type": "string",
        "description": "테이블 식별자",
        "required": true
      },
      "description": {
        "type": "string",
        "description": "테이블 설명"
      }
    }
  }
},
"defaultVariables": {
  "input": {
    "identifier": "test-table",
    "description": "테스트 테이블"
  }
}
```

#### 3. **확장 작업 체크리스트**

##### **변수 추출하기**
```bash
# GraphQL 쿼리에서 변수 추출
cat template.json | jq -r '.template.query' | grep -o '\$[a-zA-Z][a-zA-Z0-9_]*' | sort -u
```

##### **각 변수별 정보 정의**
1. **GraphQL 타입 확인**: 쿼리에서 변수 타입 확인 (`$var: Type!`)
2. **적절한 기본값 설정**: 실제 사용 가능한 값으로 설정
3. **한국어 설명 작성**: 사용자가 이해할 수 있는 명확한 설명
4. **검증 규칙 추가**: `required`, `minimum`, `maximum`, `enum` 등
5. **예제 값 제공**: `example` 필드로 사용법 안내

##### **operationType 정정**
```bash
# mutation 쿼리는 operationType을 "mutation"으로 수정
sed -i 's/"operationType": "query"/"operationType": "mutation"/' template.json
```

#### 4. **확장된 템플릿 검증**

```bash
# 1. JSON 구조 검증
jq empty template.json && echo "✅ Valid JSON" || echo "❌ Invalid JSON"

# 2. 필수 필드 존재 확인
jq -e '.template.variables and .template.variablesSchema and .template.defaultVariables' template.json

# 3. 템플릿 실행 테스트
bun demo/curl-tester.ts template.json

# 4. Import 테스트
bun scripts/template-import.ts validate template.json
```

#### 5. **자동화 도구 활용**

##### **배치 변수 확장 스크립트 예제**
```bash
#!/bin/bash
# 모든 템플릿에서 변수 의존성 분석
find demo/templates -name "*.json" | while read file; do
  echo "=== $file ==="
  
  # 변수 추출
  vars=$(cat "$file" | jq -r '.template.query' | grep -o '\$[a-zA-Z][a-zA-Z0-9_]*' | sort -u)
  
  if [ ! -z "$vars" ]; then
    echo "Variables found: $vars"
    
    # variables가 null인지 확인
    if [ "$(cat "$file" | jq '.template.variables')" = "null" ]; then
      echo "⚠️  Needs variable extension"
    else
      echo "✅ Already has variable info"
    fi
  else
    echo "No variables"
  fi
  echo
done
```

### 실제 적용된 템플릿 예시

#### **완전히 확장된 템플릿**: `get-table-schema_v1-0-0.json`
- ✅ 3개 변수: `tableIdentifier`, `includeNodes`, `nodeSampleLimit`
- ✅ 완전한 스키마 정의: 타입, 설명, 기본값, 검증 규칙
- ✅ 실행 가능한 기본값 제공
- ✅ 한국어 설명으로 사용성 향상

#### **기본 관리용 템플릿들**

##### 1. **`basic-search-templates_v1-0-0.json`** - 기본 템플릿 검색
```json
{
  "identifier": "basic-search-templates",
  "operationType": "query",
  "variables": {
    "pagination": { "limit": 10, "offset": 0 },
    "filter": ""
  },
  "description": "기본적인 템플릿 검색으로 사용 가능한 템플릿 목록 조회"
}
```
**사용 예시:**
```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates(pagination: {limit: 5}) { nodes { identifier name usageCount } totalCount } }"}' | jq '.'
```

##### 2. **`create-template-basic_v1-0-0.json`** - 기본 템플릿 생성
```json
{
  "identifier": "create-template-basic",
  "operationType": "mutation",
  "variables": {
    "input": {
      "identifier": "new-template",
      "name": "New Template",
      "description": "A new template for testing",
      "query": "query { __typename }"
    }
  },
  "description": "기본적인 새 템플릿 생성"
}
```
**사용 예시:**
```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: {identifier: \"my-test\", name: \"My Test\", description: \"test\", query: \"query { __typename }\"}) { success template { id identifier } errors { message } } }"}' | jq '.'
```

##### 3. **`execute-template-with-variables_v1-0-0.json`** - 변수와 함께 템플릿 실행
```json
{
  "identifier": "execute-template-with-variables",
  "operationType": "mutation",
  "variables": {
    "templateIdentifier": "test-health-check",
    "variables": {}
  },
  "description": "변수와 함께 기존 템플릿 실행하기"
}
```
**사용 예시:**
```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-health-check\") { success data } }"}' | jq '.'
```

##### 4. **`schema-introspection_v1-0-0.json`** - 스키마 구조 확인
```json
{
  "identifier": "schema-introspection",
  "operationType": "query",
  "variables": null,
  "description": "GraphQL 스키마 구조 확인 및 서버 상태 검증용 쿼리"
}
```
**사용 예시:**
```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name fields { name } } mutationType { name fields { name } } } }"}' | jq '.data.__schema | {queryFields: .queryType.fields | length, mutationFields: .mutationType.fields | length}'
```

##### 5. **`simple-health-check_v1-0-0.json`** - 간단한 연결 테스트
```json
{
  "identifier": "simple-health-check",
  "operationType": "query",
  "variables": null,
  "description": "가장 간단한 서버 연결 상태 확인 쿼리"
}
```
**사용 예시:**
```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name } } }"}' | jq '.data'
```

#### **변수 확장 완료 목록**

##### **데이터 관리 템플릿들**
- `get-table-attributes-by-id_v1-0-0.json` → tableId
- `get-table-attributes-by-identifier_v1-0-0.json` → tableIdentifier  
- `get-table-nodes-by-id_v1-0-0.json` → tableId, pagination
- `get-table-nodes-by-identifier_v1-0-0.json` → tableIdentifier, pagination
- `list-tables-with-pagination_v1-0-0.json` → pagination, filter, sort options
- `get-table-schema_v1-0-0.json` → tableIdentifier, includeNodes, nodeSampleLimit
- `test-get-table_v1-0-0.json` → tableId
- `list-nodes-by-table_v1-0-0.json` → tableIdentifier, pagination, filter
- `test-create-node_v1-0-0.json` → input (complex object)
- `test-create-table_v1-0-0.json` → input (complex object)
- `search-templates-advanced_v1-0-0.json` → filter, pagination, sort (nested schema)

##### **기본 관리 템플릿들**
- `basic-search-templates_v1-0-0.json` → pagination, filter (기본 검색)
- `create-template-basic_v1-0-0.json` → input (CreateQueryTemplateInput)
- `execute-template-with-variables_v1-0-0.json` → templateIdentifier, variables
- `schema-introspection_v1-0-0.json` → variables 없음 (스키마 구조 확인)
- `simple-health-check_v1-0-0.json` → variables 없음 (간단한 연결 테스트)

### 확장의 실용적 가치

1. **개발 효율성**: 변수 구조를 미리 알 수 있어 빠른 개발
2. **문서화 자동화**: 템플릿 자체가 API 문서 역할
3. **검증 강화**: 스키마 기반 입력값 검증
4. **재사용성 증대**: 명확한 변수 정의로 다양한 컨텍스트에서 재사용
5. **오류 감소**: 타입과 제약사항이 명시되어 런타임 오류 방지
6. **기본 관리 운영**: 기본적인 CRUD 작업들이 템플릿으로 표준화되어 일관된 개발 경험
7. **디버깅 용이성**: 스키마 구조 확인, 연결 테스트 등이 템플릿으로 제공

이 가이드는 **실제 동작하는 코드와 검증된 워크플로우**를 바탕으로 작성되었으며, 실무에서 바로 활용 가능한 실용적인 접근법을 제시합니다.