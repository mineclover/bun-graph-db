/**
 * MCP 2025-06-18 TypeScript Types
 *
 * Complete type definitions for the Model Context Protocol specification
 * including JSON-RPC 2.0, Streamable HTTP transport, and security features
 */

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

// =============================================================================
// MCP Core Protocol Types
// =============================================================================

export interface McpInitializeRequest {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface McpInitializeResponse {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  sampling?: object;
  roots?: {
    listChanged?: boolean;
  };
}

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: object;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  streaming?: StreamingCapabilities;
}

export interface StreamingCapabilities {
  streamableHttp?: boolean;
  webSocket?: boolean;
  compression?: string[];
  maxFrameSize?: number;
}

// =============================================================================
// MCP Tool Types
// =============================================================================

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResult {
  content?: McpContent[];
  isError?: boolean;
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  $ref?: string;
  $schema?: string;
  $id?: string;
  title?: string;
  examples?: unknown[];
  default?: unknown;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
}

// =============================================================================
// MCP Resource Types
// =============================================================================

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// =============================================================================
// MCP Content Types
// =============================================================================

export type McpContent = McpTextContent | McpImageContent | McpResourceContent;

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface McpResourceContent {
  type: "resource";
  resource: {
    uri: string;
    text?: string;
    mimeType?: string;
  };
}

// =============================================================================
// MCP Prompt Types
// =============================================================================

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPromptMessage {
  role: "user" | "assistant";
  content: McpContent;
}

// =============================================================================
// MCP Logging Types
// =============================================================================

export type McpLogLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

export interface McpLogMessage {
  level: McpLogLevel;
  data?: unknown;
  logger?: string;
}

// =============================================================================
// MCP Root Types
// =============================================================================

export interface McpRoot {
  uri: string;
  name?: string;
}

// =============================================================================
// MCP Notification Types
// =============================================================================

export interface McpCancelledNotification {
  requestId: string | number;
  reason?: string;
}

export interface McpProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
}

// =============================================================================
// Streamable HTTP Types (MCP 2025 Standard)
// =============================================================================

export interface StreamableHttpTransport {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
  compression?: "gzip" | "deflate" | "br";
  upgradeToStreaming?: boolean;
}

export interface StreamableHttpFrame {
  type: "data" | "control" | "error" | "close";
  id?: string;
  payload?: unknown;
  error?: StreamableHttpError;
}

export interface StreamableHttpError {
  code: string;
  message: string;
  details?: unknown;
}

export interface StreamableHttpUpgrade {
  protocol: "websocket" | "http2" | "http3";
  capabilities: StreamingCapabilities;
}

// =============================================================================
// Security and Consent Types (MCP 2025-06-18)
// =============================================================================

export interface ConsentRequest {
  toolName: string;
  operation: string;
  description: string;
  dataAccess?: DataAccessRequest;
  riskLevel: "low" | "medium" | "high";
  userContext?: Record<string, unknown>;
}

export interface ConsentResponse {
  approved: boolean;
  restrictions?: ConsentRestriction[];
  expiresAt?: Date;
  auditLog?: boolean;
}

export interface ConsentRestriction {
  type: "data_limit" | "operation_limit" | "time_limit" | "scope_limit";
  value: unknown;
  description: string;
}

export interface DataAccessRequest {
  scope: string[];
  purpose: string;
  retention?: string;
  sharing?: boolean;
  sensitiveData?: boolean;
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  permissions: string[];
  trustLevel: "untrusted" | "basic" | "elevated" | "admin";
  auditEnabled: boolean;
}

// =============================================================================
// Elicitation Feature Types (MCP 2025-06-18)
// =============================================================================

export interface ElicitationRequest {
  type: "clarification" | "confirmation" | "selection" | "input";
  prompt: string;
  options?: ElicitationOption[];
  defaultValue?: unknown;
  required?: boolean;
  context?: Record<string, unknown>;
}

export interface ElicitationOption {
  value: unknown;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface ElicitationResponse {
  value: unknown;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// GraphQL Integration Types
// =============================================================================

export interface GraphQLMcpContext {
  tools: McpTool[];
  resources: McpResource[];
  executeTemplate: (identifier: string, variables?: Record<string, unknown>) => Promise<unknown>;
  securityContext: SecurityContext;
  consentManager: ConsentManager;
}

export interface ConsentManager {
  requestConsent(request: ConsentRequest): Promise<ConsentResponse>;
  checkPermission(toolName: string, operation: string): Promise<boolean>;
  auditLog(event: AuditEvent): Promise<void>;
  revokeConsent(toolName: string): Promise<void>;
}

export interface AuditEvent {
  timestamp: Date;
  userId?: string;
  toolName: string;
  operation: string;
  result: "success" | "failure" | "denied";
  dataAccessed?: string[];
  error?: string;
}

// =============================================================================
// WebTransport Future-Proofing Types
// =============================================================================

export interface WebTransportConnection {
  ready: Promise<void>;
  closed: Promise<void>;
  close: (closeInfo?: { closeCode?: number; reason?: string }) => Promise<void>;
  createBidirectionalStream(): Promise<WebTransportBidirectionalStream>;
  createUnidirectionalStream(): Promise<WebTransportSendStream>;
  incomingBidirectionalStreams: ReadableStream<WebTransportBidirectionalStream>;
  incomingUnidirectionalStreams: ReadableStream<WebTransportReceiveStream>;
  datagrams: {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  };
}

export interface WebTransportBidirectionalStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

export interface WebTransportSendStream extends WritableStream<Uint8Array> {}
export interface WebTransportReceiveStream extends ReadableStream<Uint8Array> {}

// =============================================================================
// Error Types
// =============================================================================

export enum McpErrorCode {
  // Standard JSON-RPC errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // MCP-specific errors
  TOOL_NOT_FOUND = -32000,
  RESOURCE_NOT_FOUND = -32001,
  CONSENT_DENIED = -32002,
  SECURITY_VIOLATION = -32003,
  STREAMING_ERROR = -32004,
  CAPABILITY_NOT_SUPPORTED = -32005,
}

export class McpError extends Error {
  constructor(
    public code: McpErrorCode,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }

  toJsonRpc(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

// =============================================================================
// Type Guards
// =============================================================================

export function isJsonRpcRequest(obj: unknown): obj is JsonRpcRequest {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "jsonrpc" in obj &&
    (obj as any).jsonrpc === "2.0" &&
    "method" in obj &&
    typeof (obj as any).method === "string"
  );
}

export function isJsonRpcResponse(obj: unknown): obj is JsonRpcResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "jsonrpc" in obj &&
    (obj as any).jsonrpc === "2.0" &&
    ("result" in obj || "error" in obj)
  );
}

export function isJsonRpcNotification(obj: unknown): obj is JsonRpcNotification {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "jsonrpc" in obj &&
    (obj as any).jsonrpc === "2.0" &&
    "method" in obj &&
    typeof (obj as any).method === "string" &&
    !("id" in obj)
  );
}

export function isMcpError(obj: unknown): obj is McpError {
  return obj instanceof McpError;
}