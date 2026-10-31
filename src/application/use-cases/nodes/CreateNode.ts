import type { CreateNodeInput, CreateNodeOutput } from '@/application/dtos/NodeDto.js'
import { fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import {
  projectionDiagnosticErrors,
  unsafeProjectedAttributeValueErrors,
} from '@/application/use-cases/nodes/ProjectionValidationUtils.js'
import {
  extractProjectedAttributeLookup,
  validateProjectedNodeInput,
  type JsonSchema,
  type ProjectionValidationError,
  type TableSchemaProjection,
} from '@/core/schema/TableSchemaProjection.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type {
  INodeMutationRepository,
  NodeAttributeMutation,
} from '@/domain/repositories/INodeMutationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { ConflictException, NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { sanitizeTextContent } from '@/shared/utils/sanitizeText.js'

export type TableSchemaProjectionProvider = Pick<TableSchemaProjectionService, 'project'>

export class CreateNodeUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly logger: ILogger,
    private readonly projectionProvider?: TableSchemaProjectionProvider,
    private readonly nodeMutationRepository?: INodeMutationRepository,
  ) {}

  async execute(input: CreateNodeInput): Promise<CreateNodeOutput> {
    const sanitizedContent = sanitizeTextContent(input.content) ?? undefined
    const sanitizedTitle = sanitizeTextContent(input.title) ?? undefined
    const sanitizedDescription = sanitizeTextContent(input.description) ?? undefined

    this.logger.debug('Creating new node', {
      tableId: input.tableId,
      content: sanitizedContent,
    })

    // Validate input
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!sanitizedContent?.trim()) {
      throw new ValidationException('Node content is required')
    }

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    // Check if node with same content already exists in this table
    const existingNode = await this.nodeRepository.findByTableIdAndContent(input.tableId as TableId, sanitizedContent)
    if (existingNode) {
      throw new ConflictException(`Node with content '${sanitizedContent}' already exists in table '${table.identifier}'`)
    }

    try {
      const { attributes, projection } = await this.validateProjectedAttributes(input)
      let attributeIdByIdentifier = new Map<string, AttributeId>()

      if (attributes) {
        const projectedLookup = projection ? extractProjectedAttributeLookup(projection) : null
        if (projectedLookup) {
          for (const [identifier, id] of projectedLookup.attributeIdByIdentifier) {
            attributeIdByIdentifier.set(identifier, id as AttributeId)
          }
        } else {
          const availableAttributes = await this.loadAllTableAttributes(input.tableId as TableId)
          attributeIdByIdentifier = new Map(
            availableAttributes.map((attribute) => [
              attribute.getIdentifier(),
              attribute.getId() as AttributeId,
            ]),
          )
        }

        for (const [attributeIdentifier, value] of Object.entries(attributes)) {
          if (!attributeIdByIdentifier.has(attributeIdentifier)) {
            throw this.createProjectionValidationException(
              [{
                path: `#/attributes/${attributeIdentifier}`,
                code: 'additional-property',
                message: `Attribute '${attributeIdentifier}' is not defined for table '${table.identifier}'`,
                received: value,
              }],
              projection,
            )
          }
        }
      }

      // Create domain entity
      const node = Node.create(
        input.tableId as TableId,
        sanitizedContent,
        sanitizedTitle,
        sanitizedDescription,
        input.metadata,
      )
      const attributeValues: Record<string, unknown> = {}
      const attributeMutations: NodeAttributeMutation[] = []

      if (attributes) {
        for (const [attributeIdentifier, value] of Object.entries(attributes)) {
          const attributeId = attributeIdByIdentifier.get(attributeIdentifier)

          if (!attributeId) {
            throw this.createProjectionValidationException(
              [{
                path: `#/attributes/${attributeIdentifier}`,
                code: 'additional-property',
                message: `Attribute '${attributeIdentifier}' is not defined for table '${table.identifier}'`,
                received: value,
              }],
              projection,
            )
          }

          if (value === undefined) {
            continue
          }

          attributeMutations.push({
            attributeId,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          })
          attributeValues[attributeIdentifier] = value
        }
      }

      const savedNode = this.nodeMutationRepository
        ? await this.nodeMutationRepository.create(node, attributeMutations)
        : await this.saveLegacy(node, attributeMutations, input.tableId as TableId, sanitizedContent)

      this.logger.debug('Node created successfully', {
        id: savedNode.getId(),
        content: savedNode.getContent(),
        attributeCount: Object.keys(attributeValues).length,
      })

      // Return DTO with attributes
      return {
        node: nodeFromEntity(savedNode, attributeValues),
      }
    } catch (error) {
      this.logger.error('Failed to create node', {
        content: input.content,
        sanitizedContent,
        tableId: input.tableId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private async saveLegacy(
    node: Node,
    attributes: readonly NodeAttributeMutation[],
    tableId: TableId,
    content: string,
  ): Promise<Node> {
    await this.nodeRepository.save(node)
    const savedNode = await this.nodeRepository.findByTableIdAndContent(tableId, content)
    if (!savedNode) throw new Error('Failed to retrieve saved node')

    for (const attribute of attributes) {
      await this.nodeAttributeRepository.save(NodeAttribute.create(
        savedNode.getId() as NodeId,
        attribute.attributeId,
        attribute.value,
      ))
    }
    return savedNode
  }

  private async loadAllTableAttributes(tableId: TableId): Promise<Attribute[]> {
    const attributes: Attribute[] = []
    const limit = 500
    let offset = 0

    while (true) {
      const result = await this.attributeRepository.findByTableId(tableId, { limit, offset })
      const page = result.data ?? result.nodes ?? []
      attributes.push(...page)
      offset += page.length
      const total = result.total ?? result.totalCount ?? attributes.length
      if (page.length === 0 || offset >= total) return attributes
    }
  }

  private async validateProjectedAttributes(input: CreateNodeInput): Promise<{
    attributes?: Record<string, unknown>
    projection?: TableSchemaProjection
  }> {
    if (!this.projectionProvider) {
      return { attributes: input.attributes }
    }

    const projection = await this.projectionProvider.project({ tableId: input.tableId })
    const projectionErrors = projectionDiagnosticErrors(projection)
    if (projectionErrors.length > 0) {
      throw this.createProjectionValidationException(projectionErrors, projection)
    }

    const attributes = this.coerceProjectedAttributeValues(input.attributes ?? {}, projection)
    const unsafeAttributeErrors = unsafeProjectedAttributeValueErrors(attributes)
    if (unsafeAttributeErrors.length > 0) {
      throw this.createProjectionValidationException(unsafeAttributeErrors, projection)
    }

    const validation = validateProjectedNodeInput({
      tableId: input.tableId,
      content: input.content,
      attributes,
    }, projection)

    if (!validation.valid) {
      throw this.createProjectionValidationException(validation.errors, projection)
    }

    return {
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      projection,
    }
  }

  private createProjectionValidationException(
    errors: ProjectionValidationError[],
    projection?: TableSchemaProjection,
  ): ValidationException {
    return new ValidationException('CreateNode attributes failed table projection validation', {
      validationErrors: errors.map((error) => ({
        message: error.message,
        code: error.code,
        field: this.pointerToField(error.path),
        path: error.path,
        expected: error.expected,
        received: error.received,
        source: error.source,
      })),
      tableId: projection?.tableId,
      tableIdentifier: projection?.tableIdentifier,
      projectionVersionHash: projection?.versionHash,
    })
  }

  private coerceProjectedAttributeValues(
    attributes: Record<string, unknown>,
    projection: TableSchemaProjection,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(attributes).map(([identifier, value]) => [
        identifier,
        this.coerceProjectedAttributeValue(value, projection.attributeValueSchemas[identifier]),
      ]),
    )
  }

  private coerceProjectedAttributeValue(value: unknown, schema: JsonSchema | undefined): unknown {
    if (typeof value !== 'string' || !schema) {
      return value
    }

    const type = this.firstJsonType(schema.type)
    if (!type || type === 'string') {
      return value
    }

    try {
      const parsed = JSON.parse(value)
      return parsed
    } catch {
      return value
    }
  }

  private firstJsonType(type: JsonSchema['type']): string | undefined {
    if (Array.isArray(type)) {
      return type.find((candidate) => candidate !== 'null')
    }

    return type
  }

  private pointerToField(path: string): string {
    return path
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
      .join('.')
  }
}
