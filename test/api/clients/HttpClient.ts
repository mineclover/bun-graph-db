/**
 * HTTP Client for Direct API Testing
 *
 * Provides low-level HTTP request functionality for API testing
 */

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
  timeout?: number
  retries?: number
  validateStatus?: (status: number) => boolean
}

export interface HttpResponse<T = unknown> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
  timing: {
    start: number
    end: number
    duration: number
  }
  request: {
    url: string
    method: string
    headers: Record<string, string>
  }
}

export interface HttpClientConfig {
  baseURL: string
  timeout: number
  defaultHeaders: Record<string, string>
  retries: number
  retryDelay: number
}

export class HttpClient {
  private config: HttpClientConfig

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:4000',
      timeout: config.timeout || 30000,
      defaultHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config.defaultHeaders,
      },
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
    }
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const startTime = Date.now()

    const url = this.resolveUrl(options.url)
    const headers = { ...this.config.defaultHeaders, ...options.headers }
    const timeout = options.timeout || this.config.timeout
    const retries = options.retries !== undefined ? options.retries : this.config.retries

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const fetchOptions: RequestInit = {
          method: options.method,
          headers,
          signal: controller.signal,
        }

        if (options.body) {
          if (typeof options.body === 'string') {
            fetchOptions.body = options.body
          } else {
            fetchOptions.body = JSON.stringify(options.body)
          }
        }

        const response = await fetch(url, fetchOptions)
        clearTimeout(timeoutId)

        const endTime = Date.now()
        const responseHeaders = this.extractHeaders(response.headers)

        // Validate status if validator provided
        if (options.validateStatus && !options.validateStatus(response.status)) {
          throw new Error(`Request failed with status ${response.status}: ${response.statusText}`)
        }

        let data: T
        const contentType = responseHeaders['content-type'] || ''

        if (contentType.includes('application/json')) {
          data = await response.json()
        } else {
          data = (await response.text()) as T
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          data,
          timing: {
            start: startTime,
            end: endTime,
            duration: endTime - startTime,
          },
          request: {
            url,
            method: options.method,
            headers,
          },
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < retries) {
          await this.delay(this.config.retryDelay * (attempt + 1))
        }
      }
    }

    throw lastError || new Error('Request failed after all retries')
  }

  async get<T = unknown>(
    url: string,
    options: Omit<HttpRequestOptions, 'method' | 'url'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'GET', url })
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'POST', url, body })
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'PUT', url, body })
  }

  async delete<T = unknown>(
    url: string,
    options: Omit<HttpRequestOptions, 'method' | 'url'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'DELETE', url })
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'PATCH', url, body })
  }

  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    const baseUrl = this.config.baseURL.endsWith('/')
      ? this.config.baseURL.slice(0, -1)
      : this.config.baseURL
    const path = url.startsWith('/') ? url : `/${url}`

    return `${baseUrl}${path}`
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value
    })
    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Configuration methods
  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL
  }

  setDefaultHeader(name: string, value: string): void {
    this.config.defaultHeaders[name] = value
  }

  removeDefaultHeader(name: string): void {
    delete this.config.defaultHeaders[name]
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout
  }

  setRetries(retries: number, delay?: number): void {
    this.config.retries = retries
    if (delay !== undefined) {
      this.config.retryDelay = delay
    }
  }
}

// Export a default instance
export const httpClient = new HttpClient()

// Export common configurations
export const createHttpClient = (config?: Partial<HttpClientConfig>) => new HttpClient(config)

// Export for testing specific environments
export const createDevClient = () =>
  createHttpClient({
    baseURL: 'http://localhost:4000',
    timeout: 10000,
  })

export const createProdClient = () =>
  createHttpClient({
    baseURL: process.env.PROD_API_URL || 'https://api.example.com',
    timeout: 30000,
    retries: 5,
  })
