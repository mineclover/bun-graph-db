#!/usr/bin/env bun

/**
 * 관계(Relation) 특화 파라미터화 템플릿 생성 스크립트
 *
 * 포함 템플릿:
 * 1. 기본 관계 CRUD 작업
 * 2. 관계 검색 및 필터링
 * 3. 관계 분석 및 통계
 * 4. 관계 네트워크 분석
 * 5. 관계 품질 관리
 */

interface RelationTemplate {
  identifier: string
  name: string
  description: string
  query: string
  variables: Record<string, any>
  variablesSchema: Record<string, any>
  defaultVariables: Record<string, any>
  tags: string[]
  complexityScore: number
  category: string
}

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

const relationTemplates: RelationTemplate[] = [
  // 1. 기본 관계 CRUD 작업
  {
    identifier: 'create-relation-with-params',
    name: 'CreateRelationWithParams',
    description: '두 노드 간의 관계를 생성합니다 (파라미터화)',
    query: `mutation CreateRelation($input: CreateRelationInput!) {
  createRelation(input: $input) {
    success
    relation {
      id
      sourceNodeId
      targetNodeId
      relationType
      strength
      confidence
      metadata
      createdAt
      isActive
    }
    errors {
      field
      message
      code
    }
  }
}`,
    variables: {
      input: {
        sourceNodeId: 'node-source-example',
        targetNodeId: 'node-target-example',
        relationType: 'RELATED_TO',
        strength: 0.8,
        confidence: 0.9,
        metadata: {
          category: 'semantic',
          direction: 'bidirectional',
        },
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: {
            type: 'string',
            description: '소스 노드 ID',
          },
          targetNodeId: {
            type: 'string',
            description: '타겟 노드 ID',
          },
          relationType: {
            type: 'string',
            description: '관계 타입 (RELATED_TO, DEPENDS_ON, CONTAINS 등)',
          },
          strength: {
            type: 'number',
            description: '관계 강도 (0.0-1.0)',
          },
          confidence: {
            type: 'number',
            description: '관계 신뢰도 (0.0-1.0)',
          },
          metadata: {
            type: 'object',
            description: '관계 메타데이터',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        sourceNodeId: 'node-source-example',
        targetNodeId: 'node-target-example',
        relationType: 'RELATED_TO',
        strength: 0.8,
        confidence: 0.9,
        metadata: {
          category: 'semantic',
          direction: 'bidirectional',
        },
      },
    },
    tags: ['relation', 'mutation', 'create', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  {
    identifier: 'update-relation-with-params',
    name: 'UpdateRelationWithParams',
    description: '기존 관계의 속성을 업데이트합니다 (파라미터화)',
    query: `mutation UpdateRelation($id: ID!, $input: UpdateRelationInput!) {
  updateRelation(id: $id, input: $input) {
    success
    relation {
      id
      sourceNodeId
      targetNodeId
      relationType
      strength
      confidence
      metadata
      updatedAt
      isActive
    }
    errors {
      field
      message
      code
    }
  }
}`,
    variables: {
      id: 'relation-example-id',
      input: {
        relationType: 'STRONGLY_RELATED',
        strength: 0.95,
        confidence: 0.85,
        metadata: {
          updated_reason: 'quality_improvement',
          reviewer: 'system',
        },
      },
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '업데이트할 관계 ID',
      },
      input: {
        type: 'object',
        required: true,
        properties: {
          relationType: {
            type: 'string',
            description: '새로운 관계 타입',
          },
          strength: {
            type: 'number',
            description: '새로운 관계 강도',
          },
          confidence: {
            type: 'number',
            description: '새로운 신뢰도',
          },
          metadata: {
            type: 'object',
            description: '업데이트할 메타데이터',
          },
        },
      },
    },
    defaultVariables: {
      id: 'relation-example-id',
      input: {
        relationType: 'STRONGLY_RELATED',
        strength: 0.95,
        confidence: 0.85,
        metadata: {
          updated_reason: 'quality_improvement',
        },
      },
    },
    tags: ['relation', 'mutation', 'update', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  {
    identifier: 'delete-relation-with-params',
    name: 'DeleteRelationWithParams',
    description: '관계를 삭제합니다 (파라미터화)',
    query: `mutation DeleteRelation($id: ID!, $options: DeleteOptions) {
  deleteRelation(id: $id, options: $options) {
    success
    deletedId
    errors {
      field
      message
      code
    }
  }
}`,
    variables: {
      id: 'relation-to-delete-id',
      options: {
        cascade: false,
        backup: true,
      },
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '삭제할 관계 ID',
      },
      options: {
        type: 'object',
        properties: {
          cascade: {
            type: 'boolean',
            description: '연관 데이터도 함께 삭제할지 여부',
          },
          backup: {
            type: 'boolean',
            description: '삭제 전 백업 생성 여부',
          },
        },
      },
    },
    defaultVariables: {
      id: 'relation-to-delete-id',
      options: {
        cascade: false,
        backup: true,
      },
    },
    tags: ['relation', 'mutation', 'delete', 'parameterized', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  // 2. 관계 검색 및 필터링
  {
    identifier: 'search-relations-with-params',
    name: 'SearchRelationsWithParams',
    description: '다양한 조건으로 관계를 검색합니다 (파라미터화)',
    query: `query SearchRelations($filter: RelationSearchFilter!, $pagination: Pagination, $sort: [RelationSortInput!]) {
  searchRelations(filter: $filter, pagination: $pagination, sort: $sort) {
    id
    sourceNodeId
    targetNodeId
    relationType
    strength
    confidence
    metadata
    createdAt
    updatedAt
    isActive
    sourceNode {
      id
      title
      content
    }
    targetNode {
      id
      title
      content
    }
  }
}`,
    variables: {
      filter: {
        relationType: 'RELATED_TO',
        strengthMin: 0.7,
        confidenceMin: 0.8,
        nodeIds: ['node1', 'node2'],
        isActive: true,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
      sort: [
        {
          field: 'strength',
          direction: 'DESC',
        },
      ],
    },
    variablesSchema: {
      filter: {
        type: 'object',
        required: true,
        properties: {
          relationType: {
            type: 'string',
            description: '관계 타입으로 필터링',
          },
          strengthMin: {
            type: 'number',
            description: '최소 관계 강도',
          },
          confidenceMin: {
            type: 'number',
            description: '최소 신뢰도',
          },
          nodeIds: {
            type: 'array',
            description: '특정 노드들과 연관된 관계만',
          },
          isActive: {
            type: 'boolean',
            description: '활성 관계만 조회',
          },
        },
      },
    },
    defaultVariables: {
      filter: {
        relationType: 'RELATED_TO',
        strengthMin: 0.7,
        confidenceMin: 0.8,
        isActive: true,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'search', 'filter', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 3. 관계 분석 및 통계
  {
    identifier: 'analyze-relation-patterns-with-params',
    name: 'AnalyzeRelationPatternsWithParams',
    description: '관계 패턴을 분석하고 통계를 제공합니다 (파라미터화)',
    query: `query AnalyzeRelationPatterns($analysis: RelationAnalysisInput!) {
  analyzeRelationPatterns(analysis: $analysis) {
    totalRelations
    relationTypeDistribution {
      type
      count
      percentage
      avgStrength
      avgConfidence
    }
    strengthDistribution {
      range
      count
      percentage
    }
    topConnectedNodes {
      nodeId
      incomingCount
      outgoingCount
      totalConnections
      avgStrength
    }
    qualityMetrics {
      avgStrength
      avgConfidence
      lowQualityCount
      duplicateCount
    }
    networkMetrics {
      density
      clustering
      centralityScores
    }
  }
}`,
    variables: {
      analysis: {
        scope: 'all',
        includeInactive: false,
        relationTypes: ['RELATED_TO', 'DEPENDS_ON'],
        strengthThreshold: 0.5,
        nodeLimit: 100,
      },
    },
    variablesSchema: {
      analysis: {
        type: 'object',
        required: true,
        properties: {
          scope: {
            type: 'string',
            description: '분석 범위 (all, table, node)',
          },
          includeInactive: {
            type: 'boolean',
            description: '비활성 관계 포함 여부',
          },
          relationTypes: {
            type: 'array',
            description: '분석할 관계 타입들',
          },
          strengthThreshold: {
            type: 'number',
            description: '분석에 포함할 최소 강도',
          },
          nodeLimit: {
            type: 'number',
            description: '분석할 최대 노드 수',
          },
        },
      },
    },
    defaultVariables: {
      analysis: {
        scope: 'all',
        includeInactive: false,
        relationTypes: ['RELATED_TO', 'DEPENDS_ON'],
        strengthThreshold: 0.5,
        nodeLimit: 100,
      },
    },
    tags: ['relation', 'query', 'analysis', 'statistics', 'parameterized', 'fixed'],
    complexityScore: 7,
    category: 'relation',
  },

  // 4. 관계 네트워크 분석
  {
    identifier: 'find-relation-paths-with-params',
    name: 'FindRelationPathsWithParams',
    description: '두 노드 간의 관계 경로를 찾습니다 (파라미터화)',
    query: `query FindRelationPaths($pathSearch: RelationPathInput!) {
  findRelationPaths(pathSearch: $pathSearch) {
    paths {
      length
      strength
      confidence
      nodes {
        id
        title
        type
      }
      relations {
        id
        relationType
        strength
        confidence
      }
    }
    statistics {
      totalPaths
      avgLength
      maxStrength
      shortestPath
    }
  }
}`,
    variables: {
      pathSearch: {
        sourceNodeId: 'start-node-id',
        targetNodeId: 'end-node-id',
        maxDepth: 5,
        minStrength: 0.3,
        relationTypes: ['RELATED_TO', 'CONTAINS'],
        algorithm: 'dijkstra',
      },
    },
    variablesSchema: {
      pathSearch: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: {
            type: 'string',
            description: '시작 노드 ID',
          },
          targetNodeId: {
            type: 'string',
            description: '목표 노드 ID',
          },
          maxDepth: {
            type: 'number',
            description: '최대 탐색 깊이',
          },
          minStrength: {
            type: 'number',
            description: '경로에 포함할 최소 관계 강도',
          },
          relationTypes: {
            type: 'array',
            description: '탐색할 관계 타입들',
          },
          algorithm: {
            type: 'string',
            description: '경로 탐색 알고리즘',
          },
        },
      },
    },
    defaultVariables: {
      pathSearch: {
        sourceNodeId: 'start-node-id',
        targetNodeId: 'end-node-id',
        maxDepth: 5,
        minStrength: 0.3,
        relationTypes: ['RELATED_TO', 'CONTAINS'],
        algorithm: 'dijkstra',
      },
    },
    tags: ['relation', 'query', 'path', 'network', 'parameterized', 'fixed'],
    complexityScore: 8,
    category: 'relation',
  },

  // 5. 관계 품질 관리
  {
    identifier: 'validate-relation-quality-with-params',
    name: 'ValidateRelationQualityWithParams',
    description: '관계 품질을 검증하고 개선 제안을 제공합니다 (파라미터화)',
    query: `query ValidateRelationQuality($validation: RelationValidationInput!) {
  validateRelationQuality(validation: $validation) {
    summary {
      totalRelations
      validRelations
      invalidRelations
      qualityScore
    }
    issues {
      type
      severity
      count
      relations {
        id
        issue
        recommendation
      }
    }
    recommendations {
      category
      priority
      action
      expectedImprovement
    }
    qualityMetrics {
      strengthDistribution
      confidenceDistribution
      duplicateCount
      orphanCount
    }
  }
}`,
    variables: {
      validation: {
        scope: 'all',
        checks: ['duplicates', 'orphans', 'low_quality', 'consistency'],
        thresholds: {
          minStrength: 0.1,
          minConfidence: 0.1,
          maxDuplicates: 0,
        },
        autoFix: false,
      },
    },
    variablesSchema: {
      validation: {
        type: 'object',
        required: true,
        properties: {
          scope: {
            type: 'string',
            description: '검증 범위',
          },
          checks: {
            type: 'array',
            description: '수행할 검증 항목들',
          },
          thresholds: {
            type: 'object',
            description: '품질 기준 임계값들',
          },
          autoFix: {
            type: 'boolean',
            description: '자동 수정 여부',
          },
        },
      },
    },
    defaultVariables: {
      validation: {
        scope: 'all',
        checks: ['duplicates', 'orphans', 'low_quality', 'consistency'],
        thresholds: {
          minStrength: 0.1,
          minConfidence: 0.1,
          maxDuplicates: 0,
        },
        autoFix: false,
      },
    },
    tags: ['relation', 'query', 'validation', 'quality', 'parameterized', 'fixed'],
    complexityScore: 6,
    category: 'relation',
  },

  // 6. 관계 중복 제거
  {
    identifier: 'deduplicate-relations-with-params',
    name: 'DeduplicateRelationsWithParams',
    description: '중복된 관계를 찾아 제거하거나 병합합니다 (파라미터화)',
    query: `mutation DeduplicateRelations($deduplication: RelationDeduplicationInput!) {
  deduplicateRelations(deduplication: $deduplication) {
    success
    summary {
      totalProcessed
      duplicatesFound
      relationsRemoved
      relationsMerged
      qualityImprovement
    }
    operations {
      action
      relationIds
      result
      reason
    }
    errors {
      relationId
      error
      message
    }
  }
}`,
    variables: {
      deduplication: {
        strategy: 'merge_highest_quality',
        criteria: {
          sameNodes: true,
          sameType: true,
          similarStrength: 0.1,
        },
        mergePolicy: {
          strengthMethod: 'average',
          confidenceMethod: 'max',
          metadataMethod: 'combine',
        },
        dryRun: true,
      },
    },
    variablesSchema: {
      deduplication: {
        type: 'object',
        required: true,
        properties: {
          strategy: {
            type: 'string',
            description: '중복 제거 전략',
          },
          criteria: {
            type: 'object',
            description: '중복 판단 기준',
          },
          mergePolicy: {
            type: 'object',
            description: '병합 정책',
          },
          dryRun: {
            type: 'boolean',
            description: '시뮬레이션 모드',
          },
        },
      },
    },
    defaultVariables: {
      deduplication: {
        strategy: 'merge_highest_quality',
        criteria: {
          sameNodes: true,
          sameType: true,
          similarStrength: 0.1,
        },
        mergePolicy: {
          strengthMethod: 'average',
          confidenceMethod: 'max',
          metadataMethod: 'combine',
        },
        dryRun: true,
      },
    },
    tags: ['relation', 'mutation', 'deduplication', 'quality', 'parameterized', 'fixed'],
    complexityScore: 7,
    category: 'relation',
  },

  // 7. 관계 강도 재계산
  {
    identifier: 'recalculate-relation-strength-with-params',
    name: 'RecalculateRelationStrengthWithParams',
    description: '관계 강도를 다양한 알고리즘으로 재계산합니다 (파라미터화)',
    query: `mutation RecalculateRelationStrength($recalculation: RelationRecalculationInput!) {
  recalculateRelationStrength(recalculation: $recalculation) {
    success
    summary {
      totalProcessed
      strengthUpdated
      avgImprovement
      qualityScore
    }
    updates {
      relationId
      oldStrength
      newStrength
      algorithm
      factors
    }
    errors {
      relationId
      error
      message
    }
  }
}`,
    variables: {
      recalculation: {
        scope: 'all',
        algorithm: 'semantic_similarity',
        factors: {
          nodeContent: 0.4,
          nodeAttributes: 0.3,
          networkPosition: 0.2,
          temporalFactors: 0.1,
        },
        filters: {
          minCurrentStrength: 0.0,
          relationTypes: ['RELATED_TO', 'SIMILAR_TO'],
        },
        dryRun: false,
      },
    },
    variablesSchema: {
      recalculation: {
        type: 'object',
        required: true,
        properties: {
          scope: {
            type: 'string',
            description: '재계산 범위',
          },
          algorithm: {
            type: 'string',
            description: '사용할 알고리즘',
          },
          factors: {
            type: 'object',
            description: '강도 계산 요소별 가중치',
          },
          filters: {
            type: 'object',
            description: '재계산 대상 필터',
          },
          dryRun: {
            type: 'boolean',
            description: '시뮬레이션 모드',
          },
        },
      },
    },
    defaultVariables: {
      recalculation: {
        scope: 'all',
        algorithm: 'semantic_similarity',
        factors: {
          nodeContent: 0.4,
          nodeAttributes: 0.3,
          networkPosition: 0.2,
          temporalFactors: 0.1,
        },
        filters: {
          minCurrentStrength: 0.0,
          relationTypes: ['RELATED_TO', 'SIMILAR_TO'],
        },
        dryRun: false,
      },
    },
    tags: ['relation', 'mutation', 'recalculation', 'strength', 'parameterized', 'fixed'],
    complexityScore: 8,
    category: 'relation',
  },
]

async function createRelationTemplate(template: RelationTemplate): Promise<boolean> {
  try {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
            name
            description
          }
          errors {
            field
            message
            code
          }
        }
      }
    `

    const variables = {
      input: {
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.query,
        variables: template.variables,
        variablesSchema: template.variablesSchema,
        defaultVariables: template.defaultVariables,
        tags: template.tags,
        complexityScore: template.complexityScore,
        category: template.category,
        version: '1.0.0',
        isActive: true,
      },
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    })

    if (!response.ok) {
      console.error(`❌ HTTP 오류: ${response.status} ${response.statusText}`)
      return false
    }

    const result = await response.json()

    if (result.errors) {
      console.error(`❌ GraphQL 오류:`, result.errors)
      return false
    }

    if (result.data?.createTemplate?.success) {
      const createdTemplate = result.data.createTemplate.template
      console.log(`  ✅ 성공: ${createdTemplate.name}`)
      console.log(`  📝 ID: ${createdTemplate.id}`)
      console.log(`  🎯 복잡도: ${template.complexityScore}/10`)
      console.log(
        `  🏷️ 카테고리: [${template.tags.filter((tag) => tag !== 'parameterized' && tag !== 'fixed').join(', ')}]`
      )
      return true
    } else {
      console.error(`❌ 생성 실패: ${template.name}`)
      if (result.data?.createTemplate?.errors) {
        console.error('  오류:', result.data.createTemplate.errors)
      }
      return false
    }
  } catch (error) {
    console.error(`❌ 네트워크 오류: ${template.name}`, error)
    return false
  }
}

async function main() {
  console.log('🚀 관계(Relation) 특화 템플릿 생성 시작')
  console.log(`📡 서버: ${GRAPHQL_ENDPOINT}`)
  console.log(`📋 생성할 템플릿 수: ${relationTemplates.length}개`)
  console.log()

  let successCount = 0
  let failureCount = 0
  const createdTemplates: string[] = []

  for (const template of relationTemplates) {
    console.log(`🔄 생성 중: ${template.identifier}`)

    const success = await createRelationTemplate(template)
    if (success) {
      successCount++
      createdTemplates.push(`${template.identifier}: ${template.name}`)
    } else {
      failureCount++
    }
    console.log()
  }

  console.log('📊 생성 결과 요약:')
  console.log(`  ✅ 성공: ${successCount}개`)
  console.log(`  ❌ 실패: ${failureCount}개`)
  console.log()

  if (successCount > 0) {
    console.log('✅ 생성된 관계 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore || 1
      const icon = complexity >= 7 ? '🔥' : complexity >= 5 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계 특화 템플릿 생성 완료!')
  console.log()
  console.log('💡 템플릿 카테고리:')
  console.log('  🔧 CRUD Operations: 관계 생성, 수정, 삭제')
  console.log('  🔍 Search & Filter: 관계 검색 및 필터링')
  console.log('  📊 Analytics: 관계 패턴 분석 및 통계')
  console.log('  🕸️ Network Analysis: 경로 탐색 및 네트워크 분석')
  console.log('  ✅ Quality Management: 품질 검증 및 개선')
  console.log('  🔄 Maintenance: 중복 제거 및 강도 재계산')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 관계 분석 템플릿으로 네트워크 구조 파악')
  console.log('  3. 품질 관리 템플릿으로 데이터 품질 향상')
  console.log('  4. 경로 탐색으로 노드 간 연결성 분석')
}

main().catch(console.error)
