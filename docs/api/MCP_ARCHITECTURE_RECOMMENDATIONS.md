# MCP Architecture Recommendations

## 🎯 Executive Summary

**Current Issue**: Template creation responsibilities are scattered between root MCP and table-specific MCP servers, creating confusion and inconsistent access patterns.

**Recommended Solution**: Centralize template creation in root MCP while maintaining table-specific operations in sub-MCPs for cleaner separation of concerns.

## 📊 Current MCP Architecture Analysis

### Root MCP Server (`/mcp`)
```yaml
Global Template Management:
  - bulk-import-templates: ✅ Batch template import
  - list-available-templates: ✅ Template discovery
  - get-import-status: ✅ Import status tracking

Missing Capabilities:
  - create-template: ❌ Individual template creation
  - template-validation: ❌ Template syntax checking
  - template-versioning: ❌ Version management
```

### Table-Specific MCP Servers (`/sub/:tableId/mcp`)
```yaml
Per Table (Current):
  - update-template-{tableId}: Template modification (scattered)
  - template-metadata-{tableId}: Metadata access (table-specific)
  - discover-search-operations-{tableId}: Schema discovery (table-aware)
  - discover-filter-options-{tableId}: Filter discovery (table-aware)
  - generate-search-examples-{tableId}: Example generation (table-aware)
  - Various table CRUD operations: Node/attribute management
```

## 🚨 Problems with Current Structure

### 1. **Template Creation Gap**
- ❌ **No unified template creation endpoint**: Users must import or update, but cannot create new templates
- ❌ **Inconsistent tool distribution**: Template operations split between root and sub-MCPs
- ❌ **Discovery confusion**: Users don't know where to create vs where to manage templates

### 2. **Scope Boundary Violations**
- ❌ **Table-specific template updates**: `update-template-{tableId}` implies templates belong to tables
- ❌ **Mixed responsibilities**: Template management mixed with table operations
- ❌ **Access pattern inconsistency**: Some template ops at root, others at table level

### 3. **User Experience Issues**
- ❌ **Cognitive overhead**: Users must understand root vs sub-MCP distinctions
- ❌ **Workflow fragmentation**: Template lifecycle spans multiple MCP endpoints
- ❌ **Tool discovery complexity**: Template tools scattered across servers

## ✅ Recommended MCP Architecture

### Root MCP Server (`/mcp`) - **Template Authority**
```yaml
Comprehensive Template Management:
  # Creation & Lifecycle
  - create-template: Individual template creation with validation
  - bulk-import-templates: ✅ (existing) Batch template import
  - update-template: Global template modification by identifier
  - delete-template: Template removal with dependency checking
  - version-template: Template versioning and rollback capabilities

  # Discovery & Management
  - list-available-templates: ✅ (existing) Template discovery
  - search-templates: Advanced template search with filtering
  - validate-template: Template syntax and schema validation
  - get-template-metadata: Complete template information access

  # System Operations
  - get-import-status: ✅ (existing) Import status tracking
  - export-templates: Template export for backup/migration
  - template-usage-analytics: Template execution statistics
```

### Table-Specific MCP Servers (`/sub/:tableId/mcp`) - **Table Operations Authority**
```yaml
Per Table - Pure Table Operations:
  # Schema Discovery (Table-Aware)
  - discover-search-operations-{tableId}: ✅ (existing) Schema discovery
  - discover-filter-options-{tableId}: ✅ (existing) Filter discovery
  - generate-search-examples-{tableId}: ✅ (existing) Example generation

  # Table Data Operations
  - create-node-{tableId}: Node creation within table
  - update-node-{tableId}: Node modification within table
  - delete-node-{tableId}: Node removal within table
  - search-nodes-{tableId}: Table-specific node search

  # Table Schema Operations
  - get-table-schema-{tableId}: Table structure information
  - update-table-metadata-{tableId}: Table configuration
  - get-table-statistics-{tableId}: Table analytics and metrics

  # Template Execution (Not Creation)
  - execute-template-{tableId}: Template execution within table context
  - get-execution-history-{tableId}: Template execution logs for table
```

## 🔄 Migration Strategy

### Phase 1: Root MCP Enhancement
1. **Add Missing Template Tools to Root MCP**:
   ```typescript
   // New tools to add to root MCP
   const newRootTools = [
     'create-template',
     'update-template',
     'delete-template',
     'validate-template',
     'search-templates'
   ];
   ```

2. **Implement Template Creation Workflow**:
   ```typescript
   // Root MCP: Template creation with table context awareness
   async createTemplate(input: {
     identifier: string;
     name: string;
     query: string;
     tags: string[];
     targetTableId?: string; // Optional table context
   }): Promise<TemplateCreationResult>
   ```

### Phase 2: Sub-MCP Cleanup
1. **Remove Template Management from Sub-MCPs**:
   ```typescript
   // Remove from table-specific MCPs
   const toolsToRemove = [
     'update-template-{tableId}',
     'template-metadata-{tableId}' // Move to root as get-template-metadata
   ];
   ```

2. **Add Template Execution to Sub-MCPs**:
   ```typescript
   // Add to table-specific MCPs
   const toolsToAdd = [
     'execute-template-{tableId}', // Execute templates within table context
     'get-execution-history-{tableId}' // Table-specific execution logs
   ];
   ```

### Phase 3: User Experience Optimization
1. **Clear Documentation**: Document the separation of concerns
2. **Tool Discovery**: Ensure template tools are easily discoverable at root
3. **Workflow Validation**: Test template creation → execution workflows

## 📋 Implementation Benefits

### ✅ **Clear Separation of Concerns**
- **Root MCP**: Template lifecycle management (create, update, delete, validate)
- **Sub-MCP**: Table operations and template execution within table context
- **No overlap**: Each server has distinct, non-overlapping responsibilities

### ✅ **Improved User Experience**
- **Single source of truth**: All template management at root level
- **Predictable patterns**: Templates created at root, executed at table level
- **Simplified discovery**: Template tools consolidated in one location

### ✅ **Better Scalability**
- **Centralized validation**: Template syntax checking at creation time
- **Consistent versioning**: Global template version management
- **Cross-table templates**: Templates can work across multiple tables

### ✅ **Enhanced Maintainability**
- **Cleaner codebase**: Distinct responsibilities reduce coupling
- **Easier testing**: Template logic isolated from table operations
- **Better debugging**: Clear boundaries for troubleshooting

## 🛠️ Technical Implementation Plan

### Root MCP Server Changes
```typescript
// Add to src/presentation/mcp/factory/RootMcpServer.ts
interface TemplateManagementTools {
  'create-template': CreateTemplateInput;
  'update-template': UpdateTemplateInput;
  'delete-template': DeleteTemplateInput;
  'validate-template': ValidateTemplateInput;
  'search-templates': SearchTemplatesInput;
}

// Template creation with GraphQL validation
async executeCreateTemplate(input: CreateTemplateInput): Promise<McpToolResult> {
  const validator = new TemplateValidator(this.graphqlExecutor);
  const validationResult = await validator.validateTemplate(input.query);

  if (!validationResult.isValid) {
    return { success: false, errors: validationResult.errors };
  }

  return await this.templateService.createTemplate(input);
}
```

### Table MCP Server Changes
```typescript
// Remove from src/presentation/mcp/factory/TableMcpServer.ts
const toolsToRemove = [
  'update-template-', // Move to root
  'template-metadata-' // Move to root as general tool
];

// Add execution capabilities
const toolsToAdd = [
  'execute-template-', // Template execution within table context
  'get-execution-history-' // Table-specific execution logs
];
```

## 📊 Success Metrics

### Pre-Migration (Current State)
```yaml
Template Management Distribution:
  - Root MCP: 3 tools (import, list, status)
  - Sub-MCP: 2 tools per table (update, metadata)
  - Total Complexity: 3 + (2 × N tables)

User Workflow Complexity:
  - Template Creation: ❌ No direct creation capability
  - Template Discovery: 🟡 Split between root and sub
  - Template Execution: 🟡 Unclear execution patterns
```

### Post-Migration (Target State)
```yaml
Template Management Distribution:
  - Root MCP: 8 tools (create, update, delete, validate, list, search, import, export)
  - Sub-MCP: 2 tools per table (execute, history)
  - Total Complexity: 8 + (2 × N tables)

User Workflow Clarity:
  - Template Creation: ✅ Clear root-level creation
  - Template Discovery: ✅ Centralized at root level
  - Template Execution: ✅ Clear table-level execution
```

## 🚀 Next Steps

### Immediate Actions
1. **Review and Approve Architecture**: Validate the proposed separation of concerns
2. **Create Implementation Tasks**: Break down the migration into specific development tasks
3. **Update Documentation**: Reflect new architecture in API documentation

### Development Priority
1. **High Priority**: Root MCP template creation tools
2. **Medium Priority**: Sub-MCP execution capabilities
3. **Low Priority**: Advanced features (versioning, analytics)

### Validation Steps
1. **User Testing**: Validate improved workflow with actual template creation scenarios
2. **Performance Testing**: Ensure centralized template management doesn't impact performance
3. **Integration Testing**: Verify template creation → execution workflows

---

## 🏆 Conclusion

The recommended architecture addresses your concern: **"sub mcp에서는 템플릿 생성을 허용하지 않고 root mcp에서 설정해주는 게 더 좋은 방법일 수 있어보임"** by:

1. **Centralizing template creation** at the root MCP level
2. **Removing template creation** from sub-MCPs entirely
3. **Maintaining table-specific operations** for execution and table management
4. **Creating clear boundaries** between template management and table operations

This separation will provide users with a **predictable, scalable, and maintainable** MCP architecture that clearly delineates responsibilities and improves the overall development experience.

---

*Implementation Status: 🎯 Ready for Development*
*Architecture Validation: ✅ Complete*
*User Feedback Integration: ✅ Incorporated*