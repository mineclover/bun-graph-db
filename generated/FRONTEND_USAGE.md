# Frontend GraphQL Integration Guide

## 📦 Available Schema Files

1. **`schema.graphql`** - Complete GraphQL schema definition
2. **`graphql.types.ts`** - TypeScript type definitions (run `bun run codegen`)
3. **`introspection.json`** - Schema introspection for GraphQL tools

## 🚀 Quick Start Examples

### 1. Apollo Client (React)

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import type { Node, Table, NodeRelation } from '../generated/graphql.types';

// Initialize Apollo Client
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
});

// Example queries with TypeScript types
const GET_TABLES = gql`
  query GetTables {
    tables {
      totalCount
      nodes {
        id
        identifier
        name
        description
      }
    }
  }
`;

const CREATE_NODE = gql`
  mutation CreateNode($input: CreateNodeInput!) {
    createNode(input: $input) {
      success
      node {
        id
        content
        title
      }
    }
  }
`;
```

### 2. GraphQL Request (Simple HTTP)

```typescript
import { GraphQLClient } from 'graphql-request';
import type { Query, Mutation } from '../generated/graphql.types';

const client = new GraphQLClient('http://localhost:4000/graphql');

// Type-safe queries
async function getNodes() {
  const query = `
    query GetNodes {
      nodes {
        id
        content
        title
        table {
          name
        }
      }
    }
  `;
  
  const data = await client.request<Pick<Query, 'nodes'>>(query);
  return data.nodes;
}
```

### 3. urql (React)

```typescript
import { createClient, Provider } from 'urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
});

// In your React app
function App() {
  return (
    <Provider value={client}>
      <YourComponents />
    </Provider>
  );
}
```

## 📋 Common Query Examples

### Get All Tables with Nodes
```graphql
query GetTablesWithNodes {
  tables {
    nodes {
      id
      name
      nodes {
        id
        content
        title
      }
    }
  }
}
```

### Search Nodes
```graphql
query SearchNodes($query: String!) {
  searchNodes(query: $query) {
    id
    content
    title
    relevanceScore
  }
}
```

### Get Node Relations
```graphql
query GetNodeRelations($nodeId: ID!) {
  nodeRelations(filter: { sourceNodeId: $nodeId }) {
    nodes {
      id
      targetNode {
        id
        content
      }
      relationType {
        name
      }
    }
  }
}
```

### Create Node with Attributes
```graphql
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      title
      attributes {
        key
        value
      }
    }
    errors {
      message
    }
  }
}
```

### Execute Query Template
```graphql
query ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
  executeTemplate(input: $input) {
    success
    data
    execution {
      duration
      resultCount
    }
  }
}
```

## 🛠️ TypeScript Generation

### Generate Types from Schema

```bash
# Install dependencies (if not already installed)
bun add -D @graphql-codegen/cli @graphql-codegen/typescript

# Generate TypeScript types
bun run codegen

# Or manually
bunx graphql-codegen
```

### Using Generated Types

```typescript
import type {
  Node,
  Table,
  NodeRelation,
  QueryTemplate,
  CreateNodeInput,
  UpdateNodeInput,
  NodeFilter,
  PaginationInput,
} from '../generated/graphql.types';

// Type-safe input objects
const createNodeInput: CreateNodeInput = {
  tableId: '1',
  content: 'Node content',
  title: 'Node title',
  attributes: [
    { key: 'category', value: 'example' }
  ]
};

// Type-safe filter objects
const nodeFilter: NodeFilter = {
  tableId: '1',
  search: 'keyword',
  createdAfter: new Date().toISOString()
};
```

## 🔑 Authentication (if needed)

```typescript
// With Apollo Client
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  headers: {
    authorization: `Bearer ${authToken}`,
  },
  cache: new InMemoryCache(),
});

// With graphql-request
const client = new GraphQLClient('http://localhost:4000/graphql', {
  headers: {
    authorization: `Bearer ${authToken}`,
  },
});
```

## 📚 GraphQL Features

### Supported Operations
- ✅ Queries (read operations)
- ✅ Mutations (write operations)
- ✅ Nested queries
- ✅ Filtering
- ✅ Pagination
- ✅ Sorting
- ✅ Full-text search
- ✅ Graph traversal

### Key Types
- **Node**: Core content unit
- **Table**: Container for nodes
- **NodeRelation**: Connections between nodes
- **Attribute**: Metadata for nodes
- **QueryTemplate**: Reusable query patterns
- **RelationType**: Types of relationships

### Pagination Pattern
```graphql
query GetPaginatedNodes(
  $first: Int
  $after: String
  $filter: NodeFilter
) {
  nodes(
    pagination: { limit: $first, offset: 0 }
    filter: $filter
  ) {
    id
    content
  }
}
```

### Error Handling
All mutations return a standardized response:
```typescript
interface MutationResponse {
  success: boolean;
  errors: Array<{
    message: string;
    code?: string;
  }>;
  // ... specific data
}
```

## 📊 Performance Tips

1. **Use fragments** for repeated field selections
2. **Limit nested queries** to avoid over-fetching
3. **Use pagination** for large result sets
4. **Cache aggressively** with Apollo or urql
5. **Request only needed fields** (avoid `*` selections)

## 🔗 Additional Resources

- [GraphQL Documentation](https://graphql.org/learn/)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [urql Documentation](https://formidable.com/open-source/urql/)
- [graphql-request](https://github.com/jasonkuhrt/graphql-request)