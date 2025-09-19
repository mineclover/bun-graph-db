/**
 * MCP Server Configuration with Capability Negotiation
 *
 * Implements MCP 2025-06-18 specification with:
 * - JSON-RPC 2.0 compliance
 * - Streamable HTTP transport
 * - Security and consent framework
 * - Capability negotiation
 */

import type {
  ServerCapabilities,
  StreamingCapabilities,
  SecurityContext,
  ConsentRequest,
  ConsentResponse,
} from "../types/McpTypes.js";

export interface McpServerConfig {
  serverInfo: {
    name: string;
    version: string;
    description?: string;
  };
  transport: McpTransportConfig;
  capabilities: ServerCapabilities;
  security: McpSecurityConfig;
  logging: McpLoggingConfig;
  performance: McpPerformanceConfig;
}

export interface McpTransportConfig {
  // Streamable HTTP (primary transport for MCP 2025)
  streamableHttp: {
    enabled: boolean;
    port: number;
    host: string;
    path: string;
    compression: ("gzip" | "deflate" | "br")[];
    maxFrameSize: number;
    upgradeTimeout: number;
    keepAlive: boolean;
    cors?: {
      enabled: boolean;
      origins: string[];
      methods: string[];
      headers: string[];
    };
  };

  // WebSocket fallback
  webSocket: {
    enabled: boolean;
    port?: number;
    path: string;
    maxPayloadLength: number;
    pingInterval: number;
    pongTimeout: number;
  };

  // WebTransport (future-proofing for HTTP/3)
  webTransport: {
    enabled: boolean;
    port?: number;
    certificate?: {
      cert: string;
      key: string;
    };
  };
}

export interface McpSecurityConfig {
  consent: {
    enabled: boolean;
    defaultApproval: boolean;
    auditLogging: boolean;
    consentTimeout: number;
    persistConsent: boolean;
  };

  authentication: {
    enabled: boolean;
    methods: ("api_key" | "oauth2" | "jwt" | "mutual_tls")[];
    apiKeys?: string[];
    jwtSecret?: string;
    oauthConfig?: {
      clientId: string;
      clientSecret: string;
      authUrl: string;
      tokenUrl: string;
    };
  };

  authorization: {
    enabled: boolean;
    defaultRole: "guest" | "user" | "admin";
    rolePermissions: Record<string, string[]>;
  };

  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };

  dataProtection: {
    encryptSensitiveData: boolean;
    logSanitization: boolean;
    dataRetentionDays: number;
  };
}

export interface McpLoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  destinations: ("console" | "file" | "network")[];
  file?: {
    path: string;
    maxSize: string;
    maxFiles: number;
  };
  network?: {
    url: string;
    headers?: Record<string, string>;
  };
  sanitizeParams: boolean;
  includeStackTrace: boolean;
}

export interface McpPerformanceConfig {
  streaming: {
    targetLatency: number; // <25ms for Streamable HTTP
    bufferSize: number;
    compressionThreshold: number;
    heartbeatInterval: number;
  };

  tools: {
    timeout: number;
    maxConcurrentCalls: number;
    cacheResults: boolean;
    cacheTtl: number;
  };

  resources: {
    maxSize: number;
    compressionEnabled: boolean;
    streamingEnabled: boolean;
  };

  memory: {
    maxHeapSize: string;
    gcInterval: number;
    enableProfiling: boolean;
  };
}

/**
 * Default MCP Server Configuration for Bun Graph Database
 */
export const defaultMcpConfig: McpServerConfig = {
  serverInfo: {
    name: "bun-graph-db-mcp-server",
    version: "1.0.0",
    description: "MCP Server for Bun Graph Database with GraphQL integration",
  },

  transport: {
    streamableHttp: {
      enabled: true,
      port: 3001,
      host: "0.0.0.0",
      path: "/mcp",
      compression: ["gzip", "br"],
      maxFrameSize: 64 * 1024, // 64KB
      upgradeTimeout: 5000,
      keepAlive: true,
      cors: {
        enabled: true,
        origins: ["*"], // Configure appropriately for production
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        headers: ["Content-Type", "Authorization", "X-MCP-Version"],
      },
    },

    webSocket: {
      enabled: true,
      path: "/mcp/ws",
      maxPayloadLength: 16 * 1024 * 1024, // 16MB
      pingInterval: 30000,
      pongTimeout: 5000,
    },

    webTransport: {
      enabled: false, // Enable when HTTP/3 support is ready
      port: 3002,
    },
  },

  capabilities: {
    experimental: {
      streamableHttp: true,
      graphqlIntegration: true,
      templateExecution: true,
    },

    logging: {},

    prompts: {
      listChanged: true,
    },

    resources: {
      subscribe: true,
      listChanged: true,
    },

    tools: {
      listChanged: true,
    },

    streaming: {
      streamableHttp: true,
      webSocket: true,
      compression: ["gzip", "br"],
      maxFrameSize: 64 * 1024,
    },
  },

  security: {
    consent: {
      enabled: true,
      defaultApproval: false,
      auditLogging: true,
      consentTimeout: 300000, // 5 minutes
      persistConsent: true,
    },

    authentication: {
      enabled: false, // Start with disabled for development
      methods: ["api_key"],
    },

    authorization: {
      enabled: true,
      defaultRole: "user",
      rolePermissions: {
        guest: ["healthCheck", "systemStats"],
        user: ["healthCheck", "systemStats", "searchNodes", "searchTemplates", "executeTemplate"],
        admin: ["*"], // All permissions
      },
    },

    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
    },

    dataProtection: {
      encryptSensitiveData: false, // Enable in production
      logSanitization: true,
      dataRetentionDays: 30,
    },
  },

  logging: {
    level: "info",
    destinations: ["console"],
    sanitizeParams: true,
    includeStackTrace: true,
  },

  performance: {
    streaming: {
      targetLatency: 25, // 25ms target for Streamable HTTP
      bufferSize: 8192,
      compressionThreshold: 1024,
      heartbeatInterval: 30000,
    },

    tools: {
      timeout: 30000, // 30 seconds
      maxConcurrentCalls: 10,
      cacheResults: true,
      cacheTtl: 300000, // 5 minutes
    },

    resources: {
      maxSize: 10 * 1024 * 1024, // 10MB
      compressionEnabled: true,
      streamingEnabled: true,
    },

    memory: {
      maxHeapSize: "512MB",
      gcInterval: 60000, // 1 minute
      enableProfiling: false,
    },
  },
};

/**
 * Environment-specific configuration overrides
 */
export function getMcpConfig(environment: "development" | "test" | "production" = "development"): McpServerConfig {
  const config = { ...defaultMcpConfig };

  switch (environment) {
    case "development":
      config.logging.level = "debug";
      config.logging.destinations = ["console"];
      config.security.authentication.enabled = false;
      config.security.consent.defaultApproval = true; // For easier development
      break;

    case "test":
      config.transport.streamableHttp.port = 0; // Random port
      config.transport.webSocket.enabled = false;
      config.logging.level = "error";
      config.logging.destinations = [];
      config.security.rateLimit.enabled = false;
      break;

    case "production":
      config.logging.level = "warn";
      config.logging.destinations = ["file", "network"];
      config.security.authentication.enabled = true;
      config.security.consent.defaultApproval = false;
      config.security.dataProtection.encryptSensitiveData = true;
      config.performance.memory.enableProfiling = true;
      config.transport.streamableHttp.cors!.origins = []; // Configure specific origins
      break;
  }

  return config;
}

/**
 * Configuration validation
 */
export function validateMcpConfig(config: McpServerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate server info
  if (!config.serverInfo.name || config.serverInfo.name.trim() === "") {
    errors.push("Server name is required");
  }

  if (!config.serverInfo.version || config.serverInfo.version.trim() === "") {
    errors.push("Server version is required");
  }

  // Validate transport
  if (!config.transport.streamableHttp.enabled && !config.transport.webSocket.enabled) {
    errors.push("At least one transport method must be enabled");
  }

  if (config.transport.streamableHttp.enabled) {
    if (config.transport.streamableHttp.port < 1 || config.transport.streamableHttp.port > 65535) {
      errors.push("Streamable HTTP port must be between 1 and 65535");
    }

    if (config.transport.streamableHttp.maxFrameSize < 1024) {
      errors.push("Max frame size must be at least 1024 bytes");
    }
  }

  // Validate performance targets
  if (config.performance.streaming.targetLatency > 100) {
    errors.push("Target latency should be <= 100ms for optimal performance");
  }

  // Validate security settings
  if (config.security.consent.enabled && config.security.consent.consentTimeout < 10000) {
    errors.push("Consent timeout should be at least 10 seconds");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Capability negotiation helper
 */
export function negotiateCapabilities(
  serverCapabilities: ServerCapabilities,
  clientCapabilities: any
): ServerCapabilities {
  const negotiated: ServerCapabilities = { ...serverCapabilities };

  // Adjust streaming capabilities based on client support
  if (negotiated.streaming && clientCapabilities.streaming) {
    negotiated.streaming.streamableHttp =
      negotiated.streaming.streamableHttp && clientCapabilities.streaming.streamableHttp;

    negotiated.streaming.webSocket =
      negotiated.streaming.webSocket && clientCapabilities.streaming.webSocket;

    // Find common compression methods
    if (negotiated.streaming.compression && clientCapabilities.streaming.compression) {
      negotiated.streaming.compression = negotiated.streaming.compression.filter(
        (method: string) => clientCapabilities.streaming.compression.includes(method)
      );
    }

    // Use minimum frame size
    if (negotiated.streaming.maxFrameSize && clientCapabilities.streaming.maxFrameSize) {
      negotiated.streaming.maxFrameSize = Math.min(
        negotiated.streaming.maxFrameSize,
        clientCapabilities.streaming.maxFrameSize
      );
    }
  }

  return negotiated;
}

export default defaultMcpConfig;