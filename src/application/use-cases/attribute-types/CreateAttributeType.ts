import type {
  CreateAttributeTypeInput,
  CreateAttributeTypeOutput,
} from '@/application/dtos/AttributeTypeDto.js'
import { AttributeTypeDto } from '@/application/dtos/AttributeTypeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'

export class CreateAttributeTypeUseCase {
  constructor(
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateAttributeTypeInput): Promise<CreateAttributeTypeOutput> {
    this.logger.info('Creating new attribute type', { identifier: input.identifier })

    // Validate input
    if (!input.identifier?.trim()) {
      throw new ValidationException('Attribute type identifier is required')
    }

    if (!input.jsonType?.trim()) {
      throw new ValidationException('Attribute type jsonType is required')
    }

    // Check if attribute type already exists
    const existingAttributeType = await this.attributeTypeRepository.findByIdentifier(
      input.identifier
    )
    if (existingAttributeType) {
      throw new ConflictException(
        `Attribute type with identifier '${input.identifier}' already exists`
      )
    }

    try {
      // Convert input objects to JSON strings for domain entity
      const validationSchemaJson = input.validationSchema
        ? JSON.stringify(input.validationSchema)
        : undefined
      const referenceConfigJson = input.referenceConfig
        ? JSON.stringify(input.referenceConfig)
        : undefined
      const defaultValueJson =
        input.defaultValue !== undefined ? JSON.stringify(input.defaultValue) : undefined
      const examplesJson = input.examples ? JSON.stringify(input.examples) : undefined

      // Create domain entity
      const attributeType = AttributeType.create(
        input.identifier,
        input.jsonType,
        input.format,
        input.description,
        validationSchemaJson,
        referenceConfigJson,
        defaultValueJson,
        examplesJson
      )

      // Save to repository
      await this.attributeTypeRepository.save(attributeType)

      // Retrieve the saved attribute type with the generated ID
      const savedAttributeType = await this.attributeTypeRepository.findByIdentifier(
        input.identifier
      )
      if (!savedAttributeType) {
        throw new Error('Failed to retrieve saved attribute type')
      }

      this.logger.info('Attribute type created successfully', {
        id: savedAttributeType.getId(),
        identifier: savedAttributeType.getIdentifier(),
      })

      // Return DTO
      return {
        attributeType: AttributeTypeDto.fromEntity(savedAttributeType),
      }
    } catch (error) {
      this.logger.error('Failed to create attribute type', {
        identifier: input.identifier,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
