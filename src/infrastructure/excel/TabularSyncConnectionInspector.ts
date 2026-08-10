import type {
  TabularSyncConfig,
  TabularSyncTargetConfig,
} from './TabularSyncConfig.js'
import type { ResolvedSyncTargetSelection } from './TabularSyncTargetRegistry.js'
import { TabularSyncTargetRegistry } from './TabularSyncTargetRegistry.js'
import { createTabularDestinationGateways } from './factories/TabularDestinationGatewayFactory.js'
import { ExcelFileGateway } from './gateways/ExcelFileGateway.js'
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

      try {
        if (gateway instanceof ExcelFileGateway) {
          await gateway.verifyWritable(selection)
        }
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

  /**
   * Verifies the routes that would become live before a configuration is made
   * active.  This intentionally uses the destination gateways (rather than
   * validating target strings) so activation cannot silently accept an
   * unreachable spreadsheet or an unwritable Excel destination.
   */
  async assertReadyForActivation(config: TabularSyncConfig): Promise<void> {
    const registry = new TabularSyncTargetRegistry(config)
    const failures: TabularSyncConnectionTestResult[] = []

    for (const route of config.routes) {
      if (route.enabled === false) {
        continue
      }

      const selection = registry.resolve(route.tableIdentifier)
      if (!selection) {
        failures.push({
          tableIdentifier: route.tableIdentifier,
          targetId: route.targetId,
          targetKind: 'excel-file',
          sheetName: route.sheetName || route.tableIdentifier,
          success: false,
          rowCount: 0,
          message: 'No enabled route/target could be resolved for activation.',
        })
        continue
      }

      const gateway = this.resolveGateway(selection)
      if (!gateway) {
        failures.push({
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

      try {
        if (gateway instanceof ExcelFileGateway) {
          await gateway.verifyWritable(selection)
        }
        await gateway.readRows(selection)
      } catch (error) {
        failures.push({
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

    if (failures.length > 0) {
      const details = failures
        .map((failure) => `${failure.tableIdentifier} (${failure.targetId}): ${failure.message}`)
        .join('; ')
      throw new Error(`Tabular sync activation readiness check failed: ${details}`)
    }
  }

  private resolveGateway(
    selection: ResolvedSyncTargetSelection,
  ): TabularDestinationGateway | null {
    return this.gateways.find((gateway) => gateway.supports(selection)) || null
  }
}
