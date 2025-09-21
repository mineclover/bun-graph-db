# Existing AttributeType System Analysis

## Current Architecture

### Repository Layer (IAttributeTypeRepository)
- **Basic Operations**: save, findById, findByIdentifier, findAll, delete, exists, count
- **Search Methods**: findByJsonType(jsonType, options) - type-based filtering
- **Batch Operations**: saveMany, findByIds, update

### Current Type-Based Search
- **findByJsonType()**: Filters attributes by jsonType field (string, number, boolean, etc.)
- **Basic pagination**: PaginationOptions with limit/offset
- **No advanced filtering**: No capability-based, category-based, or operator-based filtering

### GraphQL Interface
- **attributeTypes()**: Returns all attribute types with basic pagination (limit: 100)
- **attributeType(id)**: Single attribute type by ID
- **attributeTypeByIdentifier(identifier)**: Single attribute type by identifier
- **Table.attributeTypes**: Field resolver for table-specific attribute types

### Current Data Structure
```typescript
// Current AttributeType entity fields:
- id: AttributeTypeId
- identifier: string (e.g., "string", "integer", "date")  
- jsonType: string (JSON schema type)
- format: string (validation format)
- description: string
- validationSchema: string (JSON schema)
- referenceConfig: string
- defaultValue: string
- examples: string
- createdAt/updatedAt: Date
```

## Gap Analysis: Current vs New System

### Missing Capabilities
1. **No system type categorization** (primitive, temporal, textual, etc.)
2. **No data family grouping** (text, numeric, boolean, etc.)
3. **No capability metadata** (searchable, filterable, sortable, etc.)
4. **No filter operator support** (equals, contains, greater_than, etc.)
5. **No UI widget mapping** (text-input, date-picker, etc.)
6. **No advanced filtering/grouping** utilities

### Integration Opportunities
1. **Enhance findByJsonType()** → Add SystemTypeClassification filtering
2. **Add new search methods** → findByCategory, findByDataFamily, findByCapability
3. **Extend GraphQL schema** → Add filtered queries with new classification system
4. **Create mapping layer** → Map existing 13 core types to new metadata system

## 13 Core System Types (Current Database)
- string, boolean, integer, number, date, datetime, email, uri, uuid, text, json, array, reference
- These map perfectly to our new SystemTypeClassification framework