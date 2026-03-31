import type {
  ResolvedSyncTargetSelection,
  TabularSyncTargetRegistry,
} from '../TabularSyncTargetRegistry.js'
import type { TabularDestinationGateway } from '../gateways/TabularDestinationGateway.js'
import type {
  PlanTabularSyncInput,
  TabularSyncPlanner,
} from './TabularSyncPlanner.js'

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
}

export class TabularSyncService {
  constructor(
    private readonly registry: TabularSyncTargetRegistry,
    private readonly planner: TabularSyncPlanner,
    private readonly gateways: TabularDestinationGateway[],
  ) {}

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
    const plan = await this.preview(input)
    if (!plan) {
      return {
        synced: false,
        reason: 'No enabled tabular sync route matched the table identifier.',
      }
    }

    const gateway = this.resolveGateway(plan.selection)
    await gateway.writeSheet(plan)

    return {
      synced: true,
      selection: plan.selection,
      diffSummary: {
        added: plan.diff.added,
        removed: plan.diff.removed,
        changed: plan.diff.changed,
        unchanged: plan.diff.unchanged,
      },
    }
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
