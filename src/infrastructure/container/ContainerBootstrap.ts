import { getDatabasePath } from '@/config/database.js'
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
 *
 * Uses static imports and lazy resolution through DIContainer.
 * Actual instances are only created when resolve() is called.
 */
let containerInstance: DIContainer | undefined
let containerDatabasePath: string | undefined

/**
 * Create and configure the main application container
 */
export async function createContainer(): Promise<DIContainer> {
  const databasePath = getDatabasePath()

  if (containerInstance && containerDatabasePath === databasePath) {
    return containerInstance
  }

  if (containerInstance && containerDatabasePath !== databasePath) {
    containerInstance.clear()
  }

  const container = new DIContainer()

  // Register modules in dependency order
  // These only register factory functions, not create instances
  registerCoreModule(container)
  registerDatabaseModule(container)
  registerRepositoryModule(container)
  registerTablePackageModule(container)
  registerUseCaseModule(container)
  registerGraphQLModule(container)

  containerInstance = container
  containerDatabasePath = databasePath
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
  containerInstance?.clear()
  containerInstance = undefined
  containerDatabasePath = undefined
}

/**
 * Create a test container with mock implementations
 */
export async function createTestContainer(): Promise<DIContainer> {
  const container = new DIContainer()

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
