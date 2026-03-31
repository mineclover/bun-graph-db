import type { GoogleSheetsAdapterLike } from './GoogleSheetsAdapter.js'

export interface GoogleToolsSheetInfo {
  sheetId?: number
  title?: string
  rowCount?: number
  columnCount?: number
}

export interface GoogleToolsSpreadsheetInfo {
  id: string
  title?: string
  sheets: GoogleToolsSheetInfo[]
}

export interface GoogleToolsSheetsClientLike {
  getInfo(spreadsheetId: string): Promise<GoogleToolsSpreadsheetInfo>
  readSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<{
    values: Array<Array<string | number | boolean | null>>
  }>
  clear(spreadsheetId: string, range: string): Promise<unknown>
  write(
    spreadsheetId: string,
    range: string,
    values: Array<Array<string | number | boolean | null>>,
  ): Promise<unknown>
}

export class GoogleToolsSheetsAdapter implements GoogleSheetsAdapterLike {
  constructor(private readonly client: GoogleToolsSheetsClientLike) {}

  async getSpreadsheetInfo(spreadsheetId: string) {
    return this.client.getInfo(spreadsheetId)
  }

  async readSheet(spreadsheetId: string, sheetName: string) {
    return this.client.readSheet(spreadsheetId, sheetName)
  }

  async replaceSheet(
    spreadsheetId: string,
    sheetName: string,
    values: Array<Array<string | number | boolean | null>>,
  ) {
    const info = await this.client.getInfo(spreadsheetId)
    const matchedSheet = info.sheets.find((sheet) => sheet.title === sheetName)
    const columnCount = Math.max(...values.map((row) => row.length), 1)
    const rowCount = Math.max(values.length, matchedSheet?.rowCount || 1)
    const clearRange = `'${sheetName}'!A1:${this.columnToLetter(columnCount)}${rowCount}`

    await this.client.clear(spreadsheetId, clearRange)
    await this.client.write(spreadsheetId, `'${sheetName}'!A1`, values)
  }

  private columnToLetter(column: number): string {
    let result = ''
    let current = column

    while (current > 0) {
      current -= 1
      result = String.fromCharCode(65 + (current % 26)) + result
      current = Math.floor(current / 26)
    }

    return result || 'A'
  }
}
