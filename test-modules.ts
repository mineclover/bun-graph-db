console.log('🔍 [1] Testing CoreModule import...')
import { registerCoreModule } from './src/infrastructure/container/modules/CoreModule.js'
console.log('✅ [1] CoreModule imported')

console.log('🔍 [2] Testing DatabaseModule import...')
import { registerDatabaseModule } from './src/infrastructure/container/modules/DatabaseModule.js'
console.log('✅ [2] DatabaseModule imported')

console.log('🔍 [3] Testing RepositoryModule import...')
import { registerRepositoryModule } from './src/infrastructure/container/modules/RepositoryModule.js'
console.log('✅ [3] RepositoryModule imported')

console.log('🔍 [4] Testing TablePackageModule import...')
import { registerTablePackageModule } from './src/infrastructure/container/modules/TablePackageModule.js'
console.log('✅ [4] TablePackageModule imported')

console.log('🔍 [5] Testing UseCaseModule import...')
import { registerUseCaseModule } from './src/infrastructure/container/modules/UseCaseModule.js'
console.log('✅ [5] UseCaseModule imported')

console.log('🔍 [6] Testing GraphQLModule import...')
import { registerGraphQLModule } from './src/infrastructure/container/modules/GraphQLModule.js'
console.log('✅ [6] GraphQLModule imported')

console.log('✅ All modules imported successfully!')
