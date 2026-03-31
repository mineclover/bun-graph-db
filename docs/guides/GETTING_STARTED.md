# Getting Started with Bun Graph Database

**Version**: 1.0.0
**Last Updated**: 2026-03-30
**Verification Snapshot**: build/typecheck/lint passing, core runtime flows verified

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Server](#running-the-server)
4. [Basic Usage](#basic-usage)
5. [GraphQL Query Examples](#graphql-query-examples)
6. [Troubleshooting](#troubleshooting)
7. [Next Steps](#next-steps)

---

## Prerequisites

### System Requirements

#### Required
- **Bun**: 1.0.0 or higher ([Installation Guide](https://bun.sh))
- **Operating System**: Linux, macOS, or WSL2 (Windows)
- **Memory**: 512MB minimum
- **Disk Space**: 100MB free space

#### Optional
- **Node.js**: 18.0.0+ (for compatibility testing)
- **Git**: For version control
- **GraphQL Client**: Postman, Insomnia, or curl

### Verify Bun Installation

```bash
# Check if Bun is installed
bun --version

# Install if not present
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version  # Should be 1.0.0 or higher
```

---

## Installation

### 1. Clone the Repository

```bash
# Using Git
git clone https://github.com/your-username/bun-graph-db.git
cd bun-graph-db

# Or download ZIP
# https://github.com/your-username/bun-graph-db/archive/refs/heads/main.zip
```

### 2. Install Dependencies

```bash
# Install packages using Bun
bun install

# Verify installation (node_modules directory created)
ls -la node_modules
```

**Installation Time**: Approximately 30 seconds to 1 minute

### 3. Database Initialization

```bash
# Initialize the schema explicitly
bun run scripts/init-database.ts
```

**Database Location**: `./data/bun-graph-db.sqlite`

---

## Running the Server

### Basic Startup

```bash
# Start development server
bun run dev

# Expected output:
# 🚀 Bun Graph DB Server ready at http://localhost:4141/graphql
# 📊 GraphiQL available at http://localhost:4141/graphql
# 🔌 MCP Protocol available at http://localhost:4141/mcp
```

### Custom Port

```bash
# Run on custom port
bun run dev --port 3000

# Verify
# Server ready at http://localhost:3000/graphql
```

### Health Check

```bash
# 1. Browser
# Visit: http://localhost:4141/graphql

# 2. Using curl
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'

# MCP initialize
curl -X POST http://localhost:4141/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"smoke","version":"1.0.0"},"capabilities":{}}}'

# Expected output:
# {"data":{"healthCheck":{"status":"OK","database":true,"version":"1.0.0"}}}
```

> Note: the latest lane-based full-suite status is tracked in [../development/SYSTEM_EVALUATION_2026-03-30.md](../development/SYSTEM_EVALUATION_2026-03-30.md). Core server flows are verified and `bun run test` is currently passing.

### Stopping the Server

```bash
# Press Ctrl + C or Cmd + C
# Or if running in background:
pkill -f "bun.*dev"
```

---

## Basic Usage

### 1. Access GraphQL Playground

**Open in Browser**:
```
http://localhost:4141/graphql
```

**Interface Layout**:
- Left: Query editor
- Right: Results panel
- Top: Execute button (▶)
- Right: Schema tab (explore available operations)

### 2. First Query

**Health Check Query**:
```graphql
query {
  healthCheck {
    status
    database
    version
  }
}
```

**How to Execute**:
1. Copy the query to the left panel
2. Click the Execute button (▶)
3. View results on the right

**Expected Result**:
```json
{
  "data": {
    "healthCheck": {
      "status": "healthy",
      "database": "connected",
      "version": "1.0.0"
    }
  }
}
```

### 3. Create Your First Table

**Mutation**:
```graphql
mutation {
  createTable(input: {
    identifier: "my-first-table"
    description: "My first graph table"
  }) {
    success
    table {
      id
      identifier
      description
    }
    errors {
      message
    }
  }
}
```

**Result**:
```json
{
  "data": {
    "createTable": {
      "success": true,
      "table": {
        "id": "1",
        "identifier": "my-first-table",
        "description": "My first graph table"
      },
      "errors": []
    }
  }
}
```

### 4. Create a Node

**After getting the table ID**:
```graphql
mutation {
  createNode(input: {
    tableId: "1"
    title: "First Node"
    content: "Hello, Bun Graph DB!"
  }) {
    success
    node {
      id
      title
      content
      createdAt
    }
  }
}
```

### 5. Query Data

**List All Tables**:
```graphql
query {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
      createdAt
    }
  }
}
```

**Query Nodes in a Table**:
```graphql
query {
  table(id: "1") {
    id
    identifier
    tableNodes {
      nodes {
        id
        title
        content
      }
    }
  }
}
```

---

## GraphQL Query Examples

### Basic CRUD Operations

#### 1. Create

**Create Table**:
```graphql
mutation CreateTable {
  createTable(input: {
    identifier: "users"
    description: "User profiles table"
  }) {
    success
    table {
      id
      identifier
    }
  }
}
```

**Create Node**:
```graphql
mutation CreateNode {
  createNode(input: {
    tableId: "1"
    title: "John Doe"
    content: "Software Engineer"
  }) {
    success
    node {
      id
      title
    }
  }
}
```

#### 2. Read

**Get Single Node**:
```graphql
query GetNode {
  node(id: "1") {
    id
    title
    content
    createdAt
    updatedAt
  }
}
```

**Search Nodes**:
```graphql
query SearchNodes {
  searchNodes(
    tableId: "1"
    searchQuery: {
      textSearch: "Engineer"
      limit: 10
    }
  ) {
    nodes {
      node {
        id
        title
        content
      }
    }
    totalCount
  }
}
```

#### 3. Update

**Update Node**:
```graphql
mutation UpdateNode {
  updateNode(input: {
    id: "1"
    title: "John Doe (Updated)"
    content: "Senior Software Engineer"
  }) {
    success
    node {
      id
      title
      content
      updatedAt
    }
  }
}
```

#### 4. Delete

**Delete Node**:
```graphql
mutation DeleteNode {
  deleteNode(id: "1") {
    success
    message
  }
}
```

### Advanced Features

#### Working with Relations

**1. Create Relation Type**:
```graphql
mutation CreateRelationType {
  createRelationType(input: {
    identifier: "knows"
    description: "Person knows another person"
  }) {
    success
    relationType {
      id
      identifier
    }
  }
}
```

**2. Create Relation Between Nodes**:
```graphql
mutation CreateRelation {
  createRelation(input: {
    fromNodeId: "1"
    toNodeId: "2"
    relationshipType: "knows"
    strength: 3
    confidence: 4
  }) {
    success
    relation {
      id
      sourceNode { title }
      targetNode { title }
    }
  }
}
```

#### Graph Traversal

**Find Connected Nodes**:
```graphql
query FindConnected {
  node(id: "1") {
    id
    title
    connectedNodes(depth: 2, direction: BOTH) {
      id
      title
      content
    }
  }
}
```

**Find Shortest Path**:
```graphql
query ShortestPath {
  node(id: "1") {
    title
    shortestPath(targetNodeId: "5", maxDepth: 10) {
      id
      title
    }
  }
}
```

**Get Neighbors by Relation Type**:
```graphql
query GetNeighbors {
  node(id: "1") {
    title
    neighborsByRelationType(
      relationTypes: ["knows", "works_with"]
      direction: OUTGOING
    ) {
      id
      title
    }
  }
}
```

#### Template System

**1. Create Template**:
```graphql
mutation CreateTemplate {
  createTemplate(input: {
    identifier: "create-user-v1"
    name: "User Creation Template"
    query: """
      mutation CreateUser($name: String!, $role: String!) {
        createNode(input: {
          tableId: "1"
          title: $name
          content: $role
        }) {
          success
          node { id title }
        }
      }
    """
    tags: ["user", "create"]
  }) {
    success
    template {
      id
      identifier
    }
  }
}
```

**2. Execute Template**:
```graphql
mutation ExecuteUserTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-user-v1"
    variables: {
      name: "Jane Smith"
      role: "Project Manager"
    }
  ) {
    success
    data
    errors { message }
  }
}
```

#### Attributes

**1. Create Attribute Type**:
```graphql
mutation CreateAttributeType {
  createAttributeType(input: {
    identifier: "email"
    description: "Email address"
    dataType: "string"
  }) {
    success
    attributeType {
      id
      identifier
    }
  }
}
```

**2. Add Attribute to Table**:
```graphql
mutation CreateAttribute {
  createAttribute(input: {
    tableId: "1"
    identifier: "user_email"
    name: "Email"
    attributeTypeId: "1"
  }) {
    success
    attribute {
      id
      identifier
    }
  }
}
```

**3. Set Node Attribute Value**:
```graphql
mutation SetAttribute {
  setNodeAttribute(input: {
    nodeId: "1"
    attributeId: "1"
    value: "john.doe@example.com"
  }) {
    success
    nodeAttribute {
      id
      value
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Server Won't Start

**Symptom**:
```
Error: Port 4141 already in use
```

**Solution**:
```bash
# Find process using the port
lsof -i :4141

# Kill the process
kill -9 <PID>

# Or use a different port
bun run dev --port 3000
```

#### 2. Database Connection Error

**Symptom**:
```
Database connection failed
```

**Solution**:
```bash
# Check data directory
ls -la ./data

# Fix permissions
chmod 755 ./data
chmod 644 ./data/bun-graph-db.sqlite

# Recreate database (WARNING: Deletes all data)
rm ./data/bun-graph-db.sqlite
bun run dev  # Auto-creates new database
```

#### 3. GraphQL Query Errors

**Symptom**:
```json
{
  "errors": [
    {
      "message": "Cannot query field 'xxx' on type 'Query'"
    }
  ]
}
```

**Solution**:
1. Check available fields in Schema tab
2. Verify field name spelling
3. Ensure all required arguments are provided
4. Check argument types match schema

#### 4. Memory Issues

**Symptom**:
```
JavaScript heap out of memory
```

**Solution**:
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" bun run dev
```

### Debugging

**Server Logs**:
- View real-time logs in the terminal
- `[INFO]` for informational messages
- `[ERROR]` for errors

**Enable Debug Mode**:
```bash
# Verbose logging
DEBUG=* bun run dev
```

### Performance Optimization

**Optimize Slow Queries**:
1. Select only required fields
2. Use `limit` parameter
3. Add indexes for large datasets

**Example**:
```graphql
# ❌ Inefficient
query {
  tables {
    nodes {
      # All fields and relations
      ...
      tableNodes {
        nodes {
          ...  # Thousands of nodes
        }
      }
    }
  }
}

# ✅ Efficient
query {
  tables {
    nodes {
      id
      identifier
      nodeCount  # Just get count
    }
  }
}
```

---

## Next Steps

### Learning Resources

1. **API Documentation**: [docs/api/doc-api-reference.md](../../api/doc-api-reference.md)
2. **Template Guide**: [docs/templates/template-system-guide.md](../../templates/template-system-guide.md)
3. **Test Coverage Report**: [claudedocs/test-coverage-report.md](../../claudedocs/test-coverage-report.md)
4. **Architecture Overview**: [docs/architecture/ARCHITECTURE_OVERVIEW.md](../../architecture/ARCHITECTURE_OVERVIEW.md)

### Advanced Features

#### 1. MCP Protocol Integration
```bash
# MCP endpoint
http://localhost:4141/mcp

# Integrate with Claude AI and other MCP clients
```

**Setup MCP with Claude**:
```bash
# Add global MCP server
claude mcp add --transport http bun-graph-root http://localhost:4141/mcp

# Add table-specific MCP
claude mcp add --transport http my-table http://localhost:4141/sub/1/mcp
```

#### 2. Schema Export/Import
```graphql
# Export table schema
query ExportTable {
  exportTable(tableId: "1") {
    success
    package {
      table { identifier }
      attributes { identifier name }
    }
  }
}
```

#### 3. Batch Operations
```graphql
# Create multiple nodes at once
mutation BatchCreate {
  executeTemplateWithGraphQL(
    templateIdentifier: "batch-create-users"
    variables: { users: [...] }
  ) {
    success
  }
}
```

### Production Deployment

**Preparation Checklist**:
1. ✅ Set environment variables
2. ✅ Configure database backups
3. ✅ Set up monitoring
4. ✅ Configure security (firewall, authentication)

**Recommendations**:
- Use HTTPS
- Regular backups
- Log monitoring
- Performance metrics
- Rate limiting
- Authentication/Authorization

**Environment Variables**:
```bash
# .env file example
PORT=4141
DATABASE_PATH=./data/bun-graph-db.sqlite
NODE_ENV=production
```

---

## Help & Support

### Community

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and discussions
- **Documentation**: Comprehensive guides and API docs

### Documentation

- **CLAUDE.md**: Project overview and key features
- **docs/**: Detailed documentation
- **claudedocs/**: Development-related docs

### Version Information

```graphql
query {
  healthCheck {
    version  # Check current version
  }
}
```

---

## Appendix

### Useful GraphQL Queries

**System Statistics**:
```graphql
query SystemStats {
  systemStats {
    memory {
      used
      total
      percentage
    }
    process {
      pid
      cpu
      platform
    }
  }
}
```

**List All Tables**:
```graphql
query AllTables {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
    }
    totalCount
  }
}
```

**Search Templates**:
```graphql
query FindTemplates {
  searchTemplates {
    templates {
      identifier
      name
      tags
      usageCount
    }
  }
}
```

**Relation Analytics** (Stub):
```graphql
query Analytics {
  relationAnalytics(filter: { tableIds: ["1"] }) {
    totalRelations
    strengthDistribution {
      invalid
      autoGenerated
      uncertain
      confident
      veryStrong
    }
    confidenceDistribution {
      probablyWrong
      autoGenerated
      uncertainButValid
      confident
      verified
    }
  }
}
```

### Keyboard Shortcuts (GraphQL Playground)

- `Ctrl/Cmd + Enter`: Execute query
- `Ctrl/Cmd + Space`: Auto-complete
- `Ctrl/Cmd + Shift + P`: Format with Prettier
- `Ctrl/Cmd + F`: Find in editor
- `Ctrl/Cmd + B`: Beautify query

### HTTP API Examples

**Using curl**:
```bash
# Health check
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query{healthCheck{status}}"}'

# Create table
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation{createTable(input:{identifier:\"test\"}){success table{id}}}"}'
```

**Using JavaScript/TypeScript**:
```typescript
const response = await fetch('http://localhost:4141/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query {
        healthCheck {
          status
          version
        }
      }
    `
  })
});

const data = await response.json();
console.log(data);
```

---

## Quick Reference

### Common Operations Cheat Sheet

| Operation | GraphQL Type | Example |
|-----------|--------------|---------|
| Create Table | Mutation | `createTable(input: {...})` |
| Create Node | Mutation | `createNode(input: {...})` |
| Update Node | Mutation | `updateNode(input: {...})` |
| Delete Node | Mutation | `deleteNode(id: "1")` |
| Get Node | Query | `node(id: "1") {...}` |
| Search | Query | `searchNodes(tableId: "1", searchQuery: {...})` |
| List Tables | Query | `tables {...}` |
| Create Relation | Mutation | `createRelation(input: {...})` |

### Port Configuration

| Service | Default Port | Description |
|---------|--------------|-------------|
| GraphQL API | 4141 | Main API endpoint |
| MCP Protocol | 4141/mcp | MCP JSON-RPC endpoint |
| GraphiQL | 4141/graphql | Interactive playground |

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-23
**Authors**: Bun Graph DB Team

**Feedback**: Please submit feedback or suggestions via GitHub Issues.

**License**: MIT
