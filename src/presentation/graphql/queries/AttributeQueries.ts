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
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async attributeType(_: GraphQLParent, args: AttributeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Attribute type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute type ID'),
      ],
      'attributeType',
    )

    return this.handleQuery(
      async () => {
        const attributeType = await this.attributeTypeRepository.findById(args.id)
        if (!attributeType) return null

        // Map entity to GraphQL format
        return {
          id: attributeType.getId(),
          identifier: attributeType.getIdentifier(),
          name: attributeType.getIdentifier(), // Use identifier as name for now
          description: attributeType.getDescription(),
          dataType: attributeType.getJsonType(),
          format: attributeType.getFormat(),
          constraints: attributeType.getParsedValidationSchema(),
          defaultValue: attributeType.getDefaultValue(),
          createdAt: attributeType.getCreatedAt(),
          updatedAt: attributeType.getUpdatedAt(),
        }
      },
      'findAttributeTypeById',
      { id: args.id },
    )
  }

  async attributeTypeByIdentifier(_: GraphQLParent, args: AttributeByIdentifierArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('identifier', 'Attribute type identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Attribute type identifier'),
      ],
      'attributeTypeByIdentifier',
    )

    return this.handleQuery(
      async () => {
        const attributeType = await this.attributeTypeRepository.findByIdentifier(args.identifier)
        if (!attributeType) return null

        // Map entity to GraphQL format
        return {
          id: attributeType.getId(),
          identifier: attributeType.getIdentifier(),
          name: attributeType.getIdentifier(), // Use identifier as name for now
          description: attributeType.getDescription(),
          dataType: attributeType.getJsonType(),
          format: attributeType.getFormat(),
          constraints: attributeType.getParsedValidationSchema(),
          defaultValue: attributeType.getDefaultValue(),
          createdAt: attributeType.getCreatedAt(),
          updatedAt: attributeType.getUpdatedAt(),
        }
      },
      'findAttributeTypeByIdentifier',
      { identifier: args.identifier },
    )
  }

  async attributeTypes(_: GraphQLParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.attributeTypeRepository.findAll({ limit: 100, offset: 0 })

        // Map entities to GraphQL format
        const nodes = (result.data || result.nodes || []).map((attributeType) => ({
          id: attributeType.getId(),
          identifier: attributeType.getIdentifier(),
          name: attributeType.getIdentifier(), // Use identifier as name for now
          description: attributeType.getDescription(),
          dataType: attributeType.getJsonType(),
          format: attributeType.getFormat(),
          constraints: attributeType.getParsedValidationSchema(),
          defaultValue: attributeType.getDefaultValue(),
          createdAt: attributeType.getCreatedAt(),
          updatedAt: attributeType.getUpdatedAt(),
        }))

        return {
          attributeTypes: nodes,
          totalCount: result.total || result.totalCount || 0,
          hasNextPage: result.hasNextPage || false,
          hasPreviousPage: result.hasPreviousPage || false,
        }
      },
      'findAttributeTypes',
      {},
    )
  }

  async attribute(_: GraphQLParent, args: AttributeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Attribute ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Attribute ID'),
      ],
      'attribute',
    )

    return this.handleQuery(
      async () => {
        const attribute = await this.attributeRepository.findById(args.id)
        if (!attribute) return null

        // Get the associated AttributeType to resolve the name
        const attributeType = await this.attributeTypeRepository.findById(attribute.getAttributeTypeId())

        // Map entity to GraphQL format
        return {
          id: attribute.getId(),
          identifier: attribute.getIdentifier(),
          name: attributeType?.getIdentifier() || attribute.getIdentifier(), // Use AttributeType name or fallback to identifier
          description: attribute.getDescription(),
          createdAt: attribute.getCreatedAt(),
          updatedAt: attribute.getUpdatedAt(),
        }
      },
      'findAttributeById',
      { id: args.id },
    )
  }

  async attributeByIdentifier(
    _: GraphQLParent,
    args: AttributeByIdentifierArgs & { tableId: string },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('identifier', 'Attribute identifier'),
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Attribute identifier'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'attributeByIdentifier',
    )

    return this.handleQuery(
      async () => {
        // Note: The repository interface only accepts identifier, not tableId
        // This is a potential issue in the domain design that might need addressing
        // For now, we'll use only the identifier parameter
        const attribute = await this.attributeRepository.findByIdentifier(args.identifier)
        if (!attribute) return null

        // Get the associated AttributeType to resolve the name
        const attributeType = await this.attributeTypeRepository.findById(attribute.getAttributeTypeId())

        // Map entity to GraphQL format
        return {
          id: attribute.getId(),
          identifier: attribute.getIdentifier(),
          name: attributeType?.getIdentifier() || attribute.getIdentifier(), // Use AttributeType name or fallback to identifier
          description: attribute.getDescription(),
          createdAt: attribute.getCreatedAt(),
          updatedAt: attribute.getUpdatedAt(),
        }
      },
      'findAttributeByIdentifier',
      { identifier: args.identifier, tableId: args.tableId },
    )
  }

  async attributes(_: GraphQLParent, args: AttributesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.attributeRepository.findAll(args.pagination || { limit: 10, offset: 0 })

        // Map entities to GraphQL format
        const attributes = (result.items || result.nodes || result.data || []).map(async (attribute) => {
          // Get the associated AttributeType to resolve the name
          const attributeType = await this.attributeTypeRepository.findById(attribute.getAttributeTypeId())

          return {
            id: attribute.getId(),
            identifier: attribute.getIdentifier(),
            name: attributeType?.getIdentifier() || attribute.getIdentifier(), // Use AttributeType name or fallback to identifier
            description: attribute.getDescription(),
            createdAt: attribute.getCreatedAt(),
            updatedAt: attribute.getUpdatedAt(),
          }
        })

        return {
          attributes: await Promise.all(attributes),
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAttributes',
      { filter: args.filter, pagination: args.pagination, sort: args.sort },
    )
  }
}
