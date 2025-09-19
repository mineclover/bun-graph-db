# Table-Based Data Export/Import System

A comprehensive system for selective table package export/import with dependency resolution and auto-generated templates, implementing the requirements from [Feature Specification: Table-Based Data Export/Import System](../specs/001-users-junwoobang-project/spec.md).

## Overview

The Table Package System allows you to:

- **Export individual tables** as self-contained packages
- **Import table packages** with conflict resolution
- **Resolve dependencies** automatically for correct import order
- **Generate query templates** automatically for exported tables
- **Batch operations** for multiple tables simultaneously
- **Roll back imports** when operations fail
- **Track import sessions** for complex operations

## Table Package Format

Each exported table creates a structured package containing:

```
Users/
├── schema.json      # Table structure, attributes, and types
├── dataset.json     # Node data and attributes
├── relations.json   # Relationships and relation types
└── templates.json   # Query templates with full metadata
```

### Package Structure

```typescript
interface TablePackageFormat {
  version: string                    // Package format version
  exportedAt: string                // Export timestamp
  sourceTable: {
    identifier: string               // Table identifier
    description: string | null       // Table description
  }
  dependencies: string[]             // Required table dependencies
  package: {
    schema: TableSchemaExport        // Table structure
    dataset: TableDataExport         // Table data
    relations: TableRelationsExport  // Relationships
    templates: TableTemplatesExport  // Query templates
  }
}
```

## CLI Usage

### Basic Operations

```bash
# Export a single table
bun run table:export users --output ./packages/users.json

# Import a table package
bun run table:import ./packages/users.json --conflict rename

# Batch export multiple tables
bun run table:batch-export users posts comments --output-dir ./packages

# Batch import multiple packages
bun run table:batch-import ./packages/*.json --conflict overwrite
```

### Advanced Operations

```bash
# Analyze table dependencies
bun run table:analyze-deps users

# Resolve import order for multiple tables
bun run table:resolve-order users posts comments

# Generate CRUD templates for a table
bun run table:generate-templates users --no-delete

# Validate a package before import
bun run table:validate ./packages/users.json
```

### Export Options

```bash
# Export with specific options
bun run table:export users \
  --output ./packages/users.json \
  --no-data \
  --statistics \
  --no-dependencies \
  --compact
```

Available export options:
- `--output <path>` - Output file path
- `--no-data` - Exclude node data
- `--no-relations` - Exclude relationships
- `--no-templates` - Exclude query templates
- `--statistics` - Include usage statistics
- `--no-dependencies` - Skip dependency resolution
- `--compact` - Compact JSON output

### Import Options

```bash
# Import with conflict resolution
bun run table:import ./packages/users.json \
  --conflict rename \
  --prefix imported_ \
  --no-validate \
  --no-generate
```

Available import options:
- `--conflict <strategy>` - Conflict resolution: `overwrite`, `merge`, `rename`, `skip`
- `--no-data` - Skip node data import
- `--no-relations` - Skip relationships import
- `--no-templates` - Skip templates import
- `--no-preserve-stats` - Don't preserve statistics
- `--no-validate` - Skip integrity validation
- `--no-generate` - Skip template generation
- `--prefix <string>` - Prefix for renamed tables
- `--no-session` - Don't create import session

## GraphQL API

### Queries

```graphql
# Export a single table
query ExportTable {
  exportTablePackage(
    tableIdentifier: "users"
    options: {
      includeData: true
      includeRelations: true
      includeTemplates: true
      resolveDependencies: true
    }
  ) {
    success
    tablePackage {
      version
      exportedAt
      sourceTable {
        identifier
        description
      }
      dependencies
      package {
        schema { ... }
        dataset { ... }
        relations { ... }
        templates { ... }
      }
    }
    dependencyOrder
    errors
    warnings
  }
}

# Analyze table dependencies
query AnalyzeDependencies {
  analyzeTableDependencies(tableIdentifier: "users") {
    tableIdentifier
    dependencies
    dependents
    depth
    circularReferences
  }
}

# Validate a package before import
query ValidatePackage {
  validateTablePackage(
    packageData: $packageJson
    options: { conflictResolution: SKIP }
  ) {
    type
    severity
    message
    context {
      tableName
      templateName
      attributeName
    }
    suggestedResolution
  }
}
```

### Mutations

```graphql
# Import a table package
mutation ImportTable {
  importTablePackage(
    packageData: $packageJson
    options: {
      conflictResolution: RENAME
      importData: true
      importRelations: true
      importTemplates: true
      generateTemplates: true
    }
  ) {
    success
    importedTable {
      id
      identifier
      originalIdentifier
    }
    generatedTemplates {
      id
      identifier
      name
      operationType
    }
    resolvedConflicts {
      type
      originalName
      resolvedName
      action
    }
    errors
    warnings
  }
}

# Batch import multiple packages
mutation BatchImport {
  batchImportTablePackages(
    input: {
      packages: [$package1, $package2, $package3]
      options: { conflictResolution: OVERWRITE }
      createSession: true
    }
  ) {
    success
    results {
      success
      importedTable { ... }
      generatedTemplates { ... }
      errors
    }
    importedCount
    failedCount
    session {
      sessionId
      status
      packagesImported
      packagesRemaining
    }
    errors
  }
}

# Generate templates for a table
mutation GenerateTemplates {
  generateTableTemplates(
    tableIdentifier: "users"
    options: {
      includeCreate: true
      includeRead: true
      includeUpdate: true
      includeDelete: false
      includeSearch: true
      includeBatch: false
    }
  ) {
    success
    templates {
      id
      identifier
      name
      operationType
    }
    errors
  }
}
```

## Dependency Management

The system automatically resolves table dependencies to ensure correct import order:

### Dependency Analysis

```bash
# Analyze dependencies for a specific table
bun run table:analyze-deps users
```

Output:
```
🔍 Analyzing dependencies for table: users

📊 Dependency Analysis:
Table: users
Depth: 1

⬇️  Dependencies (tables this table depends on):
   - user_roles
   - user_profiles

⬆️  Dependents (tables that depend on this table):
   - posts
   - comments
   - notifications

✅ No circular dependencies found
```

### Import Order Resolution

```bash
# Resolve import order for multiple tables
bun run table:resolve-order users posts comments user_roles
```

Output:
```
🔍 Resolving import order for 4 tables...

📋 Recommended Import Order:
1. user_roles
2. users
3. posts
4. comments

💡 Import in this order to resolve dependencies correctly
```

## Template Generation

The system automatically generates CRUD templates for imported tables following the existing export format:

### Generated Template Structure

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-01-16T12:00:00Z",
  "template": {
    "identifier": "create-users",
    "name": "Create Users",
    "description": "Auto-generated CREATE template for users table",
    "query": "mutation CreateUsers($input: CreateUsersInput!) { ... }",
    "queryName": ["createUsers"],
    "operationType": "mutation",
    "variables": null,
    "variablesSchema": { ... },
    "defaultVariables": null,
    "applicableTables": ["users"],
    "complexityScore": 2,
    "version": "1.0.0",
    "tags": ["users", "mutation", "export-import", "table-package"],
    "isActive": true,
    "statistics": {
      "usageCount": 0,
      "avgExecutionTimeMs": 0,
      "lastUsedAt": null
    }
  }
}
```

### Template Types Generated

For each imported table, the system generates:

1. **Create Template** - `create-{table}` mutation
2. **Read Template** - `get-{table}` query
3. **Update Template** - `update-{table}` mutation
4. **Delete Template** - `delete-{table}` mutation
5. **Search Template** - `search-{table}` query

Example generated templates:
```bash
bun run table:generate-templates users
```

Output:
```
🔧 Generating templates for table: users

✅ Templates generated successfully!
📝 Generated 5 templates:
   - Create Users (mutation)
     Identifier: create-users
   - Get Users (query)
     Identifier: get-users
   - Update Users (mutation)
     Identifier: update-users
   - Delete Users (mutation)
     Identifier: delete-users
   - Search Users (query)
     Identifier: search-users
```

## Conflict Resolution

When importing tables that already exist, the system provides several conflict resolution strategies:

### Resolution Strategies

1. **Skip** (default) - Skip conflicting items, report errors
2. **Overwrite** - Replace existing items completely
3. **Merge** - Merge new data with existing data
4. **Rename** - Create new items with modified names

### Example: Rename Strategy

```bash
bun run table:import ./packages/users.json --conflict rename --prefix imported_
```

This will:
- Rename `users` table to `imported_users`
- Update all references and dependencies
- Generate templates for the new table name
- Report all renamed items

## Error Handling and Rollback

### Import Sessions

For complex operations, the system creates import sessions to track progress:

```graphql
# Create an import session
mutation CreateSession {
  createImportSession(packages: [$package1, $package2]) {
    sessionId
    status
    packagesImported
    packagesRemaining
    rollbackInfo {
      tablesCreated
      templatesCreated
      nodesCreated
    }
  }
}

# Get session status
query GetSession {
  getImportSession(sessionId: "import_123456") {
    sessionId
    status
    startedAt
    completedAt
    packagesImported
    packagesRemaining
    errors
  }
}

# Rollback failed import
mutation RollbackSession {
  rollbackImportSession(sessionId: "import_123456") {
    sessionId
    status
    completedAt
  }
}
```

### Rollback Capability

If an import fails partway through, the system can automatically roll back:

1. **Delete created templates** - Remove any templates that were created
2. **Delete created nodes** - Remove imported node data
3. **Delete created tables** - Remove table structures (cascade deletes attributes)
4. **Restore system state** - Return to pre-import state

## File System Operations

### Export to File

```graphql
mutation ExportToFile {
  exportTablePackageToFile(
    tableIdentifier: "users"
    outputPath: "/path/to/users.json"
    options: { prettyPrint: true }
  ) {
    success
    packagePath
    errors
  }
}
```

### Import from File

```graphql
mutation ImportFromFile {
  importTablePackageFromFile(
    filePath: "/path/to/users.json"
    options: { conflictResolution: RENAME }
  ) {
    success
    importedTable { ... }
    generatedTemplates { ... }
    errors
  }
}
```

## Best Practices

### Export Guidelines

1. **Resolve Dependencies** - Always export with `resolveDependencies: true` for complete packages
2. **Include Templates** - Export templates to maintain query functionality
3. **Use Pretty Print** - Enable for human-readable packages
4. **Document Purpose** - Include descriptive table descriptions

### Import Guidelines

1. **Validate First** - Always validate packages before importing
2. **Analyze Dependencies** - Check dependency requirements
3. **Choose Resolution Strategy** - Select appropriate conflict resolution
4. **Monitor Sessions** - Track import progress for complex operations
5. **Test in Development** - Import to development environment first

### Error Prevention

1. **Check Disk Space** - Ensure sufficient space for large exports
2. **Validate Syntax** - Check JSON syntax before importing
3. **Backup Data** - Create backups before large import operations
4. **Monitor Performance** - Track operation performance and timeouts

## Examples

### Complete Workflow Example

```bash
# 1. Analyze dependencies
bun run table:analyze-deps users

# 2. Export table with dependencies
bun run table:export users --output ./backup/users.json --statistics

# 3. Validate the exported package
bun run table:validate ./backup/users.json

# 4. Import to different environment
bun run table:import ./backup/users.json --conflict rename --prefix prod_

# 5. Generate additional templates if needed
bun run table:generate-templates prod_users --batch
```

### Batch Migration Example

```bash
# 1. Resolve import order
bun run table:resolve-order users posts comments notifications

# 2. Export all tables
bun run table:batch-export users posts comments notifications --output-dir ./migration

# 3. Import to new system
bun run table:batch-import ./migration/*.json --conflict overwrite --no-session
```

## Error Troubleshooting

### Common Issues

1. **Circular Dependencies**
   - Use `table:analyze-deps` to identify circular references
   - Break cycles by importing base tables first

2. **Missing Dependencies**
   - Check dependency requirements before import
   - Import dependencies in correct order

3. **Version Conflicts**
   - Validate package format version compatibility
   - Update packages if necessary

4. **Disk Space Issues**
   - Check available disk space before large exports
   - Use `--compact` flag to reduce file size

5. **Type Mismatches**
   - Validate attribute types are compatible
   - Check schema compatibility between systems

### Debug Information

Enable detailed logging:
```bash
# Set log level for debugging
export LOG_LEVEL=debug
bun run table:import ./packages/users.json --conflict overwrite
```

This system provides a comprehensive solution for table-based data migration, backup, and sharing while maintaining data integrity and providing powerful automation features.