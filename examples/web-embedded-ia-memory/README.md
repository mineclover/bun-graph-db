# Starter 1: Web/Browser Embedded Knowledge & AI Memory (Zero-Dep Core)

This example runs **Bun Graph DB Headless Core (`bun-graph-db/core`)** directly inside a browser or web worker using `sql.js` (WASM SQLite) + `IndexedDbSnapshotStorage` without any GraphQL server, Node built-ins, or external embedding API required.

## Run in a Vite / React / Vanilla App

1. Install `bun-graph-db` and `sql.js` (or `@sqlite.org/sqlite-wasm`).
2. Import [`app.ts`](./app.ts) into your frontend bundle.
3. Open [`index.html`](./index.html) inside your Vite dev server (`pnpm vite`).
