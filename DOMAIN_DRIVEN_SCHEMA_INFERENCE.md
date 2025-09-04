# Domain-Driven Schema Inference Scenarios 🧠

도메인 기반 스마트 스키마 추론 시나리오 - 테이블과 속성 정의 후 도메인 정보를 통한 노드 구조 자동 제안

## 📋 Overview

사용자가 테이블과 속성을 정의한 후, **도메인(domain) 정보만 제공**하면 시스템이 기존 스키마를 분석하여 적절한 노드 구조와 데이터를 제안하는 스마트 워크플로우입니다.

### Core Concept
```
User Input: Domain → System Analysis → Schema Inference → Node Suggestion → Smart Data Entry
```

## 🏗️ Workflow Scenarios

### Scenario 1: E-commerce Domain Example

#### Step 1: Table & Attributes Definition
```graphql
# 1. Create table
mutation {
  createTable(input: {
    identifier: "ecommerce_products"
    description: "E-commerce product catalog management"
    metadata: {
      domain: "ecommerce",
      category: "product_management"
    }
  }) {
    id
    identifier
  }
}

# 2. Define attribute types and attributes
mutation {
  # Create custom attribute types for this domain
  priceType: createAttributeType(input: {
    identifier: "product_price"
    name: "Product Price"
    dataType: NUMBER
    constraints: { min: 0, precision: 2 }
  }) { id }
  
  categoryType: createAttributeType(input: {
    identifier: "product_category"
    name: "Product Category"
    dataType: STRING
    allowedValues: ["electronics", "clothing", "books", "home"]
  }) { id }
  
  # Add attributes to table
  priceAttr: createAttribute(input: {
    tableId: $tableId
    attributeTypeId: $priceTypeId
    identifier: "price"
    name: "Product Price"
    isRequired: true
  }) { id }
  
  categoryAttr: createAttribute(input: {
    tableId: $tableId
    attributeTypeId: $categoryTypeId
    identifier: "category"
    name: "Product Category"
    isRequired: true
  }) { id }
}
```

#### Step 2: Domain-Based Node Inference
```graphql
# 3. Request schema inference based on domain
query {
  inferNodeSchema(input: {
    tableId: $tableId
    domain: "ecommerce"
    context: {
      business_type: "retail",
      target_audience: "consumers",
      scale: "medium"
    }
  }) {
    suggestedNodes {
      content
      title
      description
      attributes
      confidence
      reasoning
    }
    schemaAnalysis {
      detectedPatterns
      missingAttributes
      recommendations
    }
  }
}
```

#### Step 3: Smart Node Creation
```graphql
# 4. Create nodes with AI-suggested structure
mutation {
  createNodeWithInference(input: {
    tableId: $tableId
    domain: "ecommerce"
    seedData: {
      category: "electronics"
      keywords: ["smartphone", "high-end"]
    }
  }) {
    node {
      id
      content
      title
      attributes
    }
    inference {
      appliedPatterns
      confidence
      alternatives
    }
  }
}
```

### Scenario 2: Project Management Domain

#### Complete Workflow Example
```graphql
# Step 1: Table Setup
mutation CreateProjectTable {
  table: createTable(input: {
    identifier: "project_management"
    description: "Software project task and milestone tracking"
    metadata: {
      domain: "project_management",
      subdomain: "software_development",
      methodology: "agile"
    }
  }) { id }
  
  # Define domain-specific attributes
  statusType: createAttributeType(input: {
    identifier: "task_status"
    name: "Task Status"
    dataType: STRING
    allowedValues: ["todo", "in_progress", "review", "done", "blocked"]
  }) { id }
  
  priorityType: createAttributeType(input: {
    identifier: "priority_level"
    name: "Priority Level"
    dataType: STRING
    allowedValues: ["low", "medium", "high", "critical"]
  }) { id }
  
  estimateType: createAttributeType(input: {
    identifier: "story_points"
    name: "Story Points"
    dataType: NUMBER
    constraints: { min: 1, max: 21 }
  }) { id }
}

# Step 2: Domain Analysis and Inference
query AnalyzeDomain {
  analyzeDomainPatterns(input: {
    tableId: $tableId
    domain: "project_management"
    existingAttributes: ["task_status", "priority_level", "story_points"]
  }) {
    domainAnalysis {
      commonPatterns
      typicalStructures
      relationshipTypes
      bestPractices
    }
    suggestions {
      additionalAttributes
      nodeTemplates
      relationshipPatterns
    }
  }
}

# Step 3: Smart Node Generation
mutation CreateInferredNodes {
  # Epic level
  epic: createNodeWithDomainInference(input: {
    tableId: $tableId
    domain: "project_management"
    nodeType: "epic"
    context: {
      project_phase: "development",
      team_size: 5,
      timeline: "3_months"
    }
  }) {
    node { id content title attributes }
    appliedPatterns
  }
  
  # Feature level
  feature: createNodeWithDomainInference(input: {
    tableId: $tableId
    domain: "project_management"
    nodeType: "feature"
    parentNode: $epicId
    context: {
      complexity: "high",
      dependencies: ["user_auth", "database_design"]
    }
  }) {
    node { id content title attributes }
    appliedPatterns
  }
}
```

## 🤖 Smart Inference Engine

### Domain Pattern Recognition
```typescript
// Domain patterns stored in system
interface DomainPattern {
  domain: string
  subdomain?: string
  commonStructures: {
    nodeTypes: string[]
    attributePatterns: Record<string, any>
    relationshipTypes: string[]
  }
  templates: {
    nodeTemplates: NodeTemplate[]
    attributeTemplates: AttributeTemplate[]
  }
  businessRules: {
    validation: string[]
    defaults: Record<string, any>
    constraints: string[]
  }
}

// E-commerce domain pattern example
const ecommerceDomainPattern: DomainPattern = {
  domain: "ecommerce",
  commonStructures: {
    nodeTypes: ["product", "category", "brand", "review", "order"],
    attributePatterns: {
      product: ["name", "price", "description", "sku", "category", "stock"],
      order: ["order_id", "customer", "total", "status", "date"]
    },
    relationshipTypes: ["belongs_to", "related_product", "purchased_with"]
  },
  templates: {
    nodeTemplates: [
      {
        type: "product",
        contentPattern: "{brand} {product_name} - {category}",
        requiredAttributes: ["price", "category", "stock"],
        suggestedAttributes: ["description", "tags", "rating"]
      }
    ]
  }
}
```

### Inference Algorithm
```graphql
# Domain-based inference query structure
type DomainInferenceInput {
  tableId: String!
  domain: String!
  subdomain: String
  context: JSON
  seedData: JSON
  inferenceMode: InferenceMode # SUGGEST, AUTO_CREATE, TEMPLATE_ONLY
}

type InferenceResult {
  confidence: Float # 0.0 - 1.0
  suggestedNodes: [NodeSuggestion!]!
  schemaAnalysis: SchemaAnalysis!
  appliedPatterns: [String!]!
  alternatives: [NodeSuggestion!]!
}

type NodeSuggestion {
  content: String!
  title: String
  description: String
  attributes: JSON!
  reasoning: String!
  confidence: Float!
  templateUsed: String
}
```

## 📊 Implementation Strategy

### Phase 1: Pattern Database Setup
1. **Domain Pattern Collection**: 일반적인 도메인 패턴 수집 (ecommerce, project_management, etc.)
2. **Template Creation**: 도메인별 노드 템플릿 및 속성 패턴 정의
3. **Business Rules**: 도메인 특화 validation 및 constraint 규칙

### Phase 2: Inference Engine
1. **Schema Analysis**: 기존 테이블/속성 구조 분석
2. **Pattern Matching**: 도메인 패턴과의 매칭 및 신뢰도 계산
3. **Smart Suggestion**: 컨텍스트 기반 노드 구조 제안
4. **Validation**: 제안된 구조의 일관성 및 유효성 검증

### Phase 3: Learning System
1. **Usage Tracking**: 사용자의 선택과 수정사항 추적
2. **Pattern Refinement**: 사용 패턴을 통한 도메인 템플릿 개선
3. **Confidence Calibration**: 제안 정확도 기반 신뢰도 모델 조정

## 🎯 Usage Examples

### Example 1: Minimal Input, Maximum Inference
```graphql
mutation {
  createSmartNode(input: {
    tableId: "ecommerce_table_id"
    domain: "ecommerce"
    hint: "iPhone 15 Pro"
  }) {
    node {
      content # → "Apple iPhone 15 Pro - Electronics"
      attributes {
        # Automatically inferred:
        # price: null (to be filled)
        # category: "electronics"
        # brand: "Apple"
        # model: "iPhone 15 Pro"
      }
    }
    inference {
      confidence # → 0.95
      reasoning # → "Detected product pattern with brand and model"
    }
  }
}
```

### Example 2: Progressive Enhancement
```graphql
# Start with basic structure
mutation Step1 {
  createTable(input: {
    identifier: "healthcare_patients"
    metadata: { domain: "healthcare" }
  }) { id }
}

# System suggests healthcare-specific attributes
query Step2 {
  suggestDomainAttributes(tableId: $tableId, domain: "healthcare") {
    critical: ["patient_id", "medical_record_number", "birth_date"]
    recommended: ["insurance_info", "emergency_contact", "medical_history"]
    optional: ["preferences", "notes", "referral_source"]
  }
}

# Create nodes with domain intelligence
mutation Step3 {
  createPatientNode(input: {
    tableId: $tableId
    domain: "healthcare"
    basicInfo: {
      name: "John Smith",
      age: 45
    }
  }) {
    node {
      # System generates appropriate medical record structure
      content # → "Patient: John Smith (DOB: 1978-XX-XX)"
      attributes {
        # Auto-generated patient ID
        # Structured medical record fields
        # Privacy compliance markers
      }
    }
  }
}
```

## 🔄 Continuous Learning

### Feedback Loop
1. **User Accepts Suggestion** → Increase pattern confidence
2. **User Modifies Suggestion** → Learn from modifications  
3. **User Rejects Suggestion** → Analyze rejection reasons
4. **Domain Patterns Evolution** → Update templates based on usage

### Analytics Integration
```graphql
query DomainInferenceAnalytics {
  getDomainUsageStats(domain: "ecommerce") {
    totalInferences: 1250
    acceptanceRate: 0.87
    mostUsedPatterns: ["product", "category", "brand"]
    improvementAreas: ["pricing_structure", "inventory_management"]
  }
}
```

## 🎉 Expected Benefits

1. **Reduced Setup Time**: 도메인 정보만으로 빠른 스키마 구축
2. **Consistency**: 도메인 베스트 프랙티스 자동 적용
3. **Learning System**: 사용할수록 더 정확한 제안
4. **Flexibility**: 제안 수락/수정/거부 자유도
5. **Domain Expertise**: 각 도메인별 전문 지식 내장

이 시나리오를 통해 사용자는 복잡한 스키마 설계 없이도 도메인 지식을 활용한 스마트한 데이터 구조를 빠르게 구축할 수 있습니다.

---

# 관계 관리 및 그래프 탐색 확장 🔗

## 📊 도메인 기반 관계 발견 시스템

### 노드 기반 관계 탐색 워크플로우
```
Node Selection → Domain Analysis → Relationship Discovery → Graph Traversal → Relationship Suggestion
```

## 🔍 관계 발견 및 정의 시나리오

### Scenario 3: E-commerce 관계 탐색 예시

#### Step 1: 도메인 노드 리스트 조회
```graphql
query GetDomainNodes {
  getDomainNodeList(input: {
    tableId: "ecommerce_products"
    domain: "ecommerce"
    filters: {
      category: "electronics"
      priceRange: { min: 100, max: 1000 }
    }
    limit: 50
  }) {
    nodes {
      id
      content
      title
      attributes
      potentialRelations {
        relationTypeId
        relationTypeName
        confidence
        targetNodeSuggestions {
          nodeId
          content
          relationStrength
        }
      }
    }
    availableRelationTypes {
      id
      identifier
      description
      category
      domainSpecific
      usageCount
    }
  }
}
```

#### Step 2: 양방향 그래프 탐색
```graphql
query ExploreNodeRelations {
  exploreNodeGraph(input: {
    startNodeIds: ["node_123", "node_456"]
    direction: "BOTH" # INCOMING, OUTGOING, BOTH
    maxDepth: 3
    relationFilters: {
      relationTypes: ["related_to", "depends_on", "purchased_with"]
      strengthThreshold: 30
    }
    includeMetrics: true
  }) {
    traversalResult {
      startNode {
        id
        content
        title
      }
      connections {
        relationId
        relationTypeId
        relationTypeName
        direction
        strength # 0-4: 0=invalid, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=very_strong
        confidence # 0-4: 0=probably_wrong, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=verified
        targetNode {
          id
          content
          title
          distance
        }
        properties
      }
      graphMetrics {
        totalConnections
        averagePathLength
        centralityScore
        clusteringCoefficient
      }
    }
    backLinks {
      incomingRelations {
        relationId
        sourceNodeId
        sourceNodeContent
        relationTypeName
        strength
        createdAt
      }
      outgoingRelations {
        relationId
        targetNodeId
        targetNodeContent
        relationTypeName
        strength
        createdAt
      }
    }
    relationshipSuggestions {
      suggestedRelationType
      targetNodeId
      targetNodeContent
      confidence
      reasoning
      domainPattern
    }
  }
}
```

#### Step 3: 스마트 관계 정의
```graphql
mutation CreateIntelligentRelations {
  createDomainRelations(input: {
    sourceNodeId: "product_iphone_15"
    domain: "ecommerce"
    relationContext: {
      businessType: "retail"
      relationIntent: "cross_sell"
      customerBehavior: "frequently_bought_together"
    }
    autoDiscovery: true
  }) {
    createdRelations {
      id
      relationTypeId
      relationTypeName
      targetNodeId
      targetNodeContent
      strength
      confidence
      appliedPattern
    }
    suggestions {
      relationTypeId
      targetNodeIds
      reasoning
      expectedImpact
    }
  }
}
```

### Scenario 4: Project Management 관계 네트워크

#### 복합 관계 패턴 분석
```graphql
query AnalyzeProjectRelations {
  analyzeRelationshipPatterns(input: {
    tableId: "project_management"
    domain: "software_development"
    analysisType: "COMPREHENSIVE"
    focusAreas: ["dependencies", "blockers", "milestones"]
  }) {
    relationshipAnalysis {
      criticalPath {
        nodes {
          id
          content
          criticalityScore
        }
        dependencies {
          relationId
          type
          isBlocking
          estimatedImpact
        }
      }
      relationshipClusters {
        clusterId
        clusterType
        nodes {
          id
          content
          role
        }
        interconnections
        healthScore
      }
      bottleneckAnalysis {
        nodeId
        bottleneckType
        incomingCount
        outgoingCount
        impactScope
        recommendations
      }
    }
    domainInsights {
      commonPatterns
      missingRelations
      optimizationOpportunities
      riskFactors
    }
  }
}
```

## 🎯 관계 유형 발견 시스템

### 도메인별 관계 카탈로그
```graphql
query GetAvailableRelationTypes {
  getRelationTypeCatalog(input: {
    domain: "ecommerce"
    context: {
      nodeTypes: ["product", "category", "brand"]
      businessContext: "b2c_retail"
    }
  }) {
    coreRelations {
      identifier
      description
      category
      bidirectional
      strengthRange
      usageExamples
      domainSpecificProperties
    }
    suggestedRelations {
      identifier
      description
      confidence
      basedOnPattern
      expectedBenefit
    }
    customRelations {
      identifier
      description
      createdByUser
      usageCount
      effectiveness
    }
  }
}
```

### 관계 패턴 매칭
```typescript
// 도메인별 관계 패턴 정의
interface DomainRelationPattern {
  domain: string
  patterns: {
    structural: Array<{
      pattern: string
      relationTypes: string[]
      conditions: Record<string, any>
      strength: number
    }>
    semantic: Array<{
      pattern: string
      nlpFeatures: string[]
      relationTypes: string[]
      confidence: number
    }>
    behavioral: Array<{
      pattern: string
      userActions: string[]
      relationTypes: string[]
      temporalFactors: Record<string, any>
    }>
  }
  businessRules: {
    mandatory: string[]
    optional: string[]
    forbidden: Array<{
      sourceType: string
      targetType: string
      reason: string
    }>
  }
}

// E-commerce 도메인 관계 패턴 예시
const ecommerceRelationPatterns: DomainRelationPattern = {
  domain: "ecommerce",
  patterns: {
    structural: [
      {
        pattern: "product_category_hierarchy",
        relationTypes: ["belongs_to", "parent_of", "child_of"],
        conditions: { hierarchyLevel: "max_5", cyclicCheck: true },
        strength: 95
      },
      {
        pattern: "product_variant_group",
        relationTypes: ["variant_of", "grouped_with"],
        conditions: { sameCategory: true, similarAttributes: 0.8 },
        strength: 90
      }
    ],
    semantic: [
      {
        pattern: "complementary_products",
        nlpFeatures: ["similar_description", "shared_keywords", "category_overlap"],
        relationTypes: ["complements", "goes_well_with"],
        confidence: 0.75
      },
      {
        pattern: "competitive_products",
        nlpFeatures: ["similar_function", "price_range_overlap", "target_audience"],
        relationTypes: ["competes_with", "alternative_to"],
        confidence: 0.70
      }
    ],
    behavioral: [
      {
        pattern: "frequently_bought_together",
        userActions: ["co_purchase", "basket_analysis", "recommendation_clicks"],
        relationTypes: ["purchased_with", "recommended_with"],
        temporalFactors: { timeWindow: "30_days", sessionBased: true }
      }
    ]
  },
  businessRules: {
    mandatory: ["belongs_to_category", "has_price"],
    optional: ["related_products", "cross_sell_items", "up_sell_items"],
    forbidden: [
      {
        sourceType: "product",
        targetType: "competitor_product",
        reason: "business_policy_conflict"
      }
    ]
  }
}
```

## 🌐 그래프 탐색 엔진

### 양방향 탐색 알고리즘
```graphql
type GraphTraversalEngine {
  # 전방 탐색 (Outgoing Relations)
  exploreForward(
    startNodes: [String!]!
    relationFilters: RelationFilterInput
    traversalOptions: TraversalOptionsInput
  ): ForwardTraversalResult!
  
  # 후방 탐색 (Incoming Relations)  
  exploreBackward(
    targetNodes: [String!]!
    relationFilters: RelationFilterInput
    traversalOptions: TraversalOptionsInput
  ): BackwardTraversalResult!
  
  # 양방향 탐색
  exploreBidirectional(
    centerNodes: [String!]!
    relationFilters: RelationFilterInput
    traversalOptions: TraversalOptionsInput
  ): BidirectionalTraversalResult!
  
  # 경로 탐색
  findPaths(
    sourceNodes: [String!]!
    targetNodes: [String!]!
    pathConstraints: PathConstraintInput
  ): PathDiscoveryResult!
}

input TraversalOptionsInput {
  maxDepth: Int = 3
  direction: TraversalDirection = BOTH
  includeWeights: Boolean = true
  includeProperties: Boolean = false
  visitationStrategy: VisitationStrategy = BREADTH_FIRST
  nodeFilter: NodeFilterInput
  stopConditions: [StopConditionInput!]
  returnFormat: GraphReturnFormat = TREE
}

type BidirectionalTraversalResult {
  traversalId: String!
  centerNodes: [Node!]!
  forwardGraph: {
    connections: [Connection!]!
    reachableNodes: [Node!]!
    maxDepthReached: Int!
  }
  backwardGraph: {
    connections: [Connection!]!
    sourceNodes: [Node!]!
    maxDepthReached: Int!
  }
  intersections: [GraphIntersection!]!
  metrics: GraphMetrics!
  performanceStats: TraversalPerformance!
}
```

### 관계 강도 및 품질 분석
```graphql
type RelationshipQualityAnalysis {
  relationId: String!
  qualityMetrics: {
    strength: Int! # 0-4: 0=invalid, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=very_strong
    confidence: Int! # 0-4: 0=probably_wrong, 1=auto_generated, 2=uncertain_but_valid, 3=confident, 4=verified
    stability: Float! # 시간에 따른 안정성 (0.0 - 1.0)
    reciprocity: Float! # 양방향성 점수 (0.0 - 1.0)
    semanticCoherence: Float! # 의미적 일관성 (0.0 - 1.0)
  }
  evidenceFactors: {
    dataEvidence: [String!]! # 데이터 기반 증거
    patternEvidence: [String!]! # 패턴 매칭 증거  
    userEvidence: [String!]! # 사용자 행동 증거
    domainEvidence: [String!]! # 도메인 지식 증거
  }
  improvementSuggestions: [RelationImprovementSuggestion!]!
  riskFactors: [RelationRiskFactor!]!
}

query AnalyzeRelationshipQuality {
  analyzeRelationQuality(input: {
    relationIds: ["rel_123", "rel_456"]
    analysisDepth: COMPREHENSIVE
    includeRecommendations: true
  }) {
    analyses: [RelationshipQualityAnalysis!]!
    summaryInsights: {
      overallHealthScore: Float!
      criticalIssues: [String!]!
      optimizationOpportunities: [String!]!
      benchmarkComparison: QualityBenchmark!
    }
  }
}
```

## 🤖 지능형 관계 제안 시스템

### 컨텍스트 인식 관계 추천
```graphql
mutation GetRelationshipSuggestions {
  suggestRelationships(input: {
    sourceNodeId: "product_laptop_123"
    domain: "ecommerce"
    suggestionContext: {
      intent: "CROSS_SELL" # UPSELL, RELATED, SUBSTITUTE
      userProfile: {
        purchaseHistory: ["electronics", "accessories"]
        preferences: ["premium_brands", "latest_tech"]
        priceRange: { min: 500, max: 2000 }
      }
      businessRules: {
        profitMargin: { min: 0.15 }
        inventoryLevel: { min: 10 }
        seasonalFactor: "holiday_season"
      }
    }
    maxSuggestions: 10
    includeExplanation: true
  }) {
    suggestions: [RelationshipSuggestion!]!
    explanations: [SuggestionExplanation!]!
    alternativeStrategies: [AlternativeStrategy!]!
  }
}

type RelationshipSuggestion {
  targetNodeId: String!
  targetNodeContent: String!
  suggestedRelationType: String!
  confidence: Float!
  expectedImpact: {
    revenueImpact: Float
    conversionRate: Float
    customerSatisfaction: Float
  }
  reasoning: {
    primaryFactors: [String!]!
    supportingEvidence: [String!]!
    domainPatterns: [String!]!
    riskMitigation: [String!]!
  }
  implementationPriority: Priority!
}
```

## 📈 관계 성능 모니터링

### 관계 효과성 추적
```graphql
type RelationshipPerformanceMetrics {
  relationId: String!
  performanceData: {
    utilizationRate: Float! # 관계 활용도
    traversalFrequency: Int! # 탐색 빈도
    userEngagement: Float! # 사용자 참여도
    businessImpact: Float! # 비즈니스 영향도
  }
  trendAnalysis: {
    performanceTrend: TrendDirection!
    growthRate: Float!
    seasonalPatterns: [SeasonalPattern!]!
    anomalies: [PerformanceAnomaly!]!
  }
  benchmarkComparison: {
    domainAverage: Float!
    topPerformers: [String!]!
    improvementPotential: Float!
  }
}

query GetRelationshipPerformance {
  getRelationPerformance(input: {
    relationIds: ["rel_123", "rel_456"]
    timeRange: {
      startDate: "2024-01-01"
      endDate: "2024-12-31"
    }
    includeProjections: true
  }) {
    performanceMetrics: [RelationshipPerformanceMetrics!]!
    aggregateInsights: {
      topPerformingRelations: [String!]!
      underPerformingRelations: [String!]!
      optimizationOpportunities: [OptimizationOpportunity!]!
    }
  }
}
```

## 📏 관계 품질 컨벤션

### 관계 강도 (Strength) 레벨 정의
```yaml
strength_levels:
  0: # Invalid/Broken
    description: "무효하거나 깨진 관계"
    usage: "삭제 대상, 오류로 확인된 관계"
    example: "잘못 생성된 자동 관계, 데이터 불일치"
    
  1: # Auto Generated (기본값)
    description: "시스템에서 자동 생성된 관계"
    usage: "AI나 알고리즘으로 추론된 초기 관계"
    example: "도메인 패턴 매칭, 키워드 분석 결과"
    
  2: # Uncertain but Valid
    description: "긴가민가하지만 유효한 관계"
    usage: "낮은 신뢰도지만 유지할 가치가 있는 관계"
    example: "약한 연관성, 간접적 관계"
    
  3: # Confident
    description: "확실한 관계"
    usage: "명확한 증거가 있는 강한 관계"
    example: "명시적 종속성, 직접적 연관성"
    
  4: # Very Strong
    description: "매우 강력한 관계"
    usage: "핵심적이고 변경되지 않는 관계"
    example: "구조적 의존성, 필수 관계"
```

### 관계 신뢰도 (Confidence) 레벨 정의
```yaml
confidence_levels:
  0: # Probably Wrong
    description: "아마도 틀린 관계"
    usage: "검토 후 삭제 예정인 관계"
    example: "사용자가 의심스럽다고 표시한 관계"
    
  1: # Auto Generated (기본값)
    description: "자동 생성된 관계"
    usage: "아직 검증되지 않은 시스템 추론 관계"
    example: "패턴 매칭으로 생성된 관계"
    
  2: # Uncertain but Valid
    description: "확실하지 않지만 유효한 관계"
    usage: "부분적 검증이 된 관계"
    example: "일부 데이터로 확인된 관계"
    
  3: # Confident
    description: "확신하는 관계"
    usage: "충분한 증거로 검증된 관계"
    example: "사용자가 확인한 관계, 데이터로 검증된 관계"
    
  4: # Verified
    description: "완전히 검증된 관계"
    usage: "여러 소스로 교차 검증된 관계"
    example: "공식 문서 확인, 다중 증거 검증"
```

### 품질 관리 워크플로우
```graphql
# 관계 품질 업그레이드 예시
mutation UpdateRelationQuality {
  updateRelationQuality(input: {
    relationId: "rel_123"
    newStrength: 3
    newConfidence: 3
    evidence: [
      "User confirmed relationship accuracy"
      "Data analysis shows 85% correlation"
      "Domain expert validation completed"
    ]
    updatedBy: "user_456"
    updateReason: "Manual verification with supporting evidence"
  }) {
    success
    updatedRelation {
      id
      strength
      confidence
      lastUpdated
      updateHistory {
        timestamp
        previousStrength
        previousConfidence
        newStrength
        newConfidence
        updatedBy
        evidence
      }
    }
  }
}

# 품질 기반 관계 필터링
query GetHighQualityRelations {
  getRelationsByQuality(input: {
    tableId: "ecommerce_products"
    qualityFilter: {
      minStrength: 2
      minConfidence: 2
      excludeAutoGenerated: false
    }
    sortBy: "quality_score_desc"
  }) {
    relations {
      id
      strength
      confidence
      qualityScore # computed: (strength + confidence) / 8.0
      sourceNode { id, content }
      targetNode { id, content }
      relationType { identifier, description }
    }
    qualityStats {
      averageStrength: 2.1
      averageConfidence: 1.8
      totalRelations: 156
      qualityDistribution {
        high: 23    # strength >= 3, confidence >= 3
        medium: 89  # strength >= 2, confidence >= 2
        low: 44     # strength < 2 or confidence < 2
      }
    }
  }
}

# 품질 향상 제안
query GetQualityImprovementSuggestions {
  analyzeRelationQuality(input: {
    relationIds: ["rel_123", "rel_456", "rel_789"]
  }) {
    improvements {
      relationId
      currentQuality: { strength: 1, confidence: 1 }
      suggestedQuality: { strength: 2, confidence: 2 }
      improvementActions: [
        "Gather user feedback on relation accuracy"
        "Cross-validate with similar domain patterns"
        "Analyze usage frequency and engagement"
      ]
      expectedImpact: "Improved recommendation accuracy by 15%"
      estimatedEffort: "Low - automated analysis available"
    }
  }
}
```

### 자동 품질 관리
```typescript
// 관계 품질 자동 업데이트 로직
interface AutoQualityUpdateRule {
  trigger: 'usage_frequency' | 'user_feedback' | 'data_validation' | 'time_decay'
  condition: Record<string, any>
  qualityChange: {
    strengthDelta: number
    confidenceDelta: number
    maxStrength?: number
    maxConfidence?: number
  }
  evidence: string[]
}

const autoQualityRules: AutoQualityUpdateRule[] = [
  {
    trigger: 'usage_frequency',
    condition: { traversalCount: '>10', timeWindow: '30days' },
    qualityChange: { strengthDelta: +1, confidenceDelta: +1, maxStrength: 3, maxConfidence: 3 },
    evidence: ['High usage frequency indicates valuable relationship']
  },
  {
    trigger: 'user_feedback',
    condition: { positiveVotes: '>3', negativeVotes: '=0' },
    qualityChange: { strengthDelta: +1, confidenceDelta: +2, maxStrength: 4, maxConfidence: 4 },
    evidence: ['Positive user validation confirms relationship accuracy']
  },
  {
    trigger: 'data_validation',
    condition: { correlationScore: '>0.8', sampleSize: '>50' },
    qualityChange: { strengthDelta: +1, confidenceDelta: +1, maxStrength: 3, maxConfidence: 3 },
    evidence: ['Statistical correlation supports relationship validity']
  },
  {
    trigger: 'time_decay',
    condition: { lastValidated: '>90days', usageCount: '<5' },
    qualityChange: { strengthDelta: -1, confidenceDelta: -1 },
    evidence: ['Lack of recent usage suggests decreasing relevance']
  }
]
```

## 🔧 구현 전략

### Phase 1: 관계 발견 엔진
1. **도메인별 관계 카탈로그**: 표준 관계 유형 및 패턴 정의
2. **그래프 탐색 알고리즘**: 양방향 BFS/DFS 구현
3. **관계 강도 계산**: 다중 팩터 기반 점수 시스템
4. **백링크 인덱싱**: 효율적인 역방향 탐색 지원

### Phase 2: 지능형 제안 시스템  
1. **패턴 매칭 엔진**: ML 기반 관계 패턴 인식
2. **컨텍스트 분석**: 비즈니스 규칙 및 사용자 의도 분석
3. **품질 평가**: 관계 품질 및 효과성 측정
4. **실시간 추천**: 동적 관계 제안 시스템

### Phase 3: 성능 최적화
1. **인덱스 최적화**: 그래프 탐색 성능 향상
2. **캐싱 전략**: 자주 사용되는 패턴 캐싱
3. **병렬 처리**: 대규모 그래프 탐색 병렬화
4. **메트릭 수집**: 관계 성능 및 사용 패턴 분석

## 💡 활용 사례

### 1. 전자상거래 추천 시스템
- 상품 간 관계 자동 발견
- 구매 패턴 기반 관계 강도 조정
- 실시간 크로스셀/업셀 제안

### 2. 프로젝트 관리 시스템
- 작업 의존성 자동 탐지
- 병목 지점 식별 및 해결
- 리소스 최적화 제안

### 3. 지식 관리 시스템
- 개념 간 연관성 자동 구축
- 학습 경로 최적화
- 지식 격차 식별

이 확장된 관계 관리 시스템을 통해 사용자는 도메인 지식을 기반으로 복잡한 관계 네트워크를 효율적으로 탐색하고 관리할 수 있으며, AI 기반 인사이트를 통해 최적의 관계 구조를 구축할 수 있습니다.