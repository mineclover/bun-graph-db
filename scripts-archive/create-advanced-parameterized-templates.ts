#!/usr/bin/env bun

/**
 * Create Advanced Parameterized Templates
 *
 * 고급 분석, 리포팅, 자동화 기능들의 파라미터를 노출하는 템플릿들을 생성하는 스크립트
 */

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface AdvancedTemplate {
  identifier: string
  name: string
  description: string
  query: string
  tags: string[]
  defaultVariables?: Record<string, any>
  variablesSchema?: Record<string, any>
  complexityScore?: number
}

// 고급 파라미터화 템플릿들
const advancedParameterizedTemplates: AdvancedTemplate[] = [
  // 1. 고급 분석 및 통계 쿼리들
  {
    identifier: 'analyze-table-relationships-with-params',
    name: 'Analyze Table Relationships With Parameters',
    description: '파라미터를 사용하여 테이블 간 관계를 분석합니다',
    query: `query AnalyzeTableRelationshipsWithParams($tableId: ID!, $depth: Int, $includeStats: Boolean) {
  analyzeTableRelationships(tableId: $tableId, maxDepth: $depth, includeStatistics: $includeStats) {
    sourceTable {
      id
      identifier
      nodeCount
    }
    relationships {
      targetTable {
        id
        identifier
        nodeCount
      }
      relationshipType
      strength
      connectionCount
      bidirectional
    }
    statistics {
      totalRelationships
      strongRelationships
      weakRelationships
      averageStrength
      networkDensity
    }
    analysis {
      centralityScore
      clusteringCoefficient
      recommendations
    }
  }
}`,
    tags: ['table', 'analysis', 'relationships', 'statistics', 'parameterized', 'fixed'],
    defaultVariables: {
      tableId: 'example-table-id',
      depth: 2,
      includeStats: true,
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '분석할 테이블 ID',
      },
      depth: {
        type: 'number',
        description: '분석 깊이 (1-5)',
      },
      includeStats: {
        type: 'boolean',
        description: '통계 정보 포함 여부',
      },
    },
    complexityScore: 7,
  },

  {
    identifier: 'generate-table-report-with-params',
    name: 'Generate Table Report With Parameters',
    description: '파라미터를 사용하여 테이블 상세 리포트를 생성합니다',
    query: `query GenerateTableReportWithParams($tableId: ID!, $reportType: String!, $timeRange: String) {
  generateTableReport(tableId: $tableId, reportType: $reportType, timeRange: $timeRange) {
    table {
      id
      identifier
      description
      createdAt
      lastModified
    }
    summary {
      totalNodes
      totalAttributes
      totalRelationships
      dataQualityScore
      completenessScore
    }
    trends {
      nodeGrowth {
        period
        count
        growthRate
      }
      activityPatterns {
        timeOfDay
        dayOfWeek
        activity
      }
    }
    recommendations {
      type
      priority
      description
      estimatedImpact
    }
    exportOptions {
      formats
      estimatedSize
    }
  }
}`,
    tags: ['table', 'report', 'analytics', 'trends', 'parameterized', 'fixed'],
    defaultVariables: {
      tableId: 'example-table-id',
      reportType: 'COMPREHENSIVE',
      timeRange: '30d',
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '리포트 생성할 테이블 ID',
      },
      reportType: {
        type: 'string',
        required: true,
        description: '리포트 타입 (SUMMARY, DETAILED, COMPREHENSIVE)',
      },
      timeRange: {
        type: 'string',
        description: '분석 기간 (7d, 30d, 90d, 1y)',
      },
    },
    complexityScore: 8,
  },

  // 2. 데이터 품질 및 검증 쿼리들
  {
    identifier: 'validate-data-quality-with-params',
    name: 'Validate Data Quality With Parameters',
    description: '파라미터를 사용하여 데이터 품질을 검증합니다',
    query: `query ValidateDataQualityWithParams($scope: DataValidationScope!, $checks: [ValidationCheckType!], $options: ValidationOptions) {
  validateDataQuality(scope: $scope, checks: $checks, options: $options) {
    overallScore
    summary {
      totalChecks
      passedChecks
      failedChecks
      warningCount
    }
    results {
      checkType
      status
      score
      message
      affectedRecords
      recommendations
    }
    details {
      completeness {
        totalFields
        completeFields
        missingFields
        completenessRate
      }
      consistency {
        duplicates
        conflicts
        inconsistencies
      }
      accuracy {
        validRecords
        invalidRecords
        accuracyRate
      }
    }
    fixes {
      autoFixable
      manualRequired
      estimatedEffort
    }
  }
}`,
    tags: ['data', 'quality', 'validation', 'analytics', 'parameterized', 'fixed'],
    defaultVariables: {
      scope: {
        tableIds: ['example-table-id'],
        includeRelationships: true,
      },
      checks: ['COMPLETENESS', 'CONSISTENCY', 'ACCURACY', 'DUPLICATES'],
      options: {
        sampleSize: 1000,
        strictMode: false,
        generateReport: true,
      },
    },
    variablesSchema: {
      scope: {
        type: 'object',
        required: true,
        properties: {
          tableIds: { type: 'array', description: '검증할 테이블 ID 목록' },
          includeRelationships: { type: 'boolean', description: '관계 데이터 포함 여부' },
        },
      },
      checks: {
        type: 'array',
        description: '수행할 검증 항목들',
      },
      options: {
        type: 'object',
        properties: {
          sampleSize: { type: 'number', description: '샘플 크기' },
          strictMode: { type: 'boolean', description: '엄격 모드' },
          generateReport: { type: 'boolean', description: '리포트 생성 여부' },
        },
      },
    },
    complexityScore: 8,
  },

  // 3. 성능 모니터링 및 최적화 쿼리들
  {
    identifier: 'analyze-query-performance-with-params',
    name: 'Analyze Query Performance With Parameters',
    description: '파라미터를 사용하여 쿼리 성능을 분석합니다',
    query: `query AnalyzeQueryPerformanceWithParams($timeRange: String!, $queryTypes: [String!], $threshold: Float) {
  analyzeQueryPerformance(timeRange: $timeRange, queryTypes: $queryTypes, slowQueryThreshold: $threshold) {
    summary {
      totalQueries
      avgExecutionTime
      slowQueries
      fastQueries
      errorRate
    }
    slowQueries {
      query
      avgExecutionTime
      executionCount
      lastExecuted
      optimization {
        suggestions
        expectedImprovement
        complexity
      }
    }
    patterns {
      peakHours
      commonPatterns
      bottlenecks
    }
    recommendations {
      indexSuggestions {
        table
        columns
        estimatedImprovement
        creationCost
      }
      queryOptimizations {
        original
        optimized
        improvement
      }
      cacheStrategies {
        queries
        ttl
        hitRate
      }
    }
  }
}`,
    tags: ['performance', 'query', 'optimization', 'monitoring', 'parameterized', 'fixed'],
    defaultVariables: {
      timeRange: '24h',
      queryTypes: ['QUERY', 'MUTATION'],
      threshold: 100.0,
    },
    variablesSchema: {
      timeRange: {
        type: 'string',
        required: true,
        description: '분석 기간 (1h, 24h, 7d)',
      },
      queryTypes: {
        type: 'array',
        description: '분석할 쿼리 타입들',
      },
      threshold: {
        type: 'number',
        description: '느린 쿼리 임계값 (ms)',
      },
    },
    complexityScore: 7,
  },

  // 4. 자동화 및 배치 작업 쿼리들
  {
    identifier: 'schedule-maintenance-tasks-with-params',
    name: 'Schedule Maintenance Tasks With Parameters',
    description: '파라미터를 사용하여 유지보수 작업을 예약합니다',
    query: `mutation ScheduleMaintenanceTasksWithParams($tasks: [MaintenanceTaskInput!]!, $schedule: ScheduleInput!) {
  scheduleMaintenanceTasks(tasks: $tasks, schedule: $schedule) {
    success
    scheduledTasks {
      id
      type
      description
      estimatedDuration
      priority
      dependencies
      resources
    }
    schedule {
      startTime
      endTime
      frequency
      nextExecution
    }
    impact {
      affectedTables
      estimatedDowntime
      userImpact
      rollbackPlan
    }
    monitoring {
      checkpoints
      alertThresholds
      notificationChannels
    }
  }
}`,
    tags: ['maintenance', 'automation', 'schedule', 'batch', 'parameterized', 'fixed'],
    defaultVariables: {
      tasks: [
        {
          type: 'CLEANUP_ORPHANED_NODES',
          priority: 'MEDIUM',
          options: {
            dryRun: false,
            batchSize: 100,
          },
        },
        {
          type: 'REBUILD_INDEXES',
          priority: 'LOW',
          tables: ['example-table-id'],
        },
      ],
      schedule: {
        frequency: 'WEEKLY',
        startTime: '02:00',
        timezone: 'UTC',
        maintainWindow: 120,
      },
    },
    variablesSchema: {
      tasks: {
        type: 'array',
        required: true,
        description: '수행할 유지보수 작업 목록',
      },
      schedule: {
        type: 'object',
        required: true,
        properties: {
          frequency: { type: 'string', description: '실행 빈도 (DAILY, WEEKLY, MONTHLY)' },
          startTime: { type: 'string', description: '시작 시간 (HH:MM)' },
          timezone: { type: 'string', description: '시간대' },
          maintainWindow: { type: 'number', description: '유지보수 시간 (분)' },
        },
      },
    },
    complexityScore: 9,
  },

  // 5. 데이터 마이그레이션 및 동기화 쿼리들
  {
    identifier: 'migrate-data-with-params',
    name: 'Migrate Data With Parameters',
    description: '파라미터를 사용하여 데이터를 마이그레이션합니다',
    query: `mutation MigrateDataWithParams($source: DataSourceInput!, $target: DataTargetInput!, $options: MigrationOptions!) {
  migrateData(source: $source, target: $target, options: $options) {
    success
    migrationId
    status
    progress {
      totalRecords
      processedRecords
      successfulRecords
      failedRecords
      percentage
      estimatedTimeRemaining
    }
    mapping {
      fieldMappings {
        sourceField
        targetField
        transformation
        validated
      }
      relationships {
        sourceTable
        targetTable
        preserveReferences
      }
    }
    validation {
      preChecks
      postChecks
      dataIntegrity
      schemaCompatibility
    }
    rollback {
      available
      estimatedTime
      dependencies
    }
  }
}`,
    tags: ['migration', 'data', 'sync', 'batch', 'parameterized', 'fixed'],
    defaultVariables: {
      source: {
        type: 'TABLE',
        identifier: 'source-table-id',
        filters: {
          dateRange: '2024-01-01,2024-12-31',
        },
      },
      target: {
        type: 'TABLE',
        identifier: 'target-table-id',
        createIfNotExists: true,
      },
      options: {
        batchSize: 500,
        validateBeforeMigration: true,
        preserveRelationships: true,
        handleConflicts: 'SKIP',
        generateReport: true,
      },
    },
    variablesSchema: {
      source: {
        type: 'object',
        required: true,
        properties: {
          type: { type: 'string', description: '소스 타입 (TABLE, FILE, API)' },
          identifier: { type: 'string', description: '소스 식별자' },
          filters: { type: 'object', description: '필터 조건' },
        },
      },
      target: {
        type: 'object',
        required: true,
        properties: {
          type: { type: 'string', description: '대상 타입' },
          identifier: { type: 'string', description: '대상 식별자' },
          createIfNotExists: { type: 'boolean', description: '없으면 생성 여부' },
        },
      },
      options: {
        type: 'object',
        required: true,
        properties: {
          batchSize: { type: 'number', description: '배치 크기' },
          validateBeforeMigration: { type: 'boolean', description: '마이그레이션 전 검증' },
          preserveRelationships: { type: 'boolean', description: '관계 보존 여부' },
          handleConflicts: { type: 'string', description: '충돌 처리 방식' },
        },
      },
    },
    complexityScore: 9,
  },

  // 6. 협업 및 버전 관리 쿼리들
  {
    identifier: 'track-changes-with-params',
    name: 'Track Changes With Parameters',
    description: '파라미터를 사용하여 변경 사항을 추적합니다',
    query: `query TrackChangesWithParams($scope: ChangeTrackingScope!, $timeRange: String, $changeTypes: [ChangeType!]) {
  trackChanges(scope: $scope, timeRange: $timeRange, changeTypes: $changeTypes) {
    summary {
      totalChanges
      changesByType {
        type
        count
        percentage
      }
      mostActiveUsers
      mostChangedTables
    }
    changes {
      id
      timestamp
      user {
        id
        name
      }
      type
      entity {
        type
        id
        name
      }
      changes {
        field
        oldValue
        newValue
        operation
      }
      metadata {
        source
        version
        comments
      }
    }
    analytics {
      patterns {
        timeOfDay
        dayOfWeek
        frequency
      }
      trends {
        changeVelocity
        userActivity
        dataGrowth
      }
    }
    conflicts {
      potentialConflicts
      resolved
      pending
    }
  }
}`,
    tags: ['tracking', 'changes', 'collaboration', 'versioning', 'parameterized', 'fixed'],
    defaultVariables: {
      scope: {
        tables: ['example-table-id'],
        includeSystemChanges: false,
      },
      timeRange: '7d',
      changeTypes: ['CREATE', 'UPDATE', 'DELETE'],
    },
    variablesSchema: {
      scope: {
        type: 'object',
        required: true,
        properties: {
          tables: { type: 'array', description: '추적할 테이블 목록' },
          includeSystemChanges: { type: 'boolean', description: '시스템 변경 포함 여부' },
        },
      },
      timeRange: {
        type: 'string',
        description: '추적 기간',
      },
      changeTypes: {
        type: 'array',
        description: '추적할 변경 타입들',
      },
    },
    complexityScore: 6,
  },

  // 7. 고급 검색 및 추천 시스템
  {
    identifier: 'smart-search-with-params',
    name: 'Smart Search With Parameters',
    description: '파라미터를 사용하여 지능형 검색을 수행합니다',
    query: `query SmartSearchWithParams($query: String!, $context: SearchContext, $options: SmartSearchOptions) {
  smartSearch(query: $query, context: $context, options: $options) {
    results {
      nodes {
        id
        title
        content
        relevanceScore
        matchedFields
        highlights
        relationships {
          id
          title
          relationshipType
          strength
        }
      }
      tables {
        id
        identifier
        description
        relevanceScore
        matchReason
      }
      templates {
        id
        identifier
        name
        relevanceScore
        suggestedVariables
      }
    }
    suggestions {
      queryCorrections
      semanticExpansions
      relatedTerms
      filters
    }
    analytics {
      searchTime
      indexesUsed
      cacheHit
      resultsCount
    }
    recommendations {
      type
      items
      confidence
      reasoning
    }
  }
}`,
    tags: ['search', 'ai', 'smart', 'recommendations', 'parameterized', 'fixed'],
    defaultVariables: {
      query: 'example search term',
      context: {
        userId: 'current-user',
        previousSearches: [],
        currentTable: null,
      },
      options: {
        includeRelated: true,
        fuzzyMatch: true,
        semanticSearch: true,
        maxResults: 50,
        boostRecent: true,
      },
    },
    variablesSchema: {
      query: {
        type: 'string',
        required: true,
        description: '검색 쿼리',
      },
      context: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '사용자 ID' },
          previousSearches: { type: 'array', description: '이전 검색 기록' },
          currentTable: { type: 'string', description: '현재 테이블 컨텍스트' },
        },
      },
      options: {
        type: 'object',
        properties: {
          includeRelated: { type: 'boolean', description: '관련 항목 포함' },
          fuzzyMatch: { type: 'boolean', description: '유사 매칭' },
          semanticSearch: { type: 'boolean', description: '의미 기반 검색' },
          maxResults: { type: 'number', description: '최대 결과 수' },
        },
      },
    },
    complexityScore: 8,
  },
]

async function createTemplate(template: AdvancedTemplate) {
  const mutation = `
    mutation CreateTemplate($input: CreateQueryTemplateInput!) {
      createTemplate(input: $input) {
        success
        template {
          id
          identifier
          name
        }
        errors {
          message
        }
      }
    }
  `

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            identifier: template.identifier,
            name: template.name,
            description: template.description,
            query: template.query,
            tags: template.tags,
            defaultVariables: template.defaultVariables,
            variablesSchema: template.variablesSchema,
            complexityScore: template.complexityScore || 5,
            version: '1.0.0',
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    if (!data.data.createTemplate.success) {
      throw new Error(`생성 실패: ${JSON.stringify(data.data.createTemplate.errors)}`)
    }

    return {
      success: true,
      template: data.data.createTemplate.template,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🚀 고급 파라미터화 템플릿 생성 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📋 생성할 템플릿 수: ${advancedParameterizedTemplates.length}개`)

  const results = []

  for (const template of advancedParameterizedTemplates) {
    console.log(`\n🔄 생성 중: ${template.identifier}`)

    const result = await createTemplate(template)
    results.push({ template, result })

    if (result.success) {
      console.log(`  ✅ 성공: ${template.name}`)
      console.log(`  📝 ID: ${result.template.id}`)
      console.log(`  🎯 복잡도: ${template.complexityScore}/10`)
      console.log(`  🏷️ 카테고리: [${template.tags.slice(0, 3).join(', ')}]`)
    } else {
      console.log(`  ❌ 실패: ${result.error}`)
    }

    // 서버 부하 방지를 위한 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  // 결과 요약
  console.log('\n📊 생성 결과 요약:')
  const successful = results.filter((r) => r.result.success)
  const failed = results.filter((r) => !r.result.success)

  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)

  if (successful.length > 0) {
    console.log('\n✅ 생성된 고급 템플릿들:')
    successful.forEach((s) => {
      const isQuery = s.template.tags.includes('query') || !s.template.tags.includes('mutation')
      const category = isQuery ? '🔍' : '🔧'
      const domain =
        s.template.tags.find((tag) =>
          ['table', 'node', 'attribute', 'template', 'system', 'data', 'performance'].includes(tag)
        ) || 'general'
      const complexity =
        s.template.complexityScore >= 8 ? '🔥' : s.template.complexityScore >= 6 ? '⚡' : '📊'
      console.log(
        `  ${category}${complexity} ${s.template.identifier}: ${s.template.name} [${domain}]`
      )
    })
  }

  if (failed.length > 0) {
    console.log('\n❌ 실패한 템플릿들:')
    failed.forEach((f) => {
      console.log(`  - ${f.template.identifier}: ${f.result.error}`)
    })
  }

  console.log('\n🎉 고급 파라미터화 템플릿 생성 완료!')
  console.log('\n💡 기능별 템플릿 카테고리:')
  console.log('  📊 Analytics & Reporting: 테이블 관계 분석, 리포트 생성')
  console.log('  🔍 Data Quality: 데이터 품질 검증, 일관성 체크')
  console.log('  ⚡ Performance: 쿼리 성능 분석, 최적화 제안')
  console.log('  🤖 Automation: 유지보수 스케줄링, 배치 작업')
  console.log('  🔄 Migration: 데이터 마이그레이션, 동기화')
  console.log('  📝 Collaboration: 변경 추적, 버전 관리')
  console.log('  🧠 Smart Features: 지능형 검색, AI 추천')
  console.log('\n💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 고급 분석 템플릿으로 데이터 인사이트 획득')
  console.log('  3. 자동화 템플릿으로 운영 효율성 향상')
  console.log('  4. 지능형 검색으로 정확한 정보 발견')
}

// 스크립트 실행
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 스크립트 실행 중 오류:', error)
    process.exit(1)
  })
}
