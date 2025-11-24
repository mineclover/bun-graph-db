# 에러 표준화 가이드

**날짜**: 2025-11-24
**브랜치**: `claude/plan-code-structure-01RYhkJmxpXLUg2hADyZhTQo`

## 📋 개요

시스템 전체의 에러 처리를 표준화하여 일관성과 타입 안정성을 개선했습니다.

## ✅ 주요 개선사항

### 1. ErrorCode Enum 추가

```typescript
export enum ErrorCode {
  DOMAIN_ERROR = 'DOMAIN_ERROR',           // 400
  VALIDATION_ERROR = 'VALIDATION_ERROR',   // 422
  NOT_FOUND = 'NOT_FOUND',                 // 404
  CONFLICT = 'CONFLICT',                   // 409
  DATABASE_ERROR = 'DATABASE_ERROR',       // 500
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR', // 503
  UNAUTHORIZED = 'UNAUTHORIZED',           // 401
  FORBIDDEN = 'FORBIDDEN',                 // 403
  INTERNAL_ERROR = 'INTERNAL_ERROR'        // 500
}
```

**이전 (문자열 리터럴)**:
```typescript
export class ValidationException extends BaseException {
  readonly code = 'VALIDATION_ERROR'  // 타입 안전하지 않음
}
```

**개선 후 (Enum)**:
```typescript
export class ValidationException extends BaseException {
  readonly code = ErrorCode.VALIDATION_ERROR  // 타입 안전
}
```

### 2. ErrorResponse 표준 인터페이스

```typescript
export interface ErrorResponse {
  code: ErrorCode              // 에러 코드 (enum)
  message: string              // 사람이 읽을 수 있는 메시지
  field?: string               // 필드 이름 (유효성 검사 에러용)
  statusCode: number           // HTTP 상태 코드
  context?: Record<string, unknown>  // 디버깅 정보
  timestamp: string            // ISO 8601 타임스탬프
  requestId?: string           // 요청 추적 ID
}
```

### 3. 에러 생성 헬퍼 함수

```typescript
// 기본 에러 응답 생성
const error = createErrorResponse(
  ErrorCode.VALIDATION_ERROR,
  'Invalid email format',
  {
    field: 'email',
    statusCode: 422,
    requestId: 'req-123'
  }
)

// Exception을 ErrorResponse로 변환
const response = exceptionToErrorResponse(
  new ValidationException('Invalid input'),
  'req-123'
)

// GraphQL용 포맷
const gqlErrors = formatGraphQLErrors([error1, error2])
```

## 🎯 사용 예제

### Use Case에서 에러 던지기

```typescript
export class CreateNodeUseCase {
  async execute(input: CreateNodeInput): Promise<CreateNodeOutput> {
    // 유효성 검사
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    // 리소스 확인
    const table = await this.tableRepository.findById(input.tableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    // 충돌 확인
    const existing = await this.nodeRepository.findByTableIdAndContent(
      input.tableId,
      input.content
    )
    if (existing) {
      throw new ConflictException(
        `Node with content '${input.content}' already exists in table '${table.getIdentifier()}'`
      )
    }

    // ... 나머지 로직
  }
}
```

### GraphQL Resolver에서 에러 처리

```typescript
// 이전 방식
try {
  const result = await useCase.execute(input)
  return { success: true, node: result.node, errors: [] }
} catch (error) {
  return {
    success: false,
    node: null,
    errors: [{
      message: error.message,
      code: 'UNKNOWN',  // 일관성 없음
    }]
  }
}

// 개선된 방식
try {
  const result = await useCase.execute(input)
  return { success: true, node: result.node, errors: [] }
} catch (error) {
  const errorResponse = exceptionToErrorResponse(error, requestId)
  return {
    success: false,
    node: null,
    errors: [formatGraphQLError(errorResponse)]
  }
}
```

### REST API에서 에러 응답

```typescript
app.post('/api/nodes', async (req, res) => {
  try {
    const result = await createNodeUseCase.execute(req.body)
    res.status(201).json({ success: true, data: result })
  } catch (error) {
    const errorResponse = exceptionToErrorResponse(error, req.id)
    res.status(errorResponse.statusCode).json({
      success: false,
      error: errorResponse
    })
  }
})
```

### MCP 프로토콜에서 에러 응답

```typescript
// MCP JSON-RPC 2.0 error response
try {
  const result = await executeTemplate(params)
  return { result }
} catch (error) {
  const errorResponse = exceptionToErrorResponse(error)
  return {
    error: {
      code: getJsonRpcErrorCode(errorResponse.code),
      message: errorResponse.message,
      data: {
        field: errorResponse.field,
        context: errorResponse.context
      }
    }
  }
}
```

## 📊 에러 코드 매핑

### HTTP 상태 코드
| ErrorCode | HTTP Status | 설명 |
|-----------|-------------|------|
| DOMAIN_ERROR | 400 | 일반적인 도메인 에러 |
| UNAUTHORIZED | 401 | 인증 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| CONFLICT | 409 | 리소스 충돌/중복 |
| VALIDATION_ERROR | 422 | 입력 유효성 검사 실패 |
| INTERNAL_ERROR | 500 | 내부 서버 에러 |
| DATABASE_ERROR | 500 | 데이터베이스 에러 |
| EXTERNAL_SERVICE_ERROR | 503 | 외부 서비스 에러 |

### JSON-RPC 에러 코드
| ErrorCode | JSON-RPC Code | 설명 |
|-----------|---------------|------|
| VALIDATION_ERROR | -32602 | Invalid params |
| NOT_FOUND | -32001 | Resource not found |
| INTERNAL_ERROR | -32603 | Internal error |
| DATABASE_ERROR | -32000 | Server error |

## 🎯 타입 안정성 개선

### 이전 (타입 불안전)
```typescript
// 문자열 리터럴 - 오타 가능
if (error.code === 'VALIDATON_ERROR') {  // 오타!
  // ...
}

// 타입 체크 없음
const code: string = error.code
```

### 개선 후 (타입 안전)
```typescript
// Enum - IDE 자동완성, 오타 방지
if (error.code === ErrorCode.VALIDATION_ERROR) {  // 안전!
  // ...
}

// 타입 체크 가능
const code: ErrorCode = error.code
```

## 📈 개선 효과

### 타입 안정성
- ✅ ErrorCode enum으로 오타 방지
- ✅ IDE 자동완성 지원
- ✅ 컴파일 타임 타입 체크

### 일관성
- ✅ 모든 레이어에서 동일한 에러 구조
- ✅ 표준화된 필드 이름
- ✅ 일관된 HTTP 상태 코드

### 디버깅
- ✅ 타임스탬프로 에러 발생 시점 추적
- ✅ requestId로 요청 추적
- ✅ context로 추가 디버깅 정보

### 확장성
- ✅ 새 에러 타입 추가 용이
- ✅ 프로토콜별 변환 함수 제공
- ✅ 레거시 코드와 호환

## 🔧 마이그레이션 가이드

### 1단계: Import 변경
```typescript
// 이전
import { ValidationException } from '@/shared/exceptions/DomainException.js'

// 개선
import {
  ValidationException,
  ErrorCode
} from '@/shared/exceptions/DomainException.js'
import {
  createErrorResponse,
  exceptionToErrorResponse
} from '@/shared/exceptions/ErrorResponse.js'
```

### 2단계: 에러 처리 업데이트
```typescript
// 이전
catch (error) {
  return { errors: [{ message: error.message, code: 'ERROR' }] }
}

// 개선
catch (error) {
  const errorResponse = exceptionToErrorResponse(error)
  return { errors: [formatGraphQLError(errorResponse)] }
}
```

### 3단계: 에러 코드 체크 업데이트
```typescript
// 이전
if (error.code === 'VALIDATION_ERROR')

// 개선
if (error.code === ErrorCode.VALIDATION_ERROR)
```

## 📝 Best Practices

### ✅ 권장사항

1. **특정 Exception 사용**
   ```typescript
   // Good
   throw new ValidationException('Email is required')
   throw new NotFoundException('User not found')

   // Avoid
   throw new Error('Email is required')
   ```

2. **필드 정보 포함 (유효성 검사)**
   ```typescript
   // Context에 필드 정보 포함
   throw new ValidationException('Invalid email format', {
     field: 'email',
     value: input.email
   })
   ```

3. **적절한 에러 타입 선택**
   - 입력 검증 실패 → `ValidationException`
   - 리소스 없음 → `NotFoundException`
   - 중복/충돌 → `ConflictException`
   - 데이터베이스 에러 → `DatabaseException`

4. **명확한 에러 메시지**
   ```typescript
   // Good: 구체적이고 액션 가능
   throw new ValidationException('Table ID must be a non-empty string')

   // Avoid: 모호함
   throw new ValidationException('Invalid input')
   ```

### ❌ 피해야 할 것

1. **Generic Error 던지기**
   ```typescript
   // Bad
   throw new Error('Something went wrong')

   // Good
   throw new InternalErrorException('Database connection failed')
   ```

2. **에러 정보 숨기기**
   ```typescript
   // Bad
   catch (error) {
     throw new Error('Error occurred')
   }

   // Good
   catch (error) {
     throw new DatabaseException('Failed to save node', {
       originalError: error.message
     })
   }
   ```

## 🎉 결과

### 개선 메트릭
- ✅ **타입 안정성**: string → ErrorCode enum
- ✅ **새 Exception 타입**: 3개 추가
- ✅ **표준 헬퍼**: 4개 함수 제공
- ✅ **테스트 통과**: 51/51 (100%)

### 다음 단계
1. 기존 코드베이스에 ErrorResponse 적용
2. GraphQL resolver에서 formatGraphQLError 사용
3. REST API에서 표준 에러 응답 사용
4. MCP 서버에서 에러 변환 적용

---

**상태**: ✅ **완료** - 에러 표준화 기반 구축 완료!
