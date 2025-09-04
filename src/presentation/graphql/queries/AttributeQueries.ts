import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  AttributeArgs,
  AttributeByIdentifierArgs,
  AttributesArgs
} from '@/presentation/graphql/types/GraphQLTypes.js'

export class AttributeQueries {
  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly logger: ILogger
  ) {}

  async attributeType(_: GraphQLParent, args: AttributeArgs) {
    try {
      this.logger.info('Fetching attribute type', { id: args.id })
      return await this.attributeTypeRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching attribute type', { error, id: args.id })
      throw error
    }
  }

  async attributeTypeByIdentifier(_: GraphQLParent, args: AttributeByIdentifierArgs) {
    try {
      this.logger.info('Fetching attribute type by identifier', { identifier: args.identifier })
      return await this.attributeTypeRepository.findByIdentifier(args.identifier)
    } catch (error) {
      this.logger.error('Error fetching attribute type by identifier', { error, identifier: args.identifier })
      throw error
    }
  }

  async attributeTypes(_: GraphQLParent) {
    try {
      this.logger.info('Fetching attribute types')
      
      const result = await this.attributeTypeRepository.findAll({
        pagination: { limit: 100, offset: 0 }
      })

      return {
        nodes: result.items,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error fetching attribute types', { error })
      throw error
    }
  }

  async attribute(_: GraphQLParent, args: AttributeArgs) {
    try {
      this.logger.info('Fetching attribute', { id: args.id })
      return await this.attributeRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching attribute', { error, id: args.id })
      throw error
    }
  }

  async attributeByIdentifier(_: GraphQLParent, args: AttributeByIdentifierArgs & { tableId: string }) {
    try {
      this.logger.info('Fetching attribute by identifier', { identifier: args.identifier, tableId: args.tableId })
      return await this.attributeRepository.findByIdentifier(args.identifier, args.tableId)
    } catch (error) {
      this.logger.error('Error fetching attribute by identifier', { error, identifier: args.identifier, tableId: args.tableId })
      throw error
    }
  }

  async attributes(_: GraphQLParent, args: AttributesArgs) {
    try {
      this.logger.info('Fetching attributes', { args })
      
      const result = await this.attributeRepository.findAll({
        filter: args.filter,
        pagination: args.pagination || { limit: 10, offset: 0 },
        sort: args.sort
      })

      return {
        nodes: result.items,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error fetching attributes', { error, args })
      throw error
    }
  }
}