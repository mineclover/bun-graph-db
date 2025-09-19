import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  TablePackageConflict,
  TablePackageConflictType,
  TablePackageFormat,
  TablePackageImportOptions,
} from '@/core/types/TablePackage.js'
import { validateQuerySyntax } from '@/core/utils/GraphQLParser.js'
import type { IAttributeTypeRepository } from '../repositories/IAttributeTypeRepository.js'
import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '../repositories/ITableRepository.js'

/**
 * Enhanced table package validator
 *
 * Provides comprehensive validation including:
 * - Schema compatibility validation
 * - Data integrity checks
 * - Relationship consistency validation
 * - Template GraphQL syntax validation
 * - Version compatibility checks
 * - Circular dependency detection
 * - Performance impact assessment
 */
export class TablePackageValidator {
  constructor(
    private readonly tableRepository: ITableRepository,
    readonly _attributeTypeRepository: IAttributeTypeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Comprehensive validation of a table package
   */
  async validatePackage(
    packageData: TablePackageFormat,
    options: TablePackageImportOptions = { conflictResolution: 'skip' }
  ): Promise<TablePackageConflict[]> {
    this.logger.info('Starting comprehensive package validation', {
      tableIdentifier: packageData.sourceTable.identifier,
      version: packageData.version,
    })

    const conflicts: TablePackageConflict[] = []

    try {
      // 1. Structural validation
      const structuralIssues = await this.validatePackageStructure(packageData)
      conflicts.push(...structuralIssues)

      // 2. Schema compatibility validation
      const schemaIssues = await this.validateSchemaCompatibility(packageData, options)
      conflicts.push(...schemaIssues)

      // 3. Data integrity validation
      const dataIssues = await this.validateDataIntegrity(packageData)
      conflicts.push(...dataIssues)

      // 4. Relationship consistency validation
      const relationshipIssues = await this.validateRelationshipConsistency(packageData)
      conflicts.push(...relationshipIssues)

      // 5. Template validation
      const templateIssues = await this.validateTemplates(packageData)
      conflicts.push(...templateIssues)

      // 6. Version compatibility validation
      const versionIssues = await this.validateVersionCompatibility(packageData)
      conflicts.push(...versionIssues)

      // 7. Dependency validation
      const dependencyIssues = await this.validateDependencies(packageData)
      conflicts.push(...dependencyIssues)

      // 8. Performance impact assessment
      const performanceIssues = await this.assessPerformanceImpact(packageData)
      conflicts.push(...performanceIssues)

      // 9. Security validation
      const securityIssues = await this.validateSecurity(packageData)
      conflicts.push(...securityIssues)

      this.logger.info('Package validation completed', {
        tableIdentifier: packageData.sourceTable.identifier,
        totalIssues: conflicts.length,
        errors: conflicts.filter((c) => c.severity === 'error').length,
        warnings: conflicts.filter((c) => c.severity === 'warning').length,
      })

      return conflicts
    } catch (error) {
      this.logger.error('Package validation failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        error,
      })

      return [
        {
          type: 'schema_incompatible',
          severity: 'error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          context: { tableName: packageData.sourceTable.identifier },
        },
      ]
    }
  }

  /**
   * Validate package structure and required fields
   */
  private async validatePackageStructure(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check required top-level fields
    if (!packageData.version) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Package version is required',
        context: {},
      })
    }

    if (!packageData.exportedAt) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Package export timestamp is required',
        context: {},
      })
    }

    if (!packageData.sourceTable?.identifier) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Source table identifier is required',
        context: {},
      })
    }

    // Validate package structure
    if (!packageData.package) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Package data is missing',
        context: {},
      })
      return conflicts
    }

    // Check required package components
    const { schema, dataset, relations, templates } = packageData.package

    if (!schema?.table) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: 'Package schema is missing table definition',
        context: {},
      })
    }

    if (!Array.isArray(schema?.attributes)) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: 'Package schema is missing attributes definition',
        context: {},
      })
    }

    if (!Array.isArray(dataset?.nodes)) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: 'Package dataset is missing nodes array',
        context: {},
      })
    }

    if (!Array.isArray(relations?.relationTypes)) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: 'Package relations is missing relation types array',
        context: {},
      })
    }

    if (!Array.isArray(templates?.templates)) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: 'Package templates is missing templates array',
        context: {},
      })
    }

    return conflicts
  }

  /**
   * Validate schema compatibility with existing system
   */
  private async validateSchemaCompatibility(
    packageData: TablePackageFormat,
    options: TablePackageImportOptions
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      // Check if table already exists
      const existingTable = await this.tableRepository.findByIdentifier(
        packageData.sourceTable.identifier
      )

      if (existingTable) {
        const conflictType: TablePackageConflictType = 'table_exists'
        const severity = options.conflictResolution === 'skip' ? 'error' : 'warning'

        conflicts.push({
          type: conflictType,
          severity,
          message: `Table '${packageData.sourceTable.identifier}' already exists`,
          context: { tableName: packageData.sourceTable.identifier },
          suggestedResolution:
            options.conflictResolution === 'skip'
              ? 'Use conflictResolution: "rename", "overwrite", or "merge"'
              : `Will ${options.conflictResolution} existing table`,
        })

        // If merging or overwriting, validate schema compatibility
        if (options.conflictResolution === 'merge' || options.conflictResolution === 'overwrite') {
          const schemaCompatibility = await this.validateSchemaUpgrade(packageData, existingTable)
          conflicts.push(...schemaCompatibility)
        }
      }

      // Validate attribute types
      const attributeTypeIssues = await this.validateAttributeTypes(packageData.package.schema)
      conflicts.push(...attributeTypeIssues)

      // Validate attribute constraints
      const constraintIssues = await this.validateAttributeConstraints(packageData.package.schema)
      conflicts.push(...constraintIssues)
    } catch (error) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: `Schema compatibility validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Validate data integrity and consistency
   */
  private async validateDataIntegrity(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const { dataset, schema } = packageData.package

      // Validate node data consistency
      const nodeIssues = await this.validateNodeData(dataset, schema)
      conflicts.push(...nodeIssues)

      // Validate node attributes consistency
      const attributeIssues = await this.validateNodeAttributes(dataset, schema)
      conflicts.push(...attributeIssues)

      // Validate data types and constraints
      const typeIssues = await this.validateDataTypes(dataset, schema)
      conflicts.push(...typeIssues)

      // Check for duplicate data
      const duplicateIssues = await this.validateDuplicateData(dataset)
      conflicts.push(...duplicateIssues)
    } catch (error) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: `Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Validate relationship consistency
   */
  private async validateRelationshipConsistency(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const { relations, dataset } = packageData.package

      // Validate relationship references
      const referenceIssues = await this.validateRelationshipReferences(relations, dataset)
      conflicts.push(...referenceIssues)

      // Validate relationship types
      const typeIssues = await this.validateRelationshipTypes(relations)
      conflicts.push(...typeIssues)

      // Check for orphaned relationships
      const orphanIssues = await this.validateOrphanedRelationships(relations, dataset)
      conflicts.push(...orphanIssues)
    } catch (error) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'error',
        message: `Relationship consistency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Validate GraphQL templates
   */
  private async validateTemplates(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const { templates } = packageData.package
      // GraphQLParser is now a function, not a class

      for (const template of templates.templates) {
        // Validate GraphQL syntax
        const parseResult = validateQuerySyntax(template.query)
        if (!parseResult.isValid) {
          conflicts.push({
            type: 'template_exists',
            severity: 'error',
            message: `Template '${template.identifier}' has invalid GraphQL syntax: ${parseResult.errors.join(', ')}`,
            context: { templateName: template.identifier },
            suggestedResolution: 'Fix GraphQL syntax errors in the template',
          })
          continue
        }

        // Check for template naming conflicts
        const existingTemplate = await this.queryTemplateRepository.findByIdentifier(
          template.identifier
        )
        if (existingTemplate) {
          conflicts.push({
            type: 'template_exists',
            severity: 'warning',
            message: `Template '${template.identifier}' already exists`,
            context: { templateName: template.identifier },
            suggestedResolution: 'Template will be overwritten during import',
          })
        }

        // Validate template variables
        const variableIssues = await this.validateTemplateVariables(template)
        conflicts.push(...variableIssues)

        // Validate operation type consistency
        const operationIssues = await this.validateOperationType(template)
        conflicts.push(...operationIssues)
      }
    } catch (error) {
      conflicts.push({
        type: 'template_exists',
        severity: 'error',
        message: `Template validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Validate version compatibility
   */
  private async validateVersionCompatibility(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const packageVersion = packageData.version
      const currentSystemVersion = '1.0.0' // This should come from system configuration

      // Parse semantic versions
      const packageVersionParts = packageVersion.split('.').map(Number)
      const systemVersionParts = currentSystemVersion.split('.').map(Number)

      // Check major version compatibility
      if ((packageVersionParts[0] || 0) > (systemVersionParts[0] || 0)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Package version ${packageVersion} is newer than system version ${currentSystemVersion}`,
          context: { tableName: packageData.sourceTable.identifier },
          suggestedResolution: 'Upgrade system or use a compatible package version',
        })
      }

      // Check for deprecated features
      const deprecationIssues = await this.checkDeprecatedFeatures(packageData)
      conflicts.push(...deprecationIssues)
    } catch (error) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: `Version compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Validate dependencies
   */
  private async validateDependencies(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const dependencies = packageData.dependencies || []

      for (const dependency of dependencies) {
        // Check if dependency exists
        const dependencyTable = await this.tableRepository.findByIdentifier(dependency)
        if (!dependencyTable) {
          conflicts.push({
            type: 'missing_dependency',
            severity: 'error',
            message: `Required dependency table '${dependency}' not found`,
            context: {
              tableName: packageData.sourceTable.identifier,
              dependency,
            },
            suggestedResolution: 'Import dependency table first or remove dependency',
          })
        }
      }

      // Check for circular dependencies
      const circularDeps = await this.detectCircularDependencies(packageData)
      conflicts.push(...circularDeps)
    } catch (error) {
      conflicts.push({
        type: 'missing_dependency',
        severity: 'error',
        message: `Dependency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  /**
   * Assess performance impact of importing the package
   */
  private async assessPerformanceImpact(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      const { dataset, relations, templates } = packageData.package

      // Check data volume impact
      const nodeCount = dataset.nodes.length
      const relationCount = relations.nodeRelations.length
      const _templateCount = templates.templates.length

      if (nodeCount > 10000) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'warning',
          message: `Large dataset detected (${nodeCount} nodes). Import may take significant time`,
          context: { tableName: packageData.sourceTable.identifier },
          suggestedResolution: 'Consider batch import or during low-traffic periods',
        })
      }

      if (relationCount > 50000) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'warning',
          message: `Large relationship dataset (${relationCount} relations). May impact query performance`,
          context: { tableName: packageData.sourceTable.identifier },
          suggestedResolution: 'Monitor query performance after import',
        })
      }

      // Check template complexity
      const complexTemplates = templates.templates.filter(
        (t) => (t.complexityScore || 0) > 7 || t.query.length > 5000
      )

      if (complexTemplates.length > 0) {
        conflicts.push({
          type: 'template_exists',
          severity: 'warning',
          message: `${complexTemplates.length} complex templates detected. May impact query performance`,
          context: { tableName: packageData.sourceTable.identifier },
          suggestedResolution: 'Review and optimize complex templates',
        })
      }
    } catch (error) {
      this.logger.warn('Performance impact assessment failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        error,
      })
    }

    return conflicts
  }

  /**
   * Validate security aspects of the package
   */
  private async validateSecurity(packageData: TablePackageFormat): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    try {
      // Check for potentially sensitive data
      const sensitiveDataIssues = await this.detectSensitiveData(packageData)
      conflicts.push(...sensitiveDataIssues)

      // Validate template security
      const templateSecurityIssues = await this.validateTemplateSecurity(packageData)
      conflicts.push(...templateSecurityIssues)

      // Check for injection vulnerabilities
      const injectionIssues = await this.detectInjectionVulnerabilities(packageData)
      conflicts.push(...injectionIssues)
    } catch (error) {
      this.logger.warn('Security validation failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        error,
      })
    }

    return conflicts
  }

  // Helper methods for specific validations

  private async validateSchemaUpgrade(
    _packageData: TablePackageFormat,
    _existingTable: any
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Implementation would compare schemas and detect breaking changes
    // For now, just a placeholder

    return conflicts
  }

  private async validateAttributeTypes(schema: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    for (const attrType of schema.attributeTypes || []) {
      // Check if attribute type is supported
      const supportedTypes = ['string', 'integer', 'number', 'boolean', 'array', 'object']
      if (!supportedTypes.includes(attrType.dataType)) {
        conflicts.push({
          type: 'attribute_type_mismatch',
          severity: 'error',
          message: `Unsupported attribute type: ${attrType.dataType}`,
          context: { attributeName: attrType.identifier },
        })
      }

      // Validate JSON schema for validation field
      if (attrType.validation) {
        try {
          JSON.parse(attrType.validation)
        } catch {
          conflicts.push({
            type: 'attribute_type_mismatch',
            severity: 'error',
            message: `Invalid validation schema for attribute type: ${attrType.identifier}`,
            context: { attributeName: attrType.identifier },
          })
        }
      }
    }

    return conflicts
  }

  private async validateAttributeConstraints(schema: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    for (const attr of schema.attributes || []) {
      // Check if required attribute type exists
      const hasAttributeType = schema.attributeTypes?.some(
        (at: any) => at.id === attr.attributeTypeId
      )
      if (!hasAttributeType) {
        conflicts.push({
          type: 'attribute_type_mismatch',
          severity: 'error',
          message: `Attribute '${attr.identifier}' references unknown attribute type: ${attr.attributeTypeId}`,
          context: { attributeName: attr.identifier },
        })
      }
    }

    return conflicts
  }

  private async validateNodeData(dataset: any, _schema: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    for (const node of dataset.nodes || []) {
      // Validate node structure
      if (!node.externalId) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: 'Node missing required externalId field',
          context: {},
        })
      }

      // Validate content structure
      if (node.content && typeof node.content !== 'object') {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'warning',
          message: `Node ${node.externalId} has invalid content structure`,
          context: {},
        })
      }
    }

    return conflicts
  }

  private async validateNodeAttributes(dataset: any, schema: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const nodeIds = new Set(dataset.nodes?.map((n: any) => n.externalId) || [])
    const attributeIds = new Set(schema.attributes?.map((a: any) => a.identifier) || [])

    for (const nodeAttr of dataset.nodeAttributes || []) {
      // Check if node exists
      if (!nodeIds.has(nodeAttr.nodeExternalId)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Node attribute references unknown node: ${nodeAttr.nodeExternalId}`,
          context: {},
        })
      }

      // Check if attribute exists
      if (!attributeIds.has(nodeAttr.attributeIdentifier)) {
        conflicts.push({
          type: 'attribute_type_mismatch',
          severity: 'error',
          message: `Node attribute references unknown attribute: ${nodeAttr.attributeIdentifier}`,
          context: { attributeName: nodeAttr.attributeIdentifier },
        })
      }
    }

    return conflicts
  }

  private async validateDataTypes(_dataset: any, _schema: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Implementation would validate data against attribute type constraints
    // This is a complex validation that would check each node attribute value
    // against its defined type and validation rules

    return conflicts
  }

  private async validateDuplicateData(dataset: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const externalIds = new Set()
    for (const node of dataset.nodes || []) {
      if (externalIds.has(node.externalId)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Duplicate node external ID: ${node.externalId}`,
          context: {},
        })
      }
      externalIds.add(node.externalId)
    }

    return conflicts
  }

  private async validateRelationshipReferences(
    relations: any,
    dataset: any
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const nodeIds = new Set(dataset.nodes?.map((n: any) => n.externalId) || [])

    for (const relation of relations.nodeRelations || []) {
      if (!nodeIds.has(relation.sourceExternalId)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Relation references unknown source node: ${relation.sourceExternalId}`,
          context: {},
        })
      }

      if (!nodeIds.has(relation.targetExternalId)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Relation references unknown target node: ${relation.targetExternalId}`,
          context: {},
        })
      }
    }

    return conflicts
  }

  private async validateRelationshipTypes(relations: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const relationTypeIds = new Set(relations.relationTypes?.map((rt: any) => rt.id) || [])

    for (const relation of relations.nodeRelations || []) {
      if (!relationTypeIds.has(relation.relationTypeId)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'error',
          message: `Relation references unknown relation type: ${relation.relationTypeId}`,
          context: {},
        })
      }
    }

    return conflicts
  }

  private async validateOrphanedRelationships(
    relations: any,
    _dataset: any
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check for relation types not used by any relations
    const usedRelationTypes = new Set(
      relations.nodeRelations?.map((r: any) => r.relationTypeId) || []
    )

    for (const relationType of relations.relationTypes || []) {
      if (!usedRelationTypes.has(relationType.id)) {
        conflicts.push({
          type: 'schema_incompatible',
          severity: 'warning',
          message: `Unused relation type: ${relationType.identifier}`,
          context: {},
        })
      }
    }

    return conflicts
  }

  private async validateTemplateVariables(template: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Parse template query to extract variable definitions
    const variableRegex = /\$(\w+):\s*(\w+)(!?)/g
    const definedVariables = new Set<string>()
    let match: RegExpExecArray | null

    match = variableRegex.exec(template.query)
    while (match !== null) {
      if (match[1]) {
        definedVariables.add(match[1])
      }
      match = variableRegex.exec(template.query)
    }

    // Check if variables schema matches defined variables
    if (template.variablesSchema) {
      const schemaVariables = new Set(Object.keys(template.variablesSchema.properties || {}))

      for (const variable of definedVariables) {
        if (!schemaVariables.has(variable)) {
          conflicts.push({
            type: 'template_exists',
            severity: 'warning',
            message: `Template '${template.identifier}' uses undefined variable: $${variable}`,
            context: { templateName: template.identifier },
          })
        }
      }
    }

    return conflicts
  }

  private async validateOperationType(template: any): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const query = template.query.trim()
    const actualType = query.startsWith('mutation')
      ? 'mutation'
      : query.startsWith('subscription')
        ? 'subscription'
        : 'query'

    if (actualType !== template.operationType) {
      conflicts.push({
        type: 'template_exists',
        severity: 'error',
        message: `Template '${template.identifier}' operation type mismatch: declared as '${template.operationType}' but query is '${actualType}'`,
        context: { templateName: template.identifier },
        suggestedResolution: `Change operationType to '${actualType}' or update query`,
      })
    }

    return conflicts
  }

  private async checkDeprecatedFeatures(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check for deprecated package version formats
    if (!packageData.version.match(/^\d+\.\d+\.\d+$/)) {
      conflicts.push({
        type: 'schema_incompatible',
        severity: 'warning',
        message: 'Package uses non-standard version format. Consider using semantic versioning.',
        context: { tableName: packageData.sourceTable.identifier },
      })
    }

    return conflicts
  }

  private async detectCircularDependencies(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    const dependencies = packageData.dependencies || []
    const tableId = packageData.sourceTable.identifier

    // Simple circular dependency detection
    if (dependencies.includes(tableId)) {
      conflicts.push({
        type: 'circular_dependency',
        severity: 'error',
        message: `Table '${tableId}' has circular dependency on itself`,
        context: { tableName: tableId },
      })
    }

    return conflicts
  }

  private async detectSensitiveData(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check for potential sensitive data patterns
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /credit[_-]?card/i,
      /ssn/i,
      /social[_-]?security/i,
    ]

    const checkObject = (obj: any, path: string) => {
      if (typeof obj === 'string') {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(obj)) {
            conflicts.push({
              type: 'schema_incompatible',
              severity: 'warning',
              message: `Potential sensitive data detected at ${path}`,
              context: { tableName: packageData.sourceTable.identifier },
              suggestedResolution: 'Review and sanitize sensitive data before import',
            })
            break
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          checkObject(value, `${path}.${key}`)
        }
      }
    }

    // Check nodes content
    for (const node of packageData.package.dataset.nodes || []) {
      if (node.content) {
        checkObject(node.content, `node.${node.externalId}.content`)
      }
    }

    return conflicts
  }

  private async validateTemplateSecurity(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    for (const template of packageData.package.templates.templates || []) {
      // Check for potential GraphQL injection patterns
      const suspiciousPatterns = [
        /\$\{.*\}/, // Template literal injection
        /eval\s*\(/i, // Eval functions
        /function\s*\(/i, // Function definitions
      ]

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(template.query)) {
          conflicts.push({
            type: 'template_exists',
            severity: 'warning',
            message: `Template '${template.identifier}' contains potentially unsafe patterns`,
            context: { templateName: template.identifier },
            suggestedResolution: 'Review template query for security issues',
          })
          break
        }
      }
    }

    return conflicts
  }

  private async detectInjectionVulnerabilities(
    packageData: TablePackageFormat
  ): Promise<TablePackageConflict[]> {
    const conflicts: TablePackageConflict[] = []

    // Check for SQL injection patterns in string data
    const sqlPatterns = [
      /;\s*(drop|delete|truncate|alter)\s+/i,
      /union\s+select/i,
      /'\s*or\s+'?\d*'?\s*=\s*'?\d*'?/i,
    ]

    const checkForSqlInjection = (data: any, context: string) => {
      if (typeof data === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(data)) {
            conflicts.push({
              type: 'schema_incompatible',
              severity: 'warning',
              message: `Potential SQL injection pattern detected in ${context}`,
              context: { tableName: packageData.sourceTable.identifier },
              suggestedResolution: 'Review and sanitize data before import',
            })
            break
          }
        }
      }
    }

    // Check all string data in the package
    for (const node of packageData.package.dataset.nodes || []) {
      if (node.content) {
        this.traverseObject(node.content, (value, path) => {
          checkForSqlInjection(value, `node.${node.externalId}.content.${path}`)
        })
      }
    }

    return conflicts
  }

  private traverseObject(obj: any, callback: (value: any, path: string) => void, path = ''): void {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key
        callback(value, newPath)
        if (typeof value === 'object' && value !== null) {
          this.traverseObject(value, callback, newPath)
        }
      }
    } else {
      callback(obj, path)
    }
  }
}
