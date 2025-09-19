#!/usr/bin/env bun

/**
 * GraphQL Client for Demo
 *
 * 실제 서버에 요청을 보내는 GraphQL 클라이언트
 */

export interface GraphQLResponse<T = any> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, any>
  }>
}

export interface GraphQLRequestOptions {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

export class GraphQLClient {
  constructor(
    private readonly endpoint: string,
    private readonly defaultHeaders: Record<string, string> = {}
  ) {}

  async request<T = any>(options: GraphQLRequestOptions): Promise<GraphQLResponse<T>> {
    const { query, variables, operationName } = options

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.defaultHeaders,
        },
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: GraphQLResponse<T> = await response.json()

      if (result.errors && result.errors.length > 0) {
        console.warn('⚠️ GraphQL Errors:', result.errors)
      }

      return result
    } catch (error) {
      console.error('❌ GraphQL Request Failed:', error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.request({
        query: `
          query TestConnection {
            __schema {
              queryType {
                name
              }
            }
          }
        `,
      })

      return !response.errors || response.errors.length === 0
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  // 헬스체크 쿼리
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.request({
      query: `
        query HealthCheck {
          health {
            status
            timestamp
          }
        }
      `,
    })

    if (response.errors) {
      throw new Error(`Health check failed: ${response.errors[0]?.message}`)
    }

    return response.data.health
  }

  // 템플릿 관련 쿼리들
  async getAllTemplates(limit: number = 10) {
    return this.request({
      query: `
        query GetAllTemplates($limit: Int) {
          searchTemplates(pagination: { limit: $limit }) {
            nodes {
              id
              identifier
              name
              description
              usageCount
              isActive
              createdAt
              updatedAt
            }
            totalCount
          }
        }
      `,
      variables: { limit },
    })
  }

  async createTemplate(input: {
    identifier: string
    name: string
    query: string
    description?: string
    variables?: any
  }) {
    return this.request({
      query: `
        mutation CreateTemplate($input: CreateQueryTemplateInput!) {
          createTemplate(input: $input) {
            success
            template {
              id
              identifier
              name
              isActive
            }
            errors {
              message
              code
            }
          }
        }
      `,
      variables: { input },
    })
  }

  async executeTemplate(params: {
    templateId?: string
    templateIdentifier?: string
    variables?: Record<string, any>
  }) {
    return this.request({
      query: `
        mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
            metadata {
              executionTime
            }
            errors {
              message
              code
            }
          }
        }
      `,
      variables: { input: params },
    })
  }

  async searchTemplates(filter: {
    search?: string
    isActive?: boolean
    createdBy?: string
    createdAfter?: string
    createdBefore?: string
    limit?: number
  }) {
    return this.request({
      query: `
        query SearchTemplates($filter: QueryTemplatesFilter, $pagination: PaginationInput) {
          searchTemplates(filter: $filter, pagination: $pagination) {
            nodes {
              id
              identifier
              name
              description
              isActive
              usageCount
              createdBy
              createdAt
              updatedAt
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `,
      variables: {
        filter,
        pagination: { limit: filter.limit || 10 },
      },
    })
  }

  // 성능 통계 조회
  async getPerformanceStats() {
    return this.request({
      query: `
        query GetPerformanceStats {
          searchTemplates(pagination: { limit: 10 }) {
            nodes {
              id
              name
              identifier
              usageCount
              createdAt
              updatedAt
              isActive
            }
            totalCount
          }
        }
      `,
    })
  }

  // 템플릿 내보내기
  async exportTemplate(params: {
    templateId?: string
    templateIdentifier?: string
    includeStatistics?: boolean
  }) {
    return this.request({
      query: `
        mutation ExportTemplate(
          $templateId: ID
          $templateIdentifier: String
          $includeStatistics: Boolean
        ) {
          exportTemplate(
            templateId: $templateId
            templateIdentifier: $templateIdentifier
            includeStatistics: $includeStatistics
          ) {
            success
            exportData
            filename
            errors {
              message
              code
            }
          }
        }
      `,
      variables: params,
    })
  }

  // 템플릿 가져오기
  async importTemplate(params: {
    jsonData: string
    overwriteExisting?: boolean
    generateNewIdentifier?: boolean
    newIdentifierPrefix?: string
  }) {
    return this.request({
      query: `
        mutation ImportTemplate(
          $jsonData: String!
          $overwriteExisting: Boolean
          $generateNewIdentifier: Boolean
          $newIdentifierPrefix: String
        ) {
          importTemplate(
            jsonData: $jsonData
            overwriteExisting: $overwriteExisting
            generateNewIdentifier: $generateNewIdentifier
            newIdentifierPrefix: $newIdentifierPrefix
          ) {
            success
            template {
              id
              identifier
              name
              isActive
            }
            errors {
              message
              code
            }
            warnings
          }
        }
      `,
      variables: params,
    })
  }
}

// 팩토리 함수
export function createGraphQLClient(
  endpoint: string,
  headers?: Record<string, string>
): GraphQLClient {
  return new GraphQLClient(endpoint, headers)
}

// 기본 클라이언트 생성 헬퍼
export function createDefaultClient(serverUrl?: string): GraphQLClient {
  const endpoint = serverUrl || process.env.GRAPHQL_SERVER || 'http://localhost:4000/graphql'

  return createGraphQLClient(endpoint, {
    'User-Agent': 'BunGraphDB-Demo/1.0.0',
  })
}
