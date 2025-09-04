import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/TableTypes.js'

export interface DeleteTableInput {
  id: TableId
  force?: boolean
  cascadeDelete?: boolean
}

export interface TableDependencyInfo {
  nodeCount: number
  attributeCount: number
  relationCount: number
  hasData: boolean
}

export class DeleteTableUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly logger: ILogger
  ) {}

  async checkTableDependencies(tableId: TableId): Promise<TableDependencyInfo> {
    this.logger.info('Checking table dependencies', { tableId })

    const [nodeCount, attributeCount, relationCount] = await Promise.all([
      this.nodeRepository.countByTableId(tableId),
      this.attributeRepository.countByTableId(tableId),
      this.relationRepository.count(tableId)
    ])

    const hasData = nodeCount > 0 || attributeCount > 0 || relationCount > 0

    this.logger.info('Table dependency check complete', {
      tableId,
      nodeCount,
      attributeCount,
      relationCount,
      hasData
    })

    return {
      nodeCount,
      attributeCount,
      relationCount,
      hasData
    }
  }

  async execute(input: DeleteTableInput): Promise<TableDependencyInfo> {
    const { id, force = false, cascadeDelete = false } = input

    this.logger.info('Starting table deletion process', {
      tableId: id,
      force,
      cascadeDelete
    })

    // Check if table exists
    const table = await this.tableRepository.findById(id)
    if (!table) {
      throw new Error(`Table with ID ${id} not found`)
    }

    // Check dependencies
    const dependencies = await this.checkTableDependencies(id)

    // If table has data and force is not set, throw error with dependency info
    if (dependencies.hasData && !force) {
      this.logger.warn('Table deletion blocked due to existing data', {
        tableId: id,
        dependencies
      })
      
      const errorMessage = `Cannot delete table '${table.identifier}'. ` +
        `Found ${dependencies.nodeCount} nodes, ${dependencies.attributeCount} attributes, ` +
        `and ${dependencies.relationCount} relations. ` +
        `Use 'force: true' to override or 'cascadeDelete: true' to delete all related data.`
      
      throw new Error(errorMessage)
    }

    // If cascadeDelete is true, delete all related data first
    if (cascadeDelete && dependencies.hasData) {
      this.logger.info('Starting cascade deletion of related data', {
        tableId: id,
        dependencies
      })

      // Note: This would need to be implemented with proper transaction handling
      // For now, we'll just log what would be deleted
      this.logger.warn('Cascade deletion not fully implemented - would delete related data', {
        tableId: id,
        nodeCount: dependencies.nodeCount,
        attributeCount: dependencies.attributeCount,
        relationCount: dependencies.relationCount
      })

      // TODO: Implement actual cascade deletion with proper transaction handling
      // await this.deleteCascadeData(id, dependencies)
    }

    // Perform the actual table deletion
    await this.tableRepository.delete(id)

    this.logger.info('Table deletion completed successfully', {
      tableId: id,
      tableName: table.identifier,
      hadDependencies: dependencies.hasData
    })

    return dependencies
  }

  // TODO: Implement this method for actual cascade deletion
  // private async deleteCascadeData(tableId: TableId, dependencies: TableDependencyInfo): Promise<void> {
  //   // Delete in proper order to maintain referential integrity:
  //   // 1. Relations (referencing nodes)
  //   // 2. Node attributes (referencing nodes and attributes)  
  //   // 3. Nodes (referencing table)
  //   // 4. Attributes (referencing table)
  // }
}