import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import { graphqlRequest } from './graphql-integration.test.js'

/**
 * Schema Export/Import Integration Tests
 * Tests the complete schema export and import functionality
 */

const GRAPHQL_URL = 'http://localhost:4000/graphql'

describe('Schema Export/Import Tests', () => {
  let testTableId: string
  let exportedSchema: any

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  describe('1. Setup Test Data', () => {
    test('should create test table with attributes and nodes', async () => {
      const timestamp = Date.now()
      const tableIdentifier = `export-test-table-${timestamp}`
      
      // Create table
      const tableResult = await graphqlRequest(`
        mutation CreateExportTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table {
              id
              identifier
              description
            }
            errors { message }
          }
        }
      `, {
        input: {
          identifier: tableIdentifier,
          description: 'Test table for schema export/import functionality'
        }
      })

      expect(tableResult.data.createTable.errors).toHaveLength(0)
      testTableId = tableResult.data.createTable.table.id

      // Create test attributes
      const attributeResult = await graphqlRequest(`
        mutation CreateTestAttributes($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute {
              id
              identifier
            }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          identifier: "test_field",
          attributeTypeId: "1", // string type
          description: "Test field for export",
          isRequired: true
        }
      })

      expect(attributeResult.data.createAttribute.errors).toHaveLength(0)
    })
  })

  describe('2. Schema Export Tests', () => {
    test('should export single table schema', async () => {
      const result = await graphqlRequest(`
        query ExportTableSchema($tableId: ID!) {
          exportTable(tableId: $tableId) {
            metadata {
              exportedAt
              version
              source
            }
            tables {
              identifier
              description
              attributes {
                identifier
                description
                isRequired
                attributeType {
                  identifier
                  jsonType
                }
              }
              nodes {
                content
                title
                description
              }
              statistics {
                nodeCount
                relationCount
                attributeCount
              }
            }
            statistics {
              totalTables
              totalNodes
              totalRelations
              totalAttributes
            }
          }
        }
      `, {
        tableId: testTableId
      })

      expect(result.data.exportTable).toBeTruthy()
      expect(result.data.exportTable.metadata.version).toBe('1.0.0')
      expect(result.data.exportTable.tables).toHaveLength(1)
      expect(result.data.exportTable.tables[0].attributes.length).toBeGreaterThan(0)
      
      exportedSchema = result.data.exportTable
    })

    test('should export all tables schema', async () => {
      const result = await graphqlRequest(`
        query ExportAllTables {
          exportAllTables {
            metadata {
              exportedAt
              version
              source
            }
            tables {
              identifier
              description
              attributes {
                identifier
              }
            }
            globalAttributeTypes {
              identifier
              jsonType
            }
            globalRelationTypes {
              identifier
              description
            }
            statistics {
              totalTables
              totalNodes
              totalRelations
            }
          }
        }
      `)

      expect(result.data.exportAllTables).toBeTruthy()
      expect(result.data.exportAllTables.tables.length).toBeGreaterThan(0)
      expect(result.data.exportAllTables.globalAttributeTypes.length).toBeGreaterThan(10)
    })
  })

  describe('3. Schema Import Tests', () => {
    test('should import schema successfully', async () => {
      // Modify the exported schema for import test
      const importSchema = {
        ...exportedSchema,
        tables: exportedSchema.tables.map((table: any) => ({
          ...table,
          identifier: `imported_${table.identifier}`,
          description: `Imported: ${table.description}`
        }))
      }

      const result = await graphqlRequest(`
        mutation ImportSchema($exportData: JSON!, $options: JSON) {
          importSchema(exportData: $exportData, options: $options) {
            success
            statistics {
              tablesImported
              nodesImported
              relationsImported
              attributesImported
            }
            errors {
              type
              message
            }
            warnings {
              type
              message
            }
            executionTime
          }
        }
      `, {
        exportData: importSchema,
        options: {
          conflictStrategy: "SKIP",
          validateOnly: false
        }
      })

      expect(result.data.importSchema.success).toBe(true)
      expect(result.data.importSchema.statistics.tablesImported).toBeGreaterThan(0)
      expect(result.data.importSchema.errors).toHaveLength(0)
    })

    test('should validate import with dry run', async () => {
      const result = await graphqlRequest(`
        mutation ValidateImport($exportData: JSON!, $options: JSON) {
          importSchema(exportData: $exportData, options: $options) {
            success
            statistics {
              tablesImported
              skipped
            }
            errors {
              type
              message
            }
            warnings {
              type  
              message
            }
          }
        }
      `, {
        exportData: exportedSchema,
        options: {
          validateOnly: true,
          conflictStrategy: "SKIP"
        }
      })

      expect(result.data.importSchema).toBeTruthy()
      expect(result.data.importSchema.statistics).toBeTruthy()
    })

    test('should handle import conflicts appropriately', async () => {
      // Try to import the same schema again (should create conflicts)
      const result = await graphqlRequest(`
        mutation ImportConflictTest($exportData: JSON!, $options: JSON) {
          importSchema(exportData: $exportData, options: $options) {
            success
            statistics {
              tablesImported
              skipped
              errors
            }
            errors {
              type
              message
            }
            warnings {
              type
              message
            }
          }
        }
      `, {
        exportData: exportedSchema,
        options: {
          conflictStrategy: "SKIP",
          validateOnly: false
        }
      })

      // Should succeed but with skipped items due to conflicts
      expect(result.data.importSchema.success).toBe(true)
      expect(result.data.importSchema.statistics.skipped).toBeGreaterThan(0)
    })
  })

  describe('4. Advanced Export Features', () => {
    test('should export with custom options', async () => {
      const result = await graphqlRequest(`
        query ExportWithOptions($tableId: ID!, $options: JSON) {
          exportTable(tableId: $tableId, options: $options) {
            metadata {
              exportedAt
              version
              source
              checksum
            }
            tables {
              identifier
              nodes {
                content
                attributes
              }
            }
          }
        }
      `, {
        tableId: testTableId,
        options: {
          includeMetadata: true,
          includeNodeAttributes: true,
          generateChecksum: true
        }
      })

      expect(result.data.exportTable.metadata.checksum).toBeTruthy()
      expect(result.data.exportTable.tables[0].nodes).toBeInstanceOf(Array)
    })
  })

  describe('5. Error Handling', () => {
    test('should handle invalid table ID for export', async () => {
      const result = await graphqlRequest(`
        query ExportInvalidTable($tableId: ID!) {
          exportTable(tableId: $tableId) {
            metadata {
              exportedAt
            }
            tables {
              identifier
            }
          }
        }
      `, {
        tableId: "invalid_table_id"
      })

      // GraphQL should return null for exportTable if table not found
      expect(result.data.exportTable).toBeNull()
    })

    test('should handle malformed import data', async () => {
      const result = await graphqlRequest(`
        mutation ImportMalformed($exportData: JSON!) {
          importSchema(exportData: $exportData) {
            success
            errors {
              type
              message
            }
          }
        }
      `, {
        exportData: {
          invalid: "schema structure"
        }
      })

      expect(result.data.importSchema.success).toBe(false)
      expect(result.data.importSchema.errors.length).toBeGreaterThan(0)
      expect(result.data.importSchema.errors[0].type).toBe('VALIDATION_ERROR')
    })
  })
})