# Relation Type Naming Convention

## Overview

This document establishes the camelCase naming convention for relation type identifiers in the Bun Graph Database system.

## Naming Convention

### Standard: camelCase

All relation type identifiers must use **camelCase** naming convention to maintain consistency with TypeScript/JavaScript code style throughout the codebase.

### Examples

| ✅ Correct (camelCase) | ❌ Incorrect (snake_case) |
|----------------------|-------------------------|
| `dependsOn`          | `depends_on`           |
| `relatedTo`          | `related_to`           |
| `parentOf`           | `parent_of`            |
| `linkedTo`           | `linked_to`            |
| `extends`            | `extends` (already correct) |
| `implements`         | `implements` (already correct) |
| `references`         | `references` (already correct) |

## Default Relation Types

The system provides the following default relation types:

```sql
INSERT OR IGNORE INTO relation_types (identifier, description, category) VALUES
  ('dependsOn', 'Direct dependency', 'structural'),
  ('relatedTo', 'Related entity', 'semantic'),
  ('extends', 'Extension relationship', 'hierarchy'),
  ('implements', 'Implementation relationship', 'structural'),
  ('references', 'Reference relationship', 'reference'),
  ('parentOf', 'Parent-child relationship', 'hierarchy'),
  ('linkedTo', 'Bidirectional link', 'semantic');
```

## Migration from snake_case

### Migration Script

For existing databases with snake_case relation type identifiers, use the migration script:

```bash
sqlite3 data/bun-graph-db.sqlite < scripts/migrate-relation-types-to-camelcase.sql
```

### Migration Details

The migration updates the following identifiers:
- `depends_on` → `dependsOn`
- `related_to` → `relatedTo`
- `parent_of` → `parentOf`
- `linked_to` → `linkedTo`

## Implementation Guidelines

### When Creating New Relation Types

1. **Always use camelCase**: Start with lowercase, capitalize subsequent words
2. **Be descriptive**: Use clear, meaningful names that describe the relationship
3. **Follow patterns**: Use consistent verb forms (e.g., "dependsOn", "relatedTo")

### Code Examples

#### GraphQL Mutations
```typescript
mutation {
  createRelation(input: {
    fromNodeId: "123"
    toNodeId: "456"
    relationTypeId: "dependsOn"  // camelCase
    properties: "{}"
  }) {
    success
    relation {
      id
      relationType {
        identifier  // Will be "dependsOn"
      }
    }
  }
}
```

#### TypeScript Code
```typescript
// Good: camelCase
const relationTypeId = 'dependsOn';
const relatedToType = 'relatedTo';

// Bad: snake_case
const relationTypeId = 'depends_on';  // ❌
```

### Database Schema Updates

When updating schema files:

```sql
-- Good: camelCase in new relation types
INSERT INTO relation_types (identifier, description, category) VALUES
  ('belongsTo', 'Ownership relationship', 'structural');

-- Bad: snake_case
INSERT INTO relation_types (identifier, description, category) VALUES
  ('belongs_to', 'Ownership relationship', 'structural');  -- ❌
```

## Testing Guidelines

### Test Data

Test fixtures should use camelCase relation type identifiers:

```typescript
// tests/fixtures/test-database-factory.ts
INSERT OR IGNORE INTO relation_types (identifier, description, category) VALUES
  ('dependsOn', 'Direct dependency', 'structural'),
  ('relatedTo', 'Related entity', 'semantic'),
  // ... other camelCase identifiers
```

### Test Cases

Test code should verify camelCase naming:

```typescript
describe('Relation Types', () => {
  it('should use camelCase identifiers', async () => {
    const relationType = await repository.findByIdentifier('dependsOn');
    expect(relationType.identifier).toBe('dependsOn');
    expect(relationType.identifier).not.toBe('depends_on');  // snake_case
  });
});
```

## Consistency Across Codebase

### File Locations Updated

The following files have been updated to use camelCase:

1. **Schema Files**:
   - `core/schema.sql` - Default relation types
   - `tests/fixtures/test-database-factory.ts` - Test fixtures

2. **Script Files**:
   - `scripts/unified-schema-enhancement.sql` - Updated references
   - `scripts/migrate-relation-types-to-camelcase.sql` - Migration script

### GraphQL Schema

The GraphQL schema automatically reflects the camelCase identifiers:

```graphql
type RelationType {
  id: ID!
  identifier: String!  # Will be camelCase: "dependsOn", "relatedTo", etc.
  description: String!
  category: String!
}
```

## Benefits of camelCase Convention

1. **Consistency**: Matches TypeScript/JavaScript naming conventions
2. **Readability**: Clear word boundaries without underscores
3. **Integration**: Better integration with frontend frameworks
4. **Standards**: Follows modern JavaScript/TypeScript best practices

## Backward Compatibility

### During Migration Period

- Old snake_case identifiers are updated via migration script
- No breaking changes to API functionality
- Existing relationships maintain their integrity (uses ID references)

### Post-Migration

- All new relation types must use camelCase
- Documentation and examples use camelCase
- Code reviews should enforce camelCase convention

## Troubleshooting

### Common Issues

1. **Mixed Naming**: If you see both `depends_on` and `dependsOn`:
   - Run the migration script
   - Check for test data creating duplicates

2. **API Inconsistencies**:
   - Verify GraphQL queries use correct identifiers
   - Update any hardcoded strings in application code

3. **Test Failures**:
   - Update test expectations to use camelCase
   - Verify test fixtures use new naming convention

### Verification Queries

```sql
-- Check all relation type identifiers
SELECT identifier FROM relation_types ORDER BY identifier;

-- Find any snake_case patterns (should return empty after migration)
SELECT identifier FROM relation_types WHERE identifier LIKE '%_%';

-- Count relations by type
SELECT rt.identifier, COUNT(nr.id) as relation_count
FROM relation_types rt
LEFT JOIN node_relations nr ON rt.id = nr.relation_type_id
GROUP BY rt.identifier
ORDER BY relation_count DESC;
```

## Conclusion

The camelCase naming convention for relation type identifiers provides consistency, readability, and better integration with the TypeScript/JavaScript ecosystem. All new development should follow this convention, and existing systems should be migrated using the provided migration script.