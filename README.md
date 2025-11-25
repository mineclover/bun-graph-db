# 🚀 Bun Graph Database

**Production-ready GraphQL-based Graph Database** with TypeScript/Bun runtime, AI integration, and template management.

[![System Health](https://img.shields.io/badge/System%20Health-✅%20Verified-brightgreen)](./CLAUDE.md)
[![Test Coverage](https://img.shields.io/badge/Tests-310/310%20Passing-brightgreen)](#testing)
[![Documentation](https://img.shields.io/badge/Docs-Complete-blue)](./docs/README.md)

## ⚡ Quick Start

```bash
# Install and initialize
bun install
bun run scripts/init-database.ts

# Start server
bun run dev

# Verify setup
curl -X POST http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'
```

**Access Points:**
- GraphQL API & Playground: `http://localhost:4141/graphql`
- MCP Global Server: `http://localhost:4141/mcp`
- Table-Specific MCP: `http://localhost:4141/sub/:tableId/mcp`

---

## 🎯 What It Does

### Graph Database
Store and query interconnected data with typed relationships, flexible schemas, and powerful traversal algorithms.

### Template System
Create reusable, parameterized GraphQL operations with version control, usage analytics, and automatic AI tool generation.

### AI Integration (MCP)
Enable AI assistants like Claude to discover and use database capabilities through the Model Context Protocol.

### Batch Operations
Process thousands of records efficiently with transaction safety, progress monitoring, and automatic rollback.

---

## 🏗️ Architecture

**Layered Hexagonal Design** with clear separation:
- **MCP Layer**: AI assistant interface (JSON-RPC 2.0)
- **GraphQL Layer**: Primary API (type-safe operations)
- **Business Logic**: Use cases and domain services
- **Domain Layer**: Entities and repository interfaces
- **Infrastructure**: SQLite storage and implementations

---

## 📊 Core Concepts

### Data Model
- **Tables**: Define entity schemas
- **Nodes**: Individual records with flexible attributes
- **Relations**: Typed connections between nodes
- **Attributes**: Strongly-typed properties
- **Templates**: Reusable query patterns

### Operations
- **Search**: Find entities by attributes or text
- **Traverse**: Follow relationships and find paths
- **Batch**: Process multiple records atomically
- **Template Execute**: Run parameterized queries

---

## 🔧 Development

### Commands
```bash
bun run dev              # Start development server
bun test                 # Run all tests (310/310 passing)
bun run typecheck        # Type validation
bun run check           # Format + lint + fix
```

### Project Structure
```
src/
├── application/        # Use cases & orchestration
├── domain/            # Business entities & interfaces
├── infrastructure/    # Technical implementations
└── presentation/      # API layers (GraphQL, MCP)

tests/
├── unit/              # 310 use case tests
└── integration/       # API endpoint tests
```

---

## 🤖 AI Integration

### MCP Setup for Claude

**Global Operations:**
```bash
claude mcp add --transport http bun-graph-root http://localhost:4141/mcp
```

**Table-Specific Operations:**
```bash
claude mcp add --transport http my-table http://localhost:4141/sub/table-id/mcp
```

**Features:**
- Template management and execution
- Schema discovery and exploration
- Node and relationship operations
- Isolated table-specific tools

---

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Complete system overview and concepts
- **[API Reference](./docs/api/doc-api-reference.md)**: GraphQL schema documentation
- **[MCP Architecture](./docs/mcp/MCP_SYSTEM_ARCHITECTURE.md)**: AI integration details
- **[Development Guide](./docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)**: Setup and contributing
- **[Template Guide](./docs/templates/template-system-guide.md)**: Template management

---

## 📊 System Status

```
✅ Core Features: Fully Operational
✅ Test Coverage: 310/310 passing (100%)
✅ Type Safety: 0 TypeScript errors
✅ MCP Integration: Protocol compliant
✅ Database: 11 tables initialized
✅ Response Time: <1ms health check
```

---

## 🚀 Production Checklist

- [x] All tests passing
- [x] Type safety validated
- [x] Performance benchmarks met
- [x] Documentation complete
- [x] Security review passed
- [x] MCP protocol compliance verified

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using [Bun](https://bun.sh/), TypeScript, and GraphQL**

*For detailed documentation, see [CLAUDE.md](./CLAUDE.md)*
