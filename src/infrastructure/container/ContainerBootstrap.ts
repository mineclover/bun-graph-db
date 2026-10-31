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
import { DatabaseTokens } from './tokens/index.js'

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
    await disposeContainer()
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
export async function disposeContainer(): Promise<void> {
  const container = containerInstance
  containerInstance = undefined
  containerDatabasePath = undefined
  await container?.dispose()
}

/**
 * @deprecated Use disposeContainer() and await it so database connections and
 * other infrastructure resources are released deterministically.
 */
export async function resetContainer(): Promise<void> {
  await disposeContainer()
}

/**
 * Create an isolated test container backed by an in-memory SQLite database.
 */
export async function createTestContainer(): Promise<DIContainer> {
  const container = new DIContainer()

  registerCoreModule(container)
  registerDatabaseModule(container)
  container.registerSingleton(DatabaseTokens.DATABASE_CONFIG, async () => ({
    url: ':memory:',
    type: 'sqlite' as const,
  }))
  registerRepositoryModule(container)
  registerTablePackageModule(container)
  registerUseCaseModule(container)
  registerGraphQLModule(container)

  return container
}
