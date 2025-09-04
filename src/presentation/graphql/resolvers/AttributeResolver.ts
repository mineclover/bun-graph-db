import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ValidationException, NotFoundException, ConflictException } from '@/shared/exceptions/DomainException.js'
import { AttributeTypeDto } from '@/application/dtos/AttributeTypeDto.js'
import { AttributeDto } from '@/application/dtos/AttributeDto.js'
import { NodeAttributeDto } from '@/application/dtos/NodeDto.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import type { AttributeId, AttributeTypeId, TableId } from '@/core/types/CommonTypes.js'

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

export class AttributeResolver {
  constructor(
    private readonly createAttributeTypeUseCase: CreateAttributeTypeUseCase,
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  // Query resolvers - Attribute Types
  async attributeType(args: { id: string }): Promise<AttributeTypeDto | null> {
    try {
      const attributeType = await this.attributeTypeRepository.findById(args.id as AttributeTypeId)
      return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
    } catch (error) {
      this.logger.error('Failed to find attribute type by id', { id: args.id, error })
      throw error
    }
  }

  async attributeTypeByIdentifier(args: { identifier: string }): Promise<AttributeTypeDto | null> {
    try {
      const attributeType = await this.attributeTypeRepository.findByIdentifier(args.identifier)
      return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
    } catch (error) {
      this.logger.error('Failed to find attribute type by identifier', { identifier: args.identifier, error })
      throw error
    }
  }

  async attributeTypes(): Promise<AttributeTypeDto[]> {
    try {
      const result = await this.attributeTypeRepository.findAll({ limit: 100, offset: 0 })
      return result.data.map(attributeType => AttributeTypeDto.fromEntity(attributeType))
    } catch (error) {
      this.logger.error('Failed to find attribute types', { error })
      throw error
    }
  }

  // Query resolvers - Attributes
  async attribute(args: { id: string }): Promise<AttributeDto | null> {
    try {
      const attribute = await this.attributeRepository.findById(args.id as AttributeId)
      return attribute ? AttributeDto.fromEntity(attribute) : null
    } catch (error) {
      this.logger.error('Failed to find attribute by id', { id: args.id, error })
      throw error
    }
  }

  async attributes(args: { tableId: string }): Promise<AttributeDto[]> {
    try {
      const result = await this.attributeRepository.findByTableId(args.tableId as TableId, { limit: 100, offset: 0 })
      return result.data.map(attribute => AttributeDto.fromEntity(attribute))
    } catch (error) {
      this.logger.error('Failed to find attributes by table id', { tableId: args.tableId, error })
      throw error
    }
  }

  // Mutation resolvers - Attribute Types
  async createAttributeType(args: { input: CreateAttributeTypeInput }): Promise<{
    attributeType: AttributeTypeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createAttributeTypeUseCase.execute(args.input)
      return {
        attributeType: result.attributeType,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create attribute type', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          attributeType: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }

      if (error instanceof ConflictException) {
        return {
          attributeType: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }
      
      return {
        attributeType: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async updateAttributeType(args: { 
    id: string
    input: CreateAttributeTypeInput 
  }): Promise<{
    attributeType: AttributeTypeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const attributeType = await this.attributeTypeRepository.findById(args.id as AttributeTypeId)
      if (!attributeType) {
        throw new NotFoundException(`Attribute type with id ${args.id} not found`)
      }

      // TODO: Implement update logic for AttributeType entity
      // For now, return existing entity
      return {
        attributeType: AttributeTypeDto.fromEntity(attributeType),
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to update attribute type', { id: args.id, input: args.input, error })
      
      return {
        attributeType: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
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
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to delete attribute type', { id: args.id, error })
      
      return {
        success: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  // Mutation resolvers - Attributes
  async createAttribute(args: { input: CreateAttributeInput }): Promise<{
    attribute: AttributeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createAttributeUseCase.execute(args.input)
      return {
        attribute: result.attribute,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create attribute', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          attribute: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }

      if (error instanceof NotFoundException) {
        return {
          attribute: null,
          errors: [{ 
            message: error.message, 
            code: error.code
          }]
        }
      }

      if (error instanceof ConflictException) {
        return {
          attribute: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }
      
      return {
        attribute: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async updateAttribute(args: { 
    id: string
    input: UpdateAttributeInput 
  }): Promise<{
    attribute: AttributeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const attribute = await this.attributeRepository.findById(args.id as AttributeId)
      if (!attribute) {
        throw new NotFoundException(`Attribute with id ${args.id} not found`)
      }

      // TODO: Implement update methods in Attribute entity
      // For now, return existing entity
      return {
        attribute: AttributeDto.fromEntity(attribute),
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to update attribute', { id: args.id, input: args.input, error })
      
      return {
        attribute: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
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
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to delete attribute', { id: args.id, error })
      
      return {
        success: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  // Field resolvers for Attribute type
  async attributeType_field(attribute: AttributeDto): Promise<AttributeTypeDto | null> {
    try {
      const attributeType = await this.attributeTypeRepository.findById(attribute.attributeTypeId as AttributeTypeId)
      return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
    } catch (error) {
      this.logger.error('Failed to resolve attribute type field', { attributeId: attribute.id, error })
      return null
    }
  }

  async table_field(attribute: AttributeDto): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findById(attribute.tableId as TableId)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to resolve table field', { attributeId: attribute.id, error })
      return null
    }
  }

  // Field resolver for NodeAttribute type
  async nodeAttribute_attribute_field(nodeAttribute: NodeAttributeDto): Promise<AttributeDto | null> {
    try {
      const attribute = await this.attributeRepository.findById(nodeAttribute.attributeId as AttributeId)
      return attribute ? AttributeDto.fromEntity(attribute) : null
    } catch (error) {
      this.logger.error('Failed to resolve attribute field for NodeAttribute', { nodeAttributeId: nodeAttribute.attributeId, error })
      return null
    }
  }
}