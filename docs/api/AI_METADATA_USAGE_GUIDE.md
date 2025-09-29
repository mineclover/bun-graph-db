# AI Metadata Usage Guide

**Best Practices for Template Creation with AI Metadata**

## 🎯 Quick Reference

### When to Use AI Metadata
✅ **Good for**: Conceptual guidance, pattern identification, initial planning
❌ **Not for**: Direct template generation, production-ready queries

### Template Creation Workflow
```
AI Metadata → Concept → Schema Validation → Manual Correction → Testing → Production
```

## 📋 Step-by-Step Guide

### 1. Analyze AI Metadata
```bash
curl -X POST http://localhost:4141/sub/{tableId}/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get-table-metadata-{tableId}", "arguments": {}}}'
```

**Extract useful information:**
- Query complexity assessment
- Common usage patterns
- Conceptual guidance

### 2. Understand Real Schema
```bash
# Check actual GraphQL schema
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query IntrospectionQuery { __schema { queryType { fields { name args { name type { name } } } } } }"}'
```

### 3. Find Working Template Examples
```bash
# Look for existing working templates
find /path/to/exported-templates -name "*.json" | head -5
grep -l "searchNodes" /path/to/exported-templates/*.json
```

### 4. Create Schema-Compliant Template
Use working template structure, not AI suggestions:

**❌ AI Metadata Suggestion:**
```graphql
searchNodes(tableId: $tableId, searchQuery: { conditions: [...] })
```

**✅ Actual Working Structure:**
```graphql
searchNodes(filter: $filter, pagination: $pagination, sort: $sort)
```

### 5. Test Template
```bash
# Import template
curl -X POST http://localhost:4141/sub/{tableId}/mcp \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "bulk-import-templates", "arguments": {"filePaths": ["/path/to/template.json"]}}}'

# Test execution
curl -X POST http://localhost:4141/graphql \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"your-template\", variables: {...}) { success data errors } }"}'
```

## ⚠️ Common Pitfalls

### Schema Mismatch Issues
- **Problem**: AI metadata uses outdated parameter structures
- **Solution**: Always validate against current GraphQL schema
- **Example**: `searchQuery` parameter doesn't exist in actual schema

### Parameter Structure Errors
- **Problem**: AI suggests complex nested structures that don't work
- **Solution**: Use simple, schema-compliant parameter structures
- **Check**: Verify all parameters exist in GraphQL introspection

### Type Incompatibility
- **Problem**: AI suggests wrong GraphQL types
- **Solution**: Check actual type definitions in schema
- **Validate**: Use GraphQL Playground for real-time validation

## 🔧 Template Validation Checklist

### Before Using AI-Generated Templates
- [ ] Compare AI parameters with actual GraphQL schema
- [ ] Check parameter naming matches schema exactly
- [ ] Verify all required parameters are included
- [ ] Test with minimal example data first
- [ ] Validate GraphQL syntax in Playground

### Schema Compatibility Check
```typescript
// Quick validation script
const aiSuggestion = "searchNodes(tableId: $tableId, searchQuery: {...})";
const actualSchema = "searchNodes(filter: $filter, pagination: $pagination, sort: $sort)";

// ❌ These don't match - manual correction needed
```

## 📊 AI Metadata Reliability Matrix

| Component | Reliability | Use Case | Validation Required |
|-----------|-------------|----------|-------------------|
| **Complexity Assessment** | 🟢 High | Planning, resource estimation | ❌ No |
| **Query Patterns** | 🟡 Medium | Conceptual understanding | ⚠️ Yes |
| **Parameter Structure** | 🔴 Low | Direct implementation | ✅ Critical |
| **Examples** | 🔴 Low | Copy-paste usage | ✅ Critical |

## 🚀 Recommended Workflow

### For New Templates

1. **Inspiration Phase** (Use AI Metadata)
   - Review AI suggested patterns
   - Understand query complexity
   - Identify relevant use cases

2. **Research Phase** (Use Real Schema)
   - Introspect actual GraphQL schema
   - Find working template examples
   - Understand parameter requirements

3. **Creation Phase** (Manual Implementation)
   - Start with working template structure
   - Adapt for specific use case
   - Use AI concepts as guidance

4. **Validation Phase** (Testing)
   - Test in GraphQL Playground
   - Import via MCP tools
   - Execute with sample data

### For Template Updates

1. **Check AI Metadata** for new pattern suggestions
2. **Validate Against Schema** for compatibility
3. **Test Incrementally** with small changes
4. **Monitor Execution** for errors

## 🔍 Debugging Failed Templates

### Common Error Messages

**"Argument 'filter' of required type 'SearchNodesFilter!' was not provided"**
- **Cause**: Using AI suggested `searchQuery` instead of `filter`
- **Fix**: Replace with correct parameter structure

**"Field 'searchQuery' doesn't exist on type 'Query'"**
- **Cause**: AI metadata using non-existent field names
- **Fix**: Use GraphQL introspection to find correct fields

**"Expected type 'SearchNodesFilter', found Object"**
- **Cause**: Incorrect parameter object structure
- **Fix**: Check working templates for correct structure

### Debugging Steps

1. **Validate GraphQL Syntax** in Playground
2. **Check Parameter Names** against schema
3. **Compare with Working Templates**
4. **Test Minimal Version** first
5. **Add Complexity Gradually**

## 💡 Pro Tips

### Maximize AI Metadata Value
- Use for **conceptual planning**, not implementation
- Focus on **complexity assessment** and **use case identification**
- Combine with **real schema introspection**

### Efficient Template Development
- Keep a **library of working templates**
- Use **schema introspection scripts**
- Implement **automated validation**
- Build **incremental testing**

### Future-Proofing
- Expect **AI metadata improvements**
- Plan for **real-time schema sync**
- Design **validation pipelines**
- Monitor **template success rates**

---

**Remember**: AI metadata is a starting point, not a destination. Always validate against real schema and test thoroughly before production use.