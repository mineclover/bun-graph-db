/**
 * GraphQL Client for Direct API Testing
 *
 * Provides GraphQL-specific functionality built on top of HttpClient
 */

import type { HttpResponse } from './HttpClient.js'
import { HttpClient } from './HttpClient.js'

export interface GraphQLRequest {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

export interface GraphQLResponse<T = unknown> {
  data?: T
  errors?: GraphQLError[]
  extensions?: Record<string, unknown>
}

export interface GraphQLError {
  message: string
  locations?: Array<{
    line: number
    column: number
  }>
  path?: Array<string | number>
  extensions?: Record<string, unknown>
}

export interface GraphQLClientOptions {
  endpoint?: string
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

export interface ExecutionResult<T = unknown> extends HttpResponse<GraphQLResponse<T>> {
  isSuccess: boolean
  hasErrors: boolean
  operationType?: 'query' | 'mutation' | 'subscription'
  operationName?: string
  queryComplexity?: number
}

export class GraphQLClient {
  private httpClient: HttpClient
  private endpoint: string

  constructor(options: GraphQLClientOptions = {}) {
    this.endpoint = options.endpoint || '/graphql'

    this.httpClient = new HttpClient({
      timeout: options.timeout || 30000,
      defaultHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
      retries: options.retries || 3,
    })
  }

  async execute<T = unknown>(request: GraphQLRequest): Promise<ExecutionResult<T>> {
    const startTime = Date.now()

    try {
      const response = await this.httpClient.post<GraphQLResponse<T>>(this.endpoint, {
        query: request.query,
        variables: request.variables || {},
        operationName: request.operationName,
      })

      const result: ExecutionResult<T> = {
        ...response,
        isSuccess: response.status >= 200 && response.status < 300 && !response.data.errors,
        hasErrors: !!response.data.errors && response.data.errors.length > 0,
        operationType: this.detectOperationType(request.query),
        operationName: request.operationName,
        queryComplexity: this.calculateComplexity(request.query),
      }

      return result
    } catch (error) {
      throw new GraphQLClientError(
        `GraphQL request failed: ${error instanceof Error ? error.message : String(error)}`,
        request,
        Date.now() - startTime
      )
    }
  }

  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<ExecutionResult<T>> {
    return this.execute<T>({ query, variables, operationName })
  }

  async mutation<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<ExecutionResult<T>> {
    return this.execute<T>({ query: mutation, variables, operationName })
  }

  // Batch execution for multiple operations
  async batch<T = unknown>(requests: GraphQLRequest[]): Promise<ExecutionResult<T>[]> {
    const promises = requests.map((request) => this.execute<T>(request))
    return Promise.all(promises)
  }

  // Parallel execution with concurrency control
  async parallel<T = unknown>(
    requests: GraphQLRequest[],
    concurrency: number = 10
  ): Promise<ExecutionResult<T>[]> {
    const results: ExecutionResult<T>[] = []

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      const batchResults = await this.batch<T>(batch)
      results.push(...batchResults)
    }

    return results
  }

  // Subscription support (for WebSocket-based subscriptions)
  subscribe(
    subscription: string,
    variables?: Record<string, unknown>
  ): AsyncIterable<GraphQLResponse> {
    // Implementation would depend on WebSocket client
    throw new Error('Subscription support not implemented yet')
  }

  // Performance testing helpers
  async benchmark<T = unknown>(
    request: GraphQLRequest,
    iterations: number = 100
  ): Promise<BenchmarkResult<T>> {
    const results: ExecutionResult<T>[] = []
    const timings: number[] = []

    for (let i = 0; i < iterations; i++) {
      const result = await this.execute<T>(request)
      results.push(result)
      timings.push(result.timing.duration)
    }

    return {
      iterations,
      results,
      timing: {
        min: Math.min(...timings),
        max: Math.max(...timings),
        average: timings.reduce((a, b) => a + b, 0) / timings.length,
        median: this.calculateMedian(timings),
        p95: this.calculatePercentile(timings, 0.95),
        p99: this.calculatePercentile(timings, 0.99),
      },
      success: results.filter((r) => r.isSuccess).length,
      errors: results.filter((r) => r.hasErrors).length,
    }
  }

  // Load testing helpers
  async loadTest<T = unknown>(
    request: GraphQLRequest,
    options: {
      duration: number // milliseconds
      concurrent: number
      rampUp?: number // milliseconds
    }
  ): Promise<LoadTestResult<T>> {
    const { duration, concurrent, rampUp = 0 } = options
    const results: ExecutionResult<T>[] = []
    const startTime = Date.now()
    const workers: Promise<ExecutionResult<T>>[] = []

    // Ramp up workers gradually
    const rampUpInterval = rampUp > 0 ? rampUp / concurrent : 0

    for (let i = 0; i < concurrent; i++) {
      if (rampUpInterval > 0) {
        await new Promise((resolve) => setTimeout(resolve, rampUpInterval))
      }

      const worker = this.runWorker(request, duration)
      workers.push(worker)
    }

    const workerResults = await Promise.allSettled(workers)

    workerResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    })

    const totalDuration = Date.now() - startTime

    return {
      duration: totalDuration,
      concurrent,
      totalRequests: results.length,
      successfulRequests: results.filter((r) => r.isSuccess).length,
      failedRequests: results.filter((r) => !r.isSuccess).length,
      requestsPerSecond: results.length / (totalDuration / 1000),
      averageResponseTime: results.reduce((sum, r) => sum + r.timing.duration, 0) / results.length,
    }
  }

  private async runWorker<T>(
    request: GraphQLRequest,
    duration: number
  ): Promise<ExecutionResult<T>> {
    const endTime = Date.now() + duration
    const results: ExecutionResult<T>[] = []

    while (Date.now() < endTime) {
      try {
        const result = await this.execute<T>(request)
        results.push(result)
      } catch (error) {}
    }

    // Return the last successful result or throw if no results
    const successfulResults = results.filter((r) => r.isSuccess)
    if (successfulResults.length > 0) {
      return successfulResults[successfulResults.length - 1]!
    }

    throw new Error('No successful requests during worker execution')
  }

  private detectOperationType(query: string): 'query' | 'mutation' | 'subscription' {
    const normalized = query.trim().toLowerCase()
    if (normalized.startsWith('mutation')) return 'mutation'
    if (normalized.startsWith('subscription')) return 'subscription'
    return 'query'
  }

  private calculateComplexity(query: string): number {
    // Simple complexity calculation based on query structure
    const fieldMatches = query.match(/\w+\s*{/g) || []
    const nestedMatches = query.match(/{[^}]*{/g) || []
    return fieldMatches.length + nestedMatches.length * 2
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1] || 0) + (sorted[mid] || 0)) / 2
      : sorted[mid] || 0
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = [...numbers].sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * percentile) - 1
    return sorted[index] || 0
  }

  // Configuration methods
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint
  }

  setHeader(name: string, value: string): void {
    this.httpClient.setDefaultHeader(name, value)
  }

  setAuthToken(token: string): void {
    this.setHeader('Authorization', `Bearer ${token}`)
  }
}

export interface BenchmarkResult<T> {
  iterations: number
  results: ExecutionResult<T>[]
  timing: {
    min: number
    max: number
    average: number
    median: number
    p95: number
    p99: number
  }
  success: number
  errors: number
}

export interface LoadTestResult<T> {
  duration: number
  concurrent: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  requestsPerSecond: number
  averageResponseTime: number
}

export class GraphQLClientError extends Error {
  constructor(
    message: string,
    public request: GraphQLRequest,
    public duration: number
  ) {
    super(message)
    this.name = 'GraphQLClientError'
  }
}

// Export default instances
export const graphqlClient = new GraphQLClient()

// Export factory functions
export const createGraphQLClient = (options?: GraphQLClientOptions) => new GraphQLClient(options)

export const createDevGraphQLClient = () =>
  createGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeout: 10000,
  })

export const createProdGraphQLClient = () =>
  createGraphQLClient({
    endpoint: process.env.PROD_GRAPHQL_URL || 'https://api.example.com/graphql',
    timeout: 30000,
    retries: 5,
  })
