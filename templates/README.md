# Template 시스템 디렉토리 구조

Template 시스템의 모든 리소스를 체계적으로 관리하는 중앙 집중식 디렉토리입니다.

## 📁 디렉토리 구조

```
templates/
├── README.md                    # 이 문서
├── schemas/                     # 템플릿 스키마 정의
│   ├── core/                    # 핵심 템플릿 스키마
│   │   ├── node-templates.schema.json
│   │   ├── relation-templates.schema.json
│   │   └── attribute-templates.schema.json
│   ├── domain/                  # 도메인별 템플릿 스키마
│   │   ├── ecommerce.schema.json
│   │   ├── project-management.schema.json
│   │   └── knowledge-graph.schema.json
│   └── validation/              # JSON Schema 검증 스키마
│       ├── template-structure.schema.json
│       └── variable-types.schema.json
├── datasets/                    # 템플릿 데이터셋
│   ├── production/              # 프로덕션 템플릿
│   │   ├── basic-operations.json
│   │   ├── advanced-queries.json
│   │   └── mutation-templates.json
│   ├── development/             # 개발용 템플릿
│   │   ├── test-templates.json
│   │   ├── debug-templates.json
│   │   └── sample-templates.json
│   └── migration/               # 마이그레이션 데이터
│       ├── v1-to-v2/
│       └── legacy-templates.json
├── loaders/                     # 데이터 로더 스크립트
│   ├── template-loader.ts       # 메인 템플릿 로더
│   ├── schema-loader.ts         # 스키마 로더
│   ├── validation-loader.ts     # 검증 로더
│   └── migration-loader.ts      # 마이그레이션 로더
├── generators/                  # 템플릿 생성기
│   ├── basic-template-generator.ts
│   ├── domain-template-generator.ts
│   ├── test-template-generator.ts
│   └── migration-generator.ts
├── validators/                  # 템플릿 검증기
│   ├── template-validator.ts    # 메인 템플릿 검증기
│   ├── schema-validator.ts      # 스키마 검증기
│   ├── variable-validator.ts    # 변수 검증기
│   └── execution-validator.ts   # 실행 검증기
├── tests/                       # 템플릿 전용 테스트
│   ├── unit/                    # 단위 테스트
│   │   ├── loaders.test.ts
│   │   ├── generators.test.ts
│   │   └── validators.test.ts
│   ├── integration/             # 통합 테스트
│   │   ├── template-execution.test.ts
│   │   ├── schema-validation.test.ts
│   │   └── end-to-end.test.ts
│   └── fixtures/                # 테스트 픽스처
│       ├── valid-templates/
│       ├── invalid-templates/
│       └── test-data/
├── examples/                    # 템플릿 예제 및 문서화
│   ├── basic-usage/
│   │   ├── create-node.md
│   │   ├── search-nodes.md
│   │   └── update-relations.md
│   ├── advanced-usage/
│   │   ├── complex-queries.md
│   │   ├── batch-operations.md
│   │   └── custom-variables.md
│   └── domain-examples/
│       ├── ecommerce-templates.md
│       ├── project-management-templates.md
│       └── knowledge-graph-templates.md
└── tools/                       # 템플릿 관리 도구
    ├── template-cli.ts          # CLI 도구
    ├── template-analyzer.ts     # 분석 도구
    ├── performance-profiler.ts  # 성능 프로파일러
    └── migration-tool.ts        # 마이그레이션 도구
```

## 🎯 각 디렉토리의 목적

### 📋 **schemas/**
- **핵심 기능**: JSON Schema 기반 템플릿 구조 정의
- **검증**: 템플릿 생성 시 구조적 유효성 검증
- **도메인별 스키마**: 특정 도메인에 특화된 템플릿 스키마

### 📊 **datasets/**
- **환경별 분리**: production/development/migration
- **버전 관리**: 템플릿 버전별 데이터셋 관리
- **마이그레이션**: 스키마 변경 시 데이터 마이그레이션 지원

### 🔄 **loaders/**
- **자동 로딩**: 시스템 시작 시 템플릿 자동 로드
- **Hot Reload**: 개발 시 템플릿 변경 감지 및 재로드
- **성능 최적화**: 지연 로딩 및 캐싱

### 🏭 **generators/**
- **자동 생성**: 패턴 기반 템플릿 자동 생성
- **도메인 특화**: 특정 도메인용 템플릿 생성기
- **테스트 지원**: 테스트용 템플릿 자동 생성

### ✅ **validators/**
- **다단계 검증**: 구조 → 변수 → 실행 가능성 검증
- **에러 리포팅**: 상세한 검증 오류 정보 제공
- **성능 검증**: 템플릿 실행 성능 검증

### 🧪 **tests/**
- **완전한 테스트 커버리지**: 모든 템플릿 기능 테스트
- **테스트 격리**: 템플릿 전용 테스트 환경
- **픽스처 관리**: 테스트 데이터 체계적 관리

### 📚 **examples/**
- **사용법 문서화**: 실제 사용 예제
- **도메인별 가이드**: 특정 도메인 활용법
- **학습 리소스**: 신규 사용자 온보딩

### 🛠️ **tools/**
- **CLI 인터페이스**: 개발자 편의 도구
- **분석 도구**: 템플릿 사용량 및 성능 분석
- **마이그레이션**: 버전 업그레이드 지원

## 🚀 핵심 장점

### 1. **중앙 집중식 관리**
- 모든 템플릿 관련 리소스를 한 곳에서 관리
- 일관된 구조와 네이밍 컨벤션

### 2. **환경별 분리**
- Production, Development, Testing 환경별 격리
- 안전한 배포 및 테스트 환경 보장

### 3. **확장성**
- 새로운 도메인 템플릿 쉽게 추가
- 플러그인 방식의 확장 구조

### 4. **자동화**
- 로딩, 검증, 생성 과정의 완전 자동화
- CI/CD 파이프라인 통합 가능

### 5. **개발자 경험**
- 명확한 구조와 문서화
- 강력한 CLI 도구 지원
- Hot Reload 개발 환경

## 🔗 다른 시스템과의 통합

### src/ 디렉토리와의 관계
- `src/domain/entities/QueryTemplate.ts` ↔ `templates/schemas/`
- `src/application/use-cases/query-templates/` ↔ `templates/validators/`
- `src/infrastructure/database/sqlite/SqliteQueryTemplateRepository.ts` ↔ `templates/loaders/`

### scripts/ 디렉토리와의 관계
- `scripts/test-templates.ts` → `templates/tests/`로 이동 예정
- `scripts/run-template-tests.ts` → `templates/tools/template-cli.ts`로 통합

### test/ 디렉토리와의 관계
- `test/template-based-node-mutations.test.ts` → `templates/tests/integration/`로 이동
- `templates/tests/`에서 전용 테스트 환경 구축

이 구조를 통해 템플릿 시스템의 모든 측면을 체계적으로 관리하고, AI 친화적인 GraphQL 그래프 데이터베이스의 핵심 차별화 기능을 강화할 수 있습니다.