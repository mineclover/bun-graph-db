# 테이블 분리 시나리오 샘플

**멀티 테이블 데이터 격리 및 네임스페이스 관리 시스템**

## 📋 시나리오 개요

단일 테이블(`table_id = 1`) 구조에서 다중 테이블 지원으로 확장하여 데이터 격리, 네임스페이스 분리, 멀티 테넌시를 제공하는 실제 사용 예제입니다.

## 🎯 주요 특징

- **데이터 격리**: 테이블간 완전한 데이터 분리
- **네임스페이스**: 동일 이름 엔티티의 테이블별 존재 허용  
- **멀티 테넌시**: 사용자/프로젝트/조직별 테이블 분리
- **접근 제어**: 테이블 기반 권한 관리

## 🏗️ 시스템 구조 설계

### 1. 기본 테이블 관리
```bash
# MCP 도구: create_table
# 개발 프로젝트용 테이블 생성 (논리적 데이터 단위)
create_table {
  "identifier": "dev-project-alpha",
  "description": "알파 개발 프로젝트 전용 데이터 테이블"
}

# MCP 도구: create_table
# 프로덕션 환경용 테이블 생성 (독립적 스키마 관리)
create_table {
  "identifier": "prod-customer-data",
  "description": "고객 데이터 프로덕션 환경"
}

# MCP 도구: create_table
# 테스트 환경용 테이블 생성 (네임스페이스 역할)
create_table {
  "identifier": "test-environment", 
  "description": "자동화된 테스트를 위한 격리된 환경"
}
```

### 2. 조직별 테이블 분리
```bash
# 조직 A 테이블
create_table {
  "identifier": "org-alpha-workspace",
  "description": "알파 조직 전용 작업 공간",
  "metadata": {
    "organization": "alpha-corp",
    "department": "engineering", 
    "access_level": "internal",
    "created_by": "admin@alpha-corp.com"
  }
}

# 조직 B 테이블
create_table {
  "identifier": "org-beta-workspace", 
  "description": "베타 조직 전용 작업 공간",
  "metadata": {
    "organization": "beta-inc",
    "department": "product",
    "access_level": "confidential",
    "created_by": "admin@beta-inc.com" 
  }
}
```

## 📝 실제 사용 예제

### 1. 개발 환경별 데이터 분리

#### 개발 환경 사용자 데이터
```bash
# MCP 도구: create_attributes
# 개발 환경 사용자 속성 정의 (attribute_types 기반 컬럼 정의)
create_attributes {
  "table_id": "dev-project-alpha",
  "attributes": [
    {
      "identifier": "user_id",
      "attribute_type_id": "string",
      "description": "개발용 사용자 ID",
      "is_required": true
    },
    {
      "identifier": "email",
      "attribute_type_id": "email",
      "description": "개발용 이메일 주소",
      "is_required": true
    },
    {
      "identifier": "role", 
      "attribute_type_id": "string",
      "description": "개발 환경 역할",
      "is_required": false
    }
  ]
}

# MCP 도구: create_nodes
# 개발 환경 사용자 생성 (테이블의 row 데이터 생성)
create_nodes {
  "table_id": "dev-project-alpha", 
  "nodes": [
    {
      "content": "dev-user-001",
      "title": "개발 사용자 001",
      "attributes": {
        "user_id": "dev-001", 
        "email": "test.user@dev.example.com",
        "role": "developer",
        "environment": "development",
        "test_data": true
      }
    }
  ]
}
```

#### 프로덕션 환경 사용자 데이터  
```bash
# 프로덕션 환경 사용자 속성 정의
create_attributes {
  "table_id": "prod-customer-data",
  "attributes": [
    {
      "identifier": "user_id",
      "attribute_type_id": "uuid",
      "description": "프로덕션 사용자 UUID",
      "is_required": true
    },
    {
      "identifier": "email",
      "attribute_type_id": "email", 
      "description": "고객 이메일 주소",
      "is_required": true
    },
    {
      "identifier": "subscription_tier",
      "attribute_type_id": "string",
      "description": "구독 등급",
      "is_required": false
    }
  ]
}

# 프로덕션 사용자 생성 (같은 이름이지만 다른 테이블)
create_nodes {
  "table_id": "prod-customer-data",
  "nodes": [
    {
      "content": "dev-user-001", # 개발과 동일한 이름이지만 다른 테이블에 격리
      "title": "실제 고객 사용자",
      "attributes": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "real.customer@company.com", 
        "subscription_tier": "premium",
        "environment": "production",
        "pii_data": true
      }
    }
  ]
}
```

### 2. 조직간 데이터 격리

#### 알파 조직 프로젝트 데이터
```bash
# 알파 조직 프로젝트 속성 정의
create_attributes {
  "table_id": "org-alpha-workspace",
  "attributes": [
    {
      "identifier": "project_code",
      "attribute_type_id": "string", 
      "description": "알파 조직 프로젝트 코드",
      "is_required": true
    },
    {
      "identifier": "client_info",
      "attribute_type_id": "json",
      "description": "클라이언트 정보",
      "is_required": false
    },
    {
      "identifier": "budget",
      "attribute_type_id": "number",
      "description": "프로젝트 예산",
      "is_required": false
    }
  ]
}

# 알파 조직 프로젝트 생성
create_nodes {
  "table_id": "org-alpha-workspace", 
  "nodes": [
    {
      "content": "project-phoenix",
      "title": "피닉스 프로젝트",
      "attributes": {
        "project_code": "ALPHA-PHX-2025",
        "client_info": {
          "name": "TechCorp Solutions",
          "contact": "john@techcorp.com",
          "priority": "high"
        },
        "budget": 250000,
        "status": "active",
        "organization": "alpha-corp"
      }
    }
  ]
}
```

#### 베타 조직 프로젝트 데이터 (동일한 속성명, 다른 테이블)
```bash
# 베타 조직 프로젝트 속성 정의
create_attributes {
  "table_id": "org-beta-workspace",
  "attributes": [
    {
      "identifier": "project_code",
      "attribute_type_id": "string",
      "description": "베타 조직 프로젝트 코드", 
      "is_required": true
    },
    {
      "identifier": "client_info",
      "attribute_type_id": "json", 
      "description": "클라이언트 정보",
      "is_required": false
    },
    {
      "identifier": "budget",
      "attribute_type_id": "number",
      "description": "프로젝트 예산",
      "is_required": false
    }
  ]
}

# 베타 조직 프로젝트 생성 (동일한 이름, 다른 테이블에 격리)
create_nodes {
  "table_id": "org-beta-workspace",
  "nodes": [
    {
      "content": "project-phoenix", # 알파와 동일한 이름이지만 완전 격리
      "title": "피닉스 프로젝트 (베타 버전)",
      "attributes": {
        "project_code": "BETA-PHX-2025",
        "client_info": {
          "name": "Innovation Labs",
          "contact": "sarah@innovationlabs.com", 
          "priority": "medium"
        },
        "budget": 180000,
        "status": "planning",
        "organization": "beta-inc"
      }
    }
  ]
}
```

### 3. 기능별 테이블 분리

#### 작업 관리 테이블
```bash
create_table {
  "identifier": "task-management-prod",
  "description": "프로덕션 작업 관리 시스템"
}

# 작업 관리 전용 속성
create_attributes {
  "table_id": "task-management-prod",
  "attributes": [
    {
      "identifier": "task_id",
      "attribute_type_id": "string",
      "description": "작업 식별자",
      "is_required": true
    },
    {
      "identifier": "assignee",
      "attribute_type_id": "string", 
      "description": "담당자",
      "is_required": false
    }
  ]
}
```

#### 고객 관리 테이블
```bash
create_table {
  "identifier": "customer-management-prod", 
  "description": "프로덕션 고객 관리 시스템"
}

# 고객 관리 전용 속성  
create_attributes {
  "table_id": "customer-management-prod",
  "attributes": [
    {
      "identifier": "customer_id",
      "attribute_type_id": "uuid",
      "description": "고객 고유 식별자",
      "is_required": true
    },
    {
      "identifier": "tier",
      "attribute_type_id": "string",
      "description": "고객 등급",
      "is_required": false
    }
  ]
}
```

## 🔗 테이블 간 관계 관리

### 1. 크로스 테이블 참조
```bash
# 개발 환경 작업이 프로덕션 고객과 연결
create_nodes {
  "table_id": "task-management-prod",
  "nodes": [
    {
      "content": "customer-integration-task",
      "title": "고객 통합 작업",
      "attributes": {
        "task_id": "TASK-2025-001",
        "assignee": "dev-team",
        "related_customer_table": "customer-management-prod",
        "related_customer_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  ]
}

# 테이블 간 관계 생성 (외부 참조)
create_relations {
  "table_id": "task-management-prod",
  "relations": [
    {
      "source_node_content": "customer-integration-task",
      "target_external_id": "customer-management-prod:premium-customer-001",
      "relation_type_id": "references",
      "properties": {
        "reference_type": "cross_table",
        "target_table": "customer-management-prod"
      }
    }
  ]
}
```

## 🔍 테이블별 데이터 조회

### 1. 테이블 컨텍스트별 검색
```bash
# 개발 환경에서만 검색
search_nodes {
  "table_id": "dev-project-alpha", 
  "query": "user_id:dev-001"
}

# 프로덕션 환경에서만 검색  
search_nodes {
  "table_id": "prod-customer-data",
  "query": "subscription_tier:premium"
}

# 알파 조직에서만 검색
search_nodes {
  "table_id": "org-alpha-workspace",
  "query": "project_code:ALPHA*"
}
```

### 2. 전체 테이블 목록 조회
```bash
# MCP 도구: list_tables
# 시스템 내 모든 테이블 조회 (테이블 메타데이터 포함)
list_tables {}

# MCP 도구: list_tables
# 특정 조직의 테이블만 조회 (메타데이터 필터링)
list_tables {
  "filter": {
    "metadata.organization": "alpha-corp"
  }
}
```

### 3. 테이블별 통계
```bash
# 각 테이블의 노드 수 및 관계 수 조회
get_table_stats {
  "table_id": "org-alpha-workspace"
}
```

## 🔄 테이블 마이그레이션 및 복제

### 1. 테이블 데이터 복제
```bash
# MCP 도구: clone_table
# 개발 환경 → 테스트 환경 데이터 복제 (테이블 레벨 복사)
clone_table {
  "source_table_id": "dev-project-alpha",
  "target_table_id": "test-environment", 
  "clone_options": {
    "include_relations": true,
    "update_references": true,
    "prefix_nodes": "test-"
  }
}
```

### 2. 노드 마이그레이션
```bash
# 특정 노드를 다른 테이블로 이동
migrate_nodes {
  "source_table_id": "dev-project-alpha",
  "target_table_id": "prod-customer-data",
  "node_filter": {
    "content": "verified-user-*"
  },
  "migration_options": {
    "preserve_relations": true,
    "update_attributes": {
      "environment": "production"
    }
  }
}
```

## 📊 접근 제어 및 권한 관리

### 1. 테이블 기반 권한 설정
```bash
# 테이블 메타데이터에 권한 정보 설정
update_table {
  "table_id": "prod-customer-data",
  "metadata": {
    "access_control": {
      "read": ["admin", "customer-service"],
      "write": ["admin"],
      "delete": ["admin"],
      "export": ["admin", "data-analyst"]
    },
    "data_classification": "confidential",
    "compliance": ["GDPR", "CCPA"]
  }
}
```

### 2. 조직별 네임스페이스 관리
```bash
# 조직별 접근 가능한 테이블 목록 관리
create_table {
  "identifier": "org-alpha-public",
  "description": "알파 조직 공개 데이터",
  "metadata": {
    "visibility": "public",
    "organization": "alpha-corp",
    "accessible_by": ["alpha-corp", "partner-orgs"]
  }
}
```

## 🎨 테이블 분리 구조 예시

```
Production Environment:
├── prod-customer-data [ACTIVE, 15,247 nodes]
│   ├── premium customers [8,234 nodes]  
│   ├── standard customers [6,891 nodes]
│   └── trial users [122 nodes]
├── task-management-prod [ACTIVE, 3,456 nodes]
└── customer-management-prod [ACTIVE, 15,247 nodes]

Development Environment:  
├── dev-project-alpha [ACTIVE, 892 nodes]
│   ├── test users [245 nodes]
│   ├── mock data [547 nodes] 
│   └── development tasks [100 nodes]
└── test-environment [ACTIVE, 1,234 nodes]

Organization Separation:
├── org-alpha-workspace [PRIVATE, 567 nodes]
│   ├── Alpha Corp projects [245 nodes]
│   └── Internal resources [322 nodes] 
├── org-beta-workspace [PRIVATE, 891 nodes]
│   ├── Beta Inc projects [456 nodes]
│   └── Confidential data [435 nodes]
└── org-public-shared [PUBLIC, 123 nodes]
```

## 📈 활용 패턴

### 1. 환경별 데이터 분리
- 개발/스테이징/프로덕션 환경 격리
- 테스트 데이터와 실제 데이터 분리
- 환경간 안전한 데이터 마이그레이션

### 2. 멀티 테넌트 SaaS 운영
- 고객별 완전 데이터 격리
- 조직별 네임스페이스 관리  
- 계층적 권한 및 접근 제어

### 3. 프로젝트 기반 데이터 관리
- 프로젝트별 독립적인 데이터 공간
- 팀간 데이터 격리 및 협업
- 프로젝트 완료 후 데이터 아카이브

### 4. 규정 준수 데이터 관리
- 민감 데이터와 일반 데이터 분리
- 지역별 데이터 거버넌스 준수
- 감사 추적 및 접근 로그 관리

이 샘플은 bun-url-db의 테이블 시스템을 활용하여 엔터프라이즈급 멀티 테넌트 데이터 아키텍처를 구현하고 안전하게 운영하는 포괄적인 방법을 제시합니다.