#!/usr/bin/env bun

/**
 * 시스템 모니터링 템플릿을 데이터베이스에 임포트하는 스크립트
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

interface MonitoringTemplate {
  identifier: string
  name: string
  description: string
  version: string
  query: string
  operationType: string
  variables: any[]
  defaultVariables: Record<string, any>
  tags: string[]
  complexity: number
  estimatedExecutionTime: number
  applicableTables: string[]
  isActive: boolean
  createdBy: string
  validationRules: any[]
  metadata: Record<string, any>
}

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
const TEMPLATES_DIR = join(process.cwd(), 'demo', 'templates')

async function createTemplate(template: MonitoringTemplate) {
  const mutation = `
    mutation CreateMonitoringTemplate($input: CreateQueryTemplateInput!) {
      createTemplate(input: $input) {
        success
        template {
          id
          identifier
          name
          version
          isActive
        }
        errors {
          message
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
      variables: template.variables.length > 0 ? template.variables : null,
      defaultVariables: Object.keys(template.defaultVariables).length > 0 ? template.defaultVariables : null,
      applicableTables: template.applicableTables,
      complexityScore: template.complexity,
      version: template.version,
      tags: template.tags,
      createdBy: template.createdBy
    }
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables
      })
    })

    const result = await response.json()
    
    if (result.errors) {
      console.log(`❌ GraphQL 오류 - ${template.identifier}:`)
      result.errors.forEach((error: any) => {
        console.log(`   ${error.message}`)
      })
      return false
    } else if (!result.data?.createTemplate?.success) {
      console.log(`❌ 템플릿 생성 실패 - ${template.identifier}:`)
      if (result.data?.createTemplate?.errors) {
        result.data.createTemplate.errors.forEach((error: any) => {
          console.log(`   ${error.message}`)
        })
      }
      return false
    } else {
      console.log(`✅ 템플릿 생성 성공 - ${template.identifier}`)
      return true
    }
  } catch (error) {
    console.log(`❌ 네트워크 오류 - ${template.identifier}: ${error}`)
    return false
  }
}

async function importMonitoringTemplates() {
  console.log('🔄 시스템 모니터링 템플릿 임포트 시작...\n')

  // 모니터링 관련 템플릿 파일 찾기
  const monitoringTemplates = [
    'system-health-check_v1-0-0.json',
    'system-statistics-full_v1-0-0.json', 
    'memory-monitoring-detailed_v1-0-0.json',
    'system-monitoring-dashboard_v1-0-0.json',
    'process-memory-analysis_v1-0-0.json'
  ]

  let successCount = 0
  let totalCount = monitoringTemplates.length

  for (const templateFile of monitoringTemplates) {
    const templatePath = join(TEMPLATES_DIR, templateFile)
    
    try {
      console.log(`📄 처리 중: ${templateFile}`)
      const templateContent = readFileSync(templatePath, 'utf-8')
      const template = JSON.parse(templateContent) as MonitoringTemplate
      
      const success = await createTemplate(template)
      if (success) {
        successCount++
      }
      
      console.log('')
    } catch (error) {
      console.log(`❌ 파일 읽기 오류 - ${templateFile}: ${error}\n`)
    }
  }

  console.log('📊 임포트 결과:')
  console.log(`   성공: ${successCount}/${totalCount}`)
  console.log(`   실패: ${totalCount - successCount}/${totalCount}`)
  
  if (successCount === totalCount) {
    console.log('\n🎉 모든 모니터링 템플릿이 성공적으로 임포트되었습니다!')
    console.log('\n📋 생성된 템플릿:')
    console.log('   • system-health-check_v1-0-0: 시스템 헬스 체크')
    console.log('   • system-statistics-full_v1-0-0: 전체 시스템 통계')
    console.log('   • memory-monitoring-detailed_v1-0-0: 상세 메모리 모니터링')
    console.log('   • system-monitoring-dashboard_v1-0-0: 모니터링 대시보드')
  } else {
    console.log('\n⚠️  일부 템플릿 임포트에 실패했습니다. 서버 상태를 확인해주세요.')
  }
}

// 스크립트 실행
await importMonitoringTemplates()