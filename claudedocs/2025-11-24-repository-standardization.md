# Repository 표준화 가이드 (Repository Standardization Guide)

**날짜**: 2025-11-24
**브랜치**: `claude/plan-code-structure-01RYhkJmxpXLUg2hADyZhTQo`

## 📋 개요

Repository 인터페이스를 표준화하여 일관성을 높이고 재사용성을 향상시키는 공통 패턴을 구축했습니다.

## ✅ 주요 개선사항

### 1. RepositoryTypes.ts 추가

새로운 파일: `src/core/types/RepositoryTypes.ts`
- **목적**: Repository 인터페이스의 표준화된 패턴 제공
- **효과**: 일관된 데이터 접근 패턴, 코드 중복 제거, 유지보수성 향상

### 2. Base Repository 인터페이스

#### IBaseRepository<TEntity, TId>
모든 Repository의 기본 인터페이스

```typescript
export interface IBaseRepository<TEntity, TId> {
  save(entity: TEntity): Promise<TEntity | void>
  findById(id: TId): Promise<TEntity | null>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<TEntity>>
  delete(id: TId): Promise<void>
  count(): Promise<number>
}
```

**사용 사례**: 기본 CRUD 작업만 필요한 간단한 Entity

### 3. 확장 인터페이스

#### IRepositoryWithIdentifier<TEntity, TId>
Identifier 기반 조회가 필요한 Repository

```typescript
export interface IRepositoryWithIdentifier<TEntity, TId>
  extends IBaseRepository<TEntity, TId> {
  findByIdentifier(identifier: string): Promise<TEntity | null>
  exists(identifier: string): Promise<boolean>
}
```

**사용 사례**: Table, RelationType, AttributeType 등 identifier 필드를 가진 Entity

#### IRepositoryWithBatchOperations<TEntity, TId>
대량 작업 지원이 필요한 Repository

```typescript
export interface IRepositoryWithBatchOperations<TEntity, TId>
  extends IBaseRepository<TEntity, TId> {
  saveMany(entities: TEntity[]): Promise<void>
  findByIds(ids: TId[]): Promise<TEntity[]>
  deleteMany(ids: TId[]): Promise<void>
}
```

**사용 사례**: Attribute, Node 등 대량으로 생성/조회/삭제가 필요한 Entity

#### IRepositoryWithUpdate<TEntity, TId, TUpdateData>
부분 업데이트 지원이 필요한 Repository

```typescript
export interface IRepositoryWithUpdate<TEntity, TId, TUpdateData = Partial<TEntity>>
  extends IBaseRepository<TEntity, TId> {
  update(id: TId, updates: TUpdateData): Promise<TEntity>
}
```

**사용 사례**: 특정 필드만 업데이트 가능한 Entity

#### IFullRepository<TEntity, TId, TUpdateData>
모든 기능을 포함하는 Full-featured Repository

```typescript
export interface IFullRepository<TEntity, TId, TUpdateData = Partial<TEntity>>
  extends IRepositoryWithIdentifier<TEntity, TId>,
    IRepositoryWithBatchOperations<TEntity, TId>,
    IRepositoryWithUpdate<TEntity, TId, TUpdateData> {}
```

**사용 사례**: Table, Attribute 등 대부분의 핵심 Entity

### 4. 특수 패턴

#### IChildRepository<TEntity, TId, TParentId>
부모-자식 관계를 가진 Entity의 Repository

```typescript
export interface IChildRepository<TEntity, TId, TParentId>
  extends IBaseRepository<TEntity, TId> {
  findByParentId(parentId: TParentId, options?: PaginationOptions): Promise<PaginatedResult<TEntity>>
  countByParentId(parentId: TParentId): Promise<number>
  deleteByParentId(parentId: TParentId): Promise<void>
}
```

**사용 사례**:
- Attribute (부모: Table)
- Node (부모: Table)
- NodeAttribute (부모: Node)
- Doc (부모: Table)

#### ITableScopedRepository<TEntity, TId>
Table 범위 Entity의 간편한 Type Alias

```typescript
export type ITableScopedRepository<TEntity, TId> = IChildRepository<
  TEntity,
  TId,
  string // TableId
>
```

**사용 사례**: 대부분의 Table-scoped Entity (Attribute, Node, Doc 등)

## 📊 기존 Repository 매핑

### 현재 구조 분석

| Repository | 현재 패턴 | 권장 인터페이스 |
|------------|----------|----------------|
| ITableRepository | Full CRUD + Batch | `IFullRepository<Table, TableId>` |
| IAttributeRepository | Full CRUD + Table-scoped | `IFullRepository<Attribute, AttributeId> & ITableScopedRepository<...>` |
| INodeRepository | Basic CRUD + Table-scoped | `IBaseRepository<Node, NodeId> & ITableScopedRepository<...>` |
| IRelationTypeRepository | Full CRUD + Identifier | `IFullRepository<RelationType, RelationTypeId>` |
| IDocRepository | CRUD + Table-scoped + Category | `ITableScopedRepository<Doc, DocId>` + custom methods |

### 마이그레이션 예제

#### 예제 1: ITableRepository 표준화

**현재**:
```typescript
export interface ITableRepository {
  save(table: Table): Promise<Table>
  findById(id: TableId): Promise<Table | null>
  findByIdentifier(identifier: string): Promise<Table | null>
  findAll(options?: TableSearchOptions): Promise<PaginatedResult<Table>>
  delete(id: TableId): Promise<void>
  exists(identifier: string): Promise<boolean>
  count(): Promise<number>
  saveMany(tables: Table[]): Promise<void>
  findByIds(ids: TableId[]): Promise<Table[]>
  update(id: TableId, updates: Partial<Table>): Promise<Table>
}
```

**표준화 후**:
```typescript
import type { IFullRepository } from '@/core/types/RepositoryTypes.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { Table } from '@/domain/entities/Table.js'

export interface ITableRepository extends IFullRepository<Table, TableId> {
  // 기본 CRUD + Identifier + Batch + Update는 상속됨
  // Table-specific 메서드만 추가
  // (현재는 모든 메서드가 표준 패턴이므로 추가 메서드 없음)
}
```

#### 예제 2: IAttributeRepository 표준화

**현재**:
```typescript
export interface IAttributeRepository {
  save(attribute: Attribute): Promise<void>
  findById(id: AttributeId): Promise<Attribute | null>
  findByTableIdAndIdentifier(tableId: TableId, identifier: string): Promise<Attribute | null>
  findByTableId(tableId: TableId, options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  delete(id: AttributeId): Promise<void>
  deleteByTableId(tableId: TableId): Promise<void>
  exists(tableId: TableId, identifier: string): Promise<boolean>
  count(): Promise<number>
  countByTableId(tableId: TableId): Promise<number>
  saveMany(attributes: Attribute[]): Promise<void>
  findByIds(ids: AttributeId[]): Promise<Attribute[]>
  update(id: AttributeId, updates: AttributeUpdateData): Promise<Attribute>

  // Attribute-specific methods
  findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
  getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>
}
```

**표준화 후**:
```typescript
import type { IFullRepository, ITableScopedRepository } from '@/core/types/RepositoryTypes.js'
import type { AttributeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute, AttributeType } from '@/domain/entities/Attribute.js'

// Combine standard patterns
export interface IAttributeRepository
  extends IFullRepository<Attribute, AttributeId, AttributeUpdateData>,
          ITableScopedRepository<Attribute, AttributeId> {

  // Attribute-specific methods only
  findByTableIdAndIdentifier(
    tableId: TableId,
    identifier: string
  ): Promise<Attribute | null>

  findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
  getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>

  // Override exists to match current signature
  exists(tableId: TableId, identifier: string): Promise<boolean>
}
```

#### 예제 3: 새로운 Repository 생성

**간단한 Entity**:
```typescript
import type { IRepositoryWithIdentifier } from '@/core/types/RepositoryTypes.js'

export interface ITagRepository extends IRepositoryWithIdentifier<Tag, TagId> {
  // 기본 CRUD + Identifier는 상속됨
  // 추가 메서드만 정의
  findByCategory(category: string): Promise<Tag[]>
}
```

**복잡한 Entity**:
```typescript
import type { IFullRepository, ITableScopedRepository } from '@/core/types/RepositoryTypes.js'

export interface ICommentRepository
  extends IFullRepository<Comment, CommentId>,
          ITableScopedRepository<Comment, CommentId> {

  // Comment-specific methods
  findByNodeId(nodeId: NodeId): Promise<Comment[]>
  findByAuthor(authorId: string): Promise<Comment[]>
  countByNodeId(nodeId: NodeId): Promise<number>
}
```

## 🎯 활용 가이드

### 1. 적절한 Base 인터페이스 선택

```typescript
// Decision Tree
if (entity.hasIdentifierField && entity.needsBatchOps && entity.needsUpdate) {
  // Use IFullRepository
  extends IFullRepository<Entity, EntityId, UpdateData>
}
else if (entity.hasParent) {
  // Use IChildRepository or ITableScopedRepository
  extends ITableScopedRepository<Entity, EntityId>
}
else if (entity.needsBatchOps) {
  // Use IRepositoryWithBatchOperations
  extends IRepositoryWithBatchOperations<Entity, EntityId>
}
else {
  // Use IBaseRepository
  extends IBaseRepository<Entity, EntityId>
}
```

### 2. 인터페이스 조합

```typescript
// 여러 인터페이스 조합 가능
export interface IMyRepository
  extends IRepositoryWithIdentifier<MyEntity, MyEntityId>,
          IRepositoryWithBatchOperations<MyEntity, MyEntityId>,
          IChildRepository<MyEntity, MyEntityId, ParentId> {
  // Custom methods
}
```

### 3. Update Data 타입 정의

```typescript
// Entity-specific update data
export interface AttributeUpdateData {
  identifier?: string
  description?: string | null
  isRequired?: boolean
  defaultValue?: any
}

// Use in repository
export interface IAttributeRepository
  extends IFullRepository<Attribute, AttributeId, AttributeUpdateData> {}
```

### 4. Custom 메서드 추가 규칙

**✅ 권장**: Domain-specific 비즈니스 로직
```typescript
export interface IAttributeRepository extends IFullRepository<...> {
  findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
  getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>
}
```

**❌ 피할 것**: 이미 Base 인터페이스에 있는 메서드 재정의
```typescript
// Bad - 이미 IBaseRepository에 있음
export interface IMyRepository extends IBaseRepository<...> {
  findById(id: MyId): Promise<MyEntity | null>  // ❌ 중복
  count(): Promise<number>                       // ❌ 중복
}
```

## 📈 개선 효과

### 타입 안정성
- ✅ 일관된 메서드 시그니처
- ✅ Generic 타입으로 컴파일 타임 체크 강화
- ✅ 리팩토링 안전성 증가

### 코드 재사용성
- ✅ 중복 인터페이스 정의 제거
- ✅ 표준 패턴으로 학습 곡선 감소
- ✅ 새로운 Repository 작성 시간 단축

### 유지보수성
- ✅ 단일 소스의 진실 (Single Source of Truth)
- ✅ 인터페이스 변경 시 영향 범위 명확
- ✅ 테스트 작성이 더 쉬워짐

## 🔧 Best Practices

### ✅ 권장사항

1. **적절한 Base 인터페이스 선택**
   ```typescript
   // Good: 필요한 기능만 상속
   export interface ISimpleRepository
     extends IBaseRepository<Simple, SimpleId> {}

   // Good: 모든 기능이 필요하면 Full 사용
   export interface IComplexRepository
     extends IFullRepository<Complex, ComplexId> {}
   ```

2. **일관된 메서드 시그니처**
   ```typescript
   // Good: 표준 패턴 따름
   findById(id: EntityId): Promise<Entity | null>
   findAll(options?: PaginationOptions): Promise<PaginatedResult<Entity>>

   // Avoid: 비표준 시그니처
   getById(id: EntityId): Entity | undefined  // ❌
   listAll(): Entity[]                        // ❌
   ```

3. **Custom 메서드는 명확하게**
   ```typescript
   // Good: Domain 의미가 명확
   findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
   getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>

   // Avoid: 모호한 이름
   getStuff(id: string): Promise<any>  // ❌
   ```

### ❌ 피해야 할 것

1. **불필요한 메서드 재정의**
   ```typescript
   // Bad: Base에 이미 있는 메서드 재정의
   export interface IMyRepository extends IFullRepository<...> {
     save(entity: MyEntity): Promise<void>  // ❌ 이미 상속됨
   }
   ```

2. **일관성 없는 패턴**
   ```typescript
   // Bad: 표준 패턴을 따르지 않음
   export interface IMyRepository {
     create(data: MyData): MyEntity        // ❌ save 사용
     get(id: MyId): MyEntity              // ❌ findById 사용
     remove(id: MyId): boolean            // ❌ delete 사용
   }
   ```

## 🚀 마이그레이션 전략

### Phase 1: 새로운 Repository (우선순위 높음)
- ✅ 모든 새로운 Repository는 RepositoryTypes 사용
- ✅ 적절한 Base 인터페이스 선택
- ✅ Custom 메서드만 정의

### Phase 2: 핵심 Repository 리팩토링 (우선순위 중간)
1. **ITableRepository** - 가장 기본이 되는 Repository
2. **IAttributeRepository** - 사용 빈도 높음
3. **INodeRepository** - 핵심 Entity

### Phase 3: 나머지 Repository (우선순위 낮음)
- RelationType, AttributeType, Doc 등
- 점진적으로 표준화 적용

## 📊 현황

- **RepositoryTypes.ts**: ✅ 생성 완료
- **문서화**: ✅ 완료
- **테스트**: ✅ 기존 테스트 모두 통과 (93/93)
- **실제 적용**: ⏳ 다음 단계

## 🎯 다음 단계

1. **선택적 적용**: 새로운 Repository 작성 시 RepositoryTypes 활용
2. **점진적 마이그레이션**: 기존 Repository 리팩토링 (필요 시)
3. **모범 사례 문서**: 실제 적용 사례 추가
4. **Query Builder**: 고급 검색 기능 필요 시 IQueryBuilder 구현

---

**상태**: ✅ **완료** - Repository 표준화 시스템 구축 완료!
**영향**: 모든 새로운 Repository 개발에 적용 가능
