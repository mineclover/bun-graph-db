import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'

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

  async exportTable(tableId: string, options: SchemaExportOptions = {}): Promise<SchemaExportResult> {
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
        exportSize: this.calculateSize([exportedTable])
      }

      const result: SchemaExportResult = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Bun Graph DB',
          options
        },
        tables: [exportedTable],
        globalRelationTypes,
        globalAttributeTypes,
        statistics
      }

      const executionTime = Date.now() - startTime
      this.logger.info('Table export completed', { 
        tableId, 
        statistics, 
        executionTime 
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
      for (const table of tablesResult.data) {
        const exportedTable = await this.exportSingleTable(table.id, options)
        exportedTables.push(exportedTable)
      }

      // Get global types
      const globalRelationTypes = await this.exportGlobalRelationTypes()
      const globalAttributeTypes = await this.exportGlobalAttributeTypes()

      // Calculate total statistics
      const totalNodes = exportedTables.reduce((sum, t) => sum + t.statistics.nodeCount, 0)
      const totalRelations = exportedTables.reduce((sum, t) => sum + t.statistics.relationCount, 0)
      const totalAttributes = exportedTables.reduce((sum, t) => sum + t.statistics.attributeCount, 0)

      const statistics = {
        totalTables: exportedTables.length,
        totalNodes,
        totalRelations,
        totalAttributes,
        exportSize: this.calculateSize(exportedTables)
      }

      const result: SchemaExportResult = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          source: 'Bun Graph DB',
          options,
          checksum: this.calculateChecksum(exportedTables)
        },
        tables: exportedTables,
        globalRelationTypes,
        globalAttributeTypes,
        statistics
      }

      const executionTime = Date.now() - startTime
      this.logger.info('Full database export completed', { 
        tablesCount: exportedTables.length,
        statistics, 
        executionTime 
      })

      return result

    } catch (error) {
      this.logger.error('Failed to export database', { options, error })
      throw error
    }
  }

  private async exportSingleTable(tableId: string, options: SchemaExportOptions): Promise<ExportedTable> {
    // Get table
    const table = await this.tableRepository.findById(tableId as TableId)
    if (!table) {
      throw new Error(`Table with id '${tableId}' not found`)
    }

    // Get attributes
    const attributesResult = await this.attributeRepository.findByTableId(tableId as TableId, { limit: 1000, offset: 0 })
    const exportedAttributes: ExportedAttribute[] = []

    for (const attribute of attributesResult.data) {
      const attributeType = await this.attributeTypeRepository.findById(attribute.attributeTypeId)
      if (attributeType) {
        exportedAttributes.push({
          id: attribute.id,
          identifier: attribute.identifier,
          name: attribute.name,
          description: attribute.description,
          attributeType: {
            id: attributeType.id,
            identifier: attributeType.identifier,
            name: attributeType.name,
            dataType: attributeType.dataType,
            allowedValues: attributeType.allowedValues,
            constraints: attributeType.constraints
          },
          isRequired: attribute.isRequired,
          defaultValue: attribute.defaultValue,
          createdAt: attribute.createdAt.toISOString(),
          updatedAt: attribute.updatedAt.toISOString()
        })
      }
    }

    // Get nodes (conditionally)
    const exportedNodes: ExportedNode[] = []
    if (options.includeData !== false) {
      const nodesResult = await this.nodeRepository.findByTableId(tableId as TableId, { limit: 10000, offset: 0 })
      
      for (const node of nodesResult.data) {
        exportedNodes.push({
          id: node.id,
          content: node.content,
          title: node.title,
          description: node.description,
          attributes: node.attributes,
          createdAt: node.createdAt.toISOString(),
          updatedAt: node.updatedAt.toISOString()
        })
      }
    }

    // Get relations (conditionally)
    const exportedRelations: ExportedRelation[] = []
    if (options.includeRelations !== false && options.includeData !== false) {
      const relationsResult = await this.relationRepository.findByTableId(tableId as TableId, { limit: 10000, offset: 0 })
      
      for (const relation of relationsResult.data) {
        const relationType = await this.relationTypeRepository.findById(relation.relationTypeId)
        if (relationType) {
          exportedRelations.push({
            id: relation.id,
            sourceNodeId: relation.sourceNodeId,
            targetNodeId: relation.targetNodeId,
            relationType: {
              id: relationType.id,
              identifier: relationType.identifier,
              name: relationType.name,
              description: relationType.description
            },
            properties: relation.properties,
            strength: relation.strength,
            createdAt: relation.createdAt.toISOString(),
            updatedAt: relation.updatedAt.toISOString()
          })
        }
      }
    }

    const tableData = table.toDatabase()
    
    return {
      id: table.id,
      identifier: table.identifier || 'unknown',
      description: table.description || null,
      metadata: tableData.metadata || null,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
      attributes: exportedAttributes,
      nodes: exportedNodes,
      relations: exportedRelations,
      statistics: {
        nodeCount: exportedNodes.length,
        attributeCount: exportedAttributes.length,
        relationCount: exportedRelations.length
      }
    }
  }

  private async exportGlobalRelationTypes(): Promise<any[]> {
    const relationTypesResult = await this.relationTypeRepository.findAll({ limit: 1000, offset: 0 })
    
    return relationTypesResult.data.map(rt => ({
      id: rt.id,
      identifier: rt.identifier || 'unknown',
      name: rt.name || 'Unknown Relation Type',
      description: rt.description || null,
      metadata: rt.metadata || null,
      createdAt: rt.createdAt.toISOString(),
      updatedAt: rt.updatedAt.toISOString()
    }))
  }

  private async exportGlobalAttributeTypes(): Promise<any[]> {
    const attributeTypesResult = await this.attributeTypeRepository.findAll({ limit: 1000, offset: 0 })
    
    return attributeTypesResult.data.map(at => ({
      id: at.id,
      identifier: at.identifier || 'unknown',
      name: at.name || 'Unknown Attribute Type',
      description: at.description || null,
      dataType: at.dataType || 'STRING',
      allowedValues: at.allowedValues || null,
      constraints: at.constraints || null,
      createdAt: at.createdAt.toISOString(),
      updatedAt: at.updatedAt.toISOString()
    }))
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
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16)
  }
}