# 테스트 관리 시나리오 샘플

**다중 구현체 테스트 추적 및 의존성 관리 시스템**

## 📋 시나리오 개요

테스트를 독립적인 엔티티로 관리하며, 각 테스트의 다양한 구현체(Jest, Playwright, Postman 등)와 성공/실패 상태, 의존성 관계를 체계적으로 추적하는 실제 사용 예제입니다.

## 🎯 주요 특징

- **다중 구현체 지원**: 하나의 테스트에 여러 프레임워크 구현
- **상태 추적**: passing/failing/flaky 등 실시간 상태 관리
- **의존성 관리**: 테스트 간 선행 조건 및 차단 관계
- **성과 메트릭**: 성공률, 실행 시간, 커버리지 추적

## 🏗️ 테이블 구조 설계

### 1. 테스트 관리 테이블 생성
```bash
# MCP 도구: create_table
# 테스트 관리 전용 테이블 생성 (논리적 데이터 단위)
create_table {
  "identifier": "test-management",
  "description": "다중 구현체 테스트 추적 및 의존성 관리"
}
```

### 2. 테스트 속성 정의  
```bash
# MCP 도구: create_attributes
# 테이블의 컬럼 정의 (attribute_types 기반 데이터 타입)
create_attributes {
  "table_id": "test-management",
  "attributes": [
    {
      "identifier": "test_type",
      "attribute_type_id": "string",
      "description": "테스트 유형 (unit/integration/e2e/performance)",
      "is_required": true
    },
    {
      "identifier": "status",
      "attribute_type_id": "string",
      "description": "테스트 상태 (passing/failing/flaky/pending)",
      "is_required": true
    },
    {
      "identifier": "implementation_locations", 
      "attribute_type_id": "json",
      "description": "구현 파일 경로 배열",
      "is_required": true
    },
    {
      "identifier": "success_rate",
      "attribute_type_id": "string",
      "description": "성공률 퍼센티지",
      "is_required": false
    },
    {
      "identifier": "last_run",
      "attribute_type_id": "datetime", 
      "description": "마지막 실행 시간",
      "is_required": false
    },
    {
      "identifier": "test_suite",
      "attribute_type_id": "string",
      "description": "소속 테스트 스위트",
      "is_required": false
    },
    {
      "identifier": "frameworks",
      "attribute_type_id": "json",
      "description": "사용 프레임워크 목록",
      "is_required": false
    },
    {
      "identifier": "coverage",
      "attribute_type_id": "string",
      "description": "코드 커버리지 퍼센티지",
      "is_required": false
    },
    {
      "identifier": "execution_time",
      "attribute_type_id": "number",
      "description": "평균 실행 시간(초)",
      "is_required": false
    }
  ]
}
```

## 📝 실제 사용 예제

### 1. 기본 테스트 엔티티 생성
```bash
# MCP 도구: create_nodes
# 사용자 인증 테스트 (테이블의 row 데이터 생성)
create_nodes {
  "table_id": "test-management", 
  "nodes": [
    {
      "content": "User Authentication Test",
      "title": "사용자 인증 테스트",
      "attributes": {
        "test_type": "integration",
        "status": "passing",
        "implementation_locations": [
          "tests/auth/auth.test.ts",
          "tests/e2e/login.spec.ts"
        ],
        "success_rate": "95%",
        "last_run": "2025-01-15T10:30:00Z",
        "test_suite": "authentication-suite", 
        "frameworks": ["jest", "playwright"],
        "coverage": "87%",
        "execution_time": 2.3
      }
    }
  ]
}
```

### 2. 다중 구현체 테스트
```bash
# API 엔드포인트 테스트 (여러 구현체)
create_nodes {
  "table_id": "test-management",
  "nodes": [
    {
      "content": "API Endpoint Test",
      "title": "API 엔드포인트 테스트",
      "attributes": {
        "test_type": "integration", 
        "status": "failing",
        "implementation_locations": [
          "tests/api/endpoints.test.ts",
          "tests/api/auth-endpoints.test.ts", 
          "tests/postman/api-collection.json",
          "k6/api-load-test.js"
        ],
        "success_rate": "60%",
        "last_run": "2025-01-15T14:20:00Z",
        "test_suite": "api-suite",
        "frameworks": ["jest", "postman", "k6"],
        "coverage": "73%",
        "execution_time": 5.7
      }
    }
  ]
}
```

### 3. 성능 테스트
```bash
# 성능 로드 테스트
create_nodes {
  "table_id": "test-management",
  "nodes": [
    {
      "content": "Performance Load Test",
      "title": "성능 로드 테스트",
      "attributes": {
        "test_type": "performance",
        "status": "pending",
        "implementation_locations": [
          "tests/performance/load.test.ts",
          "k6/load-test.js",
          "artillery/load-config.yml"
        ],
        "test_suite": "performance-suite",
        "frameworks": ["k6", "artillery", "jest"],
        "target_metrics": "1000 concurrent users, <500ms response time"
      }
    }
  ]
}
```

### 4. 전제조건 테스트
```bash
# 데이터베이스 연결 테스트
create_nodes {
  "table_id": "test-management", 
  "nodes": [
    {
      "content": "Database Connection Test",
      "title": "데이터베이스 연결 테스트",
      "attributes": {
        "test_type": "unit",
        "status": "passing",
        "implementation_locations": ["tests/database/connection.test.ts"],
        "success_rate": "100%",
        "last_run": "2025-01-15T09:15:00Z",
        "test_suite": "database-suite",
        "frameworks": ["jest"],
        "coverage": "100%",
        "execution_time": 0.8
      }
    }
  ]
}
```

## 🔗 테스트 의존성 관리

### 1. 의존성 관계 생성
```bash
# MCP 도구: create_relations
# 테스트 간 의존성 설정 (테이블 독립적 관계 관리)
create_relations {
  "table_id": "test-management",
  "relations": [
    {
      "source_node_content": "API Endpoint Test",
      "target_node_content": "Database Connection Test",
      "relation_type_id": "depends_on",
      "properties": {
        "dependency_type": "prerequisite",
        "blocking": "true",
        "reason": "API 테스트는 데이터베이스 연결이 필요"
      }
    },
    {
      "source_node_content": "API Endpoint Test", 
      "target_node_content": "User Authentication Test",
      "relation_type_id": "depends_on",
      "properties": {
        "dependency_type": "prerequisite",
        "blocking": "true",
        "reason": "API 테스트는 인증 시스템이 필요"
      }
    },
    {
      "source_node_content": "Performance Load Test",
      "target_node_content": "API Endpoint Test",
      "relation_type_id": "depends_on", 
      "properties": {
        "dependency_type": "prerequisite",
        "blocking": "true",
        "reason": "로드 테스트는 안정적인 API 엔드포인트가 필요"
      }
    }
  ]
}
```

## 🛠️ 테스트 구현체 세부 관리

### 1. 구현체별 상태 추적
```bash
# Jest 구현체 세부 정보
create_nodes {
  "table_id": "test-management",
  "nodes": [
    {
      "content": "Jest Unit Implementation",
      "title": "Jest 단위 테스트 구현체",
      "attributes": {
        "parent_test": "User Authentication Test",
        "implementation_type": "unit",
        "framework": "jest",
        "file_path": "tests/auth/auth.test.ts",
        "status": "passing",
        "coverage": "87%",
        "last_run": "2025-01-15T10:30:00Z",
        "execution_time": 1.2
      }
    },
    {
      "content": "Playwright E2E Implementation", 
      "title": "Playwright E2E 테스트 구현체",
      "attributes": {
        "parent_test": "User Authentication Test",
        "implementation_type": "e2e",
        "framework": "playwright",
        "file_path": "tests/e2e/login.spec.ts",
        "status": "flaky",
        "browser_support": "chromium,firefox,webkit",
        "last_run": "2025-01-15T10:30:00Z",
        "execution_time": 8.5,
        "flaky_reason": "network_timeout_intermittent"
      }
    }
  ]
}
```

### 2. 구현체 간 관계 설정
```bash
# 구현체와 테스트 간 관계
create_relations {
  "table_id": "test-management",
  "relations": [
    {
      "source_node_content": "Jest Unit Implementation",
      "target_node_content": "User Authentication Test",
      "relation_type_id": "implements",
      "properties": {
        "implementation_scope": "unit_level",
        "coverage_type": "white_box"
      }
    },
    {
      "source_node_content": "Playwright E2E Implementation",
      "target_node_content": "User Authentication Test", 
      "relation_type_id": "implements",
      "properties": {
        "implementation_scope": "end_to_end", 
        "coverage_type": "black_box"
      }
    }
  ]
}
```

## 🔍 테스트 상태 및 성과 분석

### 1. 실패 테스트 조회
```bash
# MCP 도구: search_nodes
# attribute_types 기반 타입별 특화 검색 (현재 실패 중인 테스트)
search_nodes {
  "table_id": "test-management",
  "query": "status:failing"
}

# MCP 도구: search_nodes  
# Flaky 테스트 조회 (string 타입 정확 일치 검색)
search_nodes {
  "table_id": "test-management", 
  "query": "status:flaky"
}
```

### 2. 테스트 스위트별 조회
```bash
# 인증 스위트 테스트 조회
search_nodes {
  "table_id": "test-management",
  "query": "test_suite:authentication-suite"
}
```

### 3. 성과 메트릭 업데이트
```bash
# 테스트 실행 결과 업데이트
update_node_attributes {
  "table_id": "test-management",
  "node_content": "API Endpoint Test",
  "attributes": {
    "status": "passing",
    "success_rate": "95%",
    "last_run": "2025-01-15T16:45:00Z",
    "fixes_applied": "timeout 증가, retry 로직 추가",
    "execution_time": 4.2
  }
}
```

### 4. 커버리지 분석
```bash
# 낮은 커버리지 테스트 식별
search_nodes {
  "table_id": "test-management",
  "query": "coverage:<80%"
}
```

## 📊 테스트 스위트 관리

### 1. 테스트 스위트 엔티티 생성
```bash
# 인증 테스트 스위트
create_nodes {
  "table_id": "test-management",
  "nodes": [
    {
      "content": "Authentication Test Suite",
      "title": "인증 테스트 스위트",
      "attributes": {
        "entity_type": "test-suite",
        "suite_type": "functional",
        "status": "mostly_passing",
        "test_count": 15,
        "passing_count": 14,
        "coverage": "89%",
        "execution_time": 45,
        "last_run": "2025-01-15T16:45:00Z"
      }
    }
  ]
}
```

### 2. 스위트 멤버십 관리
```bash
# 테스트와 스위트 간 멤버십 관계
create_relations {
  "table_id": "test-management", 
  "relations": [
    {
      "source_node_content": "User Authentication Test",
      "target_node_content": "Authentication Test Suite",
      "relation_type_id": "member_of",
      "properties": {
        "membership_type": "primary",
        "execution_order": "1"
      }
    }
  ]
}
```

## 🎨 테스트 구조 예시

```
Database Connection Test [PASSING, 100%] 
├── Jest Implementation [tests/database/connection.test.ts]
└── Dependencies: None

User Authentication Test [PASSING, 95%]
├── Jest Unit Implementation [PASSING, 87% coverage]
├── Playwright E2E Implementation [FLAKY → STABLE]
└── Dependencies: Database Connection Test

API Endpoint Test [PASSING, 95%] 
├── Jest Integration Implementation [PASSING]
├── Postman API Collection [PASSING, staging env]
├── K6 Load Test [PENDING]
└── Dependencies: Database Connection Test, User Authentication Test

Performance Load Test [PENDING]
├── K6 Implementation [PENDING] 
├── Artillery Implementation [PENDING]
└── Dependencies: API Endpoint Test
```

## 📈 활용 패턴

### 1. CI/CD 파이프라인 통합
- 파이프라인 단계별 테스트 그룹 실행
- 실패 시 차단 및 알림 설정
- 성능 회귀 자동 탐지

### 2. 테스트 안정성 모니터링
- Flaky 테스트 식별 및 수정
- 성공률 추세 분석
- 실행 시간 최적화

### 3. 다중 환경 테스트 관리
- 개발/스테이징/프로덕션 환경별 실행
- 브라우저/디바이스별 호환성 테스트
- A/B 테스트 시나리오 관리

### 4. 품질 게이트 관리
- 최소 성공률 임계값 설정
- 커버리지 요구사항 검증
- 성능 기준선 유지

이 샘플은 bun-url-db의 테이블 시스템을 활용하여 복잡한 테스트 환경에서의 다중 구현체 관리, 의존성 추적, 성과 모니터링을 효과적으로 수행하는 방법을 제시합니다.