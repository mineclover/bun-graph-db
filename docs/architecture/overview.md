# 🏗️ bun-url-db System Overview

<!-- Verification Metadata -->
<!-- Last Verified: 2025-09-03 -->
<!-- Verified By: Claude Code -->
<!-- Verification Scope: Core system architecture and data model -->
<!-- Status: ✅ Fully Verified -->

**Structured Knowledge Graph Database with Dynamic Schema Management**

## 🎯 System Concept

bun-url-db는 **AI 친화적인 테이블 기반 구조화된 지식 그래프 시스템**입니다. 전통적인 데이터베이스의 테이블 구조와 지식 그래프의 유연성을 결합하여, 동적 스키마 관리와 고급 검색 기능을 제공합니다.

**핵심 철학**: AI가 데이터베이스 테이블을 메타적으로 정의하고, 이를 지속적으로 기억하면서 해당 테이블에 구조화된 데이터를 계속 적재할 수 있도록 설계된 시스템입니다. 다양한 외부 시스템의 데이터 모델을 url-db의 유연한 구조로 통합하여, 단일 인터페이스로 관리할 수 있는 **AI 기반 통합 데이터 플랫폼** 역할을 수행합니다.

**AI 중심 설계**:
- **메타 스키마 정의**: AI가 테이블 구조를 이해하고 정의할 수 있는 메타데이터 시스템
- **지속적 컨텍스트**: 한 번 정의된 테이블 구조를 AI가 계속 기억하고 활용
- **구조화된 데이터 적재**: AI가 테이블 스키마에 맞춰 자동으로 데이터를 구조화하여 저장
- **스키마 인식 상호작용**: AI가 각 테이블의 속성과 제약조건을 이해하고 적절한 데이터 처리 수행

## 🔄 기본 사용 흐름

**표준 워크플로우**: 테이블 정의 → 속성 생성 → 문서 작성 → 데이터 수집 → 검색 활용 → JSON 출력

### 1. 테이블 및 스키마 정의
- **테이블 생성**: 비즈니스 목적에 맞는 테이블 구조 정의
- **속성 설정**: `attribute_types` 기반 컬럼 정의 및 제약조건 설정
- **docs 작성**: 테이블 사용법과 목적을 카테고리별 문서로 정리

### 2. 데이터 수집 및 관리
- **node 생성**: 테이블 정의에 따른 구조화된 데이터 입력
- **관계 설정**: 테이블 간 독립적인 관계 정의 및 관리
- **템플릿 활용**: 검색 템플릿을 통한 효율적인 데이터 조회

### 3. 활용 및 출력
- **고급 검색**: attribute_types 기반 타입별 특화 검색 수행
- **JSON 출력**: 테이블 데이터를 표준 JSON 형식으로 export
- **스키마 출력**: JSON Schema 표준으로 테이블 구조 export

### 4. GraphQL 서버 구현
**GraphQL API 서버**: SQLite 스키마를 기반으로 한 완전한 GraphQL 서버를 구현합니다. 이 GraphQL 서버는 [mcp-graphql](https://github.com/blurrah/mcp-graphql)을 통해 MCP(Model Context Protocol)로 변환되어 AI 도구들과의 통합을 지원합니다.

**구현 목표**:
- SQLite 데이터베이스 구조를 GraphQL 스키마로 완전 매핑
- 타입 안전성과 실시간 데이터 조회를 지원하는 현대적인 GraphQL API
- 헥사고날 아키텍처와 모듈화를 통한 확장 가능하고 유지보수하기 쉬운 구조
- GraphQL → MCP 변환을 통한 AI 도구 생태계와의 원활한 통합

## 🏗️ Core Architecture

### 1. Table Definition
**테이블**은 데이터 구조의 논리적 단위입니다.

**테이블 정의 요소:**
- **이름**: 데이터 구조의 고유 식별자 (테이블명 역할)
- **설명**: 테이블의 목적과 용도 정의
- **속성 집합**: 해당 테이블에서 사용 가능한 모든 컬럼 정의
- **제약 조건**: 데이터 무결성 규칙 및 검증 조건

**특징:**
- 논리적 데이터 분리 및 조직화
- 독립적인 스키마 관리
- 네임스페이스 역할 수행

### 2. Attribute Schema Definition
**속성은 테이블의 컬럼 정의**와 동일하며, 데이터 타입과 제약조건을 포함합니다.

**속성 정의 요소:**
- **이름**: 속성의 고유 식별자
- **타입**: 저장될 데이터의 형태 정의
- **필수 여부**: NULL 허용 여부 결정
- **검증 규칙**: 데이터 유효성 검사 조건
- **메타데이터**: 인덱스, 고유성 등 추가 제약

**기본 지원 데이터 타입** (`attribute_types` 테이블을 통해 확장 가능):
- **string**: 텍스트 데이터 저장
- **boolean**: 참/거짓 값 저장
- **integer**: 정수 데이터 저장
- **number**: 실수 데이터 저장
- **date**: 날짜 정보 저장 (YYYY-MM-DD 형식)
- **datetime**: 날짜/시간 정보 저장 (ISO 8601 형식)
- **email**: 이메일 주소 형식
- **uri**: URI/URL 형식
- **uuid**: UUID 식별자 형식
- **text**: 긴 텍스트 콘텐츠
- **json**: 구조화된 JSON 객체 데이터
- **array**: JSON 배열 형태 다중 값
- **reference**: 외부 참조 타입 (느슨한 결합 방식)

**확장성**: `attribute_types` 테이블에 새로운 타입 정의를 추가하여 커스텀 데이터 타입과 검증 규칙을 자유롭게 확장할 수 있습니다.

#### 참조 타입 (Reference Type) 시스템

**느슨한 결합 참조 아키텍처**: 외부 시스템이나 다른 테이블의 데이터를 안전하고 효율적으로 참조할 수 있는 특수 타입입니다.

**이중 구조 설계**:

1. **선언적 참조 정의** (`reference_config` 컬럼):
```json
{
  "source": "external_service",
  "endpoint": "/api/users/{id}",
  "method": "GET", 
  "resolver": "user_resolver",
  "ttl": 3600
}
```

2. **인스턴스 캐시 데이터** (`node_attributes.value`):
```json
{
  "id": "user_42",
  "last_response": {"name": "John", "email": "john@example.com"},
  "fetched_at": "2024-01-01T12:00:00Z",
  "cache_status": "valid"
}
```

**참조 해결 프로세스**:
1. **선언적 해결 방법**: `attribute_types`에서 참조 해결 방법 정의
2. **캐시 상태 확인**: 실제 값에서 캐시 유효성 검사
3. **지연 로딩**: 필요시에만 외부 데이터 페치
4. **자동 갱신**: TTL 기반 캐시 갱신 및 상태 관리

**시스템 장점**:
- **독립성**: 참조 무결성에 의존하지 않는 느슨한 결합
- **성능**: 스마트 캐싱과 지연 로딩으로 효율적인 데이터 접근
- **확장성**: 새로운 외부 시스템 쉽게 추가 가능
- **안정성**: 외부 시스템 장애시에도 캐시된 데이터 활용 가능

### 3. Node (Row) Management
**Node는 테이블의 row**에 해당하며, 정의된 스키마에 따라 데이터를 저장합니다.

**Node 구성 요소:**
- **고유 식별자**: 시스템 내에서 Node를 구분하는 내부 ID
- **테이블 참조**: 해당 Node가 속한 테이블에 대한 연결
- **기본 식별자**: 사용자가 정의하는 Node의 주요 식별 값
- **속성 값 집합**: Domain에 정의된 속성들에 대응하는 실제 데이터 값들

**Node 특징:**
- Domain에서 정의된 스키마 제약 조건 준수
- 필수 속성에 대한 값 보장
- 동적 속성 추가 및 수정 지원

**개별 Node 조회 및 관리**:
- **ID 기반 조회**: Node의 고유 식별자로 개별 Node 정보 조회
- **속성 CRUD**: Node의 속성 추가, 편집, 제거 기능
- **스키마 준수성**: 테이블에 정의되지 않은 속성은 "미아 값"으로 분류
- **조회 옵션**: 유효한 값만 반환하거나 저장된 모든 값을 반환하는 옵션 선택 가능

## 🛡️ Data Validation & Integrity

### attribute_types 기반 검증 시스템
**JSON Schema 표준을 활용한 강력한 데이터 검증:**

**검증 메커니즘**:
- **타입 검증**: `attribute_types`의 `json_type` 필드에 따른 기본 데이터 타입 검증
- **형식 검증**: `format` 필드를 통한 특수 형식 검증 (email, uuid, date, uri 등)
- **스키마 검증**: `validation_schema` JSON Schema를 통한 고급 제약조건 검증
- **범위 검증**: 최솟값, 최댓값, 길이 제한 등의 범위 검증

**검증 적용 시점**:
- **노드 생성 시**: 모든 필수 속성 검증 및 타입 일치 확인
- **노드 업데이트 시**: 변경되는 속성에 대한 검증 수행
- **JSON Schema Export 시**: 스키마 정의 검증 및 일관성 확인
- **MCP 도구 실행 시**: 입력 파라미터의 유효성 검증

**무결성 보장**:
- **참조 무결성**: 외래키 제약을 통한 테이블 간 관계 보장
- **도메인 무결성**: attribute_types 기반 데이터 타입 및 형식 보장
- **개체 무결성**: 테이블별 content 필드의 유일성 보장
- **사용자 정의 무결성**: validation_schema를 통한 커스텀 제약조건

**오류 처리**:
- **검증 실패 시**: 명확한 오류 메시지와 함께 작업 거부
- **부분 검증**: 일부 속성만 업데이트 시 해당 속성에 대해서만 검증
- **기존 데이터 보호**: 스키마 변경 시에도 기존 데이터 무결성 유지

## 🔧 Schema Management

### 1. Dynamic Schema Evolution
스키마는 동적으로 변경 가능하며, **기존 데이터에 대한 비파괴적 변경**을 보장합니다.

**스키마 진화 단계:**
1. 새로운 속성 정의
2. 제약 조건 설정
3. 새 데이터에 적용
4. 기존 데이터 무결성 보장

**스키마 변경 정책:**
- **신규 필수 속성**: 새로 추가되는 데이터에만 적용
- **타입 변경**: 기존 데이터 보존, 신규 데이터는 새 타입으로 저장
- **제약 조건 추가**: 기존 데이터 영향 없이 신규 데이터에만 검증 적용
- **데이터 보호**: 기존에 저장된 데이터는 스키마 변경과 무관하게 보존

### 2. Required Attribute Handling

**신규 데이터 저장 원칙:**
- 모든 필수 속성에 대한 값이 제공되어야 함
- 필수 속성 누락 시 데이터 저장 거부
- 선택적 속성은 값 제공 없이도 저장 허용
- 검증 통과 후에만 데이터베이스에 저장

**기존 데이터 보호 원칙:**
- 새로운 필수 속성이 추가되어도 기존 데이터는 그대로 유지
- 스키마 변경으로 인한 기존 데이터 삭제 또는 수정 없음
- 기존 데이터는 이전 스키마 기준으로 유효한 상태 보장
- 데이터 일관성보다 데이터 보존을 우선시

## 🔍 Advanced Filter Search System

### 1. Type-Based Search Operations
**속성의 데이터 타입에 따라 사용 가능한 검색 연산자와 방식이 자동으로 결정됩니다.**

**타입별 검색 시스템**: 각 속성의 데이터 타입에 최적화된 검색 연산자와 필터링 방식을 제공하며, 기본 제공 타입 외에도 향후 커스텀 데이터 타입에 대한 확장이 가능한 구조로 설계되었습니다.

**기본 지원 데이터 타입별 검색 기능** (예시):

**String 타입**: 포함 검색, 시작/종료 문자열 검색, 완전 일치 검색, 정규식 패턴 검색, 대소문자 구분/무시 옵션

**Number 타입**: 정확한 값 일치, 범위 검색 (크다/작다/사이), 특정 값 목록 내 포함 여부 검색, 숫자 정렬 및 순위 기반 검색

**Date 타입**: 날짜 정확 일치, 이전/이후 날짜 검색, 날짜 범위 검색, 상대적 날짜 검색, 시간대 고려 검색 옵션

**Boolean 타입**: 참/거짓 값 정확 일치 검색, NULL/비어있음 상태 검색

**Array 타입**: 배열 내 특정 값 포함 검색, 모든 값 포함/일부 값 포함 검색, 배열 길이 기반 검색

**JSON 타입**: 구조화된 객체 내 특정 필드 검색, 중첩 속성 접근, 객체 구조 일치 검색

**확장 가능한 타입 시스템**: 향후 지리적 위치(geolocation), 파일 메타데이터(file_metadata), 색상(color) 등의 전문 데이터 타입이 추가될 수 있으며, 각각에 특화된 검색 연산자가 제공됩니다.

### 2. Complex Query Support
**attribute_types 기반 다중 조건 검색 지원**: `attribute_types`에 정의된 각 데이터 타입별로 특화된 검색 옵션들을 조합하여 정교한 복합 쿼리를 구성할 수 있습니다.

**타입별 검색 조건 조합**:
- **타입 인식 필터링**: 각 속성의 `attribute_type_id`에 따라 해당 타입에 최적화된 검색 연산자 자동 선택
- **검증 기반 쿼리**: `attribute_types`의 `validation_schema` 정보를 활용한 유효한 값 범위 내 검색
- **포맷별 특화 검색**: `format` 필드 정보를 기반으로 한 특수 형식 데이터 검색 (email, uuid, date 등)
- **다중 타입 조건**: 서로 다른 데이터 타입의 속성들을 논리 연산자(AND/OR)로 결합한 복합 검색

### 3. Extensible Filter Architecture
**MCP 서버에서 관리되는 플러그인 아키텍처:**

**필터 핸들러 시스템**: 각 데이터 타입별 전용 검색 핸들러가 검색 연산을 담당하며, 새로운 데이터 타입에 대한 검색 기능을 동적으로 추가할 수 있습니다.

**확장성 특징**:
- **타입별 특화**: 각 데이터 타입에 최적화된 검색 연산자 제공
- **동적 확장**: 런타임에 새로운 필터 핸들러 추가 가능
- **플러그인 구조**: 독립적인 검색 모듈로 관리되어 유지보수성 향상

**향후 확장 예시**: 지리적 위치 데이터 타입을 위한 공간 검색 (범위 내, 거리 기반, 인근 검색) 기능 추가 가능

## 📤 Data Export/Import System

### 1. Table Data Export
**테이블 형태의 완전한 테이블 데이터 export:**

**Export 기능**: 테이블의 모든 데이터를 테이블 구조에 맞는 JSON 형식으로 export하여 외부 시스템과의 데이터 교환이나 백업 목적으로 활용할 수 있습니다.

**Export JSON 구조**:
- **tableName**: 테이블의 고유 식별 이름
- **createdAt**: 테이블 생성 시각 정보
- **data**: Node들을 row 형태로 구성한 배열 데이터

**Data 배열 구성**:
- **id**: url-db 시스템 내부의 Node 고유 식별자 (시스템 전체에서 유일)
- **content**: 테이블별로 정의된 사용자 식별자 (테이블 내에서 유일)
- **속성 필드들**: 테이블에 정의된 각 속성의 실제 값들
- **메타데이터**: 생성일시, 수정일시 등의 시스템 관리 정보

### 2. JSON Schema Export  
**테이블의 속성 정의를 JSON Schema 표준으로 export:**

**Export 기능**: 테이블에 정의된 모든 속성과 제약 조건을 JSON Schema Draft-07 표준 형식으로 변환하여 외부 시스템에서 활용 가능한 스키마 파일을 생성합니다.

**attribute_types 기반 변환**: `attribute_types` 테이블에 저장된 JSON Schema 표준 타입 정보를 활용하여 안정적이고 일관된 스키마 생성이 보장됩니다.

**Export 구성 요소**:
- **타입 매핑**: `attribute_types`의 `json_type`, `format` 정보를 JSON Schema 타입으로 변환
- **검증 규칙**: `attribute_types`의 `validation_schema`를 활용한 유효성 검증 조건
- **기본값**: `default_value` 정보를 JSON Schema 기본값으로 적용
- **예제 데이터**: `examples` 필드의 값을 JSON Schema 예제로 포함
- **필수 속성**: 각 속성의 `is_required` 설정에 따른 required 배열 생성
- **메타데이터**: 속성 설명과 스키마 버전 정보 포함

**스키마 최적화 가능성**: `attribute_types`에 정의된 `validation_schema`, `default_value`, `examples` 등의 정보를 기반으로 JSON Schema export 과정에서 더 정교한 제약조건, 최적화된 기본값 설정, 실제 사용패턴을 반영한 예제 데이터 등으로 스키마를 개선할 여지가 있습니다.

### 3. Schema Validation
**Export된 스키마는 표준 JSON Schema 검증 도구로 사용 가능:**

**검증 활용**: Export된 JSON Schema는 표준 JSON Schema 라이브러리들과 완벽 호환되어 데이터 검증, API 문서화, 폼 생성 등 다양한 용도로 활용할 수 있습니다.

**활용 사례**:
- **데이터 검증**: 입력 데이터의 형식과 제약 조건 검증
- **API 문서화**: OpenAPI 스펙의 스키마 정의로 활용
- **폼 생성**: UI 폼 자동 생성을 위한 스키마 정보 제공
- **타입 생성**: TypeScript, JSON Schema to Code 도구와의 연계

### 4. Rapid Schema Import
**JSON Schema를 다시 임포트하여 테이블 속성 빠른 설정:**

**Import 기능**: 표준 JSON Schema 파일을 분석하여 url-db의 테이블 속성 정의를 자동으로 생성하는 역변환 기능을 제공합니다.

**Import 처리 과정**:
- **스키마 분석**: JSON Schema의 properties, required, constraints 정보 추출
- **속성 매핑**: JSON Schema 타입을 url-db 속성 타입으로 변환
- **제약 변환**: JSON Schema 검증 규칙을 url-db 제약 조건으로 변환
- **자동 생성**: 분석된 정보를 바탕으로 테이블 속성 자동 생성

## 🛠️ Documentation & Template System

### 1. Table Documentation Board
**테이블별 사용처 및 가이드를 위한 카테고리별 문서화 게시판:**

**Docs 시스템**: 각 테이블의 사용법, 목적, 예제 등을 카테고리별로 체계적으로 관리할 수 있는 문서화 시스템입니다.

**문서 카테고리**:
- **usage**: 테이블의 주요 사용처와 활용 방법
- **guide**: 사용자를 위한 가이드 및 매뉴얼
- **example**: 구체적인 사용 예제와 샘플 데이터
- **spec**: 기술적 명세와 제약사항
- **general**: 기타 일반적인 메모 및 정보

**버전 관리 특징**:
- **버전별 관리**: 각 카테고리별로 다중 버전 지원
- **활성 상태 제어**: 테이블+카테고리별로 하나의 활성 문서만 유지
- **자유 형식 콘텐츠**: 마크다운, 텍스트 등 자유로운 형식의 문서 작성

### 2. Search Query Template System
**attribute_type_id 기반 검색식 관리 시스템:**

**Templates 시스템**: `attribute_types`에 정의된 각 데이터 타입별로 특화된 검색 쿼리 템플릿을 저장하고 관리하는 시스템입니다.

**템플릿 타입**:
- **filter**: 필터링 조건 템플릿 (기본값)
- **sort**: 정렬 조건 템플릿
- **aggregate**: 집계 함수 템플릿
- **validation**: 데이터 검증 템플릿

**템플릿 구성**:
- **검색식 템플릿**: SQL WHERE 조건 또는 JSON 쿼리 형태의 검색식
- **타입별 특화**: 각 `attribute_type_id`에 최적화된 검색 패턴
- **사용 예제**: JSON 배열 형태의 실제 사용 사례
- **버전 관리**: 검색식 수정 및 개선을 위한 버전별 관리
- **테이블별 관리**: 테이블+속성타입+식별자+버전 조합으로 고유성 보장

**사용자 피드백 시스템**:
- **성공 카운트**: 사용자가 원하는 결과를 얻었을 때 피드백 기록
- **실패 카운트**: 사용자가 원하는 결과를 얻지 못했을 때 피드백 기록
- **총 사용횟수**: 템플릿이 사용된 총 횟수 추적
- **성공률 기반 최적화**: 피드백 데이터를 바탕으로 검색 템플릿의 효과성 평가 및 개선

**확장 가능성**: 구현 방식에 따라 다양한 검색 쿼리 생성을 지원할 수 있는 고급 쿼리 빌더 시스템으로 확장될 가능성이 있으며, 복잡한 조건문, 동적 필터 생성, 쿼리 최적화, 머신러닝 기반 검색 개선 등의 기능을 포함할 수 있습니다.

## 🔄 Data Lifecycle Management

### 1. CRUD Operations
**완전한 데이터 생명주기 관리**: 테이블 내 Node에 대한 생성, 조회, 수정, 삭제 작업을 스키마 검증과 함께 안전하게 수행합니다.

**작업별 특징**:
- **Create**: 스키마 검증을 통한 데이터 무결성 보장 후 저장
- **Read**: 타입 인식 필터링과 페이지네이션을 통한 효율적인 데이터 조회
- **Update**: 제약 조건 검증과 버전 관리를 통한 안전한 데이터 수정
- **Delete**: 관계 정리와 연쇄 처리를 통한 완전한 데이터 삭제

### 2. Relationship Management
**Node 간의 관계는 테이블과 독립적으로 관리되며 테이블 경계를 자유롭게 초월:**

**관계 관리 시스템**: 관계는 테이블과 무관하게 독립적으로 정의되며, 어떤 테이블의 Node든 다른 테이블의 Node와 자유롭게 관계를 형성할 수 있습니다.

**관계 구성 요소**:
- **소스 Node**: 관계의 출발점이 되는 Node (모든 테이블 가능)
- **타겟 Node**: 관계의 도착점이 되는 Node (모든 테이블 가능)
- **관계 타입**: 관계의 의미와 성격을 나타내는 분류
- **관계 속성**: 관계에 추가되는 메타데이터 (역할, 시작일, 강도 등)
- **테이블 독립성**: 관계 정의는 테이블 구조와 완전히 독립적

#### 온톨로지식 외부 시스템 통합

**하이브리드 노드 참조 시스템**: url-db는 내부 Node뿐만 아니라 외부 시스템의 엔티티와도 관계를 형성할 수 있는 온톨로지식 설계를 채택했습니다.

**외부 시스템 식별자 관리**:
- **서비스 자율성 원칙**: 각 외부 서비스는 고유한 식별자 체계를 가지며, 이를 그대로 존중
- **단일 서비스 = 단일 식별자**: GitHub은 "repo:owner/project#issue-123", JIRA는 "PROJECT-456" 형태의 자체 식별자 사용
- **의미론적 명확성**: 식별자 자체가 서비스와 엔티티의 의미를 직관적으로 표현

**온톨로지 설계의 장점**:
- **자연스러운 통합**: AI가 "GitHub 이슈와 JIRA 티켓을 연결"이라고 표현하면 자동으로 적절한 식별자로 매핑
- **확장성**: 새로운 외부 서비스 추가 시 스키마 변경 없이 즉시 통합 가능
- **서비스 특성 보존**: 각 서비스의 고유한 네이밍 컨벤션과 구조적 특성 유지

**애플리케이션 레벨 관리**:
- **서비스 레지스트리**: 각 외부 서비스의 메타데이터와 API 정보는 애플리케이션에서 관리
- **식별자 파싱**: 외부 식별자의 구조 분석과 실제 API 호출을 위한 변환은 애플리케이션 로직으로 처리
- **비즈니스 로직 분리**: 데이터베이스는 온톨로지적 의미 저장, 애플리케이션은 실행 가능한 동작 처리

**내부 시스템의 외부 식별 필요성**: url-db 내부의 Node들도 외부 시스템에서 참조될 때를 대비해 고유한 외부 식별자가 필요하며, 이는 애플리케이션 레벨에서 관리되어야 합니다.

**현재 제공 기능**:
- **백링크 조회**: 특정 Node로 들어오는 관계들의 정보 제공
- **Forward링크 조회**: 특정 Node에서 나가는 관계들의 정보 제공
- **하이브리드 관계 탐색**: 내부-내부, 내부-외부 관계 유형 지원 (외부-외부 직접 관계는 미지원)

**향후 확장 예정**: 다차원 관계 분석, 관계 패턴 탐지, 그래프 순회 등의 고급 관계 기능은 추후 구현 예정

## 🔌 MCP Protocol Integration

### Model Context Protocol (MCP) Server
**HTTP Transport를 통한 멀티 클라이언트 MCP 서버:**

**MCP 서버 아키텍처**: url-db는 HTTP transport로 구동되는 MCP(Model Context Protocol) 서버로, **MCP 프로토콜 최신 버전 (2025-06-18)** 을 준수하며, 지속적으로 실행되면서 Claude Code, 커스텀 AI 도구, 웹 애플리케이션 등 다양한 클라이언트의 동시 접속을 지원합니다.

**서버 운영 방식**:
- **HTTP 기반 통신**: RESTful API가 아닌 MCP 프로토콜의 HTTP transport 사용
- **상시 가동**: 서버를 켜둔 상태에서 여러 클라이언트가 동시 접속 가능
- **다중 클라이언트 지원**: 동일한 데이터베이스에 여러 AI 도구가 동시 작업 가능
- **세션 관리**: 클라이언트별 독립적인 세션과 컨텍스트 관리

**MCP 도구 확장성**:
- **현재 구현된 도구들**: Core Memory, Table Management, Documentation, Search Templates 등
- **요구사항 기반 확장**: 새로운 사용 사례와 요구사항에 따라 MCP 도구를 지속적으로 추가
- **기능별 도구화**: 각 시스템 기능을 독립적인 MCP 도구로 구현하여 모듈화

**MCP 통합의 이점**:
- **표준화된 인터페이스**: AI 도구들과의 일관된 통신 방식
- **멀티 클라이언트 아키텍처**: 다양한 AI 도구의 동시 접속 지원
- **확장 가능한 도구 생태계**: 요구사항에 따른 지속적인 도구 확장
- **HTTP 기반 접근성**: 웹 기반 클라이언트들의 쉬운 통합 가능

### GraphQL API 확장 계획

**GraphQL 레이어 추가를 통한 웹 API 지원**: MCP 프로토콜과 함께 GraphQL API를 병행 제공하여 웹 애플리케이션과의 통합을 확장할 예정입니다.

**GraphQL 구현 전략**:

1. **동적 스키마 생성**: `attribute_types` 기반 자동 GraphQL 스키마 생성
   - 각 테이블을 GraphQL Type으로 매핑
   - 속성별 데이터 타입을 GraphQL 스칼라/객체 타입으로 변환
   - JSON Schema `validation_schema`를 GraphQL 제약조건으로 활용

2. **참조 타입 Resolver**: `reference_config` 기반 자동 참조 해결
   - Reference 타입 속성에 대한 지연 로딩 Resolver 자동 생성
   - 캐시 상태 확인과 외부 데이터 페치 로직 투명하게 처리
   - GraphQL의 DataLoader 패턴과 통합하여 N+1 쿼리 문제 해결

3. **관계 탐색**: `node_relations` 기반 그래프 쿼리
   - 테이블 간 관계를 GraphQL 관계형 필드로 자동 노출
   - Forward/Backward 링크 탐색을 GraphQL nested query로 지원
   - 관계 필터링 및 페이지네이션 내장 지원

4. **타입 안전성**: TypeScript 코드 생성
   - GraphQL 스키마에서 TypeScript 타입 정의 자동 생성
   - 프론트엔드 개발 시 완전한 타입 안전성 보장
   - IDE 자동완성과 컴파일 타임 검증 지원

**GraphQL API 장점**:
- **웹 친화적**: REST API보다 유연한 데이터 페칭
- **실시간 업데이트**: GraphQL Subscription을 통한 실시간 데이터 동기화
- **개발자 경험**: GraphiQL 플레이그라운드와 강력한 인트로스펙션
- **성능 최적화**: 필요한 데이터만 페치하는 효율적인 쿼리
- **타입 시스템**: 강력한 타입 시스템과 자동 문서화

**통합 아키텍처**:
- **MCP**: AI 도구와의 전용 통신 (Claude Code, 커스텀 AI 도구)
- **GraphQL**: 웹 애플리케이션과의 표준 API (대시보드, 모바일 앱, SPA)
- **공통 비즈니스 로직**: 두 인터페이스가 동일한 코어 로직 공유하여 일관성 보장

## 🔌 External System Integration

### 1. Integration Philosophy
**url-db는 다양한 외부 시스템을 통합할 수 있는 플랫폼**으로 설계되었습니다.

**Memory Server Integration (Example)**
- Memory Server의 `observations` 모델을 url-db의 `attributes` 구조로 매핑
- 기존 Memory Server API 호출을 url-db 테이블 작업으로 변환
- **목적**: url-db가 어떤 외부 데이터 모델이든 수용할 수 있음을 실증

### 2. Adapter Pattern Architecture
**외부 시스템 통합을 위한 어댑터 패턴**: 다양한 외부 시스템의 데이터 모델을 url-db 구조로 변환하는 표준화된 인터페이스를 제공합니다.

**어댑터 구성 요소**:
- **데이터 매핑**: 외부 시스템 데이터를 url-db Node 구조로 변환
- **역방향 매핑**: url-db Node를 외부 시스템 형식으로 변환
- **통합 검증**: 데이터 변환 과정의 무결성 검증
- **타입 안전성**: 제네릭을 통한 타입 안전한 변환 보장

**Memory Server 어댑터 (예시)**: Memory Server의 observations 모델을 url-db의 attributes 구조로 매핑하여 기존 Memory Server API와의 호환성을 제공하는 샘플 구현

### 3. Integration Capabilities
- **API 호환성**: 기존 외부 시스템 API 유지
- **데이터 변환**: 외부 모델 → url-db 구조 자동 변환  
- **스키마 매핑**: 외부 스키마를 url-db 속성으로 자동 매핑
- **실시간 동기화**: 외부 시스템과 양방향 동기화 지원

### 4. Future Integration Examples
**향후 통합 가능한 외부 시스템 예시:**

**비즈니스 시스템 통합**:
- **CRM System**: 고객 정보를 Customer 테이블으로 매핑
- **E-commerce Platform**: 상품 카탈로그를 Product 테이블으로 통합
- **Content Management**: 콘텐츠를 Article 테이블으로 구조화
- **Project Management**: 작업 관리를 Task 테이블으로 연동
- **Social Media**: 사용자와 게시물을 User/Post 테이블으로 통합

**통합 방식**: 각 외부 시스템별 전용 어댑터를 통해 데이터 모델을 url-db 구조로 자동 변환하여 단일 인터페이스로 관리

## 📊 Performance & Scalability

### 1. Indexing Strategy
- **Primary Index**: content field (unique per table)
- **Attribute Indexes**: Type-specific optimization
- **Composite Indexes**: Multi-attribute search optimization
- **Full-Text Search**: String attributes with search optimization

### 2. Query Optimization
- **Domain Partitioning**: Query scope limitation
- **Type-Specific Handlers**: Optimized per data type
- **Caching Layer**: Frequently accessed schema and data
- **Batch Operations**: Bulk insert/update optimization

---

## 🔧 보완 요청 사항

### 현재 구현되었으나 설명에 누락된 기능들

#### 1. **Relationship System Enhancement**
- 현재 구현: `node_relations` 테이블을 통한 관계 관리
- 누락 설명: 관계의 방향성, 메타데이터, 타입별 관계 처리
- 요청: 관계 시스템의 상세 설명 추가

#### 2. **Advanced Dependency Management**
- 현재 구현: `dependencies` 및 `node_dependencies` 테이블
- 누락 설명: 순환 의존성 검사, 의존성 분석, 강도 및 우선순위
- 요청: 의존성 관리 시스템 아키텍처 설명

#### 3. **Table Isolation & Multi-tenancy**
- 현재 구현: 완전한 테이블 격리 시스템
- 누락 설명: 테이블 간 데이터 격리, 권한 관리, 네임스페이스
- 요청: 멀티테넌시 아키텍처 상세 설명

#### 4. **External System Integration Example (Memory Server)**
- 현재 구현: Memory Server 스타일 API를 url-db 시스템에 통합하는 예제
- 누락 설명: 외부 시스템 API를 url-db 구조로 매핑하는 어댑터 패턴
- 요청: 다양한 외부 시스템 통합 방법론 및 어댑터 아키텍처 설명
- 비고: **Memory Server는 url-db가 외부 시스템을 통합할 수 있음을 보여주는 샘플 사례**

#### 5. **Performance Monitoring & Metrics**
- 현재 구현: SystemMetrics 포트 및 성능 추적
- 누락 설명: 실시간 성능 모니터링, 메트릭 수집, 최적화 제안
- 요청: 성능 관리 시스템 설명

#### 6. **Batch Operations & Validation**
- 현재 구현: 대용량 일괄 처리 및 실시간 검증
- 누락 설명: 배치 처리 전략, 트랜잭션 관리, 오류 복구
- 요청: 대용량 데이터 처리 아키텍처 설명

#### 7. **Extension Architecture**
- 현재 구현: 플러그인 가능한 필터 시스템, 확장 가능한 MCP 도구
- 누락 설명: 시스템 확장 방법, 플러그인 아키텍처, API 확장성
- 요청: 확장성 아키텍처 및 플러그인 시스템 설명

---

## 📋 구현 기반

**데이터베이스 스키마**: 모든 시스템 구조는 `/samples/schema.sql`을 기반으로 구현됩니다.

**핵심 테이블 구조**:
- **tables**: 테이블 정의 및 메타데이터 관리
- **attribute_types**: JSON Schema 표준 타입 정의 (확장 가능)
  - `validation_schema`: JSON Schema 검증 규칙
  - `reference_config`: 참조 타입 해결 설정 (reference 타입 전용)
- **attributes**: 테이블별 속성 정의 및 제약조건
- **nodes**: 실제 데이터 저장 (테이블의 row)
- **node_attributes**: 속성별 실제 값 저장
- **docs**: 테이블별 카테고리 문서화 (5개 카테고리, 버전 관리)
- **templates**: 검색식 관리 (attribute_type_id 기반, 피드백 시스템)
- **node_relations**: 테이블 독립적 관계 정의

**JSON Schema 호환성**: `attribute_types` 테이블의 표준화된 타입 정의를 통해 완전한 JSON Schema Draft-07 호환 export 지원

---

**문서 생성일**: 2025-09-03  
**검증 범위**: 핵심 아키텍처, 데이터 모델, 주요 기능, MCP 프로토콜 통합  
**상태**: 완성본, 구현 기반 schema.sql 반영 완료