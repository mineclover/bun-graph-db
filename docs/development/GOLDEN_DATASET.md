---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
sources:
  - tests/fixtures/golden/golden-dataset.json
  - tests/fixtures/golden/golden-expected.json
  - tests/fixtures/golden/golden-loader.ts
tests:
  - tests/unit/golden-dataset.test.ts
---

# 핵심 기능 골든 테스트 데이터셋 (Core Golden Test Dataset)

`bun-graph-db`의 핵심 그래프·스키마·검색·계층·분석·MCP·REST·보안·백업 기능을 **Node 26 (`node:sqlite`)**, **Cloudflare Durable Object SQLite**, **JSONL 라운드트립** 전반에서 동일하게 검증하는 결정적(deterministic) 기준 데이터셋입니다.

## 빠른 실행

```bash
pnpm run test:golden
```

---

## 데이터셋 구성 (`bun-graph-db.golden-dataset.v1`)

정적 픽스처와 기대 결과는 [golden-dataset.json](../../tests/fixtures/golden/golden-dataset.json) 및 [golden-expected.json](../../tests/fixtures/golden/golden-expected.json)에 정의되며, 시딩과 10대 기능군 검증은 [golden-loader.ts](../../tests/fixtures/golden/golden-loader.ts)가 담당합니다.

### 1. `golden_org_hierarchy` (엄격한 Tree 계층 토폴로지)
- **노드 (8)**: `ceo` → `{eng, product}`, `eng` → `{platform, ai}`, `platform` → `{storage, runtime}`, `product` → `design`
- **속성 (5)**: `tier` (`integer`), `headcount` (`integer`), `active` (`boolean`), `founded` (`date`, `YYYY-MM-DD`), `budget_m` (`number`)
- **관계 (7)**: `parentOf` 트리 엣지
- **검증 초점**: 루트/리프 탐지, `getAncestors`, `getSubtree`, `getLowestCommonAncestor`, `validateHierarchy(mode: TREE)`, `moveHierarchyNode` 사이클 차단 및 합법 재배치

### 2. `golden_knowledge_docs` (그래프·하이브리드 검색·분석·문서 토폴로지)
- **노드 (8)**:
  - 가중치 다이아몬드 경로: `doc_bfs` → `doc_dijkstra` → `doc_mcp_spec` (고신뢰 경로) 및 `doc_bfs` → `doc_edge_do` → `doc_dijkstra` (저신뢰 우회 경로)
  - 3-노드 순환 사이클(SCC): `doc_scc_a` → `doc_scc_b` → `doc_scc_c` → `doc_scc_a` (`references`)
  - 고립 노드: `doc_island` (연결 0)
- **임베딩 (8 × 8D Float32)**: `golden-8d` 모델 영속 벡터
- **문서 (`docs`)**: 활성 `usage` v2, 활성 `spec` v1 (총 3건 중 2건 활성)
- **검증 초점**: FTS5 전문 검색, `value_num` 숫자형 SQL 푸시다운 필터·정렬, 4-신호 `hybridSearchNodes`, 가중 `findOptimalPath`, Tarjan `stronglyConnectedComponents`, `pageRank`, `getNodeConnectivity`, `getDocs`, `nodeAttributeAnalytics`, `attributeCompleteness`, `customSortFunctions`, `tableOpenApiProjection`, REST `schema/audit` 및 `shortest-path`

### 3. `golden_service_dag` (다중 부모 DAG 토폴로지)
- **노드 (5)**: `gateway` → `{auth, search}`, `{auth, search}` → `db_core` (공통 다중 부모), `search` → `cache`
- **검증 초점**: `validateHierarchy(mode: DAG)` 통과 vs `validateHierarchy(mode: TREE)` 실패(`multiParentNodeIds: ["db_core"]`) 구분

### 4. 재사용 템플릿 (`templates`)
- `golden-search-docs`: 키워드 기반 문서 검색 템플릿 (`executeTemplateWithGraphQL` + `templatePerformanceAnalytics` 실행 계측 검증)
- `golden-org-subtree`: 조직 서브트리 조회 템플릿

---

## 교차 런타임 검증 매트릭스 ([golden-dataset.test.ts](../../tests/unit/golden-dataset.test.ts))

| 검증 대상 | 검증 범위 |
| --- | --- |
| **Node 26 `node:sqlite`** | 10대 기능군 전체, `NodeAttributeSchemaGate` 타입 거부, `moveHierarchyNode` 사이클 가드, 템플릿 실행 및 메트릭, 신규 정렬 REST 라우트, MCP `2026-07-28` (`tools/list`, `ToolAnnotations`, `outputSchema`, `structuredContent`), `AccessControl` 역할(`403`) 및 테이블 격리(`404`) |
| **Cloudflare DO SQLite (Strict Mock)** | 금지된 SQLite `PRAGMA` 차단, 100개 바인딩 파라미터 한계 준수, `transactionSync` 제약 하에서 동일 데이터셋·검증 통과 |
| **JSONL Export/Import 라운드트립** | `exportJsonl` → 신규 인메모리 DB `importJsonl(OVERWRITE)` 후 테이블·속성·노드·관계·임베딩 복원 및 동일 검증 통과 (`docs` 테이블은 JSONL 백업 범위 밖이므로 `includeDocs: false`로 검증) |
