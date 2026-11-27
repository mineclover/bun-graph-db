# Role 4: Cloudflare Durable Objects Single-Node Edge Hub

Deploy an isolated per-tenant graph + IA + AI memory + MCP node on Cloudflare Workers backed by Durable Object SQLite storage and optional R2 snapshot backups.

## Local Multi-Tenant Simulator Demo

Verify per-tenant isolation (`workspace-alpha` vs `workspace-beta`) and RBAC enforcement (`reader` vs `admin`) locally without waiting for a cloud deploy:

```bash
# Headless verification summary
pnpm run demo:cf

# Interactive local HTTP simulator
pnpm run demo:cf -- --serve --port 8414
```

Pass `x-graph-node-id: workspace-alpha` (or `workspace-beta`) to route requests to isolated Durable Object SQLite instances.

## Production Wrangler Deploy

- [`../../deploy/cloudflare/wrangler.jsonc`](../../deploy/cloudflare/wrangler.jsonc) — Worker & DO SQLite configuration
- [`../../deploy/cloudflare/worker.ts`](../../deploy/cloudflare/worker.ts) — `GraphNodeDurableObject` + `routeSingleNodeRequest`

```bash
wrangler deploy --config deploy/cloudflare/wrangler.jsonc
```
