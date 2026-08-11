import type { GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { TableNodesExportUseCase } from '@/application/use-cases/export/TableNodesExportUseCase.js'
import type { SystemMonitoringUseCase } from '@/application/use-cases/monitoring/SystemMonitoringUseCase.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { IDatabaseConnection } from '@/core/database/interfaces/IDatabaseConnection.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { JsonExportService } from '@/domain/services/JsonExportService.js'
import type { JsonlBackupService } from '@/domain/services/JsonlBackupService.js'
import type { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import type { TabularSyncConfigActivationService } from '@/application/services/TabularSyncConfigActivationService.js'
import type { Database } from 'bun:sqlite'
import type { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'
import type { TabularSyncEventStore } from '@/infrastructure/excel/TabularSyncEventStore.js'
import { debugApplication } from '@/shared/utils/debugLog.js'
import {
  AttributeFieldResolvers,
  DocFieldResolvers,
  NodeFieldResolvers,
  QueryTemplateFieldResolvers,
  RelationFieldResolvers,
  RelationTypeFieldResolvers,
  TableFieldResolvers,
} from '@/presentation/graphql/field-resolvers/index.js'
// NOTE: buildGraphQLSchema is imported dynamically in the GRAPHQL_SCHEMA factory
// to avoid module loading hang with circular dependencies
import {
  AttributeMutations,
  DocMutations,
  NodeMutations,
  RelationMutations,
  TableMutations,
  TemplateMutations,
} from '@/presentation/graphql/mutations/index.js'
import {
  AttributeQueries,
  DocQueries,
  EnhancedAttributeQueries,
  JsonExportQueries,
  NodeQueries,
  RelationQueries,
  SystemQueries,
  TableQueries,
  TemplateQueries,
} from '@/presentation/graphql/queries/index.js'
import type { DIContainer, ServiceToken } from '../DIContainer.js'
import { CommonTokens, DatabaseTokens, GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../tokens/index.js'

function createConsoleLogger(prefix: string = 'INFO'): ILogger {
  return {
    info: (message, meta) => console.log(`[${prefix}] ${message}`, meta || ''),
    warn: (message, meta) => console.warn(`[${prefix}] ${message}`, meta || ''),
    error: (message, meta) => console.error(`[${prefix}] ${message}`, meta || ''),
    debug: (message, meta) => debugApplication(`[${prefix}] ${message}`, meta ? () => meta : undefined),
  }
}

async function resolveAs<T>(container: DIContainer, token: ServiceToken): Promise<T> {
  return container.resolve(token as ServiceToken<T>)
}

/**
 * GraphQL module - registers GraphQL resolvers and schema
 */
export function registerGraphQLModule(container: DIContainer): void {
  container.registerSingleton(
    CommonTokens.TABLE_SCHEMA_PROJECTION_SERVICE,
    async (c) => {
      const tableRepository = await resolveAs<ITableRepository>(c, RepositoryTokens.TABLE_REPOSITORY)
      const attributeRepository = await resolveAs<IAttributeRepository>(c, RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const attributeTypeRepository = await resolveAs<IAttributeTypeRepository>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      return new TableSchemaProjectionService(
        tableRepository,
        attributeRepository,
        attributeTypeRepository,
        createConsoleLogger('TableSchemaProjection'),
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    ],
  )

  // Query resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_QUERIES,
    async (c) => {
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const simpleLogger = createConsoleLogger()
      return new TableQueries(tableRepository, c, simpleLogger)
    },
    [RepositoryTokens.TABLE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.NODE_QUERIES,
    async (c) => {
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      // Use lazy loading to resolve SearchNodesUseCase and break circular dependency
      const searchNodesUseCaseResolver = async (): Promise<SearchNodesUseCase | null> => {
        try {
          return (await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE)) as SearchNodesUseCase
        } catch (error) {
          console.warn('[GraphQLModule] SearchNodesUseCase not available:', error)
          return null
        }
      }
      const simpleLogger = createConsoleLogger()
      // Resolve attributeRepository for identifier-based filtering
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      return new NodeQueries(nodeRepository, searchNodesUseCaseResolver, simpleLogger, attributeRepository)
    },
    [RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const simpleLogger = createConsoleLogger()
      return new AttributeQueries(attributeRepository, attributeTypeRepository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_QUERIES,
    async (c) => {
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository
      // Remove SearchRelatedNodesUseCase dependency to break circular reference
      const simpleLogger = createConsoleLogger()
      return new RelationQueries(nodeRelationRepository, relationTypeRepository, nodeRepository, null, simpleLogger)
    },
    [RepositoryTokens.NODE_RELATION_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_QUERIES,
    async (c) => {
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )) as IQueryTemplateRepository
      const simpleLogger = createConsoleLogger()
      return new TemplateQueries(queryTemplateRepository, simpleLogger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.DOC_QUERIES,
    async (c) => {
      const docRepository = (await c.resolve(RepositoryTokens.DOC_REPOSITORY)) as IDocRepository
      const simpleLogger = createConsoleLogger()
      return new DocQueries(docRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.SYSTEM_QUERIES,
    async (c) => {
      const systemMonitoringUseCase = await resolveAs<SystemMonitoringUseCase>(
        c,
        UseCaseTokens.SYSTEM_MONITORING_USE_CASE,
      )
      const tabularSyncConfigStore = await resolveAs<TabularSyncConfigStore>(c, CommonTokens.TABULAR_SYNC_CONFIG_STORE)
      const tabularSyncHook = await resolveAs<BestEffortTabularSyncHook>(c, CommonTokens.TABULAR_SYNC_HOOK)
      const simpleLogger = createConsoleLogger()
      return new SystemQueries(systemMonitoringUseCase, simpleLogger, tabularSyncConfigStore, tabularSyncHook)
    },
    [UseCaseTokens.SYSTEM_MONITORING_USE_CASE, CommonTokens.TABULAR_SYNC_CONFIG_STORE, CommonTokens.TABULAR_SYNC_HOOK],
  )

  container.registerSingleton(
    GraphQLTokens.ENHANCED_ATTRIBUTE_QUERIES,
    async (c) => {
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const simpleLogger = createConsoleLogger()
      return new EnhancedAttributeQueries(attributeTypeRepository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY],
  )

  // JsonExportService registration
  container.registerSingleton(
    CommonTokens.JSON_EXPORT_SERVICE,
    async (c) => {
      const { JsonExportService } = await import('@/domain/services/JsonExportService.js')
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository

      return new JsonExportService(
        tableRepository,
        nodeRepository,
        attributeRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        relationTypeRepository,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  // JsonExportQueries registration
  container.registerSingleton(
    GraphQLTokens.JSON_EXPORT_QUERIES,
    async (c) => {
      const jsonExportService = await resolveAs<JsonExportService>(c, CommonTokens.JSON_EXPORT_SERVICE)
      const simpleLogger = createConsoleLogger()
      return { JsonExportQueries, jsonExportService, logger: simpleLogger }
    },
    [CommonTokens.JSON_EXPORT_SERVICE],
  )

  // JsonlBackupService registration
  container.registerSingleton(
    CommonTokens.JSONL_BACKUP_SERVICE,
    async (c) => {
      const { JsonlBackupService } = await import('@/domain/services/JsonlBackupService.js')
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository

      const simpleLogger = createConsoleLogger('JsonlBackup')

      return new JsonlBackupService(
        tableRepository,
        attributeRepository,
        attributeTypeRepository,
        nodeRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        relationTypeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  // SQLiteBackupService registration
  container.registerSingleton(
    CommonTokens.SQLITE_BACKUP_SERVICE,
    async (c) => {
      const { SQLiteBackupService } = await import('@/domain/services/SQLiteBackupService.js')
      const { DatabaseTokens } = await import('../tokens/DatabaseTokens.js')
      const db = await resolveAs<IDatabaseConnection>(c, DatabaseTokens.DATABASE_CONNECTION)
      const simpleLogger = createConsoleLogger('SQLiteBackup')

      return new SQLiteBackupService(db, simpleLogger)
    },
    [],
  )

  // BackupQueries registration
  container.registerSingleton(
    GraphQLTokens.BACKUP_QUERIES,
    async (c) => {
      const { BackupQueries } = await import('@/presentation/graphql/queries/BackupQueries.js')
      const backupService = await resolveAs<SQLiteBackupService>(c, CommonTokens.SQLITE_BACKUP_SERVICE)
      const simpleLogger = createConsoleLogger('BackupQueries')
      return { BackupQueries, backupService, logger: simpleLogger }
    },
    [CommonTokens.SQLITE_BACKUP_SERVICE],
  )

  // BackupMutations registration
  container.registerSingleton(
    GraphQLTokens.BACKUP_MUTATIONS,
    async (c) => {
      const { BackupMutations } = await import('@/presentation/graphql/mutations/BackupMutations.js')
      const backupService = await resolveAs<SQLiteBackupService>(c, CommonTokens.SQLITE_BACKUP_SERVICE)
      const simpleLogger = createConsoleLogger('BackupMutations')
      return { BackupMutations, backupService, logger: simpleLogger }
    },
    [CommonTokens.SQLITE_BACKUP_SERVICE],
  )

  // JsonlBackupQueries registration
  container.registerSingleton(
    GraphQLTokens.JSONL_BACKUP_QUERIES,
    async (c) => {
      const { JsonlBackupQueries } = await import('@/presentation/graphql/queries/JsonlBackupQueries.js')
      const jsonlBackupService = await resolveAs<JsonlBackupService>(c, CommonTokens.JSONL_BACKUP_SERVICE)
      const simpleLogger = createConsoleLogger('JsonlBackupQueries')
      return new JsonlBackupQueries(jsonlBackupService, simpleLogger)
    },
    [CommonTokens.JSONL_BACKUP_SERVICE],
  )

  // AutoPersistenceService registration
  container.registerSingleton(
    CommonTokens.AUTO_PERSISTENCE_SERVICE,
    async (c) => {
      const { AutoPersistenceService } = await import('@/domain/services/AutoPersistenceService.js')
      const jsonlBackupService = await resolveAs<JsonlBackupService>(c, CommonTokens.JSONL_BACKUP_SERVICE)
      const simpleLogger = createConsoleLogger('AutoPersistence')
      const debounceMs = Number.parseInt(process.env.JSONL_AUTO_SAVE_DEBOUNCE_MS ?? '', 10)
      return new AutoPersistenceService(jsonlBackupService, simpleLogger, {
        autoRestoreOnStartup: process.env.JSONL_AUTO_RESTORE !== 'false',
        autoBackupOnShutdown: process.env.JSONL_AUTO_BACKUP_ON_SHUTDOWN !== 'false',
        autoSaveOnWrite: process.env.JSONL_AUTO_SAVE_ON_WRITE === 'true',
        autoSaveDebounceMs: Number.isSafeInteger(debounceMs) && debounceMs > 0 ? debounceMs : 30_000,
        backupDir: process.env.JSONL_BACKUP_DIR || './backups/jsonl',
      })
    },
    [CommonTokens.JSONL_BACKUP_SERVICE],
  )

  // Mutation resolvers
  container.registerSingleton(
    CommonTokens.TABULAR_SYNC_CONFIG_STORE,
    async (c) => {
      const { TabularSyncConfigStore } = await import('@/infrastructure/excel/TabularSyncConfigStore.js')
      const db = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
      return new TabularSyncConfigStore(db)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  container.registerSingleton(
    CommonTokens.TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE,
    async (c) => {
      const { TabularSyncConfigActivationService } = await import(
        '@/application/services/TabularSyncConfigActivationService.js'
      )
      const store = await resolveAs<TabularSyncConfigStore>(c, CommonTokens.TABULAR_SYNC_CONFIG_STORE)
      return new TabularSyncConfigActivationService(store)
    },
    [CommonTokens.TABULAR_SYNC_CONFIG_STORE],
  )

  container.registerSingleton(
    CommonTokens.TABULAR_SYNC_HOOK,
    async (c) => {
      const { BestEffortTabularSyncHook } = await import('@/application/services/BestEffortTabularSyncHook.js')
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = await resolveAs<IAttributeTypeRepository>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const tabularSyncConfigStore = await resolveAs<TabularSyncConfigStore>(c, CommonTokens.TABULAR_SYNC_CONFIG_STORE)
      const tabularSyncEventStore = await resolveAs<TabularSyncEventStore>(c, CommonTokens.TABULAR_SYNC_EVENT_STORE)
      const simpleLogger = createConsoleLogger('TabularSync')
      return new BestEffortTabularSyncHook(
        tableRepository,
        attributeRepository,
        attributeTypeRepository,
        nodeRepository,
        nodeAttributeRepository,
        simpleLogger,
        process.env.TABULAR_SYNC_CONFIG_FILE,
        tabularSyncConfigStore,
        tabularSyncEventStore,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      CommonTokens.TABULAR_SYNC_CONFIG_STORE,
      CommonTokens.TABULAR_SYNC_EVENT_STORE,
    ],
  )

  container.registerSingleton(
    CommonTokens.TABULAR_SYNC_EVENT_STORE,
    async (c) => {
      const { TabularSyncEventStore } = await import('@/infrastructure/excel/TabularSyncEventStore.js')
      const db = (await c.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
      return new TabularSyncEventStore(db)
    },
    [DatabaseTokens.DATABASE_CONNECTION],
  )

  container.registerSingleton(
    GraphQLTokens.TABLE_MUTATIONS,
    async (c) => {
      const createTableUseCase = await resolveAs<ConstructorParameters<typeof TableMutations>[0]>(
        c,
        UseCaseTokens.CREATE_TABLE_USE_CASE,
      )
      const deleteTableUseCase = await resolveAs<ConstructorParameters<typeof TableMutations>[1]>(
        c,
        UseCaseTokens.DELETE_TABLE_USE_CASE,
      )
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const tabularSyncHook = await resolveAs<BestEffortTabularSyncHook>(c, CommonTokens.TABULAR_SYNC_HOOK)
      const simpleLogger = createConsoleLogger()
      return new TableMutations(createTableUseCase, deleteTableUseCase, tableRepository, simpleLogger, tabularSyncHook)
    },
    [
      UseCaseTokens.CREATE_TABLE_USE_CASE,
      UseCaseTokens.DELETE_TABLE_USE_CASE,
      RepositoryTokens.TABLE_REPOSITORY,
      CommonTokens.TABULAR_SYNC_HOOK,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.NODE_MUTATIONS,
    async (c) => {
      const createNodeUseCase = await resolveAs<ConstructorParameters<typeof NodeMutations>[0]>(
        c,
        UseCaseTokens.CREATE_NODE_USE_CASE,
      )
      const updateNodeUseCase = await resolveAs<ConstructorParameters<typeof NodeMutations>[1]>(
        c,
        UseCaseTokens.UPDATE_NODE_USE_CASE,
      )
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)) as IAttributeTypeRepository
      const tabularSyncHook = await resolveAs<BestEffortTabularSyncHook>(c, CommonTokens.TABULAR_SYNC_HOOK)
      const simpleLogger = createConsoleLogger()
      return new NodeMutations(
        createNodeUseCase,
        updateNodeUseCase,
        nodeRepository,
        nodeAttributeRepository,
        tableRepository,
        attributeRepository,
        attributeTypeRepository,
        simpleLogger,
        tabularSyncHook,
      )
    },
    [
      UseCaseTokens.CREATE_NODE_USE_CASE,
      UseCaseTokens.UPDATE_NODE_USE_CASE,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      CommonTokens.TABULAR_SYNC_HOOK,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_MUTATIONS,
    async (c) => {
      const createAttributeTypeUseCase = await resolveAs<ConstructorParameters<typeof AttributeMutations>[0]>(
        c,
        UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
      )
      const createAttributeUseCase = await resolveAs<ConstructorParameters<typeof AttributeMutations>[1]>(
        c,
        UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
      )
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )) as IQueryTemplateRepository
      const tabularSyncHook = await resolveAs<BestEffortTabularSyncHook>(c, CommonTokens.TABULAR_SYNC_HOOK)
      const simpleLogger = createConsoleLogger()
      return new AttributeMutations(
        createAttributeTypeUseCase,
        createAttributeUseCase,
        attributeTypeRepository,
        attributeRepository,
        simpleLogger,
        tabularSyncHook,
        queryTemplateRepository,
      )
    },
    [
      UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      CommonTokens.TABULAR_SYNC_HOOK,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_MUTATIONS,
    async (c) => {
      const createRelationUseCase = await resolveAs<ConstructorParameters<typeof RelationMutations>[0]>(
        c,
        UseCaseTokens.CREATE_RELATION_USE_CASE,
      )
      const createRelationTypeUseCase = await resolveAs<ConstructorParameters<typeof RelationMutations>[1]>(
        c,
        UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
      )
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository
      const simpleLogger = createConsoleLogger()
      return new RelationMutations(
        createRelationUseCase,
        createRelationTypeUseCase,
        nodeRelationRepository,
        nodeRepository,
        relationTypeRepository,
        simpleLogger,
      )
    },
    [
      UseCaseTokens.CREATE_RELATION_USE_CASE,
      UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.TEMPLATE_MUTATIONS,
    async (c) => {
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )) as IQueryTemplateRepository
      const executeQueryTemplateUseCase = await resolveAs<ConstructorParameters<typeof TemplateMutations>[1]>(
        c,
        UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE,
      )
      const simpleLogger = createConsoleLogger()
      return new TemplateMutations(queryTemplateRepository, executeQueryTemplateUseCase, simpleLogger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY, UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE],
  )

  container.registerSingleton(
    GraphQLTokens.DOC_MUTATIONS,
    async (c) => {
      const createDocUseCase = await resolveAs<ConstructorParameters<typeof DocMutations>[0]>(
        c,
        UseCaseTokens.CREATE_DOC_USE_CASE,
      )
      const updateDocUseCase = await resolveAs<ConstructorParameters<typeof DocMutations>[1]>(
        c,
        UseCaseTokens.UPDATE_DOC_USE_CASE,
      )
      const deleteDocUseCase = await resolveAs<ConstructorParameters<typeof DocMutations>[2]>(
        c,
        UseCaseTokens.DELETE_DOC_USE_CASE,
      )
      const activateDocUseCase = await resolveAs<ConstructorParameters<typeof DocMutations>[3]>(
        c,
        UseCaseTokens.ACTIVATE_DOC_USE_CASE,
      )
      const simpleLogger = createConsoleLogger()
      return new DocMutations(createDocUseCase, updateDocUseCase, deleteDocUseCase, activateDocUseCase, simpleLogger)
    },
    [
      UseCaseTokens.CREATE_DOC_USE_CASE,
      UseCaseTokens.UPDATE_DOC_USE_CASE,
      UseCaseTokens.DELETE_DOC_USE_CASE,
      UseCaseTokens.ACTIVATE_DOC_USE_CASE,
    ],
  )

  // System Resolver - Add SystemResolver for initialization mutations
  container.registerSingleton(
    GraphQLTokens.SYSTEM_RESOLVER,
    async (c) => {
      const { SystemResolver } = await import('@/presentation/graphql/resolvers/SystemResolver.js')
      const tabularSyncConfigStore = await resolveAs<TabularSyncConfigStore>(c, CommonTokens.TABULAR_SYNC_CONFIG_STORE)
      const tabularSyncConfigActivationService = await resolveAs<TabularSyncConfigActivationService>(
        c,
        CommonTokens.TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE,
      )
      const tabularSyncHook = await resolveAs<BestEffortTabularSyncHook>(c, CommonTokens.TABULAR_SYNC_HOOK)
      return new SystemResolver(c, tabularSyncConfigStore, tabularSyncHook, tabularSyncConfigActivationService)
    },
    [
      CommonTokens.TABULAR_SYNC_CONFIG_STORE,
      CommonTokens.TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE,
      CommonTokens.TABULAR_SYNC_HOOK,
    ],
  )

  // Node Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.NODE_RESOLVER,
    async (c) => {
      const { NodeResolver } = await import('@/presentation/graphql/resolvers/NodeResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createNodeUseCase = (await c.resolve(UseCaseTokens.CREATE_NODE_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof NodeResolver>[0]
      const searchNodesUseCase = (await c.resolve(UseCaseTokens.SEARCH_NODES_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof NodeResolver>[1]

      // Resolve repositories
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(c, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository

      const simpleLogger = createConsoleLogger('NodeResolver')

      return new NodeResolver(
        createNodeUseCase,
        searchNodesUseCase,
        nodeRepository,
        tableRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        attributeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ],
  )

  // Table Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_RESOLVER,
    async (c) => {
      const { TableResolver } = await import('@/presentation/graphql/resolvers/TableResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createTableUseCase = (await c.resolve(UseCaseTokens.CREATE_TABLE_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof TableResolver>[0]

      // Resolve repositories
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository

      const simpleLogger = createConsoleLogger('TableResolver')

      return new TableResolver(
        createTableUseCase,
        tableRepository,
        nodeRepository,
        attributeRepository,
        attributeTypeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    ],
  )

  // Doc Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.DOC_RESOLVER,
    async (c) => {
      const { DocResolver } = await import('@/presentation/graphql/resolvers/DocResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createDocUseCase = (await c.resolve(UseCaseTokens.CREATE_DOC_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof DocResolver>[0]
      const updateDocUseCase = (await c.resolve(UseCaseTokens.UPDATE_DOC_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof DocResolver>[1]
      const deleteDocUseCase = (await c.resolve(UseCaseTokens.DELETE_DOC_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof DocResolver>[2]
      const activateDocUseCase = (await c.resolve(UseCaseTokens.ACTIVATE_DOC_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof DocResolver>[3]

      // Resolve repositories
      const docRepository = (await c.resolve(RepositoryTokens.DOC_REPOSITORY)) as IDocRepository

      const simpleLogger = createConsoleLogger('DocResolver')

      return new DocResolver(
        createDocUseCase,
        updateDocUseCase,
        deleteDocUseCase,
        activateDocUseCase,
        docRepository,
        simpleLogger,
      )
    },
    [RepositoryTokens.DOC_REPOSITORY],
  )

  // Attribute Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_RESOLVER,
    async (c) => {
      const { AttributeResolver } = await import('@/presentation/graphql/resolvers/AttributeResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createAttributeTypeUseCase = (await c
        .resolve(UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE)
        .catch(() => null)) as ConstructorParameters<typeof AttributeResolver>[0]
      const createAttributeUseCase = (await c.resolve(UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof AttributeResolver>[1]

      // Resolve repositories
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository

      const simpleLogger = createConsoleLogger('AttributeResolver')

      return new AttributeResolver(
        createAttributeTypeUseCase,
        createAttributeUseCase,
        attributeTypeRepository,
        attributeRepository,
        tableRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  // Relation Resolver - Unified resolver with queries, mutations, and field resolvers
  container.registerSingleton(
    GraphQLTokens.RELATION_RESOLVER,
    async (c) => {
      const { RelationResolver } = await import('@/presentation/graphql/resolvers/RelationResolver.js')

      // Use lazy loading for use cases to break circular dependencies
      const createRelationUseCase = (await c.resolve(UseCaseTokens.CREATE_RELATION_USE_CASE).catch(() => null)) as
        ConstructorParameters<typeof RelationResolver>[0]
      const createRelationTypeUseCase = (await c
        .resolve(UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE)
        .catch(() => null)) as ConstructorParameters<typeof RelationResolver>[1]
      const searchRelatedNodesUseCase = (await c
        .resolve(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE)
        .catch(() => null)) as ConstructorParameters<typeof RelationResolver>[2]

      // Resolve repositories
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(c, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository

      const simpleLogger = createConsoleLogger('RelationResolver')

      return new RelationResolver(
        createRelationUseCase,
        createRelationTypeUseCase,
        searchRelatedNodesUseCase,
        nodeRelationRepository,
        relationTypeRepository,
        nodeRepository,
        nodeAttributeRepository,
        tableRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  // Query Template Resolver - Unified resolver (special: depends on GraphQLSchema)
  container.registerSingleton(
    GraphQLTokens.QUERY_TEMPLATE_RESOLVER,
    async (c) => {
      const { QueryTemplateResolver } = await import('@/presentation/graphql/resolvers/QueryTemplateResolver.js')

      // Resolve repositories
      const queryTemplateRepository = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )) as IQueryTemplateRepository

      const simpleLogger = createConsoleLogger('QueryTemplateResolver')

      // Schema will be set later via setSchema() method to avoid circular dependency
      const emptySchema = null as unknown as ConstructorParameters<typeof QueryTemplateResolver>[2]

      return new QueryTemplateResolver(queryTemplateRepository, simpleLogger, emptySchema)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.EXPORT_MUTATIONS,
    async (c) => {
      const tableNodesExportUseCase = await resolveAs<TableNodesExportUseCase>(
        c,
        UseCaseTokens.TABLE_NODES_EXPORT_USE_CASE,
      )
      const simpleLogger = createConsoleLogger()
      const { ExportMutations } = await import('@/presentation/graphql/mutations/ExportMutations.js')
      const exportMutations = new ExportMutations(tableNodesExportUseCase, simpleLogger)

      const { createExportResolvers } = await import('@/presentation/graphql/resolvers/ExportResolvers.js')
      return createExportResolvers(exportMutations)
    },
    [UseCaseTokens.TABLE_NODES_EXPORT_USE_CASE],
  )

  // Table Package Resolver
  container.registerSingleton(GraphQLTokens.TABLE_PACKAGE_RESOLVER, async (c) => {
    // Import the resolver class at runtime to avoid circular dependencies
    const { TablePackageResolver } = await import('@/presentation/graphql/resolvers/TablePackageResolver.js')
    const { TablePackageTokens } = await import('../tokens/TablePackageTokens.js')

    const tablePackageService = await c.resolve(TablePackageTokens.TABLE_PACKAGE_SERVICE)

    // Import TablePackageService type for casting
    const { TablePackageService } = await import('@/domain/services/TablePackageService.js')
    const typedTablePackageService = tablePackageService as InstanceType<typeof TablePackageService>

    const simpleLogger = createConsoleLogger()

    return new TablePackageResolver(typedTablePackageService, simpleLogger)
  })

  // Field resolvers
  container.registerSingleton(
    GraphQLTokens.TABLE_FIELD_RESOLVERS,
    async (c) => {
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const getTableDocsUseCase = await resolveAs<ConstructorParameters<typeof TableFieldResolvers>[3]>(
        c,
        UseCaseTokens.GET_TABLE_DOCS_USE_CASE,
      )
      const simpleLogger = createConsoleLogger()
      return new TableFieldResolvers(
        attributeRepository,
        attributeTypeRepository,
        nodeRepository,
        getTableDocsUseCase,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      UseCaseTokens.GET_TABLE_DOCS_USE_CASE,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.NODE_FIELD_RESOLVERS,
    async (c) => {
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeAttributeRepository = await resolveAs<INodeAttributeRepository>(c, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const nodeRelationRepository = (await c.resolve(
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )) as INodeRelationRepository
      const relationTypeRepository = await resolveAs<ConstructorParameters<typeof NodeFieldResolvers>[4]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      const simpleLogger = createConsoleLogger()
      return new NodeFieldResolvers(
        nodeRepository,
        tableRepository,
        nodeAttributeRepository,
        nodeRelationRepository,
        relationTypeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.ATTRIBUTE_FIELD_RESOLVERS,
    async (c) => {
      const attributeTypeRepository = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const attributeRepository = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const simpleLogger = createConsoleLogger()
      return new AttributeFieldResolvers(attributeTypeRepository, attributeRepository, tableRepository, simpleLogger)
    },
    [
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const nodeRepository = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const relationTypeRepository = (await c.resolve(
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )) as IRelationTypeRepository
      const simpleLogger = createConsoleLogger()
      return new RelationFieldResolvers(tableRepository, nodeRepository, relationTypeRepository, simpleLogger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY],
  )

  container.registerSingleton(
    GraphQLTokens.RELATION_TYPE_FIELD_RESOLVERS,
    async (_c) => {
      const simpleLogger = createConsoleLogger()
      return new RelationTypeFieldResolvers(simpleLogger)
    },
    [],
  )

  container.registerSingleton(
    GraphQLTokens.QUERY_TEMPLATE_FIELD_RESOLVERS,
    async (_c) => {
      const simpleLogger = createConsoleLogger()
      return new QueryTemplateFieldResolvers(simpleLogger)
    },
    [],
  )

  container.registerSingleton(
    GraphQLTokens.DOC_FIELD_RESOLVERS,
    async (c) => {
      const tableRepository = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      return new DocFieldResolvers(tableRepository)
    },
    [RepositoryTokens.TABLE_REPOSITORY],
  )

  // GraphQL Schema Builder
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA_BUILDER,
    async (c) => {
      const { GraphQLSchemaBuilder } = await import('@/presentation/graphql/GraphQLSchemaBuilder.js')
      return new GraphQLSchemaBuilder(c)
    },
    [],
  )

  // GraphQL Executor
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_EXECUTOR,
    async (c) => {
      const { execute } = await import('graphql')
      const schema = (await c.resolve(GraphQLTokens.GRAPHQL_SCHEMA)) as GraphQLSchema

      return {
        executeSchema: async (
          query: string,
          variables?: Record<string, unknown>,
          context?: unknown,
        ) => {
          return execute({
            schema,
            document: typeof query === 'string' ? await (await import('graphql')).parse(query) : query,
            variableValues: variables,
            contextValue: context,
          })
        },
        getSchema: () => schema,
      }
    },
    [GraphQLTokens.GRAPHQL_SCHEMA],
  )

  // GraphQL Schema
  container.registerSingleton(
    GraphQLTokens.GRAPHQL_SCHEMA,
    async (c) => {
      const schemaBuilder = await resolveAs<{
        build(): Promise<GraphQLSchema>
      }>(c, GraphQLTokens.GRAPHQL_SCHEMA_BUILDER)

      return schemaBuilder.build()
    },
    [GraphQLTokens.GRAPHQL_SCHEMA_BUILDER],
  )
}
