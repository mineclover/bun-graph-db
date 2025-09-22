# Memory Server 통합 시나리오 샘플

**외부 시스템 어댑터 패턴을 통한 Memory MCP Server 통합**

## 📋 시나리오 개요

bun-url-db가 **외부 시스템을 통합할 수 있는 플랫폼**임을 실증하는 샘플 사례로, 기존 Memory MCP Server의 데이터 모델을 bun-url-db의 테이블 구조로 매핑하여 단일 인터페이스로 관리하는 통합 예제입니다.

## 🎯 통합 목적

- **플랫폼 확장성 실증**: url-db가 다양한 외부 데이터 모델을 수용할 수 있음을 보여줌
- **어댑터 패턴 활용**: 외부 시스템 API를 url-db 구조로 매핑하는 표준화된 방법 제시
- **기존 시스템 호환성**: Memory Server API 유지하면서 url-db 기능 확장
- **데이터 통합**: 서로 다른 데이터 모델의 단일 인터페이스 제공

## 🏗️ Memory Server → bun-url-db 매핑

### 1. 데이터 구조 매핑

#### Memory Server 원본 구조
```typescript
interface Entity {
  name: string;           // 엔티티 식별자
  entityType: string;     // 엔티티 타입 분류
  observations: string[]; // 관찰 내용 배열
}

interface Relation {
  from: string;          // 시작 엔티티명
  to: string;            // 대상 엔티티명
  relationType: string;  // 관계 유형
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}
```

#### bun-url-db 매핑 구조
```bash
# MCP 도구: create_table
# Memory Server 호환성을 위한 테이블 생성
create_table {
  "identifier": "memory-integration",
  "description": "Memory MCP Server 데이터 모델 통합 테이블"
}
```

### 2. 속성 매핑 정의
```bash
# MCP 도구: create_attributes
# Memory Server의 observations를 attributes 구조로 매핑
create_attributes {
  "table_id": "memory-integration",
  "attributes": [
    {
      "identifier": "entity_type",
      "attribute_type_id": "string",
      "description": "Memory Server의 entityType 매핑",
      "is_required": true
    },
    {
      "identifier": "observations",
      "attribute_type_id": "array", 
      "description": "Memory Server의 observations 배열 매핑",
      "is_required": false
    },
    {
      "identifier": "source_system",
      "attribute_type_id": "string",
      "description": "데이터 원본 시스템 식별자",
      "is_required": true
    },
    {
      "identifier": "migration_timestamp",
      "attribute_type_id": "datetime",
      "description": "데이터 마이그레이션 시점",
      "is_required": false
    }
  ]
}
```

## 📝 실제 통합 예제

### 1. Memory Server 데이터 수집
```typescript
// Memory Server 원본 데이터 예시 (JSON Lines 형식)
const memoryData = [
  {
    "type": "entity",
    "name": "john-doe",
    "entityType": "person",
    "observations": [
      "works as software engineer",
      "lives in San Francisco",
      "interested in AI and machine learning"
    ]
  },
  {
    "type": "entity", 
    "name": "acme-project",
    "entityType": "project",
    "observations": [
      "web application development",
      "uses React and Node.js",
      "deadline: Q2 2025"
    ]
  },
  {
    "type": "relation",
    "from": "john-doe",
    "to": "acme-project", 
    "relationType": "works_on"
  }
];
```

### 2. bun-url-db로 데이터 변환
```bash
# MCP 도구: create_nodes
# Memory Server Entity를 url-db Node로 변환
create_nodes {
  "table_id": "memory-integration",
  "nodes": [
    {
      "content": "john-doe",
      "title": "John Doe (Person Entity)",
      "attributes": {
        "entity_type": "person",
        "observations": [
          "works as software engineer",
          "lives in San Francisco", 
          "interested in AI and machine learning"
        ],
        "source_system": "memory-server",
        "migration_timestamp": "2025-01-15T10:30:00Z"
      }
    },
    {
      "content": "acme-project",
      "title": "ACME Project (Project Entity)",
      "attributes": {
        "entity_type": "project",
        "observations": [
          "web application development",
          "uses React and Node.js", 
          "deadline: Q2 2025"
        ],
        "source_system": "memory-server",
        "migration_timestamp": "2025-01-15T10:30:00Z"
      }
    }
  ]
}
```

### 3. 관계 데이터 변환
```bash
# MCP 도구: create_relations
# Memory Server Relation을 url-db Relations로 매핑
create_relations {
  "table_id": "memory-integration",
  "relations": [
    {
      "source_node_content": "john-doe",
      "target_node_content": "acme-project",
      "relation_type_id": "works_on",
      "properties": {
        "source_system": "memory-server",
        "original_relation": "works_on",
        "migration_context": "memory_to_urldb"
      }
    }
  ]
}
```

## 🔄 어댑터 패턴 구현

### 1. Memory Server API 래퍼
```typescript
// Memory Server API를 bun-url-db MCP 호출로 변환하는 어댑터
class MemoryToUrlDbAdapter {
  
  // Memory Server: create_entities → bun-url-db: create_nodes
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const nodes = entities.map(entity => ({
      content: entity.name,
      title: `${entity.name} (${entity.entityType})`,
      attributes: {
        entity_type: entity.entityType,
        observations: entity.observations,
        source_system: "memory-server",
        migration_timestamp: new Date().toISOString()
      }
    }));
    
    return await urlDbClient.createNodes("memory-integration", nodes);
  }
  
  // Memory Server: add_observations → bun-url-db: update_node_attributes
  async addObservations(observations: {entityName: string, contents: string[]}[]): Promise<any> {
    const results = [];
    for (const obs of observations) {
      const node = await urlDbClient.getNodeByContent("memory-integration", obs.entityName);
      const existingObs = node.attributes.observations || [];
      const newObservations = [...existingObs, ...obs.contents];
      
      await urlDbClient.updateNodeAttributes("memory-integration", obs.entityName, {
        observations: newObservations
      });
      results.push({entityName: obs.entityName, addedObservations: obs.contents});
    }
    return results;
  }
  
  // Memory Server: search_nodes → bun-url-db: search_nodes
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const searchResults = await urlDbClient.searchNodes("memory-integration", query);
    
    // bun-url-db 결과를 Memory Server 형식으로 변환
    const entities = searchResults.nodes.map(node => ({
      name: node.content,
      entityType: node.attributes.entity_type,
      observations: node.attributes.observations || []
    }));
    
    const relations = searchResults.relations.map(rel => ({
      from: rel.source_node_content,
      to: rel.target_node_content,  
      relationType: rel.relation_type_id
    }));
    
    return { entities, relations };
  }
}
```

### 2. API 호환성 유지
```typescript
// 기존 Memory Server API 호출을 url-db로 투명하게 변환
const memoryAdapter = new MemoryToUrlDbAdapter();

// 기존 Memory Server 클라이언트 코드가 그대로 작동
const entities = await memoryAdapter.createEntities([
  {
    name: "user-task-001", 
    entityType: "task",
    observations: ["High priority task", "Assigned to development team"]
  }
]);

const searchResult = await memoryAdapter.searchNodes("task");
```

## 🔍 통합된 데이터 조회 및 분석

### 1. Memory Server 스타일 검색
```bash
# MCP 도구: search_nodes
# Memory Server의 전체 텍스트 검색을 url-db에서 수행
search_nodes {
  "table_id": "memory-integration",
  "query": "software engineer"  
}

# 엔티티 타입별 검색
search_nodes {
  "table_id": "memory-integration",
  "query": "entity_type:person"
}
```

### 2. 고급 attribute_types 기반 검색
```bash
# MCP 도구: search_nodes
# array 타입 특화 검색 (observations 배열 내용 검색)
search_nodes {
  "table_id": "memory-integration",
  "query": "observations:contains:AI"
}

# datetime 타입 특화 검색 (마이그레이션 시점 기반)
search_nodes {
  "table_id": "memory-integration", 
  "query": "migration_timestamp:>2025-01-01"
}
```

### 3. 관계 분석
```bash
# MCP 도구: analyze_relations
# 관계 네트워크 분석 (Memory Server에서 불가능했던 기능)
analyze_relations {
  "table_id": "memory-integration",
  "relation_type": "works_on"
}
```

## 📊 통합 이후 확장된 기능

### 1. JSON Schema Export
```bash
# MCP 도구: export_table_schema
# Memory Server 데이터 모델을 JSON Schema로 export
export_table_schema {
  "table_id": "memory-integration",
  "format": "json_schema"
}
```

결과:
```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "content": {"type": "string", "description": "Entity identifier"},
    "entity_type": {"type": "string", "description": "Memory Server entityType mapping"},
    "observations": {
      "type": "array", 
      "items": {"type": "string"},
      "description": "Memory Server observations array"
    },
    "source_system": {"type": "string", "enum": ["memory-server"]},
    "migration_timestamp": {"type": "string", "format": "date-time"}
  },
  "required": ["content", "entity_type", "source_system"]
}
```

### 2. 테이블 데이터 Export
```bash
# MCP 도구: export_table_data
# Memory Server 형식 또는 url-db 네이티브 형식으로 export
export_table_data {
  "table_id": "memory-integration",
  "format": "json",
  "include_metadata": true
}
```

### 3. 문서화 시스템 활용
```bash
# MCP 도구: create_docs
# Memory Server 통합 문서화
create_docs {
  "table_id": "memory-integration",
  "category": "usage",
  "content": "# Memory Server Integration Usage\n\nThis table integrates Memory MCP Server data model with url-db structure...",
  "version": 1,
  "is_active": true
}
```

## 🔧 다양한 외부 시스템 통합 패턴

### 1. 내부 테이블 방식: GitHub Issues 통합
```bash
# GitHub Issues를 내부 테이블로 완전 동기화
create_table {
  "identifier": "github-issues",
  "description": "GitHub Issues 데이터 통합 (내부 저장)"
}

create_attributes {
  "table_id": "github-issues",
  "attributes": [
    {
      "identifier": "issue_number",
      "attribute_type_id": "integer",
      "description": "GitHub 이슈 번호"
    },
    {
      "identifier": "title", 
      "attribute_type_id": "string",
      "description": "이슈 제목"
    },
    {
      "identifier": "labels",
      "attribute_type_id": "array",
      "description": "이슈 라벨 목록"
    },
    {
      "identifier": "github_sync_status",
      "attribute_type_id": "string",
      "description": "GitHub 동기화 상태"
    }
  ]
}
```

### 2. Reference 타입 방식: JIRA 티켓 외부 참조
```bash
# JIRA 티켓을 reference 타입으로 외부 참조 (느슨한 결합)
create_attributes {
  "table_id": "github-issues",
  "attributes": [
    {
      "identifier": "linked_jira_tickets",
      "attribute_type_id": "array",
      "description": "연결된 JIRA 티켓들 (reference 배열)",
      "is_required": false,
      "validation_schema": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "last_response": {"type": "object"},
            "fetched_at": {"type": "string", "format": "date-time"},
            "cache_status": {"type": "string", "enum": ["valid", "stale", "invalid"]}
          }
        }
      }
    }
  ]
}
```

### 3. 하이브리드 방식: 프로젝트 관리 시스템
```bash
# 프로젝트는 내부 테이블, 외부 리소스는 reference
create_table {
  "identifier": "projects",
  "description": "프로젝트 관리 (하이브리드 통합)"
}

create_attributes {
  "table_id": "projects",
  "attributes": [
    {
      "identifier": "project_name",
      "attribute_type_id": "string",
      "description": "프로젝트명 (내부 저장)"
    },
    {
      "identifier": "external_repo",
      "attribute_type_id": "reference",
      "description": "GitHub 저장소 참조",
      "reference_config": {
        "source": "github_service",
        "endpoint": "/repos/{owner}/{repo}",
        "method": "GET",
        "resolver": "github_repo_resolver",
        "ttl": 7200
      }
    },
    {
      "identifier": "external_board",
      "attribute_type_id": "reference", 
      "description": "Trello/Jira 보드 참조",
      "reference_config": {
        "source": "trello_service",
        "endpoint": "/1/boards/{id}",
        "method": "GET",
        "resolver": "trello_board_resolver",
        "ttl": 3600
      }
    }
  ]
}
```

### 3. Reference 타입을 활용한 외부 시스템 참조
```bash
# JIRA 티켓 참조 속성 정의 (느슨한 결합 방식)
create_attributes {
  "table_id": "github-issues",
  "attributes": [
    {
      "identifier": "linked_jira_ticket",
      "attribute_type_id": "reference",
      "description": "연결된 JIRA 티켓 참조",
      "is_required": false,
      "reference_config": {
        "source": "jira_service",
        "endpoint": "/rest/api/2/issue/{id}",
        "method": "GET",
        "resolver": "jira_ticket_resolver",
        "ttl": 3600
      }
    }
  ]
}

# GitHub 이슈에서 JIRA 티켓 참조 설정
create_nodes {
  "table_id": "github-issues",
  "nodes": [
    {
      "content": "issue-123",
      "title": "Fix authentication bug",
      "attributes": {
        "issue_number": 123,
        "title": "Fix authentication bug",
        "labels": ["bug", "authentication"],
        "linked_jira_ticket": {
          "id": "PROJECT-456",
          "last_response": {
            "key": "PROJECT-456",
            "fields": {
              "summary": "Authentication system improvement",
              "status": {"name": "In Progress"}
            }
          },
          "fetched_at": "2025-01-15T10:30:00Z",
          "cache_status": "valid"
        }
      }
    }
  ]
}
```

## 📈 외부 시스템 통합의 현실과 해결책

### 1. 외부 연동의 핵심 어려움: 상호 식별 문제

#### 문제 분석
```bash
# Memory Server 예시로 본 식별자 매핑 문제
# 
# Memory Server 원본:
# - Entity name: "john-doe" 
# - 내부적으로는 JSON Lines 파일에서 순서나 다른 식별자 사용
#
# bun-url-db 변환:
# - content: "john-doe"
# - 내부 node_id: 12345
#
# 문제: Memory Server와 bun-url-db가 서로의 식별자를 모름
# - Memory Server API 호출 시: "john-doe"로 요청
# - bun-url-db에서는: content="john-doe" 또는 node_id=12345
# - 양방향 매핑 정보 없으면 관계 설정 불가
```

### 2. MCP 서버 관점에서의 실용적 해결책

#### 해결책 1: 데이터 요청 시 양방향 식별자 함께 제공
```bash
# MCP 도구: search_nodes_with_mappings  
# 외부 시스템 조회 시 내부 식별자도 함께 반환
search_nodes_with_mappings {
  "table_id": "memory-integration",
  "query": "entity_type:person",
  "include_ontology_ids": true,
  "include_external_mappings": true
}
```

응답 예시:
```json
{
  "results": [
    {
      "node_data": {
        "content": "john-doe",
        "title": "John Doe (Person Entity)",
        "attributes": {
          "entity_type": "person",
          "observations": ["works as software engineer"]
        }
      },
      "ontology_mapping": {
        "internal_id": "node_12345",
        "table_id": "memory-integration", 
        "content_uri": "urldb://memory-integration/john-doe",
        "external_mappings": {
          "memory_server": {
            "external_id": "john-doe",
            "system_type": "memory_entity",
            "last_sync": "2025-01-15T14:30:00Z"
          }
        }
      }
    }
  ]
}
```

#### 해결책 2: Export 시 외부 시스템용 매핑 정보 포함
```bash
# MCP 도구: export_for_external_system
# Memory Server나 다른 외부 시스템이 사용할 수 있는 형태로 export
export_for_external_system {
  "table_id": "memory-integration",
  "target_system": "memory_server",
  "include_bidirectional_mappings": true
}
```

결과:
```json
{
  "memory_server_format": {
    "entities": [
      {
        "name": "john-doe",
        "entityType": "person", 
        "observations": ["works as software engineer"],
        "_urldb_mapping": {
          "internal_id": "node_12345",
          "table_id": "memory-integration",
          "uri": "urldb://memory-integration/john-doe"
        }
      }
    ],
    "relations": [
      {
        "from": "john-doe",
        "to": "acme-project",
        "relationType": "works_on",
        "_urldb_mapping": {
          "relation_id": "rel_789",
          "source_node_id": "node_12345", 
          "target_node_id": "node_67890"
        }
      }
    ]
  }
}
```

#### 해결책 3: 외부 시스템 매핑 자동 관리
```bash
# 매핑 정보 자동 유지 테이블
create_table {
  "identifier": "external-mappings-memory",
  "description": "Memory Server와의 식별자 매핑 관리"
}

create_attributes {
  "table_id": "external-mappings-memory",
  "attributes": [
    {
      "identifier": "memory_entity_name",
      "attribute_type_id": "string",
      "description": "Memory Server의 entity name",
      "is_required": true
    },
    {
      "identifier": "urldb_node_id", 
      "attribute_type_id": "string",
      "description": "bun-url-db 내부 node ID",
      "is_required": true
    },
    {
      "identifier": "urldb_content",
      "attribute_type_id": "string", 
      "description": "bun-url-db의 content 값",
      "is_required": true
    },
    {
      "identifier": "sync_status",
      "attribute_type_id": "string",
      "description": "동기화 상태 (active/stale/conflict)",
      "is_required": true
    },
    {
      "identifier": "last_verified",
      "attribute_type_id": "datetime",
      "description": "매핑 정보 마지막 검증 시점",
      "is_required": false
    }
  ]
}
```

### 3. 통합 패턴별 식별자 관리 복잡도

| 통합 방식 | 식별자 매핑 | MCP 서버 부담 | 외부 시스템 인식 필요성 |
|----------|------------|--------------|----------------------|
| **내부 테이블** | 불필요 (content 기반) | ⭐ 낮음 | ❌ 불필요 |
| **Reference 타입** | 필수 (양방향 매핑) | ⭐⭐⭐ 높음 | ✅ 필수 |
| **하이브리드** | 선택적 (부분 매핑) | ⭐⭐ 중간 | ⚠️ 부분적 |

### 4. MCP 서버 구현 시 고려사항

#### A. 데이터 요청 응답에 식별자 포함
- 모든 조회/검색 응답에 내부 ID와 URI 포함
- 외부 시스템 매핑 정보 선택적 포함 가능
- Export 기능에서 목적 시스템별 형태 변환

#### B. 매핑 정보 자동 유지
- 외부 데이터 import 시 매핑 테이블 자동 생성
- 동기화 상태 추적 및 충돌 감지
- 매핑 정보 검증 및 복구 메커니즘

#### C. 온톨로지 URI 표준화  
- `urldb://table-id/content` 형태 URI 체계
- 외부 시스템이 bun-url-db 데이터 참조 시 표준 방법 제공
- Cross-reference 추적 및 관리

## 🔮 확장 가능성

### 1. 실시간 동기화
```typescript
// 외부 시스템과 양방향 실시간 동기화 예시
class RealtimeSyncAdapter {
  async syncFromExternal(externalSystem: string) {
    // 외부 시스템 데이터를 실시간으로 url-db에 반영
  }
  
  async syncToExternal(externalSystem: string) {
    // url-db 변경사항을 외부 시스템에 실시간 반영
  }
}
```

### 2. 자동 스키마 매핑
```typescript
// AI 기반 자동 스키마 매핑 (향후 구현)
class AutoSchemaMapper {
  async analyzeExternalSchema(apiResponse: any): Promise<TableSchema> {
    // AI가 외부 API 응답을 분석하여 자동으로 url-db 스키마 생성
  }
}
```

이 샘플은 bun-url-db가 **외부 시스템을 통합할 수 있는 플랫폼**으로서의 능력을 실증하며, Memory Server를 시작으로 GitHub, JIRA, CRM 등 다양한 외부 시스템을 단일 인터페이스로 통합할 수 있는 아키텍처를 제시합니다.