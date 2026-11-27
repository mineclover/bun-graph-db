# Role 3: Browser Offline-First Embedded Knowledge & AI Memory (Zero-Dep Core)

Runs **Bun Graph DB Headless Core (`bun-graph-db/core`, `0` Node built-ins / `0` npm deps)** directly in the browser or headless Node WASM contract using `sql.js` + `IndexedDbSnapshotStorage`.

## Run Headless Contract Verification

```bash
pnpm run demo:web
```

## Run Interactive Browser Demo (`http://127.0.0.1:8413/`)

Ensure `pnpm run build` has generated `dist/core/index.js`, then start the zero-build-step demo server:

```bash
node --import tsx examples/web-embedded-ia-memory/demo.ts --serve --port 8413
```

Open `http://127.0.0.1:8413/` to apply the `knowledge` preset, store AI memories, run 5-signal recall, audit IA health, and persist/restore SQLite snapshots in browser IndexedDB.
