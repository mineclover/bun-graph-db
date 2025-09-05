# 템플릿 플로우 시나리오

## 🎯 목표

테이블 생성부터 노드 제거까지의 전체 데이터베이스 생명주기를 하나의 플로우로 테스트하여, 각 단계별로 값들이 정상적으로 추가되고 제거되는지 검증합니다.

## 📋 시나리오 개요

### 전체 플로우
```
1. 테이블 생성 → 2. 속성 정의 → 3. 노드 생성(속성 포함) → 4. 노드 조회 → 5. 노드 제거
```

### 각 단계별 상세 시나리오

#### 1단계: 테이블 생성 (Table Creation)
- **목적**: 새로운 테이블을 데이터베이스에 생성
- **템플릿**: `create_table`
- **입력 데이터**:
  ```json
  {
    "tableName": "test_users",
    "description": "Test user table for template flow validation"
  }
  ```
- **예상 결과**: 
  - 테이블이 성공적으로 생성됨
  - 테이블 ID 반환
  - 데이터베이스에 테이블 존재 확인

#### 2단계: 속성 정의 (Attribute Definition)
- **목적**: 생성된 테이블에 속성들을 정의
- **템플릿**: `define_attributes`
- **입력 데이터**:
  ```json
  {
    "tableId": "{{tableId}}",
    "attributes": [
      {
        "name": "name",
        "type": "string",
        "required": true
      },
      {
        "name": "email",
        "type": "string",
        "required": true
      },
      {
        "name": "age",
        "type": "integer",
        "required": false
      }
    ]
  }
  ```
- **예상 결과**:
  - 속성들이 성공적으로 정의됨
  - 각 속성의 ID 반환
  - 테이블 스키마 업데이트 확인

#### 3단계: 노드 생성 (Node Creation with Attributes)
- **목적**: 정의된 속성을 포함하여 노드 생성
- **템플릿**: `create_node_with_attributes`
- **입력 데이터**:
  ```json
  {
    "tableId": "{{tableId}}",
    "attributes": {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "age": 30
    }
  }
  ```
- **예상 결과**:
  - 노드가 성공적으로 생성됨
  - 노드 ID 반환
  - 모든 속성 값이 정상적으로 저장됨

#### 4단계: 노드 조회 (Node Retrieval)
- **목적**: 생성된 노드의 정보를 조회하여 데이터 정합성 확인
- **템플릿**: `get_node_with_attributes`
- **입력 데이터**:
  ```json
  {
    "nodeId": "{{nodeId}}"
  }
  ```
- **예상 결과**:
  - 노드 정보가 정상적으로 조회됨
  - 모든 속성 값이 입력한 값과 일치
  - 테이블 정보 포함

#### 5단계: 노드 제거 (Node Removal)
- **목적**: 생성된 노드를 제거하여 정리
- **템플릿**: `delete_node`
- **입력 데이터**:
  ```json
  {
    "nodeId": "{{nodeId}}"
  }
  ```
- **예상 결과**:
  - 노드가 성공적으로 제거됨
  - 노드 조회 시 존재하지 않음 확인

## 🔄 데이터 플로우

### 변수 전달 체인
```
tableId (1단계) → tableId (2단계) → tableId (3단계) → nodeId (3단계) → nodeId (4단계) → nodeId (5단계)
```

### 각 단계별 검증 포인트
1. **테이블 생성**: 테이블 존재 여부, 테이블 ID 유효성
2. **속성 정의**: 속성 개수, 속성 타입, 필수 속성 설정
3. **노드 생성**: 노드 ID 유효성, 속성 값 정합성
4. **노드 조회**: 데이터 정합성, 속성 값 일치성
5. **노드 제거**: 노드 존재 여부, 정리 완료 확인

## 📊 로깅 요구사항

### 개별 테스트 로깅
각 단계별로 다음 정보가 로그에 기록되어야 함:

```json
{
  "step": 1,
  "stepName": "Table Creation",
  "templateId": "create_table",
  "input": { "tableName": "test_users", "description": "..." },
  "output": { "tableId": "table_123", "success": true },
  "executionTime": 150,
  "success": true,
  "timestamp": "2025-09-06T00:00:00Z"
}
```

### 전체 플로우 로깅
```json
{
  "flowId": "template-flow-001",
  "flowName": "Complete Database Lifecycle",
  "startTime": "2025-09-06T00:00:00Z",
  "endTime": "2025-09-06T00:05:00Z",
  "totalDuration": 300000,
  "steps": [
    { "step": 1, "success": true, "duration": 150 },
    { "step": 2, "success": true, "duration": 200 },
    { "step": 3, "success": true, "duration": 180 },
    { "step": 4, "success": true, "duration": 120 },
    { "step": 5, "success": true, "duration": 100 }
  ],
  "overallSuccess": true,
  "variables": {
    "tableId": "table_123",
    "nodeId": "node_456"
  }
}
```

## 🧪 테스트 구현 계획

### 파일 구조
```
test/queries/template-flow-complete.test.ts
```

### 테스트 구조
```typescript
describe('Template Flow - Complete Database Lifecycle', () => {
  describe('Step 1: Table Creation', () => {
    test('should create table when valid data provided', () => {})
  })
  
  describe('Step 2: Attribute Definition', () => {
    test('should define attributes when table exists', () => {})
  })
  
  describe('Step 3: Node Creation', () => {
    test('should create node with attributes when table and attributes defined', () => {})
  })
  
  describe('Step 4: Node Retrieval', () => {
    test('should retrieve node when node exists', () => {})
  })
  
  describe('Step 5: Node Removal', () => {
    test('should remove node when node exists', () => {})
  })
  
  describe('Complete Flow', () => {
    test('should execute complete flow when all steps performed sequentially', () => {})
  })
})
```

## ✅ 성공 기준

### 기능적 요구사항
- [ ] 각 단계별로 템플릿이 정상 실행됨
- [ ] 변수가 단계별로 정상 전달됨
- [ ] 각 단계의 결과가 다음 단계의 입력으로 사용됨
- [ ] 전체 플로우가 순차적으로 완료됨

### 비기능적 요구사항
- [ ] 각 단계별 실행 시간이 로그에 기록됨
- [ ] 개별 테스트 결과가 로그 파일에 저장됨
- [ ] 전체 플로우 결과가 로그 파일에 저장됨
- [ ] 에러 발생 시 적절한 에러 로깅

### 데이터 정합성 요구사항
- [ ] 생성된 테이블이 데이터베이스에 존재함
- [ ] 정의된 속성이 테이블에 정상 반영됨
- [ ] 생성된 노드의 속성 값이 입력 값과 일치함
- [ ] 조회된 노드의 데이터가 생성 시 데이터와 일치함
- [ ] 제거된 노드가 데이터베이스에서 삭제됨

## 🚀 실행 방법

```bash
# 전체 플로우 테스트 실행
bun test:queries

# 특정 플로우 테스트만 실행
bun test test/queries/template-flow-complete.test.ts

# 로그 확인
bun test/runner/simple-test-runner.ts queries
```

## 📝 참고사항

- 각 단계는 이전 단계의 결과에 의존하므로 순차 실행이 필수
- 테스트 실행 전후로 데이터베이스 정리가 필요
- 변수 전달을 위해 템플릿 실행 결과를 저장하고 재사용
- 에러 발생 시 전체 플로우 중단 및 정리 작업 수행
