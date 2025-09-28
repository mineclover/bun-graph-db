import type {
  CreateAttributeInput,
  CreateAttributeOutput,
} from '@/application/dtos/AttributeDto.js'
import { fromEntity as attributeFromEntity } from '@/application/dtos/AttributeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeTypeId, TableId } from '@/core/types/CommonTypes.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { TableTemplateAutoGenerator } from '@/application/services/TableTemplateAutoGenerator.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export class CreateAttributeUseCase {
  private readonly templateAutoGenerator: TableTemplateAutoGenerator

  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {
    this.templateAutoGenerator = new TableTemplateAutoGenerator(
      this.queryTemplateRepository,
      this.attributeRepository,
      this.logger
    )
  }

  async execute(input: CreateAttributeInput): Promise<CreateAttributeOutput> {
    this.logger.info('Creating new attribute', {
      identifier: input.identifier,
      tableId: input.tableId,
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
    const attributeType = await this.attributeTypeRepository.findById(
      input.attributeTypeId as AttributeTypeId
    )
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
        `Attribute with identifier '${input.identifier}' already exists for table '${table.identifier}'`
      )
    }

    try {
      // Convert input metadata object to JSON string for domain entity
      const metadataJson = input.metadata ? JSON.stringify(input.metadata) : undefined

      // Create domain entity with name parameter
      const attribute = Attribute.create(
        input.tableId as TableId,
        input.identifier,
        input.attributeTypeId as AttributeTypeId,
        input.name,
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
        console.error('CRITICAL: Failed to retrieve saved attribute after creation:', {
          tableId: input.tableId,
          identifier: input.identifier,
          inputName: input.name,
        })
        throw new Error('Failed to retrieve saved attribute')
      }

      console.log('DEBUG: Attribute created successfully:', {
        id: savedAttribute.getId(),
        identifier: savedAttribute.getIdentifier(),
        name: savedAttribute.getName(),
        tableId: savedAttribute.getTableId(),
      })

      // Convert to DTO
      const attributeDto = attributeFromEntity(savedAttribute)
      console.log('DEBUG: Converted to DTO:', {
        id: attributeDto.id,
        identifier: attributeDto.identifier,
        name: attributeDto.name,
      })

      // Auto-generate attribute-specific template
      try {
        const attributeWithType = {
          id: savedAttribute.getId(),
          identifier: savedAttribute.getIdentifier(),
          name: savedAttribute.getName(),
          description: savedAttribute.getDescription(),
          required: savedAttribute.getIsRequired(),
          attributeType: {
            id: attributeType.getId(),
            identifier: attributeType.getIdentifier(),
            name: attributeType.getIdentifier(), // Use identifier as name since there's no getName() method
            dataType: attributeType.getJsonType(), // Use getJsonType() instead of getDataType()
            description: attributeType.getDescription()
          }
        }

        const templates = await this.templateAutoGenerator.generateTemplatesForTable(
          table.id,
          table.identifier
        )

        // Find and create only the attribute-specific template
        const attributeTemplate = templates.find(t =>
          t.templateType === 'attribute' &&
          t.identifier.includes(savedAttribute.getIdentifier())
        )

        if (attributeTemplate) {
          const queryTemplate = QueryTemplate.create(
            attributeTemplate.identifier,
            attributeTemplate.name,
            attributeTemplate.query,
            attributeTemplate.tags,
            {
              description: attributeTemplate.description,
              applicableTables: [table.identifier],
              version: '1.0.0'
            }
          )
          await this.queryTemplateRepository.create(queryTemplate)

          this.logger.info('Auto-generated attribute template created', {
            attributeId: savedAttribute.getId(),
            templateIdentifier: attributeTemplate.identifier,
          })
        }
      } catch (error) {
        this.logger.warn('Failed to auto-generate attribute template, but attribute creation succeeded', {
          attributeId: savedAttribute.getId(),
          identifier: savedAttribute.getIdentifier(),
          error: error instanceof Error ? error.message : String(error),
        })
        // Don't fail attribute creation if template generation fails
      }

      // Return DTO
      return {
        attribute: attributeDto,
      }
    } catch (error) {
      this.logger.error('Failed to create attribute', {
        identifier: input.identifier,
        tableId: input.tableId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
