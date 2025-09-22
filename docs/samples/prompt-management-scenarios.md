# 프롬프트 관리 시나리오 샘플

**AI 프롬프트 라이브러리 및 버전 관리 시스템**

## 📋 시나리오 개요

AI 프롬프트를 체계적으로 관리하며, 버전 컨트롤, 템플릿 시스템, Langfuse 연동, 성능 추적을 통한 프롬프트 엔지니어링 워크플로우 실제 사용 예제입니다.

## 🎯 주요 특징

- **버전 관리**: 시맨틱 버저닝을 통한 프롬프트 이력 추적
- **템플릿 시스템**: 변수 치환 기능의 재사용 가능한 프롬프트 구조
- **외부 동기화**: Langfuse와의 양방향 동기화
- **성능 추적**: 사용량, 성공률, 응답 시간 모니터링

## 🏗️ 테이블 구조 설계

### 1. 프롬프트 관리 테이블 생성
```bash  
# MCP 도구: create_table
# 프롬프트 관리 전용 테이블 생성 (논리적 데이터 단위)
create_table {
  "identifier": "prompt-management",
  "description": "AI 프롬프트 라이브러리 및 버전 관리 시스템"
}
```

### 2. 프롬프트 속성 정의
```bash
# MCP 도구: create_attributes  
# 테이블의 컬럼 정의 (attribute_types 기반 JSON Schema 표준)
create_attributes {
  "table_id": "prompt-management",
  "attributes": [
    {
      "identifier": "domain_name",
      "attribute_type_id": "string",
      "description": "적용 도메인명 (customer-service, content-creation 등)",
      "is_required": true
    },
    {
      "identifier": "purpose",
      "attribute_type_id": "text", 
      "description": "프롬프트의 구체적 사용 목적",
      "is_required": true
    },
    {
      "identifier": "prompt_text",
      "attribute_type_id": "text",
      "description": "실제 프롬프트 텍스트",
      "is_required": true
    },
    {
      "identifier": "expected_output",
      "attribute_type_id": "text",
      "description": "예상 출력 형식 및 구조", 
      "is_required": true
    },
    {
      "identifier": "command_name",
      "attribute_type_id": "string",
      "description": "연결된 명령어명",
      "is_required": true
    },
    {
      "identifier": "version",
      "attribute_type_id": "string",
      "description": "시맨틱 버저닝 (x.y.z)",
      "is_required": true
    },
    {
      "identifier": "status",
      "attribute_type_id": "string",
      "description": "상태 (draft/review/active/deprecated)",
      "is_required": true
    },
    {
      "identifier": "model_config",
      "attribute_type_id": "json",
      "description": "AI 모델 설정 파라미터",
      "is_required": false
    },
    {
      "identifier": "langfuse_id",
      "attribute_type_id": "string",
      "description": "Langfuse 플랫폼 ID",
      "is_required": false
    },
    {
      "identifier": "usage_metrics",
      "attribute_type_id": "json",
      "description": "사용량 및 성능 메트릭",
      "is_required": false
    },
    {
      "identifier": "variables",
      "attribute_type_id": "json",
      "description": "템플릿 변수 정의",
      "is_required": false
    }
  ]
}
```

## 📝 실제 사용 예제

### 1. 기본 프롬프트 엔티티 생성
```bash
# MCP 도구: create_nodes
# 고객 지원 에이전트 프롬프트 (테이블의 row 데이터 생성)
create_nodes {
  "table_id": "prompt-management", 
  "nodes": [
    {
      "content": "customer-support-agent",
      "title": "고객 지원 에이전트 프롬프트",
      "attributes": {
        "domain_name": "customer-service",
        "purpose": "고객 문의를 공감적이고 효율적으로 처리",
        "prompt_text": "당신은 도움이 되는 고객 지원 담당자입니다. 항상 정중하고 공감하며 명확한 해결책을 제공하세요. 문제를 해결할 수 없다면 적절히 에스컬레이션하세요.",
        "expected_output": "JSON 형식: {action, response, escalate_flag, confidence_score}",
        "command_name": "handle_customer_inquiry",
        "version": "2.1.0",
        "status": "active",
        "model_config": {
          "model": "gpt-4",
          "temperature": 0.7,
          "max_tokens": 1000,
          "top_p": 0.9
        },
        "langfuse_id": "prompt_abc123",
        "usage_metrics": {
          "usage_count": 1247,
          "success_rate": 0.94,
          "avg_response_time": 1.2,
          "user_satisfaction": 4.6
        }
      }
    }
  ]
}
```

### 2. 템플릿 기반 프롬프트
```bash
# 이메일 응답 템플릿 프롬프트
create_nodes {
  "table_id": "prompt-management",
  "nodes": [
    {
      "content": "email-response-template",
      "title": "이메일 응답 템플릿",
      "attributes": {
        "domain_name": "communication",
        "purpose": "전문적인 이메일 응답 생성",
        "prompt_text": "{{customer_name}}님에게 {{inquiry_type}}에 관한 전문적인 이메일 응답을 작성하세요. {{tone}} 톤을 사용하고 {{required_info}}를 포함하세요.",
        "expected_output": "제목과 본문이 포함된 완전한 이메일",
        "command_name": "draft_email_response",
        "version": "1.0.0",
        "status": "active",
        "variables": {
          "customer_name": {
            "type": "string",
            "description": "고객명",
            "required": true
          },
          "inquiry_type": {
            "type": "string", 
            "description": "문의 유형",
            "required": true
          },
          "tone": {
            "type": "enum",
            "values": ["formal", "friendly", "urgent"],
            "description": "이메일 톤",
            "default": "friendly"
          },
          "required_info": {
            "type": "array",
            "items": "string",
            "description": "포함해야 할 정보 목록"
          }
        }
      }
    }
  ]
}
```

### 3. 버전 관리 프롬프트
```bash
# 고급 코드 리뷰어 프롬프트 (여러 버전)
create_nodes {
  "table_id": "prompt-management",
  "nodes": [
    {
      "content": "code-reviewer-v1",
      "title": "코드 리뷰어 v1.0",
      "attributes": {
        "domain_name": "development",
        "purpose": "코드 품질 및 보안 검토",
        "prompt_text": "제출된 코드를 검토하고 개선사항을 제안하세요. 버그, 성능 문제, 보안 취약점에 집중하세요.",
        "expected_output": "구조화된 리뷰 리포트",
        "command_name": "review_code",
        "version": "1.0.0",
        "status": "deprecated"
      }
    },
    {
      "content": "code-reviewer-v2",
      "title": "코드 리뷰어 v2.0", 
      "attributes": {
        "domain_name": "development",
        "purpose": "포괄적인 코드 품질 분석",
        "prompt_text": "코드를 포괄적으로 분석하여 다음 영역에서 피드백을 제공하세요: 1) 코드 품질 및 가독성, 2) 성능 최적화, 3) 보안 취약점, 4) 베스트 프랙티스 준수. 구체적인 개선 제안과 예제 코드를 포함하세요.",
        "expected_output": "JSON: {quality_score, security_issues, performance_suggestions, best_practices, example_fixes}",
        "command_name": "review_code",
        "version": "2.0.0", 
        "status": "active",
        "model_config": {
          "model": "gpt-4",
          "temperature": 0.3,
          "max_tokens": 2000
        }
      }
    }
  ]
}
```

### 4. 다국어 컨텐츠 생성 프롬프트
```bash
# 다국어 컨텐츠 생성 프롬프트
create_nodes {
  "table_id": "prompt-management",
  "nodes": [
    {
      "content": "multilingual-content-creator",
      "title": "다국어 컨텐츠 생성기",
      "attributes": {
        "domain_name": "content-creation",
        "purpose": "다양한 언어로 마케팅 컨텐츠 생성",
        "prompt_text": "{{target_language}}로 {{content_type}}을 작성하세요. 주제: {{topic}}, 타겟 오디언스: {{audience}}, 톤: {{tone}}. 문화적 맥락을 고려하여 현지화하세요.",
        "expected_output": "현지화된 완성된 컨텐츠",
        "command_name": "generate_multilingual_content",
        "version": "1.2.0",
        "status": "active",
        "variables": {
          "target_language": {
            "type": "enum",
            "values": ["ko", "en", "ja", "zh", "es", "fr"],
            "description": "대상 언어",
            "required": true
          },
          "content_type": {
            "type": "enum",
            "values": ["blog_post", "social_media", "advertisement", "email"],
            "description": "컨텐츠 유형"
          },
          "topic": {
            "type": "string",
            "description": "주제"
          },
          "audience": {
            "type": "string", 
            "description": "타겟 오디언스"
          },
          "tone": {
            "type": "string",
            "description": "원하는 톤"
          }
        }
      }
    }
  ]
}
```

## 🔄 프롬프트 컬렉션 관리

### 1. 프롬프트 컬렉션 생성
```bash
# 고객 서비스 프롬프트 컬렉션
create_nodes {
  "table_id": "prompt-management",
  "nodes": [
    {
      "content": "customer-service-suite",
      "title": "고객 서비스 프롬프트 스위트", 
      "attributes": {
        "collection_type": "prompt_collection",
        "description": "고객 서비스 운영을 위한 완전한 프롬프트 세트",
        "category": "customer-service",
        "maintainer": "support-team",
        "workflow_order": [
          "customer-support-agent",
          "escalation-handler", 
          "feedback-collector"
        ],
        "version": "1.0.0",
        "status": "active"
      }
    }
  ]
}
```

### 2. 컬렉션 멤버십 관계
```bash
# 프롬프트와 컬렉션 간 관계
create_relations {
  "table_id": "prompt-management",
  "relations": [
    {
      "source_node_content": "customer-support-agent",
      "target_node_content": "customer-service-suite",
      "relation_type_id": "member_of",
      "properties": {
        "membership_type": "primary",
        "execution_order": 1,
        "workflow_role": "initial_contact"
      }
    }
  ]
}
```

## 📊 성능 추적 및 최적화

### 1. 사용량 메트릭 업데이트
```bash
# 프롬프트 사용량 및 성능 업데이트
update_node_attributes {
  "table_id": "prompt-management",
  "node_content": "customer-support-agent",
  "attributes": {
    "usage_metrics": {
      "usage_count": 1348,
      "success_rate": 0.96,
      "avg_response_time": 1.1,
      "user_satisfaction": 4.7,
      "last_used": "2025-01-15T14:30:00Z",
      "failure_reasons": {
        "timeout": 2,
        "invalid_format": 1,
        "escalation_needed": 8
      }
    },
    "optimization_notes": "max_tokens을 800으로 줄여서 응답 속도 개선 검토"
  }
}
```

### 2. Langfuse 동기화 상태
```bash
# 외부 플랫폼 동기화 상태 업데이트
update_node_attributes {
  "table_id": "prompt-management",
  "node_content": "customer-support-agent",
  "attributes": {
    "sync_status": "synchronized",
    "last_sync": "2025-01-15T15:20:00Z", 
    "langfuse_version": "2.1.0",
    "sync_conflicts": null,
    "performance_score": 0.94
  }
}
```

## 🔍 프롬프트 검색 및 분석

### 1. 도메인별 프롬프트 조회
```bash
# MCP 도구: search_nodes
# attribute_types 기반 string 타입 정확 일치 검색
search_nodes {
  "table_id": "prompt-management",
  "query": "domain_name:customer-service"
}

# MCP 도구: search_nodes  
# 활성 상태 프롬프트만 조회 (타입별 특화 검색)
search_nodes {
  "table_id": "prompt-management",
  "query": "status:active"
}
```

### 2. 성능 기반 분석
```bash
# 높은 성공률 프롬프트 조회
search_nodes {
  "table_id": "prompt-management",
  "query": "usage_metrics.success_rate:>0.9"
}

# 사용량 높은 프롬프트 조회
search_nodes {
  "table_id": "prompt-management",
  "query": "usage_metrics.usage_count:>1000"
}
```

### 3. 버전 히스토리 분석
```bash
# 특정 명령어의 모든 버전 조회
search_nodes {
  "table_id": "prompt-management",
  "query": "command_name:review_code"
}
```

## 🛠️ 프롬프트 라이프사이클 관리

### 1. 버전 업데이트 워크플로
```bash
# 새 버전 프롬프트 생성
create_nodes {
  "table_id": "prompt-management",
  "nodes": [
    {
      "content": "customer-support-agent-v3",
      "title": "고객 지원 에이전트 v3.0",
      "attributes": {
        "domain_name": "customer-service",
        "purpose": "AI 기반 감정 분석을 포함한 고객 지원",
        "prompt_text": "당신은 고급 고객 지원 담당자입니다. 고객의 감정 상태를 분석하고, 그에 맞는 적절한 톤과 해결책을 제공하세요. 감정적 요구사항을 먼저 충족한 후 기술적 문제를 해결하세요.",
        "expected_output": "JSON: {emotion_analysis, response_tone, action_plan, escalation_flag, satisfaction_prediction}",
        "command_name": "handle_customer_inquiry",
        "version": "3.0.0",
        "status": "review"
      }
    }
  ]
}
```

### 2. A/B 테스트 설정
```bash
# A/B 테스트를 위한 프롬프트 변형 생성
create_relations {
  "table_id": "prompt-management",
  "relations": [
    {
      "source_node_content": "customer-support-agent-v3", 
      "target_node_content": "customer-support-agent",
      "relation_type_id": "variant_of",
      "properties": {
        "test_type": "ab_test",
        "test_ratio": "50:50",
        "test_metrics": ["response_time", "satisfaction", "resolution_rate"],
        "test_duration": "2_weeks"
      }
    }
  ]
}
```

## 🎨 프롬프트 구조 예시

```
Customer Service Suite [ACTIVE]
├── customer-support-agent v2.1.0 [ACTIVE, 96% success rate]
│   ├── Langfuse ID: prompt_abc123
│   └── Usage: 1,348 calls, 4.7/5 satisfaction
├── escalation-handler v1.5.0 [ACTIVE]
└── feedback-collector v1.0.0 [ACTIVE]

Development Suite [ACTIVE]  
├── code-reviewer v1.0.0 [DEPRECATED]
└── code-reviewer v2.0.0 [ACTIVE, 91% success rate]

Content Creation Suite [ACTIVE]
└── multilingual-content-creator v1.2.0 [ACTIVE]
    ├── Supports: ko, en, ja, zh, es, fr
    └── Content Types: blog, social, ads, email
```

## 📈 활용 패턴

### 1. 프롬프트 엔지니어링 워크플로
- 초안 작성 → 리뷰 → 테스트 → 스테이징 → 프로덕션 → 모니터링

### 2. 팀 협업 프롬프트 관리
- 도메인별 전문가 할당
- 버전 관리 및 승인 프로세스
- 성능 피드백 수집 및 개선

### 3. 다국가/다문화 프롬프트 운영
- 언어별 현지화 프롬프트
- 문화적 맥락 고려사항 관리
- 지역별 성능 메트릭 추적

### 4. 프롬프트 품질 관리
- 성공률 임계값 모니터링
- 자동 성능 회귀 탐지
- 사용자 피드백 기반 최적화

이 샘플은 bun-url-db의 테이블 시스템을 활용하여 엔터프라이즈급 AI 프롬프트 관리 시스템을 구축하고 운영하는 포괄적인 방법을 제시합니다.