import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface UpdateDocInput {
  content?: string
  isActive?: boolean
}

export interface UpdateDocOutput {
  doc: DocDto
}

export class UpdateDocUseCase {
  constructor(
    private readonly docRepository: IDocRepository,
    private readonly logger: ILogger
  ) {}

  async execute(id: DocId, input: UpdateDocInput): Promise<UpdateDocOutput> {
    this.logger.info('Updating doc', { id, input })

    // Validate input
    if (!id?.trim()) {
      throw new ValidationException('Doc ID is required')
    }

    // Find existing doc
    const doc = await this.docRepository.findById(id)
    if (!doc) {
      throw new NotFoundException(`Doc with id '${id}' not found`)
    }

    try {
      // Update doc properties
      if (input.content !== undefined) {
        doc.updateContent(input.content)
      }

      if (input.isActive !== undefined) {
        if (input.isActive) {
          // If activating this doc, deactivate others in same category
          await this.docRepository.deactivateOthersInCategory(doc.tableId, doc.category, doc.id)
          doc.activate()
        } else {
          doc.deactivate()
        }
      }

      // Save updated doc
      await this.docRepository.save(doc)

      this.logger.info('Doc updated successfully', {
        id: doc.id,
        tableId: doc.tableId,
        category: doc.category,
      })

      // Return DTO
      return {
        doc: DocDto.fromEntity(doc),
      }
    } catch (error) {
      this.logger.error('Failed to update doc', { id, input, ...toErrorMeta(error) })
      throw error
    }
  }
}
