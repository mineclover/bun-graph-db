import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  GraphQLContext,
  GraphQLParent,
  TableArgs,
  TableByIdentifierArgs,
  TablesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class TableQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async table(_: GraphQLParent, args: TableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'table'
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findById(args.id)
      },
      'findTableById',
      { id: args.id }
    )
  }

  async tableByIdentifier(
    _: GraphQLParent,
    args: TableByIdentifierArgs,
    _context?: GraphQLContext
  ) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('identifier', 'Table identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Table identifier'),
      ],
      'tableByIdentifier'
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findByIdentifier(args.identifier)
      },
      'findTableByIdentifier',
      { identifier: args.identifier }
    )
  }

  async tables(_: GraphQLParent, args: TablesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.tableRepository.findAll(
          args.pagination || { limit: 10, offset: 0 }
        )

        return {
          nodes: result.data || [],
          totalCount: result.total || 0,
          hasNextPage: result.hasMore || false,
          hasPreviousPage: (args.pagination?.offset || 0) > 0,
        }
      },
      'findTables',
      { filter: args.filter, pagination: args.pagination, sort: args.sort }
    )
  }

  async searchTables(_: GraphQLParent, args: { filter?: any }, _context?: GraphQLContext) {
    // searchTables is a simplified interface for MCP compatibility
    // It delegates to the tables method with default pagination
    return this.tables(_, {
      filter: args.filter,
      pagination: { limit: 50, offset: 0 },
      sort: [{ field: 'createdAt', direction: 'DESC' }]
    }, _context)
  }

  async tableDocumentation(
    _: GraphQLParent,
    args: {
      tableId?: string
      identifier?: string
      includeRelationships?: boolean
      includeSampleNodes?: boolean
      includeUsageStats?: boolean
      sampleLimit?: number
    },
    _context?: GraphQLContext
  ) {
    // Validate that either tableId or identifier is provided
    if (!args.tableId && !args.identifier) {
      throw new Error('Either tableId or identifier must be provided')
    }

    return this.handleQuery(
      async () => {
        // Find the table first
        let table: any
        if (args.tableId) {
          table = await this.tableRepository.findById(args.tableId)
        } else if (args.identifier) {
          table = await this.tableRepository.findByIdentifier(args.identifier)
        }

        if (!table) {
          return null
        }

        // For now, return a basic structure - this will be expanded
        return {
          table: table,
          schema: {
            totalAttributes: 0,
            attributes: [],
          },
          sampleNodes: args.includeSampleNodes !== false ? [] : null,
          relationships:
            args.includeRelationships !== false
              ? {
                  incomingRelations: [],
                  outgoingRelations: [],
                  relatedTables: [],
                }
              : null,
          usageStats:
            args.includeUsageStats === true
              ? {
                  totalNodes: 0,
                  recentlyCreatedNodes: 0,
                  frequentlyAccessedAttributes: [],
                  averageAttributeUsage: 0.0,
                }
              : null,
          usageExamples: [
            {
              category: 'basic',
              title: 'Create a new node',
              description: `Add a new node to the ${table.identifier} table`,
              exampleMutation: `mutation {
  createNode(input: {
    tableId: "${table.id}"
    content: "Your content here"
  }) {
    success
    node { id content }
    errors { message }
  }
}`,
            },
          ],
        }
      },
      'tableDocumentation',
      { tableId: args.tableId, identifier: args.identifier }
    )
  }
}
