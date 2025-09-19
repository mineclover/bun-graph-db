#!/usr/bin/env bun

/**
 * Import All Exported Templates Script
 *
 * exported-templates 디렉토리의 모든 JSON 파일들을 데이터베이스로 import하는 스크립트
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

interface ImportResult {
  success: boolean
  filename: string
  templateName?: string
  templateId?: string
  error?: string
  isNew?: boolean
  isUpdated?: boolean
}

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const EXPORTED_DIR = join(process.cwd(), 'exported-templates')

async function main() {
  console.log('🚀 Export된 템플릿들 자동 Import 시작')
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

    // 2. 모든 파일 Import
    console.log('\n📤 모든 템플릿 Import 시작...')
    const results = await importAllFiles(jsonFiles)

    // 3. 결과 요약
    displayImportResults(results)

    console.log('\n🎉 모든 템플릿 Import 완료!')
  } catch (error) {
    console.error('💥 Import 실행 중 오류:', error)
    process.exit(1)
  }
}

async function findJsonFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(EXPORTED_DIR)
    const jsonFiles = files
      .filter((file) => file.endsWith('.json'))
      .filter((file) => !file.includes('INDEX')) // INDEX 파일 제외
      .sort() // 파일명순 정렬 (순위순)

    return jsonFiles
  } catch (error) {
    console.error(`❌ 디렉토리 읽기 실패: ${EXPORTED_DIR}`)
    throw error
  }
}

async function importAllFiles(jsonFiles: string[]): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  const batchSize = 3 // 동시 처리 개수 (낮춤 - import는 부하가 클 수 있음)

  for (let i = 0; i < jsonFiles.length; i += batchSize) {
    const batch = jsonFiles.slice(i, i + batchSize)
    console.log(
      `\n📦 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(jsonFiles.length / batchSize)} 처리 중... (${i + 1}-${Math.min(i + batchSize, jsonFiles.length)}/${jsonFiles.length})`
    )

    // 배치 단위로 병렬 처리
    const batchPromises = batch.map((filename) => importSingleFile(filename))
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
      } else {
        results.push({
          success: false,
          filename,
          error: result.reason?.message || '알 수 없는 오류',
        })
        console.log(`  ❌ ${filename} - ${result.reason?.message}`)
      }
    }

    // 배치 간 잠시 대기 (서버 부하 방지)
    if (i + batchSize < jsonFiles.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
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

    // 3. 기존 템플릿 존재 확인
    const existingTemplate = await checkTemplateExists(template.identifier)

    if (existingTemplate) {
      // 4-1. 기존 템플릿 업데이트
      const updateResult = await updateTemplate(existingTemplate.id, template)
      return {
        success: updateResult.success,
        filename,
        templateName: template.name,
        templateId: existingTemplate.id,
        isUpdated: updateResult.success,
        error: updateResult.success ? undefined : updateResult.error,
      }
    } else {
      // 4-2. 새 템플릿 생성
      const createResult = await createTemplate(template)
      return {
        success: createResult.success,
        filename,
        templateName: template.name,
        templateId: createResult.templateId,
        isNew: createResult.success,
        error: createResult.success ? undefined : createResult.error,
      }
    }
  } catch (error) {
    return {
      success: false,
      filename,
      error: error instanceof Error ? error.message : String(error),
    }
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
        variables: { identifier },
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

async function createTemplate(
  template: any
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createQueryTemplate(input: $input) {
          success
          template {
            id
          }
          errors {
            message
          }
        }
      }
    `

    const input = {
      identifier: template.identifier,
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
      tags: template.tags,
    }

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    const result = data.data.createQueryTemplate

    if (!result.success) {
      throw new Error(`생성 실패: ${result.errors?.map((e) => e.message).join(', ')}`)
    }

    return {
      success: true,
      templateId: result.template.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function updateTemplate(
  templateId: string,
  template: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const mutation = `
      mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
        updateQueryTemplate(id: $id, input: $input) {
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
      tags: template.tags,
    }

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { id: templateId, input },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    const result = data.data.updateQueryTemplate

    if (!result.success) {
      throw new Error(`업데이트 실패: ${result.errors?.map((e) => e.message).join(', ')}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function displayImportResults(results: ImportResult[]) {
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const newTemplates = results.filter((r) => r.isNew)
  const updatedTemplates = results.filter((r) => r.isUpdated)
  const existingTemplates = successful.filter((r) => !r.isNew && !r.isUpdated)

  console.log('\n📊 Import 결과 요약:')
  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`    🆕 새로 생성: ${newTemplates.length}개`)
  console.log(`    🔄 업데이트: ${updatedTemplates.length}개`)
  console.log(`    📋 기존 유지: ${existingTemplates.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)
  console.log(`  📈 전체: ${results.length}개 파일`)

  if (failed.length > 0) {
    console.log('\n❌ 실패한 파일들:')
    failed.forEach((result) => {
      console.log(`  - ${result.filename}: ${result.error}`)
    })
  }

  if (newTemplates.length > 0) {
    console.log('\n🆕 새로 생성된 템플릿들:')
    newTemplates.slice(0, 10).forEach((result) => {
      console.log(`  - ${result.templateName} (ID: ${result.templateId})`)
    })
    if (newTemplates.length > 10) {
      console.log(`  ... 및 ${newTemplates.length - 10}개 더`)
    }
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}
