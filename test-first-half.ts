console.log('🔍 [1] Testing DIContainer + first 3 modules...')

import { DIContainer } from './src/infrastructure/container/DIContainer.js'
console.log('✅ [1] DIContainer imported')

import { registerCoreModule } from './src/infrastructure/container/modules/CoreModule.js'
console.log('✅ [2] CoreModule imported')

import { registerDatabaseModule } from './src/infrastructure/container/modules/DatabaseModule.js'
console.log('✅ [3] DatabaseModule imported')

import { registerRepositoryModule } from './src/infrastructure/container/modules/RepositoryModule.js'
console.log('✅ [4] RepositoryModule imported')

console.log('✅ Test complete!')
