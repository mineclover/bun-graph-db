# Bun Graph DB

A GraphQL-based graph database implementation using Bun runtime with SQLite backend, following hexagonal architecture and domain-driven design patterns.

## Features

- **GraphQL API**: Complete GraphQL schema with queries and mutations for all entities
- **Graph Database**: Node and relationship storage with quality metrics (strength/confidence)
- **Type Safety**: Comprehensive TypeScript implementation with strict typing
- **Hexagonal Architecture**: Clean separation of concerns with domain-driven design
- **Test Suite**: Comprehensive testing environment with multiple domain fixtures

## Architecture

- **Domain Layer**: Core business logic and entities
- **Application Layer**: Use cases and DTOs
- **Infrastructure Layer**: Database repositories and external adapters
- **Presentation Layer**: GraphQL resolvers and schema

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- Node.js 18+ (for compatibility)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bun-graph-db

# Install dependencies
bun install
```

### Development

```bash
# Start development server with hot reload
bun run dev

# Start production server
bun run start

# Run type checking
bun run typecheck

# Run linting and formatting
bun run check
```

### Testing

#### 🎯 **Unified Test Management**

```bash
# Run complete unified test suite (recommended)
bun run test

# List all available test suites
bun run test:list

# Generate coverage reports for all test runners
bun run test:coverage
```

#### ⚡ **Bun Native Tests** (Fast)

```bash
# Run Bun tests with coverage
bun run test:bun

# Watch mode for development  
bun run test:bun:watch

# Comprehensive GraphQL integration tests
bun run test:integration
```

#### 🧪 **Jest Integration Tests** (Legacy)

```bash
# All Jest tests
bun run test:jest

# Specific test categories
bun run test:advanced      # Advanced search tests
bun run test:performance   # Performance tests
bun run test:quality       # Relationship quality tests
```

#### 🎯 **Specific Test Execution**

```bash
# Run specific test suite
bun run test:specific bun-unit
bun run test:specific jest-performance

# Run individual test categories
bun run test:graphql       # GraphQL comprehensive tests
```

**Note**: The test environment successfully identifies real API implementation gaps and schema mismatches. Failing tests indicate areas where GraphQL resolvers need alignment with the expected schema.

## GraphQL API

The API provides comprehensive CRUD operations for:

### Core Entities

- **Tables**: Database tables/schemas
- **Nodes**: Graph nodes with content and metadata
- **Relations**: Graph edges with quality metrics
- **Attributes**: Node properties with types
- **Attribute Types**: Schema definitions for attributes
- **Relation Types**: Schema definitions for relations

### Query Examples

```graphql
# Health check
query {
  health {
    status
    timestamp
    database
    version
  }
}

# Get all tables
query {
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

# Search nodes in a table
query {
  searchNodes(input: {
    tableId: "table-id"
    query: "search term"
    limit: 10
  }) {
    nodes {
      id
      content
      description
      createdAt
    }
    total
    hasMore
  }
}

# Get node relationships
query {
  nodeRelations(tableId: "table-id") {
    id
    sourceExternalId
    targetExternalId
    strength
    confidence
    relationType {
      identifier
      description
    }
  }
}
```

### Mutation Examples

```graphql
# Create a table
mutation {
  createTable(input: {
    identifier: "my-table"
    description: "My graph table"
  }) {
    table {
      id
      identifier
      description
    }
    errors {
      message
      code
      field
    }
  }
}

# Create a node
mutation {
  createNode(input: {
    tableId: "table-id"
    content: "Node content"
    description: "Node description"
  }) {
    node {
      id
      content
      description
    }
    errors {
      message
      code
    }
  }
}

# Create a relation
mutation {
  createRelation(input: {
    tableId: "table-id"
    sourceExternalId: "node-1-id"
    targetExternalId: "node-2-id"
    relationTypeId: "relation-type-id"
    strength: 0.8
    confidence: 0.9
  }) {
    relation {
      id
      strength
      confidence
    }
    errors {
      message
      code
    }
  }
}
```

## Test Environment

The project includes a comprehensive test suite with:

### Test Utilities

- **GraphQLTestClient**: Full-featured GraphQL client with all operations
- **TestDataFixtures**: Pre-built test data for multiple domains
- **GraphQLTestRunner**: Server lifecycle management for integration tests

### Test Domains

1. **E-commerce**: Products, customers, orders, and purchase relationships
2. **Project Management**: Projects, tasks, users, and assignment relationships
3. **Knowledge Graph**: Concepts with hierarchical and associative relationships
4. **Performance Testing**: Large datasets for performance validation

### Running Tests

```bash
# Full test suite with server management
bun run test:server

# Direct GraphQL tests (requires running server)
bun run test:graphql

# Start test server and run specific tests
bun test/test-runner.ts test test/graphql-comprehensive.test.ts
```

## Database Schema

The system uses SQLite with the following key tables:

- `tables`: Graph table definitions
- `nodes`: Graph nodes with content and metadata
- `node_relations`: Graph edges with quality metrics
- `attributes`: Node property definitions
- `attribute_types`: Property type schemas
- `relation_types`: Relationship type schemas

## Quality System

Relations include a quality scoring system:

- **Strength** (0.0-1.0): How strong the relationship is
- **Confidence** (0.0-1.0): How certain we are about the relationship

This enables weighted graph algorithms and relationship quality analysis.

## Configuration

Key configuration files:

- `biome.json`: Code formatting and linting rules
- `tsconfig.json`: TypeScript compiler configuration
- `package.json`: Dependencies and scripts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the full test suite: `bun run test:server`
5. Ensure type safety: `bun run typecheck`
6. Format code: `bun run check`
7. Submit a pull request

## License

This project is private and proprietary.
