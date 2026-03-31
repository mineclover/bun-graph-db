export const DEFAULT_EXCEL_SYSTEM_COLUMNS = [
  '__node_id',
  '__title',
  '__content',
  '__description',
  '__created_at',
  '__updated_at',
] as const

export type ExcelSystemColumn = (typeof DEFAULT_EXCEL_SYSTEM_COLUMNS)[number]

export type ExcelColumnSourceType = 'system' | 'attribute'

export interface ExcelColumnSchema {
  columnName: string
  sourceType: ExcelColumnSourceType
  sourceKey: string
  dataType: string
  required: boolean
  searchable: boolean
  order: number
}

export interface ExcelSheetSchema {
  tableIdentifier: string
  sheetName: string
  columns: ExcelColumnSchema[]
}

export interface ExcelWorkbookMetaRow {
  tableIdentifier: string
  tableId?: string
  sheetName: string
  description?: string
  lastSyncedAt?: string
  rowCount?: number
}

export type ExcelTableRow = Record<string, string | number | boolean | null>
