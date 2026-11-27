export const MODERN_MCP_PROTOCOL_VERSION = '2026-07-28'
export const SUPPORTED_MODERN_MCP_PROTOCOL_VERSIONS = [MODERN_MCP_PROTOCOL_VERSION] as const
export const LATEST_LEGACY_MCP_PROTOCOL_VERSION = '2025-11-25'
export const LEGACY_MCP_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'] as const
export const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  MODERN_MCP_PROTOCOL_VERSION,
  ...LEGACY_MCP_PROTOCOL_VERSIONS,
] as const

export const MCP_META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion'
export const MCP_META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities'
export const MCP_META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo'
export const MCP_META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'
export const MCP_TRACE_META_KEYS = ['traceparent', 'tracestate', 'baggage'] as const

export interface McpToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
  [key: string]: unknown
}

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

const BASE64_SENTINEL_PREFIX = '=?base64?'
const BASE64_SENTINEL_SUFFIX = '?='
const PROTOCOL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const BASE64_PAYLOAD_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/
const LOOPBACK_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'http://127.0.0.1',
  'https://127.0.0.1',
  'http://[::1]',
  'https://[::1]',
  'null',
])
const LOOPBACK_PREFIXES = [
  'http://localhost:',
  'https://localhost:',
  'http://127.0.0.1:',
  'https://127.0.0.1:',
  'http://[::1]:',
  'https://[::1]:',
]
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requestMeta(request: ModernMcpRequest): JsonRecord | undefined {
  if (!isRecord(request.params) || !isRecord(request.params._meta)) return undefined
  return request.params._meta
}

/** Trim RFC 9110 optional whitespace (SP / HTAB) around HTTP field values. */
export function normalizeHeaderOws(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, '')
  return trimmed.length > 0 ? trimmed : undefined
}

export function isModernProtocolVersion(version: string): boolean {
  if ((SUPPORTED_MODERN_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return true
  }
  return PROTOCOL_DATE_PATTERN.test(version) && version >= '2026-01-01'
}

export function isSupportedProtocolVersion(version: string): boolean {
  const normalized = normalizeHeaderOws(version)
  if (!normalized) return false
  return (SUPPORTED_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(normalized)
}

/** Returns true for protocol revisions that mandate 202 notification responses and isError tool validation results. */
export function usesStrictProtocolSemantics(version: string | undefined): boolean {
  const normalized = normalizeHeaderOws(version)
  return normalized === MODERN_MCP_PROTOCOL_VERSION || normalized === LATEST_LEGACY_MCP_PROTOCOL_VERSION
}

export function isJsonRpcNotification(request: ModernMcpRequest): boolean {
  return request.id === undefined
}

/** Decode SEP-2243 `Mcp-Name` header values, including `=?base64?<payload>?=` sentinels for non-ASCII names. */
export function decodeMcpNameHeader(rawHeader: string | null): { value?: string; error?: string } {
  const normalized = normalizeHeaderOws(rawHeader)
  if (!normalized) return {}

  if (!normalized.startsWith(BASE64_SENTINEL_PREFIX) || !normalized.endsWith(BASE64_SENTINEL_SUFFIX)) {
    return { value: normalized }
  }

  const encoded = normalized.slice(BASE64_SENTINEL_PREFIX.length, -BASE64_SENTINEL_SUFFIX.length)
  if (!encoded || encoded.length % 4 !== 0 || !BASE64_PAYLOAD_PATTERN.test(encoded)) {
    return { error: 'Malformed base64 sentinel in Mcp-Name header.' }
  }

  let decoded: string
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    decoded = utf8Decoder.decode(bytes)
  } catch {
    return { error: 'Malformed base64 sentinel in Mcp-Name header.' }
  }

  if (decoded.length === 0) {
    return { error: 'Empty decoded value in Mcp-Name header.' }
  }
  return { value: decoded }
}

/** Validate Origin headers for MCP DNS-rebinding defense across loopback and configured allowlists. */
export function isValidMcpOrigin(origin: string, env?: Record<string, string | undefined>): boolean {
  if (LOOPBACK_ORIGINS.has(origin) || LOOPBACK_PREFIXES.some((prefix) => origin.startsWith(prefix))) {
    return true
  }

  const resolvedEnv = env ?? (typeof process !== 'undefined' ? process.env : {})
  const configured = (resolvedEnv.BUN_GRAPH_DB_ALLOWED_ORIGINS || resolvedEnv.CORS_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return configured.includes('*') || configured.includes(origin)
}

/** Reject JSON-RPC batch arrays per MCP 2025-06-18+ / 2026-07-28 HTTP transport rules. */
export function validateJsonRpcBatch(parsed: unknown): ModernMcpError | undefined {
  if (!Array.isArray(parsed)) return undefined
  return {
    code: -32600,
    message: 'Invalid Request',
    data: {
      reason:
        parsed.length === 0
          ? 'Empty JSON-RPC batch is not allowed.'
          : 'JSON-RPC batch requests are not supported.',
    },
  }
}

export function isModernMcpRequest(request: ModernMcpRequest, headers: Headers): boolean {
  const headerVersion = normalizeHeaderOws(headers.get('MCP-Protocol-Version'))
  if (headerVersion && isModernProtocolVersion(headerVersion)) {
    return true
  }

  const metaVersion = requestMeta(request)?.[MCP_META_PROTOCOL_VERSION]
  return typeof metaVersion === 'string' && isModernProtocolVersion(metaVersion)
}

export function validateModernMcpRequest(request: ModernMcpRequest, headers: Headers): ModernMcpError | undefined {
  const meta = requestMeta(request)
  const protocolVersion = meta?.[MCP_META_PROTOCOL_VERSION]
  const clientCapabilities = meta?.[MCP_META_CLIENT_CAPABILITIES]
  const clientInfo = meta?.[MCP_META_CLIENT_INFO]
  const headerVersion = normalizeHeaderOws(headers.get('MCP-Protocol-Version'))
  const method = typeof request.method === 'string' ? request.method : undefined
  const headerMethod = normalizeHeaderOws(headers.get('Mcp-Method'))
  const params = isRecord(request.params) ? request.params : undefined
  const toolName = typeof params?.name === 'string' ? params.name : undefined
  const decodedHeaderName = decodeMcpNameHeader(headers.get('Mcp-Name'))
  const isNotification = isJsonRpcNotification(request)

  if (method === 'initialize' && headerVersion && isModernProtocolVersion(headerVersion) && protocolVersion === undefined) {
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        reason: 'Legacy initialize cannot be sent with a modern MCP-Protocol-Version header.',
      },
    }
  }

  if (typeof protocolVersion !== 'string') {
    if (headerVersion && !(SUPPORTED_MODERN_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(headerVersion)) {
      return {
        code: -32022,
        message: 'Unsupported protocol version',
        data: { requested: headerVersion, supported: [...SUPPORTED_MCP_PROTOCOL_VERSIONS] },
      }
    }
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        reason: 'Modern MCP requests require protocolVersion and clientCapabilities in params._meta.',
      },
    }
  }

  if (!(SUPPORTED_MODERN_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(protocolVersion)) {
    return {
      code: -32022,
      message: 'Unsupported protocol version',
      data: { requested: protocolVersion, supported: [...SUPPORTED_MCP_PROTOCOL_VERSIONS] },
    }
  }

  if ((!isNotification && !isRecord(clientCapabilities)) || (isNotification && clientCapabilities !== undefined && !isRecord(clientCapabilities))) {
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        reason: 'Modern MCP requests require protocolVersion and clientCapabilities in params._meta.',
      },
    }
  }

  if (decodedHeaderName.error) {
    return {
      code: -32020,
      message: 'Header mismatch',
      data: {
        reason: decodedHeaderName.error,
      },
    }
  }

  if (
    headerVersion !== protocolVersion ||
    headerMethod !== method ||
    (method === 'tools/call' && decodedHeaderName.value !== toolName)
  ) {
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

  if (meta) {
    for (const traceKey of MCP_TRACE_META_KEYS) {
      if (traceKey in meta && meta[traceKey] !== undefined && typeof meta[traceKey] !== 'string') {
        return {
          code: -32602,
          message: 'Invalid params',
          data: { reason: `${traceKey}, when present in _meta, must be a string.` },
        }
      }
    }
  }

  return undefined
}

/** Extract W3C Trace Context fields (SEP-414) from request `_meta` for response propagation. */
export function extractTraceMeta(request: ModernMcpRequest): JsonRecord | undefined {
  const meta = requestMeta(request)
  if (!meta) return undefined

  const trace: JsonRecord = {}
  let hasTrace = false
  for (const key of MCP_TRACE_META_KEYS) {
    const value = meta[key]
    if (typeof value === 'string' && value.length > 0) {
      trace[key] = value
      hasTrace = true
    }
  }
  return hasTrace ? trace : undefined
}

export function withModernResult<T extends JsonRecord>(
  result: T,
  serverInfo: JsonRecord,
  traceMeta?: JsonRecord,
): T & JsonRecord {
  const existingMeta = isRecord(result._meta) ? result._meta : {}
  return {
    ...result,
    resultType: 'complete',
    _meta: {
      ...(traceMeta ?? {}),
      ...existingMeta,
      [MCP_META_SERVER_INFO]: serverInfo,
    },
  }
}

/** Populate `structuredContent` (SEP-2106) alongside `content` when the text payload serializes a JSON object. */
export function withStructuredToolResult<T extends JsonRecord>(result: T): T {
  if (result.structuredContent !== undefined) return result
  const content = result.content
  if (!Array.isArray(content) || content.length === 0) return result

  const first = content[0]
  if (!isRecord(first) || first.type !== 'text' || typeof first.text !== 'string') {
    return result
  }

  try {
    const parsed: unknown = JSON.parse(first.text)
    if (!isRecord(parsed)) return result
    return {
      ...result,
      structuredContent: parsed,
    }
  } catch {
    return result
  }
}

export function deriveDefaultToolAnnotations(
  name: string,
  action: 'read' | 'write',
  existing?: Record<string, unknown>,
): McpToolAnnotations {
  const defaults: McpToolAnnotations = {
    readOnlyHint: action === 'read',
    destructiveHint: action === 'write' && /(delete|remove|reset|drop|purge|clear|truncate)/i.test(name),
    idempotentHint:
      action === 'read' ||
      /^(set|update|put|resync|upsert|delete|remove)/i.test(name) ||
      /-(update|delete|remove|resync|upsert)-/i.test(name) ||
      name === 'quick-reset',
    openWorldHint: false,
  }

  return existing ? { ...defaults, ...existing } : defaults
}
