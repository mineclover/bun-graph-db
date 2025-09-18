-- ================================================================
-- Relations System Enhancement Script
-- Purpose: Activate underutilized relations features and create meaningful connections
-- ================================================================

BEGIN TRANSACTION;

-- 1. Clear existing external-only relations and create proper internal relations
DELETE FROM node_relations WHERE source_node_id IS NULL OR target_node_id IS NULL;

-- 2. Create meaningful relationships between existing nodes
-- Performance nodes relationships (table_id: 6)
INSERT INTO node_relations (
  table_id, source_node_id, target_node_id, relation_type_id,
  strength, confidence, properties, source_external_id, target_external_id
)
SELECT
  6, -- table_id for performance nodes
  n1.id, -- source node
  n2.id, -- target node
  rt.id, -- relation type
  CASE
    -- Higher strength for performance comparisons
    WHEN ABS(n1.id - n2.id) = 1 THEN 4 -- very strong for adjacent nodes
    WHEN ABS(n1.id - n2.id) <= 3 THEN 3 -- confident for nearby nodes
    ELSE 2 -- uncertain but valid for distant nodes
  END as strength,
  CASE
    -- Higher confidence for nodes with similar attributes
    WHEN ABS(n1.id - n2.id) <= 2 THEN 4 -- verified for close nodes
    WHEN ABS(n1.id - n2.id) <= 5 THEN 3 -- confident
    ELSE 2 -- uncertain but valid
  END as confidence,
  '{"relationship_basis": "performance_comparison", "metric_similarity": "high"}' as properties,
  'internal' as source_external_id,
  'internal' as target_external_id
FROM nodes n1
CROSS JOIN nodes n2
CROSS JOIN relation_types rt
WHERE n1.table_id = 6
  AND n2.table_id = 6
  AND n1.id != n2.id -- no self-relations
  AND n1.id < n2.id -- avoid duplicates
  AND rt.identifier = 'related_to'
  AND ABS(n1.id - n2.id) <= 5 -- only connect nearby performance nodes
LIMIT 15;

-- 3. Create hierarchical relationships for test nodes (table_id: 5)
INSERT INTO node_relations (
  table_id, source_node_id, target_node_id, relation_type_id,
  strength, confidence, properties, source_external_id, target_external_id
)
SELECT
  5, -- table_id for test nodes
  n1.id, -- parent node (lower ID)
  n2.id, -- child node (higher ID)
  rt.id, -- parent_of relation type
  3, -- confident strength
  3, -- confident confidence
  '{"hierarchy_level": "test_structure", "parent_child": true}' as properties,
  'internal' as source_external_id,
  'internal' as target_external_id
FROM nodes n1
CROSS JOIN nodes n2
CROSS JOIN relation_types rt
WHERE n1.table_id = 5
  AND n2.table_id = 5
  AND n1.id < n2.id -- parent has lower ID
  AND n2.id = n1.id + 1 -- sequential parent-child relationship
  AND rt.identifier = 'parent_of'
LIMIT 10;

-- 4. Create cross-table relationships
-- Connect MacBook Pro (table_id: 4) with performance nodes (table_id: 6)
INSERT INTO node_relations (
  table_id, source_node_id, target_node_id, relation_type_id,
  strength, confidence, properties, source_external_id, target_external_id
)
SELECT
  4, -- using MacBook table as base
  (SELECT id FROM nodes WHERE table_id = 4 LIMIT 1), -- MacBook Pro node
  n.id, -- performance node
  rt.id, -- references relation type
  3, -- confident strength
  4, -- verified confidence (hardware runs performance tests)
  '{"cross_table": true, "hardware_software_link": "performance_testing"}' as properties,
  'internal' as source_external_id,
  'internal' as target_external_id
FROM nodes n
CROSS JOIN relation_types rt
WHERE n.table_id = 6 -- performance nodes
  AND rt.identifier = 'references'
LIMIT 5;

-- 5. Create dependency relationships for products (table_id: 1)
INSERT INTO node_relations (
  table_id, source_node_id, target_node_id, relation_type_id,
  strength, confidence, properties, source_external_id, target_external_id
)
SELECT
  1, -- products table
  n1.id, -- source product
  n2.id, -- target product
  rt.id, -- depends_on relation type
  2, -- uncertain but valid
  3, -- confident
  '{"dependency_type": "product_line", "business_relation": true}' as properties,
  'internal' as source_external_id,
  'internal' as target_external_id
FROM nodes n1
CROSS JOIN nodes n2
CROSS JOIN relation_types rt
WHERE n1.table_id = 1
  AND n2.table_id = 1
  AND n1.id != n2.id
  AND rt.identifier = 'depends_on'
  AND ABS(n1.id - n2.id) = 1 -- adjacent products depend on each other
LIMIT 8;

-- 6. Enhance relation_types with missing metadata
UPDATE relation_types
SET category = CASE
  WHEN identifier IN ('depends_on', 'implements') THEN 'structural'
  WHEN identifier IN ('related_to', 'linked_to') THEN 'semantic'
  WHEN identifier IN ('extends', 'parent_of') THEN 'hierarchy'
  WHEN identifier IN ('references') THEN 'reference'
  ELSE 'semantic'
END,
description = CASE
  WHEN description IS NULL OR description = '' THEN
    CASE identifier
      WHEN 'depends-on' THEN 'Dependency relationship between entities'
      WHEN 'connected-to' THEN 'Connection between related entities'
      WHEN 'relates-to' THEN 'General relationship between entities'
      ELSE description
    END
  ELSE description
END
WHERE category IS NULL OR description IS NULL OR description = '';

-- 7. Create external reference examples
-- Insert some external references to demonstrate the system
INSERT INTO node_relations (
  table_id, source_node_id, source_external_id, target_node_id, target_external_id,
  relation_type_id, strength, confidence, properties
)
VALUES
  -- External repository references
  (1, NULL, 'github:user/repo:node123',
   (SELECT id FROM nodes WHERE table_id = 1 LIMIT 1), 'internal',
   (SELECT id FROM relation_types WHERE identifier = 'references' LIMIT 1),
   3, 3, '{"external_source": "github", "repository": "user/repo"}'),

  (6, NULL, 'performance-db:benchmark:cpu_test_456',
   (SELECT id FROM nodes WHERE table_id = 6 LIMIT 1), 'internal',
   (SELECT id FROM relation_types WHERE identifier = 'related_to' LIMIT 1),
   2, 3, '{"external_source": "performance-db", "benchmark_type": "cpu"}'),

  -- Bidirectional external reference
  ((SELECT id FROM nodes WHERE table_id = 5 LIMIT 1), 'internal',
   NULL, 'test-suite:integration:test789',
   (SELECT id FROM relation_types WHERE identifier = 'linked_to' LIMIT 1),
   3, 4, '{"test_integration": true, "external_target": "test-suite"}');

-- 8. Create analytics views for relations
CREATE VIEW IF NOT EXISTS relation_analytics AS
SELECT
  t.identifier as table_name,
  rt.identifier as relation_type,
  rt.category,
  COUNT(*) as relation_count,
  AVG(nr.strength) as avg_strength,
  AVG(nr.confidence) as avg_confidence,
  COUNT(CASE WHEN nr.source_external_id != 'internal' THEN 1 END) as external_sources,
  COUNT(CASE WHEN nr.target_external_id != 'internal' THEN 1 END) as external_targets
FROM node_relations nr
JOIN relation_types rt ON nr.relation_type_id = rt.id
JOIN tables t ON nr.table_id = t.id
GROUP BY t.identifier, rt.identifier, rt.category
ORDER BY relation_count DESC;

-- 9. Create node connectivity view
CREATE VIEW IF NOT EXISTS node_connectivity AS
SELECT
  n.id as node_id,
  n.content,
  t.identifier as table_name,
  COUNT(CASE WHEN nr.source_node_id = n.id THEN 1 END) as outgoing_relations,
  COUNT(CASE WHEN nr.target_node_id = n.id THEN 1 END) as incoming_relations,
  COUNT(CASE WHEN nr.source_node_id = n.id OR nr.target_node_id = n.id THEN 1 END) as total_relations,
  AVG(CASE WHEN nr.source_node_id = n.id OR nr.target_node_id = n.id THEN nr.strength END) as avg_relation_strength
FROM nodes n
JOIN tables t ON n.table_id = t.id
LEFT JOIN node_relations nr ON (nr.source_node_id = n.id OR nr.target_node_id = n.id)
  AND nr.source_external_id = 'internal' AND nr.target_external_id = 'internal'
GROUP BY n.id, n.content, t.identifier
HAVING total_relations > 0
ORDER BY total_relations DESC, avg_relation_strength DESC;

COMMIT;

-- ================================================================
-- Verification Queries
-- ================================================================

-- Show relation system activation results
SELECT
  'Total Relations' as metric,
  COUNT(*) as value
FROM node_relations
UNION ALL
SELECT
  'Internal Relations' as metric,
  COUNT(*) as value
FROM node_relations
WHERE source_external_id = 'internal' AND target_external_id = 'internal'
UNION ALL
SELECT
  'External Relations' as metric,
  COUNT(*) as value
FROM node_relations
WHERE source_external_id != 'internal' OR target_external_id != 'internal'
UNION ALL
SELECT
  'Relation Types Used' as metric,
  COUNT(DISTINCT relation_type_id) as value
FROM node_relations;

-- Show relation analytics
SELECT * FROM relation_analytics LIMIT 10;

-- Show most connected nodes
SELECT * FROM node_connectivity LIMIT 10;