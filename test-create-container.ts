console.log('🔍 [1] Starting createContainer test...')

import { createContainer } from './src/infrastructure/container/ContainerBootstrap'
console.log('✅ [2] Imported ContainerBootstrap')

console.log('🔍 [3] Calling createContainer()...')
const container = await createContainer()
console.log('✅ [4] Container created successfully!')

console.log('✅ Test complete!')
