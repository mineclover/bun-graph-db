---
docType: architecture
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
question: "Bun Graph DB를 Cloudflare의 단일 노드 모델로 배포할 때 가장 적합한 런타임과 포팅 경계는 무엇인가?"
decisionStatus: accepted
sources:
  - index.ts
  - scripts/generate-embedded-assets.ts
  - src/generated/embedded-assets.ts
  - src/infrastructure/database/sqlite/SqlitePort.ts
  - src/infrastructure/database/sqlite/SqliteAdapter.ts
  - src/infrastructure/database/sqlite/DoSqliteAdapter.ts
  - src/infrastructure/database/sqlite/DatabaseMigrationRunner.ts
  - src/infrastructure/database/sqlite/SqlitePragmas.ts
  - src/infrastructure/database/sqlite/SqliteNodeRepository.ts
  - src/infrastructure/database/sqlite/SqliteNodeSearchRepository.ts
  - src/infrastructure/database/sqlite/SqliteGraphRepository.ts
  - src/infrastructure/container/modules/DatabaseModule.ts
  - src/infrastructure/container/PortableBootstrap.ts
  - src/domain/ports/ISnapshotStoragePort.ts
  - src/presentation/graphql/GraphQLSchemaBuilder.ts
  - src/mcp/http-server/modern-protocol.ts
  - src/mcp/http-server/McpHttpServer.ts
  - src/presentation/mcp/routes/mcp-routes.ts
  - src/presentation/cloudflare/CloudflareSingleNodeWorker.ts
  - src/domain/services/JsonlBackupService.ts
  - src/domain/services/SQLiteBackupService.ts
tests:
  - tests/unit/cloudflare-do-sqlite-portability.test.ts
---

# Cloudflare 단일 노드 아키텍처 검토

이 문서는 현재 `Node 26` + `node:sqlite` + Web Fetch 기반 모놀리스인 **Bun Graph DB**를 Cloudflare 환경에 "단일 노드(Single-Node)" 개념으로 올리는 아키텍처 선택지를 비교하고, 실제 코드베이스 감사에서 확인된 포팅 블로커와 단계별 도입안을 정리한다.

## 1. 선택지 비교

| 기준 | **옵션 1 (권장): Workers + SQLite Durable Object** | **옵션 2: Cloudflare Containers (Docker + Node 26)** | **옵션 3: Workers + D1 (비권장)** |
| --- | --- | --- | --- |
| SQLite 모델 | DO 내부 **in-process 동기 SQLite (`ctx.storage.sql`)** | 컨테이너 로컬 디스크 SQLite (단, **임시 디스크**) | 네트워크 RPC 기반 비동기 D1 |
| 탐색 지연/적합성 | 멀티홉 BFS와 `UNION` 인접 조회가 **단일 호스트 내 동기 실행**으로 가장 자연스러움 | Node 26 `node:sqlite` 그대로 동작, 콜드스타트 시 컨테이너 부팅 지연 | BFS 홉마다 비동기 네트워크 왕복 + 모든 저장소 포트 async 재작성 필요 |
| FTS5 / BLOB | **네이티브 FTS5 및 Uint8Array/Float32Array BLOB 지원** | 풀 SQLite `3.54.x` 지원 | FTS5 가능하나 트랜잭션·지연 제약 존재 |
| 용량 · 한도 | DO당 **10 GB**(Workers Paid) / **1 GB**(Free), 쿼리당 **바인드 파라미터 100개**, 행/값 최대 8 MB | `lite`(256 MiB / 2 GB) ~ `standard-4`(12 GiB / 20 GB), 0 스케일링 가능 | DB당 10 GB, 단일 동시성 쓰기 병목 |
| 영속성 | Cloudflare가 DO SQLite 자동 복제·영속화 (+ R2 JSONL 스냅샷 선택) | 인스턴스 재시작 시 디스크 휘발 → R2 스냅샷(최대 20 GB, 30일 보존) 필수 | Cloudflare 관리형 영속화 |
| 단일 노드 → 확장 경로 | `env.GRAPH_NODE.getByName("default")` 단일 노드로 시작 → 워크스페이스/테넌트별 DO(`getByName(workspaceId)`)로 무중단 수평 확장 | 인스턴스 크기 스케일업, 워크스페이스 샤딩 시 별도 라우팅 구현 필요 | 샤딩 및 다중 DB 관리 부담 |
| 코드 변경량 | 중간 (SQLite 어댑터·바인드 청크·스냅샷 I/O 분리 필요) | **최소** (`node:sqlite`·FS 코드 그대로 유지 가능) | 매우 큼 (모든 동기 리포지토리 async 전환) |

### 핵심 권장안과 단일 DO 병목 주의점

1. **초기 MVP/검증을 최소 수정으로 올릴 때는 옵션 2 (Cloudflare Containers)**가 가장 빠르다. 단, 컨테이너 파일시스템은 재시작·유휴 슬립 시 초기화되므로 기동/종료 훅에 **R2 JSONL/SQLite 스냅샷 복원·저장**을 반드시 붙여야 한다.
2. **네이티브 엣지 운영과 테넌트 확장을 고려한 정본 아키텍처는 옵션 1 (Workers + SQLite-backed Durable Object)**이다.
   - 요청 진입점(Stateless Worker)이 인증(`AccessControl` / Cloudflare Access JWT)·CORS·원격 MCP/GraphQL 파싱 전검증을 처리하고 `env.GRAPH_NODE.getByName(nodeKey)` RPC로 단일 그래프 노드(DO)를 호출한다.
   - `bun-graph-db`의 요청 핸들러가 이미 Web Standard `Request`/`Response`(`BunApiRouter`, GraphQL Yoga `yoga.fetch`, `McpHttpServer` `inProcessFetch`) 위에서 동작하므로, HTTP 엔진 자체는 Workers `fetch` 모델과 궁합이 매우 좋다.
   - **경고 (Global Single-DO Anti-Pattern)**: 트래픽이 매우 높은 전역 단일 서비스에 단 하나의 global DO만 두면 단일 스레드 직렬화 병목이 발생한다. **개인/소팀 단일 지식 그래프**는 단일 DO(`default`)로 운영하고, 팀·SaaS 환경으로 커지면 즉시 **테넌트/워크스페이스 단위 DO 샤딩**(`getByName(workspaceId)`)으로 분리해야 한다.

## 2. 식별되었던 포팅 블로커와 Phase 1 해소 내역 (5/5 해소)

DO SQLite(`new_sqlite_classes`) 기준으로 식별했던 5가지 포팅 블로커는 Phase 1 구현에서 모두 코드 레벨로 해소되었다.

1. **`ISqliteDatabase` 포트 분리 · DO 어댑터 · `?` 위치 바인딩 전환**
   - [SqlitePort.ts](../../src/infrastructure/database/sqlite/SqlitePort.ts)가 `node:sqlite` 의존 없는 `ISqliteDatabase`, `getMaxBindParams`, `chunkValues`, `translateNamedParamsToPositional`(문자열 리터럴·식별자·주석 보존)을 정의하고, [SqliteAdapter.ts](../../src/infrastructure/database/sqlite/SqliteAdapter.ts)의 `Database`(`driver = 'node-sqlite'`, `maxBindParams = 500`, `supportsFilePragmas = true`)가 이를 구현한다.
   - [DoSqliteAdapter.ts](../../src/infrastructure/database/sqlite/DoSqliteAdapter.ts)의 `DoSqliteDatabase`는 `ctx.storage.sql` + `ctx.storage.transactionSync`(중첩 `SAVEPOINT` 지원)를 감싸며 `maxBindParams = 90`, `supportsFilePragmas = false`, 쿼리당 100개 초과 바인딩 사전 차단을 수행한다.
   - [DatabaseMigrationRunner.ts](../../src/infrastructure/database/sqlite/DatabaseMigrationRunner.ts)는 `VALUES ($version, $name)` 대신 위치 바인딩 `VALUES (?, ?)`와 `ISqliteDatabase`를 사용한다.
2. **`IN (...)` SQL 바인드 파라미터 `<= 90` 자동 청킹 (`json_each` 폴백 포함)**
   - `BaseSqliteRepository`, `SqliteNodeRepository`, `SqliteNodeAttributeRepository`, `SqliteNodeRelationRepository`(`BOTH` 2-leg `UNION` 및 `relationTypeIds` 개수 반영), `SqliteNodeSearchRepository`(100개 초과 `IN`/`NOT IN` 필터는 1-바인드 `json_each(?)` 폴백), `SqliteGraphRepository`, `SqliteDocRepository`, `SqliteTableRepository`, `SqliteAttributeRepository`, `SqliteRelationTypeRepository`, `SqliteQueryTemplateRepository` 모두 `getMaxBindParams(this.db)` 기준으로 쿼리 파라미터를 `<= 90`개 이하로 분할한다.
3. **지원되지 않는 파일/OS `PRAGMA` 가드**
   - [SqlitePragmas.ts](../../src/infrastructure/database/sqlite/SqlitePragmas.ts)는 `PRAGMA foreign_keys = ON`만 공통 실행하고 `supportsFilePragmas === false || driver === 'cloudflare-do-sqlite'`일 때는 `busy_timeout`, `synchronous`, `cache_size`, `temp_store`, `journal_mode`, `wal_autocheckpoint`, `mmap_size`를 실행하지 않는다.
4. **빌드 타임 정적 `schema.sql` & GraphQL SDL 번들링**
   - [generate-embedded-assets.ts](../../scripts/generate-embedded-assets.ts)가 `schema.sql`과 모든 `.graphql` SDL 문서를 정렬·해시해 [embedded-assets.ts](../../src/generated/embedded-assets.ts)(`EMBEDDED_INITIAL_SCHEMA_SQL`, `EMBEDDED_GRAPHQL_SDL_DOCUMENTS`, `EMBEDDED_ASSETS_VERSION_HASH`)로 생성하며 `--check` 게이트가 `check:static`에 통합되어 있다.
   - [DatabaseModule.ts](../../src/infrastructure/container/modules/DatabaseModule.ts)와 [GraphQLSchemaBuilder.ts](../../src/presentation/graphql/GraphQLSchemaBuilder.ts)는 런타임 `node:fs` / `loadFilesSync` 없이 정적 자산을 직접 사용한다.
5. **스냅샷 저장소 포트 · Portable Bootstrap · 단일 노드 Worker 어댑터**
   - [ISnapshotStoragePort.ts](../../src/domain/ports/ISnapshotStoragePort.ts)가 `InMemorySnapshotStorage`와 `R2BucketSnapshotStorage`(`CloudflareR2BucketLike` 제로-의존 계약)를 제공한다.
   - [PortableBootstrap.ts](../../src/infrastructure/container/PortableBootstrap.ts)의 `createPortableGraphNode`와 [CloudflareSingleNodeWorker.ts](../../src/presentation/cloudflare/CloudflareSingleNodeWorker.ts)의 `createCloudflareDurableObjectNode` · `routeSingleNodeRequest`(`x-graph-node-key` 정규식 검증, optional `AccessControl` + `internalBridgeToken` 전달, DO 스텁 라우팅)가 `/graphql`, `/api/*`, `/mcp`, `/sub/:tableId/mcp`, `/health` 전체를 서빙하며, `McpHttpServer`와 `modern-protocol.ts`는 정적 `node:fs`/`Buffer` 의존성 없이 Web Standard API(`atob`/`TextDecoder`)로 동작한다.

## 3. 단계별 도입 현황 및 로드맵

1. **Phase 1 — 런타임 중립 코어 · DO SQLite 포팅 계층 (구현·엄격 모의 검증 완료)**:
   - Node 26 `node:sqlite`와 DO `ctx.storage.sql` 양쪽을 지원하는 `ISqliteDatabase`/`DoSqliteDatabase`, `<= 90` 파라미터 청킹, 정적 `embedded-assets.ts`, `ISnapshotStoragePort`/`R2BucketSnapshotStorage`, `PortableBootstrap`(`/graphql`, `/api/*`, `/mcp`, `/sub/:tableId/mcp`, `/health`, `AccessControl`), `CloudflareSingleNodeWorker` 구현 완료.
   - [cloudflare-do-sqlite-portability.test.ts](../../tests/unit/cloudflare-do-sqlite-portability.test.ts)의 `StrictMockCloudflareDoStorage`(쿼리당 100개 파라미터 하드 상한, 명명 파라미터 금지, 미지원 PRAGMA 차단, 동기 `transactionSync` 강제)로 마이그레이션 v1..v14, 220노드·220엣지 배치·검색·순회, GraphQL(계층·탐색·분석)·REST·루트/테이블 MCP(`2026-07-28`)·인증 E2E를 검증했다.
2. **Phase 2 — 실제 Cloudflare Worker + SQLite DO 프로토타입 배포 (다음 단계)**:
   - `wrangler.jsonc` (`new_sqlite_classes` + `R2` 바인딩)와 `DurableObject` 클래스를 연결해 실제 `workerd` 환경에서 기동하고, DO Alarm 기반 R2 JSONL 스냅샷 주기 백업을 연결한다. (주의: 일부 선택적 레거시 백업/엑셀 리졸버는 여전히 동적/지연 `node:fs` 경로를 가지므로 Worker 전용 프로파일에서는 제외하거나 `ISnapshotStoragePort`로 치환한다.)
3. **Phase 3 — 멀티 워크스페이스 DO 확장 & 엣지 보안 결합 (다음 단계)**:
   - `getByName(workspaceId)`로 테이블/워크스페이스 단위 DO 분리(단일 DO CPU/직렬화 병목 해소) 및 앞단 Cloudflare Access JWT 검증 + 대용량 벡터용 Vectorize 옵션 검토.

## 4. 관련 문서

- [아키텍처 개요](./overview.md)
- [실전 활용 정의 및 기능 성숙도 매트릭스](../guides/USE_CASES_AND_CAPABILITIES.md)
- [운영 및 관리 가이드](../guides/OPERATIONS_GUIDE.md)
