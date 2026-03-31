import {
  createGoogleToolsHttpSpreadsheet,
  ExcelSchemaProjector,
  GoogleToolsHttpSheetsAdapter,
  SheetSyncDiffService,
  SheetMatrixSerializer,
  type ExcelProjectableAttribute,
  type ExcelProjectableNode,
} from '@/infrastructure/excel/index.js'

function createNodes(count: number, prefix: string): ExcelProjectableNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `Row ${index + 1}`,
    content: `Content ${index + 1}`,
    description: `Description ${index + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attributes: {
      email: `${prefix}-${index + 1}@example.com`,
      department: index % 2 === 0 ? 'platform' : 'product',
    },
  }))
}

async function main() {
  const baseUrl = process.env.GOOGLE_TOOLS_BASE_URL || 'http://localhost:5678'
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'benchmark_users'
  const rowCount = Number(process.env.BENCHMARK_ROW_COUNT || '50')

  const spreadsheet =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? { spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID }
      : await createGoogleToolsHttpSpreadsheet({
          baseUrl,
          title: `bun-graph-db-benchmark-${Date.now()}`,
        })

  const attributes: ExcelProjectableAttribute[] = [
    { identifier: 'email', dataType: 'email', searchable: true, required: true },
    { identifier: 'department', dataType: 'text', searchable: true },
  ]

  const projector = new ExcelSchemaProjector()
  const schema = projector.projectTableSheetSchema('benchmark_users', sheetName, attributes)
  const serializer = new SheetMatrixSerializer()
  const diffService = new SheetSyncDiffService()
  const adapter = new GoogleToolsHttpSheetsAdapter({ baseUrl })

  const initialRows = createNodes(rowCount, 'initial').map((node) => ({
    __node_id: node.id,
    __title: node.title || '',
    __content: node.content,
    __description: node.description || '',
    __created_at: node.createdAt || '',
    __updated_at: node.updatedAt || '',
    email: String(node.attributes?.email || ''),
    department: String(node.attributes?.department || ''),
  }))

  const updatedRows = initialRows.map((row, index) =>
    index < 5
      ? {
          ...row,
          __title: `${row.__title} updated`,
          department: 'growth',
        }
      : row,
  )

  const initialMatrix = serializer.toMatrix(schema, initialRows)
  const fullStart = Date.now()
  await adapter.replaceSheet(spreadsheet.spreadsheetId, sheetName, initialMatrix)
  const fullWriteMs = Date.now() - fullStart

  const diff = diffService.diffRows(initialRows, updatedRows)
  const patchStart = Date.now()
  const patched = await adapter.patchSheet(
    spreadsheet.spreadsheetId,
    sheetName,
    schema,
    initialRows,
    updatedRows,
    diff.rows,
  )
  const patchMs = Date.now() - patchStart

  const readBack = await adapter.readSheet(spreadsheet.spreadsheetId, sheetName)

  console.log(
    JSON.stringify(
      {
        spreadsheetId: spreadsheet.spreadsheetId,
        sheetName,
        rowCount,
        fullWriteMs,
        patchMs,
        patched,
        changedRows: diff.changed,
        addedRows: diff.added,
        removedRows: diff.removed,
        readBackRowCount: readBack.values.length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
})
