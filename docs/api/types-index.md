# GraphQL Types Reference

GraphQL API 타입 정의 참조 문서

## 🏷️ AttributeType
```graphql
type AttributeType {
  id: ID!
  identifier: String!
  name: String!
  description: String
  dataType: String!
  format: String
  constraints: JSON
  defaultValue: String
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## 🏷️ Attribute
```graphql
type Attribute {
  id: ID!
  identifier: String!
  name: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
  attributeType: AttributeType!
  table: Table!
}
```

## 📊 Table
```graphql
type Table {
  id: ID!
  identifier: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
  attributes: [Attribute!]!
  attributeTypes: [AttributeType!]!
  tableNodes: [TableNode!]!
  tableNodeCount: Int!
  attributeCount: Int!
}
```

## 🔗 TableNode
```graphql
type TableNode {
  id: ID!
  content: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  table: Table!
  attributes: [NodeAttribute!]!
  outgoingRelations: [NodeRelation!]!
  incomingRelations: [NodeRelation!]!
  attributeCount: Int!
  relationCount: Int!
  connectedNodes(depth: Int = 1, direction: RelationDirection = BOTH, relationTypes: [ID!]): [ConnectedNode!]!
  shortestPath(targetNodeId: ID!, maxDepth: Int = 6): GraphPath
  neighborsByRelationType(relationTypeId: ID!): [TableNode!]!
}
```

## 🔗 NodeAttribute
```graphql
type NodeAttribute {
  id: ID!
  value: String!
  attribute: Attribute!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## 🔗 RelationType
```graphql
type RelationType {
  id: ID!
  identifier: String!
  name: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## 🔗 NodeRelation
```graphql
type NodeRelation {
  id: ID!
  sourceNode: TableNode!
  targetNode: TableNode!
  relationType: RelationType!
  strength: Float
  properties: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
  table: Table!
}
```

## 📝 QueryTemplate
```graphql
type QueryTemplate {
  id: ID!
  identifier: String!
  name: String!
  description: String
  query: String!
  variables: JSON
  operationType: String!
  tags: [String!]!
  isActive: Boolean!
  usageCount: Int!
  complexityScore: Int!
  applicableTables: [String!]
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## 📄 Doc
```graphql
type Doc {
  id: ID!
  category: DocCategory!
  version: Int!
  content: String!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  table: Table!
}

enum DocCategory {
  USAGE
  GUIDE
  EXAMPLE
  SPEC
  GENERAL
}
```

## 🏥 HealthStatus
```graphql
type HealthStatus {
  status: String!
  timestamp: DateTime!
  database: Boolean!
  version: String!
  memory: MemoryHealthStatus!
}
```

## 🏥 SystemStats
```graphql
type SystemStats {
  memory: MemoryStats!
  process: ProcessStats!
  database: DatabaseStats!
  timestamp: DateTime!
  uptime: Int!
}
```

## 🏥 MemoryStats
```graphql
type MemoryStats {
  used: Int!
  free: Int!
  total: Int!
  percentage: Float!
  heap: HeapStats!
}
```

## 🔗 연결 타입들 (Connections)
```graphql
type TablesConnection {
  nodes: [Table!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type NodesConnection {
  nodes: [TableNode!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type AttributesConnection {
  attributes: [Attribute!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type AttributeTypesConnection {
  attributeTypes: [AttributeType!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type DocsConnection {
  docs: [Doc!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}
```

## 📤 Payload 타입들 (Operation Results)
```graphql
type CreateTablePayload {
  success: Boolean!
  table: Table
  errors: [Error!]!
}

type CreateNodePayload {
  success: Boolean!
  node: TableNode
  errors: [Error!]!
}

type CreateAttributeTypePayload {
  success: Boolean!
  attributeType: AttributeType
  errors: [Error!]!
}

type CreateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [Error!]!
}

type UpdateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [Error!]!
}

type DeleteDocPayload {
  success: Boolean!
  errors: [Error!]!
}

type ActivateDocPayload {
  success: Boolean!
  doc: Doc
  errors: [Error!]!
}

type Error {
  message: String!
  code: String!
  field: String
}
```

## 🔍 Enum 타입들
```graphql
enum RelationDirection {
  INCOMING
  OUTGOING
  BOTH
}

enum FilterOperator {
  EQUALS
  CONTAINS
  STARTS_WITH
  ENDS_WITH
  GREATER_THAN
  LESS_THAN
}
```

## 📥 Input 타입들
```graphql
input CreateTableInput {
  identifier: String!
  description: String
}

input CreateNodeInput {
  content: String!
  tableId: ID!
  attributes: [NodeAttributeInput!]
}

input CreateAttributeTypeInput {
  identifier: String!
  name: String!
  description: String
  dataType: String!
  format: String
  constraints: JSON
  defaultValue: String
}

input CreateDocInput {
  tableId: ID!
  category: DocCategory!
  content: String!
  version: Int = 1
}

input UpdateDocInput {
  content: String
  isActive: Boolean
}

input DocsFilter {
  tableId: ID
  category: DocCategory
  isActive: Boolean
  version: Int
  createdAfter: DateTime
  createdBefore: DateTime
}

input TablesFilter {
  search: String
  createdAfter: DateTime
  createdBefore: DateTime
  identifiers: [String!]
  hasNodes: Boolean
  nodeCountMin: Int
  nodeCountMax: Int
}

input NodesFilter {
  search: String
  tableId: ID
  hasAttributes: Boolean
  createdAfter: DateTime
  createdBefore: DateTime
}

input PaginationInput {
  limit: Int = 10
  offset: Int = 0
}

input SortInput {
  field: String!
  direction: SortDirection = ASC
}

enum SortDirection {
  ASC
  DESC
}
```

---
*GraphQL API 스키마 기반 자동 생성*