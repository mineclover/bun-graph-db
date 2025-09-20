# Document 51 - usage

**Version**: 1
**Table ID**: 106 (test-reliability-check)
**Created**: 2025-09-19T21:38:47.248Z
**Updated**: 2025-09-19T21:38:47.248Z
**Content Length**: 1816 characters

---

# Bun Graph DB - Complete API Usage Guide

## Overview

Production-ready GraphQL-based Graph Database System with TypeScript/Bun runtime featuring:

- **SQLite-backed storage** with relationship scoring
- **Hexagonal Architecture** with Domain-Driven Design
- **Type-safe GraphQL operations** with comprehensive schema
- **Template system** with ExecuteTemplateWithGraphQL engine
- **Batch operations** with transaction safety
- **Real-time synchronization** support

## Endpoints

- **GraphQL API**: `http://localhost:4000/graphql`
- **GraphQL Playground**: `http://localhost:4000/graphql`
- **Schema SDL**: `http://localhost:4000/schema`
- **Schema JSON**: `http://localhost:4000/schema.json`
- **Introspection**: `http://localhost:4000/introspection.json`
- **TypeScript Types**: `http://localhost:4000/schema/typescript`
- **MCP JSON-RPC**: `http://localhost:4000/mcp`
- **MCP Info**: `http://localhost:4000/mcp/info`
- **MCP Health**: `http://localhost:4000/mcp/health`

## Core Workflow

1. **Create Table** via GraphQL mutation
2. **Define Schema** with attribute types via GraphQL
3. **Get Table ID** from creation response
4. **Create Template** for populating rows using the table ID
5. **Execute Template** via ExecuteTemplateWithGraphQL engine

## Key Types

- `Table`: Main data container
- `Node`: Individual data records
- `Template`: Parameterized query templates
- `AttributeType`: Schema definitions
- `NodeAttribute`: Data field values
- `Relation`: Connections between nodes
- `Doc`: Documentation entries

## Health Check

```graphql
query HealthCheck {
  healthCheck {
    status
    database
    version
    timestamp
  }
}
```

Expected Response:
```json
{
  "healthCheck": {
    "status": "OK",
    "database": "Connected",
    "version": "1.0.0",
    "timestamp": "2025-01-19T..."
  }
}
```
