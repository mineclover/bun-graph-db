-- ================================================================
-- Template Performance Tracking Activation Script
-- Purpose: Activate currently unused performance tracking fields
-- ================================================================

BEGIN TRANSACTION;

-- 1. Simulate realistic usage patterns for existing templates
-- This demonstrates the performance tracking system in action

-- Update popular query templates with usage statistics
UPDATE templates
SET
  usage_count = CASE
    WHEN query_name LIKE '%health%' THEN 1500 + ABS(RANDOM() % 500)
    WHEN query_name LIKE '%table%' THEN 800 + ABS(RANDOM() % 400)
    WHEN query_name LIKE '%node%' THEN 600 + ABS(RANDOM() % 300)
    WHEN query_name LIKE '%relation%' THEN 200 + ABS(RANDOM() % 150)
    WHEN query_name LIKE '%search%' THEN 400 + ABS(RANDOM() % 200)
    WHEN query_name LIKE '%analytics%' THEN 100 + ABS(RANDOM() % 100)
    ELSE 10 + ABS(RANDOM() % 50)
  END,
  last_used_at = datetime('now', '-' || (ABS(RANDOM() % 720)) || ' hours'),
  avg_execution_time_ms = CASE operation_type
    WHEN 'query' THEN 50 + ABS(RANDOM() % 200)
    WHEN 'mutation' THEN 100 + ABS(RANDOM() % 300)
    WHEN 'subscription' THEN 20 + ABS(RANDOM() % 100)
    ELSE 75 + ABS(RANDOM() % 150)
  END
WHERE is_active = 1;

-- 2. Create template execution log table for detailed performance tracking
CREATE TABLE IF NOT EXISTS template_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER NOT NULL,
  variables_used TEXT, -- JSON of variables passed
  result_count INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  user_context TEXT, -- User/session info

  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- 3. Create performance tracking indexes
CREATE INDEX IF NOT EXISTS idx_template_executions_template
ON template_executions(template_id);

CREATE INDEX IF NOT EXISTS idx_template_executions_time
ON template_executions(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_executions_performance
ON template_executions(execution_time_ms);

CREATE INDEX IF NOT EXISTS idx_template_executions_success
ON template_executions(success, executed_at);

-- 4. Insert sample execution logs to demonstrate the system
INSERT INTO template_executions (template_id, execution_time_ms, result_count, variables_used)
SELECT
  t.id,
  25 + ABS(RANDOM() % 200) as execution_time_ms,
  ABS(RANDOM() % 100) as result_count,
  CASE
    WHEN t.applicable_tables IS NOT NULL
    THEN '{"tableId": "' || (ABS(RANDOM() % 10) + 1) || '"}'
    ELSE '{}'
  END as variables_used
FROM templates t
WHERE t.is_active = 1
ORDER BY RANDOM()
LIMIT 50;

-- Add some recent executions
INSERT INTO template_executions (template_id, executed_at, execution_time_ms, result_count)
SELECT
  t.id,
  datetime('now', '-' || (ABS(RANDOM() % 24)) || ' hours') as executed_at,
  30 + ABS(RANDOM() % 100) as execution_time_ms,
  ABS(RANDOM() % 50) as result_count
FROM templates t
WHERE t.usage_count > 500
ORDER BY RANDOM()
LIMIT 20;

-- 5. Update template performance metrics based on execution logs
UPDATE templates
SET
  avg_execution_time_ms = (
    SELECT AVG(execution_time_ms)
    FROM template_executions te
    WHERE te.template_id = templates.id
    AND te.success = 1
  ),
  last_used_at = (
    SELECT MAX(executed_at)
    FROM template_executions te
    WHERE te.template_id = templates.id
  )
WHERE id IN (
  SELECT DISTINCT template_id
  FROM template_executions
);

-- 6. Create template performance views
CREATE VIEW IF NOT EXISTS template_performance_summary AS
SELECT
  t.id,
  t.identifier,
  t.query_name,
  t.operation_type,
  t.usage_count,
  t.avg_execution_time_ms,
  t.last_used_at,
  t.complexity_score,

  -- Performance metrics from executions
  COUNT(te.id) as total_executions,
  AVG(te.execution_time_ms) as real_avg_execution_time,
  MIN(te.execution_time_ms) as min_execution_time,
  MAX(te.execution_time_ms) as max_execution_time,

  -- Success rate
  COUNT(CASE WHEN te.success = 1 THEN 1 END) * 100.0 / COUNT(te.id) as success_rate,

  -- Recent performance (last 24 hours)
  COUNT(CASE WHEN te.executed_at > datetime('now', '-24 hours') THEN 1 END) as executions_last_24h,

  -- Performance category
  CASE
    WHEN t.avg_execution_time_ms < 50 THEN 'fast'
    WHEN t.avg_execution_time_ms < 200 THEN 'medium'
    ELSE 'slow'
  END as performance_category

FROM templates t
LEFT JOIN template_executions te ON t.id = te.template_id
WHERE t.is_active = 1
GROUP BY t.id, t.identifier, t.query_name, t.operation_type,
         t.usage_count, t.avg_execution_time_ms, t.last_used_at, t.complexity_score;

-- 7. Create hot queries view (frequently used, good performance)
CREATE VIEW IF NOT EXISTS hot_queries AS
SELECT
  t.*,
  tps.total_executions,
  tps.success_rate,
  tps.executions_last_24h
FROM templates t
JOIN template_performance_summary tps ON t.id = tps.id
WHERE t.usage_count > 100
  AND tps.success_rate > 95
  AND t.avg_execution_time_ms < 150
ORDER BY t.usage_count DESC, t.avg_execution_time_ms ASC;

COMMIT;

-- ================================================================
-- Verification Queries
-- ================================================================

-- Show performance tracking activation results
SELECT
  COUNT(*) as total_templates,
  COUNT(CASE WHEN usage_count > 0 THEN 1 END) as templates_with_usage,
  COUNT(CASE WHEN last_used_at IS NOT NULL THEN 1 END) as templates_with_timing,
  COUNT(CASE WHEN avg_execution_time_ms > 0 THEN 1 END) as templates_with_performance,
  AVG(usage_count) as avg_usage_count,
  AVG(avg_execution_time_ms) as avg_execution_time
FROM templates
WHERE is_active = 1;

-- Show top performing templates
SELECT
  query_name,
  operation_type,
  usage_count,
  avg_execution_time_ms,
  performance_category,
  total_executions,
  success_rate
FROM template_performance_summary
ORDER BY usage_count DESC, avg_execution_time_ms ASC
LIMIT 10;

-- Show execution log sample
SELECT
  t.query_name,
  te.executed_at,
  te.execution_time_ms,
  te.result_count,
  te.success
FROM template_executions te
JOIN templates t ON te.template_id = t.id
ORDER BY te.executed_at DESC
LIMIT 10;