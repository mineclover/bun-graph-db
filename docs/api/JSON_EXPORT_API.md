# JSON Export API Reference

GraphQL-based JSON Export System for Graph Database Tables.

## Overview

The JSON Export API provides two export formats for extracting table data:
1. **Flat JSON** - Simple array format with flattened attributes
2. **HFI Protocol** - Full graph structure compatible with flow visualization tools

## Table of Contents

- [Schema Types](#schema-types)
- [Queries](#queries)
- [Export Formats](#export-formats)
- [Patch Types](#patch-types)
- [Usage Examples](#usage-examples)
- [Type Guards](#type-guards)

## Schema Types

### JsonExportFormat

```graphql
enum JsonExportFormat {
  FLAT  # Simple array format
  HFI   # HFI Protocol v1.1 graph format
}
```

### JsonExportOptions

```graphql
input JsonExportOptions {
  """Export format: FLAT for simple array, HFI for full graph protocol"""
  format: JsonExportFormat! = FLAT
  """Include relations as branches (HFI only)"""
  includeRelations: Boolean = true
  """Include node positions (HFI only)"""
  includePositions: Boolean = false
  """Include visual themes (HFI only)"""
  includeThemes: Boolean = false
  """Include state connections (HFI only)"""
  includeStateConnections: Boolean = false
  """Pretty print JSON output"""
  prettyPrint: Boolean = true
  """Filter by specific node IDs"""
  nodeIds: [String!]
  """Filter by tags"""
  tags: [String!]
}
```

### JsonExportResult

```graphql
type JsonExportResult {
  success: Boolean!
  format: JsonExportFormat!
  """Raw JSON string output"""
  json: String
  """Parsed data (use json field for actual export)"""
  data: JSON
  nodeCount: Int!
  errors: [String!]!
  warnings: [String!]!
}
```

## Queries

### exportTableJson

Export table data to JSON format.

```graphql
query ExportTable($tableId: String!, $options: JsonExportOptions) {
  exportTableJson(tableId: $tableId, options: $options) {
    success
    format
    json
    nodeCount
    errors
    warnings
  }
}
```

## Export Formats

### Flat JSON Format

Simple array structure with flattened node attributes.

```typescript
interface FlatJsonExport {
  version: string
  exportedAt: string
  table: {
    id: string
    identifier: string
    description?: string
  }
  nodes: FlatNode[]
}

interface FlatNode {
  id: string
  title: string
  content?: string
  type?: string
  [key: string]: unknown // Dynamic attributes
}
```

**Example Output:**
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-01-27T10:00:00.000Z",
  "table": {
    "id": "123",
    "identifier": "users",
    "description": "User accounts"
  },
  "nodes": [
    {
      "id": "1",
      "title": "John Doe",
      "email": "john@example.com",
      "age": 30
    }
  ]
}
```

### HFI Protocol Format

Full graph structure compatible with @packages/hfiflow.

```typescript
interface HFIProtocolExport {
  protocol: 'HFI/1.1'
  context: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  stateConnections?: StateConnection[]
  viewport?: ViewportState
  themes?: Record<string, ContextTheme>
  metadata?: {
    createdAt?: string
    updatedAt?: string
    author?: string
    description?: string
    version?: string
    tags?: string[]
    sourceTable?: {
      id: string
      identifier: string
    }
  }
}
```

**Node Types:**

```typescript
// Query Node - Decision point with branches
interface QueryNode {
  id: string
  type: 'query'
  target: string
  title: string
  branches: BranchMetadata[]
  payload: PayloadField[]
  position?: NodePosition
  flowContext?: string
  category?: string
  tags?: string[]
  style?: NodeStyle
}

// Effect Node - Execution point
interface EffectNode {
  id: string
  type: 'effect'
  target: string
  title: string
  description?: string
  payload: PayloadField[]
  position?: NodePosition
  flowContext?: string
  category?: string
  tags?: string[]
  style?: NodeStyle
}
```

**Example Output:**
```json
{
  "protocol": "HFI/1.1",
  "context": "users",
  "nodes": [
    {
      "id": "1",
      "type": "query",
      "target": "user.validate",
      "title": "Validate User",
      "branches": [
        { "case": "valid", "label": "Valid", "next": "2" },
        { "case": "invalid", "label": "Invalid", "next": "3" }
      ],
      "payload": [
        { "key": "email", "type": "string", "value": "", "required": true }
      ]
    }
  ],
  "edges": [
    { "id": "e1-2", "label": "valid" }
  ],
  "metadata": {
    "sourceTable": { "id": "123", "identifier": "users" }
  }
}
```

## Patch Types

Format-specific mutation types for updating exported data.

### Flat JSON Patch

```typescript
interface FlatNodePatch {
  id: string           // Target node ID (required)
  title?: string       // Update title
  content?: string     // Update content
  attributes?: Record<string, unknown>  // Update dynamic attributes
}

interface FlatJsonPatchRequest {
  format: 'flat'
  tableId: string
  patches: FlatNodePatch[]
}
```

### HFI Protocol Patch

```typescript
interface HFINodePatch {
  id: string                    // Target node ID (required)
  title?: string                // Update title
  description?: string          // Update description (effect nodes)
  payload?: PayloadFieldPatch[] // Update payload fields
  tags?: string[]               // Update tags
  position?: NodePosition       // Update position
  style?: Partial<NodeStyle>    // Update style
}

interface HFIBranchPatch {
  nodeId: string        // Target node ID
  case: string          // Branch case to update
  label?: string        // Update label
  description?: string  // Update description
  next?: string | string[]  // Update next targets
  color?: string        // Update color
}

interface HFIRelationPatch {
  add?: {
    sourceNodeId: string
    targetNodeId: string
    relationTypeIdentifier: string
  }
  remove?: {
    sourceNodeId: string
    targetNodeId: string
    relationTypeIdentifier?: string
  }
}

interface HFIProtocolPatchRequest {
  format: 'hfi'
  context: string
  nodes?: HFINodePatch[]
  branches?: HFIBranchPatch[]
  relations?: HFIRelationPatch[]
  stateConnections?: HFIStateConnectionPatch[]
}
```

### Patch Result

```typescript
interface JsonPatchResult {
  success: boolean
  format: JsonExportFormat
  totalOperations: number
  successCount: number
  failureCount: number
  results: PatchOperationResult[]
  errors: string[]
  warnings: string[]
}
```

## Usage Examples

### Export Flat JSON

```graphql
query {
  exportTableJson(
    tableId: "123"
    options: {
      format: FLAT
      prettyPrint: true
    }
  ) {
    success
    json
    nodeCount
  }
}
```

### Export HFI Protocol

```graphql
query {
  exportTableJson(
    tableId: "123"
    options: {
      format: HFI
      includeRelations: true
      includePositions: true
      includeThemes: true
    }
  ) {
    success
    json
    nodeCount
    warnings
  }
}
```

### Export with Filters

```graphql
query {
  exportTableJson(
    tableId: "123"
    options: {
      format: HFI
      nodeIds: ["1", "2", "3"]
      tags: ["important"]
    }
  ) {
    success
    json
    nodeCount
  }
}
```

## Type Guards

Runtime type checking utilities:

```typescript
import {
  isPathRef,
  isExprRef,
  isQueryNode,
  isEffectNode,
  isHFIProtocol,
  isFlatJsonExport,
  isFlatJsonPatchRequest,
  isHFIProtocolPatchRequest
} from '@/core/types/JsonExport'

// Check export format
if (isHFIProtocol(data)) {
  // data is HFIProtocolExport
  console.log(data.protocol) // 'HFI/1.1'
}

// Check node type
if (isQueryNode(node)) {
  // node has branches
  console.log(node.branches)
}

// Check patch request format
if (isFlatJsonPatchRequest(request)) {
  // request is FlatJsonPatchRequest
  console.log(request.tableId)
}
```

## Best Practices

1. **Format Selection**
   - Use `FLAT` for simple data exports and external integrations
   - Use `HFI` for graph visualization and flow-based processing

2. **Performance**
   - Use `nodeIds` filter for large tables
   - Set `prettyPrint: false` for production exports

3. **HFI Protocol**
   - Enable `includeRelations` to preserve graph structure
   - Use `includePositions` for visual layout preservation
   - State connections require explicit `includeStateConnections: true`

4. **Patching**
   - Use format-specific patch types for type safety
   - Always include target `id` in patch operations
   - Batch related patches in single request
