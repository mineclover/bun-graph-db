// Simple dependency injection container (no external library needed)

import { SqliteConnection } from '@/infrastructure/database/sqlite/SqliteConnection.js'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { SqliteNodeSearchRepository } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteRelationTypeRepository } from '@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js'
import { SQLiteQueryTemplateRepository } from '@/infrastructure/database/repositories/SQLiteQueryTemplateRepository.js'
import { ConsoleLogger } from '@/infrastructure/logging/ConsoleLogger.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import { NodeAnalyticsUseCase } from '@/application/use-cases/analytics/NodeAnalyticsUseCase.js'
import { AdvancedSearchUseCase } from '@/application/use-cases/search/AdvancedSearchUseCase.js'
import { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import { LogLevel } from '@/application/ports/ILogger.js'

import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
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

    const nodeRelationRepository = new SqliteNodeRelationRepository(database)
    this.register<INodeRelationRepository>('nodeRelationRepository', nodeRelationRepository)

    const nodeSearchRepository = new SqliteNodeSearchRepository(database)
    this.register('nodeSearchRepository', nodeSearchRepository)

    const relationTypeRepository = new SqliteRelationTypeRepository(database)
    this.register<IRelationTypeRepository>('relationTypeRepository', relationTypeRepository)

    const graphRepository = new SqliteGraphRepository(database)
    this.register('graphRepository', graphRepository)

    // Services  
    const logger = new ConsoleLogger(
      process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      true
    )
    this.register<ILogger>('logger', logger)

    const queryTemplateRepository = new SQLiteQueryTemplateRepository(database, logger)
    this.register<IQueryTemplateRepository>('queryTemplateRepository', queryTemplateRepository)

    // Use cases
    const createTableUseCase = new CreateTableUseCase(tableRepository, logger)
    this.register('createTableUseCase', createTableUseCase)

    const createAttributeTypeUseCase = new CreateAttributeTypeUseCase(attributeTypeRepository, logger)
    this.register('createAttributeTypeUseCase', createAttributeTypeUseCase)

    const createAttributeUseCase = new CreateAttributeUseCase(attributeRepository, attributeTypeRepository, tableRepository, logger)
    this.register('createAttributeUseCase', createAttributeUseCase)

    const createNodeUseCase = new CreateNodeUseCase(nodeRepository, nodeAttributeRepository, tableRepository, attributeRepository, logger)
    this.register('createNodeUseCase', createNodeUseCase)

    const searchNodesUseCase = new SearchNodesUseCase(nodeRepository, nodeSearchRepository, attributeRepository, tableRepository, logger)
    this.register('searchNodesUseCase', searchNodesUseCase)

    const createRelationUseCase = new CreateRelationUseCase(nodeRelationRepository, relationTypeRepository, nodeRepository, tableRepository, logger)
    this.register('createRelationUseCase', createRelationUseCase)

    const createRelationTypeUseCase = new CreateRelationTypeUseCase(relationTypeRepository, logger)
    this.register('createRelationTypeUseCase', createRelationTypeUseCase)

    const searchRelatedNodesUseCase = new SearchRelatedNodesUseCase(nodeRepository, nodeRelationRepository, graphRepository, tableRepository, logger)
    this.register('searchRelatedNodesUseCase', searchRelatedNodesUseCase)

    const nodeAnalyticsUseCase = new NodeAnalyticsUseCase(nodeRepository, nodeRelationRepository, tableRepository, logger)
    this.register('nodeAnalyticsUseCase', nodeAnalyticsUseCase)

    const advancedSearchUseCase = new AdvancedSearchUseCase(nodeRepository, nodeRelationRepository, tableRepository, logger)
    this.register('advancedSearchUseCase', advancedSearchUseCase)

    const schemaExportUseCase = new SchemaExportUseCase(tableRepository, attributeTypeRepository, attributeRepository, nodeRepository, nodeRelationRepository, relationTypeRepository, logger)
    this.register('schemaExportUseCase', schemaExportUseCase)

    const schemaImportUseCase = new SchemaImportUseCase(tableRepository, attributeTypeRepository, attributeRepository, nodeRepository, nodeRelationRepository, relationTypeRepository, logger)
    this.register('schemaImportUseCase', schemaImportUseCase)
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

  getSearchNodesUseCase(): SearchNodesUseCase {
    return this.resolve('searchNodesUseCase')
  }

  getNodeRelationRepository(): INodeRelationRepository {
    return this.resolve<INodeRelationRepository>('nodeRelationRepository')
  }

  getRelationTypeRepository(): IRelationTypeRepository {
    return this.resolve<IRelationTypeRepository>('relationTypeRepository')
  }

  getQueryTemplateRepository(): IQueryTemplateRepository {
    return this.resolve<IQueryTemplateRepository>('queryTemplateRepository')
  }

  getCreateRelationUseCase(): CreateRelationUseCase {
    return this.resolve('createRelationUseCase')
  }

  getCreateRelationTypeUseCase(): CreateRelationTypeUseCase {
    return this.resolve('createRelationTypeUseCase')
  }

  getSearchRelatedNodesUseCase(): SearchRelatedNodesUseCase {
    return this.resolve('searchRelatedNodesUseCase')
  }

  getNodeAnalyticsUseCase(): NodeAnalyticsUseCase {
    return this.resolve('nodeAnalyticsUseCase')
  }

  getAdvancedSearchUseCase(): AdvancedSearchUseCase {
    return this.resolve('advancedSearchUseCase')
  }

  getSchemaExportUseCase(): SchemaExportUseCase {
    return this.resolve('schemaExportUseCase')
  }

  getSchemaImportUseCase(): SchemaImportUseCase {
    return this.resolve('schemaImportUseCase')
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