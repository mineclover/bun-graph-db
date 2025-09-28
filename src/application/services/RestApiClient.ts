import { API_ENDPOINT_MAPPING } from '../../presentation/http/routes/ApiRoutes.js'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class RestApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  }

  private async makeRequest<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      let url = `${this.baseUrl}${endpoint}`

      // Add query parameters for GET requests
      if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams(params)
        url += `?${searchParams.toString()}`
      }

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data)
      }

      const response = await fetch(url, options)

      if (!response.ok) {
        const text = await response.text()
        console.error(`REST API ${method} ${endpoint} error - Status: ${response.status}, Body: ${text}`)
        return {
          success: false,
          error: `HTTP ${response.status}: ${text}`,
        } as ApiResponse<T>
      }

      const result = await response.json()
      return result as ApiResponse<T>
    } catch (error) {
      console.error(`REST API ${method} ${endpoint} error:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // MCP Tool -> REST API 매핑
  async callMcpTool(toolName: string, params: any = {}): Promise<ApiResponse> {
    const endpoint = this.getEndpointForTool(toolName)

    if (!endpoint) {
      return {
        success: false,
        error: `No REST API endpoint found for tool: ${toolName}`,
      }
    }

    // /api/mcp-tools/call 엔드포인트는 특별한 형식이 필요
    if (endpoint.includes('/api/mcp-tools/call')) {
      const callBody = {
        toolName,
        parameters: params
      }
      return this.makeRequest('POST', '/mcp-tools/call', callBody)
    }

    const { method, path, queryParams, body } = this.prepareRequest(toolName, endpoint, params)

    return this.makeRequest(method, path, body, queryParams)
  }

  private getEndpointForTool(toolName: string): string | null {
    return API_ENDPOINT_MAPPING[toolName as keyof typeof API_ENDPOINT_MAPPING] || null
  }

  private prepareRequest(
    _toolName: string,
    endpoint: string,
    params: any
  ): {
    method: string
    path: string
    queryParams?: Record<string, string>
    body?: any
  } {
    const [method, pathTemplate] = endpoint.split(' ')

    if (!pathTemplate) {
      throw new Error(`Invalid endpoint format: ${endpoint}. Expected format: "METHOD /path"`)
    }

    // URL 파라미터 치환
    let path = pathTemplate.replace('/api', '')
    Object.keys(params).forEach((key) => {
      path = path.replace(`:${key}`, params[key])
    })

    // GET 요청의 경우 쿼리 파라미터로 전환
    if (method === 'GET') {
      const queryParams: Record<string, string> = {}
      Object.keys(params).forEach((key) => {
        if (!pathTemplate.includes(`:${key}`)) {
          queryParams[key] = String(params[key])
        }
      })
      return { method: method!, path, queryParams }
    }

    // POST/PUT 요청의 경우 body 데이터로 전환
    const body = { ...params }
    Object.keys(params).forEach((key) => {
      if (pathTemplate.includes(`:${key}`)) {
        delete body[key]
      }
    })

    return { method: method!, path, body }
  }

  // 개별 API 메서드들
  async healthCheck(): Promise<ApiResponse> {
    return this.makeRequest('GET', '/health')
  }

  async systemStats(): Promise<ApiResponse> {
    return this.makeRequest('GET', '/stats')
  }

  async createTable(params: {
    identifier: string
    name?: string
    description?: string
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/tables', params)
  }

  async searchTables(params: { searchTerm?: string; limit?: number }): Promise<ApiResponse> {
    return this.makeRequest('GET', '/tables/search', undefined, {
      searchTerm: params.searchTerm || '',
      limit: String(params.limit || 10),
    })
  }

  async createNode(params: {
    tableId: string
    content: string
    metadata?: any
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/nodes', params)
  }

  async searchNodes(params: {
    tableId: string
    search?: string
    limit?: number
  }): Promise<ApiResponse> {
    return this.makeRequest('GET', '/nodes/search', undefined, {
      tableId: params.tableId,
      search: params.search || '',
      limit: String(params.limit || 10),
    })
  }

  async createRelation(params: {
    fromNodeId: string
    toNodeId: string
    relationshipType: string
    tableId: string
    properties?: any
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/relations', params)
  }

  async createTemplate(params: {
    identifier: string
    name: string
    query: string
    tags?: string[]
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/templates', params)
  }

  async executeTemplateWithGraphQL(params: {
    templateIdentifier: string
    variables?: any
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/templates/execute', params)
  }

  async searchTemplates(params: { searchTerm?: string; tags?: string[] }): Promise<ApiResponse> {
    const queryParams: Record<string, string> = {
      searchTerm: params.searchTerm || '',
    }

    if (params.tags && params.tags.length > 0) {
      params.tags.forEach((tag, index) => {
        queryParams[`tags[${index}]`] = tag
      })
    }

    return this.makeRequest('GET', '/templates/search', undefined, queryParams)
  }

  async exportTemplate(params: { templateIdentifier: string }): Promise<ApiResponse> {
    return this.makeRequest('GET', `/templates/${params.templateIdentifier}/export`)
  }

  async importTemplate(params: {
    jsonData: string
    overwriteExisting?: boolean
    generateNewIdentifier?: boolean
  }): Promise<ApiResponse> {
    return this.makeRequest('POST', '/templates/import', params)
  }

  // 나머지 API 메서드들도 필요에 따라 추가...
}
