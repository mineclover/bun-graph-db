-- Migration Script: Convert Relation Type Identifiers to camelCase
-- Date: 2025-09-23
-- Purpose: Migrate existing snake_case relation type identifiers to camelCase convention

-- Step 1: Update existing relation type identifiers to camelCase
UPDATE relation_types
SET identifier = 'dependsOn'
WHERE identifier = 'depends_on';

UPDATE relation_types
SET identifier = 'relatedTo'
WHERE identifier = 'related_to';

UPDATE relation_types
SET identifier = 'parentOf'
WHERE identifier = 'parent_of';

UPDATE relation_types
SET identifier = 'linkedTo'
WHERE identifier = 'linked_to';

-- Note: 'extends', 'implements', 'references' are already in camelCase format

-- Step 2: Verification query - check updated relation types
SELECT id, identifier, description, category, created_at
FROM relation_types
ORDER BY id;

-- Step 3: Check if there are any node_relations that reference old identifiers
-- This is informational only - node_relations table uses relation_type_id (integer), not identifier
SELECT
    rt.identifier,
    COUNT(nr.id) as relation_count
FROM relation_types rt
LEFT JOIN node_relations nr ON rt.id = nr.relation_type_id
GROUP BY rt.id, rt.identifier
ORDER BY rt.id;

-- Step 4: Clean up any duplicate relation types that might have been created during testing
-- Be careful with this - only run if you're sure there are duplicates
-- DELETE FROM relation_types
-- WHERE identifier LIKE 'test_%'
--   OR identifier IN ('depends-on') -- hyphen-based test entries
--   AND id NOT IN (
--     SELECT MIN(id) FROM relation_types GROUP BY identifier
--   );

-- Final verification
SELECT 'Migration completed. Current relation types:' as status;
SELECT id, identifier, description, category
FROM relation_types
ORDER BY id;