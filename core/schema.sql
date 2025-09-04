-- Sample Schema for Testing
-- SQLite Memory MCP Server Schema

-- Tables table
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Nodes table  
CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  UNIQUE(table_id, content)
);

-- Attribute types table (JSON Schema 표준 타입 정의)
CREATE TABLE IF NOT EXISTS attribute_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  json_type TEXT NOT NULL, -- JSON Schema primitive types: string, number, integer, boolean, array, object, null
  format TEXT, -- JSON Schema format: date, time, date-time, email, uri, uuid, etc.
  description TEXT,
  validation_schema TEXT, -- JSON Schema for validation rules
  reference_config TEXT, -- Reference resolution configuration (for format='reference' only)
  default_value TEXT, -- Default value in JSON format
  examples TEXT, -- JSON array of example values
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Attributes table
CREATE TABLE IF NOT EXISTS attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  identifier TEXT NOT NULL,
  attribute_type_id INTEGER NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  metadata TEXT, -- Additional attribute-specific configuration
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  FOREIGN KEY (attribute_type_id) REFERENCES attribute_types(id) ON DELETE RESTRICT,
  UNIQUE(table_id, identifier)
);

-- Node attributes table
CREATE TABLE IF NOT EXISTS node_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL,
  attribute_id INTEGER NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE,
  UNIQUE(node_id, attribute_id)
);

-- Docs table (테이블 사용처 메모 및 자유 형식 게시판)
CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('usage', 'guide', 'example', 'spec', 'general')),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  UNIQUE(table_id, category, version)
);

-- Query Templates table (GraphQL 쿼리/뮤테이션 템플릿 관리)
-- GraphQL 쿼리를 재사용 가능한 템플릿으로 관리하기 위한 테이블
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- GraphQL 쿼리 정보
  query_text TEXT NOT NULL,
  variables_schema TEXT, -- JSON schema for variables
  default_variables TEXT, -- Default JSON values
  
  -- 적용 가능 테이블 (검색 활용)
  applicable_tables TEXT, -- JSON array of table identifiers. null = 범용, ["table1", "table2"] = 특정 테이블들
  
  -- 메타데이터
  template_type TEXT DEFAULT 'query', -- 'query', 'mutation', 'subscription'
  complexity_score INTEGER DEFAULT 1, -- 1-10 (1=simple, 10=complex)
  
  -- 사용 통계
  usage_count INTEGER DEFAULT 0,
  
  -- 버전 관리
  version TEXT DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT TRUE,
  
  -- 태그 기반 검색
  tags TEXT, -- JSON array for search
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Node relations table (노드 간 관계 정의)
CREATE TABLE IF NOT EXISTS node_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  -- Source node: either internal node_id or external repository identifier
  source_node_id INTEGER, -- Internal node reference
  source_external_id TEXT DEFAULT 'internal', -- External reference format: 'repository_name:node_identifier' or 'internal'
  -- Target node: either internal node_id or external repository identifier  
  target_node_id INTEGER, -- Internal node reference
  target_external_id TEXT DEFAULT 'internal', -- External reference format: 'repository_name:node_identifier' or 'internal'
  -- Relation information
  relation_type_id INTEGER NOT NULL,
  properties TEXT, -- JSON: additional relation properties
  strength INTEGER DEFAULT 1, -- 0-4, relation strength: 0=invalid, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=very_strong
  confidence INTEGER DEFAULT 1, -- 0-4, relation confidence: 0=probably_wrong, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=verified
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (relation_type_id) REFERENCES relation_types(id) ON DELETE CASCADE,
  -- Ensure proper identifier usage: if using internal, external_id should be 'internal'
  CHECK ((source_node_id IS NOT NULL AND source_external_id = 'internal') OR 
         (source_node_id IS NULL AND source_external_id != 'internal')),
  CHECK ((target_node_id IS NOT NULL AND target_external_id = 'internal') OR 
         (target_node_id IS NULL AND target_external_id != 'internal')),
  -- Validate strength and confidence ranges
  CHECK (strength >= 0 AND strength <= 4),
  CHECK (confidence >= 0 AND confidence <= 4),
  UNIQUE(table_id, source_node_id, source_external_id, target_node_id, target_external_id, relation_type_id)
);

-- Relation types table (관계 유형 정의)
CREATE TABLE IF NOT EXISTS relation_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT, -- 'structural', 'semantic', 'reference', 'hierarchy'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- UPDATE TRIGGERS - Automatically manage updated_at timestamps
-- =================================================================================

-- Tables table update trigger
CREATE TRIGGER IF NOT EXISTS update_tables_updated_at
    AFTER UPDATE ON tables
    FOR EACH ROW
BEGIN
    UPDATE tables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Nodes table update trigger  
CREATE TRIGGER IF NOT EXISTS update_nodes_updated_at
    AFTER UPDATE ON nodes
    FOR EACH ROW
BEGIN
    UPDATE nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Attribute types table update trigger
CREATE TRIGGER IF NOT EXISTS update_attribute_types_updated_at
    AFTER UPDATE ON attribute_types
    FOR EACH ROW
BEGIN
    UPDATE attribute_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Attributes table update trigger
CREATE TRIGGER IF NOT EXISTS update_attributes_updated_at
    AFTER UPDATE ON attributes
    FOR EACH ROW
BEGIN
    UPDATE attributes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Node attributes table update trigger
CREATE TRIGGER IF NOT EXISTS update_node_attributes_updated_at
    AFTER UPDATE ON node_attributes
    FOR EACH ROW
BEGIN
    UPDATE node_attributes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Docs table update trigger
CREATE TRIGGER IF NOT EXISTS update_docs_updated_at
    AFTER UPDATE ON docs
    FOR EACH ROW
BEGIN
    UPDATE docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Templates table update trigger
CREATE TRIGGER IF NOT EXISTS update_templates_updated_at
    AFTER UPDATE ON templates
    FOR EACH ROW
BEGIN
    UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Node relations table update trigger
CREATE TRIGGER IF NOT EXISTS update_node_relations_updated_at
    AFTER UPDATE ON node_relations
    FOR EACH ROW
BEGIN
    UPDATE node_relations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Relation types table update trigger
CREATE TRIGGER IF NOT EXISTS update_relation_types_updated_at
    AFTER UPDATE ON relation_types
    FOR EACH ROW
BEGIN
    UPDATE relation_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =================================================================================
-- RELATION STRENGTH AND CONFIDENCE CONVENTIONS
-- =================================================================================

-- Strength Levels (관계 강도):
-- 0 = Invalid/Broken (무효/깨진 관계)
-- 1 = Auto Generated (자동 생성) - 기본값
-- 2 = Uncertain but Valid (긴가민가하지만 유효)
-- 3 = Confident (확실함)
-- 4 = Very Strong (매우 강력)

-- Confidence Levels (관계 신뢰도):
-- 0 = Probably Wrong (아마 틀림)
-- 1 = Auto Generated (자동 생성) - 기본값
-- 2 = Uncertain but Valid (긴가민가하지만 유효)
-- 3 = Confident (확신함)
-- 4 = Verified (검증됨)

-- Usage Examples:
-- INSERT INTO node_relations (..., strength, confidence, ...) VALUES (..., 1, 1, ...); -- Auto-generated relation
-- INSERT INTO node_relations (..., strength, confidence, ...) VALUES (..., 2, 2, ...); -- Weak but valid relation
-- INSERT INTO node_relations (..., strength, confidence, ...) VALUES (..., 3, 3, ...); -- Strong and confident relation
-- INSERT INTO node_relations (..., strength, confidence, ...) VALUES (..., 0, 0, ...); -- Invalid/wrong relation

-- =================================================================================
-- DEFAULT DATA
-- =================================================================================

INSERT OR IGNORE INTO attribute_types (identifier, json_type, format, description, validation_schema, reference_config, default_value, examples) VALUES 
  ('string', 'string', NULL, 'Basic string type', NULL, NULL, '""', '["hello", "world"]'),
  ('boolean', 'boolean', NULL, 'Boolean true/false', NULL, NULL, 'false', '[true, false]'),
  ('integer', 'integer', NULL, 'Integer number', '{"minimum": 0}', NULL, '0', '[1, 42, 100]'),
  ('number', 'number', NULL, 'Decimal number', NULL, NULL, '0.0', '[1.5, 3.14, 100.0]'),
  ('date', 'string', 'date', 'Date in YYYY-MM-DD format', '{"pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$"}', NULL, '"2024-01-01"', '["2024-01-01", "2023-12-31"]'),
  ('datetime', 'string', 'date-time', 'ISO 8601 datetime', NULL, NULL, '"2024-01-01T00:00:00Z"', '["2024-01-01T12:00:00Z", "2023-12-31T23:59:59Z"]'),
  ('email', 'string', 'email', 'Email address', NULL, NULL, '"user@example.com"', '["user@domain.com", "test@example.org"]'),
  ('uri', 'string', 'uri', 'URI/URL', NULL, NULL, '"https://example.com"', '["https://example.com", "http://localhost:3000"]'),
  ('uuid', 'string', 'uuid', 'UUID identifier', '{"pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"}', NULL, '"00000000-0000-0000-0000-000000000000"', '["123e4567-e89b-12d3-a456-426614174000"]'),
  ('text', 'string', NULL, 'Long text content', '{"minLength": 0}', NULL, '""', '["Short text", "Lorem ipsum dolor sit amet..."]'),
  ('json', 'object', NULL, 'JSON object', NULL, NULL, '{}', '[{"key": "value"}, {"name": "John", "age": 30}]'),
  ('array', 'array', NULL, 'JSON array', NULL, NULL, '[]', '[["item1", "item2"], [1, 2, 3]]'),
  ('reference', 'object', 'reference', 'External reference with caching', 
   '{"type": "object", "properties": {"id": {"type": "string"}, "last_response": {"type": "object"}, "fetched_at": {"type": "string", "format": "date-time"}, "cache_status": {"type": "string", "enum": ["valid", "stale", "invalid"]}}, "required": ["id"]}',
   '{"source": "external_service", "endpoint": "/api/users/{id}", "method": "GET", "resolver": "user_resolver", "ttl": 3600}',
   '{"id": "user_42", "last_response": null, "fetched_at": null, "cache_status": "invalid"}', 
   '[{"id": "user_42", "last_response": {"name": "John", "email": "john@example.com"}, "fetched_at": "2024-01-01T12:00:00Z", "cache_status": "valid"}]');

-- Insert default relation types
INSERT OR IGNORE INTO relation_types (identifier, description, category) VALUES 
  ('depends_on', 'Direct dependency', 'structural'),
  ('related_to', 'Related entity', 'semantic'),
  ('extends', 'Extension relationship', 'hierarchy'),
  ('implements', 'Implementation relationship', 'structural'),
  ('references', 'Reference relationship', 'reference'),
  ('parent_of', 'Parent-child relationship', 'hierarchy'),
  ('linked_to', 'Bidirectional link', 'semantic');

-- =================================================================================
-- PERFORMANCE INDEXES
-- =================================================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_table_content ON nodes(table_id, content);
CREATE INDEX IF NOT EXISTS idx_attribute_types_identifier ON attribute_types(identifier);
CREATE INDEX IF NOT EXISTS idx_attribute_types_json_type ON attribute_types(json_type);
CREATE INDEX IF NOT EXISTS idx_attributes_table_identifier ON attributes(table_id, identifier);
CREATE INDEX IF NOT EXISTS idx_attributes_type ON attributes(attribute_type_id);
CREATE INDEX IF NOT EXISTS idx_docs_table_category ON docs(table_id, category);
CREATE INDEX IF NOT EXISTS idx_docs_version ON docs(version);
CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_docs_active ON docs(is_active);
-- Partial index to enforce only one active doc per table+category
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_unique_active 
ON docs(table_id, category) WHERE is_active = TRUE;
-- Templates (query templates) indexes
CREATE INDEX IF NOT EXISTS idx_templates_identifier ON templates(identifier);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_version ON templates(version);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_applicable ON templates(applicable_tables);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates(tags);
CREATE INDEX IF NOT EXISTS idx_node_attributes_node ON node_attributes(node_id);
CREATE INDEX IF NOT EXISTS idx_node_attributes_attr ON node_attributes(attribute_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_source ON node_relations(source_node_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_target ON node_relations(target_node_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_source_ext ON node_relations(source_external_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_target_ext ON node_relations(target_external_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_type ON node_relations(relation_type_id);
CREATE INDEX IF NOT EXISTS idx_node_relations_table ON node_relations(table_id);

