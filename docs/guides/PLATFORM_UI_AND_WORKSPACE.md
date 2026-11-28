---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-11-28"
owner: "Bun Graph DB maintainers"
sources:
  - src/presentation/ui/index.ts
  - src/presentation/ui/contracts.ts
  - src/presentation/ui/clients/sharedHelpers.ts
  - src/presentation/ui/clients/LocalHeadlessClient.ts
  - src/presentation/ui/clients/RemoteHttpClient.ts
  - src/presentation/ui/authoring/FieldEditorRegistry.ts
  - src/presentation/ui/authoring/AuthoringController.ts
  - src/presentation/ui/views/ViewRegistry.ts
  - src/presentation/ui/views/TableViewPlugin.ts
  - src/presentation/ui/views/OutlineViewPlugin.ts
  - src/presentation/ui/views/BoardViewPlugin.ts
  - src/presentation/ui/views/GraphViewPlugin.ts
  - src/presentation/ui/views/TimelineViewPlugin.ts
  - src/presentation/ui/views/AuditViewPlugin.ts
  - src/presentation/ui/components/RightInspectorDrawer.ts
  - src/presentation/ui/components/QuickCaptureDialog.ts
  - src/presentation/ui/GraphPlatformWorkspace.ts
  - src/presentation/ui/GraphMemoryWorkspaceElement.ts
  - src/presentation/ui/studio-entry.ts
  - src/presentation/ui/styles/tokens.css
  - src/presentation/ui/styles/primitives.css
  - src/presentation/ui/styles/views.css
  - src/presentation/studio/StudioHtml.ts
  - src/presentation/http/observability/OpsRoutes.ts
tests:
  - tests/unit/platform-ui-architecture.test.ts
  - tests/unit/observability-studio-and-security-ops.test.ts
---

# 플랫폼 UI · 작성/시각화 워크스페이스 가이드 (`bun-graph-db/ui`)

`bun-graph-db/ui` (`dist/ui/index.js`, `0` Node built-ins / `0` 외부 npm 의존성)는 **브라우저 WASM SQLite · 로컬 Node HTTP 서버 · Cloudflare Durable Objects** 위에서 동일하게 동작하는 제로-프레임워크 작성·시각화 플랫폼 UI 계층입니다.

내장 Web Studio(`/studio`)와 브라우저 임베디드 데모([examples/web-embedded-ia-memory/](../../examples/web-embedded-ia-memory/README.md))가 모두 단일 Web Component `<graph-memory-workspace>`와 공통 View Plugin · Authoring 엔진을 공유합니다.

---

## 1. 4계층 플랫폼 아키텍처

| 계층 | 주요 모듈 | 역할 |
| --- | --- | --- |
| **Layer 0: Client Adapter** | [`IGraphPlatformClient`](../../src/presentation/ui/contracts.ts), [`createLocalHeadlessClient`](../../src/presentation/ui/clients/LocalHeadlessClient.ts), [`createRemoteHttpClient`](../../src/presentation/ui/clients/RemoteHttpClient.ts) | 런타임(`HeadlessGraphDb` vs HTTP `/api`·`/mcp`·`/graphql`) 추상화 및 `subscribe()` 반응형 무효화 |
| **Layer 1: Authoring Engine** | [`createDefaultFieldEditorRegistry`](../../src/presentation/ui/authoring/FieldEditorRegistry.ts), [`AuthoringCommandStack`](../../src/presentation/ui/authoring/AuthoringController.ts), [`validateRowDraft`](../../src/presentation/ui/clients/sharedHelpers.ts) | `ColumnConfig` 역할 기반 편집 위젯 매핑, 저장 전 스키마 검증, Undo/Redo 커맨드 스택 |
| **Layer 2: Visualization Plugins** | [`createDefaultViewRegistry`](../../src/presentation/ui/views/ViewRegistry.ts) (`table`, `outline`, `board`, `graph`, `timeline`, `audit`) | `ViewDataSlice` 입력 · `ViewIntent` 출력 계약을 따르는 6대 시각화 플러그인 |
| **Layer 3: Shell & Web Component** | [`mountGraphPlatformWorkspace`](../../src/presentation/ui/GraphPlatformWorkspace.ts), [`GraphMemoryWorkspaceElement`](../../src/presentation/ui/GraphMemoryWorkspaceElement.ts) | 3-Zone 반응형 워크스페이스(Top Command Bar · Left Nav Rail · Center Stage · Right Inspector Drawer) + `<graph-memory-workspace>` |

---

## 2. 바로 쓰는 3가지 구성 레시피

### A. Remote Web Studio (`/studio`) 바로 띄우기

```bash
pnpm run build
node dist/cli/index.js serve --database-path ./data/graph-memory.sqlite --port 4141
```

브라우저에서 `http://localhost:4141/studio`를 열면 [StudioHtml.ts](../../src/presentation/studio/StudioHtml.ts)가 아래 3개 엔드포인트를 조합해 즉시 `<graph-memory-workspace mode="remote-http">`를 실행합니다.

- `GET /studio`: `<graph-memory-workspace mode="remote-http">` HTML 셸
- `GET /studio.css`: 공용 CSS 레이어 (`tokens.css` + `primitives.css` + `views.css`)
- `GET /studio.js`: 브라우저 전용 번들 (`src/presentation/ui/studio-entry.ts`)
- 인증이 켜진 프로덕션 환경에서는 상단 바 `Token` 버튼(팝오버)에서 Bearer 토큰을 `sessionStorage`로 적용할 수 있습니다.

### B. 브라우저 WASM 오프라인 임베드 (`mode="local-headless"`)

```html
<link rel="stylesheet" href="./styles.css" />
<graph-memory-workspace
  id="workspace"
  mode="local-headless"
  title="Offline Knowledge &amp; AI Memory Platform"
  version="1.0.0">
</graph-memory-workspace>

<script src="https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.js"></script>
<script type="module">
  import { createHeadlessGraphDb, IndexedDbSnapshotStorage } from "bun-graph-db/core";
  import { registerGraphMemoryWorkspace } from "bun-graph-db/ui";

  registerGraphMemoryWorkspace();
  const SQL = await window.initSqlJs();
  const snapshots = new IndexedDbSnapshotStorage({ databaseName: "my-graph-app" });

  let rawDb = new SQL.Database();
  const db = await createHeadlessGraphDb({ database: rawDb, snapshotStorage: snapshots });
  await db.applyPresetBlueprint("knowledge");

  const workspace = document.getElementById("workspace");
  workspace.connectHeadlessDb(db, {
    onSaveSnapshot: (key) => db.saveSnapshot(key),
    onRestoreSnapshot: async (key) => {
      const snap = await snapshots.getSnapshot(key);
      if (!snap?.data) throw new Error(`Missing snapshot '${key}'`);
      await db.dispose();
      rawDb = new SQL.Database(snap.data);
      const nextDb = await createHeadlessGraphDb({ database: rawDb, snapshotStorage: snapshots });
      workspace.connectHeadlessDb(nextDb);
    },
  });
</script>
```

### C. 커스텀 마운트 (`mountGraphPlatformWorkspace` + `PLATFORM_UI_CSS`)

React·Vue·Vanilla 앱의 특정 컨테이너에 직접 마운트할 때는 `mountGraphPlatformWorkspace`와 `createRemoteHttpClient` / `createLocalHeadlessClient`를 사용합니다.

```ts
import {
  createRemoteHttpClient,
  mountGraphPlatformWorkspace,
  PLATFORM_UI_CSS,
} from "bun-graph-db/ui";

const style = document.createElement("style");
style.textContent = PLATFORM_UI_CSS;
document.head.append(style);

const client = createRemoteHttpClient({
  baseUrl: "http://localhost:4141",
  token: process.env.API_TOKEN,
});

const handle = mountGraphPlatformWorkspace(
  document.getElementById("app")!,
  client,
  { initialTable: "ia_documents", initialView: "board" },
);
```

---

## 3. 작성 인터페이스 (`Authoring Interface`)

[`FieldEditorRegistry`](../../src/presentation/ui/authoring/FieldEditorRegistry.ts)는 테이블의 [`ColumnConfig`](../../src/domain/value-objects/ColumnConfig.ts)를 읽어 별도 폼 코드 없이 편집기를 매핑합니다.

| 매칭 조건 (`ColumnConfig` / `attributeTypeId`) | 위젯 ID | 셀 렌더 / 편집 동작 |
| --- | --- | --- |
| `enumValues` 존재 또는 `role: "status" \| "category"` | `enum-select` | 상태 톤 배지 + `<select>` 즉시 커밋 |
| `role: "priority" \| "metric"` 또는 숫자 타입 | `number-metric` | 우측 정렬 `tabular-nums` + `data-value` 숫자 입력 |
| `role: "tag"` | `tag-chips` | 칩 목록 + 쉼표 구분 태그 입력 |
| `role: "date"` | `date-picker` | `<time datetime>` + `<input type="date">` |
| `role: "reference"` | `reference-picker` | 대상 노드 후보 `<select>` 피커 |
| 기본 텍스트 / `slug` | `default-text` | IME 조합 중 제출 방지(`isComposing`/`keyCode === 229`) + `Escape` 취소 |

- **인라인 편집**: 테이블 뷰 셀 클릭 시 즉시 위젯으로 전환되며 `AuthoringCommandStack`에 역연산이 쌓여 상단 바 **Undo / Redo**가 동작합니다.
- **Right Inspector Drawer**: 행 ID/제목/Inspect 클릭 시 슬라이드오버(또는 우측 도킹)로 열리며, 제목·Markdown 본문·스키마 속성·**Relation Composer**(연결 목록, 삭제, 대상 노드 + 관계 타입 추가)·Breadcrumb·Raw Node JSON을 제공합니다.
- **Quick Capture (`+ New` / `Cmd+K`)**: 모달 `<dialog>`에서 **New Row**(동적 스키마 폼 + `validateRowDraft` 오류 표시), **Quick AI Memory**(`kind`, `topicPath`, `importance`), **Apply Preset**(`knowledge`, `product-spec`, `decision-log`)을 전환 실행할 수 있습니다.

---

## 4. 6대 시각화 플러그인 (`IVisualizationPlugin`)

| 뷰 ID | 활성화 조건 (`supports`) | 주요 기능 & 발행 `ViewIntent` |
| --- | --- | --- |
| **`table`** | 항상 활성 | 반응형(`@container < 600px` 카드 스택), `aria-sort` 정렬, 패싯 칩 필터, 인라인 수정, 삭제 |
| **`outline`** | 계층 엣지 존재 또는 `topic`/`spec`/`domain` 테이블 | `ia_topics`/`parentOf` 트리 탐색, 드래그 앤 드롭 & `<select>` 안전 이동(`moveHierarchyNode`), 서브트리 스코프(`focus-subtree`) |
| **`board`** | `enumValues` 또는 `status`/`category`/`priority` 칼럼 존재 (또는 `ai_memories`) | 그룹 기준 `<select>`, 드래그 앤 드롭 + 카드 `<select>` 상태 이동(`inline-update`) |
| **`graph`** | 노드/관계 존재 시 | 무의존성 SVG 그래프(PageRank 반지름, Tarjan SCC 클러스터, 선택 노드 영향 체인 하이라이트, 관계 타입 필터, 줌 툴바) |
| **`timeline`** | `ai_memories` 또는 회상 결과 존재 시 | AI Memory 통계, 5-신호 점수 분해 `<progress>` 바(`Combined`/`Lexical`/`Vector`/`Recency`/`Salience·Graph`), `Consolidate` 통합 버튼 |
| **`audit`** | 항상 활성 | 프리셋 적용, IA 무결성/적합성/고아 노드 테이블, 이슈 배지, 원격 모드 시 `/health`·`/metrics`·`/api/audit-log` 점검 |

---

## 5. Saved Views SSOT 및 CSS 토큰 커스터마이징

- **Saved Views (`ui_views` 메타 테이블)**: 상단 `Save View` 클릭 시 현재 테이블·뷰 종류·정렬·검색 조건을 `ui_views` 노드의 `metadata.savedView`에 저장하며, Left Nav Rail의 `Saved Views` 목록에서 1클릭 복원하거나 삭제할 수 있습니다. 브라우저 IndexedDB 스냅샷·로컬 파일 SQLite·Cloudflare DO 간에 동일하게 이동합니다.
- **CSS 토큰 체계**: [tokens.css](../../src/presentation/ui/styles/tokens.css)가 `color-scheme: light dark`, `light-dark()` 및 `@media (prefers-color-scheme: dark)` 폴백을 정의합니다. 호스트 페이지에서 `--bg`, `--panel`, `--panel-alt`, `--border`, `--text`, `--accent`, `--accent-soft` 변수를 덮어쓰면 전체 셸과 6대 뷰의 테마를 일괄 변경할 수 있습니다.
