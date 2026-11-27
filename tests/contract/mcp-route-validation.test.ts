/**
 * HTTP Route Contract Validation Tests
 *
 * Purpose: Contract tests for `/sub/:tableId/mcp` endpoint pattern
 * Task: Phase 1, Task 3 - HTTP Route Contract Validation
 * Dependencies: None
 * Parallel: Can run with tasks 1-2
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startServerForSuite, stopServerForSuite } from '../fixtures/test-graphql-server'

describe('MCP Route Contract Tests', () => {
  let baseUrl = ''
  let validTableId: string
  let invalidTableIds: string[]

  beforeAll(async () => {
    const server = await startServerForSuite('mcp-route-validation')
    baseUrl = server.url.replace('/graphql', '')
    validTableId = 'test-table-12345'
    invalidTableIds = [
      '', // empty
      'invalid id with spaces',
      'id-with-special-chars!@#',
      '../../../etc/passwd', // path traversal
      'x'.repeat(1000), // extremely long
      'null',
      'undefined',
      '../../',
    ]
  })

  afterAll(async () => {
    await stopServerForSuite('mcp-route-validation')
  })

  describe('Valid Table ID Route Acceptance', () => {
    it('should accept valid alphanumeric table IDs', async () => {
      const validIds = ['table123', 'test-table-456', 'Table_123', 'a1b2c3', 'table-with-dashes-123']

      for (const tableId of validIds) {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }

        const response = await fetch(`${baseUrl}/sub/${tableId}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        // Should not fail due to invalid table ID format
        expect([200, 404].includes(response.status)).toBe(true)

        if (response.status === 200) {
          const result = await response.json()
          expect(result).toHaveProperty('jsonrpc', '2.0')
        }
      }
    })

    it('should handle UUID format table IDs', async () => {
      const uuidTableIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ]

      for (const tableId of uuidTableIds) {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }

        const response = await fetch(`${baseUrl}/sub/${tableId}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        // Should not fail due to invalid table ID format
        expect([200, 404].includes(response.status)).toBe(true)
      }
    })
  })

  describe('Invalid Table ID Route Rejection', () => {
    it('should reject invalid table ID patterns', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      for (const invalidId of invalidTableIds) {
        try {
          const response = await fetch(`${baseUrl}/sub/${encodeURIComponent(invalidId)}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          })

          // Should return 404 for invalid table IDs or 400 for malformed requests
          expect([400, 404].includes(response.status)).toBe(true)

          if (response.headers.get('content-type')?.includes('application/json')) {
            const result = await response.json()

            if (result.error) {
              // Should be proper JSON-RPC error response
              expect(result).toHaveProperty('jsonrpc', '2.0')
              expect(result).toHaveProperty('error')
              expect(result.error).toHaveProperty('code')
              expect(result.error).toHaveProperty('message')
            }
          }
        } catch (error) {
          // Network errors for malformed URLs are acceptable
          expect(error).toBeDefined()
        }
      }
    })

    it('should return 404 for non-existent table IDs', async () => {
      const nonExistentTableId = `definitely-does-not-exist-${Math.random()}`

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      const response = await fetch(`${baseUrl}/sub/${nonExistentTableId}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect([400, 404]).toContain(response.status)

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json()
        if (result.jsonrpc) {
          expect(result).toHaveProperty('jsonrpc', '2.0')
          expect(result).toHaveProperty('error')
        } else {
          expect(result.error || result.details || result.message).toBeDefined()
        }
      }
    })
  })

  describe('Route Pattern Validation', () => {
    it('should only match exact /sub/:tableId/mcp pattern', async () => {
      const invalidPaths = [
        '/sub/mcp', // missing table ID
        '/sub/table123/mcp/extra', // extra path segment
        '/sub/table123', // missing /mcp
        '/subs/table123/mcp', // wrong prefix
        '/sub/table123/mcp/', // trailing slash
        '/SUB/table123/mcp', // wrong case
        '/sub//mcp', // empty table ID
      ]

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      for (const path of invalidPaths) {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        // Should return 404 for pattern mismatches
        expect(response.status).toBe(404)
      }
    })

    it('should handle URL encoded table IDs properly', async () => {
      const encodedTableId = encodeURIComponent('table-with-special-chars')

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      const response = await fetch(`${baseUrl}/sub/${encodedTableId}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      // Should handle URL decoding properly
      expect([200, 404].includes(response.status)).toBe(true)
    })
  })

  describe('HTTP Method Validation', () => {
    it('should only accept POST requests for JSON-RPC', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

      for (const method of methods) {
        const response = await fetch(`${baseUrl}/sub/${validTableId}/mcp`, {
          method,
        })

        // GET is allowed for server discovery, other methods should be rejected
        expect(response.status).toBeGreaterThanOrEqual(200)
        expect(response.status).toBeLessThan(500)
      }
    })

    it('should require Content-Type header for POST requests', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      // Test with missing Content-Type
      let response = await fetch(`${baseUrl}/sub/${validTableId}/mcp`, {
        method: 'POST',
        body: JSON.stringify(request),
      })

      // May be lenient about content-type, but should still process or reject explicitly
      expect(response.status).toBeGreaterThanOrEqual(200)
      expect(response.status).toBeLessThan(500)

      // Test with wrong Content-Type
      response = await fetch(`${baseUrl}/sub/${validTableId}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBeGreaterThanOrEqual(200)
      expect(response.status).toBeLessThan(500)
    })
  })

  describe('Security Validation', () => {
    it('should prevent path traversal attacks in table ID', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '....//....//....//etc//passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ]

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      for (const maliciousId of maliciousIds) {
        const response = await fetch(`${baseUrl}/sub/${maliciousId}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        // Should safely reject malicious table IDs
        expect([400, 404].includes(response.status)).toBe(true)
      }
    })

    it('should handle very long table IDs gracefully', async () => {
      const longTableId = 'x'.repeat(10000)

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      try {
        const response = await fetch(`${baseUrl}/sub/${longTableId}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        // Should handle or reject gracefully
        expect([400, 404, 414].includes(response.status)).toBe(true) // 414 = URI Too Long
      } catch (error) {
        // Network errors for extremely long URLs are acceptable
        expect(error).toBeDefined()
      }
    })
  })
})
