-- ================================================================
-- Documentation System Activation Script
-- Purpose: Generate comprehensive documentation for all tables using the docs system
-- ================================================================

BEGIN TRANSACTION;

-- 1. Create comprehensive documentation for major tables
-- Performance test table documentation (table_id: 6)
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (6, 'usage', 1, '# Performance Test Table Usage

This table stores performance testing nodes with various metrics and benchmarks.

## Key Features
- CPU usage tracking
- Memory consumption monitoring
- Test categorization (load_test, stress_test, performance_benchmark)
- Relationship tracking with other performance nodes

## Primary Use Cases
1. **Performance Monitoring**: Track system performance over time
2. **Benchmark Comparison**: Compare different test scenarios
3. **Capacity Planning**: Analyze resource utilization patterns
4. **Bottleneck Identification**: Identify performance constraints

## Data Structure
- Node content: Descriptive performance test names
- Attributes: cpu_usage, memory_usage, test_type
- Relations: Performance comparisons and dependencies

## Best Practices
- Use consistent naming conventions for test nodes
- Maintain proper cpu_usage and memory_usage values
- Document test conditions in node descriptions
- Create relationships between related performance tests', TRUE),

  (6, 'guide', 1, '# Performance Testing Guide

## Getting Started

### 1. Creating Performance Nodes
```graphql
mutation CreatePerformanceTest {
  createNode(input: {
    tableId: "6"
    content: "Load Test - Web Server Response"
    attributes: [
      { name: "cpu_usage", value: "45" }
      { name: "memory_usage", value: "1024" }
      { name: "test_type", value: "load_test" }
    ]
  }) {
    success
    node { id content }
  }
}
```

### 2. Querying Performance Data
```graphql
query GetPerformanceMetrics {
  nodes(filter: { tableId: "6" }) {
    content
    attributes {
      name
      value
    }
  }
}
```

### 3. Analyzing Performance Relationships
```graphql
query PerformanceRelationships {
  nodeRelations(filter: { tableId: "6" }) {
    sourceNode { content }
    targetNode { content }
    strength
    confidence
  }
}
```

## Advanced Usage

### Performance Trending
- Track metrics over time using node timestamps
- Create relationships between sequential tests
- Use strength/confidence for reliability scoring

### Capacity Analysis
- Aggregate cpu_usage and memory_usage across tests
- Identify resource consumption patterns
- Plan infrastructure scaling based on trends', TRUE),

  (6, 'example', 1, '# Performance Testing Examples

## Example 1: CPU Stress Test
```json
{
  "content": "CPU Stress Test - Prime Number Calculation",
  "attributes": {
    "cpu_usage": "95",
    "memory_usage": "512",
    "test_type": "stress_test"
  }
}
```

## Example 2: Memory Load Test
```json
{
  "content": "Memory Allocation Test - Large Dataset Processing",
  "attributes": {
    "cpu_usage": "25",
    "memory_usage": "4096",
    "test_type": "load_test"
  }
}
```

## Example 3: Baseline Performance
```json
{
  "content": "Baseline Performance - Idle System",
  "attributes": {
    "cpu_usage": "5",
    "memory_usage": "256",
    "test_type": "performance_benchmark"
  }
}
```

## Relationship Examples

### Performance Comparison
- Source: "High Load Test"
- Target: "Baseline Test"
- Type: "related_to"
- Strength: 4 (very strong)
- Confidence: 4 (verified)

### Test Dependency
- Source: "Setup Test"
- Target: "Main Performance Test"
- Type: "depends_on"
- Strength: 3 (confident)
- Confidence: 4 (verified)', TRUE);

-- Product table documentation (table_id: 1)
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (1, 'usage', 1, '# Product Table Usage

This table manages product information with comprehensive attributes and metadata.

## Key Features
- Product name and description management
- Price tracking and validation
- Contact information storage
- Launch date management
- UUID-based identification
- Email validation for contacts

## Primary Use Cases
1. **Product Catalog**: Maintain comprehensive product listings
2. **Inventory Management**: Track product details and specifications
3. **Contact Management**: Store product-specific contact information
4. **Launch Planning**: Manage product release timelines
5. **Price Management**: Track pricing information and changes

## Data Structure
- Node content: Product names and descriptions
- Attributes: name, price, contact_email, launch_date, uuid, description
- Relations: Product dependencies and relationships

## Validation Rules
- Email format validation for contact_email
- UUID format enforcement
- Required fields: name (product name)
- Optional fields with defaults: price, description', TRUE),

  (1, 'spec', 1, '# Product Table Specification

## Schema Definition

### Table: products (table_id: 1)

### Attributes Schema

| Attribute | Type | Required | Validation | Description |
|-----------|------|----------|------------|-------------|
| name | string | Yes | maxLength: 255 | Product name |
| price | number | No | min: 0 | Product price in currency units |
| contact_email | string | No | email format | Contact email for product |
| launch_date | string | No | date format (YYYY-MM-DD) | Product launch date |
| uuid | string | No | UUID format | Unique product identifier |
| description | string | No | maxLength: 1000 | Product description |

### Business Rules
1. Each product must have a unique name
2. Price must be non-negative
3. Launch date cannot be in the past for new products
4. Contact email must be valid format
5. UUID must be unique across all products

### Data Integrity
- Referential integrity with attributes table
- Cascade delete protection
- Audit trail via created_at/updated_at
- Version control through node updates

### Performance Considerations
- Index on product name for fast lookup
- Index on launch_date for temporal queries
- Index on price for range queries', TRUE);

-- MacBook table documentation (table_id: 4)
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (4, 'usage', 1, '# MacBook Hardware Table Usage

This table stores information about MacBook hardware configurations and specifications.

## Key Features
- Hardware specification tracking
- Model identification and categorization
- Performance characteristics documentation
- Technical specifications storage

## Primary Use Cases
1. **Hardware Inventory**: Track MacBook models and configurations
2. **Performance Comparison**: Compare different MacBook specifications
3. **Compatibility Analysis**: Determine hardware-software compatibility
4. **Asset Management**: Maintain organizational hardware records

## Data Structure
- Node content: MacBook model names and specifications
- Attributes: name_field (descriptive hardware name)
- Relations: Cross-references with performance testing results

## Integration Points
- **Performance Testing**: Links to performance test results
- **Compatibility Matrix**: Hardware-software compatibility tracking
- **Asset Tracking**: Integration with organizational inventory systems', TRUE);

-- Test table documentation (table_id: 5)
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (5, 'guide', 1, '# Test Node Management Guide

## Overview
The test table provides a structured environment for testing relationships, hierarchies, and data validation scenarios.

## Testing Scenarios

### 1. Relationship Testing
- Create parent-child relationships between test nodes
- Validate relationship strength and confidence scores
- Test bidirectional relationship creation

### 2. Hierarchy Validation
- Build tree structures using parent_of relationships
- Test depth-first and breadth-first traversal
- Validate hierarchy integrity

### 3. Data Integrity Testing
- Test constraint validation
- Verify cascade operations
- Validate referential integrity

## Best Practices
1. Use sequential naming for test nodes (Test Node 0, Test Node 1, etc.)
2. Create meaningful relationships with proper strength/confidence scores
3. Document test scenarios in node descriptions
4. Clean up test data after validation', TRUE);

-- Template test products documentation (table_id: 57)
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (57, 'usage', 1, '# Template Test Products Usage

This table supports template testing and validation scenarios for product-related GraphQL queries and mutations.

## Key Features
- Template query validation
- Product data modeling for tests
- GraphQL schema testing support
- Query performance benchmarking

## Primary Use Cases
1. **Template Validation**: Test GraphQL query templates
2. **Schema Testing**: Validate product data structures
3. **Performance Testing**: Benchmark query execution times
4. **Integration Testing**: Test product-related workflows

## Data Structure
- Node content: Test product names and scenarios
- Attributes: name_field (template-specific naming)
- Relations: Template dependencies and test relationships', TRUE);

-- 2. Create general documentation categories for remaining tables
-- Insert usage documentation for tables without existing docs
INSERT INTO docs (table_id, category, version, content, is_active)
SELECT
  t.id,
  'usage',
  1,
  '# ' || t.identifier || ' Table Usage

This table is part of the graph database system supporting various data management and relationship tracking capabilities.

## Features
- Node-based data storage
- Attribute management system
- Relationship tracking
- Temporal data support

## Primary Use Cases
1. **Data Storage**: Store and manage domain-specific information
2. **Relationship Management**: Track connections between entities
3. **Attribute Tracking**: Manage entity properties and metadata
4. **Graph Analysis**: Support graph-based queries and analytics

## Integration
- Connects with the normalized attribute system
- Supports relationship networks
- Integrates with template and documentation systems
- Provides foundation for graph analytics

Generated automatically. Please update with table-specific information.',
  TRUE
FROM tables t
WHERE t.id NOT IN (
  SELECT DISTINCT table_id FROM docs WHERE is_active = TRUE
)
LIMIT 20; -- Limit to prevent overwhelming the system

-- 3. Create specification docs for major tables
INSERT INTO docs (table_id, category, version, content, is_active)
SELECT
  t.id,
  'spec',
  1,
  '# ' || t.identifier || ' Table Specification

## Schema Information
- Table ID: ' || t.id || '
- Table Identifier: ' || t.identifier || '
- Created: ' || t.created_at || '
- Last Updated: ' || t.updated_at || '

## Attributes
' || COALESCE(
  (SELECT GROUP_CONCAT('- ' || a.identifier || ' (' || at.json_type || ')' ||
    CASE WHEN a.is_required = 1 THEN ' [Required]' ELSE ' [Optional]' END, char(10))
   FROM attributes a
   JOIN attribute_types at ON a.attribute_type_id = at.id
   WHERE a.table_id = t.id),
  'No attributes defined'
) || '

## Node Count
Current nodes: ' || (SELECT COUNT(*) FROM nodes WHERE table_id = t.id) || '

## Relationships
' || COALESCE(
  (SELECT GROUP_CONCAT('- ' || rt.identifier || ' (' || rt.category || '): ' || COUNT(*) || ' relations', char(10))
   FROM node_relations nr
   JOIN relation_types rt ON nr.relation_type_id = rt.id
   WHERE nr.table_id = t.id
   GROUP BY rt.identifier, rt.category),
  'No relationships defined'
) || '

## Data Integrity
- Referential integrity enforced
- Cascade operations supported
- Audit trail maintained
- Version control enabled

Generated automatically from current schema state.',
  TRUE
FROM tables t
WHERE t.id IN (1, 4, 5, 6, 57, 58, 59) -- Major tables with data
  AND NOT EXISTS (
    SELECT 1 FROM docs d
    WHERE d.table_id = t.id AND d.category = 'spec' AND d.is_active = TRUE
  );

-- 4. Create example documentation for tables with attributes
INSERT INTO docs (table_id, category, version, content, is_active)
VALUES
  (1, 'example', 1, '# Product Table Examples

## Product Creation Example
```json
{
  "content": "Wireless Bluetooth Headphones",
  "attributes": {
    "name": "AudioMax Pro 3000",
    "price": "299.99",
    "contact_email": "support@audiomax.com",
    "launch_date": "2024-03-15",
    "uuid": "product-audio-headphones-001",
    "description": "Premium wireless headphones with active noise cancellation"
  }
}
```

## Product Query Examples
```graphql
# Get all products with price range
query ProductsByPrice {
  searchNodesByAttribute(filter: {
    attributeFilters: [
      {
        attributeIdentifier: "price"
        operator: BETWEEN
        value: "100,500"
      }
    ]
  }) {
    nodes {
      content
      attributes {
        name
        value
      }
    }
  }
}
```

## Product Relationship Examples
- Dependencies: "Premium Accessory" depends_on "Main Product"
- Categories: Products linked by "related_to" relationships
- Launch sequence: Sequential products connected by launch dates', TRUE);

-- 5. Update table descriptions based on documentation
UPDATE tables
SET description = CASE
  WHEN id = 6 THEN 'Performance testing and benchmarking data with CPU, memory, and test type tracking'
  WHEN id = 1 THEN 'Product catalog with comprehensive attributes including pricing, contacts, and launch information'
  WHEN id = 4 THEN 'MacBook hardware specifications and technical documentation'
  WHEN id = 5 THEN 'Test data structure for relationship and hierarchy validation'
  WHEN id = 57 THEN 'Template testing environment for product-related GraphQL operations'
  ELSE description
END
WHERE id IN (1, 4, 5, 6, 57);

COMMIT;

-- ================================================================
-- Verification Queries
-- ================================================================

-- Show documentation system activation results
SELECT
  'Total Tables' as metric,
  COUNT(*) as value
FROM tables
UNION ALL
SELECT
  'Tables with Documentation' as metric,
  COUNT(DISTINCT table_id) as value
FROM docs
WHERE is_active = TRUE
UNION ALL
SELECT
  'Total Active Documents' as metric,
  COUNT(*) as value
FROM docs
WHERE is_active = TRUE
UNION ALL
SELECT
  'Documentation Categories' as metric,
  COUNT(DISTINCT category) as value
FROM docs
WHERE is_active = TRUE;

-- Show documentation distribution by category
SELECT
  category,
  COUNT(*) as document_count,
  COUNT(DISTINCT table_id) as tables_covered
FROM docs
WHERE is_active = TRUE
GROUP BY category
ORDER BY document_count DESC;

-- Show comprehensive table documentation status
SELECT
  t.identifier as table_name,
  t.description,
  COUNT(d.id) as doc_count,
  GROUP_CONCAT(d.category) as categories,
  (SELECT COUNT(*) FROM nodes WHERE table_id = t.id) as node_count
FROM tables t
LEFT JOIN docs d ON t.id = d.table_id AND d.is_active = TRUE
GROUP BY t.id, t.identifier, t.description
HAVING doc_count > 0
ORDER BY doc_count DESC, node_count DESC;