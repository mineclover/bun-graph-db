import type { GraphQLResolveInfo } from 'graphql'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

export class DocFieldResolvers {
  constructor(private readonly tableRepository: ITableRepository) {}

  async table(parent: any, _args: any, _context: any, _info: GraphQLResolveInfo): Promise<TableDto | null> {
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
