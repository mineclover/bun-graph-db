import {
  createExcelMirrorConfig,
  type ExcelMirrorConfig,
  type ExcelTableMirrorRule,
} from './ExcelWorkbookConfig.js'

export class ExcelTableMappingRegistry {
  private readonly config: Required<ExcelMirrorConfig>

  constructor(config: ExcelMirrorConfig) {
    this.config = createExcelMirrorConfig(config)
  }

  getWorkbookPath(): string {
    return this.config.workbookPath
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

  getRule(tableIdentifier: string): ExcelTableMirrorRule | null {
    return (
      this.config.tables.find((rule) => rule.tableIdentifier === tableIdentifier) ||
      null
    )
  }

  isTableEnabled(tableIdentifier: string): boolean {
    const rule = this.getRule(tableIdentifier)
    return rule?.enabled === true
  }

  getSheetName(tableIdentifier: string): string | null {
    const rule = this.getRule(tableIdentifier)
    if (!rule || rule.enabled !== true) {
      return null
    }

    return rule.sheetName || tableIdentifier
  }

  listEnabledTables(): ExcelTableMirrorRule[] {
    return this.config.tables.filter((rule) => rule.enabled === true)
  }
}
