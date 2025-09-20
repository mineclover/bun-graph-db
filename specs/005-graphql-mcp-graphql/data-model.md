# Phase 1: Data Model & Design

## Core Entities

### McpToolDefinition
**Purpose**: Represents an MCP tool that maps to a GraphQL operation
**Fields**:
- `name: string` - MCP tool name (e.g., "createTable", "searchNodes")
- `description: string` - Human-readable description of the tool's purpose
- `inputSchema: JSONSchema` - JSON schema defining required/optional parameters
- `graphqlOperation: GraphQLOperation` - Associated GraphQL query/mutation details
- `operationType: "query" | "mutation"` - Type of GraphQL operation

**Relationships**:
- Has one GraphQLOperation
- Maps to zero or many ToolExecutionResults

**Validation Rules**:
- Name must be unique within MCP server
- Input schema must be valid JSON Schema draft-07
- GraphQL operation must exist in target schema

### GraphQLOperation
**Purpose**: Encapsulates GraphQL query/mutation execution details
**Fields**:
- `operationName: string` - GraphQL operation name (e.g., "createTable", "healthCheck")
- `query: string` - GraphQL query/mutation string with variable placeholders
- `variables: Record<string, any>` - Default or template variables
- `operationType: "query" | "mutation"` - GraphQL operation type

**Relationships**:
- Belongs to one McpToolDefinition
- Maps to GraphQL schema operations

**Validation Rules**:
- Operation name must exist in GraphQL schema
- Query must be valid GraphQL syntax
- Variables must match GraphQL operation requirements

### McpSession
**Purpose**: Represents an active MCP client connection
**Fields**:
- `sessionId: string` - Unique session identifier
- `clientInfo: ClientInfo` - Client metadata (name, version)
- `capabilities: ClientCapabilities` - MCP capabilities negotiated
- `createdAt: DateTime` - Session establishment time
- `lastActivity: DateTime` - Last request timestamp

**Relationships**:
- Has many ToolExecutionResults
- Has one SessionState

**State Transitions**:
- Initializing → Negotiated (after capability exchange)
- Negotiated → Active (after first successful tool call)
- Active → Idle (after inactivity timeout)
- Any → Closed (on disconnect or error)

### ToolExecutionResult
**Purpose**: Records the result of executing an MCP tool
**Fields**:
- `executionId: string` - Unique execution identifier
- `toolName: string` - Name of executed MCP tool
- `parameters: Record<string, any>` - Parameters passed to tool
- `graphqlQuery: string` - Generated GraphQL query
- `graphqlVariables: Record<string, any>` - Variables sent to GraphQL
- `result: any` - Execution result (success data or error)
- `success: boolean` - Whether execution succeeded
- `executionTime: number` - Execution duration in milliseconds
- `timestamp: DateTime` - Execution start time

**Relationships**:
- Belongs to one McpSession
- References one McpToolDefinition

**Validation Rules**:
- Execution ID must be unique
- Parameters must match tool's input schema
- Result must be valid JSON

### ErrorContext
**Purpose**: Structured error information for debugging
**Fields**:
- `errorCode: string` - MCP or GraphQL error code
- `message: string` - Human-readable error message
- `details: Record<string, any>` - Additional error context
- `graphqlErrors?: GraphQLError[]` - Original GraphQL errors if applicable
- `stackTrace?: string` - Stack trace for debugging

**Relationships**:
- Can be part of ToolExecutionResult
- Referenced by logging systems

## Data Flow Architecture

### MCP Request → GraphQL Execution
```
1. McpSession receives tool execution request
2. Validate parameters against McpToolDefinition.inputSchema
3. Retrieve GraphQLOperation for the tool
4. Transform MCP parameters to GraphQL variables
5. Execute GraphQL operation against existing server
6. Transform GraphQL response to MCP result format
7. Create ToolExecutionResult record
8. Return MCP-compliant response
```

### Tool Discovery Flow
```
1. Client requests available tools (MCP list_tools)
2. Server returns all McpToolDefinition entries
3. Client can inspect inputSchema for each tool
4. Client executes tools using call_tool request
```

### Error Handling Flow
```
1. Capture errors at any step of execution
2. Create ErrorContext with appropriate details
3. Transform to MCP error format
4. Log error with session and execution context
5. Return structured error to client
```

## Schema Relationships

### MCP Tools ↔ GraphQL Operations Mapping
- **System Queries**: healthCheck, systemStats → GraphQL Query operations
- **Table Operations**: createTable, searchTables, getTable → GraphQL Mutation/Query
- **Node Operations**: createNode, searchNodes, getNode → GraphQL Mutation/Query
- **Relation Operations**: createRelation, searchRelatedNodes → GraphQL Mutation/Query
- **Template Operations**: createTemplate, executeTemplateWithGraphQL → GraphQL Mutation
- **Schema Operations**: importSchema, exportSchema → GraphQL Mutation/Query

### Data Consistency Rules
- All GraphQL operations must have corresponding MCP tool definitions
- Tool input schemas must be compatible with GraphQL variable requirements
- Session state must be maintained across tool executions
- Execution results must be logged for debugging and monitoring

## Integration Points

### With Existing GraphQL Server
- Reuse existing GraphQL endpoint (localhost:4000/graphql)
- Maintain existing GraphQL schema without modifications
- Preserve all existing functionality and performance
- Add MCP layer as non-invasive proxy

### With MCP Protocol
- Implement MCP 2025-06-18 specification fully
- Support tool discovery, execution, and error handling
- Use application/json transport as required
- Maintain session state per MCP specification

### With Logging Infrastructure
- Integrate with existing ConsoleLogger pattern
- Log all MCP requests and GraphQL executions
- Provide structured logging for debugging
- Include session context in all log entries