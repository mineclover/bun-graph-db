import { Database } from 'bun:sqlite'
import { graphql } from 'graphql'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setDatabasePath } from '@/config/database.js'
import { createContainer, resetContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { GraphQLTokens } from '@/infrastructure/container/tokens/index.js'

function initializeTempDatabase(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-config-'))
  const dbPath = join(tempDir, 'config.sqlite')
  const schema = readFileSync(join(process.cwd(), 'scripts/database/schema.sql'), 'utf8')
  const db = new Database(dbPath)
  db.exec(schema)
  db.close()
  return dbPath
}

async function executeGraphql(schema: unknown, query: string, variables?: Record<string, unknown>) {
  const result = await graphql({
    schema: schema as Parameters<typeof graphql>[0]['schema'],
    source: query,
    variableValues: variables,
  })

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('; '))
  }

  return result.data
}

async function main() {
  const dbPath = initializeTempDatabase()
  process.env.DATABASE_PATH = dbPath
  delete process.env.TABULAR_SYNC_CONFIG_FILE
  setDatabasePath(dbPath)
  resetContainer()

  const container = await createContainer()
  const schema = await container.resolve(GraphQLTokens.GRAPHQL_SCHEMA)

  const firstConfig = {
    defaultTargetId: 'google-sheets-primary',
    targets: [
      {
        id: 'google-sheets-primary',
        kind: 'google-sheets',
        transport: 'google-tools-http',
        spreadsheetId: 'spreadsheet-alpha',
        googleToolsBaseUrl: 'http://localhost:5678',
      },
    ],
    routes: [
      {
        tableIdentifier: 'users',
        targetId: 'google-sheets-primary',
        sheetName: 'users',
      },
    ],
  }

  const secondConfig = {
    defaultTargetId: 'google-sheets-beta',
    targets: [
      {
        id: 'google-sheets-beta',
        kind: 'google-sheets',
        transport: 'google-tools-http',
        spreadsheetId: 'spreadsheet-beta',
        googleToolsBaseUrl: 'http://localhost:5678',
      },
    ],
    routes: [
      {
        tableIdentifier: 'projects',
        targetId: 'google-sheets-beta',
        sheetName: 'projects',
      },
    ],
  }

  await executeGraphql(
    schema,
    `
      mutation SaveAlpha($input: SaveTabularSyncConfigInput!) {
        saveTabularSyncConfig(input: $input) {
          success
          config {
            configKey
            isActive
          }
        }
      }
    `,
    {
      input: {
        configKey: 'alpha',
        config: firstConfig,
        active: true,
      },
    },
  )

  await executeGraphql(
    schema,
    `
      mutation SaveBeta($input: SaveTabularSyncConfigInput!) {
        saveTabularSyncConfig(input: $input) {
          success
          config {
            configKey
            isActive
          }
        }
      }
    `,
    {
      input: {
        configKey: 'beta',
        config: secondConfig,
        active: false,
      },
    },
  )

  const listed = await executeGraphql(
    schema,
    `
      query ListConfigs {
        tabularSyncConfigs {
          configKey
          isActive
          updatedAt
        }
      }
    `,
  )

  const active = await executeGraphql(
    schema,
    `
      query GetActive {
        tabularSyncConfig {
          configKey
          isActive
          config
        }
      }
    `,
  )

  await executeGraphql(
    schema,
    `
      mutation ActivateBeta($configKey: String!) {
        activateTabularSyncConfig(configKey: $configKey) {
          success
          config {
            configKey
            isActive
          }
        }
      }
    `,
    {
      configKey: 'beta',
    },
  )

  const activeAfter = await executeGraphql(
    schema,
    `
      query GetActiveAfter {
        tabularSyncConfig {
          configKey
          isActive
          config
        }
      }
    `,
  )

  console.log(
    JSON.stringify(
      {
        listed,
        active,
        activeAfter,
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
