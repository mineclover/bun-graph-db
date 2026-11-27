import { fromEntity as attributeFromEntity } from '@/application/dtos/AttributeDto.js'
import { fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import { fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { NotFoundException } from '@/shared/exceptions/DomainException.js'

const MAX_SCAN_NODES = 10_000
const MAX_SCAN_TABLES = 500
const MAX_SCAN_ATTRIBUTES = 5_000

export type AttributeGroupByMode = 'VALUE' | 'DATA_TYPE' | 'TABLE' | 'ATTRIBUTE'

export interface NodeAttributeAnalyticsFilterInput {
  dateRange?: { start?: string; end?: string }
  valuePattern?: string
  dataTypes?: string[]
  isRequired?: boolean
}

export interface NodeAttributeAnalyticsArgs {
  tableId?: string
  attributeIdentifier?: string
  filter?: NodeAttributeAnalyticsFilterInput
}

export class NodeAttributeAnalyticsService {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
  ) {}

  async getNodeAttributeAnalytics(args: NodeAttributeAnalyticsArgs = {}) {
    const tables = await this.loadScopedTables(args.tableId)
    const tableIds = tables.map((t) => t.id)
    const [nodes, allAttributes, attributeTypes] = await Promise.all([
      this.loadNodesForTables(tableIds),
      this.loadAttributesForTables(tableIds),
      this.loadAllAttributeTypes(),
    ])

    const typeById = new Map(attributeTypes.map((at) => [String(at.getId()), at]))
    const filter = args.filter ?? {}
    const allowedDataTypes =
      filter.dataTypes && filter.dataTypes.length > 0
        ? new Set(filter.dataTypes.map((dt) => dt.trim().toLowerCase()).filter(Boolean))
        : null

    const scopedAttributes = allAttributes.filter((attr) => {
      if (args.attributeIdentifier && attr.getIdentifier() !== args.attributeIdentifier) {
        return false
      }
      if (filter.isRequired !== undefined && attr.getIsRequired() !== filter.isRequired) {
        return false
      }
      if (allowedDataTypes) {
        const at = typeById.get(String(attr.getAttributeTypeId()))
        const jsonType = at?.getJsonType().toLowerCase() ?? ''
        const typeIdent = at?.getIdentifier().toLowerCase() ?? ''
        if (!allowedDataTypes.has(jsonType) && !allowedDataTypes.has(typeIdent)) {
          return false
        }
      }
      return true
    })

    const scopedAttrById = new Map(scopedAttributes.map((attr) => [String(attr.getId()), attr]))
    const nodeIds = nodes.map((node) => node.getId()).filter(Boolean) as NodeId[]
    const rawNodeAttrs = nodeIds.length > 0 ? await this.nodeAttributeRepository.findByNodeIds(nodeIds) : []

    const startMs = parseOptionalDateMs(filter.dateRange?.start)
    const endMs = parseOptionalDateMs(filter.dateRange?.end)
    const patternMatcher = createValuePatternMatcher(filter.valuePattern)

    const valuesByAttrId = new Map<string, string[]>()
    const filledNodeAttrKeys = new Set<string>()

    for (const na of rawNodeAttrs) {
      const attrId = String(na.getAttributeId())
      if (!scopedAttrById.has(attrId)) continue

      if (startMs !== null || endMs !== null) {
        const createdMs = na.getCreatedAt().getTime()
        if (startMs !== null && createdMs < startMs) continue
        if (endMs !== null && createdMs > endMs) continue
      }

      const rawValue = stringifyAttributeValue(na.getValue())
      if (patternMatcher && !patternMatcher(rawValue)) continue

      let list = valuesByAttrId.get(attrId)
      if (!list) {
        list = []
        valuesByAttrId.set(attrId, list)
      }
      list.push(rawValue)
      if (rawValue.trim().length > 0) {
        filledNodeAttrKeys.add(`${na.getNodeId()}:${attrId}`)
      }
    }

    const totalNodes = nodes.length
    const totalAttributes = scopedAttributes.length

    const attributeStats = scopedAttributes.map((attr) => {
      const attrId = String(attr.getId())
      const vals = valuesByAttrId.get(attrId) ?? []
      const nonEmptyVals = vals.filter((v) => v.trim().length > 0)
      const uniqueValues = new Set(nonEmptyVals).size
      const totalValues = nonEmptyVals.length
      const nullValues = Math.max(0, totalNodes - totalValues)
      const completenessRate = totalNodes > 0 ? (totalValues / totalNodes) * 100 : 100
      const at = typeById.get(String(attr.getAttributeTypeId()))
      return {
        attributeId: attrId,
        identifier: attr.getIdentifier(),
        totalValues,
        uniqueValues,
        nullValues,
        completenessRate,
        dataType: at?.getJsonType() ?? 'string',
      }
    })

    const usageByTypeId = new Map<string, number>()
    for (const attr of scopedAttributes) {
      const attrId = String(attr.getId())
      const typeId = String(attr.getAttributeTypeId())
      const count = (valuesByAttrId.get(attrId) ?? []).length
      usageByTypeId.set(typeId, (usageByTypeId.get(typeId) ?? 0) + count)
    }

    const typeDistribution = [...usageByTypeId.entries()]
      .map(([typeId, usageCount]) => {
        const at = typeById.get(typeId)
        if (!at) return null
        return {
          typeId,
          identifier: at.getIdentifier(),
          jsonType: at.getJsonType(),
          usageCount,
          averageValuesPerNode: totalNodes > 0 ? usageCount / totalNodes : 0,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.usageCount - a.usageCount || a.identifier.localeCompare(b.identifier))

    const valueRanges = scopedAttributes.map((attr) => {
      const attrId = String(attr.getId())
      const vals = (valuesByAttrId.get(attrId) ?? []).filter((v) => v.trim().length > 0)
      const at = typeById.get(String(attr.getAttributeTypeId()))
      const jsonType = at?.getJsonType() ?? 'string'
      const isNumeric = jsonType === 'number' || jsonType === 'integer'

      let minValue: string | null = null
      let maxValue: string | null = null
      if (vals.length > 0) {
        if (isNumeric) {
          const nums = vals.map((v) => Number(v)).filter((n) => Number.isFinite(n))
          if (nums.length > 0) {
            minValue = String(Math.min(...nums))
            maxValue = String(Math.max(...nums))
          }
        }
        if (minValue === null) {
          const sorted = [...vals].sort((a, b) => a.localeCompare(b))
          minValue = sorted[0] ?? null
          maxValue = sorted[sorted.length - 1] ?? null
        }
      }

      const avgLen =
        vals.length > 0 ? vals.reduce((sum, v) => sum + v.length, 0) / vals.length : null
      const freq = new Map<string, number>()
      for (const v of vals) {
        freq.set(v, (freq.get(v) ?? 0) + 1)
      }
      const commonValues = [...freq.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([v]) => v)

      return {
        attributeId: attrId,
        identifier: attr.getIdentifier(),
        minValue,
        maxValue,
        averageLength: avgLen,
        commonValues,
      }
    })

    const denominator = totalNodes * totalAttributes
    const completenessPercentage =
      denominator > 0 ? (filledNodeAttrKeys.size / denominator) * 100 : totalNodes === 0 ? 0 : 100

    return {
      totalNodes,
      totalAttributes,
      completenessPercentage,
      attributeStats,
      typeDistribution,
      valueRanges,
    }
  }

  async getAttributeValueDistribution(
    attributeId: string,
    groupBy: AttributeGroupByMode = 'VALUE',
  ) {
    const attribute = await this.attributeRepository.findById(attributeId as AttributeId)
    if (!attribute) {
      throw new NotFoundException(`Attribute with ID '${attributeId}' not found`)
    }

    const [attributeType, table, nodeAttributes] = await Promise.all([
      this.attributeTypeRepository.findById(attribute.getAttributeTypeId()),
      this.tableRepository.findById(attribute.getTableId()),
      this.loadAllByAttributeId(attributeId as AttributeId),
    ])

    const nodeIds = [...new Set(nodeAttributes.map((na) => na.getNodeId()))] as NodeId[]
    const loadedNodes = nodeIds.length > 0 ? await this.nodeRepository.findByIds(nodeIds) : []
    const nodeById = new Map(loadedNodes.map((node) => [String(node.getId()), node]))

    const total = nodeAttributes.length
    const groups = new Map<string, { count: number; nodes: Map<string, Node> }>()

    for (const na of nodeAttributes) {
      const groupKey =
        groupBy === 'DATA_TYPE'
          ? (attributeType?.getJsonType() ?? 'string')
          : groupBy === 'TABLE'
            ? (table?.identifier ?? String(attribute.getTableId()))
            : groupBy === 'ATTRIBUTE'
              ? attribute.getIdentifier()
              : stringifyAttributeValue(na.getValue())

      let bucket = groups.get(groupKey)
      if (!bucket) {
        bucket = { count: 0, nodes: new Map() }
        groups.set(groupKey, bucket)
      }
      bucket.count += 1
      const entity = nodeById.get(String(na.getNodeId()))
      if (entity) {
        bucket.nodes.set(String(entity.getId()), entity)
      }
    }

    return [...groups.entries()]
      .map(([value, bucket]) => ({
        value,
        count: bucket.count,
        percentage: total > 0 ? (bucket.count / total) * 100 : 0,
        nodes: [...bucket.nodes.values()].map((node) => nodeFromEntity(node)),
      }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  }

  async getAttributeCompleteness(tableId: string) {
    const table = await this.tableRepository.findById(tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with ID '${tableId}' not found`)
    }

    const [attributes, nodes] = await Promise.all([
      this.loadAttributesForTables([tableId as TableId]),
      this.loadNodesForTables([tableId as TableId]),
    ])

    const nodeIds = nodes.map((node) => node.getId()).filter(Boolean) as NodeId[]
    const rawNodeAttrs = nodeIds.length > 0 ? await this.nodeAttributeRepository.findByNodeIds(nodeIds) : []

    const filledByAttrId = new Map<string, Set<string>>()
    const filledAttrsByNodeId = new Map<string, Set<string>>()

    for (const na of rawNodeAttrs) {
      const val = stringifyAttributeValue(na.getValue())
      if (val.trim().length === 0) continue
      const attrId = String(na.getAttributeId())
      const nodeId = String(na.getNodeId())

      let nodeSet = filledByAttrId.get(attrId)
      if (!nodeSet) {
        nodeSet = new Set()
        filledByAttrId.set(attrId, nodeSet)
      }
      nodeSet.add(nodeId)

      let attrSet = filledAttrsByNodeId.get(nodeId)
      if (!attrSet) {
        attrSet = new Set()
        filledAttrsByNodeId.set(nodeId, attrSet)
      }
      attrSet.add(attrId)
    }

    const requiredAttrs = attributes.filter((attr) => attr.getIsRequired())
    const totalNodes = nodes.length
    const totalRequiredAttributes = requiredAttrs.length
    const totalOptionalAttributes = attributes.length - totalRequiredAttributes

    let completeNodes = 0
    for (const node of nodes) {
      const nodeId = String(node.getId())
      const present = filledAttrsByNodeId.get(nodeId)
      const hasAllRequired = requiredAttrs.every((req) => present?.has(String(req.getId())))
      if (hasAllRequired) {
        completeNodes += 1
      }
    }

    const incompleteNodes = Math.max(0, totalNodes - completeNodes)
    const completenessRate = totalNodes > 0 ? (completeNodes / totalNodes) * 100 : 100

    const attributeCompleteness = attributes.map((attr) => {
      const attrId = String(attr.getId())
      const filledCount = filledByAttrId.get(attrId)?.size ?? 0
      const emptyCount = Math.max(0, totalNodes - filledCount)
      return {
        attributeId: attrId,
        identifier: attr.getIdentifier(),
        isRequired: attr.getIsRequired(),
        filledCount,
        emptyCount,
        completenessRate: totalNodes > 0 ? (filledCount / totalNodes) * 100 : 100,
      }
    })

    return {
      tableId: String(table.id),
      totalNodes,
      totalRequiredAttributes,
      totalOptionalAttributes,
      completeNodes,
      incompleteNodes,
      completenessRate,
      attributeCompleteness,
    }
  }

  async getNodeWithTypedAttributes(nodeId: string) {
    const node = await this.nodeRepository.findById(nodeId as NodeId)
    if (!node) {
      return null
    }

    const tableId = node.getTableId()
    const [table, tableAttributes, attributeTypes, nodeAttributes] = await Promise.all([
      this.tableRepository.findById(tableId),
      this.loadAttributesForTables([tableId]),
      this.loadAllAttributeTypes(),
      this.nodeAttributeRepository.findByNodeId(nodeId as NodeId),
    ])

    if (!table) {
      return null
    }

    const attrById = new Map(tableAttributes.map((attr) => [String(attr.getId()), attr]))
    const typeById = new Map(attributeTypes.map((at) => [String(at.getId()), at]))
    const presentNonEmptyAttrIds = new Set<string>()

    const typedAttributes = nodeAttributes
      .map((na) => {
        const attr = attrById.get(String(na.getAttributeId()))
        if (!attr) return null
        const attrType = typeById.get(String(attr.getAttributeTypeId()))
        const rawString = stringifyAttributeValue(na.getValue())
        if (rawString.trim().length > 0) {
          presentNonEmptyAttrIds.add(String(attr.getId()))
        }
        const { parsedValue, isValid, validationErrors } = parseAndValidateTypedValue(
          rawString,
          attrType,
        )
        return {
          id: String(na.getId()),
          attribute: attributeFromEntity(attr),
          value: rawString,
          parsedValue,
          isValid,
          validationErrors,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const missingRequiredAttributes = tableAttributes
      .filter((attr) => attr.getIsRequired() && !presentNonEmptyAttrIds.has(String(attr.getId())))
      .map((attr) => attributeFromEntity(attr))

    const completenessScore =
      tableAttributes.length > 0
        ? (presentNonEmptyAttrIds.size / tableAttributes.length) * 100
        : 100

    return {
      id: String(node.getId()),
      content: node.getContent(),
      table: tableFromEntity(table),
      typedAttributes,
      missingRequiredAttributes,
      completenessScore,
    }
  }

  private async loadScopedTables(tableId?: string): Promise<Table[]> {
    if (tableId) {
      const table = await this.tableRepository.findById(tableId as TableId)
      return table ? [table] : []
    }
    const tables: Table[] = []
    let offset = 0
    while (tables.length < MAX_SCAN_TABLES) {
      const page = await this.tableRepository.findAll({ limit: 200, offset })
      const items = page.nodes ?? page.data ?? []
      if (items.length === 0) break
      tables.push(...items)
      if (!page.hasNextPage && !page.hasMore) break
      offset += items.length
    }
    return tables
  }

  private async loadNodesForTables(tableIds: readonly TableId[]): Promise<Node[]> {
    const nodes: Node[] = []
    for (const tableId of tableIds) {
      let offset = 0
      while (nodes.length < MAX_SCAN_NODES) {
        const page = await this.nodeRepository.findByTableId(tableId, { limit: 1000, offset })
        const items = page.nodes ?? page.data ?? []
        if (items.length === 0) break
        nodes.push(...items)
        if (!page.hasNextPage && !page.hasMore) break
        offset += items.length
      }
    }
    return nodes
  }

  private async loadAttributesForTables(tableIds: readonly TableId[]): Promise<Attribute[]> {
    const attrs: Attribute[] = []
    for (const tableId of tableIds) {
      let offset = 0
      while (attrs.length < MAX_SCAN_ATTRIBUTES) {
        const page = await this.attributeRepository.findByTableId(tableId, { limit: 500, offset })
        const items = page.nodes ?? page.data ?? []
        if (items.length === 0) break
        attrs.push(...items)
        if (!page.hasNextPage && !page.hasMore) break
        offset += items.length
      }
    }
    return attrs
  }

  private async loadAllAttributeTypes(): Promise<AttributeType[]> {
    const page = await this.attributeTypeRepository.findAll({ limit: 500, offset: 0 })
    return page.nodes ?? page.data ?? []
  }

  private async loadAllByAttributeId(attributeId: AttributeId): Promise<NodeAttribute[]> {
    const items: NodeAttribute[] = []
    let offset = 0
    while (items.length < MAX_SCAN_NODES) {
      const page = await this.nodeAttributeRepository.findByAttributeId(attributeId, {
        limit: 1000,
        offset,
      })
      const batch = page.nodes ?? page.data ?? []
      if (batch.length === 0) break
      items.push(...batch)
      if (!page.hasNextPage && !page.hasMore) break
      offset += batch.length
    }
    return items
  }
}

function stringifyAttributeValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseOptionalDateMs(raw?: string): number | null {
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

function createValuePatternMatcher(pattern?: string): ((value: string) => boolean) | null {
  if (!pattern?.trim()) return null
  const trimmed = pattern.trim()
  try {
    const regex = new RegExp(trimmed, 'i')
    return (value: string) => regex.test(value)
  } catch {
    const lower = trimmed.toLowerCase()
    return (value: string) => value.toLowerCase().includes(lower)
  }
}

function parseAndValidateTypedValue(
  raw: string,
  attributeType?: AttributeType,
): { parsedValue: unknown; isValid: boolean; validationErrors: string[] } {
  const errors: string[] = []
  const jsonType = attributeType?.getJsonType() ?? 'string'
  let parsedValue: unknown = raw

  if (jsonType === 'integer') {
    const num = Number(raw)
    if (!raw.trim() || !Number.isInteger(num)) {
      errors.push('Expected integer value')
    } else {
      parsedValue = num
    }
  } else if (jsonType === 'number') {
    const num = Number(raw)
    if (!raw.trim() || !Number.isFinite(num)) {
      errors.push('Expected number value')
    } else {
      parsedValue = num
    }
  } else if (jsonType === 'boolean') {
    const normalized = raw.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') parsedValue = true
    else if (normalized === 'false' || normalized === '0') parsedValue = false
    else errors.push('Expected boolean value')
  } else if (jsonType === 'array') {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) errors.push('Expected JSON array')
      else parsedValue = parsed
    } catch {
      errors.push('Invalid JSON array')
    }
  } else if (jsonType === 'object') {
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push('Expected JSON object')
      } else {
        parsedValue = parsed
      }
    } catch {
      errors.push('Invalid JSON object')
    }
  } else if (jsonType === 'null') {
    if (raw !== 'null' && raw !== '') errors.push('Expected null value')
    else parsedValue = null
  }

  const schema = attributeType?.getParsedValidationSchema?.() ?? attributeType?.getValidationSchema?.()
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const record = schema as Record<string, unknown>
    if (typeof record.minimum === 'number' && typeof parsedValue === 'number' && parsedValue < record.minimum) {
      errors.push(`Value must be >= ${record.minimum}`)
    }
    if (typeof record.maximum === 'number' && typeof parsedValue === 'number' && parsedValue > record.maximum) {
      errors.push(`Value must be <= ${record.maximum}`)
    }
    if (typeof record.minLength === 'number' && typeof parsedValue === 'string' && parsedValue.length < record.minLength) {
      errors.push(`Length must be >= ${record.minLength}`)
    }
    if (typeof record.maxLength === 'number' && typeof parsedValue === 'string' && parsedValue.length > record.maxLength) {
      errors.push(`Length must be <= ${record.maxLength}`)
    }
    if (Array.isArray(record.enum) && !record.enum.includes(parsedValue)) {
      errors.push(`Value must be one of: ${record.enum.map(String).join(', ')}`)
    }
  }

  return {
    parsedValue,
    isValid: errors.length === 0,
    validationErrors: errors,
  }
}
