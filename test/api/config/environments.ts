/**
 * Environment Configuration for API Tests
 * 
 * Manages different testing environments and their configurations
 */

export interface Environment {
  name: string
  graphqlEndpoint: string
  restEndpoint?: string
  wsEndpoint?: string
  timeout: number
  retries: number
  headers: Record<string, string>
  rateLimits: {
    requestsPerSecond: number
    burstLimit: number
  }
  features: {
    subscriptions: boolean
    fileUploads: boolean
    authentication: boolean
    caching: boolean
  }
}

export const environments: Record<string, Environment> = {
  development: {
    name: 'development',
    graphqlEndpoint: 'http://localhost:4000/graphql',
    restEndpoint: 'http://localhost:4000/api',
    wsEndpoint: 'ws://localhost:4000/graphql',
    timeout: 10000, // 10 seconds
    retries: 3,
    headers: {
      'x-api-version': '1.0',
      'x-client': 'api-test-suite',
    },
    rateLimits: {
      requestsPerSecond: 100,
      burstLimit: 200,
    },
    features: {
      subscriptions: true,
      fileUploads: true,
      authentication: false, // Usually disabled for local dev
      caching: false,
    },
  },

  testing: {
    name: 'testing',
    graphqlEndpoint: 'http://localhost:4001/graphql',
    restEndpoint: 'http://localhost:4001/api',
    wsEndpoint: 'ws://localhost:4001/graphql',
    timeout: 15000,
    retries: 2,
    headers: {
      'x-api-version': '1.0',
      'x-client': 'api-test-suite',
      'x-environment': 'testing',
    },
    rateLimits: {
      requestsPerSecond: 50,
      burstLimit: 100,
    },
    features: {
      subscriptions: true,
      fileUploads: true,
      authentication: true,
      caching: true,
    },
  },

  staging: {
    name: 'staging',
    graphqlEndpoint: process.env.STAGING_GRAPHQL_URL || 'https://staging-api.example.com/graphql',
    restEndpoint: process.env.STAGING_REST_URL || 'https://staging-api.example.com/api',
    wsEndpoint: process.env.STAGING_WS_URL || 'wss://staging-api.example.com/graphql',
    timeout: 30000,
    retries: 3,
    headers: {
      'x-api-version': '1.0',
      'x-client': 'api-test-suite',
      'x-environment': 'staging',
      'Authorization': `Bearer ${process.env.STAGING_API_TOKEN || ''}`,
    },
    rateLimits: {
      requestsPerSecond: 30,
      burstLimit: 60,
    },
    features: {
      subscriptions: true,
      fileUploads: true,
      authentication: true,
      caching: true,
    },
  },

  production: {
    name: 'production',
    graphqlEndpoint: process.env.PROD_GRAPHQL_URL || 'https://api.example.com/graphql',
    restEndpoint: process.env.PROD_REST_URL || 'https://api.example.com/api',
    wsEndpoint: process.env.PROD_WS_URL || 'wss://api.example.com/graphql',
    timeout: 30000,
    retries: 5,
    headers: {
      'x-api-version': '1.0',
      'x-client': 'api-test-suite-prod',
      'x-environment': 'production',
      'Authorization': `Bearer ${process.env.PROD_API_TOKEN || ''}`,
    },
    rateLimits: {
      requestsPerSecond: 10, // Conservative for production
      burstLimit: 20,
    },
    features: {
      subscriptions: true,
      fileUploads: true,
      authentication: true,
      caching: true,
    },
  },

  // Special environment for load testing
  loadTest: {
    name: 'loadTest',
    graphqlEndpoint: process.env.LOAD_TEST_GRAPHQL_URL || 'http://localhost:4000/graphql',
    restEndpoint: process.env.LOAD_TEST_REST_URL || 'http://localhost:4000/api',
    wsEndpoint: process.env.LOAD_TEST_WS_URL || 'ws://localhost:4000/graphql',
    timeout: 60000, // Longer timeout for load tests
    retries: 1, // Fewer retries to avoid skewing results
    headers: {
      'x-api-version': '1.0',
      'x-client': 'load-test-suite',
      'x-test-type': 'load',
    },
    rateLimits: {
      requestsPerSecond: 1000, // High limits for load testing
      burstLimit: 2000,
    },
    features: {
      subscriptions: false, // Typically disabled for load tests
      fileUploads: false,
      authentication: false,
      caching: false,
    },
  },
}

/**
 * Get environment configuration by name
 */
export function getEnvironment(name: string): Environment {
  const env = environments[name]
  if (!env) {
    throw new Error(`Environment '${name}' not found. Available: ${Object.keys(environments).join(', ')}`)
  }
  return env
}

/**
 * Get current environment from environment variable
 */
export function getCurrentEnvironment(): Environment {
  const envName = process.env.TEST_ENV || process.env.NODE_ENV || 'development'
  return getEnvironment(envName)
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(env: Environment): void {
  const errors: string[] = []

  if (!env.graphqlEndpoint) {
    errors.push('GraphQL endpoint is required')
  }

  if (!env.graphqlEndpoint.startsWith('http://') && !env.graphqlEndpoint.startsWith('https://')) {
    errors.push('GraphQL endpoint must be a valid HTTP/HTTPS URL')
  }

  if (env.timeout <= 0) {
    errors.push('Timeout must be positive')
  }

  if (env.retries < 0) {
    errors.push('Retries must be non-negative')
  }

  if (env.rateLimits.requestsPerSecond <= 0) {
    errors.push('Requests per second must be positive')
  }

  if (env.rateLimits.burstLimit < env.rateLimits.requestsPerSecond) {
    errors.push('Burst limit must be >= requests per second')
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`)
  }
}

/**
 * Create environment-specific test configuration
 */
export function createTestConfig(envName: string) {
  const env = getEnvironment(envName)
  validateEnvironment(env)

  return {
    environment: env,
    graphqlClient: {
      endpoint: env.graphqlEndpoint,
      headers: env.headers,
      timeout: env.timeout,
      retries: env.retries,
    },
    httpClient: {
      baseURL: env.restEndpoint || env.graphqlEndpoint.replace('/graphql', ''),
      timeout: env.timeout,
      defaultHeaders: env.headers,
      retries: env.retries,
    },
    performance: {
      maxResponseTime: env.timeout / 2, // Expected response time should be < half timeout
      successRate: env.name === 'production' ? 0.99 : 0.95, // Higher success rate for production
      concurrency: Math.min(env.rateLimits.requestsPerSecond / 10, 20), // Conservative concurrency
    },
  }
}

/**
 * Get environment-specific test timeouts
 */
export function getTestTimeouts(envName: string) {
  const env = getEnvironment(envName)
  
  return {
    quick: Math.min(env.timeout / 4, 2500), // Quick tests: max 2.5s
    standard: Math.min(env.timeout / 2, 5000), // Standard tests: max 5s
    slow: env.timeout, // Slow tests: use full timeout
    load: env.timeout * 2, // Load tests: double timeout
  }
}

/**
 * Check if feature is enabled in current environment
 */
export function isFeatureEnabled(feature: keyof Environment['features'], envName?: string): boolean {
  const env = envName ? getEnvironment(envName) : getCurrentEnvironment()
  return env.features[feature]
}

/**
 * Get environment-specific rate limits
 */
export function getRateLimits(envName?: string) {
  const env = envName ? getEnvironment(envName) : getCurrentEnvironment()
  return env.rateLimits
}

// Export current environment for convenience
export const currentEnvironment = getCurrentEnvironment()
export const currentConfig = createTestConfig(currentEnvironment.name)