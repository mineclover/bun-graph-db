import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type {
  CreateAttributeInput,
  CreateAttributeTypeInput,
  MutationCreateAttributeArgs,
  MutationCreateAttributeTypeArgs,
  MutationDeleteAttributeArgs,
  MutationDeleteAttributeTypeArgs,
  MutationUpdateAttributeArgs,
  MutationUpdateAttributeTypeArgs,
} from '../../../../generated/graphql.types.js'
import type {
  GraphQLContext,
  GraphQLParent,
} from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class AttributeMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createAttributeTypeUseCase: CreateAttributeTypeUseCase,
    private readonly createAttributeUseCase: CreateAttributeUseCase,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createAttributeType(
    _: GraphQLParent,
    args: MutationCreateAttributeTypeArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create attribute type input'),
        BaseResolver.validationRules.required('input.identifier', 'Identifier'),
        BaseResolver.validationRules.required('input.name', 'Name'),
        BaseResolver.validationRules.required('input.dataType', 'Data type'),
        BaseResolver.validationRules.nonEmpty('input.identifier', 'Identifier'),
        BaseResolver.validationRules.nonEmpty('input.name', 'Name'),
      ],
      'createAttributeType'
    )

    return this.handleMutation(
      async () => {
        const result = await this.createAttributeTypeUseCase.execute({
          identifier: args.input.identifier,
          jsonType: args.input.dataType,
          format: args.input.name,
          description: args.input.description ?? undefined,
          validationSchema: args.input.constraints ?? undefined,
          defaultValue: args.input.defaultValue ?? undefined,
        })

        return {
          success: !!result,
          data: result,
          errors: [],
        }
      },
      'createAttributeType',
      { input: args.input }
    )
  }

  async updateAttributeType(
    _: GraphQLParent,
    args: MutationUpdateAttributeTypeArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute type ID'),
        BaseResolver.validationRules.required('input', 'Update attribute type input'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute type ID'),
      ],
      'updateAttributeType'
    )

    return this.handleMutation(
      async () => {
        const existingAttributeType = await this.attributeTypeRepository.findById(args.id)
        if (!existingAttributeType) {
          return {
            success: false,
            data: null,
            errors: [{ message: 'Attribute type not found', code: 'ATTRIBUTE_TYPE_NOT_FOUND' }],
          }
        }

        const updatedAttributeType = await this.attributeTypeRepository.update(args.id, existingAttributeType)

        return {
          success: !!updatedAttributeType,
          data: updatedAttributeType,
          errors: [],
        }
      },
      'updateAttributeType',
      { id: args.id, input: args.input }
    )
  }

  async deleteAttributeType(
    _: GraphQLParent,
    args: MutationDeleteAttributeTypeArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute type ID'),
      ],
      'deleteAttributeType'
    )

    return this.handleMutation(
      async () => {
        const existingAttributeType = await this.attributeTypeRepository.findById(args.id)
        if (!existingAttributeType) {
          return {
            success: false,
            errors: [{ message: 'Attribute type not found', code: 'ATTRIBUTE_TYPE_NOT_FOUND' }],
          }
        }

        await this.attributeTypeRepository.delete(args.id)

        return {
          success: true,
          errors: [],
        }
      },
      'deleteAttributeType',
      { id: args.id }
    )
  }

  async createAttribute(_: GraphQLParent, args: MutationCreateAttributeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create attribute input'),
        BaseResolver.validationRules.required('input.identifier', 'Identifier'),
        BaseResolver.validationRules.required('input.name', 'Name'),
        BaseResolver.validationRules.required('input.attributeTypeId', 'Attribute type ID'),
        BaseResolver.validationRules.required('input.tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('input.identifier', 'Identifier'),
        BaseResolver.validationRules.nonEmpty('input.name', 'Name'),
        BaseResolver.validationRules.nonEmpty('input.attributeTypeId', 'Attribute type ID'),
        BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
      ],
      'createAttribute'
    )

    return this.handleMutation(
      async () => {
        const result = await this.createAttributeUseCase.execute({
          identifier: args.input.identifier,
          description: args.input.description || undefined,
          attributeTypeId: args.input.attributeTypeId,
          tableId: args.input.tableId,
        })

        return {
          success: !!result,
          data: result,
          errors: [],
        }
      },
      'createAttribute',
      { input: args.input }
    )
  }

  async updateAttribute(_: GraphQLParent, args: MutationUpdateAttributeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute ID'),
        BaseResolver.validationRules.required('input', 'Update attribute input'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute ID'),
      ],
      'updateAttribute'
    )

    return this.handleMutation(
      async () => {
        const existingAttribute = await this.attributeRepository.findById(args.id)
        if (!existingAttribute) {
          return {
            success: false,
            data: null,
            errors: [{ message: 'Attribute not found', code: 'ATTRIBUTE_NOT_FOUND' }],
          }
        }

        const updatedAttribute = await this.attributeRepository.update(args.id, existingAttribute)

        return {
          success: !!updatedAttribute,
          data: updatedAttribute,
          errors: [],
        }
      },
      'updateAttribute',
      { id: args.id, input: args.input }
    )
  }

  async deleteAttribute(_: GraphQLParent, args: MutationDeleteAttributeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute ID'),
      ],
      'deleteAttribute'
    )

    return this.handleMutation(
      async () => {
        const existingAttribute = await this.attributeRepository.findById(args.id)
        if (!existingAttribute) {
          return {
            success: false,
            errors: [{ message: 'Attribute not found', code: 'ATTRIBUTE_NOT_FOUND' }],
          }
        }

        await this.attributeRepository.delete(args.id)

        return {
          success: true,
          errors: [],
        }
      },
      'deleteAttribute',
      { id: args.id }
    )
  }
}
