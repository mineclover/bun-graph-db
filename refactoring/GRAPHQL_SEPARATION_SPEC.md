# GraphQL 관심사 분리 상세 설계

> **이 문서는 [REFACTOR_SPECIFICATION.md](./REFACTOR_SPECIFICATION.md)의 GraphQL 관심사 분리 부분을 상세히 다룹니다.**

## 🎯 분리 목표

현재 단일 파일에 집중된 GraphQL resolver들을 Query, Mutation, Subscription으로 명확히 분리하여 유지보수성과 가독성 향상

## 📋 현재 상태 분석

### 문제점
```typescript
// 현재: schema-builder.ts에 모든 것이 집중 (366줄)
const resolvers = {
  Query: {
    health: () => ({ /* */ }),
    table: (_: GraphQLParent, args: TableArgs) => tableResolver.table(args),
    tableByIdentifier: (_: GraphQLParent, args: TableByIdentifierArgs) => /* */,
    tables: (_: GraphQLParent, args: TablesArgs) => /* */,
    // ... 50+ query resolvers
  },
  Mutation: {
    createTable: (_: GraphQLParent, args: CreateTableArgs) => /* */,
    updateTable: (_: GraphQLParent, args: UpdateTableArgs) => /* */,
    // ... 30+ mutation resolvers  
  },
  // ... Field resolvers, subscriptions
}
```

## 🏗️ 새로운 분리 구조

### 1. Directory Structure
```
src/presentation/graphql/
├── schema/                        # GraphQL Schema 정의 파일들
│   ├── root.graphql              # 최상위 스키마
│   ├── types/                    # 타입 정의들
│   │   ├── common.graphql        # 공통 타입 (DateTime, JSON 등)
│   │   ├── table.graphql         # Table 관련 타입들
│   │   ├── node.graphql          # Node 관련 타입들  
│   │   ├── relation.graphql      # Relation 관련 타입들
│   │   ├── analytics.graphql     # Analytics 관련 타입들
│   │   └── query-template.graphql
│   ├── queries/                  # Query 스키마들 
│   │   ├── table-queries.graphql
│   │   ├── node-queries.graphql
│   │   ├── relation-queries.graphql
│   │   ├── analytics-queries.graphql
│   │   └── template-queries.graphql
│   ├── mutations/                # Mutation 스키마들
│   │   ├── table-mutations.graphql  
│   │   ├── node-mutations.graphql
│   │   ├── relation-mutations.graphql
│   │   └── template-mutations.graphql
│   └── subscriptions/            # Subscription 스키마들
│       └── realtime.graphql
│
├── resolvers/                    # Resolver 구현체들
│   ├── queries/                  # Query Resolver들
│   │   ├── TableQueries.ts
│   │   ├── NodeQueries.ts  
│   │   ├── RelationQueries.ts
│   │   ├── AnalyticsQueries.ts
│   │   ├── TemplateQueries.ts
│   │   └── index.ts             # Query resolvers 통합
│   ├── mutations/               # Mutation Resolver들
│   │   ├── TableMutations.ts
│   │   ├── NodeMutations.ts
│   │   ├── RelationMutations.ts
│   │   ├── TemplateMutations.ts
│   │   └── index.ts            # Mutation resolvers 통합
│   ├── subscriptions/          # Subscription Resolver들
│   │   ├── RealtimeSubscriptions.ts
│   │   └── index.ts
│   └── field-resolvers/        # Field Resolver들
│       ├── TableFieldResolvers.ts
│       ├── NodeFieldResolvers.ts
│       ├── RelationFieldResolvers.ts  
│       └── index.ts
│
├── types/                       # TypeScript 타입 정의들
│   ├── GraphQLContext.ts        # Context 타입
│   ├── ResolverTypes.ts         # Resolver 함수 타입들
│   └── InputTypes.ts            # Input 타입들
│
└── GraphQLSchemaBuilder.ts      # 스키마 빌더 (새로운 구조)
```

### 2. Schema 파일 분리

#### root.graphql
```graphql
# 최상위 스키마 정의
schema {
  query: Query
  mutation: Mutation  
  subscription: Subscription
}

# 루트 타입들
type Query {
  # Health check
  health: HealthStatus!
  
  # Import from sub-schemas
  # extend type Query { ... } 를 사용하여 각 도메인별 쿼리들을 확장
}

type Mutation {
  # Placeholder for extensions
  _empty: String
}

type Subscription {
  # Placeholder for extensions  
  _empty: String
}

type HealthStatus {
  status: String!
  timestamp: DateTime!
  database: Boolean!
  version: String!
}
```

#### queries/table-queries.graphql
```graphql
# Table 관련 쿼리들 확장
extend type Query {
  # Single table queries
  table(id: ID!): Table
  tableByIdentifier(identifier: String!): Table
  
  # Multiple tables queries  
  tables(
    first: Int
    after: String
    filter: TableFilter
    orderBy: TableOrderBy
  ): TableConnection!
}

# Table 필터 및 정렬 옵션
input TableFilter {
  identifierContains: String
  createdAfter: DateTime
  createdBefore: DateTime
  hasNodes: Boolean
}

input TableOrderBy {
  field: TableOrderField!
  direction: OrderDirection!
}

enum TableOrderField {
  ID
  IDENTIFIER  
  CREATED_AT
  UPDATED_AT
  NODE_COUNT
}
```

#### mutations/table-mutations.graphql
```graphql
# Table 관련 변경 작업들 확장
extend type Mutation {
  # Table lifecycle
  createTable(input: CreateTableInput!): Table!
  updateTable(id: ID!, input: UpdateTableInput!): Table!
  deleteTable(id: ID!): Boolean!
  
  # Bulk operations
  createMultipleTables(input: [CreateTableInput!]!): [Table!]!
  deleteMultipleTables(ids: [ID!]!): BatchResult!
}

# Input types
input CreateTableInput {
  identifier: String!
  description: String
}

input UpdateTableInput {
  identifier: String
  description: String
}

type BatchResult {
  successCount: Int!
  errorCount: Int!
  errors: [BatchError!]!
}

type BatchError {
  index: Int!
  message: String!
}
```

### 3. Resolver 클래스 분리

#### TableQueries.ts
```typescript
import type { 
  QueryResolvers, 
  TableArgs, 
  TableByIdentifierArgs, 
  TablesArgs 
} from '../types/ResolverTypes.js'

export class TableQueries implements Partial<QueryResolvers> {
  constructor(
    private tableRepository: ITableRepository,
    private createTableUseCase: CreateTableUseCase,
    private logger: ILogger
  ) {}

  async table(_parent: unknown, args: TableArgs): Promise<Table | null> {
    this.logger.debug('TableQueries.table', { args })
    
    try {
      const table = await this.tableRepository.findById(args.id)
      return table || null
    } catch (error) {
      this.logger.error('Failed to fetch table', { error, args })
      throw new GraphQLError('Failed to fetch table', {
        extensions: { code: 'TABLE_NOT_FOUND' }
      })
    }
  }

  async tableByIdentifier(_parent: unknown, args: TableByIdentifierArgs): Promise<Table | null> {
    this.logger.debug('TableQueries.tableByIdentifier', { args })
    
    try {
      const table = await this.tableRepository.findByIdentifier(args.identifier)
      return table || null
    } catch (error) {
      this.logger.error('Failed to fetch table by identifier', { error, args })
      throw new GraphQLError('Failed to fetch table by identifier')
    }
  }

  async tables(_parent: unknown, args: TablesArgs): Promise<TableConnection> {
    this.logger.debug('TableQueries.tables', { args })
    
    try {
      const { first = 10, after, filter, orderBy } = args
      
      // Pagination & filtering logic
      const result = await this.tableRepository.findMany({
        limit: first,
        cursor: after,
        filter: this.buildFilter(filter),
        orderBy: this.buildOrderBy(orderBy)
      })

      return {
        nodes: result.items,
        edges: result.items.map(item => ({
          node: item,
          cursor: item.id.toString()
        })),
        pageInfo: {
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          startCursor: result.items[0]?.id.toString(),
          endCursor: result.items[result.items.length - 1]?.id.toString()
        },
        totalCount: result.totalCount
      }
    } catch (error) {
      this.logger.error('Failed to fetch tables', { error, args })
      throw new GraphQLError('Failed to fetch tables')
    }
  }

  private buildFilter(filter?: TableFilter): RepositoryFilter {
    // Filter 변환 로직
  }

  private buildOrderBy(orderBy?: TableOrderBy): RepositoryOrderBy {
    // Order 변환 로직
  }
}
```

#### TableMutations.ts
```typescript
export class TableMutations implements Partial<MutationResolvers> {
  constructor(
    private createTableUseCase: CreateTableUseCase,
    private updateTableUseCase: UpdateTableUseCase,
    private deleteTableUseCase: DeleteTableUseCase,
    private logger: ILogger
  ) {}

  async createTable(_parent: unknown, args: CreateTableArgs): Promise<Table> {
    this.logger.debug('TableMutations.createTable', { args })
    
    try {
      const { input } = args
      
      // Input validation
      if (!input.identifier?.trim()) {
        throw new GraphQLError('Table identifier is required', {
          extensions: { code: 'INVALID_INPUT' }
        })
      }

      // Use case 호출
      const table = await this.createTableUseCase.execute({
        identifier: input.identifier.trim(),
        description: input.description?.trim()
      })

      this.logger.info('Table created successfully', { tableId: table.id })
      return table
      
    } catch (error) {
      if (error instanceof DomainException) {
        throw new GraphQLError(error.message, {
          extensions: { code: error.code }
        })
      }
      
      this.logger.error('Failed to create table', { error, args })
      throw new GraphQLError('Failed to create table')
    }
  }

  async updateTable(_parent: unknown, args: UpdateTableArgs): Promise<Table> {
    // 비슷한 패턴으로 구현
  }

  async deleteTable(_parent: unknown, args: DeleteTableArgs): Promise<boolean> {
    // 비슷한 패턴으로 구현  
  }
}
```

### 4. Field Resolver 분리

#### TableFieldResolvers.ts
```typescript
export class TableFieldResolvers implements TableResolvers {
  constructor(
    private nodeRepository: INodeRepository,
    private attributeRepository: IAttributeRepository,
    private logger: ILogger
  ) {}

  async nodeCount(parent: Table): Promise<number> {
    try {
      return await this.nodeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.error('Failed to count nodes for table', { error, tableId: parent.id })
      return 0
    }
  }

  async attributeCount(parent: Table): Promise<number> {
    try {
      return await this.attributeRepository.countByTableId(parent.id)  
    } catch (error) {
      this.logger.error('Failed to count attributes for table', { error, tableId: parent.id })
      return 0
    }
  }

  async nodes(parent: Table, args: NodesArgs): Promise<NodeConnection> {
    try {
      const result = await this.nodeRepository.findByTableId(parent.id, {
        limit: args.first || 10,
        cursor: args.after,
        filter: args.filter
      })

      return this.buildNodeConnection(result)
    } catch (error) {
      this.logger.error('Failed to fetch nodes for table', { error, tableId: parent.id })
      throw new GraphQLError('Failed to fetch nodes')
    }
  }

  async attributes(parent: Table): Promise<Attribute[]> {
    try {
      return await this.attributeRepository.findByTableId(parent.id)
    } catch (error) {
      this.logger.error('Failed to fetch attributes for table', { error, tableId: parent.id })
      return []
    }
  }

  private buildNodeConnection(result: PaginatedResult<Node>): NodeConnection {
    // Connection 빌드 로직
  }
}
```

### 5. 새로운 Schema Builder

#### GraphQLSchemaBuilder.ts
```typescript
import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge'

// Resolver imports
import { createQueryResolvers } from './resolvers/queries/index.js'
import { createMutationResolvers } from './resolvers/mutations/index.js'
import { createSubscriptionResolvers } from './resolvers/subscriptions/index.js'
import { createFieldResolvers } from './resolvers/field-resolvers/index.js'

export class GraphQLSchemaBuilder {
  private dependencies: SchemaBuilderDependencies

  constructor(dependencies: SchemaBuilderDependencies) {
    this.dependencies = dependencies
  }

  build(): GraphQLSchema {
    // 1. Load schema files
    const typeDefs = this.loadSchemaFiles()
    
    // 2. Create resolvers
    const resolvers = this.createResolvers()
    
    // 3. Build executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })

    return schema
  }

  private loadSchemaFiles() {
    const schemaFiles = loadFilesSync(
      join(process.cwd(), 'src/presentation/graphql/schema'),
      { 
        extensions: ['graphql'],
        recursive: true
      }
    )

    return mergeTypeDefs(schemaFiles)
  }

  private createResolvers() {
    const queryResolvers = createQueryResolvers(this.dependencies)
    const mutationResolvers = createMutationResolvers(this.dependencies)  
    const subscriptionResolvers = createSubscriptionResolvers(this.dependencies)
    const fieldResolvers = createFieldResolvers(this.dependencies)

    return mergeResolvers([
      {
        // Custom scalars
        DateTime: DateTimeResolver,
        JSON: JSONResolver,
        
        // Root resolvers
        Query: queryResolvers,
        Mutation: mutationResolvers,
        Subscription: subscriptionResolvers
      },
      fieldResolvers
    ])
  }
}

export interface SchemaBuilderDependencies {
  // Repositories
  tableRepository: ITableRepository
  attributeTypeRepository: IAttributeTypeRepository
  // ... 기타 의존성들
  
  // Use cases  
  createTableUseCase: CreateTableUseCase
  // ... 기타 use case들
  
  // Services
  logger: ILogger
}
```

### 6. Resolver 통합 파일들

#### resolvers/queries/index.ts
```typescript
export function createQueryResolvers(deps: SchemaBuilderDependencies) {
  const tableQueries = new TableQueries(
    deps.tableRepository,
    deps.createTableUseCase,
    deps.logger
  )
  
  const nodeQueries = new NodeQueries(
    deps.nodeRepository,
    deps.searchNodesUseCase,
    deps.logger
  )
  
  // ... 기타 query resolver들

  return {
    // Health check
    health: () => ({
      status: 'OK',
      timestamp: new Date().toISOString(), 
      database: true,
      version: '1.0.0'
    }),

    // Table queries
    ...tableQueries,
    
    // Node queries
    ...nodeQueries,
    
    // ... 기타 resolver들
  }
}
```

## 🔄 Migration Plan

### Phase 1: Schema 파일 분리
1. 기존 `.graphql` 파일들을 도메인별로 분리
2. `extend type` 문법 사용하여 확장 구조로 변경
3. Schema 로딩 로직 수정

### Phase 2: Resolver 클래스 분리  
1. `TableQueries`, `NodeQueries` 등 Query resolver 클래스 생성
2. `TableMutations`, `NodeMutations` 등 Mutation resolver 클래스 생성
3. Field resolver 클래스들 분리

### Phase 3: Schema Builder 교체
1. 새로운 `GraphQLSchemaBuilder` 구현
2. Resolver 통합 로직 구현
3. 기존 `schema-builder.ts` 교체

### Phase 4: 타입 안전성 강화
1. Generated GraphQL types와 TypeScript 연동
2. Resolver 함수 타입 정의 강화
3. Error handling 표준화

## 🎯 기대 효과

1. **가독성**: 각 관심사별로 명확히 분리된 코드
2. **유지보수성**: 작은 단위로 분리되어 수정이 용이
3. **테스트성**: 개별 resolver 클래스 단위 테스트 가능  
4. **확장성**: 새로운 도메인 추가 시 독립적으로 개발 가능
5. **성능**: 필요한 resolver만 로딩 가능
6. **협업**: 도메인별로 다른 개발자가 작업 가능

## ⚠️ 주의사항

1. **Breaking Changes**: 기존 import 경로들 수정 필요
2. **Schema 순서**: GraphQL schema 확장 순서 중요
3. **순환 참조**: Resolver간 의존성 주의
4. **성능 영향**: 파일 분리로 인한 번들 크기 증가 가능성
5. **타입 동기화**: Schema 변경 시 TypeScript 타입도 함께 업데이트