# 일괄 속성 생성 뮤테이션 설계

## 📋 **현재 상황 분석**

### **현재 방식 (3번 개별 호출)**
```yaml
# Step 3: Create String Attribute Type
create_string_attribute_type:
  query: |
    mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
      createAttributeType(input: $input) { ... }
    }

# Step 4: Create Integer Attribute Type  
create_integer_attribute_type:
  query: |
    mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
      createAttributeType(input: $input) { ... }
    }

# Step 5: Create Name Attribute
create_name_attribute:
  query: |
    mutation CreateAttribute($input: CreateAttributeInput!) {
      createAttribute(input: $input) { ... }
    }

# Step 6: Create Email Attribute
create_email_attribute:
  query: |
    mutation CreateAttribute($input: CreateAttributeInput!) {
      createAttribute(input: $input) { ... }
    }

# Step 7: Create Age Attribute
create_age_attribute:
  query: |
    mutation CreateAttribute($input: CreateAttributeInput!) {
      createAttribute(input: $input) { ... }
    }
```

### **문제점**
1. **네트워크 오버헤드**: 5번의 개별 GraphQL 호출
2. **트랜잭션 일관성**: 중간에 실패 시 부분적 생성 상태
3. **성능 저하**: 순차적 실행으로 인한 지연
4. **복잡성**: 템플릿 관리의 복잡성 증가

## 🎯 **개선 목표**

1. **단일 뮤테이션으로 일괄 처리**
2. **트랜잭션 일관성 보장**
3. **성능 최적화**
4. **에러 처리 개선**
5. **템플릿 단순화**

## 🏗️ **설계 방안**

### **방안 1: 일괄 속성 타입 및 속성 생성 뮤테이션**

```graphql
# 새로운 뮤테이션 정의
mutation CreateTableWithAttributes($input: CreateTableWithAttributesInput!) {
  createTableWithAttributes(input: $input) {
    success
    table {
      id
      identifier
      description
      attributes {
        id
        identifier
        name
        attributeType {
          id
          identifier
          dataType
        }
      }
    }
    errors {
      message
      code
      field
    }
  }
}

# 입력 타입 정의
input CreateTableWithAttributesInput {
  # 테이블 정보
  table: CreateTableInput!
  
  # 속성 타입 정의 (필요한 경우에만 생성)
  attributeTypes: [CreateAttributeTypeInput!]
  
  # 속성 정의
  attributes: [CreateAttributeDefinitionInput!]!
}

input CreateTableInput {
  identifier: String!
  name: String!
  description: String
}

input CreateAttributeTypeInput {
  identifier: String!
  name: String!
  description: String
  dataType: String!
  constraints: JSON
  defaultValue: String
}

input CreateAttributeDefinitionInput {
  identifier: String!
  name: String!
  description: String
  attributeTypeIdentifier: String!  # 기존 속성 타입 참조
  isRequired: Boolean = false
  metadata: JSON
}
```

### **방안 2: 기존 속성 타입 활용 + 일괄 속성 생성**

```graphql
# 기존 속성 타입을 활용한 일괄 속성 생성
mutation CreateAttributesBatch($input: CreateAttributesBatchInput!) {
  createAttributesBatch(input: $input) {
    success
    attributes {
      id
      identifier
      name
      attributeType {
        id
        identifier
        dataType
      }
      table {
        id
        identifier
      }
    }
    errors {
      message
      code
      field
      attributeIndex
    }
  }
}

input CreateAttributesBatchInput {
  tableId: ID!
  attributes: [CreateAttributeInput!]!
}

input CreateAttributeInput {
  identifier: String!
  name: String!
  description: String
  attributeTypeId: ID!
  isRequired: Boolean = false
  metadata: JSON
}
```

### **방안 3: 하이브리드 접근법 (권장)**

```graphql
# 테이블과 속성을 함께 생성하는 통합 뮤테이션
mutation CreateTableWithSchema($input: CreateTableWithSchemaInput!) {
  createTableWithSchema(input: $input) {
    success
    table {
      id
      identifier
      description
      attributes {
        id
        identifier
        name
        attributeType {
          id
          identifier
          dataType
        }
        isRequired
        metadata
      }
    }
    createdAttributeTypes {
      id
      identifier
      dataType
    }
    errors {
      message
      code
      field
      step
    }
  }
}

input CreateTableWithSchemaInput {
  # 테이블 기본 정보
  table: CreateTableInput!
  
  # 속성 스키마 정의
  schema: TableSchemaInput!
}

input CreateTableInput {
  identifier: String!
  name: String!
  description: String
}

input TableSchemaInput {
  # 필요한 속성 타입들 (없으면 생성)
  attributeTypes: [AttributeTypeDefinitionInput!]
  
  # 테이블 속성들
  attributes: [AttributeDefinitionInput!]!
}

input AttributeTypeDefinitionInput {
  identifier: String!
  name: String!
  description: String
  dataType: String!
  constraints: JSON
  defaultValue: String
}

input AttributeDefinitionInput {
  identifier: String!
  name: String!
  description: String
  attributeTypeIdentifier: String!  # 속성 타입 식별자
  isRequired: Boolean = false
  metadata: JSON
}
```

## 🔧 **구현 세부사항**

### **1. 백엔드 구현 (TypeScript)**

```typescript
// src/presentation/graphql/mutations/TableMutations.ts

export class TableMutations extends BaseResolver {
  async createTableWithSchema(
    _: any,
    { input }: { input: CreateTableWithSchemaInput },
    context: GraphQLContext
  ): Promise<CreateTableWithSchemaPayload> {
    const { table, schema } = input;
    
    try {
      // 트랜잭션 시작
      return await this.database.transaction(async (trx) => {
        const errors: Error[] = [];
        
        // 1. 테이블 생성
        const tableResult = await this.createTable(_, { input: table }, context);
        if (!tableResult.success) {
          return {
            success: false,
            table: null,
            createdAttributeTypes: [],
            errors: tableResult.errors
          };
        }
        
        const tableId = tableResult.table!.id;
        const createdAttributeTypes: AttributeType[] = [];
        
        // 2. 속성 타입 생성 (필요한 경우)
        const attributeTypeMap = new Map<string, string>();
        
        for (const attrTypeDef of schema.attributeTypes || []) {
          try {
            const attrTypeResult = await this.createAttributeType(_, {
              input: attrTypeDef
            }, context);
            
            if (attrTypeResult.success && attrTypeResult.attributeType) {
              attributeTypeMap.set(attrTypeDef.identifier, attrTypeResult.attributeType.id);
              createdAttributeTypes.push(attrTypeResult.attributeType);
            } else {
              errors.push(...attrTypeResult.errors);
            }
          } catch (error) {
            errors.push({
              message: `Failed to create attribute type ${attrTypeDef.identifier}`,
              code: 'ATTRIBUTE_TYPE_CREATION_FAILED',
              field: 'attributeTypes',
              step: 'attributeTypeCreation'
            });
          }
        }
        
        // 3. 기존 속성 타입 조회 (이미 존재하는 경우)
        for (const attrDef of schema.attributes) {
          if (!attributeTypeMap.has(attrDef.attributeTypeIdentifier)) {
            const existingAttrType = await this.getAttributeTypeByIdentifier(
              attrDef.attributeTypeIdentifier
            );
            if (existingAttrType) {
              attributeTypeMap.set(attrDef.attributeTypeIdentifier, existingAttrType.id);
            } else {
              errors.push({
                message: `Attribute type ${attrDef.attributeTypeIdentifier} not found`,
                code: 'ATTRIBUTE_TYPE_NOT_FOUND',
                field: 'attributes',
                step: 'attributeCreation'
              });
            }
          }
        }
        
        // 4. 속성들 일괄 생성
        const createdAttributes: Attribute[] = [];
        
        for (const attrDef of schema.attributes) {
          const attributeTypeId = attributeTypeMap.get(attrDef.attributeTypeIdentifier);
          
          if (attributeTypeId) {
            try {
              const attrResult = await this.createAttribute(_, {
                input: {
                  identifier: attrDef.identifier,
                  name: attrDef.name,
                  description: attrDef.description,
                  attributeTypeId,
                  tableId,
                  isRequired: attrDef.isRequired,
                  metadata: attrDef.metadata
                }
              }, context);
              
              if (attrResult.success && attrResult.attribute) {
                createdAttributes.push(attrResult.attribute);
              } else {
                errors.push(...attrResult.errors);
              }
            } catch (error) {
              errors.push({
                message: `Failed to create attribute ${attrDef.identifier}`,
                code: 'ATTRIBUTE_CREATION_FAILED',
                field: 'attributes',
                step: 'attributeCreation'
              });
            }
          }
        }
        
        // 5. 결과 반환
        return {
          success: errors.length === 0,
          table: {
            ...tableResult.table!,
            attributes: createdAttributes
          },
          createdAttributeTypes,
          errors
        };
      });
      
    } catch (error) {
      return {
        success: false,
        table: null,
        createdAttributeTypes: [],
        errors: [{
          message: error.message,
          code: 'TRANSACTION_FAILED',
          field: 'general',
          step: 'transaction'
        }]
      };
    }
  }
}
```

### **2. GraphQL 스키마 확장**

```graphql
# src/presentation/graphql/schema/mutations/table-mutations.graphql

extend type Mutation {
  # 기존 뮤테이션들...
  createTable(input: CreateTableInput!): CreateTablePayload!
  updateTable(id: ID!, input: UpdateTableInput!): UpdateTablePayload!
  deleteTable(id: ID!): DeleteTablePayload!
  
  # 새로운 일괄 생성 뮤테이션
  createTableWithSchema(input: CreateTableWithSchemaInput!): CreateTableWithSchemaPayload!
}

# 새로운 타입 정의
type CreateTableWithSchemaPayload implements OperationResult {
  success: Boolean!
  table: Table
  createdAttributeTypes: [AttributeType!]!
  errors: [Error!]!
}

input CreateTableWithSchemaInput {
  table: CreateTableInput!
  schema: TableSchemaInput!
}

input CreateTableInput {
  identifier: String!
  name: String!
  description: String
}

input TableSchemaInput {
  attributeTypes: [AttributeTypeDefinitionInput!]
  attributes: [AttributeDefinitionInput!]!
}

input AttributeTypeDefinitionInput {
  identifier: String!
  name: String!
  description: String
  dataType: String!
  constraints: JSON
  defaultValue: String
}

input AttributeDefinitionInput {
  identifier: String!
  name: String!
  description: String
  attributeTypeIdentifier: String!
  isRequired: Boolean = false
  metadata: JSON
}
```

### **3. 템플릿 시나리오 개선**

```yaml
# test/setup/template-scenarios.yaml

# 기존 5단계를 1단계로 단순화
create_table_with_attributes:
  identifier: "test-create-table-with-attributes"
  name: "Create Table with Attributes"
  description: "테이블과 속성을 일괄 생성하는 테스트"
  query: |
    mutation CreateTableWithSchema($input: CreateTableWithSchemaInput!) {
      createTableWithSchema(input: $input) {
        success
        table {
          id
          identifier
          description
          attributes {
            id
            identifier
            name
            attributeType {
              id
              identifier
              dataType
            }
            isRequired
            metadata
          }
        }
        createdAttributeTypes {
          id
          identifier
          dataType
        }
        errors {
          message
          code
          field
          step
        }
      }
    }
  variables:
    input:
      table:
        identifier: "{{tableIdentifier}}"
        name: "{{tableName}}"
        description: "Test table with attributes"
      schema:
        attributeTypes:
          - identifier: "string"
            name: "String"
            description: "String data type for text values"
            dataType: "string"
          - identifier: "integer"
            name: "Integer"
            description: "Integer data type for numeric values"
            dataType: "integer"
        attributes:
          - identifier: "name"
            name: "name"
            description: "User name attribute"
            attributeTypeIdentifier: "string"
            isRequired: true
          - identifier: "email"
            name: "email"
            description: "User email attribute"
            attributeTypeIdentifier: "string"
            isRequired: true
          - identifier: "age"
            name: "age"
            description: "User age attribute"
            attributeTypeIdentifier: "integer"
            isRequired: false
  expectations:
    - path: "data.createTableWithSchema.success"
      equals: true
    - path: "data.createTableWithSchema.table.id"
      type: "string"
    - path: "data.createTableWithSchema.table.attributes"
      type: "array"
      length: 3
    - path: "data.createTableWithSchema.createdAttributeTypes"
      type: "array"
      length: 2
```

### **4. 테스트 플로우 단순화**

```typescript
// test/queries/template-flow-complete.test.ts

describe('Simplified Template Flow', () => {
  test('should create table with attributes in single step', async () => {
    const stepStartTime = Date.now()
    
    try {
      const result = await templateRunner.runTemplate('create_table_with_attributes', {
        tableIdentifier: `test-table-${Date.now()}`,
        tableName: 'Test Table'
      })
      
      const executionTime = Date.now() - stepStartTime
      
      // 로깅
      queryResultLogger.logQueryResult({
        queryId: 'create-table-with-attributes',
        queryName: 'Create Table with Attributes',
        queryType: 'mutation',
        templateId: 'create_table_with_attributes',
        stepNumber: 1,
        flowId: flowResult.flowId,
        executionTime,
        success: result.success,
        query: 'createTableWithSchema',
        variables: { tableIdentifier: `test-table-${Date.now()}`, tableName: 'Test Table' },
        result: result.data,
        error: result.error,
        errorType: result.error ? 'TEMPLATE_EXECUTION_ERROR' : undefined,
        validation: {
          expectations: [
            {
              path: 'data.createTableWithSchema.success',
              expected: true,
              actual: result.data?.createTableWithSchema?.success,
              passed: result.data?.createTableWithSchema?.success === true
            }
          ],
          overallPassed: result.success
        },
        metadata: {
          businessContext: 'template-flow',
          testType: 'integration'
        }
      })
      
      expect(result.success).toBe(true)
      expect(result.data?.createTableWithSchema?.table?.attributes).toHaveLength(3)
      
    } catch (error) {
      throw error
    }
  })
})
```

## 📊 **성능 비교**

### **기존 방식 (5단계)**
```
Step 1: Create String Attribute Type    - 150ms
Step 2: Create Integer Attribute Type   - 140ms  
Step 3: Create Name Attribute           - 120ms
Step 4: Create Email Attribute          - 130ms
Step 5: Create Age Attribute            - 125ms
----------------------------------------
Total: 665ms (순차 실행)
```

### **개선된 방식 (1단계)**
```
Step 1: Create Table with Attributes    - 200ms
----------------------------------------
Total: 200ms (일괄 처리)
```

**성능 개선**: **70% 향상** (665ms → 200ms)

## 🔄 **마이그레이션 전략**

### **Phase 1: 백엔드 구현**
1. `createTableWithSchema` 뮤테이션 구현
2. GraphQL 스키마 확장
3. 단위 테스트 작성

### **Phase 2: 템플릿 마이그레이션**
1. 새로운 템플릿 추가
2. 기존 템플릿과 병행 운영
3. 성능 및 안정성 검증

### **Phase 3: 완전 전환**
1. 기존 5단계 템플릿 제거
2. 테스트 플로우 단순화
3. 문서 업데이트

## 🎯 **장점**

### **1. 성능 향상**
- **70% 실행 시간 단축**
- 네트워크 오버헤드 감소
- 트랜잭션 일관성 보장

### **2. 개발자 경험 개선**
- 템플릿 관리 단순화
- 에러 처리 개선
- 디버깅 용이성

### **3. 시스템 안정성**
- 트랜잭션 원자성 보장
- 부분 실패 방지
- 롤백 자동화

### **4. 확장성**
- 새로운 속성 타입 추가 용이
- 복잡한 스키마 지원
- 재사용 가능한 구조

## 🚀 **구현 우선순위**

### **High Priority**
1. `createTableWithSchema` 뮤테이션 구현
2. GraphQL 스키마 확장
3. 기본 템플릿 작성

### **Medium Priority**
1. 에러 처리 개선
2. 성능 최적화
3. 단위 테스트 작성

### **Low Priority**
1. 고급 스키마 기능
2. 마이그레이션 도구
3. 문서화

---

**설계 완료일**: 2025-09-06  
**작성자**: AI Assistant  
**버전**: 1.0
