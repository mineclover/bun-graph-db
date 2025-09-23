#!/usr/bin/env bun
/**
 * Template Issue Analysis System
 * 운영 로그를 분석하여 문제있는 템플릿들을 식별하고 수정 전략을 제시
 */

interface TemplateIssue {
  templateIdentifier: string
  issueType: 'SCHEMA_MISMATCH' | 'INVALID_DATA' | 'MISSING_FIELDS' | 'TYPE_MISMATCH'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  errorMessage: string
  suggestedFix: string
  affectedFields: string[]
}

interface UpdatePlan {
  templateIdentifier: string
  currentQuery: string
  currentVariables: string
  updatedQuery: string
  updatedVariables: string
  updateReason: string
}

// 로그에서 식별된 주요 문제 패턴들
const IDENTIFIED_ISSUES: TemplateIssue[] = [
  {
    templateIdentifier: 'create-attribute-with-params',
    issueType: 'MISSING_FIELDS',
    severity: 'HIGH',
    errorMessage: 'Field "identifier" of required type "String!" was not provided',
    suggestedFix: 'Add missing required fields: identifier, attributeTypeId',
    affectedFields: ['identifier', 'attributeTypeId'],
  },
  {
    templateIdentifier: 'list-tables-with-filter',
    issueType: 'SCHEMA_MISMATCH',
    severity: 'MEDIUM',
    errorMessage: 'Field "isActive" is not defined by type "TablesFilter"',
    suggestedFix: 'Remove non-existent filter fields',
    affectedFields: ['isActive', 'sort'],
  },
  {
    templateIdentifier: 'query-optimization',
    issueType: 'TYPE_MISMATCH',
    severity: 'HIGH',
    errorMessage:
      'Variable "$options" expected value of type "OptimizationOptions" which cannot be used as an input type',
    suggestedFix: 'Replace non-input types with valid GraphQL input types',
    affectedFields: ['options'],
  },
  {
    templateIdentifier: 'universal_metric_entry',
    issueType: 'MISSING_FIELDS',
    severity: 'HIGH',
    errorMessage: 'Variable "$tableId" of required type "ID!" was not provided',
    suggestedFix: 'Add all required variables to defaultValue',
    affectedFields: ['tableId', 'content', 'metricName', 'metricValue', 'timestamp'],
  },
  {
    templateIdentifier: 'find-paths-between-nodes-with-params',
    issueType: 'SCHEMA_MISMATCH',
    severity: 'MEDIUM',
    errorMessage: 'Field "algorithm" is not defined by type "FindPathsInput"',
    suggestedFix: 'Remove unsupported fields from input',
    affectedFields: ['algorithm'],
  },
  {
    templateIdentifier: 'search-nodes-with-filter',
    issueType: 'SCHEMA_MISMATCH',
    severity: 'MEDIUM',
    errorMessage: 'Field "searchTerm" is not defined by type "SearchNodesFilter"',
    suggestedFix: 'Use correct field name "search" instead of "searchTerm"',
    affectedFields: ['searchTerm'],
  },
]

// 대량 처리가 필요한 타입 불일치 문제들
const BULK_TYPE_ISSUES = [
  'ValidationOptions',
  'OptimizationOptions',
  'BulkImportInput',
  'LifecycleOperation',
  'ExportFormat',
  'MetricType',
  'DataValidationScope',
  'ChangeTrackingScope',
  'SearchContext',
  'SmartSearchOptions',
  'MaintenanceTaskInput',
  'DataSourceInput',
  'MigrationOptions',
  'AttributeSortInput',
  'TableSortInput',
  'TemplateSortInput',
  'NodeSortInput',
]

const GRAPHQL_ENDPOINT = 'http://localhost:4500/graphql'

async function executeGraphQLQuery(query: string, variables: any = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  return await response.json()
}

async function getCurrentTemplate(identifier: string) {
  const query = `
    query GetTemplate($identifier: String!) {
      findTemplateByIdentifier(identifier: $identifier) {
        id
        identifier
        name
        query
        default_variables
        tags
      }
    }
  `

  const result = await executeGraphQLQuery(query, { identifier })
  return result.data?.findTemplateByIdentifier
}

async function updateTemplate(templateId: string, updates: any) {
  const query = `
    mutation UpdateTemplate($id: ID!, $input: UpdateTemplateInput!) {
      updateTemplate(id: $id, input: $input) {
        id
        identifier
        name
        query
        default_variables
      }
    }
  `

  const result = await executeGraphQLQuery(query, {
    id: templateId,
    input: updates,
  })

  return result.data?.updateTemplate
}

// 개별 템플릿 수정 계획들
const TEMPLATE_UPDATE_PLANS: UpdatePlan[] = [
  {
    templateIdentifier: 'create-attribute-with-params',
    currentQuery: '',
    currentVariables: '',
    updatedQuery: `
      mutation CreateAttributeWithParams($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          id
          identifier
          name
          description
          attributeTypeId
          tableId
        }
      }
    `,
    updatedVariables: JSON.stringify({
      input: {
        identifier: 'new_attribute',
        name: '새 속성',
        description: '새로운 속성입니다',
        tableId: '128',
        attributeTypeId: '1',
      },
    }),
    updateReason: 'Add missing required fields: identifier, attributeTypeId',
  },
  {
    templateIdentifier: 'list-tables-with-filter',
    currentQuery: '',
    currentVariables: '',
    updatedQuery: `
      query ListTablesWithFilter($filter: TablesFilter, $pagination: PaginationInput) {
        findAllTables(filter: $filter, pagination: $pagination) {
          tables {
            id
            identifier
            description
            createdAt
            updatedAt
          }
          pagination {
            total
            limit
            offset
            hasMore
          }
        }
      }
    `,
    updatedVariables: JSON.stringify({
      filter: {},
      pagination: {
        limit: 10,
        offset: 0,
      },
    }),
    updateReason: 'Remove invalid filter fields and sort parameters',
  },
  {
    templateIdentifier: 'universal_metric_entry',
    currentQuery: '',
    currentVariables: '',
    updatedQuery: `
      mutation UniversalMetricEntry($tableId: ID!, $content: String!, $metricName: String!, $metricValue: String!, $timestamp: String!) {
        createNode(input: {
          tableId: $tableId
          content: $content
          attributes: [
            { attributeId: "1", value: $metricName }
            { attributeId: "2", value: $metricValue }
            { attributeId: "3", value: $timestamp }
          ]
        }) {
          id
          content
          attributes {
            id
            value
            attribute {
              name
              identifier
            }
          }
        }
      }
    `,
    updatedVariables: JSON.stringify({
      tableId: '101',
      content: '메트릭 항목',
      metricName: 'response_time',
      metricValue: '150ms',
      timestamp: new Date().toISOString(),
    }),
    updateReason: 'Add all required variables with proper values',
  },
  {
    templateIdentifier: 'find-paths-between-nodes-with-params',
    currentQuery: '',
    currentVariables: '',
    updatedQuery: `
      query FindPathsBetweenNodesWithParams($input: FindPathsInput!) {
        findShortestPath(input: $input) {
          success
          paths {
            length
            nodes {
              id
              content
            }
            relationships {
              id
              relationshipType
            }
          }
        }
      }
    `,
    updatedVariables: JSON.stringify({
      input: {
        sourceNodeId: '100',
        targetNodeId: '110',
        maxDepth: 5,
      },
    }),
    updateReason: 'Remove unsupported algorithm field',
  },
  {
    templateIdentifier: 'search-nodes-with-filter',
    currentQuery: '',
    currentVariables: '',
    updatedQuery: `
      query SearchNodesWithFilter($filter: SearchNodesFilter!, $pagination: PaginationInput) {
        findAllNodes(filter: $filter, pagination: $pagination) {
          nodes {
            id
            content
            tableId
            createdAt
            attributes {
              id
              value
              attribute {
                name
                identifier
              }
            }
          }
          pagination {
            total
            limit
            offset
            hasMore
          }
        }
      }
    `,
    updatedVariables: JSON.stringify({
      filter: {
        search: 'example',
        tableId: '101',
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
    }),
    updateReason: 'Use correct field name "search" instead of "searchTerm"',
  },
]

async function generateFixedTemplates() {
  console.log('🔧 템플릿 수정 계획 분석 시작...\n')

  const updateResults = []

  for (const plan of TEMPLATE_UPDATE_PLANS) {
    console.log(`📋 처리 중: ${plan.templateIdentifier}`)

    try {
      // 현재 템플릿 정보 가져오기
      const currentTemplate = await getCurrentTemplate(plan.templateIdentifier)

      if (!currentTemplate) {
        console.log(`  ❌ 템플릿을 찾을 수 없음: ${plan.templateIdentifier}`)
        continue
      }

      console.log(`  📄 현재 템플릿 ID: ${currentTemplate.id}`)
      console.log(`  🔄 수정 이유: ${plan.updateReason}`)

      // 템플릿 업데이트 실행
      const updated = await updateTemplate(currentTemplate.id, {
        query: plan.updatedQuery.trim(),
        default_variables: plan.updatedVariables,
      })

      if (updated) {
        console.log(`  ✅ 업데이트 완료: ${plan.templateIdentifier}`)
        updateResults.push({
          identifier: plan.templateIdentifier,
          status: 'SUCCESS',
          reason: plan.updateReason,
        })
      } else {
        console.log(`  ❌ 업데이트 실패: ${plan.templateIdentifier}`)
        updateResults.push({
          identifier: plan.templateIdentifier,
          status: 'FAILED',
          reason: 'Update mutation failed',
        })
      }
    } catch (error) {
      console.log(`  ❌ 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`)
      updateResults.push({
        identifier: plan.templateIdentifier,
        status: 'ERROR',
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 서버 부하 방지
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // 결과 요약
  console.log('\n📊 업데이트 결과 요약:')
  const successful = updateResults.filter((r) => r.status === 'SUCCESS').length
  const failed = updateResults.filter((r) => r.status !== 'SUCCESS').length

  console.log(`✅ 성공: ${successful}개`)
  console.log(`❌ 실패: ${failed}개`)

  if (failed > 0) {
    console.log('\n💥 실패한 템플릿들:')
    updateResults
      .filter((r) => r.status !== 'SUCCESS')
      .forEach((r) => {
        console.log(`  - ${r.identifier}: ${r.reason}`)
      })
  }

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultPath = `./claudedocs/template-update-results-${timestamp}.json`
  await Bun.write(resultPath, JSON.stringify(updateResults, null, 2))
  console.log(`\n📋 상세 결과 저장: ${resultPath}`)

  return updateResults
}

async function main() {
  console.log('🚀 템플릿 품질 개선 시스템 시작\n')

  try {
    // 서버 연결 확인
    const healthCheck = await executeGraphQLQuery(`
      query { healthCheck { status } }
    `)

    if (!healthCheck.data?.healthCheck?.status) {
      console.error('❌ GraphQL 서버에 연결할 수 없습니다.')
      process.exit(1)
    }

    console.log('✅ GraphQL 서버 연결 확인\n')

    // 템플릿 수정 실행
    await generateFixedTemplates()

    console.log('\n🎉 템플릿 품질 개선 완료!')
  } catch (error) {
    console.error('❌ 시스템 오류:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

export { generateFixedTemplates, IDENTIFIED_ISSUES, TEMPLATE_UPDATE_PLANS }
