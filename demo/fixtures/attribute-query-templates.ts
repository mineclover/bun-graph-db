/**
 * Attribute Query Templates
 * 
 * Template Management Guide 기반 Attribute 조회 템플릿 모음
 * 테이블 식별자/ID를 변수로 사용하는 Production-Ready 템플릿들
 */

export const attributeQueryTemplates = [
  // ==========================================
  // Basic Attribute Query Templates
  // ==========================================

  {
    identifier: "get-table-attributes-by-id",
    name: "Get Table Attributes by Table ID",
    description: "테이블 ID를 기반으로 해당 테이블의 모든 속성 조회 (관계형 데이터 포함)",
    query: `
      query GetTableAttributesById($tableId: ID!, $limit: Int = 50, $offset: Int = 0) {
        table(id: $tableId) {
          id
          identifier
          name
          description
          attributes {
            id
            identifier
            name
            description
            createdAt
            updatedAt
            attributeType {
              id
              identifier
              name
              dataType
              constraints
              defaultValue
            }
          }
        }
      }
    `,
    variables: {
      tableId: "1",
      limit: 50,
      offset: 0
    },
    tags: ["attribute", "table", "query", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 3.2,
    usagePattern: "data-analysis"
  },

  {
    identifier: "get-table-attributes-by-identifier", 
    name: "Get Table Attributes by Table Identifier",
    description: "테이블 식별자(identifier)를 기반으로 해당 테이블의 모든 속성 조회",
    query: `
      query GetTableAttributesByIdentifier($tableIdentifier: String!, $includeInactive: Boolean = false) {
        tables(filter: { identifier: $tableIdentifier }) {
          nodes {
            id
            identifier  
            name
            description
            nodeCount
            attributeCount
            attributes {
              id
              identifier
              name
              description
              createdAt
              updatedAt
              attributeType {
                id
                identifier
                name
                dataType
                constraints
                defaultValue
                createdAt
              }
            }
            createdAt
            updatedAt
          }
        }
      }
    `,
    variables: {
      tableIdentifier: "users",
      includeInactive: false
    },
    tags: ["attribute", "table", "identifier-based", "production"],
    operationType: "query", 
    version: "1.0.0",
    complexityScore: 3.5,
    usagePattern: "schema-analysis"
  },

  {
    identifier: "search-attributes-by-table-filter",
    name: "Search Attributes with Table Filtering",
    description: "고급 필터링과 페이지네이션을 사용한 테이블별 속성 검색",
    query: `
      query SearchAttributesByTableFilter(
        $tableId: ID
        $tableIdentifier: String
        $search: String
        $dataType: String
        $limit: Int = 20
        $offset: Int = 0
        $sortField: String = "name"
        $sortDirection: String = "ASC"
      ) {
        attributes(
          filter: {
            tableId: $tableId
            search: $search
            attributeTypeId: null
          }
          pagination: { limit: $limit, offset: $offset }
          sort: [{ field: $sortField, direction: $sortDirection }]
        ) {
          nodes {
            id
            identifier
            name
            description
            createdAt
            updatedAt
            
            # 속성 타입 정보
            attributeType {
              id
              identifier
              name
              dataType
              constraints
              defaultValue
            }
            
            # 연결된 테이블 정보
            table {
              id
              identifier
              name
              nodeCount
              attributeCount
            }
          }
          totalCount
          hasNextPage
          hasPreviousPage
        }
        
        # 테이블 식별자로도 조회 지원
        tableByIdentifier: tables(filter: { identifier: $tableIdentifier }) @include(if: $tableIdentifier) {
          nodes {
            id
            identifier
            name
            attributes {
              totalCount: id  # 속성 개수 확인용
            }
          }
        }
      }
    `,
    variables: {
      tableId: null,
      tableIdentifier: "users", 
      search: "",
      dataType: "",
      limit: 20,
      offset: 0,
      sortField: "name",
      sortDirection: "ASC"
    },
    tags: ["attribute", "search", "advanced", "pagination", "production"],
    operationType: "query",
    version: "1.0.0", 
    complexityScore: 4.1,
    usagePattern: "administrative-interface"
  },

  // ==========================================
  // Analytical Attribute Query Templates
  // ==========================================

  {
    identifier: "analyze-table-schema-attributes",
    name: "Table Schema Attribute Analysis", 
    description: "테이블의 전체 스키마 구조 분석 (속성 타입, 제약조건, 통계 포함)",
    query: `
      query AnalyzeTableSchemaAttributes($tableId: ID, $tableIdentifier: String) {
        # ID로 조회
        tableById: table(id: $tableId) @include(if: $tableId) {
          id
          identifier
          name
          description
          nodeCount
          attributeCount
          createdAt
          
          attributes {
            id
            identifier
            name
            description
            attributeType {
              id
              identifier
              name
              dataType
              constraints
              defaultValue
            }
          }
        }
        
        # 식별자로 조회
        tableByIdentifier: tables(filter: { identifier: $tableIdentifier }) @include(if: $tableIdentifier) {
          nodes {
            id
            identifier
            name
            description
            nodeCount
            attributeCount
            createdAt
            
            attributes {
              id
              identifier
              name
              description
              createdAt
              attributeType {
                id
                identifier
                name
                dataType
                constraints
                defaultValue
                createdAt
              }
            }
          }
        }
        
        # 속성 타입별 통계
        attributeTypeStats: attributeTypes(pagination: { limit: 100 }) {
          nodes {
            id
            identifier
            name
            dataType
            createdAt
          }
          totalCount
        }
      }
    `,
    variables: {
      tableId: null,
      tableIdentifier: "users"
    },
    tags: ["attribute", "schema", "analysis", "statistics", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 4.5,
    usagePattern: "data-modeling"
  },

  {
    identifier: "get-attribute-type-usage-by-table",
    name: "Attribute Type Usage by Table",
    description: "특정 테이블에서 사용되는 속성 타입들의 사용 현황 분석",
    query: `
      query GetAttributeTypeUsageByTable($tableId: ID, $tableIdentifier: String, $dataTypeFilter: String) {
        # 테이블 정보 조회 (ID 우선)
        targetTable: table(id: $tableId) @include(if: $tableId) {
          id
          identifier
          name
          attributeCount
          
          attributes {
            id
            identifier
            attributeType {
              id
              identifier
              name
              dataType
              constraints
            }
          }
        }
        
        # 테이블 정보 조회 (식별자 기반)
        targetTableByIdentifier: tables(filter: { identifier: $tableIdentifier }) @include(if: $tableIdentifier) {
          nodes {
            id
            identifier
            name
            attributeCount
            
            attributes {
              id  
              identifier
              attributeType {
                id
                identifier
                name
                dataType
                constraints
              }
            }
          }
        }
        
        # 전체 속성 타입 현황
        allAttributeTypes: attributeTypes(
          filter: { dataType: $dataTypeFilter }
          pagination: { limit: 100 }
          sort: [{ field: "name", direction: "ASC" }]
        ) {
          nodes {
            id
            identifier
            name
            dataType
            constraints
            defaultValue
            createdAt
          }
          totalCount
        }
        
        # 속성 사용 현황 (테이블 필터링)
        attributeUsage: attributes(
          filter: { tableId: $tableId }
          pagination: { limit: 100 }
        ) @include(if: $tableId) {
          nodes {
            id
            identifier
            name
            attributeType {
              dataType
              name
            }
          }
          totalCount
        }
      }
    `,
    variables: {
      tableId: null,
      tableIdentifier: "users",
      dataTypeFilter: ""
    },
    tags: ["attribute", "usage", "statistics", "type-analysis", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 4.2,
    usagePattern: "system-analysis"
  },

  // ==========================================
  // Multi-Table Attribute Templates  
  // ==========================================

  {
    identifier: "compare-table-attributes-schemas",
    name: "Compare Multiple Table Attribute Schemas",
    description: "여러 테이블의 속성 구조를 비교 분석 (스키마 호환성 검사용)",
    query: `
      query CompareTableAttributeSchemas($tableIds: [ID!], $tableIdentifiers: [String!]) {
        # ID 기반 테이블들 조회
        tablesById: nodes(ids: $tableIds) @include(if: $tableIds) {
          ... on Table {
            id
            identifier
            name
            attributeCount
            
            attributes {
              id
              identifier
              name
              description
              attributeType {
                id
                identifier
                name
                dataType
                constraints
                defaultValue
              }
            }
          }
        }
        
        # 전체 테이블 목록에서 식별자 매칭
        allTables: tables(pagination: { limit: 100 }) {
          nodes {
            id
            identifier
            name
            attributeCount
            
            # 지정된 식별자에 해당하는 테이블만 속성 포함
            attributes {
              id
              identifier  
              name
              description
              attributeType {
                id
                identifier
                name
                dataType
                constraints
              }
            }
          }
        }
      }
    `,
    variables: {
      tableIds: ["1", "2"],
      tableIdentifiers: ["users", "products"]
    },
    tags: ["attribute", "schema", "comparison", "multi-table", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 4.8,
    usagePattern: "schema-migration"
  },

  {
    identifier: "search-similar-attributes-across-tables",
    name: "Search Similar Attributes Across Tables", 
    description: "여러 테이블에 걸쳐 유사한 속성들을 검색 (중복 검사 및 표준화용)",
    query: `
      query SearchSimilarAttributesAcrossTables(
        $attributeNamePattern: String
        $dataType: String
        $includeTableIds: [ID!]
        $excludeTableIds: [ID!]
        $limit: Int = 50
      ) {
        # 속성 검색 (이름 패턴 기반)
        matchingAttributes: attributes(
          filter: {
            search: $attributeNamePattern
          }
          pagination: { limit: $limit }
          sort: [{ field: "name", direction: "ASC" }]
        ) {
          nodes {
            id
            identifier
            name
            description
            createdAt
            
            # 속성 타입 정보
            attributeType {
              id
              identifier
              name
              dataType
              constraints
              defaultValue
            }
            
            # 속한 테이블 정보
            table {
              id  
              identifier
              name
              nodeCount
            }
          }
          totalCount
        }
        
        # 특정 데이터 타입의 속성들
        attributesByType: attributeTypes(filter: { dataType: $dataType }) @include(if: $dataType) {
          nodes {
            id
            identifier
            name
            dataType
            constraints
          }
        }
        
        # 포함할 테이블들의 속성 현황
        includedTablesAttributes: nodes(ids: $includeTableIds) @include(if: $includeTableIds) {
          ... on Table {
            id
            identifier
            name
            attributes {
              id
              identifier
              name
              attributeType {
                dataType
                name
              }
            }
          }
        }
      }
    `,
    variables: {
      attributeNamePattern: "email",
      dataType: "String",
      includeTableIds: [],
      excludeTableIds: [],
      limit: 50
    },
    tags: ["attribute", "search", "similarity", "cross-table", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 4.3,
    usagePattern: "data-governance"
  },

  // ==========================================
  // Performance Optimized Templates
  // ==========================================

  {
    identifier: "quick-table-attribute-summary",
    name: "Quick Table Attribute Summary",
    description: "테이블별 속성 개요 정보를 빠르게 조회 (대시보드용 최적화)",
    query: `
      query QuickTableAttributeSummary($tableId: ID, $tableIdentifier: String) {
        # 핵심 정보만 빠르게 조회
        table: table(id: $tableId) @include(if: $tableId) {
          id
          identifier
          name
          attributeCount
          nodeCount
          
          # 최소한의 속성 정보
          attributes {
            id
            identifier
            name
            attributeType {
              dataType
              name
            }
          }
        }
        
        # 식별자 기반 조회
        tableByIdentifier: tables(filter: { identifier: $tableIdentifier }) @include(if: $tableIdentifier) {
          nodes {
            id
            identifier
            name
            attributeCount
            nodeCount
            
            attributes {
              id
              identifier
              name
              attributeType {
                dataType
                name
              }
            }
          }
        }
      }
    `,
    variables: {
      tableId: null,
      tableIdentifier: "users"
    },
    tags: ["attribute", "summary", "performance", "dashboard", "production"],
    operationType: "query", 
    version: "1.0.0",
    complexityScore: 2.1,
    usagePattern: "dashboard-widget"
  },

  {
    identifier: "batch-table-attributes-lookup",
    name: "Batch Table Attributes Lookup",
    description: "여러 테이블의 속성을 한 번에 조회 (배치 처리 최적화)",
    query: `
      query BatchTableAttributesLookup(
        $tableIds: [ID!]
        $tableIdentifiers: [String!] 
        $includeAttributeTypes: Boolean = true
        $limit: Int = 100
      ) {
        # 여러 테이블 일괄 조회 (ID 기반)
        tables: nodes(ids: $tableIds) @include(if: $tableIds) {
          ... on Table {
            id
            identifier
            name
            attributeCount
            
            attributes {
              id
              identifier
              name
              attributeType @include(if: $includeAttributeTypes) {
                id
                dataType
                name
              }
            }
          }
        }
        
        # 테이블 목록에서 식별자 매칭 조회
        tablesByIdentifiers: tables(
          filter: {}
          pagination: { limit: $limit }
        ) {
          nodes {
            id
            identifier
            name
            attributeCount
            
            # 조건부 속성 데이터 포함
            attributes @include(if: $includeAttributeTypes) {
              id
              identifier
              name
              attributeType {
                id
                dataType
                name
                constraints
              }
            }
          }
        }
        
        # 전체 통계 정보
        summary: {
          totalTables: tables { totalCount }
          totalAttributes: attributes { totalCount } 
          totalAttributeTypes: attributeTypes { totalCount }
        }
      }
    `,
    variables: {
      tableIds: [],
      tableIdentifiers: ["users", "products", "orders"],
      includeAttributeTypes: true,
      limit: 100
    },
    tags: ["attribute", "batch", "performance", "bulk-operation", "production"],
    operationType: "query",
    version: "1.0.0",
    complexityScore: 3.8,
    usagePattern: "bulk-processing"
  }
]

// 성능 테스트용 Attribute 쿼리 템플릿 생성기
export function generateAttributeQueryPerformanceTemplates(count: number = 10) {
  const templates = []
  const tableIdentifiers = ['users', 'products', 'orders', 'customers', 'inventory']
  
  for (let i = 1; i <= count; i++) {
    const tableIdentifier = tableIdentifiers[i % tableIdentifiers.length]
    
    templates.push({
      identifier: `perf-attr-query-${i.toString().padStart(3, '0')}`,
      name: `Attribute Query Performance Test ${i}`,
      description: `자동 생성 속성 쿼리 성능 테스트 템플릿 #${i}`,
      query: `
        query PerfAttributeQuery${i}($tableIdentifier: String!, $limit: Int = 20) {
          tables(filter: { identifier: $tableIdentifier }) {
            nodes {
              id
              identifier
              name
              attributeCount
              attributes {
                id
                identifier
                name
                attributeType {
                  dataType
                  name
                  constraints
                }
              }
            }
          }
        }
      `,
      variables: {
        tableIdentifier: tableIdentifier,
        limit: Math.min(50, i % 30 + 10)
      },
      tags: ['performance', 'attribute-query', 'auto-generated', `test-${i}`],
      operationType: 'query',
      version: '1.0.0',
      complexityScore: Math.round((2.0 + (i % 3) * 0.5) * 10) / 10,
      usagePattern: 'performance-testing'
    })
  }
  
  return templates
}

// Production용 Attribute 관리 템플릿 생성기
export function generateProductionAttributeTemplates() {
  return [
    {
      identifier: "production-table-attribute-audit",
      name: "Production Table Attribute Audit",
      description: "프로덕션 환경에서 테이블 속성 감사 및 검증",
      query: `
        query ProductionTableAttributeAudit($tableIdentifier: String!, $checkConstraints: Boolean = true) {
          tables(filter: { identifier: $tableIdentifier }) {
            nodes {
              id
              identifier
              name
              description
              nodeCount
              attributeCount
              createdAt
              updatedAt
              
              attributes {
                id
                identifier
                name
                description
                createdAt
                updatedAt
                
                attributeType {
                  id
                  identifier
                  name
                  dataType
                  constraints @include(if: $checkConstraints)
                  defaultValue
                  createdAt
                }
              }
            }
          }
        }
      `,
      variables: {
        tableIdentifier: "users",
        checkConstraints: true
      },
      tags: ["production", "audit", "attribute", "compliance"],
      operationType: "query",
      version: "1.0.0",
      complexityScore: 3.7,
      usagePattern: "compliance-audit"
    },
    
    {
      identifier: "production-attribute-health-check",
      name: "Production Attribute Health Check", 
      description: "프로덕션 속성 시스템 상태 확인 및 이상 탐지",
      query: `
        query ProductionAttributeHealthCheck($tableIds: [ID!], $alertThreshold: Int = 1000) {
          # 지정된 테이블들의 상태 확인
          criticalTables: nodes(ids: $tableIds) {
            ... on Table {
              id
              identifier
              name
              nodeCount
              attributeCount
              
              # 속성 구조 무결성 확인
              attributes {
                id
                identifier
                name
                attributeType {
                  id
                  dataType
                  constraints
                }
              }
            }
          }
          
          # 전체 시스템 통계
          systemHealth: {
            totalTables: tables { totalCount }
            totalAttributes: attributes { totalCount }
            totalAttributeTypes: attributeTypes { totalCount }
          }
          
          # 최근 생성된 속성들 (이상 패턴 감지용)
          recentAttributes: attributes(
            sort: [{ field: "createdAt", direction: "DESC" }]
            pagination: { limit: 20 }
          ) {
            nodes {
              id
              identifier
              createdAt
              table {
                identifier
              }
              attributeType {
                dataType
              }
            }
          }
        }
      `,
      variables: {
        tableIds: ["1", "2", "3"],
        alertThreshold: 1000
      },
      tags: ["production", "health-check", "monitoring", "attribute"],
      operationType: "query",
      version: "1.0.0", 
      complexityScore: 4.0,
      usagePattern: "system-monitoring"
    }
  ]
}