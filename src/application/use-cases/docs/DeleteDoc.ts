import type { ILogger } from '@/application/ports/ILogger.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface DeleteDocOutput {
  success: boolean
}

export class DeleteDocUseCase {
  constructor(
    private readonly docRepository: IDocRepository,
    private readonly logger: ILogger
  ) {}

  async execute(id: DocId): Promise<DeleteDocOutput> {
    this.logger.info('Deleting doc', { id })

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
      // Check if doc can be deleted (business rules)
      if (!doc.canBeDeleted()) {
        throw new ValidationException('Doc cannot be deleted')
      }

      // Delete the doc
      await this.docRepository.delete(id)

      this.logger.info('Doc deleted successfully', {
        id,
        tableId: doc.tableId,
        category: doc.category,
      })

      return {
        success: true,
      }
    } catch (error) {
      this.logger.error('Failed to delete doc', { id, ...toErrorMeta(error) })
      throw error
    }
  }
}
