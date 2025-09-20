# Document 52 - guide

**Version**: 1
**Table ID**: 106 (test-reliability-check)
**Created**: 2025-09-19T21:39:07.297Z
**Updated**: 2025-09-19T21:39:07.297Z
**Content Length**: 2645 characters

---

# GraphQL Queries Guide

## Basic Queries

### Health Check
```graphql
query HealthCheck {
  healthCheck {
    status
    database
    version
    timestamp
  }
}
```

### System Statistics
```graphql
query SystemStats {
  systemStats {
    memory {
      used
      total
      percentage
    }
    process {
      pid
      cpu
      platform
    }
  }
}
```

### Table Operations

#### List All Tables
```graphql
query GetTables {
  tables {
    nodes {
      id
      identifier
      description
      createdAt
      updatedAt
      nodeCount
      attributeCount
    }
    totalCount
    hasNextPage
  }
}
```

#### Get Specific Table
```graphql
query GetTable($id: ID!) {
  getTable(id: $id) {
    id
    identifier
    description
    attributes {
      id
      identifier
      name
      attributeType {
        id
        name
      }
    }
    nodes {
      nodes {
        id
        attributes {
          id
          value
          attributeType {
            name
          }
        }
      }
    }
  }
}
```

### Node Operations

#### Search Nodes
```graphql
query SearchNodes($filter: NodesFilter!) {
  searchNodes(filter: $filter) {
    nodes {
      id
      table {
        identifier
      }
      attributes {
        id
        value
        attributeType {
          name
        }
      }
    }
    totalCount
  }
}
```

### Template Operations

#### Search Templates
```graphql
query SearchTemplates($filter: TemplatesFilter) {
  searchTemplates(filter: $filter) {
    templates {
      id
      identifier
      name
      description
      query
      variables
      variablesSchema
      tags
      createdAt
      updatedAt
      usageCount
      lastUsedAt
    }
    totalCount
  }
}
```

#### Get Template by Identifier
```graphql
query GetTemplateByIdentifier($identifier: String!) {
  getTemplateByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    description
    query
    variables
    variablesSchema
    tags
    usageCount
  }
}
```

### Documentation Queries

#### Search Documentation
```graphql
query SearchDocs($filter: DocsFilter!) {
  searchDocs(filter: $filter) {
    docs {
      id
      category
      content
      version
      table {
        identifier
      }
      createdAt
      updatedAt
    }
    totalCount
  }
}
```

## Query Variables Examples

### Table Filter
```json
{
  "filter": {
    "identifier": "user_analytics"
  }
}
```

### Node Search Filter
```json
{
  "filter": {
    "tableId": "106",
    "searchTerm": "example"
  }
}
```

### Template Filter
```json
{
  "filter": {
    "tags": ["system", "health"],
    "searchTerm": "check"
  }
}
```
