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
          'Accept': 'application/json',
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
          templates(limit: $limit) {
            id
            identifier
            name
            description
            queryName
            operationType
            complexityScore
            usageCount
            avgExecutionTimeMs
            tags
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { limit },
    })
  }

  async createTemplate(input: {
    identifier: string
    name: string
    queryText: string
    tags: string[]
    description?: string
    variablesSchema?: any
  }) {
    return this.request({
      query: `
        mutation CreateTemplate($input: CreateTemplateInput!) {
          createTemplate(input: $input) {
            id
            identifier
            name
            queryName
            operationType
            complexityScore
            tags
            isActive
          }
        }
      `,
      variables: { input },
    })
  }

  async executeTemplate(templateId: string, variables?: Record<string, any>) {
    return this.request({
      query: `
        mutation ExecuteTemplate($templateId: ID!, $variables: JSON) {
          executeTemplate(templateId: $templateId, variables: $variables) {
            success
            data
            executionTimeMs
            errors
          }
        }
      `,
      variables: { templateId, variables },
    })
  }

  async searchTemplates(criteria: {
    queryName?: string
    operationType?: string
    tags?: string[]
    limit?: number
  }) {
    return this.request({
      query: `
        query SearchTemplates($criteria: SearchCriteria!) {
          searchTemplates(criteria: $criteria) {
            items {
              id
              identifier
              name
              queryName
              operationType
              complexityScore
              usageCount
              avgExecutionTimeMs
              tags
            }
            total
            hasNextPage
            hasPreviousPage
          }
        }
      `,
      variables: { criteria },
    })
  }

  // 성능 통계 조회
  async getPerformanceStats() {
    return this.request({
      query: `
        query GetPerformanceStats {
          templates(orderBy: "avgExecutionTimeMs", orderDirection: "DESC", limit: 10) {
            id
            name
            queryName
            operationType
            usageCount
            avgExecutionTimeMs
            complexityScore
          }
        }
      `,
    })
  }
}

// 팩토리 함수
export function createGraphQLClient(endpoint: string, headers?: Record<string, string>): GraphQLClient {
  return new GraphQLClient(endpoint, headers)
}

// 기본 클라이언트 생성 헬퍼
export function createDefaultClient(serverUrl?: string): GraphQLClient {
  const endpoint = serverUrl || process.env.GRAPHQL_SERVER || 'http://localhost:4000/graphql'
  
  return createGraphQLClient(endpoint, {
    'User-Agent': 'BunGraphDB-Demo/1.0.0',
  })
}