import { SheetSyncDiffService } from '../SheetSyncDiff.js'
import type {
  ResolvedSyncTargetSelection,
  TabularSyncTargetRegistry,
} from '../TabularSyncTargetRegistry.js'
import type { ExcelSheetSchema, ExcelTableRow } from '../types/ExcelRowSchema.js'
import type {
  TabularDestinationGateway,
  TabularWritePlan,
} from '../gateways/TabularDestinationGateway.js'
import type {
  PlanTabularSyncInput,
  TabularSyncPlanner,
} from './TabularSyncPlanner.js'

export interface TabularSyncExecutionMetrics {
  mode: 'full' | 'incremental'
  remoteReadSkipped: boolean
  writeSkipped: boolean
  previousRowCount: number
  nextRowCount: number
  remoteReadMs: number
  planningMs: number
  writeMs: number
}

export interface TabularSyncResult {
  synced: boolean
  selection?: ResolvedSyncTargetSelection
  reason?: string
  diffSummary?: {
    added: number
    removed: number
    changed: number
    unchanged: number
  }
  metrics?: TabularSyncExecutionMetrics
}

export interface IncrementalTabularSyncInput extends PlanTabularSyncInput {
  /** The complete dirty set for this coalesced revision. `nodes` contains only
   * dirty IDs that still exist; missing IDs are treated as deletions. */
  dirtyNodeIds: readonly string[]
  revision?: number
}

interface SuccessfulSyncSnapshot {
  schema: ExcelSheetSchema
  rows: ExcelTableRow[]
  primaryKeyColumn: string
  revision?: number
}

interface IncrementalDestinationGateway extends TabularDestinationGateway {
  supportsIncrementalWrite(
    selection: ResolvedSyncTargetSelection,
  ): boolean | Promise<boolean>
}

export class TabularSyncService {
  private readonly snapshots = new Map<string, SuccessfulSyncSnapshot>()
  private readonly diffService = new SheetSyncDiffService()
  private readonly destinationTails = new Map<string, Promise<void>>()

  constructor(
    private readonly registry: TabularSyncTargetRegistry,
    private readonly planner: TabularSyncPlanner,
    private readonly gateways: TabularDestinationGateway[],
  ) {}

  supportsIdentifier(tableIdentifier: string): boolean {
    return this.registry.resolve(tableIdentifier) !== null
  }

  async preview(input: PlanTabularSyncInput) {
    const selection = this.registry.resolve(input.tableIdentifier)
    if (!selection) {
      return null
    }

    const gateway = this.resolveGateway(selection)
    const previousRows = await gateway.readRows(selection)

    return this.planner.plan({
      ...input,
      previousRows,
    })
  }

  async sync(input: PlanTabularSyncInput): Promise<TabularSyncResult> {
    const selection = this.registry.resolve(input.tableIdentifier)
    if (!selection) {
      return this.noRouteResult()
    }

    return await this.runDestinationSerial(selection, () =>
      this.syncSelection(input, selection),
    )
  }

  private async syncSelection(
    input: PlanTabularSyncInput,
    selection: ResolvedSyncTargetSelection,
  ): Promise<TabularSyncResult> {
    const gateway = this.resolveGateway(selection)
    const readStartedAt = performance.now()
    const previousRows = await gateway.readRows(selection)
    const remoteReadMs = performance.now() - readStartedAt
    const planningStartedAt = performance.now()
    const plan = this.planner.plan({
      ...input,
      previousRows,
    })
    const planningMs = performance.now() - planningStartedAt

    if (!plan) {
      return this.noRouteResult()
    }

    const writeStartedAt = performance.now()
    await gateway.writeSheet(plan)
    const writeMs = performance.now() - writeStartedAt
    this.rememberSuccessfulPlan(plan, input.tableIdentifier)

    return this.toSyncResult(plan, {
      mode: 'full',
      remoteReadSkipped: false,
      writeSkipped: false,
      previousRowCount: previousRows.length,
      nextRowCount: plan.rows.length,
      remoteReadMs,
      planningMs,
      writeMs,
    })
  }

  /**
   * Applies dirty rows against the last successful in-process snapshot. `null`
   * means the caller must rebuild a full local snapshot and re-read the remote
   * destination. Failed writes are deliberately propagated so the durable job
   * runner retains its existing retry/backoff behavior.
   */
  async syncIncremental(
    input: IncrementalTabularSyncInput,
  ): Promise<TabularSyncResult | null> {
    const selection = this.registry.resolve(input.tableIdentifier)
    if (!selection) {
      return this.noRouteResult()
    }

    return await this.runDestinationSerial(selection, () =>
      this.syncIncrementalSelection(input, selection),
    )
  }

  private async syncIncrementalSelection(
    input: IncrementalTabularSyncInput,
    selection: ResolvedSyncTargetSelection,
  ): Promise<TabularSyncResult | null> {
    const gateway = this.resolveGateway(selection)
    if (!(await this.supportsIncrementalWrite(gateway, selection))) {
      return null
    }

    const snapshotKey = this.snapshotKey(selection, input.tableIdentifier)
    const snapshot = this.snapshots.get(snapshotKey)
    if (!snapshot) {
      return null
    }

    const planningStartedAt = performance.now()
    const partialPlan = this.planner.plan({
      ...input,
      previousRows: [],
    })
    if (
      !partialPlan ||
      snapshot.primaryKeyColumn !== selection.route.primaryKeyColumn ||
      !sameSchema(snapshot.schema, partialPlan.schema)
    ) {
      return null
    }

    const nextRows = mergeDirtyRows(
      snapshot.rows,
      partialPlan.rows,
      input.dirtyNodeIds,
      snapshot.primaryKeyColumn,
    )
    if (!nextRows) {
      return null
    }

    const diff = this.diffService.diffRows(
      snapshot.rows,
      nextRows,
      snapshot.primaryKeyColumn,
    )
    const plan: TabularWritePlan = {
      ...partialPlan,
      previousRows: snapshot.rows,
      rows: nextRows,
      diff,
      metadataUpdate: {
        ...partialPlan.metadataUpdate,
        tableRows: partialPlan.metadataUpdate.tableRows.map((row) => ({
          ...row,
          rowCount: nextRows.length,
        })),
      },
    }
    const planningMs = performance.now() - planningStartedAt
    const writeSkipped = diff.rows.length === 0
    let writeMs = 0

    if (!writeSkipped) {
      const writeStartedAt = performance.now()
      await gateway.writeSheet(plan)
      writeMs = performance.now() - writeStartedAt
    }

    this.snapshots.set(snapshotKey, {
      schema: plan.schema,
      rows: plan.rows,
      primaryKeyColumn: selection.route.primaryKeyColumn,
      revision: input.revision,
    })

    return this.toSyncResult(plan, {
      mode: 'incremental',
      remoteReadSkipped: true,
      writeSkipped,
      previousRowCount: snapshot.rows.length,
      nextRowCount: nextRows.length,
      remoteReadMs: 0,
      planningMs,
      writeMs,
    })
  }

  private rememberSuccessfulPlan(
    plan: TabularWritePlan,
    tableIdentifier: string,
  ): void {
    this.snapshots.set(this.snapshotKey(plan.selection, tableIdentifier), {
      schema: plan.schema,
      rows: plan.rows,
      primaryKeyColumn: plan.selection.route.primaryKeyColumn,
    })
  }

  private async supportsIncrementalWrite(
    gateway: TabularDestinationGateway,
    selection: ResolvedSyncTargetSelection,
  ): Promise<boolean> {
    if (!('supportsIncrementalWrite' in gateway)) {
      return false
    }
    const candidate = gateway as IncrementalDestinationGateway
    return await candidate.supportsIncrementalWrite(selection)
  }

  private snapshotKey(
    selection: ResolvedSyncTargetSelection,
    tableIdentifier: string,
  ): string {
    return `${selection.target.id}\u0000${selection.sheetName}\u0000${tableIdentifier}`
  }

  private noRouteResult(): TabularSyncResult {
    return {
      synced: false,
      reason: 'No enabled tabular sync route matched the table identifier.',
    }
  }

  private toSyncResult(
    plan: TabularWritePlan,
    metrics: TabularSyncExecutionMetrics,
  ): TabularSyncResult {
    return {
      synced: true,
      selection: plan.selection,
      diffSummary: {
        added: plan.diff.added,
        removed: plan.diff.removed,
        changed: plan.diff.changed,
        unchanged: plan.diff.unchanged,
      },
      metrics,
    }
  }

  /** Serializes read/plan/write cycles that share one physical destination.
   * Different workbooks and different Google sheets may still use the hook's
   * bounded cross-table concurrency. */
  private async runDestinationSerial<T>(
    selection: ResolvedSyncTargetSelection,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = this.destinationKey(selection)
    const previous = this.destinationTails.get(key) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    this.destinationTails.set(key, current)

    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.destinationTails.get(key) === current) {
        this.destinationTails.delete(key)
      }
    }
  }

  private destinationKey(selection: ResolvedSyncTargetSelection): string {
    if (selection.target.kind === 'excel-file') {
      return `excel-file:${selection.target.workbookPath}`
    }
    return `google-sheets:${selection.target.spreadsheetId}:${selection.sheetName}`
  }

  private resolveGateway(
    selection: ResolvedSyncTargetSelection,
  ): TabularDestinationGateway {
    const gateway = this.gateways.find((candidate) =>
      candidate.supports(selection),
    )

    if (!gateway) {
      throw new Error(
        `No tabular destination gateway is registered for target kind '${selection.target.kind}'.`,
      )
    }

    return gateway
  }
}

function sameSchema(
  left: ExcelSheetSchema,
  right: ExcelSheetSchema,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function mergeDirtyRows(
  previousRows: readonly ExcelTableRow[],
  dirtyRows: readonly ExcelTableRow[],
  dirtyNodeIds: readonly string[],
  primaryKeyColumn: string,
): ExcelTableRow[] | null {
  const dirtyIds = [...new Set(dirtyNodeIds.map(String))]
  const dirtyIdSet = new Set(dirtyIds)
  const dirtyRowsById = new Map<string, ExcelTableRow>()

  for (const row of dirtyRows) {
    const key = String(row[primaryKeyColumn] ?? '')
    if (!key || !dirtyIdSet.has(key) || dirtyRowsById.has(key)) {
      return null
    }
    dirtyRowsById.set(key, row)
  }

  const previousIds = new Set<string>()
  const nextRows: ExcelTableRow[] = []
  for (const previousRow of previousRows) {
    const key = String(previousRow[primaryKeyColumn] ?? '')
    if (!key || previousIds.has(key)) {
      return null
    }
    previousIds.add(key)

    if (!dirtyIdSet.has(key)) {
      nextRows.push(previousRow)
      continue
    }

    const replacement = dirtyRowsById.get(key)
    if (replacement) {
      nextRows.push(replacement)
    }
  }

  for (const dirtyId of dirtyIds) {
    if (previousIds.has(dirtyId)) {
      continue
    }
    const added = dirtyRowsById.get(dirtyId)
    if (added) {
      nextRows.push(added)
    }
  }

  return nextRows
}
