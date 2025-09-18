-- ================================================================
-- Sample Data Population Script
-- Purpose: Add comprehensive sample data for testing and demonstration
-- Note: Schema structure is now included in core/schema.sql by default
-- ================================================================

BEGIN TRANSACTION;

-- ================================================================
-- SAMPLE NODE ATTRIBUTES DATA
-- Populate normalized node_attributes with realistic test data
-- ================================================================

-- 1.1 Create sample attribute types for demonstration
INSERT OR IGNORE INTO attribute_types (identifier, json_type, description) VALUES
  ('performance_metric', 'number', 'Performance metric value'),
  ('test_category', 'string', 'Performance test category'),
  ('benchmark_score', 'number', 'Benchmark test score'),
  ('test_duration', 'number', 'Test execution duration in seconds');

-- 1.2 Create sample attributes for performance testing table (table_id: 6)
INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'cpu_usage', at.id, 'CPU usage percentage', 0
FROM attribute_types at WHERE at.identifier = 'performance_metric';

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'memory_usage', at.id, 'Memory usage in MB', 0
FROM attribute_types at WHERE at.identifier = 'performance_metric';

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'test_type', at.id, 'Type of performance test', 0
FROM attribute_types at WHERE at.identifier = 'test_category';

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'benchmark_score', at.id, 'Overall benchmark score', 0
FROM attribute_types at WHERE at.identifier = 'benchmark_score';

-- 1.3 Populate sample node attributes for performance nodes
INSERT OR IGNORE INTO node_attributes (node_id, attribute_id, value)
SELECT n.id, a.id,
  CASE a.identifier
    WHEN 'cpu_usage' THEN CAST((45 + (n.id % 30)) AS TEXT)
    WHEN 'memory_usage' THEN CAST((512 + (n.id * 128) % 2048) AS TEXT)
    WHEN 'test_type' THEN CASE (n.id % 4)
      WHEN 0 THEN 'cpu_intensive'
      WHEN 1 THEN 'memory_intensive'
      WHEN 2 THEN 'io_intensive'
      ELSE 'mixed_workload'
    END
    WHEN 'benchmark_score' THEN CAST((750 + (n.id * 47) % 500) AS TEXT)
  END
FROM nodes n
JOIN attributes a ON a.table_id = n.table_id
WHERE n.table_id = 6 AND a.identifier IN ('cpu_usage', 'memory_usage', 'test_type', 'benchmark_score');

-- ================================================================
-- SAMPLE TEMPLATE PERFORMANCE DATA
-- Add realistic template execution logs for analytics
-- ================================================================

-- 2.1 Generate sample template executions for existing templates
INSERT OR IGNORE INTO template_executions (template_id, executed_at, execution_time_ms, variables_used, result_count, success, user_context)
SELECT
  t.id,
  datetime('now', '-' || (abs(random()) % 2160) || ' hours'),
  25 + (abs(random()) % 200),
  '{"tableId": "' || (1 + abs(random()) % 10) || '"}',
  5 + (abs(random()) % 50),
  CASE WHEN abs(random()) % 20 = 0 THEN 0 ELSE 1 END,
  'sample_user_' || (1 + abs(random()) % 10)
FROM templates t
WHERE t.is_active = 1;

-- 2.2 Add multiple execution records for popular templates
INSERT OR IGNORE INTO template_executions (template_id, executed_at, execution_time_ms, variables_used, result_count, success, user_context)
SELECT
  t.id,
  datetime('now', '-' || (abs(random()) % 720) || ' hours'),
  15 + (abs(random()) % 100),
  '{"limit": ' || (10 + abs(random()) % 40) || '}',
  10 + (abs(random()) % 30),
  1,
  'power_user_' || (1 + abs(random()) % 5)
FROM templates t
WHERE t.is_active = 1 AND t.usage_count > 50;

-- ================================================================
-- SAMPLE RELATIONS DATA
-- Create meaningful relationships between nodes
-- ================================================================

-- 3.1 Add performance test relationships
INSERT OR IGNORE INTO node_relations (table_id, source_node_id, target_node_id, relation_type_id, source_external_id, target_external_id, properties, strength, confidence)
SELECT
  6, -- performance-test table
  n1.id,
  n2.id,
  rt.id,
  'internal',
  'internal',
  '{"correlation": ' || (0.1 + (abs(random()) % 90) / 100.0) || ', "test_batch": "batch_' || (1 + abs(random()) % 5) || '"}',
  2 + (abs(random()) % 3), -- strength 2-4
  2 + (abs(random()) % 3)  -- confidence 2-4
FROM nodes n1, nodes n2, relation_types rt
WHERE n1.table_id = 6 AND n2.table_id = 6 AND n1.id < n2.id
  AND rt.identifier = 'related_to'
  AND abs(random()) % 3 = 0 -- 33% chance to create relation
LIMIT 20;

-- 3.2 Add cross-table relationships (product to performance tests)
INSERT OR IGNORE INTO node_relations (table_id, source_node_id, target_node_id, relation_type_id, source_external_id, target_external_id, properties, strength, confidence)
SELECT
  1, -- products table
  p.id,
  pt.id,
  rt.id,
  'internal',
  'internal',
  '{"test_purpose": "performance_validation", "priority": "' || CASE (abs(random()) % 3) WHEN 0 THEN 'high' WHEN 1 THEN 'medium' ELSE 'low' END || '"}',
  3, -- confident strength
  3  -- confident confidence
FROM nodes p, nodes pt, relation_types rt
WHERE p.table_id = 1 AND pt.table_id = 6
  AND rt.identifier = 'references'
  AND abs(random()) % 4 = 0 -- 25% chance
LIMIT 5;

-- ================================================================
-- SAMPLE DOCUMENTATION DATA
-- Add comprehensive documentation for tables
-- ================================================================

-- 4.1 Usage documentation for major tables
INSERT OR IGNORE INTO docs (table_id, category, version, content, is_active) VALUES
(1, 'usage', 1, '# Products Table Usage Guide

## Overview
The products table stores e-commerce product information with rich attributes and relationships.

## Key Features
- Product catalog management
- Inventory tracking integration
- Performance test relationships
- Rich attribute system

## Usage Examples
```graphql
query getProducts {
  nodes(tableId: "1") {
    id
    content
    attributes {
      identifier
      value
    }
  }
}
```

## Best Practices
- Always include required attributes
- Use consistent naming conventions
- Link to performance test data when available', 1),

(6, 'usage', 1, '# Performance Test Table Usage Guide

## Overview
Comprehensive performance testing data with normalized attributes and relationship tracking.

## Metrics Tracked
- CPU usage percentage
- Memory consumption
- Benchmark scores
- Test execution duration

## Sample Queries
```graphql
query getPerformanceData {
  nodes(tableId: "6") {
    id
    content
    attributes {
      identifier
      value
    }
    relations {
      targetNode {
        content
      }
      strength
      confidence
    }
  }
}
```

## Analytics Features
- Performance trend analysis
- Resource usage patterns
- Test correlation detection
- Benchmark comparison', 1),

(5, 'guide', 1, '# Test Node Management Guide

## Purpose
Comprehensive guide for managing test nodes and their lifecycle.

## Management Tasks
1. **Creation**: Use template-based mutations
2. **Validation**: Ensure attribute compliance
3. **Maintenance**: Regular cleanup and updates
4. **Analytics**: Monitor usage patterns

## Integration Points
- Performance testing workflows
- Documentation generation
- Relationship management
- Template optimization', 1);

-- 4.2 Example documentation
INSERT OR IGNORE INTO docs (table_id, category, version, content, is_active) VALUES
(1, 'example', 1, '# Product Examples

## Sample Product Creation
```json
{
  "content": "Laptop Pro 15-inch",
  "attributes": {
    "price": 1299.99,
    "category": "Electronics",
    "stock": 50
  }
}
```

## Bulk Import Example
```json
[
  {"content": "Smartphone X", "category": "Mobile"},
  {"content": "Tablet Air", "category": "Electronics"},
  {"content": "Headphones Pro", "category": "Audio"}
]
```', 1),

(6, 'example', 1, '# Performance Test Examples

## CPU Intensive Test
```json
{
  "content": "CPU Stress Test #1",
  "attributes": {
    "cpu_usage": 85,
    "memory_usage": 512,
    "test_type": "cpu_intensive",
    "benchmark_score": 1250
  }
}
```

## Mixed Workload Test
```json
{
  "content": "Mixed Performance Test",
  "attributes": {
    "cpu_usage": 65,
    "memory_usage": 1024,
    "test_type": "mixed_workload",
    "benchmark_score": 980
  }
}
```', 1);

-- ================================================================
-- TEMPLATE USAGE STATISTICS UPDATE
-- Update template usage counts based on execution logs
-- ================================================================

-- Update usage counts and performance metrics for templates
UPDATE templates
SET
  usage_count = (
    SELECT COUNT(*)
    FROM template_executions te
    WHERE te.template_id = templates.id
  ),
  last_used_at = (
    SELECT MAX(executed_at)
    FROM template_executions te
    WHERE te.template_id = templates.id
  ),
  avg_execution_time_ms = (
    SELECT AVG(execution_time_ms)
    FROM template_executions te
    WHERE te.template_id = templates.id
  )
WHERE id IN (
  SELECT DISTINCT template_id
  FROM template_executions
);

COMMIT;

-- ================================================================
-- VERIFICATION QUERIES
-- Run these to verify sample data was inserted correctly
-- ================================================================

-- Check node attributes sample data
-- SELECT n.content, a.identifier, na.value
-- FROM node_attributes na
-- JOIN nodes n ON na.node_id = n.id
-- JOIN attributes a ON na.attribute_id = a.id
-- WHERE n.table_id = 6 LIMIT 10;

-- Check template executions
-- SELECT t.identifier, COUNT(*) as execution_count, AVG(te.execution_time_ms) as avg_time
-- FROM template_executions te
-- JOIN templates t ON te.template_id = t.id
-- GROUP BY t.identifier ORDER BY execution_count DESC LIMIT 5;

-- Check relationships
-- SELECT 'Total relations:', COUNT(*) FROM node_relations WHERE source_external_id = 'internal';

-- Check documentation
-- SELECT table_id, category, LENGTH(content) as content_length
-- FROM docs WHERE is_active = 1 ORDER BY table_id;