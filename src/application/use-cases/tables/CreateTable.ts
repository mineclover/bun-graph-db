import { Table } from '@/domain/entities/Table.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'
import type { CreateTableInput, CreateTableOutput } from '@/application/dtos/TableDto.js'
import { TableDto } from '@/application/dtos/TableDto.js'

export class CreateTableUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateTableInput): Promise<CreateTableOutput> {
    this.logger.info('Creating new table', { identifier: input.identifier })

    // Validate input
    if (!input.identifier?.trim()) {
      throw new ValidationException('Table identifier is required')
    }

    // Check if table already exists
    const existingTable = await this.tableRepository.findByIdentifier(input.identifier)
    if (existingTable) {
      throw new ConflictException(`Table with identifier '${input.identifier}' already exists`)
    }

    try {
      // Create domain entity
      const table = Table.create(input.identifier, input.description)

      // Save to repository
      await this.tableRepository.save(table)

      this.logger.info('Table created successfully', { 
        id: table.id, 
        identifier: table.identifier 
      })

      // Return DTO
      return {
        table: TableDto.fromEntity(table)
      }
    } catch (error) {
      this.logger.error('Failed to create table', { 
        identifier: input.identifier,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
}