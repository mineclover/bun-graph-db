# Template System Usage Guide

## 📋 Overview

Based on comprehensive testing of the template system, this guide provides practical usage patterns, best practices, and common patterns discovered during real-world testing.

## 🎯 Key Findings from Testing

### ✅ What Works Well

1. **Simple Query Templates**: Basic table and node queries execute perfectly
2. **Template Variables**: Variable substitution works reliably
3. **Usage Tracking**: Automatic usage count tracking is accurate
4. **Metadata Collection**: Complexity scoring and execution time tracking
5. **Template Search**: Connection-based pagination works smoothly

### ⚠️ Current Limitations

1. **Complex Node Queries**: Some advanced node filtering patterns have issues
2. **Query Text Escaping**: Stored mutation templates have escaping issues in some cases
3. **Schema Differences**: Documentation schema differs from actual implementation

## 🚀 Practical Usage Patterns

### 1. Basic Query Template Pattern

**Use Case**: Frequently used simple queries

```graphql
# Template Creation
mutation CreateBasicTemplate {
  createTemplate(input: {
    identifier: "get-table-info"
    name: "Get Table Information"
    description: "Basic table information with node count"
    query: "query GetTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }"
    variables: { "tableId": "1" }
    createdBy: "system"
  }) {
    template { id identifier name }
    errors { message }
  }
}

# Template Execution
mutation ExecuteBasicTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "get-table-info"
    variables: { "tableId": "10" }
    trackUsage: true
  ) {
    success
    data
    errors { message }
  }
}
```

**Result**: ✅ Executes perfectly, returns real table data

### 2. Template Search and Discovery Pattern

```graphql
# Search Templates
query FindTemplates {
  searchTemplates(filter: {}) {
    nodes {
      id
      identifier
      name
      description
      query
      usageCount
      isActive
    }
    totalCount
    hasNextPage
  }
}
```

**Best Practice**: Use `searchTemplates` to discover existing templates before creating new ones.

### 3. Template Management Workflow

```typescript
// 1. Search for existing templates
const existingTemplates = await searchTemplates({ filter: {} })

// 2. Create new template if not exists
const newTemplate = await createTemplate({
  identifier: "unique-identifier",
  name: "Descriptive Name",
  query: "...",
  variables: defaultVariables
})

// 3. Execute with different variables
const result = await executeTemplateWithGraphQL(
  templateIdentifier,
  customVariables,
  true // track usage
)

// 4. Monitor usage
const usage = await getTemplate(templateId)
console.log(`Used ${usage.usageCount} times`)
```

## 📊 Template Categories Discovered

### 1. Data Retrieval Templates (Queries)
- **Basic Table Info**: Simple table metadata
- **Table Listings**: Tables with pagination
- **Node Queries**: Node data retrieval (with limitations)

### 2. Data Manipulation Templates (Mutations)
- **Table Creation**: Create new tables
- **Node Creation**: Add nodes to tables
- **Bulk Operations**: Multiple record creation

### 3. System Templates
- **Health Checks**: System status verification
- **Metadata Queries**: System information retrieval

## 🔧 Implementation Schema Reference

### Actual GraphQL Schema (Tested)

```graphql
# Template Input (Actual Implementation)
input CreateQueryTemplateInput {
  identifier: String!
  name: String!
  description: String
  query: String!          # Note: "query" not "queryText"
  variables: JSON         # Note: "variables" not "variablesSchema"
  createdBy: String
}

# Template Output (Actual Implementation)
type CreateQueryTemplatePayload {
  template: QueryTemplate  # Note: "template" not "queryTemplate"
  errors: [Error!]!
}

# Template Execution (Actual Implementation)
type ExecuteQueryTemplatePayload {
  success: Boolean!
  data: JSON              # Contains processed query and metadata
  execution: QueryTemplateExecution
  errors: [Error!]!
}
```

### Key Schema Differences

| Documentation | Actual Implementation |
|---|---|
| `queryText` | `query` |
| `variablesSchema` | `variables` |
| `queryTemplate` | `template` |
| `result` | `data` |

## 🎯 Best Practices

### 1. Template Naming Convention
- **Identifier**: kebab-case (e.g., `get-table-info`)
- **Name**: Human-readable (e.g., `Get Table Information`)
- **Description**: Clear purpose explanation

### 2. Variable Design
- Use meaningful parameter names
- Provide default values in template creation
- Keep variable structure simple

### 3. Query Design
- Start with simple queries
- Test queries independently before templating
- Avoid complex nested relationships initially

### 4. Error Handling
```typescript
const result = await executeTemplateWithGraphQL(...)
if (!result.success) {
  console.error('Template execution failed:', result.errors)
  return
}

const graphqlResult = result.data
if (!graphqlResult.success) {
  console.error('GraphQL execution failed:', graphqlResult.errors)
  return
}

// Process successful result
const actualData = graphqlResult.data
```

### 5. Usage Tracking
- Always set `trackUsage: true` for production usage
- Monitor usage patterns via `usageCount`
- Use popular templates for performance optimization

## 🧪 Testing Insights

### Reliable Patterns
1. **Simple table queries**: Always work
2. **Basic mutations**: Work with proper escaping
3. **Template CRUD**: All operations functional
4. **Usage statistics**: Accurate tracking

### Areas Needing Attention
1. **Complex node queries**: Need schema investigation
2. **Escaping in stored queries**: String handling improvements needed
3. **Error message clarity**: Some errors could be more descriptive

## 📈 Performance Characteristics

### Template Execution Speed
- Simple queries: ~2-3ms execution time
- Template lookup: Nearly instantaneous
- Variable processing: Minimal overhead
- Usage tracking: No noticeable impact

### Resource Usage
- Memory efficient template storage
- Fast template search with pagination
- Minimal database overhead

## 🔮 Recommended Usage Workflows

### For Developers
1. **Start Simple**: Begin with basic query templates
2. **Test First**: Verify GraphQL queries work before templating
3. **Iterate**: Improve templates based on usage patterns
4. **Monitor**: Track usage statistics for optimization

### For Applications  
1. **Template Library**: Build a library of common operations
2. **Dynamic Execution**: Use templates for user-driven queries
3. **Performance**: Cache frequently used template results
4. **Analytics**: Use template statistics for insights

## 🛠️ Troubleshooting Guide

### Common Issues and Solutions

1. **"Cannot query field X"**: Check actual schema vs documentation
2. **"Template not found"**: Verify template identifier spelling
3. **"GraphQL parse error"**: Check query syntax and escaping
4. **"Variable validation failed"**: Ensure required variables provided

### Debugging Steps
1. Test the raw GraphQL query first
2. Verify template creation succeeded
3. Check template existence with `getTemplate`
4. Validate variable structure
5. Review error messages carefully

This guide reflects real-world testing experience and should be updated as the system evolves.