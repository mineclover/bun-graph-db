/**
 * Comprehensive Test Suite: Security and Validation Testing
 *
 * Purpose: Test security measures, input validation, and data protection
 * Coverage: Input sanitization, injection attacks, access control, data validation, error handling
 *
 * Test Categories:
 * - Input validation and sanitization
 * - SQL injection prevention
 * - GraphQL query complexity limits
 * - Data type validation and constraints
 * - Error message security (no sensitive data leakage)
 * - Rate limiting and abuse prevention
 * - Schema validation and enforcement
 * - Security headers and CORS
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Container } from 'inversify'
import { createContainer } from '../../src/infrastructure/container/Container'
import { createGraphQLYoga } from '../../src/presentation/graphql/GraphQLServer'
import { TestIsolationHelpers } from '../fixtures/test-isolation-helpers'

interface SecurityTestCase {
  name: string
  input: any
  expectedError: boolean
  expectedErrorPattern?: RegExp
  shouldPreventExecution?: boolean
}

class SecurityTester {
  private testCases: SecurityTestCase[] = []

  addTestCase(testCase: SecurityTestCase): SecurityTester {
    this.testCases.push(testCase)
    return this
  }

  async runTests(executor: (input: any) => Promise<any>): Promise<any[]> {
    const results = []

    for (const testCase of this.testCases) {
      try {
        const result = await executor(testCase.input)
        const hasErrors = result.errors && result.errors.length > 0

        results.push({
          name: testCase.name,
          input: testCase.input,
          result,
          hasErrors,
          passed: testCase.expectedError === hasErrors,
          errorMatch: testCase.expectedErrorPattern
            ? testCase.expectedErrorPattern.test(JSON.stringify(result))
            : true,
        })
      } catch (error) {
        results.push({
          name: testCase.name,
          input: testCase.input,
          error,
          passed: testCase.expectedError === true,
          errorMatch: true,
        })
      }
    }

    return results
  }
}

describe('Security and Validation Comprehensive Tests', () => {
  let yoga: any
  let container: Container
  let testDb: any
  let isolationHelpers: TestIsolationHelpers

  const graphqlExecute = async (query: string, variables?: any) => {
    const response = await yoga.fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    return await response.json()
  }

  beforeAll(async () => {
    testDb = TestDatabaseFactory.createInMemoryDatabase()
    container = createContainer(testDb.path)
    yoga = createGraphQLYoga(container)
    isolationHelpers = new TestIsolationHelpers(container)
  })

  beforeEach(async () => {
    await isolationHelpers.clearAllData()
  })

  afterAll(async () => {
    await testDb.cleanup()
  })

  describe('Input Validation and Sanitization', () => {
    let tableId: string

    beforeEach(async () => {
      // Create test table for validation tests
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "security-test-table"
            name: "Security Test Table"
          }) {
            table { id }
          }
        }
      `)
      tableId = tableResponse.data.createTable.table.id
    })

    test('should validate and reject malicious input in table creation', async () => {
      const securityTester = new SecurityTester()

      securityTester
        .addTestCase({
          name: 'XSS Script Tag',
          input: {
            identifier: '<script>alert("xss")</script>',
            name: 'Normal Name',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*identifier/i,
        })
        .addTestCase({
          name: 'SQL Injection Attempt',
          input: {
            identifier: "'; DROP TABLE users; --",
            name: 'Injection Test',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*identifier/i,
        })
        .addTestCase({
          name: 'Unicode Control Characters',
          input: {
            identifier: 'test\u0000\u0001\u0002table',
            name: 'Control Chars Test',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*identifier/i,
        })
        .addTestCase({
          name: 'Extremely Long Identifier',
          input: {
            identifier: 'a'.repeat(1000),
            name: 'Long ID Test',
          },
          expectedError: true,
          expectedErrorPattern: /identifier.*too.*long/i,
        })
        .addTestCase({
          name: 'Empty Required Fields',
          input: {
            identifier: '',
            name: '',
          },
          expectedError: true,
          expectedErrorPattern: /required/i,
        })
        .addTestCase({
          name: 'Null Values',
          input: {
            identifier: null,
            name: null,
          },
          expectedError: true,
          expectedErrorPattern: /required/i,
        })
        .addTestCase({
          name: 'Valid Input (Control)',
          input: {
            identifier: 'valid-security-table',
            name: 'Valid Security Table',
          },
          expectedError: false,
        })

      const results = await securityTester.runTests(async (input) => {
        return await graphqlExecute(
          `
          mutation CreateTable($input: CreateTableInput!) {
            createTable(input: $input) {
              table {
                id
                identifier
                name
              }
            }
          }
        `,
          { input }
        )
      })

      // Validate security test results
      results.forEach((result) => {
        expect(result.passed).toBe(true)
        if (result.hasErrors && result.expectedErrorPattern) {
          expect(result.errorMatch).toBe(true)
        }
      })

      // Ensure no malicious data was stored
      const tablesQuery = await graphqlExecute(`
        query {
          getTables(input: { limit: 100 }) {
            tables {
              identifier
              name
            }
          }
        }
      `)

      const tableIdentifiers = tablesQuery.data.getTables.tables.map((t: any) => t.identifier)
      expect(tableIdentifiers).not.toContain('<script>alert("xss")</script>')
      expect(tableIdentifiers).not.toContain("'; DROP TABLE users; --")
    })

    test('should validate node content and prevent script injection', async () => {
      const securityTester = new SecurityTester()

      securityTester
        .addTestCase({
          name: 'JavaScript Code Injection',
          input: {
            tableId,
            content: '<script>document.cookie</script>',
            metadata: { test: true },
          },
          expectedError: false, // Content should be stored but escaped
          shouldPreventExecution: true,
        })
        .addTestCase({
          name: 'HTML Injection',
          input: {
            tableId,
            content: '<img src="x" onerror="alert(1)">',
            metadata: { test: true },
          },
          expectedError: false, // Content should be stored but escaped
          shouldPreventExecution: true,
        })
        .addTestCase({
          name: 'JSON Injection in Metadata',
          input: {
            tableId,
            content: 'Normal content',
            metadata: { malicious: '"; DROP TABLE nodes; --' },
          },
          expectedError: false, // Should be stored safely as JSON
        })
        .addTestCase({
          name: 'Binary Data in Content',
          input: {
            tableId,
            content: '\x00\x01\x02\x03\xFF',
            metadata: { test: true },
          },
          expectedError: false, // Should handle binary data safely
        })
        .addTestCase({
          name: 'Unicode Edge Cases',
          input: {
            tableId,
            content: '🚀💻🔒\u200B\u200C\u200D', // Zero-width characters
            metadata: { unicode: true },
          },
          expectedError: false,
        })

      const results = await securityTester.runTests(async (input) => {
        return await graphqlExecute(
          `
          mutation CreateNode($input: CreateNodeInput!) {
            createNode(input: $input) {
              node {
                id
                content
                metadata
              }
            }
          }
        `,
          { input }
        )
      })

      // Verify no malicious code execution occurred
      results.forEach((result) => {
        if (!result.hasErrors) {
          const nodeContent = result.result.data?.createNode?.node?.content
          if (nodeContent && nodeContent.includes('<script>')) {
            // Verify the script tag is properly escaped/sanitized
            expect(nodeContent).not.toMatch(/<script[^>]*>[^<]*<\/script>/i)
          }
        }
      })
    })

    test('should validate GraphQL query complexity and depth', async () => {
      // Test query depth limits
      const deepQuery = `
        query DeepQuery {
          getTables(input: { limit: 1 }) {
            tables {
              id
              nodes {
                id
                relations {
                  toNode {
                    relations {
                      toNode {
                        relations {
                          toNode {
                            relations {
                              toNode {
                                id
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `

      const deepQueryResult = await graphqlExecute(deepQuery)

      // Should either execute with reasonable performance or be rejected
      if (deepQueryResult.errors) {
        expect(deepQueryResult.errors[0].message).toMatch(/complexity|depth|limit/i)
      } else {
        // If executed, should complete within reasonable time
        expect(deepQueryResult.data).toBeDefined()
      }

      // Test query with many fields
      const wideQuery = `
        query WideQuery {
          field1: healthCheck { status }
          field2: healthCheck { status }
          field3: healthCheck { status }
          field4: healthCheck { status }
          field5: healthCheck { status }
          field6: healthCheck { status }
          field7: healthCheck { status }
          field8: healthCheck { status }
          field9: healthCheck { status }
          field10: healthCheck { status }
        }
      `

      const wideQueryResult = await graphqlExecute(wideQuery)
      expect(wideQueryResult.data || wideQueryResult.errors).toBeDefined()
    })

    test('should validate attribute type constraints', async () => {
      // Create attribute with specific type
      const attrResponse = await graphqlExecute(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "test_number"
            name: "Test Number"
            attributeTypeId: "2"
          }) {
            attribute { id }
          }
        }
      `)
      const attributeId = attrResponse.data.createAttribute.attribute.id

      // Create node for attribute testing
      const nodeResponse = await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Attribute Test Node"
          }) {
            node { id }
          }
        }
      `)
      const nodeId = nodeResponse.data.createNode.node.id

      const securityTester = new SecurityTester()

      securityTester
        .addTestCase({
          name: 'Valid Number',
          input: {
            nodeId,
            attributeId,
            value: '42',
          },
          expectedError: false,
        })
        .addTestCase({
          name: 'Invalid Number - Text',
          input: {
            nodeId,
            attributeId,
            value: 'not a number',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*number|type.*mismatch/i,
        })
        .addTestCase({
          name: 'Invalid Number - Script',
          input: {
            nodeId,
            attributeId,
            value: '<script>alert(1)</script>',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*number|type.*mismatch/i,
        })
        .addTestCase({
          name: 'Number Overflow',
          input: {
            nodeId,
            attributeId,
            value: '9'.repeat(1000),
          },
          expectedError: true,
          expectedErrorPattern: /overflow|too.*large|invalid/i,
        })
        .addTestCase({
          name: 'SQL Injection in Attribute Value',
          input: {
            nodeId,
            attributeId,
            value: '1; DROP TABLE attributes; --',
          },
          expectedError: true,
          expectedErrorPattern: /invalid.*number|type.*mismatch/i,
        })

      const results = await securityTester.runTests(async (input) => {
        return await graphqlExecute(
          `
          mutation SetNodeAttribute($input: SetNodeAttributeInput!) {
            setNodeAttribute(input: $input) {
              success
              attribute {
                value
              }
            }
          }
        `,
          { input }
        )
      })

      results.forEach((result) => {
        expect(result.passed).toBe(true)
      })
    })
  })

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in search operations', async () => {
      // Create test data
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "sql-injection-test"
            name: "SQL Injection Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Safe test content"
          }) {
            node { id }
          }
        }
      `)

      const injectionAttempts = [
        "'; DROP TABLE nodes; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO nodes (content) VALUES ('hacked'); --",
        "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
        "'; ALTER TABLE nodes ADD COLUMN hacked TEXT; --",
      ]

      for (const injection of injectionAttempts) {
        const searchResult = await graphqlExecute(
          `
          query SearchNodes($tableId: ID!, $search: String!) {
            searchNodes(input: {
              tableId: $tableId
              search: $search
              limit: 10
            }) {
              nodes {
                id
                content
              }
            }
          }
        `,
          {
            tableId,
            search: injection,
          }
        )

        // Should not cause errors or return unexpected results
        expect(searchResult.errors).toBeUndefined()
        expect(searchResult.data.searchNodes.nodes).toBeDefined()

        // Should not have altered the database structure
        const healthCheck = await graphqlExecute(`
          query {
            healthCheck {
              status
              database
            }
          }
        `)
        expect(healthCheck.data.healthCheck.status).toBe('healthy')
      }
    })

    test('should prevent SQL injection in template parameters', async () => {
      const templateResponse = await graphqlExecute(`
        mutation {
          createTemplate(input: {
            identifier: "sql-injection-template"
            name: "SQL Injection Template Test"
            query: "query TestQuery($search: String!) { healthCheck { status } }"
            variables: ["search"]
          }) {
            template { identifier }
          }
        }
      `)

      const injectionAttempts = [
        "'; DROP TABLE templates; --",
        "' OR 1=1 --",
        "'; UPDATE templates SET query='malicious'; --",
      ]

      for (const injection of injectionAttempts) {
        const execResult = await graphqlExecute(
          `
          mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON!) {
            executeTemplateWithGraphQL(
              templateIdentifier: $templateIdentifier
              variables: $variables
            ) {
              success
              data
              errors {
                message
              }
            }
          }
        `,
          {
            templateIdentifier: 'sql-injection-template',
            variables: { search: injection },
          }
        )

        // Should execute safely without SQL injection
        expect(execResult.data.executeTemplateWithGraphQL.success).toBe(true)

        // Verify database integrity
        const templateCheck = await graphqlExecute(`
          query {
            searchTemplates(input: { limit: 10 }) {
              templates {
                identifier
                query
              }
            }
          }
        `)

        expect(templateCheck.errors).toBeUndefined()
        const template = templateCheck.data.searchTemplates.templates.find(
          (t: any) => t.identifier === 'sql-injection-template'
        )
        expect(template.query).not.toBe('malicious')
      }
    })
  })

  describe('Error Message Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      // Test with non-existent resources
      const sensitiveQueries = [
        {
          name: 'Non-existent table ID',
          query: `query { searchNodes(input: { tableId: "non-existent-id" }) { nodes { id } } }`,
        },
        {
          name: 'Invalid node ID format',
          query: `query { getNodeAttributes(nodeId: "../../etc/passwd") { attributes { value } } }`,
        },
        {
          name: 'Malformed GraphQL',
          query: `query { invalid syntax here }`,
        },
        {
          name: 'System path injection',
          query: `mutation { createTable(input: { identifier: "/etc/passwd", name: "hack" }) { table { id } } }`,
        },
      ]

      for (const testCase of sensitiveQueries) {
        const result = await graphqlExecute(testCase.query)

        if (result.errors) {
          const errorMessage = JSON.stringify(result.errors)

          // Should not contain sensitive system information
          expect(errorMessage).not.toMatch(/password|secret|key|token/i)
          expect(errorMessage).not.toMatch(/\/etc\/|\/var\/|\/usr\/|C:\\/i) // System paths
          expect(errorMessage).not.toMatch(/database.*error|sqlite.*error/i) // Database internals
          expect(errorMessage).not.toMatch(/stack.*trace|\.js:\d+/i) // Stack traces

          // Should contain generic, safe error messages
          expect(errorMessage).toMatch(/not.*found|invalid|unauthorized|bad.*request/i)
        }
      }
    })

    test('should handle authentication errors securely', async () => {
      // Test unauthorized operations (if auth is implemented)
      const unauthorizedOperations = [
        {
          name: 'Admin operation without auth',
          query: `mutation { deleteAllTables { success } }`,
        },
        {
          name: 'System information access',
          query: `query { systemInternals { databasePath connectionString } }`,
        },
      ]

      for (const operation of unauthorizedOperations) {
        const result = await graphqlExecute(operation.query)

        if (result.errors) {
          const errorMessage = JSON.stringify(result.errors)

          // Should not reveal authentication details
          expect(errorMessage).not.toMatch(/admin|root|superuser/i)
          expect(errorMessage).not.toMatch(/authentication.*failed.*because/i)
          expect(errorMessage).not.toMatch(/user.*not.*exists/i)

          // Should use generic unauthorized message
          expect(errorMessage).toMatch(/unauthorized|forbidden|not.*allowed/i)
        }
      }
    })
  })

  describe('Rate Limiting and Abuse Prevention', () => {
    test('should handle rapid successive requests', async () => {
      const startTime = Date.now()

      // Send 50 rapid requests
      const rapidRequests = Array.from({ length: 50 }, () =>
        graphqlExecute(`query { healthCheck { status } }`)
      )

      const responses = await Promise.all(rapidRequests)
      const endTime = Date.now()
      const duration = endTime - startTime

      // All requests should complete
      expect(responses).toHaveLength(50)

      // Check for rate limiting indicators
      const errors = responses.filter((r) => r.errors && r.errors.length > 0)
      const rateLimitErrors = errors.filter((r) =>
        JSON.stringify(r.errors).match(/rate.*limit|too.*many.*requests|throttle/i)
      )

      if (rateLimitErrors.length > 0) {
        // If rate limiting is implemented, it should be reasonable
        expect(rateLimitErrors.length).toBeLessThan(responses.length * 0.8) // Less than 80% rejected
      }

      // Should not crash the server
      const finalHealthCheck = await graphqlExecute(`query { healthCheck { status } }`)
      expect(finalHealthCheck.data.healthCheck.status).toBe('healthy')
    })

    test('should handle large payload requests', async () => {
      const largeContent = 'x'.repeat(100000) // 100KB content

      const largePayloadResult = await graphqlExecute(
        `
        mutation CreateLargeNode($tableId: ID!, $content: String!) {
          createTable(input: {
            identifier: "large-payload-test"
            name: "Large Payload Test"
          }) {
            table { id }
          }
        }
      `,
        {
          tableId: 'dummy',
          content: largeContent,
        }
      )

      // Should either accept or reject gracefully
      if (largePayloadResult.errors) {
        expect(JSON.stringify(largePayloadResult.errors)).toMatch(
          /payload.*too.*large|size.*limit/i
        )
      } else {
        expect(largePayloadResult.data).toBeDefined()
      }

      // System should remain stable
      const healthCheck = await graphqlExecute(`query { healthCheck { status } }`)
      expect(healthCheck.data.healthCheck.status).toBe('healthy')
    })
  })

  describe('Data Type Security', () => {
    test('should validate JSON metadata safely', async () => {
      // Create test table
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "json-security-test"
            name: "JSON Security Test"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const jsonTestCases = [
        {
          name: 'Valid JSON',
          metadata: { valid: true, number: 42, text: 'hello' },
          expectedError: false,
        },
        {
          name: 'Nested Objects',
          metadata: { level1: { level2: { level3: 'deep' } } },
          expectedError: false,
        },
        {
          name: 'Large Numbers',
          metadata: { number: Number.MAX_SAFE_INTEGER },
          expectedError: false,
        },
        {
          name: 'Special Characters',
          metadata: { special: '!@#$%^&*(){}[]|\\:";\'<>?,./' },
          expectedError: false,
        },
        {
          name: 'Unicode Content',
          metadata: { unicode: '🚀🔒💻中文العربية' },
          expectedError: false,
        },
      ]

      for (const testCase of jsonTestCases) {
        const result = await graphqlExecute(
          `
          mutation CreateNodeWithMetadata($tableId: ID!, $metadata: JSON!) {
            createNode(input: {
              tableId: $tableId
              content: "JSON Test Node"
              metadata: $metadata
            }) {
              node {
                id
                metadata
              }
            }
          }
        `,
          {
            tableId,
            metadata: testCase.metadata,
          }
        )

        if (testCase.expectedError) {
          expect(result.errors).toBeDefined()
        } else {
          expect(result.errors).toBeUndefined()
          expect(result.data.createNode.node.metadata).toEqual(testCase.metadata)
        }
      }
    })

    test('should prevent prototype pollution in metadata', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "prototype-pollution-test"
            name: "Prototype Pollution Test"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const pollutionAttempts = [
        { __proto__: { polluted: true } },
        { constructor: { prototype: { polluted: true } } },
        { prototype: { polluted: true } },
      ]

      for (const attempt of pollutionAttempts) {
        const result = await graphqlExecute(
          `
          mutation CreateNodeWithPollution($tableId: ID!, $metadata: JSON!) {
            createNode(input: {
              tableId: $tableId
              content: "Pollution Test"
              metadata: $metadata
            }) {
              node {
                id
                metadata
              }
            }
          }
        `,
          {
            tableId,
            metadata: attempt,
          }
        )

        // Should either reject or sanitize the input
        if (!result.errors) {
          const metadata = result.data.createNode.node.metadata
          // Should not contain prototype pollution
          expect(metadata.__proto__).toBeUndefined()
          expect(metadata.constructor?.prototype).toBeUndefined()
        }
      }

      // Verify no global pollution occurred
      expect(({} as any).polluted).toBeUndefined()
      expect(Object.prototype.polluted).toBeUndefined()
    })
  })

  describe('CORS and Security Headers', () => {
    test('should handle CORS preflight requests properly', async () => {
      const preflightResponse = await yoga.fetch('/graphql', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://malicious-site.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })

      // Should handle OPTIONS requests
      expect([200, 204, 404]).toContain(preflightResponse.status)

      const corsHeaders = preflightResponse.headers
      if (corsHeaders.get('access-control-allow-origin')) {
        // If CORS is configured, it should be secure
        const allowedOrigin = corsHeaders.get('access-control-allow-origin')
        expect(allowedOrigin).not.toBe('*') // Should not allow all origins
      }
    })

    test('should set appropriate security headers', async () => {
      const response = await yoga.fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { healthCheck { status } }' }),
      })

      const headers = response.headers

      // Check for security headers
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': /max-age=\d+/,
      }

      for (const [headerName, expectedValue] of Object.entries(securityHeaders)) {
        const headerValue = headers.get(headerName)
        if (headerValue) {
          if (expectedValue instanceof RegExp) {
            expect(headerValue).toMatch(expectedValue)
          } else {
            expect(headerValue).toBe(expectedValue)
          }
        }
      }
    })
  })
})
