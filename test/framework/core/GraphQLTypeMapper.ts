import type { Node } from '@/domain/entities/Node.js'
import type { Table } from '@/domain/entities/Table.js'

/**
 * GraphQL Type Mapper
 * Domain Entity와 GraphQL DTO 간의 타입 안전한 변환
 */

// GraphQL Response Types
export interface NodeDto {
  id: string
  content: string
  title: string
  tableId: string
  createdAt: string
  updatedAt: string
  description?: string
  metadata?: Record<string, any>
}

export interface TableDto {
  id: string
  identifier: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface StandardMutationResult<T> {
  success: boolean
  message?: string
  data?: T
}

export interface CreateNodeOutput {
  node: NodeDto
}

export interface CreateTableOutput {
  table: TableDto
}

export interface PaginatedResult<T> {
  nodes: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Type-safe mappers between Domain and DTO
 */
export class GraphQLTypeMapper {
  static nodeToDto(node: Node): NodeDto {
    return {
      id: node.getId(),
      content: node.getContent(),
      title: node.getTitle(),
      tableId: node.getTableId(),
      createdAt: node.getCreatedAt().toISOString(),
      updatedAt: node.getUpdatedAt().toISOString(),
      description: node.getDescription(),
      metadata: node.getMetadata()
    }
  }

  static tableToDto(table: Table): TableDto {
    return {
      id: table.getId(),
      identifier: table.getIdentifier(),
      description: table.getDescription(),
      createdAt: table.getCreatedAt().toISOString(),
      updatedAt: table.getUpdatedAt().toISOString()
    }
  }

  static createSuccessResult<T>(data: T, message?: string): StandardMutationResult<T> {
    return {
      success: true,
      data,
      message
    }
  }

  static createErrorResult<T>(message: string): StandardMutationResult<T> {
    return {
      success: false,
      message
    }
  }

  static createPaginatedResult<T>(
    items: T[], 
    total: number,
    hasNextPage: boolean = false,
    hasPreviousPage: boolean = false
  ): PaginatedResult<T> {
    return {
      nodes: items,
      totalCount: total,
      hasNextPage,
      hasPreviousPage
    }
  }

  /**
   * Mock factory methods for testing
   */
  static createMockNodeDto(overrides?: Partial<NodeDto>): NodeDto {
    return {
      id: 'node-1',
      content: 'Test Node Content',
      title: 'Test Node',
      tableId: 'table-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: 'Test Description',
      metadata: {},
      ...overrides
    }
  }

  static createMockTableDto(overrides?: Partial<TableDto>): TableDto {
    return {
      id: 'table-1',
      identifier: 'test-table',
      description: 'Test Table',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  static createMockCreateNodeOutput(nodeOverrides?: Partial<NodeDto>): CreateNodeOutput {
    return {
      node: this.createMockNodeDto(nodeOverrides)
    }
  }

  static createMockCreateTableOutput(tableOverrides?: Partial<TableDto>): CreateTableOutput {
    return {
      table: this.createMockTableDto(tableOverrides)
    }
  }
}

/**
 * Type guards for GraphQL responses
 */
export class GraphQLTypeGuards {
  static isNodeDto(value: unknown): value is NodeDto {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as NodeDto).id === 'string' &&
      typeof (value as NodeDto).content === 'string' &&
      typeof (value as NodeDto).title === 'string' &&
      typeof (value as NodeDto).tableId === 'string'
    )
  }

  static isTableDto(value: unknown): value is TableDto {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as TableDto).id === 'string' &&
      typeof (value as TableDto).identifier === 'string' &&
      typeof (value as TableDto).description === 'string'
    )
  }

  static isStandardMutationResult<T>(
    value: unknown,
    dataGuard?: (data: unknown) => data is T
  ): value is StandardMutationResult<T> {
    if (typeof value !== 'object' || value === null) return false
    
    const result = value as StandardMutationResult<T>
    if (typeof result.success !== 'boolean') return false
    
    if (dataGuard && result.data !== undefined) {
      return dataGuard(result.data)
    }
    
    return true
  }

  static isPaginatedResult<T>(
    value: unknown,
    itemGuard?: (item: unknown) => item is T
  ): value is PaginatedResult<T> {
    if (typeof value !== 'object' || value === null) return false
    
    const result = value as PaginatedResult<T>
    return (
      Array.isArray(result.nodes) &&
      typeof result.totalCount === 'number' &&
      typeof result.hasNextPage === 'boolean' &&
      typeof result.hasPreviousPage === 'boolean' &&
      (itemGuard ? result.nodes.every(itemGuard) : true)
    )
  }
}