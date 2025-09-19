import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, TableParent } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class TableFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async attributes(parent: TableParent, _args?: any, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        const result = await this.attributeRepository.findByTableId(parent.id)
        const attributes = result.data || result.nodes || result.items || []

        // Map entities to GraphQL format with proper name resolution
        const mappedAttributes = await Promise.all(
          attributes.map(async (attribute) => {
            // Get the associated AttributeType to resolve the name
            const attributeType = await this.attributeTypeRepository.findById(
              attribute.getAttributeTypeId()
            )

            return {
              id: attribute.getId(),
              identifier: attribute.getIdentifier(),
              name: attributeType?.getIdentifier() || attribute.getIdentifier(), // Use AttributeType name or fallback to identifier
              description: attribute.getDescription(),
              createdAt: attribute.getCreatedAt(),
              updatedAt: attribute.getUpdatedAt(),
            }
          })
        )

        return mappedAttributes
      },
      'attributes',
      'Table',
      { tableId: parent.id }
    )
  }

  async attributeTypes(parent: TableParent, _args?: any, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        // Get all attributes for this table
        const attributesResult = await this.attributeRepository.findByTableId(parent.id)
        const attributes =
          attributesResult.data || attributesResult.nodes || attributesResult.items || []

        // Get unique attribute type IDs
        const attributeTypeIds = [
          ...new Set(attributes.map((attr) => attr.getAttributeTypeId()).filter(Boolean)),
        ]

        // Fetch all attribute types for these IDs
        const attributeTypes = await Promise.all(
          attributeTypeIds.map((id) => this.attributeTypeRepository.findById(id))
        )

        // Map to GraphQL format
        return attributeTypes
          .filter((at): at is NonNullable<typeof at> => at !== null)
          .map((at) => ({
            id: at.getId(),
            identifier: at.getIdentifier(),
            name: at.getIdentifier(),
            description: at.getDescription(),
            dataType: at.getJsonType(),
            format: at.getFormat(),
            constraints: at.getParsedValidationSchema(),
            defaultValue: at.getDefaultValue(),
            createdAt: at.getCreatedAt(),
            updatedAt: at.getUpdatedAt(),
          }))
      },
      'attributeTypes',
      'Table',
      { tableId: parent.id }
    )
  }

  async tableNodes(parent: TableParent, _args?: any, _context?: GraphQLContext) {
    try {
      this.logger.debug(`Resolving field: Table.tableNodes`, {
        tableId: parent.id
      })

      const result = await this.nodeRepository.findByTableId(parent.id)

      if (!result || !result.items) {
        this.logger.warn('No nodes found for Table', {
          tableId: parent.id
        })
        return []
      }

      // Transform domain entities to GraphQL-compatible objects
      const graphqlNodes = result.items.map(node => ({
        id: node.getId(),
        content: node.getContent(),
        createdAt: node.getCreatedAt(),
        updatedAt: node.getUpdatedAt(),
        tableId: node.getTableId()
      }))

      this.logger.debug(`Field resolved: Table.tableNodes`, {
        tableId: parent.id,
        nodeCount: graphqlNodes.length
      })

      return graphqlNodes
    } catch (error) {
      this.logger.error('Field resolution failed: Table.tableNodes', {
        error,
        tableId: parent.id
      })

      // Return empty array to prevent GraphQL errors
      return []
    }
  }

  async tableNodeCount(parent: TableParent, _args?: any, _context?: GraphQLContext) {
    try {
      return await this.nodeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.warn('TableNodeCount query failed, returning 0', { tableId: parent.id, error })
      return 0
    }
  }

  async attributeCount(parent: TableParent, _args?: any, _context?: GraphQLContext) {
    try {
      return await this.attributeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.warn('AttributeCount query failed, returning 0', { tableId: parent.id, error })
      return 0
    }
  }
}
