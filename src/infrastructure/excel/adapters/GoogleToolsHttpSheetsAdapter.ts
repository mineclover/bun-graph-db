import type {
  GoogleSheetsCellValue,
  GoogleSheetsPatchCapableAdapter,
} from './GoogleSheetsAdapter.js'
import type { SheetRowDiff } from '../SheetSyncDiff.js'
import type { ExcelSheetSchema } from '../types/ExcelRowSchema.js'

export interface GoogleToolsHttpSheetsAdapterOptions {
  baseUrl: string
  headers?: Record<string, string>
}

export class GoogleToolsHttpSheetsAdapter implements GoogleSheetsPatchCapableAdapter {
  constructor(private readonly options: GoogleToolsHttpSheetsAdapterOptions) {}

  private async getSpreadsheetInfo(spreadsheetId: string): Promise<{
    id?: string
    title?: string
    sheets?: Array<{ title?: string }>
  }> {
    const url = new URL(`/sheets/${encodeURIComponent(spreadsheetId)}`, this.options.baseUrl)
    const response = await fetch(url, {
      headers: this.options.headers,
    })

    if (!response.ok) {
      throw new Error(
        `google-tools HTTP getSpreadsheetInfo failed with status ${response.status}`,
      )
    }

    const payload = (await response.json()) as {
      data?: {
        id?: string
        title?: string
        sheets?: Array<{ title?: string }>
      }
    }

    return payload.data || {}
  }

  private async resolveSheetName(
    spreadsheetId: string,
    desiredSheetName: string,
  ): Promise<string> {
    const info = await this.getSpreadsheetInfo(spreadsheetId)
    const availableTitles = (info.sheets || [])
      .map((sheet) => sheet.title)
      .filter((title): title is string => Boolean(title))

    if (availableTitles.includes(desiredSheetName)) {
      return desiredSheetName
    }

    return availableTitles[0] || desiredSheetName
  }

  async readSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<{ values: GoogleSheetsCellValue[][] }> {
    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const url = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/sheets/${encodeURIComponent(resolvedSheetName)}`,
      this.options.baseUrl,
    )

    const response = await fetch(url, {
      headers: this.options.headers,
    })

    if (!response.ok) {
      throw new Error(`google-tools HTTP readSheet failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      data?: {
        values?: GoogleSheetsCellValue[][]
      }
    }

    return {
      values: payload.data?.values || [],
    }
  }

  async replaceSheet(
    spreadsheetId: string,
    sheetName: string,
    values: GoogleSheetsCellValue[][],
  ): Promise<void> {
    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const range = `${resolvedSheetName}!A1`
    const clearUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/values`,
      this.options.baseUrl,
    )
    clearUrl.searchParams.set('range', range)

    const clearResponse = await fetch(clearUrl, {
      method: 'DELETE',
      headers: this.options.headers,
    })

    if (!clearResponse.ok) {
      throw new Error(`google-tools HTTP clear failed with status ${clearResponse.status}`)
    }

    const writeUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/values`,
      this.options.baseUrl,
    )

    const writeResponse = await fetch(writeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.headers || {}),
      },
      body: JSON.stringify({
        range,
        values,
      }),
    })

    if (!writeResponse.ok) {
      throw new Error(`google-tools HTTP write failed with status ${writeResponse.status}`)
    }
  }

  async patchSheet(
    spreadsheetId: string,
    sheetName: string,
    schema: ExcelSheetSchema,
    previousRows: Array<Record<string, GoogleSheetsCellValue>>,
    nextRows: Array<Record<string, GoogleSheetsCellValue>>,
    rowDiffs: SheetRowDiff[],
  ): Promise<boolean> {
    if (rowDiffs.some((rowDiff) => rowDiff.kind === 'removed')) {
      return false
    }

    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const orderedColumns = [...schema.columns].sort((a, b) => a.order - b.order)
    const previousIndexByKey = new Map(
      previousRows.map((row, index) => [String(row.__node_id ?? ''), index]),
    )
    const batchData: Array<{ range: string; values: GoogleSheetsCellValue[][] }> = []
    let addedRowOffset = 0

    for (const rowDiff of rowDiffs) {
      const nextRow = nextRows.find(
        (row) => String(row.__node_id ?? '') === rowDiff.key,
      )
      if (!nextRow) {
        continue
      }

      if (rowDiff.kind === 'changed') {
        const previousIndex = previousIndexByKey.get(rowDiff.key)
        if (previousIndex === undefined) {
          return false
        }
        const rowNumber = previousIndex + 2
        batchData.push({
          range: `'${resolvedSheetName}'!A${rowNumber}`,
          values: [
            orderedColumns.map((column) => nextRow[column.columnName] ?? null),
          ],
        })
        continue
      }

      if (rowDiff.kind === 'added') {
        const rowNumber = previousRows.length + addedRowOffset + 2
        addedRowOffset += 1
        batchData.push({
          range: `'${resolvedSheetName}'!A${rowNumber}`,
          values: [
            orderedColumns.map((column) => nextRow[column.columnName] ?? null),
          ],
        })
      }
    }

    if (batchData.length === 0) {
      return true
    }

    const batchUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/batch`,
      this.options.baseUrl,
    )
    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.headers || {}),
      },
      body: JSON.stringify({
        data: batchData,
      }),
    })

    if (!response.ok) {
      throw new Error(`google-tools HTTP batch patch failed with status ${response.status}`)
    }

    return true
  }
}
