import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import { Doc, DocCategory } from '@/domain/entities/Doc.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export interface CreateDocInput {
  tableId: TableId
  category: DocCategory
  content: string
  version?: number
}

export interface CreateDocOutput {
  doc: DocDto
}

export class CreateDocUseCase {
  constructor(
    private readonly docRepository: IDocRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateDocInput): Promise<CreateDocOutput> {
    // Map GraphQL enum values to domain enum values
    const categoryMapping: Record<string, DocCategory> = {
      USAGE: DocCategory.USAGE,
      GUIDE: DocCategory.GUIDE,
      EXAMPLE: DocCategory.EXAMPLE,
      SPEC: DocCategory.SPEC,
      GENERAL: DocCategory.GENERAL,
    }

    const mappedCategory =
      categoryMapping[input.category as string] || (input.category as DocCategory)

    this.logger.info('Creating new doc', {
      tableId: input.tableId,
      category: input.category,
      mappedCategory: mappedCategory,
    })

    // Validate input
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!input.category) {
      throw new ValidationException('Doc category is required')
    }

    if (!input.content?.trim()) {
      throw new ValidationException('Doc content is required')
    }

    // Verify table exists
    const table = await this.tableRepository.findById(input.tableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    try {
      // Determine version number
      const version = input.version || 1

      // Check if doc with same version already exists
      const existingDoc = await this.docRepository.exists(input.tableId, mappedCategory, version)
      if (existingDoc) {
        throw new ConflictException(
          `Doc with category '${mappedCategory}' and version ${version} already exists for table '${input.tableId}'`
        )
      }

      // Create domain entity
      const doc = Doc.create(input.tableId, mappedCategory, input.content, version)

      // When creating any new version, it becomes the active version and deactivates others
      await this.docRepository.deactivateOthersInCategory(input.tableId, mappedCategory)

      // Save to repository
      await this.docRepository.save(doc)

      // Retrieve the saved doc with the generated ID
      const savedDocs = await this.docRepository.findByTableAndCategory(
        input.tableId,
        mappedCategory
      )
      const savedDoc = savedDocs.find((d) => d.version === version)

      if (!savedDoc) {
        throw new Error('Failed to retrieve saved doc')
      }

      this.logger.info('Doc created successfully', {
        id: savedDoc.id,
        tableId: savedDoc.tableId,
        category: savedDoc.category,
        version: savedDoc.version,
      })

      // Return DTO
      return {
        doc: DocDto.fromEntity(savedDoc),
      }
    } catch (error) {
      this.logger.error('Failed to create doc', { input, error })
      throw error
    }
  }
}
