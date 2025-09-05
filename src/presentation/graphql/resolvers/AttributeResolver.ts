import { AttributeDto } from '@/application/dtos/AttributeDto.js'
import { AttributeTypeDto } from '@/application/dtos/AttributeTypeDto.js'
import type { NodeAttributeDto } from '@/application/dtos/NodeDto.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { AttributeId, AttributeTypeId, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
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
    context?: GraphQLContext
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
        return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
      },
      'findAttributeTypeById',
      { id: args.id }
    )
  }

  async attributeTypeByIdentifier(args: { identifier: string }): Promise<AttributeTypeDto | null> {
    try {
      const attributeType = await this.attributeTypeRepository.findByIdentifier(args.identifier)
      return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
    } catch (error) {
      this.logger.error('Failed to find attribute type by identifier', {
        identifier: args.identifier,
        error,
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
      return result.data.map((attributeType) => AttributeTypeDto.fromEntity(attributeType))
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
      return result.data.map((attribute) => AttributeDto.fromEntity(attribute))
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
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create attribute type', { input: args.input, error })

      if (error instanceof ValidationException) {
        return {
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

      // TODO: Implement update logic for AttributeType entity
      // For now, return existing entity
      return {
        attributeType: AttributeTypeDto.fromEntity(attributeType),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update attribute type', {
        id: args.id,
        input: args.input,
        error,
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
      this.logger.error('Failed to delete attribute type', { id: args.id, error })

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
    attribute: AttributeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createAttributeUseCase.execute(args.input)
      return {
        attribute: result.attribute,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create attribute', { input: args.input, error })

      if (error instanceof ValidationException) {
        return {
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

      // TODO: Implement update methods in Attribute entity
      // For now, return existing entity
      return {
        attribute: AttributeDto.fromEntity(attribute),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update attribute', { id: args.id, input: args.input, error })

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
      this.logger.error('Failed to delete attribute', { id: args.id, error })

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
    context?: GraphQLContext
  ): Promise<AttributeTypeDto | null> {
    return this.handleFieldResolution(
      async () => {
        const attributeType = await this.attributeTypeRepository.findById(
          attribute.attributeTypeId as AttributeTypeId
        )
        return attributeType ? AttributeTypeDto.fromEntity(attributeType) : null
      },
      'attributeType',
      'Attribute',
      { attributeId: attribute.id }
    )
  }

  async table_field(attribute: AttributeDto, context?: GraphQLContext): Promise<TableDto | null> {
    return this.handleFieldResolution(
      async () => {
        const table = await this.tableRepository.findById(attribute.tableId as TableId)
        return table ? TableDto.fromEntity(table) : null
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
      return attribute ? AttributeDto.fromEntity(attribute) : null
    } catch (error) {
      this.logger.error('Failed to resolve attribute field for NodeAttribute', {
        nodeAttributeId: nodeAttribute.attributeId,
        error,
      })
      return null
    }
  }
}
