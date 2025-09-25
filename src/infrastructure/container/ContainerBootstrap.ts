import { DIContainer } from './DIContainer.js'
import {
  registerCoreModule,
  registerDatabaseModule,
  registerGraphQLModule,
  registerRepositoryModule,
  registerTablePackageModule,
  registerUseCaseModule,
} from './modules/index.js'

/**
 * Container Bootstrap - Sets up the entire DI container
 */
let containerInstance: DIContainer | undefined

/**
 * Create and configure the main application container
 */
export async function createContainer(): Promise<DIContainer> {
  if (containerInstance) {
    return containerInstance
  }

  const container = new DIContainer()

  // Register modules in dependency order
  registerCoreModule(container)
  registerDatabaseModule(container)
  registerRepositoryModule(container)
  registerTablePackageModule(container)
  registerUseCaseModule(container)
  registerGraphQLModule(container)

  containerInstance = container
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
