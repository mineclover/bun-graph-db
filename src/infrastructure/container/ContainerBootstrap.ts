console.log('🟢 [ContainerBootstrap] Module loading started...')

import { DIContainer } from './DIContainer.js'
console.log('🟢 [ContainerBootstrap] DIContainer imported')

import {
  registerCoreModule,
  registerDatabaseModule,
  registerGraphQLModule,
  registerRepositoryModule,
  registerTablePackageModule,
  registerUseCaseModule,
} from './modules/index.js'
console.log('🟢 [ContainerBootstrap] All register functions imported')

/**
 * Container Bootstrap - Sets up the entire DI container
 */
let containerInstance: DIContainer | undefined
console.log('🟢 [ContainerBootstrap] Module fully loaded!')

/**
 * Create and configure the main application container
 */
export async function createContainer(): Promise<DIContainer> {
  console.log('🔍 [createContainer] Starting container creation...')

  if (containerInstance) {
    console.log('✅ [createContainer] Returning cached instance')
    return containerInstance
  }

  console.log('🔍 [createContainer] Creating new DIContainer...')
  const container = new DIContainer()
  console.log('✅ [createContainer] DIContainer created')

  // Register modules in dependency order
  console.log('🔍 [1/6] Registering CoreModule...')
  registerCoreModule(container)
  console.log('✅ [1/6] CoreModule registered')

  console.log('🔍 [2/6] Registering DatabaseModule...')
  registerDatabaseModule(container)
  console.log('✅ [2/6] DatabaseModule registered')

  console.log('🔍 [3/6] Registering RepositoryModule...')
  registerRepositoryModule(container)
  console.log('✅ [3/6] RepositoryModule registered')

  console.log('🔍 [4/6] Registering TablePackageModule...')
  registerTablePackageModule(container)
  console.log('✅ [4/6] TablePackageModule registered')

  console.log('🔍 [5/6] Registering UseCaseModule...')
  registerUseCaseModule(container)
  console.log('✅ [5/6] UseCaseModule registered')

  console.log('🔍 [6/6] Registering GraphQLModule...')
  registerGraphQLModule(container)
  console.log('✅ [6/6] GraphQLModule registered')

  containerInstance = container
  console.log('✅ [createContainer] Container creation complete!')
  return container
}

/**
 * Get the singleton container instance
 */
export function getContainer(): DIContainer {
  if (!containerInstance) {
    throw new Error('Container not initialized. Call createContainer() first.')
  }
  return containerInstance
}

/**
 * Reset the container (for testing)
 */
export function resetContainer(): void {
  containerInstance = undefined
}

/**
 * Create a test container with mock implementations
 */
export async function createTestContainer(): Promise<DIContainer> {
  const container = new DIContainer()

  // Register core module with test configuration
  registerCoreModule(container)

  // Override database provider to use mock
  process.env.DB_PROVIDER = 'mock'

  registerDatabaseModule(container)
  registerRepositoryModule(container)
  registerTablePackageModule(container)
  registerUseCaseModule(container)
  registerGraphQLModule(container)

  return container
}
