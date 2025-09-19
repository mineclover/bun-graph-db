import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeParent, GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class AttributeFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async attributeType(parent: AttributeParent, _args?: any, _context?: GraphQLContext) {
    try {
      this.logger.debug(`Resolving field: Attribute.attributeType`, {
        attributeId: parent.id,
        attributeTypeId: parent.attributeTypeId
      })

      const attributeType = await this.attributeTypeRepository.findById(parent.attributeTypeId)

      if (!attributeType) {
        this.logger.warn('AttributeType not found for Attribute', {
          attributeId: parent.id,
          attributeTypeId: parent.attributeTypeId
        })
        // Return a default attribute type to prevent GraphQL null error
        return {
          id: parent.attributeTypeId || 'unknown',
          identifier: 'unknown',
          dataType: 'string', // Map to dataType for GraphQL schema
          format: null,
          description: 'AttributeType not found in database',
          validationSchema: null,
          referenceConfig: null,
          defaultValue: null,
          examples: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }

      // Transform the domain entity to a GraphQL-compatible object
      const graphqlAttributeType = {
        id: attributeType.getId(),
        identifier: attributeType.getIdentifier(),
        dataType: attributeType.getJsonType(), // Map jsonType to dataType for GraphQL schema
        format: attributeType.getFormat(),
        description: attributeType.getDescription(),
        validationSchema: attributeType.getValidationSchema(),
        referenceConfig: attributeType.getReferenceConfig(),
        defaultValue: attributeType.getDefaultValue(),
        examples: attributeType.getExamples(),
        createdAt: attributeType.getCreatedAt(),
        updatedAt: attributeType.getUpdatedAt()
      }

      this.logger.debug(`Field resolved: Attribute.attributeType`, {
        attributeId: parent.id,
        attributeTypeId: parent.attributeTypeId,
        attributeTypeName: graphqlAttributeType.identifier
      })

      return graphqlAttributeType
    } catch (error) {
      this.logger.error('Field resolution failed: Attribute.attributeType', {
        error,
        attributeId: parent.id,
        attributeTypeId: parent.attributeTypeId
      })

      // Must return a non-null value to satisfy GraphQL non-nullable constraint
      return {
        id: parent.attributeTypeId || 'error',
        identifier: 'error',
        dataType: 'string', // Map to dataType for GraphQL schema
        format: null,
        description: 'An error occurred while loading the attribute type',
        validationSchema: null,
        referenceConfig: null,
        defaultValue: null,
        examples: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  }

  async table(parent: AttributeParent, _args?: any, _context?: GraphQLContext) {
    try {
      this.logger.debug(`Resolving field: Attribute.table`, {
        attributeId: parent.id,
        tableId: parent.tableId
      })

      const table = await this.tableRepository.findById(parent.tableId)

      if (!table) {
        this.logger.warn('Table not found for Attribute', {
          attributeId: parent.id,
          tableId: parent.tableId
        })
        // Return a default table to prevent GraphQL null error
        return {
          id: parent.tableId || 'unknown',
          identifier: 'unknown',
          description: 'Table not found in database',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }

      // Transform the domain entity to a GraphQL-compatible object
      const graphqlTable = {
        id: table.id,
        identifier: table.identifier,
        description: table.description,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt
      }

      this.logger.debug(`Field resolved: Attribute.table`, {
        attributeId: parent.id,
        tableId: parent.tableId,
        tableName: graphqlTable.identifier
      })

      return graphqlTable
    } catch (error) {
      this.logger.error('Field resolution failed: Attribute.table', {
        error,
        attributeId: parent.id,
        tableId: parent.tableId
      })

      // Must return a non-null value to satisfy GraphQL non-nullable constraint
      return {
        id: parent.tableId || 'error',
        identifier: 'error',
        description: 'An error occurred while loading the table',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  }

  async attribute(parent: any, _args?: any, _context?: GraphQLContext) {
    try {
      this.logger.debug(`Resolving field: NodeAttribute.attribute`, {
        nodeAttributeId: parent.id,
        attributeId: parent.attributeId
      })

      const attribute = await this.attributeRepository.findById(parent.attributeId)

      if (!attribute) {
        this.logger.warn('Attribute not found for NodeAttribute', {
          nodeAttributeId: parent.id,
          attributeId: parent.attributeId
        })
        // Return a default attribute to prevent GraphQL null error
        return {
          id: parent.attributeId || 'unknown',
          identifier: 'unknown',
          name: 'Unknown Attribute',
          description: 'Attribute not found in database',
          createdAt: new Date(),
          updatedAt: new Date(),
          attributeTypeId: 'unknown',
          tableId: 'unknown'
        }
      }

      // Get the associated AttributeType to resolve the name
      const attributeType = await this.attributeTypeRepository.findById(
        attribute.getAttributeTypeId()
      )

      // Transform the domain entity to a GraphQL-compatible object
      const graphqlAttribute = {
        id: attribute.getId(),
        identifier: attribute.getIdentifier(),
        name: attributeType?.getIdentifier() || attribute.getIdentifier(), // Use AttributeType name or fallback to identifier
        description: attribute.getDescription(),
        createdAt: attribute.getCreatedAt(),
        updatedAt: attribute.getUpdatedAt(),
        attributeTypeId: attribute.getAttributeTypeId(),
        tableId: attribute.getTableId()
      }

      this.logger.debug(`Field resolved: NodeAttribute.attribute`, {
        nodeAttributeId: parent.id,
        attributeId: parent.attributeId,
        attributeName: graphqlAttribute.name,
        attributeData: JSON.stringify(graphqlAttribute)
      })

      return graphqlAttribute
    } catch (error) {
      this.logger.error('Field resolution failed: NodeAttribute.attribute', {
        error,
        nodeAttributeId: parent.id,
        attributeId: parent.attributeId
      })

      // Must return a non-null value to satisfy GraphQL non-nullable constraint
      return {
        id: parent.attributeId || 'error',
        identifier: 'error',
        name: 'Error Loading Attribute',
        description: 'An error occurred while loading the attribute',
        createdAt: new Date(),
        updatedAt: new Date(),
        attributeTypeId: 'error',
        tableId: 'error'
      }
    }
  }
}
