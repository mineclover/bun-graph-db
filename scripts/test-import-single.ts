#!/usr/bin/env bun

/**
 * Test Import Single Template Script
 * 
 * 단일 export된 JSON 파일을 import하는 테스트 스크립트
 */

import { promises as fs } from 'fs'
import { join } from 'path'

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const TEST_FILE = join(process.cwd(), 'test-import', '70-subscribe-system-health-v1-0-0_v1-0-0.json')

async function main() {
  console.log('🧪 단일 템플릿 Import 테스트 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📄 테스트 파일: ${TEST_FILE}`)
  
  try {
    // 1. 파일 존재 확인
    await fs.access(TEST_FILE)
    
    // 2. JSON 파일 읽기
    const fileContent = await fs.readFile(TEST_FILE, 'utf8')
    const exportData = JSON.parse(fileContent)
    
    console.log('\n📋 템플릿 정보:')
    console.log(`  - 식별자: ${exportData.template.identifier}`)
    console.log(`  - 이름: ${exportData.template.name}`)
    console.log(`  - 타입: ${exportData.template.operationType}`)
    console.log(`  - 쿼리: ${exportData.template.query.length}자`)
    
    // 3. 기존 템플릿 존재 확인
    const existingTemplate = await checkTemplateExists(exportData.template.identifier)
    console.log(`\n🔍 기존 템플릿 확인: ${existingTemplate ? `있음 (ID: ${existingTemplate.id})` : '없음'}`)
    
    if (existingTemplate) {
      console.log('⚠️ 이미 존재하는 템플릿입니다. 업데이트를 시도합니다.')
      const result = await updateTemplate(existingTemplate.id, exportData.template)
      if (result.success) {
        console.log('✅ 템플릿 업데이트 성공!')
      } else {
        console.log(`❌ 템플릿 업데이트 실패: ${result.error}`)
      }
    } else {
      console.log('🆕 새 템플릿을 생성합니다.')
      const result = await createTemplate(exportData)  // 전체 exportData를 전달
      if (result.success) {
        console.log(`✅ 템플릿 생성 성공! ID: ${result.templateId}`)
      } else {
        console.log(`❌ 템플릿 생성 실패: ${result.error}`)
      }
    }
    
  } catch (error) {
    console.error('💥 테스트 실행 중 오류:', error)
    process.exit(1)
  }
}

async function checkTemplateExists(identifier: string): Promise<{ id: string } | null> {
  try {
    const query = `
      query CheckTemplate($identifier: String!) {
        getQueryTemplates(
          limit: 1
          filter: { search: $identifier }
        ) {
          templates {
            id
            identifier
          }
        }
      }
    `
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { identifier }
      }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const templates = data.data?.getQueryTemplates?.templates || []
    
    // identifier가 정확히 일치하는 템플릿 찾기
    const exactMatch = templates.find((t: any) => t.identifier === identifier)
    return exactMatch ? { id: exactMatch.id } : null
    
  } catch {
    return null
  }
}

async function createTemplate(exportData: any): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    // importTemplate 뮤테이션 사용
    const mutation = `
      mutation ImportTemplate($jsonData: String!, $overwriteExisting: Boolean) {
        importTemplate(jsonData: $jsonData, overwriteExisting: $overwriteExisting) {
          success
          template {
            id
          }
          errors {
            message
          }
          warnings
        }
      }
    `
    
    const jsonData = JSON.stringify(exportData)
    
    console.log('\n📤 Import 요청:')
    console.log(`  - 데이터 크기: ${jsonData.length}자`)
    console.log(`  - overwriteExisting: true`)
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { 
          jsonData,
          overwriteExisting: true  // 덮어쓰기 테스트
        }
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.log('GraphQL 응답 오류:', JSON.stringify(data.errors, null, 2))
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }
    
    const result = data.data.importTemplate
    
    if (!result.success) {
      console.log('Import 실패 응답:', JSON.stringify(result, null, 2))
      throw new Error(`Import 실패: ${result.errors?.map(e => e.message).join(', ')}`)
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️ Import 경고:', result.warnings.join(', '))
    }
    
    return {
      success: true,
      templateId: result.template?.id
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function updateTemplate(templateId: string, template: any): Promise<{ success: boolean; error?: string }> {
  try {
    const mutation = `
      mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
        updateTemplate(id: $id, input: $input) {
          success
          errors {
            message
          }
        }
      }
    `
    
    const input = {
      name: template.name,
      description: template.description,
      query: template.query,
      queryName: Array.isArray(template.queryName) ? template.queryName[0] : template.queryName,
      variables: template.variables,
      variablesSchema: template.variablesSchema,
      defaultVariables: template.defaultVariables,
      applicableTables: template.applicableTables,
      complexityScore: template.complexityScore,
      version: template.version,
      tags: template.tags
    }
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { id: templateId, input }
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }
    
    const result = data.data.updateTemplate
    
    if (!result.success) {
      throw new Error(`업데이트 실패: ${result.errors?.map(e => e.message).join(', ')}`)
    }
    
    return { success: true }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}