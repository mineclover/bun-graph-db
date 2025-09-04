// Simple dependency injection container (no external library needed)

import { SqliteConnection } from '@/infrastructure/database/sqlite/SqliteConnection.js'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { ConsoleLogger } from '@/infrastructure/logging/ConsoleLogger.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { LogLevel } from '@/application/ports/ILogger.js'

import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'

export class DependencyContainer {
  private static instance: DependencyContainer
  private dependencies = new Map<string, any>()

  private constructor() {
    this.registerDependencies()
  }

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer()
    }
    return DependencyContainer.instance
  }

  private registerDependencies(): void {
    // Infrastructure dependencies
    const dbConnection = SqliteConnection.getInstance()
    const database = dbConnection.getDatabase()

    // Repositories
    const tableRepository = new SqliteTableRepository(database)
    this.register<ITableRepository>('tableRepository', tableRepository)

    const attributeTypeRepository = new SqliteAttributeTypeRepository(database)
    this.register<IAttributeTypeRepository>('attributeTypeRepository', attributeTypeRepository)

    const attributeRepository = new SqliteAttributeRepository(database)
    this.register<IAttributeRepository>('attributeRepository', attributeRepository)

    const nodeRepository = new SqliteNodeRepository(database)
    this.register<INodeRepository>('nodeRepository', nodeRepository)

    const nodeAttributeRepository = new SqliteNodeAttributeRepository(database)
    this.register<INodeAttributeRepository>('nodeAttributeRepository', nodeAttributeRepository)

    // Services  
    const logger = new ConsoleLogger(
      process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      true
    )
    this.register<ILogger>('logger', logger)

    // Use cases
    const createTableUseCase = new CreateTableUseCase(tableRepository, logger)
    this.register('createTableUseCase', createTableUseCase)

    const createAttributeTypeUseCase = new CreateAttributeTypeUseCase(attributeTypeRepository, logger)
    this.register('createAttributeTypeUseCase', createAttributeTypeUseCase)

    const createAttributeUseCase = new CreateAttributeUseCase(attributeRepository, attributeTypeRepository, tableRepository, logger)
    this.register('createAttributeUseCase', createAttributeUseCase)

    const createNodeUseCase = new CreateNodeUseCase(nodeRepository, nodeAttributeRepository, tableRepository, attributeRepository, logger)
    this.register('createNodeUseCase', createNodeUseCase)
  }

  register<T>(name: string, instance: T): void {
    this.dependencies.set(name, instance)
  }

  resolve<T>(name: string): T {
    const instance = this.dependencies.get(name)
    if (!instance) {
      throw new Error(`Dependency '${name}' not registered`)
    }
    return instance as T
  }

  // Convenience methods for common dependencies
  getTableRepository(): ITableRepository {
    return this.resolve<ITableRepository>('tableRepository')
  }

  getAttributeTypeRepository(): IAttributeTypeRepository {
    return this.resolve<IAttributeTypeRepository>('attributeTypeRepository')
  }

  getAttributeRepository(): IAttributeRepository {
    return this.resolve<IAttributeRepository>('attributeRepository')
  }

  getNodeRepository(): INodeRepository {
    return this.resolve<INodeRepository>('nodeRepository')
  }

  getNodeAttributeRepository(): INodeAttributeRepository {
    return this.resolve<INodeAttributeRepository>('nodeAttributeRepository')
  }

  getLogger(): ILogger {
    return this.resolve<ILogger>('logger')
  }

  getCreateTableUseCase(): CreateTableUseCase {
    return this.resolve('createTableUseCase')
  }

  getCreateAttributeTypeUseCase(): CreateAttributeTypeUseCase {
    return this.resolve('createAttributeTypeUseCase')
  }

  getCreateAttributeUseCase(): CreateAttributeUseCase {
    return this.resolve('createAttributeUseCase')
  }

  getCreateNodeUseCase(): CreateNodeUseCase {
    return this.resolve('createNodeUseCase')
  }

  // Health check for container
  isHealthy(): boolean {
    try {
      this.getLogger()
      this.getTableRepository()
      return true
    } catch {
      return false
    }
  }
}