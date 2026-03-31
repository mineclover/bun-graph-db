import type { SheetDiffSummary } from '../SheetSyncDiff.js'
import type { ResolvedSyncTargetSelection } from '../TabularSyncTargetRegistry.js'
import type {
  ExcelColumnSchema,
  ExcelSheetSchema,
  ExcelTableRow,
  ExcelWorkbookMetaRow,
} from '../types/ExcelRowSchema.js'

export interface TabularMetadataUpdate {
  metadataSheetName: string
  schemaSheetName: string
  tableRows: ExcelWorkbookMetaRow[]
  schemaRows: Array<
    ExcelColumnSchema & {
      tableIdentifier: string
      sheetName: string
    }
  >
}

export interface TabularWritePlan {
  selection: ResolvedSyncTargetSelection
  schema: ExcelSheetSchema
  previousRows: ExcelTableRow[]
  rows: ExcelTableRow[]
  diff: SheetDiffSummary
  metadataUpdate: TabularMetadataUpdate
}

export interface TabularDestinationGateway {
  supports(selection: ResolvedSyncTargetSelection): boolean
  readRows(selection: ResolvedSyncTargetSelection): Promise<ExcelTableRow[]>
  writeSheet(plan: TabularWritePlan): Promise<void>
}
