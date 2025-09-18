-- ================================================================
-- Node Attributes Migration Script
-- Purpose: Migrate from JSON attributes to normalized node_attributes table
-- ================================================================

BEGIN TRANSACTION;

-- Sample data insertion to demonstrate the normalized attributes system
-- This populates the node_attributes table which is currently empty (0 records)

-- 1. MacBook Pro node (table_id: 4) - Add technical specifications
INSERT INTO node_attributes (node_id, attribute_id, value)
SELECT 1, 1, 'MacBook Pro M2 16-inch'  -- name_field
WHERE EXISTS (SELECT 1 FROM nodes WHERE id = 1 AND table_id = 4)
  AND EXISTS (SELECT 1 FROM attributes WHERE id = 1 AND table_id = 57);

-- 2. Product nodes (table_id: 1) - Add product information
INSERT INTO node_attributes (node_id, attribute_id, value)
SELECT n.id, a.id,
  CASE a.identifier
    WHEN 'name' THEN 'Product ' || (n.id - 1)
    WHEN 'price' THEN CAST((100 + (n.id * 50)) AS TEXT)
    WHEN 'contact_email' THEN 'product' || (n.id - 1) || '@example.com'
    WHEN 'launch_date' THEN '2024-01-' || PRINTF('%02d', (n.id % 28) + 1)
    WHEN 'uuid' THEN 'uuid-' || n.id || '-' || SUBSTR('abcdef0123456789', (n.id % 16) + 1, 8)
    WHEN 'description' THEN 'Description for product ' || (n.id - 1)
  END
FROM nodes n
CROSS JOIN attributes a
WHERE n.table_id = 1
  AND a.table_id = 1
  AND n.id IN (SELECT id FROM nodes WHERE table_id = 1 LIMIT 3);

-- 3. Todo nodes (table_id: 58) - Add todo information
INSERT INTO node_attributes (node_id, attribute_id, value)
SELECT n.id, a.id,
  CASE a.identifier
    WHEN 'todo_title' THEN 'Task ' || (n.id - (SELECT MIN(id) FROM nodes WHERE table_id = 58) + 1)
    WHEN 'todo_description' THEN 'Description for task ' || (n.id - (SELECT MIN(id) FROM nodes WHERE table_id = 58) + 1)
    WHEN 'todo_status' THEN CASE (n.id % 3) WHEN 0 THEN 'completed' WHEN 1 THEN 'in_progress' ELSE 'pending' END
  END
FROM nodes n
CROSS JOIN attributes a
WHERE n.table_id = 58
  AND a.table_id = 58
  AND n.id IN (SELECT id FROM nodes WHERE table_id = 58 LIMIT 5);

-- 4. Performance test nodes (table_id: 6) - Add performance metrics
-- First, create some performance-related attributes for table 6 if they don't exist
INSERT OR IGNORE INTO attribute_types (identifier, json_type, description)
VALUES
  ('performance_metric', 'number', 'Performance metric value'),
  ('test_category', 'string', 'Performance test category');

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'cpu_usage', at.id, 'CPU usage percentage', 0
FROM attribute_types at
WHERE at.identifier = 'performance_metric'
  AND NOT EXISTS (SELECT 1 FROM attributes WHERE table_id = 6 AND identifier = 'cpu_usage');

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'memory_usage', at.id, 'Memory usage in MB', 0
FROM attribute_types at
WHERE at.identifier = 'performance_metric'
  AND NOT EXISTS (SELECT 1 FROM attributes WHERE table_id = 6 AND identifier = 'memory_usage');

INSERT OR IGNORE INTO attributes (table_id, identifier, attribute_type_id, description, is_required)
SELECT 6, 'test_type', at.id, 'Type of performance test', 0
FROM attribute_types at
WHERE at.identifier = 'test_category'
  AND NOT EXISTS (SELECT 1 FROM attributes WHERE table_id = 6 AND identifier = 'test_type');

-- Add performance attributes to performance nodes
INSERT INTO node_attributes (node_id, attribute_id, value)
SELECT n.id, a.id,
  CASE a.identifier
    WHEN 'cpu_usage' THEN CAST((20 + (n.id % 60)) AS TEXT)
    WHEN 'memory_usage' THEN CAST((512 + (n.id * 128)) AS TEXT)
    WHEN 'test_type' THEN CASE (n.id % 3) WHEN 0 THEN 'load_test' WHEN 1 THEN 'stress_test' ELSE 'performance_benchmark' END
  END
FROM nodes n
CROSS JOIN attributes a
WHERE n.table_id = 6
  AND a.table_id = 6
  AND n.id IN (SELECT id FROM nodes WHERE table_id = 6 LIMIT 5);

-- 5. Update nodes.attributes column to NULL since we're now using normalized storage
UPDATE nodes SET attributes = NULL WHERE attributes = '';

COMMIT;

-- ================================================================
-- Verification Queries
-- ================================================================

-- Check the populated node_attributes
SELECT
  na.id,
  n.content as node_content,
  a.identifier as attribute_name,
  na.value,
  at.json_type
FROM node_attributes na
JOIN nodes n ON na.node_id = n.id
JOIN attributes a ON na.attribute_id = a.id
JOIN attribute_types at ON a.attribute_type_id = at.id
ORDER BY n.id, a.identifier
LIMIT 20;

-- Count of populated attributes by table
SELECT
  t.identifier as table_name,
  COUNT(na.id) as attribute_count
FROM tables t
LEFT JOIN nodes n ON t.id = n.table_id
LEFT JOIN node_attributes na ON n.id = na.node_id
GROUP BY t.id, t.identifier
HAVING attribute_count > 0
ORDER BY attribute_count DESC;