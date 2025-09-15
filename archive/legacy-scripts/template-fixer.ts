#!/usr/bin/env bun

/**
 * Template Auto-Fixer
 * 템플릿 문제를 자동으로 감지하고 수정하는 시스템
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GraphQLClient } from 'graphql-request'

interface FixPattern {
  name: string
  description: string
  detect: (query: string, variables?: any) => boolean
  fix: (query: string, variables?: any) => { query: string; variables?: any }
}

class TemplateFixer {
  private client: GraphQLClient
  private fixPatterns: FixPattern[]

  constructor(graphqlEndpoint: string) {
    this.client = new GraphQLClient(graphqlEndpoint)
    this.initializeFixPatterns()
  }

  private initializeFixPatterns(): void {
    this.fixPatterns = [
      // Relay pagination → offset pagination 자동 변환
      {
        name: 'relay-to-offset-pagination',
        description: 'Relay 스타일 pagination을 offset 방식으로 변환',
        detect: (query, variables) => {
          return (
            query.includes('$first:') ||
            query.includes('$after:') ||
            (variables && (variables.first || variables.after))
          )
        },
        fix: (query, variables) => {
          const fixedQuery = query
            .replace(/\$first:\s*Int[!]?/g, '$limit: Int')
            .replace(/\$after:\s*String[!]?/g, '$offset: Int')
            .replace(/first:\s*\$first/g, 'limit: $limit')
            .replace(/after:\s*\$after/g, 'offset: $offset')
            .replace(/hasNextPage\s*hasPreviousPage/g, 'hasMore')
            .replace(/nodes\s*{/g, 'templates {')

          const fixedVariables = { ...variables }
          if (fixedVariables) {
            if (fixedVariables.first) {
              fixedVariables.limit = fixedVariables.first
              delete fixedVariables.first
            }
            if (fixedVariables.after) {
              fixedVariables.offset = 0 // after 커서를 offset으로 변환하는 로직 필요
              delete fixedVariables.after
            }
          }

          return { query: fixedQuery, variables: fixedVariables }
        },
      },

      // 잘못된 필드명 자동 교정
      {
        name: 'field-name-correction',
        description: '스키마와 일치하지 않는 필드명 자동 교정',
        detect: (query) => {
          const problematicFields = ['totalCount', 'nodes', 'pageInfo']
          return problematicFields.some((field) => query.includes(field))
        },
        fix: (query, variables) => {
          const fixedQuery = query
            .replace(/totalCount/g, 'totalCount') // 실제 스키마 확인 후 수정
            .replace(/nodes\s*{/g, 'templates {')
            .replace(/pageInfo\s*{[^}]*}/g, 'hasMore')

          return { query: fixedQuery, variables }
        },
      },

      // 변수 타입 자동 교정
      {
        name: 'variable-type-correction',
        description: '잘못된 변수 타입 자동 교정',
        detect: (query) => {
          return (
            query.includes('$templateId: String!') ||
            (query.includes('ID!') && query.includes('String!'))
          )
        },
        fix: (query, variables) => {
          const fixedQuery = query
            .replace(/\$templateId:\s*String!/g, '$templateId: ID!')
            .replace(/\$id:\s*String!/g, '$id: ID!')

          return { query: fixedQuery, variables }
        },
      },

      // searchTemplates 쿼리 구조 자동 수정
      {
        name: 'search-templates-structure-fix',
        description: 'searchTemplates 쿼리를 올바른 구조로 변환',
        detect: (query) => {
          return (
            query.includes('searchTemplates') && !query.includes('$filter: QueryTemplatesFilter')
          )
        },
        fix: (_query, variables) => {
          // searchTemplates에 대한 올바른 매개변수 구조로 변환
          const fixedQuery = `
            query SearchTemplatesAdvanced($filter: QueryTemplatesFilter, $pagination: PaginationInput, $sort: [SortInput!]) {
              searchTemplates(filter: $filter, pagination: $pagination, sort: $sort) {
                templates {
                  id
                  identifier
                  name
                  description
                  tags
                  isActive
                  usageCount
                  avgExecutionTimeMs
                  lastUsedAt
                  createdAt
                  updatedAt
                }
                totalCount
                hasMore
              }
            }
          `.trim()

          return { query: fixedQuery, variables }
        },
      },
    ]
  }

  /**
   * 스키마 로드 (템플릿 validator와 동일한 로직)
   */
  async loadSchema(): Promise<void> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            fields {
              name
              type { name kind ofType { name kind } }
              args {
                name
                type { name kind ofType { name kind } }
              }
            }
            inputFields {
              name
              type { name kind ofType { name kind } }
            }
          }
          queryType { name }
          mutationType { name }
        }
      }
    `

    const result = await this.client.request(introspectionQuery)
    this.schema = result.__schema
    console.log('📋 GraphQL 스키마 로드 완료')
  }

  /**
   * 템플릿 자동 수정 및 업데이트
   */
  async fixAndUpdateTemplate(templateIdentifier: string): Promise<{
    fixed: boolean
    appliedFixes: string[]
    errors: string[]
  }> {
    const result = {
      fixed: false,
      appliedFixes: [] as string[],
      errors: [] as string[],
    }

    try {
      console.log(`🔧 템플릿 자동 수정 시작: ${templateIdentifier}`)

      // 1. 현재 템플릿 정보 가져오기
      const templateInfo = await this.getTemplateInfo(templateIdentifier)
      if (!templateInfo) {
        result.errors.push(`템플릿을 찾을 수 없음: ${templateIdentifier}`)
        return result
      }

      let currentQuery = templateInfo.query
      let currentVariables = templateInfo.defaultVariables
      let hasChanges = false

      // 2. 각 수정 패턴 적용
      for (const pattern of this.fixPatterns) {
        if (pattern.detect(currentQuery, currentVariables)) {
          console.log(`🎯 수정 패턴 적용: ${pattern.description}`)

          const fixed = pattern.fix(currentQuery, currentVariables)
          currentQuery = fixed.query
          currentVariables = fixed.variables || currentVariables

          result.appliedFixes.push(pattern.name)
          hasChanges = true
        }
      }

      // 3. 변경사항이 있으면 데이터베이스 업데이트
      if (hasChanges) {
        await this.updateTemplate(templateInfo.id, currentQuery, {
          variablesSchema: this.generateVariablesSchema(currentQuery),
          defaultVariables: currentVariables,
        })

        result.fixed = true
        console.log(`✅ 템플릿 수정 완료: ${result.appliedFixes.join(', ')}`)
      } else {
        console.log(`ℹ️ 수정이 필요하지 않음: ${templateIdentifier}`)
      }

      // 4. 수정된 템플릿 검증
      const isValid = await this.validateFixedTemplate(templateIdentifier)
      if (!isValid) {
        result.errors.push('수정 후 검증 실패')
      }
    } catch (error) {
      result.errors.push(`자동 수정 실패: ${error}`)
    }

    return result
  }

  /**
   * 여러 템플릿 일괄 수정
   */
  async fixMultipleTemplates(templateIdentifiers: string[]): Promise<Map<string, any>> {
    const results = new Map()

    console.log(`\n🔄 일괄 수정 시작 - ${templateIdentifiers.length}개 템플릿`)
    await this.loadSchema()

    for (const identifier of templateIdentifiers) {
      try {
        const result = await this.fixAndUpdateTemplate(identifier)
        results.set(identifier, result)

        // 수정 완료된 템플릿은 자동 export
        if (result.fixed && result.errors.length === 0) {
          await this.exportTemplate(identifier)
        }
      } catch (error) {
        results.set(identifier, {
          fixed: false,
          appliedFixes: [],
          errors: [`예외 발생: ${error}`],
        })
      }
    }

    this.printFixSummary(results)
    return results
  }

  /**
   * 헬퍼: 템플릿 정보 조회
   */
  private async getTemplateInfo(templateIdentifier: string) {
    const query = `
      query GetTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
          identifier
          name
          query
          defaultVariables
          variablesSchema
        }
      }
    `

    try {
      const result = await this.client.request(query, { identifier: templateIdentifier })
      return result.getTemplateByIdentifier
    } catch (error) {
      console.error(`템플릿 조회 실패: ${error}`)
      return null
    }
  }

  /**
   * 헬퍼: 템플릿 업데이트
   */
  private async updateTemplate(templateId: string, newQuery: string, updateVariables: any) {
    const mutation = `
      mutation UpdateTemplate($templateId: ID!, $newQuery: String!, $updateVariables: JSON) {
        updateTemplateQuery(templateId: $templateId, newQuery: $newQuery, updateVariables: $updateVariables) {
          success
          template { id identifier name }
        }
      }
    `

    const result = await this.client.request(mutation, {
      templateId,
      newQuery,
      updateVariables,
    })

    if (!result.updateTemplateQuery.success) {
      throw new Error('템플릿 업데이트 실패')
    }
  }

  /**
   * 헬퍼: 수정된 템플릿 검증
   */
  private async validateFixedTemplate(templateIdentifier: string): Promise<boolean> {
    try {
      const testQuery = `
        mutation TestTemplate($templateIdentifier: String!, $variables: JSON) {
          executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
            success
            errors
          }
        }
      `

      const result = await this.client.request(testQuery, {
        templateIdentifier,
        variables: {},
      })

      return result.executeTemplateWithGraphQL.success
    } catch (error) {
      console.error(`검증 실패: ${error}`)
      return false
    }
  }

  /**
   * 헬퍼: 템플릿 export
   */
  private async exportTemplate(templateIdentifier: string): Promise<void> {
    try {
      const exportQuery = `
        mutation ExportTemplate($templateIdentifier: String!) {
          exportTemplate(templateIdentifier: $templateIdentifier) {
            success
            exportData
            filename
          }
        }
      `

      const result = await this.client.request(exportQuery, { templateIdentifier })

      if (result.exportTemplate.success) {
        const outputPath = join('./demo/templates', `${templateIdentifier}_v1-0-0.json`)
        await writeFile(outputPath, result.exportTemplate.exportData, 'utf-8')
        console.log(`📁 Export 완료: ${outputPath}`)
      }
    } catch (error) {
      console.error(`Export 실패: ${error}`)
    }
  }

  /**
   * 헬퍼: 변수 스키마 생성 (쿼리 분석 기반)
   */
  private generateVariablesSchema(query: string): any {
    // GraphQL 쿼리에서 변수 추출하고 적절한 JSON Schema 생성
    const variableMatches = query.match(/\$(\w+):\s*(\w+[!]?)/g)

    if (!variableMatches) return null

    const properties: any = {}

    variableMatches.forEach((match) => {
      const [, name, type] = match.match(/\$(\w+):\s*(\w+[!]?)/) || []

      if (name && type) {
        if (type.includes('QueryTemplatesFilter')) {
          properties[name] = {
            type: 'object',
            description: '템플릿 검색 필터',
          }
        } else if (type.includes('PaginationInput')) {
          properties[name] = {
            type: 'object',
            description: '페이지네이션 설정',
          }
        } else if (type.includes('SortInput')) {
          properties[name] = {
            type: 'array',
            description: '정렬 조건',
          }
        }
      }
    })

    return {
      type: 'object',
      properties,
      required: [],
    }
  }

  /**
   * 헬퍼: 결과 요약 출력
   */
  private printFixSummary(results: Map<string, any>): void {
    console.log('\n📊 자동 수정 결과 요약:')

    let fixedCount = 0
    let errorCount = 0

    for (const [identifier, result] of results) {
      if (result.fixed) {
        console.log(`✅ ${identifier}: 수정 완료 (${result.appliedFixes.join(', ')})`)
        fixedCount++
      } else if (result.errors.length > 0) {
        console.log(`❌ ${identifier}: 오류 - ${result.errors.join(', ')}`)
        errorCount++
      } else {
        console.log(`ℹ️ ${identifier}: 수정 불필요`)
      }
    }

    console.log(`\n🎯 총 ${results.size}개 중 수정: ${fixedCount}, 오류: ${errorCount}`)
  }
}

// CLI 인터페이스
if (import.meta.main) {
  const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
  const fixer = new TemplateFixer(graphqlEndpoint)

  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'fix' && args[1]) {
    // 단일 템플릿 수정
    const templateIdentifier = args[1]
    fixer
      .fixAndUpdateTemplate(templateIdentifier)
      .then((result) => {
        console.log('수정 결과:', result)
        process.exit(result.errors.length === 0 ? 0 : 1)
      })
      .catch((error) => {
        console.error('수정 실패:', error)
        process.exit(1)
      })
  } else if (command === 'batch') {
    // 일괄 수정
    const identifiers = args.slice(1)
    if (identifiers.length === 0) {
      // 기본 템플릿 리스트
      const defaultTemplates = [
        'search-templates-advanced',
        'list-nodes-by-table',
        'get-table-schema',
        'list-tables-with-pagination',
      ]
      identifiers.push(...defaultTemplates)
    }

    fixer
      .fixMultipleTemplates(identifiers)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('일괄 수정 실패:', error)
        process.exit(1)
      })
  } else {
    console.log(`
사용법:
  bun template-fixer.ts fix <template-identifier>     # 단일 템플릿 수정
  bun template-fixer.ts batch [id1] [id2] ...        # 일괄 템플릿 수정

예시:
  bun template-fixer.ts fix search-templates-advanced
  bun template-fixer.ts batch  # 기본 템플릿들 수정
  bun template-fixer.ts batch search-templates-advanced list-nodes-by-table
    `)
    process.exit(1)
  }
}
