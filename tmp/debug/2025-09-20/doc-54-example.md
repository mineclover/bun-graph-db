# Document 54 - example

**Version**: 1
**Table ID**: 106 (test-reliability-check)
**Created**: 2025-09-19T21:41:47.702Z
**Updated**: 2025-09-19T21:41:47.702Z
**Content Length**: 1855 characters

---

# Complete API Usage Examples

## Health Check Example
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'
```

## System Statistics Example
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { systemStats { memory { used total percentage } process { pid cpu platform } } }"}'
```

## Template Search Example
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates { templates { identifier name description query tags createdAt } totalCount } }"}'
```

## Table Operations Examples

### Create Table
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTable(input: { identifier: \"sample-table\", description: \"Sample table for demonstration\" }) { success table { id identifier description } errors { message } } }"}'
```

### List Tables
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { tables { nodes { id identifier description nodeCount attributeCount createdAt } totalCount hasNextPage } }"}'
```

## Template Execution Example
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"system-health-check_v1-0-0\", variables: {}) { success data errors { message } } }"}'
```

## Complete Workflow Example

1. **Create a new table**
2. **Define table schema with attributes**
3. **Create templates for data operations**
4. **Execute templates with variables**

This demonstrates the full lifecycle of table management and data operations.
