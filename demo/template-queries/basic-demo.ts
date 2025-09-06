#!/usr/bin/env bun

/**
 * Basic Template Query Demo
 * 
 * 기본적인 템플릿 CRUD 작업 시연
 */

import { GraphQLClient } from '../utils/graphql-client.js'
import { demoTemplates } from '../fixtures/demo-templates.js'

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
      const templates = templatesResponse.data?.templates || []
      results.push(`📋 Found ${templates.length} templates`)
      
      templates.forEach((template: any, index: number) => {
        results.push(`${index + 1}. ${template.name} (${template.identifier})`)
        results.push(`   Type: ${template.operationType || 'unknown'}`)
        results.push(`   Usage: ${template.usageCount || 0} times`)
        results.push(`   Avg Time: ${template.avgExecutionTimeMs || 0}ms`)
      })
    }
  } catch (error) {
    results.push(`❌ Failed to fetch templates: ${error}`)
  }
  
  // 3. 새 템플릿 생성
  results.push('\n=== Creating Demo Template ===')
  const demoTemplate = demoTemplates[0] // Get User by ID template
  
  try {
    const createResponse = await client.createTemplate({
      identifier: demoTemplate.identifier,
      name: demoTemplate.name,
      queryText: demoTemplate.queryText,
      tags: demoTemplate.tags,
      description: demoTemplate.description,
      variablesSchema: demoTemplate.variablesSchema,
    })
    
    if (createResponse.errors) {
      results.push(`❌ Template creation failed: ${createResponse.errors[0]?.message}`)
    } else {
      const template = createResponse.data?.createTemplate
      results.push(`✅ Template created successfully`)
      results.push(`   ID: ${template?.id}`)
      results.push(`   Query Name: ${template?.queryName || 'anonymous'}`)
      results.push(`   Operation: ${template?.operationType}`)
      results.push(`   Complexity: ${template?.complexityScore}`)
    }
  } catch (error) {
    results.push(`❌ Template creation error: ${error}`)
  }
  
  // 4. 템플릿 검색 테스트
  results.push('\n=== Template Search ===')
  try {
    const searchResponse = await client.searchTemplates({
      tags: ['demo'],
      limit: 5,
    })
    
    if (searchResponse.errors) {
      results.push(`❌ Search failed: ${searchResponse.errors[0]?.message}`)
    } else {
      const searchResult = searchResponse.data?.searchTemplates
      results.push(`🔍 Search Results: ${searchResult?.items?.length || 0} templates found`)
      results.push(`   Total: ${searchResult?.total || 0}`)
      results.push(`   Has Next: ${searchResult?.hasNextPage || false}`)
      
      searchResult?.items?.forEach((template: any, index: number) => {
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
      const templates = statsResponse.data?.templates || []
      results.push(`📊 Top Performance Templates:`)
      
      templates.slice(0, 3).forEach((template: any, index: number) => {
        results.push(`${index + 1}. ${template.name}`)
        results.push(`   Usage: ${template.usageCount} times`)
        results.push(`   Avg Time: ${template.avgExecutionTimeMs}ms`)
        results.push(`   Complexity: ${template.complexityScore}`)
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
    console.error('❌ Cannot connect to server. Please check the server URL and ensure it\'s running.')
    process.exit(1)
  }
  
  // 데모 실행
  await runner.runDemo('Basic Template Operations', runBasicDemo)
  runner.printSummary()
}