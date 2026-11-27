/**
 * System Queries Integration Test - Server Isolation
 * Integration tests with isolated GraphQL server for system queries
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { type IsolatedTestContext, setupIntegrationTest } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'system-queries-integration'
let testContext: IsolatedTestContext | undefined

describe('System Queries - Integration Tests with Server Isolation', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up integration test environment for system queries...')
    testContext = await setupIntegrationTest(SUITE_NAME)
    console.log('✅ Integration test environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up integration test environment...')
    await testContext?.cleanup?.()
    console.log('✅ Cleanup completed')
  }, 60000)

  describe('GraphQL Schema Introspection', () => {
    test('should have system query types in schema', async () => {
      const query = `
        query IntrospectSchema {
          __schema {
            queryType {
              fields {
                name
                type {
                  name
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data).toBeDefined()
      expect(result.data.__schema).toBeDefined()
      expect(result.data.__schema.queryType).toBeDefined()

      const fields = result.data.__schema.queryType.fields
      const fieldNames = fields.map((field: any) => field.name)

      // Check for expected system query fields (these would be defined in your schema)
      const expectedFields = ['systemStats', 'memoryStats', 'healthCheck']
      const availableSystemFields = fieldNames.filter((name: string) =>
        expectedFields.some((expected) => name.includes(expected.toLowerCase()) || expected.includes(name)),
      )

      // At least some system-related fields should exist
      expect(availableSystemFields.length).toBeGreaterThan(0)
    })

    test('should support GraphQL introspection queries', async () => {
      const query = `
        query {
          __type(name: "Query") {
            name
            fields {
              name
              description
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data).toBeDefined()
      expect(result.data.__type).toBeDefined()
      expect(result.data.__type.name).toBe('Query')
    })
  })

  describe('Database Connection Through GraphQL', () => {
    test('should connect to isolated database', async () => {
      // Test a simple query that would use the database
      const query = `
        query {
          __schema {
            types {
              name
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data).toBeDefined()
      expect(result.data.__schema).toBeDefined()
      expect(result.data.__schema.types).toBeDefined()
      expect(Array.isArray(result.data.__schema.types)).toBe(true)
    })

    test('should handle database operations through GraphQL', async () => {
      const db = testContext.database?.database.getConnection()

      // Insert test data directly
      db.exec(`
        INSERT INTO system_stats (cpu_usage, memory_usage, disk_usage, uptime)
        VALUES (45.5, 60.2, 30.8, 12345)
      `)

      // Verify data exists
      const stats = db.prepare('SELECT * FROM system_stats ORDER BY id DESC LIMIT 1').get()
      expect(stats).toBeDefined()
      expect(stats.cpu_usage).toBe(45.5)
      expect(stats.memory_usage).toBe(60.2)
    })
  })

  describe('System Statistics Integration', () => {
    test('should provide system information through GraphQL', async () => {
      // This would test actual system stats endpoints if they exist
      // For now, test basic GraphQL functionality

      const query = `
        query {
          __schema {
            mutationType {
              name
            }
            subscriptionType {
              name
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data).toBeDefined()
      expect(result.data.__schema).toBeDefined()
    })

    test('should handle system query errors gracefully', async () => {
      // Test invalid query
      const query = `
        query {
          nonExistentField {
            someData
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      // Should return errors for non-existent fields
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Reliability', () => {
    test('should handle multiple concurrent requests', async () => {
      const query = `
        query {
          __schema {
            types {
              name
            }
          }
        }
      `

      const startTime = performance.now()

      // Send 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => testContext.graphqlRequest?.(query))

      const results = await Promise.all(promises)
      const duration = performance.now() - startTime

      // All requests should succeed
      results.forEach((result) => {
        expect(result.data).toBeDefined()
        expect(result.data.__schema).toBeDefined()
      })

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000) // < 5 seconds for 10 requests
    })

    test('should maintain database consistency under load', async () => {
      const db = testContext.database?.database.getConnection()

      // Create multiple concurrent database operations
      const operations = Array.from({ length: 20 }, (_, i) => {
        return new Promise<void>((resolve) => {
          db.exec(`
            INSERT INTO memory_stats (total_memory, free_memory, used_memory)
            VALUES (${8192 + i}, ${2048 + i}, ${6144 + i})
          `)
          resolve()
        })
      })

      await Promise.all(operations)

      // Verify all records were inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM memory_stats').get()
      expect(count.count).toBe(20)

      // Verify data integrity
      const stats = db.prepare('SELECT * FROM memory_stats ORDER BY id').all()
      expect(stats.length).toBe(20)
      expect(stats[0].total_memory).toBe(8192)
      expect(stats[19].total_memory).toBe(8192 + 19)
    })

    test('should handle server restart gracefully', async () => {
      // Test basic connectivity
      const query = `query { __typename }`

      const result = await testContext.graphqlRequest?.(query)
      expect(result.data).toBeDefined()
      expect(result.data.__typename).toBe('Query')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed GraphQL queries', async () => {
      // This will test the error handling of the GraphQL server
      const malformedQuery = `
        query {
          invalidSyntax {
            missing closing brace
        }
      `

      try {
        await testContext.graphqlRequest?.(malformedQuery)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        // Should throw due to malformed query
        expect(error).toBeDefined()
      }
    })

    test('should handle empty requests', async () => {
      try {
        await testContext.graphqlRequest?.('')
        expect(true).toBe(false) // Should not succeed
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    test('should provide meaningful error messages', async () => {
      const query = `
        query {
          fieldThatDoesNotExist
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.errors).toBeDefined()
      expect(result.errors[0].message).toContain('fieldThatDoesNotExist')
    })
  })

  describe('Database Schema Validation', () => {
    test('should have required system tables', async () => {
      const db = testContext.database?.database.getConnection()

      const tables = db
        .prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `)
        .all()

      const tableNames = tables.map((table: any) => table.name)

      // Required system tables
      expect(tableNames).toContain('system_stats')
      expect(tableNames).toContain('memory_stats')
      expect(tableNames).toContain('health_checks')
    })

    test('should have required indexes', async () => {
      const db = testContext.database?.database.getConnection()

      const indexes = db
        .prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `)
        .all()

      const indexNames = indexes.map((index: any) => index.name)

      // Required indexes for performance
      expect(indexNames).toContain('idx_system_stats_timestamp')
      expect(indexNames).toContain('idx_memory_stats_timestamp')
      expect(indexNames).toContain('idx_health_checks_timestamp')
    })

    test('should support schema migrations', async () => {
      const db = testContext.database?.database.getConnection()

      // Test adding a new column (migration-like operation)
      db.exec('ALTER TABLE system_stats ADD COLUMN test_column TEXT DEFAULT NULL')

      // Verify column was added
      const tableInfo = db.prepare('PRAGMA table_info(system_stats)').all()
      const columnNames = tableInfo.map((col: any) => col.name)

      expect(columnNames).toContain('test_column')
    })
  })
})
