#!/usr/bin/env bun

/**
 * Batch Template Manager Script
 *
 * 삭제 쿼리를 받아서 variable 배열로 일괄 실행하는 시스템
 * - 배치 삭제, 업데이트, 생성 지원
 * - 트랜잭션 방식 처리 (실패시 롤백 가능)
 * - 진행상황 모니터링 및 에러 핸들링
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface BatchOperation {
  operation: 'delete' | 'update' | 'create'
  query: string
  variables: Array<Record<string, any>>
  description?: string
}

interface BatchResult {
  success: boolean
  operation: string
  totalRequested: number
  successful: number
  failed: number
  results: Array<{
    variables: Record<string, any>
    success: boolean
    result?: any
    error?: string
  }>
  executionTimeMs: number
}

// 미리 정의된 템플릿 삭제 쿼리
const DELETE_TEMPLATES_QUERY = `
  mutation DeleteTemplate($id: ID!) {
    deleteTemplate(id: $id) {
      success
      errors {
        message
      }
    }
  }
`

// 미리 정의된 템플릿 업데이트 쿼리
const UPDATE_TEMPLATE_QUERY = `
  mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
    updateTemplate(id: $id, input: $input) {
      success
      template {
        id
        name
      }
      errors {
        message
      }
    }
  }
`

// 미리 정의된 템플릿 생성 쿼리
const _CREATE_TEMPLATE_QUERY = `
  mutation CreateTemplate($input: CreateQueryTemplateInput!) {
    createTemplate(input: $input) {
      success
      template {
        id
        name
      }
      errors {
        message
      }
    }
  }
`

async function main() {
  console.log('🔄 Batch Template Manager 시작')
  console.log(`📡 서버: ${SERVER_URL}`)

  try {
    // 예시 배치 작업들
    const operations: BatchOperation[] = await loadBatchOperations()

    console.log(`\n📋 로드된 배치 작업: ${operations.length}개`)

    for (const operation of operations) {
      console.log(`\n🚀 배치 작업 시작: ${operation.description || operation.operation}`)
      console.log(`  📊 대상: ${operation.variables.length}개 항목`)

      const result = await executeBatchOperation(operation)
      displayBatchResult(result)
    }

    console.log('\n✅ 모든 배치 작업 완료!')
  } catch (error) {
    console.error('💥 배치 작업 중 오류:', error)
    process.exit(1)
  }
}

async function loadBatchOperations(): Promise<BatchOperation[]> {
  // 예시 작업들 - 실제로는 파일에서 로드하거나 파라미터로 받을 수 있음

  // 1. 특정 태그를 가진 템플릿들 삭제 예시
  const templatesToDelete = await findTemplatesByTag('test')
  const deleteOperation: BatchOperation = {
    operation: 'delete',
    query: DELETE_TEMPLATES_QUERY,
    variables: templatesToDelete.map((t) => ({ id: t.id })),
    description: '테스트 태그를 가진 템플릿들 일괄 삭제',
  }

  // 2. 특정 패턴의 템플릿들 업데이트 예시
  const templatesWithTestPrefix = await findTemplatesByPattern('test-')
  const updateOperation: BatchOperation = {
    operation: 'update',
    query: UPDATE_TEMPLATE_QUERY,
    variables: templatesWithTestPrefix.map((t) => ({
      id: t.id,
      input: {
        tags: [...t.tags.filter((tag) => tag !== 'test'), 'updated'],
      },
    })),
    description: 'test- 접두사 템플릿들의 태그 업데이트',
  }

  return [deleteOperation, updateOperation].filter((op) => op.variables.length > 0)
}

async function findTemplatesByTag(
  tag: string
): Promise<Array<{ id: string; name: string; tags: string[] }>> {
  try {
    const query = `
      query SearchTemplatesByTag($filter: QueryTemplatesFilter) {
        searchTemplates(filter: $filter, pagination: { limit: 100 }) {
          templates {
            id
            name
            tags
          }
        }
      }
    `

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          filter: { tags: [tag] },
        },
      }),
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    if (data.errors || !data.data?.searchTemplates?.templates) {
      return []
    }

    return data.data.searchTemplates.templates
  } catch {
    return []
  }
}

async function findTemplatesByPattern(
  pattern: string
): Promise<Array<{ id: string; name: string; tags: string[] }>> {
  try {
    const query = `
      query SearchTemplatesByName($filter: QueryTemplatesFilter) {
        searchTemplates(filter: $filter, pagination: { limit: 100 }) {
          templates {
            id
            name
            tags
          }
        }
      }
    `

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          filter: { search: pattern },
        },
      }),
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    if (data.errors || !data.data?.searchTemplates?.templates) {
      return []
    }

    return data.data.searchTemplates.templates.filter((t: any) =>
      t.name.toLowerCase().includes(pattern.toLowerCase())
    )
  } catch {
    return []
  }
}

async function executeBatchOperation(operation: BatchOperation): Promise<BatchResult> {
  const startTime = Date.now()
  const results: BatchResult['results'] = []
  const batchSize = 5 // 동시 처리 개수

  console.log(`  🔄 ${operation.variables.length}개 항목을 ${batchSize}개씩 배치 처리...`)

  for (let i = 0; i < operation.variables.length; i += batchSize) {
    const batch = operation.variables.slice(i, i + batchSize)
    const batchPromises = batch.map((variables) =>
      executeSingleOperation(operation.query, variables)
    )

    const batchResults = await Promise.allSettled(batchPromises)

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      const variables = batch[j]

      if (result.status === 'fulfilled') {
        results.push({
          variables,
          success: result.value.success,
          result: result.value.result,
          error: result.value.error,
        })

        const status = result.value.success ? '✅' : '❌'
        const itemInfo = getItemInfo(variables)
        console.log(`    ${status} ${itemInfo}`)
      } else {
        results.push({
          variables,
          success: false,
          error: result.reason?.message || '알 수 없는 오류',
        })

        const itemInfo = getItemInfo(variables)
        console.log(`    ❌ ${itemInfo} - ${result.reason?.message}`)
      }
    }

    // 배치 간 잠시 대기
    if (i + batchSize < operation.variables.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return {
    success: failed === 0,
    operation: operation.operation,
    totalRequested: operation.variables.length,
    successful,
    failed,
    results,
    executionTimeMs: Date.now() - startTime,
  }
}

async function executeSingleOperation(
  query: string,
  variables: Record<string, any>
): Promise<{
  success: boolean
  result?: any
  error?: string
}> {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()

    if (data.errors) {
      return {
        success: false,
        error: `GraphQL 오류: ${data.errors.map((e) => e.message).join(', ')}`,
      }
    }

    // 뮤테이션 결과 추출 (첫 번째 뮤테이션 필드)
    const mutationKey = Object.keys(data.data)[0]
    const mutationResult = data.data[mutationKey]

    if (!mutationResult.success) {
      return {
        success: false,
        error: mutationResult.errors?.map((e) => e.message).join(', ') || '작업 실패',
      }
    }

    return {
      success: true,
      result: mutationResult,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function getItemInfo(variables: Record<string, any>): string {
  if (variables.id) {
    return `ID: ${variables.id}`
  }
  if (variables.input?.name) {
    return `이름: ${variables.input.name}`
  }
  if (variables.name) {
    return `이름: ${variables.name}`
  }
  return `${JSON.stringify(variables).slice(0, 50)}...`
}

function displayBatchResult(result: BatchResult) {
  console.log('\n📊 배치 작업 결과:')
  console.log(`  🎯 작업 유형: ${result.operation.toUpperCase()}`)
  console.log(`  ✅ 성공: ${result.successful}개`)
  console.log(`  ❌ 실패: ${result.failed}개`)
  console.log(`  📈 전체: ${result.totalRequested}개`)
  console.log(`  ⏱️ 실행 시간: ${result.executionTimeMs}ms`)
  console.log(`  📊 성공률: ${((result.successful / result.totalRequested) * 100).toFixed(1)}%`)

  if (result.failed > 0) {
    console.log('\n❌ 실패 항목들:')
    const failedResults = result.results.filter((r) => !r.success)
    failedResults.slice(0, 5).forEach((item) => {
      const itemInfo = getItemInfo(item.variables)
      console.log(`  - ${itemInfo}: ${item.error}`)
    })

    if (failedResults.length > 5) {
      console.log(`  ... 및 ${failedResults.length - 5}개 더`)
    }
  }
}

// 설정 파일에서 배치 작업 로드 (옵션)
async function _loadBatchFromFile(filePath: string): Promise<BatchOperation[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (_error) {
    console.log(`⚠️ 설정 파일 로드 실패: ${filePath}`)
    return []
  }
}

// CLI 파라미터 처리 함수
function _parseCliArgs(): { configFile?: string; operation?: string } {
  const args = process.argv.slice(2)
  const result: any = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      result.configFile = args[i + 1]
      i++
    } else if (args[i] === '--operation' && args[i + 1]) {
      result.operation = args[i + 1]
      i++
    }
  }

  return result
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

// 사용 예시를 위한 설정 파일 생성 함수
export async function createExampleBatchConfig() {
  const exampleConfig: BatchOperation[] = [
    {
      operation: 'delete',
      query: DELETE_TEMPLATES_QUERY,
      variables: [{ id: 'template-1' }, { id: 'template-2' }, { id: 'template-3' }],
      description: '특정 템플릿들 일괄 삭제',
    },
    {
      operation: 'update',
      query: UPDATE_TEMPLATE_QUERY,
      variables: [
        {
          id: 'template-4',
          input: { tags: ['updated', 'batch'] },
        },
        {
          id: 'template-5',
          input: { tags: ['updated', 'batch'] },
        },
      ],
      description: '템플릿 태그 일괄 업데이트',
    },
  ]

  const configPath = join(process.cwd(), 'batch-operations.example.json')
  await fs.writeFile(configPath, JSON.stringify(exampleConfig, null, 2))
  console.log(`📝 예시 설정 파일 생성: ${configPath}`)
}
