export type TabularSyncTargetKind = 'excel-file' | 'google-sheets'

export interface BaseTabularSyncTargetConfig {
  id: string
  kind: TabularSyncTargetKind
  displayName?: string
  enabled?: boolean
}

export interface ExcelFileTargetConfig extends BaseTabularSyncTargetConfig {
  kind: 'excel-file'
  workbookPath: string
}

export interface GoogleSheetsTargetConfig extends BaseTabularSyncTargetConfig {
  kind: 'google-sheets'
  spreadsheetId?: string
  spreadsheetUrl?: string
  authMode?: 'service-account' | 'oauth'
  accessMode?: 'google-workspace-cli' | 'google-drive-api'
  transport?: 'google-tools-http' | 'google-tools-submodule' | 'pipe-builder-table-adapter'
  cliCommand?: string
  adapterKind?: 'google-tools-submodule'
  googleToolsSubmodulePath?: string
  googleToolsBaseUrl?: string
  pipeBuilderWorkspacePath?: string
  tableAdapterPackagePath?: string
  serviceAccountKeyFile?: string
  oauthTokenFile?: string
}

export type TabularSyncTargetConfig =
  | ExcelFileTargetConfig
  | GoogleSheetsTargetConfig

export interface TableSyncRouteConfig {
  tableIdentifier: string
  targetId: string
  enabled?: boolean
  sheetName?: string
  sheetNameTemplate?: string
  primaryKeyColumn?: string
  diffMode?: 'summary' | 'row'
}

export interface TabularSyncConfig {
  defaultTargetId?: string
  targets: TabularSyncTargetConfig[]
  routes: TableSyncRouteConfig[]
  metadataSheetName?: string
  schemaSheetName?: string
  syncDebounceMs?: number
  rewriteMode?: 'table-sheet-rewrite'
}

export interface ResolvedTableSyncRoute extends TableSyncRouteConfig {
  enabled: boolean
  primaryKeyColumn: string
  diffMode: 'summary' | 'row'
}

export interface ResolvedTabularSyncConfig {
  defaultTargetId?: string
  targets: Required<TabularSyncTargetConfig>[]
  routes: ResolvedTableSyncRoute[]
  metadataSheetName: string
  schemaSheetName: string
  syncDebounceMs: number
  rewriteMode: 'table-sheet-rewrite'
}

export function createTabularSyncConfig(
  config: TabularSyncConfig,
): ResolvedTabularSyncConfig {
  const targets = config.targets.map((target) => ({
    displayName: target.displayName || target.id,
    enabled: target.enabled ?? true,
    ...(target.kind === 'excel-file'
      ? target
        : {
          ...target,
          authMode: target.authMode || 'service-account',
          accessMode: target.accessMode || 'google-drive-api',
          transport: target.transport || 'google-tools-http',
          cliCommand: target.cliCommand || 'gwk',
          googleToolsBaseUrl: target.googleToolsBaseUrl || 'http://localhost:5678',
        }),
  })) as Required<TabularSyncTargetConfig>[]

  return {
    defaultTargetId: config.defaultTargetId,
    targets,
    routes: config.routes.map((route) => ({
      enabled: route.enabled ?? true,
      primaryKeyColumn: route.primaryKeyColumn || '__node_id',
      diffMode: route.diffMode || 'summary',
      ...route,
    })),
    metadataSheetName: config.metadataSheetName || '_tables',
    schemaSheetName: config.schemaSheetName || '_schema',
    syncDebounceMs: config.syncDebounceMs ?? 250,
    rewriteMode: config.rewriteMode || 'table-sheet-rewrite',
  }
}
