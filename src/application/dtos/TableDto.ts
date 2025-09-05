import type { Table } from '@/domain/entities/Table.js'

// Data Transfer Object for Table entity
export interface TableDto {
  id: string
  identifier: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export class TableDto {
  static fromEntity(table: Table): TableDto {
    return {
      id: table.id,
      identifier: table.identifier,
      description: table.description,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    }
  }

  static fromEntities(tables: Table[]): TableDto[] {
    return tables.map((table) => TableDto.fromEntity(table))
  }
}

// Input DTOs for operations
export interface CreateTableInput {
  identifier: string
  description?: string
}

export interface UpdateTableInput {
  description?: string | null
}

export interface GetTablesInput {
  limit?: number
  offset?: number
}

// Output DTOs for operations
export interface CreateTableOutput {
  table: TableDto
}

export interface GetTableOutput {
  table: TableDto | null
}

export interface GetTablesOutput {
  tables: TableDto[]
  total: number
  hasMore: boolean
}

export interface UpdateTableOutput {
  table: TableDto
}

export interface DeleteTableOutput {
  success: boolean
}
