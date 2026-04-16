import type { UpdateNodeInput, UpdateNodeOutput } from '@/application/dtos/NodeDto.js'
import { fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableSchemaProjectionProvider } from '@/application/use-cases/nodes/CreateNode.js'
import {
  projectionDiagnosticErrors,
  unsafeProjectedAttributeValueErrors,
} from '@/application/use-cases/nodes/ProjectionValidationUtils.js'
import {
  type JsonSchema,
  type ProjectionValidationError,
  type TableSchemaProjection,
  validateProjectedNodeUpdateInput,
} from '@/core/schema/TableSchemaProjection.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { sanitizeTextContent } from '@/shared/utils/sanitizeText.js'

export class UpdateNodeUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly logger: ILogger,
    private readonly projectionProvider?: TableSchemaProjectionProvider,
  ) {}

  async execute(nodeId: string, input: UpdateNodeInput): Promise<UpdateNodeOutput> {
    const sanitizedContent = input.content === undefined ? undefined : sanitizeTextContent(input.content) ?? undefined
    const sanitizedTitle = input.title === undefined ? undefined : sanitizeTextContent(input.title) ?? null
    const sanitizedDescription = input.description === undefined ? undefined : sanitizeTextContent(input.description) ?? null

    this.logger.info('Updating node', {
      nodeId,
      tableId: input.tableId,
      hasAttributes: input.attributes !== undefined,
    })

    if (!nodeId?.trim()) {
      throw new ValidationException('Node ID is required')
    }

    if (input.content !== undefined && !sanitizedContent?.trim()) {
      throw new ValidationException('Node content is required')
    }

    if (
      input.content === undefined &&
      input.title === undefined &&
      input.description === undefined &&
      input.metadata === undefined &&
      input.attributes === undefined
    ) {
      throw new ValidationException('At least one node field or attribute must be provided')
    }

    const existingNode = await this.nodeRepository.findById(nodeId as NodeId)
    if (!existingNode) {
      throw new NotFoundException(`Node with id '${nodeId}' not found`)
    }

    const existingTableId = String(existingNode.getTableId())
    const existingTable = await this.tableRepository.findById(existingTableId as TableId)
    if (!existingTable) {
      throw new NotFoundException(`Table with id '${existingTableId}' not found`)
    }

    try {
      const { attributes, projection } = await this.validateProjectedAttributes(input, {
        tableId: existingTableId,
        tableIdentifier: existingTable.identifier,
      })
      const attributesByIdentifier = attributes
        ? await this.loadTableAttributesByIdentifier(existingTableId, existingTable.identifier, attributes, projection)
        : new Map<string, Attribute>()

      const updateFields = {
        content: sanitizedContent,
        title: sanitizedTitle,
        description: sanitizedDescription,
        metadata: input.metadata,
      }

      const hasNodeFieldUpdates = Object.values(updateFields).some((value) => value !== undefined)
      const updatedNode = hasNodeFieldUpdates
        ? await this.nodeRepository.update(nodeId as NodeId, updateFields)
        : existingNode

      if (attributes) {
        for (const [attributeIdentifier, value] of Object.entries(attributes)) {
          const attribute = attributesByIdentifier.get(attributeIdentifier) as Attribute

          if (value === undefined) {
            continue
          }

          await this.nodeAttributeRepository.setNodeAttribute(
            nodeId as NodeId,
            attribute.getId() as AttributeId,
            typeof value === 'string' ? value : JSON.stringify(value),
          )
        }
      }

      const attributeValues = await this.loadNodeAttributeValues(nodeId as NodeId)

      this.logger.info('Node updated successfully', {
        nodeId,
        tableId: existingTableId,
        attributeCount: Object.keys(attributeValues).length,
      })

      return {
        node: nodeFromEntity(updatedNode, attributeValues),
      }
    } catch (error) {
      this.logger.error('Failed to update node', {
        nodeId,
        tableId: existingTableId,
        input,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private async loadTableAttributesByIdentifier(
    tableId: string,
    tableIdentifier: string,
    attributes: Record<string, unknown>,
    projection?: TableSchemaProjection,
  ): Promise<Map<string, Attribute>> {
    const attributesResult = await this.attributeRepository.findByTableId(tableId as TableId)
    const availableAttributes = attributesResult.data ?? attributesResult.nodes ?? []
    const attributesByIdentifier = new Map(
      availableAttributes.map((attribute) => [attribute.getIdentifier(), attribute]),
    )

    for (const [attributeIdentifier, value] of Object.entries(attributes)) {
      if (!attributesByIdentifier.has(attributeIdentifier)) {
        throw this.createProjectionValidationException(
          [{
            path: `#/attributes/${attributeIdentifier}`,
            code: 'additional-property',
            message: `Attribute '${attributeIdentifier}' is not defined for table '${tableIdentifier}'`,
            received: value,
          }],
          projection,
        )
      }
    }

    return attributesByIdentifier
  }

  private async validateProjectedAttributes(
    input: UpdateNodeInput,
    existingTable: { tableId: string; tableIdentifier: string },
  ): Promise<{
    attributes?: Record<string, unknown>
    projection?: TableSchemaProjection
  }> {
    if (input.tableId !== undefined && input.tableId !== existingTable.tableId) {
      throw this.createProjectionValidationException([{
        path: '#/tableId',
        code: 'table-mismatch',
        message: `tableId must match existing node table '${existingTable.tableId}'`,
        expected: existingTable.tableId,
        received: input.tableId,
      }])
    }

    if (input.tableIdentifier !== undefined && input.tableIdentifier !== existingTable.tableIdentifier) {
      throw this.createProjectionValidationException([{
        path: '#/tableIdentifier',
        code: 'table-mismatch',
        message: `tableIdentifier must match existing node table '${existingTable.tableIdentifier}'`,
        expected: existingTable.tableIdentifier,
        received: input.tableIdentifier,
      }])
    }

    if (!this.projectionProvider) {
      return { attributes: input.attributes }
    }

    const projection = await this.projectionProvider.project({ tableId: existingTable.tableId })
    const projectionErrors = projectionDiagnosticErrors(projection)
    if (projectionErrors.length > 0) {
      throw this.createProjectionValidationException(projectionErrors, projection)
    }

    const attributes = input.attributes === undefined
      ? undefined
      : this.coerceProjectedAttributeValues(input.attributes, projection)
    const unsafeAttributeErrors = attributes ? unsafeProjectedAttributeValueErrors(attributes) : []
    if (unsafeAttributeErrors.length > 0) {
      throw this.createProjectionValidationException(unsafeAttributeErrors, projection)
    }

    const validation = validateProjectedNodeUpdateInput({
      tableId: input.tableId,
      tableIdentifier: input.tableIdentifier,
      content: input.content,
      attributes,
    }, projection)

    if (!validation.valid) {
      throw this.createProjectionValidationException(validation.errors, projection)
    }

    return {
      attributes,
      projection,
    }
  }

  private createProjectionValidationException(
    errors: ProjectionValidationError[],
    projection?: TableSchemaProjection,
  ): ValidationException {
    return new ValidationException('UpdateNode attributes failed table projection validation', {
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
      return JSON.parse(value)
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

  private async loadNodeAttributeValues(nodeId: NodeId): Promise<Record<string, unknown>> {
    const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(nodeId)
    const attributeValues: Record<string, unknown> = {}

    for (const nodeAttribute of nodeAttributes) {
      const attribute = await this.attributeRepository.findById(nodeAttribute.getAttributeId())
      if (attribute) {
        attributeValues[attribute.getIdentifier()] = nodeAttribute.getParsedValue()
      }
    }

    return attributeValues
  }
}
