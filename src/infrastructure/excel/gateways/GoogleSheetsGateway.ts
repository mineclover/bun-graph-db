import type { ResolvedSyncTargetSelection } from '../TabularSyncTargetRegistry.js'
import { SheetMatrixSerializer } from '../SheetMatrixSerializer.js'
import type { ExcelTableRow } from '../types/ExcelRowSchema.js'
import type {
  GoogleSheetsAdapterLike,
  GoogleSheetsPatchCapableAdapter,
} from '../adapters/GoogleSheetsAdapter.js'
import type {
  TabularDestinationGateway,
  TabularWritePlan,
} from './TabularDestinationGateway.js'

export type GoogleSheetsAdapterResolver = (
  selection: ResolvedSyncTargetSelection,
) => Promise<GoogleSheetsAdapterLike | null>

export class GoogleSheetsGateway implements TabularDestinationGateway {
  private readonly matrixSerializer = new SheetMatrixSerializer()
  private readonly observedHeaders = new Map<string, string[]>()

  constructor(
    private readonly adapterOrResolver?:
      | GoogleSheetsAdapterLike
      | GoogleSheetsAdapterResolver,
  ) {}

  supports(selection: ResolvedSyncTargetSelection): boolean {
    return selection.target.kind === 'google-sheets'
  }

  /**
   * Incremental sync is only safe when the resolved adapter can apply a row
   * patch. The service falls back to its full remote-read path otherwise.
   */
  async supportsIncrementalWrite(
    selection: ResolvedSyncTargetSelection,
  ): Promise<boolean> {
    const spreadsheetId =
      selection.target.kind === 'google-sheets'
        ? selection.target.spreadsheetId
        : undefined
    // GoogleSheetsPatchCapableAdapter currently indexes rows by __node_id.
    // Custom primary keys must retain the full read/replace path.
    if (
      !spreadsheetId ||
      selection.route.primaryKeyColumn !== '__node_id' ||
      !this.observedHeaders.has(this.selectionKey(selection))
    ) {
      return false
    }

    const adapter = await this.resolveAdapter(selection)
    return adapter !== null && this.asPatchCapableAdapter(adapter) !== null
  }

  async readRows(
    selection: ResolvedSyncTargetSelection,
  ): Promise<ExcelTableRow[]> {
    const spreadsheetId =
      selection.target.kind === 'google-sheets'
        ? selection.target.spreadsheetId
        : undefined

    const adapter = await this.resolveAdapter(selection)
    if (!spreadsheetId) {
      throw new Error(
        `Google Sheets target '${selection.target.id}' is missing spreadsheetId.`,
      )
    }

    if (!adapter) {
      throw new Error(
        `Google Sheets target '${selection.target.id}' could not resolve an adapter.`,
      )
    }

    try {
      const result = await adapter.readSheet(spreadsheetId, selection.sheetName)
      this.rememberObservedHeader(selection, result.values)
      return this.matrixSerializer.fromMatrix(result.values)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Sheet not found')) {
        this.observedHeaders.delete(this.selectionKey(selection))
        return []
      }

      throw error
    }
  }

  async writeSheet(plan: TabularWritePlan): Promise<void> {
    const spreadsheetId =
      plan.selection.target.kind === 'google-sheets'
        ? plan.selection.target.spreadsheetId
        : undefined

    const adapter = await this.resolveAdapter(plan.selection)
    if (!adapter || !spreadsheetId) {
      throw new Error(
        'GoogleSheetsGateway is not configured. Provide a Google Sheets adapter and spreadsheetId.',
      )
    }

    const expectedHeader = [...plan.schema.columns]
      .sort((left, right) => left.order - right.order)
      .map((column) => column.columnName)
    const observedHeader = this.observedHeaders.get(
      this.selectionKey(plan.selection),
    )
    if (
      observedHeader !== undefined &&
      sameHeader(observedHeader, expectedHeader) &&
      plan.diff.rows.length === 0
    ) {
      return
    }
    const patchCapableAdapter = this.asPatchCapableAdapter(adapter)
    if (
      patchCapableAdapter &&
      observedHeader !== undefined &&
      sameHeader(observedHeader, expectedHeader)
    ) {
      const patched = await patchCapableAdapter.patchSheet(
        spreadsheetId,
        plan.selection.sheetName,
        plan.schema,
        plan.previousRows,
        plan.rows,
        plan.diff.rows,
      )

      if (patched) {
        this.observedHeaders.set(
          this.selectionKey(plan.selection),
          expectedHeader,
        )
        return
      }
    }

    const values = this.matrixSerializer.toMatrix(plan.schema, plan.rows)
    await adapter.replaceSheet(
      spreadsheetId,
      plan.selection.sheetName,
      values,
    )
    this.observedHeaders.set(this.selectionKey(plan.selection), expectedHeader)
  }

  private rememberObservedHeader(
    selection: ResolvedSyncTargetSelection,
    values: Array<Array<string | number | boolean | null>>,
  ): void {
    const header = values[0]
    const key = this.selectionKey(selection)
    if (!header || header.length === 0) {
      this.observedHeaders.delete(key)
      return
    }
    this.observedHeaders.set(
      key,
      header.map((value) => String(value ?? '')),
    )
  }

  private selectionKey(selection: ResolvedSyncTargetSelection): string {
    const spreadsheetId =
      selection.target.kind === 'google-sheets'
        ? selection.target.spreadsheetId
        : ''
    return `${spreadsheetId}\u0000${selection.sheetName}`
  }

  private async resolveAdapter(
    selection: ResolvedSyncTargetSelection,
  ): Promise<GoogleSheetsAdapterLike | null> {
    if (!this.adapterOrResolver) {
      return null
    }

    if (typeof this.adapterOrResolver === 'function') {
      return await this.adapterOrResolver(selection)
    }

    return this.adapterOrResolver
  }

  private asPatchCapableAdapter(
    adapter: GoogleSheetsAdapterLike,
  ): GoogleSheetsPatchCapableAdapter | null {
    if ('patchSheet' in adapter && typeof adapter.patchSheet === 'function') {
      return adapter as GoogleSheetsPatchCapableAdapter
    }

    return null
  }
}

function sameHeader(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((column, index) => column === right[index])
  )
}
