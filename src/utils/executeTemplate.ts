#!/usr/bin/env bun

/**
 * executeTemplate 유틸리티 함수
 *
 * GraphQL executeTemplate 뮤테이션을 통해 템플릿을 실행하는 헬퍼 함수입니다.
 * 모든 스크립트에서 재사용할 수 있습니다.
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

export interface ExecuteTemplateOptions {
  endpoint?: string
  verbose?: boolean
  timeout?: number
}

export interface ExecuteTemplateResult {
  success: boolean
  data?: any
  errors?: Array<{ message: string; code?: string }>
  metadata?: {
    templateIdentifier: string
    executionTime: number
    hasData: boolean
  }
}

/**
 * executeTemplate 함수 - 템플릿을 실행합니다
 *
 * @param templateIdentifier 실행할 템플릿의 식별자
 * @param variables 템플릿에 전달할 변수들
 * @param options 추가 옵션들
 * @returns 실행 결과
 */
export async function executeTemplate(
  templateIdentifier: string,
  variables: any = {},
  options: ExecuteTemplateOptions = {},
): Promise<ExecuteTemplateResult> {
  const startTime = Date.now()
  const endpoint = options.endpoint || GRAPHQL_ENDPOINT
  const verbose = options.verbose !== false // 기본값은 true
  const timeout = options.timeout || 30000 // 30초

  if (verbose) {
    console.log(`\n🔄 Executing template: ${templateIdentifier}`)
    console.log(`📥 Variables:`, JSON.stringify(variables, null, 2))
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: `
          mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
            executeTemplate(input: $input) {
              success
              data
              errors {
                message
                code
              }
            }
          }
        `,
        variables: {
          input: {
            templateIdentifier,
            variables,
          },
        },
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    const executionTime = Date.now() - startTime

    const executeResult: ExecuteTemplateResult = {
      success: result.data?.executeTemplate?.success || false,
      data: result.data?.executeTemplate?.data,
      errors: result.data?.executeTemplate?.errors || result.errors,
      metadata: {
        templateIdentifier,
        executionTime,
        hasData: !!result.data?.executeTemplate?.data,
      },
    }

    if (executeResult.success) {
      if (verbose) {
        console.log(`✅ Template executed successfully! (${executionTime}ms)`)
        console.log(`📤 Result:`, JSON.stringify(executeResult.data, null, 2))
      }
    } else {
      if (verbose) {
        console.log(`❌ Template execution failed`)
        console.log(`   Errors:`, executeResult.errors)
      }
    }

    return executeResult
  } catch (error) {
    const executionTime = Date.now() - startTime

    if (verbose) {
      console.log(`❌ Template execution error: ${error}`)
    }

    return {
      success: false,
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown execution error',
          code: 'EXECUTION_ERROR',
        },
      ],
      metadata: {
        templateIdentifier,
        executionTime,
        hasData: false,
      },
    }
  }
}

/**
 * 여러 템플릿을 순차적으로 실행합니다
 */
export async function executeTemplates(
  templates: Array<{ identifier: string; variables?: any }>,
  options: ExecuteTemplateOptions = {},
): Promise<ExecuteTemplateResult[]> {
  const results: ExecuteTemplateResult[] = []

  for (const template of templates) {
    const result = await executeTemplate(template.identifier, template.variables, options)
    results.push(result)

    // 템플릿 간 짧은 대기 시간
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return results
}

/**
 * 템플릿 실행 통계를 계산합니다
 */
export function calculateExecutionStats(results: ExecuteTemplateResult[]) {
  const totalCount = results.length
  const successCount = results.filter((r) => r.success).length
  const failureCount = totalCount - successCount
  const totalTime = results.reduce((sum, r) => sum + (r.metadata?.executionTime || 0), 0)
  const avgTime = totalCount > 0 ? totalTime / totalCount : 0

  return {
    totalCount,
    successCount,
    failureCount,
    successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
    totalTime,
    avgTime,
  }
}

/**
 * 간편한 CRUD 작업 함수들
 */
export const TemplateHelpers = {
  // 노드 조회
  async getNode(nodeId: string, options?: ExecuteTemplateOptions) {
    return executeTemplate('get-node-by-id', { nodeId }, options)
  },

  // 테이블 조회
  async getTable(tableId: string, options?: ExecuteTemplateOptions) {
    return executeTemplate('get-table-by-id', { tableId }, options)
  },

  // 노드 생성
  async createNode(content: string, tableId: string, attributes: any[] = [], options?: ExecuteTemplateOptions) {
    return executeTemplate(
      'create-node-simple',
      {
        input: { content, tableId, attributes },
      },
      options,
    )
  },

  // 노드 업데이트
  async updateNode(id: string, content: string, options?: ExecuteTemplateOptions) {
    return executeTemplate(
      'update-node-simple',
      {
        id,
        input: { content },
      },
      options,
    )
  },

  // 노드 검색
  async searchNodes(tableId: string, search?: string, limit: number = 20, options?: ExecuteTemplateOptions) {
    return executeTemplate(
      'search-nodes-advanced',
      {
        filter: { tableId, search },
        pagination: { limit, offset: 0 },
      },
      options,
    )
  },

  // 시스템 통계
  async getSystemStats(options?: ExecuteTemplateOptions) {
    return executeTemplate('get-system-statistics', {}, options)
  },

  // 업데이트 작업들
  async updateTodoContent(nodeId: string, newContent: string, options?: ExecuteTemplateOptions) {
    return executeTemplate('update-todo-content', { nodeId, newContent }, options)
  },

  async updateTodoWithAttributes(
    nodeId: string,
    content: string,
    attributeId: string,
    attributeValue: string,
    options?: ExecuteTemplateOptions,
  ) {
    return executeTemplate(
      'update-todo-with-attributes',
      {
        nodeId,
        content,
        attributeId,
        attributeValue,
      },
      options,
    )
  },

  async bulkUpdateNodes(
    nodeId1: string,
    nodeId2: string,
    content1: string,
    content2: string,
    options?: ExecuteTemplateOptions,
  ) {
    return executeTemplate(
      'bulk-update-nodes-content',
      {
        nodeId1,
        nodeId2,
        content1,
        content2,
      },
      options,
    )
  },
}

// CLI에서 직접 실행 시 데모
async function demo() {
  console.log('🎯 executeTemplate 유틸리티 데모')
  console.log('='.repeat(50))

  try {
    // 1. 기본 노드 조회
    console.log('\n📋 1. 노드 조회 테스트')
    const nodeResult = await TemplateHelpers.getNode('80')

    // 2. 시스템 통계
    console.log('\n📊 2. 시스템 통계 조회')
    const statsResult = await TemplateHelpers.getSystemStats()

    // 3. 노드 검색
    console.log('\n🔍 3. 노드 검색 테스트')
    const searchResult = await TemplateHelpers.searchNodes('101', '노드', 5)

    // 4. 업데이트 테스트
    console.log('\n✏️ 4. 노드 업데이트 테스트')
    const updateResult = await TemplateHelpers.updateTodoContent('80', `데모 업데이트 ${Date.now()}`)

    // 통계 계산
    const results = [nodeResult, statsResult, searchResult, updateResult]
    const stats = calculateExecutionStats(results)

    console.log('\n📈 실행 통계:')
    console.log(`   총 실행: ${stats.totalCount}개`)
    console.log(`   성공: ${stats.successCount}개`)
    console.log(`   실패: ${stats.failureCount}개`)
    console.log(`   성공률: ${stats.successRate.toFixed(1)}%`)
    console.log(`   평균 실행 시간: ${stats.avgTime.toFixed(0)}ms`)

    console.log('\n🎉 executeTemplate 유틸리티 데모 완료!')
  } catch (error) {
    console.error('❌ 데모 실행 중 오류:', error)
  }
}

// 스크립트가 직접 실행될 때만 데모 실행
if (import.meta.main) {
  demo()
}
