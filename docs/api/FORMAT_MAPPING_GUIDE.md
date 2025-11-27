# Format Mapping System Guide

Flat JSON 기반의 유연한 포맷 매핑 시스템으로 다양한 JSON 구조로 데이터를 변환합니다.

## 개요

Format Mapping 시스템은 JSONPath 기반 주소 체계를 사용하여 Flat JSON 데이터를 원하는 형식으로 변환합니다.

### 지원 매핑 유형

| 유형 | 설명 | 사용 시나리오 |
|------|------|--------------|
| `FormatMappingTemplate` | 완전한 매핑 정의 | 복잡한 변환, 버전 관리 필요 시 |
| `SimpleMappingDefinition` | 키-값 간략 문법 | 빠른 프로토타이핑 |
| `NodeLevelMapping` | 노드 단위 간소화 문법 | 노드 배열 변환의 일반적 케이스 |

## JSONPath 주소 체계

### 기본 문법

```
$                   → 루트 객체
$.nodes             → nodes 배열
$.nodes[*]          → 모든 노드
$.nodes[0]          → 첫 번째 노드
$.nodes[*].title    → 모든 노드의 title
$.table.identifier  → 테이블 식별자
```

### 주소 예시

| 주소 | 설명 |
|------|------|
| `$.nodes[*].id` | 모든 노드의 ID |
| `$.nodes[*].title` | 모든 노드의 제목 |
| `$.nodes[*].content` | 모든 노드의 내용 |
| `$.nodes[*].attributes.email` | 모든 노드의 email 속성 |
| `$.table.id` | 테이블 ID |
| `$.table.identifier` | 테이블 식별자 |

## NodeLevelMapping (권장)

노드 배열 변환의 일반적인 케이스를 위한 간소화 문법입니다.

### 기본 구조

```typescript
interface NodeLevelMapping {
  outputKey?: string    // 출력 배열 키 (기본: 'items')
  nodeMapping: Record<string, NodeFieldMapping>   // 노드 필드 매핑
  metaMapping?: Record<string, NodeFieldMapping>  // 테이블 메타데이터 매핑
  metaKey?: string      // 메타데이터 출력 키 (기본: 'meta')
}
```

### 필드 접두사 규칙

| 접두사 | 의미 | 예시 | 변환 결과 |
|--------|------|------|-----------|
| (없음) | 코어 필드 | `'title'` | `$.nodes[*].title` |
| `@` | attributes 필드 | `'@email'` | `$.nodes[*].attributes.email` |
| `@@` | 시스템 필드 | `'@@createdAt'` | `$.nodes[*].createdAt` |

### 사용 예시

```typescript
import { NodeLevelMapping, expandNodeMapping } from './FormatMapping'

// 간소화 문법으로 정의
const userMapping: NodeLevelMapping = {
  outputKey: 'users',
  nodeMapping: {
    id: 'id',                    // $.nodes[*].id
    name: 'title',               // $.nodes[*].title
    bio: 'content',              // $.nodes[*].content
    email: '@email',             // $.nodes[*].attributes.email
    role: '@role',               // $.nodes[*].attributes.role
    createdAt: '@@createdAt',    // $.nodes[*].createdAt
  },
  metaMapping: {
    tableId: 'id',
    tableName: 'identifier',
  }
}

// 전체 템플릿으로 확장
const template = expandNodeMapping(userMapping, 'User Export')
```

### 변환 결과

```json
{
  "users": [
    {
      "id": "node-1",
      "name": "John Doe",
      "bio": "Developer",
      "email": "john@example.com",
      "role": "admin",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "tableId": "table-123",
    "tableName": "users"
  }
}
```

### Transform 적용

필드별 변환 함수를 적용할 수 있습니다.

```typescript
const mapping: NodeLevelMapping = {
  outputKey: 'items',
  nodeMapping: {
    id: 'id',
    name: { field: 'title', transform: 'uppercase' },
    status: { field: '@status', transform: 'lowercase' },
    tags: { field: '@tags', transform: 'array' },
    createdAt: { field: '@@createdAt', transform: 'timestamp' },
  }
}
```

#### 지원 Transform

| Transform | 설명 | 예시 |
|-----------|------|------|
| `string` | 문자열 변환 | `123` → `"123"` |
| `number` | 숫자 변환 | `"123"` → `123` |
| `boolean` | 불리언 변환 | `"true"` → `true` |
| `date` | ISO 날짜 포맷 | `1705312800000` → `"2025-01-15"` |
| `timestamp` | Unix 타임스탬프 | `"2025-01-15"` → `1705312800` |
| `uppercase` | 대문자 변환 | `"hello"` → `"HELLO"` |
| `lowercase` | 소문자 변환 | `"HELLO"` → `"hello"` |
| `trim` | 공백 제거 | `" hello "` → `"hello"` |
| `json` | JSON 문자열화 | `{a:1}` → `"{\"a\":1}"` |
| `array` | 배열 래핑 | `"item"` → `["item"]` |
| `flatten` | 객체 평탄화 | `{a:{b:1}}` → `{a.b:1}` |

## SimpleMappingDefinition

간단한 키-값 쌍으로 매핑을 정의합니다.

```typescript
const simpleMapping: SimpleMappingDefinition = {
  'items[*].id': '$.nodes[*].id',
  'items[*].name': '$.nodes[*].title',
  'items[*].desc': '$.nodes[*].content',
}
```

## FormatMappingTemplate

완전한 매핑 정의로 메타데이터와 버전 관리를 포함합니다.

```typescript
const fullTemplate: FormatMappingTemplate = {
  id: 'my-format',
  name: 'My Custom Format',
  description: 'API 응답용 커스텀 포맷',
  version: '1.0.0',
  mappings: [
    { target: 'data.items[*].id', source: '$.nodes[*].id' },
    { target: 'data.items[*].name', source: '$.nodes[*].title' },
    { target: 'meta.total', source: '$.nodes.length' },
  ],
  rootTemplate: {
    data: { items: [] },
    meta: {}
  },
  metadata: {
    author: 'Team',
    createdAt: '2025-01-15',
    tags: ['api', 'export']
  }
}
```

## 프리셋 매핑

자주 사용되는 매핑 템플릿이 내장되어 있습니다.

```typescript
import { PRESET_MAPPINGS } from './FormatMapping'

// CSV 평탄 구조
PRESET_MAPPINGS.CSV_FLAT

// API 응답 형식
PRESET_MAPPINGS.API_RESPONSE

// 그래프 시각화 형식
PRESET_MAPPINGS.GRAPH_FORMAT
```

## FormatMapperService 사용

### Export (Flat → Custom)

```typescript
import { FormatMapperService } from './FormatMapperService'

const mapper = new FormatMapperService()
const flatData = { /* Flat JSON 데이터 */ }

const result = mapper.exportWithMapping(flatData, {
  template: userMapping,  // NodeLevelMapping 또는 FormatMappingTemplate
  prettyPrint: true,
  includeNulls: false,
})

if (result.success) {
  console.log(result.json)  // 변환된 JSON 문자열
  console.log(result.stats) // 변환 통계
}
```

### Import (Custom → Flat)

```typescript
const customData = { /* 커스텀 형식 데이터 */ }

const result = mapper.importWithMapping(customData, {
  template: userMapping,
  mergeStrategy: 'merge',
  validateSchema: true,
})

if (result.success) {
  console.log(result.flatData)  // Flat JSON 형식
}
```

## 매핑 검증

```typescript
const validation = mapper.validateMapping(userMapping)

if (!validation.valid) {
  console.error('Errors:', validation.errors)
}
if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings)
}
```

### 에러 코드

| 코드 | 설명 |
|------|------|
| `INVALID_SOURCE_PATH` | 잘못된 소스 경로 |
| `INVALID_TARGET_PATH` | 잘못된 대상 경로 |
| `CIRCULAR_REFERENCE` | 순환 참조 |
| `DUPLICATE_TARGET` | 중복된 대상 경로 |
| `INVALID_TRANSFORM` | 잘못된 변환 함수 |
| `MISSING_REQUIRED_FIELD` | 필수 필드 누락 |
| `TYPE_MISMATCH` | 타입 불일치 |

## 타입 가드

런타임 타입 검사를 위한 유틸리티 함수:

```typescript
import {
  isFormatMappingTemplate,
  isSimpleMappingDefinition,
  isNodeLevelMapping,
  isFieldMapping,
} from './FormatMapping'

if (isNodeLevelMapping(config)) {
  // NodeLevelMapping 처리
}
```

## 관련 문서

- [JSON Export API](./JSON_EXPORT_API.md) - JSON Export 전체 API
- [Flat JSON Format](./JSON_EXPORT_API.md#flat-format) - Flat JSON 형식 상세
- [Quick Start](../guides/QUICK_START_IMPORT_EXPORT.md) - 빠른 시작 가이드
