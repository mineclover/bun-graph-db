# Task 2.2 Day 2 Analysis - Unified Resolver Migration

**Date**: 2025-11-23
**Status**: Planning Phase
**Scope**: Migrate 6 remaining unified resolvers to DI container

---

## 🔍 Current State Analysis

### Discovery: Unified Resolvers Already Exist!

Unlike NodeResolver which was incomplete (11/16 methods), the remaining resolvers **already exist as complete unified implementations**:

| Resolver | File | Lines | Methods | Status |
|----------|------|-------|---------|---------|
| SystemResolver | resolvers/SystemResolver.ts | 89 | 2 | ✅ **COMPLETE & REGISTERED** |
| TablePackageResolver | resolvers/TablePackageResolver.ts | 484 | 32 | ✅ **COMPLETE & REGISTERED** |
| NodeResolver | resolvers/NodeResolver.ts | 846 | 16 | ✅ **COMPLETE & REGISTERED** (Day 1) |
| DocResolver | resolvers/DocResolver.ts | 441 | 15 | ⚠️ **EXISTS BUT NOT REGISTERED** |
| AttributeResolver | resolvers/AttributeResolver.ts | 513 | 18 | ⚠️ **EXISTS BUT NOT REGISTERED** |
| RelationResolver | resolvers/RelationResolver.ts | 875 | 23 | ⚠️ **EXISTS BUT NOT REGISTERED** |
| TableResolver | resolvers/TableResolver.ts | 410 | 22 | ⚠️ **EXISTS BUT NOT REGISTERED** |
| QueryTemplateResolver | resolvers/QueryTemplateResolver.ts | 513 | 17 | ⚠️ **EXISTS BUT NOT REGISTERED** |

**Total Resolvers**: 8
- **Registered**: 3 (System, TablePackage, Node)
- **Not Registered**: 5 (Doc, Attribute, Relation, Table, QueryTemplate)

---

## 📋 Day 2 Revised Scope

### Original Plan vs Reality

**Original Assumption**:
- All resolvers are incomplete like NodeResolver was
- Need to add missing methods to each resolver

**Reality**:
- ✅ All unified resolvers already exist and are complete
- ❌ They're just not registered in the DI container
- ❌ Schema builder still uses old separate resolvers

### Actual Day 2 Work

Instead of migrating code, we need to:

1. **Create DI Tokens** (5 new tokens)
   - DOC_RESOLVER
   - ATTRIBUTE_RESOLVER
   - RELATION_RESOLVER
   - TABLE_RESOLVER
   - QUERY_TEMPLATE_RESOLVER

2. **Register in GraphQLModule** (5 registrations)
   - Analyze dependencies for each resolver
   - Create DI registrations with proper dependency injection
   - Handle circular dependencies with lazy loading

3. **Update GraphQLSchemaBuilder** (5 feature flag additions)
   - Add optional resolver properties to GraphQLDependencies
   - Resolve new resolvers with .catch(() => null) pattern
   - Keep using old resolvers for now (feature flag pattern)

---

## 🎯 Resolver Dependency Analysis

### DocResolver Dependencies

**File**: `src/presentation/graphql/resolvers/DocResolver.ts`

**Constructor Parameters** (from code analysis):
```typescript
constructor(
  private readonly createDocUseCase: CreateDocUseCase,
  private readonly updateDocUseCase: UpdateDocUseCase,
  private readonly deleteDocUseCase: DeleteDocUseCase,
  private readonly activateDocUseCase: ActivateDocUseCase,
  private readonly docRepository: IDocRepository,
  private readonly tableRepository: ITableRepository,
  logger: ILogger
)
```

**Dependencies** (7 total):
1. CreateDocUseCase - use case (lazy loading recommended)
2. UpdateDocUseCase - use case (lazy loading recommended)
3. DeleteDocUseCase - use case (lazy loading recommended)
4. ActivateDocUseCase - use case (lazy loading recommended)
5. IDocRepository - repository (direct resolve)
6. ITableRepository - repository (direct resolve)
7. ILogger - simple logger (console wrapper)

**Methods** (~15):
- Queries: getDoc, getActiveDoc, getDocs, getDocVersions, searchDocs
- Mutations: createDoc, updateDoc, deleteDoc, activateDoc, createDocVersion
- Field Resolvers: table_field, etc.

---

### AttributeResolver Dependencies

**File**: `src/presentation/graphql/resolvers/AttributeResolver.ts`

**Constructor Parameters** (estimated):
```typescript
constructor(
  private readonly createAttributeTypeUseCase: CreateAttributeTypeUseCase,
  private readonly createAttributeUseCase: CreateAttributeUseCase,
  private readonly attributeRepository: IAttributeRepository,
  private readonly attributeTypeRepository: IAttributeTypeRepository,
  private readonly tableRepository: ITableRepository,
  logger: ILogger
)
```

**Dependencies** (~6 total):
1. CreateAttributeTypeUseCase - use case (lazy loading)
2. CreateAttributeUseCase - use case (lazy loading)
3. IAttributeRepository - repository
4. IAttributeTypeRepository - repository
5. ITableRepository - repository
6. ILogger - simple logger

**Methods** (~18):
- Queries: attribute, attributeByIdentifier, attributes, attributeType, attributeTypes
- Mutations: createAttribute, updateAttribute, deleteAttribute, createAttributeType, updateAttributeType, deleteAttributeType
- Field Resolvers: attributeType_field, table_field, etc.

---

### RelationResolver Dependencies

**File**: `src/presentation/graphql/resolvers/RelationResolver.ts`

**Constructor Parameters** (estimated):
```typescript
constructor(
  private readonly createRelationUseCase: CreateRelationUseCase,
  private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
  private readonly nodeRelationRepository: INodeRelationRepository,
  private readonly relationTypeRepository: IRelationTypeRepository,
  private readonly nodeRepository: INodeRepository,
  private readonly tableRepository: ITableRepository,
  logger: ILogger
)
```

**Dependencies** (~7 total):
1. CreateRelationUseCase - use case (lazy loading)
2. CreateRelationTypeUseCase - use case (lazy loading)
3. INodeRelationRepository - repository
4. IRelationTypeRepository - repository
5. INodeRepository - repository
6. ITableRepository - repository
7. ILogger - simple logger

**Methods** (~23):
- Queries: relationType, relationTypes, nodeRelation, nodeRelations, searchRelatedNodes, getDependencyChain
- Mutations: createRelationType, updateRelationType, deleteRelationType, createRelation, deleteRelation
- Field Resolvers: table_field, sourceNode_field, targetNode_field, relationType_field, name_field, etc.

---

### TableResolver Dependencies

**File**: `src/presentation/graphql/resolvers/TableResolver.ts`

**Constructor Parameters** (from code):
```typescript
constructor(
  private readonly createTableUseCase: CreateTableUseCase,
  private readonly tableRepository: ITableRepository,
  private readonly nodeRepository: INodeRepository,
  private readonly attributeRepository: IAttributeRepository,
  private readonly attributeTypeRepository: IAttributeTypeRepository,
  logger: ILogger
)
```

**Dependencies** (6 total):
1. CreateTableUseCase - use case (lazy loading)
2. ITableRepository - repository (direct resolve)
3. INodeRepository - repository (direct resolve)
4. IAttributeRepository - repository (direct resolve)
5. IAttributeTypeRepository - repository (direct resolve)
6. ILogger - simple logger (console wrapper)

**Methods** (~22):
- Queries: table, tableByIdentifier, tables, searchTables, tableDocumentation
- Mutations: createTable, updateTable, deleteTable
- Field Resolvers: nodeCount, attributeCount, attributes, attributeTypes, tableNodes, aiMetadata, exportNodes, exportPreview

---

### QueryTemplateResolver Dependencies

**File**: `src/presentation/graphql/resolvers/QueryTemplateResolver.ts`

**Constructor Parameters** (estimated):
```typescript
constructor(
  private readonly queryTemplateRepository: IQueryTemplateRepository,
  private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
  logger: ILogger
)
```

**Dependencies** (~3 total):
1. IQueryTemplateRepository - repository (direct resolve)
2. ExecuteQueryTemplateUseCase - use case (lazy loading)
3. ILogger - simple logger

**Methods** (~17):
- Queries: getTemplate, getTemplateByIdentifier, searchTemplates, getPopularTemplates, templatesByTable, executeTemplate
- Mutations: createTemplate, updateTemplate, updateTemplateQuery, deleteTemplate, activateTemplate, deactivateTemplate, executeTemplate, executeTemplateWithGraphQL, exportTemplate, exportTemplates, importTemplate
- Field Resolvers: query, queryName, operationType, variables, inputSchema, defaultVariables, applicableTables, complexityScore, usageCount, lastUsedAt, avgExecutionTimeMs, version, isActive, tags, createdBy, createdAt, updatedAt, isValid, validationErrors

---

## 📊 Migration Complexity Analysis

### Complexity Ranking

| Resolver | Dependencies | Methods | Circular Deps | Complexity | Priority |
|----------|--------------|---------|---------------|------------|----------|
| TableResolver | 6 | 22 | Low | ⭐⭐ Medium | P1 |
| DocResolver | 7 | 15 | Low | ⭐⭐ Medium | P2 |
| AttributeResolver | 6 | 18 | Medium | ⭐⭐⭐ Medium-High | P3 |
| RelationResolver | 7 | 23 | Medium | ⭐⭐⭐ Medium-High | P4 |
| QueryTemplateResolver | 3 | 17 | Low | ⭐ Low | P5 |

**Priority Rationale**:
- **P1 TableResolver**: High usage, foundational, fewer dependencies
- **P2 DocResolver**: Moderate usage, fewer dependencies, straightforward
- **P3 AttributeResolver**: Medium complexity, some circular dependency risk
- **P4 RelationResolver**: Most complex, highest method count, many dependencies
- **P5 QueryTemplateResolver**: Lowest dependencies, specialized use case

---

## 🚀 Execution Strategy

### Step-by-Step Process (Per Resolver)

**Time Estimate**: 30-45 minutes per resolver

1. **Create Token** (5 min)
   - Add token to GraphQLTokens.ts
   - Use Symbol.for() pattern

2. **Analyze Dependencies** (10 min)
   - Read resolver constructor
   - Identify all dependencies
   - Determine lazy loading needs

3. **Register in DI** (15 min)
   - Add container.registerSingleton()
   - Resolve all dependencies
   - Handle circular dependencies
   - Create simple logger

4. **Update Schema Builder** (10 min)
   - Add property to GraphQLDependencies interface
   - Add resolution with .catch(() => null)
   - Document feature flag pattern

5. **Verify** (5 min)
   - TypeScript compilation
   - Server startup test
   - No breaking changes

### Total Time Estimate

- **5 Resolvers** × 40 min average = **~3.5 hours**
- **Testing & Documentation**: +1 hour
- **Total Day 2**: **~4.5 hours**

---

## ✅ Success Criteria

### Per-Resolver Verification

For each resolver migration:
- ✅ Token created in GraphQLTokens.ts
- ✅ Registered in GraphQLModule.ts with all dependencies
- ✅ Added to GraphQLSchemaBuilder with feature flag
- ✅ TypeScript compiles without new errors
- ✅ Server starts without runtime errors
- ✅ Existing tests continue to pass

### Overall Day 2 Success

- ✅ All 5 remaining resolvers registered
- ✅ All integration tests passing (24+)
- ✅ Server startup verified
- ✅ Zero breaking changes
- ✅ Documentation updated
- ✅ Ready for Day 3 (feature flag activation)

---

## 📚 Reference Materials

### Pattern from Day 1 (NodeResolver)

**1. Token Creation** (`GraphQLTokens.ts`):
```typescript
NODE_RESOLVER: Symbol.for('NodeResolver'),
```

**2. DI Registration** (`GraphQLModule.ts`):
```typescript
container.registerSingleton(
  GraphQLTokens.NODE_RESOLVER,
  async (c) => {
    const { NodeResolver } = await import('@/presentation/graphql/resolvers/NodeResolver.js')

    // Lazy loading for use cases
    const createNodeUseCase = await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE).catch(() => null) as any

    // Direct repository resolution
    const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY) as INodeRepository

    // Simple logger
    const simpleLogger = { /* ... */ }

    return new NodeResolver(/* all dependencies */)
  },
  [/* repository tokens only */]
)
```

**3. Schema Builder Update** (`GraphQLSchemaBuilder.ts`):
```typescript
// Interface
export interface GraphQLDependencies {
  nodeResolver?: any // Optional for feature flag
  // ...
}

// Resolution
nodeResolver: await this.container.resolve(GraphQLTokens.NODE_RESOLVER).catch(() => null),
```

---

## 🎯 Day 2 Goals

### Primary Objectives
1. ✅ Register all 5 remaining unified resolvers
2. ✅ Maintain zero breaking changes
3. ✅ All tests passing
4. ✅ Server starts successfully

### Stretch Goals
1. 📝 Performance benchmarking
2. 📝 Memory usage profiling
3. 📝 Detailed method inventory per resolver

---

## 📋 Next Steps After Day 2

### Day 3 Tasks (Feature Flag Activation)

1. **Add Environment Variable**
   - `USE_UNIFIED_RESOLVERS` flag
   - Default: false (safe migration)

2. **Update GraphQLSchemaBuilder**
   - Add conditional logic to use unified vs separate resolvers
   - Test with flag ON and OFF

3. **Remove Old Resolvers**
   - Delete *Queries.ts, *Mutations.ts, *FieldResolvers.ts files
   - Remove old registrations from GraphQLModule
   - Update all imports

4. **Final Validation**
   - Full test suite
   - Performance testing
   - Production readiness check

---

**Status**: Ready to begin Day 2 migration
**First Target**: TableResolver (P1)
