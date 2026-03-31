import type { GraphQLResolveInfo } from 'graphql'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

interface DocParent {
  tableId?: string | null
  table?: { id?: string | null } | null
}

export class DocFieldResolvers {
  constructor(private readonly tableRepository: ITableRepository) {}

  async table(
    parent: DocParent,
    _args: Record<string, never>,
    _context: GraphQLContext,
    _info: GraphQLResolveInfo,
  ): Promise<TableDto | null> {
    try {
      const tableId = parent.tableId || parent.table?.id
      if (!tableId) {
        throw new Error('Table ID not found in doc')
      }

      const table = await this.tableRepository.findById(tableId as TableId)
      return table ? tableFromEntity(table) : null
    } catch (error) {
      console.error('Error resolving Doc.table:', error)
      throw error
    }
  }
}
