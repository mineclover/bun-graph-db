import { existsSync, readFileSync } from 'node:fs'
import type { ILogger } from '@/application/ports/ILogger.js'
import { TabularTableSyncBridge } from '@/application/services/TabularTableSyncBridge.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { TabularSyncConfig } from '@/infrastructure/excel/TabularSyncConfig.js'
import type { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'
import type { TabularSyncEventStore } from '@/infrastructure/excel/TabularSyncEventStore.js'
import {
  createTabularDestinationGateways,
  ExcelSchemaProjector,
  TabularSyncPlanner,
  TabularSyncService,
  TabularSyncTargetRegistry,
} from '@/infrastructure/excel/index.js'

type PendingSyncMode = 'sync' | 'clear'

interface PendingSyncEntry {
  mode: PendingSyncMode
  resolvers: Array<(success: boolean) => void>
  timer: ReturnType<typeof setTimeout>
}

type TabularSyncConfigSource = 'file' | 'db' | 'none'

interface TableSyncMetricState {
  tableIdentifier: string
  pending: boolean
  notifications: number
  executions: number
  successes: number
  failures: number
  lastMode: PendingSyncMode | null
  lastScheduledAt: string | null
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastError: string | null
}

export interface TabularSyncFailureMetric {
  tableIdentifier: string
  mode: PendingSyncMode
  error: string
  occurredAt: string
}

export interface TabularSyncTableMetric {
  tableIdentifier: string
  pending: boolean
  notifications: number
  executions: number
  successes: number
  failures: number
  lastMode: PendingSyncMode | null
  lastScheduledAt: string | null
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastError: string | null
}

export interface TabularSyncStatusSnapshot {
  enabled: boolean
  configSource: TabularSyncConfigSource
  syncDebounceMs: number
  pendingCount: number
  pendingTables: string[]
  totalNotifications: number
  totalExecutions: number
  totalSucceeded: number
  totalFailed: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  recentFailures: TabularSyncFailureMetric[]
  tables: TabularSyncTableMetric[]
  persistedEvents: Array<{
    id: number
    tableIdentifier: string
    mode: string
    status: string
    errorMessage: string | null
    createdAt: string
  }>
  persistedSummary: Array<{
    tableIdentifier: string
    mode: string
    eventCount: number
    successCount: number
    failureCount: number
    successRate: number
    lastCreatedAt: string
    latestErrorMessage: string | null
  }>
}

export interface TabularSyncStatusFilters {
  limit?: number
  tableIdentifier?: string | null
  status?: string | null
  mode?: string | null
  windowPreset?: string | null
  createdAfter?: string | null
  createdBefore?: string | null
}

export class BestEffortTabularSyncHook {
  private bridge: TabularTableSyncBridge | null = null
  private syncDebounceMs = 0
  private readonly pendingSyncs = new Map<string, PendingSyncEntry>()
  private configSource: TabularSyncConfigSource = 'none'
  private currentConfigSignature = 'uninitialized'
  private readonly tableMetrics = new Map<string, TableSyncMetricState>()
  private readonly recentFailures: TabularSyncFailureMetric[] = []
  private totalNotifications = 0
  private totalExecutions = 0
  private totalSucceeded = 0
  private totalFailed = 0
  private lastSuccessAt: string | null = null
  private lastFailureAt: string | null = null

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly logger: ILogger,
    private readonly configPath: string | undefined = process.env.TABULAR_SYNC_CONFIG_FILE,
    private readonly configStore?: TabularSyncConfigStore,
    private readonly eventStore?: TabularSyncEventStore,
  ) {
    this.refreshRuntime()
  }

  isEnabled(): boolean {
    this.refreshRuntime()
    return this.bridge !== null
  }

  notifyByIdentifier(tableIdentifier: string): void {
    void this.schedule(tableIdentifier, 'sync', false)
  }

  notifyByTableId(tableId: string): void {
    void (async () => {
      this.refreshRuntime()
      if (!this.bridge) {
        return
      }

      try {
        const table = await this.tableRepository.findById(tableId)
        if (!table) {
          return
        }

        await this.schedule(table.identifier, 'sync', false)
      } catch (error) {
        this.logger.warn('Best-effort tabular sync failed', {
          tableId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }

  notifyClearByIdentifier(tableIdentifier: string): void {
    void this.schedule(tableIdentifier, 'clear', false)
  }

  async syncByIdentifier(tableIdentifier: string): Promise<boolean> {
    this.refreshRuntime()
    if (!this.bridge) {
      return false
    }

    return await this.schedule(tableIdentifier, 'sync', true)
  }

  async syncByTableId(tableId: string): Promise<boolean> {
    this.refreshRuntime()
    if (!this.bridge) {
      return false
    }

    try {
      const table = await this.tableRepository.findById(tableId)
      if (!table) {
        return false
      }

      return await this.schedule(table.identifier, 'sync', true)
    } catch (error) {
      this.logger.warn('Best-effort tabular sync failed', {
        tableId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async clearByIdentifier(tableIdentifier: string): Promise<boolean> {
    this.refreshRuntime()
    if (!this.bridge) {
      return false
    }

    return await this.schedule(tableIdentifier, 'clear', true)
  }

  async flush(): Promise<void> {
    await Promise.all(
      Array.from(this.pendingSyncs.keys()).map((tableIdentifier) =>
        this.schedule(tableIdentifier, this.pendingSyncs.get(tableIdentifier)?.mode || 'sync', true),
      ),
    )
  }

  getStatus(filters: TabularSyncStatusFilters = {}): TabularSyncStatusSnapshot {
    this.refreshRuntime()
    const resolvedWindow = this.resolveWindowPreset(filters.windowPreset)
    const createdAfter = filters.createdAfter ?? resolvedWindow.createdAfter
    const createdBefore = filters.createdBefore ?? resolvedWindow.createdBefore
    const tables = Array.from(this.tableMetrics.values())
      .map<TabularSyncTableMetric>((metric) => ({ ...metric }))
      .sort((left, right) => left.tableIdentifier.localeCompare(right.tableIdentifier))
    const aggregateMetrics = this.eventStore?.getAggregateMetrics()

    return {
      enabled: this.isEnabled(),
      configSource: this.configSource,
      syncDebounceMs: this.syncDebounceMs,
      pendingCount: this.pendingSyncs.size,
      pendingTables: Array.from(this.pendingSyncs.keys()).sort(),
      totalNotifications: this.totalNotifications,
      totalExecutions: aggregateMetrics?.totalEvents ?? this.totalExecutions,
      totalSucceeded: aggregateMetrics?.totalSuccess ?? this.totalSucceeded,
      totalFailed: aggregateMetrics?.totalFailure ?? this.totalFailed,
      lastSuccessAt: aggregateMetrics?.lastSuccessAt ?? this.lastSuccessAt,
      lastFailureAt: aggregateMetrics?.lastFailureAt ?? this.lastFailureAt,
      recentFailures: [...this.recentFailures],
      tables,
      persistedEvents:
        this.eventStore?.listRecent({
          limit: filters.limit,
          tableIdentifier: filters.tableIdentifier,
          status: filters.status,
          mode: filters.mode,
          createdAfter,
          createdBefore,
        }) || [],
      persistedSummary:
        this.eventStore?.summarize({
          limit: filters.limit,
          tableIdentifier: filters.tableIdentifier,
          status: filters.status,
          mode: filters.mode,
          createdAfter,
          createdBefore,
        }) || [],
    }
  }

  private resolveWindowPreset(windowPreset?: string | null): {
    createdAfter?: string
    createdBefore?: string
  } {
    if (!windowPreset) {
      return {}
    }

    const now = new Date()

    switch (windowPreset) {
      case '1h':
        return {
          createdAfter: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
          createdBefore: now.toISOString(),
        }
      case '24h':
        return {
          createdAfter: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          createdBefore: now.toISOString(),
        }
      case '7d':
        return {
          createdAfter: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdBefore: now.toISOString(),
        }
      default:
        return {}
    }
  }

  private async schedule(
    tableIdentifier: string,
    mode: PendingSyncMode,
    waitForCompletion: boolean,
  ): Promise<boolean> {
    this.refreshRuntime()
    if (!this.bridge) {
      return false
    }

    const metric = this.getOrCreateMetric(tableIdentifier)
    const scheduledAt = new Date().toISOString()
    this.totalNotifications++
    metric.notifications++
    metric.pending = true
    metric.lastMode = mode
    metric.lastScheduledAt = scheduledAt

    const existing = this.pendingSyncs.get(tableIdentifier)
    if (existing) {
      clearTimeout(existing.timer)
      existing.mode = existing.mode === 'clear' ? 'clear' : mode
      existing.timer = this.createTimer(tableIdentifier, existing)

      if (!waitForCompletion) {
        return false
      }

      return await new Promise<boolean>((resolve) => {
        existing.resolvers.push(resolve)
      })
    }

    const entry: PendingSyncEntry = {
      mode,
      resolvers: [],
      timer: setTimeout(() => {}, 0),
    }
    entry.timer = this.createTimer(tableIdentifier, entry)
    this.pendingSyncs.set(tableIdentifier, entry)

    if (!waitForCompletion) {
      return false
    }

    return await new Promise<boolean>((resolve) => {
      entry.resolvers.push(resolve)
    })
  }

  private createTimer(
    tableIdentifier: string,
    entry: PendingSyncEntry,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(async () => {
      this.refreshRuntime()
      const metric = this.getOrCreateMetric(tableIdentifier)
      const startedAt = new Date().toISOString()
      this.totalExecutions++
      metric.executions++
      metric.lastStartedAt = startedAt
      let executionSuccess = false

      try {
        if (!this.bridge) {
          return
        }

        if (entry.mode === 'clear') {
          await this.bridge.clearByIdentifier(tableIdentifier)
        } else {
          await this.bridge.syncByIdentifier(tableIdentifier)
        }

        const completedAt = new Date().toISOString()
        this.totalSucceeded++
        this.lastSuccessAt = completedAt
        metric.successes++
        metric.lastCompletedAt = completedAt
        metric.lastSuccessAt = completedAt
        metric.lastError = null
        this.eventStore?.recordEvent({
          tableIdentifier,
          mode: entry.mode,
          status: 'success',
        })
        executionSuccess = true
      } catch (error) {
        const completedAt = new Date().toISOString()
        const message = error instanceof Error ? error.message : String(error)
        this.totalFailed++
        this.lastFailureAt = completedAt
        metric.failures++
        metric.lastCompletedAt = completedAt
        metric.lastFailureAt = completedAt
        metric.lastError = message
        this.recordFailure({
          tableIdentifier,
          mode: entry.mode,
          error: message,
          occurredAt: completedAt,
        })
        this.eventStore?.recordEvent({
          tableIdentifier,
          mode: entry.mode,
          status: 'failure',
          errorMessage: message,
        })
        this.logger.warn('Best-effort tabular sync failed', {
          tableIdentifier,
          mode: entry.mode,
          error: message,
        })
      } finally {
        this.pendingSyncs.delete(tableIdentifier)
        metric.pending = false
        for (const resolve of entry.resolvers) {
          resolve(executionSuccess)
        }
      }
    }, this.syncDebounceMs)
  }

  private getOrCreateMetric(tableIdentifier: string): TableSyncMetricState {
    const existing = this.tableMetrics.get(tableIdentifier)
    if (existing) {
      return existing
    }

    const created: TableSyncMetricState = {
      tableIdentifier,
      pending: false,
      notifications: 0,
      executions: 0,
      successes: 0,
      failures: 0,
      lastMode: null,
      lastScheduledAt: null,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    }
    this.tableMetrics.set(tableIdentifier, created)
    return created
  }

  private recordFailure(failure: TabularSyncFailureMetric): void {
    this.recentFailures.unshift(failure)
    if (this.recentFailures.length > 10) {
      this.recentFailures.length = 10
    }
  }

  private loadRuntimeConfig(): {
    config: TabularSyncConfig | null
    source: TabularSyncConfigSource
    signature: string
  } {
    if (this.configPath && existsSync(this.configPath)) {
      const raw = readFileSync(this.configPath, 'utf8')
      return {
        config: JSON.parse(raw) as TabularSyncConfig,
        source: 'file',
        signature: `file:${raw}`,
      }
    }

    const record = this.configStore?.getActiveConfigRecord()
    if (record) {
      const serialized = JSON.stringify(record.config)
      return {
        config: record.config,
        source: 'db',
        signature: `db:${record.configKey}:${record.updatedAt}:${serialized}`,
      }
    }

    return {
      config: null,
      source: 'none',
      signature: 'none',
    }
  }

  private refreshRuntime(): void {
    const { config, source, signature } = this.loadRuntimeConfig()

    if (signature === this.currentConfigSignature) {
      return
    }

    this.currentConfigSignature = signature

    if (!config) {
      this.bridge = null
      this.syncDebounceMs = 0
      this.configSource = source
      return
    }

    try {
      const registry = new TabularSyncTargetRegistry(config)
      const planner = new TabularSyncPlanner(registry, new ExcelSchemaProjector())
      const syncService = new TabularSyncService(registry, planner, createTabularDestinationGateways())

      this.syncDebounceMs = registry.getSyncDebounceMs()
      this.bridge = new TabularTableSyncBridge(
        this.tableRepository,
        this.attributeRepository,
        this.nodeRepository,
        this.nodeAttributeRepository,
        syncService,
        this.logger,
      )
      this.configSource = source
    } catch (error) {
      this.syncDebounceMs = 0
      this.configSource = 'none'
      this.bridge = null
      this.logger.warn('Failed to initialize tabular sync hook; disabling sync', {
        configPath: this.configPath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
