# 🚀 관계형 데이터 저장소

**연결된 정보를 쉽게 저장하고 탐색**할 수 있는 그래프 기반 데이터 시스템입니다.

**🎯 처음 시작하시나요?** [**GETTING_STARTED.md**](GETTING_STARTED.md) - 5분 만에 배우기

**📚 용어가 궁금하신가요?** [**GLOSSARY.md**](GLOSSARY.md) - 모든 용어 설명

[![System Health](https://img.shields.io/badge/System%20Health-Core%20flows%20verified-brightgreen)](./docs/development/SYSTEM_EVALUATION_2026-03-30.md)
[![Quality Gates](https://img.shields.io/badge/Build%20%2B%20Typecheck%20%2B%20Lint-Passing-brightgreen)](./docs/development/SYSTEM_EVALUATION_2026-03-30.md)
[![Test Status](https://img.shields.io/badge/bun%20run%20test-Passing-brightgreen)](./docs/development/SYSTEM_EVALUATION_2026-03-30.md)
[![Documentation](https://img.shields.io/badge/Docs-Complete-blue)](./docs/README.md)
[![Last Updated](https://img.shields.io/badge/Updated-2026--03--30-blue)](#)

## ⚡ 빠른 시작

```bash
# 설치 및 초기화
bun install
bun run scripts/init-database.ts

# 서버 시작
bun run dev

# 동작 확인
curl -X POST http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'
```

**접속 주소:**
- 메인 인터페이스: `http://localhost:4141/graphql`
- AI 전역 도구: `http://localhost:4141/mcp`
- 테이블별 도구: `http://localhost:4141/sub/:tableId/mcp`

## 📌 검증 스냅샷

2026-03-30 기준으로 다음이 실제로 다시 검증되었습니다.

- `bun run typecheck` 통과
- `bun run lint --max-diagnostics=20` 통과
- `bun run build` 통과
- 라이브 스모크
  - `GET /api/health`
  - GraphQL `healthCheck`
  - MCP `initialize`
  - `createTable`
  - `tableByIdentifier`
  - `createNode`
  - `searchNodes` with `nodes { tableId }`

현재 `bun run test`까지 포함한 기본 품질 게이트가 통과합니다. 자세한 검증 내역은 [최신 시스템 평가 문서](docs/development/SYSTEM_EVALUATION_2026-03-30.md)를 참고하세요.

---

## 🎯 무엇을 할 수 있나요?

### 그래프 데이터 저장
연결된 데이터를 타입이 지정된 관계, 유연한 스키마, 강력한 탐색 알고리즘으로 저장하고 조회합니다.

### 템플릿 시스템
재사용 가능한 쿼리 패턴을 버전 관리, 사용 분석, 자동 AI 도구 생성과 함께 만듭니다.

### AI 통합
Claude 같은 AI 어시스턴트가 데이터 기능을 발견하고 사용할 수 있게 합니다.

### 일괄 작업
수천 개의 레코드를 트랜잭션 안전성, 진행 모니터링, 자동 롤백과 함께 효율적으로 처리합니다.

---

## 🏗️ 시스템 구조

**계층화된 헥사고날 설계**로 명확하게 분리:
- **AI 통합 계층**: AI 어시스턴트 인터페이스
- **쿼리 인터페이스 계층**: 타입 안전한 작업
- **비즈니스 로직**: 유스케이스와 도메인 서비스
- **도메인 계층**: 엔티티와 리포지토리 인터페이스
- **인프라 계층**: 저장소 및 구현

---

## 📊 핵심 개념

### 데이터 모델
- **테이블**: 엔티티 스키마 정의
- **노드**: 유연한 속성을 가진 개별 레코드
- **관계**: 노드 간의 타입이 지정된 연결
- **속성**: 강타입 속성
- **템플릿**: 재사용 가능한 쿼리 패턴

### 작업
- **검색**: 속성이나 텍스트로 엔티티 찾기
- **탐색**: 관계를 따라가고 경로 찾기
- **일괄 처리**: 여러 레코드를 원자적으로 처리
- **템플릿 실행**: 매개변수화된 쿼리 실행

---

## 🔧 개발

### 명령어
```bash
bun run dev              # 개발 서버 시작
bun test                 # lane-based 전체 테스트 실행 (통과)
bun run typecheck        # 타입 검증
bun run check            # 포맷 + 린트 + 수정
```

### 프로젝트 구조
```
src/
├── application/        # 유스케이스 & 오케스트레이션
├── domain/            # 비즈니스 엔티티 & 인터페이스
├── infrastructure/    # 기술적 구현
└── presentation/      # 인터페이스 계층

tests/
├── unit/              # 도메인/유스케이스 단위 테스트
└── integration/       # 인터페이스 엔드포인트 테스트
```

---

## 📚 문서

### 사용자용
- **[시작 가이드](GETTING_STARTED.md)** - 5분 만에 시작하기
- **[용어집](GLOSSARY.md)** - 모든 용어 상세 설명
- **[인터페이스 레퍼런스](docs/api/doc-api-reference.md)** - 전체 작업 스키마
- **[템플릿 가이드](docs/templates/template-system-guide.md)** - 재사용 쿼리 만들기
- **[AI 통합 설정](docs/guides/MCP_SETUP_GUIDE.md)** - Claude 연동

### 개발자용
- **[아키텍처 개요](docs/architecture/ARCHITECTURE_OVERVIEW.md)** - 시스템 설계
- **[개발 가이드](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)** - 기여 & 설정
- **[최신 시스템 평가](docs/development/SYSTEM_EVALUATION_2026-03-30.md)** - 실제 검증 결과와 known issues
- **[테스팅 전략](docs/development/TESTING.md)** - 품질 보증
- **[리포지토리 패턴](docs/architecture/ARCHITECTURE_OVERVIEW.md)** - 데이터 접근

### AI 통합용
- **[AI 통합 구조](docs/mcp/MCP_SYSTEM_ARCHITECTURE.md)** - 프로토콜 구현
- **[도구 생성](docs/architecture/MCP_TEMPLATE_ARCHITECTURE.md)** - 템플릿-도구 변환
- **[스키마 탐색](docs/guides/MCP_EXAMPLES.md)** - 동적 기능 노출
- **[사용 예제](docs/samples/template-execution-patterns.md)** - 일반 패턴

---

## 🔌 Claude AI 연동 설정

### 전역 템플릿 관리
테이블 간 작업을 위한 루트 서버 구성:

```bash
claude mcp add --transport http graph-root http://localhost:4141/mcp
```

**기능:**
- 템플릿 생성 및 관리
- 테이블 간 검색
- 전역 쿼리 실행
- 시스템 관리

### 테이블별 작업
격리된 작업을 위한 테이블별 서버 구성:

```bash
# 예시: 특정 테이블 추가
claude mcp add --transport http my-table http://localhost:4141/sub/my-table-id/mcp
```

**기능:**
- 테이블 범위 쿼리
- 노드 작업
- 관계 관리
- 템플릿 실행

**테이블 격리의 이점:**
- **보안**: 작업이 하나의 테이블로 제한됨
- **조직화**: 명확한 도구 분리
- **성능**: 집중된 기능 세트
- **유연성**: 테이블별 맞춤 설정

---

## 📊 시스템 상태

### 현재 지표
```
✅ Build / Typecheck / Lint: 통과
✅ 핵심 서버 경로: 검증됨
├── REST health: 검증됨
├── GraphQL healthCheck: 검증됨
├── MCP initialize: 검증됨
├── createTable → tableByIdentifier: 검증됨
├── createNode → searchNodes: 검증됨
└── table-scoped MCP route: 검증됨

✅ 전체 `bun run test`: 통과
✅ 기본 품질 게이트: build + typecheck + lint + lane tests 통과
```

### 알려진 제한사항
- 파일 기반 저장소 (단일 작성자)
- 수평 확장 없음 (단일 프로세스)
- 파일 기반 백업만
- 인프로세스 트랜잭션 관리

---

## 🚀 다음 단계

### 새 사용자를 위해
1. 빠른 시작 섹션 검토
2. 쿼리 인터페이스 탐색
3. 예제 쿼리 시도 (인터페이스 레퍼런스 참조)
4. 첫 테이블 만들기

### 개발자를 위해
1. 아키텍처 개요 읽기
2. 테스트 스위트 실행
3. 코드 구조 검토
4. 기여 가이드라인 확인

### AI 통합을 위해
1. AI 통합 서버 설정
2. 도구 탐색 테스트
3. 샘플 작업 실행
4. 통합 패턴 검토

---

## 🔧 문제 해결

### 일반적인 문제

**서버가 시작되지 않음**
- 포트 4141 사용 가능 여부 확인
- 저장소 초기화 확인
- 서버 로그 검토

**쿼리 인터페이스 오류**
- 쿼리 인터페이스 탐색기에서 스키마 확인
- 쿼리 문법 검증
- 스키마에서 필드 사용 가능 여부 확인

**저장소 문제**
- `bun run scripts/init-database.ts`로 초기화
- `./data/` 디렉토리 권한 확인
- 손상된 경우 삭제 후 재초기화

### 도움 받기
- 상세한 오류는 서버 로그 확인
- `http://localhost:4141/graphql`에서 쿼리 인터페이스 탐색기 사용
- `docs/` 디렉토리의 문서 검토

---

## 📖 핵심 개념

- **헥사고날 아키텍처**: 포트 & 어댑터 패턴
- **도메인 주도 설계**: 비즈니스 로직 조직화
- **리포지토리 패턴**: 데이터 접근 추상화
- **의존성 주입**: 서비스 구성
- **템플릿 엔진**: 쿼리 매개변수화
- **AI 통합 프로토콜**: AI 도구 통합 표준

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

---

**마지막 업데이트**: 2025-11-25
