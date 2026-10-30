---
docType: explanation
sourceLocale: ko
canonical: true
lastVerified: "2026-10-27"
owner: "Bun Graph DB maintainers"
sources:
  - src/domain/services/vector/ExactVectorIndex.ts
  - src/infrastructure/database/sqlite/SqliteNodeRelationRepository.ts
  - scripts/benchmark-vector-storage.ts
tests:
  - tests/unit/exact-vector-index.test.ts
  - tests/unit/sqlite-graph-repository-traversal.test.ts
---

# 벡터 검색과 대규모 저장소 비교 기준선

Kuzu의 vector 확장은 HNSW approximate nearest neighbor index를 제공한다.
Bun Graph DB에는 아직 embedding 저장·ANN index·vector API가 없으므로, 먼저 정확한 cosine
검색과 SQLite adjacency bulk read를 비교 기준선으로 고정한다. 이 문서는 Kuzu 성능을
추정하거나 대체 구현이 완료됐다고 선언하지 않는다.

## 현재 적용

`ExactVectorIndex`는 dimension이 고정된 in-memory index다.

- `upsert`, `delete`, `clear`, `search(topK, minScore)`를 제공한다.
- cosine similarity를 계산하고 score 내림차순, ID 오름차순으로 동률을 정렬한다.
- 모든 vector를 스캔하므로 정확성 기준선이며 검색 비용은 O(N × D)다.
- query metrics에 dimension, index size, scanned count, query elapsed time을 기록한다.
- persistence, tenant/table scope, filter pushdown, update durability는 제공하지 않는다.

SQLite 관계 저장소는 `findAdjacentByNodeIds`로 frontier node들을 한 SQL `IN` query에서 읽는다.
bulk 포트가 없는 저장소는 기존 per-node fallback으로 동작한다. benchmark는 같은 64개
frontier와 4 edges/node를 사용해 두 경로의 결과 row 수를 먼저 일치시킨 뒤 시간을 잰다.

## 재현 가능한 benchmark

```bash
bun run benchmark:vector-storage
```

2026-10-27 로컬 실행 결과는 다음과 같다. 수치는 Bun 1.3.9, in-memory SQLite,
dimension 64, 5회 반복의 median/p95이며, machine-specific advisory evidence다.

| fixture size | exact vector median/p95 ms | SQLite bulk median/p95 ms | SQLite per-node median/p95 ms | scanned/rows |
|---:|---:|---:|---:|---:|
| 100 | 0.307 / 0.344 | 0.782 / 1.503 | 1.320 / 2.111 | 100 / 256 |
| 1,000 | 0.601 / 0.673 | 0.653 / 1.144 | 8.557 / 10.033 | 1,000 / 256 |
| 5,000 | 1.483 / 1.623 | 2.535 / 3.084 | 48.667 / 162.158 | 5,000 / 256 |

이 결과에서 확인할 수 있는 범위는 exact vector scan이 N에 따라 증가하고, 같은 adjacency
결과를 bulk query로 읽는 경로가 64개 per-node query보다 이 fixture에서 짧았다는 점이다.
SQLite in-memory 실행이므로 disk WAL, page cache, filesystem, process RSS를 측정하지 않았다.
따라서 Kuzu columnar/CSR/HNSW와의 처리량 비교나 배수 주장은 하지 않는다.

## Kuzu와의 다음 비교 단계

| 축 | 현재 Bun 기준선 | Kuzu reference | 다음 실험 조건 |
|---|---|---|---|
| nearest neighbor | exact cosine, O(N × D), deterministic top-k | vector extension HNSW ANN | 같은 embeddings·metric·k·필터에서 recall@k, build/update/delete, cold/warm latency 측정 |
| graph adjacency | SQLite `IN` bulk vs per-node fallback | columnar/CSR neighbor scan | 같은 frontier·edge 수에서 query plan, RSS, disk size, cold/warm, result equality 기록 |
| persistence | in-memory vector index only | DB/index persistence와 extension lifecycle | restart recovery, index rebuild, schema/version migration을 통과해야 read model 채택 |
| filtering | vector index 자체의 minScore만 | ANN filter semantics는 extension/query 구성에 따름 | table/tenant/permission filter를 candidate 단계 또는 rerank 단계에서 명시 |
| consistency | application이 vector/node 변경을 묶지 않음 | transaction/WAL 기반 DB index lifecycle | node commit과 embedding/index update의 실패·재시도·staleness 계약 정의 |

Kuzu source의 [HNSW 생성](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7f9/extension/vector/src/function/create_hnsw_index.cpp)과
[질의](https://github.com/kuzudb/kuzu/blob/89f0263cc7a1fd9c396d2c4953747a013556a7/extension/vector/src/function/query_hnsw_index.cpp)는
ANN 후보 생성의 참고점이다. Bun 기준선은 같은 API나 알고리즘을 구현한 것이 아니며,
Kuzu runtime dependency도 추가하지 않는다.

대규모 저장소를 검토할 때는 먼저 SQLite adjacency bulk의 결과 동등성과 관측 지표를
고정한다. 그 후 disk-backed fixture와 Kuzu/C++ 또는 WASM binding을 동일 환경에서
실행한다. fixture가 다르거나 결과 semantics가 다르면 latency 숫자를 한 순위표에 섞지 않는다.
