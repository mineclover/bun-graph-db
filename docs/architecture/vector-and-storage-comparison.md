---
docType: explanation
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
sources:
  - src/domain/services/vector/ExactVectorIndex.ts
  - src/domain/repositories/INodeEmbeddingRepository.ts
  - src/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.ts
  - src/application/use-cases/nodes/HybridSearchNodes.ts
  - src/infrastructure/database/sqlite/SqliteNodeRelationRepository.ts
  - scripts/benchmark-vector-storage.ts
tests:
  - tests/unit/exact-vector-index.test.ts
  - tests/unit/sqlite-node-embedding-and-hybrid-search.test.ts
  - tests/unit/sqlite-graph-repository-traversal.test.ts
  - tests/unit/engine-optimizations-p0-p2.test.ts
---

# 벡터·하이브리드 검색과 대규모 저장소 비교 기준선

Kuzu의 vector 확장은 HNSW approximate nearest neighbor index를 제공한다.
Bun Graph DB는 단일 SQLite 파일 기반 영속 `Float32Array` 임베딩 저장소(`node_embeddings`),
정확 코사인 검색(`SqliteNodeEmbeddingRepository`, `ExactVectorIndex`), 그리고 N-hop 그래프·타입 속성 필터·FTS5 BM25·벡터 코사인을 결합한 RRF 하이브리드 검색(`HybridSearchNodesUseCase`)을 제공한다.
이 문서는 현재 정확 벡터·하이브리드 구현과 SQLite adjacency bulk read 기준선을 설명하며, Kuzu HNSW 성능을 추정하거나 근사 ANN 인덱스가 구현됐다고 선언하지 않는다.

## 현재 적용

1. **순수 인메모리 기준선 (`ExactVectorIndex`, `BoundedTopKCollector`)**:
   - 고정 dimension에서 `upsert`, `delete`, `clear`, `search(topK, minScore)`를 제공한다.
   - 정확 cosine similarity를 `O(N * D)`로 계산하고 `BoundedTopKCollector`(`O(N log K)`)로 상위 `K`건만 유지하며 score 내림차순·ID 오름차순으로 동률을 정렬한다.
2. **영속 SQLite `Float32Array` 저장소 (`SqliteNodeEmbeddingRepository`)**:
   - Migration 13(`persistent-node-embeddings`)이 `node_embeddings`(`vector_blob BLOB`, 사전 계산된 float32 L2 `norm`, `dimension`, `model`, `table_id`)와 `node_embedding_revisions` 카운터 트리거를 생성하며, Migration 14(`optimize-eav-indexes-and-write-triggers`)가 `node_embeddings_rev_update_old_table` 트리거를 `old.table_id != new.table_id` 조건으로 제한해 일반 임베딩 갱신의 이중 개정 쓰기를 제거한다.
   - 노드·테이블 삭제 트리거가 고아 임베딩을 자동 정리하며, 테이블별 write-through LRU 캐시(최대 64 테이블 / 128 MiB)는 `(dimension, model)` 버킷별 단위 정규화(unit-normalized) 연속 `Float32Array` 슬랩과 `node_embedding_revisions` PK 조회(`O(1)`)로 외부 삭제·갱신까지 즉시 감지해 재동기화한다.
   - `upsertMany` / GraphQL `batchSetNodeEmbeddings`는 단일 SQLite `IMMEDIATE` 트랜잭션으로 일괄 저장하며, `restrictToNodeIds` 후보 집합이 버킷 전체 슬롯보다 작으면 후보 오프셋만 직접 순회해 스캔 비용을 `O(|C| * D)`로 줄인다.
3. **4-신호 RRF 하이브리드 검색 (`HybridSearchNodesUseCase`)**:
   - 선택적 N-hop 그래프 이웃 거리(`GraphTraversalService.connectedNodeDistances` + 경량 엣지 타깃/존재 확인 포트) ∩ 타입 EAV 속성 필터(`node_attributes.value_num` 부분 B-Tree pushdown) ∩ (`node_search_fts` / `node_attribute_search_fts` BM25 + 단위 정규화 `Float32Array` 코사인 유사도 + hop 근접도)를 Reciprocal Rank Fusion(RRF)으로 결합한다.
   - GraphQL(`hybridSearchNodes`, `nodeEmbedding`, `setNodeEmbedding`, `removeNodeEmbedding`), REST(`/api/nodes/hybrid-search`, `/api/nodes/:nodeId/embedding`), 루트·테이블 MCP 도구에서 동일한 `AccessControl` 테이블 권한 경계를 통과한다.

SQLite 관계 저장소는 `findAdjacentByNodeIds` (`BOTH` 방향 `UNION` 인덱스 스캔)와 경량 `findAdjacentEdgeTargetsByNodeIds`로 frontier node들을 한 SQL query(및 선택적 `relation_type_id IN (...)` pushdown)에서 읽는다.
bulk 포트가 없는 저장소는 기존 per-node fallback으로 동작한다. benchmark는 같은 64개
frontier와 4 edges/node를 사용해 두 경로의 결과 row 수를 먼저 일치시킨 뒤 시간을 잰다.

## 재현 가능한 benchmark

```bash
pnpm run benchmark:vector-storage
```

2026-10-31 Bun 1.3.9 로컬 실행 기준선과 2026-11-27 Node.js v26.13.1 (`node:sqlite`, SQLite 3.54.1) 로컬 실행 기준선은 다음과 같다. 수치는 machine-specific advisory evidence다.

### 2026-11-27 Node.js v26.13.1 + SQLite 3.54.1 기준선

| fixture size | exact vector median/p95 ms | SQLite bulk median/p95 ms | SQLite per-node median/p95 ms | scanned/rows |
|---:|---:|---:|---:|---:|
| 100 | 0.041 / 0.042 | 0.587 / 0.712 | 1.773 / 2.438 | 100 / 256 |
| 1,000 | 0.120 / 0.284 | 0.720 / 0.783 | 7.264 / 7.569 | 1,000 / 256 |
| 5,000 | 0.278 / 0.368 | 2.364 / 2.521 | 36.256 / 37.599 | 5,000 / 256 |

### 2026-10-31 Bun 1.3.9 비교 기준선

| fixture size | exact vector median/p95 ms | SQLite bulk median/p95 ms | SQLite per-node median/p95 ms | scanned/rows |
|---:|---:|---:|---:|---:|
| 100 | 0.048 / 0.095 | 0.659 / 0.903 | 1.320 / 1.981 | 100 / 256 |
| 1,000 | 0.094 / 0.097 | 0.562 / 0.728 | 6.809 / 11.491 | 1,000 / 256 |
| 5,000 | 0.185 / 0.216 | 1.922 / 2.263 | 32.392 / 33.428 | 5,000 / 256 |

이 결과에서 확인할 수 있는 범위는 exact vector scan이 N에 따라 증가하고, 같은 adjacency
결과를 bulk query로 읽는 경로가 64개 per-node query보다 이 fixture에서 짧았다는 점이다.
SQLite in-memory 실행이므로 disk WAL, page cache, filesystem, process RSS를 측정하지 않았다.
따라서 Kuzu columnar/CSR/HNSW와의 처리량 비교나 배수 주장은 하지 않는다.

## Kuzu와의 다음 비교 단계

| 축 | 현재 Bun 기준선 | Kuzu reference | 다음 실험 조건 |
|---|---|---|---|
| nearest neighbor | exact cosine, O(N × D) 또는 후보 제한 O(\|C\| × D), deterministic top-k | vector extension HNSW ANN | 수만 건 이상에서 같은 embeddings·metric·k·필터로 recall@k, build/update/delete, cold/warm latency 비교 |
| graph adjacency | SQLite `IN` bulk + `relation_type_id` pushdown vs per-node fallback | columnar/CSR neighbor scan | 같은 frontier·edge 수에서 query plan, RSS, disk size, cold/warm, result equality 기록 |
| persistence | SQLite `node_embeddings` Float32 BLOB + revision-synced cache | DB/index persistence와 extension lifecycle | 대규모 디스크 fixture에서 cold cache reload 및 WAL checkpoint 비용 측정 |
| filtering | table scope + N-hop graph + typed EAV (`value_num`) candidate pre-filter | ANN filter semantics는 extension/query 구성에 따름 | ANN 도입 시 pre-filter vs post-filter recall 저하 구간 정량화 |
| consistency | SQLite FK/트리거 cascade + `node_embedding_revisions` 즉시 캐시 무효화 | transaction/WAL 기반 DB index lifecycle | 외부 임베딩 생성 파이프라인의 비동기 갱신·모델 버전 전환 정책 정의 |

Kuzu source의 [HNSW 생성](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7f9/extension/vector/src/function/create_hnsw_index.cpp)과
[질의](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7/extension/vector/src/function/query_hnsw_index.cpp)는
ANN 후보 생성의 참고점이다. Bun 기준선은 같은 API나 알고리즘을 구현한 것이 아니며,
Kuzu runtime dependency도 추가하지 않는다.

대규모 저장소를 검토할 때는 먼저 SQLite adjacency bulk의 결과 동등성과 관측 지표를
고정한다. 그 후 disk-backed fixture와 Kuzu/C++ 또는 WASM binding을 동일 환경에서
실행한다. fixture가 다르거나 결과 semantics가 다르면 latency 숫자를 한 순위표에 섞지 않는다.
