# Starter 3: Cloudflare Durable Objects Single-Node Worker

Deploy an isolated per-tenant graph + IA + AI memory + MCP node on Cloudflare Workers backed by Durable Object SQLite storage and optional R2 snapshot backups.

## Files
- [`../../deploy/cloudflare/wrangler.jsonc`](../../deploy/cloudflare/wrangler.jsonc) — Worker & DO SQLite configuration
- [`../../deploy/cloudflare/worker.ts`](../../deploy/cloudflare/worker.ts) — `GraphNodeDurableObject` + `routeSingleNodeRequest`

## Deploy

```bash
wrangler deploy --config deploy/cloudflare/wrangler.jsonc
```

Route requests to isolated tenants using the `x-graph-node-id` header (e.g., `x-graph-node-id: workspace-alpha`).
