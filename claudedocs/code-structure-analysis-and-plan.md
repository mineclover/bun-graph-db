# Bun Graph Database - Code Structure Analysis & Restructuring Plan

**Generated**: 2025-11-22
**Status**: Comprehensive Analysis Complete
**Priority**: Strategic Planning Document

---

## Executive Summary

The bun-graph-db codebase demonstrates **excellent architectural foundations** with clean Domain-Driven Design (DDD) principles, comprehensive testing, and production-ready quality. The project contains:

- **206 TypeScript source files** (~56K LOC)
- **67 test files** (~32K LOC)
- **71 documentation files**
- **Clear layered architecture**: Domain → Application → Presentation → Infrastructure
- **Multiple interfaces**: GraphQL API, REST API, MCP Protocol, CLI

### Overall Assessment: 🟢 Production Ready

**Strengths**: Clean architecture, strong DDD patterns, comprehensive testing, excellent documentation
**Improvement Areas**: Minor organizational inconsistencies, some code duplication, scattered utilities

---

## 1. Current Architecture Overview

### 1.1 Layered Architecture (Clean Architecture + DDD)

```
┌─────────────────────────────────────────────────────┐
│           PRESENTATION LAYER (56 files)             │
│  ┌──────────────┬──────────────┬─────────────────┐ │
│  │   GraphQL    │   REST API   │  MCP Protocol   │ │
│  │  (Queries,   │ (Controllers,│   (Factory,     │ │
│  │  Mutations,  │   Routes,    │  SchemaMapper)  │ │
│  │  Resolvers)  │    Utils)    │                 │ │
│  └──────────────┴──────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│          APPLICATION LAYER (~45 files)              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Use Cases (22 domains, ~30 classes)         │  │
│  │  - CreateTable, CreateNode, SearchNodes      │  │
│  │  - ExecuteTemplate, ImportTablePackage       │  │
│  │  - [+26 more use cases]                      │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Application Services                         │  │
│  │  - McpToolRegistry, SearchQueryParser        │  │
│  │  - TableTemplateAutoGenerator, etc.          │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  DTOs (Data Transfer Objects)                │  │
│  │  - TableDto, NodeDto, AttributeDto, etc.     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│            DOMAIN LAYER (~21 files)                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  Entities (9 core business entities)         │  │
│  │  - Table, Node, NodeRelation                 │  │
│  │  - Attribute, QueryTemplate, Doc             │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Repository Interfaces (Ports)               │  │
│  │  - ITableRepository, INodeRepository         │  │
│  │  - [+7 more repository interfaces]           │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Domain Services (8 services)                │  │
│  │  - TablePackageService                       │  │
│  │  - SchemaIntrospectionService                │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Value Objects                               │  │
│  │  - SearchFilter, SortStrategy, RelationQuery │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│        INFRASTRUCTURE LAYER (37 files)              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Database (SQLite Implementations)           │  │
│  │  - SqliteConnection                          │  │
│  │  - 12 Repository Implementations             │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Dependency Injection                        │  │
│  │  - DIContainer, ContainerBootstrap           │  │
│  │  - Module Configuration (6 modules)          │  │
│  │  - Service Tokens (6 token files)            │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  AI Metadata & Schema Discovery (9 files)    │  │
│  │  - GraphQLSchemaIntrospector                 │  │
│  │  - EnhancedAIMetadataGenerator               │  │
│  │  - SchemaDiscoveryService                    │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Logging                                     │  │
│  │  - ConsoleLogger                             │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Patterns

| Pattern | Implementation | Status |
|---------|----------------|--------|
| **Domain-Driven Design (DDD)** | Entities, Value Objects, Repositories, Domain Services | ✅ Excellent |
| **Clean Architecture** | Layered structure with clear boundaries | ✅ Excellent |
| **Dependency Inversion** | Repositories as ports, SQLite as adapters | ✅ Excellent |
| **Repository Pattern** | 9 interfaces, 12 SQLite implementations | ✅ Excellent |
| **Use Case Pattern** | ~30 use case classes, single responsibility | ✅ Excellent |
| **Factory Pattern** | TableMcpServerFactory, Entity factories | ✅ Good |
| **Dependency Injection** | Custom DIContainer with modules | ✅ Excellent |
| **DTO Pattern** | Data transfer between layers | ✅ Good |

---

## 2. Structural Strengths (What's Working Well)

### 2.1 ✅ Excellent Architectural Separation

**Domain Layer Isolation**
- Pure business logic with no infrastructure dependencies
- Rich domain entities with behavior (not anemic)
- Clear repository interfaces (ports)
- Domain services for cross-entity logic

**Application Layer Orchestration**
- Use cases organized by business domain
- Single responsibility per use case
- Clear service boundaries
- Proper DTO usage for data transfer

**Infrastructure Independence**
- SQLite can be swapped for PostgreSQL without domain changes
- Repository implementations cleanly separated
- Logging abstracted through ILogger interface

### 2.2 ✅ Comprehensive Interface Support

**Four API Interfaces**
1. **GraphQL API** (Primary)
   - Complete schema with 20+ types
   - 8 query resolver classes
   - 9 mutation resolver classes
   - Field-level resolvers for nested data
   - Subscription support for real-time updates

2. **REST API** (Specialized Operations)
   - 5 controller classes
   - HTTP routes for specific operations
   - Response helpers and error handling
   - Complements GraphQL for certain use cases

3. **MCP Protocol** (AI Integration)
   - JSON-RPC 2.0 compliance
   - Global MCP server at `/mcp`
   - Table-specific servers at `/sub/:tableId/mcp`
   - 27 registered MCP tools
   - Dynamic tool generation from templates

4. **CLI Interface** (Developer Tools)
   - Command-line utilities
   - Script execution support

### 2.3 ✅ Robust Testing Infrastructure

**Test Categories (67 files, 32K LOC)**
- **Unit Tests** (12 files): Individual services, utilities
- **Integration Tests** (7 files): Component interaction, API contracts
- **E2E Tests** (4 files): User workflows, full system
- **Comprehensive Tests** (10 files): Features, performance, security
- **Contract Tests** (6 files): Protocol compliance, interfaces
- **Test Fixtures** (13 helpers): Reusable test infrastructure

**Test Quality Features**
- Database isolation patterns
- Parallel test execution support
- Custom test runner for flexibility
- Comprehensive fixture library

### 2.4 ✅ Comprehensive Documentation

**71 Documentation Files**
- Complete API reference with examples
- Architecture and design patterns
- Template system guide
- Development environment setup
- Testing strategies
- AI metadata generation guides
- MCP protocol documentation
- Quick start guides

### 2.5 ✅ Advanced Features

**Template System**
- Parameterized GraphQL query templates
- Template execution engine (ExecuteTemplateWithGraphQL)
- Template import/export
- Usage analytics and optimization
- AI-friendly template management

**Batch Operations**
- Mass operations with transaction safety
- Schema validation
- Progress monitoring
- Rollback support

**AI Integration**
- Schema introspection service
- AI metadata generation
- Schema discovery for dynamic templates
- Template validation and sync

**Graph Database**
- SQLite-backed storage with relationships
- High-performance traversal algorithms
- Quality metrics and confidence scoring
- Shortest path finding

### 2.6 ✅ Type Safety & Code Quality

**TypeScript Configuration**
- Strict mode enabled
- Domain-specific type aliases (TableId, NodeId, etc.)
- DTO types for API contracts
- GraphQL scalar types

**Code Quality Tools**
- Biome for formatting and linting
- TypeScript type checking
- GraphQL schema validation
- Automated quality checks

### 2.7 ✅ Dependency Injection System

**Custom DIContainer**
- Type-safe service registration
- Modular configuration via modules
- Service tokens for compile-time checking
- Singleton and transient scopes
- Circular dependency detection

---

## 3. Identified Structural Issues & Inconsistencies

### 3.1 ⚠️ Scattered Supporting Directories (Priority 1)

**Issue**: Root-level directories with unclear purpose

```
/home/user/bun-graph-db/
├── /core/                      # Mostly empty, conflicts with /src/core
├── /config/                    # Only 1 file (core-templates.json)
├── /utils/                     # Utility functions scattered
├── /samples/                   # Mix of demos, fixtures, examples
├── /scripts/                   # Mix of utility scripts
├── /templates/                 # Only 1 subdirectory
├── /specs/                     # Specification management
├── /claudedocs/                # Claude documentation output
├── /tmp/                       # Temporary files (should be .gitignored)
├── /exported-templates/        # Generated template exports
└── /reports/                   # Reports & analysis
```

**Impact**:
- Navigation confusion for new developers
- Potential file conflicts (e.g., `/core` vs `/src/core`)
- Unclear where to place new utility files
- Mix of generated and source files

**Recommendation**: Consolidate into `/src` or clear categories

### 3.2 ⚠️ Configuration File Locations (Priority 1)

**Issue**: Configuration loaded from multiple locations

```
Configuration sources:
├── /src/config/                # Config module (separate)
├── /src/core/config/           # Another config location
├── /config/core-templates.json # Root-level config file
├── biome.json                  # Biome config (good)
├── tsconfig.json               # TypeScript config (good)
├── codegen.yml                 # GraphQL codegen (good)
└── .gql-config.json            # GraphQL config (good)
```

**Impact**:
- Confusion about which config file to modify
- Potential inconsistency in config management
- Hard to understand configuration hierarchy

**Recommendation**: Single configuration source at `/src/core/config/`

### 3.3 ⚠️ Repository Implementation Duplication (Priority 1)

**Issue**: 12 SQLite repository files with nearly identical CRUD patterns

```typescript
// Pattern repeated in each repository:
- save(entity): Promise<Entity>
- findById(id): Promise<Entity | null>
- findAll(options?): Promise<PaginatedResult<Entity>>
- delete(id): Promise<void>
- exists(identifier): Promise<boolean>
- count(): Promise<number>
- Batch operations: saveMany(), findByIds()
```

**Current Implementation**:
- 12 repository files (~200 LOC each)
- ~2,400 total lines of mostly duplicated code
- Updates require changes in 12 places

**Impact**:
- Hard to maintain consistency
- Bug fixes need to be applied to multiple files
- New features (e.g., soft delete) require 12 updates

**Recommendation**: Create abstract `BaseSqliteRepository<T>` class

**Estimated Code Reduction**: 30-40% (800-1,000 LOC)

### 3.4 ⚠️ GraphQL Resolver Organization (Priority 2)

**Issue**: Unclear distinction between resolver layers

```
Three levels of resolver definition:
├── /src/presentation/graphql/queries/         # Query resolvers (8 files)
├── /src/presentation/graphql/mutations/       # Mutation resolvers (9 files)
├── /src/presentation/graphql/resolvers/       # Top-level resolvers (9 files)
└── /src/presentation/graphql/field-resolvers/ # Field resolvers (8 files)

Total: 34 resolver-related files
```

**Impact**:
- Hard to find where specific resolver is implemented
- Unclear which file to modify for a field
- Duplication in resolver logic

**Current Structure Example**:
```
Node entity resolvers scattered across:
- /queries/NodeQueries.ts              # Query operations
- /mutations/NodeMutations.ts          # Mutation operations
- /resolvers/NodeResolver.ts           # Top-level resolver
- /field-resolvers/NodeFieldResolvers.ts  # Field resolvers
```

**Recommendation**: Consolidate per entity

**Proposed Structure**:
```
/src/presentation/graphql/resolvers/
├── NodeResolver.ts         # All Node operations in one file
│   ├── Query operations
│   ├── Mutation operations
│   └── Field resolvers
├── TableResolver.ts        # All Table operations
├── QueryTemplateResolver.ts  # All Template operations
└── [6 more entity resolvers]

Result: 9 files instead of 34
```

### 3.5 ⚠️ Test File Organization (Priority 2)

**Issue**: Test files scattered with overlapping categories

```
Test organization:
├── /tests/unit/                    # Unit tests ✓
├── /tests/integration/             # Integration tests ✓
├── /tests/e2e/                     # E2E tests ✓
├── /tests/comprehensive/           # Comprehensive tests ⚠️
├── /tests/contract/                # Contract tests ✓
├── /tests/*.test.ts                # 3+ isolated tests at root ⚠️
├── /tests/system-queries/          # System query tests ⚠️
├── /tests/unified-template-execution/  # Template tests ⚠️
└── /tests/template-indexing/       # Template tests ⚠️

Plus duplicate fixtures:
├── /tests/fixtures/                # Test fixtures
├── /samples/fixtures/              # Sample fixtures ⚠️
└── /tests/system-queries/fixtures/ # More fixtures ⚠️
```

**Impact**:
- Unclear which test category to use for new tests
- Duplicate fixture code
- Hard to run specific test suites

**Recommendation**: Consolidate into standard categories

### 3.6 ⚠️ Models & Presentation DTOs (Priority 2)

**Issue**: Multiple DTO locations with unclear separation

```
DTO locations:
├── /src/models/                # Mostly empty ⚠️
├── /src/presentation/dto/      # Presentation DTOs
└── /src/application/dtos/      # Application DTOs

Question: Which DTO should be used where?
```

**Impact**:
- Confusion about DTO placement
- Potential duplication of DTO definitions
- Unclear data transformation boundaries

**Recommendation**: Single DTO location per layer

### 3.7 ⚠️ Use Case File Naming (Priority 3)

**Issue**: Inconsistent use case naming patterns

```
Current naming:
├── CreateTable.ts              # File name (no suffix)
│   └── class CreateTableUseCase  # Class name (has suffix)
├── CreateNode.ts
│   └── class CreateNodeUseCase
├── ExecuteTemplateWithGraphQL.ts  # Long descriptive name
│   └── class ExecuteTemplateWithGraphQLUseCase
```

**Impact**:
- Hard to distinguish use case files from other files
- Inconsistent naming makes navigation harder

**Recommendation**: All files should be named `*UseCase.ts`

**Proposed**:
```
├── CreateTableUseCase.ts
│   └── class CreateTableUseCase
├── CreateNodeUseCase.ts
│   └── class CreateNodeUseCase
├── ExecuteTemplateWithGraphQLUseCase.ts
│   └── class ExecuteTemplateWithGraphQLUseCase
```

### 3.8 ⚠️ Unused/Empty Directories (Priority 3)

**Issue**: Several directories are mostly empty or unused

```
Empty/nearly empty directories:
├── /src/models/                # Empty
├── /core/                      # Empty (duplicate of /src/core)
├── /src/config/                # Only 1 file
├── /templates/                 # Only scripts subdirectory
└── /tmp/                       # Temporary files (should be .gitignored)
```

**Impact**:
- Repository clutter
- Confusion about purpose
- Potential for incorrect file placement

**Recommendation**: Remove or repurpose empty directories

### 3.9 ⚠️ Documentation Scattered (Priority 3)

**Issue**: Documentation in multiple locations

```
Documentation locations:
├── /docs/                      # Main documentation (71 files) ✓
├── /samples/FOLDER-STRUCTURE.md  # Demo structure (should be in docs)
├── /scripts/README.md          # Scripts guide (should be in docs)
├── /samples/README.md          # Sample guide (should be in docs)
├── CLAUDE.md                   # Project instructions (at root) ✓
└── README.md                   # Main readme (at root) ✓
```

**Impact**:
- Hard to find specific documentation
- Duplicate information
- Maintenance overhead

**Recommendation**: Consolidate into `/docs/`

### 3.10 ⚠️ CLI and Utilities Organization (Priority 3)

**Issue**: CLI and utility files scattered

```
CLI/Utility locations:
├── /src/application/cli/       # CLI interface (incomplete)
├── /src/utils/                 # General utilities
├── /utils/                     # Root-level utilities
├── /scripts/                   # Utility scripts
└── /samples/utils/             # Sample utilities
```

**Impact**:
- Hard to extend CLI functionality
- Duplicate utility functions
- Unclear which utilities are for what purpose

**Recommendation**: Consolidate utilities

---

## 4. Restructuring Plan

### Phase 1: Quick Wins (High Impact, Low Effort) - 1-2 Days

#### Task 1.1: Clean Up Root-Level Directories

**Current State**:
```
/home/user/bun-graph-db/
├── /core/                      # Empty, conflicts with /src/core
├── /config/                    # Only 1 file
├── /utils/                     # Scattered utilities
├── /tmp/                       # Temporary files
└── /exported-templates/        # Generated files
```

**Actions**:
1. **Move `/core` contents** → `/src/core/legacy/` (if any content exists)
2. **Delete `/core`** if completely empty
3. **Move `/config/core-templates.json`** → `/src/core/config/core-templates.json`
4. **Delete `/config` directory**
5. **Move `/utils/*`** → `/src/utils/`
6. **Add `/tmp` to `.gitignore`** (remove from repository)
7. **Add `/exported-templates` to `.gitignore`** (generated files)

**Commands**:
```bash
# Move core templates config
mkdir -p src/core/config
mv config/core-templates.json src/core/config/

# Move root utils to src
mv utils/* src/utils/ 2>/dev/null || true

# Clean up
rmdir core 2>/dev/null || true
rmdir config 2>/dev/null || true
rmdir utils 2>/dev/null || true

# Add to .gitignore
echo "/tmp/" >> .gitignore
echo "/exported-templates/" >> .gitignore
```

**Expected Outcome**:
- Cleaner root directory
- No name conflicts
- Clear separation of source and generated files

#### Task 1.2: Consolidate Test Fixtures

**Current State**:
```
Test fixtures scattered:
├── /tests/fixtures/
├── /samples/fixtures/
└── /tests/system-queries/fixtures/
```

**Actions**:
1. **Keep only `/tests/fixtures/`**
2. **Move `/samples/fixtures/*`** → `/tests/fixtures/samples/`
3. **Move `/tests/system-queries/fixtures/*`** → `/tests/fixtures/system-queries/`

**Commands**:
```bash
# Create destination directories
mkdir -p tests/fixtures/samples
mkdir -p tests/fixtures/system-queries

# Move sample fixtures
mv samples/fixtures/* tests/fixtures/samples/ 2>/dev/null || true

# Move system-queries fixtures
mv tests/system-queries/fixtures/* tests/fixtures/system-queries/ 2>/dev/null || true

# Clean up empty directories
rmdir samples/fixtures 2>/dev/null || true
rmdir tests/system-queries/fixtures 2>/dev/null || true
```

**Expected Outcome**:
- Single source of truth for test fixtures
- Clear organization by fixture type
- Easier to find and reuse fixtures

#### Task 1.3: Consolidate Documentation

**Current State**:
```
Documentation scattered:
├── /docs/                      # Main docs
├── /samples/FOLDER-STRUCTURE.md
├── /samples/README.md
└── /scripts/README.md
```

**Actions**:
1. **Move `/samples/FOLDER-STRUCTURE.md`** → `/docs/development/folder-structure.md`
2. **Move `/samples/README.md`** → `/docs/samples/README.md`
3. **Move `/scripts/README.md`** → `/docs/tooling/scripts.md`
4. **Update cross-references** in moved files

**Commands**:
```bash
# Move documentation files
mkdir -p docs/development
mkdir -p docs/samples
mkdir -p docs/tooling

mv samples/FOLDER-STRUCTURE.md docs/development/folder-structure.md
mv samples/README.md docs/samples/README.md
mv scripts/README.md docs/tooling/scripts.md
```

**Expected Outcome**:
- All documentation in `/docs/`
- Clear documentation structure
- Easier to maintain and find docs

---

### Phase 2: Code Quality Improvements (Moderate Effort) - 3-5 Days

#### Task 2.1: Create Base Repository Class

**Goal**: Reduce code duplication in SQLite repositories by 30-40%

**Current Duplication**:
- 12 repository files with nearly identical CRUD code
- ~2,400 lines of duplicated code
- Each repository implements: save, findById, findAll, delete, exists, count, batch operations

**Implementation**:

**Step 1**: Create `BaseSqliteRepository.ts`

```typescript
// src/infrastructure/database/sqlite/BaseSqliteRepository.ts

export abstract class BaseSqliteRepository<T, TId extends string> {
  constructor(
    protected connection: SqliteConnection,
    protected tableName: string
  ) {}

  // Common CRUD operations
  async save(entity: T): Promise<T> {
    const query = this.buildInsertQuery(entity);
    const result = await this.connection.execute(query.sql, query.params);
    return this.mapRowToEntity(result);
  }

  async findById(id: TId): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const result = await this.connection.execute(query, [id]);
    return result ? this.mapRowToEntity(result) : null;
  }

  async findAll(options?: PaginationOptions): Promise<PaginatedResult<T>> {
    const query = this.buildSelectQuery(options);
    const results = await this.connection.execute(query.sql, query.params);
    return {
      items: results.map(row => this.mapRowToEntity(row)),
      total: await this.count(),
      ...options
    };
  }

  async delete(id: TId): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.connection.execute(query, [id]);
  }

  async exists(id: TId): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const result = await this.connection.execute(query, [id]);
    return result !== null;
  }

  async count(filter?: any): Promise<number> {
    const query = this.buildCountQuery(filter);
    const result = await this.connection.execute(query.sql, query.params);
    return result.count;
  }

  // Batch operations
  async saveMany(entities: T[]): Promise<T[]> {
    // Transaction support
    return this.connection.transaction(() => {
      return Promise.all(entities.map(e => this.save(e)));
    });
  }

  async findByIds(ids: TId[]): Promise<T[]> {
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`;
    const results = await this.connection.execute(query, ids);
    return results.map(row => this.mapRowToEntity(row));
  }

  // Abstract methods to be implemented by subclasses
  protected abstract mapRowToEntity(row: any): T;
  protected abstract buildInsertQuery(entity: T): { sql: string; params: any[] };
  protected abstract buildUpdateQuery(entity: T): { sql: string; params: any[] };
  protected abstract buildSelectQuery(options?: any): { sql: string; params: any[] };
  protected abstract buildCountQuery(filter?: any): { sql: string; params: any[] };
}
```

**Step 2**: Refactor existing repositories to extend base class

```typescript
// src/infrastructure/database/sqlite/SqliteTableRepository.ts

export class SqliteTableRepository
  extends BaseSqliteRepository<Table, TableId>
  implements ITableRepository
{
  constructor(connection: SqliteConnection) {
    super(connection, 'tables');
  }

  // Only implement entity-specific logic
  protected mapRowToEntity(row: any): Table {
    return Table.create(
      row.identifier,
      row.description,
      row.id,
      row.created_at,
      row.updated_at
    );
  }

  protected buildInsertQuery(table: Table): { sql: string; params: any[] } {
    return {
      sql: `INSERT INTO tables (id, identifier, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        table.getId(),
        table.getIdentifier(),
        table.getDescription(),
        table.getCreatedAt(),
        table.getUpdatedAt()
      ]
    };
  }

  // ... implement other abstract methods

  // Entity-specific operations (not in base class)
  async findByIdentifier(identifier: string): Promise<Table | null> {
    const query = `SELECT * FROM tables WHERE identifier = ?`;
    const result = await this.connection.execute(query, [identifier]);
    return result ? this.mapRowToEntity(result) : null;
  }
}
```

**Migration Strategy**:
1. Create `BaseSqliteRepository.ts` with common operations
2. Update one repository at a time (start with `SqliteTableRepository`)
3. Run tests after each migration
4. Repeat for all 12 repositories
5. Remove duplicated code

**Estimated Code Reduction**:
- Before: ~2,400 LOC across 12 files
- After: ~1,500 LOC (12 files + 1 base class)
- **Reduction: 900 LOC (37.5%)**

**Benefits**:
- Bug fixes in one place
- Easier to add features (e.g., soft delete, audit logging)
- Better testability
- Consistent behavior across repositories

#### Task 2.2: Consolidate GraphQL Resolvers

**Goal**: Reduce 34 resolver files to 9 entity-focused resolvers

**Current Structure**:
```
/src/presentation/graphql/
├── queries/         # 8 files (NodeQueries, TableQueries, etc.)
├── mutations/       # 9 files (NodeMutations, TableMutations, etc.)
├── resolvers/       # 9 files (NodeResolver, TableResolver, etc.)
└── field-resolvers/ # 8 files (NodeFieldResolvers, etc.)

Total: 34 files
```

**Proposed Structure**:
```
/src/presentation/graphql/resolvers/
├── NodeResolver.ts              # All Node operations
├── TableResolver.ts             # All Table operations
├── QueryTemplateResolver.ts     # All Template operations
├── AttributeResolver.ts         # All Attribute operations
├── RelationResolver.ts          # All Relation operations
├── DocResolver.ts               # All Doc operations
├── SystemResolver.ts            # System queries
├── ExportResolver.ts            # Export operations
└── TablePackageResolver.ts      # Table package operations

Total: 9 files
```

**Implementation Example**:

```typescript
// src/presentation/graphql/resolvers/NodeResolver.ts

import { BaseResolver } from './BaseResolver';

export class NodeResolver extends BaseResolver {
  constructor(
    private createNodeUseCase: CreateNodeUseCase,
    private searchNodesUseCase: SearchNodesUseCase,
    private updateNodeUseCase: UpdateNodeUseCase,
    private deleteNodeUseCase: DeleteNodeUseCase
  ) {
    super();
  }

  // ========================================
  // QUERIES
  // ========================================

  async node(parent: any, args: { id: NodeId }): Promise<NodeDto | null> {
    // Query implementation
  }

  async nodes(parent: any, args: NodesQueryArgs): Promise<NodesResult> {
    // Query implementation
  }

  async searchNodes(parent: any, args: SearchNodesArgs): Promise<SearchResult> {
    return this.searchNodesUseCase.execute(args);
  }

  // ========================================
  // MUTATIONS
  // ========================================

  async createNode(parent: any, args: CreateNodeInput): Promise<NodeResult> {
    return this.createNodeUseCase.execute(args.input);
  }

  async updateNode(parent: any, args: UpdateNodeInput): Promise<NodeResult> {
    return this.updateNodeUseCase.execute(args.input);
  }

  async deleteNode(parent: any, args: { id: NodeId }): Promise<DeleteResult> {
    return this.deleteNodeUseCase.execute(args.id);
  }

  // ========================================
  // FIELD RESOLVERS
  // ========================================

  async Node_attributes(node: NodeDto): Promise<NodeAttribute[]> {
    // Resolve Node.attributes field
  }

  async Node_table(node: NodeDto): Promise<TableDto> {
    // Resolve Node.table field
  }

  async Node_relations(node: NodeDto): Promise<Relation[]> {
    // Resolve Node.relations field
  }

  async Node_incomingRelations(node: NodeDto): Promise<Relation[]> {
    // Resolve Node.incomingRelations field
  }

  async Node_outgoingRelations(node: NodeDto): Promise<Relation[]> {
    // Resolve Node.outgoingRelations field
  }
}
```

**Migration Strategy**:
1. Create new `/src/presentation/graphql/resolvers/` directory
2. Create consolidated resolver files one at a time
3. Update `GraphQLSchemaBuilder.ts` to use new resolvers
4. Test each resolver after migration
5. Delete old resolver files when confirmed working
6. Update imports in dependent files

**Benefits**:
- Easier to find resolver logic (all Node operations in one file)
- Better cohesion (related operations together)
- Reduced file count (34 → 9 files)
- Clearer mental model for developers

#### Task 2.3: Standardize DTO Locations

**Goal**: Single DTO location per architectural layer

**Current State**:
```
DTO locations:
├── /src/models/                # Mostly empty
├── /src/presentation/dto/      # Presentation DTOs
└── /src/application/dtos/      # Application DTOs
```

**Proposed Structure**:
```
/src/application/dtos/          # Application-level DTOs (primary)
├── TableDto.ts
├── NodeDto.ts
├── AttributeDto.ts
├── RelationDto.ts
├── QueryTemplateDto.ts
├── DocDto.ts
├── [all current DTOs]

/src/presentation/http/dto/     # HTTP-specific DTOs (if needed)
├── ApiResponseDto.ts
├── HttpErrorDto.ts

# Remove /src/models/ entirely
# Remove /src/presentation/dto/
```

**Actions**:
1. **Keep `/src/application/dtos/`** as primary DTO location
2. **Move HTTP-specific DTOs** to `/src/presentation/http/dto/`
3. **Delete `/src/models/`** directory
4. **Delete `/src/presentation/dto/`** directory
5. **Update all imports** to use new locations

**Benefits**:
- Clear DTO placement rules
- No confusion about which DTO to use
- Single source of truth for data transfer

---

### Phase 3: Nice to Have Improvements (Larger Effort) - 5-7 Days

#### Task 3.1: Expand CLI Module

**Goal**: Create comprehensive CLI interface

**Current State**:
```
/src/application/cli/
└── commands/  # Incomplete implementation
```

**Proposed Structure**:
```
/src/application/cli/
├── commands/
│   ├── TableCommands.ts        # Table operations
│   ├── NodeCommands.ts         # Node operations
│   ├── TemplateCommands.ts     # Template operations
│   ├── SchemaCommands.ts       # Schema operations
│   └── SystemCommands.ts       # System utilities
│
├── CLIRunner.ts                # Command runner
├── CommandParser.ts            # Argument parser
├── HelpSystem.ts               # Help/usage info
└── AutoComplete.ts             # Shell completion
```

**Features to Implement**:
- Command-line argument parsing
- Help system with usage examples
- Interactive mode
- Shell auto-completion
- Output formatting (JSON, table, CSV)
- Piping support

**Example Commands**:
```bash
# Table operations
bun-graph-db table create --identifier my-table --description "My table"
bun-graph-db table list
bun-graph-db table show --id 123

# Node operations
bun-graph-db node create --table-id 123 --title "My node" --content "Content"
bun-graph-db node search --table-id 123 --query "search term"

# Template operations
bun-graph-db template list
bun-graph-db template execute --identifier my-template --vars '{"param": "value"}'

# Schema operations
bun-graph-db schema export --table-id 123 --output schema.json
bun-graph-db schema import --input schema.json
```

#### Task 3.2: Refactor Use Case Naming

**Goal**: Consistent naming pattern for all use case files

**Current Naming**:
```
/src/application/use-cases/
├── tables/
│   ├── CreateTable.ts              # No suffix
│   ├── DeleteTable.ts              # No suffix
│   └── GetTableDocs.ts             # No suffix
├── nodes/
│   ├── CreateNode.ts               # No suffix
│   └── SearchNodes.ts              # No suffix
```

**Proposed Naming**:
```
/src/application/use-cases/
├── tables/
│   ├── CreateTableUseCase.ts       # UseCase suffix
│   ├── DeleteTableUseCase.ts       # UseCase suffix
│   └── GetTableDocsUseCase.ts      # UseCase suffix
├── nodes/
│   ├── CreateNodeUseCase.ts        # UseCase suffix
│   └── SearchNodesUseCase.ts       # UseCase suffix
```

**Migration Strategy**:
1. **Rename files** one directory at a time
2. **Update imports** in dependent files
3. **Run tests** after each directory
4. **Update documentation** to reflect new names

**Benefits**:
- Clear identification of use case files
- Consistent naming across project
- Easier navigation and search

#### Task 3.3: Consolidate Utilities

**Goal**: Organize utilities by purpose

**Current State**:
```
Utilities scattered:
├── /src/utils/                 # Source utilities
├── /utils/                     # Root utilities
├── /scripts/                   # Utility scripts
└── /samples/utils/             # Sample utilities
```

**Proposed Structure**:
```
/src/utils/
├── graphql/                    # GraphQL utilities
│   └── GraphQLParser.ts
├── database/                   # Database utilities
│   └── ConnectionPool.ts
├── validation/                 # Validation utilities
│   └── SchemaValidator.ts
├── formatting/                 # Formatting utilities
│   └── ResponseFormatter.ts
└── testing/                    # Test utilities
    └── TestHelpers.ts

/scripts/                       # Build/deployment scripts
├── build/
├── deploy/
└── maintenance/

/samples/utils/                 # Sample utilities (keep)
└── [example utilities]
```

**Actions**:
1. **Move `/utils/*`** → `/src/utils/` (categorize by purpose)
2. **Organize `/scripts/`** by script type
3. **Keep `/samples/utils/`** for example code
4. **Update imports** throughout codebase

---

## 5. Implementation Checklist

### Phase 1: Quick Wins (1-2 Days)

- [ ] **Task 1.1**: Clean up root-level directories
  - [ ] Move core templates config
  - [ ] Move root utils to src
  - [ ] Delete empty directories
  - [ ] Update .gitignore

- [ ] **Task 1.2**: Consolidate test fixtures
  - [ ] Move sample fixtures
  - [ ] Move system-query fixtures
  - [ ] Update test imports

- [ ] **Task 1.3**: Consolidate documentation
  - [ ] Move documentation files
  - [ ] Update cross-references
  - [ ] Create docs index

### Phase 2: Code Quality (3-5 Days)

- [ ] **Task 2.1**: Create base repository class
  - [ ] Create BaseSqliteRepository
  - [ ] Refactor SqliteTableRepository
  - [ ] Refactor SqliteNodeRepository
  - [ ] Refactor remaining 10 repositories
  - [ ] Run full test suite

- [ ] **Task 2.2**: Consolidate GraphQL resolvers
  - [ ] Create NodeResolver
  - [ ] Create TableResolver
  - [ ] Create remaining 7 resolvers
  - [ ] Update GraphQLSchemaBuilder
  - [ ] Test GraphQL API
  - [ ] Delete old resolver files

- [ ] **Task 2.3**: Standardize DTO locations
  - [ ] Move DTOs to standard locations
  - [ ] Update imports
  - [ ] Delete duplicate DTO directories

### Phase 3: Nice to Have (5-7 Days)

- [ ] **Task 3.1**: Expand CLI module
  - [ ] Create command classes
  - [ ] Implement command parser
  - [ ] Add help system
  - [ ] Create shell completion

- [ ] **Task 3.2**: Refactor use case naming
  - [ ] Rename use case files
  - [ ] Update imports
  - [ ] Update documentation

- [ ] **Task 3.3**: Consolidate utilities
  - [ ] Organize utilities by purpose
  - [ ] Update imports
  - [ ] Document utility functions

---

## 6. Risk Assessment

### Low Risk Tasks (Safe to Execute)
- ✅ Consolidating test fixtures
- ✅ Moving documentation files
- ✅ Cleaning up empty directories
- ✅ Updating .gitignore

### Medium Risk Tasks (Requires Testing)
- ⚠️ Creating base repository class (requires comprehensive testing)
- ⚠️ Consolidating GraphQL resolvers (requires API testing)
- ⚠️ Standardizing DTO locations (requires import updates)

### High Risk Tasks (Requires Careful Planning)
- 🚨 Renaming use case files (affects many imports)
- 🚨 Consolidating utilities (widespread impact)

### Risk Mitigation Strategies
1. **Create feature branch** for each phase
2. **Run full test suite** after each task
3. **Commit incrementally** for easy rollback
4. **Update documentation** as changes are made
5. **Get code review** before merging to main

---

## 7. Expected Benefits

### Immediate Benefits (Phase 1)
- **Cleaner repository structure** - easier navigation
- **Reduced confusion** - clear file organization
- **Better documentation discoverability** - single docs location

### Medium-Term Benefits (Phase 2)
- **30-40% code reduction** in repository layer
- **Easier maintenance** - fewer files to manage
- **Better testability** - base classes easier to test
- **Improved developer experience** - clearer structure

### Long-Term Benefits (Phase 3)
- **Enhanced CLI** - better developer productivity
- **Consistent naming** - easier code search
- **Organized utilities** - better reusability

---

## 8. Maintenance Guidelines (Post-Restructuring)

### Directory Structure Rules

1. **Source Code Organization**
   - All source code in `/src/`
   - Layer-based organization: domain, application, presentation, infrastructure
   - Entity-based subdirectories in use cases

2. **Test Organization**
   - All tests in `/tests/`
   - Category-based subdirectories: unit, integration, e2e, contract
   - All fixtures in `/tests/fixtures/`

3. **Documentation Organization**
   - All documentation in `/docs/`
   - Category-based subdirectories: api, architecture, guides, development

4. **Configuration**
   - Application config in `/src/core/config/`
   - Tool config at root level (biome.json, tsconfig.json, etc.)

### Naming Conventions

1. **Files**
   - Use case files: `*UseCase.ts`
   - Repository interfaces: `I*Repository.ts`
   - Repository implementations: `Sqlite*Repository.ts`
   - Resolvers: `*Resolver.ts`
   - DTOs: `*Dto.ts`

2. **Directories**
   - Use plural for collections: `/entities/`, `/repositories/`
   - Use singular for layers: `/domain/`, `/application/`
   - Use kebab-case for multi-word: `/use-cases/`, `/field-resolvers/`

### Code Quality Standards

1. **DRY Principle**
   - Use base classes for common patterns
   - Extract shared logic to utilities
   - Reuse DTOs across layers

2. **Single Responsibility**
   - One entity per resolver file
   - One concern per use case
   - Clear separation of layers

3. **Dependency Management**
   - Use dependency injection
   - Depend on interfaces, not implementations
   - Keep layers independent

---

## 9. Success Metrics

### Code Quality Metrics
- **Code duplication**: Reduce by 30-40% in repository layer
- **File count**: Reduce resolver files from 34 to 9
- **Test coverage**: Maintain >80% coverage
- **Type safety**: 100% TypeScript strict mode

### Developer Experience Metrics
- **Time to find code**: Reduce by 50% (measured via developer survey)
- **Onboarding time**: Reduce by 30% for new developers
- **Build time**: Maintain or improve current build time
- **Test execution time**: Maintain or improve current test time

### Maintainability Metrics
- **Bug fix time**: Reduce by 20% (fewer places to update)
- **Feature implementation time**: Reduce by 15% (clearer structure)
- **Documentation accuracy**: 100% up-to-date
- **Code review time**: Reduce by 25% (easier to understand)

---

## 10. Conclusion

The bun-graph-db codebase has **excellent architectural foundations** with:
- Clean DDD and Clean Architecture principles
- Comprehensive testing infrastructure
- Production-ready quality and features

The identified structural issues are **minor and non-critical**, but addressing them will:
- Improve developer experience significantly
- Reduce maintenance burden long-term
- Make the codebase more accessible to new developers
- Reduce code duplication by 30-40%

**Recommended Approach**:
1. Start with **Phase 1 (Quick Wins)** - low risk, high impact
2. Proceed to **Phase 2 (Code Quality)** - medium risk, high value
3. Consider **Phase 3 (Nice to Have)** based on team priorities

**Total Estimated Effort**: 9-14 days across all phases

**Priority Recommendation**: Execute Phase 1 immediately, Phase 2 within 2-4 weeks, Phase 3 as time permits.

---

**Document Status**: ✅ Complete
**Next Steps**: Review plan with team, create feature branches, begin Phase 1 implementation
**Contact**: Generated by Claude Code analysis agent
