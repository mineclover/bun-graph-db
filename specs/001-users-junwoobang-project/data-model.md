# Data Model: Table-Based Export/Import System

**Date**: 2025-01-16
**Feature**: Table-Based Data Export/Import System

## Core Entities

### 1. TablePackage
**Purpose**: Represents a complete table export package containing all components needed for recreation

**Fields**:
- `tableId: string` - Unique identifier of the source table
- `tableName: string` - Human-readable table name
- `version: string` - Package version (semantic versioning)
- `exportedAt: Date` - Timestamp of package creation
- `packagePath: string` - File system path to package folder
- `dependencies: string[]` - List of table IDs this package depends on
- `size: number` - Total package size in bytes
- `recordCount: number` - Number of data records included

**Relationships**:
- References source Table entity
- Contains SchemaDefinition, DatasetCollection, RelationshipMapping, TemplateSet

**Validation Rules**:
- `tableId` must correspond to existing table
- `version` must follow semantic versioning (MAJOR.MINOR.PATCH)
- `packagePath` must be valid file system path
- `dependencies` must reference existing table IDs

### 2. SchemaDefinition
**Purpose**: JSON representation of table structure, attributes, types, and constraints

**Fields**:
- `tableId: string` - Reference to parent table
- `identifier: string` - Table identifier
- `description: string` - Table description
- `attributes: AttributeSchema[]` - Array of attribute definitions
- `constraints: ConstraintSchema[]` - Table-level constraints
- `metadata: object` - Additional table metadata
- `schemaVersion: string` - Schema format version

**AttributeSchema Structure**:
```typescript
{
  id: string
  identifier: string
  name: string
  type: AttributeType
  isRequired: boolean
  defaultValue?: any
  constraints?: string[]
  metadata?: object
}
```

**Validation Rules**:
- All attribute IDs must be unique within table
- Required attributes cannot have null default values
- Constraint references must be valid

### 3. DatasetCollection
**Purpose**: Complete table data with proper formatting and relationship references

**Fields**:
- `tableId: string` - Reference to parent table
- `records: NodeRecord[]` - Array of table data records
- `totalCount: number` - Total number of records
- `exportedAt: Date` - Data extraction timestamp
- `formatVersion: string` - Data format version

**NodeRecord Structure**:
```typescript
{
  id: string
  content: string
  attributes: Record<string, any>
  relationships: RelationshipReference[]
  metadata: {
    createdAt: Date
    updatedAt: Date
    version: number
  }
}
```

**Validation Rules**:
- All record IDs must be unique
- Attribute values must match schema types
- Relationship references must be valid

### 4. RelationshipMapping
**Purpose**: Defines table relationships and dependency ordering for imports

**Fields**:
- `tableId: string` - Reference to parent table
- `incomingRelations: RelationDefinition[]` - Relations where this table is target
- `outgoingRelations: RelationDefinition[]` - Relations where this table is source
- `dependencyOrder: number` - Import order based on dependencies
- `circularDependencies: string[]` - List of circular dependency chains

**RelationDefinition Structure**:
```typescript
{
  id: string
  sourceTableId: string
  targetTableId: string
  relationType: string
  strength: number
  confidence: number
  metadata?: object
}
```

**Validation Rules**:
- Source and target table IDs must be valid
- Strength and confidence must be between 0 and 1
- No self-referencing relations in circular dependency detection

### 5. TemplateSet
**Purpose**: Auto-generated query templates following existing export format

**Fields**:
- `tableId: string` - Reference to parent table
- `templates: QueryTemplate[]` - Array of generated templates
- `generatedAt: Date` - Template generation timestamp
- `templateVersion: string` - Template format version

**QueryTemplate Structure** (matches existing format):
```typescript
{
  version: string
  exportedAt: string
  template: {
    id: string
    identifier: string
    name: string
    description: string
    query: string
    queryName: string[]
    operationType: 'query' | 'mutation' | 'subscription'
    variables: object
    variablesSchema: object
    defaultVariables: object
    applicableTables: string[]
    complexityScore: number
    version: string
    tags: string[]
    isActive: boolean
    statistics: {
      usageCount: number
      avgExecutionTimeMs: number
      lastUsedAt: string | null
    }
  }
}
```

**Template Types Generated**:
- `createNode_{tableName}`: Create new record
- `updateNode_{tableName}`: Update existing record
- `deleteNode_{tableName}`: Delete record
- `getNode_{tableName}`: Get record by ID
- `searchNodes_{tableName}`: Search records with filters

**Validation Rules**:
- Template identifiers must be unique
- GraphQL queries must be syntactically valid
- Complexity scores must be positive integers
- Tags must include table name and operation type

### 6. ImportSession
**Purpose**: Tracks active import operations with progress and rollback information

**Fields**:
- `sessionId: string` - Unique session identifier
- `packagePaths: string[]` - List of packages being imported
- `startedAt: Date` - Session start timestamp
- `status: ImportStatus` - Current session status
- `progress: ImportProgress` - Current progress information
- `conflicts: ConflictInfo[]` - Detected conflicts requiring resolution
- `rollbackInfo: RollbackInfo` - Information for operation rollback

**ImportStatus Enum**: 'pending' | 'analyzing' | 'importing' | 'completed' | 'failed' | 'rolled_back'

**ImportProgress Structure**:
```typescript
{
  totalTables: number
  processedTables: number
  currentTable: string
  currentOperation: string
  estimatedTimeRemaining: number
}
```

**ConflictInfo Structure**:
```typescript
{
  type: 'table_exists' | 'schema_mismatch' | 'data_conflict'
  tableId: string
  message: string
  resolutionOptions: string[]
  userChoice?: string
}
```

**State Transitions**:
- pending → analyzing → importing → completed
- Any state → failed → rolled_back
- analyzing → pending (on conflict requiring user input)

### 7. ExportManifest
**Purpose**: Package-level metadata for version compatibility and validation

**Fields**:
- `manifestVersion: string` - Manifest format version
- `exportId: string` - Unique export operation identifier
- `exportedAt: Date` - Export timestamp
- `sourceSystem: SystemInfo` - Information about source system
- `packages: PackageInfo[]` - List of included table packages
- `totalSize: number` - Total export size in bytes
- `checksum: string` - Integrity verification checksum

**SystemInfo Structure**:
```typescript
{
  systemVersion: string
  databaseVersion: string
  schemaVersion: string
  exportToolVersion: string
}
```

**PackageInfo Structure**:
```typescript
{
  tableId: string
  tableName: string
  recordCount: number
  size: number
  dependencies: string[]
  checksum: string
}
```

## Domain Rules

### Export Rules
1. Tables with dependencies must include dependency information
2. Schema export must include all attribute definitions and constraints
3. Data export must maintain referential integrity
4. Templates must be generated for all standard CRUD operations

### Import Rules
1. Dependencies must be satisfied before importing dependent tables
2. Schema compatibility must be validated before data import
3. Conflicts must be resolved before proceeding with import
4. Rollback must be available until import is committed

### Validation Rules
1. All JSON files must be valid and parseable
2. Schema versions must be compatible between export and import systems
3. Data types must match schema definitions
4. Relationship references must be resolvable

### Performance Rules
1. Large datasets must be processed in batches
2. Progress must be reported for operations exceeding 5 seconds
3. Memory usage must be bounded for large table exports
4. File I/O must be optimized for sequential access patterns

## Integration with Existing Domain

### Table Entity Extensions
- Add export/import status tracking
- Include package generation metadata
- Track export history and statistics

### Template Entity Integration
- Auto-generated templates follow existing format exactly
- Generated templates inherit from base template entity
- Template tags distinguish auto-generated from manual templates

### Repository Pattern Extensions
- TablePackageRepository for package CRUD operations
- ImportSessionRepository for session management
- Leverage existing TableRepository, NodeRepository, RelationRepository

This data model extends the existing domain entities while maintaining compatibility with the current hexagonal architecture and repository patterns.