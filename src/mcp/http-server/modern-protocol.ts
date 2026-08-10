export const MODERN_MCP_PROTOCOL_VERSION = '2026-07-28'
export const LEGACY_MCP_PROTOCOL_VERSIONS = ['2024-11-05', '2025-06-18'] as const
export const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  MODERN_MCP_PROTOCOL_VERSION,
  ...LEGACY_MCP_PROTOCOL_VERSIONS,
] as const

export interface ModernMcpRequest {
  jsonrpc?: unknown
  id?: string | number | null
  method?: unknown
  params?: unknown
}

export interface ModernMcpError {
  code: number
  message: string
  data: Record<string, unknown>
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requestMeta(request: ModernMcpRequest): JsonRecord | undefined {
  if (!isRecord(request.params) || !isRecord(request.params._meta)) return undefined
  return request.params._meta
}

export function isModernMcpRequest(request: ModernMcpRequest, headers: Headers): boolean {
  return (
    headers.get('MCP-Protocol-Version') === MODERN_MCP_PROTOCOL_VERSION ||
    requestMeta(request)?.['io.modelcontextprotocol/protocolVersion'] === MODERN_MCP_PROTOCOL_VERSION
  )
}

export function validateModernMcpRequest(request: ModernMcpRequest, headers: Headers): ModernMcpError | undefined {
  const meta = requestMeta(request)
  const protocolVersion = meta?.['io.modelcontextprotocol/protocolVersion']
  const clientCapabilities = meta?.['io.modelcontextprotocol/clientCapabilities']
  const clientInfo = meta?.['io.modelcontextprotocol/clientInfo']
  const headerVersion = headers.get('MCP-Protocol-Version')
  const method = typeof request.method === 'string' ? request.method : undefined
  const headerMethod = headers.get('Mcp-Method')
  const params = isRecord(request.params) ? request.params : undefined
  const toolName = typeof params?.name === 'string' ? params.name : undefined
  const headerName = headers.get('Mcp-Name')

  if (typeof protocolVersion !== 'string' || !isRecord(clientCapabilities)) {
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        reason: 'Modern MCP requests require protocolVersion and clientCapabilities in params._meta.',
      },
    }
  }

  if (protocolVersion !== MODERN_MCP_PROTOCOL_VERSION) {
    return {
      code: -32022,
      message: 'Unsupported protocol version',
      data: { requested: protocolVersion, supported: [...SUPPORTED_MCP_PROTOCOL_VERSIONS] },
    }
  }

  if (headerVersion !== protocolVersion || headerMethod !== method || (method === 'tools/call' && headerName !== toolName)) {
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        expected: {
          'MCP-Protocol-Version': protocolVersion,
          'Mcp-Method': method,
          ...(method === 'tools/call' ? { 'Mcp-Name': toolName } : {}),
        },
      },
    }
  }

  if (clientInfo !== undefined && (!isRecord(clientInfo) || typeof clientInfo.name !== 'string' || typeof clientInfo.version !== 'string')) {
    return {
      code: -32602,
      message: 'Invalid params',
      data: { reason: 'clientInfo, when present, must include string name and version fields.' },
    }
  }

  return undefined
}

export function withModernResult<T extends JsonRecord>(result: T, serverInfo: JsonRecord): T & JsonRecord {
  const existingMeta = isRecord(result._meta) ? result._meta : {}
  return {
    ...result,
    resultType: 'complete',
    _meta: {
      ...existingMeta,
      'io.modelcontextprotocol/serverInfo': serverInfo,
    },
  }
}
