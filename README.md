# 🚀 관계형 데이터 저장소

**연결된 정보를 쉽게 저장하고 탐색**할 수 있는 그래프 기반 데이터 시스템입니다.

**🎯 처음 시작하시나요?** [**GETTING_STARTED.md**](GETTING_STARTED.md) - 5분 만에 배우기

**📚 용어가 궁금하신가요?** [**GLOSSARY.md**](GLOSSARY.md) - 모든 용어 설명

[![System Health](https://img.shields.io/badge/System%20Health-Core%20flows%20verified-brightgreen)](./docs/guides/OPERATIONS_GUIDE.md)
[![Quality Gates](https://img.shields.io/badge/Build%20%2B%20Typecheck%20%2B%20Lint-Passing-brightgreen)](./docs/README.md)
[![Test Status](https://img.shields.io/badge/pnpm%20run%20test-Passing-brightgreen)](./docs/development/TESTING.md)
[![Documentation](https://img.shields.io/badge/Docs-Complete-blue)](./docs/README.md)
[![Last Updated](https://img.shields.io/badge/Updated-2026--11--28-blue)](#)

## ⚡ 빠른 시작

```bash
# 1) CLI로 즉시 초기화 (지식/IA 프리셋 적용 + Claude Desktop / Cursor MCP 설정 생성)
pnpm run cli -- init --database-path ./data/graph-memory.sqlite --preset knowledge

# 2) Stdio MCP 서버로 실행 (Claude Desktop / Cursor 연동)
pnpm run cli -- mcp --database-path ./data/graph-memory.sqlite

# 3) HTTP / GraphQL / REST / MCP / Web Studio 통합 서버 실행
pnpm run dev
# 또는 빌드 후 바이너리:
node dist/cli/index.js serve --port 4141

# 동작 확인
curl -X POST http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'
```

**접속 주소:**
- Web Studio / 플랫폼 UI: `http://localhost:4141/studio` (`/studio.css`, `/studio.js`)
- 메인 GraphQL 인터페이스: `http://localhost:4141/graphql`
- AI 전역 MCP: `http://localhost:4141/mcp` (테이블 격리: `/sub/:tableId/mcp`)
- 운영 관측 지표(admin): `http://localhost:4141/metrics`, `http://localhost:4141/api/audit-log`

### 📦 패키지 엔트리포인트 (`.js` + `.d.ts`)

- `bun-graph-db/core` — 그래프·IA·5-신호 AI 메모리·Typed EAV 전용 **제로-의존(Zero External Deps, Zero `node:*`)** 헤드리스 SDK (`createHeadlessGraphDb`, `IndexedDbSnapshotStorage`)
- `bun-graph-db/ui` — 제로-프레임워크 작성·시각화 플랫폼 UI 및 `<graph-memory-workspace>` Web Component (6대 뷰 `table`/`outline`/`board`/`graph`/`timeline`/`audit`, `createLocalHeadlessClient`/`createRemoteHttpClient`, `PLATFORM_UI_CSS`, [플랫폼 UI 가이드](docs/guides/PLATFORM_UI_AND_WORKSPACE.md))
- `bun-graph-db/embedded` — Browser WASM (`sql.js`/`sqlite-wasm`) 및 Cloudflare DO 풀스택 임베디드 (`createEmbeddedWebGraphDb`, `createPortableGraphNode`)
- `bun-graph-db/mcp-stdio` — Claude/Cursor용 line-delimited JSON-RPC 2.0 Stdio MCP (`startMcpStdioServer`)
- `bun-graph-db/cli` (`graph-memory` / `bun-graph-db` 바이너리) — `init`, `inspect`, `mcp`, `serve`, `backup`, `restore`
- `bun-graph-db` — 풀스택 Node.js 26 standalone 서버

### 🎯 4대 실전 역할 & 실행 데모

```bash
pnpm run demo:all   # 4개 역할 데모 일괄 검증
```

| 역할 | 데모 / 실행 명령 | 핵심 구성 |
| --- | --- | --- |
| **1. MCP AI Agent Memory (Stdio / CLI)** | `pnpm run demo:mcp` | [examples/mcp-ai-memory/](examples/mcp-ai-memory/README.md) · `graph-memory mcp` · 5-신호 기억 회상/통합 |
| **2. 스펙 계보 & OpenAPI 투영 그래프** | `pnpm run demo:spec` | [examples/spec-lineage-openapi/](examples/spec-lineage-openapi/README.md) · `product-spec` · 의존성 체인·PageRank·SCC |
| **3. 브라우저 오프라인 플랫폼 (`./core` + `./ui`)** | `pnpm run demo:web` (`--serve --port 8413`) | [examples/web-embedded-ia-memory/](examples/web-embedded-ia-memory/README.md) · `sql.js` + `<graph-memory-workspace>` + IndexedDB |
| **4. Cloudflare Durable Object Worker** | `pnpm run demo:cf` | [examples/cloudflare-do-worker/](examples/cloudflare-do-worker/README.md) · `CloudflareSingleNodeWorker` + `DoSqliteDatabase` |

## 📌 검증 스냅샷

2026-11-28 기준으로 다음 품질·성능·계약 게이트가 Node.js v26.13.1 + pnpm 12.21.0 환경에서 모두 통과합니다.

- `pnpm run check:static` (`check:embedded` + `check:docs` + `ci:versions` + `check:biome` + `typecheck` + `typecheck:contract` + `typecheck:benchmark` + `check:codegen` + `build` + `.d.ts` 생성) 통과
- `pnpm run release:check` (`dist/core/index.js`·`dist/ui/index.js` 외부 의존성 0개·`node:*` 0개·비보호 `process.env` 0개, `dist/embedded/index.js` `node:*` 0개, 전체 exports/bin/`.d.ts` 계약) 통과
- `pnpm run check:mcp-spec` (`@modelcontextprotocol/server` 공식 스키마 기반 LTS `2025-11-25` & Modern `2026-07-28` + `/sub/:tableId/mcp` 적합성 검증) 통과
- `pnpm run test:golden` (핵심 10대 기능군 골든 데이터셋 3-런타임 교차 검증) 통과 ([GOLDEN_DATASET.md](docs/development/GOLDEN_DATASET.md))
- `pnpm run test:lanes:audit` 및 `pnpm run test` (Vitest 5 기반 4개 레인 전체 142개 테스트 파일) 통과
- 플랫폼 UI (`bun-graph-db/ui` · `<graph-memory-workspace>`, 6대 뷰, `LocalHeadlessClient`/`RemoteHttpClient`, Saved Views `ui_views`), Web Embedded (`bun-graph-db/core` + `IndexedDbSnapshotStorage` + `sql.js`/`sqlite-wasm`), 제로-임베딩 우선 IA, 5-신호 AI Agent Memory 검증 ([PLATFORM_UI_AND_WORKSPACE.md](docs/guides/PLATFORM_UI_AND_WORKSPACE.md), [EMBEDDED_WEB_AND_AI_MEMORY.md](docs/guides/EMBEDDED_WEB_AND_AI_MEMORY.md))
- `pnpm run projection:check` (`oa-sdk` OpenAPI 3.2 스키마 투영 계약) 통과
- `pnpm run benchmark:hotpaths:ci` 및 `pnpm run benchmark:vector-storage` 통과
- 배포 템플릿: [Dockerfile](Dockerfile), [deploy/cloudflare/wrangler.jsonc](deploy/cloudflare/wrangler.jsonc), [examples/](examples/web-embedded-ia-memory/README.md) 3종 스타터 제공

운영 배포·권한·백업·마이그레이션 기준은 [운영 및 관리 가이드](docs/guides/OPERATIONS_GUIDE.md)를, 초기 평가 이력(역사적 스냅샷)은 [초기 시스템 평가(2026-03-30)](docs/development/SYSTEM_EVALUATION_2026-03-30.md)를 참고하세요.

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
pnpm run dev                 # 개발 서버 시작 (tsx watch)
pnpm run test:direct         # 기본 Vitest 테스트 실행
pnpm run test:parallel-safe
pnpm run test:serial-only
pnpm run test:e2e
pnpm run test:stress         # 예약/수동 부하 검증
pnpm run benchmark:hotpaths:ci # 결정적 hot-path 측정과 correctness invariant
pnpm run typecheck           # 타입 검증
pnpm run check:static        # 버전 + lint + 타입 + codegen + build
```

Hot-path 벤치마크는 검색, 그래프 순회, JSONL 다중 페이지 export,
원자적 node/attribute 쓰기, projection cache miss/hit의 median/p95/p99와
SQLite query plan을 함께 기록합니다. 기본 비교는 advisory이며 같은 fixture
schema의 baseline을 넘겨 `--enforce`한 경우에만 회귀를 실패로 처리합니다.
SQLite 자체가 이미 durable하므로 전체 JSONL write autosave는 기본적으로
꺼져 있습니다. 필요한 배포에서만 `JSONL_AUTO_SAVE_ON_WRITE=true`로 명시해
활성화하세요.

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

### 개발자 및 운영자용
- **[플랫폼 UI · 작성/시각화 워크스페이스 가이드 (`bun-graph-db/ui`)](docs/guides/PLATFORM_UI_AND_WORKSPACE.md)** - `<graph-memory-workspace>`, 6대 뷰 플러그인, `FieldEditorRegistry`, Saved Views, CSS 토큰 커스터마이징
- **[Web Embedded · IA · AI Memory 가이드](docs/guides/EMBEDDED_WEB_AND_AI_MEMORY.md)** - `bun-graph-db/core`·`bun-graph-db/embedded`, IndexedDB, `google/embeddinggemma-2`, 5-신호 메모리
- **[운영 및 관리 가이드](docs/guides/OPERATIONS_GUIDE.md)** - 기동, 역할·테이블 권한, 마이그레이션, 하이브리드 검색, JSONL 재해 복구, 품질 게이트
- **[실전 활용 정의 및 기능 성숙도 매트릭스](docs/guides/USE_CASES_AND_CAPABILITIES.md)** - 6대 활용 시나리오, 계층 구조(Tree/DAG) 가이드, SDL 연결 현황
- **[아키텍처 개요](docs/architecture/overview.md)** - 모듈형 모놀리스 계층과 운영 경계
- **[GraphQL 필드 탐색 계약과 계층 경계](docs/architecture/graph-traversal.md)** - BFS·Dijkstra/Yen·계층 쿼리 계약
- **[Cloudflare 단일 노드 아키텍처 검토](docs/architecture/cloudflare-single-node.md)** - Durable Object SQLite Phase 1 및 `PortableBootstrap`
- **[개발 가이드](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)** - 기여 & 설정
- **[초기 시스템 평가 (2026-03-30 스냅샷)](docs/development/SYSTEM_EVALUATION_2026-03-30.md)** - 초기 검증 이력과 known issues 참고용
- **[스키마 Projection 실험](docs/development/SCHEMA_PROJECTION_EXPERIMENT.md)** - 동적 테이블 스키마를 `$defs`/`$ref` projection으로 만들고 MCP/runtime validation에 연결
- **[테스팅 전략](docs/development/TESTING.md)** - 품질 보증
- **[리포지토리 패턴](docs/architecture/ARCHITECTURE_OVERVIEW.md)** - 데이터 접근

### AI 통합용
- **[MCP 참조](docs/mcp/README.md)** - `2026-07-28` / `2025-11-25` LTS 프로토콜·인증·요청 규약
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
├── MCP (`2026-07-28` / `2025-11-25` LTS): 검증됨
├── createTable → tableByIdentifier: 검증됨
├── createNode → searchNodes: 검증됨
└── table-scoped MCP route (`/sub/:tableId/mcp`): 검증됨

✅ 전체 `pnpm run test`: 통과
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
- `node --import tsx scripts/init-database.ts`로 초기화
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

**마지막 업데이트**: 2026-11-27
