# bun-graph-db 프로젝트 가이드

**Node.js 26 LTS (`node:sqlite`)** 및 **Cloudflare Durable Objects SQLite** 포터블 실행을 지원하는 **그래프 기반 관계형 데이터 저장소**로, GraphQL·REST·MCP(`2026-07-28` + `2025-11-25` LTS) 통합 인터페이스를 제공합니다.

> 💡 **용어 설명**: [GLOSSARY.md](GLOSSARY.md)에서 주요 도메인 용어를 확인할 수 있습니다.

## ⚡ 빠른 시작

```bash
# 의존성 설치
pnpm install

# 데이터베이스 스키마 초기화
node --import tsx scripts/init-database.ts

# 개발 서버 시작 (기본 포트: 4141)
pnpm run dev
```

**주요 엔드포인트 (기본 포트 `4141`)**:
- **GraphQL API / 탐색기**: `http://localhost:4141/graphql`
- **REST API**: `http://localhost:4141/api/*` (OpenAPI 3.2: `/api/openapi`)
- **전역 MCP 서버 (`2026-07-28` + `2025-11-25` LTS)**: `http://localhost:4141/mcp`
- **테이블 격리 MCP 서버**: `http://localhost:4141/sub/:tableId/mcp`
- **헬스체크**: `http://localhost:4141/health`

---

## 🏗️ 아키텍처 & 실행 모델

프로젝트는 **Clean + Hexagonal Architecture** 기반의 4개 핵심 계층으로 구성되며, SQLite 포트 추상화(`ISqliteDatabase`)를 통해 Node 26과 Cloudflare DO 환경에서 동일한 코어가 동작합니다.

1. **Presentation Layer (`src/presentation/`)**:
   - `http/`: `BunApiRouter` (`ApiEndpointMapping.ts` 정렬), `GraphApiController`, `GraphDbApiController`, `AttributeApiController`, `TabularSyncRoutes`
   - `graphql/`: `createGraphQLServer`, Pothos/Schema-first 통합 스키마 (`src/presentation/graphql/schema/`)
   - `mcp/` & `src/mcp/`: 루트 `/mcp` 및 테이블 스코프 `/sub/:tableId/mcp` Streamable HTTP 서버 (`2026-07-28` / `2025-11-25` LTS, `ToolAnnotations`, `outputSchema`, `structuredContent`)
   - `cloudflare/`: `CloudflareSingleNodeWorker` (단일 노드 DO SQLite 워커 어댑터 Phase 1)
2. **Application Layer (`src/application/`)**:
   - 유스케이스 (`tables`, `nodes`, `attributes`, `relations`, `templates`, `docs`, `export`, `backup`)
   - `NodeAttributeSchemaGate` (JSON Schema 2020-12 기반 `TableSchemaProjectionService` 검증·정규화)
   - `AccessControl` (Bearer 토큰 기반 역할 검증 `403` 및 테이블 스코프 은닉 `404` 격리)
3. **Domain Layer (`src/domain/`)**:
   - 엔티티, 리포지토리 포트, `GraphTraversalService` (양방향 BFS, `shortestPath`, Weighted Dijkstra `findOptimalPath`, `getDependencyChain`), `HierarchyService` (Tree/DAG/LCA/`moveHierarchyNode`), `GraphAnalyticsService` (Tarjan SCC, Power-Iteration PageRank)
4. **Infrastructure Layer (`src/infrastructure/`)**:
   - `PortableBootstrap.ts`, `SqliteAdapter.ts` (`node:sqlite`), `DoSqliteAdapter.ts` (`Cloudflare DO`), `ExactVectorIndex` (`node_embeddings` Float32), `SqliteNodeSearchRepository` (FTS5 + `value_num` 푸시다운 + 4-신호 `hybridSearchNodes`), `SchemaGenerator`, `JsonlBackupService`

---

## 📊 핵심 기능 요약

- **그래프 탐색 & 계층 구조**: 양방향 레벨-오더 BFS, 다익스트라 가중 최적 경로, Tarjan SCC, PageRank 중심성, `parentOf` 기반 Tree/DAG 검증 및 `getLowestCommonAncestor`·`moveHierarchyNode` ([USE_CASES_AND_CAPABILITIES.md](docs/guides/USE_CASES_AND_CAPABILITIES.md))
- **영속 임베딩 & `google/embeddinggemma-2` 하이브리드 검색**: 공식 태스크 프리픽스 + MRL(`768/512/256/128`) 재정규화 + Transformers.js(WebGPU)/HTTP 백엔드 + `EmbedNodesUseCase`, FTS5 + `value_num` 푸시다운 + `ExactVectorIndex` + N-홉 근접도 RRF 결합 (`hybridSearchNodes`)
- **웹 임베디드 런타임 & 정보구조화(IA) & AI Agent Memory**: `createEmbeddedWebGraphDb` (`sql.js`/`sqlite-wasm`), `InformationArchitectureService` 블루프린트·패싯 서브트리 쿼리, `AiMemoryService` 5-신호 회상·통합·컨텍스트 윈도우 + `memory-*` MCP 도구 ([EMBEDDED_WEB_AND_AI_MEMORY.md](docs/guides/EMBEDDED_WEB_AND_AI_MEMORY.md))
- **스키마 게이트 & OpenAPI 3.2 투영**: 테이블별 JSON Schema 2020-12 검증 게이트(`NodeAttributeSchemaGate`), `oa-sdk` OpenAPI 3.2 계약 투영(`projection:check`)
- **이중 백업 & 복원**: SQLite 바이너리 스냅샷 + Git 친화적 JSONL 백업(`exportJsonl`/`importJsonl`, 임베딩 포함)
- **골든 테스트 데이터셋**: 3개 테이블·2개 템플릿으로 10대 핵심 기능군을 Node 26 / Cloudflare DO SQLite / JSONL 라운드트립에서 검증 (`pnpm run test:golden`, [GOLDEN_DATASET.md](docs/development/GOLDEN_DATASET.md))

---

## 🔧 자주 사용하는 명령어

```bash
pnpm run dev                   # 개발 서버 실행 (포트 4141)
pnpm run check:static          # check:embedded + check:docs + ci:versions + check:biome + typecheck + check:codegen + build
pnpm run test:golden           # 핵심 기능 골든 데이터셋 3-런타임 검증
pnpm run test                  # Vitest 5 전체 4개 레인 테스트 (134개 테스트 파일)
pnpm run test:lanes:audit      # 테스트 레인 분류 정합성 감사
pnpm run projection:check      # oa-sdk OpenAPI 3.2 투영 계약 검증
pnpm run benchmark:hotpaths:ci # 핫패스 성능 회귀 게이트
pnpm run codegen               # GraphQL 타입 및 schema.json 재생성
```

---

## 📚 문서 & 레퍼런스

- **시작 & 개요**: [README.md](README.md), [GETTING_STARTED.md](GETTING_STARTED.md), [docs/README.md](docs/README.md)
- **활용 & 아키텍처**: [USE_CASES_AND_CAPABILITIES.md](docs/guides/USE_CASES_AND_CAPABILITIES.md), [EMBEDDED_WEB_AND_AI_MEMORY.md](docs/guides/EMBEDDED_WEB_AND_AI_MEMORY.md), [ARCHITECTURE_OVERVIEW.md](docs/architecture/ARCHITECTURE_OVERVIEW.md), [cloudflare-single-node.md](docs/architecture/cloudflare-single-node.md)
- **MCP 연동**: [docs/mcp/README.md](docs/mcp/README.md), [docs/guides/MCP_SETUP_GUIDE.md](docs/guides/MCP_SETUP_GUIDE.md)
- **개발 & 검증**: [DEVELOPMENT_ENVIRONMENT_GUIDE.md](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md), [TESTING.md](docs/development/TESTING.md), [GOLDEN_DATASET.md](docs/development/GOLDEN_DATASET.md), [DOCUMENTATION_POLICY.md](docs/development/DOCUMENTATION_POLICY.md)
- **스크립트 가이드**: [docs/tooling/scripts.md](docs/tooling/scripts.md)

---

**라이선스**: [MIT License](LICENSE)  
**마지막 업데이트**: 2026-11-27
