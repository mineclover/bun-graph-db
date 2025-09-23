#!/usr/bin/env bun
/**
 * Template Quality Improvement System
 * 실제 존재하는 문제 템플릿들을 정확히 식별하고 업데이트
 */

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

// 로그에서 확인된 실제 존재하는 문제 템플릿들
const PROBLEMATIC_TEMPLATES = [
  'list-tables-with-filter',
  'create-table-with-params',
  'create-node-with-params',
  'update-node-with-params',
  'delete-node-with-params',
  'bulk-create-nodes-with-params',
  'update-table-with-params',
  'analyze-table-relationships-with-params',
]

async function getTemplateDetails(identifier: string) {
  const query = `
    query FindTemplate($identifier: String!) {
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

async function updateTemplate(templateId: string, query: string, defaultVariables: string) {
  const mutation = `
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

  const result = await executeGraphQLQuery(mutation, {
    id: templateId,
    input: {
      query: query.trim(),
      default_variables: defaultVariables,
    },
  })

  return result.data?.updateTemplate
}

// 개별 템플릿 수정 사항들
const TEMPLATE_FIXES = {
  'list-tables-with-filter': {
    query: `
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
    variables: JSON.stringify({
      filter: {},
      pagination: {
        limit: 10,
        offset: 0,
      },
    }),
  },
  'create-table-with-params': {
    query: `
      mutation CreateTableWithParams($input: CreateTableInput!) {
        createTable(input: $input) {
          id
          identifier
          description
          createdAt
          updatedAt
        }
      }
    `,
    variables: JSON.stringify({
      input: {
        identifier: 'sample_table_' + Date.now(),
        description: '샘플 테이블입니다',
      },
    }),
  },
  'create-node-with-params': {
    query: `
      mutation CreateNodeWithParams($input: CreateNodeInput!) {
        createNode(input: $input) {
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
      }
    `,
    variables: JSON.stringify({
      input: {
        content: '샘플 노드',
        tableId: '128',
      },
    }),
  },
  'update-node-with-params': {
    query: `
      mutation UpdateNodeWithParams($id: ID!, $input: UpdateNodeInput!) {
        updateNode(id: $id, input: $input) {
          id
          content
          tableId
          updatedAt
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
    variables: JSON.stringify({
      id: '100',
      input: {
        content: '업데이트된 내용',
      },
    }),
  },
  'delete-node-with-params': {
    query: `
      mutation DeleteNodeWithParams($id: ID!) {
        deleteNode(id: $id) {
          success
          message
        }
      }
    `,
    variables: JSON.stringify({
      id: '999',
    }),
  },
  'bulk-create-nodes-with-params': {
    query: `
      mutation BulkCreateNodesWithParams($nodes: [CreateNodeInput!]!) {
        bulkCreateNodes: createMultipleNodes(inputs: $nodes) {
          success
          results {
            id
            content
            tableId
          }
          errors {
            message
          }
        }
      }
    `,
    variables: JSON.stringify({
      nodes: [
        {
          content: '일괄 노드 1',
          tableId: '128',
        },
        {
          content: '일괄 노드 2',
          tableId: '128',
        },
      ],
    }),
  },
  'update-table-with-params': {
    query: `
      mutation UpdateTableWithParams($id: ID!, $input: UpdateTableInput!) {
        updateTable(id: $id, input: $input) {
          id
          identifier
          description
          updatedAt
        }
      }
    `,
    variables: JSON.stringify({
      id: '128',
      input: {
        description: '업데이트된 테이블 설명',
      },
    }),
  },
  'analyze-table-relationships-with-params': {
    query: `
      query AnalyzeTableRelationshipsWithParams($tableId: ID!) {
        findTableById(id: $tableId) {
          id
          identifier
          description
          nodes {
            id
            content
            relationships {
              id
              relationshipType
              targetNode {
                id
                content
              }
            }
          }
        }
      }
    `,
    variables: JSON.stringify({
      tableId: '128',
    }),
  },
}

async function fixProblematicTemplates() {
  console.log('🔧 문제 템플릿 수정 시작...\n')

  const results = []

  for (const templateIdentifier of PROBLEMATIC_TEMPLATES) {
    console.log(`📋 처리 중: ${templateIdentifier}`)

    try {
      // 현재 템플릿 정보 가져오기
      const template = await getTemplateDetails(templateIdentifier)

      if (!template) {
        console.log(`  ❌ 템플릿을 찾을 수 없음: ${templateIdentifier}`)
        results.push({
          identifier: templateIdentifier,
          status: 'NOT_FOUND',
          message: 'Template not found',
        })
        continue
      }

      console.log(`  📄 현재 템플릿 ID: ${template.id}`)

      // 수정사항이 있는지 확인
      const fix = TEMPLATE_FIXES[templateIdentifier as keyof typeof TEMPLATE_FIXES]
      if (!fix) {
        console.log(`  ⚠️ 수정 계획이 없음: ${templateIdentifier}`)
        results.push({
          identifier: templateIdentifier,
          status: 'NO_FIX_PLAN',
          message: 'No fix plan available',
        })
        continue
      }

      console.log(`  🔄 템플릿 업데이트 실행...`)

      // 템플릿 업데이트
      const updated = await updateTemplate(template.id, fix.query, fix.variables)

      if (updated) {
        console.log(`  ✅ 업데이트 완료: ${templateIdentifier}`)
        results.push({
          identifier: templateIdentifier,
          status: 'SUCCESS',
          message: 'Template updated successfully',
        })
      } else {
        console.log(`  ❌ 업데이트 실패: ${templateIdentifier}`)
        results.push({
          identifier: templateIdentifier,
          status: 'UPDATE_FAILED',
          message: 'Update mutation failed',
        })
      }
    } catch (error) {
      console.log(`  ❌ 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.push({
        identifier: templateIdentifier,
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 서버 부하 방지
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  // 결과 요약
  console.log('\n📊 업데이트 결과 요약:')
  const successful = results.filter((r) => r.status === 'SUCCESS').length
  const failed = results.filter((r) => r.status !== 'SUCCESS').length

  console.log(`✅ 성공: ${successful}개`)
  console.log(`❌ 실패: ${failed}개`)

  if (failed > 0) {
    console.log('\n💥 실패한 템플릿들:')
    results
      .filter((r) => r.status !== 'SUCCESS')
      .forEach((r) => {
        console.log(`  - ${r.identifier}: ${r.message}`)
      })
  }

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultPath = `./claudedocs/template-fix-results-${timestamp}.json`
  await Bun.write(resultPath, JSON.stringify(results, null, 2))
  console.log(`\n📋 상세 결과 저장: ${resultPath}`)

  return results
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

    // 문제 템플릿 수정
    await fixProblematicTemplates()

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

export { fixProblematicTemplates }
