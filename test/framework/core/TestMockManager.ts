import { mock, type Mock } from 'bun:test'
import type { ITestMockManager } from '../interfaces/ITestFramework.js'
import type { Node } from '@/domain/entities/Node.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'

/**
 * Type-Safe Mock Manager
 * Mock 객체의 타입 안전성을 보장하는 중앙화된 관리자
 */
export class TestMockManager implements ITestMockManager {
  private mocks: Map<string, Mock<any>> = new Map()

  createTypedMock<T>(implementation?: Partial<T>): jest.Mocked<T> {
    const mockId = `mock_${Date.now()}_${Math.random()}`
    const mockObject = {} as jest.Mocked<T>
    
    // Create mock functions for all methods
    if (implementation) {
      Object.keys(implementation).forEach(key => {
        const value = implementation[key as keyof T]
        if (typeof value === 'function') {
          mockObject[key as keyof T] = mock(value as any) as any
        } else {
          mockObject[key as keyof T] = value as any
        }
      })
    }
    
    this.mocks.set(mockId, mockObject as any)
    return mockObject
  }

  // Domain-specific typed mock creators
  createNodeRepositoryMock(overrides?: Partial<INodeRepository>): jest.Mocked<INodeRepository> {
    const defaultImplementation: Partial<INodeRepository> = {
      save: () => Promise.resolve(),
      findById: () => Promise.resolve(null),
      findByTableIdAndContent: () => Promise.resolve(null),
      findByTableId: () => Promise.resolve({ 
        items: [], 
        total: 0, 
        hasNextPage: false, 
        hasPreviousPage: false 
      }),
      findAll: () => Promise.resolve({ 
        items: [], 
        total: 0, 
        hasNextPage: false, 
        hasPreviousPage: false 
      }),
      delete: () => Promise.resolve(),
      deleteByTableId: () => Promise.resolve(),
      exists: () => Promise.resolve(false),
      count: () => Promise.resolve(0),
      countByTableId: () => Promise.resolve(0),
      saveMany: () => Promise.resolve(),
      findByIds: () => Promise.resolve([]),
      searchByContent: () => Promise.resolve({ 
        items: [], 
        total: 0, 
        hasNextPage: false, 
        hasPreviousPage: false 
      }),
      executeRawQuery: () => Promise.resolve([]),
      ...overrides
    }
    
    return this.createTypedMock<INodeRepository>(defaultImplementation)
  }

  // Helper method to create mock Node entities that match domain structure
  static createMockNode(overrides?: {
    id?: string
    content?: string
    title?: string
    tableId?: string
    createdAt?: Date
    updatedAt?: Date
    description?: string
    metadata?: Record<string, any>
  }): Node {
    const defaults = {
      id: 'node-1',
      content: 'Mock Node Content',
      title: 'Mock Node',
      tableId: 'table-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      description: 'Mock Description',
      metadata: {}
    }
    
    const data = { ...defaults, ...overrides }
    
    return {
      getId: () => data.id,
      getContent: () => data.content,
      getTitle: () => data.title,
      getTableId: () => data.tableId,
      getCreatedAt: () => data.createdAt,
      getUpdatedAt: () => data.updatedAt,
      getDescription: () => data.description,
      getMetadata: () => data.metadata
    } as Node
  }

  createTableRepositoryMock(overrides?: Partial<ITableRepository>): jest.Mocked<ITableRepository> {
    const defaultImplementation: Partial<ITableRepository> = {
      findById: () => Promise.resolve(null),
      findByIdentifier: () => Promise.resolve(null),
      findAll: () => Promise.resolve({ 
        items: [], 
        total: 0, 
        hasNextPage: false, 
        hasPreviousPage: false 
      }),
      save: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      ...overrides
    }
    
    return this.createTypedMock<ITableRepository>(defaultImplementation)
  }

  createLoggerMock(): jest.Mocked<ILogger> {
    return this.createTypedMock<ILogger>({
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    })
  }

  resetAllMocks(): void {
    this.mocks.forEach(mockObj => {
      if (typeof mockObj.mockReset === 'function') {
        mockObj.mockReset()
      }
    })
  }

  verifyMockCalls(mockName: string, expectedCalls: number): void {
    const mockObj = this.mocks.get(mockName)
    if (!mockObj) {
      throw new Error(`Mock '${mockName}' not found`)
    }
    
    if (typeof mockObj.mock?.calls !== 'undefined') {
      const actualCalls = mockObj.mock.calls.length
      if (actualCalls !== expectedCalls) {
        throw new Error(`Expected ${expectedCalls} calls, but got ${actualCalls}`)
      }
    }
  }

  getMock(mockId: string): Mock<any> | undefined {
    return this.mocks.get(mockId)
  }
}

// Type declarations for jest.Mocked compatibility
declare global {
  namespace jest {
    type Mocked<T> = {
      [K in keyof T]: T[K] extends (...args: any[]) => any
        ? Mock<T[K]> & T[K]
        : T[K]
    }
  }
}