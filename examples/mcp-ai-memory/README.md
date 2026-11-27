# Starter 2: MCP AI Memory Server (Stdio for Claude Desktop / Cursor / Windsurf)

Connect any desktop MCP client directly to a local SQLite knowledge & AI memory graph without managing background HTTP servers.

## Claude Desktop / Cursor Config

Copy [`claude_desktop_config.json`](./claude_desktop_config.json) into your MCP client config and point `--database-path` to your persistent `.sqlite` file.

## Local Smoke Demo

```bash
node --import tsx examples/mcp-ai-memory/demo.ts
```
