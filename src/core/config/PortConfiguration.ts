/**
 * Port Configuration Management for Bun Graph DB
 *
 * Port Allocation Rules:
 * - HTTP/GraphQL Server: Base port (default: 4000)
 * - WebSocket Server: Base port (same as HTTP for GraphQL-Yoga integration)
 * - Development Range: 4000-4999
 * - Testing Range: 5000-5999
 * - Production Range: 8000-8999
 *
 * Port Offset Rules:
 * - Main HTTP/GraphQL: Base port
 * - WebSocket: Same port (GraphQL-Yoga handles both HTTP and WS on same port)
 * - Metrics/Admin: Base + 1000 (if needed)
 * - Health Check: Base + 2000 (if needed)
 */

export interface PortConfiguration {
  http: number
  websocket: number
  metrics?: number
  healthCheck?: number
  environment: 'development' | 'test' | 'production'
}

export class PortManager {
  private static readonly PORT_RANGES = {
    development: { min: 4000, max: 4999 },
    test: { min: 5000, max: 5999 },
    production: { min: 8000, max: 8999 },
  }

  private static readonly PORT_OFFSETS = {
    websocket: 0, // Same port as HTTP (GraphQL-Yoga handles both)
    metrics: 1000,
    healthCheck: 2000,
  }

  /**
   * Generate port configuration based on base port and environment
   */
  static generatePortConfig(
    basePort: number,
    environment: 'development' | 'test' | 'production' = 'development'
  ): PortConfiguration {
    const validatedPort = PortManager.validatePort(basePort, environment)

    return {
      http: validatedPort,
      websocket: validatedPort, // Same port for GraphQL-Yoga
      environment,
      // Optional ports for future use
      metrics: PortManager.isPortAvailable(
        validatedPort + PortManager.PORT_OFFSETS.metrics,
        environment
      )
        ? validatedPort + PortManager.PORT_OFFSETS.metrics
        : undefined,
      healthCheck: PortManager.isPortAvailable(
        validatedPort + PortManager.PORT_OFFSETS.healthCheck,
        environment
      )
        ? validatedPort + PortManager.PORT_OFFSETS.healthCheck
        : undefined,
    }
  }

  /**
   * Validate port is within allowed range for environment
   */
  private static validatePort(
    port: number,
    environment: keyof typeof PortManager.PORT_RANGES
  ): number {
    const range = PortManager.PORT_RANGES[environment]

    if (port < range.min || port > range.max) {
      console.warn(
        `Port ${port} is outside ${environment} range (${range.min}-${range.max}). Using default: ${range.min}`
      )
      return range.min
    }

    return port
  }

  /**
   * Check if port is within valid range
   */
  private static isPortAvailable(
    port: number,
    environment: keyof typeof PortManager.PORT_RANGES
  ): boolean {
    const range = PortManager.PORT_RANGES[environment]
    return port >= range.min && port <= range.max
  }

  /**
   * Get WebSocket URL from HTTP URL
   */
  static getWebSocketUrl(httpUrl: string): string {
    return httpUrl.replace(/^http/, 'ws')
  }

  /**
   * Parse port from various input formats
   */
  static parsePort(input: string | number | undefined, defaultPort: number = 4000): number {
    if (typeof input === 'number') return input
    if (typeof input === 'string') {
      const parsed = parseInt(input, 10)
      if (!Number.isNaN(parsed)) return parsed
    }
    return defaultPort
  }

  /**
   * Get environment from port number
   */
  static getEnvironmentFromPort(port: number): 'development' | 'test' | 'production' {
    if (port >= 4000 && port <= 4999) return 'development'
    if (port >= 5000 && port <= 5999) return 'test'
    if (port >= 8000 && port <= 8999) return 'production'

    // Default to development for unknown ranges
    return 'development'
  }

  /**
   * Format port information for logging
   */
  static formatPortInfo(config: PortConfiguration): string {
    const lines = [
      `🌐 HTTP/GraphQL: http://localhost:${config.http}/graphql`,
      `🔌 WebSocket: ws://localhost:${config.websocket}/graphql`,
    ]

    if (config.metrics) {
      lines.push(`📊 Metrics: http://localhost:${config.metrics}/metrics`)
    }

    if (config.healthCheck) {
      lines.push(`❤️ Health: http://localhost:${config.healthCheck}/health`)
    }

    lines.push(`🔧 Environment: ${config.environment}`)

    return lines.join('\n')
  }
}

/**
 * Default port configurations for different environments
 */
export const DEFAULT_PORTS = {
  development: 4000,
  test: 5000,
  production: 8000,
} as const

/**
 * Get port configuration from environment variables or CLI args
 */
export function getPortConfiguration(
  cliPort?: string | number,
  envPort?: string,
  nodeEnv?: string
): PortConfiguration {
  const environment = (nodeEnv || process.env.NODE_ENV || 'development') as
    | 'development'
    | 'test'
    | 'production'

  // Priority: CLI > GRAPHQL_PORT/envPort > PORT > Default
  const basePort = PortManager.parsePort(
    cliPort || envPort || process.env.GRAPHQL_PORT || process.env.PORT,
    DEFAULT_PORTS[environment]
  )

  const config = PortManager.generatePortConfig(basePort, environment)

  return config
}
