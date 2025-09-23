# 작업 관리 시나리오 샘플

**테이블 기반 계층적 작업 추적 및 파일 관리 시스템**

## 📋 시나리오 개요

계층적 ID 시스템(task-1, task-1.1, task-1.1.1)을 사용한 작업 관리 테이블에서 작업 생성, 상태 추적, 파일 연결, 의존성 관리를 수행하는 실제 사용 예제입니다.

## 🎯 주요 특징

- **계층적 작업 ID**: 상위-하위 관계를 명시하는 구조적 식별자
- **파일 추적**: 작업과 연관된 파일 경로 관리
- **상태 관리**: 작업 진행 상황 실시간 추적
- **의존성 관리**: 작업 간 선후 관계 및 차단 조건

## 🏗️ 테이블 구조 설계

### 1. 기본 테이블 생성
```bash
# MCP 도구: create_table
# 작업 관리 전용 테이블 생성
create_table {
  "identifier": "task-management",
  "description": "계층적 작업 추적 및 파일 관리"
}
```

### 2. 속성 정의
```bash  
# MCP 도구: create_attributes
# 작업 관리 속성 설정 (attribute_types 테이블 기반)
create_attributes {
  "table_id": "task-management",
  "attributes": [
    {
      "identifier": "task_id",
      "attribute_type_id": "string",
      "description": "계층적 작업 식별자 (task-1, task-1.1)",
      "is_required": true
    },
    {
      "identifier": "status",
      "attribute_type_id": "string", 
      "description": "작업 상태 (pending/in-progress/completed/blocked)",
      "is_required": true
    },
    {
      "identifier": "priority",
      "attribute_type_id": "string",
      "description": "우선순위 (low/medium/high/critical)",
      "is_required": false
    },
    {
      "identifier": "file_paths",
      "attribute_type_id": "json",
      "description": "연관된 파일 경로 배열",
      "is_required": false
    },
    {
      "identifier": "parent_task",
      "attribute_type_id": "string", 
      "description": "상위 작업 ID",
      "is_required": false
    },
    {
      "identifier": "definition",
      "attribute_type_id": "text",
      "description": "작업 상세 정의",
      "is_required": false
    },
    {
      "identifier": "estimated_hours",
      "attribute_type_id": "number",
      "description": "예상 소요 시간",
      "is_required": false
    },
    {
      "identifier": "assignee",
      "attribute_type_id": "string",
      "description": "담당자",
      "is_required": false
    },
    {
      "identifier": "external_ticket",
      "attribute_type_id": "reference",
      "description": "연결된 외부 티켓 (JIRA, GitHub 등)",
      "is_required": false,
      "reference_config": {
        "source": "ticket_service",
        "endpoint": "/api/tickets/{id}",
        "method": "GET",
        "resolver": "external_ticket_resolver",
        "ttl": 1800
      }
    }
  ]
}
```

## 📝 실제 사용 예제

### 1. 메인 작업 생성
```bash
# MCP 도구: create_nodes  
# 인증 시스템 구현 작업 (테이블의 row 생성)
create_nodes {
  "table_id": "task-management", 
  "nodes": [
    {
      "content": "Implement Authentication System",
      "title": "인증 시스템 구현", 
      "attributes": {
        "task_id": "task-1",
        "status": "in-progress", 
        "priority": "high",
        "definition": "JWT 기반 사용자 인증 시스템 전체 구현",
        "file_paths": ["src/auth/AuthService.ts", "src/middleware/auth.ts"],
        "estimated_hours": 40,
        "assignee": "backend-team"
      }
    }
  ]
}
```

### 2. 하위 작업 생성
```bash
# JWT 토큰 생성 하위 작업
create_nodes {
  "table_id": "task-management",
  "nodes": [
    {
      "content": "JWT Token Generation",
      "title": "JWT 토큰 생성 기능",
      "attributes": {
        "task_id": "task-1.1",
        "parent_task": "task-1",
        "status": "completed",
        "priority": "high",
        "definition": "JWT 토큰 생성 및 검증 로직 구현",
        "file_paths": ["src/auth/JwtService.ts", "tests/auth/jwt.test.ts"],
        "estimated_hours": 8,
        "assignee": "john-doe"
      }
    },
    {
      "content": "Password Hashing",
      "title": "비밀번호 해싱",
      "attributes": {
        "task_id": "task-1.2", 
        "parent_task": "task-1",
        "status": "in-progress",
        "priority": "high",
        "definition": "bcrypt 기반 비밀번호 해싱 및 검증",
        "file_paths": ["src/auth/PasswordService.ts"],
        "estimated_hours": 4,
        "assignee": "jane-smith"
      }
    }
  ]
}
```

### 3. 세부 하위 작업
```bash
# 로그인 검증 로직 (3단계 계층)
create_nodes {
  "table_id": "task-management", 
  "nodes": [
    {
      "content": "Login Validation Logic",
      "title": "로그인 검증 로직",
      "attributes": {
        "task_id": "task-1.1.1",
        "parent_task": "task-1.1",
        "status": "completed",
        "priority": "medium",
        "definition": "사용자 자격 증명 검증 및 속도 제한 구현",
        "file_paths": ["src/auth/LoginValidator.ts", "src/middleware/rateLimit.ts"],
        "estimated_hours": 6,
        "assignee": "john-doe"
      }
    }
  ]
}
```

### 4. 관련 작업과 의존성
```bash
# 데이터베이스 스키마 설계 (의존성 있는 작업)
create_nodes {
  "table_id": "task-management",
  "nodes": [
    {
      "content": "Database Schema Design", 
      "title": "데이터베이스 스키마 설계",
      "attributes": {
        "task_id": "task-2",
        "status": "completed",
        "priority": "high", 
        "definition": "사용자 관리를 위한 데이터베이스 스키마 설계 및 구현",
        "file_paths": ["migrations/001_create_users.sql", "src/models/User.ts"],
        "estimated_hours": 12,
        "assignee": "database-team"
      }
    }
  ]
}

# MCP 도구: create_relations
# 작업 간 의존성 관계 생성 (테이블 독립적 관계 관리)
create_relations {
  "table_id": "task-management",
  "relations": [
    {
      "source_node_content": "Implement Authentication System",
      "target_node_content": "Database Schema Design", 
      "relation_type_id": "dependsOn",
      "properties": {
        "dependency_type": "schema_required",
        "blocking": "true",
        "reason": "인증 시스템은 사용자 테이블 스키마가 필요"
      }
    }
  ]
}
```

## 🔧 외부 티켓 시스템 통합 패턴

### 1. 내부 테이블 방식: JIRA 티켓 완전 동기화
```bash
# JIRA 티켓을 내부 테이블로 완전히 복제하여 관리
create_table {
  "identifier": "jira-tickets-internal",
  "description": "JIRA 티켓 내부 저장 방식"
}

create_attributes {
  "table_id": "jira-tickets-internal",
  "attributes": [
    {
      "identifier": "jira_key",
      "attribute_type_id": "string",
      "description": "JIRA 티켓 키 (예: PROJ-123)",
      "is_required": true
    },
    {
      "identifier": "summary",
      "attribute_type_id": "string",
      "description": "티켓 요약",
      "is_required": true
    },
    {
      "identifier": "status",
      "attribute_type_id": "string",
      "description": "티켓 상태",
      "is_required": true
    },
    {
      "identifier": "priority",
      "attribute_type_id": "string",
      "description": "우선순위",
      "is_required": false
    },
    {
      "identifier": "assignee",
      "attribute_type_id": "string",
      "description": "담당자",
      "is_required": false
    },
    {
      "identifier": "sync_timestamp",
      "attribute_type_id": "datetime",
      "description": "마지막 동기화 시점",
      "is_required": false
    }
  ]
}

# 내부 JIRA 티켓 데이터 생성
create_nodes {
  "table_id": "jira-tickets-internal",
  "nodes": [
    {
      "content": "PROJ-456",
      "title": "Authentication System Improvement",
      "attributes": {
        "jira_key": "PROJ-456",
        "summary": "Implement JWT-based authentication with refresh tokens",
        "status": "In Progress",
        "priority": "High",
        "assignee": "john-doe",
        "sync_timestamp": "2025-01-15T14:30:00Z"
      }
    }
  ]
}
```

### 2. Reference 타입 방식: 외부 JIRA 시스템 참조
```bash
# 작업 관리 테이블에서 외부 JIRA 티켓 참조 (느슨한 결합)
create_nodes {
  "table_id": "task-management",
  "nodes": [
    {
      "content": "Implement Authentication System",
      "title": "인증 시스템 구현",
      "attributes": {
        "task_id": "task-1",
        "status": "in-progress",
        "priority": "high",
        "definition": "JWT 기반 사용자 인증 시스템 전체 구현",
        "external_ticket": {
          "id": "PROJ-456",
          "last_response": {
            "key": "PROJ-456",
            "fields": {
              "summary": "Authentication System Improvement",
              "status": {"name": "In Progress"},
              "priority": {"name": "High"},
              "assignee": {"displayName": "John Doe"}
            }
          },
          "fetched_at": "2025-01-15T14:30:00Z",
          "cache_status": "valid"
        },
        "file_paths": ["src/auth/AuthService.ts", "src/middleware/auth.ts"],
        "estimated_hours": 40,
        "assignee": "backend-team"
      }
    }
  ]
}
```

### 3. 하이브리드 방식: 선택적 통합
```bash
# 핵심 작업은 내부 관리, 부가 정보는 외부 참조
create_attributes {
  "table_id": "task-management",
  "attributes": [
    {
      "identifier": "internal_jira_ticket",
      "attribute_type_id": "string",
      "description": "내부 복제된 JIRA 티켓 ID (table 간 참조)",
      "is_required": false
    },
    {
      "identifier": "external_jira_comments",
      "attribute_type_id": "reference",
      "description": "외부 JIRA 댓글 참조 (실시간 데이터)",
      "is_required": false,
      "reference_config": {
        "source": "jira_service",
        "endpoint": "/rest/api/2/issue/{id}/comment",
        "method": "GET",
        "resolver": "jira_comments_resolver",
        "ttl": 600
      }
    }
  ]
}

# 하이브리드 작업 생성 예시
create_nodes {
  "table_id": "task-management",
  "nodes": [
    {
      "content": "Fix Critical Bug",
      "title": "긴급 버그 수정",
      "attributes": {
        "task_id": "task-2",
        "status": "blocked",
        "priority": "critical",
        "internal_jira_ticket": "PROJ-456",  # 내부 테이블 참조
        "external_jira_comments": {  # 실시간 외부 댓글 참조
          "id": "PROJ-456",
          "last_response": {
            "comments": [
              {
                "author": "jane-smith",
                "body": "Added test case to reproduce the issue",
                "created": "2025-01-15T15:00:00Z"
              }
            ]
          },
          "fetched_at": "2025-01-15T15:05:00Z",
          "cache_status": "valid"
        }
      }
    }
  ]
}

# 내부 테이블과 외부 참조 간의 관계 설정
create_relations {
  "table_id": "task-management",
  "relations": [
    {
      "source_node_content": "Fix Critical Bug",
      "target_node_content": "PROJ-456",
      "relation_type_id": "linkedTo",
      "properties": {
        "integration_type": "hybrid",
        "internal_reference": "jira-tickets-internal",
        "external_reference": "jira_service",
        "sync_strategy": "selective"
      }
    }
  ]
}
```

### 4. 외부 시스템 연동의 핵심 과제: 고유 식별자 매핑

#### 문제점 분석
```bash
# 내부 시스템 참조 (쉬운 방법)
create_relations {
  "table_id": "task-management",
  "relations": [
    {
      "source_node_content": "task-1",        # 내부 content로 직접 참조 가능
      "target_node_content": "PROJ-456",       # 내부 content로 직접 참조 가능
      "relation_type_id": "linkedTo"
    }
  ]
}

# 외부 시스템 참조 (복잡한 문제)
# 문제: JIRA 티켓 "PROJ-456"이 외부에 있을 때
# - bun-url-db는 JIRA의 internal ID를 모름
# - JIRA는 bun-url-db의 node ID를 모름
# - 상호 식별 정보가 없어서 관계 설정 불가
```

#### 실용적 해결책 1: MCP 서버에서 식별자 함께 제공
```bash
# MCP 도구: create_nodes_with_external_refs
# 외부 참조 정보를 생성 시점에 함께 제공
create_nodes_with_external_refs {
  "table_id": "task-management",
  "nodes": [
    {
      "content": "task-1",
      "title": "인증 시스템 구현",
      "attributes": {
        "task_id": "task-1",
        "status": "in-progress",
        "priority": "high"
      },
      "external_references": [
        {
          "system": "jira",
          "external_id": "PROJ-456",           # JIRA의 고유 식별자
          "reference_url": "https://company.atlassian.net/browse/PROJ-456",
          "relation_type": "linkedTo",
          "sync_timestamp": "2025-01-15T14:30:00Z"
        },
        {
          "system": "github", 
          "external_id": "repo/issues/123",    # GitHub의 고유 식별자
          "reference_url": "https://github.com/company/repo/issues/123",
          "relation_type": "implements",
          "sync_timestamp": "2025-01-15T14:35:00Z"
        }
      ]
    }
  ]
}
```

#### 실용적 해결책 2: 온톨로지 식별자 Export 시 포함
```bash
# MCP 도구: export_with_ontology_ids
# 데이터 export 시 내부 식별자도 함께 제공
export_with_ontology_ids {
  "table_id": "task-management",
  "node_content": "task-1",
  "include_internal_ids": true,
  "include_external_mappings": true
}
```

결과:
```json
{
  "ontology_data": {
    "internal_id": "node_12345",           # bun-url-db 내부 ID
    "table_id": "task-management",
    "content": "task-1",
    "uri": "urldb://task-management/task-1"  # 고유 URI
  },
  "node_data": {
    "content": "task-1",
    "title": "인증 시스템 구현",
    "attributes": { /* ... */ }
  },
  "external_mappings": [
    {
      "system": "jira",
      "external_id": "PROJ-456",
      "bidirectional_mapping": {
        "jira_to_urldb": "PROJ-456 → urldb://task-management/task-1",
        "urldb_to_jira": "node_12345 → PROJ-456"
      }
    }
  ]
}
```

#### 실용적 해결책 3: 양방향 매핑 테이블
```bash
# 외부 시스템 매핑 전용 테이블 생성
create_table {
  "identifier": "external-system-mappings",
  "description": "내부-외부 시스템 식별자 매핑 테이블"
}

create_attributes {
  "table_id": "external-system-mappings",
  "attributes": [
    {
      "identifier": "internal_table_id",
      "attribute_type_id": "string", 
      "description": "내부 테이블 식별자",
      "is_required": true
    },
    {
      "identifier": "internal_node_content",
      "attribute_type_id": "string",
      "description": "내부 노드 content 값", 
      "is_required": true
    },
    {
      "identifier": "external_system",
      "attribute_type_id": "string",
      "description": "외부 시스템명 (jira, github, etc)",
      "is_required": true
    },
    {
      "identifier": "external_id",
      "attribute_type_id": "string", 
      "description": "외부 시스템의 고유 식별자",
      "is_required": true
    },
    {
      "identifier": "mapping_metadata",
      "attribute_type_id": "json",
      "description": "매핑 메타데이터 (URL, 동기화 정보 등)",
      "is_required": false
    }
  ]
}

# 매핑 데이터 생성
create_nodes {
  "table_id": "external-system-mappings", 
  "nodes": [
    {
      "content": "task-1:PROJ-456",
      "title": "Task-1 ↔ JIRA PROJ-456 매핑",
      "attributes": {
        "internal_table_id": "task-management",
        "internal_node_content": "task-1",
        "external_system": "jira",
        "external_id": "PROJ-456",
        "mapping_metadata": {
          "jira_url": "https://company.atlassian.net/browse/PROJ-456",
          "created_at": "2025-01-15T14:30:00Z",
          "last_verified": "2025-01-15T14:30:00Z",
          "status": "active"
        }
      }
    }
  ]
}
```

### 5. 통합 패턴별 장단점 비교 (수정됨)

| 통합 방식 | 장점 | 단점 | 식별자 매핑 복잡도 |
|----------|------|------|-------------------|
| **내부 테이블** | 빠른 쿼리, 완전 제어, 직접 참조 가능 | 동기화 복잡성, 저장소 용량 | ⭐ 낮음 (content 기반) |
| **Reference 타입** | 실시간 데이터, 저장 공간 효율 | 네트워크 의존, **식별자 매핑 필수** | ⭐⭐⭐ 높음 (양방향 매핑) |
| **하이브리드** | 유연성, 핵심 데이터는 빠른 접근 | 복잡한 구조, **매핑 테이블 관리** | ⭐⭐ 중간 (선택적 매핑) |

## 🔍 작업 조회 및 관리

### 1. 상태별 작업 조회
```bash
# MCP 도구: search_nodes  
# attribute_types 기반 타입별 특화 검색 수행
search_nodes {
  "table_id": "task-management",
  "query": "status:in-progress"
}

# MCP 도구: search_nodes
# 높은 우선순위 작업 검색 
search_nodes {
  "table_id": "task-management", 
  "query": "priority:high"
}
```

### 2. 계층 구조 탐색
```bash
# 특정 작업의 하위 작업 조회
search_nodes {
  "table_id": "task-management",
  "query": "parent_task:task-1"
}

# 루트 작업만 조회
search_nodes {
  "table_id": "task-management",
  "query": "parent_task:null"
}
```

### 3. 작업 상태 업데이트
```bash
# MCP 도구: update_node_attributes
# 작업 완료 처리 (동적 속성 추가 및 수정 지원)
update_node_attributes {
  "table_id": "task-management",
  "node_content": "Password Hashing",
  "attributes": {
    "status": "completed",
    "completion_date": "2025-01-15",
    "actual_hours": 5
  }
}
```

### 4. 진행률 추적
```bash
# 메인 작업 진행률 업데이트
update_node_attributes {
  "table_id": "task-management",
  "node_content": "Implement Authentication System", 
  "attributes": {
    "progress_percentage": "75%",
    "last_updated": "2025-01-15T14:30:00Z",
    "completion_notes": "JWT와 패스워드 해싱 완료, 미들웨어 작업 남음"
  }
}
```

## 📊 작업 현황 분석

### 1. 전체 작업 구조 조회
```bash
# MCP 도구: read_table  
# 테이블 전체 구조 조회 (테이블 스키마 + 데이터)
read_table {
  "table_id": "task-management"
}
```

### 2. 의존성 분석
```bash
# 작업 의존성 전체 분석
analyze_relations {
  "table_id": "task-management",
  "relation_type": "dependsOn"
}
```

## 🎨 작업 계층 구조 예시

```
task-1: Implement Authentication System [IN-PROGRESS, 75%]
  ├── task-1.1: JWT Token Generation [COMPLETED] 
  │   └── task-1.1.1: Login Validation Logic [COMPLETED]
  ├── task-1.2: Password Hashing [COMPLETED]
  └── task-1.3: Auth Middleware [PENDING]
      ├── task-1.3.1: Route Protection [PENDING]
      └── task-1.3.2: Permission Checking [PENDING]

task-2: Database Schema Design [COMPLETED] 
  ├── task-2.1: User Table Schema [COMPLETED]
  └── task-2.2: Migration Scripts [COMPLETED]

Dependencies:
task-1 → dependsOn → task-2 (schema_required)
```

## 📈 활용 패턴

### 1. 개발 스프린트 관리
- 스프린트별 작업 그룹화
- 백로그 우선순위 관리
- 개발자별 작업 할당

### 2. 기능 개발 추적
- 기능별 작업 분해
- 코드 파일과 작업 연결
- 리뷰 및 테스트 단계 관리

### 3. 버그 수정 워크플로
- 버그 재현 → 원인 분석 → 수정 → 테스트
- 관련 파일 및 영향 범위 추적
- 회귀 테스트 작업 연결

이 샘플은 bun-url-db의 테이블 시스템을 활용한 실제 작업 관리 시나리오를 보여주며, 계층적 구조와 메타데이터를 통한 효율적인 프로젝트 관리 방법을 제시합니다.