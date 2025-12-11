/**
 * Comprehensive Template System Test Suite
 *
 * Purpose: Test complete template lifecycle and execution engine
 * Coverage: Template creation, validation, execution, import/export, versioning
 * Scenarios: Simple templates, complex parameterized queries, error handling
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, setupIntegrationTest } from '../fixtures/test-isolation-helpers'

// Typed interfaces for template responses

const SUITE_NAME = 'template-system-comprehensive'
let testContext: IsolatedTestContext

describe('Comprehensive Template System Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up comprehensive template system test environment...')
    testContext = await setupIntegrationTest(SUITE_NAME)
    console.log('✅ Test environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up comprehensive template system test environment...')
    await testContext.cleanup()
    console.log('✅ Cleanup completed')
  }, 10000)

  describe('Template Creation and Validation', () => {
    test('should create basic template with validation', async () => {
      const mutation = `
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
              createdAt
            }
            errors {
              message
              code
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: 'basic-health-check',
          name: 'Basic Health Check Template',
          description: 'Simple health check query template',
          query: `query HealthCheck {
            healthCheck {
              status
              database
              version
              timestamp
            }
          }`,
          tags: ['health', 'system', 'basic'],
        },
      }

      const result = await testContext.graphqlRequest?.<CreateTemplateResponse>(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createTemplate.success).toBe(true)
      expect(result.data.createTemplate.template).toMatchObject({
        identifier: 'basic-health-check',
        name: 'Basic Health Check Template',
        tags: ['health', 'system', 'basic'],
      })
      expect(result.data.createTemplate.template?.id).toBeDefined()
      expect(result.data.createTemplate.template?.createdAt).toBeDefined()
    })

    test('should create parameterized template with variable validation', async () => {
      const templateData = {
        identifier: 'parameterized-node-search',
        name: 'Parameterized Node Search',
        description: 'Search nodes with dynamic parameters',
        query: `
          query SearchNodes($tableId: ID!, $searchTerm: String!, $limit: Int = 10) {
            table(id: $tableId) {
              identifier
              nodeCount
            }
            searchNodes(tableId: $tableId, searchQuery: {
              textSearch: $searchTerm
              limit: $limit
              sortBy: [{ field: "created_at", direction: "DESC" }]
            }) {
              nodes {
                node {
                  id
                  title
                  content
                  createdAt
                }
                score
              }
              totalCount
              hasNextPage
            }
          }
        `,
        variables: ['tableId', 'searchTerm', 'limit'],
        tags: ['search', 'parameterized', 'nodes'],
      }

      const result = await createTemplateUseCase.execute(templateData)

      expect(result.success).toBe(true)
      expect(result.template.variables).toEqual(['tableId', 'searchTerm', 'limit'])
      expect(result.template.query).toContain('$tableId: ID!')
      expect(result.template.query).toContain('$searchTerm: String!')
    })

    test('should validate GraphQL syntax in template queries', async () => {
      const invalidTemplateData = {
        identifier: 'invalid-syntax-template',
        name: 'Invalid Syntax Template',
        query: `
          query InvalidQuery {
            nonExistentField {
              invalidSubfield
            }
            missingClosingBrace
        `,
        variables: [],
        tags: ['invalid'],
      }

      const result = await createTemplateUseCase.execute(invalidTemplateData)

      expect(result.success).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'query',
          message: expect.stringContaining('syntax'),
        }),
      )
    })

    test('should handle duplicate template identifiers', async () => {
      const templateData = {
        identifier: 'duplicate-test-template',
        name: 'First Template',
        query: 'query { healthCheck { status } }',
        variables: [],
        tags: ['test'],
      }

      // Create first template
      await createTemplateUseCase.execute(templateData)

      // Try to create duplicate
      const duplicateData = {
        ...templateData,
        name: 'Second Template',
      }

      const result = await createTemplateUseCase.execute(duplicateData)

      expect(result.success).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identifier',
          message: expect.stringContaining('already exists'),
        }),
      )
    })
  })

  describe('Template Execution Engine', () => {
    let testTableId: string

    beforeEach(async () => {
      // Create test data for template execution
      const tableResult = await testDbFactory.createTestTable('template-execution-table')
      testTableId = tableResult.id

      // Create test nodes
      await testDbFactory.createTestNode(testTableId, {
        title: 'Template Test Node 1',
        content: 'Content for template testing with keyword alpha',
      })
      await testDbFactory.createTestNode(testTableId, {
        title: 'Template Test Node 2',
        content: 'Content for template testing with keyword beta',
      })
      await testDbFactory.createTestNode(testTableId, {
        title: 'Different Node',
        content: 'Different content without keywords',
      })
    })

    test('should execute simple template without parameters', async () => {
      // Create template
      const templateData = {
        identifier: 'simple-health-template',
        name: 'Simple Health Template',
        query: `
          query SimpleHealth {
            healthCheck {
              status
              database
              version
            }
            systemStats {
              memory {
                used
                total
              }
            }
          }
        `,
        variables: [],
        tags: ['simple'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute template
      const result = await executeTemplateUseCase.execute({
        templateIdentifier: 'simple-health-template',
        variables: {},
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.healthCheck).toMatchObject({
        status: 'OK',
        database: 'Connected',
      })
      expect(result.data.systemStats.memory).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should execute parameterized template with variable substitution', async () => {
      // Create parameterized template
      const templateData = {
        identifier: 'parameterized-search-template',
        name: 'Parameterized Search Template',
        query: `
          query ParameterizedSearch($tableId: ID!, $searchTerm: String!, $limit: Int!) {
            table(id: $tableId) {
              id
              identifier
              nodeCount
            }
            searchNodes(tableId: $tableId, searchQuery: {
              textSearch: $searchTerm
              limit: $limit
              sortBy: [{ field: "title", direction: "ASC" }]
            }) {
              nodes {
                node {
                  id
                  title
                  content
                }
                score
              }
              totalCount
            }
          }
        `,
        variables: ['tableId', 'searchTerm', 'limit'],
        tags: ['parameterized', 'search'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute with variables
      const result = await executeTemplateUseCase.execute({
        templateIdentifier: 'parameterized-search-template',
        variables: {
          tableId: testTableId,
          searchTerm: 'template',
          limit: 5,
        },
      })

      expect(result.success).toBe(true)
      expect(result.data.table.id).toBe(testTableId)
      expect(result.data.searchNodes.nodes).toHaveLength(2) // Should find 2 nodes with "template"
      expect(result.data.searchNodes.totalCount).toBe(2)
      expect(result.variablesUsed).toEqual({
        tableId: testTableId,
        searchTerm: 'template',
        limit: 5,
      })
    })

    test('should handle complex nested template execution', async () => {
      // Create complex template
      const templateData = {
        identifier: 'complex-nested-template',
        name: 'Complex Nested Template',
        query: `
          query ComplexNested($tableId: ID!) {
            table(id: $tableId) {
              id
              identifier
              attributes {
                id
                identifier
                name
                attributeType {
                  id
                  dataType
                }
              }
              nodes(first: 10) {
                edges {
                  node {
                    id
                    title
                    content
                    attributes {
                      id
                      value
                      attribute {
                        identifier
                        name
                      }
                    }
                    outgoingRelations {
                      id
                      targetNode {
                        id
                        title
                      }
                      relationType {
                        identifier
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                }
              }
            }
            systemStats {
              memory {
                percentage
              }
            }
          }
        `,
        variables: ['tableId'],
        tags: ['complex', 'nested'],
      }

      await createTemplateUseCase.execute(templateData)

      const result = await executeTemplateUseCase.execute({
        templateIdentifier: 'complex-nested-template',
        variables: { tableId: testTableId },
      })

      expect(result.success).toBe(true)
      expect(result.data.table.nodes.edges).toHaveLength(3) // Should find 3 created nodes
      expect(result.data.systemStats.memory).toBeDefined()
    })

    test('should handle template execution errors gracefully', async () => {
      // Create template with potential runtime error
      const templateData = {
        identifier: 'error-prone-template',
        name: 'Error Prone Template',
        query: `
          query ErrorProne($invalidTableId: ID!) {
            table(id: $invalidTableId) {
              id
              identifier
            }
          }
        `,
        variables: ['invalidTableId'],
        tags: ['error'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute with invalid table ID
      const result = await executeTemplateUseCase.execute({
        templateIdentifier: 'error-prone-template',
        variables: { invalidTableId: 'non-existent-table-id' },
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toBeNull()
    })

    test('should validate required variables', async () => {
      const templateData = {
        identifier: 'required-vars-template',
        name: 'Required Variables Template',
        query: `
          query RequiredVars($tableId: ID!, $requiredParam: String!) {
            table(id: $tableId) {
              identifier
            }
          }
        `,
        variables: ['tableId', 'requiredParam'],
        tags: ['validation'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute without required variable
      const result = await executeTemplateUseCase.execute({
        templateIdentifier: 'required-vars-template',
        variables: { tableId: testTableId }, // Missing requiredParam
      })

      expect(result.success).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('requiredParam'),
        }),
      )
    })
  })

  describe('Template Import/Export System', () => {
    test('should export single template with metadata', async () => {
      // Create template
      const templateData = {
        identifier: 'export-test-template',
        name: 'Export Test Template',
        description: 'Template for testing export functionality',
        query: `
          query ExportTest($param: String!) {
            healthCheck {
              status
            }
          }
        `,
        variables: ['param'],
        tags: ['export', 'test'],
      }

      const createResult = await createTemplateUseCase.execute(templateData)
      const templateId = createResult.template.id

      // Export template
      const exportResult = await importExportService.exportTemplate(templateId)

      expect(exportResult.success).toBe(true)
      expect(exportResult.exportData).toMatchObject({
        metadata: {
          exportedAt: expect.any(String),
          version: expect.any(String),
          source: 'Bun Graph Database',
        },
        template: {
          identifier: 'export-test-template',
          name: 'Export Test Template',
          query: expect.stringContaining('ExportTest'),
          variables: ['param'],
          tags: ['export', 'test'],
        },
      })
    })

    test('should import template with validation', async () => {
      const importData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Test System',
        },
        template: {
          identifier: 'imported-test-template',
          name: 'Imported Test Template',
          description: 'Template imported for testing',
          query: `
            query ImportedTest($id: ID!) {
              table(id: $id) {
                identifier
                nodeCount
              }
            }
          `,
          variables: ['id'],
          tags: ['imported', 'test'],
        },
      }

      const result = await importExportService.importTemplate(JSON.stringify(importData), {
        validateSchema: true,
        overwriteExisting: false,
      })

      expect(result.success).toBe(true)
      expect(result.template).toMatchObject({
        identifier: 'imported-test-template',
        name: 'Imported Test Template',
        variables: ['id'],
        tags: ['imported', 'test'],
      })
    })

    test('should handle import conflicts with overwrite options', async () => {
      // Create original template
      const originalTemplate = {
        identifier: 'conflict-template',
        name: 'Original Template',
        query: 'query { healthCheck { status } }',
        variables: [],
        tags: ['original'],
      }

      await createTemplateUseCase.execute(originalTemplate)

      // Attempt to import conflicting template
      const importData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Test System',
        },
        template: {
          identifier: 'conflict-template',
          name: 'Conflicting Template',
          query: 'query { systemStats { memory { used } } }',
          variables: [],
          tags: ['conflicting'],
        },
      }

      // Import without overwrite (should fail)
      const failResult = await importExportService.importTemplate(JSON.stringify(importData), {
        overwriteExisting: false,
      })

      expect(failResult.success).toBe(false)
      expect(failResult.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('already exists'),
        }),
      )

      // Import with overwrite (should succeed)
      const successResult = await importExportService.importTemplate(JSON.stringify(importData), {
        overwriteExisting: true,
      })

      expect(successResult.success).toBe(true)
      expect(successResult.template.name).toBe('Conflicting Template')
    })

    test('should batch export multiple templates', async () => {
      // Create multiple templates
      const templates = [
        {
          identifier: 'batch-template-1',
          name: 'Batch Template 1',
          query: 'query { healthCheck { status } }',
          variables: [],
          tags: ['batch', 'first'],
        },
        {
          identifier: 'batch-template-2',
          name: 'Batch Template 2',
          query: 'query { systemStats { memory { used } } }',
          variables: [],
          tags: ['batch', 'second'],
        },
        {
          identifier: 'batch-template-3',
          name: 'Batch Template 3',
          query: 'query($id: ID!) { table(id: $id) { identifier } }',
          variables: ['id'],
          tags: ['batch', 'third'],
        },
      ]

      const templateIds = []
      for (const template of templates) {
        const result = await createTemplateUseCase.execute(template)
        templateIds.push(result.template.id)
      }

      // Batch export
      const exportResult = await importExportService.batchExportTemplates(templateIds)

      expect(exportResult.success).toBe(true)
      expect(exportResult.exportData.templates).toHaveLength(3)
      expect(exportResult.exportData.metadata).toMatchObject({
        totalTemplates: 3,
        exportedAt: expect.any(String),
      })
    })
  })

  describe('Template Versioning and History', () => {
    test('should track template version history', async () => {
      // Create initial template
      const templateData = {
        identifier: 'versioned-template',
        name: 'Versioned Template',
        query: 'query { healthCheck { status } }',
        variables: [],
        tags: ['versioned'],
        version: '1.0.0',
      }

      const v1Result = await createTemplateUseCase.execute(templateData)
      const templateId = v1Result.template.id

      // Update template (version 2)
      const updatedData = {
        ...templateData,
        query: 'query { healthCheck { status database } }',
        version: '1.1.0',
      }

      const v2Result = await createTemplateUseCase.execute({
        ...updatedData,
        id: templateId,
      })

      expect(v2Result.success).toBe(true)
      expect(v2Result.template.version).toBe('1.1.0')

      // Check version history
      const historyResult = await importExportService.getTemplateHistory(templateId)

      expect(historyResult.versions).toHaveLength(2)
      expect(historyResult.versions[0].version).toBe('1.0.0')
      expect(historyResult.versions[1].version).toBe('1.1.0')
    })

    test('should rollback to previous template version', async () => {
      const templateData = {
        identifier: 'rollback-template',
        name: 'Rollback Template',
        query: 'query { healthCheck { status } }',
        variables: [],
        tags: ['rollback'],
      }

      // Create and update template multiple times
      const v1Result = await createTemplateUseCase.execute(templateData)
      const templateId = v1Result.template.id

      await createTemplateUseCase.execute({
        ...templateData,
        id: templateId,
        query: 'query { healthCheck { status database } }',
        version: '1.1.0',
      })

      await createTemplateUseCase.execute({
        ...templateData,
        id: templateId,
        query: 'query { healthCheck { status database version } }',
        version: '1.2.0',
      })

      // Rollback to version 1.1.0
      const rollbackResult = await importExportService.rollbackTemplate(templateId, '1.1.0')

      expect(rollbackResult.success).toBe(true)
      expect(rollbackResult.template.query).toContain('database')
      expect(rollbackResult.template.query).not.toContain('version')
    })
  })

  describe('Template Performance and Optimization', () => {
    test('should cache frequently executed templates', async () => {
      const templateData = {
        identifier: 'cached-template',
        name: 'Cached Template',
        query: 'query { healthCheck { status timestamp } }',
        variables: [],
        tags: ['cached'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute template multiple times
      const executions = []
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now()
        const result = await executeTemplateUseCase.execute({
          templateIdentifier: 'cached-template',
          variables: {},
        })
        const endTime = Date.now()

        executions.push({
          success: result.success,
          executionTime: endTime - startTime,
        })
      }

      // All executions should succeed
      executions.forEach((exec) => {
        expect(exec.success).toBe(true)
      })

      // Later executions should be faster due to caching
      const firstExecution = executions[0].executionTime
      const lastExecution = executions[4].executionTime
      expect(lastExecution).toBeLessThanOrEqual(firstExecution)
    })

    test('should handle concurrent template executions', async () => {
      const templateData = {
        identifier: 'concurrent-template',
        name: 'Concurrent Template',
        query: `
          query ConcurrentTest($delay: Int = 0) {
            healthCheck {
              status
              timestamp
            }
            systemStats {
              memory {
                used
                total
              }
            }
          }
        `,
        variables: ['delay'],
        tags: ['concurrent'],
      }

      await createTemplateUseCase.execute(templateData)

      // Execute template concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        executeTemplateUseCase.execute({
          templateIdentifier: 'concurrent-template',
          variables: { delay: i * 10 },
        }),
      )

      const results = await Promise.all(promises)

      // All executions should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.data.healthCheck.status).toBe('OK')
        expect(result.variablesUsed.delay).toBe(index * 10)
      })
    })

    test('should optimize large template collections', async () => {
      // Create many templates
      const templatePromises = Array.from({ length: 50 }, (_, i) =>
        createTemplateUseCase.execute({
          identifier: `perf-template-${i}`,
          name: `Performance Template ${i}`,
          query: `query PerfTest${i} { healthCheck { status } }`,
          variables: [],
          tags: ['performance', `batch-${Math.floor(i / 10)}`],
        }),
      )

      await Promise.all(templatePromises)

      // Search and filter templates efficiently
      const startTime = Date.now()
      const searchResult = await importExportService.searchTemplates({
        tags: ['performance'],
        textSearch: 'Performance Template',
        limit: 20,
      })
      const endTime = Date.now()

      expect(searchResult.templates.length).toBe(20)
      expect(searchResult.totalCount).toBe(50)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
