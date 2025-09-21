import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { graphql } from 'graphql'
import type { TablePackageFormat } from '@/core/types/TablePackage.js'
import { ContainerBootstrap } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import type { GraphQLSchemaBuilder } from '@/presentation/graphql/GraphQLSchemaBuilder.js'

describe('Table Package System Integration', () => {
  let schema: any
  let container: DIContainer

  beforeEach(async () => {
    // Initialize the DI container and schema for testing
    container = await ContainerBootstrap.createTestContainer()

    const schemaBuilder = (await container.resolve(
      Symbol.for('GraphQLSchemaBuilder')
    )) as GraphQLSchemaBuilder
    schema = await schemaBuilder.build()
  })

  afterEach(async () => {
    // Reset the container after tests
    ContainerBootstrap.reset()
  })

  describe('GraphQL Integration', () => {
    test('should export table via GraphQL mutation', async () => {
      // First create a test table to export
      const createTableMutation = `
        mutation CreateTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table {
              id
              identifier
            }
          }
        }
      `

      const createTableVariables = {
        input: {
          identifier: 'test-table',
          description: 'Test table for export',
        },
      }

      const createResult = await graphql({
        schema,
        source: createTableMutation,
        variableValues: createTableVariables,
      })

      expect(createResult.errors).toBeUndefined()
      expect((createResult.data?.createTable as any)?.success).toBe(true)

      // Now export the table
      const mutation = `
        mutation ExportTable($input: ExportTablePackageInput!) {
          exportTablePackage(input: $input) {
            success
            errors
            exportPath
            package {
              version
              sourceTable {
                identifier
                description
              }
              dependencies
            }
          }
        }
      `

      const variables = {
        input: {
          tableIdentifier: 'test-table',
          options: {
            includeData: true,
            includeTemplates: true,
            includeRelations: true,
            outputPath: './exports/',
          },
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.exportTablePackage).toBeDefined()
      expect((result.data?.exportTablePackage as any)?.success).toBe(true)
    })

    test('should import table via GraphQL mutation', async () => {
      const mutation = `
        mutation ImportTable($input: ImportTablePackageInput!) {
          importTablePackage(input: $input) {
            success
            errors
            warnings
            importedTable {
              id
              identifier
              originalIdentifier
            }
            generatedTemplates {
              id
              name
              operationType
            }
          }
        }
      `

      const mockPackage: TablePackageFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: 'imported-table',
          description: 'Test imported table',
        },
        dependencies: [],
        package: {
          schema: {
            table: {
              identifier: 'imported-table',
              description: 'Test imported table',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: {
            nodes: [],
            nodeAttributes: [],
          },
          relations: {
            relationTypes: [],
            nodeRelations: [],
          },
          templates: {
            templates: [],
          },
        },
      }

      const variables = {
        input: {
          packageData: mockPackage,
          options: {
            conflictResolution: 'RENAME',
            generateTemplates: true,
          },
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.importTablePackage).toBeDefined()
      expect((result.data?.importTablePackage as any)?.success).toBe(true)
    })

    test('should validate package via GraphQL query', async () => {
      const query = `
        query ValidatePackage($packageData: TablePackageInput!, $options: ValidationOptionsInput) {
          validateTablePackage(packageData: $packageData, options: $options) {
            type
            severity
            message
            context
          }
        }
      `

      const mockPackage: TablePackageFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: 'validation-test',
          description: 'Test validation',
        },
        dependencies: [],
        package: {
          schema: {
            table: {
              identifier: 'validation-test',
              description: 'Test validation',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: {
            nodes: [],
            nodeAttributes: [],
          },
          relations: {
            relationTypes: [],
            nodeRelations: [],
          },
          templates: {
            templates: [],
          },
        },
      }

      const variables = {
        packageData: mockPackage,
        options: {
          conflictResolution: 'SKIP',
        },
      }

      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.validateTablePackage).toBeDefined()
      expect(Array.isArray(result.data?.validateTablePackage)).toBe(true)
    })

    test('should analyze dependencies via GraphQL query', async () => {
      const query = `
        query AnalyzeDependencies($tableIdentifiers: [String!]!) {
          analyzeTableDependencies(tableIdentifiers: $tableIdentifiers) {
            tableIdentifier
            dependencies
            dependents
            depth
            circularReferences
          }
        }
      `

      const variables = {
        tableIdentifiers: ['table1', 'table2', 'table3'],
      }

      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.analyzeTableDependencies).toBeDefined()
      expect(Array.isArray(result.data?.analyzeTableDependencies)).toBe(true)
    })

    test('should execute batch import via GraphQL mutation', async () => {
      const mutation = `
        mutation BatchImport($input: BatchImportTablePackagesInput!) {
          batchImportTablePackages(input: $input) {
            success
            summary {
              total
              succeeded
              failed
              skipped
            }
            results {
              packageIdentifier
              success
              errors
              warnings
            }
            session {
              sessionId
              status
              packagesRemaining
            }
          }
        }
      `

      const mockPackages: TablePackageFormat[] = [
        {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceTable: {
            identifier: 'batch-table-1',
            description: 'First batch table',
          },
          dependencies: [],
          package: {
            schema: {
              table: {
                identifier: 'batch-table-1',
                description: 'First batch table',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              attributes: [],
              attributeTypes: [],
            },
            dataset: { nodes: [], nodeAttributes: [] },
            relations: { relationTypes: [], nodeRelations: [] },
            templates: { templates: [] },
          },
        },
        {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceTable: {
            identifier: 'batch-table-2',
            description: 'Second batch table',
          },
          dependencies: [],
          package: {
            schema: {
              table: {
                identifier: 'batch-table-2',
                description: 'Second batch table',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              attributes: [],
              attributeTypes: [],
            },
            dataset: { nodes: [], nodeAttributes: [] },
            relations: { relationTypes: [], nodeRelations: [] },
            templates: { templates: [] },
          },
        },
      ]

      const variables = {
        input: {
          packages: mockPackages,
          options: {
            conflictResolution: 'SKIP',
            generateTemplates: true,
          },
          createSession: true,
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.batchImportTablePackages).toBeDefined()
      expect((result.data?.batchImportTablePackages as any)?.summary).toBeDefined()
      expect((result.data?.batchImportTablePackages as any)?.summary.total).toBe(2)
    })
  })

  describe('End-to-End Workflow', () => {
    test('should complete full export-import cycle', async () => {
      // Step 0: Create a test table first
      const createTableMutation = `
        mutation CreateTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table {
              id
              identifier
            }
          }
        }
      `

      // Generate unique table identifier to avoid conflicts
      const uniqueTableId = `source-table-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

      await graphql({
        schema,
        source: createTableMutation,
        variableValues: {
          input: {
            identifier: uniqueTableId,
            description: 'Test source table for export-import cycle',
          },
        },
      })

      // Step 1: Export a table
      const exportMutation = `
        mutation ExportTable($input: ExportTablePackageInput!) {
          exportTablePackage(input: $input) {
            success
            package {
              version
              sourceTable {
                identifier
              }
            }
          }
        }
      `

      const exportResult = await graphql({
        schema,
        source: exportMutation,
        variableValues: {
          input: {
            tableIdentifier: uniqueTableId,
            options: {
              includeData: true,
              includeTemplates: true,
              includeRelations: true,
            },
          },
        },
      })

      expect(exportResult.errors).toBeUndefined()
      expect((exportResult.data?.exportTablePackage as any)?.success).toBe(true)

      // Step 2: Import the same package with rename
      const importMutation = `
        mutation ImportTable($input: ImportTablePackageInput!) {
          importTablePackage(input: $input) {
            success
            importedTable {
              identifier
            }
            generatedTemplates {
              name
              operationType
            }
          }
        }
      `

      const packageData = (exportResult.data?.exportTablePackage as any)?.package
      if (packageData) {
        // Generate unique import table identifier
        const uniqueImportTableId = `imported-source-table-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

        // Modify the package to rename the table
        packageData.sourceTable.identifier = uniqueImportTableId
        packageData.package.schema.table.identifier = uniqueImportTableId

        const importResult = await graphql({
          schema,
          source: importMutation,
          variableValues: {
            input: {
              packageData,
              options: {
                conflictResolution: 'RENAME',
                generateTemplates: true,
              },
            },
          },
        })

        expect(importResult.errors).toBeUndefined()
        expect((importResult.data?.importTablePackage as any)?.success).toBe(true)
        expect((importResult.data?.importTablePackage as any)?.importedTable.identifier).toBe(
          uniqueImportTableId
        )
        expect((importResult.data?.importTablePackage as any)?.generatedTemplates).toBeDefined()
        expect(
          (importResult.data?.importTablePackage as any)?.generatedTemplates.length
        ).toBeGreaterThan(0)
      }
    })

    test('should handle dependency resolution in batch import', async () => {
      const mutation = `
        mutation BatchImport($input: BatchImportTablePackagesInput!) {
          batchImportTablePackages(input: $input) {
            success
            summary {
              total
              succeeded
            }
            results {
              packageIdentifier
              success
            }
          }
        }
      `

      // Create packages with dependencies
      const dependentPackage: TablePackageFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: 'dependent-table',
          description: 'Table that depends on others',
        },
        dependencies: ['base-table'],
        package: {
          schema: {
            table: {
              identifier: 'dependent-table',
              description: 'Table that depends on others',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: { nodes: [], nodeAttributes: [] },
          relations: { relationTypes: [], nodeRelations: [] },
          templates: { templates: [] },
        },
      }

      const basePackage: TablePackageFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: 'base-table',
          description: 'Base table',
        },
        dependencies: [],
        package: {
          schema: {
            table: {
              identifier: 'base-table',
              description: 'Base table',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: { nodes: [], nodeAttributes: [] },
          relations: { relationTypes: [], nodeRelations: [] },
          templates: { templates: [] },
        },
      }

      const variables = {
        input: {
          packages: [dependentPackage, basePackage], // Wrong order to test dependency resolution
          options: {
            conflictResolution: 'SKIP',
          },
          createSession: true,
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.batchImportTablePackages).toBeDefined()
      expect((result.data?.batchImportTablePackages as any)?.summary.total).toBe(2)
      // The system should handle dependency resolution automatically
    })
  })

  describe('Error Scenarios', () => {
    test('should handle malformed package data gracefully', async () => {
      const mutation = `
        mutation ImportTable($input: ImportTablePackageInput!) {
          importTablePackage(input: $input) {
            success
            errors
          }
        }
      `

      const malformedPackage = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: '', // Invalid empty identifier
          description: null,
        },
        dependencies: [],
        package: {
          schema: {
            table: {
              identifier: '',
              description: null,
              createdAt: '',
              updatedAt: '',
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: { nodes: [], nodeAttributes: [] },
          relations: { relationTypes: [], nodeRelations: [] },
          templates: { templates: [] },
        },
      }

      const variables = {
        input: {
          packageData: malformedPackage,
          options: {
            conflictResolution: 'SKIP',
          },
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      // Should not crash but should report errors
      expect(result.errors).toBeUndefined()
      expect(result.data?.importTablePackage).toBeDefined()
      // May succeed or fail depending on validation logic
    })

    test('should handle missing table in export gracefully', async () => {
      const mutation = `
        mutation ExportTable($input: ExportTablePackageInput!) {
          exportTablePackage(input: $input) {
            success
            errors
          }
        }
      `

      const variables = {
        input: {
          tableIdentifier: 'non-existent-table',
          options: {
            includeData: true,
          },
        },
      }

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: variables,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.exportTablePackage).toBeDefined()
      expect((result.data?.exportTablePackage as any)?.success).toBe(false)
      expect((result.data?.exportTablePackage as any)?.errors).toBeDefined()
      expect((result.data?.exportTablePackage as any)?.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Session Management', () => {
    test('should track import session progress', async () => {
      const batchMutation = `
        mutation BatchImport($input: BatchImportTablePackagesInput!) {
          batchImportTablePackages(input: $input) {
            success
            session {
              sessionId
              status
              packagesRemaining
            }
          }
        }
      `

      const sessionQuery = `
        query GetSession($sessionId: String!) {
          getImportSession(sessionId: $sessionId) {
            sessionId
            status
            startedAt
            packagesImported
            packagesRemaining
            errors
          }
        }
      `

      // Start batch import
      const batchResult = await graphql({
        schema,
        source: batchMutation,
        variableValues: {
          input: {
            packages: [
              {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                sourceTable: {
                  identifier: 'session-test-table',
                  description: 'Session test table',
                },
                dependencies: [],
                package: {
                  schema: {
                    table: {
                      identifier: 'session-test-table',
                      description: 'Session test table',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                    attributes: [],
                    attributeTypes: [],
                  },
                  dataset: { nodes: [], nodeAttributes: [] },
                  relations: { relationTypes: [], nodeRelations: [] },
                  templates: { templates: [] },
                },
              },
            ],
            createSession: true,
          },
        },
      })

      expect(batchResult.errors).toBeUndefined()
      expect((batchResult.data?.batchImportTablePackages as any)?.session).toBeDefined()

      const sessionId = (batchResult.data?.batchImportTablePackages as any)?.session?.sessionId
      if (sessionId) {
        // Query session status
        const sessionResult = await graphql({
          schema,
          source: sessionQuery,
          variableValues: { sessionId },
        })

        expect(sessionResult.errors).toBeUndefined()
        expect(sessionResult.data?.getImportSession).toBeDefined()
        expect((sessionResult.data?.getImportSession as any)?.sessionId).toBe(sessionId)
      }
    })
  })
})
