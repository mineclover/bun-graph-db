import { timingSafeEqual } from 'node:crypto'
import { Kind, parse, visit, type ValueNode } from 'graphql'
import type { ILogger } from '../ports/ILogger.js'

export type AccessRole = 'reader' | 'writer' | 'admin'
export type AccessAction = 'read' | 'write' | 'admin'

export interface AccessPrincipal {
  id: string
  role: AccessRole
  tableIds: readonly string[]
}

export interface AccessRequirement {
  action: AccessAction
  endpoint: string
  tableId?: string
  tableIds?: readonly string[]
  /** A table-owned resource was referenced but its owner could not be resolved. */
  unresolvedTableScopedResource?: boolean
  /** The endpoint exposes or mutates global state rather than a table-scoped resource. */
  requiresGlobalScope?: boolean
  requestBytes?: number
  graphqlComplexity?: number
}

export interface AllowedAccessDecision {
  allowed: true
  principal?: AccessPrincipal
}

export interface DeniedAccessDecision {
  allowed: false
  status: 400 | 401 | 403 | 404 | 413 | 429
  code:
    | 'authentication_required'
    | 'invalid_credentials'
    | 'forbidden'
    | 'not_found'
    | 'rate_limited'
    | 'request_too_large'
    | 'query_too_complex'
}

export type AccessDecision = AllowedAccessDecision | DeniedAccessDecision

interface AccessTokenDefinition {
  id?: string
  role?: AccessRole
  tableIds?: string[]
}

export interface ExternalResourceAccessResolver {
  /** Resolve a node's owning table before dispatching an external request. */
  resolveNodeTableId?: (nodeId: string) => Promise<string | undefined>
}

interface RateLimitBucket {
  count: number
  resetAt: number
}

export interface AccessControlOptions {
  enabled: boolean
  tokens: ReadonlyMap<string, AccessPrincipal>
  allowedOrigins: readonly string[]
  rateLimit: {
    enabled: boolean
    max: number
    windowMs: number
  }
  maxRequestBytes: number
  maxGraphqlComplexity: number
  logger?: ILogger
}

const roleRank: Record<AccessRole, number> = {
  reader: 1,
  writer: 2,
  admin: 3,
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value === 'true'
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue
}

function parseAccessTokens(env: Record<string, string | undefined>): Map<string, AccessPrincipal> {
  const configured = env.BUN_GRAPH_DB_ACCESS_TOKENS
  const legacyAdminToken = env.BUN_GRAPH_DB_API_TOKEN
  const tokens = new Map<string, AccessPrincipal>()

  if (configured) {
    let parsed: unknown
    try {
      parsed = JSON.parse(configured)
    } catch {
      throw new Error('BUN_GRAPH_DB_ACCESS_TOKENS must be valid JSON.')
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('BUN_GRAPH_DB_ACCESS_TOKENS must map credential strings to access definitions.')
    }

    for (const [token, definition] of Object.entries(parsed as Record<string, unknown>)) {
      if (!token || !definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new Error('Every BUN_GRAPH_DB_ACCESS_TOKENS entry must contain a non-empty token and object definition.')
      }

      const typed = definition as AccessTokenDefinition
      const role = typed.role || 'reader'
      if (!(role in roleRank)) {
        throw new Error(`Unsupported access role: ${String(typed.role)}`)
      }
      if (typed.tableIds !== undefined && (!Array.isArray(typed.tableIds) || typed.tableIds.some((value) => typeof value !== 'string'))) {
        throw new Error('Access token tableIds must be an array of strings.')
      }

      tokens.set(token, {
        id: typed.id?.trim() || `token-${tokens.size + 1}`,
        role,
        tableIds: typed.tableIds?.map((value) => value.trim()).filter(Boolean) ?? ['*'],
      })
    }
  }

  if (legacyAdminToken) {
    tokens.set(legacyAdminToken, { id: 'legacy-admin', role: 'admin', tableIds: ['*'] })
  }

  // Per-process capability for MCP's authenticated loopback bridge. It goes
  // through the ordinary Bearer credential path and is never inferred from an
  // address or forgeable X-* header.
  const internalBridgeToken = env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN?.trim()
  if (internalBridgeToken) {
    tokens.set(internalBridgeToken, { id: 'internal-mcp-bridge', role: 'admin', tableIds: ['*'] })
  }

  return tokens
}

function secureTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function credentialFrom(request: Request): string | undefined {
  const authorization = request.headers.get('Authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim()
  return request.headers.get('X-API-Key')?.trim() || undefined
}

function requestIdentity(request: Request, principal?: AccessPrincipal): string {
  if (principal) return `principal:${principal.id}`
  const forwarded = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  return `network:${forwarded || request.headers.get('X-Real-IP') || 'unknown'}`
}

export class AccessControl {
  private readonly rateLimitBuckets = new Map<string, RateLimitBucket>()

  constructor(private readonly options: AccessControlOptions) {}

  static fromEnvironment(env: Record<string, string | undefined>, logger?: ILogger): AccessControl {
    const production = env.NODE_ENV === 'production'
    const enabled = parseBoolean(env.BUN_GRAPH_DB_AUTH_REQUIRED, production)
    const allowedOrigins = (env.BUN_GRAPH_DB_ALLOWED_ORIGINS || env.CORS_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

    return new AccessControl({
      enabled,
      tokens: parseAccessTokens(env),
      allowedOrigins,
      rateLimit: {
        enabled: parseBoolean(env.BUN_GRAPH_DB_RATE_LIMIT_ENABLED, production),
        max: parsePositiveInteger(env.BUN_GRAPH_DB_RATE_LIMIT_MAX, 1_000),
        windowMs: parsePositiveInteger(env.BUN_GRAPH_DB_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1_000),
      },
      maxRequestBytes: parsePositiveInteger(env.BUN_GRAPH_DB_MAX_REQUEST_BYTES, 1_048_576),
      maxGraphqlComplexity: parsePositiveInteger(env.BUN_GRAPH_DB_GRAPHQL_MAX_COMPLEXITY, 250),
      logger,
    })
  }

  authorize(request: Request, requirement: AccessRequirement): AccessDecision {
    const originDecision = this.validateOrigin(request, requirement)
    if (originDecision) return originDecision

    const credential = credentialFrom(request)
    const principal = credential ? this.findPrincipal(credential) : undefined
    if (this.options.enabled && !principal) {
      return this.denied(requirement, credential ? 'invalid_credentials' : 'authentication_required')
    }

    const rateLimitDecision = this.validateRateLimit(request, principal, requirement)
    if (rateLimitDecision) return rateLimitDecision

    if (requirement.requestBytes !== undefined && requirement.requestBytes > this.options.maxRequestBytes) {
      return this.denied(requirement, 'request_too_large', principal, false)
    }
    if (
      requirement.graphqlComplexity !== undefined &&
      requirement.graphqlComplexity > this.options.maxGraphqlComplexity
    ) {
      return this.denied(requirement, 'query_too_complex', principal, false)
    }

    if (!this.options.enabled) {
      this.audit('allowed', requirement, undefined)
      return { allowed: true }
    }

    if (!principal || roleRank[principal.role] < this.requiredRoleRank(requirement.action)) {
      return this.denied(requirement, 'forbidden', principal, false)
    }
    const requestedTableIds = requirement.tableIds || (requirement.tableId ? [requirement.tableId] : [])
    if (requirement.requiresGlobalScope && !principal.tableIds.includes('*')) {
      return this.denied(requirement, 'forbidden', principal, false)
    }
    if (requirement.unresolvedTableScopedResource && !principal.tableIds.includes('*')) {
      return this.denied(requirement, 'not_found', principal)
    }
    if (
      requestedTableIds.length > 0 &&
      !principal.tableIds.includes('*') &&
      requestedTableIds.some((tableId) => !principal.tableIds.includes(tableId))
    ) {
      return this.denied(requirement, 'not_found', principal)
    }

    this.audit('allowed', requirement, principal)
    return { allowed: true, principal }
  }

  responseFor(decision: DeniedAccessDecision): Response {
    const status = decision.status
    const body = decision.code === 'not_found' ? { error: 'Not Found' } : { error: decision.code }
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
      },
    })
  }

  principalFor(request: Request): AccessPrincipal | undefined {
    const credential = credentialFrom(request)
    return credential ? this.findPrincipal(credential) : undefined
  }

  isAuthenticationRequired(): boolean {
    return this.options.enabled
  }

  private findPrincipal(credential: string): AccessPrincipal | undefined {
    for (const [token, principal] of this.options.tokens) {
      if (secureTokenEquals(credential, token)) return principal
    }
    return undefined
  }

  private validateOrigin(request: Request, requirement: AccessRequirement): AccessDecision | undefined {
    const origin = request.headers.get('Origin')
    if (!origin || this.options.allowedOrigins.length === 0 || this.options.allowedOrigins.includes('*')) return undefined
    if (this.options.allowedOrigins.includes(origin)) return undefined
    return this.denied(requirement, 'forbidden')
  }

  private validateRateLimit(
    request: Request,
    principal: AccessPrincipal | undefined,
    requirement: AccessRequirement,
  ): AccessDecision | undefined {
    if (!this.options.rateLimit.enabled) return undefined

    const now = Date.now()
    const key = requestIdentity(request, principal)
    const existing = this.rateLimitBuckets.get(key)
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + this.options.rateLimit.windowMs } : existing
    bucket.count += 1
    this.rateLimitBuckets.set(key, bucket)

    if (bucket.count <= this.options.rateLimit.max) return undefined
    return this.denied(requirement, 'rate_limited', principal)
  }

  private requiredRoleRank(action: AccessAction): number {
    return action === 'admin' ? roleRank.admin : action === 'write' ? roleRank.writer : roleRank.reader
  }

  private denied(
    requirement: AccessRequirement,
    code: DeniedAccessDecision['code'],
    principal?: AccessPrincipal,
    hideTable: boolean = true,
  ): AccessDecision {
    this.audit(code, requirement, principal)
    if (code === 'authentication_required' || code === 'invalid_credentials') {
      return { allowed: false, status: 401, code }
    }
    if (code === 'rate_limited') return { allowed: false, status: 429, code }
    if (code === 'request_too_large') return { allowed: false, status: 413, code }
    if (code === 'query_too_complex') return { allowed: false, status: 400, code }
    const shouldHideTable = hideTable && Boolean(requirement.tableId || requirement.unresolvedTableScopedResource)
    return {
      allowed: false,
      status: shouldHideTable ? 404 : 403,
      code: shouldHideTable ? 'not_found' : code,
    }
  }

  private audit(outcome: string, requirement: AccessRequirement, principal?: AccessPrincipal): void {
    this.options.logger?.info('Access decision', {
      outcome,
      principalId: principal?.id || 'anonymous',
      role: principal?.role,
      endpoint: requirement.endpoint,
      action: requirement.action,
      tableId: requirement.tableId,
    })
  }
}

export interface ResolvedMcpRequestAccess {
  action: AccessAction
  tableId?: string
  scope?: 'global' | 'table'
}

export type McpToolActionResolver = (
  toolName: string,
  argumentsValue: unknown,
) => ResolvedMcpRequestAccess | undefined

export async function authorizeExternalRequest(
  control: AccessControl,
  request: Request,
  resolveMcpToolAction?: McpToolActionResolver,
  resourceResolver?: ExternalResourceAccessResolver,
): Promise<AccessDecision> {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (request.method === 'OPTIONS' || pathname === '/' || pathname === '/api/health') {
    return { allowed: true }
  }

  const tableMcpMatch = pathname.match(/^\/sub\/([^/]+)\/mcp\/?$/)
  const isMcp = pathname === '/mcp' || Boolean(tableMcpMatch)
  const isGraphql = pathname === '/graphql'
  const isSchema =
    pathname === '/schema' ||
    pathname.startsWith('/schema/') ||
    pathname === '/schema.json' ||
    pathname === '/introspection.json' ||
    pathname === '/introspection'
  const isApi = pathname.startsWith('/api/') || pathname === '/tabular-sync'

  // The policy is intentionally closed by default: a new external endpoint is
  // an admin operation until it receives an explicit classification below.
  if (!isMcp && !isGraphql && !isSchema && !isApi) {
    return control.authorize(request, { action: 'admin', endpoint: pathname, requiresGlobalScope: true })
  }

  const requestBytes = await requestSize(request)
  let action: AccessAction = isSchema ? 'admin' : 'read'
  let requestedTableIds = tableMcpMatch ? [decodeURIComponent(tableMcpMatch[1] || '')] : []
  let nodeIds: string[] = []
  let unresolvedTableScopedResource = false
  let requiresGlobalScope = isSchema
  let graphqlComplexity: number | undefined
  if (isMcp && request.method === 'POST') {
    try {
      const payload = (await request.clone().json()) as {
        method?: unknown
        params?: { name?: unknown; arguments?: unknown }
      }
      const toolName = typeof payload.params?.name === 'string' ? payload.params.name : undefined
      const toolAccess = toolName ? resolveMcpToolAction?.(toolName, payload.params?.arguments) : undefined
      action = payload.method === 'tools/call' ? toolAccess?.action || 'admin' : 'read'
      if (payload.method === 'tools/call' && toolAccess?.tableId) requestedTableIds = [toolAccess.tableId]
      requiresGlobalScope = Boolean(payload.method === 'tools/call' && toolAccess?.scope === 'global')
      nodeIds = collectNodeIds(payload.params?.arguments)
    } catch {
      action = 'admin'
      requiresGlobalScope = true
    }
  } else if (isGraphql && request.method === 'POST') {
    try {
      const payload = (await request.clone().json()) as { query?: unknown; variables?: unknown }
      if (typeof payload.query === 'string') {
        graphqlComplexity = estimateGraphqlComplexity(payload.query)
        const analysis = analyzeGraphqlRequest(payload.query, payload.variables)
        action = analysis.action
        requestedTableIds = analysis.tableIds
        nodeIds = analysis.nodeIds
        requiresGlobalScope = analysis.requiresGlobalScope
      } else {
        action = 'admin'
        requiresGlobalScope = true
      }
    } catch {
      action = 'admin'
      requiresGlobalScope = true
    }
  } else if (isApi) {
    const payload = await readJsonBody(request)
    const apiAccess = classifyApiAccess(request.method, pathname, url, payload)
    action = apiAccess.action
    requestedTableIds = apiAccess.tableIds
    nodeIds = apiAccess.nodeIds
    requiresGlobalScope = apiAccess.requiresGlobalScope
  }

  if (resourceResolver?.resolveNodeTableId && nodeIds.length > 0) {
    const resolved = await Promise.all(
      nodeIds.map(async (nodeId) => ({ nodeId, tableId: await resourceResolver.resolveNodeTableId?.(nodeId) })),
    )
    const resolvedTableIds = resolved.flatMap(({ tableId }) => (tableId ? [tableId] : []))
    requestedTableIds = uniqueStrings([...requestedTableIds, ...resolvedTableIds])
    unresolvedTableScopedResource = resolved.some(({ tableId }) => !tableId)
  }

  return control.authorize(request, {
    action,
    endpoint: pathname,
    tableId: requestedTableIds[0],
    tableIds: requestedTableIds,
    unresolvedTableScopedResource,
    requiresGlobalScope,
    requestBytes,
    graphqlComplexity,
  })
}

async function requestSize(request: Request): Promise<number> {
  const headerValue = request.headers.get('Content-Length')
  const contentLength = headerValue ? Number.parseInt(headerValue, 10) : Number.NaN
  if (Number.isSafeInteger(contentLength) && contentLength >= 0) return contentLength
  return (await request.clone().arrayBuffer()).byteLength
}

function estimateGraphqlComplexity(query: string): number {
  try {
    let complexity = 0
    visit(parse(query), {
      Field() {
        complexity += 1
      },
    })
    return complexity
  } catch {
    return 0
  }
}

function analyzeGraphqlRequest(
  query: string,
  variables: unknown,
): { action: AccessAction; tableIds: string[]; nodeIds: string[]; requiresGlobalScope: boolean } {
  const tableIds = new Set<string>()
  collectTableIds(variables, tableIds)
  const nodeIds = new Set<string>()
  let isMutation = false
  let healthCheckOnly = true
  let hasRootField = false
  let knownTableScopedMutation = false

  try {
    const document = parse(query)
    for (const definition of document.definitions) {
      if (definition.kind !== Kind.OPERATION_DEFINITION) continue
      isMutation ||= definition.operation === 'mutation'
      for (const selection of definition.selectionSet.selections) {
        if (selection.kind !== Kind.FIELD) {
          healthCheckOnly = false
          continue
        }
        hasRootField = true
        const fieldName = selection.name.value
        if (tableScopedMutationFields.has(fieldName)) knownTableScopedMutation = true
        if (fieldName !== 'healthCheck') healthCheckOnly = false
        for (const argument of selection.arguments || []) {
          const argumentValue = graphQlValueToUnknown(argument.value, variables)
          collectTableIds(argumentValue, tableIds)
          if (isTableIdKey(argument.name.value)) collectTableIds(argumentValue, tableIds, argument.name.value)
          if (isNodeIdKey(argument.name.value) || (rootNodeIdFields.has(fieldName) && argument.name.value === 'id')) {
            if (typeof argumentValue === 'string' && argumentValue.trim()) nodeIds.add(argumentValue.trim())
            else collectNodeIds(argumentValue, nodeIds)
          }
          collectNodeIds(argumentValue, nodeIds)
        }
      }
    }
  } catch {
    return { action: 'admin', tableIds: [], nodeIds: [], requiresGlobalScope: true }
  }

  const requestedTableIds = uniqueStrings([...tableIds])
  const requestedNodeIds = uniqueStrings([...nodeIds])
  const isGlobalOperation = requestedTableIds.length === 0 && requestedNodeIds.length === 0 && !(hasRootField && healthCheckOnly)
  return {
    // An unscoped mutation changes global state. A scoped mutation can be
    // performed by a writer after its resource/table ownership is checked.
    action: isMutation && isGlobalOperation && !knownTableScopedMutation ? 'admin' : isMutation ? 'write' : 'read',
    tableIds: requestedTableIds,
    nodeIds: requestedNodeIds,
    requiresGlobalScope: isGlobalOperation,
  }
}

function collectTableIds(value: unknown, tableIds: Set<string>, key?: string): void {
  if (typeof value === 'string' && key && isTableIdKey(key)) {
    tableIds.add(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectTableIds(item, tableIds, key)
    })
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [childKey, childValue] of Object.entries(value)) {
    collectTableIds(childValue, tableIds, childKey)
  }
}

function isTableIdKey(key: string): boolean {
  return key === 'tableId' || key === 'tableIdentifier' || key === 'targetTableId' || key === 'tableIds' || key === 'tableIdentifiers'
}

const rootNodeIdFields = new Set([
  'node',
  'deleteNode',
  'updateNode',
  'getNodeAttributes',
  'getConnectedNodes',
  'getNodeRelations',
])

const tableScopedMutationFields = new Set([
  'createNode',
  'createNodeWithAttributes',
  'createPersonNode',
  'updateNode',
  'deleteNode',
  'setNodeAttribute',
  'setNodeAttributes',
  'setNodeAttributesByIdentifier',
  'updateNodeAttributeValue',
  'removeNodeAttribute',
  'bulkSetNodeAttributes',
  'createRelation',
])

function isNodeIdKey(key: string): boolean {
  return key === 'nodeId' || key === 'sourceNodeId' || key === 'targetNodeId' || key === 'fromNodeId' || key === 'toNodeId'
}

function collectNodeIds(value: unknown, nodeIds: Set<string> = new Set(), key?: string): string[] {
  if (typeof value === 'string' && key && isNodeIdKey(key)) {
    nodeIds.add(value)
    return uniqueStrings([...nodeIds])
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectNodeIds(item, nodeIds, key)
    })
    return uniqueStrings([...nodeIds])
  }
  if (!value || typeof value !== 'object') return uniqueStrings([...nodeIds])
  for (const [childKey, childValue] of Object.entries(value)) {
    collectNodeIds(childValue, nodeIds, childKey)
  }
  return uniqueStrings([...nodeIds])
}

function graphQlValueToUnknown(value: ValueNode, variables: unknown): unknown {
  switch (value.kind) {
    case Kind.VARIABLE:
      return isRecord(variables) ? variables[value.name.value] : undefined
    case Kind.LIST:
      return value.values.map((item) => graphQlValueToUnknown(item, variables))
    case Kind.OBJECT:
      return Object.fromEntries(value.fields.map((field) => [field.name.value, graphQlValueToUnknown(field.value, variables)]))
    case Kind.NULL:
      return null
    case Kind.BOOLEAN:
      return value.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(value.value)
    case Kind.STRING:
    case Kind.ENUM:
      return value.value
    default:
      return undefined
  }
}

function classifyApiAccess(
  method: string,
  pathname: string,
  url: URL,
  body: unknown,
): { action: AccessAction; tableIds: string[]; nodeIds: string[]; requiresGlobalScope: boolean } {
  const tableIds = new Set<string>()
  collectTableIds(body, tableIds)
  url.searchParams.forEach((value, key) => {
    collectTableIds(value, tableIds, key)
  })
  const nodeIds = new Set<string>(collectNodeIds(body))
  const nodePathMatch = pathname.match(/^\/api\/nodes\/([^/]+)(?:\/|$)/)
  if (nodePathMatch?.[1] && !['search', 'shortest-path'].includes(nodePathMatch[1])) {
    nodeIds.add(decodeURIComponent(nodePathMatch[1]))
  }
  const tablePathMatch = pathname.match(/^\/api\/tables\/([^/]+)(?:\/|$)/)
  if (tablePathMatch?.[1] && !['search', 'docs'].includes(tablePathMatch[1])) {
    tableIds.add(decodeURIComponent(tablePathMatch[1]))
  }

  const isAdminRoute =
    pathname === '/tabular-sync' ||
    pathname.startsWith('/api/tabular-sync') ||
    pathname.startsWith('/api/mcp-tools') ||
    pathname === '/api/openapi' ||
    pathname === '/api/stats' ||
    pathname.startsWith('/api/template-files') ||
    pathname.startsWith('/api/templates') ||
    (pathname === '/api/tables' && method !== 'GET')
  if (isAdminRoute) return { action: 'admin', tableIds: [], nodeIds: [], requiresGlobalScope: true }

  const safeMethod = method === 'GET' || method === 'HEAD'
  const requestedTableIds = uniqueStrings([...tableIds])
  const requestedNodeIds = uniqueStrings([...nodeIds])
  const hasScope = requestedTableIds.length > 0 || requestedNodeIds.length > 0
  return {
    action: safeMethod ? 'read' : hasScope ? 'write' : 'admin',
    tableIds: requestedTableIds,
    nodeIds: requestedNodeIds,
    requiresGlobalScope: !hasScope,
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return undefined
  try {
    return await request.clone().json()
  } catch {
    return undefined
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
