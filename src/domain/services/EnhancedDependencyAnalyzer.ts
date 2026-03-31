import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableDependencyInfo } from '@/core/types/TablePackage.js'
import { extractFieldNames, validateQuerySyntax } from '@/core/utils/GraphQLParser.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import type { IAttributeRepository } from '../repositories/IAttributeRepository.js'
import type { INodeRelationRepository } from '../repositories/INodeRelationRepository.js'
import type { INodeRepository } from '../repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '../repositories/ITableRepository.js'

/**
 * Enhanced dependency analyzer for table packages
 *
 * Implements comprehensive dependency analysis including:
 * - Foreign key relationships in attributes
 * - Node relations that reference other tables
 * - Template dependencies on other tables
 * - Circular dependency detection with path tracking
 * - Multi-level dependency depth calculation
 */
export class EnhancedDependencyAnalyzer {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Analyze comprehensive dependencies for a table
   */
  async analyzeDependencies(tableIdentifier: string): Promise<TableDependencyInfo> {
    this.logger.info('Analyzing comprehensive dependencies', { tableIdentifier })

    try {
      // Find the table
      const table = await this.tableRepository.findByIdentifier(tableIdentifier)
      if (!table) {
        return {
          tableIdentifier,
          dependencies: [],
          dependents: [],
          depth: 0,
          circularReferences: [],
        }
      }

      const dependencies: string[] = []
      const dependents: string[] = []
      const circularReferences: string[] = []

      // 1. Analyze foreign key relationships in attributes
      const fkDependencies = await this.analyzeForeignKeyDependencies(table.id as string)
      dependencies.push(...fkDependencies)

      // 2. Analyze node relations that reference other tables
      const relationDependencies = await this.analyzeRelationDependencies(table.id as string)
      dependencies.push(...relationDependencies)

      // 3. Analyze template dependencies
      const templateDependencies = await this.analyzeTemplateDependencies(tableIdentifier)
      dependencies.push(...templateDependencies)

      // 4. Find tables that depend on this table
      const allTables = await this.tableRepository.findAll()
      for (const otherTable of allTables.items || []) {
        if (otherTable.identifier !== tableIdentifier) {
          const otherDeps = await this.getDirectDependencies(otherTable.identifier)
          if (otherDeps.includes(tableIdentifier)) {
            dependents.push(otherTable.identifier)
          }
        }
      }

      // Remove duplicates
      const uniqueDependencies = [...new Set(dependencies)]
      const uniqueDependents = [...new Set(dependents)]

      // 5. Detect circular dependencies
      const circularPaths = await this.detectCircularDependencies(tableIdentifier, uniqueDependencies)
      circularReferences.push(...circularPaths)

      // 6. Calculate dependency depth
      const depth = await this.calculateDependencyDepth(tableIdentifier, uniqueDependencies)

      this.logger.info('Dependency analysis completed', {
        tableIdentifier,
        dependenciesCount: uniqueDependencies.length,
        dependentsCount: uniqueDependents.length,
        circularReferencesCount: circularReferences.length,
        depth,
      })

      return {
        tableIdentifier,
        dependencies: uniqueDependencies,
        dependents: uniqueDependents,
        depth,
        circularReferences,
      }
    } catch (error) {
      this.logger.error('Dependency analysis failed', { tableIdentifier, ...toErrorMeta(error) })
      throw error
    }
  }

  /**
   * Resolve optimal import order with enhanced topological sorting
   */
  async resolveImportOrder(tableIdentifiers: string[]): Promise<string[]> {
    this.logger.info('Resolving import order with enhanced algorithm', {
      tableCount: tableIdentifiers.length,
    })

    // Build dependency graph
    const dependencies = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    // Initialize
    for (const identifier of tableIdentifiers) {
      dependencies.set(identifier, [])
      inDegree.set(identifier, 0)
    }

    // Populate dependencies
    for (const identifier of tableIdentifiers) {
      const deps = await this.getDirectDependencies(identifier)
      const filteredDeps = deps.filter((d) => tableIdentifiers.includes(d))
      dependencies.set(identifier, filteredDeps)

      // Update in-degree
      for (const dep of filteredDeps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
      }
    }

    // Kahn's algorithm for topological sorting
    const queue: string[] = []
    const result: string[] = []

    // Find nodes with no incoming edges
    for (const [identifier, degree] of inDegree) {
      if (degree === 0) {
        queue.push(identifier)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }
      result.push(current)

      // Update neighbors
      const currentDeps = dependencies.get(current) || []
      for (const dep of currentDeps) {
        const newDegree = (inDegree.get(dep) || 0) - 1
        inDegree.set(dep, newDegree)

        if (newDegree === 0) {
          queue.push(dep)
        }
      }
    }

    // Handle circular dependencies
    if (result.length < tableIdentifiers.length) {
      const remaining = tableIdentifiers.filter((id) => !result.includes(id))
      this.logger.warn('Circular dependencies detected, adding remaining tables at end', {
        remaining,
      })
      result.push(...remaining)
    }

    this.logger.info('Import order resolved', {
      originalOrder: tableIdentifiers,
      resolvedOrder: result,
    })

    return result
  }

  /**
   * Analyze foreign key dependencies in table attributes
   */
  private async analyzeForeignKeyDependencies(tableId: string): Promise<string[]> {
    const dependencies: string[] = []

    try {
      // Get all attributes for this table
      const attributesResult = await this.attributeRepository.findByTableId(tableId)
      const attributes = attributesResult.items || attributesResult.data || []

      // For each attribute, check if it references another table
      // This would need to be enhanced based on the actual attribute type system
      // For now, we'll check for common foreign key patterns
      for (const attribute of attributes) {
        const attributeId = attribute.getIdentifier()

        // Check for common foreign key naming patterns
        if (attributeId.endsWith('_id') || attributeId.endsWith('Id')) {
          const potentialTableName = attributeId
            .replace(/_id$/, '')
            .replace(/Id$/, '')
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '')

          // Verify if this table exists
          const referencedTable = await this.tableRepository.findByIdentifier(potentialTableName)
          if (referencedTable) {
            dependencies.push(potentialTableName)
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to analyze foreign key dependencies', {
        tableId,
        ...toErrorMeta(error),
      })
    }

    return dependencies
  }

  /**
   * Analyze relation dependencies between tables
   */
  private async analyzeRelationDependencies(tableId: string): Promise<string[]> {
    const dependencies: string[] = []

    try {
      // Get all nodes for this table
      const nodesResult = await this.nodeRepository.findByTableId(tableId)
      const nodes = nodesResult.items || nodesResult.data || []

      // For each node, check its relations to nodes in other tables
      for (const node of nodes) {
        const outgoingRelations = await this.nodeRelationRepository.findBySourceNodeId(node.getId())

        for (const relation of outgoingRelations) {
          // Find the target node's table
          const targetNodeId = relation.getTargetNodeId()
          if (!targetNodeId) {
            continue
          }
          const targetNode = await this.nodeRepository.findById(targetNodeId)

          if (targetNode) {
            const targetTableId = targetNode.getTableId()
            if (targetTableId) {
              const targetTable = await this.tableRepository.findById(targetTableId)

              if (targetTable && targetTable.identifier !== tableId) {
                dependencies.push(targetTable.identifier)
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to analyze relation dependencies', {
        tableId,
        ...toErrorMeta(error),
      })
    }

    return dependencies
  }

  /**
   * Analyze template dependencies using enhanced GraphQL parsing
   */
  private async analyzeTemplateDependencies(tableIdentifier: string): Promise<string[]> {
    const dependencies: string[] = []

    try {
      // Find templates that reference this table
      const templates = await this.queryTemplateRepository.findByApplicableTable(tableIdentifier, true)

      for (const template of templates) {
        const queryText = template.getQueryText()
        const referencedTables = await this.extractTableReferencesFromGraphQL(queryText)
        dependencies.push(...referencedTables.filter((t) => t !== tableIdentifier))
      }
    } catch (error) {
      this.logger.warn('Failed to analyze template dependencies', {
        tableIdentifier,
        ...toErrorMeta(error),
      })
    }

    return dependencies
  }

  /**
   * Enhanced GraphQL query parsing for table references
   */
  private async extractTableReferencesFromGraphQL(queryText: string): Promise<string[]> {
    const references: string[] = []

    try {
      // Use GraphQLParser to parse the query
      const parseResult = validateQuerySyntax(queryText)

      if (parseResult.isValid) {
        // Extract field names from the query
        const fieldNames = extractFieldNames(queryText)

        // Convert field names to potential table names
        for (const fieldName of fieldNames) {
          const potentialTableName = fieldName
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '')
            .replace(/s$/, '') // Remove plural suffix

          references.push(potentialTableName)
        }
      }
    } catch (_error) {
      // Fallback to regex-based extraction
      const regexReferences = this.extractTableReferencesWithRegex(queryText)
      references.push(...regexReferences)
    }

    return [...new Set(references)]
  }

  /**
   * Regex-based table reference extraction (fallback)
   */
  private extractTableReferencesWithRegex(queryText: string): string[] {
    const references: string[] = []

    // Look for common GraphQL patterns that might reference tables
    const patterns = [
      /\b([a-z][a-zA-Z0-9]*)\s*\(/g, // Function calls that might be table operations
      /\btable:\s*"([^"]+)"/g, // Explicit table references
      /\bfrom\s+([a-zA-Z0-9_-]+)/gi, // SQL-like from clauses
      /\bjoin\s+([a-zA-Z0-9_-]+)/gi, // SQL-like join clauses
    ]

    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      match = pattern.exec(queryText)
      while (match !== null) {
        if (match[1]) {
          // Convert to kebab-case
          const tableName = match[1]
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '')
          references.push(tableName)
        }
        match = pattern.exec(queryText)
      }
    }

    return references
  }

  /**
   * Get direct dependencies for a table (used for dependent detection)
   */
  private async getDirectDependencies(tableIdentifier: string): Promise<string[]> {
    try {
      const table = await this.tableRepository.findByIdentifier(tableIdentifier)
      if (!table) return []

      const dependencies: string[] = []

      // Get FK dependencies
      const fkDeps = await this.analyzeForeignKeyDependencies(table.id as string)
      dependencies.push(...fkDeps)

      // Get relation dependencies
      const relDeps = await this.analyzeRelationDependencies(table.id as string)
      dependencies.push(...relDeps)

      // Get template dependencies
      const templateDeps = await this.analyzeTemplateDependencies(tableIdentifier)
      dependencies.push(...templateDeps)

      return [...new Set(dependencies)]
    } catch (error) {
      this.logger.warn('Failed to get direct dependencies', {
        tableIdentifier,
        ...toErrorMeta(error),
      })
      return []
    }
  }

  /**
   * Detect circular dependencies with path tracking
   */
  private async detectCircularDependencies(tableIdentifier: string, _dependencies: string[]): Promise<string[]> {
    const circularPaths: string[] = []
    const visited = new Set<string>()
    const path = new Set<string>()

    const dfs = async (current: string, currentPath: string[]): Promise<void> => {
      if (path.has(current)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(current)
        const cycle = currentPath.slice(cycleStart).concat([current])
        circularPaths.push(cycle.join(' → '))
        return
      }

      if (visited.has(current)) {
        return
      }

      visited.add(current)
      path.add(current)
      currentPath.push(current)

      const currentDeps = await this.getDirectDependencies(current)
      for (const dep of currentDeps) {
        await dfs(dep, [...currentPath])
      }

      path.delete(current)
      currentPath.pop()
    }

    await dfs(tableIdentifier, [])

    return circularPaths
  }

  /**
   * Calculate maximum dependency depth
   */
  private async calculateDependencyDepth(_tableIdentifier: string, dependencies: string[]): Promise<number> {
    if (dependencies.length === 0) return 0

    const visited = new Set<string>()
    let maxDepth = 0

    const dfs = async (current: string, depth: number): Promise<void> => {
      if (visited.has(current)) {
        return
      }

      visited.add(current)
      maxDepth = Math.max(maxDepth, depth)

      const currentDeps = await this.getDirectDependencies(current)
      for (const dep of currentDeps) {
        await dfs(dep, depth + 1)
      }
    }

    for (const dep of dependencies) {
      await dfs(dep, 1)
    }

    return maxDepth
  }
}
