/**
 * T015: McpSession model
 *
 * Purpose: Represents an active MCP client connection
 * Based On: data-model.md McpSession specification
 */

import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export interface ClientInfo {
  name: string
  version: string
}

export interface ClientCapabilities {
  tools?: boolean
  resources?: boolean
  prompts?: boolean
  logging?: boolean
}

export type SessionState = 'initializing' | 'negotiated' | 'active' | 'idle' | 'closed'

export interface McpSession {
  sessionId: string
  clientInfo: ClientInfo
  capabilities: ClientCapabilities
  createdAt: Date
  lastActivity: Date
  state: SessionState
  protocolVersion?: string
  metadata?: Record<string, SafeJsonValue>
}

export interface SessionStateTransition {
  from: SessionState
  to: SessionState
  timestamp: Date
  reason?: string
}

export class McpSessionBuilder {
  private session: Partial<McpSession> = {}

  constructor() {
    this.session.createdAt = new Date()
    this.session.lastActivity = new Date()
    this.session.state = 'initializing'
  }

  withSessionId(sessionId: string): McpSessionBuilder {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID cannot be empty')
    }
    this.session.sessionId = sessionId.trim()
    return this
  }

  withClientInfo(clientInfo: ClientInfo): McpSessionBuilder {
    if (!clientInfo) {
      throw new Error('Client info is required')
    }
    if (!clientInfo.name || clientInfo.name.trim().length === 0) {
      throw new Error('Client name cannot be empty')
    }
    if (!clientInfo.version || clientInfo.version.trim().length === 0) {
      throw new Error('Client version cannot be empty')
    }

    this.session.clientInfo = {
      name: clientInfo.name.trim(),
      version: clientInfo.version.trim(),
    }
    return this
  }

  withCapabilities(capabilities: ClientCapabilities): McpSessionBuilder {
    this.session.capabilities = capabilities || {}
    return this
  }

  withProtocolVersion(version: string): McpSessionBuilder {
    if (version && version.trim().length > 0) {
      this.session.protocolVersion = version.trim()
    }
    return this
  }

  withMetadata(metadata: Record<string, SafeJsonValue>): McpSessionBuilder {
    this.session.metadata = metadata || {}
    return this
  }

  build(): McpSession {
    if (!this.session.sessionId) {
      throw new Error('Session ID is required')
    }
    if (!this.session.clientInfo) {
      throw new Error('Client info is required')
    }
    if (!this.session.capabilities) {
      this.session.capabilities = {}
    }

    return this.session as McpSession
  }
}

export class McpSessionManager {
  private sessions: Map<string, McpSession> = new Map()
  private stateTransitions: Map<string, SessionStateTransition[]> = new Map()
  private readonly idleTimeoutMs: number
  private readonly maxSessions: number

  constructor(idleTimeoutMs: number = 30 * 60 * 1000, maxSessions: number = 100) {
    this.idleTimeoutMs = idleTimeoutMs
    this.maxSessions = maxSessions
  }

  create(sessionData: Omit<McpSession, 'createdAt' | 'lastActivity' | 'state'>): McpSession {
    if (this.sessions.size >= this.maxSessions) {
      // Clean up idle sessions first
      this.cleanupIdleSessions()

      if (this.sessions.size >= this.maxSessions) {
        throw new Error('Maximum number of sessions reached')
      }
    }

    const session = new McpSessionBuilder()
      .withSessionId(sessionData.sessionId)
      .withClientInfo(sessionData.clientInfo)
      .withCapabilities(sessionData.capabilities)
      .withProtocolVersion(sessionData.protocolVersion || '1.0')
      .withMetadata(sessionData.metadata || {})
      .build()

    this.sessions.set(session.sessionId, session)
    this.stateTransitions.set(session.sessionId, [])

    return session
  }

  get(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.updateLastActivity(sessionId)
    }
    return session
  }

  exists(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  updateLastActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastActivity = new Date()
    }
  }

  transitionState(sessionId: string, newState: SessionState, reason?: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    const oldState = session.state

    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      throw new Error(`Invalid state transition from ${oldState} to ${newState}`)
    }

    session.state = newState
    session.lastActivity = new Date()

    // Record transition
    const transitions = this.stateTransitions.get(sessionId) || []
    transitions.push({
      from: oldState,
      to: newState,
      timestamp: new Date(),
      reason,
    })
    this.stateTransitions.set(sessionId, transitions)

    // Auto-close sessions that transition to closed
    if (newState === 'closed') {
      this.close(sessionId)
    }

    return true
  }

  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.state = 'closed'
    session.lastActivity = new Date()

    // Clean up
    this.sessions.delete(sessionId)
    this.stateTransitions.delete(sessionId)

    return true
  }

  getActiveSessions(): McpSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.state !== 'closed')
  }

  getSessionsByState(state: SessionState): McpSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.state === state)
  }

  getSessionHistory(sessionId: string): SessionStateTransition[] {
    return this.stateTransitions.get(sessionId) || []
  }

  cleanupIdleSessions(): number {
    const now = new Date()
    const sessionsToClose: string[] = []

    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime()

      if (timeSinceLastActivity > this.idleTimeoutMs) {
        sessionsToClose.push(sessionId)
      }
    }

    sessionsToClose.forEach((sessionId) => {
      this.transitionState(sessionId, 'idle', 'Inactivity timeout')
      this.close(sessionId)
    })

    return sessionsToClose.length
  }

  getStats(): {
    total: number
    byState: Record<SessionState, number>
    oldestSession: Date | null
    newestSession: Date | null
  } {
    const sessions = Array.from(this.sessions.values())
    const byState: Record<SessionState, number> = {
      initializing: 0,
      negotiated: 0,
      active: 0,
      idle: 0,
      closed: 0,
    }

    sessions.forEach((session) => {
      byState[session.state]++
    })

    const creationTimes = sessions.map((s) => s.createdAt)

    return {
      total: sessions.length,
      byState,
      oldestSession: creationTimes.length > 0 ? new Date(Math.min(...creationTimes.map((d) => d.getTime()))) : null,
      newestSession: creationTimes.length > 0 ? new Date(Math.max(...creationTimes.map((d) => d.getTime()))) : null,
    }
  }

  private isValidTransition(from: SessionState, to: SessionState): boolean {
    const validTransitions: Record<SessionState, SessionState[]> = {
      initializing: ['negotiated', 'closed'],
      negotiated: ['active', 'closed'],
      active: ['idle', 'closed'],
      idle: ['active', 'closed'],
      closed: [], // No transitions from closed
    }

    return validTransitions[from]?.includes(to) || false
  }
}

export function generateMcpSessionId(): string {
  return `mcp-session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

export function createMcpSession(
  clientInfo: ClientInfo,
  capabilities: ClientCapabilities,
  protocolVersion?: string,
  metadata?: Record<string, SafeJsonValue>,
): McpSession {
  return new McpSessionBuilder()
    .withSessionId(generateMcpSessionId())
    .withClientInfo(clientInfo)
    .withCapabilities(capabilities)
    .withProtocolVersion(protocolVersion || '1.0')
    .withMetadata(metadata || {})
    .build()
}

export function validateMcpClientInfo(clientInfo: unknown): ClientInfo {
  if (!isRecord(clientInfo)) {
    throw new Error('Client info must be an object')
  }

  if (!clientInfo.name || typeof clientInfo.name !== 'string' || clientInfo.name.trim().length === 0) {
    throw new Error('Client name is required and must be a non-empty string')
  }

  if (!clientInfo.version || typeof clientInfo.version !== 'string' || clientInfo.version.trim().length === 0) {
    throw new Error('Client version is required and must be a non-empty string')
  }

  return {
    name: clientInfo.name.trim(),
    version: clientInfo.version.trim(),
  }
}

export function validateMcpClientCapabilities(capabilities: unknown): ClientCapabilities {
  if (!isRecord(capabilities)) {
    return {}
  }

  const result: ClientCapabilities = {}

  if (capabilities.tools !== undefined) {
    result.tools = Boolean(capabilities.tools)
  }
  if (capabilities.resources !== undefined) {
    result.resources = Boolean(capabilities.resources)
  }
  if (capabilities.prompts !== undefined) {
    result.prompts = Boolean(capabilities.prompts)
  }
  if (capabilities.logging !== undefined) {
    result.logging = Boolean(capabilities.logging)
  }

  return result
}

export function isMcpSessionExpired(session: McpSession, timeoutMs: number): boolean {
  const now = new Date()
  const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime()
  return timeSinceLastActivity > timeoutMs
}

export function formatMcpSessionInfo(session: McpSession): string {
  return `Session ${session.sessionId} (${session.clientInfo.name} v${session.clientInfo.version}) - ${session.state}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
