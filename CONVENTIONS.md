# 📐 Development Conventions

> **Framework**: Bun + TypeScript + GraphQL + Biome  
> **Architecture**: Hexagonal Architecture with Domain-Driven Design  
> **Target**: GraphQL → MCP conversion via [mcp-graphql](https://github.com/blurrah/mcp-graphql)

## 🏗️ Architecture Principles

### Hexagonal Architecture (Ports & Adapters)

**Core Concept**: Business logic at the center, isolated from external concerns through ports and adapters.

```
┌─────────────────────────────────────────┐
│             Infrastructure             │
│  ┌─────────────────────────────────┐   │
│  │           Adapters              │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │         Ports           │   │   │
│  │  │  ┌─────────────────┐   │   │   │
│  │  │  │   Domain Core   │   │   │   │
│  │  │  │   (Business     │   │   │   │
│  │  │  │     Logic)      │   │   │   │
│  │  │  └─────────────────┘   │   │   │
│  │  └─────────────────────────┘   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Layer Responsibilities

**Domain Layer** (Core):
- Business entities and value objects
- Domain services and business rules
- No external dependencies

**Application Layer** (Use Cases):
- Application services and use cases
- Orchestrates domain objects
- Defines ports (interfaces)

**Infrastructure Layer** (Adapters):
- Database implementations
- External API clients
- GraphQL resolvers and schemas
- Logging, monitoring, caching

**Presentation Layer** (Controllers):
- GraphQL entry points
- Request/response handling
- Input validation and transformation

## 📁 Project Structure

```
src/
├── domain/                    # 🎯 Domain Layer (Core Business Logic)
│   ├── entities/             # Domain entities
│   │   ├── Table.ts         # Core business entities
│   │   ├── Node.ts
│   │   ├── Attribute.ts
│   │   └── Relation.ts
│   ├── value-objects/        # Value objects
│   │   ├── TableId.ts
│   │   ├── NodeId.ts
│   │   └── AttributeType.ts
│   ├── repositories/         # Repository interfaces (ports)
│   │   ├── ITableRepository.ts
│   │   ├── INodeRepository.ts
│   │   └── IAttributeRepository.ts
│   ├── services/             # Domain services
│   │   ├── ValidationService.ts
│   │   ├── RelationService.ts
│   │   └── SchemaService.ts
│   └── events/               # Domain events
│       ├── TableCreated.ts
│       └── NodeUpdated.ts
│
├── application/              # 🎮 Application Layer (Use Cases)
│   ├── use-cases/           # Application use cases
│   │   ├── tables/         # Table-related use cases
│   │   │   ├── CreateTable.ts
│   │   │   ├── GetTable.ts
│   │   │   └── UpdateTable.ts
│   │   ├── nodes/          # Node-related use cases
│   │   │   ├── CreateNode.ts
│   │   │   ├── GetNode.ts
│   │   │   └── SearchNodes.ts
│   │   └── schema/         # Schema-related use cases
│   │       ├── ExportSchema.ts
│   │       └── ValidateData.ts
│   ├── ports/              # Application ports (interfaces)
│   │   ├── IEventBus.ts
│   │   ├── ILogger.ts
│   │   └── ICacheService.ts
│   └── dtos/               # Data Transfer Objects
│       ├── TableDto.ts
│       ├── NodeDto.ts
│       └── SearchDto.ts
│
├── infrastructure/          # 🔧 Infrastructure Layer (Adapters)
│   ├── database/           # Database adapters
│   │   ├── sqlite/        # SQLite implementation
│   │   │   ├── SqliteTableRepository.ts
│   │   │   ├── SqliteNodeRepository.ts
│   │   │   ├── SqliteConnection.ts
│   │   │   └── migrations/
│   │   └── schemas/       # Database schemas
│   │       └── schema.sql
│   ├── cache/             # Caching adapters
│   │   ├── RedisCache.ts
│   │   └── MemoryCache.ts
│   ├── logging/           # Logging adapters
│   │   ├── ConsoleLogger.ts
│   │   └── FileLogger.ts
│   └── external/          # External service adapters
│       └── ReferenceResolver.ts
│
├── presentation/           # 🎨 Presentation Layer (GraphQL)
│   ├── graphql/           # GraphQL presentation
│   │   ├── schemas/       # GraphQL schemas
│   │   │   ├── table.graphql
│   │   │   ├── node.graphql
│   │   │   ├── attribute.graphql
│   │   │   └── relation.graphql
│   │   ├── resolvers/     # GraphQL resolvers
│   │   │   ├── TableResolver.ts
│   │   │   ├── NodeResolver.ts
│   │   │   ├── AttributeResolver.ts
│   │   │   └── RelationResolver.ts
│   │   └── middleware/    # GraphQL middleware
│   │       ├── AuthMiddleware.ts
│   │       └── ValidationMiddleware.ts
│   └── http/              # HTTP adapters
│       ├── controllers/   # HTTP controllers (if needed)
│       └── middleware/    # HTTP middleware
│
├── shared/                # 🔄 Shared Utilities
│   ├── types/            # Shared type definitions
│   │   ├── common.ts
│   │   └── graphql-types.ts
│   ├── utils/            # Utility functions
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── error-handling.ts
│   ├── constants/        # Application constants
│   │   ├── attributeTypes.ts
│   │   └── errorCodes.ts
│   └── exceptions/       # Custom exceptions
│       ├── DomainException.ts
│       ├── ValidationException.ts
│       └── NotFoundExceptin.ts
│
└── config/               # ⚙️ Configuration
    ├── database.ts       # Database configuration
    ├── graphql.ts        # GraphQL configuration
    └── logger.ts         # Logger configuration
```

## 🎯 Domain-Driven Design

### Entity Design Pattern

```typescript
// Domain Entity Example
export class Table {
  private constructor(
    private readonly _id: TableId,
    private readonly _identifier: string,
    private _description: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Factory method
  static create(identifier: string, description?: string): Table {
    return new Table(
      TableId.generate(),
      identifier,
      description || null,
      new Date(),
      new Date()
    )
  }

  // Business methods
  updateDescription(newDescription: string): void {
    if (newDescription.trim().length === 0) {
      throw new DomainException('Description cannot be empty')
    }
    this._description = newDescription
    this._updatedAt = new Date()
  }

  // Getters (no direct property access)
  get id(): TableId { return this._id }
  get identifier(): string { return this._identifier }
  get description(): string | null { return this._description }
  get createdAt(): Date { return this._createdAt }
  get updatedAt(): Date { return this._updatedAt }
}
```

### Repository Pattern

```typescript
// Port (Interface)
export interface ITableRepository {
  save(table: Table): Promise<void>
  findById(id: TableId): Promise<Table | null>
  findByIdentifier(identifier: string): Promise<Table | null>
  findAll(): Promise<Table[]>
  delete(id: TableId): Promise<void>
}

// Adapter (Implementation)
export class SqliteTableRepository implements ITableRepository {
  constructor(private db: Database) {}

  async save(table: Table): Promise<void> {
    const query = `
      INSERT INTO tables (id, identifier, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        description = excluded.description,
        updated_at = excluded.updated_at
    `
    
    await this.db.run(query, [
      table.id.value,
      table.identifier,
      table.description,
      table.createdAt.toISOString(),
      table.updatedAt.toISOString()
    ])
  }
}
```

### Use Case Pattern

```typescript
export class CreateTableUseCase {
  constructor(
    private tableRepository: ITableRepository,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  async execute(command: CreateTableCommand): Promise<TableDto> {
    this.logger.info('Creating table', { identifier: command.identifier })

    // Check if table already exists
    const existing = await this.tableRepository.findByIdentifier(command.identifier)
    if (existing) {
      throw new ValidationException(`Table '${command.identifier}' already exists`)
    }

    // Create domain entity
    const table = Table.create(command.identifier, command.description)

    // Save to repository
    await this.tableRepository.save(table)

    // Publish domain event
    await this.eventBus.publish(new TableCreatedEvent(table.id, table.identifier))

    this.logger.info('Table created successfully', { id: table.id.value })

    // Return DTO
    return TableDto.fromEntity(table)
  }
}
```

## 🔒 TypeScript Conventions

### Strict Type Safety

```typescript
// Use strict types, avoid 'any'
interface StrictInterface {
  id: string
  name: string
  optional?: number
}

// Use branded types for domain identifiers
export type TableId = string & { readonly brand: unique symbol }
export type NodeId = string & { readonly brand: unique symbol }

// Use discriminated unions for type safety
type AttributeValue = 
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: Date }
```

### Error Handling

```typescript
// Use Result pattern for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// Example usage
async function createTable(identifier: string): Promise<Result<Table, ValidationError>> {
  try {
    const table = Table.create(identifier)
    await this.repository.save(table)
    return { success: true, data: table }
  } catch (error) {
    return { success: false, error: new ValidationError('Failed to create table') }
  }
}
```

### Async/Await Conventions

```typescript
// Always use async/await, not Promises
async function good(): Promise<string> {
  const result = await someAsyncOperation()
  return result.toString()
}

// Avoid promise chains
function bad(): Promise<string> {
  return someAsyncOperation()
    .then(result => result.toString())
}
```

## 🔍 GraphQL Conventions

### Schema Design

```graphql
# Use clear, descriptive types
type Table {
  id: ID!
  identifier: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relationships
  attributes: [Attribute!]!
  nodes: [Node!]!
  
  # Computed fields
  nodeCount: Int!
}

# Use input types for mutations
input CreateTableInput {
  identifier: String!
  description: String
}

# Use proper error handling
type CreateTablePayload {
  table: Table
  errors: [Error!]!
}
```

### Resolver Conventions

```typescript
export class TableResolver {
  constructor(
    private createTableUseCase: CreateTableUseCase,
    private getTableUseCase: GetTableUseCase
  ) {}

  // Query resolvers
  @Query(() => [Table])
  async tables(): Promise<Table[]> {
    const result = await this.getTableUseCase.execute()
    return result.tables
  }

  @Query(() => Table, { nullable: true })
  async table(@Arg('id') id: string): Promise<Table | null> {
    const result = await this.getTableUseCase.execute({ id })
    return result.table
  }

  // Mutation resolvers
  @Mutation(() => CreateTablePayload)
  async createTable(@Arg('input') input: CreateTableInput): Promise<CreateTablePayload> {
    try {
      const table = await this.createTableUseCase.execute(input)
      return { table, errors: [] }
    } catch (error) {
      return { table: null, errors: [{ message: error.message }] }
    }
  }

  // Field resolvers
  @FieldResolver(() => [Node])
  async nodes(@Root() table: Table): Promise<Node[]> {
    // Implement lazy loading
    return this.nodeService.findByTableId(table.id)
  }
}
```

## 🧪 Testing Conventions

### Test Structure

```typescript
describe('CreateTableUseCase', () => {
  let useCase: CreateTableUseCase
  let mockRepository: jest.Mocked<ITableRepository>
  let mockEventBus: jest.Mocked<IEventBus>

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockEventBus = createMockEventBus()
    useCase = new CreateTableUseCase(mockRepository, mockEventBus, mockLogger)
  })

  describe('when creating a valid table', () => {
    it('should create and save the table', async () => {
      // Arrange
      const command = new CreateTableCommand('test-table', 'Test description')
      mockRepository.findByIdentifier.mockResolvedValue(null)

      // Act
      const result = await useCase.execute(command)

      // Assert
      expect(result.identifier).toBe('test-table')
      expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Table))
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(TableCreatedEvent))
    })
  })
})
```

## 📦 Module and Import Conventions

### Import Organization

```typescript
// 1. Node.js built-ins
import { readFileSync } from 'fs'

// 2. External libraries
import { GraphQLSchema } from 'graphql'
import { Database } from 'sqlite3'

// 3. Internal modules (domain first, then application, infrastructure)
import { Table } from '@/domain/entities/Table'
import { ITableRepository } from '@/domain/repositories/ITableRepository'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository'

// 4. Type-only imports
import type { TableDto } from '@/application/dtos/TableDto'
```

### Export Conventions

```typescript
// Use named exports primarily
export { Table } from './Table'
export { Node } from './Node'

// Use default exports for main module exports
export default class TableService {
  // ...
}

// Re-export from index files
export * from './entities'
export * from './services'
```

## 🎨 Code Style (Biome Configuration)

### Naming Conventions

```typescript
// Classes: PascalCase
class TableService {}

// Functions and variables: camelCase
const createTable = () => {}
const tableCount = 42

// Constants: UPPER_SNAKE_CASE
const MAX_TABLE_SIZE = 1000
const DEFAULT_PAGE_SIZE = 20

// Types and interfaces: PascalCase
interface TableData {}
type AttributeType = string

// Files: kebab-case
// table-service.ts
// create-table-use-case.ts
```

### Code Organization

```typescript
// Order: imports -> types -> constants -> functions -> classes -> exports
import { Database } from 'sqlite3'

type TableConfig = {
  maxSize: number
  autoSave: boolean
}

const DEFAULT_CONFIG: TableConfig = {
  maxSize: 1000,
  autoSave: true
}

function createConnection(): Database {
  // ...
}

export class TableRepository {
  // ...
}
```

## 🔄 Dependency Injection

### IoC Container Setup

```typescript
// config/container.ts
import { Container } from 'inversify'
import { TYPES } from './types'

const container = new Container()

// Bind repositories
container.bind<ITableRepository>(TYPES.TableRepository).to(SqliteTableRepository)
container.bind<INodeRepository>(TYPES.NodeRepository).to(SqliteNodeRepository)

// Bind use cases
container.bind<CreateTableUseCase>(TYPES.CreateTableUseCase).to(CreateTableUseCase)

// Bind services
container.bind<ILogger>(TYPES.Logger).to(ConsoleLogger)

export { container }
```

## 🛡️ Error Handling Strategy

### Exception Hierarchy

```typescript
abstract class BaseException extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number
}

export class DomainException extends BaseException {
  readonly code = 'DOMAIN_ERROR'
  readonly statusCode = 400
}

export class ValidationException extends BaseException {
  readonly code = 'VALIDATION_ERROR' 
  readonly statusCode = 422
}

export class NotFoundException extends BaseException {
  readonly code = 'NOT_FOUND'
  readonly statusCode = 404
}
```

## 📊 Performance Considerations

### Database Optimization

```typescript
// Use connection pooling
export class SqliteConnectionPool {
  private connections: Database[] = []
  
  async getConnection(): Promise<Database> {
    // Pool management logic
  }
}

// Use prepared statements
export class SqliteTableRepository {
  private insertStatement: Statement
  
  constructor(private db: Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO tables (id, identifier, description) VALUES (?, ?, ?)
    `)
  }
}
```

### GraphQL Optimization

```typescript
// Use DataLoader for N+1 problem
export class NodeLoader {
  private loader = new DataLoader(this.batchLoad.bind(this))
  
  async load(nodeId: string): Promise<Node> {
    return this.loader.load(nodeId)
  }
  
  private async batchLoad(nodeIds: readonly string[]): Promise<Node[]> {
    // Batch loading logic
  }
}
```

## 🎯 MCP Integration Readiness

### GraphQL Schema Design for MCP

```typescript
// Design schemas that work well with mcp-graphql conversion
type Query {
  # Simple queries work best with MCP
  table(id: ID!): Table
  tables(limit: Int = 10): [Table!]!
  
  # Complex nested queries may need special handling
  searchNodes(filter: NodeFilter!): [Node!]!
}

type Mutation {
  # Clear, atomic operations
  createTable(input: CreateTableInput!): CreateTablePayload!
  updateTable(id: ID!, input: UpdateTableInput!): UpdateTablePayload!
  deleteTable(id: ID!): DeleteTablePayload!
}
```

---

**Remember**: The goal is to create a robust GraphQL API that can be seamlessly converted to MCP tools while maintaining clean architecture and type safety.