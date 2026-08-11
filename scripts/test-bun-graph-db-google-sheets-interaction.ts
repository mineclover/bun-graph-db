import { Database } from 'bun:sqlite'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TabularTableSyncBridge } from '@/application/services/TabularTableSyncBridge.js'
import { setDatabasePath } from '@/config/database.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { Node } from '@/domain/entities/Node.js'
import { Table } from '@/domain/entities/Table.js'
import { resetContainer, createContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { RepositoryTokens } from '@/infrastructure/container/tokens/RepositoryTokens.js'
import {
  createGoogleSheetsPipeBuilderConfig,
  createGoogleSpreadsheet,
  createTabularDestinationGateways,
  ExcelSchemaProjector,
  TabularSyncPlanner,
  TabularSyncService,
  TabularSyncTargetRegistry,
} from '@/infrastructure/excel/index.js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function initializeTempDatabase(): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-sheets-'))
  const dbPath = join(tempDir, 'interaction.sqlite')
  const schema = readFileSync(join(process.cwd(), 'scripts/database/schema.sql'), 'utf8')
  const db = new Database(dbPath)
  db.exec(schema)
  db.close()
  return dbPath
}

async function main() {
  const oauthTokenFile = requireEnv('GOOGLE_OAUTH_TOKEN_FILE')
  const workspacePath =
    process.env.PIPE_BUILDER_WORKSPACE_PATH ||
    '/Users/junwoobang/workflow/pipe-builder'
  const desiredSheetName =
    process.env.GOOGLE_SHEETS_SHEET_NAME || 'bun_graph_sync_users'

  const spreadsheet =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? { spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID }
      : await createGoogleSpreadsheet({
          workspacePath,
          authMode: 'oauth',
          oauthTokenFile,
          title: `bun-graph-db-interaction-${Date.now()}`,
        })

  const dbPath = await initializeTempDatabase()
  resetContainer()
  setDatabasePath(dbPath)
  process.env.DATABASE_PATH = dbPath

  const container = await createContainer()
  const tableRepository = await container.resolve(RepositoryTokens.TABLE_REPOSITORY)
  const attributeTypeRepository = await container.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
  const attributeRepository = await container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
  const nodeRepository = await container.resolve(RepositoryTokens.NODE_REPOSITORY)
  const nodeAttributeRepository = await container.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)

  const table = Table.create('google_sync_users', 'Google Sheets sync test table')
  await tableRepository.save(table)
  const savedTable = await tableRepository.findByIdentifier('google_sync_users')
  if (!savedTable) {
    throw new Error('Failed to create test table')
  }

  const emailType = await attributeTypeRepository.findByIdentifier('email')
  const textType = await attributeTypeRepository.findByIdentifier('text')
  if (!emailType || !textType) {
    throw new Error('Required default attribute types not found')
  }

  const emailAttr = Attribute.create(
    savedTable.id,
    'email',
    emailType.getId(),
    'Email',
    'Primary email',
    true,
    JSON.stringify({ searchable: true }),
  )
  const departmentAttr = Attribute.create(
    savedTable.id,
    'department',
    textType.getId(),
    'Department',
    'Department name',
    false,
    JSON.stringify({ searchable: true }),
  )
  await attributeRepository.save(emailAttr)
  await attributeRepository.save(departmentAttr)

  const savedEmailAttr = await attributeRepository.findByTableIdAndIdentifier(
    savedTable.id,
    'email',
  )
  const savedDepartmentAttr =
    await attributeRepository.findByTableIdAndIdentifier(savedTable.id, 'department')
  if (!savedEmailAttr || !savedDepartmentAttr) {
    throw new Error('Failed to create test attributes')
  }

  const node1 = Node.create(
    savedTable.id,
    'Initial synced content',
    'Alpha',
    'First node',
  )
  await nodeRepository.save(node1)
  const savedNode1 = await nodeRepository.findByTableIdAndContent(
    savedTable.id,
    'Initial synced content',
  )
  if (!savedNode1) {
    throw new Error('Failed to create first node')
  }
  await nodeAttributeRepository.setNodeAttribute(
    savedNode1.getId(),
    savedEmailAttr.getId(),
    'alpha@example.com',
  )
  await nodeAttributeRepository.setNodeAttribute(
    savedNode1.getId(),
    savedDepartmentAttr.getId(),
    'platform',
  )

  const config = createGoogleSheetsPipeBuilderConfig({
    spreadsheetId: spreadsheet.spreadsheetId,
    oauthTokenFile,
    authMode: 'oauth',
    tableIdentifier: savedTable.identifier,
    sheetName: desiredSheetName,
    pipeBuilderWorkspacePath: workspacePath,
  })

  const registry = new TabularSyncTargetRegistry(config)
  const planner = new TabularSyncPlanner(registry, new ExcelSchemaProjector())
  const syncService = new TabularSyncService(
    registry,
    planner,
    createTabularDestinationGateways(),
  )
  const bridge = new TabularTableSyncBridge(
    tableRepository,
    attributeRepository,
    attributeTypeRepository,
    nodeRepository,
    nodeAttributeRepository,
    syncService,
  )

  const firstResult = await bridge.syncByIdentifier(savedTable.identifier)

  await nodeRepository.update(savedNode1.getId(), {
    content: 'Updated synced content',
    title: 'Alpha Updated',
  })
  await nodeAttributeRepository.setNodeAttribute(
    savedNode1.getId(),
    savedDepartmentAttr.getId(),
    'product',
  )

  const node2 = Node.create(savedTable.id, 'Second synced content', 'Beta', 'Second node')
  await nodeRepository.save(node2)
  const savedNode2 = await nodeRepository.findByTableIdAndContent(
    savedTable.id,
    'Second synced content',
  )
  if (!savedNode2) {
    throw new Error('Failed to create second node')
  }
  await nodeAttributeRepository.setNodeAttribute(
    savedNode2.getId(),
    savedEmailAttr.getId(),
    'beta@example.com',
  )
  await nodeAttributeRepository.setNodeAttribute(
    savedNode2.getId(),
    savedDepartmentAttr.getId(),
    'platform',
  )

  const secondResult = await bridge.syncByIdentifier(savedTable.identifier)

  const selection = registry.resolve(savedTable.identifier)
  if (!selection) {
    throw new Error('Failed to resolve Google Sheets target')
  }
  const gateway = createTabularDestinationGateways().find((candidate) =>
    candidate.supports(selection),
  )
  if (!gateway) {
    throw new Error('No Google Sheets gateway found')
  }

  const rows = await gateway.readRows(selection)

  console.log(
    JSON.stringify(
      {
        spreadsheetId: spreadsheet.spreadsheetId,
        sheetName: selection.sheetName,
        firstResult,
        secondResult,
        rowCount: rows.length,
        rows,
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
