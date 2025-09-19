# ExecuteTemplateWithGraphQL: Meta Template Execution System

## Overview

The `executeTemplateWithGraphQL` mutation provides a meta-execution system that allows dynamic execution of any stored template with variable substitution and usage tracking. This system enables template orchestration, testing, and programmatic execution workflows.

## Template Structure Analysis

### Self-Referential Template Example

The `execute-template-with-graphql` template demonstrates the system's meta-capabilities:

```json
{
  "identifier": "execute-template-with-graphql",
  "name": "Execute Template with GraphQL",
  "description": "GraphQL 템플릿을 동적으로 실행하고 결과를 반환합니다.",
  "query": "mutation ExecuteTemplateWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) { executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables, trackUsage: $trackUsage) { success data errors { message } metadata { executionTimeMs templateUsageCount } } }",
  "queryName": "ExecuteTemplateWithGraphQL",
  "operationType": "mutation",
  "variablesSchema": {
    "type": "object",
    "properties": {
      "templateIdentifier": {
        "type": "string",
        "description": "실행할 템플릿의 식별자"
      },
      "variables": {
        "type": "object",
        "description": "템플릿 실행에 필요한 변수들 (JSON 객체)"
      },
      "trackUsage": {
        "type": "boolean",
        "description": "사용 통계 추적 여부",
        "default": true
      }
    },
    "required": ["templateIdentifier"]
  },
  "defaultVariables": {
    "templateIdentifier": "get-system-statistics",
    "variables": {},
    "trackUsage": true
  }
}
```

## Target Template Example: Table Detailed Statistics

To demonstrate executing different interface types, we'll use the `get-table-detailed-statistics` template:

### Target Template Structure
```json
{
  "identifier": "get-table-detailed-statistics",
  "name": "Get Table Comprehensive Details",
  "description": "특정 테이블의 종합 정보 (기본 정보, 속성 목록, 관련 템플릿 개수)",
  "query": "query GetTableComprehensiveDetails($tableIdentifier: String!) { table: tableByIdentifier(identifier: $tableIdentifier) { id identifier description attributeCount tableNodeCount createdAt updatedAt attributes { id identifier name description attributeType { id name } } } relatedTemplates: searchTemplates(filter: { search: $tableIdentifier }) { totalCount nodes { identifier name usageCount isActive } } }",
  "queryName": "GetTableComprehensiveDetails",
  "operationType": "query",
  "variablesSchema": {
    "type": "object",
    "properties": {
      "tableIdentifier": {
        "type": "string",
        "description": "조회할 테이블의 식별자"
      }
    },
    "required": ["tableIdentifier"]
  },
  "defaultVariables": {
    "tableIdentifier": "demo-table"
  }
}
```

## Execution Scenarios

### Scenario 1: Execute Simple Template (No Variables)

**Target**: `get-system-statistics` (requires no variables)

```graphql
mutation ExecuteSimpleTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "get-system-statistics",
    variables: {},
    trackUsage: true
  ) {
    success
    data
    errors { message }
    metadata {
      templateId
      templateName
      executionTime
    }
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "executeTemplateWithGraphQL": {
      "success": true,
      "data": {
        "tables": {
          "totalCount": 56
        }
      },
      "errors": [],
      "metadata": {
        "templateId": "204",
        "templateName": "Get System Tables Count",
        "executionTime": 1
      }
    }
  }
}
```

### Scenario 2: Execute Template with Required Variables

**Target**: `get-table-detailed-statistics` (requires `tableIdentifier`)

```graphql
mutation ExecuteTemplateWithVariables {
  executeTemplateWithGraphQL(
    templateIdentifier: "get-table-detailed-statistics",
    variables: {
      "tableIdentifier": "demo-table"
    },
    trackUsage: true
  ) {
    success
    data
    errors { message }
    metadata {
      templateId
      templateName
      complexityScore
      executionTime
    }
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "executeTemplateWithGraphQL": {
      "success": true,
      "data": {
        "table": {
          "id": "55",
          "identifier": "demo-table",
          "description": "Demo table created via dataset testing",
          "attributeCount": 0,
          "tableNodeCount": 0,
          "createdAt": "2025-09-06T14:33:47.718Z",
          "updatedAt": "2025-09-06T14:33:47.718Z",
          "attributes": []
        },
        "relatedTemplates": {
          "totalCount": 33,
          "nodes": [
            {
              "identifier": "test-health-check",
              "name": "System Health Check",
              "usageCount": 181,
              "isActive": true
            }
          ]
        }
      },
      "errors": [],
      "metadata": {
        "templateId": "205",
        "templateName": "Get Table Comprehensive Details",
        "complexityScore": 2,
        "executionTime": 15
      }
    }
  }
}
```

### Scenario 3: Variable Validation Error

**Incorrect Usage**: Missing required variable

```graphql
mutation ExecuteWithMissingVariable {
  executeTemplateWithGraphQL(
    templateIdentifier: "get-table-detailed-statistics",
    variables: {},
    trackUsage: false
  ) {
    success
    data
    errors { message }
    metadata {
      templateId
      templateName
    }
  }
}
```

**Expected Error Response**:
```json
{
  "data": {
    "executeTemplateWithGraphQL": {
      "success": false,
      "data": null,
      "errors": [
        {
          "message": "Variable validation failed: Required variable 'tableIdentifier' is missing"
        }
      ],
      "metadata": {
        "templateId": "205",
        "templateName": "Get Table Comprehensive Details"
      }
    }
  }
}
```

## Interface Comparison

### Template Interface Analysis

| Template | Variables Required | Variable Schema | Default Behavior |
|----------|-------------------|-----------------|------------------|
| `execute-template-with-graphql` | `templateIdentifier` | Complex JSON object interface | Executes `get-system-statistics` by default |
| `get-system-statistics` | None | No variables needed | Returns total table count |
| `get-table-detailed-statistics` | `tableIdentifier` | Single string parameter | Uses `"demo-table"` as default |

### GraphQL Operation Types

| Template | Operation Type | Purpose | Return Pattern |
|----------|---------------|---------|----------------|
| `execute-template-with-graphql` | `mutation` | Meta-execution system | Wrapped execution result |
| `get-system-statistics` | `query` | Data retrieval | Direct data object |
| `get-table-detailed-statistics` | `query` | Data retrieval with parameters | Direct data object |

## Advanced Usage Patterns

### 1. Template Testing Workflow

```graphql
# Test multiple templates in sequence
mutation TestTemplateSequence {
  # Test 1: Basic system stats
  test1: executeTemplateWithGraphQL(
    templateIdentifier: "get-system-statistics",
    trackUsage: false
  ) { success errors { message } }
  
  # Test 2: Specific table details
  test2: executeTemplateWithGraphQL(
    templateIdentifier: "get-table-detailed-statistics",
    variables: { "tableIdentifier": "demo-table" },
    trackUsage: false
  ) { success errors { message } }
}
```

### 2. Dynamic Template Discovery and Execution

```graphql
# First, discover available templates
query DiscoverTemplates {
  searchTemplates(pagination: { limit: 5 }) {
    nodes {
      identifier
      name
      operationType
    }
  }
}

# Then execute discovered template
mutation ExecuteDiscoveredTemplate($templateId: String!) {
  executeTemplateWithGraphQL(
    templateIdentifier: $templateId,
    variables: {},
    trackUsage: true
  ) {
    success
    data
    metadata { executionTime }
  }
}
```

### 3. Conditional Template Execution

```graphql
mutation ConditionalExecution($useDetailedView: Boolean!, $tableId: String) {
  basicStats: executeTemplateWithGraphQL(
    templateIdentifier: "get-system-statistics"
  ) { success data }
  
  detailedStats: executeTemplateWithGraphQL(
    templateIdentifier: "get-table-detailed-statistics",
    variables: { "tableIdentifier": $tableId }
  ) @include(if: $useDetailedView) {
    success
    data
  }
}
```

## Performance Considerations

### Execution Overhead
- **Meta-Execution Layer**: ~2-5ms additional overhead
- **Variable Processing**: ~1-3ms for complex variable validation
- **Tracking Overhead**: ~1ms when usage tracking is enabled

### Optimization Strategies
1. **Disable Tracking**: Set `trackUsage: false` for high-frequency operations
2. **Variable Caching**: Reuse validated variable sets for repeated executions
3. **Template Warming**: Pre-execute frequently used templates during startup

### Resource Usage Patterns
| Scenario | Memory | CPU | Network |
|----------|---------|-----|---------|
| Simple template (no variables) | Low | Low | Minimal |
| Complex template with variables | Medium | Medium | Standard |
| Meta-execution with error handling | Medium | Medium | Standard |

## Error Handling Patterns

### Common Error Types

1. **Template Not Found**
```json
{
  "success": false,
  "errors": [{"message": "Template 'invalid-identifier' not found"}]
}
```

2. **Variable Validation Errors**
```json
{
  "success": false,
  "errors": [{"message": "Variable validation failed: 'tableIdentifier' is required"}]
}
```

3. **GraphQL Execution Errors**
```json
{
  "success": false,
  "errors": [{"message": "Cannot query field 'nonExistentField' on type 'Table'"}]
}
```

### Best Practices for Error Handling

1. **Always Check Success Flag**
```javascript
const result = await executeTemplate({
  templateIdentifier: "get-table-detailed-statistics",
  variables: { tableIdentifier: "demo-table" }
});

if (!result.success) {
  console.error("Template execution failed:", result.errors);
  return;
}

// Process successful result
const tableData = result.data.table;
```

2. **Validate Variables Client-Side**
```javascript
function validateTableIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error("tableIdentifier must be a non-empty string");
  }
  return identifier;
}
```

3. **Implement Retry Logic**
```javascript
async function executeWithRetry(templateIdentifier, variables, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await executeTemplate({ templateIdentifier, variables });
    if (result.success) return result;
    
    if (i === maxRetries - 1) throw new Error("Max retries exceeded");
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
}
```

## Integration Examples

### REST API Wrapper

```javascript
app.post('/api/templates/:identifier/execute', async (req, res) => {
  try {
    const result = await graphqlClient.request(`
      mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateIdentifier,
          variables: $variables,
          trackUsage: true
        ) {
          success
          data
          errors { message }
          metadata { executionTime }
        }
      }
    `, {
      templateIdentifier: req.params.identifier,
      variables: req.body.variables || {}
    });
    
    if (result.executeTemplateWithGraphQL.success) {
      res.json({
        data: result.executeTemplateWithGraphQL.data,
        metadata: result.executeTemplateWithGraphQL.metadata
      });
    } else {
      res.status(400).json({
        error: "Template execution failed",
        details: result.executeTemplateWithGraphQL.errors
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Batch Template Execution

```javascript
async function executeBatchTemplates(templateRequests) {
  const results = await Promise.allSettled(
    templateRequests.map(({ identifier, variables }) =>
      graphqlClient.request(`
        mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON) {
          executeTemplateWithGraphQL(
            templateIdentifier: $templateIdentifier,
            variables: $variables,
            trackUsage: true
          ) {
            success
            data
            errors { message }
            metadata { templateName executionTime }
          }
        }
      `, { templateIdentifier: identifier, variables })
    )
  );
  
  return results.map((result, index) => ({
    template: templateRequests[index].identifier,
    success: result.status === 'fulfilled' && result.value.executeTemplateWithGraphQL.success,
    data: result.status === 'fulfilled' ? result.value.executeTemplateWithGraphQL.data : null,
    error: result.status === 'rejected' ? result.reason.message : 
           (result.value.executeTemplateWithGraphQL.errors || []).map(e => e.message).join(', ')
  }));
}
```

## Conclusion

The `executeTemplateWithGraphQL` system provides a powerful meta-execution layer that enables:

- **Dynamic Template Orchestration**: Execute any template programmatically
- **Variable Validation**: Robust type checking and schema validation
- **Usage Analytics**: Comprehensive execution tracking and performance monitoring
- **Error Handling**: Detailed error reporting and debugging information
- **Integration Flexibility**: REST API wrappers, batch processing, and conditional execution

This system transforms static GraphQL templates into a dynamic, programmable execution environment suitable for complex application workflows, testing scenarios, and automated operations.