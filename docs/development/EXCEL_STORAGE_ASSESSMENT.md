# Excel Storage Assessment

Last updated: 2026-03-30

## Summary

결론부터 말하면:

- **Excel 파일을 주 저장소(source of truth)로 전면 전환하는 것은 비추천**
- **Excel을 import/export 또는 권위 소스 + 읽기 캐시 구조로 쓰는 것은 가능**
- 현재 코드베이스 기준으로 가장 현실적인 방향은:
  1. **SQLite 유지**
  2. **특정 Excel 파일과 양방향 동기화 또는 단방향 import/export 강화**
  3. 필요하면 나중에 **Excel-authoritative + cache** 구조로 점진 전환

즉, 이 프로젝트에서 Excel은 “좋은 외부 포맷”이 될 수는 있지만, 지금 당장 SQLite를 완전히 대체하는 “좋은 운영 저장 엔진”은 아닙니다.

## Current Architecture Reality

현재 persistence 계층은 SQLite에 매우 강하게 결합되어 있습니다.

핵심 결합 지점:

- [DatabaseModule.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/container/modules/DatabaseModule.ts)
  - `bun:sqlite` `Database`를 직접 생성
  - `schema.sql`을 직접 적용
  - `PRAGMA`와 `sqlite_master`를 사용
- [RepositoryModule.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/container/modules/RepositoryModule.ts)
  - 모든 repository 구현이 `Sqlite*Repository`
- [SqliteTableRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteTableRepository.ts)
- [SqliteNodeRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteNodeRepository.ts)
- [SqliteAttributeRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteAttributeRepository.ts)
- [SqliteNodeSearchRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteNodeSearchRepository.ts)
- [SqliteGraphRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteGraphRepository.ts)
- [SqliteQueryTemplateRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteQueryTemplateRepository.ts)
- [SqliteDocRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteDocRepository.ts)

추가로 SQLite 의존은 repository 밖에도 퍼져 있습니다.

- [system-queries.ts](/Users/junwoobang/workflow/bun-graph-db/src/application/services/system-queries.ts)
  - `sqlite_master`, `PRAGMA` 기반 통계/상태 계산
- [SchemaReflection.ts](/Users/junwoobang/workflow/bun-graph-db/src/core/schema/SchemaReflection.ts)
  - SQLite 스키마 introspection
- [SQLiteBackupService.ts](/Users/junwoobang/workflow/bun-graph-db/src/domain/services/SQLiteBackupService.ts)
  - 파일 단위 SQLite 백업/복원
- [JsonlBackupService.ts](/Users/junwoobang/workflow/bun-graph-db/src/domain/services/JsonlBackupService.ts)
  - SQLite repository 위에서 동작
- [scripts/init-database.ts](/Users/junwoobang/workflow/bun-graph-db/scripts/init-database.ts)
  - `schema.sql`을 SQLite에 적용

## Why Full Excel Replacement Is Expensive

### 1. Query model is not simple CRUD

이 프로젝트의 핵심은 단순 테이블 CRUD가 아닙니다.

- 검색
  - [SearchNodes.ts](/Users/junwoobang/workflow/bun-graph-db/src/application/use-cases/nodes/SearchNodes.ts)
  - [SqliteNodeSearchRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteNodeSearchRepository.ts)
- 그래프 탐색
  - [SearchRelatedNodes.ts](/Users/junwoobang/workflow/bun-graph-db/src/application/use-cases/relations/SearchRelatedNodes.ts)
  - [SqliteGraphRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteGraphRepository.ts)
- import/export/package recovery
  - [TablePackageService.ts](/Users/junwoobang/workflow/bun-graph-db/src/domain/services/TablePackageService.ts)
  - [TablePackageRecoveryManager.ts](/Users/junwoobang/workflow/bun-graph-db/src/domain/services/TablePackageRecoveryManager.ts)

이 계층은 JOIN, recursive traversal, filtering, pagination, count, transaction이 많이 필요합니다.

Excel은 이 작업을 저장 엔진으로 수행하기에 적합하지 않습니다.

### 2. Transaction and integrity semantics degrade

SQLite에서는 아래가 기본입니다.

- atomic writes
- foreign key enforcement
- unique constraints
- transactions
- indexes

Excel workbook은 이런 의미를 기본 제공하지 않습니다.

필요한 기능을 직접 구현해야 합니다.

- row-level uniqueness 검사
- relation integrity 검사
- concurrent write 방지
- partial failure rollback
- workbook 전체 atomic rewrite

### 3. Search/traversal performance will regress

현재 검색과 그래프 탐색은 SQL 질의와 집계를 이용합니다.

- attribute filter
- full/partial text match
- relation direction filter
- path finding
- counts and pagination

Excel 파일을 직접 읽어서 이걸 매 요청마다 수행하면 성능과 안정성이 크게 떨어질 가능성이 높습니다.

### 4. Existing Excel support is not storage-grade

현재 코드베이스엔 `excel` export 옵션은 있지만, 실제 구현은 placeholder입니다.

- [TableNodesExportUseCase.ts](/Users/junwoobang/workflow/bun-graph-db/src/application/use-cases/export/TableNodesExportUseCase.ts)
  - `exportToExcel()`는 실제 `.xlsx` 생성이 아니라 JSON buffer fallback
  - 코드 주석에도 `xlsx` 또는 `exceljs` 라이브러리가 필요하다고 명시됨

즉 “Excel 지원이 조금 있으니 저장 주체로도 쉽게 바꿀 수 있겠다”는 상태는 아닙니다.

## Feasibility Options

### Option A: Keep SQLite, strengthen Excel import/export

가장 추천합니다.

구성:

- SQLite = source of truth
- Excel = import/export artifact

장점:

- 현재 기능/테스트 대부분 유지
- 사용자는 특정 Excel 파일을 주고받을 수 있음
- 구현 리스크가 가장 낮음

추천 사용 사례:

- 운영 데이터 백오피스 전달
- 수동 편집 후 재반영
- 외부 팀과 파일 기반 협업

### Option B: Excel as source of truth, SQLite as read cache

현실적인 절충안입니다.

구성:

- 특정 Excel 파일 = authoritative source
- 서버 시작/변경 시 SQLite cache 재생성
- GraphQL/MCP/검색/탐색은 SQLite cache를 사용

장점:

- 사용자 관점에선 “엑셀이 주 저장소”
- 시스템 관점에선 기존 검색/그래프 성능 유지

단점:

- sync 파이프라인이 필요
- Excel 변경 감지, 충돌 정책, 캐시 재빌드 규칙 필요

이 옵션이 “엑셀을 저장 주체로 둔다”는 목표를 가장 현실적으로 만족합니다.

### Option C: Full Excel backend

권장하지 않습니다.

필요 작업:

- 새 workbook access layer
- sheet schema 설계
- row/id generator
- relation integrity validator
- transaction emulation
- search engine 재구현
- graph traversal 재구현
- backup/restore 전략 전면 재설계

ROI 대비 비용이 큽니다.

## If Excel Must Become the Authoritative Store

전면 교체보다는 아래 모델이 현실적입니다.

### Workbook design

권장 시트 구조:

- `tables`
- `attributes`
- `attribute_types`
- `nodes`
- `node_attributes`
- `relation_types`
- `node_relations`
- `templates`
- `docs`
- `meta`

### Required infrastructure

필수 컴포넌트:

1. `ExcelWorkbookGateway`
   - workbook load/save
   - temp file write + atomic replace

2. `ExcelLockService`
   - 단일 writer 보장
   - concurrent write guard

3. `ExcelSchemaValidator`
   - sheet/column validation
   - required field validation

4. `ExcelSyncService`
   - workbook -> cache rebuild
   - cache invalidation

5. `Excel*Repository`
   - 최소 `Table`, `Attribute`, `Node`, `NodeRelation`, `Template`, `Doc`

하지만 이 구조에서도 실질적인 query 엔진은 별도 캐시 없이 버티기 어렵습니다.

## Recommended Direction

현재 코드베이스 기준 최종 권장안:

1. **SQLite는 유지한다**
2. **특정 Excel 파일을 공식 import/export 포맷으로 강화한다**
3. 사용자가 정말 Excel을 “주 저장소”로 인식해야 한다면:
   - **Excel authoritative + SQLite cache** 구조를 택한다
4. **Full Excel backend 전환은 하지 않는다**

## Suggested Phase Plan

### Phase 1: Real Excel import/export

- 실제 `.xlsx` 라이브러리 도입
- [TableNodesExportUseCase.ts](/Users/junwoobang/workflow/bun-graph-db/src/application/use-cases/export/TableNodesExportUseCase.ts)의 placeholder 제거
- workbook -> domain import use case 추가
- sheet schema 문서화

### Phase 2: Named workbook integration

- 특정 Excel 파일 경로를 설정값으로 받기
- “import from workbook” / “export to workbook”를 공식 운영 경로로 만들기
- 변경 전/후 검증 추가

### Phase 3: Optional authoritative Excel mode

- workbook 변경 시 SQLite cache 재생성
- GraphQL/MCP는 cache를 읽음
- write는 workbook + cache 갱신으로 처리

## Final Recommendation

질문에 대한 짧은 답:

- **엑셀 파일을 저장 주체로 완전히 바꾸는 건 지금 구조에서는 비추천**
- **하지만 특정 Excel 파일을 운영 중심 포맷으로 삼고, SQLite를 내부 실행 엔진/캐시로 두는 방향은 충분히 검토할 가치가 있음**

이 프로젝트의 목표가 “사용자는 Excel을 편집한다”인지, 아니면 “시스템 내부 엔진까지 Excel이어야 한다”인지에 따라 최적안이 달라집니다.

현재 코드베이스엔 전자가 맞고, 후자는 비용이 큽니다.
