import type {
  TabularSyncConfig,
  TabularSyncTargetConfig,
} from './TabularSyncConfig.js'
import type { ResolvedSyncTargetSelection } from './TabularSyncTargetRegistry.js'
import { TabularSyncTargetRegistry } from './TabularSyncTargetRegistry.js'
import { createTabularDestinationGateways } from './factories/TabularDestinationGatewayFactory.js'
import type { TabularDestinationGateway } from './gateways/TabularDestinationGateway.js'

export interface TabularSyncRoutePreview {
  tableIdentifier: string
  targetId: string
  targetKind: TabularSyncTargetConfig['kind']
  sheetName: string
  enabled: boolean
}

export interface TabularSyncConnectionTestResult {
  tableIdentifier: string
  targetId: string
  targetKind: TabularSyncTargetConfig['kind']
  sheetName: string
  success: boolean
  rowCount: number
  message: string
}

export class TabularSyncConnectionInspector {
  constructor(
    private readonly gateways: TabularDestinationGateway[] = createTabularDestinationGateways(),
  ) {}

  preview(config: TabularSyncConfig): TabularSyncRoutePreview[] {
    const registry = new TabularSyncTargetRegistry(config)

    return config.routes.map((route) => {
      const selection = registry.resolve(route.tableIdentifier)
      const target = selection?.target || registry.getTarget(route.targetId)

      return {
        tableIdentifier: route.tableIdentifier,
        targetId: route.targetId,
        targetKind: target?.kind || 'excel-file',
        sheetName: selection?.sheetName || route.sheetName || route.tableIdentifier,
        enabled: route.enabled !== false && Boolean(target?.enabled ?? true),
      }
    })
  }

  async test(config: TabularSyncConfig): Promise<TabularSyncConnectionTestResult[]> {
    const registry = new TabularSyncTargetRegistry(config)
    const results: TabularSyncConnectionTestResult[] = []

    for (const route of config.routes) {
      const selection = registry.resolve(route.tableIdentifier)

      if (!selection) {
        results.push({
          tableIdentifier: route.tableIdentifier,
          targetId: route.targetId,
          targetKind: 'excel-file',
          sheetName: route.sheetName || route.tableIdentifier,
          success: false,
          rowCount: 0,
          message: 'No enabled route/target could be resolved for this table.',
        })
        continue
      }

      const gateway = this.resolveGateway(selection)
      if (!gateway) {
        results.push({
          tableIdentifier: selection.route.tableIdentifier,
          targetId: selection.target.id,
          targetKind: selection.target.kind,
          sheetName: selection.sheetName,
          success: false,
          rowCount: 0,
          message: `No gateway is registered for target kind '${selection.target.kind}'.`,
        })
        continue
      }

      if (selection.target.kind === 'excel-file') {
        results.push({
          tableIdentifier: selection.route.tableIdentifier,
          targetId: selection.target.id,
          targetKind: selection.target.kind,
          sheetName: selection.sheetName,
          success: false,
          rowCount: 0,
          message: 'Excel file sync is preview-only until ExcelFileGateway.writeSheet is implemented.',
        })
        continue
      }

      try {
        const rows = await gateway.readRows(selection)
        results.push({
          tableIdentifier: selection.route.tableIdentifier,
          targetId: selection.target.id,
          targetKind: selection.target.kind,
          sheetName: selection.sheetName,
          success: true,
          rowCount: rows.length,
          message: `Read succeeded (${rows.length} rows).`,
        })
      } catch (error) {
        results.push({
          tableIdentifier: selection.route.tableIdentifier,
          targetId: selection.target.id,
          targetKind: selection.target.kind,
          sheetName: selection.sheetName,
          success: false,
          rowCount: 0,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  private resolveGateway(
    selection: ResolvedSyncTargetSelection,
  ): TabularDestinationGateway | null {
    return this.gateways.find((gateway) => gateway.supports(selection)) || null
  }
}
