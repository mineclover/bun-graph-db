#!/usr/bin/env bun

/**
 * Test Batch Operations Script
 * 
 * 배치 생성/업데이트/삭제 테스트 스크립트
 * - 5개 테스트 템플릿 생성
 * - 생성된 템플릿들 태그 업데이트
 * - 생성된 템플릿들 모두 삭제
 * - 전체 과정 검증
 */

import { promises as fs } from 'fs'
import { join } from 'path'

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface BatchResult {
  success: boolean
  operation: string
  totalRequested: number
  successful: number
  failed: number
  createdIds?: string[]
  executionTimeMs: number
  results: Array<{
    variables: Record<string, any>
    success: boolean
    result?: any
    error?: string
  }>
}

async function main() {
  console.log('🧪 배치 작업 테스트 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  
  try {
    // 1. 기존 테스트 템플릿들 정리 (있다면)
    await cleanupExistingTestTemplates()
    
    // 2. 배치 생성 테스트
    console.log('\n🚀 1단계: 배치 생성 테스트')
    const createResult = await testBatchCreate()
    
    if (!createResult.success || !createResult.createdIds?.length) {
      console.log('❌ 배치 생성 실패 - 테스트 중단')
      return
    }
    
    // 3. 배치 업데이트 테스트
    console.log('\n🔄 2단계: 배치 업데이트 테스트')
    const updateResult = await testBatchUpdate(createResult.createdIds)
    
    // 4. 배치 삭제 테스트
    console.log('\n🗑️ 3단계: 배치 삭제 테스트')
    const deleteResult = await testBatchDelete(createResult.createdIds)
    
    // 5. 결과 요약
    displayFinalSummary([createResult, updateResult, deleteResult])
    
    console.log('\n✅ 모든 배치 작업 테스트 완료!')
    
  } catch (error) {
    console.error('💥 배치 테스트 중 오류:', error)
    process.exit(1)
  }
}

async function cleanupExistingTestTemplates() {
  console.log('🧹 기존 테스트 템플릿들 정리...')
  
  try {
    const existingTemplates = await findTestTemplates()
    if (existingTemplates.length > 0) {
      console.log(`  🔍 기존 테스트 템플릿 ${existingTemplates.length}개 발견`)
      
      for (const template of existingTemplates) {
        await deleteTemplate(template.id)
        console.log(`  🗑️ 삭제: ${template.name} (ID: ${template.id})`)
      }
    } else {
      console.log('  ✅ 기존 테스트 템플릿 없음')
    }
  } catch (error) {
    console.log('  ⚠️ 정리 중 오류 (계속 진행):', error)
  }
}

async function testBatchCreate(): Promise<BatchResult> {
  const startTime = Date.now()
  
  const templates = [
    {
      identifier: "batch-test-template-1",
      name: "배치 테스트 템플릿 1",
      description: "배치 생성 테스트용 템플릿 1 - 헬스체크",
      query: "query BatchTest1 { health { status timestamp database version } }",
      tags: ["batch-test", "test", "generated"],
      complexityScore: 1
    },
    {
      identifier: "batch-test-template-2", 
      name: "배치 테스트 템플릿 2",
      description: "배치 생성 테스트용 템플릿 2 - 템플릿 검색",
      query: "query BatchTest2 { searchTemplates(pagination: { limit: 5 }) { templates { id name } } }",
      tags: ["batch-test", "test", "generated"],
      complexityScore: 1
    },
    {
      identifier: "batch-test-template-3",
      name: "배치 테스트 템플릿 3", 
      description: "배치 생성 테스트용 템플릿 3 - 인기 템플릿",
      query: "query BatchTest3 { searchTemplates(sort: { field: \"usageCount\", direction: desc }, pagination: { limit: 3 }) { templates { id name usageCount } } }",
      tags: ["batch-test", "test", "generated"],
      complexityScore: 2
    },
    {
      identifier: "batch-test-template-4",
      name: "배치 테스트 템플릿 4",
      description: "배치 생성 테스트용 템플릿 4 - 테이블 생성",
      query: "mutation BatchTest4($input: CreateTableInput!) { createTable(input: $input) { success table { id identifier } errors { message } } }",
      tags: ["batch-test", "test", "generated"],
      complexityScore: 2
    },
    {
      identifier: "batch-test-template-5",
      name: "배치 테스트 템플릿 5",
      description: "배치 생성 테스트용 템플릿 5 - 시스템 모니터링",
      query: "query BatchTest5 { systemMonitoring { memoryUsage { total available used percentage } } }",
      tags: ["batch-test", "test", "generated"],
      complexityScore: 3
    }
  ]
  
  const results = []
  const createdIds: string[] = []
  
  console.log(`  📊 ${templates.length}개 템플릿 생성 시작...`)
  
  for (const template of templates) {
    try {
      const result = await createTemplate(template)
      results.push({
        variables: { input: template },
        success: result.success,
        result: result.result,
        error: result.error
      })
      
      if (result.success && result.result.template?.id) {
        createdIds.push(result.result.template.id)
        console.log(`  ✅ 생성: ${template.name} (ID: ${result.result.template.id})`)
      } else {
        console.log(`  ❌ 실패: ${template.name} - ${result.error}`)
      }
      
    } catch (error) {
      results.push({
        variables: { input: template },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.log(`  ❌ 오류: ${template.name} - ${error}`)
    }
    
    // 템플릿 간 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  return {
    success: failed === 0,
    operation: 'CREATE',
    totalRequested: templates.length,
    successful,
    failed,
    createdIds,
    executionTimeMs: Date.now() - startTime,
    results
  }
}

async function testBatchUpdate(templateIds: string[]): Promise<BatchResult> {
  const startTime = Date.now()
  const results = []
  
  console.log(`  📊 ${templateIds.length}개 템플릿 업데이트 시작...`)
  
  for (const id of templateIds) {
    try {
      const updateInput = {
        tags: ["batch-test", "test", "updated", "verified"]
      }
      
      const result = await updateTemplate(id, updateInput)
      results.push({
        variables: { id, input: updateInput },
        success: result.success,
        result: result.result,
        error: result.error
      })
      
      if (result.success) {
        console.log(`  ✅ 업데이트: ${result.result.template?.name} (ID: ${id})`)
      } else {
        console.log(`  ❌ 실패: ID ${id} - ${result.error}`)
      }
      
    } catch (error) {
      results.push({
        variables: { id },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.log(`  ❌ 오류: ID ${id} - ${error}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  return {
    success: failed === 0,
    operation: 'UPDATE',
    totalRequested: templateIds.length,
    successful,
    failed,
    executionTimeMs: Date.now() - startTime,
    results
  }
}

async function testBatchDelete(templateIds: string[]): Promise<BatchResult> {
  const startTime = Date.now()
  const results = []
  
  console.log(`  📊 ${templateIds.length}개 템플릿 삭제 시작...`)
  
  for (const id of templateIds) {
    try {
      const result = await deleteTemplate(id)
      results.push({
        variables: { id },
        success: result.success,
        result: result.result,
        error: result.error
      })
      
      if (result.success) {
        console.log(`  ✅ 삭제: ID ${id}`)
      } else {
        console.log(`  ❌ 실패: ID ${id} - ${result.error}`)
      }
      
    } catch (error) {
      results.push({
        variables: { id },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.log(`  ❌ 오류: ID ${id} - ${error}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  return {
    success: failed === 0,
    operation: 'DELETE',
    totalRequested: templateIds.length,
    successful,
    failed,
    executionTimeMs: Date.now() - startTime,
    results
  }
}

async function findTestTemplates(): Promise<Array<{ id: string; name: string }>> {
  try {
    const query = `
      query FindTestTemplates {
        searchTemplates(
          filter: { tags: ["batch-test"] }
          pagination: { limit: 20 }
        ) {
          templates {
            id
            name
          }
        }
      }
    `
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    
    if (!response.ok) return []
    
    const data = await response.json()
    if (data.errors || !data.data?.searchTemplates?.templates) return []
    
    return data.data.searchTemplates.templates
    
  } catch {
    return []
  }
}

async function createTemplate(input: any): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const mutation = `
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
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: { input }
      })
    })
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }
    
    const data = await response.json()
    if (data.errors) {
      return { success: false, error: data.errors.map(e => e.message).join(', ') }
    }
    
    const result = data.data.createTemplate
    if (!result.success) {
      return { success: false, error: result.errors?.map(e => e.message).join(', ') }
    }
    
    return { success: true, result }
    
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function updateTemplate(id: string, input: any): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const mutation = `
      mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
        updateTemplate(id: $id, input: $input) {
          success
          template {
            id
            name
            tags
          }
          errors {
            message
          }
        }
      }
    `
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: { id, input }
      })
    })
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }
    
    const data = await response.json()
    if (data.errors) {
      return { success: false, error: data.errors.map(e => e.message).join(', ') }
    }
    
    const result = data.data.updateTemplate
    if (!result.success) {
      return { success: false, error: result.errors?.map(e => e.message).join(', ') }
    }
    
    return { success: true, result }
    
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function deleteTemplate(id: string): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const mutation = `
      mutation DeleteTemplate($id: ID!) {
        deleteTemplate(id: $id) {
          success
          errors {
            message
          }
        }
      }
    `
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: { id }
      })
    })
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }
    
    const data = await response.json()
    if (data.errors) {
      return { success: false, error: data.errors.map(e => e.message).join(', ') }
    }
    
    const result = data.data.deleteTemplate
    if (!result.success) {
      return { success: false, error: result.errors?.map(e => e.message).join(', ') }
    }
    
    return { success: true, result }
    
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function displayFinalSummary(results: BatchResult[]) {
  console.log('\n📊 배치 테스트 최종 결과:')
  
  let totalSuccess = 0
  let totalRequested = 0
  let totalTime = 0
  
  results.forEach(result => {
    console.log(`\n🎯 ${result.operation} 작업:`)
    console.log(`  ✅ 성공: ${result.successful}개`)
    console.log(`  ❌ 실패: ${result.failed}개`)
    console.log(`  📊 성공률: ${((result.successful / result.totalRequested) * 100).toFixed(1)}%`)
    console.log(`  ⏱️ 실행 시간: ${result.executionTimeMs}ms`)
    
    totalSuccess += result.successful
    totalRequested += result.totalRequested
    totalTime += result.executionTimeMs
  })
  
  console.log('\n🏆 전체 요약:')
  console.log(`  ✅ 총 성공: ${totalSuccess}개`)
  console.log(`  📊 전체 성공률: ${((totalSuccess / totalRequested) * 100).toFixed(1)}%`)
  console.log(`  ⏱️ 총 실행 시간: ${totalTime}ms`)
  
  const allSuccessful = results.every(r => r.success)
  if (allSuccessful) {
    console.log('\n🎉 모든 배치 작업이 성공적으로 완료되었습니다!')
  } else {
    console.log('\n⚠️ 일부 배치 작업에서 실패가 발생했습니다.')
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}