# Bun Graph DB - Query Recipes 🍳

Complete GraphQL query recipes for testing all implemented features in the Bun Graph DB.

## 🏗️ System Overview Features

### 1. Health Check & System Status
```graphql
# Basic health check
query HealthCheck {
  health {
    status
    timestamp
    database
    version
  }
}

# System status monitoring
query SystemStatus {
  getSystemStatus {
    status
    uptime
    activeConnections
    queueLength
    lastUpdate
  }
}
```

### 2. Table Management
```graphql
# Get all tables
query GetAllTables {
  tables {
    nodes {
      id
      identifier
      description
      createdAt
      updatedAt
      nodeCount
      attributeCount
    }
    totalCount
    hasNextPage
  }
}

# Create a new table
mutation CreateTable {
  createTable(input: {
    identifier: "project_management"
    description: "Project management system with tasks and dependencies"
    metadata: {
      domain: "software_development"
      version: "1.0"
    }
  }) {
    id
    identifier
    description
    createdAt
    nodeCount
    attributeCount
  }
}
```

### 3. Attribute Type & Attribute Management
```graphql
# Create attribute types
mutation CreateAttributeTypes {
  statusType: createAttributeType(input: {
    identifier: "status"
    name: "Task Status"
    description: "Status of a task or project item"
    dataType: STRING
    allowedValues: ["todo", "in_progress", "completed", "blocked"]
  }) {
    id
    identifier
    name
    dataType
    allowedValues
  }
  
  priorityType: createAttributeType(input: {
    identifier: "priority"
    name: "Priority Level"
    description: "Priority level for tasks"
    dataType: STRING
    allowedValues: ["low", "medium", "high", "critical"]
  }) {
    id
    identifier
    name
    dataType
    allowedValues
  }
  
  estimateType: createAttributeType(input: {
    identifier: "estimate"
    name: "Time Estimate"
    description: "Estimated time in hours"
    dataType: NUMBER
    constraints: {
      min: 0.5
      max: 100
    }
  }) {
    id
    identifier
    name
    dataType
    constraints
  }
}

# Create attributes for a table
mutation CreateAttributes($tableId: String!) {
  statusAttr: createAttribute(input: {
    tableId: $tableId
    attributeTypeId: "1"  # Replace with actual status type ID
    identifier: "task_status"
    name: "Task Status"
    description: "Current status of the task"
    isRequired: true
    defaultValue: "todo"
  }) {
    id
    identifier
    name
    isRequired
    defaultValue
  }
  
  priorityAttr: createAttribute(input: {
    tableId: $tableId
    attributeTypeId: "2"  # Replace with actual priority type ID
    identifier: "task_priority"
    name: "Task Priority"
    description: "Priority level of the task"
    isRequired: false
    defaultValue: "medium"
  }) {
    id
    identifier
    name
    isRequired
    defaultValue
  }
}
```

### 4. Node Management with Complex Scenarios
```graphql
# Create nodes with different types
mutation CreateProjectNodes($tableId: String!) {
  # Main project node
  project: createNode(input: {
    tableId: $tableId
    content: "E-commerce Platform Redesign"
    title: "Main Project"
    description: "Complete redesign of the e-commerce platform with modern architecture"
    attributes: {
      task_status: "in_progress"
      task_priority: "high"
      estimate: 80
    }
  }) {
    id
    content
    title
    createdAt
  }
  
  # Feature nodes
  userAuth: createNode(input: {
    tableId: $tableId
    content: "User Authentication System"
    title: "Authentication Feature"
    description: "Implement OAuth2 and JWT-based authentication"
    attributes: {
      task_status: "completed"
      task_priority: "critical"
      estimate: 16
    }
  }) {
    id
    content
    title
  }
  
  paymentGateway: createNode(input: {
    tableId: $tableId
    content: "Payment Gateway Integration"
    title: "Payment Processing"
    description: "Integrate with Stripe and PayPal payment systems"
    attributes: {
      task_status: "todo"
      task_priority: "high"
      estimate: 24
    }
  }) {
    id
    content
    title
  }
  
  uiComponents: createNode(input: {
    tableId: $tableId
    content: "UI Component Library"
    title: "Component System"
    description: "Build reusable React components with Storybook"
    attributes: {
      task_status: "in_progress"
      task_priority: "medium"
      estimate: 32
    }
  }) {
    id
    content
    title
  }
  
  # Bug/Issue nodes
  mobileBug: createNode(input: {
    tableId: $tableId
    content: "Mobile responsiveness issues"
    title: "Mobile Bug"
    description: "Fix responsive layout issues on mobile devices"
    attributes: {
      task_status: "blocked"
      task_priority: "high"
      estimate: 8
    }
  }) {
    id
    content
    title
  }
}
```

### 5. Relationship Management
```graphql
# Create relation types
mutation CreateRelationTypes {
  dependsOn: createRelationType(input: {
    identifier: "depends_on"
    name: "Depends On"
    description: "This task depends on completion of another task"
    metadata: {
      color: "blue"
      strength: "strong"
    }
  }) {
    id
    identifier
    name
    description
  }
  
  blockedBy: createRelationType(input: {
    identifier: "blocked_by"
    name: "Blocked By"
    description: "This task is blocked by an issue or dependency"
    metadata: {
      color: "red"
      strength: "critical"
    }
  }) {
    id
    identifier
    name
    description
  }
  
  partOf: createRelationType(input: {
    identifier: "part_of"
    name: "Part Of"
    description: "This task is part of a larger feature or project"
    metadata: {
      color: "green"
      strength: "medium"
    }
  }) {
    id
    identifier
    name
    description
  }
}

# Create relationships between nodes
mutation CreateRelationships($tableId: String!) {
  # Payment gateway depends on user auth
  dep1: createRelation(input: {
    tableId: $tableId
    sourceNodeId: "3"  # Payment Gateway
    targetNodeId: "2"  # User Auth
    relationTypeId: "1" # depends_on
    properties: {
      reason: "Payment processing requires user authentication"
      priority: "high"
      estimatedDelay: 2
    }
    strength: 9
  }) {
    id
    strength
    properties
  }
  
  # UI Components is part of main project
  part1: createRelation(input: {
    tableId: $tableId
    sourceNodeId: "4"  # UI Components
    targetNodeId: "1"  # Main Project
    relationTypeId: "3" # part_of
    properties: {
      completion_percentage: 65
      milestone: "Phase 2"
    }
    strength: 8
  }) {
    id
    strength
    properties
  }
  
  # Mobile bug blocks UI components
  block1: createRelation(input: {
    tableId: $tableId
    sourceNodeId: "4"  # UI Components
    targetNodeId: "5"  # Mobile Bug
    relationTypeId: "2" # blocked_by
    properties: {
      impact: "high"
      urgency: "immediate"
      affected_platforms: ["mobile", "tablet"]
    }
    strength: 7
  }) {
    id
    strength
    properties
  }
}
```

## 🔍 Advanced Search & Analytics Features

### 6. Basic Node Search
```graphql
# Search nodes with filters
query SearchNodes($tableId: String!) {
  searchNodes(input: {
    tableId: $tableId
    searchTerm: "authentication"
    limit: 10
  }) {
    nodes {
      id
      content
      title
      description
      createdAt
    }
    totalCount
    hasMore
  }
}
```

### 7. Advanced Search with Complex Filters
```graphql
# Advanced search with multiple filters and aggregations
query AdvancedTaskSearch($tableId: String!) {
  advancedSearch(input: {
    tableId: $tableId
    filters: [
      {
        field: "task_status"
        operator: IN
        values: ["in_progress", "todo"]
      }
      {
        field: "task_priority"
        operator: EQ
        value: "high"
      }
    ]
    relationFilters: [
      {
        relationTypes: ["depends_on", "blocked_by"]
        direction: BOTH
        depth: 2
      }
    ]
    aggregations: [
      {
        field: "task_status"
        operation: COUNT
        groupBy: ["task_status"]
      }
      {
        field: "estimate"
        operation: SUM
      }
      {
        field: "estimate"
        operation: AVG
        groupBy: ["task_priority"]
      }
    ]
    sort: [
      {
        field: "task_priority"
        direction: DESC
      }
      {
        field: "estimate"
        direction: ASC
      }
    ]
    limit: 20
    includeRelationCount: true
  }) {
    nodes {
      id
      content
      title
      relationCount
      score
      createdAt
    }
    aggregations {
      field
      operation
      value
      groupedResults {
        groupKey
        value
        count
      }
    }
    totalCount
    hasNextPage
    executionTime
  }
}
```

### 8. Graph Relationship Queries
```graphql
# Search related nodes with complex graph traversal
query SearchRelatedNodes($tableId: String!) {
  searchRelatedNodes(input: {
    tableId: $tableId
    sourceNodeIds: ["1"]  # Main Project
    relationFilters: [
      {
        relationTypes: ["part_of", "depends_on"]
        direction: BOTH
        depth: UNLIMITED
      }
    ]
    nodeFilters: {
      task_status: ["in_progress", "todo"]
    }
    limit: 50
  }) {
    nodes {
      node {
        id
        content
        title
      }
      sourceNodeId
      targetNodeId
      relationTypeId
      properties
      strength
    }
    relations {
      id
      sourceNodeId
      targetNodeId
      relationType {
        identifier
        name
      }
      properties
      strength
    }
    paths {
      startNodeId
      endNodeId
      path
      length
    }
    total
    hasMore
  }
}

# Find paths between specific nodes
query FindDependencyPaths($tableId: String!) {
  findPathsBetweenNodes(
    tableId: $tableId
    startNodeIds: ["3"]  # Payment Gateway
    endNodeIds: ["2"]    # User Auth
    maxDepth: 5
    relationTypes: ["depends_on", "blocked_by"]
  ) {
    startNodeId
    endNodeId
    path
    length
  }
}

# Get dependency chain for a node
query GetDependencyChain($tableId: String!) {
  getDependencyChain(
    tableId: $tableId
    nodeId: "1"  # Main Project
    direction: BOTH
    relationTypes: ["depends_on", "part_of"]
  ) {
    nodeId
    level
    relationPath
  }
}
```

## 📊 Analytics & Performance Features

### 9. Node Analytics
```graphql
# Comprehensive node analytics
query NodeAnalytics($tableId: String!) {
  analyzeNodes(input: {
    tableId: $tableId
    nodeFilters: {
      task_status: ["in_progress", "completed"]
    }
    relationFilters: [
      {
        relationTypes: ["depends_on", "part_of"]
        direction: BOTH
      }
    ]
    timeRange: {
      startDate: "2024-01-01T00:00:00Z"
      endDate: "2024-12-31T23:59:59Z"
    }
  }) {
    tableAnalytics {
      totalNodes
      totalRelations
      averageRelationsPerNode
      networkDensity
      growthTrends {
        date
        nodeCount
        relationCount
      }
      relationshipBreakdown {
        relationTypeId
        relationTypeName
        totalCount
        averageStrength
        distributionByStrength {
          range
          count
        }
      }
    }
    nodeMetrics {
      nodeId
      incomingCount
      outgoingCount
      totalRelations
      centrality
      clustering
      pageRank
      createdAt
      lastActivity
    }
    qualityScores {
      metric
      score
      description
    }
    recommendations {
      type
      message
      priority
    }
  }
}
```

### 10. Performance Monitoring
```graphql
# Get search performance metrics
query SearchPerformanceMetrics($tableId: String!) {
  getSearchPerformanceMetrics(input: {
    tableId: $tableId
    timeRange: {
      startDate: "2024-01-01T00:00:00Z"
    }
    includeSlowQueries: true
  }) {
    tableId
    queryResponseTimes {
      operationType
      averageMs
      maxMs
      minMs
      count
    }
    indexEfficiency
    cacheHitRatio
    concurrentOperations
    averageQueryTime
    slowestQueries {
      queryType
      duration
      timestamp
      parameters
    }
  }
}

# Get monitoring metrics over time
query MonitoringMetrics($tableId: String!) {
  getMonitoringMetrics(
    tableId: $tableId
    timeRange: {
      startDate: "2024-01-01T00:00:00Z"
    }
  ) {
    responseTime
    throughput
    errorRate
    resourceUtilization
    timestamp
  }
}

# Get system health metrics
query SystemHealth($tableId: String!) {
  getSystemHealth(tableId: $tableId) {
    status
    databaseSize
    totalTables
    totalNodes
    totalRelations
    uptime
    memoryUsage
    activeConnections
    lastUpdate
  }
}
```

### 11. Data Aggregation Examples
```graphql
# Complex aggregation queries
query TaskAggregations($tableId: String!) {
  statusAggregation: aggregateData(input: {
    tableId: $tableId
    field: "status"
    aggregationType: COUNT
    groupBy: ["task_priority", "task_status"]
    filters: {
      created_date: {
        gte: "2024-01-01"
      }
    }
    timeRange: {
      startDate: "2024-01-01T00:00:00Z"
      endDate: "2024-12-31T23:59:59Z"
    }
  }) {
    field
    aggregationType
    value
    groupedBy {
      key
      value
      count
    }
  }
  
  estimateAggregation: aggregateData(input: {
    tableId: $tableId
    field: "estimate"
    aggregationType: AVG
    groupBy: ["task_status"]
  }) {
    field
    aggregationType
    value
    groupedBy {
      key
      value
      count
    }
  }
}
```

## 🚨 Alert & Management Features

### 12. Alert Management
```graphql
# Create performance alert rules
mutation CreateAlertRules {
  responseTimeAlert: createAlertRule(input: {
    name: "High Response Time"
    condition: "averageResponseTime > threshold"
    threshold: 100.0
    tableId: "1"
  }) {
    id
    name
    condition
    threshold
    isActive
    createdAt
  }
  
  errorRateAlert: createAlertRule(input: {
    name: "High Error Rate"
    condition: "errorRate > threshold"
    threshold: 0.05
  }) {
    id
    name
    condition
    threshold
    isActive
    createdAt
  }
}

# Get all alert rules
query GetAlertRules($tableId: String) {
  getAlertRules(tableId: $tableId) {
    id
    name
    condition
    threshold
    isActive
    createdAt
  }
}
```

### 13. System Management
```graphql
# System maintenance operations
mutation SystemMaintenance {
  clearCache: clearCache(tableId: "1")
  optimizeDatabase: optimizeDatabase
}
```

## 🧪 Testing Workflow

### Complete Test Sequence
```graphql
# 1. Start with health check
query { health { status timestamp database version } }

# 2. Create table and get ID
mutation { createTable(input: {identifier: "test_project", description: "Test project"}) { id } }

# 3. Create attribute types and attributes (use returned IDs)

# 4. Create nodes with attributes (use table ID from step 2)

# 5. Create relation types and relationships (use node IDs from step 4)

# 6. Test advanced search with various filters

# 7. Test graph relationship queries

# 8. Test analytics and performance monitoring

# 9. Test alert management

# 10. Verify system health and metrics
```

## 📝 Variable Examples

For testing with GraphiQL, use these variables:

```json
{
  "tableId": "1",
  "nodeId": "1",
  "relationTypeId": "1"
}
```

## 🎯 Expected Results

Each query should return:
- ✅ Proper data structure matching GraphQL schema
- ✅ Performance metrics < 100ms for simple queries
- ✅ Accurate aggregation calculations
- ✅ Valid relationship traversals
- ✅ Meaningful analytics insights
- ✅ System health indicators

This comprehensive recipe covers all implemented features from basic CRUD operations to advanced analytics and monitoring capabilities.