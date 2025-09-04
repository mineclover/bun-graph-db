import { Attribute } from '@/domain/entities/Attribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ConflictException, ValidationException, NotFoundException } from '@/shared/exceptions/DomainException.js'
import type { CreateAttributeInput, CreateAttributeOutput } from '@/application/dtos/AttributeDto.js'
import { AttributeDto } from '@/application/dtos/AttributeDto.js'
import type { TableId, AttributeTypeId } from '@/shared/types/common.js'

export class CreateAttributeUseCase {
  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateAttributeInput): Promise<CreateAttributeOutput> {
    this.logger.info('Creating new attribute', { 
      identifier: input.identifier, 
      tableId: input.tableId 
    })

    // Validate input
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!input.identifier?.trim()) {
      throw new ValidationException('Attribute identifier is required')
    }

    if (!input.attributeTypeId?.trim()) {
      throw new ValidationException('Attribute type ID is required')
    }

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    // Check if attribute type exists
    const attributeType = await this.attributeTypeRepository.findById(input.attributeTypeId as AttributeTypeId)
    if (!attributeType) {
      throw new NotFoundException(`Attribute type with id '${input.attributeTypeId}' not found`)
    }

    // Check if attribute already exists for this table
    const existingAttribute = await this.attributeRepository.findByTableIdAndIdentifier(
      input.tableId as TableId, 
      input.identifier
    )
    if (existingAttribute) {
      throw new ConflictException(
        `Attribute with identifier '${input.identifier}' already exists for table '${table.getIdentifier()}'`
      )
    }

    try {
      // Convert input metadata object to JSON string for domain entity
      const metadataJson = input.metadata ? JSON.stringify(input.metadata) : undefined

      // Create domain entity
      const attribute = Attribute.create(
        input.tableId as TableId,
        input.identifier,
        input.attributeTypeId as AttributeTypeId,
        input.description,
        input.isRequired || false,
        metadataJson
      )

      // Save to repository
      await this.attributeRepository.save(attribute)

      // Retrieve the saved attribute with the generated ID
      const savedAttribute = await this.attributeRepository.findByTableIdAndIdentifier(
        input.tableId as TableId, 
        input.identifier
      )
      if (!savedAttribute) {
        throw new Error('Failed to retrieve saved attribute')
      }

      this.logger.info('Attribute created successfully', { 
        id: savedAttribute.getId(), 
        identifier: savedAttribute.getIdentifier(),
        tableId: savedAttribute.getTableId()
      })

      // Return DTO
      return {
        attribute: AttributeDto.fromEntity(savedAttribute)
      }
    } catch (error) {
      this.logger.error('Failed to create attribute', { 
        identifier: input.identifier,
        tableId: input.tableId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
}