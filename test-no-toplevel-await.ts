console.log('🔍 [1] Importing createContainer...')
import { createContainer } from './src/infrastructure/container/ContainerBootstrap.js'
console.log('✅ [1] createContainer imported')

console.log('🔍 [2] Calling createContainer() in async function (NOT top-level)...')

async function main() {
  console.log('🔍 [3] Inside main(), about to call createContainer()...')
  const container = await createContainer()
  console.log('✅ [3] createContainer() returned!')
  console.log('✅ Test complete!')
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})

console.log('🔍 [4] main() called, waiting for completion...')
