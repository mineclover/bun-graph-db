import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { TableSchemaProjectionService } from '../../src/application/services/TableSchemaProjectionService'
import type { IAttributeRepository } from '../../src/domain/repositories/IAttributeRepository'
import type { IAttributeTypeRepository } from '../../src/domain/repositories/IAttributeTypeRepository'
import type { ITableRepository } from '../../src/domain/repositories/ITableRepository'
import {
  createContainer,
  resetContainer,
} from '../../src/infrastructure/container/ContainerBootstrap'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { RepositoryTokens } from '../../src/infrastructure/container/tokens/RepositoryTokens'
import { createTableMcpMiddleware } from '../../src/presentation/mcp/routes/mcp-routes'
import { createGraphQLYoga } from '../fixtures/graphql-yoga-helper'
import {
  createTestEnvironment,
  type TestEnvironment,
} from '../fixtures/test-database-factory'

describe('Table MCP tools/list projection schemas', () => {
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let restoreDatabasePath: () => void
  let originalFetch: typeof fetch

  beforeAll(async () => {
    originalFetch = globalThis.fetch
    const previousDatabasePath = process.env.DATABASE_PATH
    restoreDatabasePath = () => {
      if (previousDatabasePath === undefined) {
        delete process.env.DATABASE_PATH
      } else {
        process.env.DATABASE_PATH = previousDatabasePath
      }
    }

    testEnvironment = await createTestEnvironment(
      'mcp-table-projection-tools-list',
      'integration',
    )
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await createContainer()
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    resetContainer()
    restoreDatabasePath?.()
    await testEnvironment.cleanup()
  })

  test('includes projection-derived attributes on table-scoped create node tool schema', async () => {
    const db = testEnvironment.database.getConnection()
    const tableId = seedProjectedTable(db)
    const yoga = await createGraphQLYoga(container)
    const graphqlEndpoint = 'http://mcp-projection.test/graphql'
    connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch)

    const projectionService = new TableSchemaProjectionService(
      (await container.resolve(
        RepositoryTokens.TABLE_REPOSITORY,
      )) as ITableRepository,
      (await container.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )) as IAttributeRepository,
      (await container.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository,
    )
    const tableMcpMiddleware = createTableMcpMiddleware({
      graphqlEndpoint,
      restApiBaseUrl: 'http://mcp-projection.test/api',
      projectionService,
    })

    const tools = await listTableMcpTools(tableMcpMiddleware, tableId)

    expect(
      tools.some((tool) => tool.name === `get-table-metadata-${tableId}`),
    ).toBe(true)
    expect(
      tools.some((tool) => tool.name === `get-table-${tableId}-attributes`),
    ).toBe(true)

    const createNodeTool = tools.find(
      (tool) => tool.name === `create-table-${tableId}-node`,
    )
    const updateNodeTool = tools.find(
      (tool) => tool.name === `update-table-${tableId}-node`,
    )
    expect(createNodeTool).toBeDefined()
    expect(updateNodeTool).toBeDefined()
    expect(createNodeTool?.inputSchema.required).toEqual([
      'content',
      'attributes',
    ])

    const attributesSchema = createNodeTool?.inputSchema.properties.attributes
    expect(attributesSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: expect.objectContaining({
          status: expect.objectContaining({
            type: 'string',
            enum: ['todo', 'doing', 'done'],
          }),
          effort: expect.objectContaining({
            type: 'integer',
            minimum: 0,
            maximum: 8,
          }),
        }),
      }),
    )
    expect(createNodeTool?._meta?.tableSchemaProjection).toEqual(
      expect.objectContaining({
        available: true,
        tableId: String(tableId),
        tableIdentifier: 'projection_tasks',
        diagnostics: [],
      }),
    )
    expect(updateNodeTool?.inputSchema.properties.attributes).toEqual({
      ...attributesSchema,
      required: [],
    })
  })

  test('refreshes cached table-scoped schema after attribute creation', async () => {
    const db = testEnvironment.database.getConnection()
    const tableId = seedProjectedTable(db, 'projection_refresh_tasks')
    const dueDateTypeId = seedAttributeType(
      db,
      'projection_refresh_due_date',
      'string',
    )
    const yoga = await createGraphQLYoga(container)
    const graphqlEndpoint = 'http://mcp-projection-refresh.test/graphql'
    connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch)

    const projectionService = new TableSchemaProjectionService(
      (await container.resolve(
        RepositoryTokens.TABLE_REPOSITORY,
      )) as ITableRepository,
      (await container.resolve(
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )) as IAttributeRepository,
      (await container.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository,
    )
    const tableMcpMiddleware = createTableMcpMiddleware({
      graphqlEndpoint,
      restApiBaseUrl: 'http://mcp-projection-refresh.test/api',
      projectionService,
    })

    const beforeTools = await listTableMcpTools(tableMcpMiddleware, tableId)
    const beforeCreateNodeTool = beforeTools.find(
      (tool) => tool.name === `create-table-${tableId}-node`,
    )
    expect(
      beforeCreateNodeTool?.inputSchema.properties.attributes.properties
        .due_date,
    ).toBeUndefined()

    const mutationResponse = await yoga.fetch(graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateAttribute($input: CreateAttributeInput!) {
            createAttribute(input: $input) {
              success
              attribute {
                id
                tableId
                identifier
              }
              errors {
                message
                code
              }
            }
          }
        `,
        variables: {
          input: {
            tableId,
            identifier: 'due_date',
            name: 'Due Date',
            attributeTypeId: dueDateTypeId,
          },
        },
      }),
    })
    const mutationResult = await mutationResponse.json()
    expect(mutationResult.errors).toBeUndefined()
    expect(mutationResult.data.createAttribute.success).toBe(true)

    const afterTools = await listTableMcpTools(tableMcpMiddleware, tableId)
    const afterCreateNodeTool = afterTools.find(
      (tool) => tool.name === `create-table-${tableId}-node`,
    )
    const afterAttributesSchema =
      afterCreateNodeTool?.inputSchema.properties.attributes

    expect(afterAttributesSchema.properties.due_date).toEqual(
      expect.objectContaining({
        type: 'string',
      }),
    )
  })
})

type ListedTool = {
  name: string
  inputSchema: {
    properties: Record<string, any>
    required: string[]
  }
  _meta?: Record<string, any>
}

function connectGraphqlFetchToYoga(
  graphqlEndpoint: string,
  yoga: Awaited<ReturnType<typeof createGraphQLYoga>>,
  fallbackFetch: typeof fetch,
): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' || input instanceof URL
        ? String(input)
        : input.url
    if (url === graphqlEndpoint) {
      return yoga.fetch(url, init)
    }
    return fallbackFetch(input, init)
  }) as typeof fetch
}

async function listTableMcpTools(
  tableMcpMiddleware: ReturnType<typeof createTableMcpMiddleware>,
  tableId: string,
): Promise<ListedTool[]> {
  const response = await tableMcpMiddleware(
    new Request(`http://mcp-projection.test/sub/${tableId}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-list',
        method: 'tools/list',
        params: {},
      }),
    }),
  )

  expect(response).not.toBeNull()
  expect(response?.status).toBe(200)

  const result = await response!.json()
  return result.result.tools as ListedTool[]
}

function seedProjectedTable(
  db: Database,
  tableIdentifier = 'projection_tasks',
): string {
  db.prepare('INSERT INTO tables (identifier, description) VALUES (?, ?)').run(
    tableIdentifier,
    'Projection-backed MCP table',
  )

  const table = db
    .prepare('SELECT id FROM tables WHERE identifier = ?')
    .get(tableIdentifier) as { id: number }

  const statusTypeId = seedAttributeType(
    db,
    `${tableIdentifier}_task_status`,
    'string',
    JSON.stringify({ enum: ['todo', 'doing', 'done'] }),
  )
  const effortTypeId = seedAttributeType(
    db,
    `${tableIdentifier}_task_effort`,
    'integer',
    JSON.stringify({ minimum: 0, maximum: 8 }),
  )

  db.prepare(`
    INSERT INTO attributes (table_id, identifier, name, attribute_type_id, description, is_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(table.id, 'status', 'Status', statusTypeId, 'Workflow status', 1)

  db.prepare(`
    INSERT INTO attributes (table_id, identifier, name, attribute_type_id, description, is_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(table.id, 'effort', 'Effort', effortTypeId, 'Estimated effort', 0)

  return String(table.id)
}

function seedAttributeType(
  db: Database,
  identifier: string,
  jsonType: string,
  validationSchema?: string,
): string {
  db.prepare(`
    INSERT INTO attribute_types (identifier, json_type, description, validation_schema)
    VALUES (?, ?, ?, ?)
  `).run(identifier, jsonType, identifier, validationSchema ?? null)

  const attributeType = db
    .prepare('SELECT id FROM attribute_types WHERE identifier = ?')
    .get(identifier) as {
    id: number
  }

  return String(attributeType.id)
}
