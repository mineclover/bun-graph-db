# bun-graph-db Project Configuration

## Project Overview
**GraphQL-based Graph Database System** with TypeScript/Bun runtime implementation

### Core Domain
- **Graph Database Engine**: SQLite-backed graph storage with quality metrics
- **GraphQL API Layer**: Comprehensive schema with queries/mutations for all entities  
- **Template Query System**: AI-friendly parameterized query management
- **Metadata Management**: Node relationships with strength/confidence scoring

### Primary Use Cases
- Knowledge graph construction and traversal
- Relationship-aware data modeling
- Template-driven query execution
- Graph analytics with quality metrics

## Technical Architecture

### Architecture Pattern
**Hexagonal Architecture (Clean Architecture)** with domain-driven design principles

```
Core Layer (Pure Business Logic)
├── Database Abstraction Interfaces
├── Common Type Definitions
└── Configuration Management

Domain Layer (Business Models)
├── Entities (Node, Table, Relation, Attribute, QueryTemplate)
├── Repository Interfaces 
└── Value Objects (SearchFilter, RelationQuery)

Application Layer (Use Cases)
├── CRUD Operations per Entity
├── Search & Analytics Services
├── Template Execution Engine
└── Import/Export Utilities

Infrastructure Layer (External Concerns)
├── SQLite Repository Implementations
├── Dependency Injection Container
└── Logging & Monitoring

Presentation Layer (External Interface)
├── GraphQL Schema & Resolvers
├── Query/Mutation/Field Resolver Separation
└── Type-Safe GraphQL Integration
```

### Key Design Patterns
- **Repository Pattern**: Database abstraction with interface/implementation separation
- **Dependency Injection**: Type-safe DI container with module-based registration
- **Clean Architecture**: Strict layer dependency rules (inward dependencies only)
- **Domain-Driven Design**: Rich domain models with business logic encapsulation

## Coding Standards

### TypeScript Configuration
```typescript
// Strict Type Safety
"strict": true
"noUncheckedIndexedAccess": true
"noImplicitOverride": true

// Module System
"module": "Preserve"
"moduleResolution": "bundler"
"target": "ESNext"

// Path Aliases
"@/*": ["./src/*"]
"~/*": ["./src/*"]
```

### Code Style (Biome)
```javascript
// Formatting Rules
indentStyle: "space"
indentWidth: 2
lineWidth: 100
quoteStyle: "single"
trailingCommas: "es5"
semicolons: "asNeeded"

// Linting Policy
recommended: true
noNonNullAssertion: "off"  // Allowed for domain confidence
noExplicitAny: "off"       // Allowed for GraphQL flexibility
```

### Naming Conventions
- **Files**: PascalCase for classes, kebab-case for utilities
- **Classes**: PascalCase with descriptive domain terms
- **Interfaces**: PascalCase with 'I' prefix for ports/contracts
- **Types**: PascalCase with domain-specific suffixes (Id, Dto, etc.)
- **Constants**: SCREAMING_SNAKE_CASE
- **Variables/Functions**: camelCase with intention-revealing names

### Import Organization
```typescript
// 1. External libraries
import { makeExecutableSchema } from '@graphql-tools/schema'

// 2. Internal absolute imports (@/ or ~/)
import type { NodeId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

// 3. Relative imports
import type { INodeRepository } from '../repositories/INodeRepository.js'
```

## Project Structure Philosophy

### Layer Responsibilities
- **Core**: Framework-agnostic business abstractions
- **Domain**: Pure business logic and domain models
- **Application**: Use case orchestration and business workflows
- **Infrastructure**: External system integration and technical concerns
- **Presentation**: External interface contracts and data transformation

### Dependency Rules
- Dependencies flow inward only (Presentation → Infrastructure → Application → Domain → Core)
- No outward dependencies from inner layers
- Interfaces defined in inner layers, implemented in outer layers
- Domain layer remains pure without external dependencies

### File Organization Strategy
```
Domain-Driven Folder Structure:
├── entities/           # Core business objects
├── repositories/       # Data access contracts  
├── use-cases/         # Business operation implementations
├── queries/           # GraphQL query resolvers
├── mutations/         # GraphQL mutation resolvers
└── field-resolvers/   # GraphQL field resolvers
```

## Development Workflow

### Test Strategy
```bash
# Template Indexing Tests (GraphQL Functionality)
bun run test:templates template-indexing  # ✅ 29 tests passing (100% success rate)

# Individual test categories
bun test tests/template-indexing/graphql-parsing.test.ts     # ✅ 15 tests - GraphQL parsing
bun test tests/template-indexing/template-creation.test.ts   # ✅ 14 tests - Template creation

# Legacy test commands (broader test suites - may need updates)
bun run test              # Complete unified test suite
bun run test:bun         # Fast Bun native tests
bun run test:integration # GraphQL integration tests
bun run test:performance # Performance validation
```

### Quality Gates
- **Type Safety**: Strict TypeScript with no implicit any
- **Test Coverage**: 80%+ unit test coverage requirement
- **Performance**: <200ms API response time targets
- **Code Quality**: Biome linting with recommended rules
- **Architecture**: Layer dependency validation

### Development Commands
```bash
# Development
bun run dev              # Hot reload development server
bun run typecheck        # Type validation
bun run check           # Format + lint + fix

# Template Testing (New - GraphQL Indexing)
bun run test:templates                    # Run all available template tests
bun run test:templates template-indexing  # Run template indexing category (✅ 29 tests)
bun run test:templates --help             # Show test runner options

# Query Management  
bun run query:validate   # Template query validation
bun run query:test      # Query execution testing
bun run query:analytics # Query performance analysis
```

## Testing Environment Architecture

### ✅ Current Test Organization (Template Indexing)
- **Custom Test Runner**: `tests/test-runner.ts` with detailed reporting and performance insights
- **Organized Structure**: Category-based test organization (`template-indexing/`, `integration/`, `unit/`)
- **Rich Fixtures**: Comprehensive GraphQL query samples and template definitions
- **Status Tracking**: Clear success/failure indicators and repository compatibility status

### ✅ Working Test Categories
- **GraphQL Parsing Tests**: Complete SDL parsing, operation detection, error handling
- **Template Creation Tests**: Auto-parsing, validation, immutable patterns, legacy compatibility
- **Performance Validation**: Sub-100ms execution times, efficient complexity calculation

### 🔧 Test Development Pipeline (Needs Repository Fixes)
- **Database Integration Tests**: Schema compatibility alignment required
- **Performance Tracking Tests**: Repository interface updates needed
- **Index Optimization Tests**: Schema synchronization required

### Test Data Strategy
- **GraphQL Fixtures**: `tests/fixtures/sample-queries.ts` with comprehensive query examples
- **Template Definitions**: `tests/fixtures/test-templates.ts` with expected outcomes
- **Error Test Cases**: Malformed query handling and validation testing
- **Performance Templates**: Large datasets for scalability validation

## Integration Guidelines

### GraphQL Schema Management
- **Schema-First Design**: GraphQL schema drives implementation
- **Resolver Separation**: Query/Mutation/Field resolvers in dedicated modules
- **Type Safety**: Full TypeScript integration with GraphQL types
- **Modular Schema**: Domain-separated schema files with composition

### Database Integration
- **Repository Abstraction**: Provider-independent data access
- **SQLite Optimization**: Bun runtime optimized SQLite operations
- **Quality Metrics**: Relationship strength/confidence scoring system
- **Template Storage**: Parameterized query template persistence

### Dependency Injection
- **Type-Safe Containers**: Compile-time dependency validation
- **Module-Based Registration**: Domain-separated service registration
- **Interface-Based Design**: Dependency inversion principle adherence
- **Lifecycle Management**: Singleton/transient service lifetime control