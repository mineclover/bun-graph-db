/**
 * AIMetadata Unit Tests
 *
 * Tests for AIMetadata functionality including:
 * - Schema information generation
 * - Usage patterns analysis
 * - Sample data provision
 * - GraphQL integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AttributeDto from '../../src/application/dtos/AttributeDto'
import * as TableDto from '../../src/application/dtos/TableDto'
import type { ILogger } from '../../src/application/ports/ILogger'

vi.mock('../../src/application/dtos/AttributeDto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/application/dtos/AttributeDto')>()
  return { ...actual, fromEntities: vi.fn(actual.fromEntities) }
})
vi.mock('../../src/application/dtos/TableDto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/application/dtos/TableDto')>()
  return { ...actual, fromEntity: vi.fn(actual.fromEntity) }
})
import { GetTableDocsUseCase } from '../../src/application/use-cases/tables/GetTableDocs'
import type { IAttributeRepository } from '../../src/domain/repositories/IAttributeRepository'
import type { IAttributeTypeRepository } from '../../src/domain/repositories/IAttributeTypeRepository'
import type { IDocRepository } from '../../src/domain/repositories/IDocRepository'
import type { INodeRepository } from '../../src/domain/repositories/INodeRepository'
import type { IQueryTemplateRepository } from '../../src/domain/repositories/IQueryTemplateRepository'
import type { IRelationTypeRepository } from '../../src/domain/repositories/IRelationTypeRepository'
import type { ITableRepository } from '../../src/domain/repositories/ITableRepository'

// Mock implementations with proper domain entity structure
const createMockTable = (id: string, identifier: string, description: string | null = null) => ({
  id,
  identifier,
  description,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
})

const createMockAttribute = (id: string, identifier: string, attributeTypeId: string, description: string) => ({
  getId: () => id,
  getTableId: () => 'test-table-1',
  getIdentifier: () => identifier,
  getName: () => identifier,
  getAttributeTypeId: () => attributeTypeId,
  getDescription: () => description,
  getIsRequired: () => false,
  getMetadata: () => null,
  getCreatedAt: () => new Date('2024-01-01T00:00:00Z'),
  getUpdatedAt: () => new Date('2024-01-01T00:00:00Z'),
  getParsedMetadata: () => null,
  toDatabase: () => ({
    id: id,
    table_id: 'test-table-1',
    identifier: identifier,
    name: identifier,
    attribute_type_id: attributeTypeId,
    description: description,
    is_required: false,
    metadata: null,
    created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2024-01-01T00:00:00Z').toISOString(),
  }),
})

const _createMockAttributeType = (id: string, identifier: string, jsonType: string) => ({
  getId: () => id,
  getIdentifier: () => identifier,
  getJsonType: () => jsonType,
  getFormat: () => null,
  getParsedValidationSchema: () => ({}),
  getDefaultValue: () => null,
  getDescription: () => null,
  getCreatedAt: () => new Date('2024-01-01T00:00:00Z'),
  getUpdatedAt: () => new Date('2024-01-01T00:00:00Z'),
})

// Create DTO-compatible attribute (what AttributeDto.fromEntities returns)
const createMockAttributeDto = (id: string, identifier: string, attributeTypeDto: any, description: string) => ({
  id,
  identifier,
  name: identifier,
  description,
  attributeType: attributeTypeDto, // This is what generateSchemaInfo expects
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
})

const createMockAttributeTypeDto = (identifier: string, dataType: string) => ({
  identifier,
  dataType,
  format: null,
  constraints: {},
  defaultValue: null,
})

const createMockNode = (id: string, title: string, content: string) => ({
  getId: () => id,
  getTableId: () => 'test-table-1',
  getTitle: () => title,
  getContent: () => content,
  getCreatedAt: () => new Date('2024-01-01T00:00:00Z'),
  getUpdatedAt: () => new Date('2024-01-01T00:00:00Z'),
})

const createMockQueryTemplate = (id: string, identifier: string, name: string, query: string, tags: string[]) => ({
  getId: () => id,
  getIdentifier: () => identifier,
  getName: () => name,
  getDescription: () => null,
  getQueryText: () => query,
  getQueryName: () => [name],
  getOperationType: () => 'MUTATION',
  getInputSchema: () => null,
  getDefaultVariables: () => null,
  getApplicableTables: () => ['test-table-1'],
  getTemplateType: () => 'USER',
  getComplexityScore: () => 1,
  getUsageCount: () => 0,
  getLastUsedAt: () => null,
  getAvgExecutionTimeMs: () => 0,
  getVersion: () => '1.0.0',
  getIsActive: () => true,
  getTags: () => tags,
  getCreatedAt: () => new Date('2024-01-01T00:00:00Z'),
  getUpdatedAt: () => new Date('2024-01-01T00:00:00Z'),
})

describe('AIMetadata Unit Tests', () => {
  let getTableDocsUseCase: GetTableDocsUseCase
  let mockTableRepository: ITableRepository
  let mockAttributeRepository: IAttributeRepository
  let mockAttributeTypeRepository: IAttributeTypeRepository
  let mockNodeRepository: INodeRepository
  let mockQueryTemplateRepository: IQueryTemplateRepository
  let mockRelationTypeRepository: IRelationTypeRepository
  let mockDocRepository: IDocRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock repositories
    mockTableRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByIdentifier: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
    }

    mockAttributeRepository = {
      findById: vi.fn(),
      findByTableId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
      countByTableId: vi.fn(),
    }

    mockAttributeTypeRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByDataType: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
    }

    mockNodeRepository = {
      findById: vi.fn(),
      findByTableId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
      countByTableId: vi.fn(),
    }

    mockQueryTemplateRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByIdentifier: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
      findByApplicableTable: vi.fn(),
    }

    mockRelationTypeRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
    }

    mockDocRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      count: vi.fn(),
      findByTableIds: vi.fn(),
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }

    getTableDocsUseCase = new GetTableDocsUseCase(
      mockTableRepository,
      mockAttributeRepository,
      mockAttributeTypeRepository,
      mockNodeRepository,
      mockQueryTemplateRepository,
      mockRelationTypeRepository,
      mockDocRepository,
      mockLogger,
    )

    // Set default mock returns
    mockDocRepository.findByTableIds.mockResolvedValue([])
    mockRelationTypeRepository.findAll.mockResolvedValue({
      data: [],
      nodes: [],
      totalCount: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    })

    // Mock AttributeDto.fromEntities static method
    vi.mocked(AttributeDto.fromEntities).mockImplementation((attributes) => {
      return attributes.map((attr: any) =>
        createMockAttributeDto(
          attr.getId(),
          attr.getIdentifier(),
          createMockAttributeTypeDto('string', 'string'),
          attr.getDescription(),
        ),
      )
    })

    // Mock TableDto.fromEntity static method
    vi.mocked(TableDto.fromEntity).mockImplementation((table) => ({
      id: table.id,
      identifier: table.identifier,
      description: table.description,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    }))
  })

  describe('AIMetadata Generation', () => {
    it('should generate complete AI metadata for a table', async () => {
      // Mock table data
      const mockTable = createMockTable('test-table-1', 'users', 'User profile information')

      // Mock attributes
      const mockAttributes = [
        createMockAttribute('attr-1', 'name', 'type-1', 'User full name'),
        createMockAttribute('attr-2', 'email', 'type-2', 'User email address'),
        createMockAttribute('attr-3', 'age', 'type-3', 'User age'),
      ]

      // Mock templates
      const mockTemplates = [
        createMockQueryTemplate('template-1', 'create-user', 'Create User Profile', 'CREATE USER...', [
          'create',
          'user',
        ]),
        createMockQueryTemplate('template-2', 'update-user', 'Update User Profile', 'UPDATE USER...', [
          'update',
          'user',
        ]),
      ]

      // Mock sample data
      const mockSampleNodes = [
        createMockNode('node-1', 'John Doe', 'Software Engineer'),
        createMockNode('node-2', 'Jane Smith', 'Product Manager'),
      ]

      // Setup mocks
      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: mockAttributes,
        nodes: mockAttributes,
        totalCount: mockAttributes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue(mockTemplates)
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: mockSampleNodes,
        nodes: mockSampleNodes,
        totalCount: mockSampleNodes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      // Execute
      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
        includeRelatedTemplates: true,
      })

      // Verify AI metadata structure
      expect(result.tableDocs).toBeDefined()
      expect(result.tableDocs.aiMetadata).toBeDefined()
      expect(result.tableDocs.aiMetadata.schemaInfo).toBeDefined()
      expect(result.tableDocs.aiMetadata.usagePatterns).toBeDefined()
      expect(result.tableDocs.aiMetadata.sampleData).toBeDefined()
      expect(result.tableDocs.aiMetadata.sampleData.nodes.length).toBe(2)
    })

    it('should generate schema information correctly', async () => {
      const mockTable = createMockTable('test-table-1', 'products', 'Product information')

      const mockAttributes = [
        createMockAttribute('attr-1', 'name', 'type-1', 'Product name'),
        createMockAttribute('attr-2', 'price', 'type-2', 'Product price'),
        createMockAttribute('attr-3', 'category', 'type-3', 'Product category'),
      ]

      // Override the AttributeDto mock to return specific attribute types
      vi.mocked(AttributeDto.fromEntities).mockImplementation((attributes) => {
        return attributes.map((attr: any, index: number) => {
          const dataTypes = ['string', 'number', 'string']
          return createMockAttributeDto(
            attr.getId(),
            attr.getIdentifier(),
            createMockAttributeTypeDto(dataTypes[index], dataTypes[index]),
            attr.getDescription(),
          )
        })
      })

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: mockAttributes,
        nodes: mockAttributes,
        totalCount: mockAttributes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
      })

      const schemaInfo = result.tableDocs.aiMetadata.schemaInfo

      // Test schema info structure
      expect(schemaInfo.dataTypes).toBeDefined()
      expect(typeof schemaInfo.dataTypes).toBe('object')
      expect(Array.isArray(schemaInfo.requiredFields)).toBe(true)
      expect(Array.isArray(schemaInfo.searchableFields)).toBe(true)
      expect(Array.isArray(schemaInfo.relationshipCapabilities)).toBe(true)

      // Test that name field is marked as required (per logic in generateSchemaInfo)
      expect(schemaInfo.requiredFields).toContain('name')
      expect(schemaInfo.searchableFields).toContain('name') // string type should be searchable
      expect(schemaInfo.searchableFields).toContain('category') // string type should be searchable
      expect(schemaInfo.searchableFields).not.toContain('price') // number type is not marked as searchable
    })

    it('should generate usage patterns with template recommendations', async () => {
      const mockTable = createMockTable('test-table-1', 'orders', 'Order management')

      const mockTemplates = [
        createMockQueryTemplate('template-1', 'create-order', 'Create New Order', 'INSERT INTO orders...', [
          'create',
          'order',
        ]),
        createMockQueryTemplate(
          'template-2',
          'update-order-status',
          'Update Order Status',
          'UPDATE orders SET status...',
          ['update', 'status'],
        ),
        createMockQueryTemplate(
          'template-3',
          'search-orders-by-customer',
          'Search Orders by Customer',
          'SELECT * FROM orders WHERE customer_id...',
          ['search', 'customer'],
        ),
      ]

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue(mockTemplates)
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
        includeRelatedTemplates: true,
      })

      const usagePatterns = result.tableDocs.aiMetadata.usagePatterns

      // Test usage patterns structure
      expect(Array.isArray(usagePatterns.commonQueries)).toBe(true)
      expect(Array.isArray(usagePatterns.templateRecommendations)).toBe(true)
      expect(['simple', 'moderate', 'complex']).toContain(usagePatterns.queryComplexity)

      // Test template recommendations
      expect(usagePatterns.templateRecommendations.length).toBe(3)
      expect(usagePatterns.templateRecommendations[0]).toHaveProperty('templateId')
      expect(usagePatterns.templateRecommendations[0]).toHaveProperty('useCase')

      // Test common queries generation
      expect(usagePatterns.commonQueries.length).toBeGreaterThan(0)
      usagePatterns.commonQueries.forEach((query) => {
        expect(query).toHaveProperty('pattern')
        expect(query).toHaveProperty('description')
        expect(query).toHaveProperty('example')
      })
    })

    it('should handle sample data generation', async () => {
      const mockTable = createMockTable('test-table-1', 'customers', 'Customer database')

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
        sampleLimit: 2,
      })

      const sampleData = result.tableDocs.aiMetadata.sampleData

      // Test sample data structure
      expect(sampleData).toBeDefined()
      expect(Array.isArray(sampleData.nodes)).toBe(true)
      expect(Array.isArray(sampleData.relationships)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing table gracefully', async () => {
      mockTableRepository.findById.mockResolvedValue(null)

      const result = await getTableDocsUseCase.execute({
        tableId: 'non-existent-table',
        includeAiMetadata: true,
      })

      expect(result.tableDocs).toBeNull()
    })

    it('should handle repository errors gracefully', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockRejectedValue(new Error('Database error'))

      // This should throw an error since GetTableDocsUseCase doesn't handle attribute repository errors gracefully
      await expect(
        getTableDocsUseCase.execute({
          tableId: 'test-table-1',
          includeAiMetadata: true,
        }),
      ).rejects.toThrow('Database error')
    })

    it('should handle empty data sets', async () => {
      const mockTable = createMockTable('test-table-1', 'empty-table', 'Empty table')

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
      })

      const aiMetadata = result.tableDocs.aiMetadata

      // Should handle empty datasets gracefully
      expect(aiMetadata.schemaInfo.requiredFields).toEqual([])
      expect(aiMetadata.schemaInfo.searchableFields).toEqual([])
      expect(aiMetadata.usagePatterns.templateRecommendations).toEqual([])
      expect(aiMetadata.sampleData).toBeDefined()
      expect(aiMetadata.sampleData.nodes).toEqual([])
      expect(aiMetadata.usagePatterns.queryComplexity).toBe('simple')
    })
  })

  describe('Configuration and Customization', () => {
    it('should respect sample limit parameter', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      const mockSampleNodes = Array.from({ length: 10 }, (_, i) =>
        createMockNode(`node-${i}`, `Sample ${i}`, `Content ${i}`),
      )

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: mockSampleNodes,
        nodes: mockSampleNodes,
        totalCount: mockSampleNodes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
        sampleLimit: 3,
      })

      expect(result.tableDocs.aiMetadata.sampleData.nodes.length).toBe(3)
    })

    it('should allow disabling AI metadata', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: false,
      })

      expect(result.tableDocs.aiMetadata).toBeUndefined()
    })
  })

  describe('Data Quality and Validation', () => {
    it('should validate schema info data types', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      const mockAttributes = [
        createMockAttribute('attr-1', 'valid_field', 'type-1', 'Valid field'),
        createMockAttribute('attr-2', 'numeric_field', 'type-2', 'Numeric field'),
      ]

      // Override AttributeDto mock for this test
      vi.mocked(AttributeDto.fromEntities).mockImplementation((_attributes) => {
        return [
          createMockAttributeDto('attr-1', 'valid_field', createMockAttributeTypeDto('text', 'string'), 'Valid field'),
          createMockAttributeDto(
            'attr-2',
            'numeric_field',
            createMockAttributeTypeDto('number', 'number'),
            'Numeric field',
          ),
        ]
      })

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: mockAttributes,
        nodes: mockAttributes,
        totalCount: mockAttributes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
      })

      const dataTypes = result.tableDocs.aiMetadata.schemaInfo.dataTypes

      // Validate data types structure
      expect(dataTypes).toHaveProperty('valid_field')
      expect(dataTypes).toHaveProperty('numeric_field')
      expect(dataTypes.valid_field).toBe('string')
      expect(dataTypes.numeric_field).toBe('number')
    })

    it('should ensure consistent field naming', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      const mockAttributes = [
        createMockAttribute('attr-1', 'user_name', 'type-1', 'User name'),
        createMockAttribute('attr-2', 'email_address', 'type-2', 'Email address'),
      ]

      // Override AttributeDto mock for this test
      vi.mocked(AttributeDto.fromEntities).mockImplementation((_attributes) => {
        return [
          createMockAttributeDto('attr-1', 'user_name', createMockAttributeTypeDto('text', 'string'), 'User name'),
          createMockAttributeDto(
            'attr-2',
            'email_address',
            createMockAttributeTypeDto('email', 'string'),
            'Email address',
          ),
        ]
      })

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: mockAttributes,
        nodes: mockAttributes,
        totalCount: mockAttributes.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
      })

      const schemaInfo = result.tableDocs.aiMetadata.schemaInfo

      // Test searchable fields (both should be searchable as string types)
      expect(schemaInfo.searchableFields).toContain('user_name')
      expect(schemaInfo.searchableFields).toContain('email_address')
      // Required fields would only include names like 'title' or 'name'
      expect(schemaInfo.requiredFields).toEqual([])
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large datasets efficiently', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      const largeAttributeSet = Array.from({ length: 50 }, (_, i) =>
        createMockAttribute(`attr-${i}`, `field_${i}`, `type-${i}`, `Field ${i}`),
      )

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: largeAttributeSet,
        nodes: largeAttributeSet,
        totalCount: largeAttributeSet.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const startTime = performance.now()

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
      })

      const duration = performance.now() - startTime

      // Should handle large datasets without significant performance impact
      expect(duration).toBeLessThan(1000) // Less than 1 second
      expect(result.tableDocs.aiMetadata.schemaInfo).toBeDefined()
    })

    it('should limit sample data appropriately', async () => {
      const mockTable = createMockTable('test-table-1', 'test', 'Test table')
      const limitedSamples = Array.from({ length: 5 }, (_, i) =>
        createMockNode(`node-${i}`, `Sample ${i}`, `Content ${i}`),
      )

      mockTableRepository.findById.mockResolvedValue(mockTable)
      mockAttributeRepository.findByTableId.mockResolvedValue({
        data: [],
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      mockQueryTemplateRepository.findByApplicableTable.mockResolvedValue([])
      mockNodeRepository.findByTableId.mockResolvedValue({
        data: limitedSamples,
        nodes: limitedSamples,
        totalCount: limitedSamples.length,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      const result = await getTableDocsUseCase.execute({
        tableId: 'test-table-1',
        includeAiMetadata: true,
        sampleLimit: 5,
      })

      expect(result.tableDocs.aiMetadata.sampleData.nodes.length).toBe(5)
    })
  })
})
