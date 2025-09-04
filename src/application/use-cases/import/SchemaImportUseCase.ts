import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportResult, ExportedTable, ExportedAttribute, ExportedNode, ExportedRelation } from '../export/SchemaExportUseCase.js'
import { Table } from '@/domain/entities/Table.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationType } from '@/domain/entities/RelationType.js'

export interface SchemaImportOptions {
  overwriteExisting?: boolean
  skipDuplicates?: boolean
  validateData?: boolean
  dryRun?: boolean
  conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'fail'
}

export interface ImportResult {
  success: boolean
  statistics: {
    tablesImported: number
    nodesImported: number
    relationsImported: number
    attributesImported: number
    attributeTypesImported: number
    relationTypesImported: number
    skipped: number
    errors: number
  }
  errors: Array<{
    type: string
    message: string
    item?: any
  }>
  warnings: Array<{
    type: string
    message: string
    item?: any
  }>
  executionTime: number
  importedAt: string
}

export class SchemaImportUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly logger: ILogger
  ) {}

  async importSchema(exportData: SchemaExportResult, options: SchemaImportOptions = {}): Promise<ImportResult> {
    const startTime = Date.now()
    
    const result: ImportResult = {
      success: false,
      statistics: {
        tablesImported: 0,
        nodesImported: 0,
        relationsImported: 0,
        attributesImported: 0,
        attributeTypesImported: 0,
        relationTypesImported: 0,
        skipped: 0,
        errors: 0
      },
      errors: [],
      warnings: [],
      executionTime: 0,
      importedAt: new Date().toISOString()
    }

    try {
      this.logger.info('Starting schema import', { 
        tablesCount: exportData.tables.length,
        options 
      })

      // Validate export data
      if (options.validateData) {
        await this.validateExportData(exportData, result)
      }

      if (options.dryRun) {
        this.logger.info('Dry run mode - no actual import performed')
        result.success = true
        result.executionTime = Date.now() - startTime
        return result
      }

      // Import global attribute types first
      await this.importAttributeTypes(exportData.globalAttributeTypes, options, result)

      // Import global relation types
      await this.importRelationTypes(exportData.globalRelationTypes, options, result)

      // Import tables with their data
      for (const tableData of exportData.tables) {
        await this.importTable(tableData, options, result)
      }

      result.success = result.errors.length === 0
      result.executionTime = Date.now() - startTime

      this.logger.info('Schema import completed', { 
        success: result.success,
        statistics: result.statistics,
        executionTime: result.executionTime 
      })

      return result

    } catch (error) {
      result.errors.push({
        type: 'SYSTEM_ERROR',
        message: `Import failed: ${error}`
      })
      result.statistics.errors++
      result.executionTime = Date.now() - startTime
      
      this.logger.error('Schema import failed', { error, result })
      throw error
    }
  }

  private async validateExportData(exportData: SchemaExportResult, result: ImportResult): Promise<void> {
    // Validate metadata
    if (!exportData.metadata || !exportData.metadata.exportedAt) {
      result.warnings.push({
        type: 'VALIDATION_WARNING',
        message: 'Export metadata is missing or incomplete'
      })
    }

    // Validate tables structure
    for (const table of exportData.tables) {
      if (!table.identifier || !table.id) {
        result.errors.push({
          type: 'VALIDATION_ERROR',
          message: 'Table missing required fields',
          item: table
        })
        result.statistics.errors++
      }

      // Validate nodes reference valid tables
      for (const node of table.nodes) {
        if (!node.id || !node.content) {
          result.errors.push({
            type: 'VALIDATION_ERROR',
            message: 'Node missing required fields',
            item: node
          })
          result.statistics.errors++
        }
      }

      // Validate relations reference valid nodes
      for (const relation of table.relations) {
        const sourceExists = table.nodes.some(n => n.id === relation.sourceNodeId)
        const targetExists = table.nodes.some(n => n.id === relation.targetNodeId)
        
        if (!sourceExists || !targetExists) {
          result.errors.push({
            type: 'VALIDATION_ERROR',
            message: 'Relation references non-existent nodes',
            item: relation
          })
          result.statistics.errors++
        }
      }
    }
  }

  private async importAttributeTypes(attributeTypes: any[], options: SchemaImportOptions, result: ImportResult): Promise<void> {
    for (const atData of attributeTypes) {
      try {
        // Check if attribute type already exists
        const existing = await this.attributeTypeRepository.findByIdentifier(atData.identifier)
        
        if (existing) {
          if (options.conflictResolution === 'skip' || options.skipDuplicates) {
            result.statistics.skipped++
            continue
          } else if (options.conflictResolution === 'fail') {
            result.errors.push({
              type: 'CONFLICT_ERROR',
              message: `Attribute type '${atData.identifier}' already exists`,
              item: atData
            })
            result.statistics.errors++
            continue
          }
          // For 'overwrite' or 'merge', we'll update the existing one
        }

        const attributeType = AttributeType.create(
          atData.identifier,
          atData.name,
          atData.dataType,
          atData.description,
          atData.allowedValues,
          atData.constraints
        )

        await this.attributeTypeRepository.save(attributeType)
        result.statistics.attributeTypesImported++

        this.logger.debug('Imported attribute type', { identifier: atData.identifier })

      } catch (error) {
        result.errors.push({
          type: 'IMPORT_ERROR',
          message: `Failed to import attribute type '${atData.identifier}': ${error}`,
          item: atData
        })
        result.statistics.errors++
      }
    }
  }

  private async importRelationTypes(relationTypes: any[], options: SchemaImportOptions, result: ImportResult): Promise<void> {
    for (const rtData of relationTypes) {
      try {
        // Check if relation type already exists
        const existing = await this.relationTypeRepository.findByIdentifier(rtData.identifier)
        
        if (existing) {
          if (options.conflictResolution === 'skip' || options.skipDuplicates) {
            result.statistics.skipped++
            continue
          } else if (options.conflictResolution === 'fail') {
            result.errors.push({
              type: 'CONFLICT_ERROR',
              message: `Relation type '${rtData.identifier}' already exists`,
              item: rtData
            })
            result.statistics.errors++
            continue
          }
        }

        const relationType = RelationType.create(
          rtData.identifier,
          rtData.name,
          rtData.description,
          rtData.metadata
        )

        await this.relationTypeRepository.save(relationType)
        result.statistics.relationTypesImported++

        this.logger.debug('Imported relation type', { identifier: rtData.identifier })

      } catch (error) {
        result.errors.push({
          type: 'IMPORT_ERROR',
          message: `Failed to import relation type '${rtData.identifier}': ${error}`,
          item: rtData
        })
        result.statistics.errors++
      }
    }
  }

  private async importTable(tableData: ExportedTable, options: SchemaImportOptions, result: ImportResult): Promise<void> {
    try {
      this.logger.info('Importing table', { identifier: tableData.identifier })

      // Check if table already exists
      const existingTable = await this.tableRepository.findByIdentifier(tableData.identifier)
      
      if (existingTable) {
        if (options.conflictResolution === 'skip' || options.skipDuplicates) {
          result.statistics.skipped++
          return
        } else if (options.conflictResolution === 'fail') {
          result.errors.push({
            type: 'CONFLICT_ERROR',
            message: `Table '${tableData.identifier}' already exists`,
            item: tableData
          })
          result.statistics.errors++
          return
        }
      }

      // Create or update table
      let table: Table
      if (existingTable && (options.conflictResolution === 'overwrite' || options.conflictResolution === 'merge')) {
        table = existingTable
        // Update table properties if needed
      } else {
        table = Table.create(
          tableData.identifier,
          tableData.description,
          tableData.metadata
        )
        await this.tableRepository.save(table)
      }
      
      result.statistics.tablesImported++

      // Import attributes for this table
      await this.importTableAttributes(table.id, tableData.attributes, options, result)

      // Import nodes for this table
      const nodeIdMapping = await this.importTableNodes(table.id, tableData.nodes, options, result)

      // Import relations for this table
      await this.importTableRelations(table.id, tableData.relations, nodeIdMapping, options, result)

      this.logger.info('Table import completed', { 
        identifier: tableData.identifier,
        nodes: tableData.nodes.length,
        relations: tableData.relations.length 
      })

    } catch (error) {
      result.errors.push({
        type: 'TABLE_IMPORT_ERROR',
        message: `Failed to import table '${tableData.identifier}': ${error}`,
        item: tableData
      })
      result.statistics.errors++
    }
  }

  private async importTableAttributes(tableId: string, attributes: ExportedAttribute[], options: SchemaImportOptions, result: ImportResult): Promise<void> {
    for (const attrData of attributes) {
      try {
        // Find the attribute type
        const attributeType = await this.attributeTypeRepository.findByIdentifier(attrData.attributeType.identifier)
        if (!attributeType) {
          result.warnings.push({
            type: 'MISSING_REFERENCE',
            message: `Attribute type '${attrData.attributeType.identifier}' not found, creating it`,
            item: attrData
          })
          
          // Create the missing attribute type
          const newAttributeType = AttributeType.create(
            attrData.attributeType.identifier,
            attrData.attributeType.name,
            attrData.attributeType.dataType,
            attrData.attributeType.description,
            attrData.attributeType.allowedValues,
            attrData.attributeType.constraints
          )
          await this.attributeTypeRepository.save(newAttributeType)
        }

        // Check if attribute already exists
        const existing = await this.attributeRepository.findByTableIdAndIdentifier(tableId, attrData.identifier)
        
        if (existing && options.skipDuplicates) {
          result.statistics.skipped++
          continue
        }

        const attribute = Attribute.create(
          tableId,
          attributeType?.id || attrData.attributeType.id,
          attrData.identifier,
          attrData.name,
          attrData.description,
          attrData.isRequired,
          attrData.defaultValue
        )

        await this.attributeRepository.save(attribute)
        result.statistics.attributesImported++

      } catch (error) {
        result.errors.push({
          type: 'ATTRIBUTE_IMPORT_ERROR',
          message: `Failed to import attribute '${attrData.identifier}': ${error}`,
          item: attrData
        })
        result.statistics.errors++
      }
    }
  }

  private async importTableNodes(tableId: string, nodes: ExportedNode[], options: SchemaImportOptions, result: ImportResult): Promise<Map<string, string>> {
    const nodeIdMapping = new Map<string, string>() // old ID -> new ID

    for (const nodeData of nodes) {
      try {
        // Check for existing node with same content
        const existing = await this.nodeRepository.findByTableIdAndContent(tableId, nodeData.content)
        
        if (existing && options.skipDuplicates) {
          nodeIdMapping.set(nodeData.id, existing.id)
          result.statistics.skipped++
          continue
        }

        const node = Node.create(
          tableId,
          nodeData.content,
          nodeData.title,
          nodeData.description,
          nodeData.attributes
        )

        await this.nodeRepository.save(node)
        
        // Map old ID to new ID for relation mapping
        nodeIdMapping.set(nodeData.id, node.id)
        result.statistics.nodesImported++

      } catch (error) {
        result.errors.push({
          type: 'NODE_IMPORT_ERROR',
          message: `Failed to import node '${nodeData.content}': ${error}`,
          item: nodeData
        })
        result.statistics.errors++
      }
    }

    return nodeIdMapping
  }

  private async importTableRelations(
    tableId: string, 
    relations: ExportedRelation[], 
    nodeIdMapping: Map<string, string>,
    options: SchemaImportOptions, 
    result: ImportResult
  ): Promise<void> {
    for (const relationData of relations) {
      try {
        // Map old node IDs to new node IDs
        const sourceNodeId = nodeIdMapping.get(relationData.sourceNodeId)
        const targetNodeId = nodeIdMapping.get(relationData.targetNodeId)

        if (!sourceNodeId || !targetNodeId) {
          result.errors.push({
            type: 'RELATION_MAPPING_ERROR',
            message: 'Cannot map relation node IDs',
            item: relationData
          })
          result.statistics.errors++
          continue
        }

        // Find the relation type
        const relationType = await this.relationTypeRepository.findByIdentifier(relationData.relationType.identifier)
        if (!relationType) {
          result.warnings.push({
            type: 'MISSING_REFERENCE',
            message: `Relation type '${relationData.relationType.identifier}' not found, creating it`,
            item: relationData
          })

          // Create the missing relation type
          const newRelationType = RelationType.create(
            relationData.relationType.identifier,
            relationData.relationType.name,
            relationData.relationType.description
          )
          await this.relationTypeRepository.save(newRelationType)
        }

        const relation = NodeRelation.create(
          tableId,
          sourceNodeId,
          targetNodeId,
          relationType?.id || relationData.relationType.id,
          relationData.properties,
          relationData.strength
        )

        await this.relationRepository.save(relation)
        result.statistics.relationsImported++

      } catch (error) {
        result.errors.push({
          type: 'RELATION_IMPORT_ERROR',
          message: `Failed to import relation: ${error}`,
          item: relationData
        })
        result.statistics.errors++
      }
    }
  }
}