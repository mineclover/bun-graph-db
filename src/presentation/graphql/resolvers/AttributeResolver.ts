import {
  type AttributeDto,
  fromEntity as attributeFromEntity,
} from '@/application/dtos/AttributeDto.js'
import {
  type AttributeTypeDto,
  fromEntity as attributeTypeFromEntity,
} from '@/application/dtos/AttributeTypeDto.js'
import type { NodeAttributeDto } from '@/application/dtos/NodeDto.js'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { AttributeId, AttributeTypeId, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

// Input types matching GraphQL schema
interface CreateAttributeTypeInput {
  identifier: string
  jsonType: string
  format?: string
  description?: string
  validationSchema?: object
  referenceConfig?: object
  defaultValue?: unknown
  examples?: unknown[]
}

interface CreateAttributeInput {
  tableId: string
  identifier: string
  attributeTypeId: string
  description?: string
  isRequired?: boolean
  metadata?: object
}

interface UpdateAttributeInput {
  description?: string
  isRequired?: boolean
  metadata?: object
}

export class AttributeResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createAttributeTypeUseCase: CreateAttributeTypeUseCase,
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  // Query resolvers - Attribute Types
  async attributeType(
    args: { id: string },
    _context?: GraphQLContext
  ): Promise<AttributeTypeDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute Type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute Type ID'),
      ],
      'attributeType'
    )

    return this.handleQuery(
      async () => {
        const attributeType = await this.attributeTypeRepository.findById(
          args.id as AttributeTypeId
        )
        return attributeType ? attributeTypeFromEntity(attributeType) : null
      },
      'findAttributeTypeById',
      { id: args.id }
    )
  }

  async attributeTypeByIdentifier(args: { identifier: string }): Promise<AttributeTypeDto | null> {
    try {
      const attributeType = await this.attributeTypeRepository.findByIdentifier(args.identifier)
      return attributeType ? attributeTypeFromEntity(attributeType) : null
    } catch (error) {
      this.logger.error('Failed to find attribute type by identifier', {
        identifier: args.identifier,
        ...toErrorMeta(error),
      })
      throw error
    }
  }

  async attributeTypes(): Promise<AttributeTypeDto[]> {
    try {
      const result = await this.attributeTypeRepository.findAll({ limit: 100, offset: 0 })
      if (!result.data) {
        this.logger.warn('No data returned from attributeTypeRepository.findAll')
        return []
      }
      return result.data.map((attributeType) => attributeTypeFromEntity(attributeType))
    } catch (error) {
      this.logger.error('Failed to find attribute types', toErrorMeta(error))
      throw error
    }
  }

  // Query resolvers - Attributes
  async attribute(args: { id: string }): Promise<AttributeDto | null> {
    try {
      const attribute = await this.attributeRepository.findById(args.id as AttributeId)
      return attribute ? attributeFromEntity(attribute) : null
    } catch (error) {
      this.logger.error('Failed to find attribute by id', { id: args.id, ...toErrorMeta(error) })
      throw error
    }
  }

  async attributes(args: { tableId: string }): Promise<AttributeDto[]> {
    try {
      const result = await this.attributeRepository.findByTableId(args.tableId as TableId, {
        limit: 100,
        offset: 0,
      })
      if (!result.data) {
        this.logger.warn('No data returned from attributeRepository.findByTableId', {
          tableId: args.tableId,
        })
        return []
      }
      return result.data.map((attribute) => attributeFromEntity(attribute))
    } catch (error) {
      this.logger.error('Failed to find attributes by table id', {
        tableId: args.tableId,
        ...toErrorMeta(error),
      })
      throw error
    }
  }

  // Mutation resolvers - Attribute Types
  async createAttributeType(args: { input: CreateAttributeTypeInput }): Promise<{
    success: boolean
    attributeType: AttributeTypeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createAttributeTypeUseCase.execute(args.input)
      return {
        success: true,
        attributeType: result.attributeType,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create attribute type', {
        input: args.input,
        ...toErrorMeta(error),
      })

      if (error instanceof ValidationException) {
        return {
          success: false,
          attributeType: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      if (error instanceof ConflictException) {
        return {
          success: false,
          attributeType: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      return {
        success: false,
        attributeType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async updateAttributeType(args: { id: string; input: CreateAttributeTypeInput }): Promise<{
    attributeType: AttributeTypeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const attributeType = await this.attributeTypeRepository.findById(args.id as AttributeTypeId)
      if (!attributeType) {
        throw new NotFoundException(`Attribute type with id ${args.id} not found`)
      }

      // Use repository update method for AttributeType
      const updates = {
        identifier: args.input.identifier,
        description: args.input.description,
        jsonType: args.input.jsonType,
        format: args.input.format,
        validationSchema: args.input.validationSchema ? args.input.validationSchema : null,
        defaultValue: args.input.defaultValue !== undefined ? args.input.defaultValue : null,
      }

      const updatedAttributeType = await this.attributeTypeRepository.update(
        args.id as AttributeTypeId,
        updates
      )

      return {
        attributeType: attributeTypeFromEntity(updatedAttributeType),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update attribute type', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        attributeType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteAttributeType(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const attributeType = await this.attributeTypeRepository.findById(args.id as AttributeTypeId)
      if (!attributeType) {
        throw new NotFoundException(`Attribute type with id ${args.id} not found`)
      }

      await this.attributeTypeRepository.delete(args.id as AttributeTypeId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete attribute type', { id: args.id, ...toErrorMeta(error) })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  // Mutation resolvers - Attributes
  async createAttribute(args: { input: CreateAttributeInput }): Promise<{
    success: boolean
    attribute: AttributeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      console.log('DEBUG: createAttribute resolver called with input:', args.input)
      const result = await this.createAttributeUseCase.execute(args.input)
      console.log('DEBUG: createAttributeUseCase returned:', {
        hasAttribute: !!result.attribute,
        attributeId: result.attribute?.id,
        attributeName: result.attribute?.name,
      })
      return {
        success: true,
        attribute: result.attribute,
        errors: [],
      }
    } catch (error) {
      console.error('DEBUG: createAttribute resolver caught error:', error)
      this.logger.error('Failed to create attribute', { input: args.input, ...toErrorMeta(error) })

      if (error instanceof ValidationException) {
        return {
          success: false,
          attribute: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      if (error instanceof NotFoundException) {
        return {
          success: false,
          attribute: null,
          errors: [
            {
              message: error.message,
              code: error.code,
            },
          ],
        }
      }

      if (error instanceof ConflictException) {
        return {
          success: false,
          attribute: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      return {
        success: false,
        attribute: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async updateAttribute(args: { id: string; input: UpdateAttributeInput }): Promise<{
    attribute: AttributeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const attribute = await this.attributeRepository.findById(args.id as AttributeId)
      if (!attribute) {
        throw new NotFoundException(`Attribute with id ${args.id} not found`)
      }

      let updatedAttribute = attribute

      // Apply updates using entity methods
      if (args.input.description !== undefined) {
        updatedAttribute = updatedAttribute.updateDescription(args.input.description)
      }

      if (args.input.isRequired !== undefined) {
        updatedAttribute = updatedAttribute.updateRequiredStatus(args.input.isRequired)
      }

      if (args.input.metadata !== undefined) {
        const metadataString = args.input.metadata ? JSON.stringify(args.input.metadata) : null
        updatedAttribute = updatedAttribute.updateMetadata(metadataString)
      }

      // Save the updated attribute
      await this.attributeRepository.save(updatedAttribute)
      const savedAttribute = updatedAttribute

      return {
        attribute: attributeFromEntity(savedAttribute),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update attribute', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        attribute: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteAttribute(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const attribute = await this.attributeRepository.findById(args.id as AttributeId)
      if (!attribute) {
        throw new NotFoundException(`Attribute with id ${args.id} not found`)
      }

      await this.attributeRepository.delete(args.id as AttributeId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete attribute', { id: args.id, ...toErrorMeta(error) })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  // Field resolvers for Attribute type
  async attributeType_field(
    attribute: AttributeDto,
    _context?: GraphQLContext
  ): Promise<AttributeTypeDto | null> {
    return this.handleFieldResolution(
      async () => {
        const attributeType = await this.attributeTypeRepository.findById(
          attribute.attributeTypeId as AttributeTypeId
        )
        return attributeType ? attributeTypeFromEntity(attributeType) : null
      },
      'attributeType',
      'Attribute',
      { attributeId: attribute.id }
    )
  }

  async table_field(attribute: AttributeDto, _context?: GraphQLContext): Promise<TableDto | null> {
    return this.handleFieldResolution(
      async () => {
        const table = await this.tableRepository.findById(attribute.tableId as TableId)
        return table ? tableFromEntity(table) : null
      },
      'table',
      'Attribute',
      { attributeId: attribute.id }
    )
  }

  // Field resolver for NodeAttribute type
  async nodeAttribute_attribute_field(
    nodeAttribute: NodeAttributeDto
  ): Promise<AttributeDto | null> {
    try {
      const attribute = await this.attributeRepository.findById(
        nodeAttribute.attributeId as AttributeId
      )
      return attribute ? attributeFromEntity(attribute) : null
    } catch (error) {
      this.logger.error('Failed to resolve attribute field for NodeAttribute', {
        nodeAttributeId: nodeAttribute.attributeId,
        ...toErrorMeta(error),
      })
      return null
    }
  }

  // Field resolver for NodeAttribute formattedValue field
  async nodeAttribute_formattedValue_field(
    nodeAttribute: NodeAttributeDto
  ): Promise<string> {
    try {
      // For now, return the value as-is. This can be enhanced later with proper formatting
      // based on attribute type (date formatting, number formatting, etc.)
      if (typeof nodeAttribute.value === 'string') {
        return nodeAttribute.value
      }
      return String(nodeAttribute.value)
    } catch (error) {
      this.logger.error('Failed to resolve formattedValue field for NodeAttribute', {
        nodeAttributeId: nodeAttribute.attributeId,
        ...toErrorMeta(error),
      })
      return String(nodeAttribute.value || '')
    }
  }
}
