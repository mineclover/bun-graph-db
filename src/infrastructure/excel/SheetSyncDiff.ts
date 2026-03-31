import type { ExcelTableRow } from './types/ExcelRowSchema.js'

export interface SheetRowDiff {
  kind: 'added' | 'removed' | 'changed'
  key: string
  before?: ExcelTableRow
  after?: ExcelTableRow
  changedColumns?: string[]
}

export interface SheetDiffSummary {
  added: number
  removed: number
  changed: number
  unchanged: number
  rows: SheetRowDiff[]
}

export class SheetSyncDiffService {
  diffRows(
    previousRows: ExcelTableRow[],
    nextRows: ExcelTableRow[],
    primaryKeyColumn: string = '__node_id',
  ): SheetDiffSummary {
    const previousByKey = new Map(
      previousRows.map((row) => [String(row[primaryKeyColumn] ?? ''), row]),
    )
    const nextByKey = new Map(
      nextRows.map((row) => [String(row[primaryKeyColumn] ?? ''), row]),
    )

    const rows: SheetRowDiff[] = []
    let unchanged = 0

    for (const [key, previousRow] of previousByKey) {
      const nextRow = nextByKey.get(key)
      if (!nextRow) {
        rows.push({ kind: 'removed', key, before: previousRow })
        continue
      }

      const changedColumns = this.getChangedColumns(previousRow, nextRow)
      if (changedColumns.length === 0) {
        unchanged += 1
        continue
      }

      rows.push({
        kind: 'changed',
        key,
        before: previousRow,
        after: nextRow,
        changedColumns,
      })
    }

    for (const [key, nextRow] of nextByKey) {
      if (!previousByKey.has(key)) {
        rows.push({ kind: 'added', key, after: nextRow })
      }
    }

    return {
      added: rows.filter((row) => row.kind === 'added').length,
      removed: rows.filter((row) => row.kind === 'removed').length,
      changed: rows.filter((row) => row.kind === 'changed').length,
      unchanged,
      rows,
    }
  }

  private getChangedColumns(
    previousRow: ExcelTableRow,
    nextRow: ExcelTableRow,
  ): string[] {
    const keys = new Set([
      ...Object.keys(previousRow),
      ...Object.keys(nextRow),
    ])

    return [...keys].filter(
      (key) => this.normalizeValue(previousRow[key]) !== this.normalizeValue(nextRow[key]),
    )
  }

  private normalizeValue(
    value: ExcelTableRow[string] | undefined,
  ): string {
    return value === null || value === undefined ? '' : String(value)
  }
}
