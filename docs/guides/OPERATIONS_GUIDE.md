---
docType: how-to
sourceLocale: ko
canonical: true
lastVerified: "2026-10-31"
owner: "Bun Graph DB maintainers"
sources:
  - index.ts
  - src/application/security/AccessControl.ts
  - src/infrastructure/database/sqlite/DatabaseMigrationRunner.ts
  - src/application/services/NodeAttributeSchemaGate.ts
  - src/domain/services/JsonlBackupService.ts
  - src/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.ts
  - src/application/use-cases/nodes/HybridSearchNodes.ts
  - src/application/services/BestEffortTabularSyncHook.ts
tests:
  - tests/unit/access-control.test.ts
  - tests/unit/database-migration-runner.test.ts
  - tests/unit/schema/node-attribute-schema-gate.test.ts
  - tests/unit/jsonl-backup-pagination.test.ts
  - tests/unit/sqlite-node-embedding-and-hybrid-search.test.ts
  - tests/unit/engine-optimizations-p0-p2.test.ts
---

# Bun Graph DB 운영 및 관리 가이드

이 문서는 단일 Bun 프로세스와 SQLite 데이터베이스로 동작하는 Bun Graph DB의 배포 구성, 접근 제어, 스키마 마이그레이션·정합성 감사, 하이브리드 검색·임베딩 관리, JSONL 백업·재해 복구, 표 형식 동기화 큐 제어, 정기 품질 점검 절차를 정리한다.

시스템 계층과 설계 배경은 [아키텍처 개요](../architecture/overview.md)를, 운영 준비도 요구사항은 [운영 준비도 명세](../../specs/008-production-readiness/spec.md)를 함께 참조한다.

---

## 1. 기동, 빌드 및 환경 변수 구성

### 주요 실행 명령

```bash
# 개발 실행 (파일 변경 감지)
bun run dev

# 프로덕션 번들 빌드 (선택적 Excel 어댑터 xlsx는 외부 모듈로 분리)
bun run build

# 프로덕션 기동 예시
NODE_ENV=production \
PORT=4141 \
DATABASE_PATH=/var/lib/bun-graph-db/graph.sqlite \
BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN="<32자-이상-고엔트로피-토큰>" \
BUN_GRAPH_DB_ACCESS_TOKENS='{"<admin-token>":{"id":"ops-admin","role":"admin","tableIds":["*"]}}' \
bun index.ts
```

- **단일 Writer 원칙**: SQLite 파일 잠금과 트랜잭션 일관성을 위해 하나의 SQLite 파일에는 단일 Bun Graph DB 인스턴스만 쓰기를 수행하도록 배포한다.
- **선택적 Excel 의존성**: `bun run build`는 `--external xlsx` 플래그로 SheetJS(`xlsx`)를 코어 번들(`dist/index.js`)에서 분리한다. 로컬 `.xlsx` 표 동기화 대상을 활성화한 배포에서만 런타임 `node_modules/xlsx`가 로드된다.
- **정상 종료(`SIGINT` / `SIGTERM`) 순서**:
  1. `AutoPersistenceService.shutdown()` 자동 백업 확인 및 수행
  2. Bun HTTP 리스너 신규 연결 수락 중단(`server.stop()`)
  3. 루트 MCP(`McpHttpServer.close()`) 및 테이블 MCP(`tableMcpMiddleware.close()`) 종료
  4. DI 컨테이너 역순 해제(`disposeContainer()`)를 통한 SQLite 연결 정리

### 핵심 환경 변수 요약

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production`일 때 인증과 속도 제한이 기본 활성화됨 |
| `PORT` | `4141` | HTTP / GraphQL / MCP 수신 포트 (`--port` CLI 인수로 재정의 가능) |
| `DATABASE_PATH` | `./data/bun-graph-db.sqlite` | SQLite 데이터 파일 경로 (`--database-path` CLI 인수로 재정의 가능) |
| `BUN_GRAPH_DB_AUTH_REQUIRED` | `NODE_ENV === 'production'` | 외부 요청 인증 강제 여부 (`true` / `false`) |
| `BUN_GRAPH_DB_ACCESS_TOKENS` | 미설정 | 토큰별 `{ id, role, tableIds }` JSON 맵 |
| `BUN_GRAPH_DB_API_TOKEN` | 미설정 | 레거시 호환 전역 `admin` 단일 토큰 |
| `BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN` | 미설정 | 인증 활성화 시 필수(32자 이상). 프로세스 내 MCP -> GraphQL/REST 브리지 전용 Bearer 토큰 |
| `BUN_GRAPH_DB_ALLOWED_ORIGINS` | 미설정 (`CORS_ORIGIN` 대체) | 허용 브라우저 `Origin` 쉼표 구분 목록 |
| `BUN_GRAPH_DB_RATE_LIMIT_ENABLED` | `NODE_ENV === 'production'` | 주체(`principal`) 또는 클라이언트 IP 기준 요청 속도 제한 활성화 |
| `BUN_GRAPH_DB_RATE_LIMIT_MAX` | `1000` | 윈도우당 최대 허용 요청 수 |
| `BUN_GRAPH_DB_RATE_LIMIT_WINDOW_MS` | `900000` (15분) | 속도 제한 시간 윈도우(ms) |
| `BUN_GRAPH_DB_MAX_REQUEST_BYTES` | `1048576` (1 MiB) | 요청 본문 최대 바이트 (`413 request_too_large` 반환) |
| `BUN_GRAPH_DB_GRAPHQL_MAX_COMPLEXITY` | `250` | GraphQL AST 필드 수 상한 (`400 query_too_complex` 반환) |
| `JSONL_AUTO_SAVE_ON_WRITE` | `false` | 쓰기 직후 전체 JSONL 자동 내보내기 여부 (SQLite 자체 내구성이 있으므로 기본 비활성) |

---

## 2. 인증, 역할 및 테이블 범위 접근 제어

`AccessControl`은 외부 엔드포인트(`/graphql`, `/mcp`, `/sub/:tableId/mcp`, `/api/*`, `/schema*`)에 대해 **기본 닫힘(closed-by-default)** 정책을 적용한다. 익명 접근은 `OPTIONS`, `/`, `/api/health`에만 허용된다.

### 역할(`AccessRole`)과 테이블 범위(`tableIds`)

```json
{
  "tok_orders_reader": {
    "id": "agent-orders-ro",
    "role": "reader",
    "tableIds": ["orders"]
  },
  "tok_orders_writer": {
    "id": "agent-orders-rw",
    "role": "writer",
    "tableIds": ["orders"]
  },
  "tok_platform_admin": {
    "id": "ops-admin",
    "role": "admin",
    "tableIds": ["*"]
  }
}
```

- **`reader`**: 허용된 테이블 범위 내 조회(`Query`, `GET /api/*`, `POST /api/nodes/hybrid-search`, 읽기 전용 MCP `tools/call` 및 `tools/list`).
- **`writer`**: 허용된 테이블 범위 내 노드·속성·임베딩·관계 생성/수정/삭제.
- **`admin`**: 테이블·속성 타입·관계 타입·템플릿 DDL, 스키마 산출물(`/schema*`), JSONL 백업·복원(`exportJsonl`, `importJsonl`, `inspectJsonlBackup`), 표 동기화 관리(`/api/tabular-sync*`).
- **테이블 ID·식별자 자동 정합**: 토큰의 `tableIds`에 사람이 읽기 쉬운 테이블 `identifier`(`"orders"`)를 지정하든 숫자 `id`(`"1"`)를 지정하든, 런타임이 `tableId`, `tableIdentifier`, `nodeId`(소속 테이블 역추적) 요청과 양방향으로 대조한다. 허용되지 않은 타 테이블 리소스는 존재 여부를 노출하지 않도록 `404 Not Found`로 거부한다.
- **GraphQL 루트 필드별 AST 격리**:
  - 쿼리에서 실제로 참조하지 않는 미사용 `variables`에 `tableId`를 넣어도 전역 쿼리(`tables`, `deleteTable` 등) 권한이 부여되지 않는다(`403 forbidden`).
  - 하나의 GraphQL 요청에 여러 루트 필드를 묶을 때 어느 한 필드라도 범위가 없거나 전역 작업이면 전역 범위(`*`)를 요구한다.
  - 파일 시스템 백업/복원 및 전역 DDL 루트 필드는 `tableIds` 인수를 포함하더라도 항상 `admin` 역할을 요구한다.

자격 증명은 `Authorization: Bearer <token>` 또는 `X-API-Key: <token>` 헤더로 전달한다.

---

## 3. 스키마 마이그레이션(`v1..v13`) 및 동적 스키마 감사

### 순방향 마이그레이션 운영 원칙

서버 기동 시 `DatabaseMigrationRunner`가 `schema_migrations` 원장을 확인하고 미적용 마이그레이션(`v1..v13`)을 각 버전별 단일 트랜잭션으로 적용한다.

- 주요 최신 마이그레이션:
  - `v11` (`node-attributes-numeric-projection`): `node_attributes.value_num` 수치·날짜 투영 컬럼 및 부분 B-Tree 인덱스
  - `v12` (`node-relations-traversal-indexes`): 방향별 그래프 탐색 및 `relation_type_id` pushdown 복합 인덱스
  - `v13` (`persistent-node-embeddings`): `node_embeddings` Float32 BLOB 저장소 및 `node_embedding_revisions` 캐시 무효화 카운터 트리거
- **Fail-Closed 보호**: 데이터베이스에 현재 바이너리가 알 수 없는 상위 버전이 기록되어 있거나 기존 버전 이름이 불일치하면 즉시 연결을 닫고 기동을 중단한다. 업그레이드 전에는 반드시 SQLite 파일 또는 JSONL 백업을 먼저 확보한다.

### 동적 테이블 스키마 정합성 감사

모든 노드 속성 쓰기(GraphQL 단일/배치, REST, JSONL 복원)는 `NodeAttributeSchemaGate`를 통과하며 미등록 속성 키, 타입 불일치, 필수값 누락, `format` / 범위 위반을 사전 차단한다.

기존 저장 데이터에 대한 비파괴 정합성 감사는 다음 REST 경로로 수행한다:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:4141/api/tables/<tableId>/schema/audit
```

응답은 테이블의 현재 `TableSchemaProjection`(`versionHash`) 기준으로 누락된 필수 속성, 타입 변환 불일치, 알 수 없는 속성 레코드 건수와 상세 목록을 반환한다.

---

## 4. 영속 벡터 임베딩 및 4-신호 하이브리드 검색 운영

### 노드 임베딩 저장 및 일괄 적재

노드 임베딩은 `node_embeddings` 테이블에 Little-Endian `Float32Array` BLOB과 사전 계산된 L2 `norm`으로 영속화되며, 인메모리에서는 `(dimension, model)` 버킷별 연속(contiguous) `Float32Array` 슬랩과 `node_embedding_revisions` 카운터로 동기화된다.

- **단건 저장/조회/삭제**:
  - GraphQL: `setNodeEmbedding`, `nodeEmbedding`, `removeNodeEmbedding`
  - REST: `PUT /api/nodes/:nodeId/embedding`, `GET /api/nodes/:nodeId/embedding`, `DELETE /api/nodes/:nodeId/embedding`
- **대량 적재 권장 경로 (`batchSetNodeEmbeddings`)**:
  - 수백~수천 건의 임베딩을 적재할 때는 단일 SQLite `IMMEDIATE` 트랜잭션으로 처리하는 GraphQL `batchSetNodeEmbeddings`를 사용해 커밋 오버헤드와 슬랩 재구성을 최소화한다.
- **차원·모델 관리**:
  - 동일 테이블 내에서도 모델 전환 과도기에 서로 다른 `(dimension, model)` 임베딩이 공존할 수 있으며, 검색 시 `queryVector.length`와 일치하는 차원(및 지정된 `model`) 버킷만 정확 코사인 스캔 대상이 된다.

### 4-신호 RRF 하이브리드 검색

`hybridSearchNodes` (GraphQL) 및 `POST /api/nodes/hybrid-search` (REST)는 다음 4가지 신호를 Reciprocal Rank Fusion(RRF)으로 결합한다:

1. **그래프 탐색 제약 (`graph`)**: `anchorNodeIds`, `maxDepth`, `direction`, `relationTypeIds` 기준 N-hop 연결 후보 및 홉 거리 점수
2. **타입 속성 필터 (`filters`)**: `NodeAttributeSchemaGate` 타입과 `value_num` 부분 인덱스를 활용하는 수치·문자열 필터
3. **전문 검색 (`query`)**: `node_search_fts` + `node_attribute_search_fts` FTS5 BM25 순위
4. **의미 벡터 검색 (`vector`)**: 영속 `Float32Array` 정확 코사인 유사도 (`BoundedTopKCollector` `O(N log K)`)

---

## 5. JSONL 백업 및 재해 복구

JSONL 백업·복원은 Git 추적, 스키마 이관, 버전 업그레이드 전후 재해 복구에 사용하는 표준 논리 백업 경로이며 **`admin` 역할**이 필요하다.

### 백업 내보내기 (`exportJsonl`)

```graphql
mutation ExportFullBackup {
  exportJsonl(
    options: {
      outputDir: "/var/backups/bun-graph-db/2026-10-31"
      includeSchema: true
      includeRelations: true
      includeEmbeddings: true
      prettyPrint: false
    }
  ) {
    success
    outputDir
    stats {
      tablesExported
      nodesExported
      relationsExported
      embeddingsExported
      totalBytes
    }
    errors
  }
}
```

- `tableIds` 또는 `tableIdentifiers`를 지정하면 선택한 테이블만 부분 백업할 수 있다.
- `includeEmbeddings: true`를 지정하면 `embeddings.jsonl`이 함께 기록되고 `manifest.json`에 `hasEmbeddings: true`가 추가된다. 생략 시 기본 `manifest.json` 포맷과 바이트 호환성을 그대로 유지한다.
- 모든 파일 쓰기는 동일 디렉터리 임시 파일 기록 후 원자적 `rename`으로 교체되어, 도중 실패 시 직전 유효 스냅샷을 훼손하지 않는다.

### 백업 검증 및 복원 (`inspectJsonlBackup` / `importJsonl`)

복원 전 `inspectJsonlBackup(inputDir: ...)` 쿼리로 매니페스트와 테이블 목록을 먼저 점검한 뒤 `importJsonl`을 실행한다.

```graphql
mutation RestoreFullBackup {
  importJsonl(
    options: {
      inputDir: "/var/backups/bun-graph-db/2026-10-31"
      conflictResolution: OVERWRITE
      validateSchema: true
    }
  ) {
    success
    stats {
      tablesImported
      nodesImported
      nodesUpdated
      nodesSkipped
      relationsImported
      embeddingsImported
    }
    warnings
    errors
  }
}
```

- **빈 DB / ID 시프트 환경 완전 복원**: 대상 DB에 테이블·커스텀 속성·관계 타입이 미리 없거나 자동 증가 ID가 달라진 상태에서도 `schema.jsonl` -> `tables/*.jsonl` -> `relation-types.jsonl` & `relations.jsonl` -> `embeddings.jsonl` 순서로 스키마, 정규화된 속성값, 리매핑된 노드 간 관계, 영속 임베딩을 일괄 복원한다.
- **충돌 정책 (`conflictResolution`)**:
  - `SKIP`: 동일 `(table, content)` 노드 및 기존 관계·임베딩이 있으면 건너뜀
  - `OVERWRITE`: 기존 노드의 제목·내용·속성값과 관계·임베딩을 백업 값으로 갱신
  - `MERGE`: 기존 노드의 제목·내용은 유지하고 백업에 포함된 속성·임베딩을 병합 갱신

---

## 6. 단방향 표 형식 동기화(Tabular Sync) 운영

표 형식 동기화는 그래프 테이블 변경을 로컬 Excel(`.xlsx`) 또는 Google Sheets로 단방향 내보내는 영속 작업 큐(`tabular_sync_jobs`)로 동작한다.

- **상태 조회**: `GET /api/tabular-sync-status` (전역 `admin` 권한 필요)
  - 작업 상태: `queued`, `running`(60초 임대), `retry_wait`(1초~60초 지수 백오프, 최대 5회), `paused`, `succeeded`, `failed`
- **운영자 수동 제어**:
  - 일시 중지: `POST /api/tabular-sync-status/:tableIdentifier/pause`
  - 재개: `POST /api/tabular-sync-status/:tableIdentifier/resume`
  - 실패 작업 즉시 재시도: `POST /api/tabular-sync-status/:tableIdentifier/retry`
- 프로세스 비정상 종료 후 재기동하면 만료되거나 중단된 `running` 임대가 자동으로 재시도 대기열로 복구된다.

---

## 7. 일상 상태 점검 및 배포 전 품질 게이트

### 런타임 헬스체크

- **HTTP Liveness**: `GET /api/health` (익명 허용)
- **GraphQL 상태 점검**:
  ```graphql
  query {
    healthCheck {
      status
      database
      version
      timestamp
    }
  }
  ```

### 배포 및 커밋 전 검증 체크리스트

변경 배포 또는 릴리스 커밋 전에는 다음 명령이 모두 통과해야 한다:

```bash
# 1. 정적 품질 게이트 (문서 검증 + 런타임 버전 + Biome + TypeScript + GraphQL codegen + 번들 빌드)
bun run check:static

# 2. 테스트 레인 분류 감사 및 전체 테스트 스위트(parallel-safe, serial-only, e2e, stress)
bun run test:lanes:audit
bun run test

# 3. oa-sdk OpenAPI 투영 아티팩트 결정성 검증
bun run projection:check

# 4. 핵심 핫패스(검색·그래프 탐색·JSONL 백업·원자 쓰기·투영 캐시) 및 벡터 저장소 기준선 검증
bun run benchmark:hotpaths:ci
bun run benchmark:vector-storage
```

벤치마크와 레인 구성의 세부 규칙은 [테스트 가이드](../development/TESTING.md)와 [벡터·하이브리드 검색 기준선](../architecture/vector-and-storage-comparison.md)을 따른다.
