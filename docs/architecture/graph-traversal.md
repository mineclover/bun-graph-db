---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
sources:
  - src/domain/services/graph/BreadthFirstSearch.ts
  - src/domain/services/graph/WeightedShortestPath.ts
  - src/domain/services/graph/StronglyConnectedComponents.ts
  - src/domain/services/graph/PageRank.ts
  - src/application/services/GraphTraversalService.ts
  - src/application/services/GraphAnalyticsService.ts
  - src/presentation/graphql/field-resolvers/NodeFieldResolvers.ts
  - src/presentation/graphql/resolvers/NodeResolver.ts
  - src/presentation/graphql/queries/RelationQueries.ts
  - src/presentation/graphql/queries/EnhancedRelationQueries.ts
  - src/presentation/graphql/schema/types/node.graphql
  - src/presentation/graphql/schema/queries/enhanced-relations-queries.graphql
  - src/infrastructure/database/sqlite/SqliteNodeRelationRepository.ts
  - src/infrastructure/database/sqlite/SqliteGraphRepository.ts
tests:
  - tests/unit/breadth-first-search.test.ts
  - tests/unit/weighted-shortest-path.test.ts
  - tests/unit/node-field-resolvers-graph-traversal.test.ts
  - tests/unit/sqlite-graph-repository-traversal.test.ts
  - tests/unit/strongly-connected-components.test.ts
  - tests/unit/page-rank.test.ts
  - tests/unit/graph-traversal-p0-p2.test.ts
  - tests/unit/use-case-scenarios-and-hierarchy.test.ts
  - tests/unit/analytics-and-custom-sort-queries.test.ts
  - tests/unit/cloudflare-do-sqlite-portability.test.ts
  - tests/unit/node26-runtime-and-optimizations.test.ts
---

# GraphQL 필드 탐색 계약과 계층 경계

이 문서는 `NodeFieldResolvers`·`NodeResolver`·`RelationQueries`·`EnhancedRelationQueries`와 REST 그래프 엔드포인트(`/api/nodes/:nodeId/connected`, `/api/nodes/shortest-path`)가 사용하는 탐색·가중 최단 경로·분석 계약을 설명한다.
API 형태의 정본은
[Node SDL](../../src/presentation/graphql/schema/types/node.graphql)과
[Enhanced Relations SDL](../../src/presentation/graphql/schema/queries/enhanced-relations-queries.graphql)이다.

## 책임 분리

```mermaid
flowchart TD
  Resolver["GraphQL field resolver: identifier 해석 · 응답 모양 · 오류 처리"] --> Service["GraphTraversalService: 저장소 읽기 · 방향/타입 필터 · batch"]
  Service --> BFS["BreadthFirstSearch: frontier · 중복 방지 · 부모 포인터"]
  Service --> Repositories["Node/NodeRelation repository 읽기 포트"]
  Repositories --> SQLite["SQLite 구현"]
```

[BFS 상태](../../src/domain/services/graph/BreadthFirstSearch.ts)는 import가 없는 동기 모듈이다.
GraphQL, SQLite, domain entity를 알지 못하며 문자열 node ID와 generic edge만 다룬다.
리졸버가 관계 identifier를 실제 ID로 해석하고,
[서비스](../../src/application/services/GraphTraversalService.ts)가 인접 목록을 읽어 한 레벨씩 전달한다.
알고리즘이 사용할 저장소 포트는 `findByIds`, `findBySourceNodeId`, `findByTargetNodeId`뿐이다.

Kuzu의 [Graph 읽기 인터페이스](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7f9/src/include/graph/graph.h)와
[single-parent 경로 상태](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7f9/src/include/function/gds/bfs_graph.h)에서
책임 분리 원칙을 참고했다. C++ 구현을 복제하거나 Kuzu 런타임을 연결한 변경은 아니다.

## 관측 가능한 동작

| 항목 | 계약 |
|---|---|
| `connectedNodes.depth` | 최대 hop 수, 기본 1. 명시적 `0`은 빈 배열이다. 음수는 빈 배열이다. |
| 방문·중복 | 레벨 순서 BFS, node ID당 최초 발견 한 번. 시작 노드는 공개 결과에서 제외한다. |
| 방향 | `OUTGOING`, `INCOMING`, 기본 `BOTH`. 방향에 맞는 저장소 읽기를 수행한다. |
| 관계 필터 | GraphQL 입력은 identifier. 리졸버에서 ID로 바꾼 뒤 발견 전에 필터링한다. 미지정은 전체, 빈 목록/모두 미확인인 identifier는 관계를 확장하지 않는다. |
| `shortestPath.maxDepth` | 기본 6. 경계 hop까지 도달할 수 있다. 방향은 `BOTH`이며 관계 타입 필터는 없다. |
| 최단의 의미 | 최소 hop 경로 한 개. 관계 `strength`를 가중 비용으로 사용하지 않는다. |
| 동률 | frontier 순서와 저장소 인접 목록 순서에서 먼저 발견한 부모를 유지한다. 저장소에 전역 정렬을 추가한 보장은 없다. |
| 경로 응답 | 시작에서 목표까지 순서대로 node를 반환한다. 같은 시작/목표는 0-hop이며, 경로가 없으면 빈 배열이다. |
| 0-hop 부가 동작 | 최단 경로의 시작/목표 일치 확인은 깊이 중단보다 먼저 한다. 음수 `maxDepth`도 같은 ID이면 기존처럼 0-hop 후보를 복원한다. |
| 노드 적재 | 한 번의 `findByIds`에 최대 500개. 반환 순서와 무관하게 탐색/경로 순서로 조립한다. |
| 인접 적재 | 최대 64개 frontier node씩 조회한다. SQLite bulk 경로(`findAdjacentByNodeIds`)는 한 번의 SQL `IN` 조회와 선택적 `relation_type_id IN (...)` pushdown을 사용한다. |
| 탐색 상한 | `GraphTraversalService`는 기본 `maxTraversalDepth = 32`, `maxVisitedNodes = 50_000` 상한으로 무제한 그래프 확장을 차단한다. |
| 존재하지 않는 node | 연결 탐색은 node를 적재하지 못하면 그 지점을 확장하지 않는다. 최단 경로는 기존처럼 관계를 따라 찾고 마지막 node 적재에서 없는 항목을 제외한다. |
| 일관성·범위 | 새 snapshot transaction이나 table 격리 정책을 도입하지 않는다. 저장소/요청 접근 제어의 기존 경계를 따른다. |

마지막 두 행은 후속 설계 대상이다. 탐색 중 삭제가 일어날 때의 snapshot 의미와 경로 중간
node의 누락 처리, 여러 table에 걸친 탐색 범위는 별도 결정 없이 이 모듈이 보장하지 않는다.
`depth=0`은 기존의 `|| 1` 처리에서 `?? 1`로 바꿔 명시적인 0을 존중하도록 수정했다.
`shortestPath`는 양쪽 frontier 중 더 작은 쪽을 먼저 확장하는 `BidirectionalBreadthFirstSearch`를 사용해
분기 계수 `b`, 깊이 `d` 그래프에서 탐색 공간을 `O(b^d)`에서 `O(b^(d/2))`로 줄이며, N-hop 거리 맵이 필요한
하이브리드 검색(`connectedNodeDistances`)은 단방향 레벨 순서 `BreadthFirstSearch`를 사용한다.

`findAdjacentByNodeIds` bulk 포트는 SQLite 관계 저장소에 적용되어 있으며, `BOTH` 방향 조회 시 `OR` 대신 `UNION` 인덱스 스캔으로 복합 인덱스 `idx_node_relations_src_type_dst`와 `idx_node_relations_dst_type_src` 위에서 `relation_type_id IN (...)` 조건을 SQL 단계로 pushdown한다. 하이브리드 검색의 그래프 신호 경로는 엣지 전체를 materialize하지 않는 경량 `findAdjacentEdgeTargetsByNodeIds`와 노드 존재 확인용 `findExistingIds`를 사용한다. bulk 메서드가 없는 저장소는 기존 per-node fallback을 사용한다. bulk 전환은 SQL round trip을 줄이지만 snapshot
transaction이나 새로운 table scope 정책을 만들지 않으며, 기존 SQLite 일관성 범위를 따른다.
GraphQL 로그에는 node batch 수, 요청/적재 node 수, adjacency batch 수, bulk/per-node 호출 수,
적재 관계 수, 최대 frontier, elapsed time을 남긴다. 이 값은 응답 계약이 아니며 최적화 비교용
관측치다. `elapsedMs`는 저장소 왕복과 entity 적재를 포함하고 GraphQL/HTTP 전체 왕복은 포함하지 않는다.

## 알고리즘 비용과 검증

frontier에는 node ID만 두고, 발견 시 node당 부모 ID와 edge 하나를 저장한다.
전체 경로는 `pathTo()`를 요청할 때 역방향으로 추적한 뒤 한 번 뒤집는다.
BFS 상태는 방문한 node 수에 대해 O(V), 경로 복원은 길이에 대해 O(L)이다.
이 표기는 저장소 조회, 인접 목록 materialization, 반환 node entity의 메모리는 제외한다.
기존 경로/관계 배열의 frontier별 복사를 제거했다는 구조적 개선이며, 실행 시간 개선율은 측정하지 않았다.

[알고리즘 테스트](../../tests/unit/breadth-first-search.test.ts)는 self-loop를 제외한 3-node 방향 그래프
64개 전체의 모든 시작/목표 조합을 독립적인 Floyd–Warshall 거리와 대조한다.
self-loop·parallel edge·cycle·동률·누락된 인접 목록은 별도 fixture로 검증하고,
10,000-hop 경로를 재귀 없이 복원한다.
[서비스/리졸버 테스트](../../tests/unit/node-field-resolvers-graph-traversal.test.ts)는
방향·타입 필터·명시적 depth 0·경계 최단 경로·1,001개 frontier의 batch·적재 순서를 검증한다.

```bash
pnpm exec vitest run \
  tests/unit/breadth-first-search.test.ts \
  tests/unit/weighted-shortest-path.test.ts \
  tests/unit/node-field-resolvers-graph-traversal.test.ts \
  tests/unit/sqlite-graph-repository-traversal.test.ts \
  tests/unit/strongly-connected-components.test.ts \
  tests/unit/page-rank.test.ts \
  tests/unit/graph-traversal-p0-p2.test.ts \
  tests/unit/node26-runtime-and-optimizations.test.ts
```

## 통합 루트 Query·REST·가중 경로·그래프 분석 계약 (P0–P2)

- **루트 `Query` 탐색 통합 (P0)**:
  - `Query.getConnectedNodes`는 `GraphTraversalService.connectedNodesWithDetails`와 bulk `resolveRelationTypeRefs`를 사용해 `depth <= 0`에서 빈 결과를 반환하고 N+1 조회 없이 `TableNode`와 `NodeRelation`을 완전 하이드레이션한다.
  - `Query.getDependencyChain`과 `Query.findPathsBetweenNodes`는 `relationTypeIds` 인수에 숫자 ID와 문자열 `identifier`를 모두 허용하고 `findByIds`·bulk 인접 조회로 완전한 `TableNode`·`NodeRelation` DTO를 반환한다. `getDependencyChain`은 `OUTGOING`·`INCOMING`·`BOTH`와 명시적 `maxDepth`(최대 32)를 모두 지원한다. `findPathsBetweenNodes`는 directed `OUTGOING` 단순 경로 탐색을 수행한다.
- **`SearchRelatedNodes`, REST 그래프 엔드포인트, 관계 품질 범위 일치 (P1)**:
  - `SearchRelatedNodesUseCase`와 `SqliteGraphRepository.searchRelatedNodes`는 `sourceNodeIds` 지정 시 chunked BFS로 도달 가능한 노드 집합만 스코프에 포함한다.
  - `BunApiRouter`는 `GET /api/nodes/:nodeId/connected`와 `POST /api/nodes/shortest-path`를 노출하며 `AccessControl`은 두 경로 모두 `reader` 권한과 노드 소속 테이블 스코프를 검사한다.
  - `NodeRelation`과 `CreateRelationUseCase`는 SQLite `CHECK` 제약과 동일하게 `strength`·`confidence`를 `0..4` 정수로 검증·영속화한다.
- **Dijkstra/Yen 가중 최단 경로 및 전체 그래프 분석 노출 (P2)**:
  - `WeightedShortestPath`(`dijkstraShortestPath`, `kShortestWeightedPaths`)와 `GraphAnalyticsService` / `EnhancedRelationQueries`가 `relationAnalytics`, `findOptimalPath`, `getNodeConnectivity`, `analyzeRelationshipStrength`, `resolveExternalReferences`, `discoverRelationPatterns`, `getHighConfidenceRelations`, `stronglyConnectedComponents`, `pageRank` 9개 GraphQL 쿼리를 실제 데이터와 도메인 알고리즘 기반으로 제공한다.
- **1급 계층 구조(Hierarchy Tree / DAG) 및 전체 SDL 완성**:
  - [GraphHierarchyService](../../src/application/services/GraphHierarchyService.ts)와 [Hierarchy SDL](../../src/presentation/graphql/schema/queries/hierarchy-queries.graphql)이 `parentOf`(또는 임의의 계층 관계 타입) 기반 `getAncestors`, `getDescendants`, `getSubtree`, `getHierarchyRoots`, `getHierarchyLeaves`, `getLowestCommonAncestor`, `validateHierarchy`(`TREE`/`DAG`), 사이클 방지 `moveHierarchyNode`를 제공한다.
  - 루트 리졸버에 `Query.relationTypeByIdentifier`, `Mutation.updateRelation`, `Mutation.bulkSetNodeAttributes`와 함께 속성 분석·커스텀 정렬·템플릿 성능 분석 12개 쿼리가 모두 연결되어 [실전 시나리오 통합 테스트](../../tests/unit/use-case-scenarios-and-hierarchy.test.ts), [분석·커스텀 정렬 테스트](../../tests/unit/analytics-and-custom-sort-queries.test.ts), [DO SQLite `<= 90`-바인드 포팅 테스트](../../tests/unit/cloudflare-do-sqlite-portability.test.ts)로 검증된다.

문서·SDL·테스트의 변경 순서는 [문서 관리 정책](../development/DOCUMENTATION_POLICY.md)을 따른다.
