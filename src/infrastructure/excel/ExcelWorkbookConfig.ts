export interface ExcelTableMirrorRule {
  tableIdentifier: string
  sheetName?: string
  enabled?: boolean
}

export interface ExcelMirrorConfig {
  workbookPath: string
  tables: ExcelTableMirrorRule[]
  metadataSheetName?: string
  schemaSheetName?: string
  syncDebounceMs?: number
  rewriteMode?: 'table-sheet-rewrite'
}

export const DEFAULT_EXCEL_MIRROR_CONFIG: Omit<
  ExcelMirrorConfig,
  'workbookPath' | 'tables'
> = {
  metadataSheetName: '_tables',
  schemaSheetName: '_schema',
  syncDebounceMs: 250,
  rewriteMode: 'table-sheet-rewrite',
}

export function createExcelMirrorConfig(
  config: ExcelMirrorConfig,
): Required<ExcelMirrorConfig> {
  const metadataSheetName =
    config.metadataSheetName ?? DEFAULT_EXCEL_MIRROR_CONFIG.metadataSheetName ?? '_tables'
  const schemaSheetName =
    config.schemaSheetName ?? DEFAULT_EXCEL_MIRROR_CONFIG.schemaSheetName ?? '_schema'
  const syncDebounceMs =
    config.syncDebounceMs ?? DEFAULT_EXCEL_MIRROR_CONFIG.syncDebounceMs ?? 250
  const rewriteMode =
    config.rewriteMode ?? DEFAULT_EXCEL_MIRROR_CONFIG.rewriteMode ?? 'table-sheet-rewrite'

  return {
    ...DEFAULT_EXCEL_MIRROR_CONFIG,
    ...config,
    tables: config.tables.map((rule) => ({
      enabled: true,
      ...rule,
    })),
    metadataSheetName,
    schemaSheetName,
    syncDebounceMs,
    rewriteMode,
  }
}
