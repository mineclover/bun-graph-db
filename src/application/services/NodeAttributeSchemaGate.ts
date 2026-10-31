import type {
  TableSchemaProjectionRequest,
  TableSchemaProjectionService,
} from '@/application/services/TableSchemaProjectionService.js'
import {
  projectionDiagnosticErrors,
  unsafeProjectedAttributeValueErrors,
} from '@/application/use-cases/nodes/ProjectionValidationUtils.js'
import {
  auditProjectedNodeAttributes,
  coerceValueForProjectedSchema,
  extractProjectedAttributeLookup,
  type ProjectionValidationError,
  type TableSchemaConformanceReport,
  type TableSchemaProjection,
  validateProjectedNodeInput,
  validateProjectedNodeUpdateInput,
} from '@/core/schema/TableSchemaProjection.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface AttributePatchEntry {
  attributeIdOrIdentifier: string
  value: unknown
}

export interface NormalizedAttributeMutation {
  attributeId: AttributeId
  identifier: string
  coercedValue: unknown
  canonicalValue: string
}

export interface TableAttributeGateContext {
  readonly tableId: string
  readonly projection: TableSchemaProjection
  readonly attributeIdByIdentifier: ReadonlyMap<string, AttributeId>
  readonly identifierByAttributeId: ReadonlyMap<string, string>
  readonly requiredIdentifiers: ReadonlySet<string>
}

export type BatchPatchValidationResult =
  | {
      ok: true
      node: Node
      projection: TableSchemaProjection
      normalized: NormalizedAttributeMutation[]
    }
  | {
      ok: false
      error: unknown
    }

export class NodeAttributeSchemaGate {
  constructor(
    private readonly projectionService: Pick<TableSchemaProjectionService, 'project'>,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeAttributeRepository?: INodeAttributeRepository,
  ) {}

  async prepareTableGate(tableId: string): Promise<TableAttributeGateContext> {
    const projection = await this.projectionService.project({ tableId })
    const diagnosticErrors = projectionDiagnosticErrors(projection)
    if (diagnosticErrors.length > 0) {
      throw this.toValidationException(diagnosticErrors, projection)
    }

    const projectedLookup = extractProjectedAttributeLookup(projection)
    if (projectedLookup) {
      const attributeIdByIdentifier = new Map<string, AttributeId>()
      for (const [identifier, id] of projectedLookup.attributeIdByIdentifier) {
        attributeIdByIdentifier.set(identifier, id as AttributeId)
      }
      return {
        tableId,
        projection,
        attributeIdByIdentifier,
        identifierByAttributeId: projectedLookup.identifierByAttributeId,
        requiredIdentifiers: projectedLookup.requiredIdentifiers,
      }
    }

    const tableAttributes = await this.loadAllTableAttributes(tableId as TableId)
    const attributeIdByIdentifier = new Map<string, AttributeId>()
    const identifierByAttributeId = new Map<string, string>()
    const requiredIdentifiers = new Set<string>()
    for (const attribute of tableAttributes) {
      const id = attribute.getId()
      const identifier = attribute.getIdentifier()
      if (id) {
        attributeIdByIdentifier.set(identifier, String(id) as AttributeId)
        identifierByAttributeId.set(String(id), identifier)
      }
      if (attribute.getIsRequired()) {
        requiredIdentifiers.add(identifier)
      }
    }

    return {
      tableId,
      projection,
      attributeIdByIdentifier,
      identifierByAttributeId,
      requiredIdentifiers,
    }
  }

  validateAndNormalizePatchWithContext(
    context: TableAttributeGateContext,
    entries: ReadonlyArray<AttributePatchEntry>,
  ): NormalizedAttributeMutation[] {
    const { resolvedEntries, coercedByIdentifier, resolutionErrors } =
      this.resolveAndCoerceEntries(context, entries)

    const unsafeKeyErrors = unsafeProjectedAttributeValueErrors(coercedByIdentifier)
    const updateValidation = validateProjectedNodeUpdateInput(
      {
        tableId: context.tableId,
        attributes: coercedByIdentifier,
      },
      context.projection,
    )

    const allErrors = [
      ...resolutionErrors,
      ...unsafeKeyErrors,
      ...(updateValidation.valid ? [] : updateValidation.errors),
    ]
    if (allErrors.length > 0) {
      throw this.toValidationException(allErrors, context.projection)
    }

    return resolvedEntries.map((item) => ({
      attributeId: item.attributeId,
      identifier: item.identifier,
      coercedValue: item.coercedValue,
      canonicalValue:
        typeof item.coercedValue === 'string'
          ? item.coercedValue
          : JSON.stringify(item.coercedValue),
    }))
  }

  async validateAndNormalizeCreate(
    tableId: string,
    content: string,
    entries: ReadonlyArray<AttributePatchEntry> = [],
    cachedContext?: TableAttributeGateContext,
  ): Promise<{
    context: TableAttributeGateContext
    normalized: NormalizedAttributeMutation[]
  }> {
    const context = cachedContext ?? (await this.prepareTableGate(tableId))
    const { resolvedEntries, coercedByIdentifier, resolutionErrors } =
      this.resolveAndCoerceEntries(context, entries)

    const unsafeKeyErrors = unsafeProjectedAttributeValueErrors(coercedByIdentifier)
    const createValidation = validateProjectedNodeInput(
      {
        tableId: context.tableId,
        content,
        attributes: coercedByIdentifier,
      },
      context.projection,
    )

    const allErrors = [
      ...resolutionErrors,
      ...unsafeKeyErrors,
      ...(createValidation.valid ? [] : createValidation.errors),
    ]
    if (allErrors.length > 0) {
      throw this.toValidationException(allErrors, context.projection)
    }

    const normalized: NormalizedAttributeMutation[] = resolvedEntries
      .filter((item) => item.coercedValue !== undefined)
      .map((item) => ({
        attributeId: item.attributeId,
        identifier: item.identifier,
        coercedValue: item.coercedValue,
        canonicalValue:
          typeof item.coercedValue === 'string'
            ? item.coercedValue
            : JSON.stringify(item.coercedValue),
      }))

    return {
      context,
      normalized,
    }
  }

  async validateAndNormalizePatch(
    nodeId: string,
    entries: ReadonlyArray<AttributePatchEntry>,
  ): Promise<{
    node: Node
    projection: TableSchemaProjection
    normalized: NormalizedAttributeMutation[]
  }> {
    const node = await this.nodeRepository.findById(nodeId as NodeId)
    if (!node) {
      throw new NotFoundException(`Node with id '${nodeId}' not found`)
    }

    const tableId = String(node.getTableId())
    const context = await this.prepareTableGate(tableId)
    const normalized = this.validateAndNormalizePatchWithContext(context, entries)

    return {
      node,
      projection: context.projection,
      normalized,
    }
  }

  async validateAndNormalizeBatchPatches(
    patches: ReadonlyArray<{
      nodeId: string
      entries: ReadonlyArray<AttributePatchEntry>
    }>,
  ): Promise<BatchPatchValidationResult[]> {
    if (patches.length === 0) {
      return []
    }

    const uniqueNodeIds = Array.from(
      new Set(
        patches
          .map((patch) => patch.nodeId?.trim())
          .filter((nodeId): nodeId is string => Boolean(nodeId)),
      ),
    )
    const nodesById = await this.loadNodesByIds(uniqueNodeIds)
    const contextPromisesByTableId = new Map<string, Promise<TableAttributeGateContext>>()

    const getTableContext = (tableId: string): Promise<TableAttributeGateContext> => {
      let existing = contextPromisesByTableId.get(tableId)
      if (!existing) {
        existing = this.prepareTableGate(tableId)
        contextPromisesByTableId.set(tableId, existing)
      }
      return existing
    }

    const results: BatchPatchValidationResult[] = []
    for (const patch of patches) {
      const node = patch.nodeId ? nodesById.get(String(patch.nodeId)) : undefined
      if (!node) {
        results.push({
          ok: false,
          error: new NotFoundException(`Node with id '${patch.nodeId}' not found`),
        })
        continue
      }

      try {
        const context = await getTableContext(String(node.getTableId()))
        const normalized = this.validateAndNormalizePatchWithContext(
          context,
          patch.entries,
        )
        results.push({
          ok: true,
          node,
          projection: context.projection,
          normalized,
        })
      } catch (error) {
        results.push({
          ok: false,
          error,
        })
      }
    }

    return results
  }

  async validateRemoval(
    nodeId: string,
    attributeIdOrIdentifier: string,
  ): Promise<{
    node: Node
    resolvedAttributeId: AttributeId
    attribute: Attribute | null
  }> {
    const node = await this.nodeRepository.findById(nodeId as NodeId)
    if (!node) {
      throw new NotFoundException(`Node with id '${nodeId}' not found`)
    }

    const tableId = String(node.getTableId())
    const tableAttributes = await this.loadAllTableAttributes(tableId as TableId)
    const attribute =
      tableAttributes.find(
        (candidate) =>
          String(candidate.getId()) === attributeIdOrIdentifier ||
          candidate.getIdentifier() === attributeIdOrIdentifier,
      ) ?? null

    if (attribute?.getIsRequired()) {
      const identifier = attribute.getIdentifier()
      const message = `Cannot remove required attribute '${identifier}' from node '${nodeId}'`
      throw new ValidationException(message, {
        validationErrors: [
          {
            message,
            code: 'required',
            field: `attributes.${identifier}`,
            path: `#/attributes/${escapePointer(identifier)}`,
          },
        ],
        tableId,
      })
    }

    return {
      node,
      resolvedAttributeId: (attribute?.getId() ?? attributeIdOrIdentifier) as AttributeId,
      attribute,
    }
  }

  async auditTableConformance(
    request: TableSchemaProjectionRequest,
    options: { maxViolations?: number } = {},
  ): Promise<TableSchemaConformanceReport> {
    if (!this.nodeAttributeRepository) {
      throw new Error('nodeAttributeRepository is required to audit table conformance')
    }

    const projection = await this.projectionService.project(request)
    const tableId = projection.tableId as TableId
    const projectedLookup = extractProjectedAttributeLookup(projection)
    let identifierById: ReadonlyMap<string, string>
    if (projectedLookup) {
      identifierById = projectedLookup.identifierByAttributeId
    } else {
      const tableAttributes = await this.loadAllTableAttributes(tableId)
      const fallbackMap = new Map<string, string>()
      for (const attribute of tableAttributes) {
        const id = attribute.getId()
        if (id) fallbackMap.set(String(id), attribute.getIdentifier())
      }
      identifierById = fallbackMap
    }

    const nodes = await this.loadAllTableNodes(tableId)
    const attributesByNodeId = new Map<string, Record<string, unknown>>()
    const chunkSize = 500
    for (let index = 0; index < nodes.length; index += chunkSize) {
      const batchIds: NodeId[] = []
      for (const candidate of nodes.slice(index, index + chunkSize)) {
        const candidateId = candidate.getId()
        if (candidateId) batchIds.push(candidateId)
      }
      if (batchIds.length === 0) continue

      const rows: NodeAttribute[] = await this.nodeAttributeRepository.findByNodeIds(batchIds)
      for (const row of rows) {
        const nodeId = String(row.getNodeId())
        const attrId = String(row.getAttributeId())
        const identifier = identifierById.get(attrId) ?? attrId
        let record = attributesByNodeId.get(nodeId)
        if (!record) {
          record = {}
          attributesByNodeId.set(nodeId, record)
        }
        record[identifier] = row.getValue()
      }
    }

    const auditNodes = nodes.map((node) => {
      const id = String(node.getId())
      return {
        nodeId: id,
        content: node.getContent(),
        attributes: attributesByNodeId.get(id) ?? {},
      }
    })

    return auditProjectedNodeAttributes(auditNodes, projection, options)
  }

  private resolveAndCoerceEntries(
    context: TableAttributeGateContext,
    entries: ReadonlyArray<AttributePatchEntry>,
  ): {
    resolvedEntries: Array<{
      attributeId: AttributeId
      identifier: string
      coercedValue: unknown
    }>
    coercedByIdentifier: Record<string, unknown>
    resolutionErrors: ProjectionValidationError[]
  } {
    const resolutionErrors: ProjectionValidationError[] = []
    const resolvedEntries: Array<{
      attributeId: AttributeId
      identifier: string
      coercedValue: unknown
    }> = []
    const coercedByIdentifier: Record<string, unknown> = {}

    for (const entry of entries) {
      const key = String(entry.attributeIdOrIdentifier)
      const identifier =
        context.identifierByAttributeId.get(key) ??
        (context.attributeIdByIdentifier.has(key) ? key : undefined)
      const attributeId = identifier
        ? context.attributeIdByIdentifier.get(identifier)
        : undefined
      if (!identifier || !attributeId) {
        resolutionErrors.push({
          path: `#/attributes/${escapePointer(key)}`,
          code: 'additional-property',
          message: `Attribute '${key}' is not defined for table '${context.projection.tableIdentifier}'`,
          received: entry.value,
        })
        continue
      }

      const schema = context.projection.attributeValueSchemas[identifier]
      const coercedValue = coerceValueForProjectedSchema(entry.value, schema)
      coercedByIdentifier[identifier] = coercedValue
      resolvedEntries.push({
        attributeId,
        identifier,
        coercedValue,
      })
    }

    return {
      resolvedEntries,
      coercedByIdentifier,
      resolutionErrors,
    }
  }

  private async loadNodesByIds(nodeIds: readonly string[]): Promise<Map<string, Node>> {
    const nodesById = new Map<string, Node>()
    if (nodeIds.length === 0) {
      return nodesById
    }

    if (typeof this.nodeRepository.findByIds === 'function') {
      const chunkSize = 500
      for (let index = 0; index < nodeIds.length; index += chunkSize) {
        const chunk = nodeIds.slice(index, index + chunkSize) as NodeId[]
        const found = await this.nodeRepository.findByIds(chunk)
        for (const node of found) {
          nodesById.set(String(node.getId()), node)
        }
      }
      return nodesById
    }

    for (const nodeId of nodeIds) {
      const node = await this.nodeRepository.findById(nodeId as NodeId)
      if (node) {
        nodesById.set(String(node.getId()), node)
      }
    }
    return nodesById
  }

  private async loadAllTableAttributes(tableId: TableId): Promise<Attribute[]> {
    const attributes: Attribute[] = []
    const limit = 500
    let offset = 0

    while (true) {
      const result = await this.attributeRepository.findByTableId(tableId, { limit, offset })
      const page = result.data ?? result.nodes ?? result.items ?? []
      attributes.push(...page)
      offset += page.length
      const total = result.total ?? result.totalCount ?? attributes.length
      if (page.length === 0 || offset >= total) return attributes
    }
  }

  private async loadAllTableNodes(tableId: TableId): Promise<Node[]> {
    const nodes: Node[] = []
    const limit = 500
    let offset = 0

    while (true) {
      const result = await this.nodeRepository.findByTableId(tableId, { limit, offset })
      const page = result.data ?? result.nodes ?? result.items ?? []
      nodes.push(...page)
      offset += page.length
      const total = result.total ?? result.totalCount ?? nodes.length
      if (page.length === 0 || offset >= total) return nodes
    }
  }

  private toValidationException(
    errors: ProjectionValidationError[],
    projection: TableSchemaProjection,
  ): ValidationException {
    const firstMessage = errors[0]?.message ?? 'Node attribute failed table projection validation'
    return new ValidationException(firstMessage, {
      validationErrors: errors.map((error) => ({
        message: error.message,
        code: error.code,
        field: pointerToField(error.path),
        path: error.path,
        expected: error.expected,
        received: error.received,
        source: error.source,
      })),
      tableId: projection.tableId,
      tableIdentifier: projection.tableIdentifier,
      projectionVersionHash: projection.versionHash,
    })
  }
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

function pointerToField(path: string): string {
  return path
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')
}
