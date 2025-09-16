import { DIContainer } from './DIContainer.js'
import {
  registerCoreModule,
  registerDatabaseModule,
  registerGraphQLModule,
  registerRepositoryModule,
  registerUseCaseModule,
  registerTablePackageModule,
} from './modules/index.js'

/**
 * Container Bootstrap - Sets up the entire DI container
 */
export class ContainerBootstrap {
  private static instance?: DIContainer

  /**
   * Create and configure the main application container
   */
  static async createContainer(): Promise<DIContainer> {
    if (ContainerBootstrap.instance) {
      return ContainerBootstrap.instance
    }

    const container = new DIContainer()

    // Register modules in dependency order
    registerCoreModule(container)
    registerDatabaseModule(container)
    registerRepositoryModule(container)
    registerTablePackageModule(container)
    registerUseCaseModule(container)
    registerGraphQLModule(container)

    ContainerBootstrap.instance = container
    return container
  }

  /**
   * Get the singleton container instance
   */
  static getContainer(): DIContainer {
    if (!ContainerBootstrap.instance) {
      throw new Error('Container not initialized. Call createContainer() first.')
    }
    return ContainerBootstrap.instance
  }

  /**
   * Reset the container (for testing)
   */
  static reset(): void {
    ContainerBootstrap.instance = undefined
  }

  /**
   * Create a test container with mock implementations
   */
  static async createTestContainer(): Promise<DIContainer> {
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
}
