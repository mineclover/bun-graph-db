# Data Model: MCP Schema Synchronization & Dynamic Variable Mapping

**Feature**: MCP Schema Synchronization & Dynamic Variable Mapping
**Date**: 2025-01-19
**Phase**: Phase 1 - Design & Contracts

## Overview

This document defines the core entities, relationships, and data structures required for automatic GraphQL schema synchronization with MCP tool contracts.

## Core Entities

### 1. Schema Snapshot

**Purpose**: Represents a specific version of the GraphQL schema with change detection capabilities

**Fields**:
- `id`: UUID - Unique identifier for the snapshot
- `version`: String - Schema version identifier (semantic versioning)
- `hash`: String - SHA-256 hash of the introspection result for change detection
- `introspectionMetadata`: JSON - Full GraphQL introspection query result
- `timestamp`: DateTime - When the snapshot was created
- `status`: Enum - `healthy` | `degraded` | `failed`
- `changesSince`: String[] - Array of changes since previous version
- `isBreaking`: Boolean - Whether this version contains breaking changes
- `source`: Enum - `live` | `cache` | `fallback` | `static`

**Validation Rules**:
- `version` must follow semantic versioning (MAJOR.MINOR.PATCH)
- `hash` must be exactly 64 characters (SHA-256)
- `timestamp` must be valid ISO 8601 datetime
- `introspectionMetadata` must be valid GraphQL introspection result

**State Transitions**:
- `creating` → `healthy` (successful introspection)
- `creating` → `failed` (introspection failure)
- `healthy` → `degraded` (partial validation failure)
- `degraded` → `healthy` (validation recovery)
- `*` → `failed` (critical errors)

### 2. Contract Mapping

**Purpose**: Links MCP tool definitions to GraphQL operations with transformation metadata

**Fields**:
- `id`: UUID - Unique identifier for the mapping
- `mcpToolName`: String - Name of the MCP tool
- `graphqlOperation`: String - GraphQL operation (query/mutation/subscription)
- `operationType`: Enum - `query` | `mutation` | `subscription`
- `schemaSnapshotId`: UUID - Reference to Schema Snapshot
- `inputMapping`: JSON - Transformation rules for MCP arguments → GraphQL variables
- `outputMapping`: JSON - Transformation rules for GraphQL response → MCP response
- `validationRules`: JSON - JSON Schema validation for input arguments
- `status`: Enum - `active` | `deprecated` | `disabled` | `migrating`
- `createdAt`: DateTime - When the mapping was created
- `lastValidated`: DateTime - Last successful validation timestamp
- `compatibilityLevel`: Enum - `full` | `partial` | `limited` | `incompatible`

**Validation Rules**:
- `mcpToolName` must match existing MCP tool definitions
- `graphqlOperation` must be valid GraphQL syntax
- `inputMapping` and `outputMapping` must be valid JSONPath expressions
- `validationRules` must be valid JSON Schema

**Relationships**:
- Many-to-One with Schema Snapshot
- One-to-One with Variable Transformer

### 3. Variable Transformer

**Purpose**: Defines rules for converting MCP tool arguments into GraphQL operation variables and vice versa

**Fields**:
- `id`: UUID - Unique identifier for the transformer
- `contractMappingId`: UUID - Reference to Contract Mapping
- `transformationRules`: JSON - Bidirectional transformation rules
- `scalarMappings`: JSON - Custom scalar type conversions
- `validationSchema`: JSON - JSON Schema for input validation
- `defaultValues`: JSON - Default values for optional parameters
- `errorHandling`: JSON - Error handling strategies and fallback values
- `performanceHints`: JSON - Optimization hints for transformation
- `version`: String - Transformer version for compatibility tracking

**Transformation Rule Structure**:
```json
{
  "toGraphQL": {
    "variables": {
      "tableId": "$.arguments.tableId",
      "content": "$.arguments.content",
      "metadata": "$.arguments.metadata || {}"
    },
    "scalars": {
      "DateTime": "toISOString",
      "UUID": "validateUUID",
      "JSON": "stringify"
    }
  },
  "fromGraphQL": {
    "response": {
      "data": "$.data",
      "errors": "$.errors",
      "success": "!$.errors"
    },
    "scalars": {
      "DateTime": "parseDate",
      "UUID": "passthrough",
      "JSON": "parse"
    }
  }
}
```

**Validation Rules**:
- `transformationRules` must contain both `toGraphQL` and `fromGraphQL` sections
- JSONPath expressions must be syntactically valid
- Scalar mappings must reference registered scalar types
- Default values must match target parameter types

### 4. Sync Event

**Purpose**: Records schema synchronization activities, changes, and audit trail

**Fields**:
- `id`: UUID - Unique identifier for the event
- `eventType`: Enum - `schema_detected` | `sync_triggered` | `mapping_updated` | `validation_failed` | `rollback_performed`
- `schemaSnapshotId`: UUID - Reference to Schema Snapshot (nullable)
- `changesDetected`: JSON - Array of specific changes found
- `affectedMappings`: UUID[] - Array of Contract Mapping IDs affected
- `syncDuration`: Integer - Time taken for sync operation (milliseconds)
- `errors`: JSON - Array of errors encountered during sync
- `metadata`: JSON - Additional context and debugging information
- `triggeredBy`: Enum - `scheduled` | `webhook` | `manual` | `health_check`
- `timestamp`: DateTime - When the event occurred
- `severity`: Enum - `info` | `warning` | `error` | `critical`

**Event Payload Examples**:
```json
{
  "eventType": "schema_detected",
  "changesDetected": [
    {
      "type": "FIELD_ADDED",
      "path": "Query.searchNodes",
      "field": "includeMetadata",
      "fieldType": "Boolean",
      "breaking": false
    },
    {
      "type": "TYPE_DEPRECATED",
      "path": "User.email",
      "reason": "Use contactInfo.email instead",
      "breaking": false
    }
  ],
  "affectedMappings": ["uuid1", "uuid2"],
  "metadata": {
    "previousVersion": "1.2.3",
    "newVersion": "1.3.0",
    "introspectionLatency": 45
  }
}
```

## Entity Relationships

### Primary Relationships

```
Schema Snapshot (1) ←→ (Many) Contract Mapping
Contract Mapping (1) ←→ (1) Variable Transformer
Schema Snapshot (1) ←→ (Many) Sync Event
Contract Mapping (Many) ←→ (Many) Sync Event (via affectedMappings)
```

### Relationship Constraints

1. **Schema Snapshot → Contract Mapping**
   - One schema version can have multiple tool mappings
   - Contract mappings must reference valid schema snapshots
   - Orphaned mappings (invalid schema references) are marked as `disabled`

2. **Contract Mapping → Variable Transformer**
   - One-to-one relationship (each mapping has exactly one transformer)
   - Transformers cannot exist without a parent mapping
   - Cascade delete: removing mapping removes transformer

3. **Schema Snapshot → Sync Event**
   - Events can reference schema snapshots (for schema-related events)
   - Some events (like validation failures) may not have schema references
   - Sync events provide audit trail for schema changes

4. **Sync Event ← Contract Mapping**
   - Many-to-many through `affectedMappings` array
   - Tracks which tools were impacted by schema changes
   - Enables targeted notifications and rollback procedures

## Data Storage Strategy

### SQLite Schema Design

Based on the existing SQLite infrastructure in the codebase:

```sql
-- Schema Snapshots table
CREATE TABLE schema_snapshots (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    introspection_metadata TEXT NOT NULL, -- JSON
    timestamp DATETIME NOT NULL,
    status TEXT CHECK(status IN ('healthy', 'degraded', 'failed')) NOT NULL,
    changes_since TEXT, -- JSON array
    is_breaking BOOLEAN NOT NULL DEFAULT 0,
    source TEXT CHECK(source IN ('live', 'cache', 'fallback', 'static')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contract Mappings table
CREATE TABLE contract_mappings (
    id TEXT PRIMARY KEY,
    mcp_tool_name TEXT NOT NULL,
    graphql_operation TEXT NOT NULL,
    operation_type TEXT CHECK(operation_type IN ('query', 'mutation', 'subscription')) NOT NULL,
    schema_snapshot_id TEXT NOT NULL,
    input_mapping TEXT NOT NULL, -- JSON
    output_mapping TEXT NOT NULL, -- JSON
    validation_rules TEXT NOT NULL, -- JSON Schema
    status TEXT CHECK(status IN ('active', 'deprecated', 'disabled', 'migrating')) NOT NULL,
    compatibility_level TEXT CHECK(compatibility_level IN ('full', 'partial', 'limited', 'incompatible')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_validated DATETIME,
    FOREIGN KEY (schema_snapshot_id) REFERENCES schema_snapshots(id) ON DELETE CASCADE
);

-- Variable Transformers table
CREATE TABLE variable_transformers (
    id TEXT PRIMARY KEY,
    contract_mapping_id TEXT NOT NULL UNIQUE,
    transformation_rules TEXT NOT NULL, -- JSON
    scalar_mappings TEXT NOT NULL, -- JSON
    validation_schema TEXT NOT NULL, -- JSON Schema
    default_values TEXT, -- JSON
    error_handling TEXT, -- JSON
    performance_hints TEXT, -- JSON
    version TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_mapping_id) REFERENCES contract_mappings(id) ON DELETE CASCADE
);

-- Sync Events table
CREATE TABLE sync_events (
    id TEXT PRIMARY KEY,
    event_type TEXT CHECK(event_type IN ('schema_detected', 'sync_triggered', 'mapping_updated', 'validation_failed', 'rollback_performed')) NOT NULL,
    schema_snapshot_id TEXT NULL,
    changes_detected TEXT, -- JSON array
    affected_mappings TEXT, -- JSON array of UUIDs
    sync_duration INTEGER, -- milliseconds
    errors TEXT, -- JSON array
    metadata TEXT, -- JSON
    triggered_by TEXT CHECK(triggered_by IN ('scheduled', 'webhook', 'manual', 'health_check')) NOT NULL,
    severity TEXT CHECK(severity IN ('info', 'warning', 'error', 'critical')) NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schema_snapshot_id) REFERENCES schema_snapshots(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_schema_snapshots_version ON schema_snapshots(version);
CREATE INDEX idx_schema_snapshots_timestamp ON schema_snapshots(timestamp DESC);
CREATE INDEX idx_contract_mappings_tool_name ON contract_mappings(mcp_tool_name);
CREATE INDEX idx_contract_mappings_schema_id ON contract_mappings(schema_snapshot_id);
CREATE INDEX idx_sync_events_timestamp ON sync_events(timestamp DESC);
CREATE INDEX idx_sync_events_type ON sync_events(event_type);
```

### Caching Strategy

1. **In-Memory Cache**: Current active schema snapshot and frequently used mappings
2. **Persistent Cache**: Disk-based cache for schema snapshots (1-hour TTL)
3. **CDN Cache**: Static schema artifacts for global distribution

### Backup and Recovery

1. **Schema Snapshots**: Retain last 10 versions for rollback capability
2. **Event Log**: Complete audit trail for compliance and debugging
3. **Point-in-Time Recovery**: Ability to reconstruct state at any timestamp

## Integration Points

### Existing Codebase Integration

1. **Models Directory** (`/src/models/`)
   - Add new model classes following existing patterns
   - Integrate with existing repository pattern

2. **Database Layer** (`/src/infrastructure/database/`)
   - Extend existing SQLite repository implementations
   - Use existing connection management and transaction handling

3. **GraphQL Schema** (`/src/presentation/graphql/`)
   - Add new types and resolvers for schema sync operations
   - Integrate with existing schema building pipeline

### External Dependencies

1. **GraphQL Introspection**: Standard GraphQL introspection queries
2. **JSON Schema Validation**: For input/output validation
3. **JSONPath**: For transformation rule evaluation
4. **Crypto APIs**: For hash generation and validation

This data model provides a solid foundation for implementing the MCP schema synchronization system while integrating seamlessly with the existing bun-graph-db architecture.