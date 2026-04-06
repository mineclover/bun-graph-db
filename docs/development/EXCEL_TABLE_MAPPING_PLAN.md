# Excel Table Mapping Plan

Last updated: 2026-03-31

## Goal

목표는 SQLite를 바로 제거하는 것이 아니라,

- **현재 저장은 그대로 수행하고**
- **특정 Excel workbook에 table 구성을 매핑해서 함께 저장하는 것**

입니다.

즉 v1은 **Excel Mirror Mode**이고, v1.1부터는 **Tabular Target Mode**로 확장합니다.

## Why This Is the Right First Step

이 방식은 현재 시스템 구조와 잘 맞습니다.

- 저장/조회/검색/그래프 탐색은 기존 SQLite 경로 유지
- Excel은 사람이 편집/전달/검토하기 좋은 운영 포맷
- 실패 시에도 core runtime을 깨지 않음
- 구현 범위가 full Excel backend보다 훨씬 작음

관련 판단 배경:

- [EXCEL_STORAGE_ASSESSMENT.md](/Users/junwoobang/workflow/bun-graph-db/docs/development/EXCEL_STORAGE_ASSESSMENT.md)
- [DatabaseModule.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/container/modules/DatabaseModule.ts)
- [RepositoryModule.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/container/modules/RepositoryModule.ts)

## V1 Scope

V1에서는 다음만 지원합니다.

### Included

- 특정 workbook 파일 경로 지정
- 특정 table identifier를 특정 sheet에 매핑
- destination config를 바꿔 workbook 대상을 자유롭게 선택
- sheet 이름을 explicit name 또는 template로 결정
- sync 전에 diff preview 생성
- config 기준으로 Excel 파일 또는 Google Sheets destination 결정
- SQLite 저장 성공 후 해당 table sheet를 다시 생성 또는 갱신
- node -> row 평탄화 저장
- attribute -> column 매핑
- 최소 metadata sheet 저장

### Excluded

- Excel을 읽기 경로의 source of truth로 사용
- relation graph를 workbook에 완전 정규화 저장
- templates / docs / backups 전체를 workbook에 동기화
- Excel 수정분을 실시간으로 DB에 역반영

즉 v1은 **one-way sync from SQLite to workbook** 입니다.

## Current Delivery Status

현재 기준으로 아래는 이미 동작합니다.

- Google Sheets destination sync
- table별 route / target / sheet mapping
- mutation 후 best-effort continuous upload
- DB-backed tabular sync config 관리
- GraphQL / HTTP / MCP 관리면
- sync status / recent failures / persisted events 조회
- filtered persisted event 조회
  - `tableIdentifier`
  - `status`
  - `mode`
  - `windowPreset`
  - `createdAfter`
  - `createdBefore`
- persisted summary 조회
  - `tableIdentifier + mode`
  - `eventCount`
  - `successCount`
  - `failureCount`
  - `successRate`
  - `latestErrorMessage`

즉 지금은 단순 mirror prototype이 아니라, 운영 관측성까지 포함한 tabular sync foundation 상태입니다.

## Recommended Data Model

가볍게 가려면 정규화된 다중 시트보다 **table별 1 sheet + 최소 meta sheets**가 좋습니다.

### Workbook sheets

1. `_tables`
2. `_schema`
3. `<table-identifier>` sheets

예시:

- `_tables`
- `_schema`
- `users`
- `projects`

### `_tables` sheet

역할:

- 어떤 table이 어떤 sheet에 연결되는지 기록

권장 columns:

- `table_identifier`
- `table_id`
- `sheet_name`
- `description`
- `last_synced_at`
- `row_count`

### `_schema` sheet

역할:

- 각 table sheet의 column schema 기록

권장 columns:

- `table_identifier`
- `column_name`
- `source_type` (`system` | `attribute`)
- `source_key`
- `data_type`
- `required`
- `searchable`
- `order`

### `<table-identifier>` sheet

역할:

- 실제 node 데이터를 row 단위로 저장

권장 system columns:

- `__node_id`
- `__title`
- `__content`
- `__description`
- `__created_at`
- `__updated_at`

권장 attribute columns:

- 각 attribute identifier 그대로 사용
- 예: `email`, `department`, `salary`

## Row Mapping Rule

핵심 개념:

- **1 node = 1 row**
- **1 attribute = 1 column**

예시:

| __node_id | __title | __content | email | department | salary |
|-----------|---------|-----------|-------|------------|--------|
| 101       | Alice   | Engineer  | a@x.com | Platform | 90000 |

이 구조가 가장 단순하고, 사용자가 엑셀에서 보기에 자연스럽습니다.

## Sync Strategy

V1에서는 “row 단위 incremental write”보다 **table sheet 전체 재생성**이 낫습니다.

이유:

- 구현이 단순함
- schema drift 처리 쉬움
- 삭제/컬럼 변경 반영 쉬움
- 작은/중간 규모 데이터에서는 충분히 빠름

### Recommended flow

1. SQLite write 성공
2. 해당 table identifier를 sync queue에 추가
3. debounce/coalesce 적용
4. table data를 다시 조회
5. workbook에서 해당 sheet를 재작성
6. `_tables`, `_schema` metadata 갱신
7. temp file write 후 atomic replace

### Diff support

sync 전에 최소한 아래 요약을 만들 수 있어야 합니다.

- added rows
- removed rows
- changed rows
- changed columns

이 diff는 UI/CLI preview와 audit log에 모두 유용합니다.

## Where To Hook In

V1 hook 포인트는 mutation/write use case 완료 직후가 적절합니다.

우선순위:

1. table changes
   - create/update/delete table
2. attribute changes
   - create/update/delete attribute
3. node changes
   - create/update/delete node
   - set node attributes

관련 경로:

- [TableMutations.ts](/Users/junwoobang/workflow/bun-graph-db/src/presentation/graphql/mutations/TableMutations.ts)
- [AttributeMutations.ts](/Users/junwoobang/workflow/bun-graph-db/src/presentation/graphql/mutations/AttributeMutations.ts)
- [NodeMutations.ts](/Users/junwoobang/workflow/bun-graph-db/src/presentation/graphql/mutations/NodeMutations.ts)

더 안전한 위치는 use case 또는 domain service 이후 application service에서 enqueue 하는 방식입니다.

## Recommended Module Structure

새 외부 패키지로 바로 분리하기보다, 먼저 repo 내부의 package-like module로 시작하는 것을 권장합니다.

예시:

```text
src/infrastructure/excel/
├── ExcelWorkbookConfig.ts
├── ExcelTableMappingRegistry.ts
├── SheetNameResolver.ts
├── SheetSyncDiff.ts
├── TabularSyncConfig.ts
├── TabularSyncTargetRegistry.ts
├── ExcelWorkbookGateway.ts
├── ExcelSheetWriter.ts
├── ExcelSchemaProjector.ts
├── ExcelTableSyncService.ts
└── types/
    ├── ExcelRowSchema.ts
    ├── ExcelSheetSchema.ts
    └── ExcelWorkbookMeta.ts
```

### Responsibilities

- `ExcelWorkbookConfig`
  - workbook path
  - enabled tables
  - sync mode

- `ExcelTableMappingRegistry`
  - table identifier -> sheet name
  - reserved columns

- `TabularSyncConfig`
  - destination targets
  - target routing rules
  - diff mode

- `TabularSyncTargetRegistry`
  - table -> destination resolution
  - target lookup
  - route resolution

- `SheetNameResolver`
  - explicit name
  - template-based naming
  - sheet-safe sanitization

- `SheetSyncDiff`
  - before/after row diff
  - summary counts

- `ExcelSchemaProjector`
  - attribute definitions -> sheet columns

- `ExcelSheetWriter`
  - rows 생성
  - 시트 재작성

- `ExcelTableSyncService`
  - sync queue
  - debounce
  - atomic save orchestration

## V1 Storage Contract

V1에서 workbook은 아래 의미만 가집니다.

- SQLite에서 파생된 공식 미러
- 사람이 읽고 편집하기 쉬운 운영 산출물
- 필요 시 수동 재생성 가능한 artifact

즉, v1 workbook은 **cacheable artifact**이지 **authoritative DB**가 아닙니다.

## Why Not Row-Level Incremental Update First

겉보기엔 “저장한 row만 엑셀에 바로 쓰면 된다”가 단순해 보이지만,
실제로는 아래 문제가 생깁니다.

- row 위치 추적
- 컬럼 순서 drift
- attribute 추가/삭제 시 헤더 재정렬
- 삭제 시 row compaction
- workbook 동시 편집 충돌

그래서 v1은 **sheet rewrite 방식**이 더 안전합니다.

## Recommended Implementation Order

### Phase 1

- workbook path config 추가
- table -> sheet mapping registry 추가
- `TableNodesExportUseCase`에서 실제 `.xlsx` 생성 기반 확보
- single table export to sheet 구현

### Phase 2

- sync service 추가
- write 후 해당 table sheet 자동 재생성
- `_tables`, `_schema` metadata 갱신

### Phase 3

- multi-table workbook sync
- manual resync command
- selective table enable/disable

## Final Recommendation

질문에 대한 짧은 답:

- 네, **특정 row 단위 스키마를 지정해서 가볍게 가는 방향이 맞습니다**
- 다만 그 의미는 “Excel backend replacement”가 아니라
  **“SQLite 저장 후 configurable tabular destination mirror”** 로 잡는 게 가장 현실적입니다

이 방향이면 현재 시스템을 거의 안 깨고도 Excel 중심 운영 경험을 만들 수 있습니다.

## Google Sheets Direction

Google Sheets는 Excel과 같은 row/sheet abstraction으로 다루되, writer/gateway만 분리하는 방향이 맞습니다.

권장 target kinds:

- `excel-file`
- `google-sheets`

권장 access strategy:

1. target abstraction은 공통 유지
2. Google Sheets 접근은 별도 gateway adapter로 분리
3. 기본 경로는 `google-tools` HTTP API adapter
4. submodule direct client import는 선택적 최적화 경로
3. 외부 참조는 다음을 참고
   - [googleworkspace/cli](https://github.com/googleworkspace/cli)
   - [mineclover/google-tools](https://github.com/mineclover/google-tools)

실제 구현에선 특정 CLI나 외부 툴에 직접 결합하지 말고, `GoogleSheetsGateway` 같은 adapter 뒤에 숨기는 것이 좋습니다.

현재 우선순위:

1. `google-tools-http`
2. `pipe-builder-table-adapter`
3. `google-tools-submodule` (legacy compatibility only)
