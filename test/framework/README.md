# 🏗️ Test Framework Guide

## 📋 개요

인터페이스 기반 통합 테스트 프레임워크로, 타입 안전성과 자동화된 에러 수정을 제공합니다.

## 🚀 빠른 시작

### 1. 기본 테스트 작성

```typescript
import { beforeEach, describe, expect, it } from 'bun:test'
import { 
  createTestContext, 
  TestFramework, 
  type NodeDto 
} from '../framework/TestFramework.js'

describe('My Feature', () => {
  const testContext = createTestContext('my-feature-test')
  
  beforeEach(() => {
    // Type-safe mock creation
    const mockRepository = testContext.mockManager.createNodeRepositoryMock({
      findById: () => Promise.resolve(null)
    })
  })
  
  it('should handle data safely', async () => {
    const result = await someAsyncOperation()
    
    // Null safety enforcement
    testContext.errorHandler.assertNonNull(result, 'Result is required')
    
    // Type-safe unwrapping
    const data = testContext.errorHandler.safeUnwrap<NodeDto>(result)
    
    expect(TestFramework.TypeGuards.isNodeDto(data)).toBe(true)
  })
})
```

### 2. GraphQL 테스트

```typescript
describe('GraphQL Mutations', () => {
  const testContext = createTestContext('graphql-test')
  
  it('should create node with proper types', async () => {
    // Type-safe mock data
    const mockOutput = TestFramework.TypeMapper.createMockCreateNodeOutput({
      node: { title: 'Custom Title' }
    })
    
    const mockUseCase = testContext.mockManager.createTypedMock<CreateNodeUseCase>({
      execute: () => Promise.resolve(mockOutput)
    })
    
    // Test execution with automatic cleanup
    testContext.cleanup.addCleanupTask(async () => {
      await cleanupCreatedNode(mockOutput.node.id)
    })
  })
})
```

## 🔧 핵심 컴포넌트

### TestContext
- **목적**: 테스트별 리소스 및 상태 관리
- **기능**: Mock 관리, 에러 처리, 자동 cleanup

```typescript
const testContext = createTestContext('test-id')
testContext.addResource('nodes', nodeId)
testContext.cleanup.addCleanupTask(() => deleteNode(nodeId))
```

### MockManager
- **목적**: 타입 안전한 Mock 객체 생성
- **기능**: Repository mocks, UseCase mocks, Logger mocks

```typescript
// Domain-specific mocks
const nodeRepo = testContext.mockManager.createNodeRepositoryMock()
const logger = testContext.mockManager.createLoggerMock()

// Generic type-safe mocks
const useCase = testContext.mockManager.createTypedMock<MyUseCase>({
  execute: () => Promise.resolve(result)
})
```

### ErrorHandler
- **목적**: Null safety 및 안전한 타입 변환
- **기능**: Assertion, safe unwrapping, error validation

```typescript
// Null safety
testContext.errorHandler.assertNonNull(value, 'Value is required')

// Safe unwrapping
const data = testContext.errorHandler.safeUnwrap<ExpectedType>(response)

// Error testing
await testContext.errorHandler.expectError(
  () => riskyOperation(),
  'ValidationError'
)
```

### TypeMapper
- **목적**: Domain Entity ↔ GraphQL DTO 변환
- **기능**: Type-safe mapping, mock factories

```typescript
// Create mock DTOs
const nodeDto = TestFramework.TypeMapper.createMockNodeDto({
  title: 'Custom Title'
})

// Convert entities
const dto = TestFramework.TypeMapper.nodeToDto(domainNode)

// Create response structures
const result = TestFramework.TypeMapper.createSuccessResult(data)
const paginated = TestFramework.TypeMapper.createPaginatedResult(items, total)
```

## 🛠️ 자동화 도구

### 타입 에러 자동 수정

```bash
# 모든 테스트 파일의 타입 에러 자동 수정
bun run test:fix-types

# 수정 후 타입 체크 검증
bun run test:validate
```

### 수정되는 패턴들

1. **Mock 타입 선언**:
   ```typescript
   // Before
   let mockRepository: IRepository
   
   // After  
   let mockRepository: jest.Mocked<IRepository>
   ```

2. **Unsafe 캐스팅**:
   ```typescript
   // Before
   const mockNode: Partial<Node> = { ... }
   
   // After
   const mockNodeDto = TestFramework.TypeMapper.createMockNodeDto({ ... })
   ```

3. **Null 안전성**:
   ```typescript
   // Before
   if (result) { ... }
   
   // After
   testContext.errorHandler.assertNonNull(result, 'Result is required')
   ```

## 📊 사용 예시

### 완전한 테스트 예시

```typescript
import { beforeEach, describe, expect, it, afterEach } from 'bun:test'
import { 
  createTestContext, 
  TestFramework, 
  type NodeDto,
  type CreateNodeOutput 
} from '../framework/TestFramework.js'
import { NodeMutations } from '@/presentation/graphql/mutations/NodeMutations.js'

describe('NodeMutations Integration', () => {
  const testContext = createTestContext('node-mutations-integration')
  let nodeMutations: NodeMutations
  
  beforeEach(() => {
    // Type-safe mocks
    const mockNodeRepository = testContext.mockManager.createNodeRepositoryMock()
    const mockUseCase = testContext.mockManager.createTypedMock<CreateNodeUseCase>()
    const mockLogger = testContext.mockManager.createLoggerMock()
    
    nodeMutations = new NodeMutations(mockUseCase, mockNodeRepository, mockLogger)
    
    // Reset mocks
    testContext.mockManager.resetAllMocks()
  })
  
  afterEach(async () => {
    await testContext.cleanupResources()
  })
  
  describe('createNode', () => {
    it('should create node with valid input', async () => {
      // Arrange
      const expectedOutput = TestFramework.TypeMapper.createMockCreateNodeOutput({
        node: { title: 'Test Node', content: 'Test Content' }
      })
      
      const mockUseCase = testContext.mockManager.createTypedMock<CreateNodeUseCase>({
        execute: () => Promise.resolve(expectedOutput)
      })
      
      // Act
      const result = await nodeMutations.createNode({
        tableId: 'table-1',
        title: 'Test Node',
        content: 'Test Content'
      })
      
      // Assert with type safety
      const safeResult = testContext.errorHandler.safeUnwrap<CreateNodeOutput>(result)
      expect(TestFramework.TypeGuards.isNodeDto(safeResult.node)).toBe(true)
      expect(safeResult.node.title).toBe('Test Node')
      
      // Verify mock calls
      testContext.mockManager.verifyMockCalls('createNodeUseCase', 1)
    })
    
    it('should handle errors gracefully', async () => {
      // Test error scenarios
      await testContext.errorHandler.expectError(
        () => nodeMutations.createNode({ invalid: 'input' }),
        'ValidationError'
      )
    })
  })
})
```

## 🔄 마이그레이션 가이드

### 기존 테스트 업그레이드

1. **Import 추가**:
   ```typescript
   import { 
     createTestContext, 
     TestFramework 
   } from '../framework/TestFramework.js'
   ```

2. **Test Context 생성**:
   ```typescript
   const testContext = createTestContext('test-name')
   ```

3. **Mock 생성 교체**:
   ```typescript
   // Before
   const mockRepo = { findById: mock() } as any
   
   // After
   const mockRepo = testContext.mockManager.createNodeRepositoryMock()
   ```

4. **타입 검증 추가**:
   ```typescript
   // Before
   expect(result.data).toBeTruthy()
   
   // After
   const data = testContext.errorHandler.safeUnwrap(result)
   expect(TestFramework.TypeGuards.isNodeDto(data)).toBe(true)
   ```

## 🚨 트러블슈팅

### 일반적인 문제들

1. **Mock 타입 에러**:
   - 문제: `Type 'Mock' is not assignable to type 'Function'`
   - 해결: `testContext.mockManager.createTypedMock<T>()` 사용

2. **Null/Undefined 에러**:
   - 문제: `Type 'undefined' is not assignable to type 'string'`
   - 해결: `testContext.errorHandler.assertNonNull()` 사용

3. **GraphQL 응답 타입 불일치**:
   - 문제: Response structure doesn't match expected type
   - 해결: `TestFramework.TypeMapper` 팩토리 메서드 사용

### 성능 최적화

- Test Context 재사용으로 Mock 생성 비용 절약
- Cleanup 작업 자동화로 메모리 누수 방지
- Type Guard 캐싱으로 검증 성능 향상

## 📈 Best Practices

1. **테스트당 하나의 Context**: 각 테스트 파일마다 독립적인 context 사용
2. **Mock 재사용**: beforeEach에서 공통 mock 설정
3. **Cleanup 자동화**: 리소스 정리 작업을 testContext에 등록
4. **Type Safety**: 모든 외부 데이터에 대해 type guard 사용
5. **Error Testing**: 예상되는 에러 시나리오 명시적 테스트

이 프레임워크를 통해 **타입 안전하고 유지보수 가능한 테스트 코드**를 작성할 수 있습니다.