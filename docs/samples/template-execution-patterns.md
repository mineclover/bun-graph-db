# Template Execution Patterns

Complete examples of common template execution patterns using ExecuteTemplateWithGraphQL engine.

## Basic Data Entry Patterns

### Single Record Creation
```graphql
# Template: create-user-profile
mutation CreateUserProfile($username: String!, $email: String!, $age: Int) {
  createRow(tableId: "users-table", data: {
    username: $username
    email: $email
    age: $age
    active: true
  }) {
    success
    row { id }
    errors { message }
  }
}

# Execution
{
  "username": "john_doe",
  "email": "john@example.com",
  "age": 25
}
```

### Batch Record Creation
```graphql
# Template: bulk-product-import
mutation BulkProductImport($products: [ProductInput!]!) {
  createRows(tableId: "products-table", rows: $products) {
    successCount
    errors { index message }
    results { id }
  }
}

# Execution
{
  "products": [
    {"name": "Product A", "price": 99.99, "category": "electronics"},
    {"name": "Product B", "price": 49.99, "category": "books"}
  ]
}
```

## Relationship Management Patterns

### Create Relationship
```graphql
# Template: link-user-project
mutation LinkUserProject($userId: ID!, $projectId: ID!, $role: String!) {
  createRelation(
    sourceId: $userId
    targetId: $projectId
    type: "ASSIGNED_TO"
    metadata: {role: $role}
  ) {
    success
    relation { id confidence }
    errors { message }
  }
}

# Execution
{
  "userId": "user-123",
  "projectId": "project-456",
  "role": "developer"
}
```

## Query Patterns with Variables

### Filtered Search
```graphql
# Template: search-active-users
query SearchActiveUsers($minAge: Int!, $department: String) {
  tableRows(
    tableId: "users-table"
    filters: [
      {field: "active", operator: EQUALS, value: true}
      {field: "age", operator: GREATER_THAN, value: $minAge}
      {field: "department", operator: EQUALS, value: $department}
    ]
  ) {
    rows { id data }
    totalCount
  }
}

# Execution
{
  "minAge": 18,
  "department": "engineering"
}
```

### Paginated Results
```graphql
# Template: list-products-paginated
query ListProductsPaginated($page: Int!, $limit: Int!, $category: String) {
  tableRows(
    tableId: "products-table"
    pagination: {page: $page, limit: $limit}
    filters: [{field: "category", operator: EQUALS, value: $category}]
  ) {
    rows { id data createdAt }
    totalCount
    hasMore
  }
}

# Execution
{
  "page": 1,
  "limit": 10,
  "category": "electronics"
}
```

## Complex Workflow Patterns

### Multi-Step Workflow
```graphql
# Template: complete-order-workflow
mutation CompleteOrderWorkflow($orderId: ID!, $items: [OrderItemInput!]!) {
  # Step 1: Update order status
  updateRow(
    tableId: "orders-table"
    id: $orderId
    data: {status: "processing"}
  ) {
    success
  }

  # Step 2: Create order items
  createRows(
    tableId: "order-items-table"
    rows: $items
  ) {
    successCount
  }

  # Step 3: Update inventory
  updateInventory(items: $items) {
    success
    updatedItems
  }
}

# Execution
{
  "orderId": "order-789",
  "items": [
    {"productId": "prod-1", "quantity": 2, "price": 99.99},
    {"productId": "prod-2", "quantity": 1, "price": 149.99}
  ]
}
```

## Conditional Execution Patterns

### Dynamic Query Building
```graphql
# Template: flexible-user-search
query FlexibleUserSearch(
  $hasEmail: Boolean = false
  $hasAge: Boolean = false
  $email: String
  $minAge: Int
) {
  tableRows(
    tableId: "users-table"
    filters: [
      {field: "email", operator: EQUALS, value: $email, enabled: $hasEmail}
      {field: "age", operator: GREATER_THAN, value: $minAge, enabled: $hasAge}
    ]
  ) {
    rows { id data }
    totalCount
  }
}

# Execution (email only)
{
  "hasEmail": true,
  "email": "john@example.com"
}

# Execution (age only)
{
  "hasAge": true,
  "minAge": 25
}
```

## Error Handling Patterns

### Robust Template with Validation
```graphql
# Template: safe-user-creation
mutation SafeUserCreation($input: UserInput!) {
  # Validate input
  validateUserInput(input: $input) {
    isValid
    errors { field message }
  }

  # Create user if valid
  createRow(
    tableId: "users-table"
    data: $input
    options: {validateBeforeCreate: true}
  ) {
    success
    row { id }
    errors { message field }
    warnings { message }
  }
}

# Execution
{
  "input": {
    "username": "new_user",
    "email": "valid@email.com",
    "age": 30
  }
}
```

## Performance Optimization Patterns

### Optimized Bulk Operations
```graphql
# Template: optimized-bulk-insert
mutation OptimizedBulkInsert($data: [JSON!]!, $batchSize: Int = 100) {
  bulkCreateRows(
    tableId: "data-table"
    rows: $data
    options: {
      batchSize: $batchSize
      skipValidation: false
      returnIds: true
    }
  ) {
    totalProcessed
    successCount
    failedCount
    errors { index message }
    insertedIds
    executionTime
  }
}

# Execution
{
  "data": [...1000_records...],
  "batchSize": 50
}
```

## Template Composition Patterns

### Reusable Sub-Templates
```graphql
# Template: audit-log-creation
mutation CreateAuditLog($action: String!, $userId: ID!, $resourceId: ID!) {
  createRow(
    tableId: "audit-logs-table"
    data: {
      action: $action
      userId: $userId
      resourceId: $resourceId
      timestamp: "now()"
      ipAddress: "context.ipAddress"
    }
  ) {
    success
    row { id }
  }
}

# Template: user-update-with-audit
mutation UserUpdateWithAudit($userId: ID!, $updates: JSON!) {
  # Main operation
  updateRow(
    tableId: "users-table"
    id: $userId
    data: $updates
  ) {
    success
    row { id }
  }

  # Audit trail
  executeTemplateWithGraphQL(
    templateIdentifier: "audit-log-creation"
    variables: {
      action: "USER_UPDATE"
      userId: $userId
      resourceId: $userId
    }
  ) {
    success
    data
  }
}
```

## ExecuteTemplateWithGraphQL Usage Examples

### Direct Template Execution
```javascript
// JavaScript client example
const result = await client.request(`
  mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON!) {
    executeTemplateWithGraphQL(
      templateIdentifier: $templateIdentifier
      variables: $variables
    ) {
      success
      data
      errors { message }
    }
  }
`, {
  templateIdentifier: "create-user-profile",
  variables: {
    username: "alice",
    email: "alice@example.com",
    age: 28
  }
});
```

### Template Execution with Metadata
```graphql
mutation ExecuteTemplateWithMetadata($templateIdentifier: String!, $variables: JSON!) {
  executeTemplateWithGraphQL(
    templateIdentifier: $templateIdentifier
    variables: $variables
  ) {
    success
    data
    errors { message }
  }
}
```

## Best Practices

### 1. Variable Naming
- Use descriptive names: `$userId` not `$id`
- Follow camelCase convention
- Include type information in complex objects

### 2. Error Handling
- Always check `success` field
- Handle both errors and warnings
- Provide fallback values for optional variables

### 3. Performance
- Use appropriate batch sizes for bulk operations
- Implement pagination for large result sets
- Cache frequently executed templates

### 4. Security
- Validate all input variables
- Use parameterized queries to prevent injection
- Implement proper authorization checks

---

*This document provides practical examples for implementing common patterns with the ExecuteTemplateWithGraphQL engine.*

**Last updated**: 2025-01-19