/**
 * JSON-RPC 2.0 Message Handler for MCP 2025-06-18
 *
 * Implements strict JSON-RPC 2.0 compliance with:
 * - Request/Response/Notification handling
 * - Error handling and validation
 * - Batch request support
 * - MCP-specific error codes
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  SecurityContext,
} from "../types/McpTypes.js";
import { McpError, McpErrorCode } from "../types/McpTypes.js";

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;
export type JsonRpcRequestHandler = (
  request: JsonRpcRequest,
  context: SecurityContext
) => Promise<JsonRpcResponse>;
export type JsonRpcNotificationHandler = (
  notification: JsonRpcNotification,
  context: SecurityContext
) => Promise<void>;

export interface JsonRpcHandlerConfig {
  maxBatchSize: number;
  timeout: number;
  enableNotifications: boolean;
  validateParams: boolean;
  logRequests: boolean;
}

export class JsonRpcHandler {
  private requestHandlers = new Map<string, JsonRpcRequestHandler>();
  private notificationHandlers = new Map<string, JsonRpcNotificationHandler>();
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private requestCounter = 0;

  constructor(private config: JsonRpcHandlerConfig) {}

  /**
   * Register a request handler for a specific method
   */
  onRequest(method: string, handler: JsonRpcRequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Register a notification handler for a specific method
   */
  onNotification(method: string, handler: JsonRpcNotificationHandler): void {
    if (!this.config.enableNotifications) {
      throw new Error("Notifications are disabled in configuration");
    }
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Handle incoming JSON-RPC message
   */
  async handleMessage(
    message: string | object,
    context: SecurityContext
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    try {
      const parsed = typeof message === "string" ? JSON.parse(message) : message;

      // Handle batch requests
      if (Array.isArray(parsed)) {
        return await this.handleBatch(parsed, context);
      }

      // Handle single message
      return await this.handleSingleMessage(parsed, context);
    } catch (error) {
      return this.createErrorResponse(null, McpErrorCode.PARSE_ERROR, "Parse error", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle batch requests
   */
  private async handleBatch(
    messages: unknown[],
    context: SecurityContext
  ): Promise<JsonRpcResponse[]> {
    if (messages.length === 0) {
      return [this.createErrorResponse(null, McpErrorCode.INVALID_REQUEST, "Empty batch request")];
    }

    if (messages.length > this.config.maxBatchSize) {
      return [
        this.createErrorResponse(
          null,
          McpErrorCode.INVALID_REQUEST,
          `Batch size exceeds maximum of ${this.config.maxBatchSize}`
        ),
      ];
    }

    const results = await Promise.allSettled(
      messages.map(msg => this.handleSingleMessage(msg, context))
    );

    return results
      .map(result => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          return this.createErrorResponse(
            null,
            McpErrorCode.INTERNAL_ERROR,
            "Batch item processing failed",
            { error: result.reason }
          );
        }
      })
      .filter((response): response is JsonRpcResponse => response !== null);
  }

  /**
   * Handle single JSON-RPC message
   */
  private async handleSingleMessage(
    message: unknown,
    context: SecurityContext
  ): Promise<JsonRpcResponse | null> {
    // Validate basic JSON-RPC structure
    if (!this.isValidJsonRpcMessage(message)) {
      return this.createErrorResponse(null, McpErrorCode.INVALID_REQUEST, "Invalid JSON-RPC message");
    }

    const msg = message as JsonRpcMessage;

    // Handle notifications (no response required)
    if (this.isNotification(msg)) {
      await this.handleNotification(msg as JsonRpcNotification, context);
      return null;
    }

    // Handle requests
    if (this.isRequest(msg)) {
      return await this.handleRequest(msg as JsonRpcRequest, context);
    }

    // Handle responses (for client-side usage)
    if (this.isResponse(msg)) {
      this.handleResponse(msg as JsonRpcResponse);
      return null;
    }

    return this.createErrorResponse(null, McpErrorCode.INVALID_REQUEST, "Unknown message type");
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleRequest(request: JsonRpcRequest, context: SecurityContext): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
      // Find handler
      const handler = this.requestHandlers.get(method);
      if (!handler) {
        return this.createErrorResponse(
          id,
          McpErrorCode.METHOD_NOT_FOUND,
          `Method '${method}' not found`
        );
      }

      // Validate parameters if enabled
      if (this.config.validateParams && params !== undefined) {
        if (!this.validateParams(method, params)) {
          return this.createErrorResponse(
            id,
            McpErrorCode.INVALID_PARAMS,
            `Invalid parameters for method '${method}'`
          );
        }
      }

      // Log request if enabled
      if (this.config.logRequests) {
        console.log(`[JSON-RPC] Request: ${method}`, { id, params });
      }

      // Execute handler with timeout
      const result = await this.executeWithTimeout(
        () => handler(request, context),
        this.config.timeout
      );

      return {
        jsonrpc: "2.0",
        id,
        result: result.result,
      };
    } catch (error) {
      return this.handleError(id, error);
    }
  }

  /**
   * Handle JSON-RPC notification
   */
  private async handleNotification(notification: JsonRpcNotification, context: SecurityContext): Promise<void> {
    const { method, params } = notification;

    try {
      const handler = this.notificationHandlers.get(method);
      if (!handler) {
        // Notifications don't return errors, just log
        console.warn(`[JSON-RPC] Unknown notification method: ${method}`);
        return;
      }

      if (this.config.logRequests) {
        console.log(`[JSON-RPC] Notification: ${method}`, { params });
      }

      await handler(notification, context);
    } catch (error) {
      // Notifications don't return errors, just log
      console.error(`[JSON-RPC] Notification handler error for ${method}:`, error);
    }
  }

  /**
   * Handle JSON-RPC response (for client-side usage)
   */
  private handleResponse(response: JsonRpcResponse): void {
    const { id } = response;
    if (id === null) return; // Skip responses with null id

    const pending = this.pendingRequests.get(id);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(id);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  /**
   * Send a JSON-RPC request (for client-side usage)
   */
  async sendRequest(method: string, params?: unknown, timeout?: number): Promise<unknown> {
    const id = ++this.requestCounter;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.config.timeout;
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // In a real implementation, you would send the request here
      // This is just the structure for handling responses
    });
  }

  /**
   * Send a JSON-RPC notification (for client-side usage)
   */
  sendNotification(method: string, params?: unknown): JsonRpcNotification {
    return {
      jsonrpc: "2.0",
      method,
      params,
    };
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout<T>(
    handler: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Handler timeout after ${timeout}ms`));
      }, timeout);

      handler()
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  /**
   * Handle errors and convert to JSON-RPC error response
   */
  private handleError(id: string | number | null, error: unknown): JsonRpcResponse {
    if (error instanceof McpError) {
      return this.createErrorResponse(id, error.code, error.message, error.data);
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("timeout")) {
        return this.createErrorResponse(id, McpErrorCode.INTERNAL_ERROR, "Request timeout");
      }

      if (error.message.includes("permission") || error.message.includes("unauthorized")) {
        return this.createErrorResponse(id, McpErrorCode.SECURITY_VIOLATION, error.message);
      }

      return this.createErrorResponse(id, McpErrorCode.INTERNAL_ERROR, error.message);
    }

    return this.createErrorResponse(
      id,
      McpErrorCode.INTERNAL_ERROR,
      "Unknown error occurred",
      { originalError: String(error) }
    );
  }

  /**
   * Create JSON-RPC error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: McpErrorCode,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Validate JSON-RPC message structure
   */
  private isValidJsonRpcMessage(message: unknown): boolean {
    if (typeof message !== "object" || message === null) {
      return false;
    }

    const msg = message as any;
    return msg.jsonrpc === "2.0" && typeof msg.method === "string";
  }

  /**
   * Check if message is a request
   */
  private isRequest(message: JsonRpcMessage): boolean {
    return "id" in message && "method" in message;
  }

  /**
   * Check if message is a notification
   */
  private isNotification(message: JsonRpcMessage): boolean {
    return "method" in message && !("id" in message);
  }

  /**
   * Check if message is a response
   */
  private isResponse(message: JsonRpcMessage): boolean {
    return "id" in message && !("method" in message) && ("result" in message || "error" in message);
  }

  /**
   * Validate parameters (to be implemented based on method schemas)
   */
  private validateParams(method: string, params: unknown): boolean {
    // This would typically validate against JSON schemas
    // For now, basic validation
    return params !== null;
  }

  /**
   * Clean up pending requests
   */
  dispose(): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Handler disposed"));
    }
    this.pendingRequests.clear();
  }

  /**
   * Get handler statistics
   */
  getStats(): {
    requestHandlers: number;
    notificationHandlers: number;
    pendingRequests: number;
  } {
    return {
      requestHandlers: this.requestHandlers.size,
      notificationHandlers: this.notificationHandlers.size,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

/**
 * Default JSON-RPC handler configuration
 */
export const defaultJsonRpcConfig: JsonRpcHandlerConfig = {
  maxBatchSize: 10,
  timeout: 30000, // 30 seconds
  enableNotifications: true,
  validateParams: true,
  logRequests: false, // Enable in development
};

/**
 * Create a configured JSON-RPC handler
 */
export function createJsonRpcHandler(config?: Partial<JsonRpcHandlerConfig>): JsonRpcHandler {
  return new JsonRpcHandler({ ...defaultJsonRpcConfig, ...config });
}