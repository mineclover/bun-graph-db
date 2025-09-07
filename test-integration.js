#!/usr/bin/env bun

/**
 * Simple JavaScript runner for the integration test
 * This bypasses TypeScript path resolution issues
 */

console.log('🚀 Starting Context-Layered Integration Test (JavaScript Runner)...')

async function runIntegrationTest() {
  try {
    // Import the test function
    const { testIntegration } = await import('./src/frontend/integration-test.ts')
    
    // Run the test
    const result = await testIntegration()
    
    console.log('')
    console.log('🎉 Integration Test Completed Successfully!')
    console.log('📊 Test Results:')
    console.log(`   - Success: ${result.success}`)
    console.log(`   - Memory Usage: ${Math.round(result.results.memoryUsage.heapUsed / 1024 / 1024)}MB`)
    console.log(`   - Performance Time: ${result.results.performanceTime}ms`)
    console.log(`   - Graph State Nodes: ${result.results.graphState.nodes.length}`)
    console.log(`   - Template State Templates: ${result.results.templateState.templates.length}`)
    
    return result
    
  } catch (error) {
    console.error('❌ Integration Test Failed:')
    console.error(error.message)
    console.error('')
    console.error('Stack trace:')
    console.error(error.stack)
    return { success: false, error }
  }
}

// Run the test
runIntegrationTest()
  .then(result => {
    if (result.success) {
      console.log('')
      console.log('✅ Context-Layered Architecture Integration: SUCCESSFUL')
      console.log('🚀 Ready for React component usage!')
      process.exit(0)
    } else {
      console.log('')
      console.log('❌ Context-Layered Architecture Integration: FAILED')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })