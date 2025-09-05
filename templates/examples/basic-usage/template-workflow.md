# Template-based Node Mutations Workflow

Complete guide for creating, storing, using, and managing GraphQL query templates for node creation in the Bun Graph DB system.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Template Creation](#template-creation)
4. [Template Storage](#template-storage)
5. [Template Usage](#template-usage)
6. [Template Management](#template-management)
7. [Best Practices](#best-practices)
8. [Examples](#examples)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The template-based node mutation system allows developers and users to:

- **Create reusable GraphQL mutation templates** for common node creation patterns
- **Store templates with metadata** including tags, complexity scores, and usage tracking
- **Execute templates with runtime variables** for dynamic node creation
- **Search and discover templates** by tags, table applicability, and other criteria
- **Track usage analytics** to understand template popularity and effectiveness

### Key Benefits

- ✅ **Consistency**: Standardized node creation patterns across domains
- ✅ **Reusability**: Templates can be used multiple times with different variables
- ✅ **Discoverability**: Tag-based search helps find relevant templates
- ✅ **Validation**: JSON Schema validation ensures correct variable types
- ✅ **Analytics**: Usage tracking provides insights into template effectiveness

---

## Architecture

The template system follows hexagonal architecture with clean domain boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│ GraphQL Schema  │ Query Resolvers │ Mutation Resolvers      │
│ - Templates     │ - searchTemplates│ - executeTemplate       │
│ - Input Types   │ - getTemplate   │ - createQueryTemplate   │
│ - Output Types  │ - getPopular    │ - updateQueryTemplate   │
└─────────────────┴─────────────────┴─────────────────────────┤
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│ Template Execution Service                                  │
│ - Variable validation & processing                          │
│ - GraphQL query parsing & execution                         │
│ - Usage tracking & analytics                                │
└─────────────────────────────────────────────────────────────┤
│                    Domain Layer                             │
├─────────────────────────────────────────────────────────────┤
│ QueryTemplate Entity                                        │
│ - Business rules & validation                               │
│ - Variable schema management                                │
│ - Template lifecycle management                             │
└─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
├─────────────────────────────────────────────────────────────┤
│ SQLite Repository                                           │
│ - CRUD operations with JSON queries                        │
│ - Tag-based search with SQL LIKE                           │
│ - Usage analytics & performance indexes                    │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **QueryTemplate Domain Entity** (`src/domain/entities/QueryTemplate.ts`)
   - Immutable value object with business rules
   - Variable validation and schema management
   - Template applicability and lifecycle methods

2. **IQueryTemplateRepository Interface** (`src/domain/repositories/IQueryTemplateRepository.ts`)
   - Repository contract with search capabilities
   - Advanced filtering by tags, tables, and criteria

3. **SQLiteQueryTemplateRepository** (`src/infrastructure/database/repositories/SQLiteQueryTemplateRepository.ts`)
   - SQL implementation with JSON query support
   - Performance optimized with proper indexing

4. **QueryTemplateResolver** (`src/presentation/graphql/resolvers/QueryTemplateResolver.ts`)
   - GraphQL operations for template management
   - Template execution with variable processing

---

## Template Creation

### 1. Define Template Structure

Templates consist of several key components:

```typescript
interface QueryTemplateInput {
  identifier: string           // Unique template identifier
  name: string                // Human-readable name
  description?: string        // Template description
  queryText: string          // GraphQL mutation/query text
  variablesSchema?: object   // JSON Schema for variables
  defaultVariables?: object  // Default variable values
  applicableTables?: string[] // Applicable table identifiers
  templateType: string       // 'query' | 'mutation' | 'subscription'
  complexityScore?: number   // 1-10 complexity rating
  tags: string[]            // Searchable tags
}
```

### 2. GraphQL Mutation for Template Creation

```graphql
mutation CreateQueryTemplate($input: CreateQueryTemplateInput!) {
  createQueryTemplate(input: $input) {
    id
    identifier
    name
    description
    queryText
    variablesSchema
    defaultVariables
    applicableTables
    templateType
    complexityScore
    usageCount
    version
    isActive
    tags
    createdAt
    updatedAt
  }
}
```

### 3. Example Template Creation

```javascript
const createProductTemplate = {
  input: {
    identifier: 'create-product-node',
    name: 'Create Product Node',
    description: 'Template for creating product nodes with inventory information',
    queryText: `
      mutation CreateProductNode(
        $tableId: ID!
        $productName: String!
        $sku: String!
        $price: Float!
        $stockQuantity: Int!
        $category: String!
      ) {
        createNode(input: {
          tableId: $tableId
          content: $productName
          title: $productName + " (" + $sku + ")"
          description: "Product: " + $productName
        }) {
          id
          content
          title
          description
          createdAt
          updatedAt
          attributeCount
          table {
            id
            identifier
          }
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID' },
        productName: { type: 'string', minLength: 1, description: 'Product name' },
        sku: { type: 'string', pattern: '^[A-Z0-9-]+$', description: 'Stock Keeping Unit' },
        price: { type: 'number', minimum: 0, description: 'Product price' },
        stockQuantity: { type: 'integer', minimum: 0, description: 'Stock quantity' },
        category: { type: 'string', description: 'Product category' }
      },
      required: ['tableId', 'productName', 'sku', 'price', 'stockQuantity', 'category']
    },
    defaultVariables: {
      stockQuantity: 0,
      category: 'General'
    },
    applicableTables: ['products', 'inventory', 'catalog'],
    templateType: 'mutation',
    complexityScore: 4,
    tags: ['node-creation', 'products', 'inventory', 'ecommerce']
  }
}
```

---

## Template Storage

### Database Schema

Templates are stored in the `templates` table with the following structure:

```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- GraphQL Query Information
  query_text TEXT NOT NULL,
  variables_schema TEXT,     -- JSON schema for variables
  default_variables TEXT,    -- Default JSON values
  
  -- Applicability (JSON array of table identifiers)
  applicable_tables TEXT,    -- null = universal, [...] = specific tables
  
  -- Metadata
  template_type TEXT DEFAULT 'query',  -- 'query', 'mutation', 'subscription'
  complexity_score INTEGER DEFAULT 1,   -- 1-10 complexity rating
  
  -- Usage Statistics
  usage_count INTEGER DEFAULT 0,
  
  -- Version Management
  version TEXT DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Search Tags (JSON array)
  tags TEXT,
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Performance Indexes

```sql
-- Core indexes for efficient queries
CREATE INDEX idx_templates_identifier ON templates(identifier);
CREATE INDEX idx_templates_type ON templates(template_type);
CREATE INDEX idx_templates_active ON templates(is_active);
CREATE INDEX idx_templates_usage ON templates(usage_count DESC);
CREATE INDEX idx_templates_applicable ON templates(applicable_tables);
CREATE INDEX idx_templates_tags ON templates(tags);
```

### JSON Query Support

The system uses SQLite's JSON functions for advanced searching:

```sql
-- Search by tags (ANY mode)
SELECT * FROM templates 
WHERE json_extract(tags, '$') LIKE '%"node-creation"%'

-- Search by tags (ALL mode) 
SELECT * FROM templates 
WHERE json_extract(tags, '$') LIKE '%"tag1"%' 
  AND json_extract(tags, '$') LIKE '%"tag2"%'

-- Search by applicable tables
SELECT * FROM templates 
WHERE applicable_tables IS NULL 
   OR json_extract(applicable_tables, '$') LIKE '%"products"%'
```

---

## Template Usage

### 1. Template Search and Discovery

#### Basic Search

```graphql
query SearchTemplates($input: SearchTemplatesInput!) {
  searchTemplates(input: $input) {
    id
    identifier
    name
    description
    tags
    templateType
    complexityScore
    usageCount
    applicableTables
  }
}
```

#### Search by Tags

```javascript
// Find all node creation templates
const nodeCreationTemplates = {
  input: {
    tags: ['node-creation'],
    tagMatchMode: 'ANY',
    templateType: 'mutation',
    isActive: true
  }
}

// Find templates for specific domain (ecommerce + products)
const ecommerceTemplates = {
  input: {
    tags: ['ecommerce', 'products'],
    tagMatchMode: 'ALL',
    orderBy: 'usage_count',
    orderDirection: 'DESC',
    limit: 10
  }
}
```

#### Search by Table Applicability

```javascript
const productTableTemplates = {
  input: {
    applicableToTable: 'products',
    includeUniversal: true, // Include universal templates
    templateType: 'mutation',
    isActive: true
  }
}
```

### 2. Template Execution

#### Basic Template Execution

```graphql
mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
  executeTemplate(input: $input)
}
```

#### Example Execution

```javascript
const executeProductTemplate = {
  input: {
    templateIdentifier: 'create-product-node',
    variables: {
      tableId: 'products-table-123',
      productName: 'Wireless Bluetooth Headphones',
      sku: 'WBH-2024-001',
      price: 199.99,
      stockQuantity: 50,
      category: 'Electronics'
    },
    trackUsage: true,        // Increment usage counter
    validateVariables: true  // Validate against schema
  }
}
```

#### Template Execution with Default Variables

```javascript
// Uses default values for optional variables
const executeWithDefaults = {
  input: {
    templateIdentifier: 'create-product-node',
    variables: {
      tableId: 'products-table-123',
      productName: 'Smart Watch',
      sku: 'SW-2024-001',
      price: 299.99
      // stockQuantity and category will use defaults
    },
    trackUsage: true
  }
}
```

### 3. Variable Processing

The system processes variables in the following order:

1. **Default Variables**: Applied first from template defaults
2. **Runtime Variables**: Override defaults with provided values
3. **Variable Validation**: Validate against JSON schema (if enabled)
4. **Template Execution**: Execute GraphQL with processed variables

```typescript
// Variable processing flow
const processVariables = (
  defaultVars: Record<string, unknown>,
  runtimeVars: Record<string, unknown>,
  schema: JsonSchema,
  validate: boolean
): Record<string, unknown> => {
  // 1. Start with defaults
  let processedVars = { ...defaultVars }
  
  // 2. Override with runtime values
  processedVars = { ...processedVars, ...runtimeVars }
  
  // 3. Validate if requested
  if (validate && schema) {
    validateVariables(processedVars, schema)
  }
  
  return processedVars
}
```

---

## Template Management

### 1. Template Retrieval

#### Get by ID

```graphql
query GetTemplate($id: ID!) {
  getTemplate(id: $id) {
    id
    identifier
    name
    queryText
    variablesSchema
    defaultVariables
    usageCount
    createdAt
    updatedAt
  }
}
```

#### Get by Identifier

```graphql
query GetTemplateByIdentifier($identifier: String!) {
  getTemplateByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    description
    queryText
    usageCount
    tags
  }
}
```

### 2. Popular Templates

```graphql
query GetPopularTemplates($limit: Int!) {
  getPopularTemplates(limit: $limit) {
    id
    identifier
    name
    templateType
    usageCount
    tags
    complexityScore
  }
}
```

### 3. Usage Analytics

Templates automatically track usage statistics:

- **Usage Count**: Incremented each time template is executed
- **Last Updated**: Timestamp updates on each execution
- **Popular Rankings**: Templates ordered by usage count

```javascript
// Execution automatically increments usage
await executeTemplate({
  templateIdentifier: 'create-product-node',
  variables: { /* ... */ },
  trackUsage: true  // This increments usage_count
})
```

---

## Best Practices

### 1. Template Design

#### ✅ Good Template Practices

- **Single Responsibility**: Each template should have one clear purpose
- **Descriptive Naming**: Use clear, domain-specific identifiers
- **Comprehensive Schema**: Define complete JSON schemas for variables
- **Meaningful Defaults**: Provide sensible default values
- **Appropriate Tags**: Use specific, searchable tags

```typescript
// Good template example
const goodTemplate = {
  identifier: 'create-user-profile',       // Clear, specific
  name: 'Create User Profile',
  description: 'Creates user profile with personal information',
  tags: ['node-creation', 'users', 'profiles'],  // Specific tags
  variablesSchema: {
    // Complete schema definition
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 13, maximum: 120 }
    },
    required: ['email', 'firstName']
  },
  defaultVariables: {
    age: null  // Sensible defaults
  }
}
```

#### ❌ Poor Template Practices

```typescript
// Poor template example
const poorTemplate = {
  identifier: 'template1',                 // Not descriptive
  name: 'Create Thing',                    // Vague name
  tags: ['stuff'],                         // Useless tags
  variablesSchema: {},                     // No validation
  defaultVariables: {}                     // No defaults
}
```

### 2. Variable Schema Design

#### Comprehensive Validation

```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "description": "User email address"
    },
    "age": {
      "type": "integer",
      "minimum": 13,
      "maximum": 120,
      "description": "User age"
    },
    "preferences": {
      "type": "object",
      "properties": {
        "theme": {
          "type": "string",
          "enum": ["light", "dark"],
          "default": "light"
        }
      }
    }
  },
  "required": ["email"],
  "additionalProperties": false
}
```

### 3. Tag Strategy

#### Hierarchical Tagging

```javascript
const tagStrategy = {
  // Domain tags
  domain: ['ecommerce', 'user-management', 'content'],
  
  // Operation tags  
  operation: ['node-creation', 'node-update', 'relationship'],
  
  // Entity tags
  entity: ['products', 'users', 'orders', 'articles'],
  
  // Complexity tags
  complexity: ['simple', 'moderate', 'complex'],
  
  // Feature tags
  feature: ['validation', 'bulk-operations', 'async']
}

// Good tagging example
const wellTaggedTemplate = {
  tags: [
    'ecommerce',        // domain
    'node-creation',    // operation  
    'products',         // entity
    'complex',          // complexity
    'validation'        // feature
  ]
}
```

### 4. Error Handling

#### Template Execution Errors

```typescript
try {
  const result = await executeTemplate({
    templateIdentifier: 'create-product-node',
    variables: productData,
    validateVariables: true
  })
  
  return result
} catch (error) {
  if (error.code === 'TEMPLATE_NOT_FOUND') {
    // Handle missing template
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle variable validation failure
  } else if (error.code === 'EXECUTION_ERROR') {
    // Handle GraphQL execution failure
  }
  
  throw error
}
```

---

## Examples

### 1. E-commerce Product Template

Complete example for creating product nodes with full metadata:

```javascript
const productTemplate = {
  identifier: 'create-ecommerce-product',
  name: 'Create E-commerce Product',
  description: 'Complete product creation with pricing, inventory, and SEO metadata',
  queryText: `
    mutation CreateEcommerceProduct(
      $tableId: ID!
      $productName: String!
      $sku: String!
      $price: Float!
      $salePrice: Float
      $stockQuantity: Int!
      $category: String!
      $brand: String
      $description: String!
      $images: [String!]
      $tags: [String!]
      $seoTitle: String
      $seoDescription: String
    ) {
      createNode(input: {
        tableId: $tableId
        content: $productName
        title: $seoTitle || $productName
        description: $seoDescription || $description
      }) {
        id
        content
        title
        description
        createdAt
        
        # After node creation, set attributes
        attributes {
          id
          value
          attribute {
            identifier
            description
          }
        }
        
        table {
          id
          identifier
          nodeCount
        }
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string', description: 'Target table ID' },
      productName: { 
        type: 'string', 
        minLength: 3, 
        maxLength: 200, 
        description: 'Product name' 
      },
      sku: { 
        type: 'string', 
        pattern: '^[A-Z0-9-]+$', 
        description: 'Stock Keeping Unit' 
      },
      price: { 
        type: 'number', 
        minimum: 0, 
        description: 'Regular price' 
      },
      salePrice: { 
        type: 'number', 
        minimum: 0, 
        description: 'Sale price (optional)' 
      },
      stockQuantity: { 
        type: 'integer', 
        minimum: 0, 
        description: 'Available stock' 
      },
      category: { 
        type: 'string', 
        description: 'Product category' 
      },
      brand: { 
        type: 'string', 
        description: 'Brand name' 
      },
      description: { 
        type: 'string', 
        minLength: 10, 
        description: 'Product description' 
      },
      images: {
        type: 'array',
        items: { type: 'string', format: 'uri' },
        maxItems: 10,
        description: 'Product image URLs'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 20,
        description: 'Product tags'
      },
      seoTitle: { 
        type: 'string', 
        maxLength: 60, 
        description: 'SEO title' 
      },
      seoDescription: { 
        type: 'string', 
        maxLength: 160, 
        description: 'SEO meta description' 
      }
    },
    required: ['tableId', 'productName', 'sku', 'price', 'stockQuantity', 'category', 'description']
  },
  defaultVariables: {
    stockQuantity: 0,
    category: 'General',
    tags: [],
    images: []
  },
  applicableTables: ['products', 'inventory', 'catalog', 'ecommerce'],
  templateType: 'mutation',
  complexityScore: 5,
  tags: [
    'node-creation', 
    'ecommerce', 
    'products', 
    'inventory', 
    'seo', 
    'complex'
  ]
}
```

### 2. User Management Template

```javascript
const userTemplate = {
  identifier: 'create-user-account',
  name: 'Create User Account',
  description: 'Creates user account with profile information and preferences',
  queryText: `
    mutation CreateUserAccount(
      $tableId: ID!
      $email: String!
      $firstName: String!
      $lastName: String!
      $dateOfBirth: String
      $phoneNumber: String
      $preferredLanguage: String
      $timezone: String
      $marketingOptIn: Boolean
    ) {
      createNode(input: {
        tableId: $tableId
        content: $email
        title: $firstName + " " + $lastName
        description: "User account: " + $email
      }) {
        id
        content
        title
        description
        createdAt
        updatedAt
        
        table {
          identifier
          nodeCount
        }
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string' },
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string', minLength: 1, maxLength: 50 },
      lastName: { type: 'string', minLength: 1, maxLength: 50 },
      dateOfBirth: { type: 'string', format: 'date' },
      phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
      preferredLanguage: { 
        type: 'string', 
        enum: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'] 
      },
      timezone: { type: 'string' },
      marketingOptIn: { type: 'boolean' }
    },
    required: ['tableId', 'email', 'firstName', 'lastName']
  },
  defaultVariables: {
    preferredLanguage: 'en',
    timezone: 'UTC',
    marketingOptIn: false
  },
  applicableTables: ['users', 'accounts', 'profiles'],
  templateType: 'mutation',
  complexityScore: 3,
  tags: ['node-creation', 'users', 'accounts', 'profiles', 'personal-data']
}
```

### 3. Content Management Template

```javascript
const articleTemplate = {
  identifier: 'create-blog-article',
  name: 'Create Blog Article',
  description: 'Creates blog article with content, metadata, and publishing settings',
  queryText: `
    mutation CreateBlogArticle(
      $tableId: ID!
      $title: String!
      $content: String!
      $excerpt: String
      $authorId: ID!
      $categoryId: ID!
      $tags: [String!]!
      $featuredImage: String
      $publishDate: String
      $status: String!
      $seoKeywords: [String!]
    ) {
      createNode(input: {
        tableId: $tableId
        content: $title
        title: $title
        description: $excerpt || ($content.length > 200 ? $content.substring(0, 200) + "..." : $content)
      }) {
        id
        content
        title
        description
        createdAt
        
        # Relationship to author and category would be created separately
        table {
          identifier
          description
        }
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string' },
      title: { type: 'string', minLength: 5, maxLength: 200 },
      content: { type: 'string', minLength: 100 },
      excerpt: { type: 'string', maxLength: 300 },
      authorId: { type: 'string' },
      categoryId: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10
      },
      featuredImage: { type: 'string', format: 'uri' },
      publishDate: { type: 'string', format: 'date-time' },
      status: {
        type: 'string',
        enum: ['draft', 'published', 'archived']
      },
      seoKeywords: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 15
      }
    },
    required: ['tableId', 'title', 'content', 'authorId', 'categoryId', 'tags', 'status']
  },
  defaultVariables: {
    status: 'draft',
    publishDate: new Date().toISOString(),
    tags: ['general'],
    seoKeywords: []
  },
  applicableTables: ['articles', 'blog-posts', 'content'],
  templateType: 'mutation',
  complexityScore: 4,
  tags: ['node-creation', 'content', 'articles', 'blogging', 'seo', 'publishing']
}
```

---

## Testing

### 1. Running Tests

The project includes comprehensive tests for template functionality:

```bash
# Run all template tests
bun test tests/template-based-node-mutations.test.ts

# Run with the custom test runner
bun run scripts/run-template-tests.ts

# Run specific test suite
bun test tests/template-based-node-mutations.test.ts --grep "Template Creation"
```

### 2. Test Structure

The test suite covers:

- ✅ Template creation and validation
- ✅ Template search and discovery
- ✅ Template execution with variables
- ✅ Usage tracking and analytics
- ✅ Variable validation and error handling
- ✅ Popular templates retrieval
- ✅ Multiple node creation scenarios

### 3. Test Data Setup

```typescript
// Example test setup
beforeEach(async () => {
  // Create test table
  const tableResponse = await createTable({
    identifier: `test-products-${Date.now()}`,
    description: 'Test table for products'
  })
  
  // Create test attributes
  await createAttribute({
    tableId: testTableId,
    identifier: 'product_name',
    attributeTypeId: '1', // string
    isRequired: true
  })
  
  // Create template
  const template = await createQueryTemplate({
    identifier: 'test-create-product',
    name: 'Test Product Creation',
    queryText: productMutationQuery,
    variablesSchema: productVariablesSchema,
    tags: ['test', 'products', 'node-creation']
  })
})
```

### 4. Integration Testing

```javascript
// Test complete workflow: create → search → execute → verify
describe('Complete Template Workflow', () => {
  test('should create, find, and execute template successfully', async () => {
    // 1. Create template
    const createResult = await createQueryTemplate(templateData)
    expect(createResult.data.createQueryTemplate).toBeDefined()
    
    // 2. Search for template
    const searchResult = await searchTemplates({
      tags: ['test-products'],
      templateType: 'mutation'
    })
    expect(searchResult.data.searchTemplates.length).toBeGreaterThan(0)
    
    // 3. Execute template
    const executeResult = await executeTemplate({
      templateIdentifier: 'test-create-product',
      variables: testProductData
    })
    expect(executeResult.data.executeTemplate).toBeDefined()
    
    // 4. Verify usage tracking
    const templateStats = await getTemplateByIdentifier('test-create-product')
    expect(templateStats.data.getTemplateByIdentifier.usageCount).toBe(1)
  })
})
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Template Not Found

**Error**: `Template with identifier 'xxx' not found`

**Solutions**:
- Verify template identifier spelling
- Check if template exists: `getTemplateByIdentifier`
- Ensure template is active (`is_active = true`)

```javascript
// Debug template existence
const template = await getTemplateByIdentifier('create-product-node')
if (!template.data.getTemplateByIdentifier) {
  console.log('Template does not exist')
} else if (!template.data.getTemplateByIdentifier.isActive) {
  console.log('Template exists but is inactive')
}
```

#### 2. Variable Validation Errors

**Error**: `Variable validation failed`

**Solutions**:
- Check variable types match schema requirements
- Ensure all required variables are provided
- Verify variable formats (email, date, etc.)

```javascript
// Debug variable validation
const template = await getTemplate(templateId)
const schema = template.data.getTemplate.variablesSchema

// Validate variables manually
const ajv = new Ajv()
const validate = ajv.compile(schema)
const valid = validate(variables)

if (!valid) {
  console.log('Validation errors:', validate.errors)
}
```

#### 3. GraphQL Execution Errors

**Error**: `GraphQL execution failed`

**Solutions**:
- Verify GraphQL syntax in template
- Check if target table/nodes exist
- Ensure proper variable substitution

```javascript
// Test GraphQL query separately
const testQuery = `
  query TestTemplate($tableId: ID!) {
    table(id: $tableId) {
      id
      identifier
    }
  }
`

const result = await executeGraphQL({
  query: testQuery,
  variables: { tableId: 'test-table-id' }
})
```

#### 4. Performance Issues

**Symptoms**: Slow template search or execution

**Solutions**:
- Check database indexes are created
- Optimize tag searches with specific criteria
- Use pagination for large result sets

```sql
-- Verify indexes exist
.schema templates

-- Check query performance
EXPLAIN QUERY PLAN 
SELECT * FROM templates 
WHERE json_extract(tags, '$') LIKE '%products%';
```

### Debugging Tools

#### 1. Template Information Query

```graphql
query DebugTemplate($identifier: String!) {
  getTemplateByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    queryText
    variablesSchema
    defaultVariables
    usageCount
    isActive
    tags
    applicableTables
    createdAt
    updatedAt
  }
}
```

#### 2. Usage Statistics

```graphql
query TemplateStats {
  getPopularTemplates(limit: 10) {
    identifier
    name
    usageCount
    complexityScore
    tags
  }
}
```

#### 3. System Health Check

```graphql
query SystemHealth {
  health {
    status
    database
    version
    timestamp
  }
}
```

---

## Conclusion

The template-based node mutation system provides a powerful, flexible way to standardize and reuse GraphQL operations in the Bun Graph DB. By following the patterns and best practices outlined in this documentation, developers can:

- Create maintainable, reusable templates
- Implement robust variable validation
- Build discoverable template libraries
- Track usage analytics effectively
- Ensure consistent node creation patterns

For additional help or questions, refer to:
- Source code examples in `/examples/sample-node-templates.ts`
- Test cases in `/tests/template-based-node-mutations.test.ts`
- GraphQL schema definitions in `/src/presentation/graphql/schemas/`