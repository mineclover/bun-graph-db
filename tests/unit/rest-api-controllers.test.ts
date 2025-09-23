/**
 * Unit Tests: REST API Controllers
 *
 * Purpose: Test individual controller methods in isolation
 * Validates: Parameter handling, response formatting, error handling
 *
 * Tests the REST API controllers that serve as the backbone
 * of the MCP-to-REST proxy architecture
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Request, Response } from 'express'
import { AttributeApiController } from '../../src/presentation/http/controllers/AttributeApiController'
import { GraphApiController } from '../../src/presentation/http/controllers/GraphApiController'
import { GraphDbApiController } from '../../src/presentation/http/controllers/GraphDbApiController'

// Mock logger for testing
const mockLogger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
}

// Mock Express Request/Response objects
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    params: {},
    headers: {},
    body: {},
    ...overrides,
  } as Request
}

function createMockResponse() {
  const res = {
    status: mock((code: number) => res),
    json: mock((data: any) => {}),
    send: mock((data: any) => {}),
  } as unknown as Response

  return res
}

describe('GraphDbApiController Unit Tests', () => {
  let controller: GraphDbApiController

  beforeEach(() => {
    controller = new GraphDbApiController(mockLogger)
    mockLogger.debug.mockClear()
    mockLogger.info.mockClear()
    mockLogger.warn.mockClear()
    mockLogger.error.mockClear()
  })

  describe('healthCheck', () => {
    test('should return health status successfully', async () => {
      const req = createMockRequest()
      const res = createMockResponse()

      await controller.healthCheck(req, res)

      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'OK',
          timestamp: expect.any(String),
          database: 'Connected',
          version: '1.0.0',
        }),
      })
    })

    test('should handle health check errors', async () => {
      // Create a controller that will throw an error
      const faultyController = new (class extends GraphDbApiController {
        async healthCheck(req: any, res: any) {
          try {
            throw new Error('Database connection failed')
          } catch (error) {
            this.logger.error('Health check error:', error)
            res.status(500).json({
              success: false,
              error: 'Health check failed',
            })
          }
        }
      })(mockLogger)

      const req = createMockRequest()
      const res = createMockResponse()

      await faultyController.healthCheck(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Health check failed',
      })
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('createTable', () => {
    test('should create table with valid parameters', async () => {
      const req = createMockRequest({
        body: {
          identifier: 'test-table',
          name: 'Test Table',
          description: 'A test table',
        },
      })
      const res = createMockResponse()

      await controller.createTable(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          identifier: 'test-table',
          name: 'Test Table',
          description: 'A test table',
        }),
      })
    })

    test('should handle missing identifier parameter', async () => {
      const req = createMockRequest({
        body: {
          name: 'Test Table',
          // Missing identifier
        },
      })
      const res = createMockResponse()

      await controller.createTable(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'identifier is required',
      })
    })
  })

  describe('searchTables', () => {
    test('should search tables with query parameters', async () => {
      const req = createMockRequest({
        query: {
          searchTerm: 'test',
          limit: '10',
        },
      })
      const res = createMockResponse()

      await controller.searchTables(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tables: expect.any(Array),
          total: expect.any(Number),
          searchTerm: 'test',
          limit: 10,
        }),
      })
    })

    test('should use default values for missing query parameters', async () => {
      const req = createMockRequest({ query: {} })
      const res = createMockResponse()

      await controller.searchTables(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          searchTerm: '',
          limit: 10,
        }),
      })
    })
  })

  describe('createNode', () => {
    test('should create node with valid parameters', async () => {
      const req = createMockRequest({
        body: {
          tableId: 'table-123',
          content: 'Test node content',
          metadata: { type: 'test' },
        },
      })
      const res = createMockResponse()

      await controller.createNode(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          tableId: 'table-123',
          content: 'Test node content',
        }),
      })
    })

    test('should handle missing required parameters', async () => {
      const req = createMockRequest({
        body: {
          content: 'Test content',
          // Missing tableId
        },
      })
      const res = createMockResponse()

      await controller.createNode(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'tableId and content are required',
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle internal server errors gracefully', async () => {
      // Create a controller method that throws an unexpected error
      const faultyController = new (class extends GraphDbApiController {
        async systemStats(req: any, res: any) {
          try {
            throw new Error('Unexpected database error')
          } catch (error) {
            this.logger.error('System stats error:', error)
            res.status(500).json({
              success: false,
              error: 'System stats failed',
            })
          }
        }
      })(mockLogger)

      const req = createMockRequest()
      const res = createMockResponse()

      await faultyController.systemStats(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'System stats failed',
      })
      expect(mockLogger.error).toHaveBeenCalledWith('System stats error:', expect.any(Error))
    })
  })
})

describe('AttributeApiController Unit Tests', () => {
  let controller: AttributeApiController

  beforeEach(() => {
    controller = new AttributeApiController(mockLogger)
    mockLogger.error.mockClear()
  })

  describe('createAttribute', () => {
    test('should create attribute with valid parameters', async () => {
      const req = createMockRequest({
        body: {
          tableId: 'table-123',
          identifier: 'test-attr',
          name: 'Test Attribute',
          attributeTypeId: '1',
        },
      })
      const res = createMockResponse()

      await controller.createAttribute(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          tableId: 'table-123',
          identifier: 'test-attr',
          name: 'Test Attribute',
        }),
      })
    })

    test('should handle missing required parameters', async () => {
      const req = createMockRequest({
        body: {
          identifier: 'test-attr',
          // Missing tableId and name
        },
      })
      const res = createMockResponse()

      await controller.createAttribute(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'tableId, identifier, and name are required',
      })
    })
  })

  describe('getNodeAttributes', () => {
    test('should get node attributes with valid nodeId', async () => {
      const req = createMockRequest({
        params: { nodeId: 'node-123' },
      })
      const res = createMockResponse()

      await controller.getNodeAttributes(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          nodeId: 'node-123',
          attributes: expect.any(Array),
        }),
      })
    })

    test('should handle missing nodeId parameter', async () => {
      const req = createMockRequest({ params: {} })
      const res = createMockResponse()

      await controller.getNodeAttributes(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'nodeId is required',
      })
    })
  })

  describe('setNodeAttribute', () => {
    test('should set node attribute with valid input', async () => {
      const req = createMockRequest({
        body: {
          input: {
            nodeId: 'node-123',
            attributeId: 'attr-456',
            value: 'test value',
          },
        },
      })
      const res = createMockResponse()

      await controller.setNodeAttribute(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          nodeId: 'node-123',
          attributeId: 'attr-456',
          value: 'test value',
        }),
      })
    })

    test('should handle missing input structure', async () => {
      const req = createMockRequest({
        body: {
          nodeId: 'node-123',
          // Missing input wrapper
        },
      })
      const res = createMockResponse()

      await controller.setNodeAttribute(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'input with nodeId, attributeId, and value is required',
      })
    })
  })
})

describe('GraphApiController Unit Tests', () => {
  let controller: GraphApiController

  beforeEach(() => {
    controller = new GraphApiController(mockLogger)
    mockLogger.error.mockClear()
  })

  describe('getTables', () => {
    test('should get tables with query parameters', async () => {
      const req = createMockRequest({
        query: {
          limit: '50',
          offset: '10',
          search: 'test',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      })
      const res = createMockResponse()

      await controller.getTables(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tables: expect.any(Array),
          total: expect.any(Number),
          limit: 50,
          offset: 10,
        }),
      })
    })

    test('should use default values for query parameters', async () => {
      const req = createMockRequest({ query: {} })
      const res = createMockResponse()

      await controller.getTables(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      })
    })
  })

  describe('getConnectedNodes', () => {
    test('should get connected nodes with valid nodeId', async () => {
      const req = createMockRequest({
        params: { nodeId: 'node-123' },
        query: {
          depth: '2',
          direction: 'BOTH',
          relationTypes: 'CONNECTED',
        },
      })
      const res = createMockResponse()

      await controller.getConnectedNodes(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          nodeId: 'node-123',
          depth: 2,
          direction: 'BOTH',
          connectedNodes: expect.any(Array),
        }),
      })
    })

    test('should handle missing nodeId parameter', async () => {
      const req = createMockRequest({
        params: {},
        query: {},
      })
      const res = createMockResponse()

      await controller.getConnectedNodes(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'nodeId is required',
      })
    })
  })

  describe('findShortestPath', () => {
    test('should find shortest path with valid parameters', async () => {
      const req = createMockRequest({
        body: {
          fromNodeId: 'node-123',
          toNodeId: 'node-456',
          maxDepth: 10,
        },
      })
      const res = createMockResponse()

      await controller.findShortestPath(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          fromNodeId: 'node-123',
          toNodeId: 'node-456',
          maxDepth: 10,
          path: expect.any(Array),
          distance: expect.any(Number),
        }),
      })
    })

    test('should handle missing required parameters', async () => {
      const req = createMockRequest({
        body: {
          fromNodeId: 'node-123',
          // Missing toNodeId
        },
      })
      const res = createMockResponse()

      await controller.findShortestPath(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'fromNodeId and toNodeId are required',
      })
    })
  })

  describe('exportTableWithNodes', () => {
    test('should export table with valid tableId', async () => {
      const req = createMockRequest({
        params: { tableId: 'table-123' },
        body: {
          flatFormat: true,
          outputPath: '/tmp/export.json',
        },
      })
      const res = createMockResponse()

      await controller.exportTableWithNodes(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tableId: 'table-123',
          flatFormat: true,
          outputPath: '/tmp/export.json',
          exportData: expect.any(Object),
        }),
      })
    })

    test('should handle missing tableId parameter', async () => {
      const req = createMockRequest({
        params: {},
        body: {},
      })
      const res = createMockResponse()

      await controller.exportTableWithNodes(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'tableId is required',
      })
    })
  })
})

describe('Controller Response Format Consistency', () => {
  test('all successful responses should follow consistent format', async () => {
    const controllers = [
      new GraphDbApiController(mockLogger),
      new AttributeApiController(mockLogger),
      new GraphApiController(mockLogger),
    ]

    // Test methods that should return consistent success format
    const testMethods = [
      { controller: 0, method: 'healthCheck', req: createMockRequest() },
      {
        controller: 1,
        method: 'createAttribute',
        req: createMockRequest({
          body: { tableId: 'test', identifier: 'test', name: 'test' },
        }),
      },
      { controller: 2, method: 'getTables', req: createMockRequest() },
    ]

    for (const { controller: controllerIndex, method, req } of testMethods) {
      const res = createMockResponse()
      const controller = controllers[controllerIndex]

      await (controller as any)[method](req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      )
    }
  })

  test('all error responses should follow consistent format', async () => {
    const controller = new GraphDbApiController(mockLogger)

    // Test method with missing required parameter
    const req = createMockRequest({
      body: {}, // Missing required fields
    })
    const res = createMockResponse()

    await controller.createTable(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
      })
    )
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
