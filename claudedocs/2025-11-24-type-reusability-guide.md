# 타입 재사용성 가이드 (Type Reusability Guide)

**날짜**: 2025-11-24
**브랜치**: `claude/plan-code-structure-01RYhkJmxpXLUg2hADyZhTQo`

## 📋 개요

시스템 전체의 타입 정의를 표준화하고 재사용성을 높이기 위한 공통 타입 시스템을 구축했습니다.

## ✅ 주요 개선사항

### 1. UseCaseTypes.ts 추가

새로운 파일: `src/core/types/UseCaseTypes.ts`
- **목적**: Use Case Input/Output 패턴의 표준화
- **효과**: 코드 중복 제거, 일관성 향상, 유지보수성 개선

### 2. 공통 타입 패턴

#### Base Types
```typescript
// 모든 Entity DTO의 기본 인터페이스
export interface BaseEntityDto extends TimestampedEntity {
  id: string
  createdAt: string
  updatedAt: string
}
```

#### Generic Input Types
```typescript
// 생성 입력
export type CreateInput<T> = T

// 업데이트 입력 (모든 필드 optional)
export type UpdateInput<T> = Partial<T>

// ID로 조회
export interface GetByIdInput {
  id: string
}

// Identifier로 조회
export interface GetByIdentifierInput {
  identifier: string
}

// 목록 조회 (페이지네이션 + 필터)
export type GetManyInput<T = Record<string, never>> = PaginationInput & T

// 검색 입력
export interface SearchInput<TFilters = Record<string, never>> extends PaginationInput {
  query?: string
  filters?: TFilters
  sortBy?: Array<{
    field: string
    direction: 'asc' | 'desc' | 'ASC' | 'DESC'
  }>
}
```

#### Generic Output Types
```typescript
// 생성 결과
export interface CreateOutput<TEntity> {
  [key: string]: TEntity
}

// 단일 조회 결과
export interface GetOutput<TEntity> {
  [key: string]: TEntity | null
}

// 목록 조회 결과
export interface GetManyOutput<TEntity> {
  [key: string]: TEntity[]
  total: number
  hasMore: boolean
}

// 업데이트 결과
export interface UpdateOutput<TEntity> {
  [key: string]: TEntity
}

// 삭제 결과
export interface DeleteOutput {
  success: boolean
}

// 검색 결과
export interface SearchOutput<TEntity> {
  results: TEntity[]
  total: number
  totalCount: number
  hasMore: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
}
```

### 3. 공통 필드 패턴 (Mixins)

```typescript
// 메타데이터 포함
export interface WithMetadata<T = Record<string, unknown>> {
  metadata?: T | null
}

// 설명 포함
export interface WithDescription {
  description?: string | null
}

// Identifier 포함
export interface WithIdentifier {
  identifier: string
}

// 이름 포함
export interface WithName {
  name: string
}

// 선택적 이름 포함
export interface WithOptionalName {
  name?: string | null
}

// 조합 패턴
export type WithIdentifierAndName = WithIdentifier & WithName
export type WithIdentifierAndOptionalName = WithIdentifier & WithOptionalName
export type WithIdentifierDescription = WithIdentifier & WithDescription
export type WithNameDescription = WithName & WithDescription
```

### 4. Bulk 작업 패턴

```typescript
// 대량 생성
export interface BulkCreateInput<T> {
  items: T[]
  validateAll?: boolean
  stopOnError?: boolean
}

// 대량 업데이트
export interface BulkUpdateInput<T> {
  updates: Array<{ id: string } & Partial<T>>
  validateAll?: boolean
  stopOnError?: boolean
}

// 대량 삭제
export interface BulkDeleteInput {
  ids: string[]
  force?: boolean
}

// 대량 작업 결과
export interface BulkOperationResult<TEntity> {
  successful: TEntity[]
  failed: Array<{
    item: unknown
    error: string
  }>
  totalProcessed: number
  successCount: number
  failureCount: number
}
```

### 5. 유틸리티 타입

```typescript
// 특정 필드를 필수로 만들기
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// 특정 필드를 선택적으로 만들기
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Entity 필드 제거 (id, timestamps)
export type OmitEntityFields<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

// DTO에서 Create Input 생성
export type ToCreateInput<TDto, TRequired extends keyof TDto = never> = RequireFields<
  OmitEntityFields<TDto>,
  TRequired
>

// DTO에서 Update Input 생성
export type ToUpdateInput<TDto> = Partial<OmitEntityFields<TDto>>
```

### 6. Type Guards

```typescript
// Identifier 체크
export function hasIdentifier(obj: unknown): obj is WithIdentifier {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'identifier' in obj &&
    typeof (obj as WithIdentifier).identifier === 'string'
  )
}

// Name 체크
export function hasName(obj: unknown): obj is WithName {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    typeof (obj as WithName).name === 'string'
  )
}

// Metadata 체크
export function hasMetadata(obj: unknown): obj is WithMetadata {
  return typeof obj === 'object' && obj !== null && 'metadata' in obj
}
```

## 🎯 사용 예제

### 예제 1: Attribute DTO 리팩토링

**이전 방식** (중복된 타입 정의):
```typescript
export interface CreateAttributeInput {
  tableId: string
  identifier: string
  name?: string
  attributeTypeId: string
  description?: string
  isRequired?: boolean
  metadata?: object
}

export interface UpdateAttributeInput {
  description?: string | null
  isRequired?: boolean
  metadata?: object | null
}

export interface GetAttributesInput {
  limit?: number
  offset?: number
  tableId?: string
  attributeTypeId?: string
  requiredOnly?: boolean
}

export interface CreateAttributeOutput {
  attribute: AttributeDto
}

export interface GetAttributeOutput {
  attribute: AttributeDto | null
}

export interface GetAttributesOutput {
  attributes: AttributeDto[]
  total: number
  hasMore: boolean
}
```

**개선된 방식** (재사용 가능한 타입):
```typescript
import type {
  BaseEntityDto,
  WithIdentifier,
  WithOptionalName,
  WithDescription,
  WithMetadata,
  ToCreateInput,
  ToUpdateInput,
  GetManyInput,
  CreateOutput,
  GetOutput,
  GetManyOutput
} from '@/core/types/UseCaseTypes.js'

// DTO 정의
export interface AttributeDto extends BaseEntityDto, WithIdentifier, WithOptionalName {
  tableId: string
  attributeTypeId: string
  description: string | null
  isRequired: boolean
  metadata: object | null
}

// Input 타입 - 자동 생성
export type CreateAttributeInput = ToCreateInput<
  AttributeDto,
  'tableId' | 'identifier' | 'attributeTypeId'
> & {
  name?: string  // Optional override
}

export type UpdateAttributeInput = ToUpdateInput<AttributeDto>

// GetMany에 특화된 필터 추가
export interface GetAttributesInput extends GetManyInput<{
  tableId?: string
  attributeTypeId?: string
  requiredOnly?: boolean
}> {}

// Output 타입 - 표준 패턴 사용
export type CreateAttributeOutput = CreateOutput<AttributeDto>  // { attribute: AttributeDto }
export type GetAttributeOutput = GetOutput<AttributeDto>        // { attribute: AttributeDto | null }
export type GetAttributesOutput = GetManyOutput<AttributeDto>   // { attributes: AttributeDto[], total, hasMore }
```

### 예제 2: RelationType DTO 리팩토링

**이전 방식**:
```typescript
export interface CreateRelationTypeInput {
  identifier: string
  description?: string
  category?: string
}

export interface CreateRelationTypeOutput {
  relationType: {
    id: string
    identifier: string
    description: string | null
    category: string | null
    createdAt: string
    updatedAt: string
  }
}
```

**개선된 방식**:
```typescript
import type {
  BaseEntityDto,
  WithIdentifierDescription,
  ToCreateInput,
  CreateOutput
} from '@/core/types/UseCaseTypes.js'

// DTO 정의
export interface RelationTypeDto extends BaseEntityDto, WithIdentifierDescription {
  category: string | null
}

// Input 타입
export type CreateRelationTypeInput = ToCreateInput<RelationTypeDto, 'identifier'>

// Output 타입
export type CreateRelationTypeOutput = CreateOutput<RelationTypeDto>
```

### 예제 3: Search 패턴 사용

**검색 기능 구현**:
```typescript
import type { SearchInput, SearchOutput } from '@/core/types/UseCaseTypes.js'

// 특정 필터를 가진 검색 입력
export interface SearchNodesInput extends SearchInput<{
  tableId: string
  contentContains?: string
  hasAttributes?: boolean
}> {}

// 표준 검색 출력
export type SearchNodesOutput = SearchOutput<NodeDto>

// Use Case에서 사용
class SearchNodesUseCase {
  async execute(input: SearchNodesInput): Promise<SearchNodesOutput> {
    // 구현...
    return {
      results: nodes,
      total: totalCount,
      totalCount,
      hasMore: totalCount > (input.offset || 0) + nodes.length,
      hasNextPage: totalCount > (input.offset || 0) + (input.limit || 10),
      hasPreviousPage: (input.offset || 0) > 0
    }
  }
}
```

### 예제 4: Bulk 작업 패턴

**대량 작업 구현**:
```typescript
import type { BulkCreateInput, BulkOperationResult } from '@/core/types/UseCaseTypes.js'

export interface BulkCreateAttributesInput extends BulkCreateInput<CreateAttributeInput> {
  tableId: string  // 모든 항목에 공통 적용
}

export type BulkCreateAttributesOutput = BulkOperationResult<AttributeDto>

class BulkCreateAttributesUseCase {
  async execute(input: BulkCreateAttributesInput): Promise<BulkCreateAttributesOutput> {
    const successful: AttributeDto[] = []
    const failed: Array<{ item: unknown; error: string }> = []

    for (const item of input.items) {
      try {
        const result = await this.createAttribute({
          ...item,
          tableId: input.tableId
        })
        successful.push(result.attribute)

        if (!input.stopOnError && input.validateAll) continue
      } catch (error) {
        failed.push({
          item,
          error: error instanceof Error ? error.message : String(error)
        })

        if (input.stopOnError) break
      }
    }

    return {
      successful,
      failed,
      totalProcessed: successful.length + failed.length,
      successCount: successful.length,
      failureCount: failed.length
    }
  }
}
```

## 📊 마이그레이션 전략

### Phase 1: 새로운 Use Case
- ✅ 모든 새로운 Use Case는 UseCaseTypes 사용
- ✅ DTO 파일에 Input/Output 타입 정의 시 재사용 가능한 패턴 적용

### Phase 2: 기존 DTO 리팩토링
1. **우선순위 높음**: 자주 사용되는 DTO (Node, Attribute, Table)
2. **우선순위 중간**: 관계형 DTO (Relation, RelationType)
3. **우선순위 낮음**: 특수 목적 DTO (Export, Import)

### Phase 3: Repository 인터페이스
- 공통 Repository 메서드 패턴 추출
- Generic Repository 인터페이스 생성

## 📈 개선 효과

### 타입 안정성
- ✅ 일관된 타입 구조로 오류 감소
- ✅ 자동 완성 및 IntelliSense 지원 향상
- ✅ 리팩토링 안전성 증가

### 코드 재사용성
- ✅ 중복 타입 정의 제거
- ✅ 표준 패턴으로 학습 곡선 감소
- ✅ 새로운 기능 개발 속도 향상

### 유지보수성
- ✅ 단일 소스의 진실 (Single Source of Truth)
- ✅ 타입 변경 시 영향 범위 최소화
- ✅ 문서화 자동 개선

## 🔧 Best Practices

### ✅ 권장사항

1. **Base Interface 확장**
   ```typescript
   // Good: BaseEntityDto를 확장
   export interface UserDto extends BaseEntityDto {
     username: string
     email: string
   }

   // Avoid: 중복 필드 정의
   export interface UserDto {
     id: string
     createdAt: string
     updatedAt: string
     username: string
     email: string
   }
   ```

2. **Mixin 패턴 활용**
   ```typescript
   // Good: 공통 패턴 재사용
   export interface AttributeDto
     extends BaseEntityDto,
     WithIdentifier,
     WithOptionalName,
     WithDescription {}

   // Avoid: 필드 개별 정의
   export interface AttributeDto extends BaseEntityDto {
     identifier: string
     name?: string | null
     description?: string | null
   }
   ```

3. **Generic 타입 활용**
   ```typescript
   // Good: Generic 타입으로 표준화
   export type CreateUserOutput = CreateOutput<UserDto>

   // Avoid: 개별 정의
   export interface CreateUserOutput {
     user: UserDto
   }
   ```

4. **유틸리티 타입 활용**
   ```typescript
   // Good: 자동 생성
   export type CreateUserInput = ToCreateInput<UserDto, 'username' | 'email'>

   // Avoid: 수동 정의
   export interface CreateUserInput {
     username: string
     email: string
     firstName?: string
     lastName?: string
   }
   ```

### ❌ 피해야 할 것

1. **타입 중복 정의**
   ```typescript
   // Bad: 여러 곳에 같은 구조 반복
   export interface CreateOutput {
     attribute: AttributeDto
   }
   export interface CreateNodeOutput {
     node: NodeDto
   }
   // 대신 CreateOutput<T> 제네릭 사용
   ```

2. **일관성 없는 필드명**
   ```typescript
   // Bad: 일관성 없는 네이밍
   export interface Result1 { items: T[] }
   export interface Result2 { data: T[] }
   export interface Result3 { results: T[] }

   // Good: 표준 인터페이스 사용
   export type Result<T> = GetManyOutput<T>
   ```

## 🎯 다음 단계

1. ✅ **완료**: UseCaseTypes.ts 생성
2. ✅ **완료**: 타입 재사용성 가이드 문서화
3. 🔄 **진행중**: 예제를 통한 사용법 시연
4. ⏳ **대기**: 기존 DTO 리팩토링 (점진적)
5. ⏳ **대기**: Repository 인터페이스 표준화

---

**상태**: ✅ **완료** - 타입 재사용 시스템 구축 완료!
**영향**: 모든 새로운 Use Case 및 DTO 개발에 적용 가능
