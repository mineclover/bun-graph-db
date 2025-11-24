# NodeResolver 의존성 분석

**분석 날짜**: 2025-11-22
**목적**: NodeResolver 통합을 위한 의존성 파악

---

## 현재 상태 분석

### 기존 파일들

1. **NodeQueries.ts** (6.4K, ~200줄)
   - Query 작업: node, nodeByContent, nodes, searchNodes

2. **NodeMutations.ts** (29K, ~900줄)
   - Mutation 작업: createNode, createPersonNode, updateNode, deleteNode
   - Attribute 작업: setNodeAttribute, setNodeStringAttribute, etc.

3. **NodeFieldResolvers.ts** (10K, ~320줄)
   - Field resolvers: table, attributes, relations, connectedNodes, shortestPath

4. **NodeResolver.ts** (19K, ~606줄)
   - ✅ 이미 존재! 모든 작업이 통합되어 있음

---

## 의존성 매핑

### NodeQueries.ts (3개)
```typescript
constructor(
  private nodeRepository: INodeRepository,
  private searchNodesUseCaseResolver: (() => Promise<SearchNodesUseCase | null>) | SearchNodesUseCase | null,
  private logger: ILogger
)
```

### NodeMutations.ts (6개)
```typescript
constructor(
  private createNodeUseCase: CreateNodeUseCase | null,  // ⚠️ Circular dependency
  private nodeRepository: INodeRepository,
  private nodeAttributeRepository: INodeAttributeRepository,
  private tableRepository: ITableRepository,
  private attributeRepository: IAttributeRepository,
  private logger: ILogger
)
```

### NodeFieldResolvers.ts (5개)
```typescript
constructor(
  private nodeRepository: INodeRepository,
  private tableRepository: ITableRepository,
  private nodeAttributeRepository: INodeAttributeRepository,
  private nodeRelationRepository: INodeRelationRepository,  // ⚠️ 추가 필요
  private logger: ILogger
)
```

### NodeResolver.ts - 현재 (7개)
```typescript
constructor(
  private createNodeUseCase: CreateNodeUseCase,
  private searchNodesUseCase: SearchNodesUseCase,
  private nodeRepository: INodeRepository,
  private nodeAttributeRepository: INodeAttributeRepository,
  private attributeRepository: IAttributeRepository,
  private tableRepository: ITableRepository,
  private logger: ILogger
)
```

**⚠️ 누락**: `nodeRelationRepository: INodeRelationRepository`

---

## 통합 의존성 (총 8개)

NodeResolver가 필요한 모든 의존성:

### 1. Repositories (5개)
1. ✅ `nodeRepository: INodeRepository`
2. ✅ `tableRepository: ITableRepository`
3. ✅ `nodeAttributeRepository: INodeAttributeRepository`
4. ❌ `nodeRelationRepository: INodeRelationRepository` - **추가 필요**
5. ✅ `attributeRepository: IAttributeRepository`

### 2. Use Cases (2개)
1. ✅ `createNodeUseCase: CreateNodeUseCase` (circular - lazy loading 필요)
2. ✅ `searchNodesUseCase: SearchNodesUseCase` (lazy loading)

### 3. Infrastructure (1개)
1. ✅ `logger: ILogger`

---

## 필요한 수정

### NodeResolver.ts 생성자 업데이트

```typescript
// BEFORE (현재 - 7개)
constructor(
  private readonly createNodeUseCase: CreateNodeUseCase,
  private readonly searchNodesUseCase: SearchNodesUseCase,
  private readonly nodeRepository: INodeRepository,
  private readonly nodeAttributeRepository: INodeAttributeRepository,
  private readonly attributeRepository: IAttributeRepository,
  private readonly tableRepository: ITableRepository,
  logger: ILogger
) {
  super()
  this.logger = logger
}

// AFTER (수정 필요 - 8개)
constructor(
  private readonly createNodeUseCase: CreateNodeUseCase,
  private readonly searchNodesUseCase: SearchNodesUseCase,
  private readonly nodeRepository: INodeRepository,
  private readonly tableRepository: ITableRepository,
  private readonly nodeAttributeRepository: INodeAttributeRepository,
  private readonly nodeRelationRepository: INodeRelationRepository,  // ← 추가
  private readonly attributeRepository: IAttributeRepository,
  logger: ILogger
) {
  super()
  this.logger = logger
}
```

---

## GraphQLModule.ts 등록

### 필요한 토큰

```typescript
// src/infrastructure/container/tokens/GraphQLTokens.ts
export const GraphQLTokens = {
  NODE_RESOLVER: Symbol.for('NodeResolver'),  // ✅ 이미 추가됨
  // ...
}
```

### 등록 패턴

```typescript
// src/infrastructure/container/modules/GraphQLModule.ts

container.registerSingleton(
  GraphQLTokens.NODE_RESOLVER,
  async (c) => {
    // Repositories
    const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository;
    const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository;
    const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY);
    const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY);  // 추가
    const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY);

    // Use Cases (lazy loading for circular dependencies)
    const createNodeUseCase = await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE).catch(() => null) as CreateNodeUseCase;
    const searchNodesUseCase = await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE).catch(() => null) as SearchNodesUseCase;

    // Logger
    const logger = {
      info: (msg: string) => console.log(`[NodeResolver] ${msg}`),
      error: (msg: string) => console.error(`[NodeResolver] ${msg}`),
      warn: (msg: string) => console.warn(`[NodeResolver] ${msg}`),
      debug: (msg: string) => console.debug(`[NodeResolver] ${msg}`)
    };

    return new NodeResolver(
      createNodeUseCase,
      searchNodesUseCase,
      nodeRepository,
      tableRepository,
      nodeAttributeRepository,
      nodeRelationRepository,  // 추가
      attributeRepository,
      logger
    );
  },
  [
    RepositoryTokens.NODE_REPOSITORY,
    RepositoryTokens.TABLE_REPOSITORY,
    RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    RepositoryTokens.NODE_RELATION_REPOSITORY,  // 추가
    RepositoryTokens.ATTRIBUTE_REPOSITORY
  ]
);
```

---

## GraphQLSchemaBuilder 매핑

### Node 관련 작업 목록 (총 ~20개)

#### Queries (4개)
1. `node(id: String!): Node`
2. `nodeByContent(content: String!, tableId: ID!): Node`
3. `nodes(tableId: ID, limit: Int, offset: Int): NodesResult!`
4. `searchNodes(tableId: ID!, searchQuery: SearchQueryInput!): SearchNodesResult!`

#### Mutations (8개)
1. `createNode(input: CreateNodeInput!): NodeResult!`
2. `createPersonNode(input: CreatePersonNodeInput!): NodeResult!`
3. `updateNode(input: UpdateNodeInput!): NodeResult!`
4. `deleteNode(id: ID!): DeleteResult!`
5. `setNodeAttribute(input: SetNodeAttributeInput!): NodeAttributeResult!`
6. `setNodeStringAttribute(input: SetNodeStringAttributeInput!): NodeAttributeResult!`
7. `setNodeNumberAttribute(input: SetNodeNumberAttributeInput!): NodeAttributeResult!`
8. `setNodeBooleanAttribute(input: SetNodeBooleanAttributeInput!): NodeAttributeResult!`

#### Field Resolvers (8개)
1. `Node.table: Table`
2. `Node.attributeCount: Int!`
3. `Node.attributes: [NodeAttribute!]!`
4. `Node.relationCount: Int!`
5. `Node.incomingRelations: [Relation!]!`
6. `Node.outgoingRelations: [Relation!]!`
7. `Node.connectedNodes(depth: Int, direction: Direction, relationTypes: [String!]): [Node!]!`
8. `Node.shortestPath(targetNodeId: ID!, maxDepth: Int): [Node!]!`

---

## 순환 참조 처리

### CreateNodeUseCase 순환 참조

**문제**: CreateNodeUseCase가 NodeRepository를 의존하고, NodeRepository가 다시 GraphQL 레이어를 참조할 수 있음

**해결**: Lazy loading 패턴
```typescript
const createNodeUseCase = await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE).catch(() => null);
```

**NodeResolver에서 사용**:
```typescript
async createNode(args: CreateNodeInput): Promise<NodeResult> {
  if (!this.createNodeUseCase) {
    throw new Error('CreateNodeUseCase not available');
  }
  return this.createNodeUseCase.execute(args.input);
}
```

---

## 다음 단계

1. ✅ NodeResolver.ts에 `nodeRelationRepository` 추가
2. ✅ GraphQLModule.ts에 NODE_RESOLVER 등록
3. ✅ GraphQLSchemaBuilder에 Feature Flag 패턴 적용
4. ✅ 테스트 실행 및 검증

---

**문서 소유자**: Claude Code Framework
**분석 날짜**: 2025-11-22
**상태**: ✅ **분석 완료**
**다음 단계**: NodeResolver 수정 및 DI 등록
