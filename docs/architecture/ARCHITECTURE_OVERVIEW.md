# Bun Graph DB - Architecture Overview

## 🎯 Project Vision

Bun Graph DB는 **SQLite 기반의 확장 가능한 그래프 데이터베이스 시스템**으로, 명확한 계층 구조와 관심사 분리를 통해 유지보수가 용이하고 확장 가능한 아키텍처를 제공합니다.

## 🏗️ 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 🌐 Presentation Layer                        │
│  GraphQL API • HTTP Routes • Schema Endpoints • WebSocket   │
├─────────────────────────────────────────────────────────────┤
│                🔧 Template Query System                      │
│     Template CRUD • Variable Schema • Query Execution       │
├─────────────────────────────────────────────────────────────┤
│                📊 Data Management Layer                      │
│    Export/Import • Schema Management • System Configuration │
├─────────────────────────────────────────────────────────────┤
│                🗄️ Core Data Layer (SQLite)                  │
│    Fixed Tables • Basic CRUD • Transactions • Connections   │
└─────────────────────────────────────────────────────────────┘
```

## 📋 System Components

### 🗄️ Core Data Foundation
**SQLite 기반의 고정된 테이블 구조**
- **Tables**: `tables`, `nodes`, `attributes`, `relations`, `templates`
- **Repository Pattern**: 각 엔티티별 CRUD 인터페이스
  - **BaseSqliteRepository**: 공통 CRUD 로직을 제공하는 제네릭 베이스 클래스 (2025-11-22 도입)
  - **Type-Safe Generics**: `BaseSqliteRepository<TEntity, TId>` 타입 안전성 보장
  - **Code Reduction**: 9개 리포지토리에서 435줄 중복 코드 제거 (11.2% 감소)
- **Transaction Management**: 데이터 일관성 보장
- **Schema Evolution**: 안전한 스키마 변경 관리

### 📊 Data Management Services
**시스템 기본값 설정 및 데이터 관리**
- **Export System**: 테이블/스키마 데이터 내보내기
- **Import System**: 데이터 가져오기 및 검증
- **Schema Validation**: 구조 무결성 검사
- **Backup & Recovery**: 데이터 백업 및 복원

### 🔧 Template Query Engine
**GraphQL 쿼리 템플릿 관리 시스템**
- **Template CRUD**: 생성, 조회, 수정, 삭제
- **Variable Schema**: JSON Schema 기반 변수 정의
- **Default Variables**: 사용자 편의성 제공
- **Performance Analytics**: 실행 통계 및 최적화

### 🌐 API Interface
**사용자 인터페이스 및 외부 연동**
- **GraphQL API**: Query, Mutation, Subscription
- **HTTP Routes**: RESTful 엔드포인트
- **Schema Introspection**: 스키마 정보 제공
- **Real-time Updates**: WebSocket 기반 실시간 업데이트

## 🎨 Architecture Principles

### 1. 📦 Separation of Concerns
각 레이어는 단일 책임을 가지며, 명확한 경계를 유지합니다.

```typescript
// ✅ 올바른 의존성 방향
Presentation → Application → Domain → Infrastructure
```

### 2. 🔄 Dependency Inversion
상위 레이어는 인터페이스에 의존하며, 구현체는 하위 레이어에서 제공됩니다.

```typescript
// ✅ 인터페이스 정의 (Domain Layer)
interface ITemplateRepository {
  findById(id: string): Promise<Template | null>
}

// ✅ 구현체 (Infrastructure Layer)
class SqliteTemplateRepository implements ITemplateRepository {
  // SQLite 구현
}
```

### 3. 🛡️ Data Integrity
모든 데이터 변경은 트랜잭션 내에서 수행되며, 검증 과정을 거칩니다.

```typescript
// ✅ 안전한 데이터 변경
async createTemplate(input: CreateTemplateInput): Promise<Template> {
  return await this.db.transaction(async () => {
    // 1. 검증
    await this.validate(input)
    // 2. 생성
    const template = await this.repository.create(input)
    // 3. 이벤트 발행
    await this.eventBus.publish(new TemplateCreatedEvent(template))
    return template
  })
}
```

### 4. 🚀 Performance First
캐싱, 인덱싱, 쿼리 최적화를 통한 고성능 보장

```sql
-- ✅ 성능 최적화
CREATE INDEX idx_templates_identifier ON templates(identifier);
CREATE INDEX idx_nodes_table_id ON nodes(table_id);
```

## 🔍 Key Features

### ✨ Template System
- **Variable Schema Validation**: JSON Schema 기반 타입 안전성
- **Default Values**: 즉시 사용 가능한 기본값
- **Performance Monitoring**: 실행 통계 및 최적화 제안
- **Version Management**: 템플릿 버전 관리

### 📈 Data Analytics
- **System Health Monitoring**: 실시간 시스템 상태 확인
- **Query Performance Analysis**: 쿼리 실행 성능 분석
- **Usage Statistics**: 템플릿 사용 빈도 추적

### 🔧 Developer Experience
- **GraphQL Playground**: 실시간 API 탐색
- **Schema Introspection**: 자동 문서화
- **Type Safety**: TypeScript 완전 지원
- **Hot Reload**: 개발 중 즉시 반영

## 📊 Quality Metrics

### 🎯 Code Quality
- **Type Safety**: 100% TypeScript 타입 커버리지
- **Test Coverage**: 단위/통합 테스트 완벽 지원
- **Linting**: ESLint + Prettier 자동 포맷팅
- **Documentation**: 인라인 주석 + 외부 문서

### ⚡ Performance
- **Query Optimization**: 인덱스 기반 빠른 검색
- **Memory Management**: 효율적인 메모리 사용
- **Caching Strategy**: 다층 캐싱 시스템
- **Real-time Updates**: WebSocket 기반 즉시 업데이트

### 🛡️ Security
- **Input Validation**: 모든 입력 데이터 검증
- **SQL Injection Prevention**: Prepared Statement 사용
- **Rate Limiting**: API 호출 제한
- **Query Complexity**: GraphQL 쿼리 복잡도 제한

## 🚀 Getting Started

### 1. 환경 설정
```bash
# 의존성 설치
bun install

# 개발 서버 시작
bun run dev

# GraphQL Playground 접속
open http://localhost:4000/graphql
```

### 2. 첫 번째 템플릿 생성
```graphql
mutation CreateTemplate {
  createTemplate(input: {
    identifier: "my-first-template"
    name: "My First Template"
    description: "첫 번째 템플릿입니다"
    query: "query GetTables { tables { nodes { id identifier } } }"
    variablesSchema: "{\"type\": \"object\"}"
    defaultVariables: "{}"
    tags: ["example"]
  }) {
    success
    template {
      id
      identifier
      name
    }
  }
}
```

### 3. 템플릿 실행
```graphql
query ExecuteTemplate {
  executeTemplate(
    templateId: "your-template-id"
    variables: {}
  ) {
    data
    executionTime
    errors { message }
  }
}
```

## 📚 Documentation Links

- **[System Architecture](./SYSTEM_ARCHITECTURE.md)** - 상세 아키텍처 설명
- **[Layer Management Guide](./LAYER_MANAGEMENT_GUIDE.md)** - 레이어별 관리 지침
- **[API Documentation](./docs/)** - GraphQL API 문서
- **[Testing Guide](./TESTING.md)** - 테스트 작성 가이드

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Follow** the layer management guidelines
4. **Write** tests for new features
5. **Submit** a pull request

## 📜 License

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

---

**Bun Graph DB**는 현대적인 아키텍처 패턴과 모범 사례를 적용하여, 확장 가능하고 유지보수가 용이한 그래프 데이터베이스 시스템을 제공합니다.