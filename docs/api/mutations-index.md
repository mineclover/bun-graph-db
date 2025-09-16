# GraphQL Mutations Reference

GraphQL API Mutation 타입 참조 문서

## 🏗️ 테이블 관리
- `createTable(input: CreateTableInput!): CreateTablePayload!` - 새로운 테이블 생성
- `updateTable(id: ID!, input: UpdateTableInput!): UpdateTablePayload!` - 테이블 정보 수정
- `deleteTable(id: ID!, force: Boolean = false, cascadeDelete: Boolean = false): DeleteTablePayload!` - 테이블 삭제

## 🔗 노드 관리
- `createNode(input: CreateNodeInput!): CreateNodePayload!` - 새로운 노드 생성
- `updateNode(id: ID!, input: UpdateNodeInput!): UpdateNodePayload!` - 노드 정보 수정
- `deleteNode(id: ID!): DeleteNodePayload!` - 노드 삭제
- `setNodeAttribute(input: SetNodeAttributeInput!): SetNodeAttributePayload!` - 노드 속성 설정

## 🏷️ 속성 관리
- `createAttributeType(input: CreateAttributeTypeInput!): CreateAttributeTypePayload!` - 속성 타입 생성
- `updateAttributeType(id: ID!, input: UpdateAttributeTypeInput!): UpdateAttributeTypePayload!` - 속성 타입 수정
- `deleteAttributeType(id: ID!): DeleteAttributeTypePayload!` - 속성 타입 삭제
- `createAttribute(input: CreateAttributeInput!): CreateAttributePayload!` - 테이블 속성 생성
- `updateAttribute(id: ID!, input: UpdateAttributeInput!): UpdateAttributePayload!` - 속성 수정
- `deleteAttribute(id: ID!): DeleteAttributePayload!` - 속성 삭제

## 🔗 관계 관리
- `createRelationType(input: CreateRelationTypeInput!): CreateRelationTypePayload!` - 관계 타입 생성
- `createRelation(input: CreateRelationInput!): CreateRelationPayload!` - 노드 간 관계 생성
- `deleteRelation(id: ID!): DeleteRelationPayload!` - 관계 삭제

## 📝 템플릿 관리
- `createTemplate(input: CreateQueryTemplateInput!): CreateQueryTemplatePayload!` - 템플릿 생성
- `updateTemplate(id: ID!, input: UpdateQueryTemplateInput!): UpdateQueryTemplatePayload!` - 템플릿 수정
- `deleteTemplate(id: ID!): DeleteQueryTemplatePayload!` - 템플릿 삭제
- `activateTemplate(id: ID!): QueryTemplate` - 템플릿 활성화
- `deactivateTemplate(id: ID!): QueryTemplate` - 템플릿 비활성화
- `executeTemplate(input: ExecuteQueryTemplateInput!): ExecuteQueryTemplatePayload!` - 템플릿 실행
- `executeTemplateWithGraphQL(templateIdentifier: String!, variables: JSON, trackUsage: Boolean): TemplateExecutionResult!` - GraphQL을 통한 템플릿 실행
- `updateTemplateQuery(templateId: ID, templateIdentifier: String, newQuery: String!, updateVariables: JSON): UpdateTemplateQueryPayload!` - 템플릿 쿼리 업데이트
- `exportTemplate(templateId: ID, templateIdentifier: String, includeStatistics: Boolean): ExportTemplatePayload!` - 템플릿 내보내기
- `importTemplate(jsonData: String!, overwriteExisting: Boolean, generateNewIdentifier: Boolean, newIdentifierPrefix: String): ImportTemplatePayload!` - 템플릿 가져오기

## 📄 문서 관리
- `createDoc(input: CreateDocInput!): CreateDocPayload!` - 새 문서 생성 (자동 버전 관리)
- `updateDoc(id: ID!, input: UpdateDocInput!): UpdateDocPayload!` - 기존 문서 내용/상태 수정
- `deleteDoc(id: ID!): DeleteDocPayload!` - 문서 영구 삭제
- `activateDoc(id: ID!): ActivateDocPayload!` - 문서 활성화 (같은 카테고리 다른 문서들 자동 비활성화)

## 📤 스키마 내보내기/가져오기
- `importSchema(exportData: JSON!, options: SchemaImportOptions): ImportResult!` - 스키마 데이터 가져오기

---
*GraphQL API 스키마 기반 자동 생성*