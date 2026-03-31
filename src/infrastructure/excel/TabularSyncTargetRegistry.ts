import {
  createTabularSyncConfig,
  type ResolvedTableSyncRoute,
  type ResolvedTabularSyncConfig,
  type TabularSyncConfig,
  type TabularSyncTargetConfig,
} from './TabularSyncConfig.js'
import { SheetNameResolver } from './SheetNameResolver.js'

export interface ResolvedSyncTargetSelection {
  target: Required<TabularSyncTargetConfig>
  route: ResolvedTableSyncRoute
  sheetName: string
}

export class TabularSyncTargetRegistry {
  private readonly config: ResolvedTabularSyncConfig
  private readonly sheetNameResolver = new SheetNameResolver()

  constructor(config: TabularSyncConfig) {
    this.config = createTabularSyncConfig(config)
  }

  getTarget(targetId: string): Required<TabularSyncTargetConfig> | null {
    return this.config.targets.find((target) => target.id === targetId) || null
  }

  listTargets(kind?: Required<TabularSyncTargetConfig>['kind']) {
    return kind
      ? this.config.targets.filter((target) => target.kind === kind)
      : this.config.targets
  }

  getRoute(tableIdentifier: string): ResolvedTableSyncRoute | null {
    return this.config.routes.find((route) => route.tableIdentifier === tableIdentifier) || null
  }

  resolve(tableIdentifier: string): ResolvedSyncTargetSelection | null {
    const route = this.getRoute(tableIdentifier)
    if (!route || route.enabled !== true) {
      return null
    }

    const target =
      this.getTarget(route.targetId) ||
      (this.config.defaultTargetId ? this.getTarget(this.config.defaultTargetId) : null)

    if (!target || target.enabled !== true) {
      return null
    }

    return {
      target,
      route,
      sheetName: this.sheetNameResolver.resolve({
        tableIdentifier,
        explicitSheetName: route.sheetName,
        sheetNameTemplate: route.sheetNameTemplate,
      }),
    }
  }

  getMetadataSheetName(): string {
    return this.config.metadataSheetName
  }

  getSchemaSheetName(): string {
    return this.config.schemaSheetName
  }

  getSyncDebounceMs(): number {
    return this.config.syncDebounceMs
  }

  getRewriteMode(): 'table-sheet-rewrite' {
    return this.config.rewriteMode
  }
}
