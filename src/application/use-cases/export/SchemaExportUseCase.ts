import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

export interface SchemaExportOptions {
  includeData?: boolean
  includeRelations?: boolean
  format?: 'json' | 'yaml'
  compression?: boolean
}

export interface ExportedTable {
  id: string
  identifier: string
  description?: string
  metadata?: any
  createdAt: string
  updatedAt: string
  attributes: ExportedAttribute[]
  nodes: ExportedNode[]
  relations: ExportedRelation[]
  statistics: {
    nodeCount: number
    attributeCount: number
    relationCount: number
  }
}

export interface ExportedAttribute {
  id: string
  identifier: string
  name: string
  description?: string
  attributeType: {
    id: string
    identifier: string
    name: string
    dataType: string
    allowedValues?: string[]
    constraints?: any
  }
  isRequired: boolean
  defaultValue?: any
  createdAt: string
  updatedAt: string
}

export interface ExportedNode {
  id: string
  content: string
  title?: string
  description?: string
  attributes?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface ExportedRelation {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationType: {
    id: string
    identifier: string
    name: string
    description?: string
  }
  properties?: any
  strength?: number
  createdAt: string
  updatedAt: string
}

export interface SchemaExportResult {
  metadata: {
    exportedAt: string
    version: string
    source: string
    options: SchemaExportOptions
    checksum?: string
  }
  tables: ExportedTable[]
  globalRelationTypes: Array<{
    id: string
    identifier: string
    name: string
    description?: string
    metadata?: any
    createdAt: string
    updatedAt: string
  }>
  globalAttributeTypes: Array<{
    id: string
    identifier: string
    name: string
    description?: string
    dataType: string
    allowedValues?: string[]
    constraints?: any
    createdAt: string
    updatedAt: string
  }>
  statistics: {
    totalTables: number
    totalNodes: number
    totalRelations: number
    totalAttributes: number
    exportSize: string
  }
}

export class SchemaExportUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly logger: ILogger
  ) {}

  async exportTable(
    tableId: string,
    options: SchemaExportOptions = {}
  ): Promise<SchemaExportResult> {
    const startTime = Date.now()

    try {
      this.logger.info('Starting table export', { tableId, options })

      // Get table information
      const table = await this.tableRepository.findById(tableId as TableId)
      if (!table) {
        throw new Error(`Table with id '${tableId}' not found`)
      }

      // Export table data
      const exportedTable = await this.exportSingleTable(tableId, options)

      // Get global types
      const globalRelationTypes = await this.exportGlobalRelationTypes()
      const globalAttributeTypes = await this.exportGlobalAttributeTypes()

      // Calculate statistics
      const statistics = {
        totalTables: 1,
        totalNodes: exportedTable.statistics.nodeCount,
        totalRelations: exportedTable.statistics.relationCount,
        totalAttributes: exportedTable.statistics.attributeCount,
        exportSize: this.calculateSize([exportedTable]),
      }

      const result: SchemaExportResult = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Bun Graph DB',
          options,
        },
        tables: [exportedTable],
        globalRelationTypes,
        globalAttributeTypes,
        statistics,
      }

      const executionTime = Date.now() - startTime
      this.logger.info('Table export completed', {
        tableId,
        statistics,
        executionTime,
      })

      return result
    } catch (error) {
      this.logger.error('Failed to export table', { tableId, options, error })
      throw error
    }
  }

  async exportAllTables(options: SchemaExportOptions = {}): Promise<SchemaExportResult> {
    const startTime = Date.now()

    try {
      this.logger.info('Starting full database export', { options })

      // Get all tables
      const tablesResult = await this.tableRepository.findAll({ limit: 1000, offset: 0 })
      const exportedTables: ExportedTable[] = []

      // Export each table
      for (const table of tablesResult.data || []) {
        const exportedTable = await this.exportSingleTable(table.id, options)
        exportedTables.push(exportedTable)
      }

      // Get global types
      const globalRelationTypes = await this.exportGlobalRelationTypes()
      const globalAttributeTypes = await this.exportGlobalAttributeTypes()

      // Calculate total statistics
      const totalNodes = exportedTables.reduce((sum, t) => sum + t.statistics.nodeCount, 0)
      const totalRelations = exportedTables.reduce((sum, t) => sum + t.statistics.relationCount, 0)
      const totalAttributes = exportedTables.reduce(
        (sum, t) => sum + t.statistics.attributeCount,
        0
      )

      const statistics = {
        totalTables: exportedTables.length,
        totalNodes,
        totalRelations,
        totalAttributes,
        exportSize: this.calculateSize(exportedTables),
      }

      const result: SchemaExportResult = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Bun Graph DB',
          options,
          checksum: this.calculateChecksum(exportedTables),
        },
        tables: exportedTables,
        globalRelationTypes,
        globalAttributeTypes,
        statistics,
      }

      const executionTime = Date.now() - startTime
      this.logger.info('Full database export completed', {
        tablesCount: exportedTables.length,
        statistics,
        executionTime,
      })

      return result
    } catch (error) {
      this.logger.error('Failed to export database', { options, error })
      throw error
    }
  }

  private async exportSingleTable(
    tableId: string,
    options: SchemaExportOptions
  ): Promise<ExportedTable> {
    // Get table
    const table = await this.tableRepository.findById(tableId as TableId)
    if (!table) {
      throw new Error(`Table with id '${tableId}' not found`)
    }

    // Get attributes
    const attributesResult = await this.attributeRepository.findByTableId(tableId as TableId, {
      limit: 1000,
      offset: 0,
    })
    const exportedAttributes: ExportedAttribute[] = []

    for (const attribute of attributesResult.data || []) {
      const attributeType = await this.attributeTypeRepository.findById(
        attribute.getAttributeTypeId()
      )
      if (attributeType) {
        exportedAttributes.push({
          id: attribute.getId(),
          identifier: attribute.getIdentifier(),
          name: attribute.getIdentifier(), // Use identifier as name
          description: attribute.getDescription() || undefined,
          attributeType: {
            id: attributeType.getId(),
            identifier: attributeType.getIdentifier(),
            name: attributeType.getIdentifier(), // Use identifier as name
            dataType: 'string', // Default data type
            allowedValues: undefined, // Not available in AttributeType
            constraints: undefined, // Not available in AttributeType
          },
          isRequired: attribute.getIsRequired(),
          defaultValue: undefined, // Not available in Attribute
          createdAt: attribute.getCreatedAt().toISOString(),
          updatedAt: attribute.getUpdatedAt().toISOString(),
        })
      }
    }

    // Get nodes (conditionally)
    const exportedNodes: ExportedNode[] = []
    if (options.includeData !== false) {
      const nodesResult = await this.nodeRepository.findByTableId(tableId as TableId, {
        limit: 10000,
        offset: 0,
      })

      for (const node of nodesResult.data || []) {
        exportedNodes.push({
          id: node.getId(),
          content: node.getContent(),
          title: node.getTitle() || undefined,
          description: node.getDescription() || undefined,
          attributes: {},
          createdAt: node.getCreatedAt().toISOString(),
          updatedAt: node.getUpdatedAt().toISOString(),
        })
      }
    }

    // Get relations (conditionally)
    const exportedRelations: ExportedRelation[] = []
    if (options.includeRelations !== false && options.includeData !== false) {
      const relationsResult = await this.relationRepository.findByTableId(tableId as TableId, {
        limit: 10000,
        offset: 0,
      })

      for (const relation of relationsResult.data || []) {
        const relationType = await this.relationTypeRepository.findById(
          relation.getRelationTypeId()
        )
        if (relationType) {
          exportedRelations.push({
            id: relation.getId(),
            sourceNodeId: relation.getSourceNodeId() || '',
            targetNodeId: relation.getTargetNodeId() || '',
            relationType: {
              id: relationType.getId(),
              identifier: relationType.getIdentifier(),
              name: relationType.getIdentifier(),
              description: relationType.getDescription() || undefined,
            },
            properties: relation.getProperties(),
            strength: relation.getStrength(),
            createdAt: relation.getCreatedAt().toISOString(),
            updatedAt: relation.getUpdatedAt().toISOString(),
          })
        }
      }
    }

    return {
      id: table.id,
      identifier: table.identifier || 'unknown',
      description: table.description || undefined,
      metadata: undefined,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
      attributes: exportedAttributes,
      nodes: exportedNodes,
      relations: exportedRelations,
      statistics: {
        nodeCount: exportedNodes.length,
        attributeCount: exportedAttributes.length,
        relationCount: exportedRelations.length,
      },
    }
  }

  private async exportGlobalRelationTypes(): Promise<any[]> {
    const relationTypesResult = await this.relationTypeRepository.findAll({
      limit: 1000,
      offset: 0,
    })

    return (
      relationTypesResult.data?.map((rt) => ({
        id: rt.getId(),
        identifier: rt.getIdentifier() || 'unknown',
        name: rt.getIdentifier() || 'Unknown Relation Type', // Use identifier as name
        description: rt.getDescription() || undefined,
        metadata: null, // Set to null for now
        createdAt: rt.getCreatedAt().toISOString(),
        updatedAt: rt.getUpdatedAt().toISOString(),
      })) || []
    )
  }

  private async exportGlobalAttributeTypes(): Promise<any[]> {
    const attributeTypesResult = await this.attributeTypeRepository.findAll({
      limit: 1000,
      offset: 0,
    })

    return (
      attributeTypesResult.data?.map((at) => ({
        id: at.getId(),
        identifier: at.getIdentifier() || 'unknown',
        name: at.getIdentifier() || 'Unknown Attribute Type', // Use identifier as name
        description: at.getDescription() || undefined,
        dataType: 'STRING', // Default data type
        allowedValues: undefined, // Not available
        constraints: undefined, // Not available
        createdAt: at.getCreatedAt().toISOString(),
        updatedAt: at.getUpdatedAt().toISOString(),
      })) || []
    )
  }

  private calculateSize(tables: ExportedTable[]): string {
    const jsonString = JSON.stringify(tables)
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8')

    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`
    } else {
      return `${(sizeInBytes / 1024 / 1024).toFixed(1)} MB`
    }
  }

  private calculateChecksum(tables: ExportedTable[]): string {
    const jsonString = JSON.stringify(tables, null, 0)

    // Simple hash function for checksum
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16)
  }
}
