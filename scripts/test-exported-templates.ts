#!/usr/bin/env bun

/**
 * Test Exported Templates Script
 * 
 * Tests all exported monitoring templates to verify they work correctly
 * through the GraphQL API.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

interface ExportedTemplate {
  version: string
  exportedAt: string
  template: {
    identifier: string
    name: string
    description: string
    query: string
    queryName: string[]
    operationType: string
    variables?: object
    variablesSchema?: object
    defaultVariables?: object
    applicableTables: string[]
    complexityScore: number
    version: string
    tags: string[]
    isActive: boolean
    statistics: {
      usageCount: number
      avgExecutionTimeMs: number
      lastUsedAt: string | null
    }
  }
}

async function executeGraphQLQuery(query: string, variables?: object) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result = await response.json()
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`)
  }

  return result
}

async function testTemplate(templateFile: string) {
  console.log(`\n🧪 Testing template: ${templateFile}`)
  
  try {
    // Read the template file
    const filePath = join('./exported-templates', templateFile)
    const templateData: ExportedTemplate = JSON.parse(readFileSync(filePath, 'utf-8'))
    
    console.log(`   📋 Name: ${templateData.template.name}`)
    console.log(`   🔧 Complexity: ${templateData.template.complexityScore}`)
    console.log(`   🏷️  Tags: ${templateData.template.tags.join(', ')}`)
    
    // Execute the template query
    const startTime = Date.now()
    const result = await executeGraphQLQuery(templateData.template.query)
    const executionTime = Date.now() - startTime
    
    console.log(`   ✅ PASSED (${executionTime}ms)`)
    console.log(`   📊 Data keys: ${Object.keys(result.data || {}).join(', ')}`)
    
    // Show sample of returned data
    if (result.data) {
      const firstKey = Object.keys(result.data)[0]
      if (firstKey && result.data[firstKey]) {
        const sampleData = result.data[firstKey]
        if (typeof sampleData === 'object' && sampleData !== null) {
          const sampleKeys = Object.keys(sampleData).slice(0, 3)
          console.log(`   🔍 Sample fields: ${sampleKeys.join(', ')}${sampleKeys.length > 2 ? ', ...' : ''}`)
        }
      }
    }
    
    return { success: true, executionTime, templateFile }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`)
    return { success: false, error: String(error), templateFile }
  }
}

async function main() {
  console.log('🚀 Testing Exported Monitoring Templates')
  console.log('==========================================')
  console.log(`📡 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`)
  
  // Test server connectivity first
  try {
    await executeGraphQLQuery('{ __typename }')
    console.log('✅ Server connectivity confirmed')
  } catch (error) {
    console.log(`❌ Cannot connect to server: ${error}`)
    process.exit(1)
  }
  
  // Get all template files
  const templateFiles = [
    'system-health-check_v1-0-0_exported.json',
    'system-statistics-full_v1-0-0_exported.json', 
    'memory-monitoring-detailed_v1-0-0_exported.json',
    'system-monitoring-dashboard_v1-0-0_exported.json',
    'process-memory-analysis_v1-0-0_exported.json'
  ]
  
  const results = []
  let totalTime = 0
  
  // Test each template
  for (const templateFile of templateFiles) {
    const result = await testTemplate(templateFile)
    results.push(result)
    if (result.success && result.executionTime) {
      totalTime += result.executionTime
    }
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY')
  console.log('================')
  console.log(`⏱️  Total Execution Time: ${totalTime}ms`)
  console.log(`📈 Average Time per Template: ${Math.round(totalTime / templateFiles.length)}ms`)
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log(`✅ Passed: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${Math.round((successful / results.length) * 100)}%`)
  
  if (failed > 0) {
    console.log('\n🔍 FAILED TEMPLATES:')
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.templateFile}: ${r.error}`)
    })
  }
  
  // Performance insights
  if (successful > 0) {
    console.log('\n⚡ PERFORMANCE INSIGHTS:')
    results.filter(r => r.success && r.executionTime).forEach(r => {
      const speed = r.executionTime! < 50 ? '🚄' : r.executionTime! < 100 ? '🚶' : '🐌'
      console.log(`   ${speed} ${r.templateFile.replace('_v1-0-0_exported.json', '')}: ${r.executionTime}ms`)
    })
  }
  
  console.log('\n🎉 Template validation complete!')
  
  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})