/**
 * System GraphQL Resolver
 * Handles system-level operations including initialization
 */

import {
  type SystemInitializationRequest,
  SystemInitializationUseCase,
} from '../../../application/use-cases/system/SystemInitializationUseCase'
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import type { TabularSyncConfig } from '@/infrastructure/excel/TabularSyncConfig.js'
import type { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'
import type { DIContainer } from '../../../infrastructure/container/DIContainer'
import { BaseResolver } from '../base/BaseResolver'

interface SystemInitializationInput {
  mode: 'QUICK' | 'FULL' | 'DEMO' | 'CUSTOM'
  options?: {
    resetDatabase?: boolean
    resetTemplates?: boolean
    resetTestData?: boolean
    createSampleData?: boolean
    resetMetrics?: boolean
    preserveTableIds?: number[]
    initMode?: 'DEVELOPMENT' | 'TESTING' | 'PRODUCTION' | 'DEMO'
  }
}

type InitializationMode = NonNullable<SystemInitializationRequest['options']>['mode']

const SYSTEM_INITIALIZATION_MODE_MAP: Record<SystemInitializationInput['mode'], SystemInitializationRequest['mode']> = {
  QUICK: 'quick',
  FULL: 'full',
  DEMO: 'demo',
  CUSTOM: 'custom',
}

const INITIALIZATION_OPTION_MODE_MAP: Record<
  NonNullable<NonNullable<SystemInitializationInput['options']>['initMode']>,
  InitializationMode
> = {
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  PRODUCTION: 'production',
  DEMO: 'demo',
}

export class SystemResolver extends BaseResolver {
  protected logger = {
    info: (msg: string, data?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, data || ''),
    warn: (msg: string, data?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, data || ''),
    error: (msg: string, data?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, data || ''),
    debug: (msg: string, data?: Record<string, unknown>) => console.debug(`[DEBUG] ${msg}`, data || ''),
  }

  private systemInitializationUseCase: SystemInitializationUseCase
  private readonly tabularSyncConfigStore: TabularSyncConfigStore | null
  private readonly tabularSyncHook: BestEffortTabularSyncHook | null

  constructor(
    container: DIContainer,
    tabularSyncConfigStore?: TabularSyncConfigStore | null,
    tabularSyncHook?: BestEffortTabularSyncHook | null,
  ) {
    super()
    this.systemInitializationUseCase = new SystemInitializationUseCase(container)
    this.tabularSyncConfigStore = tabularSyncConfigStore || null
    this.tabularSyncHook = tabularSyncHook || null
  }

  /**
   * Initialize system mutation
   */
  async initializeSystem(_parent: unknown, args: { input: SystemInitializationInput }) {
    try {
      const { input } = args

      // Convert GraphQL enum to use case format
      const mode = SYSTEM_INITIALIZATION_MODE_MAP[input.mode]

      const request: SystemInitializationRequest = {
        mode,
        options: input.options
          ? {
              ...input.options,
              mode: input.options.initMode ? INITIALIZATION_OPTION_MODE_MAP[input.options.initMode] : 'development',
            }
          : undefined,
      }

      const result = await this.systemInitializationUseCase.execute(request)

      return {
        success: result.success,
        result: result.success
          ? {
              actions: result.actions,
              timings: result.timings,
              summary: result.summary,
              totalTime: result.timings.total || 0,
            }
          : null,
        errors: result.errors.map((error) => ({ message: error })),
      }
    } catch (error) {
      this.logger.error('Failed to initialize system', { error })
      return {
        success: false,
        result: null,
        errors: [this.mapToGraphQLError(error, 'initializeSystem')],
      }
    }
  }

  /**
   * Get system status query
   */
  async systemStatus() {
    try {
      const status = await this.systemInitializationUseCase.getStatus()

      return {
        database: status.database,
        summary: {
          tablesCount: status.tablesCount,
          templatesCount: status.templatesCount,
          nodesCount: status.nodesCount,
          attributesCount: 0, // Will be calculated if needed
        },
        lastInitialized: status.lastInitialized,
      }
    } catch (error) {
      this.logger.error('Failed to get system status', { error })
      throw this.mapToGraphQLError(error, 'systemStatus')
    }
  }

  async saveTabularSyncConfig(
    _parent: unknown,
    args: { input: { configKey: string; config: Record<string, unknown>; active?: boolean } },
  ) {
    try {
      if (!this.tabularSyncConfigStore) {
        throw new Error('Tabular sync config store is not available')
      }

      this.tabularSyncConfigStore.saveConfig(
        args.input.configKey,
        args.input.config as unknown as TabularSyncConfig,
        { active: args.input.active !== false },
      )

      const saved = this.tabularSyncConfigStore.getConfigRecordByKey(args.input.configKey)

      return {
        success: true,
        config: saved,
        errors: [],
      }
    } catch (error) {
      return {
        success: false,
        config: null,
        errors: [this.mapToGraphQLError(error, 'saveTabularSyncConfig')],
      }
    }
  }

  async activateTabularSyncConfig(
    _parent: unknown,
    args: { configKey: string },
  ) {
    try {
      if (!this.tabularSyncConfigStore) {
        throw new Error('Tabular sync config store is not available')
      }

      this.tabularSyncConfigStore.activateConfig(args.configKey)
      const activeConfig = this.tabularSyncConfigStore.getActiveConfigRecord()

      return {
        success: true,
        config: activeConfig,
        errors: [],
      }
    } catch (error) {
      return {
        success: false,
        config: null,
        errors: [this.mapToGraphQLError(error, 'activateTabularSyncConfig')],
      }
    }
  }

  async resyncTabularSyncTable(
    _parent: unknown,
    args: { tableIdentifier: string },
  ) {
    try {
      if (!this.tabularSyncHook) {
        throw new Error('Tabular sync hook is not available')
      }

      const syncSucceeded = await this.tabularSyncHook.syncByIdentifier(args.tableIdentifier)

      return {
        success: syncSucceeded,
        tableIdentifier: args.tableIdentifier,
        status: this.tabularSyncHook.getStatus(),
        errors: syncSucceeded ? [] : [this.mapToGraphQLError(new Error('Tabular sync failed'), 'resyncTabularSyncTable')],
      }
    } catch (error) {
      return {
        success: false,
        tableIdentifier: args.tableIdentifier,
        status: this.tabularSyncHook?.getStatus() || null,
        errors: [this.mapToGraphQLError(error, 'resyncTabularSyncTable')],
      }
    }
  }
}
