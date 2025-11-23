console.log('🔍 [1] Importing createContainer...')
import { createContainer } from './src/infrastructure/container/ContainerBootstrap.js'
console.log('✅ [1] createContainer imported')

console.log('🔍 [2] CALLING createContainer()...')
const container = await createContainer()
console.log('✅ [2] createContainer() returned!')

console.log('✅ Test complete!')
