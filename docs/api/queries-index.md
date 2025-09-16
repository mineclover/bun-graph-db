# GraphQL Queries Reference

GraphQL API Query 타입 참조 문서

## 🏥 시스템 상태
- `health: HealthStatus!` - 기본 시스템 상태 확인
- `healthCheck: HealthStatus!` - 간단한 헬스체크
- `systemStats: SystemStats!` - 상세 시스템 통계
- `memoryStats: MemoryStats!` - 메모리 사용량 상세

## 📊 테이블 관리
- `table(id: ID!): Table` - ID로 특정 테이블 조회
- `tableByIdentifier(identifier: String!): Table` - 식별자로 테이블 조회
- `tables(filter: TablesFilter, pagination: TablesPagination, sort: [SortInput!]): TablesConnection!` - 테이블 목록 조회

## 🔗 노드 관리
- `node(id: ID!): TableNode` - ID로 특정 노드 조회
- `nodeByContent(content: String!, tableId: ID!): TableNode` - 콘텐츠로 노드 검색
- `nodes(filter: NodesFilter, pagination: NodesPagination, sort: [SortInput!]): NodesConnection!` - 노드 목록 조회
- `searchNodes(filter: SearchNodesFilter!, pagination: NodesPagination, sort: [SortInput!]): NodesConnection!` - 고급 노드 검색

## 🏷️ 속성 관리
- `attribute(id: ID!): Attribute` - ID로 속성 조회
- `attributeByIdentifier(identifier: String!, tableId: ID!): Attribute` - 식별자로 속성 조회
- `attributes(filter: AttributesFilter, pagination: PaginationInput, sort: [SortInput!]): AttributesConnection!` - 속성 목록 조회
- `attributeType(id: ID!): AttributeType` - 속성 타입 조회
- `attributeTypeByIdentifier(identifier: String!): AttributeType` - 식별자로 속성 타입 조회
- `attributeTypes(filter: AttributeTypesFilter, pagination: PaginationInput, sort: [SortInput!]): AttributeTypesConnection!` - 속성 타입 목록

## 🔗 관계 관리
- `relationType(id: ID!): RelationType` - 관계 타입 조회
- `relationTypeByIdentifier(identifier: String!): RelationType` - 식별자로 관계 타입 조회
- `relationTypes(filter: FilterInput, pagination: PaginationInput, sort: [SortInput!]): [RelationType!]!` - 관계 타입 목록
- `nodeRelation(id: ID!): NodeRelation` - 특정 노드 관계 조회
- `nodeRelations(filter: NodeRelationsFilter, pagination: PaginationInput, sort: [SortInput!]): NodeRelationsConnection!` - 노드 관계 목록

## 🔍 관계 탐색 및 분석
- `searchRelatedNodes(filter: SearchRelatedNodesFilter!, pagination: PaginationInput): RelatedNodesConnection!` - 관련 노드 검색
- `findPathsBetweenNodes(input: FindPathsInput!): [NodePath!]!` - 노드 간 경로 탐색
- `getDependencyChain(input: DependencyChainInput!): RelatedNodesConnection!` - 의존성 체인 조회

## 📝 쿼리 템플릿 관리
- `getTemplate(id: ID!): QueryTemplate` - 템플릿 조회
- `getTemplateByIdentifier(identifier: String!): QueryTemplate` - 식별자로 템플릿 조회
- `searchTemplates(filter: QueryTemplatesFilter, pagination: PaginationInput, sort: [SortInput!]): QueryTemplatesConnection!` - 템플릿 검색
- `getPopularTemplates(limit: Int = 10): [QueryTemplate!]!` - 인기 템플릿 목록 조회
- `templatesByTable(input: FindTemplatesByTableInput!): [QueryTemplate!]!` - 특정 테이블용 템플릿 조회
- `templatesWithTableDependencies: [QueryTemplate!]!` - 테이블 의존성이 있는 템플릿들
- `tableDependencyTemplates: [TableDependencyTemplateResult!]!` - 테이블별 템플릿 그룹화
- `executeTemplate(input: ExecuteQueryTemplateInput!): ExecuteQueryTemplatePayload!` - 템플릿 실행

## 📄 문서 관리
- `getDoc(id: ID!): Doc` - ID로 특정 문서 조회
- `getActiveDoc(tableId: ID!, category: DocCategory!): Doc` - 테이블+카테고리의 현재 활성 문서 조회
- `getDocs(tableId: ID, category: DocCategory, isActive: Boolean, pagination: PaginationInput): DocsConnection!` - 문서 목록 조회 (필터링, 페이지네이션 지원)
- `getDocVersions(tableId: ID!, category: DocCategory!, pagination: PaginationInput): DocsConnection!` - 특정 테이블+카테고리의 모든 버전 조회
- `searchDocs(filter: DocsFilter!, pagination: PaginationInput): DocsConnection!` - 문서 내용 기반 검색

## 📤 스키마 내보내기
- `exportTable(tableId: String!, options: SchemaExportOptions): SchemaExportResult!` - 특정 테이블 내보내기
- `exportAllTables(options: SchemaExportOptions): SchemaExportResult!` - 전체 테이블 내보내기

---
*GraphQL API 스키마 기반 자동 생성*