#!/usr/bin/env bun

/**
 * 시스템 모니터링 템플릿 export 스크립트
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
const EXPORT_DIR = join(process.cwd(), 'exported-templates')

async function exportTemplate(identifier: string) {
  const mutation = `
    mutation ExportMonitoringTemplate($templateIdentifier: String!) {
      exportTemplate(templateIdentifier: $templateIdentifier, includeStatistics: true) {
        success
        exportData
        filename
        errors {
          message
        }
      }
    }
  `

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { templateIdentifier: identifier },
      }),
    })

    const result = await response.json()

    if (result.errors) {
      console.log(`❌ GraphQL 오류 - ${identifier}:`)
      result.errors.forEach((error: any) => {
        console.log(`   ${error.message}`)
      })
      return null
    } else if (!result.data?.exportTemplate?.success) {
      console.log(`❌ 템플릿 export 실패 - ${identifier}:`)
      if (result.data?.exportTemplate?.errors) {
        result.data.exportTemplate.errors.forEach((error: any) => {
          console.log(`   ${error.message}`)
        })
      }
      return null
    } else {
      console.log(`✅ 템플릿 export 성공 - ${identifier}`)
      return {
        data: result.data.exportTemplate.exportData,
        filename: result.data.exportTemplate.filename,
      }
    }
  } catch (error) {
    console.log(`❌ 네트워크 오류 - ${identifier}: ${error}`)
    return null
  }
}

async function searchMonitoringTemplates() {
  const query = `
    query SearchMonitoringTemplates {
      searchTemplates(
        filter: {
          tags: ["monitoring"]
          tagMatchMode: ANY
          isActive: true
        }
        pagination: {
          limit: 20
          offset: 0
        }
      ) {
        templates {
          identifier
          name
          description
          query
          operationType
          variables
          defaultVariables
          tags
          complexityScore
          version
          isActive
          createdBy
          usageCount
          lastUsedAt
          avgExecutionTimeMs
        }
        totalCount
      }
    }
  `

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    const result = await response.json()

    if (result.errors) {
      console.log(`❌ 모니터링 템플릿 검색 실패:`)
      result.errors.forEach((error: any) => {
        console.log(`   ${error.message}`)
      })
      return []
    }

    return result.data?.searchTemplates?.templates || []
  } catch (error) {
    console.log(`❌ 네트워크 오류: ${error}`)
    return []
  }
}

async function exportMonitoringTemplates() {
  console.log('🔄 시스템 모니터링 템플릿 export 시작...\n')

  // 모니터링 템플릿 검색
  console.log('🔍 모니터링 템플릿 검색 중...')
  const templates = await searchMonitoringTemplates()

  if (templates.length === 0) {
    console.log('❌ 모니터링 템플릿을 찾을 수 없습니다.')
    return
  }

  console.log(`📊 ${templates.length}개의 모니터링 템플릿을 발견했습니다.\n`)

  let successCount = 0
  const exportedTemplates: any[] = []

  // 각 템플릿 export
  for (const template of templates) {
    console.log(`📄 Export 중: ${template.identifier}`)

    const exported = await exportTemplate(template.identifier)
    if (exported) {
      try {
        const exportData = JSON.parse(exported.data)
        exportedTemplates.push(exportData)

        // 개별 파일로 저장
        const filename = `${template.identifier}_exported.json`
        const filepath = join(process.cwd(), 'exported-templates', filename)

        try {
          writeFileSync(filepath, JSON.stringify(exportData, null, 2))
          console.log(`   💾 파일 저장됨: ${filename}`)
          successCount++
        } catch (writeError) {
          console.log(`   ❌ 파일 저장 실패: ${writeError}`)
        }
      } catch (parseError) {
        console.log(`   ❌ JSON 파싱 실패: ${parseError}`)
      }
    }
    console.log('')
  }

  // 통합 파일 생성
  if (exportedTemplates.length > 0) {
    try {
      const combinedFilePath = join(
        process.cwd(),
        'exported-templates',
        'all-monitoring-templates.json'
      )
      const combinedExport = {
        exportedAt: new Date().toISOString(),
        totalTemplates: exportedTemplates.length,
        templates: exportedTemplates,
        summary: {
          templateTypes: [...new Set(exportedTemplates.map((t) => t.operationType))],
          tags: [...new Set(exportedTemplates.flatMap((t) => t.tags || []))],
          avgComplexity: Math.round(
            exportedTemplates.reduce((sum, t) => sum + (t.complexity || 0), 0) /
              exportedTemplates.length
          ),
          totalUsage: exportedTemplates.reduce((sum, t) => sum + (t.usageCount || 0), 0),
        },
      }

      writeFileSync(combinedFilePath, JSON.stringify(combinedExport, null, 2))
      console.log(`📦 통합 export 파일 생성: all-monitoring-templates.json`)
    } catch (error) {
      console.log(`❌ 통합 파일 생성 실패: ${error}`)
    }
  }

  console.log('\n📊 Export 결과:')
  console.log(`   성공: ${successCount}/${templates.length}`)
  console.log(`   실패: ${templates.length - successCount}/${templates.length}`)

  if (successCount === templates.length) {
    console.log('\n🎉 모든 모니터링 템플릿이 성공적으로 export되었습니다!')
    console.log('\n📋 Export된 템플릿 종류:')
    const uniqueTags = [...new Set(exportedTemplates.flatMap((t) => t.tags || []))]
    uniqueTags.forEach((tag) => {
      console.log(`   • ${tag}`)
    })

    console.log('\n📂 Export 위치:')
    console.log(`   • 개별 파일: ./exported-templates/`)
    console.log(`   • 통합 파일: ./exported-templates/all-monitoring-templates.json`)
  } else {
    console.log('\n⚠️  일부 템플릿 export에 실패했습니다.')
  }
}

// 디렉토리 생성
try {
  const fs = require('node:fs')
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true })
  }
} catch (error) {
  console.log(`❌ Export 디렉토리 생성 실패: ${error}`)
  process.exit(1)
}

// 스크립트 실행
await exportMonitoringTemplates()
