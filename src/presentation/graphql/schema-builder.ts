import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import type { GraphQLSchema } from 'graphql'
import { join } from 'path'

// Import resolvers
import { TableResolver } from './resolvers/TableResolver.js'
import { AttributeResolver } from './resolvers/AttributeResolver.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { ILogger } from '@/application/ports/ILogger.js'

interface ResolverDependencies {
  tableRepository: ITableRepository
  attributeTypeRepository: IAttributeTypeRepository
  attributeRepository: IAttributeRepository
  createTableUseCase: CreateTableUseCase
  createAttributeTypeUseCase: CreateAttributeTypeUseCase
  createAttributeUseCase: CreateAttributeUseCase
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

  const attributeResolver = new AttributeResolver(
    deps.createAttributeTypeUseCase,
    deps.createAttributeUseCase,
    deps.attributeTypeRepository,
    deps.attributeRepository,
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
      tables: (_: unknown, args: any) => tableResolver.tables(args),

      // Attribute type queries
      attributeType: (_: unknown, args: any) => attributeResolver.attributeType(args),
      attributeTypeByIdentifier: (_: unknown, args: any) => attributeResolver.attributeTypeByIdentifier(args),
      attributeTypes: (_: unknown, args: any) => attributeResolver.attributeTypes(),

      // Attribute queries
      attribute: (_: unknown, args: any) => attributeResolver.attribute(args),
      attributes: (_: unknown, args: any) => attributeResolver.attributes(args)
    },

    Mutation: {
      _empty: () => null,

      // Table mutations
      createTable: (_: unknown, args: any) => tableResolver.createTable(args),
      updateTable: (_: unknown, args: any) => tableResolver.updateTable(args),
      deleteTable: (_: unknown, args: any) => tableResolver.deleteTable(args),

      // Attribute type mutations
      createAttributeType: (_: unknown, args: any) => attributeResolver.createAttributeType(args),
      updateAttributeType: (_: unknown, args: any) => attributeResolver.updateAttributeType(args),
      deleteAttributeType: (_: unknown, args: any) => attributeResolver.deleteAttributeType(args),

      // Attribute mutations
      createAttribute: (_: unknown, args: any) => attributeResolver.createAttribute(args),
      updateAttribute: (_: unknown, args: any) => attributeResolver.updateAttribute(args),
      deleteAttribute: (_: unknown, args: any) => attributeResolver.deleteAttribute(args)
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
    },

    Attribute: {
      attributeType: (parent: any) => attributeResolver.attributeType_field(parent),
      table: (parent: any) => attributeResolver.table_field(parent)
    }
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers
  })
}