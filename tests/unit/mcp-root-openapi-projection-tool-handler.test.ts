import {
  OPENAPI_PROJECTION_PROFILE_EXTENSION,
  OPENAPI_PROJECTION_REFS_EXTENSION,
  OPENAPI_PROJECTION_SOURCES_EXTENSION,
  OPENAPI_PROJECTION_VERSION_HASH_EXTENSION,
  validateOpenApiProjection,
} from '@oa-sdk/openapi-projection-contract'
import { describe, expect, test } from 'bun:test'
import {
  ROOT_MCP_TOOL_CONTRACTS_EXTENSION,
  toRootMcpToolOpenApiProjectionResult,
} from '../../src/core/schema/RootMcpToolOpenApiProjection.js'
import { McpHttpServer } from '../../src/mcp/http-server/McpHttpServer'

type McpToolContract = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

type McpResponse = {
  result?: {
    tools?: McpToolContract[]
    content?: Array<{
      type?: string
      text?: string
    }>
    isError?: boolean
  }
  error?: unknown
}

type RootProjectionOutput = {
  projection: {
    profile: string
    projection: Record<string, unknown> & {
      paths?: Record<string, unknown>
      components?: {
        schemas?: Record<string, Record<string, unknown>>
      }
      [ROOT_MCP_TOOL_CONTRACTS_EXTENSION]?: Array<{
        name: string
        description: string
        argumentsRef: string
      }>
    }
    refs: unknown[]
    diagnostics: unknown[]
    sources: Record<string, unknown>
    versionHash: string
    typeTargets: unknown[]
  }
  validation: {
    valid: boolean
    diagnostics: unknown[]
  }
}

describe('Root MCP OpenAPI projection export tool', () => {
  test('is advertised through root tools/list with a stable input contract', async () => {
    const server = createRootMcpServer()

    const response = await postMcp(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })

    const projectionTool = response.result?.tools?.find(
      (tool) => tool.name === 'get-root-openapi-projection',
    )
    expect(projectionTool).toEqual(
      expect.objectContaining({
        name: 'get-root-openapi-projection',
        description: expect.stringContaining('root MCP OpenAPI 3.2 component-bundle projection'),
        inputSchema: expect.objectContaining({
          type: 'object',
          additionalProperties: false,
          properties: expect.objectContaining({
            profile: expect.objectContaining({
              type: 'string',
              enum: ['component-bundle'],
              default: 'component-bundle',
            }),
          }),
        }),
      }),
    )
  })

  test('exports root tool argument schemas from tools/list inputSchema values', async () => {
    const server = createRootMcpServer()
    const toolsResponse = await postMcp(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
    const listedTools = toolsResponse.result?.tools ?? []

    const callResponse = await postMcp(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get-root-openapi-projection',
        arguments: {},
      },
    })
    const output = parseToolOutput(callResponse)

    expect(callResponse.error).toBeUndefined()
    expect(callResponse.result?.isError).toBe(false)
    expect(output.validation).toEqual(validateOpenApiProjection(output.projection))
    expect(output.validation.valid).toBe(true)
    expect(output.projection).toEqual(
      expect.objectContaining({
        profile: 'component-bundle',
        refs: expect.any(Array),
        diagnostics: [],
        sources: expect.any(Object),
        versionHash: expect.any(String),
        typeTargets: expect.any(Array),
      }),
    )
    expect(output.projection.projection.paths).toEqual({})
    expect(output.projection.projection[OPENAPI_PROJECTION_PROFILE_EXTENSION]).toBe('component-bundle')
    expect(output.projection.projection[OPENAPI_PROJECTION_VERSION_HASH_EXTENSION]).toBe(
      output.projection.versionHash,
    )
    expect(output.projection.projection[OPENAPI_PROJECTION_REFS_EXTENSION]).toEqual(output.projection.refs)
    expect(output.projection.projection[OPENAPI_PROJECTION_SOURCES_EXTENSION]).toEqual(output.projection.sources)

    const contracts = output.projection.projection[ROOT_MCP_TOOL_CONTRACTS_EXTENSION] ?? []
    expect(contracts.map((contract) => contract.name).sort()).toEqual(
      listedTools.map((tool) => tool.name).sort(),
    )

    const createTableTool = listedTools.find((tool) => tool.name === 'createTable')
    const createTableContract = contracts.find((contract) => contract.name === 'createTable')
    expect(createTableContract).toEqual({
      name: 'createTable',
      description: createTableTool?.description,
      argumentsRef: '#/components/schemas/CreateTableArguments',
    })

    const createTableSchema =
      output.projection.projection.components?.schemas?.CreateTableArguments
    expect(createTableSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['identifier'],
        'x-mcp-tool-name': 'createTable',
        'x-mcp-tool-description': createTableTool?.description,
        properties: expect.objectContaining({
          identifier: expect.objectContaining({
            type: 'string',
            minLength: 1,
          }),
        }),
      }),
    )
    expect(output.projection.refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'mcp://root/tools/createTable',
          to: '#/components/schemas/CreateTableArguments',
          ref: '#/components/schemas/CreateTableArguments',
          kind: 'mcp-tool-argument-schema',
        }),
      ]),
    )
    expect(output.projection.sources['#/components/schemas/CreateTableArguments']).toEqual(
      expect.objectContaining({
        kind: 'file',
        filePath: 'references/bun-graph-db/src/application/services/McpToolRegistry.ts',
        pointer: '/tools/createTable/inputSchema',
      }),
    )
    expect(output.projection.typeTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '#/components/schemas/CreateTableArguments',
          name: 'CreateTableArguments',
          kind: 'schema',
        }),
      ]),
    )
  })

  test('rejects unsupported profile values before executing the projection handler', async () => {
    const server = createRootMcpServer()

    const callResponse = await postMcp(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get-root-openapi-projection',
        arguments: {
          profile: '',
        },
      },
    })

    expect(callResponse.result).toBeUndefined()
    expect(callResponse.error).toEqual(
      expect.objectContaining({
        code: -32602,
        message: expect.stringContaining('Schema validation failed'),
      }),
    )
  })

  test('emits machine-readable diagnostics for unmappable tool input schemas', () => {
    const projection = toRootMcpToolOpenApiProjectionResult([
      {
        name: 'badTool',
        description: 'A tool with a non-object argument contract.',
        inputSchema: {
          type: 'string',
        },
      },
    ])
    const validation = validateOpenApiProjection(projection)

    expect(projection.projection.components.schemas.BadToolArguments).toEqual(
      expect.objectContaining({
        type: 'object',
        'x-mcp-tool-name': 'badTool',
        'x-mcp-input-schema-unmapped': true,
      }),
    )
    expect(projection.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'mcp-tool-openapi-projection/non-object-root-type',
          source: expect.objectContaining({
            kind: 'file',
            pointer: '/tools/badTool/inputSchema',
          }),
        }),
      ]),
    )
    expect(validation.valid).toBe(false)
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'mcp-tool-openapi-projection/non-object-root-type',
        }),
      ]),
    )
  })
})

function createRootMcpServer(): McpHttpServer {
  return new McpHttpServer(
    'http://root-mcp-openapi-projection.test/graphql',
    'http://root-mcp-openapi-projection.test/api',
  )
}

async function postMcp(server: McpHttpServer, body: Record<string, unknown>): Promise<McpResponse> {
  const response = await server.handleRequest(
    new Request('http://root-mcp-openapi-projection.test/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

  return (await response.json()) as McpResponse
}

function parseToolOutput(response: McpResponse): RootProjectionOutput {
  const text = response.result?.content?.[0]?.text
  expect(typeof text).toBe('string')
  return JSON.parse(text as string) as RootProjectionOutput
}
