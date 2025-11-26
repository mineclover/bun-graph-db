import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CreateAttributeTypeInput } from '@/application/dtos/AttributeTypeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { createTestAttributeType } from './test-helpers.js'

describe('CreateAttributeTypeUseCase', () => {
  let useCase: CreateAttributeTypeUseCase
  let mockAttributeTypeRepository: IAttributeTypeRepository
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
    mockAttributeTypeRepository = {
      save: mock(async (attributeType) => attributeType),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      delete: mock(async () => {}),
      exists: mock(async () => false),
      count: mock(async () => 0),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      deleteMany: mock(async () => {}),
    } as any

    useCase = new CreateAttributeTypeUseCase(mockAttributeTypeRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when identifier is empty', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: '',
        jsonType: 'string',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute type identifier is required')
    })

    it('should throw ValidationException when identifier is whitespace', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: '   ',
        jsonType: 'string',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute type identifier is required')
    })

    it('should throw ValidationException when jsonType is empty', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'custom_type',
        jsonType: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute type jsonType is required')
    })

    it('should throw ValidationException when jsonType is whitespace', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'custom_type',
        jsonType: '   ',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute type jsonType is required')
    })
  })

  describe('Duplicate Validation', () => {
    it('should throw ConflictException when attribute type already exists', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'existing_type',
        jsonType: 'string',
      }

      const existingAttributeType = createTestAttributeType(
        'attr-type-1',
        'existing_type',
        'string'
      )

      mockAttributeTypeRepository.findByIdentifier =
        mock().mockResolvedValueOnce(existingAttributeType)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(ConflictException)
      await expect(promise).rejects.toThrow(
        "Attribute type with identifier 'existing_type' already exists"
      )
    })
  })

  describe('Successful Attribute Type Creation', () => {
    it('should create attribute type with identifier and jsonType only', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'new_type',
        jsonType: 'string',
      }

      const createdAttributeType = createTestAttributeType('attr-type-1', 'new_type', 'string')

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(createdAttributeType) // Second call after save

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('new_type')
      expect(result.attributeType.jsonType).toBe('string')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating new attribute type',
        expect.objectContaining({
          identifier: input.identifier,
        })
      )
    })

    it('should create attribute type with format', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'email_type',
        jsonType: 'string',
        format: 'email',
      }

      const createdAttributeType = createTestAttributeType(
        'attr-type-1',
        'email_type',
        'string',
        'Email address type'
      )

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('email_type')
      expect(result.attributeType.jsonType).toBe('string')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with description', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'custom_type',
        jsonType: 'object',
        description: 'A custom object type for testing',
      }

      const createdAttributeType = createTestAttributeType(
        'attr-type-1',
        'custom_type',
        'object',
        'A custom object type for testing'
      )

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('custom_type')
      expect(result.attributeType.description).toBe('A custom object type for testing')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with validationSchema', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'validated_type',
        jsonType: 'string',
        validationSchema: {
          minLength: 5,
          maxLength: 100,
          pattern: '^[a-zA-Z]+$',
        },
      }

      const createdAttributeType = createTestAttributeType(
        'attr-type-1',
        'validated_type',
        'string'
      )

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('validated_type')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with referenceConfig', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'reference_type',
        jsonType: 'string',
        referenceConfig: {
          targetTable: 'users',
          targetField: 'id',
          cascadeDelete: true,
        },
      }

      const createdAttributeType = createTestAttributeType(
        'attr-type-1',
        'reference_type',
        'string'
      )

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('reference_type')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with defaultValue', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'default_type',
        jsonType: 'string',
        defaultValue: 'default_value',
      }

      const createdAttributeType = createTestAttributeType('attr-type-1', 'default_type', 'string')

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('default_type')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with examples array', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'example_type',
        jsonType: 'string',
        examples: ['example1', 'example2', 'example3'],
      }

      const createdAttributeType = createTestAttributeType('attr-type-1', 'example_type', 'string')

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('example_type')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })

    it('should create attribute type with all optional fields', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'complete_type',
        jsonType: 'object',
        format: 'reference',
        description: 'A complete attribute type with all fields',
        validationSchema: { required: ['field1', 'field2'] },
        referenceConfig: { targetTable: 'related' },
        defaultValue: { field1: 'value1' },
        examples: [{ field1: 'example1' }, { field1: 'example2' }],
      }

      const createdAttributeType = createTestAttributeType(
        'attr-type-1',
        'complete_type',
        'object',
        'A complete attribute type with all fields'
      )

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      const result = await useCase.execute(input)

      expect(result.attributeType).toBeDefined()
      expect(result.attributeType.identifier).toBe('complete_type')
      expect(result.attributeType.jsonType).toBe('object')
      expect(result.attributeType.description).toBe('A complete attribute type with all fields')
      expect(mockAttributeTypeRepository.save).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'new_type',
        jsonType: 'string',
      }

      const saveError = new Error('Database connection failed')

      mockAttributeTypeRepository.findByIdentifier = mock(async () => null)
      mockAttributeTypeRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create attribute type',
        expect.objectContaining({
          identifier: 'new_type',
          error: 'Database connection failed',
        })
      )
    })

    it('should throw error when saved attribute type cannot be retrieved', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'new_type',
        jsonType: 'string',
      }

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save - retrieval fails

      await expect(useCase.execute(input)).rejects.toThrow(
        'Failed to retrieve saved attribute type'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create attribute type',
        expect.any(Object)
      )
    })
  })

  describe('Logging', () => {
    it('should log attribute type creation start and success', async () => {
      const input: CreateAttributeTypeInput = {
        identifier: 'logged_type',
        jsonType: 'string',
      }

      const createdAttributeType = createTestAttributeType('attr-type-1', 'logged_type', 'string')

      mockAttributeTypeRepository.findByIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttributeType)

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating new attribute type',
        expect.objectContaining({
          identifier: 'logged_type',
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attribute type created successfully',
        expect.objectContaining({
          id: 'attr-type-1',
          identifier: 'logged_type',
        })
      )
    })
  })
})
