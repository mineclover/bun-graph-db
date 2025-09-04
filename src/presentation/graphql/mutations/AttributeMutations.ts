import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  CreateAttributeTypeArgs,
  UpdateAttributeTypeArgs,
  DeleteAttributeTypeArgs,
  CreateAttributeArgs,
  UpdateAttributeArgs,
  DeleteAttributeArgs
} from '@/presentation/graphql/types/GraphQLTypes.js'

export class AttributeMutations {
  constructor(
    private readonly createAttributeTypeUseCase: CreateAttributeTypeUseCase,
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly logger: ILogger
  ) {}

  async createAttributeType(_: GraphQLParent, args: CreateAttributeTypeArgs) {
    try {
      this.logger.info('Creating attribute type', { input: args.input })
      
      const result = await this.createAttributeTypeUseCase.execute({
        identifier: args.input.identifier,
        name: args.input.name,
        description: args.input.description,
        dataType: args.input.dataType,
        constraints: args.input.constraints,
        defaultValue: args.input.defaultValue
      })

      return {
        success: !!result,
        attributeType: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating attribute type', { error, input: args.input })
      return {
        success: false,
        attributeType: null,
        errors: [{ message: error.message, code: 'CREATE_ATTRIBUTE_TYPE_ERROR' }]
      }
    }
  }

  async updateAttributeType(_: GraphQLParent, args: UpdateAttributeTypeArgs) {
    try {
      this.logger.info('Updating attribute type', { id: args.id, input: args.input })
      
      const existingAttributeType = await this.attributeTypeRepository.findById(args.id)
      if (!existingAttributeType) {
        return {
          success: false,
          attributeType: null,
          errors: [{ message: 'Attribute type not found', code: 'ATTRIBUTE_TYPE_NOT_FOUND' }]
        }
      }

      const updatedAttributeType = await this.attributeTypeRepository.update(args.id, {
        name: args.input.name,
        description: args.input.description,
        constraints: args.input.constraints,
        defaultValue: args.input.defaultValue
      })

      return {
        success: !!updatedAttributeType,
        attributeType: updatedAttributeType,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error updating attribute type', { error, id: args.id, input: args.input })
      return {
        success: false,
        attributeType: null,
        errors: [{ message: error.message, code: 'UPDATE_ATTRIBUTE_TYPE_ERROR' }]
      }
    }
  }

  async deleteAttributeType(_: GraphQLParent, args: DeleteAttributeTypeArgs) {
    try {
      this.logger.info('Deleting attribute type', { id: args.id })
      
      const existingAttributeType = await this.attributeTypeRepository.findById(args.id)
      if (!existingAttributeType) {
        return {
          success: false,
          errors: [{ message: 'Attribute type not found', code: 'ATTRIBUTE_TYPE_NOT_FOUND' }]
        }
      }

      await this.attributeTypeRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error deleting attribute type', { error, id: args.id })
      return {
        success: false,
        errors: [{ message: error.message, code: 'DELETE_ATTRIBUTE_TYPE_ERROR' }]
      }
    }
  }

  async createAttribute(_: GraphQLParent, args: CreateAttributeArgs) {
    try {
      this.logger.info('Creating attribute', { input: args.input })
      
      const result = await this.createAttributeUseCase.execute({
        identifier: args.input.identifier,
        name: args.input.name,
        description: args.input.description,
        attributeTypeId: args.input.attributeTypeId,
        tableId: args.input.tableId
      })

      return {
        success: !!result,
        attribute: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating attribute', { error, input: args.input })
      return {
        success: false,
        attribute: null,
        errors: [{ message: error.message, code: 'CREATE_ATTRIBUTE_ERROR' }]
      }
    }
  }

  async updateAttribute(_: GraphQLParent, args: UpdateAttributeArgs) {
    try {
      this.logger.info('Updating attribute', { id: args.id, input: args.input })
      
      const existingAttribute = await this.attributeRepository.findById(args.id)
      if (!existingAttribute) {
        return {
          success: false,
          attribute: null,
          errors: [{ message: 'Attribute not found', code: 'ATTRIBUTE_NOT_FOUND' }]
        }
      }

      const updatedAttribute = await this.attributeRepository.update(args.id, {
        name: args.input.name,
        description: args.input.description
      })

      return {
        success: !!updatedAttribute,
        attribute: updatedAttribute,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error updating attribute', { error, id: args.id, input: args.input })
      return {
        success: false,
        attribute: null,
        errors: [{ message: error.message, code: 'UPDATE_ATTRIBUTE_ERROR' }]
      }
    }
  }

  async deleteAttribute(_: GraphQLParent, args: DeleteAttributeArgs) {
    try {
      this.logger.info('Deleting attribute', { id: args.id })
      
      const existingAttribute = await this.attributeRepository.findById(args.id)
      if (!existingAttribute) {
        return {
          success: false,
          errors: [{ message: 'Attribute not found', code: 'ATTRIBUTE_NOT_FOUND' }]
        }
      }

      await this.attributeRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error deleting attribute', { error, id: args.id })
      return {
        success: false,
        errors: [{ message: error.message, code: 'DELETE_ATTRIBUTE_ERROR' }]
      }
    }
  }
}