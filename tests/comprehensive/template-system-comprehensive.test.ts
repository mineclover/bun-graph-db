/**
 * Comprehensive Template System Test Suite
 *
 * Purpose: Validate the current template lifecycle through the public GraphQL API.
 * Coverage: create, query, execute, update, import/export, table scoping, concurrency.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, setupIntegrationTest } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'template-system-comprehensive'

let testContext: IsolatedTestContext
let uniqueCounter = 0

function uniqueId(prefix: string): string {
  uniqueCounter += 1
  return `${prefix}-${Date.now()}-${uniqueCounter}`
}

async function gql(query: string, variables?: Record<string, unknown>) {
  return await testContext.graphqlRequest!(query, variables)
}

async function createTemplate(input: Record<string, unknown>) {
  const result = await gql(
    `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
            name
            description
            query
            tags
            version
            isActive
            createdAt
          }
          errors {
            message
            code
          }
        }
      }
    `,
    { input },
  )

  expect(result.errors).toBeUndefined()
  return result.data.createTemplate
}

async function createTable(identifier?: string, description?: string) {
  const tableIdentifier = identifier || uniqueId('template-table')
  const result = await gql(
    `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          success
          table {
            id
            identifier
          }
          errors {
            message
          }
        }
      }
    `,
    {
      input: {
        identifier: tableIdentifier,
        description: description || `Table for ${tableIdentifier}`,
      },
    },
  )

  expect(result.errors).toBeUndefined()
  expect(result.data.createTable.success).toBe(true)
  return result.data.createTable.table as { id: string; identifier: string }
}

async function createNode(tableId: string, content: string, title?: string) {
  const result = await gql(
    `
      mutation CreateNode($input: CreateNodeInput!) {
        createNode(input: $input) {
          success
          node {
            id
            title
            content
          }
          errors {
            message
            code
          }
        }
      }
    `,
    {
      input: {
        tableId,
        content,
        title,
      },
    },
  )

  expect(result.errors).toBeUndefined()
  expect(result.data.createNode.success).toBe(true)
  return result.data.createNode.node as { id: string; title: string | null; content: string }
}

describe('Comprehensive Template System Test Suite', () => {
  beforeAll(async () => {
    testContext = await setupIntegrationTest(SUITE_NAME)
  }, 60000)

  afterAll(async () => {
    await testContext.cleanup()
  }, 10000)

  test('should create and fetch a template through GraphQL', async () => {
    const identifier = uniqueId('basic-health-check')
    const payload = await createTemplate({
      identifier,
      name: 'Basic Health Check Template',
      description: 'Simple health check query template',
      query: `
        query HealthCheckTemplate {
          healthCheck {
            status
            version
          }
        }
      `,
      tags: ['health', 'system', 'basic'],
    })

    expect(payload.success).toBe(true)
    expect(payload.template).toMatchObject({
      identifier,
      tags: ['health', 'system', 'basic'],
    })
    expect(payload.template.name).toBe('HealthCheckTemplate')
    expect(payload.template.query).toContain('healthCheck')

    const fetchResult = await gql(
      `
        query GetTemplateByIdentifier($identifier: String!) {
          getTemplateByIdentifier(identifier: $identifier) {
            id
            identifier
            name
            description
            query
            tags
            version
            isActive
          }
        }
      `,
      { identifier },
    )

    expect(fetchResult.errors).toBeUndefined()
    expect(fetchResult.data.getTemplateByIdentifier).toMatchObject({
      identifier,
      version: '1.0.0',
      isActive: true,
    })
    expect(fetchResult.data.getTemplateByIdentifier.name).toBe('HealthCheckTemplate')
  })

  test('should reject duplicate template identifiers', async () => {
    const identifier = uniqueId('duplicate-template')

    const first = await createTemplate({
      identifier,
      name: 'Original Template',
      query: 'query { healthCheck { status } }',
      tags: ['duplicate'],
    })

    expect(first.success).toBe(true)

    const second = await createTemplate({
      identifier,
      name: 'Conflicting Template',
      query: 'query { healthCheck { status database } }',
      tags: ['duplicate'],
    })

    expect(second.success).toBe(false)
    expect(second.errors.length).toBeGreaterThan(0)
  })

  test('should search templates and scope them by table identifier', async () => {
    const table = await createTable(uniqueId('customers'))
    const universalIdentifier = uniqueId('universal-template')
    const scopedIdentifier = uniqueId('scoped-template')

    expect(
      (
        await createTemplate({
          identifier: universalIdentifier,
          name: 'Universal Template',
          query: 'query { healthCheck { status } }',
          tags: ['template-search', 'shared'],
        })
      ).success,
    ).toBe(true)

    expect(
      (
        await createTemplate({
          identifier: scopedIdentifier,
          name: 'Scoped Template',
          query: 'query { healthCheck { status version } }',
          applicableTables: [table.identifier],
          tags: ['template-search', 'scoped'],
        })
      ).success,
    ).toBe(true)

    const searchResult = await gql(
      `
        query SearchTemplates($filter: QueryTemplatesFilter, $pagination: PaginationInput) {
          searchTemplates(filter: $filter, pagination: $pagination) {
            templates {
              identifier
              tags
              applicableTables
            }
            totalCount
          }
        }
      `,
      {
        filter: { tags: ['template-search'], tagMatchMode: 'ANY' },
        pagination: { limit: 10, offset: 0 },
      },
    )

    expect(searchResult.errors).toBeUndefined()
    const templateIdentifiers = searchResult.data.searchTemplates.templates.map((template: any) => template.identifier)
    expect(templateIdentifiers).toContain(universalIdentifier)
    expect(templateIdentifiers).toContain(scopedIdentifier)

    const scopedResult = await gql(
      `
        query TemplatesByTable($input: FindTemplatesByTableInput!) {
          templatesByTable(input: $input) {
            identifier
          }
        }
      `,
      {
        input: {
          tableName: table.identifier,
          includeUniversal: true,
        },
      },
    )

    expect(scopedResult.errors).toBeUndefined()
    const scopedIdentifiers = scopedResult.data.templatesByTable.map((template: any) => template.identifier)
    expect(scopedIdentifiers).toContain(scopedIdentifier)
    expect(scopedIdentifiers).toContain(universalIdentifier)
  })

  test('should execute a simple template and return GraphQL data', async () => {
    const identifier = uniqueId('simple-execution')

    expect(
      (
        await createTemplate({
          identifier,
          name: 'Simple Execution Template',
          query: `
            query SimpleExecution {
              healthCheck {
                status
                version
              }
            }
          `,
          tags: ['execute', 'simple'],
        })
      ).success,
    ).toBe(true)

    const executionResult = await gql(
      `
        mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
            errors {
              message
              code
            }
            execution {
              success
              duration
              resultCount
            }
          }
        }
      `,
      {
        input: {
          templateIdentifier: identifier,
          variables: {},
        },
      },
    )

    expect(executionResult.errors).toBeUndefined()
    expect(executionResult.data.executeTemplate.success).toBe(true)
    expect(executionResult.data.executeTemplate.data.success).toBe(true)
    expect(executionResult.data.executeTemplate.data.data.healthCheck.status).toBe('OK')
    expect(executionResult.data.executeTemplate.execution.resultCount).toBeGreaterThanOrEqual(1)
  })

  test('should execute a parameterized template against current graph data', async () => {
    const table = await createTable(uniqueId('template-execution'))
    await createNode(table.id, `alpha keyword ${uniqueId('node')}`, 'Template Test Node 1')
    await createNode(table.id, `beta keyword ${uniqueId('node')}`, 'Template Test Node 2')
    await createNode(table.id, `unrelated ${uniqueId('node')}`, 'Different Node')

    const identifier = uniqueId('parameterized-search')

    expect(
      (
        await createTemplate({
          identifier,
          name: 'Parameterized Search Template',
          query: `
            query ParameterizedSearch($tableId: ID!, $searchTerm: String!, $limit: Int!) {
              table(id: $tableId) {
                id
                identifier
              }
              searchNodes(input: {
                tableId: $tableId
                search: $searchTerm
                limit: $limit
              }) {
                nodes {
                  id
                  title
                  content
                }
                totalCount
              }
            }
          `,
          applicableTables: [table.identifier],
          tags: ['execute', 'parameterized'],
        })
      ).success,
    ).toBe(true)

    const executionResult = await gql(
      `
        mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
            errors {
              message
            }
          }
        }
      `,
      {
        input: {
          templateIdentifier: identifier,
          variables: {
            tableId: table.id,
            searchTerm: 'keyword',
            limit: 10,
          },
        },
      },
    )

    expect(executionResult.errors).toBeUndefined()
    expect(executionResult.data.executeTemplate.success).toBe(true)
    expect(executionResult.data.executeTemplate.data.success).toBe(true)
    expect(executionResult.data.executeTemplate.data.data.table.identifier).toBe(table.identifier)
    expect(executionResult.data.executeTemplate.data.data.searchNodes.totalCount).toBe(2)
  })

  test('should update a template query and execute the updated version', async () => {
    const identifier = uniqueId('update-template')
    const createResult = await createTemplate({
      identifier,
      name: 'Updatable Template',
      query: 'query { healthCheck { status } }',
      tags: ['update'],
    })

    expect(createResult.success).toBe(true)

    const updateResult = await gql(
      `
        mutation UpdateTemplateQuery($templateIdentifier: String!, $newQuery: String!) {
          updateTemplateQuery(templateIdentifier: $templateIdentifier, newQuery: $newQuery) {
            success
            previousQuery
            template {
              identifier
              query
            }
            errors {
              message
            }
          }
        }
      `,
      {
        templateIdentifier: identifier,
        newQuery: 'query { healthCheck { status version } }',
      },
    )

    expect(updateResult.errors).toBeUndefined()
    expect(updateResult.data.updateTemplateQuery.success).toBe(true)
    expect(updateResult.data.updateTemplateQuery.previousQuery).toContain('status')
    expect(updateResult.data.updateTemplateQuery.template.query).toContain('version')

    const executionResult = await gql(
      `
        mutation ExecuteUpdatedTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
          }
        }
      `,
      {
        input: {
          templateIdentifier: identifier,
          variables: {},
        },
      },
    )

    expect(executionResult.errors).toBeUndefined()
    expect(executionResult.data.executeTemplate.success).toBe(true)
    expect(executionResult.data.executeTemplate.data.data.healthCheck.version).toBeDefined()
  })

  test('should export and import a template with a generated identifier', async () => {
    const identifier = uniqueId('exportable-template')
    const prefix = uniqueId('imported')

    expect(
      (
        await createTemplate({
          identifier,
          name: 'Exportable Template',
          query: 'query { healthCheck { status database version } }',
          tags: ['export', 'import'],
        })
      ).success,
    ).toBe(true)

    const exportResult = await gql(
      `
        mutation ExportTemplate($templateIdentifier: String!) {
          exportTemplate(templateIdentifier: $templateIdentifier) {
            success
            exportData
            filename
            errors {
              message
            }
          }
        }
      `,
      { templateIdentifier: identifier },
    )

    expect(exportResult.errors).toBeUndefined()
    expect(exportResult.data.exportTemplate.success).toBe(true)
    expect(exportResult.data.exportTemplate.filename).toContain('exportable-template')
    expect(exportResult.data.exportTemplate.filename).toContain('_v1-0-0.json')

    const importResult = await gql(
      `
        mutation ImportTemplate(
          $jsonData: String!
          $generateNewIdentifier: Boolean
          $newIdentifierPrefix: String
        ) {
          importTemplate(
            jsonData: $jsonData
            generateNewIdentifier: $generateNewIdentifier
            newIdentifierPrefix: $newIdentifierPrefix
          ) {
            success
            template {
              id
              identifier
              name
            }
            errors {
              message
            }
            warnings
          }
        }
      `,
      {
        jsonData: exportResult.data.exportTemplate.exportData,
        generateNewIdentifier: true,
        newIdentifierPrefix: prefix,
      },
    )

    expect(importResult.errors).toBeUndefined()
    expect(importResult.data.importTemplate.success).toBe(true)
    expect(importResult.data.importTemplate.template.identifier).toStartWith(`${prefix}-`)
  })

  test('should overwrite an existing template through import', async () => {
    const identifier = uniqueId('overwrite-template')
    const created = await createTemplate({
      identifier,
      name: 'Original Template Name',
      query: 'query { healthCheck { status } }',
      tags: ['overwrite'],
    })

    expect(created.success).toBe(true)

    const exportResult = await gql(
      `
        mutation ExportTemplate($templateIdentifier: String!) {
          exportTemplate(templateIdentifier: $templateIdentifier) {
            success
            exportData
          }
        }
      `,
      { templateIdentifier: identifier },
    )

    expect(exportResult.errors).toBeUndefined()
    const exportData = JSON.parse(exportResult.data.exportTemplate.exportData)
    exportData.template.name = 'Overwritten Template Name'
    exportData.template.query = 'query { healthCheck { status version } }'

    const importResult = await gql(
      `
        mutation ImportTemplate($jsonData: String!, $overwriteExisting: Boolean) {
          importTemplate(jsonData: $jsonData, overwriteExisting: $overwriteExisting) {
            success
            template {
              identifier
              name
            }
            errors {
              message
            }
          }
        }
      `,
      {
        jsonData: JSON.stringify(exportData),
        overwriteExisting: true,
      },
    )

    expect(importResult.errors).toBeUndefined()
    expect(importResult.data.importTemplate.success).toBe(true)

    const fetchResult = await gql(
      `
        query GetUpdatedTemplate($identifier: String!) {
          getTemplateByIdentifier(identifier: $identifier) {
            identifier
            name
            query
          }
        }
      `,
      { identifier },
    )

    expect(fetchResult.errors).toBeUndefined()
    expect(fetchResult.data.getTemplateByIdentifier.name).toBe('Overwritten Template Name')
    expect(fetchResult.data.getTemplateByIdentifier.query).toContain('version')
  })

  test('should handle concurrent executions of the same template', async () => {
    const identifier = uniqueId('concurrent-template')

    expect(
      (
        await createTemplate({
          identifier,
          name: 'Concurrent Template',
          query: `
            query ConcurrentTemplate($index: Int!) {
              healthCheck {
                status
              }
              systemStats {
                memory {
                  used
                  total
                }
              }
            }
          `,
          tags: ['concurrent'],
        })
      ).success,
    ).toBe(true)

    const executions = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        gql(
          `
            mutation ExecuteTemplateConcurrently($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                data
                errors {
                  message
                }
                execution {
                  duration
                }
              }
            }
          `,
          {
            input: {
              templateIdentifier: identifier,
              variables: { index },
            },
          },
        ),
      ),
    )

    executions.forEach((result) => {
      expect(result.errors).toBeUndefined()
      expect(result.data.executeTemplate.success).toBe(true)
      expect(result.data.executeTemplate.data.success).toBe(true)
      expect(result.data.executeTemplate.data.data.healthCheck.status).toBe('OK')
      expect(result.data.executeTemplate.execution.duration).toBeGreaterThanOrEqual(0)
    })
  })
})
