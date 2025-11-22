# Task 2.2 GraphQL Resolver Consolidation - 실행 계획

**계획 날짜**: 2025-11-22
**실행 모드**: Progressive Migration (Option A)
**예상 기간**: 2-3일
**상태**: ✅ **실행 준비 완료**

---

## 📋 Executive Summary

**목표**: GraphQL Resolver 파일을 34개에서 9개로 통합하여 유지보수성 향상

**전략**: NodeResolver 파일럿 → 패턴 검증 → 나머지 7개 Resolver 순차 마이그레이션

**준비 완료 사항**:
- ✅ NODE_RESOLVER 토큰 추가 (GraphQLTokens.ts)
- ✅ 구현 계획 문서화 (457줄)
- ✅ 복잡도 분석 완료
- ✅ 의존성 분석 완료

---

## 🎯 Phase 1: NodeResolver 파일럿 (Day 1)

### 예상 시간: 6-8시간

### Step 1.1: 현재 상태 백업 및 브랜치 확인 (15분)

**작업**:
```bash
# 1. 현재 브랜치 확인
git status
git branch

# 2. 현재 상태 스냅샷
git add -A
git commit -m "checkpoint: Before Task 2.2 NodeResolver migration"

# 3. 테스트 베이스라인 생성
bun test > task-2.2-baseline-tests.txt

# 4. 현재 구조 확인
ls -la src/presentation/graphql/queries/NodeQueries.ts
ls -la src/presentation/graphql/mutations/NodeMutations.ts
ls -la src/presentation/graphql/field-resolvers/NodeFieldResolvers.ts
ls -la src/presentation/graphql/resolvers/NodeResolver.ts  # 이미 존재
```

**검증**:
- ✅ 브랜치: `claude/plan-code-structure-01RYhkJmxpXLUg2hADyZhTQo`
- ✅ 커밋 생성됨
- ✅ 테스트 베이스라인 저장됨
- ✅ NodeResolver.ts 존재 확인 (606줄, 이미 작성됨)

---

### Step 1.2: NodeResolver 분석 및 의존성 파악 (1시간)

**작업**:
```bash
# 1. 기존 NodeResolver 확인
cat src/presentation/graphql/resolvers/NodeResolver.ts | head -100

# 2. 현재 사용 중인 파일들 확인
cat src/presentation/graphql/queries/NodeQueries.ts | head -50
cat src/presentation/graphql/mutations/NodeMutations.ts | head -50
cat src/presentation/graphql/field-resolvers/NodeFieldResolvers.ts | head -50
```

**분석 포인트**:
1. **NodeQueries.ts 의존성** (7개):
   ```typescript
   - INodeRepository
   - SearchNodesUseCase (lazy loading)
   - ILogger
   ```

2. **NodeMutations.ts 의존성** (5개):
   ```typescript
   - CreateNodeUseCase (circular - null placeholder)
   - INodeRepository
   - INodeAttributeRepository
   - ITableRepository
   - IAttributeRepository
   ```

3. **NodeFieldResolvers.ts 의존성** (6개):
   ```typescript
   - INodeRepository
   - ITableRepository
   - INodeAttributeRepository
   - INodeRelationRepository
   - IRelationTypeRepository
   - SearchNodesUseCase
   ```

**총 고유 의존성**: ~18개 (중복 제거 후)

**문서화**:
```bash
# 의존성 목록 작성
cat > claudedocs/task-2.2-node-dependencies.md <<EOF
# NodeResolver 의존성 목록

## Repositories (6개)
1. INodeRepository
2. ITableRepository
3. INodeAttributeRepository
4. INodeRelationRepository
5. IRelationTypeRepository
6. IAttributeRepository

## Use Cases (2개)
1. SearchNodesUseCase (lazy)
2. CreateNodeUseCase (circular - null)

## Services (1개)
1. ILogger

## 총: 9개 고유 의존성
EOF
```

**검증**:
- ✅ 모든 의존성 파악됨
- ✅ Circular dependency 식별됨
- ✅ Lazy loading 패턴 확인됨

---

### Step 1.3: GraphQLModule.ts에 NODE_RESOLVER 등록 (2-3시간)

**현재 상태**:
```typescript
// GraphQLTokens.ts (이미 추가됨)
export const GraphQLTokens = {
  NODE_RESOLVER: Symbol.for('NodeResolver'),  // ✅
  // ...
}
```

**작업**: GraphQLModule.ts 업데이트

**파일 읽기**:
```bash
# GraphQLModule.ts의 현재 NODE 관련 등록 확인
grep -A 30 "NODE_QUERIES" src/infrastructure/container/modules/GraphQLModule.ts
grep -A 30 "NODE_MUTATIONS" src/infrastructure/container/modules/GraphQLModule.ts
grep -A 30 "NODE_FIELD_RESOLVERS" src/infrastructure/container/modules/GraphQLModule.ts
```

**새로운 등록 추가**:
```typescript
// src/infrastructure/container/modules/GraphQLModule.ts

// 기존 등록은 유지 (호환성)
// NODE_QUERIES, NODE_MUTATIONS, NODE_FIELD_RESOLVERS

// 새로운 통합 등록 추가
container.registerSingleton(
  GraphQLTokens.NODE_RESOLVER,
  async (c) => {
    // 1. Repository 의존성
    const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository;
    const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY) as ITableRepository;
    const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY) as INodeAttributeRepository;
    const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY) as INodeRelationRepository;
    const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY) as IRelationTypeRepository;
    const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY) as IAttributeRepository;

    // 2. Use Case 의존성 (lazy loading 패턴)
    const searchNodesUseCaseResolver = async (): Promise<SearchNodesUseCase | null> => {
      try {
        return await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE) as SearchNodesUseCase;
      } catch (error) {
        console.warn('[GraphQLModule] SearchNodesUseCase not available:', error);
        return null;
      }
    };

    // CreateNodeUseCase는 circular dependency로 인해 나중에 처리
    const createNodeUseCaseResolver = async (): Promise<CreateNodeUseCase | null> => {
      try {
        return await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE) as CreateNodeUseCase;
      } catch (error) {
        console.warn('[GraphQLModule] CreateNodeUseCase circular dependency:', error);
        return null;
      }
    };

    // 3. Logger
    const logger = {
      info: (msg: string) => console.log(`[NodeResolver] ${msg}`),
      error: (msg: string) => console.error(`[NodeResolver] ${msg}`),
      warn: (msg: string) => console.warn(`[NodeResolver] ${msg}`),
      debug: (msg: string) => console.debug(`[NodeResolver] ${msg}`)
    };

    // 4. NodeResolver 인스턴스 생성
    return new NodeResolver(
      nodeRepository,
      tableRepository,
      nodeAttributeRepository,
      nodeRelationRepository,
      relationTypeRepository,
      attributeRepository,
      searchNodesUseCaseResolver,
      createNodeUseCaseResolver,
      logger
    );
  },
  [
    RepositoryTokens.NODE_REPOSITORY,
    RepositoryTokens.TABLE_REPOSITORY,
    RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    RepositoryTokens.NODE_RELATION_REPOSITORY,
    RepositoryTokens.RELATION_TYPE_REPOSITORY,
    RepositoryTokens.ATTRIBUTE_REPOSITORY
  ]
);
```

**NodeResolver.ts 생성자 확인/수정**:
```bash
# NodeResolver.ts의 생성자 확인
grep -A 20 "constructor" src/presentation/graphql/resolvers/NodeResolver.ts
```

**만약 생성자가 다르면 수정**:
```typescript
// src/presentation/graphql/resolvers/NodeResolver.ts

export class NodeResolver extends BaseResolver {
  constructor(
    private nodeRepository: INodeRepository,
    private tableRepository: ITableRepository,
    private nodeAttributeRepository: INodeAttributeRepository,
    private nodeRelationRepository: INodeRelationRepository,
    private relationTypeRepository: IRelationTypeRepository,
    private attributeRepository: IAttributeRepository,
    private searchNodesUseCaseResolver: () => Promise<SearchNodesUseCase | null>,
    private createNodeUseCaseResolver: () => Promise<CreateNodeUseCase | null>,
    private logger: ILogger
  ) {
    super();
  }

  // 기존 메서드는 그대로 유지
  // ...
}
```

**검증**:
```bash
# TypeScript 컴파일 확인
bun run typecheck

# 문제가 있으면 수정
```

**커밋**:
```bash
git add src/infrastructure/container/modules/GraphQLModule.ts
git add src/presentation/graphql/resolvers/NodeResolver.ts
git commit -m "feat: Add NODE_RESOLVER DI registration

- Registered NodeResolver with 9 dependencies
- Used lazy loading for circular dependencies
- Maintained compatibility with existing resolvers"
```

---

### Step 1.4: GraphQLSchemaBuilder 업데이트 (1-2시간)

**현재 상태 확인**:
```bash
# GraphQLSchemaBuilder에서 Node 관련 resolver 매핑 확인
grep -n "nodeQueries" src/presentation/graphql/GraphQLSchemaBuilder.ts
grep -n "nodeMutations" src/presentation/graphql/GraphQLSchemaBuilder.ts
grep -n "nodeFieldResolvers" src/presentation/graphql/GraphQLSchemaBuilder.ts
```

**예상 구조**:
```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts

Query: {
  // 현재 (old)
  node: (_: GraphQLParent, args: Record<string, unknown>) =>
    deps.nodeQueries.node(_, args as any),

  // 새로운 (new) - 둘 다 유지 (A/B 테스트)
  node: (_: GraphQLParent, args: Record<string, unknown>) =>
    deps.nodeResolver?.node(_, args as any) ?? deps.nodeQueries.node(_, args as any),
}
```

**작업 전략**: **Feature Flag 패턴**으로 안전하게 전환

**Step 1**: GraphQLDependencies 인터페이스 확장
```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts

export interface GraphQLDependencies {
  // 기존 (유지)
  nodeQueries: NodeQueries;
  nodeMutations: NodeMutations;
  nodeFieldResolvers: NodeFieldResolvers;

  // 새로운 (추가) - optional로 시작
  nodeResolver?: NodeResolver;  // ← 추가

  // ... 나머지 의존성
}
```

**Step 2**: resolveDependencies 메서드 업데이트
```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts

private async resolveDependencies(): Promise<GraphQLDependencies> {
  return {
    // 기존 의존성 (유지)
    nodeQueries: (await this.container.resolve(GraphQLTokens.NODE_QUERIES)) as NodeQueries,
    nodeMutations: (await this.container.resolve(GraphQLTokens.NODE_MUTATIONS)) as NodeMutations,
    nodeFieldResolvers: (await this.container.resolve(GraphQLTokens.NODE_FIELD_RESOLVERS)) as NodeFieldResolvers,

    // 새로운 의존성 (추가) - optional이므로 에러 무시
    nodeResolver: await this.container.resolve(GraphQLTokens.NODE_RESOLVER).catch(() => undefined) as NodeResolver | undefined,

    // ... 나머지
  };
}
```

**Step 3**: Resolver 매핑 업데이트 (Feature Flag)
```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts

private buildResolvers(deps: GraphQLDependencies): any {
  return {
    Query: {
      // Feature flag: nodeResolver가 있으면 사용, 없으면 기존 방식
      node: (_: GraphQLParent, args: Record<string, unknown>) => {
        if (deps.nodeResolver) {
          return deps.nodeResolver.node(_, args as any);
        }
        return deps.nodeQueries.node(_, args as any);
      },

      nodeByContent: (_: GraphQLParent, args: Record<string, unknown>) => {
        if (deps.nodeResolver) {
          return deps.nodeResolver.nodeByContent(_, args as any);
        }
        return deps.nodeQueries.nodeByContent(_, args as any);
      },

      // ... 나머지 Node queries (약 10개)

      // Table, Attribute 등 다른 resolver는 기존 방식 유지
      table: (_: GraphQLParent, args: Record<string, unknown>) =>
        deps.tableQueries.table(_, args as any),
      // ...
    },

    Mutation: {
      // Node mutations도 동일한 패턴
      createNode: (_: GraphQLParent, args: Record<string, unknown>) => {
        if (deps.nodeResolver) {
          return deps.nodeResolver.createNode(_, args as any);
        }
        return deps.nodeMutations.createNode(_, args as any);
      },

      // ... 나머지 Node mutations (약 8개)

      // 다른 mutations는 기존 방식 유지
    },

    // Field resolvers
    Node: {
      table: (parent: any) => {
        if (deps.nodeResolver) {
          return deps.nodeResolver.table_field(parent);
        }
        return deps.nodeFieldResolvers.table_field(parent);
      },

      // ... 나머지 Node field resolvers (약 10개)
    },

    // 나머지 types는 그대로 유지
  };
}
```

**Node 관련 매핑 목록** (총 ~20개):
```typescript
// Queries (4개)
- node
- nodeByContent
- nodes
- searchNodes

// Mutations (8개)
- createNode
- createPersonNode
- updateNode
- deleteNode
- setNodeAttribute
- setNodeStringAttribute
- setNodeNumberAttribute
- setNodeBooleanAttribute

// Field Resolvers (8개)
- Node.table
- Node.attributeCount
- Node.attributes
- Node.relationCount
- Node.incomingRelations
- Node.outgoingRelations
- Node.connectedNodes
- Node.shortestPath
```

**커밋**:
```bash
git add src/presentation/graphql/GraphQLSchemaBuilder.ts
git commit -m "feat: Add NodeResolver feature flag to GraphQLSchemaBuilder

- Added nodeResolver to GraphQLDependencies (optional)
- Updated ~20 Node-related mappings with feature flag
- Maintained backward compatibility with existing resolvers
- Ready for A/B testing"
```

---

### Step 1.5: 통합 테스트 (1-2시간)

**테스트 전략**: 기존 테스트 + GraphQL API 검증

**1. 유닛 테스트**:
```bash
# Node 관련 모든 테스트 실행
bun test tests/unit/ --grep "Node"
bun test tests/integration/ --grep "Node"
```

**2. GraphQL API 테스트**:
```bash
# 서버 시작 (별도 터미널)
bun run dev

# GraphQL 쿼리 테스트 (다른 터미널)
# Query 테스트
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ nodes { nodes { id title } } }"}'

# Mutation 테스트
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createNode(input: { tableId: \"1\", title: \"Test\", content: \"Test\" }) { success node { id } } }"}'

# Field resolver 테스트
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ nodes { nodes { id title table { identifier } attributes { value } } } }"}'
```

**3. 관계 쿼리 테스트**:
```bash
# 특정 테스트 파일 실행
bun test tests/relation-queries-isolated.test.ts
```

**4. 전체 테스트 스위트**:
```bash
# 모든 테스트 실행
bun test

# 결과 저장
bun test > task-2.2-after-node-resolver.txt

# 베이스라인과 비교
diff task-2.2-baseline-tests.txt task-2.2-after-node-resolver.txt
```

**검증 기준**:
- ✅ 모든 유닛 테스트 통과 (51/51)
- ✅ GraphQL API 정상 응답
- ✅ Field resolver 정상 동작
- ✅ 관계 쿼리 정상 동작
- ✅ 베이스라인 대비 차이 없음

**문제 발생 시 롤백**:
```bash
# 1단계 롤백: 마지막 커밋 되돌리기
git reset --hard HEAD~1

# 2단계 롤백: Feature flag 비활성화
# GraphQLSchemaBuilder에서 nodeResolver 사용 제거

# 3단계 롤백: 전체 롤백
git reset --hard [checkpoint-commit-hash]
```

**성공 시 커밋**:
```bash
git add -A
git commit -m "test: Verify NodeResolver integration

All tests passing (51/51):
- Unit tests: ✅
- Integration tests: ✅
- GraphQL API: ✅
- Relation queries: ✅

NodeResolver pilot complete."
```

---

### Step 1.6: 기존 코드 정리 (선택사항 - 30분)

**파일럿 완료 후 결정**:

**Option 1**: 기존 코드 유지 (안전)
- NodeQueries, NodeMutations, NodeFieldResolvers 유지
- Feature flag로 병렬 운영
- 나머지 Resolver 완료 후 한 번에 정리

**Option 2**: 기존 코드 삭제 (적극적)
- NodeQueries.ts, NodeMutations.ts, NodeFieldResolvers.ts 삭제
- GraphQLSchemaBuilder에서 feature flag 제거
- 즉시 단순화

**권장**: **Option 1** (안전한 접근)

---

## 🚀 Phase 2: 나머지 7개 Resolver 마이그레이션 (Day 2-3)

### 예상 시간: 10-12시간

### 마이그레이션 순서

**Day 2 (4-5시간)**:
1. ✅ SystemResolver (가장 단순 - 1시간)
2. ✅ DocResolver (단순 - 1.5시간)
3. ✅ AttributeResolver (중간 - 1.5-2시간)

**Day 3 (6-7시간)**:
4. ✅ RelationResolver (복잡 - 2-2.5시간)
5. ✅ TableResolver (복잡 - 2-2.5시간)
6. ✅ QueryTemplateResolver (복잡 - 1.5-2시간)
7. ✅ TablePackageResolver (특수 - 1.5시간)

### 각 Resolver별 체크리스트

**템플릿** (각 Resolver마다 반복):

```bash
# 1. 기존 파일 분석 (15분)
ls -la src/presentation/graphql/queries/[Entity]Queries.ts
ls -la src/presentation/graphql/mutations/[Entity]Mutations.ts
ls -la src/presentation/graphql/field-resolvers/[Entity]FieldResolvers.ts
ls -la src/presentation/graphql/resolvers/[Entity]Resolver.ts

# 2. 의존성 파악 (15분)
grep "constructor" src/presentation/graphql/queries/[Entity]Queries.ts
# ... 의존성 목록 작성

# 3. GraphQLModule.ts 등록 (30-45분)
# [ENTITY]_RESOLVER 등록 추가

# 4. GraphQLSchemaBuilder 업데이트 (30-60분)
# [Entity] 관련 매핑 업데이트

# 5. 테스트 (30분)
bun test tests/ --grep "[Entity]"
curl -X POST http://localhost:4141/graphql -d '...'

# 6. 커밋 (5분)
git commit -m "feat: Add [Entity]Resolver integration"
```

### Resolver별 복잡도 추정

| Resolver | Queries | Mutations | Field Resolvers | 의존성 수 | 예상 시간 |
|----------|---------|-----------|-----------------|-----------|-----------|
| SystemResolver | 2 | 0 | 0 | 1 | 1시간 |
| DocResolver | 3 | 3 | 2 | 3 | 1.5시간 |
| AttributeResolver | 2 | 4 | 3 | 4 | 1.5-2시간 |
| RelationResolver | 3 | 5 | 4 | 6 | 2-2.5시간 |
| TableResolver | 4 | 5 | 5 | 6 | 2-2.5시간 |
| QueryTemplateResolver | 3 | 4 | 3 | 5 | 1.5-2시간 |
| TablePackageResolver | 2 | 3 | 2 | 4 | 1.5시간 |

---

## 🧹 Phase 3: 정리 및 최적화 (Day 3 후반)

### 예상 시간: 2-3시간

### Step 3.1: Feature Flag 제거 (1시간)

**모든 Resolver 완료 후**:

```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts

// BEFORE (feature flag):
node: (_: GraphQLParent, args: Record<string, unknown>) => {
  if (deps.nodeResolver) {
    return deps.nodeResolver.node(_, args as any);
  }
  return deps.nodeQueries.node(_, args as any);
},

// AFTER (direct):
node: (_: GraphQLParent, args: Record<string, unknown>) =>
  deps.nodeResolver.node(_, args as any),
```

**GraphQLDependencies 인터페이스 정리**:
```typescript
export interface GraphQLDependencies {
  // 기존 제거
  // nodeQueries: NodeQueries;  // ← 삭제
  // nodeMutations: NodeMutations;  // ← 삭제

  // 새로운 유지
  nodeResolver: NodeResolver;  // ← optional 제거
  tableResolver: TableResolver;
  attributeResolver: AttributeResolver;
  // ... 나머지 8개 resolver

  schemaResolvers: ReturnType<typeof createSchemaResolvers>;
}
```

---

### Step 3.2: 기존 파일 삭제 (30분)

```bash
# queries/ 디렉토리
rm src/presentation/graphql/queries/NodeQueries.ts
rm src/presentation/graphql/queries/TableQueries.ts
rm src/presentation/graphql/queries/AttributeQueries.ts
rm src/presentation/graphql/queries/RelationQueries.ts
rm src/presentation/graphql/queries/DocQueries.ts
rm src/presentation/graphql/queries/QueryTemplateQueries.ts
rm src/presentation/graphql/queries/SystemQueries.ts
rm src/presentation/graphql/queries/TablePackageQueries.ts

# mutations/ 디렉토리
rm src/presentation/graphql/mutations/NodeMutations.ts
rm src/presentation/graphql/mutations/TableMutations.ts
# ... 나머지 mutation 파일들

# field-resolvers/ 디렉토리
rm src/presentation/graphql/field-resolvers/NodeFieldResolvers.ts
rm src/presentation/graphql/field-resolvers/TableFieldResolvers.ts
# ... 나머지 field resolver 파일들

# 빈 디렉토리 삭제
rmdir src/presentation/graphql/queries
rmdir src/presentation/graphql/mutations
rmdir src/presentation/graphql/field-resolvers
```

---

### Step 3.3: GraphQLModule.ts 정리 (30분)

**기존 등록 제거**:
```typescript
// src/infrastructure/container/modules/GraphQLModule.ts

// 삭제할 등록들:
// - NODE_QUERIES
// - NODE_MUTATIONS
// - NODE_FIELD_RESOLVERS
// - TABLE_QUERIES
// - TABLE_MUTATIONS
// - TABLE_FIELD_RESOLVERS
// ... (22개 등록 제거)

// 유지할 등록들:
// - NODE_RESOLVER
// - TABLE_RESOLVER
// - ATTRIBUTE_RESOLVER
// ... (9개 통합 resolver)
```

---

### Step 3.4: 최종 테스트 (1시간)

```bash
# 1. TypeScript 컴파일
bun run typecheck

# 2. 전체 테스트 스위트
bun test

# 3. GraphQL API 검증
bun run dev
# (별도 터미널에서 GraphQL Playground 테스트)

# 4. 관계 쿼리 테스트
bun test tests/relation-queries-isolated.test.ts

# 5. 통합 테스트
bun test tests/integration/

# 6. 테스트 결과 비교
bun test > task-2.2-final.txt
diff task-2.2-baseline-tests.txt task-2.2-final.txt
```

**검증 기준**:
- ✅ 51/51 테스트 통과
- ✅ TypeScript 에러 없음
- ✅ GraphQL API 정상
- ✅ 모든 쿼리/뮤테이션/필드 resolver 동작

---

## 📊 진행 상황 추적

### 일일 체크리스트

**Day 1: NodeResolver 파일럿**
- [ ] 백업 및 브랜치 확인
- [ ] NodeResolver 분석 완료
- [ ] GraphQLModule.ts NODE_RESOLVER 등록
- [ ] GraphQLSchemaBuilder 업데이트
- [ ] 통합 테스트 통과
- [ ] 커밋 및 푸시

**Day 2: Resolver 마이그레이션 (3개)**
- [ ] SystemResolver 완료
- [ ] DocResolver 완료
- [ ] AttributeResolver 완료
- [ ] 각 단계별 테스트 통과
- [ ] 커밋 및 푸시

**Day 3: 나머지 Resolver + 정리**
- [ ] RelationResolver 완료
- [ ] TableResolver 완료
- [ ] QueryTemplateResolver 완료
- [ ] TablePackageResolver 완료
- [ ] Feature flag 제거
- [ ] 기존 파일 삭제
- [ ] GraphQLModule.ts 정리
- [ ] 최종 테스트 통과
- [ ] 문서 업데이트
- [ ] 최종 커밋 및 푸시

---

## 🚨 리스크 관리

### 롤백 포인트

**Checkpoint 1**: NodeResolver 파일럿 완료 후
```bash
git tag task-2.2-checkpoint-1-node-resolver
```

**Checkpoint 2**: Day 2 완료 후 (4개 Resolver)
```bash
git tag task-2.2-checkpoint-2-half-complete
```

**Checkpoint 3**: 모든 Resolver 완료 (정리 전)
```bash
git tag task-2.2-checkpoint-3-all-resolvers
```

### 롤백 시나리오

**시나리오 1**: NodeResolver 파일럿 실패
```bash
git reset --hard task-2.2-checkpoint-before
# 분석 재검토 필요
```

**시나리오 2**: 중간 Resolver 실패
```bash
git reset --hard task-2.2-checkpoint-1-node-resolver
# 해당 Resolver만 재작업
```

**시나리오 3**: 최종 테스트 실패
```bash
git reset --hard task-2.2-checkpoint-3-all-resolvers
# 정리 단계 재검토
```

---

## 📈 성공 기준

### 필수 기준 (Must Have)
- ✅ 51/51 테스트 통과
- ✅ TypeScript 컴파일 성공
- ✅ GraphQL API 정상 동작
- ✅ Zero 리그레션

### 목표 기준 (Should Have)
- ✅ 34 파일 → 9 파일 (75% 감소)
- ✅ GraphQLModule.ts 단순화 (22 등록 → 9 등록)
- ✅ 코드 탐색 시간 75% 감소

### 추가 기준 (Nice to Have)
- ✅ 순환 참조 문제 해결
- ✅ Lazy loading 패턴 정립
- ✅ 문서 완전성

---

## 📝 문서 업데이트

### 완료 후 업데이트할 문서

1. **phase2-detailed-plan.md**
   - Task 2.2 상태: ANALYZED & DEFERRED → COMPLETE
   - 실제 소요 시간 기록

2. **phase2-completion-summary.md**
   - Task 2.2 결과 추가
   - Phase 2 완료율: 66.7% → 100%

3. **ARCHITECTURE_OVERVIEW.md**
   - GraphQL Resolver 구조 업데이트
   - 새로운 패턴 문서화

4. **task-2.2-completion-report.md** (새로 생성)
   - 실행 결과 요약
   - 학습 사항
   - 향후 권장사항

---

## ✅ 최종 체크리스트

**기술적 완료**:
- [ ] 9개 통합 Resolver 생성
- [ ] GraphQLModule.ts 업데이트
- [ ] GraphQLSchemaBuilder 단순화
- [ ] 34개 기존 파일 삭제
- [ ] 3개 빈 디렉토리 제거
- [ ] 모든 테스트 통과

**품질 보증**:
- [ ] Zero 리그레션 확인
- [ ] TypeScript 엄격 모드 통과
- [ ] GraphQL Playground 검증
- [ ] 관계 쿼리 검증

**문서화**:
- [ ] 실행 결과 문서화
- [ ] 학습 사항 기록
- [ ] 아키텍처 문서 업데이트
- [ ] Phase 2 완료 선언

**배포 준비**:
- [ ] 모든 변경사항 커밋
- [ ] 원격 저장소 푸시
- [ ] PR 준비 (선택사항)
- [ ] 팀 리뷰 요청 (선택사항)

---

## 🎯 다음 단계 (Task 2.2 완료 후)

### Phase 3 진행

**즉시 이점**:
- ✅ Task 3.2 작업량 70% 감소
- ✅ Task 3.3 작업량 70% 감소
- ✅ 깨끗한 GraphQL 레이어에서 Phase 3 시작

**Phase 3 Tasks**:
1. Task 3.1: CLI 모듈 확장 (2-3일)
2. Task 3.2: Use Case 이름 변경 (0.5-1일) ← 70% 감소!
3. Task 3.3: 유틸리티 통합 (1-2일) ← 70% 감소!

---

**계획 소유자**: Claude Code Framework
**계획 날짜**: 2025-11-22
**상태**: ✅ **실행 준비 완료**
**다음 단계**: NodeResolver 파일럿 시작
