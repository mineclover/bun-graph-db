console.log('🔍 [1] Testing modules/index.js import...')

import {
  registerCoreModule,
  registerDatabaseModule,
  registerGraphQLModule,
  registerRepositoryModule,
  registerTablePackageModule,
  registerUseCaseModule,
} from './src/infrastructure/container/modules/index.js'

console.log('✅ [1] modules/index.js imported successfully!')
console.log('✅ Test complete!')
