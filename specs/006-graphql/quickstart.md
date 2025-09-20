# Quick Start: MCP Schema Synchronization & Dynamic Variable Mapping

**Feature**: MCP Schema Synchronization & Dynamic Variable Mapping
**Date**: 2025-01-19
**Phase**: Phase 1 - Implementation Guide

## Overview

This guide demonstrates the core functionality of the MCP Schema Synchronization system through practical examples and test scenarios.

## Prerequisites

- Bun runtime installed (>= 1.0.0)
- GraphQL server running on port 4000
- MCP server running on port 4002
- SQLite database initialized

## Quick Test Scenarios

### Scenario 1: Basic Schema Detection

**Purpose**: Verify that the system can detect GraphQL schema changes automatically

**Steps**:
1. Start the GraphQL server with current schema
2. Trigger schema detection
3. Verify schema snapshot creation
4. Modify schema (add non-breaking field)
5. Verify change detection

**Example Commands**:
```bash
# 1. Health check GraphQL server
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status version } }"}'

# 2. Trigger manual schema detection
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { triggerSchemaSync(force: true) { success version duration } }"}'

# 3. Check schema version
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getSchemaVersion { version hash timestamp status } }"}'

# 4. Detect changes
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { detectSchemaChanges(lastKnownVersion: \"1.0.0\") { hasChanged currentVersion changes { type path description breaking } } }"}'
```

**Expected Results**:
- Initial schema detection creates version `1.0.0`
- Schema changes are detected with detailed change information
- Non-breaking changes have `breaking: false`
- Response time < 200ms

### Scenario 2: MCP Tool Contract Synchronization

**Purpose**: Verify that MCP tool contracts are updated when schema changes

**Steps**:
1. Register a test MCP tool with the system
2. Verify initial contract mapping creation
3. Modify GraphQL schema (add field to existing type)
4. Trigger contract synchronization
5. Verify contract mapping updates

**Example Commands**:
```bash
# 1. Check current tool contracts
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getToolContracts(toolName: \"searchNodes\") { id mcpToolName graphqlOperation status compatibilityLevel } }"}'

# 2. Sync contracts with current schema
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { syncContracts(input: { toolNames: [\"searchNodes\"], forceUpdate: true }) { success updatedMappings errors { toolName message } } }"}'

# 3. Validate specific contract
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { validateContract(input: { toolName: \"searchNodes\", graphqlOperation: \"query searchNodes($searchTerm: String, $limit: Int) { searchNodes(searchTerm: $searchTerm, limit: $limit) { id content tableId createdAt } }\" }) { valid compatibilityLevel issues { type message } } }"}'

# 4. Check contract status
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getContractStatus(toolName: \"searchNodes\") { toolName totalMappings healthyMappings overallHealth issues { type message } } }"}'
```

**Expected Results**:
- Contract mappings are created automatically
- Schema changes trigger contract updates
- Validation passes with `compatibilityLevel: FULL`
- No critical issues reported

### Scenario 3: Variable Transformation

**Purpose**: Verify bidirectional variable transformation between MCP and GraphQL

**Steps**:
1. Send MCP tool arguments through transformation
2. Verify GraphQL variable generation
3. Send GraphQL response through reverse transformation
4. Verify MCP response format

**Example Commands**:
```bash
# 1. Transform MCP arguments to GraphQL variables
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { transformToGraphQL(input: { toolName: \"searchNodes\", operation: \"searchNodes\", mcpArguments: { \"searchTerm\": \"test\", \"limit\": 10 } }) { success variables query errors { code message } } }"}'

# 2. Preview transformation
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { previewTransformation(input: { toolName: \"searchNodes\", mcpArguments: { \"searchTerm\": \"test\", \"limit\": 10 }, direction: TO_GRAPHQL }) { input output warnings performance { complexity } } }"}'

# 3. Transform GraphQL response to MCP format
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { transformFromGraphQL(input: { toolName: \"searchNodes\", operation: \"searchNodes\", graphqlResponse: { \"data\": { \"searchNodes\": [{ \"id\": \"123\", \"content\": \"test content\", \"tableId\": \"table1\", \"createdAt\": \"2025-01-19T10:00:00Z\" }] } } }) { success content { type text } isError } }"}'

# 4. Get transformation rules
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getTransformationRules(toolName: \"searchNodes\") { id transformationRules scalarMappings version } }"}'
```

**Expected Results**:
- MCP arguments correctly transformed to GraphQL variables
- GraphQL response correctly transformed to MCP content format
- Scalar types (DateTime) properly converted
- No transformation errors

### Scenario 4: Real-time Sync Monitoring

**Purpose**: Verify real-time monitoring of synchronization events

**Steps**:
1. Subscribe to sync events
2. Trigger schema changes
3. Observe real-time event notifications
4. Check sync system status

**Example Commands**:
```bash
# 1. Get current sync status
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getSyncStatus { overall lastSyncTime currentSchemaVersion activeTools healthyMappings totalMappings components { component status } } }"}'

# 2. Get sync history
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getSyncHistory(limit: 10, severity: INFO) { events { id eventType timestamp severity affectedMappings syncDuration } totalCount } }"}'

# 3. Get sync metrics
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getSyncMetrics(timeRange: LAST_24_HOURS) { totalSyncs successfulSyncs averageSyncDuration errorsByType { errorType count } } }"}'

# 4. WebSocket subscription (using wscat or similar)
# wscat -c ws://localhost:4000/graphql
# {"type":"start","payload":{"query":"subscription { syncEvents(severity: WARNING) { id eventType timestamp message } }"}}
```

**Expected Results**:
- System status shows `overall: HEALTHY`
- Sync events are recorded with proper timestamps
- Metrics show successful sync operations
- Real-time events arrive via WebSocket

### Scenario 5: Tool Validation

**Purpose**: Verify comprehensive tool validation against schema

**Steps**:
1. Validate all existing tools
2. Register a new test tool
3. Validate tool with breaking schema change
4. Check compatibility matrix

**Example Commands**:
```bash
# 1. Validate all tools
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { validateAllTools { totalTools validTools invalidTools overallHealth toolResults { toolName valid compatibilityLevel issues { type severity message } } } }"}'

# 2. Register new tool
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { registerTool(input: { toolName: \"testTool\", description: \"Test tool for validation\", operations: [{ name: \"testOp\", graphqlOperation: \"query { healthCheck { status } }\", inputSchema: { \"type\": \"object\", \"properties\": {} } }] }) { success toolName validationResult { valid compatibilityLevel } } }"}'

# 3. Validate specific tool
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { validateTool(toolName: \"testTool\") { toolName valid compatibilityLevel operationResults { operationName valid issues { type message } } } }"}'

# 4. Get compatibility matrix
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getCompatibilityMatrix(toolNames: [\"searchNodes\", \"createTable\"]) { tools schemaVersions matrix { toolName schemaVersion score level } } }"}'
```

**Expected Results**:
- All existing tools validate successfully
- New tool registration succeeds with validation
- Compatibility matrix shows appropriate scores
- Breaking changes properly detected

## Integration Test

**Complete End-to-End Scenario**:

```bash
#!/bin/bash
# Complete integration test script

echo "🚀 Starting MCP Schema Sync Integration Test"

# 1. Verify system health
echo "1. Checking system health..."
HEALTH=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status } }"}' | jq -r '.data.healthCheck.status')

if [ "$HEALTH" != "healthy" ]; then
  echo "❌ System not healthy: $HEALTH"
  exit 1
fi
echo "✅ System healthy"

# 2. Trigger schema sync
echo "2. Triggering schema sync..."
SYNC_RESULT=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { triggerSchemaSync(force: true) { success version } }"}')

SUCCESS=$(echo $SYNC_RESULT | jq -r '.data.triggerSchemaSync.success')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Schema sync failed"
  exit 1
fi
echo "✅ Schema sync successful"

# 3. Validate tools
echo "3. Validating tools..."
VALIDATION=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { validateAllTools { validTools invalidTools } }"}')

VALID_TOOLS=$(echo $VALIDATION | jq -r '.data.validateAllTools.validTools')
INVALID_TOOLS=$(echo $VALIDATION | jq -r '.data.validateAllTools.invalidTools')

echo "✅ Tools validated: $VALID_TOOLS valid, $INVALID_TOOLS invalid"

# 4. Test variable transformation
echo "4. Testing variable transformation..."
TRANSFORM=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { transformToGraphQL(input: { toolName: \"searchNodes\", operation: \"searchNodes\", mcpArguments: { \"searchTerm\": \"test\" } }) { success } }"}')

TRANSFORM_SUCCESS=$(echo $TRANSFORM | jq -r '.data.transformToGraphQL.success')
if [ "$TRANSFORM_SUCCESS" != "true" ]; then
  echo "❌ Variable transformation failed"
  exit 1
fi
echo "✅ Variable transformation successful"

echo "🎉 All tests passed! MCP Schema Sync system is working correctly."
```

## Performance Benchmarks

**Expected Performance Metrics**:

- **Schema Detection**: < 200ms
- **Contract Sync**: < 500ms for 10 tools
- **Variable Transformation**: < 50ms per operation
- **Tool Validation**: < 1s for all tools
- **Memory Usage**: < 100MB for complete system
- **Cache Hit Rate**: > 80% for schema requests

## Troubleshooting

**Common Issues**:

1. **Schema Detection Fails**
   - Check GraphQL server connectivity
   - Verify introspection is enabled
   - Check network latency

2. **Contract Sync Errors**
   - Validate GraphQL operation syntax
   - Check for breaking schema changes
   - Verify tool definitions

3. **Variable Transformation Issues**
   - Check scalar type mappings
   - Verify JSONPath expressions
   - Validate input/output schemas

4. **Performance Issues**
   - Check cache configuration
   - Monitor database query performance
   - Verify network connectivity

## Next Steps

After successfully running these scenarios:

1. **Monitor real-world usage** with production tools
2. **Set up automated testing** with CI/CD integration
3. **Configure monitoring** and alerting for production
4. **Plan schema evolution** strategy with breaking changes

This quickstart guide provides a comprehensive validation of the MCP Schema Synchronization system functionality and serves as a foundation for production deployment.