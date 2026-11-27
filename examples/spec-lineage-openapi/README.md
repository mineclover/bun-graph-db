# Role 2: Spec Lineage, Dependency Impact & OpenAPI Projection Engine

Apply the `product-spec` Information Architecture blueprint (`spec_domains`, `spec_requirements`, `spec_components`), run GraphQL dependency impact & PageRank analysis, fetch live `/api/openapi` schemas with ETags, and inspect table-scoped MCP tools at `/sub/:tableId/mcp`.

## Commands

```bash
# Run verification summary (JSON)
pnpm run demo:spec

# Start live local HTTP / Studio / OpenAPI / MCP server
pnpm run demo:spec -- --serve --port 8412
```

When serving:

- Studio Inspector: `http://127.0.0.1:8412/studio`
- OpenAPI Document: `http://127.0.0.1:8412/api/openapi`
- GraphQL Endpoint: `http://127.0.0.1:8412/graphql`
- Table-Scoped MCP: `http://127.0.0.1:8412/sub/<spec_components_tableId>/mcp`
