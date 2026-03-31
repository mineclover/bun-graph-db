import type { GoogleSheetsAdapterLike, GoogleSheetsCellValue } from './GoogleSheetsAdapter.js'

interface ExternalCell {
  value: unknown
}

interface ExternalRow {
  cells: ExternalCell[]
}

interface ExternalTable {
  rows: ExternalRow[]
}

interface ExternalGoogleSheetsAdapterLike {
  read(
    spreadsheetId: string,
    options?: { sheetName?: string },
  ): Promise<ExternalTable>
  save(
    table: ExternalTable,
    options?: { sourceId?: string; sheetName?: string },
  ): Promise<void>
}

export class PipeBuilderGoogleSheetsAdapter implements GoogleSheetsAdapterLike {
  constructor(private readonly adapter: ExternalGoogleSheetsAdapterLike) {}

  async readSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<{ values: GoogleSheetsCellValue[][] }> {
    const table = await this.adapter.read(spreadsheetId, { sheetName })
    return {
      values: table.rows.map((row) =>
        row.cells.map((cell) => this.normalizeCell(cell.value)),
      ),
    }
  }

  async replaceSheet(
    spreadsheetId: string,
    sheetName: string,
    values: GoogleSheetsCellValue[][],
  ): Promise<void> {
    const table: ExternalTable = {
      rows: values.map((row, rowIndex) => ({
        cells: row.map((value) => ({
          value,
          isHeader: rowIndex === 0,
        })),
      })),
    }

    await this.adapter.save(table, {
      sourceId: spreadsheetId,
      sheetName,
    })
  }

  private normalizeCell(value: unknown): GoogleSheetsCellValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }

    if (value === undefined) {
      return null
    }

    return JSON.stringify(value)
  }
}
