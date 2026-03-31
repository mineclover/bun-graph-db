import type { SheetRowDiff } from '../SheetSyncDiff.js'
import type { ExcelSheetSchema } from '../types/ExcelRowSchema.js'

export type GoogleSheetsCellValue = string | number | boolean | null

export interface GoogleSheetsReadResult {
  values: GoogleSheetsCellValue[][]
}

export interface GoogleSheetsAdapterLike {
  readSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<GoogleSheetsReadResult>
  replaceSheet(
    spreadsheetId: string,
    sheetName: string,
    values: GoogleSheetsCellValue[][],
  ): Promise<void>
}

export interface GoogleSheetsPatchCapableAdapter extends GoogleSheetsAdapterLike {
  patchSheet(
    spreadsheetId: string,
    sheetName: string,
    schema: ExcelSheetSchema,
    previousRows: Array<Record<string, GoogleSheetsCellValue>>,
    nextRows: Array<Record<string, GoogleSheetsCellValue>>,
    rowDiffs: SheetRowDiff[],
  ): Promise<boolean>
}
