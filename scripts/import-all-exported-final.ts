#!/usr/bin/env bun

/**
 * Import All Exported Templates Script (Final Version)
 * 
 * exported-templates 디렉토리의 모든 JSON 파일들을 데이터베이스로 import하는 스크립트
 * - importTemplate 뮤테이션을 사용하여 안정적으로 import
 * - overwriteExisting 옵션으로 기존 템플릿 덮어쓰기 지원
 */

import { promises as fs } from 'fs'
import { join } from 'path'

interface ImportResult {
  success: boolean
  filename: string
  templateName?: string
  templateId?: string
  error?: string
  isNew?: boolean
  isUpdated?: boolean
  warnings?: string[]
}

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const EXPORTED_DIR = join(process.cwd(), 'exported-templates')

async function main() {
  console.log('🚀 Export된 템플릿들 자동 Import 시작 (Final Version)')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📂 Import 디렉토리: ${EXPORTED_DIR}`)
  
  try {
    // 1. Export 디렉토리에서 JSON 파일들 찾기
    const jsonFiles = await findJsonFiles()
    console.log(`\n📋 발견된 JSON 파일: ${jsonFiles.length}개`)
    
    if (jsonFiles.length === 0) {
      console.log('❌ Import할 JSON 파일이 없습니다.')
      return
    }
    
    // 2. 전체 파일 처리
    console.log('💡 전체 파일을 처리하여 에러 패턴을 분석합니다.')
    const testFiles = jsonFiles // 모든 파일 처리
    
    // 3. 선택된 파일들 Import
    console.log(`\n📤 선택된 ${testFiles.length}개 템플릿 Import 시작...`)
    const results = await importAllFiles(testFiles)
    
    // 4. 결과 요약
    displayImportResults(results)
    
    console.log('\n🎉 템플릿 Import 완료!')
    
  } catch (error) {
    console.error('💥 Import 실행 중 오류:', error)
    process.exit(1)
  }
}

async function findJsonFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(EXPORTED_DIR)
    const jsonFiles = files
      .filter(file => file.endsWith('.json'))
      .filter(file => !file.includes('INDEX')) // INDEX 파일 제외
      .sort() // 파일명순 정렬 (순위순)
    
    return jsonFiles
  } catch (error) {
    console.error(`❌ 디렉토리 읽기 실패: ${EXPORTED_DIR}`)
    throw error
  }
}

async function importAllFiles(jsonFiles: string[]): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  const batchSize = 2 // 동시 처리 개수 (낮춤 - import는 부하가 클 수 있음)
  
  for (let i = 0; i < jsonFiles.length; i += batchSize) {
    const batch = jsonFiles.slice(i, i + batchSize)
    console.log(`\n📦 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(jsonFiles.length / batchSize)} 처리 중... (${i + 1}-${Math.min(i + batchSize, jsonFiles.length)}/${jsonFiles.length})`)
    
    // 배치 단위로 병렬 처리
    const batchPromises = batch.map(filename => importSingleFile(filename))
    const batchResults = await Promise.allSettled(batchPromises)
    
    // 결과 처리
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      const filename = batch[j]
      
      if (result.status === 'fulfilled') {
        results.push(result.value)
        const status = result.value.success ? '✅' : '❌'
        const details = result.value.success 
          ? `${result.value.templateName} (${result.value.isNew ? 'NEW' : result.value.isUpdated ? 'UPDATED' : 'EXISTS'})`
          : result.value.error
        console.log(`  ${status} ${filename} - ${details}`)
        
        if (result.value.warnings && result.value.warnings.length > 0) {
          console.log(`    ⚠️ 경고: ${result.value.warnings.join(', ')}`)
        }
      } else {
        results.push({
          success: false,
          filename,
          error: result.reason?.message || '알 수 없는 오류'
        })
        console.log(`  ❌ ${filename} - ${result.reason?.message}`)
      }
    }
    
    // 배치 간 잠시 대기 (서버 부하 방지)
    if (i + batchSize < jsonFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  
  return results
}

async function importSingleFile(filename: string): Promise<ImportResult> {
  try {
    const filePath = join(EXPORTED_DIR, filename)
    
    // 1. JSON 파일 읽기
    const fileContent = await fs.readFile(filePath, 'utf8')
    const exportData = JSON.parse(fileContent)
    
    // 2. 템플릿 데이터 추출
    const template = exportData.template
    if (!template) {
      throw new Error('템플릿 데이터가 없습니다')
    }
    
    // 3. importTemplate 뮤테이션으로 import
    const importResult = await importTemplateViaMutation(exportData)
    
    return {
      success: importResult.success,
      filename,
      templateName: template.name,
      templateId: importResult.templateId,
      isNew: importResult.isNew,
      isUpdated: importResult.isUpdated,
      error: importResult.success ? undefined : importResult.error,
      warnings: importResult.warnings
    }
    
  } catch (error) {
    return {
      success: false,
      filename,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function importTemplateViaMutation(exportData: any): Promise<{ 
  success: boolean; 
  templateId?: string; 
  error?: string;
  isNew?: boolean;
  isUpdated?: boolean;
  warnings?: string[]
}> {
  try {
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
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { 
          jsonData,
          overwriteExisting: true  // 기존 템플릿이 있으면 업데이트
        }
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }
    
    const result = data.data.importTemplate
    
    if (!result.success) {
      throw new Error(`Import 실패: ${result.errors?.map(e => e.message).join(', ')}`)
    }
    
    // 경고 메시지에서 새로 생성인지 업데이트인지 판단
    const warnings = result.warnings || []
    const isUpdated = warnings.some(w => w.includes('Overwriting existing template'))
    const isNew = !isUpdated
    
    return {
      success: true,
      templateId: result.template?.id,
      isNew,
      isUpdated,
      warnings
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function displayImportResults(results: ImportResult[]) {
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  const newTemplates = results.filter(r => r.isNew)
  const updatedTemplates = results.filter(r => r.isUpdated)
  
  console.log('\n📊 Import 결과 요약:')
  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`    🆕 새로 생성: ${newTemplates.length}개`)
  console.log(`    🔄 업데이트: ${updatedTemplates.length}개`) 
  console.log(`  ❌ 실패: ${failed.length}개`)
  console.log(`  📈 전체: ${results.length}개 파일`)
  
  if (failed.length > 0) {
    console.log('\n❌ 실패한 파일들:')
    failed.forEach(result => {
      console.log(`  - ${result.filename}: ${result.error}`)
    })
    
    // 에러 패턴 분석
    console.log('\n🔍 에러 패턴 분석:')
    const errorPatterns = failed.reduce((acc, result) => {
      const error = result.error || 'Unknown error'
      
      // 주요 에러 패턴 추출
      if (error.includes('Syntax Error: Unexpected character: "/"')) {
        acc['GraphQL 주석 파싱 에러'] = (acc['GraphQL 주석 파싱 에러'] || 0) + 1
      } else if (error.includes('already exists')) {
        acc['중복 템플릿 에러'] = (acc['중복 템플릿 에러'] || 0) + 1
      } else if (error.includes('Valid operation type is required')) {
        acc['잘못된 operationType'] = (acc['잘못된 operationType'] || 0) + 1
      } else if (error.includes('Failed to parse GraphQL operation')) {
        acc['GraphQL 파싱 에러'] = (acc['GraphQL 파싱 에러'] || 0) + 1
      } else if (error.includes('HTTP')) {
        acc['네트워크/HTTP 에러'] = (acc['네트워크/HTTP 에러'] || 0) + 1
      } else {
        acc['기타 에러'] = (acc['기타 에러'] || 0) + 1
      }
      
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(errorPatterns).forEach(([pattern, count]) => {
      console.log(`  📋 ${pattern}: ${count}개`)
    })
  }
  
  if (newTemplates.length > 0) {
    console.log('\n🆕 새로 생성된 템플릿들:')
    newTemplates.slice(0, 5).forEach(result => {
      console.log(`  - ${result.templateName} (ID: ${result.templateId})`)
    })
    if (newTemplates.length > 5) {
      console.log(`  ... 및 ${newTemplates.length - 5}개 더`)
    }
  }
  
  if (updatedTemplates.length > 0) {
    console.log('\n🔄 업데이트된 템플릿들:')
    updatedTemplates.slice(0, 5).forEach(result => {
      console.log(`  - ${result.templateName} (ID: ${result.templateId})`)
    })
    if (updatedTemplates.length > 5) {
      console.log(`  ... 및 ${updatedTemplates.length - 5}개 더`)
    }
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}