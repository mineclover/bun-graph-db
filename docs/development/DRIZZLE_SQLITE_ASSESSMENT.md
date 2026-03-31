# Drizzle SQLite Assessment

Last updated: 2026-03-29

## Summary

Drizzle 도입은 **부분적으로는 권장**, **전면 전환은 당장은 비권장**입니다.

- 권장:
  - SQLite 스키마 정의를 Drizzle schema로 관리
  - 마이그레이션을 Drizzle migrations로 관리
  - 신규 단순 CRUD repository부터 선택적으로 Drizzle query builder 사용
- 비권장:
  - 현재 repository/query layer 전체를 한 번에 Drizzle ORM으로 전환
  - graph/search/template/query execution 계층까지 동시에 옮기는 작업

## Current State

현재 프로젝트는 Drizzle 의존성이 없습니다.

- [package.json](/Users/junwoobang/workflow/bun-graph-db/package.json)

현재 SQLite 스키마는 수동 SQL 파일로 관리되고 있습니다.

- [schema.sql](/Users/junwoobang/workflow/bun-graph-db/scripts/database/schema.sql)

현재 persistence layer는 `bun:sqlite`와 raw SQL 중심입니다.

- [BaseSqliteRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/BaseSqliteRepository.ts)
- [SqliteTableRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteTableRepository.ts)
- [SqliteNodeRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteNodeRepository.ts)
- [SqliteAttributeRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteAttributeRepository.ts)
- [SqliteNodeSearchRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteNodeSearchRepository.ts)
- [SqliteGraphRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteGraphRepository.ts)
- [SqliteQueryTemplateRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteQueryTemplateRepository.ts)
- [SqliteDocRepository.ts](/Users/junwoobang/workflow/bun-graph-db/src/infrastructure/database/sqlite/SqliteDocRepository.ts)

## What Makes Full Migration Expensive

### 1. Raw SQL usage is widespread

현재 repository/service 전반에서 raw SQL을 직접 사용합니다.

- `db.query(...)`
- `db.run(...)`
- `prepare(...)`
- `transaction(...)`

이 패턴이 단순 CRUD뿐 아니라 검색/관계/템플릿 쪽까지 넓게 퍼져 있습니다.

### 2. Schema has SQLite-specific behavior

현재 스키마는 단순 테이블 정의를 넘어 다음을 포함합니다.

- foreign keys
- composite uniques
- `CHECK` constraints
- update triggers
- index definitions

특히 trigger와 일부 SQLite 관용구는 Drizzle schema만으로는 표현이 불완전하거나 raw SQL migration을 병행해야 합니다.

### 3. Query complexity is higher than normal CRUD

이 프로젝트의 핵심은 단순 CRUD보다 아래 쪽에 있습니다.

- graph traversal
- node search / attribute search
- template execution
- package import/export / recovery
- schema introspection / AI metadata

이 계층은 ORM 이득보다 raw SQL 제어력이 더 중요한 경우가 많습니다.

### 4. Test surface is large

현재 테스트는 SQLite 동작, startup timing, import/export, MCP/GraphQL compatibility까지 넓게 덮고 있습니다.

즉 query layer를 크게 바꾸면 회귀 범위가 큽니다.

## Recommended Direction

### Option A: Drizzle for schema + migrations only

가장 현실적이고 추천하는 방향입니다.

도입 범위:

- `drizzle-orm`
- `drizzle-kit`
- `drizzle.config.ts`
- `src/db/schema/*.ts`
- `drizzle/` migrations

유지 범위:

- 기존 `bun:sqlite`
- 기존 repository 구현
- 기존 search/graph/template raw SQL

이 방식의 장점:

- 수동 `schema.sql` 관리 부담 감소
- migration history 명시화
- 새 컬럼/인덱스/제약 추가 시 diff 관리 쉬움
- 전체 query layer 리스크 없이 도입 가능

주의:

- trigger, 일부 check/index, seed data는 raw SQL migration 블록이 여전히 필요할 수 있음

### Option B: Hybrid adoption

추천 순서는 다음과 같습니다.

1. Drizzle schema + migrations 추가
2. 신규 단순 repository만 Drizzle query builder로 작성
3. 기존 복잡한 repository는 raw SQL 유지
4. 충분히 안정화된 후 일부 CRUD repository만 점진 전환

### Option C: Full ORM migration

지금 시점에서는 비추천합니다.

이유:

- ROI 대비 리스크가 큼
- graph/search/template 계층은 raw SQL이 더 잘 맞음
- 테스트와 compatibility 회귀 범위가 큼

## Concrete Recommendation

현재 코드베이스 기준 최종 권장안:

1. **지금은 전체 ORM 전환하지 않는다**
2. **Drizzle는 schema/migration 관리 용도로만 먼저 도입한다**
3. **repository query layer는 당분간 그대로 둔다**
4. **단순 CRUD repository만 후보로 점진 전환한다**

## Minimal Migration Plan

### Phase 1

- Drizzle 의존성 추가
- `drizzle.config.ts` 생성
- 현재 [schema.sql](/Users/junwoobang/workflow/bun-graph-db/scripts/database/schema.sql) 기반으로 Drizzle schema 작성
- 초기 baseline migration 생성

### Phase 2

- 서버 bootstrap에서 “schema.sql 초기화” 대신 migration runner 경로 검토
- trigger/check/index 중 Drizzle로 표현 안 되는 부분은 raw SQL migration 파일로 보완

### Phase 3

- `tables`, `attributes`, `docs` 같은 단순 repository부터 Drizzle query builder 도입 여부 재평가
- `search`, `graph`, `template`, `package` 계층은 raw SQL 유지

## Do / Don't

Do:

- schema source of truth를 Drizzle로 옮기기
- migrations를 선언적으로 관리하기
- raw SQL이 강한 계층은 그대로 두기

Don't:

- search/graph repository를 한 번에 ORM으로 옮기기
- migration과 query layer refactor를 동시에 시작하기
- trigger/index/check를 Drizzle schema만으로 모두 해결하려고 하기
