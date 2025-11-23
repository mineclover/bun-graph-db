console.log('🔍 [1] Testing with TablePackageModule added...')

import { DIContainer } from './src/infrastructure/container/DIContainer.js'
import { registerCoreModule } from './src/infrastructure/container/modules/CoreModule.js'
import { registerDatabaseModule } from './src/infrastructure/container/modules/DatabaseModule.js'
import { registerRepositoryModule } from './src/infrastructure/container/modules/RepositoryModule.js'
console.log('✅ [1] First 3 modules imported')

import { registerTablePackageModule } from './src/infrastructure/container/modules/TablePackageModule.js'
console.log('✅ [2] TablePackageModule imported')

console.log('✅ Test complete!')
