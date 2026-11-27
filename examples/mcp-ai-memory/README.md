# Role 1: Local AI Agent Long-Term Memory & ADR Hub

Connect any desktop MCP client (Claude Desktop, Cursor, Windsurf, Antigravity) directly to a local SQLite knowledge + IA + 5-signal AI Memory graph without external vector databases.

## Quick Demo Run

```bash
# Ephemeral in-memory verification (JSON summary)
pnpm run demo:mcp

# Persistent workspace DB + Web Studio on port 8411
pnpm run demo:mcp -- --database-path ./data/demo-agent-memory.sqlite
NODE_ENV=production BUN_GRAPH_DB_AUTH_REQUIRED=false \
  node dist/cli/index.js serve --database-path ./data/demo-agent-memory.sqlite --port 8411 --host 127.0.0.1
```

Open `http://127.0.0.1:8411/studio` in your browser to inspect tables, columns, IA outlines, AI memories, and audit logs.

## Claude Desktop / Cursor Config

Copy [`claude_desktop_config.json`](./claude_desktop_config.json) into your MCP client config and point `--database-path` to your persistent `.sqlite` file.
