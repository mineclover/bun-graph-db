# Task 2.2 Day 3 Execution Plan - Unified Resolver Activation

**Date**: 2025-11-23
**Task**: Activate Unified Resolvers in GraphQLSchemaBuilder
**Status**: 📋 Planning Phase
**Estimated Duration**: ~2-3 hours

---

## 🎯 Objectives

### Primary Goal
✅ Modify GraphQLSchemaBuilder to use unified resolvers instead of separate resolvers
✅ Implement feature flag pattern: unified first, fallback to old
✅ Maintain 100% backward compatibility
✅ Zero breaking changes to API

### Success Criteria
- All resolver calls use pattern: `deps.unifiedResolver?.method() || deps.oldResolver.method()`
- Server starts successfully with unified resolvers active
- All integration tests pass
- GraphQL API functionality unchanged
- TypeScript compilation succeeds

---

## 📊 Current State Analysis

### Resolver Mapping Structure

**File**: `src/presentation/graphql/GraphQLSchemaBuilder.ts`
**Method**: `buildSchema()` (lines 163-547)

#### Query Resolvers (Lines 178-289)
```typescript
Query: {
  // Table queries (5 queries)
  table: deps.tableQueries.table()
  tableByIdentifier: deps.tableQueries.tableByIdentifier()
  tables: deps.tableQueries.tables()
  searchTables: deps.tableQueries.searchTables()
  tableDocumentation: deps.tableQueries.tableDocumentation()

  // Attribute queries (6 queries)
  attributeType: deps.attributeQueries.attributeType()
  attributeTypeByIdentifier: deps.attributeQueries.attributeTypeByIdentifier()
  attributeTypes: deps.attributeQueries.attributeTypes()
  attribute: deps.attributeQueries.attribute()
  attributeByIdentifier: deps.attributeQueries.attributeByIdentifier()
  attributes: deps.attributeQueries.attributes()

  // Node queries (4 queries)
  node: deps.nodeQueries.node()
  nodeByContent: deps.nodeQueries.nodeByContent()
  nodes: deps.nodeQueries.nodes()
  searchNodes: deps.nodeQueries.searchNodes()

  // Relation queries (6 queries)
  relationType: deps.relationQueries.relationType()
  relationTypes: deps.relationQueries.relationTypes()
  nodeRelation: deps.relationQueries.nodeRelation()
  nodeRelations: deps.relationQueries.nodeRelations()
  searchRelatedNodes: deps.relationQueries.searchRelatedNodes()
  getDependencyChain: deps.relationQueries.getDependencyChain()

  // Template queries (6 queries)
  getTemplate: deps.templateQueries.getTemplate()
  getTemplateByIdentifier: deps.templateQueries.getTemplateByIdentifier()
  searchTemplates: deps.templateQueries.searchTemplates()
  getPopularTemplates: deps.templateQueries.getPopularTemplates()
  templatesByTable: deps.templateQueries.templatesByTable()
  executeTemplate: deps.templateMutations.executeTemplate()

  // Doc queries (5 queries)
  getDoc: deps.docQueries.getDoc()
  getActiveDoc: deps.docQueries.getActiveDoc()
  getDocs: deps.docQueries.getDocs()
  getDocVersions: deps.docQueries.getDocVersions()
  searchDocs: deps.docQueries.searchDocs()
}
```

#### Mutation Resolvers (Lines 291-421)
```typescript
Mutation: {
  // Table mutations (3 mutations)
  createTable: deps.tableMutations.createTable()
  updateTable: deps.tableMutations.updateTable()
  deleteTable: deps.tableMutations.deleteTable()

  // Attribute mutations (6 mutations)
  createAttributeType: deps.attributeMutations.createAttributeType()
  updateAttributeType: deps.attributeMutations.updateAttributeType()
  deleteAttributeType: deps.attributeMutations.deleteAttributeType()
  createAttribute: deps.attributeMutations.createAttribute()
  updateAttribute: deps.attributeMutations.updateAttribute()
  deleteAttribute: deps.attributeMutations.deleteAttribute()

  // Node mutations (9 mutations)
  createNode: deps.nodeMutations.createNode()
  updateNode: deps.nodeMutations.updateNode()
  deleteNode: deps.nodeMutations.deleteNode()
  setNodeAttribute: deps.nodeMutations.setNodeAttribute()
  removeNodeAttribute: deps.nodeMutations.removeNodeAttribute()
  updateNodeAttributeValue: deps.nodeMutations.updateNodeAttributeValue()
  createNodeWithAttributes: deps.nodeMutations.createNodeWithAttributes()
  createPersonNode: deps.nodeMutations.createPersonNode()
  setNodeAttributes: deps.nodeMutations.setNodeAttributes()
  setNodeAttributesByIdentifier: deps.nodeMutations.setNodeAttributesByIdentifier()

  // Relation mutations (5 mutations)
  createRelationType: deps.relationMutations.createRelationType()
  updateRelationType: deps.relationMutations.updateRelationType()
  deleteRelationType: deps.relationMutations.deleteRelationType()
  createRelation: deps.relationMutations.createRelation()
  deleteRelation: deps.relationMutations.deleteRelation()

  // Template mutations (11 mutations)
  createTemplate: deps.templateMutations.createTemplate()
  updateTemplate: deps.templateMutations.updateTemplate()
  updateTemplateQuery: deps.templateMutations.updateTemplateQuery()
  deleteTemplate: deps.templateMutations.deleteTemplate()
  activateTemplate: deps.templateMutations.activateTemplate()
  deactivateTemplate: deps.templateMutations.deactivateTemplate()
  executeTemplate: deps.templateMutations.executeTemplate()
  executeTemplateWithGraphQL: deps.templateMutations.executeTemplateWithGraphQL()
  exportTemplate: deps.templateMutations.exportTemplate()
  exportTemplates: deps.templateMutations.exportTemplates()
  importTemplate: deps.templateMutations.importTemplate()

  // Doc mutations (5 mutations)
  createDoc: deps.docMutations.createDoc()
  updateDoc: deps.docMutations.updateDoc()
  deleteDoc: deps.docMutations.deleteDoc()
  activateDoc: deps.docMutations.activateDoc()
  createDocVersion: deps.docMutations.createDocVersion()
}
```

#### Field Resolvers (Lines 427-537)
```typescript
// Table field resolvers (6 fields)
Table: {
  attributes: deps.tableFieldResolvers.attributes()
  attributeTypes: deps.tableFieldResolvers.attributeTypes()
  tableNodes: deps.tableFieldResolvers.tableNodes()
  tableNodeCount: deps.tableFieldResolvers.tableNodeCount()
  attributeCount: deps.tableFieldResolvers.attributeCount()
  aiMetadata: deps.tableFieldResolvers.aiMetadata()
}

// Attribute field resolvers (2 fields)
Attribute: {
  attributeType: deps.attributeFieldResolvers.attributeType()
  table: deps.attributeFieldResolvers.table()
}

// Node field resolvers (9 fields)
TableNode: {
  table: deps.nodeFieldResolvers.table()
  attributes: deps.nodeFieldResolvers.attributes()
  attributeCount: deps.nodeFieldResolvers.attributeCount()
  outgoingRelations: deps.nodeFieldResolvers.outgoingRelations()
  incomingRelations: deps.nodeFieldResolvers.incomingRelations()
  relationCount: deps.nodeFieldResolvers.relationCount()
  connectedNodes: deps.nodeFieldResolvers.connectedNodes()
  shortestPath: deps.nodeFieldResolvers.shortestPath()
  neighborsByRelationType: deps.nodeFieldResolvers.neighborsByRelationType()
}

// NodeAttribute field resolvers (2 fields)
NodeAttribute: {
  attribute: deps.attributeFieldResolvers.nodeAttribute_attribute_field()
  formattedValue: deps.attributeFieldResolvers.nodeAttribute_formattedValue_field()
}

// Relation field resolvers (4 fields)
NodeRelation: {
  table: deps.relationFieldResolvers.table()
  sourceNode: deps.relationFieldResolvers.sourceNode()
  targetNode: deps.relationFieldResolvers.targetNode()
  relationType: deps.relationFieldResolvers.relationType()
}

// RelationType field resolvers (1 field)
RelationType: {
  name: deps.relationTypeFieldResolvers.name()
}

// QueryTemplate field resolvers (17 fields)
QueryTemplate: {
  query: deps.queryTemplateFieldResolvers.query()
  queryName: deps.queryTemplateFieldResolvers.queryName()
  operationType: deps.queryTemplateFieldResolvers.operationType()
  variables: deps.queryTemplateFieldResolvers.variables()
  inputSchema: deps.queryTemplateFieldResolvers.inputSchema()
  defaultVariables: deps.queryTemplateFieldResolvers.defaultVariables()
  applicableTables: deps.queryTemplateFieldResolvers.applicableTables()
  complexityScore: deps.queryTemplateFieldResolvers.complexityScore()
  usageCount: deps.queryTemplateFieldResolvers.usageCount()
  lastUsedAt: deps.queryTemplateFieldResolvers.lastUsedAt()
  avgExecutionTimeMs: deps.queryTemplateFieldResolvers.avgExecutionTimeMs()
  version: deps.queryTemplateFieldResolvers.version()
  isActive: deps.queryTemplateFieldResolvers.isActive()
  tags: deps.queryTemplateFieldResolvers.tags()
  createdBy: deps.queryTemplateFieldResolvers.createdBy()
  createdAt: deps.queryTemplateFieldResolvers.createdAt()
  updatedAt: deps.queryTemplateFieldResolvers.updatedAt()
  isValid: deps.queryTemplateFieldResolvers.isValid()
  validationErrors: deps.queryTemplateFieldResolvers.validationErrors()
}

// Doc field resolvers (1 field)
Doc: {
  table: deps.docFieldResolvers.table()
}
```

### Statistics Summary

| Entity | Queries | Mutations | Field Resolvers | Total Methods |
|--------|---------|-----------|-----------------|---------------|
| Table | 5 | 3 | 6 | 14 |
| Attribute | 6 | 6 | 4 | 16 |
| Node | 4 | 9 | 9 | 22 |
| Relation | 6 | 5 | 5 | 16 |
| QueryTemplate | 6 | 11 | 17 | 34 |
| Doc | 5 | 5 | 1 | 11 |
| **Total** | **32** | **39** | **42** | **113** |

---

## 🚀 Execution Strategy

### Phase 1: Table Resolver Activation (~30 minutes)
**Lines to Modify**: ~14 resolver mappings

**Pattern**:
```typescript
// OLD:
table: (_: GraphQLParent, args: Record<string, unknown>) =>
  deps.tableQueries.table(_, args as any)

// NEW:
table: (_: GraphQLParent, args: Record<string, unknown>) =>
  deps.tableResolver?.table(_, args as any) || deps.tableQueries.table(_, args as any)
```

**Scope**:
- 5 Query resolvers (lines 181-190)
- 3 Mutation resolvers (lines 295-300)
- 6 Field resolvers (lines 429-443)

### Phase 2: Node Resolver Activation (~30 minutes)
**Lines to Modify**: ~22 resolver mappings

**Scope**:
- 4 Query resolvers (lines 208-215)
- 9 Mutation resolvers (lines 319-338)
- 9 Field resolvers (lines 452-470)

### Phase 3: Attribute Resolver Activation (~25 minutes)
**Lines to Modify**: ~16 resolver mappings

**Scope**:
- 6 Query resolvers (lines 193-205)
- 6 Mutation resolvers (lines 303-316)
- 4 Field resolvers (lines 446-476)

### Phase 4: Relation Resolver Activation (~25 minutes)
**Lines to Modify**: ~16 resolver mappings

**Scope**:
- 6 Query resolvers (lines 218-228)
- 5 Mutation resolvers (lines 341-350)
- 5 Field resolvers (lines 479-490)

### Phase 5: QueryTemplate Resolver Activation (~40 minutes)
**Lines to Modify**: ~34 resolver mappings (most complex)

**Scope**:
- 6 Query resolvers (lines 231-248)
- 11 Mutation resolvers (lines 353-386)
- 17 Field resolvers (lines 493-531)

### Phase 6: Doc Resolver Activation (~20 minutes)
**Lines to Modify**: ~11 resolver mappings

**Scope**:
- 5 Query resolvers (lines 251-260)
- 5 Mutation resolvers (lines 389-398)
- 1 Field resolver (line 535-536)

---

## ✅ Validation Steps

### After Each Phase
1. **TypeScript Compilation**: `bun run typecheck`
2. **Syntax Validation**: Quick check for syntax errors
3. **Git Commit**: Incremental commit for safety

### Final Validation (After All Phases)
1. **Full TypeScript Check**: `bun run typecheck`
2. **Server Startup**: Start server and verify it runs
3. **Health Check**: Test GraphQL health endpoint
4. **Integration Tests**: Run full integration test suite
5. **API Smoke Tests**: Test representative queries/mutations

---

## 🎯 Implementation Pattern

### Template for Each Resolver

**Query Pattern**:
```typescript
methodName: (_: GraphQLParent, args: Record<string, unknown>) =>
  deps.unifiedResolver?.methodName(_, args as any) || deps.oldQueries.methodName(_, args as any)
```

**Mutation Pattern**:
```typescript
methodName: (_: GraphQLParent, args: Record<string, unknown>) =>
  deps.unifiedResolver?.methodName(_, args as any) || deps.oldMutations.methodName(_, args as any)
```

**Field Resolver Pattern**:
```typescript
fieldName: (parent: GraphQLParent) =>
  deps.unifiedResolver?.fieldName(parent as any) || deps.oldFieldResolvers.fieldName(parent as any)
```

**With Context Pattern**:
```typescript
methodName: (_: GraphQLParent, args: Record<string, unknown>, context: GraphQLContext) =>
  deps.unifiedResolver?.methodName(_, args as any, context) || deps.oldResolver.methodName(_, args as any, context)
```

---

## 📝 Expected Outcomes

### Code Changes
- **File Modified**: `src/presentation/graphql/GraphQLSchemaBuilder.ts`
- **Lines Modified**: ~113 resolver mappings
- **Pattern**: All use `unifiedResolver?.method() || oldResolver.method()`

### Behavior Changes
- **External API**: No changes (100% backward compatible)
- **Internal Routing**: Unified resolvers used when available
- **Fallback Safety**: Old resolvers still available if unified resolver fails

### Quality Metrics
- ✅ TypeScript compilation succeeds
- ✅ Server starts without errors
- ✅ Health check passes
- ✅ Integration tests pass (target: 24+ tests)
- ✅ Zero breaking changes

---

## ⚠️ Risk Mitigation

### Potential Issues
1. **Method Name Mismatches**: Unified resolver methods might have different names
2. **Signature Differences**: Parameters might differ between old and new resolvers
3. **Context Handling**: Some methods use context parameter, others don't
4. **Type Assertions**: May need `as any` for some complex types

### Mitigation Strategies
1. **Incremental Approach**: One entity at a time with commits
2. **Pattern Validation**: Test first resolver thoroughly before batch changes
3. **Fallback Safety**: Old resolvers always available as fallback
4. **Continuous Testing**: TypeScript check after each phase

---

## 📊 Time Estimates

| Phase | Entity | Resolver Count | Estimated Time |
|-------|--------|----------------|----------------|
| 1 | Table | 14 | ~30 min |
| 2 | Node | 22 | ~30 min |
| 3 | Attribute | 16 | ~25 min |
| 4 | Relation | 16 | ~25 min |
| 5 | QueryTemplate | 34 | ~40 min |
| 6 | Doc | 11 | ~20 min |
| **Total** | **All** | **113** | **~2.5 hours** |

**Additional Time**:
- Testing & Validation: +30 minutes
- Documentation: +20 minutes
- **Grand Total**: **~3 hours**

---

## 🎉 Success Definition

**Day 3 Complete When**:
✅ All 113 resolver mappings use unified resolver pattern
✅ TypeScript compilation succeeds with no new errors
✅ Server starts successfully
✅ GraphQL health check passes
✅ Integration tests pass (24+ tests)
✅ Day 3 completion document created
✅ Changes committed and pushed

---

**Next Steps After Day 3**:
- Day 4 (Optional): Performance testing and benchmarking
- Day 5 (Optional): Remove old resolver files and cleanup
- Final: Mark Task 2.2 as complete

---

**Document Owner**: Claude Code Framework
**Created**: 2025-11-23
**Status**: Ready for execution
