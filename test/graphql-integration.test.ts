import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'

/**
 * GraphQL API Integration Tests
 * 
 * Based on test-management-sample.md scenario:
 * - Create test-management table
 * - Create attributes for test management
 * - Create test nodes with various implementation types
 * - Create relationships between tests
 * - Query and validate data
 */

const GRAPHQL_URL = 'http://localhost:4000/graphql'

// Helper function to make GraphQL requests
async function graphqlRequest(query: string, variables?: any) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

describe('Test Management GraphQL Integration', () => {
  let testTableId: string

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  describe('1. Health Check', () => {
    test('should return healthy status', async () => {
      const result = await graphqlRequest(`
        query {
          health {
            status
            database
            version
          }
        }
      `)

      expect(result.data.health.status).toBe('OK')
      expect(result.data.health.database).toBe(true)
      expect(result.data.health.version).toBe('1.0.0')
    })
  })

  describe('2. Table Management', () => {
    test('should create test-management table', async () => {
      // Create a unique identifier for this test run
      const timestamp = Date.now()
      const tableIdentifier = `test-management-integration-${timestamp}`
      
      const result = await graphqlRequest(`
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table {
              id
              identifier
              description
              createdAt
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          identifier: tableIdentifier,
          description: '다중 구현체 테스트 추적 및 의존성 관리 (Integration Test)'
        }
      })

      expect(result.data.createTable.errors).toHaveLength(0)
      expect(result.data.createTable.table).toBeTruthy()
      expect(result.data.createTable.table.identifier).toBe(tableIdentifier)
      
      testTableId = result.data.createTable.table.id
    })

    test('should list all tables including the new one', async () => {
      const result = await graphqlRequest(`
        query {
          tables {
            nodes {
              id
              identifier
              description
              createdAt
              updatedAt
            }
            totalCount
            hasNextPage
          }
        }
      `)

      expect(result.data.tables.totalCount).toBeGreaterThan(0)
      const testTable = result.data.tables.nodes.find(
        (table: any) => table.identifier === 'test-management-integration'
      )
      expect(testTable).toBeTruthy()
    })

    test('should find table by identifier', async () => {
      const result = await graphqlRequest(`
        query GetTableByIdentifier($identifier: String!) {
          tableByIdentifier(identifier: $identifier) {
            id
            identifier
            description
          }
        }
      `, {
        identifier: 'test-management-integration'
      })

      expect(result.data.tableByIdentifier).toBeTruthy()
      expect(result.data.tableByIdentifier.identifier).toBe('test-management-integration')
    })
  })

  describe('3. Attribute Management', () => {
    test('should create test management attributes', async () => {
      // Create test_type attribute (required string)
      const testTypeResult = await graphqlRequest(`
        mutation CreateTestTypeAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute {
              id
              identifier
              description
              isRequired
              attributeType {
                id
                identifier
                jsonType
              }
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          identifier: "test_type",
          attributeTypeId: "1", // string type
          description: "테스트 유형 (unit/integration/e2e/performance)",
          isRequired: true
        }
      })

      expect(testTypeResult.data.createAttribute.errors).toHaveLength(0)
      expect(testTypeResult.data.createAttribute.attribute.identifier).toBe('test_type')
      expect(testTypeResult.data.createAttribute.attribute.isRequired).toBe(true)

      // Create status attribute (required string)
      const statusResult = await graphqlRequest(`
        mutation CreateStatusAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute {
              id
              identifier
              isRequired
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          identifier: "status",
          attributeTypeId: "1", // string type
          description: "테스트 상태 (passing/failing/flaky/pending)",
          isRequired: true
        }
      })

      expect(statusResult.data.createAttribute.errors).toHaveLength(0)
      expect(statusResult.data.createAttribute.attribute.identifier).toBe('status')

      // Create implementation_locations attribute (required JSON)
      const locationsResult = await graphqlRequest(`
        mutation CreateLocationsAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute {
              id
              identifier
              attributeType {
                identifier
                jsonType
              }
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          identifier: "implementation_locations",
          attributeTypeId: "11", // json type
          description: "구현 파일 경로 배열",
          isRequired: true
        }
      })

      expect(locationsResult.data.createAttribute.errors).toHaveLength(0)
      expect(locationsResult.data.createAttribute.attribute.identifier).toBe('implementation_locations')
      expect(locationsResult.data.createAttribute.attribute.attributeType.jsonType).toBe('object')
    })

    test('should query attributes for the table', async () => {
      const result = await graphqlRequest(`
        query GetTableAttributes($tableId: ID!) {
          attributes(tableId: $tableId) {
            id
            identifier
            description
            isRequired
            attributeType {
              id
              identifier
              jsonType
            }
          }
        }
      `, {
        tableId: testTableId
      })

      expect(result.data.attributes).toBeInstanceOf(Array)
      expect(result.data.attributes.length).toBeGreaterThanOrEqual(3)
      
      const attributeIdentifiers = result.data.attributes.map((attr: any) => attr.identifier)
      expect(attributeIdentifiers).toContain('test_type')
      expect(attributeIdentifiers).toContain('status') 
      expect(attributeIdentifiers).toContain('implementation_locations')
    })

    test('should query available attribute types', async () => {
      const result = await graphqlRequest(`
        query GetAttributeTypes {
          attributeTypes {
            id
            identifier
            jsonType
            description
          }
        }
      `)

      expect(result.data.attributeTypes).toBeInstanceOf(Array)
      expect(result.data.attributeTypes.length).toBeGreaterThan(10)
      
      const types = result.data.attributeTypes.map((type: any) => type.identifier)
      expect(types).toContain('string')
      expect(types).toContain('datetime')
      expect(types).toContain('json')
    })
  })

  describe('4. Test Scenarios Based on Sample', () => {
    test('should demonstrate test management workflow setup', async () => {
      console.log('✅ Table creation and querying works')
      console.log(`   Created table with ID: ${testTableId}`)
      
      console.log('✅ Attribute type and attribute creation works')
      console.log('   Created test_type, status, and implementation_locations attributes')
      
      // TODO: Implement nodes creation  
      console.log('🚧 TODO: Implement node creation with test data')
      
      // TODO: Implement relations creation
      console.log('🚧 TODO: Implement relationship creation between tests')
      
      // TODO: Implement complex queries
      console.log('🚧 TODO: Implement complex search and filtering')
      
      expect(testTableId).toBeTruthy()
    })
  })

  describe('5. Error Handling', () => {
    test('should handle duplicate table creation', async () => {
      const result = await graphqlRequest(`
        mutation CreateDuplicateTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          identifier: 'test-management-integration', // Same identifier
          description: 'Duplicate table test'
        }
      })

      expect(result.data.createTable.table).toBeNull()
      expect(result.data.createTable.errors).toHaveLength(1)
      expect(result.data.createTable.errors[0].code).toBe('CONFLICT')
    })

    test('should handle invalid table identifier', async () => {
      const result = await graphqlRequest(`
        mutation CreateInvalidTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          identifier: '123invalid', // Invalid identifier
          description: 'Invalid identifier test'
        }
      })

      expect(result.data.createTable.table).toBeNull()
      expect(result.data.createTable.errors).toHaveLength(1)
      expect(result.data.createTable.errors[0].code).toBe('DOMAIN_ERROR')
    })
  })

  describe('6. Future Test Scenarios', () => {
    test.skip('should create test attributes based on sample', () => {
      // Will be implemented when attribute operations are available
      // - test_type (string)
      // - status (string)  
      // - implementation_locations (json)
      // - success_rate (string)
      // - last_run (datetime)
      // - etc.
    })

    test.skip('should create test nodes based on sample', () => {
      // Will be implemented when node operations are available
      // - User Authentication Test
      // - API Endpoint Test
      // - Performance Load Test
      // - Database Connection Test
    })

    test.skip('should create test relationships based on sample', () => {
      // Will be implemented when relation operations are available
      // - API Endpoint Test depends_on Database Connection Test
      // - API Endpoint Test depends_on User Authentication Test
      // - Performance Load Test depends_on API Endpoint Test
    })

    test.skip('should search and filter tests based on sample', () => {
      // Will be implemented when search operations are available
      // - Find failing tests
      // - Find flaky tests
      // - Find tests by test suite
      // - Find tests with low coverage
    })
  })
})

// Export for potential use by other test files
export { graphqlRequest }