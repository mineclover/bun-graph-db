import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { GraphQLSchema } from 'graphql'
import { join } from 'path'

// Import resolvers
import { TableResolver } from './resolvers/TableResolver.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { ILogger } from '@/application/ports/ILogger.js'

interface ResolverDependencies {
  tableRepository: ITableRepository
  createTableUseCase: CreateTableUseCase
  logger: ILogger
}

export function buildGraphQLSchema(deps: ResolverDependencies): GraphQLSchema {
  // Load GraphQL schema files
  const typesArray = loadFilesSync(join(process.cwd(), 'src/presentation/graphql/schemas'), {
    extensions: ['graphql']
  })
  
  const typeDefs = mergeTypeDefs(typesArray)

  // Create resolver instances
  const tableResolver = new TableResolver(
    deps.createTableUseCase,
    deps.tableRepository,
    deps.logger
  )

  const resolvers = {
    // Custom scalars
    DateTime: DateTimeResolver,
    JSON: JSONResolver,

    // Root resolvers
    Query: {
      // Health check
      health: () => ({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: true, // TODO: implement actual health check
        version: '1.0.0'
      }),

      // Table queries
      table: (_: unknown, args: any) => tableResolver.table(args),
      tableByIdentifier: (_: unknown, args: any) => tableResolver.tableByIdentifier(args),
      tables: (_: unknown, args: any) => tableResolver.tables(args)
    },

    Mutation: {
      _empty: () => null,

      // Table mutations
      createTable: (_: unknown, args: any) => tableResolver.createTable(args),
      updateTable: (_: unknown, args: any) => tableResolver.updateTable(args),
      deleteTable: (_: unknown, args: any) => tableResolver.deleteTable(args)
    },

    Subscription: {
      // TODO: Implement subscriptions
      tableCreated: {
        subscribe: () => {
          // Placeholder
        }
      }
    },

    // Field resolvers
    Table: {
      nodeCount: (parent: any) => tableResolver.nodeCount(parent),
      attributeCount: (parent: any) => tableResolver.attributeCount(parent)
      // TODO: Add relationship resolvers (attributes, nodes)
    }
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers
  })
}