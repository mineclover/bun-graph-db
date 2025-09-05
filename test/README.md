# Test Suite Structure

이 디렉토리는 테스트 환경 구축 코드와 테스트 코드를 명확하게 분리하여 체계적으로 관리합니다.

## 📁 디렉토리 구조

```
test/
├── setup/                    # 테스트 환경 구축 코드
│   ├── environment/          # 환경 설정
│   │   └── setup.ts         # 테스트 환경 초기화
│   ├── fixtures/            # 테스트 데이터
│   │   └── template-scenarios.yaml
│   └── utilities/           # 테스트 유틸리티
│       ├── TemplateTestRunner.ts
│       ├── TestLogger.ts
│       ├── LogViewer.ts
│       ├── GraphQLTestClient.ts
│       └── ...
├── suites/                   # 테스트 스위트 (주제별)
│   ├── template/            # 템플릿 관련 테스트
│   │   ├── template-crud.test.ts      # 🎯 템플릿 CRUD 통합 테스트
│   │   ├── template-driven.test.ts
│   │   ├── template-system-improved.test.ts
│   │   └── ...
│   ├── node/                # 노드 관련 테스트
│   ├── graphql/             # GraphQL 관련 테스트
│   └── integration/         # 통합 테스트
├── runner/                   # 테스트 실행 관리
│   ├── entry-points/        # 단일 진입점
│   │   └── test-runner.ts   # 🚀 통합 테스트 러너
│   └── orchestrators/       # 테스트 오케스트레이터
└── logs/                    # 테스트 로그
    ├── individual/          # 개별 테스트 로그
    └── *.json              # 테스트 스위트 로그
```

## 🎯 주요 특징

### 1. 명확한 분리
- **setup/**: 테스트 환경 구축 및 유틸리티
- **suites/**: 실제 테스트 코드 (주제별 분류)
- **runner/**: 테스트 실행 관리

### 2. 단일 진입점
- **template-crud.test.ts**: 템플릿 CRUD 테스트의 통합 진입점
- **test-runner.ts**: 모든 테스트 실행의 통합 진입점

### 3. 주제별 체계적 관리
- **template/**: 템플릿 관련 모든 테스트
- **node/**: 노드 관련 테스트
- **graphql/**: GraphQL 관련 테스트
- **integration/**: 통합 테스트

## 🚀 사용법

### 기본 명령어

```bash
# 사용 가능한 테스트 목록 확인
bun run test:list

# 테스트 통계 확인
bun run test:stats

# 템플릿 CRUD 테스트 실행
bun run test:crud

# 템플릿 카테고리 전체 테스트 실행
bun run test:template

# 모든 테스트 실행
bun run test:all
```

### 고급 사용법

```bash
# 특정 테스트 실행
bun test/runner/entry-points/test-runner.ts run template-crud

# 카테고리별 테스트 실행
bun test/runner/entry-points/test-runner.ts category template

# 우선순위별 테스트 실행
bun test/runner/entry-points/test-runner.ts priority high

# 상세 로그와 함께 실행
bun test/runner/entry-points/test-runner.ts all --verbose

# 타임아웃 설정
bun test/runner/entry-points/test-runner.ts all --timeout 60000
```

### 로그 확인

```bash
# 테스트 로그 통계
bun run logs:stats

# 실패한 테스트 확인
bun run logs:failed

# 특정 테스트 상세 로그
bun run logs:view details "System Health Check"

# 전체 리포트 생성
bun run logs:report
```

## 📊 테스트 우선순위

### 🔴 High Priority
- `template-crud`: 템플릿 CRUD 통합 테스트
- `template-driven`: 메인 템플릿 테스트

### 🟡 Medium Priority
- `template-system-improved`: 개선된 템플릿 시스템
- `template-execution`: 템플릿 실행 테스트
- `template-node-mutations`: 노드 뮤테이션 테스트

### 🟢 Low Priority
- `template-basic`: 기본 템플릿 테스트

## 🔧 개발 가이드

### 새로운 테스트 추가

1. **주제별 분류**: 적절한 카테고리 디렉토리에 추가
2. **네이밍 컨벤션**: `{기능}-{세부사항}.test.ts`
3. **test-runner.ts 업데이트**: TEST_CONFIGS에 새 테스트 추가
4. **우선순위 설정**: high/medium/low 중 선택

### 테스트 환경 구축 코드 추가

1. **setup/utilities/**: 재사용 가능한 유틸리티
2. **setup/fixtures/**: 테스트 데이터
3. **setup/environment/**: 환경 설정

### 로그 시스템 활용

- 모든 테스트는 자동으로 개별 로그 파일 생성
- `testLogger`를 통한 구조화된 로깅
- 실시간 로그 출력 + 파일 저장

## 📈 모니터링

- **실시간 로그**: 테스트 실행 중 실시간 확인
- **개별 로그 파일**: 각 테스트별 상세 디버깅 정보
- **통계 리포트**: 성공률, 실행시간, 에러 타입별 분석
- **프로세스 종료**: 실패 시 자동 종료 (exit code 1)

이 구조를 통해 테스트 코드의 유지보수성과 확장성을 크게 향상시킬 수 있습니다.
