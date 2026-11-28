# Role 3: Browser Offline-First Embedded Platform Workspace (`./core` + `./ui`)

Runs **Bun Graph DB Headless Core (`bun-graph-db/core`, `0` Node built-ins / `0` npm deps)** and the **Platform UI Workspace (`bun-graph-db/ui`, `<graph-memory-workspace>`)** directly in Chromium/browser using `sql.js` + `IndexedDbSnapshotStorage`, styled by the shared CSS token layers (`src/presentation/ui/styles/{tokens,primitives,views}.css`).

## Run Headless Contract Verification

```bash
pnpm run demo:web
```

## Run Interactive Browser Platform Demo (`http://127.0.0.1:8413/`)

Ensure `pnpm run build` has generated `dist/core/index.js` and `dist/ui/index.js`, then start the demo server:

```bash
node --import tsx examples/web-embedded-ia-memory/demo.ts --serve --port 8413
```

Open `http://127.0.0.1:8413/` to:
- Switch across **Table** (sortable + inline editing), **Outline** (tree reparenting + subtree scope), **Board** (status Kanban), **Graph** (SVG PageRank/SCC impact map), **Timeline** (5-signal AI memory bars), and **Audit & Ops** views.
- Author rows, typed attributes, and node relations in the **Right Inspector Drawer** or via `+ New` / `Cmd+K` (**Quick Capture**).
- Save/load **Saved Views** (`ui_views`) and persist/restore full SQLite snapshots in browser IndexedDB.
