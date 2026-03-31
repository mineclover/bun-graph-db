import type { ExcelSheetSchema, ExcelTableRow } from './types/ExcelRowSchema.js'

export class SheetMatrixSerializer {
  toMatrix(
    schema: ExcelSheetSchema,
    rows: ExcelTableRow[],
  ): Array<Array<string | number | boolean | null>> {
    const orderedColumns = [...schema.columns].sort((a, b) => a.order - b.order)
    const header = orderedColumns.map((column) => column.columnName)
    const values = rows.map((row) =>
      orderedColumns.map((column) => row[column.columnName] ?? null),
    )

    return [header, ...values]
  }

  fromMatrix(
    matrix: Array<Array<string | number | boolean | null>>,
  ): ExcelTableRow[] {
    const [headerRow, ...dataRows] = matrix
    if (!headerRow || headerRow.length === 0) {
      return []
    }

    const headers = headerRow.map((cell) => String(cell ?? ''))

    return dataRows.map((dataRow) => {
      const row: ExcelTableRow = {}
      headers.forEach((header, index) => {
        row[header] = dataRow[index] ?? null
      })
      return row
    })
  }
}
