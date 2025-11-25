# 🚀 Bun Graph Database

**Production-ready GraphQL-based Graph Database System** with TypeScript/Bun runtime and AI integration capabilities.

[![System Health](https://img.shields.io/badge/System%20Health-✅%20Verified-brightgreen)](#system-status)
[![Test Coverage](https://img.shields.io/badge/Test%20Coverage-100%25-brightgreen)](#testing)
[![MCP Architecture](https://img.shields.io/badge/MCP%20Integration-✅%20Complete-brightgreen)](#mcp-architecture)

## ⚡ Quick Start

### Installation & Setup
```bash
# Install dependencies
bun install

# Initialize database schema
bun run scripts/init-database.ts

# Start server
bun run dev
```

**Server Endpoints:**
- GraphQL API: `http://localhost:4141/graphql`
- GraphQL Playground: `http://localhost:4141/graphql` (browser)
- MCP Global Server: `http://localhost:4141/mcp`
- Table-Specific MCP: `http://localhost:4141/sub/:tableId/mcp`

### First Steps
1. **Verify Setup**: Check health endpoint to confirm server is running
2. **Explore Schema**: Open GraphQL Playground in browser
3. **Create Your First Table**: Use GraphQL mutations for data modeling
4. **Try Templates**: Execute parameterized queries
5. **Setup MCP**: Configure Claude AI integration (optional)

---

## 🎯 Core Concepts

### System Architecture

The system follows a **layered hexagonal architecture** with clear separation of concerns:

#### **1. MCP Integration Layer** (AI Interface)
- **Purpose**: Enable AI assistants (like Claude) to interact with the database
- **Dual Interface**: Global operations + Table-specific operations
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Dynamic Tools**: GraphQL templates automatically become MCP tools

#### **2. GraphQL API Layer** (Primary Interface)
- **Purpose**: Type-safe, flexible API for all database operations
- **Schema-First Design**: Strong typing and introspection
- **Real-time Capabilities**: Subscriptions for live updates
- **Query Language**: Declarative data fetching

#### **3. Core Business Logic**
- **Use Cases**: Orchestrate domain operations
- **Domain Services**: Complex business logic
- **Template Engine**: Parameterized query execution
- **Validation**: Input validation and business rules

#### **4. Domain Layer** (Business Entities)
- **Entities**: Node, Table, Relation, Attribute, Template
- **Repository Interfaces**: Data access contracts
- **Value Objects**: Immutable domain concepts
- **Domain Events**: Business-significant occurrences

#### **5. Infrastructure Layer** (Technical Implementation)
- **SQLite Storage**: File-based persistence
- **Dependency Injection**: Service composition
- **Repository Implementations**: Data access logic
- **External Integrations**: AI systems, monitoring

---

## 📊 Core Features

### Graph Database Engine
**Concept**: Store and traverse interconnected data efficiently

- **Node-Based Storage**: Entities with flexible attributes
- **Typed Relationships**: Connections with semantic meaning
- **Traversal Algorithms**: Find paths, neighbors, subgraphs
- **Quality Metrics**: Confidence scoring and relationship strength
- **Schema Evolution**: Dynamic attribute management

### Template System
**Concept**: Reusable, parameterized operations with version control

- **Query Abstraction**: Named, versioned GraphQL operations
- **Parameter Binding**: Dynamic value substitution
- **Usage Analytics**: Track execution patterns
- **AI Integration**: Templates become AI-accessible tools
- **Version Management**: Track changes over time

### Batch Operations
**Concept**: Efficient mass data operations with transaction safety

- **Bulk Processing**: Handle thousands of records
- **Schema Validation**: Ensure data consistency
- **Progress Monitoring**: Track operation completion
- **Transaction Safety**: Atomic operations with rollback
- **Error Handling**: Graceful failure with detailed reporting

### MCP Architecture
**Concept**: Bridge between AI assistants and database operations

**What is MCP?**
- Model Context Protocol - standard for AI tool integration
- Allows AI assistants to discover and use database capabilities
- JSON-RPC 2.0 protocol for request/response communication

**Architecture Layers:**
```
┌─────────────────────────────────────────┐
│   AI Assistant (Claude)                 │
│   - Discovers available tools            │
│   - Executes database operations         │
└─────────────────┬───────────────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────────────┐
│   MCP Layer (Translation)               │
│   - 27 global tools                     │
│   - Table-specific tool isolation       │
│   - Parameter transformation            │
└─────────────────┬───────────────────────┘
                  │ Internal API
┌─────────────────▼───────────────────────┐
│   GraphQL/REST API                      │
│   - Executes actual operations          │
│   - Returns structured results          │
└─────────────────────────────────────────┘
```

**Two-Level MCP System:**

1. **Global MCP Server** (`/mcp`)
   - Template management operations
   - Cross-table queries
   - System administration
   - Schema discovery

2. **Table-Specific MCP** (`/sub/:tableId/mcp`)
   - Isolated tool sets per table
   - Table-specific queries
   - Template-to-tool conversion
   - Scoped operations

---

## 🏗️ Data Model

### Tables
**Concept**: Schemas that define entity types

- Define attribute structures
- Support schema evolution
- Enable data validation
- Provide organizational boundaries

### Nodes
**Concept**: Individual entities/records

- Belong to specific tables
- Have flexible attributes
- Can be interconnected
- Support full-text search

### Relations
**Concept**: Typed connections between nodes

- Directed relationships (source → target)
- Semantic typing (knows, contains, depends_on)
- Metadata support
- Traversal optimization

### Attributes
**Concept**: Properties of nodes

- Strongly typed (string, number, boolean, date, json, etc.)
- Optional or required
- Default values
- Validation rules

### Templates
**Concept**: Reusable query patterns

- Named GraphQL operations
- Variable parameters
- Version tracking
- Usage statistics
- Automatic AI tool generation

---

## 🔧 Development

### Project Structure
```
src/
├── application/          # Use cases & orchestration
├── domain/              # Business entities & interfaces
├── infrastructure/      # Technical implementations
├── presentation/        # API layers (GraphQL, MCP, REST)
└── shared/             # Cross-cutting concerns

tests/
├── unit/               # Isolated component tests
├── integration/        # Multi-component tests
└── fixtures/           # Test data & helpers
```

### Testing Philosophy
- **310+ Use Case Tests**: Business logic validation
- **Integration Tests**: API endpoint verification
- **Isolation**: Mock external dependencies
- **Coverage**: 100% of critical paths

### Development Commands
```bash
bun run dev              # Start development server
bun test                 # Run all tests
bun run typecheck        # Type validation
bun run check           # Format + lint + fix
```

---

## 🎯 Common Workflows

### Creating a Data Model
1. **Define Table**: Create schema with identifier
2. **Add Attributes**: Define properties and types
3. **Create Template**: Build parameterized insert query
4. **Execute Template**: Populate data with variables

### Querying Graph Data
1. **Search Nodes**: Find entities by attributes
2. **Traverse Relations**: Follow connections
3. **Find Paths**: Discover routes between nodes
4. **Aggregate Data**: Analyze patterns

### AI Integration Workflow
1. **Configure MCP**: Add server to Claude
2. **Discover Tools**: AI explores capabilities
3. **Execute Operations**: AI uses tools
4. **Get Results**: Structured data returned

---

## 🔌 MCP Setup for Claude

### Global Template Management
Configure root server for cross-table operations:

```bash
# CLI Command
claude mcp add --transport http bun-graph-root http://localhost:4141/mcp
```

**Capabilities:**
- Create and manage templates
- Search across tables
- Execute global queries
- System administration

### Table-Specific Operations
Configure per-table servers for isolated operations:

```bash
# Example: Add specific table
claude mcp add --transport http my-table http://localhost:4141/sub/my-table-id/mcp
```

**Capabilities:**
- Table-scoped queries
- Node operations
- Relationship management
- Template execution

**Benefits of Table Isolation:**
- **Security**: Operations limited to one table
- **Organization**: Clear tool separation
- **Performance**: Focused capability sets
- **Flexibility**: Per-table customization

---

## 📚 Documentation Structure

### For Users
- **[Quick Start Guide](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)**: Get running fast
- **[API Reference](docs/api/doc-api-reference.md)**: Complete GraphQL schema
- **[Template Guide](docs/templates/template-system-guide.md)**: Create reusable queries
- **[MCP Setup](docs/guides/MCP_SETUP_GUIDE.md)**: AI assistant integration

### For Developers
- **[Architecture Overview](docs/architecture/ARCHITECTURE_OVERVIEW.md)**: System design
- **[Development Guide](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)**: Contributing & setup
- **[Testing Strategy](docs/development/TESTING.md)**: Quality assurance
- **[Repository Patterns](docs/architecture/ARCHITECTURE_OVERVIEW.md)**: Data access

### For AI Integration
- **[MCP Architecture](docs/mcp/MCP_SYSTEM_ARCHITECTURE.md)**: Protocol implementation
- **[Tool Generation](docs/architecture/MCP_TEMPLATE_ARCHITECTURE.md)**: Template-to-tool conversion
- **[Schema Discovery](docs/guides/MCP_EXAMPLES.md)**: Dynamic capability exposure
- **[Usage Examples](docs/samples/template-execution-patterns.md)**: Common patterns

---

## 📊 System Status

### Current Metrics
```
✅ Core Features: Fully Operational
├── GraphQL API: All endpoints working
├── Template System: Creation & execution verified
├── Batch Operations: Mass processing functional
├── Graph Traversal: All algorithms working
├── MCP Integration: Protocol compliant
└── Type Safety: 0 TypeScript errors

✅ Test Coverage: 310/310 passing (100%)
✅ Database Schema: 11 tables operational
✅ Server Response: <1ms health check
```

### Known Limitations
- SQLite file-based storage (single-writer)
- No horizontal scaling (single process)
- File-based backups only
- In-process transaction management

---

## 🚀 Next Steps

### For New Users
1. Review Quick Start section
2. Explore GraphQL Playground
3. Try example queries (see API Reference)
4. Create your first table

### For Developers
1. Read Architecture Overview
2. Run test suite
3. Review code structure
4. Check contribution guidelines

### For AI Integration
1. Setup MCP servers
2. Test tool discovery
3. Execute sample operations
4. Review integration patterns

---

## 🔧 Troubleshooting

### Common Issues

**Server Won't Start**
- Check port 4141 availability
- Verify database initialization
- Review server logs

**GraphQL Errors**
- Use GraphQL Playground for schema exploration
- Verify query syntax
- Check field availability in schema

**Database Issues**
- Initialize with `bun run scripts/init-database.ts`
- Check `./data/` directory permissions
- Delete and reinitialize if corrupted

### Getting Help
- Check server logs for detailed errors
- Use GraphQL Playground at `http://localhost:4141/graphql`
- Review documentation in `docs/` directory

---

## 📖 Key Concepts

- **Hexagonal Architecture**: Ports & Adapters pattern
- **Domain-Driven Design**: Business logic organization
- **Repository Pattern**: Data access abstraction
- **Dependency Injection**: Service composition
- **Template Engine**: Query parameterization
- **MCP Protocol**: AI tool integration standard

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using [Bun](https://bun.sh/), TypeScript, and GraphQL**

*Last updated: 2025-01-25*
