#!/usr/bin/env bun

/**
 * Basic Template Query Demo
 *
 * 기본적인 템플릿 CRUD 작업 시연
 */

import { demoTemplates } from '../fixtures/demo-templates.js'
import type { GraphQLClient } from '../utils/graphql-client.js'

export async function runBasicDemo(client: GraphQLClient): Promise<string> {
  const results = []

  // 1. 헬스체크
  results.push('=== Health Check ===')
  try {
    const health = await client.healthCheck()
    results.push(`✅ Server Status: ${health.status}`)
    results.push(`🕐 Timestamp: ${health.timestamp}`)
  } catch (error) {
    results.push(`❌ Health check failed: ${error}`)
  }

  // 2. 기존 템플릿 목록 조회
  results.push('\n=== Current Templates ===')
  try {
    const templatesResponse = await client.getAllTemplates(5)

    if (templatesResponse.errors) {
      results.push(`❌ Error fetching templates: ${templatesResponse.errors[0]?.message}`)
    } else {
      const templates = templatesResponse.data?.searchTemplates?.nodes || []
      results.push(`📋 Found ${templates.length} templates`)

      templates.forEach((template: any, index: number) => {
        results.push(`${index + 1}. ${template.name} (${template.identifier})`)
        results.push(`   Active: ${template.isActive || false}`)
        results.push(`   Usage: ${template.usageCount || 0} times`)
        results.push(`   Created: ${template.createdAt}`)
      })
    }
  } catch (error) {
    results.push(`❌ Failed to fetch templates: ${error}`)
  }

  // 3. 새 템플릿 생성
  results.push('\n=== Creating Demo Template ===')
  const demoTemplate = demoTemplates[0] // Get User by ID template

  if (!demoTemplate) {
    results.push('❌ No demo template available')
    return results.join('\n')
  }

  try {
    const createResponse = await client.createTemplate({
      identifier: demoTemplate.identifier,
      name: demoTemplate.name,
      query: demoTemplate.query,
      description: demoTemplate.description,
      variables: demoTemplate.defaultVariables,
    })

    if (createResponse.errors) {
      results.push(`❌ Template creation failed: ${createResponse.errors[0]?.message}`)
    } else {
      const template = createResponse.data?.createTemplate?.template
      results.push(`✅ Template created successfully`)
      results.push(`   ID: ${template?.id}`)
      results.push(`   Name: ${template?.name}`)
      results.push(`   Identifier: ${template?.identifier}`)
      results.push(`   Active: ${template?.isActive}`)
    }
  } catch (error) {
    results.push(`❌ Template creation error: ${error}`)
  }

  // 4. 템플릿 검색 테스트
  results.push('\n=== Template Search ===')
  try {
    const searchResponse = await client.searchTemplates({
      search: 'demo',
      limit: 5,
    })

    if (searchResponse.errors) {
      results.push(`❌ Search failed: ${searchResponse.errors[0]?.message}`)
    } else {
      const searchResult = searchResponse.data?.searchTemplates
      results.push(`🔍 Search Results: ${searchResult?.nodes?.length || 0} templates found`)
      results.push(`   Total: ${searchResult?.totalCount || 0}`)
      results.push(`   Has Next: ${searchResult?.hasNextPage || false}`)

      searchResult?.nodes?.forEach((template: any, index: number) => {
        results.push(`${index + 1}. ${template.name} (${template.identifier})`)
      })
    }
  } catch (error) {
    results.push(`❌ Search error: ${error}`)
  }

  // 5. 성능 통계 조회
  results.push('\n=== Performance Statistics ===')
  try {
    const statsResponse = await client.getPerformanceStats()

    if (statsResponse.errors) {
      results.push(`❌ Stats failed: ${statsResponse.errors[0]?.message}`)
    } else {
      const templates = statsResponse.data?.searchTemplates?.nodes || []
      results.push(`📊 Top Templates:`)

      templates.slice(0, 3).forEach((template: any, index: number) => {
        results.push(`${index + 1}. ${template.name}`)
        results.push(`   Usage: ${template.usageCount} times`)
        results.push(`   Identifier: ${template.identifier}`)
        results.push(`   Active: ${template.isActive}`)
      })
    }
  } catch (error) {
    results.push(`❌ Stats error: ${error}`)
  }

  results.push('\n=== Basic Demo Completed ===')
  return results.join('\n')
}

// 직접 실행 시
if (import.meta.main) {
  const { DemoRunner, parseCliArgs } = await import('../utils/demo-runner.js')

  const options = parseCliArgs()
  const runner = new DemoRunner(options)

  console.log('🎯 Basic Template Query Demo')

  // 연결 테스트
  const isConnected = await runner.testConnection()
  if (!isConnected) {
    console.error("❌ Cannot connect to server. Please check the server URL and ensure it's running.")
    process.exit(1)
  }

  // 데모 실행
  await runner.runDemo('Basic Template Operations', runBasicDemo)
  runner.printSummary()
}
