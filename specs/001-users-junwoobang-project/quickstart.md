# Quickstart: Table-Based Export/Import System

**Date**: 2025-01-16
**Feature**: Table-Based Data Export/Import System

## Overview

This quickstart guide demonstrates the table export/import functionality with hands-on examples that validate the feature requirements from the specification.

## Prerequisites

- Bun runtime installed and configured
- Graph database server running on `http://localhost:4000`
- Sample tables with data available in the database
- Write permissions to the filesystem for export directories

## Quick Start Examples

### Example 1: Single Table Export

**Scenario**: Export a "Users" table with its schema, data, and relationships

```bash
# Start the development server
bun run dev

# Open GraphQL playground at http://localhost:4000/graphql
```

**GraphQL Mutation**:
```graphql
mutation ExportUsersTable {
  exportTable(input: {
    tableId: "users_table_id"
    options: {
      outputDirectory: "./exports"
      includeData: true
      includeRelatedTables: false
    }
  }) {
    success
    exportId
    packagePaths
    totalSize
    recordCount
    duration
    errors {
      code
      message
      details
    }
  }
}
```

**Expected Result**:
```
exports/
└── Users/
    ├── schema.json     # Table structure and attributes
    ├── dataset.json    # User records data
    ├── relations.json  # Relationship definitions
    └── templates.json  # Auto-generated CRUD templates
```

**Validation Steps**:
1. ✅ Folder created with table name "Users"
2. ✅ Four JSON files present with correct names
3. ✅ Schema.json contains table attributes and types
4. ✅ Dataset.json contains user records
5. ✅ Templates.json includes createNode_Users, updateNode_Users, deleteNode_Users, getNode_Users, searchNodes_Users

### Example 2: Multiple Related Tables Export

**Scenario**: Export "Posts" table with its dependencies (Users, Categories)

```graphql
mutation ExportRelatedTables {
  exportTable(input: {
    tableId: "posts_table_id"
    includeRelatedTables: true
    options: {
      outputDirectory: "./exports"
    }
  }) {
    success
    packagePaths
    errors {
      code
      message
    }
  }
}
```

**Expected Result**:
```
exports/
├── Users/      # Dependency table
│   ├── schema.json
│   ├── dataset.json
│   ├── relations.json
│   └── templates.json
├── Categories/ # Another dependency
│   └── [same structure]
├── Posts/      # Main table
│   └── [same structure]
└── manifest.json # Package metadata
```

**Validation Steps**:
1. ✅ All dependent tables exported automatically
2. ✅ Manifest.json contains dependency order information
3. ✅ Relations.json in Posts references Users and Categories

### Example 3: Table Package Import

**Scenario**: Import the exported Users table into a clean database

```graphql
mutation ImportUsersPackage {
  importTablePackage(input: {
    packagePath: "./exports/Users"
    options: {
      conflictResolution: ASK_USER
      enableRollback: true
    }
  }) {
    success
    sessionId
    importedTables
    totalRecords
    conflicts {
      id
      type
      message
      resolutionOptions
    }
    errors {
      code
      message
    }
  }
}
```

**Expected Result**:
- Table recreated with exact schema from schema.json
- All user records imported from dataset.json
- Relationships established from relations.json
- Templates created and available in template system

**Validation Steps**:
1. ✅ Table exists with correct identifier and description
2. ✅ All attributes match exported schema
3. ✅ Record count matches exported dataset
4. ✅ Generated templates are available and functional

### Example 4: Conflict Resolution

**Scenario**: Import table when a table with the same name already exists

```graphql
# First mutation returns conflicts
mutation ImportWithConflicts {
  importTablePackage(input: {
    packagePath: "./exports/Users"
  }) {
    success
    sessionId
    conflicts {
      id
      type
      resolutionOptions
    }
  }
}

# Resolve conflicts with user choice
mutation ResolveConflicts {
  resolveImportConflicts(input: {
    sessionId: "session_id_from_above"
    resolutions: [{
      conflictId: "conflict_id_from_above"
      resolution: MERGE
    }]
  }) {
    success
    resolvedConflicts
    remainingConflicts
  }
}
```

**Validation Steps**:
1. ✅ System detects existing table conflict
2. ✅ User presented with resolution options (OVERWRITE, MERGE, RENAME)
3. ✅ Chosen resolution (MERGE) executed successfully
4. ✅ Data from both sources preserved according to merge strategy

### Example 5: Bulk Import with Dependencies

**Scenario**: Import multiple table packages with automatic dependency resolution

```graphql
mutation BulkImport {
  importTablePackage(input: {
    packagePaths: [
      "./exports/Users",
      "./exports/Categories",
      "./exports/Posts"
    ]
    options: {
      conflictResolution: RENAME_ALL
    }
  }) {
    success
    sessionId
    importedTables
  }
}

# Monitor import progress
query MonitorImport {
  getImportSession(sessionId: "session_id") {
    status
    progress {
      percentage
      currentTable
      currentOperation
      estimatedTimeRemaining
    }
  }
}
```

**Validation Steps**:
1. ✅ Import order determined automatically (Users → Categories → Posts)
2. ✅ Progress tracking shows current table and operation
3. ✅ All tables imported successfully with correct relationships
4. ✅ Conflicting tables renamed automatically

## Template Generation Validation

After any table import, verify auto-generated templates:

```graphql
query ListGeneratedTemplates {
  searchTemplates(filter: {
    tags: ["export-import", "table-package"]
  }) {
    nodes {
      identifier
      name
      tags
      operationType
      query
    }
  }
}
```

**Expected Template Patterns**:
- `createNode_Users`: Creates new user records
- `updateNode_Users`: Updates existing user records
- `deleteNode_Users`: Deletes user records
- `getNode_Users`: Retrieves user by ID
- `searchNodes_Users`: Searches users with filters

**Template Validation**:
1. ✅ All 5 template types generated for each imported table
2. ✅ Templates follow existing export format (version, exportedAt, template object)
3. ✅ Correct tags applied: [table_name, operation_type, "export-import", "table-package"]
4. ✅ GraphQL queries are syntactically valid and table-specific

## Error Scenarios Testing

### Invalid Package Import
```graphql
mutation ImportInvalidPackage {
  importTablePackage(input: {
    packagePath: "./exports/NonExistent"
  }) {
    success
    errors {
      code
      message
    }
  }
}
```

**Expected**: Clear error message about missing package directory

### Schema Compatibility Check
```graphql
query ValidatePackage {
  validateTablePackage(packagePath: "./exports/Users") {
    valid
    errors {
      code
      message
    }
    warnings {
      code
      recommendation
    }
  }
}
```

**Expected**: Validation results with specific compatibility issues if any

## Performance Testing

### Large Table Export
Test with tables containing 10,000+ records to verify:
1. ✅ Streaming processing (memory usage stays constant)
2. ✅ Progress reporting (updates every 1000 records)
3. ✅ Completion time within performance goals (<30s)

### Concurrent Operations
Test multiple export/import operations simultaneously:
1. ✅ Operations don't interfere with each other
2. ✅ File system locks prevent corruption
3. ✅ Session management tracks each operation independently

## Success Criteria

This quickstart validates all functional requirements from the specification:

- **FR-001** ✅: Table packages organized in folder structures named after table identifiers
- **FR-002** ✅: Four JSON files generated per table (schema, dataset, relations, templates)
- **FR-003** ✅: Automatic import order determination based on dependencies
- **FR-004** ✅: JSON validation and schema compatibility checking
- **FR-005** ✅: Conflict resolution options (overwrite, merge, rename)
- **FR-006** ✅: Auto-generated query templates for CRUD operations
- **FR-007** ✅: Circular dependency detection and handling
- **FR-008** ✅: Selective table export (single or multiple tables)
- **FR-009** ✅: Progress tracking and error reporting
- **FR-010** ✅: Relationship integrity validation after import
- **FR-014** ✅: Templates follow existing export format exactly
- **FR-016** ✅: Table-specific CRUD templates generated
- **FR-017** ✅: Appropriate tags assigned to generated templates

## Next Steps

After completing this quickstart:

1. **Integration Testing**: Run the complete test suite to ensure no regressions
2. **Performance Benchmarking**: Test with production-sized datasets
3. **User Acceptance**: Validate workflows match developer expectations
4. **Documentation**: Update API documentation with new mutations and types