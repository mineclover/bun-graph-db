console.log('🔍 [1] Testing with GraphQLModule added...')

import { DIContainer } from './src/infrastructure/container/DIContainer.js'
import { registerCoreModule } from './src/infrastructure/container/modules/CoreModule.js'
import { registerDatabaseModule } from './src/infrastructure/container/modules/DatabaseModule.js'
import { registerRepositoryModule } from './src/infrastructure/container/modules/RepositoryModule.js'
import { registerTablePackageModule } from './src/infrastructure/container/modules/TablePackageModule.js'
import { registerUseCaseModule } from './src/infrastructure/container/modules/UseCaseModule.js'
console.log('✅ [1] First 5 modules imported')

import { registerGraphQLModule } from './src/infrastructure/container/modules/GraphQLModule.js'
console.log('✅ [2] GraphQLModule imported')

console.log('✅ Test complete!')
