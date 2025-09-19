# Bun Graph DB - System Architecture & Layer Management

## 🏗️ System Overview

Bun Graph DB는 SQLite 기반의 그래프 데이터베이스 시스템으로, 명확한 계층 구조와 관심사 분리를 통해 확장 가능하고 유지보수가 용이한 아키텍처를 제공합니다.

## 📋 Architecture Layers

### 1. 🗄️ Core Data Layer (SQLite Foundation)
**위치**: `core/schema.sql`, `src/infrastructure/database/sqlite/`
**책임**: 고정된 SQLite 테이블 구조 기반의 기본 데이터 연산

#### Core Tables
- `tables` - 기본 테이블 정의
- `nodes` - 그래프 노드 데이터
- `attributes` - 노드 속성 정의
- `attribute_types` - 속성 타입 스키마
- `node_attributes` - 노드-속성 연관관계
- `relations` - 노드 간 관계
- `relation_types` - 관계 타입 정의
- `templates` - 쿼리 템플릿 저장

#### Repository Implementations
- `SqliteTableRepository` - 테이블 CRUD
- `SqliteNodeRepository` - 노드 관리
- `SqliteAttributeRepository` - 속성 관리
- `SqliteQueryTemplateRepository` - 템플릿 관리

### 2. 📊 Data Management Layer
**위치**: `src/application/use-cases/`, `src/domain/services/`
**책임**: 시스템 기본값 설정, 데이터 Export/Import, 스키마 관리

#### Export/Import System
- **Export Services**: `src/application/use-cases/export/`
  - 테이블 구조 및 데이터 내보내기
  - 스키마 백업 및 복원
- **Import Services**: `src/application/use-cases/import/`
  - 데이터 가져오기 및 검증
  - 스키마 동기화

#### Schema Management
- **Table Packages**: `src/application/use-cases/table-packages/`
  - 테이블 구조 패키징
  - 의존성 분석 및 검증

### 3. 🔧 Template Query System
**위치**: `src/application/use-cases/query-templates/`, `src/presentation/graphql/`
**책임**: 쿼리 템플릿 실행, 저장, 관리

#### Template Management
- **Template CRUD**:
  - 생성: `CreateQueryTemplate`
  - 조회: `SearchTemplates`, `GetTemplate`
  - 수정: `UpdateQueryTemplate`
  - 삭제: `DeleteQueryTemplate`

#### Template Features
- **Variable Schema**: JSON Schema 기반 변수 정의
- **Default Variables**: 기본값 설정
- **Query Validation**: GraphQL 쿼리 구문 검증
- **Performance Analytics**: 실행 통계 및 성능 분석

### 4. 🌐 Presentation Layer
**위치**: `src/presentation/graphql/`, `src/presentation/http/`
**책임**: API 제공, 사용자 인터페이스

#### GraphQL API
- **Queries**: 데이터 조회
- **Mutations**: 데이터 변경
- **Subscriptions**: 실시간 업데이트
- **Schema Types**: 타입 정의

#### HTTP Routes
- **Schema Endpoints**: 스키마 정보 제공
- **Template Files**: 템플릿 파일 관리

## 🎯 Layer Boundaries & Responsibilities

### Core Data Layer
✅ **담당**:
- SQLite 데이터베이스 연결 관리
- 기본 CRUD 연산
- 트랜잭션 관리
- 스키마 초기화

❌ **금지**:
- 비즈니스 로직 포함
- 외부 API 호출
- 복잡한 데이터 변환

### Data Management Layer
✅ **담당**:
- 데이터 import/export 로직
- 스키마 검증 및 동기화
- 시스템 설정 관리
- 데이터 무결성 검사

❌ **금지**:
- 직접적인 데이터베이스 액세스
- UI 관련 로직
- 템플릿 실행 로직

### Template Query System
✅ **담당**:
- GraphQL 쿼리 템플릿 관리
- 변수 스키마 검증
- 쿼리 실행 및 캐싱
- 성능 모니터링

❌ **금지**:
- 직접적인 SQL 조작
- 스키마 구조 변경
- 시스템 설정 변경

### Presentation Layer
✅ **담당**:
- API 엔드포인트 제공
- 요청/응답 변환
- 인증 및 권한 처리
- 에러 핸들링

❌ **금지**:
- 비즈니스 로직 구현
- 직접적인 데이터베이스 액세스
- 복잡한 데이터 변환

## 🚀 Extension Guidelines

### Adding New Core Tables
1. `core/schema.sql` 수정
2. Repository 인터페이스 정의 (`src/domain/repositories/`)
3. SQLite Repository 구현 (`src/infrastructure/database/sqlite/`)
4. Use Case 구현 (`src/application/use-cases/`)

### Adding New Data Management Features
1. Use Case 정의 (`src/application/use-cases/`)
2. Domain Service 구현 (`src/domain/services/`)
3. DTO 정의 (`src/application/dtos/`)
4. GraphQL 스키마 확장

### Adding New Template Features
1. Template 엔티티 확장 (`src/domain/entities/`)
2. Template Repository 메서드 추가
3. Use Case 구현
4. GraphQL Resolver 구현

### Adding New API Endpoints
1. GraphQL Schema 정의 (`src/presentation/graphql/schema/`)
2. Resolver 구현 (`src/presentation/graphql/resolvers/`)
3. Type 정의 (`src/presentation/graphql/types/`)
4. 테스트 작성

## 🔍 Maintenance Guidelines

### Code Organization
- 각 레이어는 명확한 책임을 가져야 함
- 의존성은 상위 레이어에서 하위 레이어로만 흘러야 함
- 순환 의존성 금지

### Testing Strategy
- 각 레이어별 독립적인 테스트 작성
- 통합 테스트는 최소한으로 유지
- Mock을 활용한 레이어 간 격리

### Performance Considerations
- 데이터베이스 쿼리 최적화
- 템플릿 캐싱 전략
- 메모리 사용량 모니터링

### Security Guidelines
- SQL Injection 방지
- GraphQL Query 복잡도 제한
- 입력 데이터 검증

## 📈 Monitoring & Analytics

### System Health
- 데이터베이스 연결 상태
- 메모리 사용량
- 쿼리 실행 통계

### Template Performance
- 실행 시간 추적
- 사용 빈도 분석
- 에러율 모니터링

### Data Quality
- 스키마 무결성 검사
- 데이터 일관성 검증
- 백업 상태 확인

---

이 아키텍처는 시스템의 확장성과 유지보수성을 보장하며, 각 레이어의 명확한 책임 분리를 통해 안정적인 개발 환경을 제공합니다.