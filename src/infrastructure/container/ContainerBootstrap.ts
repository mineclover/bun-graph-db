import { DIContainer } from './DIContainer.js'

/**
 * Container Bootstrap - Sets up the entire DI container with lazy loading
 *
 * IMPORTANT: Uses individual module imports to avoid circular dependencies
 */
let containerInstance: DIContainer | undefined

/**
 * Create and configure the main application container
 */
export async function createContainer(): Promise<DIContainer> {
  // Return cached instance if already created
  if (containerInstance) {
    return containerInstance
  }

  console.log('🔍 [createContainer] Starting...')
  const container = new DIContainer()
  console.log('✅ [createContainer] DIContainer created')

  // Import modules individually to identify which one hangs
  console.log('🔍 [1/6] Importing CoreModule...')
  const { registerCoreModule } = await import('./modules/CoreModule.js')
  console.log('✅ [1/6] CoreModule imported')
  registerCoreModule(container)
  console.log('✅ [1/6] CoreModule registered')

  console.log('🔍 [2/6] Importing DatabaseModule...')
  const { registerDatabaseModule } = await import('./modules/DatabaseModule.js')
  console.log('✅ [2/6] DatabaseModule imported')
  registerDatabaseModule(container)
  console.log('✅ [2/6] DatabaseModule registered')

  console.log('🔍 [3/6] Importing RepositoryModule...')
  const { registerRepositoryModule } = await import('./modules/RepositoryModule.js')
  console.log('✅ [3/6] RepositoryModule imported')
  registerRepositoryModule(container)
  console.log('✅ [3/6] RepositoryModule registered')

  console.log('🔍 [4/6] Importing TablePackageModule...')
  const { registerTablePackageModule } = await import('./modules/TablePackageModule.js')
  console.log('✅ [4/6] TablePackageModule imported')
  registerTablePackageModule(container)
  console.log('✅ [4/6] TablePackageModule registered')

  console.log('🔍 [5/6] Importing UseCaseModule...')
  const { registerUseCaseModule } = await import('./modules/UseCaseModule.js')
  console.log('✅ [5/6] UseCaseModule imported')
  registerUseCaseModule(container)
  console.log('✅ [5/6] UseCaseModule registered')

  console.log('🔍 [6/6] Importing GraphQLModule...')
  const { registerGraphQLModule } = await import('./modules/GraphQLModule.js')
  console.log('✅ [6/6] GraphQLModule imported')
  registerGraphQLModule(container)
  console.log('✅ [6/6] GraphQLModule registered')

  // Cache the container instance
  containerInstance = container
  console.log('✅ [createContainer] Complete!')
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

  // Import modules individually
  const { registerCoreModule } = await import('./modules/CoreModule.js')
  const { registerDatabaseModule } = await import('./modules/DatabaseModule.js')
  const { registerRepositoryModule } = await import('./modules/RepositoryModule.js')
  const { registerTablePackageModule } = await import('./modules/TablePackageModule.js')
  const { registerUseCaseModule } = await import('./modules/UseCaseModule.js')
  const { registerGraphQLModule } = await import('./modules/GraphQLModule.js')

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
