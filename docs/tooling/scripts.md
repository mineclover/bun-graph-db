# Scripts 디렉토리 및 CLI 명령 가이드

`bun-graph-db`의 `scripts/` 디렉토리와 `package.json` 검증·빌드·유틸리티 스크립트를 안내합니다. (Node.js 26 LTS + `pnpm` 12 + Vitest 5 기준)

## 📁 현재 `scripts/` 디렉토리 구조

```text
scripts/
├── database/                         # schema.sql, sample-data.sql, init scripts
├── fixtures/                         # oa-sdk-projection-fixture.ts 등 검증 픽스처
├── check-codegen.ts                  # GraphQL codegen 최신 상태 검증
├── check-docs.ts                     # canonical 문서 frontmatter / 상대 링크 검증
├── ci-versions.ts                    # Node / pnpm / 의존성 버전 정책 검증
├── generate-embedded-assets.ts       # schema.sql → src/generated/embedded-assets.ts 생성
├── test-lanes.ts                     # Vitest 5 4개 레인 분류 감사 및 오케스트레이션
├── export-oa-sdk-projection-artifacts.ts # oa-sdk OpenAPI 3.2 투영 아티팩트 내보내기/검증
├── benchmark-hotpaths.ts             # 핵심 핫패스 성능 벤치마크 (--ci)
├── benchmark-vector-storage.ts       # 벡터 저장/검색 성능 벤치마크
├── init-database.ts                  # 로컬 SQLite 스키마 초기화
├── export-all-templates-fixed.ts     # 템플릿 일괄 내보내기 유틸리티
├── setup-git-hooks.sh                # Git pre-commit/pre-push 훅 설정
├── gql                               # 로컬 GraphQL CLI 헬퍼
└── *tabular-sync* / *google-oauth*   # Google Sheets Tabular Sync 설정·테스트 스크립트
```

---

## 🧪 핵심 검증 및 테스트 스크립트

### 정적 게이트 (`pnpm run check:static`)
```bash
pnpm run check:embedded    # embedded-assets.ts가 database/schema.sql과 동기화되었는지 검증
pnpm run check:docs        # canonical 문서 메타데이터 및 링크 무결성 검증
pnpm run ci:versions       # Node 26 / pnpm / 워크스페이스 버전 정책 검증
pnpm run check:biome       # Biome 린트 및 --error-on-warnings 검증
pnpm run typecheck         # TypeScript 타입 검증 (app / contract / benchmark)
pnpm run check:codegen     # GraphQL codegen 드리프트 검사
pnpm run build             # tsup 번들 빌드 검증
```

### 테스트 실행 (`pnpm` + Vitest 5)
```bash
pnpm run test:golden       # 핵심 기능 골든 데이터셋 3-런타임 검증
pnpm run test:lanes:audit  # 132개 테스트 파일의 4개 레인(parallel-safe/serial-only/e2e/stress) 분류 감사
pnpm run test              # 전체 테스트 스위트 실행
pnpm run test:unit         # 단위 테스트 레인
pnpm run test:integration  # 통합 테스트 레인
pnpm run test:e2e          # E2E 테스트 레인
```

### OpenAPI 투영 & 벤치마크
```bash
pnpm run projection:check      # oa-sdk OpenAPI 3.2 투영 계약 결정적 검증
pnpm run benchmark:hotpaths:ci # 핫패스 레이턴시 회귀 검사
```

---

## 🛠️ 데이터베이스 & 운영 유틸리티

### 데이터베이스 초기화 & 임베디드 SQL 재생성
```bash
node --import tsx scripts/init-database.ts
pnpm run generate:embedded
```

### 템플릿 내보내기 (`scripts/export-all-templates-fixed.ts`)
```bash
node --import tsx scripts/export-all-templates-fixed.ts
```

### Google Sheets Tabular Sync 및 OAuth 스크립트
```bash
node --import tsx scripts/list-tabular-sync-configs.ts
node --import tsx scripts/smoke-google-sheets-tabular-sync.ts
```

> 참고: 레거시 `scripts/archive/`, `utils/executeTemplate.ts`, `bun run`/`bun test` 기반 워크플로우는 Node 26 LTS + pnpm + Vitest 5 마이그레이션 및 코드베이스 일관성 정리에 따라 제거되었습니다.
