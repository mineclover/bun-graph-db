# Quick Reference Guide

**Bun Graph Database** - Essential Commands and Queries

---

## 🚀 Server Commands

```bash
# Start server
pnpm run dev

# Start on custom port
pnpm run dev --port 4200

# Type check
pnpm run typecheck

# Static quality gates
pnpm run check:static

# Stop server
Ctrl + C  # or: pkill -f "tsx watch"
```

---

## 📊 Health & Status

```graphql
# Health check
query { healthCheck { status database version } }

# System stats
query { systemStats { memory { used total } process { pid cpu } } }

# All tables
query { tables { nodes { id identifier nodeCount } } }
```

---

## 📝 CRUD Operations

### Create

```graphql
# Table
mutation { createTable(input: { identifier: "users" }) { success table { id } } }

# Node
mutation { createNode(input: { tableId: "1" title: "Title" content: "Content" }) { success node { id } } }

# Relation Type
mutation { createRelationType(input: { identifier: "knows" }) { success relationType { id } } }

# Relation
mutation { createRelation(input: { fromNodeId: "1" toNodeId: "2" relationshipType: "knows" }) { success } }
```

### Read

```graphql
# Single node
query { node(id: "1") { id title content } }

# Table with nodes
query { table(id: "1") { id tableNodes { nodes { id title } } } }

# Search
query { searchNodes(tableId: "1" searchQuery: { textSearch: "keyword" limit: 10 }) { nodes { node { id title } } } }
```

### Update

```graphql
# Node
mutation { updateNode(input: { id: "1" title: "New Title" }) { success node { id title } } }

# Table
mutation { updateTable(input: { id: "1" description: "Updated" }) { success } }
```

### Delete

```graphql
# Node
mutation { deleteNode(id: "1") { success } }

# Table
mutation { deleteTable(id: "1") { success } }

# Relation
mutation { deleteRelation(id: "1") { success } }
```

---

## 🕸️ Graph Operations

```graphql
# Connected nodes (2 hops)
query { node(id: "1") { connectedNodes(depth: 2) { id title } } }

# Shortest path
query { node(id: "1") { shortestPath(targetNodeId: "5") { id title } } }

# Neighbors by relation type
query { node(id: "1") { neighborsByRelationType(relationTypes: ["knows"]) { id title } } }

# Outgoing relations
query { node(id: "1") { outgoingRelations { id targetNode { title } } } }

# Incoming relations
query { node(id: "1") { incomingRelations { id sourceNode { title } } } }
```

---

## 🎯 Attributes

```graphql
# Create attribute type
mutation { createAttributeType(input: { identifier: "email" dataType: "string" }) { success attributeType { id } } }

# Add to table
mutation { createAttribute(input: { tableId: "1" identifier: "user_email" attributeTypeId: "1" }) { success } }

# Set value
mutation { setNodeAttribute(input: { nodeId: "1" attributeId: "1" value: "user@example.com" }) { success } }

# Get attributes
query { node(id: "1") { attributes { attribute { identifier } value } } }
```

---

## 📋 Templates

```graphql
# Create template
mutation {
  createTemplate(input: {
    identifier: "create-user"
    query: "mutation CreateUser($name: String!) { ... }"
    tags: ["user"]
  }) { success }
}

# Execute template
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-user"
    variables: { name: "John" }
  ) { success data }
}

# Search templates
query { searchTemplates { templates { identifier name } } }
```

---

## 🔍 Advanced Search

```graphql
# Full-text search with filters
query {
  searchNodes(
    tableId: "1"
    searchQuery: {
      textSearch: "engineer"
      conditions: [{
        logicalOperator: AND
        filters: [{
          field: "age"
          operator: "gte"
          value: "25"
        }]
      }]
      sortBy: [{ field: "created_at" direction: DESC }]
      limit: 20
    }
  ) {
    nodes { node { id title } }
    totalCount
  }
}
```

---

## 📤 Export/Import

```graphql
# Export table
query { exportTable(tableId: "1") { success package { table { identifier } } } }

# Export formats
query { getSupportedExportFormats { formats } }
```

---

## 🔧 Troubleshooting

### Port in use
```bash
lsof -i :4141
kill -9 <PID>
# or: pnpm run dev --port 4200
```

### Database issues
```bash
rm ./data/bun-graph-db.sqlite
pnpm run dev  # Recreates database
```

### Memory issues
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm run dev
```

---

## 📌 Common Patterns

### Create Table → Attributes → Nodes
```graphql
# 1. Create table
mutation { createTable(input: { identifier: "users" }) { success table { id } } }

# 2. Create attribute type
mutation { createAttributeType(input: { identifier: "email" dataType: "string" }) { success attributeType { id } } }

# 3. Add attribute to table
mutation { createAttribute(input: { tableId: "1" attributeTypeId: "1" identifier: "user_email" }) { success } }

# 4. Create node
mutation { createNode(input: { tableId: "1" title: "User" }) { success node { id } } }

# 5. Set attribute value
mutation { setNodeAttribute(input: { nodeId: "1" attributeId: "1" value: "user@example.com" }) { success } }
```

### Build Graph Network
```graphql
# 1. Create nodes
mutation { n1: createNode(input: { tableId: "1" title: "Alice" }) { success node { id } } }
mutation { n2: createNode(input: { tableId: "1" title: "Bob" }) { success node { id } } }

# 2. Create relation type
mutation { createRelationType(input: { identifier: "knows" }) { success relationType { id } } }

# 3. Connect nodes
mutation { createRelation(input: { fromNodeId: "1" toNodeId: "2" relationshipType: "knows" strength: 3 }) { success } }

# 4. Query network
query { node(id: "1") { title connectedNodes(depth: 2) { title } } }
```

---

## 🌐 HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/graphql` | POST | GraphQL API |
| `/graphql` | GET | GraphiQL Playground |
| `/mcp` | POST | MCP JSON-RPC |
| `/schema` | GET | SDL Schema |
| `/schema.json` | GET | JSON Schema |
| `/introspection.json` | GET | Introspection |

---

## 📱 MCP Integration

```bash
# Add global MCP server
claude mcp add --transport http bun-graph-root http://localhost:4141/mcp

# Add table-specific MCP
claude mcp add --transport http my-table http://localhost:4141/sub/1/mcp
```

---

## 🎨 GraphQL Playground Shortcuts

- `Ctrl/Cmd + Enter`: Execute query
- `Ctrl/Cmd + Space`: Auto-complete
- `Ctrl/Cmd + Shift + P`: Format
- `Ctrl/Cmd + F`: Find

---

## 📚 Documentation Links

- **Full User Guide (Korean)**: [USER_GUIDE_KR.md](./USER_GUIDE_KR.md)
- **Getting Started (English)**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- **API Reference**: [../api/doc-api-reference.md](../api/doc-api-reference.md)
- **Template Guide**: [../templates/template-system-guide.md](../templates/template-system-guide.md)

---

**Version**: 1.0.0
**Updated**: 2026-11-27
