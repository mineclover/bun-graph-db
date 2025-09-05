import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  AttributeArgs,
  AttributeByIdentifierArgs,
  AttributesArgs,
  GraphQLContext,
  GraphQLParent,
} from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class AttributeQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async attributeType(_: GraphQLParent, args: AttributeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute type ID'),
      ],
      'attributeType'
    )

    return this.handleQuery(
      async () => {
        return await this.attributeTypeRepository.findById(args.id)
      },
      'findAttributeTypeById',
      { id: args.id }
    )
  }

  async attributeTypeByIdentifier(
    _: GraphQLParent,
    args: AttributeByIdentifierArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('identifier', 'Attribute type identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Attribute type identifier'),
      ],
      'attributeTypeByIdentifier'
    )

    return this.handleQuery(
      async () => {
        return await this.attributeTypeRepository.findByIdentifier(args.identifier)
      },
      'findAttributeTypeByIdentifier',
      { identifier: args.identifier }
    )
  }

  async attributeTypes(_: GraphQLParent, args?: any, context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.attributeTypeRepository.findAll({ limit: 100, offset: 0 })

        return {
          nodes: result.items,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAttributeTypes',
      {}
    )
  }

  async attribute(_: GraphQLParent, args: AttributeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Attribute ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute ID'),
      ],
      'attribute'
    )

    return this.handleQuery(
      async () => {
        return await this.attributeRepository.findById(args.id)
      },
      'findAttributeById',
      { id: args.id }
    )
  }

  async attributeByIdentifier(
    _: GraphQLParent,
    args: AttributeByIdentifierArgs & { tableId: string },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('identifier', 'Attribute identifier'),
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Attribute identifier'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'attributeByIdentifier'
    )

    return this.handleQuery(
      async () => {
        // Note: The repository interface only accepts identifier, not tableId
        // This is a potential issue in the domain design that might need addressing
        // For now, we'll use only the identifier parameter
        return await this.attributeRepository.findByIdentifier(args.identifier)
      },
      'findAttributeByIdentifier',
      { identifier: args.identifier, tableId: args.tableId }
    )
  }

  async attributes(_: GraphQLParent, args: AttributesArgs, context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.attributeRepository.findAll(
          args.pagination || { limit: 10, offset: 0 }
        )

        return {
          nodes: result.items,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAttributes',
      { filter: args.filter, pagination: args.pagination, sort: args.sort }
    )
  }
}
