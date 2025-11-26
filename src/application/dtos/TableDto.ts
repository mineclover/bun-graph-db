import type {
  BaseEntityDto,
  DeleteOutput,
  GetManyInput,
  WithDescription,
  WithIdentifier,
} from '@/core/types/UseCaseTypes.js'
import type { Table } from '@/domain/entities/Table.js'

// Data Transfer Object for Table entity
export interface TableDto extends BaseEntityDto, WithIdentifier, WithDescription {}

export function fromEntity(table: Table): TableDto {
  return {
    id: table.id,
    identifier: table.identifier,
    description: table.description,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  }
}

export function fromEntities(tables: Table[]): TableDto[] {
  return tables.map((table) => fromEntity(table))
}

// Input DTOs for operations
export interface CreateTableInput {
  identifier: string
  description?: string
}

export interface UpdateTableInput {
  description?: string | null
}

// Use generic GetManyInput for pagination
export type GetTablesInput = GetManyInput

// Output DTOs for operations - using standard patterns
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

// Use generic DeleteOutput
export type DeleteTableOutput = DeleteOutput
