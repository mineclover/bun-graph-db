import { existsSync, readFileSync } from 'node:fs'
import type { ILogger } from '@/application/ports/ILogger.js'
import { TabularTableSyncBridge } from '@/application/services/TabularTableSyncBridge.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { TabularSyncConfig } from '@/infrastructure/excel/TabularSyncConfig.js'
import type { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'
import type {
  TabularSyncEventStore,
  TabularSyncJobMode,
  TabularSyncJobRecord,
} from '@/infrastructure/excel/TabularSyncEventStore.js'
import {
  createTabularDestinationGateways,
  ExcelSchemaProjector,
  TabularSyncPlanner,
  TabularSyncService,
  TabularSyncTargetRegistry,
} from '@/infrastructure/excel/index.js'

type PendingSyncMode = TabularSyncJobMode

interface PendingSyncEntry {
  mode: PendingSyncMode
  resolvers: Array<(success: boolean) => void>
  timer: ReturnType<typeof setTimeout>
  dirtyNodeIds: Set<string>
  forceFull: boolean
  revision: number
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
  maxConcurrentTables?: number
  activeExecutions?: number
  peakConcurrentExecutions?: number
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
  persistedJobs: TabularSyncJobRecord[]
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

export interface BestEffortTabularSyncHookOptions {
  /** Maximum number of different tables that may sync concurrently. */
  maxConcurrentTables?: number
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
  private readonly durableWorkerId = `tabular-sync-${crypto.randomUUID()}`
  private durableDrainTimer: ReturnType<typeof setTimeout> | null = null
  private durableDrainRunning = false
  private disposed = false
  private readonly durableLeaseDurationMs = 60_000
  private readonly durableMaxAttempts = 5
  private readonly maxConcurrentTables: number
  private activeExecutions = 0
  private peakConcurrentExecutions = 0
  private readonly executionWaiters: Array<() => void> = []
  private readonly tableExecutionTails = new Map<string, Promise<void>>()
  private readonly tableNotificationRevisions = new Map<string, number>()
  private readonly durableDirtyNodeRevisions = new Map<
    string,
    Map<string, number>
  >()
  private readonly durableFullSyncRevisions = new Map<string, number>()

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly logger: ILogger,
    private readonly configPath: string | undefined = process.env.TABULAR_SYNC_CONFIG_FILE,
    private readonly configStore?: TabularSyncConfigStore,
    private readonly eventStore?: TabularSyncEventStore,
    options: BestEffortTabularSyncHookOptions = {},
  ) {
    this.maxConcurrentTables = resolveMaxConcurrentTables(
      options.maxConcurrentTables,
    )
    this.refreshRuntime()
    if (this.eventStore) {
      const recovered = this.eventStore.recoverUnfinishedJobs()
      if (recovered > 0) {
        this.logger.info('Recovered unfinished tabular sync jobs', { recovered })
      }
      this.requestDurableDrain()
    }
  }

  isEnabled(): boolean {
    if (this.disposed) {
      return false
    }
    this.refreshRuntime()
    this.requestDurableDrain()
    return this.bridge !== null
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose()
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true
    if (this.durableDrainTimer) {
      clearTimeout(this.durableDrainTimer)
      this.durableDrainTimer = null
    }
    for (const entry of this.pendingSyncs.values()) {
      clearTimeout(entry.timer)
      for (const resolve of entry.resolvers) {
        resolve(false)
      }
    }
    this.pendingSyncs.clear()
    this.bridge = null
    await Promise.allSettled(this.tableExecutionTails.values())
  }

  notifyByIdentifier(
    tableIdentifier: string,
    dirtyNodeIds?: string | readonly string[],
  ): void {
    void this.schedule(
      tableIdentifier,
      'sync',
      false,
      normalizeDirtyNodeIds(dirtyNodeIds),
    )
  }

  notifyByTableId(
    tableId: string,
    dirtyNodeIds?: string | readonly string[],
  ): void {
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

        await this.schedule(
          table.identifier,
          'sync',
          false,
          normalizeDirtyNodeIds(dirtyNodeIds),
        )
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

    return await this.schedule(tableIdentifier, 'sync', true, [])
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

      return await this.schedule(table.identifier, 'sync', true, [])
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

    return await this.schedule(tableIdentifier, 'clear', true, [])
  }

  async flush(): Promise<void> {
    if (this.eventStore) {
      for (const job of this.eventStore.listJobs({ limit: 1000 })) {
        this.eventStore.makeJobDue(job.tableIdentifier)
      }
      await this.processDurableJobs()
      return
    }

    await Promise.all(
      Array.from(this.pendingSyncs.keys()).map((tableIdentifier) =>
        this.schedule(
          tableIdentifier,
          this.pendingSyncs.get(tableIdentifier)?.mode || 'sync',
          true,
          [],
        ),
      ),
    )
  }

  getStatus(filters: TabularSyncStatusFilters = {}): TabularSyncStatusSnapshot {
    this.refreshRuntime()
    this.requestDurableDrain()
    const resolvedWindow = this.resolveWindowPreset(filters.windowPreset)
    const createdAfter = filters.createdAfter ?? resolvedWindow.createdAfter
    const createdBefore = filters.createdBefore ?? resolvedWindow.createdBefore
    const tables = Array.from(this.tableMetrics.values())
      .map<TabularSyncTableMetric>((metric) => ({ ...metric }))
      .sort((left, right) => left.tableIdentifier.localeCompare(right.tableIdentifier))
    const aggregateMetrics = this.eventStore?.getAggregateMetrics()
    const persistedJobs = this.eventStore?.listJobs({
      tableIdentifier: filters.tableIdentifier,
      limit: filters.limit,
    }) || []
    const activePersistedJobs = persistedJobs.filter((job) =>
      job.status === 'queued' || job.status === 'running' || job.status === 'retry_wait',
    )

    return {
      enabled: this.isEnabled(),
      configSource: this.configSource,
      syncDebounceMs: this.syncDebounceMs,
      maxConcurrentTables: this.maxConcurrentTables,
      activeExecutions: this.activeExecutions,
      peakConcurrentExecutions: this.peakConcurrentExecutions,
      pendingCount: this.eventStore ? activePersistedJobs.length : this.pendingSyncs.size,
      pendingTables: this.eventStore
        ? activePersistedJobs.map((job) => job.tableIdentifier).sort()
        : Array.from(this.pendingSyncs.keys()).sort(),
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
      persistedJobs,
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
    dirtyNodeIds: readonly string[] = [],
  ): Promise<boolean> {
    if (this.disposed) {
      return false
    }
    this.refreshRuntime()
    if (!this.bridge) {
      return false
    }
    if (
      typeof this.bridge.supportsIdentifier === 'function' &&
      !this.bridge.supportsIdentifier(tableIdentifier)
    ) {
      this.logger.debug('Skipping tabular sync without an enabled route', {
        tableIdentifier,
      })
      return false
    }

    if (this.eventStore) {
      return await this.scheduleDurable(
        tableIdentifier,
        mode,
        waitForCompletion,
        dirtyNodeIds,
      )
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
      existing.forceFull =
        existing.forceFull || (mode === 'sync' && dirtyNodeIds.length === 0)
      for (const nodeId of dirtyNodeIds) {
        existing.dirtyNodeIds.add(nodeId)
      }
      existing.revision = this.nextTableNotificationRevision(tableIdentifier)
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
      dirtyNodeIds: new Set(dirtyNodeIds),
      forceFull: mode === 'sync' && dirtyNodeIds.length === 0,
      revision: this.nextTableNotificationRevision(tableIdentifier),
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

  /**
   * SQLite is the source of truth for scheduled work.  The timer merely wakes
   * this process at the next due time; an interrupted process can reconstruct
   * the same work from the table on its next start.
   */
  private async scheduleDurable(
    tableIdentifier: string,
    mode: PendingSyncMode,
    waitForCompletion: boolean,
    dirtyNodeIds: readonly string[],
  ): Promise<boolean> {
    const metric = this.getOrCreateMetric(tableIdentifier)
    const scheduledAt = new Date().toISOString()
    this.totalNotifications++
    metric.notifications++
    metric.pending = true
    metric.lastMode = mode
    metric.lastScheduledAt = scheduledAt

    const job = this.eventStore?.enqueueJob({
      tableIdentifier,
      mode,
      nextAttemptAt: new Date(Date.now() + this.syncDebounceMs).toISOString(),
    })
    if (!job) {
      return false
    }
    this.recordDurableNotification(
      tableIdentifier,
      job.revision,
      mode,
      dirtyNodeIds,
    )

    if (!waitForCompletion) {
      this.requestDurableDrain()
      return false
    }

    // Explicit resync keeps the existing synchronous API: force its first
    // delivery now and report whether that execution completed successfully.
    this.eventStore?.makeJobDue(tableIdentifier)
    const succeeded = await this.waitForDurableOutcome(job.id)
    const settled = this.eventStore?.getJobById(job.id)
    metric.pending = settled?.status === 'queued' || settled?.status === 'running' || settled?.status === 'retry_wait'
    return succeeded
  }

  private async waitForDurableOutcome(jobId: number): Promise<boolean> {
    while (true) {
      await this.processDurableJobs()
      const current = this.eventStore?.getJobById(jobId)
      if (!current) {
        return false
      }
      if (current.status === 'succeeded') {
        return true
      }
      // The initial delivery failed. A retry remains scheduled in SQLite, but
      // callers of the long-standing explicit resync API receive that failure
      // rather than waiting through every background retry interval.
      if (current.status === 'retry_wait' || current.status === 'failed' || current.status === 'paused') {
        return false
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
    }
  }

  private requestDurableDrain(): void {
    if (
      this.disposed ||
      !this.eventStore ||
      !this.bridge ||
      this.durableDrainRunning
    ) {
      return
    }
    const nextDueAt = this.eventStore.getNextDueAt()
    if (!nextDueAt) {
      return
    }
    const delay = Math.max(0, Math.min(Date.parse(nextDueAt) - Date.now(), 2_147_483_647))
    if (this.durableDrainTimer) {
      clearTimeout(this.durableDrainTimer)
    }
    this.durableDrainTimer = setTimeout(() => {
      this.durableDrainTimer = null
      void this.processDurableJobs()
    }, delay)
  }

  private async processDurableJobs(): Promise<void> {
    if (!this.eventStore || !this.bridge || this.durableDrainRunning) {
      return
    }

    this.durableDrainRunning = true
    try {
      const running = new Set<Promise<void>>()
      while (this.bridge && !this.disposed) {
        while (running.size < this.maxConcurrentTables) {
          const job = this.eventStore.claimNextDueJob({
            workerId: this.durableWorkerId,
            leaseDurationMs: this.durableLeaseDurationMs,
          })
          if (!job) {
            break
          }

          let task: Promise<void>
          task = this.runTableSerial(job.tableIdentifier, () =>
            this.executeDurableJob(job),
          ).finally(() => {
            running.delete(task)
          })
          running.add(task)
        }

        if (running.size === 0) {
          return
        }
        await Promise.race(running)
      }
      await Promise.all(running)
    } finally {
      this.durableDrainRunning = false
      this.requestDurableDrain()
    }
  }

  private async executeDurableJob(job: TabularSyncJobRecord): Promise<void> {
    const metric = this.getOrCreateMetric(job.tableIdentifier)
    const startedAt = new Date().toISOString()
    this.totalExecutions++
    metric.executions++
    metric.pending = true
    metric.lastMode = job.mode
    metric.lastStartedAt = startedAt

    try {
      const dirtyNodeIds = this.getDurableDirtyNodeIds(
        job.tableIdentifier,
        job.revision,
      )
      const forceFullRevision =
        this.durableFullSyncRevisions.get(job.tableIdentifier)
      const forceFull =
        forceFullRevision !== undefined && forceFullRevision <= job.revision
      const result = await this.executeBridgeSync({
        tableIdentifier: job.tableIdentifier,
        mode: job.mode,
        dirtyNodeIds,
        forceFull,
        revision: job.revision,
      })
      this.assertSyncSucceeded(result)
      const completedAt = new Date().toISOString()
      const updated = this.eventStore?.completeJobSuccess(job)
      if (
        !updated ||
        (updated.status !== 'succeeded' && updated.status !== 'queued')
      ) {
        metric.pending =
          updated?.status === 'queued' ||
          updated?.status === 'running' ||
          updated?.status === 'retry_wait'
        this.logger.warn('Durable tabular sync completion lease was lost', {
          tableIdentifier: job.tableIdentifier,
          mode: job.mode,
          claimedRevision: job.revision,
          currentStatus: updated?.status ?? 'missing',
        })
        return
      }
      this.clearDurableNotificationState(job.tableIdentifier, job.revision)
      this.totalSucceeded++
      this.lastSuccessAt = completedAt
      metric.successes++
      metric.lastCompletedAt = completedAt
      metric.lastSuccessAt = completedAt
      metric.lastError = null
      metric.pending = updated?.status === 'queued'
      this.eventStore?.recordEvent({
        tableIdentifier: job.tableIdentifier,
        mode: job.mode,
        status: 'success',
      })
    } catch (error) {
      const completedAt = new Date().toISOString()
      const message = error instanceof Error ? error.message : String(error)
      const retryDelayMs = this.getRetryDelayMs(job.attempts)
      const updated = this.eventStore?.completeJobFailure({
        job,
        error: message,
        maxAttempts: this.durableMaxAttempts,
        retryDelayMs,
      })
      if (
        !updated ||
        !['queued', 'retry_wait', 'failed'].includes(updated.status)
      ) {
        metric.pending =
          updated?.status === 'queued' ||
          updated?.status === 'running' ||
          updated?.status === 'retry_wait'
        this.logger.warn('Durable tabular sync failure lease was lost', {
          tableIdentifier: job.tableIdentifier,
          mode: job.mode,
          claimedRevision: job.revision,
          currentStatus: updated?.status ?? 'missing',
          error: message,
        })
        return
      }
      this.totalFailed++
      this.lastFailureAt = completedAt
      metric.failures++
      metric.lastCompletedAt = completedAt
      metric.lastFailureAt = completedAt
      metric.lastError = message
      metric.pending = updated?.status === 'queued' || updated?.status === 'retry_wait'
      this.recordFailure({
        tableIdentifier: job.tableIdentifier,
        mode: job.mode,
        error: message,
        occurredAt: completedAt,
      })
      this.eventStore?.recordEvent({
        tableIdentifier: job.tableIdentifier,
        mode: job.mode,
        status: 'failure',
        errorMessage: message,
      })
      this.logger.warn('Durable tabular sync job failed', {
        tableIdentifier: job.tableIdentifier,
        mode: job.mode,
        attempts: job.attempts,
        retryDelayMs,
        error: message,
      })
    }
  }

  private async executeBridgeSync(input: {
    tableIdentifier: string
    mode: PendingSyncMode
    dirtyNodeIds: readonly string[]
    forceFull: boolean
    revision: number
  }): Promise<unknown> {
    if (!this.bridge) {
      throw new Error('Tabular sync bridge is not available.')
    }
    if (input.mode === 'clear') {
      return await this.bridge.clearByIdentifier(input.tableIdentifier)
    }
    if (!input.forceFull && input.dirtyNodeIds.length > 0) {
      return await this.bridge.syncDirtyByIdentifier(
        input.tableIdentifier,
        input.dirtyNodeIds,
        input.revision,
      )
    }
    return await this.bridge.syncByIdentifier(input.tableIdentifier)
  }

  private assertSyncSucceeded(result: unknown): void {
    if (
      typeof result === 'object' &&
      result !== null &&
      'synced' in result &&
      result.synced === false
    ) {
      const reason =
        'reason' in result && typeof result.reason === 'string'
          ? result.reason
          : 'Tabular sync did not write the configured destination.'
      throw new Error(reason)
    }
  }

  private nextTableNotificationRevision(tableIdentifier: string): number {
    const revision =
      (this.tableNotificationRevisions.get(tableIdentifier) ?? 0) + 1
    this.tableNotificationRevisions.set(tableIdentifier, revision)
    return revision
  }

  private recordDurableNotification(
    tableIdentifier: string,
    revision: number,
    mode: PendingSyncMode,
    dirtyNodeIds: readonly string[],
  ): void {
    if (mode !== 'sync' || dirtyNodeIds.length === 0) {
      this.durableFullSyncRevisions.set(tableIdentifier, revision)
      return
    }

    const revisions =
      this.durableDirtyNodeRevisions.get(tableIdentifier) ?? new Map()
    for (const nodeId of dirtyNodeIds) {
      revisions.set(nodeId, revision)
    }
    this.durableDirtyNodeRevisions.set(tableIdentifier, revisions)
  }

  private getDurableDirtyNodeIds(
    tableIdentifier: string,
    revision: number,
  ): string[] {
    const revisions = this.durableDirtyNodeRevisions.get(tableIdentifier)
    if (!revisions) {
      return []
    }
    return [...revisions.entries()]
      .filter(([, dirtyRevision]) => dirtyRevision <= revision)
      .map(([nodeId]) => nodeId)
      .sort()
  }

  private clearDurableNotificationState(
    tableIdentifier: string,
    revision: number,
  ): void {
    const revisions = this.durableDirtyNodeRevisions.get(tableIdentifier)
    if (revisions) {
      for (const [nodeId, dirtyRevision] of revisions) {
        if (dirtyRevision <= revision) {
          revisions.delete(nodeId)
        }
      }
      if (revisions.size === 0) {
        this.durableDirtyNodeRevisions.delete(tableIdentifier)
      }
    }

    const fullRevision = this.durableFullSyncRevisions.get(tableIdentifier)
    if (fullRevision !== undefined && fullRevision <= revision) {
      this.durableFullSyncRevisions.delete(tableIdentifier)
    }
  }

  private async runTableSerial<T>(
    tableIdentifier: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous =
      this.tableExecutionTails.get(tableIdentifier) ?? Promise.resolve()
    let releaseTable: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      releaseTable = resolve
    })
    this.tableExecutionTails.set(tableIdentifier, current)

    await previous
    try {
      return await this.withExecutionSlot(operation)
    } finally {
      releaseTable()
      if (this.tableExecutionTails.get(tableIdentifier) === current) {
        this.tableExecutionTails.delete(tableIdentifier)
      }
    }
  }

  private async withExecutionSlot<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquireExecutionSlot()
    try {
      return await operation()
    } finally {
      this.releaseExecutionSlot()
    }
  }

  private async acquireExecutionSlot(): Promise<void> {
    if (this.activeExecutions < this.maxConcurrentTables) {
      this.activeExecutions++
      this.peakConcurrentExecutions = Math.max(
        this.peakConcurrentExecutions,
        this.activeExecutions,
      )
      return
    }

    await new Promise<void>((resolve) => {
      this.executionWaiters.push(resolve)
    })
  }

  private releaseExecutionSlot(): void {
    const next = this.executionWaiters.shift()
    if (next) {
      next()
      return
    }
    this.activeExecutions--
  }

  private getRetryDelayMs(attempts: number): number {
    return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts - 1))
  }

  pauseByIdentifier(tableIdentifier: string): TabularSyncJobRecord | null {
    const job = this.eventStore?.pauseJob(tableIdentifier) || null
    if (job) {
      this.getOrCreateMetric(tableIdentifier).pending = false
    }
    return job
  }

  resumeByIdentifier(tableIdentifier: string): TabularSyncJobRecord | null {
    const job = this.eventStore?.resumeJob(tableIdentifier) || null
    this.requestDurableDrain()
    return job
  }

  retryByIdentifier(tableIdentifier: string): TabularSyncJobRecord | null {
    const job = this.eventStore?.retryJob(tableIdentifier) || null
    this.requestDurableDrain()
    return job
  }

  private createTimer(
    tableIdentifier: string,
    entry: PendingSyncEntry,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(async () => {
      if (this.pendingSyncs.get(tableIdentifier) !== entry) {
        return
      }
      // Remove the debounced batch before execution. Notifications received
      // while it runs create a distinct trailing batch, which is serialized by
      // runTableSerial rather than being lost or allowed to overlap.
      this.pendingSyncs.delete(tableIdentifier)
      this.refreshRuntime()
      const metric = this.getOrCreateMetric(tableIdentifier)
      const startedAt = new Date().toISOString()
      this.totalExecutions++
      metric.executions++
      metric.lastStartedAt = startedAt
      let executionSuccess = false

      try {
        const result = await this.runTableSerial(tableIdentifier, () =>
          this.executeBridgeSync({
            tableIdentifier,
            mode: entry.mode,
            dirtyNodeIds: [...entry.dirtyNodeIds],
            forceFull: entry.forceFull,
            revision: entry.revision,
          }),
        )
        this.assertSyncSucceeded(result)

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
        metric.pending =
          this.pendingSyncs.has(tableIdentifier) ||
          this.tableExecutionTails.has(tableIdentifier)
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
    if (this.disposed) {
      return
    }
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
        this.attributeTypeRepository,
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

function normalizeDirtyNodeIds(
  value?: string | readonly string[],
): string[] {
  const values = typeof value === 'string' ? [value] : value ?? []
  return [...new Set(values.map((nodeId) => nodeId.trim()).filter(Boolean))]
}

function resolveMaxConcurrentTables(configured?: number): number {
  const environmentValue = Number.parseInt(
    process.env.TABULAR_SYNC_MAX_CONCURRENCY ?? '',
    10,
  )
  const candidate = configured ?? environmentValue
  if (!Number.isFinite(candidate) || candidate < 1) {
    return 2
  }
  return Math.min(16, Math.floor(candidate))
}
