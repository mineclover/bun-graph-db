import type { ITablePackageService } from './ITablePackageService.js'
import type { ITableRepository } from '../repositories/ITableRepository.js'
import type { IAttributeRepository } from '../repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '../repositories/IAttributeTypeRepository.js'
import type { INodeRepository } from '../repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '../repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '../repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '../repositories/IRelationTypeRepository.js'
import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { EnhancedDependencyAnalyzer } from './EnhancedDependencyAnalyzer.js'
import { EnhancedTemplateGenerator } from './EnhancedTemplateGenerator.js'
import { TablePackageValidator } from './TablePackageValidator.js'
import { TablePackageRecoveryManager } from './TablePackageRecoveryManager.js'
import { SchemaIntrospectionService } from './SchemaIntrospectionService.js'
import type {
  TablePackageFormat,
  TablePackageExportOptions,
  TablePackageImportOptions,
  TablePackageExportResult,
  TablePackageImportResult,
  TableDependencyInfo,
  ImportSession,
  TablePackageConflict,
  TableSchemaExport,
  TableDataExport,
  TableRelationsExport,
  TableTemplatesExport,
} from '@/core/types/TablePackage.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'
import { QueryTemplate } from '../entities/QueryTemplate.js'

export class TablePackageService implements ITablePackageService {
  private readonly importSessions = new Map<string, ImportSession>()
  private readonly enhancedDependencyAnalyzer: EnhancedDependencyAnalyzer
  private readonly enhancedTemplateGenerator: EnhancedTemplateGenerator
  private readonly schemaIntrospectionService: SchemaIntrospectionService
  private readonly tablePackageValidator: TablePackageValidator
  private readonly tablePackageRecoveryManager: TablePackageRecoveryManager

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger,
    private readonly container: DIContainer
  ) {
    // Initialize enhanced services
    this.enhancedDependencyAnalyzer = new EnhancedDependencyAnalyzer(
      this.tableRepository,
      this.attributeRepository,
      this.nodeRepository,
      this.nodeRelationRepository,
      this.queryTemplateRepository,
      this.logger
    )

    this.enhancedTemplateGenerator = new EnhancedTemplateGenerator(
      this.tableRepository,
      this.attributeRepository,
      this.attributeTypeRepository,
      this.queryTemplateRepository,
      this.logger
    )

    this.tablePackageValidator = new TablePackageValidator(
      this.tableRepository,
      this.attributeTypeRepository,
      this.queryTemplateRepository,
      this.logger
    )

    this.tablePackageRecoveryManager = new TablePackageRecoveryManager(
      this.tableRepository,
      this.nodeRepository,
      this.queryTemplateRepository,
      this.logger
    )

    this.schemaIntrospectionService = new SchemaIntrospectionService(
      this.container,
      this.logger
    )
  }

  async exportTable(
    tableIdentifier: string,
    options: TablePackageExportOptions = {}
  ): Promise<TablePackageExportResult> {
    try {
      this.logger.info('Starting table export', { tableIdentifier, options })

      // Find the table
      const table = await this.tableRepository.findByIdentifier(tableIdentifier)
      if (!table) {
        return {
          success: false,
          errors: [`Table '${tableIdentifier}' not found`],
          warnings: [],
        }
      }

      // Analyze dependencies if requested
      const dependencies: string[] = []
      if (options.resolveDependencies) {
        const depInfo = await this.analyzeDependencies(tableIdentifier)
        dependencies.push(...depInfo.dependencies)
      }

      // Export schema
      const schema = await this.exportTableSchema(table.id)

      // Export data if requested
      const dataset = options.includeData !== false
        ? await this.exportTableData(table.id)
        : { nodes: [], nodeAttributes: [] }

      // Export relations if requested
      const relations = options.includeRelations !== false
        ? await this.exportTableRelations(table.id)
        : { relationTypes: [], nodeRelations: [] }

      // Export templates if requested
      const templates = options.includeTemplates !== false
        ? await this.exportTableTemplates(tableIdentifier, options.includeStatistics)
        : { templates: [] }

      const packageFormat: TablePackageFormat = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: table.identifier,
          description: table.description,
        },
        dependencies,
        package: {
          schema,
          dataset,
          relations,
          templates,
        },
      }

      this.logger.info('Table export completed successfully', {
        tableIdentifier,
        nodesCount: dataset.nodes.length,
        templatesCount: templates.templates.length,
      })

      return {
        success: true,
        tablePackage: packageFormat,
        dependencyOrder: dependencies,
        errors: [],
        warnings: [],
      }
    } catch (error) {
      this.logger.error('Table export failed', { tableIdentifier, error })
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown export error'],
        warnings: [],
      }
    }
  }

  async exportRelatedTables(
    tableIdentifiers: string[],
    options: TablePackageExportOptions = {}
  ): Promise<TablePackageExportResult[]> {
    const results: TablePackageExportResult[] = []

    for (const identifier of tableIdentifiers) {
      const result = await this.exportTable(identifier, options)
      results.push(result)
    }

    return results
  }

  async importTablePackage(
    packageData: TablePackageFormat,
    options: TablePackageImportOptions = { conflictResolution: 'skip' }
  ): Promise<TablePackageImportResult> {
    try {
      this.logger.info('Starting table package import', {
        tableIdentifier: packageData.sourceTable.identifier,
        options,
      })

      // Validate package
      const conflicts = await this.validatePackage(packageData, options)
      const errors = conflicts.filter(c => c.severity === 'error')
      const warnings = conflicts.filter(c => c.severity === 'warning')

      if (errors.length > 0 && options.conflictResolution === 'skip') {
        return {
          success: false,
          errors: errors.map(e => e.message),
          warnings: warnings.map(w => w.message),
        }
      }

      // Handle conflicts based on resolution strategy
      const resolvedIdentifier = await this.resolveTableNameConflict(
        packageData.sourceTable.identifier,
        options
      )

      // Import schema (table, attributes, attribute types)
      const importedTable = await this.importTableSchema(
        packageData.package.schema,
        resolvedIdentifier,
        options
      )

      // Import data if requested
      if (options.importData !== false) {
        await this.importTableData(
          packageData.package.dataset,
          importedTable.id,
          options
        )
      }

      // Import relations if requested
      if (options.importRelations !== false) {
        await this.importTableRelations(
          packageData.package.relations,
          importedTable.id,
          options
        )
      }

      // Import/generate templates
      const generatedTemplates = []
      if (options.importTemplates !== false) {
        const importedTemplates = await this.importTableTemplates(
          packageData.package.templates,
          resolvedIdentifier,
          options
        )
        generatedTemplates.push(...importedTemplates)
      }

      if (options.generateTemplates !== false) {
        const autoTemplates = await this.generateTableTemplates(resolvedIdentifier)
        if (autoTemplates.success) {
          generatedTemplates.push(...autoTemplates.templates.map(t => ({
            id: '', // Will be set after creation
            identifier: t.identifier,
            name: t.name,
            operationType: t.operationType,
          })))
        }
      }

      this.logger.info('Table package import completed successfully', {
        originalIdentifier: packageData.sourceTable.identifier,
        resolvedIdentifier,
        templatesGenerated: generatedTemplates.length,
      })

      return {
        success: true,
        importedTable: {
          id: importedTable.id as string,
          identifier: resolvedIdentifier,
          originalIdentifier: packageData.sourceTable.identifier,
        },
        generatedTemplates,
        resolvedConflicts: [{
          type: 'table',
          originalName: packageData.sourceTable.identifier,
          resolvedName: resolvedIdentifier,
          action: resolvedIdentifier !== packageData.sourceTable.identifier ? 'renamed' : 'overwritten',
        }],
        errors: [],
        warnings: warnings.map(w => w.message),
      }
    } catch (error) {
      this.logger.error('Table package import failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        error,
      })
      return {
        success: false,
        importedTable: undefined,
        generatedTemplates: [],
        resolvedConflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown import error'],
        warnings: [],
      }
    }
  }

  async importTablePackages(
    packages: TablePackageFormat[],
    options: TablePackageImportOptions = { conflictResolution: 'skip' }
  ): Promise<TablePackageImportResult[]> {
    // Resolve import order based on dependencies
    const identifiers = packages.map(p => p.sourceTable.identifier)
    const importOrder = await this.resolveImportOrder(identifiers)

    const results: TablePackageImportResult[] = []

    for (const identifier of importOrder) {
      const packageData = packages.find(p => p.sourceTable.identifier === identifier)
      if (packageData) {
        const result = await this.importTablePackage(packageData, options)
        results.push(result)

        // Stop on failure unless configured otherwise
        if (!result.success && options.conflictResolution !== 'skip') {
          break
        }
      }
    }

    return results
  }

  async analyzeDependencies(tableIdentifier: string): Promise<TableDependencyInfo> {
    // This is a simplified implementation - would need to analyze:
    // 1. Foreign key relationships in attributes
    // 2. Node relations that reference other tables
    // 3. Template dependencies on other tables

    const dependencies: string[] = []
    const dependents: string[] = []
    const circularReferences: string[] = []

    // Find templates that reference this table
    const templates = await this.queryTemplateRepository.findByApplicableTable(tableIdentifier, true)

    // Extract table references from template queries
    for (const template of templates) {
      const queryText = template.getQueryText()
      const referencedTables = this.extractTableReferencesFromQuery(queryText)
      dependencies.push(...referencedTables.filter(t => t !== tableIdentifier))
    }

    // Remove duplicates
    const uniqueDependencies = [...new Set(dependencies)]

    return {
      tableIdentifier,
      dependencies: uniqueDependencies,
      dependents,
      depth: uniqueDependencies.length > 0 ? 1 : 0,
      circularReferences,
    }
  }

  async resolveImportOrder(tableIdentifiers: string[]): Promise<string[]> {
    // Simplified topological sort implementation
    const dependencies = new Map<string, string[]>()

    for (const identifier of tableIdentifiers) {
      const depInfo = await this.analyzeDependencies(identifier)
      dependencies.set(identifier, depInfo.dependencies.filter(d => tableIdentifiers.includes(d)))
    }

    const result: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (node: string): void => {
      if (visiting.has(node)) {
        // Circular dependency detected - add to end
        return
      }
      if (visited.has(node)) {
        return
      }

      visiting.add(node)
      const deps = dependencies.get(node) || []
      for (const dep of deps) {
        visit(dep)
      }
      visiting.delete(node)
      visited.add(node)
      result.push(node)
    }

    for (const identifier of tableIdentifiers) {
      visit(identifier)
    }

    return result
  }

  async validatePackage(
    packageData: TablePackageFormat,
    options: TablePackageImportOptions = { conflictResolution: 'skip' }
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check if table already exists
    const existingTable = await this.tableRepository.findByIdentifier(
      packageData.sourceTable.identifier
    )

    if (existingTable && options.conflictResolution === 'skip') {
      conflicts.push({
        type: 'table_exists',
        severity: 'error',
        message: `Table '${packageData.sourceTable.identifier}' already exists`,
        context: { tableName: packageData.sourceTable.identifier },
        suggestedResolution: 'Use conflictResolution: "rename" or "overwrite"',
      })
    }

    // Validate package structure
    if (!packageData.package.schema.table) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Package schema is missing table definition',
        context: {},
      })
    }

    // Check for circular dependencies
    const depInfo = await this.analyzeDependencies(packageData.sourceTable.identifier)
    if (depInfo.circularReferences.length > 0) {
      conflicts.push({
        type: 'circular_dependency',
        severity: 'warning',
        message: `Circular dependencies detected: ${depInfo.circularReferences.join(', ')}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  async createImportSession(packages: TablePackageFormat[]): Promise<ImportSession> {
    const sessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const identifiers = packages.map(p => p.sourceTable.identifier)
    const importOrder = await this.enhancedDependencyAnalyzer.resolveImportOrder(identifiers)

    const session: ImportSession = {
      sessionId,
      status: 'pending',
      startedAt: new Date(),
      packagesImported: [],
      packagesRemaining: importOrder,
      rollbackInfo: {
        tablesCreated: [],
        templatesCreated: [],
        nodesCreated: [],
      },
      errors: [],
    }

    this.importSessions.set(sessionId, session)
    return session
  }

  async getImportSession(sessionId: string): Promise<ImportSession | null> {
    return this.importSessions.get(sessionId) || null
  }

  async rollbackImportSession(sessionId: string): Promise<void> {
    const session = this.importSessions.get(sessionId)
    if (!session) {
      throw new DomainException(`Import session '${sessionId}' not found`)
    }

    this.logger.info('Rolling back import session', { sessionId })

    try {
      // Delete created templates
      for (const templateId of session.rollbackInfo.templatesCreated) {
        await this.queryTemplateRepository.delete(templateId)
      }

      // Delete created nodes (cascade will handle relations)
      for (const nodeId of session.rollbackInfo.nodesCreated) {
        await this.nodeRepository.delete(nodeId as any)
      }

      // Delete created tables (cascade will handle attributes)
      for (const tableId of session.rollbackInfo.tablesCreated) {
        await this.tableRepository.delete(tableId as any)
      }

      session.status = 'rolled_back'
      session.completedAt = new Date()

      this.logger.info('Import session rollback completed', { sessionId })
    } catch (error) {
      this.logger.error('Import session rollback failed', { sessionId, error })
      session.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  async generateTableTemplates(
    tableIdentifier: string,
    options: {
      includeCreate?: boolean
      includeRead?: boolean
      includeUpdate?: boolean
      includeDelete?: boolean
      includeSearch?: boolean
      includeBatch?: boolean
    } = {}
  ): Promise<{
    success: boolean
    templates: Array<{
      identifier: string
      name: string
      operationType: string
      query: string
    }>
    errors: string[]
  }> {
    // Use enhanced template generator for sophisticated GraphQL templates
    const result = await this.enhancedTemplateGenerator.generateTableTemplates(tableIdentifier, {
      includeCreate: options.includeCreate !== false,
      includeRead: options.includeRead !== false,
      includeUpdate: options.includeUpdate !== false,
      includeDelete: options.includeDelete !== false,
      includeSearch: options.includeSearch !== false,
      includeBatch: options.includeBatch === true,
      includeRelations: true,
      includeValidation: true,
      includeSubscriptions: false,
    })

    return result
  }

  // Legacy implementation kept for backwards compatibility
  async generateBasicTableTemplates(
    tableIdentifier: string,
    options: {
      includeCreate?: boolean
      includeRead?: boolean
      includeUpdate?: boolean
      includeDelete?: boolean
      includeSearch?: boolean
      includeBatch?: boolean
    } = {}
  ): Promise<{
    success: boolean
    templates: Array<{
      identifier: string
      name: string
      operationType: string
      query: string
    }>
    errors: string[]
  }> {
    const defaults = {
      includeCreate: true,
      includeRead: true,
      includeUpdate: true,
      includeDelete: true,
      includeSearch: true,
      includeBatch: false,
      ...options,
    }

    const templates = []
    const errors = []

    try {
      // Get table info
      const table = await this.tableRepository.findByIdentifier(tableIdentifier)
      if (!table) {
        return {
          success: false,
          templates: [],
          errors: [`Table '${tableIdentifier}' not found`],
        }
      }

      const tableNameCamel = this.toCamelCase(tableIdentifier)
      const tableNamePascal = this.toPascalCase(tableIdentifier)

      if (defaults.includeCreate) {
        templates.push({
          identifier: `create-${tableIdentifier}`,
          name: `Create ${tableNamePascal}`,
          operationType: 'mutation',
          query: `mutation Create${tableNamePascal}($input: Create${tableNamePascal}Input!) {
  create${tableNamePascal}(input: $input) {
    success
    ${tableNameCamel} {
      id
      externalId
      createdAt
    }
    errors {
      message
      field
    }
  }
}`,
        })
      }

      if (defaults.includeRead) {
        templates.push({
          identifier: `get-${tableIdentifier}`,
          name: `Get ${tableNamePascal}`,
          operationType: 'query',
          query: `query Get${tableNamePascal}($id: ID!) {
  ${tableNameCamel}(id: $id) {
    id
    externalId
    nodeType
    content
    metadata
    createdAt
    updatedAt
  }
}`,
        })
      }

      if (defaults.includeUpdate) {
        templates.push({
          identifier: `update-${tableIdentifier}`,
          name: `Update ${tableNamePascal}`,
          operationType: 'mutation',
          query: `mutation Update${tableNamePascal}($id: ID!, $input: Update${tableNamePascal}Input!) {
  update${tableNamePascal}(id: $id, input: $input) {
    success
    ${tableNameCamel} {
      id
      externalId
      updatedAt
    }
    errors {
      message
      field
    }
  }
}`,
        })
      }

      if (defaults.includeDelete) {
        templates.push({
          identifier: `delete-${tableIdentifier}`,
          name: `Delete ${tableNamePascal}`,
          operationType: 'mutation',
          query: `mutation Delete${tableNamePascal}($id: ID!) {
  delete${tableNamePascal}(id: $id) {
    success
    deletedId: id
    errors {
      message
    }
  }
}`,
        })
      }

      if (defaults.includeSearch) {
        templates.push({
          identifier: `search-${tableIdentifier}`,
          name: `Search ${tableNamePascal}`,
          operationType: 'query',
          query: `query Search${tableNamePascal}($filter: SearchFilter, $pagination: PaginationInput) {
  search${tableNamePascal}(filter: $filter, pagination: $pagination) {
    items {
      id
      externalId
      nodeType
      content
      createdAt
    }
    pagination {
      total
      page
      pageSize
      hasNextPage
    }
  }
}`,
        })
      }

      // Create templates in repository
      for (const template of templates) {
        try {
          const queryTemplate = QueryTemplate.create(
            template.identifier,
            template.name,
            template.query,
            [tableIdentifier, template.operationType, 'export-import', 'table-package'],
            {
              description: `Auto-generated ${template.operationType} template for ${tableIdentifier} table`,
              complexityScore: 2,
              applicableTables: [tableIdentifier],
            }
          )

          await this.queryTemplateRepository.create(queryTemplate)
        } catch (error) {
          errors.push(`Failed to create template '${template.identifier}': ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return {
        success: errors.length === 0,
        templates,
        errors,
      }
    } catch (error) {
      return {
        success: false,
        templates: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  // Private helper methods

  private async exportTableSchema(tableId: string): Promise<TableSchemaExport> {
    const table = await this.tableRepository.findById(tableId as any)
    if (!table) {
      throw new DomainException(`Table with ID '${tableId}' not found`)
    }

    // Get all attributes for this table
    const attributesPaginated = await this.attributeRepository.findByTableId(tableId as any)
    const attributes = attributesPaginated.nodes

    // Get all attribute types used by these attributes
    const attributeTypeIds = [...new Set(attributes.map(attr => attr.getAttributeTypeId()))]
    const attributeTypes = await Promise.all(
      attributeTypeIds.map(id => this.attributeTypeRepository.findById(id))
    )

    return {
      table: {
        identifier: table.identifier,
        description: table.description,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
      },
      attributes: attributes.map(attr => ({
        identifier: attr.getIdentifier(),
        attributeTypeId: attr.getAttributeTypeId() as string,
        description: attr.getDescription(),
        isRequired: attr.getIsRequired(),
        metadata: null,
        createdAt: attr.getCreatedAt().toISOString(),
        updatedAt: attr.getUpdatedAt().toISOString(),
      })),
      attributeTypes: attributeTypes
        .filter(Boolean)
        .map(attrType => ({
          id: attrType!.getId() as string,
          identifier: attrType!.getIdentifier(),
          description: attrType!.getDescription(),
          dataType: attrType!.getJsonType(),
          validation: attrType!.getValidationSchema(),
          metadata: null,
          createdAt: attrType!.getCreatedAt().toISOString(),
          updatedAt: attrType!.getUpdatedAt().toISOString(),
        })),
    }
  }

  private async exportTableData(tableId: string): Promise<TableDataExport> {
    // Get all nodes for this table
    const nodesPaginated = await this.nodeRepository.findByTableId(tableId as any)
    const nodes = nodesPaginated.nodes

    // Get all node attributes for these nodes
    const nodeIds = nodes.map(node => node.getId())
    const nodeAttributes = await Promise.all(
      nodeIds.map(nodeId => this.nodeAttributeRepository.findByNodeId(nodeId))
    )
    const flatNodeAttributes = nodeAttributes.flat()

    return {
      nodes: nodes.map(node => ({
        externalId: node.getId() as string, // Use node ID as external ID
        nodeType: 'node', // Default node type
        content: typeof node.getContent() === 'string' ? JSON.parse(node.getContent() as string) : (node.getContent() as unknown) as Record<string, any> | null,
        metadata: null, // No metadata available in current Node entity
        createdAt: node.getCreatedAt().toISOString(),
        updatedAt: node.getUpdatedAt().toISOString(),
      })),
      nodeAttributes: flatNodeAttributes.map(nodeAttr => ({
        nodeExternalId: nodeAttr.getNodeId() as string, // Should be mapped to external ID
        attributeIdentifier: nodeAttr.getAttributeId() as string, // Should be mapped to attribute identifier
        value: nodeAttr.getValue(),
        createdAt: nodeAttr.getCreatedAt().toISOString(),
        updatedAt: nodeAttr.getUpdatedAt().toISOString(),
      })),
    }
  }

  private async exportTableRelations(tableId: string): Promise<TableRelationsExport> {
    // Get all nodes for this table to find their relations
    const nodesPaginated = await this.nodeRepository.findByTableId(tableId as any)
    const nodes = nodesPaginated.nodes
    const nodeIds = nodes.map(node => node.getId())

    // Get all relations where nodes from this table are involved (source or target)
    const nodeRelations = await Promise.all(
      nodeIds.map(async nodeId => {
        const outgoing = await this.nodeRelationRepository.findBySourceNodeId(nodeId)
        const incoming = await this.nodeRelationRepository.findByTargetNodeId(nodeId)
        return [...outgoing, ...incoming]
      })
    )
    const flatNodeRelations = nodeRelations.flat()

    // Get unique relation types used
    const relationTypeIds = [...new Set(flatNodeRelations.map(rel => rel.getRelationTypeId()))]
    const relationTypes = await Promise.all(
      relationTypeIds.map(id => this.relationTypeRepository.findById(id))
    )

    return {
      relationTypes: relationTypes
        .filter(Boolean)
        .map(relType => ({
          id: relType!.getId() as string,
          identifier: relType!.getIdentifier(),
          description: relType!.getDescription(),
          properties: {}, // No properties available in current RelationType entity
          createdAt: relType!.getCreatedAt().toISOString(),
          updatedAt: relType!.getUpdatedAt().toISOString(),
        })),
      nodeRelations: flatNodeRelations.map(nodeRel => ({
        sourceExternalId: nodeRel.getSourceNodeId() as string,
        targetExternalId: nodeRel.getTargetNodeId() as string,
        relationTypeId: nodeRel.getRelationTypeId() as string,
        properties: nodeRel.getProperties(),
        strength: nodeRel.getStrength(),
        createdAt: nodeRel.getCreatedAt().toISOString(),
        updatedAt: nodeRel.getUpdatedAt().toISOString(),
      })),
    }
  }

  private async exportTableTemplates(
    tableIdentifier: string,
    includeStatistics?: boolean
  ): Promise<TableTemplatesExport> {
    const templates = await this.queryTemplateRepository.findByApplicableTable(tableIdentifier, true)

    return {
      templates: templates.map(t => ({
        identifier: t.getIdentifier(),
        name: t.getName(),
        description: t.getDescription(),
        query: t.getQueryText(),
        queryName: t.getQueryName(),
        operationType: t.getOperationType(),
        variables: null,
        variablesSchema: t.getVariablesSchema(),
        defaultVariables: t.getDefaultVariables(),
        applicableTables: t.getApplicableTables(),
        complexityScore: t.getComplexityScore(),
        version: t.getVersion(),
        tags: t.getTags(),
        isActive: t.getIsActive(),
        ...(includeStatistics && {
          statistics: {
            usageCount: t.getUsageCount(),
            avgExecutionTimeMs: t.getAvgExecutionTimeMs(),
            lastUsedAt: t.getLastUsedAt()?.toISOString() || null,
          },
        }),
      })),
    }
  }

  private async resolveTableNameConflict(
    originalName: string,
    options: TablePackageImportOptions
  ): Promise<string> {
    const existingTable = await this.tableRepository.findByIdentifier(originalName)

    if (!existingTable) {
      return originalName
    }

    switch (options.conflictResolution) {
      case 'overwrite':
        await this.tableRepository.delete(existingTable.id)
        return originalName
      case 'rename': {
        const prefix = options.newTablePrefix || 'imported_'
        let newName = `${prefix}${originalName}`
        let counter = 1
        while (await this.tableRepository.findByIdentifier(newName)) {
          newName = `${prefix}${originalName}_${counter}`
          counter++
        }
        return newName
      }
      case 'merge':
        // For now, treat merge as overwrite
        return originalName
      default:
        throw new DomainException(`Table '${originalName}' already exists`)
    }
  }

  private async importTableSchema(
    schema: TableSchemaExport,
    resolvedIdentifier: string,
    _options: TablePackageImportOptions
  ): Promise<{ id: string }> {
    // Create or update attribute types first
    const attributeTypeMap = new Map<string, string>()
    for (const attrTypeData of schema.attributeTypes) {
      try {
        // Check if attribute type already exists
        const existingAttrType = await this.attributeTypeRepository.findByIdentifier(attrTypeData.identifier)

        if (existingAttrType) {
          attributeTypeMap.set(attrTypeData.id, existingAttrType.getId() as string)
        } else {
          // Create new attribute type
          const AttributeType = (await import('../entities/AttributeType.js')).AttributeType
          const newAttrType = AttributeType.create(
            attrTypeData.identifier,
            attrTypeData.dataType,
            attrTypeData.description || undefined,
            attrTypeData.validation || undefined,
            attrTypeData.metadata || undefined
          )

          await this.attributeTypeRepository.save(newAttrType)
          attributeTypeMap.set(attrTypeData.id, newAttrType.getId() as string)
        }
      } catch (error) {
        this.logger.warn('Failed to import attribute type', {
          identifier: attrTypeData.identifier,
          error,
        })
      }
    }

    // Create the table
    const Table = (await import('../entities/Table.js')).Table
    const table = Table.create(resolvedIdentifier, schema.table.description || undefined)
    const savedTable = await this.tableRepository.save(table)

    // Create attributes
    for (const attrData of schema.attributes) {
      try {
        const newAttributeTypeId = attributeTypeMap.get(attrData.attributeTypeId)
        if (!newAttributeTypeId) {
          this.logger.warn('Attribute type not found for attribute', {
            attributeIdentifier: attrData.identifier,
            attributeTypeId: attrData.attributeTypeId,
          })
          continue
        }

        const Attribute = (await import('../entities/Attribute.js')).Attribute
        const attribute = Attribute.create(
          savedTable.id,
          attrData.identifier,
          newAttributeTypeId as any,
          attrData.description || undefined,
          attrData.isRequired,
          attrData.metadata || undefined
        )

        await this.attributeRepository.save(attribute)
      } catch (error) {
        this.logger.warn('Failed to import attribute', {
          identifier: attrData.identifier,
          error,
        })
      }
    }

    return { id: savedTable.id as string }
  }

  private async importTableData(
    dataset: TableDataExport,
    tableId: string,
    _options: TablePackageImportOptions
  ): Promise<void> {
    // Create nodes first
    const nodeIdMap = new Map<string, string>()

    for (const nodeData of dataset.nodes) {
      try {
        const Node = (await import('../entities/Node.js')).Node
        const node = Node.create(
          tableId as any,
          JSON.stringify(nodeData.content),
          undefined, // title
          undefined  // description
        )

        await this.nodeRepository.save(node)
        nodeIdMap.set(nodeData.externalId, node.getId() as string)
      } catch (error) {
        this.logger.warn('Failed to import node', {
          externalId: nodeData.externalId,
          error,
        })
      }
    }

    // Get attribute identifier to ID mapping for this table
    const attributesResult = await this.attributeRepository.findByTableId(tableId as any)
    const attributeMap = new Map<string, string>()
    for (const attr of attributesResult.items || []) {
      attributeMap.set(attr.getIdentifier(), attr.getId() as string)
    }

    // Create node attributes
    for (const nodeAttrData of dataset.nodeAttributes) {
      try {
        const nodeId = nodeIdMap.get(nodeAttrData.nodeExternalId)
        const attributeId = attributeMap.get(nodeAttrData.attributeIdentifier)

        if (!nodeId || !attributeId) {
          this.logger.warn('Node or attribute not found for node attribute', {
            nodeExternalId: nodeAttrData.nodeExternalId,
            attributeIdentifier: nodeAttrData.attributeIdentifier,
          })
          continue
        }

        const NodeAttribute = (await import('../entities/NodeAttribute.js')).NodeAttribute
        const nodeAttribute = NodeAttribute.create(
          nodeId as any,
          attributeId as any,
          nodeAttrData.value
        )

        await this.nodeAttributeRepository.save(nodeAttribute)
      } catch (error) {
        this.logger.warn('Failed to import node attribute', {
          nodeExternalId: nodeAttrData.nodeExternalId,
          attributeIdentifier: nodeAttrData.attributeIdentifier,
          error,
        })
      }
    }
  }

  private async importTableRelations(
    relations: TableRelationsExport,
    tableId: string,
    _options: TablePackageImportOptions
  ): Promise<void> {
    // Create or find relation types first
    const relationTypeMap = new Map<string, string>()

    for (const relTypeData of relations.relationTypes) {
      try {
        // Check if relation type already exists
        const existingRelType = await this.relationTypeRepository.findByIdentifier(relTypeData.identifier)

        if (existingRelType) {
          relationTypeMap.set(relTypeData.id, existingRelType.getId() as string)
        } else {
          // Create new relation type
          const RelationType = (await import('../entities/RelationType.js')).RelationType
          const newRelType = RelationType.create(
            relTypeData.identifier,
            relTypeData.description || undefined,
            typeof relTypeData.properties === 'string' ? relTypeData.properties : undefined
          )

          await this.relationTypeRepository.save(newRelType)
          relationTypeMap.set(relTypeData.id, newRelType.getId() as string)
        }
      } catch (error) {
        this.logger.warn('Failed to import relation type', {
          identifier: relTypeData.identifier,
          error,
        })
      }
    }

    // Get nodes from this table by external ID to map to internal IDs
    const nodesResult = await this.nodeRepository.findByTableId(tableId as any)
    const nodeIdMap = new Map<string, string>()
    for (const node of nodesResult.items || []) {
      const externalId = node.getId() as string  // Use node ID as external ID since Node doesn't have getExternalId
      nodeIdMap.set(externalId, node.getId() as string)
    }

    // Create node relations
    for (const nodeRelData of relations.nodeRelations) {
      try {
        const sourceNodeId = nodeIdMap.get(nodeRelData.sourceExternalId)
        const targetNodeId = nodeIdMap.get(nodeRelData.targetExternalId)
        const relationTypeId = relationTypeMap.get(nodeRelData.relationTypeId)

        if (!sourceNodeId || !targetNodeId || !relationTypeId) {
          this.logger.warn('Node or relation type not found for relation', {
            sourceExternalId: nodeRelData.sourceExternalId,
            targetExternalId: nodeRelData.targetExternalId,
            relationTypeId: nodeRelData.relationTypeId,
          })
          continue
        }

        const NodeRelation = (await import('../entities/NodeRelation.js')).NodeRelation
        const nodeRelation = NodeRelation.create(
          tableId as any,
          sourceNodeId as any,
          nodeRelData.sourceExternalId,
          targetNodeId as any,
          nodeRelData.targetExternalId,
          relationTypeId as any,
          nodeRelData.properties || undefined,
          nodeRelData.strength
        )

        await this.nodeRelationRepository.save(nodeRelation)
      } catch (error) {
        this.logger.warn('Failed to import node relation', {
          sourceExternalId: nodeRelData.sourceExternalId,
          targetExternalId: nodeRelData.targetExternalId,
          error,
        })
      }
    }
  }

  private async importTableTemplates(
    templates: TableTemplatesExport,
    _tableIdentifier: string,
    _options: TablePackageImportOptions
  ): Promise<Array<{ id: string; identifier: string; name: string; operationType: string }>> {
    const imported = []

    for (const templateData of templates.templates) {
      try {
        const template = QueryTemplate.create(
          templateData.identifier,
          templateData.name,
          templateData.query,
          templateData.tags || undefined,
          {
            description: templateData.description || undefined,
            variablesSchema: templateData.variablesSchema || undefined,
            defaultVariables: templateData.defaultVariables || undefined,
            applicableTables: templateData.applicableTables || undefined,
            complexityScore: templateData.complexityScore,
            version: templateData.version,
          }
        )

        const created = await this.queryTemplateRepository.create(template)
        imported.push({
          id: created.getId() || '',
          identifier: created.getIdentifier(),
          name: created.getName(),
          operationType: created.getOperationType(),
        })
      } catch (error) {
        this.logger.warn('Failed to import template', {
          templateIdentifier: templateData.identifier,
          error,
        })
      }
    }

    return imported
  }

  private extractTableReferencesFromQuery(queryText: string): string[] {
    // Simplified extraction - would need more sophisticated parsing
    const tableReferences: string[] = []

    // Look for common GraphQL patterns that might reference tables
    const patterns = [
      /\b([a-z][a-zA-Z0-9]*)\(/g, // Function calls that might be table operations
      /\btable:\s*"([^"]+)"/g, // Explicit table references
    ]

    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(queryText)) !== null) {
        if (match[1]) {
          tableReferences.push(match[1])
        }
      }
    }

    return [...new Set(tableReferences)]
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1]?.toUpperCase() || g)
  }

  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str)
    return camel.charAt(0).toUpperCase() + camel.slice(1)
  }

  /**
   * Generate schema-aware templates for a table using introspection
   */
  async generateSchemaAwareTemplates(tableIdentifier: string): Promise<{
    templates: any[]
    schemaAnalysis: any
    validationResults: any[]
  }> {
    try {
      this.logger.info('Generating schema-aware templates', { tableIdentifier })

      // Get current schema analysis
      const schemaAnalysis = await this.schemaIntrospectionService.analyzeSchema()

      // Generate template suggestions based on schema
      const _templateSuggestions = await this.schemaIntrospectionService.generateTemplateForTable(tableIdentifier)

      // Generate templates using enhanced generator
      const templates = await this.enhancedTemplateGenerator.generateTableTemplates(
        tableIdentifier,
        { includeSubscriptions: true }
      )

      // Validate each template against live schema
      const validationResults = []
      for (const template of templates.templates) {
        try {
          const validation = await this.schemaIntrospectionService.validateTemplateQuery(
            template.query,
            template.variables || undefined
          )
          validationResults.push({
            template: template.identifier,
            validation
          })
        } catch (error) {
          validationResults.push({
            template: template.identifier,
            validation: {
              isValid: false,
              errors: [error instanceof Error ? error.message : 'Unknown validation error']
            }
          })
        }
      }

      this.logger.info('Schema-aware templates generated', {
        tableIdentifier,
        templatesCount: templates.templates.length,
        validTemplates: validationResults.filter(v => v.validation.isValid).length,
        schemaTypesCount: schemaAnalysis.types.length
      })

      return {
        templates: templates.templates,
        schemaAnalysis,
        validationResults
      }
    } catch (error) {
      this.logger.error('Failed to generate schema-aware templates', { tableIdentifier, error })
      throw error
    }
  }

  /**
   * Validate package templates against current schema
   */
  async validatePackageSchemaCompatibility(packageData: TablePackageFormat): Promise<{
    isCompatible: boolean
    validationResults: any[]
    recommendations: string[]
  }> {
    try {
      this.logger.info('Validating package schema compatibility', {
        tableIdentifier: packageData.sourceTable.identifier,
        templatesCount: packageData.package.templates?.templates?.length || 0
      })

      const validationResults = []
      const recommendations: string[] = []

      // Validate each template in the package
      for (const template of packageData.package.templates?.templates || []) {
        try {
          const validation = await this.schemaIntrospectionService.validateTemplateQuery(
            template.query,
            template.variables || undefined
          )

          validationResults.push({
            templateId: template.identifier,
            templateName: template.name,
            validation
          })

          if (!validation.isValid) {
            recommendations.push(`Template '${template.name}' has schema issues: ${validation.errors.map(e => e.message).join(', ')}`)
          }

          if (validation.suggestions?.length > 0) {
            recommendations.push(...validation.suggestions.map(s => `Template '${template.name}': ${s}`))
          }
        } catch (error) {
          validationResults.push({
            templateId: template.identifier,
            templateName: template.name,
            validation: {
              isValid: false,
              errors: [{ message: error instanceof Error ? error.message : 'Unknown validation error' }]
            }
          })
          recommendations.push(`Template '${template.name}' failed validation: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      const validTemplates = validationResults.filter(r => r.validation.isValid)
      const isCompatible = validTemplates.length === validationResults.length

      if (!isCompatible) {
        recommendations.unshift('Some templates are incompatible with current schema. Consider updating templates or schema.')
      }

      this.logger.info('Package schema compatibility validation completed', {
        tableIdentifier: packageData.sourceTable.identifier,
        totalTemplates: validationResults.length,
        validTemplates: validTemplates.length,
        isCompatible
      })

      return {
        isCompatible,
        validationResults,
        recommendations
      }
    } catch (error) {
      this.logger.error('Package schema compatibility validation failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        error
      })
      throw error
    }
  }

  /**
   * Get current GraphQL schema analysis
   */
  async getSchemaAnalysis(): Promise<any> {
    try {
      return await this.schemaIntrospectionService.analyzeSchema()
    } catch (error) {
      this.logger.error('Failed to get schema analysis', { error })
      throw error
    }
  }

  /**
   * Clear schema cache (useful for testing or after schema changes)
   */
  clearSchemaCache(): void {
    this.schemaIntrospectionService.clearCache()
    this.logger.info('Schema cache cleared')
  }
}