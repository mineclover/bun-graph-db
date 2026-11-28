---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-11-28"
owner: "Bun Graph DB maintainers"
sources:
  - src/core-sdk.ts
  - src/embedded.ts
  - src/presentation/ui/index.ts
  - src/presentation/web/EmbeddedWebGraphDb.ts
  - src/infrastructure/database/sqlite/WebSqliteAdapter.ts
  - src/infrastructure/embeddings/EmbeddingGemma2Provider.ts
  - src/application/use-cases/nodes/EmbedNodes.ts
  - src/application/services/InformationArchitectureService.ts
  - src/application/blueprints/PresetBlueprints.ts
  - src/application/services/AiMemoryService.ts
  - src/domain/value-objects/ColumnConfig.ts
  - src/shared/utils/portableHash.ts
tests:
  - tests/unit/embedding-gemma2-provider.test.ts
  - tests/unit/web-embedded-and-use-cases.test.ts
  - tests/unit/information-architecture-structured.test.ts
  - tests/unit/headless-core-sdk.test.ts
  - tests/unit/mcp-stdio-and-cli.test.ts
  - tests/unit/platform-ui-architecture.test.ts
---

# Web Embedded Runtime · `google/embeddinggemma-2` · 정보구조화(IA) · AI Agent Memory 가이드

`bun-graph-db`를 **브라우저/웹 임베디드 저장소**, **`google/embeddinggemma-2` 임베딩 파이프라인**, **정보구조화(Information Architecture) 블루프린트/패싯 쿼리**, **5-신호 AI Agent Memory**로 활용하기 위한 공식 레퍼런스입니다.

---

## 1. 웹/브라우저 임베디드 실행 (`createEmbeddedWebGraphDb`)

Node.js 런타임이나 `node:crypto` 없이 브라우저 WASM SQLite (`sql.js` 또는 `@sqlite.org/sqlite-wasm` OO1/OPFS) 위에서 전체 GraphQL·REST·MCP(`2026-07-28`)·하이브리드 검색·IA·AI 메모리를 단일 객체로 실행합니다.

```ts
import {
  createEmbeddedWebGraphDb,
  createKnowledgeArchitectureBlueprint,
  createTransformersJsEmbeddingGemma2Backend,
  EmbeddingGemma2Provider,
  WebKeyValueSnapshotStorage,
} from 'bun-graph-db/embedded' // 또는 'src/embedded.ts'
```

- **어댑터 ([WebSqliteAdapter.ts](../../src/infrastructure/database/sqlite/WebSqliteAdapter.ts))**: `SqlJsDatabaseLike` 및 `SqliteWasmOo1DatabaseLike`를 자동 감지하여 `ISqliteDatabase` 포트로 감싸며, 중첩 `SAVEPOINT`·`Uint8Array` BLOB·`exportBytes()`·`WebKeyValueSnapshotStorage`를 제공합니다.
- **제로-노드 해시 ([portableHash.ts](../../src/shared/utils/portableHash.ts))**: 순수 TypeScript FIPS 180-4 SHA-256 (`sha256Base64Url`, `constantTimeEqual`)로 ETag와 Bearer 토큰 비교를 브라우저/Cloudflare Workers/Node 26에서 동일하게 수행합니다.

---

## 2. `google/embeddinggemma-2` 임베딩 연동 ([EmbeddingGemma2Provider.ts](../../src/infrastructure/embeddings/EmbeddingGemma2Provider.ts))

Google `google/embeddinggemma-2` (및 브라우저용 `onnx-community/embeddinggemma-2-ONNX`)의 공식 태스크 프리픽스와 **Matryoshka Representation Learning (MRL)** 차원 축소(`768 / 512 / 256 / 128`) + L2 재정규화를 기본 내장합니다.

- **태스크 프리픽스**:
  - 문서 색인 (`retrieval_document`): `title: {title | none} | text: {content}`
  - 검색 질의 (`retrieval_query`): `task: search result | query: {query}`
  - QA/사실검증/분류/클러스터링/유사도/코드검색 및 멀티모달 무프리픽스 규칙 준수
- **수치 안정성 가드**: `fp16`(`float16`) 사용 시 `NaN` 발생을 방지하기 위해 `assertValidEmbeddingGemma2Dtype`로 거부하고 `q4`, `q8`, `bf16`, `fp32`만 허용합니다.
- **플러그형 백엔드**:
  - `createTransformersJsEmbeddingGemma2Backend` (`@huggingface/transformers` v3 WebGPU/WASM/CPU)
  - `createHttpEmbeddingGemma2Backend` (OpenAI `/v1/embeddings`, Ollama `/api/embed`)
  - `createDeterministicHashEmbeddingBackend` (테스트/오프라인 샌드박스용 결정적 투영)
- **자동 임베딩 검색 ([HybridSearchNodes.ts](../../src/application/use-cases/nodes/HybridSearchNodes.ts))**: `PortableBootstrap`에 `embeddingProvider`를 전달하면 `EmbedNodesUseCase`로 노드를 일괄 임베딩(`embedTableByColumnConfig`로 `embedding.enabled: true` 칼럼 테이블만 선택 임베딩 포함)하고, `hybridSearchNodes` 호출 시 `vector` 없이 `textQuery`만 넘겨도 `retrieval_query` 벡터를 자동 생성합니다.
  - **임베딩은 선택적 칼럼 옵션**: 테이블 속성([ColumnConfig.ts](../../src/domain/value-objects/ColumnConfig.ts))에 `options.embedding: { enabled: true, sourceColumns, task, dimension }`이 선언되어 있을 때만 해당 테이블을 선택적으로 벡터화하며, 선언이 없으면 임베딩 없이도 전체 IA 파이프라인이 완전히 동작합니다.

---

## 3. 정보구조화(Information Architecture) 블루프린트 & 제로-임베딩 구조화 쿼리

[InformationArchitectureService.ts](../../src/application/services/InformationArchitectureService.ts)는 **`embeddingProvider` 없이도** FTS5 + 타입드 EAV Pushdown + TREE/DAG 계층 + 다중 홉 그래프 경로를 조합해 완전한 정보 구조화 수명주기를 실행합니다 (`google/embeddinggemma-2` 연동 시 의미 유사도 자동 가산).

- **프리셋 블루프린트 ([PresetBlueprints.ts](../../src/application/blueprints/PresetBlueprints.ts))**:
  - `createKnowledgeArchitectureBlueprint()` (`ia_topics` TREE + `ia_documents` 패싯 카탈로그 + `ia_concepts` DAG)
  - `createProductSpecArchitectureBlueprint()` (`spec_domains` TREE + `spec_requirements` + `spec_components` DAG)
  - `createDecisionLogArchitectureBlueprint()` (`adr_areas` TREE + `adr_decisions` + `adr_evidence`)
  - `getPresetBlueprint('knowledge' | 'product-spec' | 'decision-log')`
- **영속 논리 키 & 수명주기 (`applyBlueprint`, `diffBlueprint`, `exportBlueprint`)**:
  - 노드 생성 시 `metadata.iaKey`를 SQLite에 영속화하여 DB 스냅샷 재오픈 후에도 `resolveNodeIdByKey`로 자동 복원합니다.
  - `diffBlueprint`로 드라이런 diff를 계산하고, `applyBlueprint(bp, { updateExistingNodes: true })`로 증분 업데이트하며, `exportBlueprint`로 라이브 DB 스키마·문서·노드·관계를 선언형 블루프린트로 직렬화합니다.
- **제로-임베딩 구조화 쿼리·개요·경로·컨텍스트 조립**:
  - `queryStructured`: 단일 테이블 서브트리(`underNodeKey`) 또는 교차 테이블 분류 스코핑(`scopedByRelation` + `includeTopicBreadcrumbs`), EAV `filterQuery`, FTS5 `textQuery`, `facets`, `includeBreadcrumbs`, `includeRelated` 지원
  - `getOutline`: 결정적 계층 트리 + 연결 관계 수 카운트(`countLinkedRelationTypes`) + 마크다운 TOC 생성
  - `queryPath`: `minDepth`/`maxDepth`·방향·중간 테이블/속성 필터를 갖춘 다중 홉 경로 탐색 및 단계별 계보(`steps`) 반환
  - `assembleContextPack`: 개요 + 매칭 항목 + 1-홉 이웃 노드를 `maxChars` 예산 내 마크다운 컨텍스트 팩으로 조립
  - `auditArchitecture`: `TREE`/`DAG` 무결성, `SchemaGate` 적합성, 고립 계층 노드(`ORPHAN_HIERARCHY_NODE`), 필수 교차 링크(`expectedLinks` -> `MISSING_EXPECTED_LINK`) 감사
- **칼럼 구성 옵션 ([ColumnConfig.ts](../../src/domain/value-objects/ColumnConfig.ts))**: 각 속성에 `role`(`status`, `priority`, `slug`, `embedding` 등), `facetable`, `searchable`, `filterable`, `sortable`, `enumValues`, `defaultValue`, `displayOrder`, `hidden`, `embedding` 옵션을 저장/검증/내보내며 `facets: 'auto'` 자동 패싯, 기본값 주입, 허용값(`enumValues`) 쓰기/감사 검증을 제공합니다.
- **IA MCP `2026-07-28` 도구 8종**: `ia-apply-blueprint`, `ia-query-structured`(`autoFacets`), `ia-get-outline`, `ia-query-path`, `ia-assemble-context`(`autoFacets`), `ia-audit`, `ia-get-columns`, `ia-configure-column`

---

## 4. 5-신호 AI Agent Memory ([AiMemoryService.ts](../../src/application/services/AiMemoryService.ts))

`ai_memory_topics`(TREE 계층)와 `ai_memories`(Typed EAV) 테이블을 기반으로 동작하며, 임베딩 없이(FTS5 + 토픽 트리 + 시간 감쇠 + 중요도 + 태그 필터 `tags`/`tagMatchMode`) 또는 `EmbeddingGemma-2`와 결합해 실행할 수 있습니다. MCP `2026-07-28` 도구(`memory-remember`, `memory-recall`, `memory-consolidate`, `memory-context-window`)로도 바로 노출됩니다.

- **메모리 유형 & 기본 반감기**: `working`(1일), `episodic`(14일), `semantic`(180일), `procedural`(365일)
- **5-신호 회상(`recall`) & 토픽 개요(`getTopicOutline`)**: FTS5 BM25 + (`EmbeddingGemma-2` 선택적 코사인 유사도) + 토픽/앵커 그래프 근접도 + 지수 감쇠 최신성(`0.5 ** (ageDays / halfLifeDays)`) + 중요도·접근 빈도 현저성(salience) 결합, 접근 시 `access_count`/`last_accessed_at` 자동 강화, `getTopicOutline`으로 메모리 토픽 트리 점검
- **수명주기 & 컨텍스트 조합**: `consolidate`(출처 메모리 `superseded` 처리 + `derivedFrom` 계보 기록), `forget`, `pruneExpired`, `getContextWindow`(토큰 예산 내 프롬프트 컨텍스트 조합), `getTimeline`, `getStats`

---

## 5. 제로-의존 Headless Core (`bun-graph-db/core`) · 플랫폼 UI (`bun-graph-db/ui`) · IndexedDB · Stdio MCP · CLI

- **초경량 Headless Core SDK ([src/core-sdk.ts](../../src/core-sdk.ts), [HeadlessGraphDb.ts](../../src/core/HeadlessGraphDb.ts))**: `graphql`, `graphql-yoga`, `ajv`, `node:*` 의존성 **0개**로 `createHeadlessGraphDb`와 IA·5-신호 AI Memory·그래프 탐색을 번들합니다(`examples/web-embedded-ia-memory/` 참조).
- **FTS5 비포함 WASM 호환**: `sql.js` 표준 빌드처럼 `ENABLE_FTS5`가 꺼진 SQLite 런타임에서는 `supportsFts5()`가 이를 자동 감지해 FTS5 가상 테이블 생성을 건너뛰고 `SqliteNodeSearchRepository`의 SQL `LIKE` 경로로 투명하게 폴백합니다.
- **제로-프레임워크 플랫폼 UI ([PLATFORM_UI_AND_WORKSPACE.md](./PLATFORM_UI_AND_WORKSPACE.md))**: `<graph-memory-workspace mode="local-headless">` Web Component(`bun-graph-db/ui`)를 `createHeadlessGraphDb`에 연결하면 브라우저 안에서 6대 뷰(`table`/`outline`/`board`/`graph`/`timeline`/`audit`), 인라인 편집, Right Inspector Drawer, Saved Views(`ui_views`), IndexedDB 스냅샷 저장·복원을 즉시 사용할 수 있습니다.
- **IndexedDB 스냅샷 저장소 ([IndexedDbSnapshotStorage.ts](../../src/infrastructure/database/sqlite/IndexedDbSnapshotStorage.ts))**: 브라우저 `IDBFactory` 기반 `ISnapshotStoragePort` 구현으로 WASM SQLite 바이트 스냅샷(`putSnapshot`/`getSnapshot`/`listSnapshots`/`deleteSnapshot`)을 페이지 새로고침 간 영속화합니다.
- **MCP Stdio 서버 ([McpStdioServer.ts](../../src/mcp/stdio/McpStdioServer.ts)) & 통합 CLI ([src/cli/index.ts](../../src/cli/index.ts))**:
  - `npx graph-memory init --database-path ./data/graph-memory.sqlite --preset knowledge`
  - `npx graph-memory mcp --database-path ./data/graph-memory.sqlite` (Claude Desktop / Cursor용 stdio JSON-RPC 2.0, `stdout` 순수 프로토콜 유지 및 `--table <id>` 스코프 격리 지원, `examples/mcp-ai-memory/` 참조)
  - `npx graph-memory inspect --json`, `backup`, `restore`, `serve`
