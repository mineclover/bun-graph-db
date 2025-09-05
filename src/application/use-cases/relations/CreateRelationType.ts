import type { ILogger } from '@/application/ports/ILogger.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface CreateRelationTypeInput {
  identifier: string
  name: string
  description?: string
  category?: string
}

export interface CreateRelationTypeOutput {
  relationType: {
    id: string
    identifier: string
    description: string | null
    category: string | null
    createdAt: string
    updatedAt: string
  }
}

export class CreateRelationTypeUseCase {
  constructor(
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateRelationTypeInput): Promise<CreateRelationTypeOutput> {
    this.logger.info('Creating new relation type', {
      identifier: input.identifier,
    })

    // Validate input
    if (!input.identifier?.trim()) {
      throw new ValidationException('Relation type identifier is required')
    }

    // Check if relation type with same identifier already exists
    const existingRelationType = await this.relationTypeRepository.findByIdentifier(
      input.identifier
    )
    if (existingRelationType) {
      throw new ConflictException(
        `RelationType with identifier '${input.identifier}' already exists`
      )
    }

    try {
      // Create domain entity
      const relationType = RelationType.create(input.identifier, input.description, input.category)

      // Save to repository
      await this.relationTypeRepository.save(relationType)

      // Retrieve the saved relation type with the generated ID
      const savedRelationType = await this.relationTypeRepository.findByIdentifier(input.identifier)
      if (!savedRelationType) {
        throw new Error('Failed to retrieve saved relation type')
      }

      this.logger.info('Relation type created successfully', {
        id: savedRelationType.getId(),
        identifier: savedRelationType.getIdentifier(),
      })

      return {
        relationType: {
          id: savedRelationType.getId(),
          identifier: savedRelationType.getIdentifier(),
          description: savedRelationType.getDescription(),
          category: savedRelationType.getCategory(),
          createdAt: savedRelationType.getCreatedAt().toISOString(),
          updatedAt: savedRelationType.getUpdatedAt().toISOString(),
        },
      }
    } catch (error) {
      this.logger.error('Failed to create relation type', {
        identifier: input.identifier,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
