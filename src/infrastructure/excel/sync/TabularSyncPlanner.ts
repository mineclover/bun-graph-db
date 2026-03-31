import { ExcelRowProjector, type ExcelProjectableNode } from '../ExcelRowProjector.js'
import {
  ExcelSchemaProjector,
  type ExcelProjectableAttribute,
} from '../ExcelSchemaProjector.js'
import { SheetSyncDiffService } from '../SheetSyncDiff.js'
import type {
  ResolvedSyncTargetSelection,
  TabularSyncTargetRegistry,
} from '../TabularSyncTargetRegistry.js'
import type { ExcelTableRow, ExcelWorkbookMetaRow } from '../types/ExcelRowSchema.js'
import type { TabularWritePlan } from '../gateways/TabularDestinationGateway.js'

export interface PlanTabularSyncInput {
  tableId?: string
  tableIdentifier: string
  description?: string
  attributes: ExcelProjectableAttribute[]
  nodes: ExcelProjectableNode[]
  previousRows?: ExcelTableRow[]
}

export class TabularSyncPlanner {
  constructor(
    private readonly registry: TabularSyncTargetRegistry,
    private readonly schemaProjector: ExcelSchemaProjector = new ExcelSchemaProjector(),
    private readonly rowProjector: ExcelRowProjector = new ExcelRowProjector(),
    private readonly diffService: SheetSyncDiffService = new SheetSyncDiffService(),
  ) {}

  plan(input: PlanTabularSyncInput): TabularWritePlan | null {
    const selection = this.registry.resolve(input.tableIdentifier)
    if (!selection) {
      return null
    }

    const schema = this.schemaProjector.projectTableSheetSchema(
      input.tableIdentifier,
      selection.sheetName,
      input.attributes,
    )
    const rows = this.rowProjector.projectRows(schema, input.nodes)
    const diff = this.diffService.diffRows(
      input.previousRows || [],
      rows,
      selection.route.primaryKeyColumn,
    )

    return {
      selection,
      schema,
      previousRows: input.previousRows || [],
      rows,
      diff,
      metadataUpdate: {
        metadataSheetName: this.registry.getMetadataSheetName(),
        schemaSheetName: this.registry.getSchemaSheetName(),
        tableRows: [
          this.createWorkbookMetaRow(selection, input, rows.length),
        ],
        schemaRows: schema.columns.map((column) => ({
          ...column,
          tableIdentifier: input.tableIdentifier,
          sheetName: selection.sheetName,
        })),
      },
    }
  }

  private createWorkbookMetaRow(
    selection: ResolvedSyncTargetSelection,
    input: PlanTabularSyncInput,
    rowCount: number,
  ): ExcelWorkbookMetaRow {
    return {
      tableIdentifier: input.tableIdentifier,
      tableId: input.tableId,
      sheetName: selection.sheetName,
      description: input.description,
      lastSyncedAt: new Date().toISOString(),
      rowCount,
    }
  }
}
