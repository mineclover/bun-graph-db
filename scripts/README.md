# Scripts 디렉토리 관리 문서

bun-graph-db 프로젝트의 모든 스크립트 파일들의 목적과 사용법을 정리한 관리 문서입니다.

## 📁 스크립트 분류 체계

### 🚀 환경 구축 스크립트 (Environment Setup)

#### `setup-test-environment.ts`
**목적**: 완전한 테스트 환경 구축 및 데이터베이스 마이그레이션
```bash
# 사용법
bun run scripts/setup-test-environment.ts [--cleanup]
```
**주요 기능**:
- SQLite 데이터베이스 스키마 초기화
- 성능 인덱스 생성
- 테스트 데이터셋 자동 생성 (nodes, relations, attribute types)
- 쿼리 템플릿 등록 (5개 템플릿)
- 데이터 검증 및 종합 리포트 생성
- `--cleanup` 플래그로 테스트 아티팩트 정리

**출력**: `./data/test-bun-graph-db.sqlite` 생성

#### `setup-test-dataset.ts`
**목적**: Clean Architecture 기반 DI Container를 활용한 프로덕션급 데이터 마이그레이션
```bash
# 사용법
bun run scripts/setup-test-dataset.ts
```
**주요 기능**:
- DI Container 기반 Repository 패턴 활용
- 엔티티 클래스 기반 타입 안전한 데이터 생성
- 다중 도메인 테스트 데이터 구성 (e-commerce, project management 등)
- 관계형 데이터 정합성 보장
- Clean Architecture 레이어 준수

### 🧪 테스트 실행 스크립트 (Test Execution)

**📁 통합된 테스트 구조**: `test/` 디렉토리로 통합 완료 (2025-09-05)
```
test/
├── utils/                           # 테스트 유틸리티
│   ├── GraphQLTestClient.ts         # GraphQL 테스트 클라이언트
│   └── TestDataFixtures.ts          # 테스트 데이터 픽스처
├── unit/                            # 🆕 단위 테스트 (Mock 기반)
│   └── presentation/graphql/        # GraphQL 리졸버 단위 테스트
├── unified-test-runner.ts           # 통합 테스트 러너
├── graphql-comprehensive.test.ts    # 종합 GraphQL 테스트
├── template-based-node-mutations.test.ts # 🆕 템플릿 기반 테스트
├── performance.test.ts              # 성능 테스트
├── relationships.test.ts            # 관계 시스템 테스트
└── query-validator.ts               # 쿼리 검증 도구
```

#### `comprehensive-test-runner.ts`
**목적**: GraphQL API 전체 기능 종합 테스트 실행기
```bash
# 사용법
bun run scripts/comprehensive-test-runner.ts
```
**주요 기능**:
- Export/Import 기능 검증
- Query/Mutation 템플릿 실행 테스트
- 성능 메트릭 측정
- 테스트 결과 리포트 생성
- 테스트 후 자동 cleanup

**노트**: 임시 스크립트로, 테스트 완료 후 삭제 예정

#### `test-templates.ts`
**목적**: 쿼리 템플릿 시스템 전용 테스트
```bash
# 사용법
bun run scripts/test-templates.ts [template-identifier]
```
**주요 기능**:
- 템플릿별 시나리오 테스트
- 변수 치환 검증
- 템플릿 사용량 추적 검증
- 예상 출력값 비교

#### `test-queries.ts`
**목적**: GraphQL 쿼리 실행 및 테스트 도구
```bash
# 사용법
bun run scripts/test-queries.ts [minimal|detailed] [tableId]

# 예시
bun run scripts/test-queries.ts minimal 1
bun run scripts/test-queries.ts detailed 54
```
**주요 기능**:
- 미리 정의된 쿼리 실행
- Minimal/Detailed 모드 지원
- 테이블별 노드 조회 테스트
- GraphQL 응답 검증

#### `run-template-tests.ts`
**목적**: 템플릿 기반 노드 생성 기능 종합 테스트
```bash
# 사용법
bun run scripts/run-template-tests.ts
```
**주요 기능**:
- 서버 상태 확인
- 샘플 템플릿 생성
- 템플릿 기반 뮤테이션 테스트
- 상세한 테스트 결과 리포트

#### 🗂️ **템플릿 시스템 통합** (2025-09-05)
**새로운 구조**: 모든 템플릿 관련 리소스가 `templates/` 디렉토리로 이동
```bash
# 템플릿 CLI 도구 사용
bun templates/tools/template-cli.ts load -e development
bun templates/tools/template-cli.ts list -o table
bun templates/tools/template-cli.ts validate -t basic-nodes-query
bun templates/tools/template-cli.ts info -t create-basic-node

# 기존 스크립트는 호환성 유지
bun run scripts/test-templates.ts
bun run scripts/run-template-tests.ts
```
**주요 기능**:
- 중앙 집중식 템플릿 관리 시스템
- 환경별 템플릿 데이터셋 (production/development/migration)
- JSON Schema 기반 템플릿 검증
- Hot Reload 개발 환경 지원
- CLI 기반 템플릿 관리 도구

#### 🆕 **단위 테스트** (test/unit/)
**목적**: Mock 기반 개별 컴포넌트 단위 테스트
```bash
# 사용법
bun test test/unit/
bun test test/unit/presentation/graphql/mutations/
bun test test/unit/presentation/graphql/queries/
```
**주요 기능**:
- GraphQL 리졸버별 독립적 테스트
- Mock 객체를 통한 격리된 테스트
- NodeMutations, TableMutations, NodeQueries 단위 테스트
- 빠른 실행 속도와 정확한 에러 위치 파악

### 📊 관리 및 검증 스크립트 (Management & Validation)

#### `validate-graphql-api-status.ts`
**목적**: GraphQL API 구현 상태 검증 및 문서 동기화
```bash
# 사용법
bun run scripts/validate-graphql-api-status.ts
```
**주요 기능**:
- Phase별 API 구현 상태 추적 (Phase 1A~3B)
- 파일 존재 여부 검증
- PRIORITY_API_IMPLEMENTATION_STATUS.md와 동기화
- 구현률 통계 생성
- 우선순위별 진행 상황 리포트

**추적 대상**: 총 50+ GraphQL API endpoints

#### `query-manager.ts`
**목적**: GraphQL 쿼리 상태 관리 및 리포팅 시스템
```bash
# 사용법
bun run scripts/query-manager.ts [report|validate|plan]

# Package.json 스크립트로 실행
bun run query:report
bun run query:validate  
bun run query:plan
```
**주요 기능**:
- 69개 쿼리 상태 추적 (구현/미구현)
- 카테고리별 구현률 분석 (core, tables, nodes, relations, analytics 등)
- 우선순위 기반 개발 진행 상황 관리
- 쿼리 레지스트리 관리

## 🎯 스크립트 사용 워크플로우

### 1. 초기 환경 구축
```bash
# 1단계: 테스트 DB 환경 구축
bun run scripts/setup-test-environment.ts

# 2단계: DI 기반 데이터 마이그레이션 (선택적)
bun run scripts/setup-test-dataset.ts
```

### 2. 개발 중 검증
```bash
# API 구현 상태 확인
bun run scripts/validate-graphql-api-status.ts

# 쿼리 관리 상태 확인
bun run query:report
```

### 3. 기능 테스트
```bash
# 🆕 통합된 테스트 실행 (권장)
bun run test                         # 통합 테스트 러너로 전체 실행
bun run test:list                    # 사용 가능한 테스트 확인

# 개별 테스트 실행
bun run test:bun                     # Bun native 단위 테스트
bun run test:integration             # GraphQL 통합 테스트
bun run test:performance             # 성능 테스트

# 특정 쿼리 테스트
bun run scripts/test-queries.ts minimal 1

# 🆕 템플릿 시스템 테스트 (새로운 CLI 도구)
bun templates/tools/template-cli.ts load -e development  # 템플릿 로드
bun templates/tools/template-cli.ts validate           # 전체 검증
bun templates/tools/template-cli.ts info -t template-id # 상세 정보

# 기존 템플릿 시스템 테스트 (호환성 유지)
bun run scripts/test-templates.ts basic-nodes-query

# 종합 기능 테스트
bun run scripts/comprehensive-test-runner.ts
```

### 4. 정리 및 리셋
```bash
# 테스트 환경 정리
bun run scripts/setup-test-environment.ts --cleanup
```

## 📋 Package.json 통합 명령어

프로젝트의 `package.json`에 정의된 스크립트 명령어들:

```json
{
  "scripts": {
    // 쿼리 관리
    "query:report": "bun scripts/query-manager.ts report",
    "query:validate": "bun scripts/query-manager.ts validate", 
    "query:plan": "bun scripts/query-manager.ts plan",
    
    // 쿼리 실행 테스트
    "query:test": "bun scripts/test-queries.ts",
    "query:minimal": "bun scripts/test-queries.ts minimal",
    "query:detailed": "bun scripts/test-queries.ts detailed"
  }
}
```

## 🔧 스크립트 의존성

### 내부 의존성
- **DI Container**: `setup-test-dataset.ts`가 사용
- **Use Cases**: Export/Import 기능 활용
- **GraphQL Schema**: API 상태 검증에 사용
- **Domain Entities**: 타입 안전한 데이터 생성

### 외부 의존성
- **Bun SQLite**: 데이터베이스 조작
- **GraphQL Request**: API 호출
- **File System**: 파일 존재 검증

## 🚨 주의사항

### 실행 전 확인사항
1. **서버 실행**: GraphQL 서버가 `http://localhost:4000/graphql`에서 실행 중이어야 함
2. **데이터베이스**: SQLite 파일이 `./data/` 경로에 접근 가능해야 함
3. **권한**: 파일 생성/삭제 권한 필요

### 스크립트별 주의사항
- **`comprehensive-test-runner.ts`**: 임시 스크립트, 테스트 완료 후 삭제 예정
- **`setup-test-environment.ts`**: `--cleanup` 사용 시 데이터 완전 삭제
- **`validate-graphql-api-status.ts`**: refactoring 문서와 동기화 필수

## 📈 확장 계획

### 🆕 테스트 구조 통합 완료 (2025-09-05)
- ✅ `tests/` 디렉토리 제거 및 `test/` 디렉토리로 통합
- ✅ 단위 테스트 추가: Mock 기반 리졸버 테스트
- ✅ 템플릿 통합 테스트 추가: DI Container 기반 
- ✅ 통합된 테스트 러너로 모든 테스트 관리
- ✅ Package.json 스크립트와 완전 통합

### Phase 2 준비 스크립트 (예정)
- 관계 시스템 마이그레이션 스크립트
- 성능 테스트 자동화 스크립트
- 배포 전 검증 스크립트

### 자동화 개선 (예정)
- CI/CD 통합 스크립트
- 일일/주간 상태 리포트 자동화
- 성능 메트릭 모니터링 스크립트

이 문서는 scripts 폴더의 모든 스크립트에 대한 완전한 가이드입니다. 각 스크립트의 목적을 명확히 이해하고 적절한 워크플로우에 따라 사용하시기 바랍니다.