import { Database } from 'bun:sqlite'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createContainer, resetContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens, GraphQLTokens, RepositoryTokens } from '@/infrastructure/container/tokens/index.js'
import { setDatabasePath } from '@/config/database.js'
import {
  createGoogleSheetsPipeBuilderConfig,
  createGoogleSpreadsheet,
  createTabularDestinationGateways,
  TabularSyncTargetRegistry,
} from '@/infrastructure/excel/index.js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function initializeTempDatabase(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-hook-'))
  const dbPath = join(tempDir, 'hook.sqlite')
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
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'graphql_hook_users'

  const createdSpreadsheet =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? { spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID }
      : await createGoogleSpreadsheet({
          workspacePath,
          authMode: 'oauth',
          oauthTokenFile,
          title: `bun-graph-db-hook-${Date.now()}`,
        })

  const config = createGoogleSheetsPipeBuilderConfig({
    spreadsheetId: createdSpreadsheet.spreadsheetId,
    oauthTokenFile,
    authMode: 'oauth',
    tableIdentifier: 'graphql_hook_users',
    sheetName,
    pipeBuilderWorkspacePath: workspacePath,
  })

  const configDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-hook-config-'))
  const configPath = join(configDir, 'tabular-sync.json')
  await Bun.write(configPath, JSON.stringify(config, null, 2))

  const dbPath = initializeTempDatabase()
  process.env.TABULAR_SYNC_CONFIG_FILE = configPath
  process.env.DATABASE_PATH = dbPath
  setDatabasePath(dbPath)
  resetContainer()

  const container = await createContainer()

  const tableMutations = await container.resolve(GraphQLTokens.TABLE_MUTATIONS)
  const attributeMutations = await container.resolve(GraphQLTokens.ATTRIBUTE_MUTATIONS)
  const nodeMutations = await container.resolve(GraphQLTokens.NODE_MUTATIONS)
  const attributeTypeRepository = await container.resolve(
    RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
  )

  const createdTable = await tableMutations.createTable(
    {},
    {
      input: {
        identifier: 'graphql_hook_users',
        description: 'GraphQL hook sync table',
      },
    },
  )

  const tableId = createdTable.table?.id
  if (!tableId) {
    throw new Error('Failed to create hook test table')
  }

  const emailType = await attributeTypeRepository.findByIdentifier('email')
  const textType = await attributeTypeRepository.findByIdentifier('text')
  if (!emailType || !textType) {
    throw new Error('Required attribute types not found')
  }

  await attributeMutations.createAttribute(
    {},
    {
      input: {
        tableId,
        identifier: 'email',
        name: 'Email',
        attributeTypeId: emailType.getId(),
        description: 'Primary email',
      },
    },
  )

  await attributeMutations.createAttribute(
    {},
    {
      input: {
        tableId,
        identifier: 'department',
        name: 'Department',
        attributeTypeId: textType.getId(),
        description: 'Department name',
      },
    },
  )

  const firstNode = await nodeMutations.createNode(
    {},
    {
      input: {
        tableId,
        content: 'First hook content',
        title: 'Hook Alpha',
      },
    },
  )

  const firstNodeId = firstNode.node?.id
  if (!firstNodeId) {
    throw new Error('Failed to create first hook node')
  }

  const attributeRepository = await container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
  const emailAttr = await attributeRepository.findByTableIdAndIdentifier(tableId, 'email')
  const departmentAttr = await attributeRepository.findByTableIdAndIdentifier(tableId, 'department')
  if (!emailAttr || !departmentAttr) {
    throw new Error('Failed to resolve created attributes')
  }

  await nodeMutations.setNodeAttribute(
    {},
    {
      input: {
        nodeId: firstNodeId,
        attributeId: emailAttr.getId(),
        value: 'hook-alpha@example.com',
      },
    },
  )

  await nodeMutations.setNodeAttribute(
    {},
    {
      input: {
        nodeId: firstNodeId,
        attributeId: departmentAttr.getId(),
        value: 'platform',
      },
    },
  )

  await nodeMutations.updateNode(
    {},
    {
      id: firstNodeId,
      input: {
        title: 'Hook Alpha Updated',
        content: 'First hook content updated',
      },
    },
  )

  const secondNode = await nodeMutations.createNode(
    {},
    {
      input: {
        tableId,
        content: 'Second hook content',
        title: 'Hook Beta',
      },
    },
  )

  const secondNodeId = secondNode.node?.id
  if (!secondNodeId) {
    throw new Error('Failed to create second hook node')
  }

  await nodeMutations.setNodeAttribute(
    {},
    {
      input: {
        nodeId: secondNodeId,
        attributeId: emailAttr.getId(),
        value: 'hook-beta@example.com',
      },
    },
  )

  await nodeMutations.removeNodeAttribute(
    {},
    {
      nodeId: secondNodeId,
      attributeId: emailAttr.getId(),
    },
  )

  await nodeMutations.deleteNode(
    {},
    {
      id: secondNodeId,
    },
  )

  await attributeMutations.deleteAttribute(
    {},
    {
      id: departmentAttr.getId(),
    },
  )

  const registry = new TabularSyncTargetRegistry(config)
  const selection = registry.resolve('graphql_hook_users')
  if (!selection) {
    throw new Error('Failed to resolve sheet target from hook config')
  }

  const tabularSyncHook = await container.resolve(CommonTokens.TABULAR_SYNC_HOOK)
  await tabularSyncHook.flush()

  const gateway = createTabularDestinationGateways().find((candidate) =>
    candidate.supports(selection),
  )
  if (!gateway) {
    throw new Error('No gateway available for hook test')
  }

  const rows = await gateway.readRows(selection)

  console.log(
    JSON.stringify(
      {
        spreadsheetId: createdSpreadsheet.spreadsheetId,
        sheetName: selection.sheetName,
        rowCount: rows.length,
        scenario: [
          'create table',
          'create attributes',
          'create node',
          'set node attributes',
          'update node',
          'create second node',
          'set second node attribute',
          'remove second node attribute',
          'delete second node',
          'delete department attribute',
        ],
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
