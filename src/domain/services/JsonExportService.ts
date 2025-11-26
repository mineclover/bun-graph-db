/**
 * JSON Export Service
 *
 * Exports table data in two formats:
 * 1. Flat JSON - Simple array with flattened attributes
 * 2. HFI Protocol - Full graph structure compatible with @packages/hfiflow
 */

import type { NodeId, RelationTypeId, TableId } from '@/core/types/CommonTypes.js'
import type {
  BranchMetadata,
  EffectNode,
  FlatJsonExport,
  FlatNode,
  FlowEdge,
  FlowNode,
  HFIProtocolExport,
  JsonExportOptions,
  JsonExportResult,
  PayloadField,
  PayloadFieldType,
  QueryNode,
  StateConnection,
} from '@/core/types/JsonExport.js'
import type { Attribute } from '../entities/Attribute.js'
import type { Node } from '../entities/Node.js'
import type { NodeAttribute } from '../entities/NodeAttribute.js'
import type { NodeRelation } from '../entities/NodeRelation.js'
import type { RelationType } from '../entities/RelationType.js'
import type { Table } from '../entities/Table.js'
import type { IAttributeRepository } from '../repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '../repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '../repositories/INodeRelationRepository.js'
import type { INodeRepository } from '../repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '../repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '../repositories/ITableRepository.js'

/** Helper to convert ID to string safely */
function toStringId(
  id: NodeId | RelationTypeId | TableId | string | number | null | undefined
): string {
  if (id === null || id === undefined) return ''
  return String(id)
}

/** Type for relation properties */
interface RelationProperties {
  isStateConnection?: boolean
  fromField?: string
  toField?: string
  [key: string]: unknown
}

/** Type for branch map entry */
interface BranchMapEntry {
  relationType: RelationType | undefined
  targets: string[]
}

export class JsonExportService {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository
  ) {}

  /**
   * Export table data to JSON
   */
  async exportTable(
    tableId: TableId,
    options: JsonExportOptions = { format: 'flat' }
  ): Promise<JsonExportResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Get table
      const table = await this.tableRepository.findById(tableId)
      if (!table) {
        return {
          success: false,
          format: options.format,
          nodeCount: 0,
          errors: [`Table with ID '${tableId}' not found`],
          warnings: [],
        }
      }

      // Get nodes
      const nodesResult = await this.nodeRepository.findByTableId(tableId, { limit: 10000 })
      let nodes = nodesResult.nodes || nodesResult.data || []

      // Filter by node IDs if specified
      if (options.nodeIds && options.nodeIds.length > 0) {
        const nodeIdSet = new Set(options.nodeIds)
        nodes = nodes.filter((n) => nodeIdSet.has(toStringId(n.getId())))
      }

      // Get attributes for table
      const attributesResult = await this.attributeRepository.findByTableId(tableId)
      const attributes = attributesResult.nodes || attributesResult.data || []

      // Get node attributes for all nodes
      const nodeAttributesMap = new Map<string, NodeAttribute[]>()
      for (const node of nodes) {
        const nodeId = toStringId(node.getId())
        const nodeAttrs = await this.nodeAttributeRepository.findByNodeId(node.getId())
        nodeAttributesMap.set(nodeId, nodeAttrs)
      }

      // Export based on format
      if (options.format === 'flat') {
        const data = this.exportFlat(table, nodes, attributes, nodeAttributesMap)
        return {
          success: true,
          format: 'flat',
          data,
          json:
            options.prettyPrint !== false ? JSON.stringify(data, null, 2) : JSON.stringify(data),
          nodeCount: nodes.length,
          errors,
          warnings,
        }
      } else {
        // HFI Protocol format
        let relations: NodeRelation[] = []
        let relationTypes: RelationType[] = []

        if (options.includeRelations !== false) {
          const relationsResult = await this.nodeRelationRepository.findByTableId(tableId, {
            limit: 10000,
          })
          relations = relationsResult.nodes || relationsResult.data || []
          const relationTypesResult = await this.relationTypeRepository.findAll()
          relationTypes = relationTypesResult.nodes || relationTypesResult.data || []
        }

        const data = this.exportHFI(
          table,
          nodes,
          attributes,
          nodeAttributesMap,
          relations,
          relationTypes,
          options
        )

        return {
          success: true,
          format: 'hfi',
          data,
          json:
            options.prettyPrint !== false ? JSON.stringify(data, null, 2) : JSON.stringify(data),
          nodeCount: nodes.length,
          errors,
          warnings,
        }
      }
    } catch (error) {
      return {
        success: false,
        format: options.format,
        nodeCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown export error'],
        warnings,
      }
    }
  }

  /**
   * Export to Flat JSON format
   */
  private exportFlat(
    table: Table,
    nodes: Node[],
    attributes: Attribute[],
    nodeAttributesMap: Map<string, NodeAttribute[]>
  ): FlatJsonExport {
    const flatNodes: FlatNode[] = nodes.map((node) => {
      const nodeId = toStringId(node.getId())
      const flatNode: FlatNode = {
        id: nodeId,
        title: node.getTitle() || node.getContent(),
        content: node.getContent(),
      }

      // Add flattened attributes
      const nodeAttrs = nodeAttributesMap.get(nodeId) || []
      for (const nodeAttr of nodeAttrs) {
        const attr = attributes.find((a) => a.getId() === nodeAttr.getAttributeId())
        if (attr) {
          flatNode[attr.getIdentifier()] = nodeAttr.getValue()
        }
      }

      return flatNode
    })

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      table: {
        id: toStringId(table.id),
        identifier: table.identifier,
        description: table.description || undefined,
      },
      nodes: flatNodes,
    }
  }

  /**
   * Export to HFI Protocol format
   */
  private exportHFI(
    table: Table,
    nodes: Node[],
    attributes: Attribute[],
    nodeAttributesMap: Map<string, NodeAttribute[]>,
    relations: NodeRelation[],
    relationTypes: RelationType[],
    options: JsonExportOptions
  ): HFIProtocolExport {
    // Build relation type map
    const relationTypeMap = new Map<string, RelationType>()
    for (const rt of relationTypes) {
      relationTypeMap.set(toStringId(rt.getId()), rt)
    }

    // Build outgoing relations map (source node ID -> relations)
    const outgoingRelationsMap = new Map<string, NodeRelation[]>()
    for (const relation of relations) {
      const sourceId = toStringId(relation.getSourceNodeId())
      if (!outgoingRelationsMap.has(sourceId)) {
        outgoingRelationsMap.set(sourceId, [])
      }
      outgoingRelationsMap.get(sourceId)!.push(relation)
    }

    // Convert nodes to FlowNodes
    const flowNodes: FlowNode[] = nodes.map((node) => {
      const nodeId = toStringId(node.getId())
      const nodeAttrs = nodeAttributesMap.get(nodeId) || []
      const outgoingRelations = outgoingRelationsMap.get(nodeId) || []

      // Build payload from attributes
      const payload: PayloadField[] = nodeAttrs.map((nodeAttr) => {
        const attr = attributes.find((a) => a.getId() === nodeAttr.getAttributeId())
        const value = nodeAttr.getValue()

        return {
          key: attr?.getIdentifier() || toStringId(nodeAttr.getAttributeId()),
          type: this.inferPayloadType(value),
          value: value,
          required: attr?.getIsRequired() ?? false,
        }
      })

      // Check if this node has branches (outgoing relations)
      if (outgoingRelations.length > 0) {
        // Query node with branches
        const branches = this.buildBranches(outgoingRelations, relationTypeMap)

        const queryNode: QueryNode = {
          id: nodeId,
          type: 'query',
          target: table.identifier,
          title: node.getTitle() || node.getContent(),
          branches,
          payload,
          flowContext: table.identifier,
          tags: options.tags,
        }

        return queryNode
      } else {
        // Effect node (no branches)
        const effectNode: EffectNode = {
          id: nodeId,
          type: 'effect',
          target: table.identifier,
          title: node.getTitle() || node.getContent(),
          description: node.getDescription() || undefined,
          payload,
          flowContext: table.identifier,
          tags: options.tags,
        }

        return effectNode
      }
    })

    // Build edges metadata
    const edges: FlowEdge[] = []
    for (const node of flowNodes) {
      if (node.type === 'query') {
        for (const branch of node.branches) {
          edges.push({
            id: `${node.id}-${branch.case}`,
            label: branch.label,
          })
        }
      }
    }

    // Build state connections if requested
    let stateConnections: StateConnection[] | undefined
    if (options.includeStateConnections) {
      stateConnections = this.buildStateConnections(relations, relationTypeMap)
    }

    return {
      protocol: 'HFI/1.1',
      context: table.identifier,
      nodes: flowNodes,
      edges,
      stateConnections,
      metadata: {
        createdAt: new Date().toISOString(),
        description: table.description || undefined,
        sourceTable: {
          id: toStringId(table.id),
          identifier: table.identifier,
        },
      },
    }
  }

  /**
   * Build branches from outgoing relations
   */
  private buildBranches(
    relations: NodeRelation[],
    relationTypeMap: Map<string, RelationType>
  ): BranchMetadata[] {
    // Group relations by relation type
    const branchMap = new Map<string, BranchMapEntry>()

    for (const relation of relations) {
      const relationTypeId = toStringId(relation.getRelationTypeId())
      const relationType = relationTypeMap.get(relationTypeId)
      const targetId = toStringId(relation.getTargetNodeId())

      if (!branchMap.has(relationTypeId)) {
        branchMap.set(relationTypeId, {
          relationType,
          targets: [],
        })
      }
      branchMap.get(relationTypeId)!.targets.push(targetId)
    }

    // Convert to BranchMetadata
    const branches: BranchMetadata[] = []
    for (const [relationTypeId, entry] of branchMap) {
      const { relationType, targets } = entry

      branches.push({
        case: relationType?.getIdentifier() || relationTypeId,
        label: relationType?.getDescription() || relationType?.getIdentifier() || relationTypeId,
        next: targets.length === 1 ? targets[0] : targets,
        meta: relationType?.getCategory() ? { category: relationType.getCategory() } : undefined,
      })
    }

    return branches
  }

  /**
   * Build state connections from relations
   * State connections are typically marked with specific relation types
   */
  private buildStateConnections(
    relations: NodeRelation[],
    _relationTypeMap: Map<string, RelationType>
  ): StateConnection[] {
    const stateConnections: StateConnection[] = []

    for (const relation of relations) {
      const properties = relation.getProperties() as RelationProperties | null
      if (properties?.isStateConnection) {
        stateConnections.push({
          from: toStringId(relation.getSourceNodeId()),
          fromField: properties.fromField || 'output',
          to: toStringId(relation.getTargetNodeId()),
          toField: properties.toField || 'input',
        })
      }
    }

    return stateConnections
  }

  /**
   * Infer payload field type from value
   */
  private inferPayloadType(value: unknown): PayloadFieldType {
    if (typeof value === 'string') return 'string'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object' && value !== null) return 'object'
    return 'string'
  }
}
