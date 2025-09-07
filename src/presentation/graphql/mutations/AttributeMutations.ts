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
          format: args.input.format ?? undefined,
          description: args.input.description ?? undefined,
          validationSchema: args.input.constraints,
          defaultValue: args.input.defaultValue ?? undefined,
        })

        // Map the DTO to GraphQL format
        if (result?.attributeType) {
          return {
            ...result.attributeType,
            dataType: result.attributeType.jsonType,
            name: args.input.name,
            constraints: result.attributeType.validationSchema,
          }
        }
        return null
      },
      'createAttributeType',
      { input: args.input }
    ).then(mutationResult => ({
      success: mutationResult.success,
      attributeType: mutationResult.data,
      errors: mutationResult.errors || [],
    }))
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
          throw new Error('Attribute type not found')
        }

        const updatedAttributeType = await this.attributeTypeRepository.update(args.id, {
          ...existingAttributeType,
          ...args.input,
        })

        return updatedAttributeType
      },
      'updateAttributeType',
      { id: args.id, input: args.input }
    ).then(mutationResult => ({
      success: mutationResult.success,
      attributeType: mutationResult.data,
      errors: mutationResult.errors || [],
    }))
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
          throw new Error('Attribute type not found')
        }

        await this.attributeTypeRepository.delete(args.id)
        return null
      },
      'deleteAttributeType',
      { id: args.id }
    ).then(mutationResult => ({
      success: mutationResult.success,
      errors: mutationResult.errors || [],
    }))
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

        return result
      },
      'createAttribute',
      { input: args.input }
    ).then(mutationResult => ({
      success: mutationResult.success,
      attribute: mutationResult.data,
      errors: mutationResult.errors || [],
    }))
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
          throw new Error('Attribute not found')
        }

        const updatedAttribute = await this.attributeRepository.update(args.id, {
          ...existingAttribute,
          ...args.input,
        })

        return updatedAttribute
      },
      'updateAttribute',
      { id: args.id, input: args.input }
    ).then(mutationResult => ({
      success: mutationResult.success,
      attribute: mutationResult.data,
      errors: mutationResult.errors || [],
    }))
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
          throw new Error('Attribute not found')
        }

        await this.attributeRepository.delete(args.id)
        return null
      },
      'deleteAttribute',
      { id: args.id }
    ).then(mutationResult => ({
      success: mutationResult.success,
      errors: mutationResult.errors || [],
    }))
  }
}
