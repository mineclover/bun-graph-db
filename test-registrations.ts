console.log('🔍 [0] Starting registration test...')

import { DIContainer } from './src/infrastructure/container/DIContainer.js'
console.log('✅ [0] DIContainer imported')

import { registerCoreModule } from './src/infrastructure/container/modules/CoreModule.js'
import { registerDatabaseModule } from './src/infrastructure/container/modules/DatabaseModule.js'
import { registerRepositoryModule } from './src/infrastructure/container/modules/RepositoryModule.js'
import { registerTablePackageModule } from './src/infrastructure/container/modules/TablePackageModule.js'
import { registerUseCaseModule } from './src/infrastructure/container/modules/UseCaseModule.js'
import { registerGraphQLModule } from './src/infrastructure/container/modules/GraphQLModule.js'
console.log('✅ [1] All modules imported')

const container = new DIContainer()
console.log('✅ [2] DIContainer created')

console.log('🔍 [3] Calling registerCoreModule...')
registerCoreModule(container)
console.log('✅ [3] CoreModule registered')

console.log('🔍 [4] Calling registerDatabaseModule...')
registerDatabaseModule(container)
console.log('✅ [4] DatabaseModule registered')

console.log('🔍 [5] Calling registerRepositoryModule...')
registerRepositoryModule(container)
console.log('✅ [5] RepositoryModule registered')

console.log('🔍 [6] Calling registerTablePackageModule...')
registerTablePackageModule(container)
console.log('✅ [6] TablePackageModule registered')

console.log('🔍 [7] Calling registerUseCaseModule...')
registerUseCaseModule(container)
console.log('✅ [7] UseCaseModule registered')

console.log('🔍 [8] Calling registerGraphQLModule...')
registerGraphQLModule(container)
console.log('✅ [8] GraphQLModule registered')

console.log('✅ All registrations complete!')
