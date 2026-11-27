---
docType: guide
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
sources:
  - src/application/services/GraphTraversalService.ts
  - src/application/services/GraphHierarchyService.ts
  - src/application/services/GraphAnalyticsService.ts
  - src/application/services/NodeAttributeAnalyticsService.ts
  - src/application/services/TemplatePerformanceAnalyticsService.ts
  - src/application/services/NodeAttributeSchemaGate.ts
  - src/application/services/TableSchemaProjectionService.ts
  - src/application/security/AccessControl.ts
  - src/infrastructure/database/sqlite/DoSqliteAdapter.ts
  - src/infrastructure/container/PortableBootstrap.ts
  - src/presentation/cloudflare/CloudflareSingleNodeWorker.ts
  - src/presentation/graphql/schema/queries/hierarchy-queries.graphql
  - src/presentation/graphql/schema/queries/enhanced-relations-queries.graphql
  - src/presentation/graphql/schema/types/relation.graphql
tests:
  - tests/unit/graph-traversal-p0-p2.test.ts
  - tests/unit/use-case-scenarios-and-hierarchy.test.ts
  - tests/unit/analytics-and-custom-sort-queries.test.ts
  - tests/unit/cloudflare-do-sqlite-portability.test.ts
  - tests/unit/access-control.test.ts
  - tests/unit/core-api-polishing.test.ts
  - tests/unit/ssot-and-aop-architecture.test.ts
---

# Bun Graph DB 실전 활용 정의 및 기능 성숙도 매트릭스

이 문서는 Bun Graph DB가 실제로 어떤 문제에 잘 맞고 어떤 경계 밖 요구에는 맞지 않는지, 그리고 현재 스키마·API의 구현·검증 현황을 정확히 정리해 안내한다.

## 1. 적합한 활용처 vs 부적합한 영역

| 구분 | 적합한 워크로드 | 부적합하거나 범위 밖인 워크로드 |
| --- | --- | --- |
| 핵심 형태 | 단일 프로세스(`Node 26` + `node:sqlite`) 또는 단일 노드 엣지(`Cloudflare Durable Object SQLite` Phase 1 런타임) 기반 **지식 그래프 · 계층형 분류체계 · 스펙 계보 · AI 에이전트 메모리** | 수 TB 규모 다중 노드 분산 그래프 저장소(Neo4j/JanusGraph 영역) |
| 규모 기준 | 수만 노드 · 수십만 엣지, 서브ms~수ms 홉 탐색 및 정확 코사인 벡터 검색 | 수천만~억 단위 대규모 ANN 벡터 인덱스(HNSW/DiskANN 필요 영역) |
| 스키마/API | 런타임에 테이블/속성 스키마가 변하는 **Typed EAV + GraphQL + OpenAPI 투영 + MCP 도구 자동 노출** | 다중 지역 수평 쓰기 샤딩 및 멀티라이터 SQLite 클러스터 |
| 보안 모델 | 토큰별 역할(`reader`/`writer`/`admin`) 및 `tableIds` 격리가 필요한 브리지·에이전트 API | 자체 사용자 계정·OAuth/OIDC SSO·행 수준(RLS) 멀티유저 SaaS |

## 2. 7대 실전 활용 시나리오

| 시나리오 | 결합 기능 | 핵심 API / 경로 | 검증 테스트 |
| --- | --- | --- | --- |
| 1. **AI 에이전트 장기 메모리 & MCP 허브** | 5-신호 AI 메모리(`AiMemoryService`) + `google/embeddinggemma-2` + MCP(`2026-07-28` / `2025-11-25` LTS) | `memory-remember`, `memory-recall`, `memory-consolidate`, `memory-context-window`, `/mcp`, `/sub/:tableId/mcp` | `tests/unit/mcp-modern-protocol.test.ts`, `tests/unit/web-embedded-and-use-cases.test.ts` |
| 2. **계층형 분류체계·정보구조화(IA) + 제로-임베딩 구조화 쿼리** | 선언형 IA 블루프린트(`knowledge`, `product-spec`, `decision-log`) + 영속 `iaKey`/diff/export + 칼럼 구성 옵션(`role`/`facetable`/`enumValues`/`defaultValue`/선택적 `embedding`) + `scopedByRelation`·`getOutline`·`queryPath`·`assembleContextPack`·`auditArchitecture` + IA MCP 도구 8종 | `applyBlueprint`, `diffBlueprint`, `exportBlueprint`, `getTableColumns`, `configureColumn`, `queryStructured`, `getOutline`, `queryPath`, `assembleContextPack`, `auditArchitecture`, `ia-*` MCP 도구 | `tests/unit/use-case-scenarios-and-hierarchy.test.ts`, `tests/unit/web-embedded-and-use-cases.test.ts`, `tests/unit/information-architecture-structured.test.ts` |
| 3. **스펙 계보 · 의존성 영향 분석 & 가중치 경로 탐색** | `dependsOn` 방향 탐색 + Dijkstra/Yen k-최단 경로 + `updateRelation` + SCC/PageRank | `getDependencyChain`, `findPathsBetweenNodes`, `findOptimalPath`, `updateRelation`, `relationTypeByIdentifier`, `stronglyConnectedComponents`, `pageRank` | `tests/unit/graph-traversal-p0-p2.test.ts`, `tests/unit/use-case-scenarios-and-hierarchy.test.ts` |
| 4. **런타임 스키마 카탈로그 (Typed EAV + OpenAPI 투영)** | `NodeAttributeSchemaGate` + 부분 수치 B-Tree pushdown + `bulkSetNodeAttributes` + ETag OpenAPI | `createAttribute`, `bulkSetNodeAttributes`, `/api/tables/:tableId/schema/audit`, `/api/openapi` | `tests/unit/schema/node-attribute-schema-gate.test.ts`, `tests/unit/use-case-scenarios-and-hierarchy.test.ts` |
| 5. **재사용 GraphQL 템플릿 · 단방향 표 동기화** | `QueryTemplate` 실행/복잡도 점수 + Google Sheets / `.xlsx` 단방향 내보내기 | `createTemplate`, `executeTemplate`, `/api/tabular-sync*` | `tests/unit/tabular-table-sync-bridge.test.ts`, `tests/unit/use-case-scenarios-and-hierarchy.test.ts` |
| 6. **이식 가능한 로컬/엣지 지식 그래프 백업** | JSONL(노드·속성·관계·임베딩, keyset 페이징) + ID 리매핑 복원 + SQLite 바이너리 백업 | `exportJsonl`, `importJsonl`, `backupDatabase`, `restoreDatabase` | `tests/unit/jsonl-backup-pagination.test.ts`, `tests/unit/use-case-scenarios-and-hierarchy.test.ts` |
| 7. **웹/브라우저 임베디드 그래프 DB & EmbeddingGemma-2** | `sql.js`/`sqlite-wasm` WASM SQLite + WebGPU/Transformers.js/HTTP `google/embeddinggemma-2` (MRL 768/512/256/128) | `createEmbeddedWebGraphDb`, `WebSqliteDatabase`, `EmbeddingGemma2Provider`, `EmbedNodesUseCase` | `tests/unit/embedding-gemma2-provider.test.ts`, `tests/unit/web-embedded-and-use-cases.test.ts` |

## 3. 계층 구조(Hierarchy: Tree / DAG) 모델링 가이드

Bun Graph DB는 전용 트리 컬럼 대신 `node_relations`의 방향성 엣지(`source_node_id --[relationType]--> target_node_id`, 기본 `parentOf`)를 1급 계층 모델로 승격해 처리한다.

- **방향 규약**: `sourceNodeId`가 **부모**, `targetNodeId`가 **자식**이다.
  - 상향 탐색(`getAncestors`, `getLowestCommonAncestor`): `INCOMING` 방향 BFS.
  - 하향 탐색(`getDescendants`, `getSubtree`): `OUTGOING` 방향 BFS.
- **Tree vs DAG 모드 (`validateHierarchy`)**:
  - `mode: TREE`: 사이클이 없고(`cycleNodeIds == []`) 모든 노드의 부모 수가 1 이하(`multiParentNodeIds == []`)여야 `valid: true`.
  - `mode: DAG`: 다중 부모는 허용하되 방향 사이클이 없을 때 `valid: true`.
- **안전 이동 (`moveHierarchyNode`)**:
  - 자기 자신 아래로 이동(`newParentId == nodeId`), 다른 테이블 노드로 이동, 자신의 자손 노드 아래로 이동(사이클 유발)을 모두 `VALIDATION_ERROR`로 차단한다.
  - 기존 부모 엣지들을 정리하고 새 부모 연결(또는 `newParentId: null` 시 루트 승격)을 적용한다.
- **서브트리 한정 하이브리드 검색**:
  - `hybridSearchNodes(input: { graph: { anchorNodeIds: [subtreeRootId], direction: OUTGOING, maxDepth: 6, relationTypes: ["parentOf"] }, queryText, queryVector })`를 사용하면 특정 조직·문서 폴더·카테고리 서브트리 내부에서만 FTS5 + 벡터 RRF 융합 검색을 수행한다.

## 4. 구현 및 검증 현황 (100% SDL 루트 리졸버 연결 완료)

### 구현·연결 및 검증 완료 (현재 운영 가능)

- 코어 CRUD & 스키마 게이트: `table*`, `node*`, `attribute*`, `doc*`, `template*`, `relationType`, `relationTypeByIdentifier`, `relationTypes`, `createRelation`, `updateRelation`, `deleteRelation`, `batchCreateRelations`, `bulkSetNodeAttributes`, REST `GET/DELETE /api/tables/:tableId`, `GET/PUT /api/tables/:tableId/columns*`, `GET/DELETE /api/nodes/:nodeId`, `DELETE /api/relations/:relationId`, `GET/POST /api/relation-types`
- 그래프 탐색 & REST: `TableNode.{connectedNodes, shortestPath, neighborsByRelationType}`, `Query.{getConnectedNodes, getDependencyChain, findPathsBetweenNodes, searchRelatedNodes}`, `GET /api/nodes/:nodeId/connected`, `POST /api/nodes/shortest-path`
- 가중치 경로 & 그래프 분석(9개): `relationAnalytics`, `findOptimalPath`, `getNodeConnectivity`, `analyzeRelationshipStrength`, `resolveExternalReferences`, `discoverRelationPatterns`, `getHighConfidenceRelations`, `stronglyConnectedComponents`, `pageRank`
- 계층 구조(8개): `getAncestors`, `getDescendants`, `getSubtree`, `getHierarchyRoots`, `getHierarchyLeaves`, `getLowestCommonAncestor`, `validateHierarchy`, `moveHierarchyNode`
- 속성 분석 · 커스텀 정렬 · 템플릿 성능 분석(12개, 모두 연결·검증 완료):
  - 속성 분석([NodeAttributeAnalyticsService.ts](../../src/application/services/NodeAttributeAnalyticsService.ts)): `nodeAttributeAnalytics`, `attributeValueDistribution`, `attributeCompleteness`, `nodeWithTypedAttributes`
  - 커스텀 정렬([NodeQueries.ts](../../src/presentation/graphql/queries/NodeQueries.ts)): `customSortFunctions`, `customSortFunction`
  - 템플릿 성능 분석([TemplatePerformanceAnalyticsService.ts](../../src/application/services/TemplatePerformanceAnalyticsService.ts) + `template_executions` 실기록): `templatePerformanceAnalytics`, `getHotQueries`, `getTemplateExecutionHistory`, `getTemplatePerformanceTrends`, `getSlowQueries`, `getTemplateRecommendations`
- 검증 범위: [analytics-and-custom-sort-queries.test.ts](../../tests/unit/analytics-and-custom-sort-queries.test.ts) 기준 실제 `Query` · `Mutation` SDL 필드 중 미연결 필드 **0개**, [cloudflare-do-sqlite-portability.test.ts](../../tests/unit/cloudflare-do-sqlite-portability.test.ts) 기준 엄격 모의 DO SQLite 환경에서 계층·탐색·분석·REST 경로 통과.

## 5. 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [MCP 참조](../mcp/README.md)
- [GraphQL 필드 탐색 계약과 계층 경계](../architecture/graph-traversal.md)
- [Cloudflare 단일 노드 아키텍처 검토](../architecture/cloudflare-single-node.md)
- [운영 및 관리 가이드](./OPERATIONS_GUIDE.md)
