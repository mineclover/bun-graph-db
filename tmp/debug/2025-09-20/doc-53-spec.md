# Document 53 - spec

**Version**: 1
**Table ID**: 106 (test-reliability-check)
**Created**: 2025-09-19T21:39:48.419Z
**Updated**: 2025-09-19T21:39:48.419Z
**Content Length**: 1747 characters

---

# GraphQL Mutations Reference

## Table Operations

### Create Table
```graphql
mutation CreateTable($input: CreateTableInput!) {
  createTable(input: $input) {
    success
    errors { message }
    table {
      id
      identifier
      description
      createdAt
    }
  }
}
```

### Create Attribute
```graphql
mutation CreateAttribute($input: CreateAttributeInput!) {
  createAttribute(input: $input) {
    success
    errors { message }
    attribute {
      id
      identifier
      name
      attributeType { id name }
    }
  }
}
```

## Node Operations

### Create Node
```graphql
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    errors { message }
    node {
      id
      attributes {
        id
        value
        attributeType { name }
      }
    }
  }
}
```

## Template Operations

### Create Template
```graphql
mutation CreateTemplate($input: CreateTemplateInput!) {
  createTemplate(input: $input) {
    success
    errors { message }
    template {
      id
      identifier
      name
      description
      query
      variables
      tags
    }
  }
}
```

### Execute Template
```graphql
mutation ExecuteTemplateWithGraphQL($templateIdentifier: String!, $variables: JSON!) {
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

## Batch Operations

### Batch Create Nodes
```graphql
mutation BatchCreateNodes($input: BatchCreateNodesInput!) {
  batchCreateNodes(input: $input) {
    success
    errors { message }
    results {
      success
      node { id }
      errors { message }
    }
    summary {
      total
      successful
      failed
    }
  }
}
```
