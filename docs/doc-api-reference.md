# Doc API Reference

GraphQL-based Documentation Management System for Graph Database Tables.

## Overview

The Doc API provides comprehensive documentation management capabilities for database tables. Each table can have multiple types of documentation (USAGE, GUIDE, EXAMPLE, SPEC, GENERAL) with version control and activation management.

## Table of Contents

- [Schema Types](#schema-types)
- [Queries](#queries)
- [Mutations](#mutations)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Schema Types

### Doc

Core documentation entity with full metadata and content.

```graphql
type Doc {
  id: ID!
  table: Table!
  category: DocCategory!
  version: Int!
  content: String!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### DocCategory

Documentation categories for different types of content.

```graphql
enum DocCategory {
  USAGE     # How to use the table/feature
  GUIDE     # Step-by-step instructions
  EXAMPLE   # Code examples and samples
  SPEC      # Technical specifications
  GENERAL   # General overview and notes
}
```

### Connection Types

Paginated results for doc queries.

```graphql
type DocsConnection {
  docs: [Doc!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}
```

### Input Types

#### CreateDocInput

```graphql
input CreateDocInput {
  tableId: ID!
  category: DocCategory!
  content: String!
  version: Int = 1
}
```

#### UpdateDocInput

```graphql
input UpdateDocInput {
  content: String
  isActive: Boolean
}
```

### Response Types

#### CreateDocPayload

```graphql
type CreateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [ValidationError!]!
}
```

#### UpdateDocPayload

```graphql
type UpdateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [ValidationError!]!
}
```

#### DeleteDocPayload

```graphql
type DeleteDocPayload {
  success: Boolean!
  errors: [ValidationError!]!
}
```

#### ActivateDocPayload

```graphql
type ActivateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [ValidationError!]!
}
```

## Queries

### getDoc

Retrieve a specific document by ID.

```graphql
getDoc(id: ID!): Doc
```

**Parameters:**
- `id`: Unique document identifier

**Returns:** `Doc` object or `null` if not found

**Example:**
```graphql
query GetSpecificDoc {
  getDoc(id: "123") {
    id
    category
    content
    version
    isActive
    table {
      id
      identifier
    }
  }
}
```

### getActiveDoc

Get the currently active document for a table and category.

```graphql
getActiveDoc(tableId: ID!, category: DocCategory!): Doc
```

**Parameters:**
- `tableId`: Table identifier
- `category`: Documentation category

**Returns:** Active `Doc` object or `null` if none active

**Example:**
```graphql
query GetActiveUsageDoc {
  getActiveDoc(tableId: "58", category: USAGE) {
    id
    content
    version
    isActive
    createdAt
  }
}
```

### getDocs

Retrieve all documents for a table with optional filtering and pagination.

```graphql
getDocs(
  tableId: ID!
  category: DocCategory
  isActive: Boolean
  pagination: PaginationInput
): DocsConnection!
```

**Parameters:**
- `tableId`: Table identifier (required)
- `category`: Filter by documentation category (optional)
- `isActive`: Filter by active status (optional)
- `pagination`: Pagination parameters (optional)

**Returns:** `DocsConnection` with docs, count, and pagination info

**Example:**
```graphql
query GetTableDocs {
  getDocs(tableId: "58", category: USAGE) {
    docs {
      id
      category
      content
      version
      isActive
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}
```

### getDocVersions

Get all versions of documentation for a specific table and category.

```graphql
getDocVersions(
  tableId: ID!
  category: DocCategory!
  pagination: PaginationInput
): DocsConnection!
```

**Parameters:**
- `tableId`: Table identifier
- `category`: Documentation category
- `pagination`: Pagination parameters (optional)

**Returns:** `DocsConnection` with all versions

**Example:**
```graphql
query GetUsageVersions {
  getDocVersions(tableId: "58", category: USAGE) {
    docs {
      id
      version
      content
      isActive
      createdAt
    }
    totalCount
  }
}
```

### searchDocs

Search documentation content across tables.

```graphql
searchDocs(
  filter: DocsFilter!
  pagination: PaginationInput
): DocsConnection!
```

**Parameters:**
- `filter`: Search and filter criteria
- `pagination`: Pagination parameters (optional)

**Returns:** `DocsConnection` with matching docs

**Example:**
```graphql
query SearchDocs {
  searchDocs(
    filter: {
      searchTerm: "todo"
      tableId: "58"
      category: USAGE
    }
  ) {
    docs {
      id
      category
      content
      table {
        identifier
      }
    }
    totalCount
  }
}
```

## Mutations

### createDoc

Create new documentation for a table.

```graphql
createDoc(input: CreateDocInput!): CreateDocPayload!
```

**Business Rules:**
- Only one active document per table+category combination
- Version numbers must be unique within table+category
- Content cannot be empty
- Table must exist

**Example:**
```graphql
mutation CreateUsageDoc {
  createDoc(input: {
    tableId: "58"
    category: USAGE
    content: "This table manages todo items with priority and status tracking."
  }) {
    success
    doc {
      id
      category
      version
      isActive
    }
    errors {
      message
      field
    }
  }
}
```

### updateDoc

Update existing documentation content or status.

```graphql
updateDoc(id: ID!, input: UpdateDocInput!): UpdateDocPayload!
```

**Example:**
```graphql
mutation UpdateDocContent {
  updateDoc(
    id: "123"
    input: {
      content: "Updated content with more details..."
    }
  ) {
    success
    doc {
      id
      content
      updatedAt
    }
    errors {
      message
    }
  }
}
```

### deleteDoc

Permanently delete documentation.

```graphql
deleteDoc(id: ID!): DeleteDocPayload!
```

**Example:**
```graphql
mutation DeleteDoc {
  deleteDoc(id: "123") {
    success
    errors {
      message
    }
  }
}
```

### activateDoc

Set a document as the active version for its category.

```graphql
activateDoc(id: ID!): ActivateDocPayload!
```

**Business Rules:**
- Deactivates all other docs in the same table+category
- Only one active doc per table+category allowed

**Example:**
```graphql
mutation ActivateDocVersion {
  activateDoc(id: "123") {
    success
    doc {
      id
      isActive
      category
    }
    errors {
      message
    }
  }
}
```

## Usage Examples

### Complete Documentation Workflow

```graphql
# 1. Create usage documentation
mutation CreateUsageDoc {
  createDoc(input: {
    tableId: "58"
    category: USAGE
    content: "Use this table to manage todo items..."
  }) {
    success
    doc { id version }
  }
}

# 2. Create guide documentation
mutation CreateGuideDoc {
  createDoc(input: {
    tableId: "58"
    category: GUIDE
    content: "Step 1: Create a new todo..."
  }) {
    success
    doc { id }
  }
}

# 3. Get all docs for the table
query GetAllTableDocs {
  getDocs(tableId: "58") {
    docs {
      id
      category
      version
      isActive
      content
    }
    totalCount
  }
}

# 4. Get only active documentation
query GetActiveDocs {
  getDocs(tableId: "58", isActive: true) {
    docs {
      category
      content
      version
    }
  }
}
```

### Version Management

```graphql
# Create new version of existing documentation
mutation CreateNewVersion {
  createDoc(input: {
    tableId: "58"
    category: USAGE
    content: "Updated usage instructions..."
    version: 2
  }) {
    success
    doc {
      id
      version
      isActive
    }
  }
}

# Activate the new version
mutation ActivateNewVersion {
  activateDoc(id: "new-doc-id") {
    success
    doc {
      isActive
      version
    }
  }
}

# View all versions
query ViewAllVersions {
  getDocVersions(tableId: "58", category: USAGE) {
    docs {
      id
      version
      isActive
      createdAt
      content
    }
  }
}
```

## Error Handling

### Common Error Types

#### ValidationError

```graphql
type ValidationError {
  message: String!
  field: String
}
```

### Error Examples

#### Invalid Input
```json
{
  "data": {
    "createDoc": {
      "success": false,
      "doc": null,
      "errors": [
        {
          "message": "Doc content is required",
          "field": "content"
        }
      ]
    }
  }
}
```

#### Not Found
```json
{
  "data": {
    "updateDoc": {
      "success": false,
      "doc": null,
      "errors": [
        {
          "message": "Doc with id '999' not found",
          "field": null
        }
      ]
    }
  }
}
```

#### Duplicate Version
```json
{
  "data": {
    "createDoc": {
      "success": false,
      "doc": null,
      "errors": [
        {
          "message": "Doc with category 'usage' and version 1 already exists for table '58'",
          "field": null
        }
      ]
    }
  }
}
```

## Best Practices

### 1. Documentation Categories

- **USAGE**: High-level overview of how to use the table/feature
- **GUIDE**: Step-by-step instructions with examples
- **EXAMPLE**: Code samples and practical examples
- **SPEC**: Technical specifications and schema details
- **GENERAL**: Overview, context, and general notes

### 2. Content Guidelines

- Keep content focused and category-appropriate
- Use clear, descriptive language
- Include examples where relevant
- Maintain consistency across versions
- Update regularly to keep content current

### 3. Version Management

- Use semantic versioning (1, 2, 3...)
- Always activate the most current version
- Keep previous versions for reference
- Document significant changes between versions

### 4. Query Optimization

- Use `getActiveDoc` for current documentation
- Use `getDocs` with filters for specific needs
- Implement pagination for large doc sets
- Cache frequently accessed documentation

### 5. Error Handling

- Always check `success` field in mutation responses
- Handle validation errors gracefully
- Provide meaningful error messages to users
- Implement retry logic for transient failures

## Integration Examples

### React Component

```tsx
import { useQuery, useMutation } from '@apollo/client'

const GET_ACTIVE_DOC = gql`
  query GetActiveDoc($tableId: ID!, $category: DocCategory!) {
    getActiveDoc(tableId: $tableId, category: $category) {
      id
      content
      version
      updatedAt
    }
  }
`

function DocumentationViewer({ tableId, category }) {
  const { data, loading, error } = useQuery(GET_ACTIVE_DOC, {
    variables: { tableId, category }
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data?.getActiveDoc) return <div>No documentation available</div>

  return (
    <div>
      <h3>{category} Documentation (v{data.getActiveDoc.version})</h3>
      <div>{data.getActiveDoc.content}</div>
      <small>Last updated: {data.getActiveDoc.updatedAt}</small>
    </div>
  )
}
```

### Node.js Usage

```javascript
const { GraphQLClient } = require('graphql-request')

const client = new GraphQLClient('http://localhost:4000/graphql')

async function createDocumentation(tableId, category, content) {
  const mutation = `
    mutation CreateDoc($input: CreateDocInput!) {
      createDoc(input: $input) {
        success
        doc { id version }
        errors { message }
      }
    }
  `

  try {
    const result = await client.request(mutation, {
      input: { tableId, category, content }
    })

    if (result.createDoc.success) {
      console.log('Documentation created:', result.createDoc.doc)
    } else {
      console.error('Errors:', result.createDoc.errors)
    }
  } catch (error) {
    console.error('Request failed:', error)
  }
}
```

## Status

- **API Version**: 1.0.0
- **Status**: Production Ready ✅
- **Last Updated**: 2025-09-15
- **Mutations**: 5/5 Working ✅
- **Queries**: 5/5 Working ✅
- **Test Coverage**: Comprehensive ✅