import { TableDto } from '@/application/dtos/TableDto.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLResolveInfo } from 'graphql'

export class DocFieldResolvers {
  constructor(private readonly tableRepository: ITableRepository) {}

  async table(parent: any, args: any, context: any, info: GraphQLResolveInfo): Promise<TableDto | null> {
    try {
      const tableId = parent.tableId || parent.table?.id
      if (!tableId) {
        throw new Error('Table ID not found in doc')
      }

      const table = await this.tableRepository.findById(tableId as TableId)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      console.error('Error resolving Doc.table:', error)
      throw error
    }
  }
}