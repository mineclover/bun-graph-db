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

  constructor(
    private readonly adapterOrResolver?:
      | GoogleSheetsAdapterLike
      | GoogleSheetsAdapterResolver,
  ) {}

  supports(selection: ResolvedSyncTargetSelection): boolean {
    return selection.target.kind === 'google-sheets'
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
      return this.matrixSerializer.fromMatrix(result.values)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Sheet not found')) {
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

    const patchCapableAdapter = this.asPatchCapableAdapter(adapter)
    if (patchCapableAdapter) {
      const patched = await patchCapableAdapter.patchSheet(
        spreadsheetId,
        plan.selection.sheetName,
        plan.schema,
        plan.previousRows,
        plan.rows,
        plan.diff.rows,
      )

      if (patched) {
        return
      }
    }

    const values = this.matrixSerializer.toMatrix(plan.schema, plan.rows)
    await adapter.replaceSheet(
      spreadsheetId,
      plan.selection.sheetName,
      values,
    )
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
