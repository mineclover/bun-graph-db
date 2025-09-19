import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface ActivateDocOutput {
  doc: DocDto
}

export class ActivateDocUseCase {
  constructor(
    private readonly docRepository: IDocRepository,
    private readonly logger: ILogger
  ) {}

  async execute(id: DocId): Promise<ActivateDocOutput> {
    this.logger.info('Activating doc', { id })

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
      // Deactivate other docs in the same category for this table
      await this.docRepository.deactivateOthersInCategory(doc.tableId, doc.category, doc.id)

      // Activate this doc
      doc.activate()

      // Save updated doc
      await this.docRepository.save(doc)

      this.logger.info('Doc activated successfully', {
        id: doc.id,
        tableId: doc.tableId,
        category: doc.category,
        version: doc.version,
      })

      // Return DTO
      return {
        doc: DocDto.fromEntity(doc),
      }
    } catch (error) {
      this.logger.error('Failed to activate doc', { id, error })
      throw error
    }
  }
}
