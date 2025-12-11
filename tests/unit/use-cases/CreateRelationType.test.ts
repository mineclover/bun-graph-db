import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  type CreateRelationTypeInput,
  CreateRelationTypeUseCase,
} from '@/application/use-cases/relations/CreateRelationType.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { createTestRelationType } from './test-helpers.js'

describe('CreateRelationTypeUseCase', () => {
  let useCase: CreateRelationTypeUseCase
  let mockRelationTypeRepository: IRelationTypeRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }

    // Mock repository
    mockRelationTypeRepository = {
      save: mock(async (relationType) => relationType),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (relationType) => relationType),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    useCase = new CreateRelationTypeUseCase(mockRelationTypeRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when identifier is empty', async () => {
      const input: CreateRelationTypeInput = {
        identifier: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Relation type identifier is required')
    })

    it('should throw ValidationException when identifier is whitespace', async () => {
      const input: CreateRelationTypeInput = {
        identifier: '   ',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Relation type identifier is required')
    })
  })

  describe('Duplicate Validation', () => {
    it('should throw ConflictException when relation type already exists', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'existing_relation',
      }

      const existingRelationType = createTestRelationType('rel-type-1', 'existing_relation', 'Existing Relation')

      mockRelationTypeRepository.findByIdentifier = mock().mockResolvedValueOnce(existingRelationType)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(ConflictException)
      await expect(promise).rejects.toThrow("RelationType with identifier 'existing_relation' already exists")
    })
  })

  describe('Successful Relation Type Creation', () => {
    it('should create a relation type successfully with identifier only', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'new_relation',
      }

      const createdRelationType = createTestRelationType('rel-type-1', 'new_relation', 'New Relation')

      mockRelationTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(createdRelationType) // Second call after save

      const result = await useCase.execute(input)

      expect(result.relationType).toBeDefined()
      expect(result.relationType.identifier).toBe('new_relation')
      expect(mockRelationTypeRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating new relation type',
        expect.objectContaining({
          identifier: input.identifier,
        }),
      )
    })

    it('should create a relation type with description', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'described_relation',
        description: 'A relation with description',
      }

      // Note: createTestRelationType params are (id, identifier, name, description)
      const createdRelationType = createTestRelationType(
        'rel-type-1',
        'described_relation',
        'Described Relation',
        'A relation with description',
      )

      mockRelationTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdRelationType)

      const result = await useCase.execute(input)

      expect(result.relationType).toBeDefined()
      expect(result.relationType.identifier).toBe('described_relation')
      // The test helper sets both name and description - verify description is returned
      expect(result.relationType.description).toBeDefined()
      expect(mockRelationTypeRepository.save).toHaveBeenCalled()
    })

    it('should create a relation type with category', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'categorized_relation',
        category: 'social',
      }

      const createdRelationType = createTestRelationType('rel-type-1', 'categorized_relation', 'Categorized Relation')

      mockRelationTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdRelationType)

      const result = await useCase.execute(input)

      expect(result.relationType).toBeDefined()
      expect(result.relationType.identifier).toBe('categorized_relation')
      expect(mockRelationTypeRepository.save).toHaveBeenCalled()
    })

    it('should create a relation type with all optional fields', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'complete_relation',
        description: 'A complete relation type',
        category: 'business',
      }

      const createdRelationType = createTestRelationType(
        'rel-type-1',
        'complete_relation',
        'Complete Relation',
        'A complete relation type',
      )

      mockRelationTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdRelationType)

      const result = await useCase.execute(input)

      expect(result.relationType).toBeDefined()
      expect(result.relationType.identifier).toBe('complete_relation')
      expect(result.relationType.description).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Relation type created successfully',
        expect.objectContaining({
          id: 'rel-type-1',
          identifier: 'complete_relation',
        }),
      )
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'failing_relation',
      }

      const saveError = new Error('Database connection failed')

      mockRelationTypeRepository.findByIdentifier = mock(async () => null)
      mockRelationTypeRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create relation type',
        expect.objectContaining({
          identifier: input.identifier,
          error: 'Database connection failed',
        }),
      )
    })

    it('should throw error when saved relation type cannot be retrieved', async () => {
      const input: CreateRelationTypeInput = {
        identifier: 'unretrievable_relation',
      }

      mockRelationTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save fails to retrieve

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved relation type')
    })
  })
})
