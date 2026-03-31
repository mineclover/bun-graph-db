import type { ILogger } from '@/application/ports/ILogger.js'
import { ExportTablePackageUseCase } from '@/application/use-cases/table-packages/ExportTablePackageUseCase.js'
import type {
  ImportSession,
  QueryVariablesSchema,
  TablePackageConflict,
  TablePackageExportOptions,
  TablePackageFormat,
  TablePackageImportOptions,
  TablePackageImportResult,
} from '@/core/types/TablePackage.js'
import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { sanitizeJsonValue, type SafeJsonValue } from '@/shared/utils/safeJson.js'
import { BaseResolver } from '../base/BaseResolver.js'

interface ExportTablePackageArgs {
  input: {
    tableIdentifier: string
    options?: TablePackageExportOptions
  }
}

interface ExportRelatedTablePackagesArgs {
  tableIdentifiers: string[]
  options?: TablePackageExportOptions
}

interface AnalyzeTableDependenciesArgs {
  tableIdentifiers: string[]
}

interface ResolveImportOrderArgs {
  tableIdentifiers: string[]
}

type ResolverTablePackageSource = TablePackageFormat | ResolverTablePackageInput

type ResolverImportConflictResolution =
  | TablePackageImportOptions['conflictResolution']
  | Uppercase<TablePackageImportOptions['conflictResolution']>

interface ResolverImportOptionsInput extends Omit<Partial<TablePackageImportOptions>, 'conflictResolution'> {
  conflictResolution?: ResolverImportConflictResolution | null
}

type ValidateTablePackageRequest = {
  packageData: ResolverTablePackageSource
  options?: ResolverImportOptionsInput
}

type ValidateTablePackageArgs = ValidateTablePackageRequest | { input: ValidateTablePackageRequest }

interface ImportTablePackageArgs {
  input: {
    packageData: ResolverTablePackageSource
    options?: ResolverImportOptionsInput
  }
}

interface ImportTablePackagesArgs {
  packages: ResolverTablePackageSource[]
  options?: ResolverImportOptionsInput
}

interface BatchImportTablePackagesArgs {
  input: {
    packages: ResolverTablePackageSource[]
    options?: ResolverImportOptionsInput
    createSession?: boolean
  }
}

type CreateImportSessionRequest = {
  packages: ResolverTablePackageSource[]
}

type CreateImportSessionArgs = CreateImportSessionRequest | { input: CreateImportSessionRequest }

type GenerateTableTemplatesRequest = {
  tableIdentifier: string
  options?: PreviewGeneratedTemplatesArgs['options']
}

type GenerateTableTemplatesArgs = GenerateTableTemplatesRequest | { input: GenerateTableTemplatesRequest }

interface ExportTablePackageToFileArgs {
  tableIdentifier: string
  options?: TablePackageExportOptions
  outputPath?: string
}

interface ImportTablePackageFromFileArgs {
  filePath: string
  options?: ResolverImportOptionsInput
}

type ExportedNodeRelation = TablePackageFormat['package']['relations']['nodeRelations'][number] & {
  confidence?: number | null
}

type ResolverTablePackageExport = Omit<TablePackageFormat, 'package'> & {
  package: Omit<TablePackageFormat['package'], 'relations'> & {
    relations: Omit<TablePackageFormat['package']['relations'], 'nodeRelations'> & {
      nodeRelations: ExportedNodeRelation[]
    }
  }
}

type ResolvedConflictInput = NonNullable<TablePackageImportResult['resolvedConflicts']>[number]

type ResolverResolvedConflict = {
  type: Uppercase<ResolvedConflictInput['type']>
  originalName: string
  resolvedName: string
  action: Uppercase<ResolvedConflictInput['action']>
}

type ResolverImportSessionInfo = {
  sessionId: string
  status: Uppercase<ImportSession['status']>
  startedAt: string
  completedAt: string | null
  packagesImported: string[]
  packagesRemaining: string[]
  rollbackInfo: ImportSession['rollbackInfo']
  errors: string[]
}

type ResolverPackageConflict = {
  type: Uppercase<TablePackageConflict['type']>
  severity: Uppercase<TablePackageConflict['severity']>
  message: string
  context: TablePackageConflict['context']
  suggestedResolution?: string
}

type ResolverTablePackageMapped = {
  version: string
  exportedAt: string
  sourceTable: TablePackageFormat['sourceTable']
  dependencies: string[]
  package: {
    schema: {
      table: TablePackageFormat['package']['schema']['table']
      attributes: Array<{
        identifier: string
        name: string
        description: string | null
        attributeType: string
        isRequired: boolean
        defaultValue: null
      }>
      attributeTypes: Array<{
        identifier: string
        name: string
        description: string | null
        dataType: string
        validationRules: string | null
      }>
    }
    dataset: {
      nodes: Array<{
        id: string
        content: string
        contentHash: null
        metadata: TablePackageFormat['package']['dataset']['nodes'][number]['metadata']
        createdAt: string
        updatedAt: string
      }>
      nodeAttributes: Array<{
        nodeId: string
        attributeIdentifier: string
        value: string
        metadata: null
      }>
    }
    relations: {
      relationTypes: Array<{
        identifier: string
        name: string
        description: string | null
        isDirectional: boolean
        metadata: TablePackageFormat['package']['relations']['relationTypes'][number]['properties']
      }>
      nodeRelations: Array<{
        fromNodeId: string
        toNodeId: string
        relationTypeIdentifier: string
        strength: number
        confidence: number | null
        metadata: TablePackageFormat['package']['relations']['relationTypes'][number]['properties']
        createdAt: string
      }>
    }
    templates: {
      templates: Array<{
        identifier: string
        name: string
        description: string | null
        query: string
        variables: Record<string, unknown> | null
        operationType: TablePackageFormat['package']['templates']['templates'][number]['operationType']
        tags: string[]
        complexityScore: number
        metadata: {
          version: string
          isActive: boolean
          applicableTables: string[] | null
          inputSchema: TablePackageFormat['package']['templates']['templates'][number]['inputSchema']
          statistics: TablePackageFormat['package']['templates']['templates'][number]['statistics'] | null
        }
      }>
    }
  }
}

interface GetImportSessionArgs {
  sessionId: string
}

interface PreviewGeneratedTemplatesArgs {
  tableIdentifier: string
  options?: {
    includeCreate?: boolean
    includeRead?: boolean
    includeUpdate?: boolean
    includeDelete?: boolean
    includeSearch?: boolean
    includeBatch?: boolean
  }
}

interface BatchExportTablePackagesArgs {
  input: {
    tableIdentifiers: string[]
    options?: TablePackageExportOptions
    outputDirectory?: string
  }
}

interface RollbackImportSessionArgs {
  sessionId: string
}

interface ResolverTablePackageInputAttribute {
  identifier: string
  attributeType: string
  description?: string | null
  isRequired?: boolean
}

interface ResolverTablePackageInputAttributeType {
  identifier: string
  description?: string | null
  dataType: string
  validationRules?: unknown
}

interface ResolverTablePackageInputNode {
  id: string
  content: unknown
  metadata?: unknown
  createdAt?: string
  updatedAt?: string
}

interface ResolverTablePackageInputNodeAttribute {
  nodeId: string
  attributeIdentifier: string
  value: unknown
}

interface ResolverTablePackageInputRelationType {
  identifier: string
  description?: string | null
  metadata?: unknown
}

interface ResolverTablePackageInputRelation {
  fromNodeId: string
  toNodeId: string
  relationTypeIdentifier: string
  metadata?: unknown
  strength?: number
  createdAt?: string
}

interface ResolverTablePackageInputTemplate {
  identifier: string
  name: string
  description?: string | null
  query: string
  variables?: Record<string, unknown> | null
  operationType?: 'query' | 'mutation' | 'subscription' | string
  tags?: string[]
  complexityScore?: number
  metadata?: {
    version?: string
    isActive?: boolean
    applicableTables?: string[] | null
    inputSchema?: unknown
    statistics?: TablePackageFormat['package']['templates']['templates'][number]['statistics'] | null
  }
}

interface ResolverTablePackageInput {
  version: string
  exportedAt: string
  sourceTable: {
    identifier: string
    description: string | null
  }
  dependencies: string[]
  package: {
    schema: {
      table: TablePackageFormat['package']['schema']['table']
      attributes?: ResolverTablePackageInputAttribute[]
      attributeTypes?: ResolverTablePackageInputAttributeType[]
    }
    dataset: {
      nodes?: ResolverTablePackageInputNode[]
      nodeAttributes?: ResolverTablePackageInputNodeAttribute[]
    }
    relations: {
      relationTypes?: ResolverTablePackageInputRelationType[]
      nodeRelations?: ResolverTablePackageInputRelation[]
    }
    templates: {
      templates?: ResolverTablePackageInputTemplate[]
    }
  }
}

export class TablePackageResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tablePackageService: ITablePackageService,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  // Query Resolvers

  async exportTablePackage(_: unknown, args: ExportTablePackageArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const useCase = new ExportTablePackageUseCase(this.tablePackageService, this.logger)

      const response = await useCase.execute({
        tableIdentifier: args.input.tableIdentifier,
        options: args.input.options || {},
      })

      if (!response.success) {
        return {
          success: false,
          exportPath: null,
          package: null,
          errors: [response.error || 'Export failed'],
          warnings: [],
        }
      }

      return {
        success: true,
        exportPath: response.exportPath || null,
        package: response.result?.tablePackage ? this.mapTablePackageFormat(response.result.tablePackage) : null,
        errors: response.result?.errors || [],
        warnings: response.result?.warnings || [],
      }
    }, 'exportTablePackage')
  }

  async exportRelatedTablePackages(_: unknown, args: ExportRelatedTablePackagesArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const results = await this.tablePackageService.exportRelatedTables(args.tableIdentifiers, args.options || {})

      return results.map((result) => ({
        success: result.success,
        exportPath: result.packagePath || null,
        package: result.tablePackage ? this.mapTablePackageFormat(result.tablePackage) : null,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }))
    }, 'exportRelatedTablePackages')
  }

  async analyzeTableDependencies(_: unknown, args: AnalyzeTableDependenciesArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const results = []
      for (const tableIdentifier of args.tableIdentifiers) {
        const result = await this.tablePackageService.analyzeDependencies(tableIdentifier)
        results.push(result)
      }
      return results
    }, 'operation-name')
  }

  async resolveImportOrder(_: unknown, args: ResolveImportOrderArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      return await this.tablePackageService.resolveImportOrder(args.tableIdentifiers)
    }, 'operation-name')
  }

  async validateTablePackage(_: unknown, args: ValidateTablePackageArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const request = this.unwrapValidateTablePackageArgs(args)
      const packageData = this.mapTablePackageInput(request.packageData)
      const options = request.options ? this.mapImportOptions(request.options) : { conflictResolution: 'skip' as const }

      const conflicts = await this.tablePackageService.validatePackage(packageData, options)
      return conflicts.map(this.mapPackageConflict)
    }, 'operation-name')
  }

  async getImportSession(_: unknown, args: GetImportSessionArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const session = await this.tablePackageService.getImportSession(args.sessionId)
      return session ? this.mapImportSession(session) : null
    }, 'operation-name')
  }

  async listImportSessions(_: unknown, _args: Record<string, never>): Promise<unknown> {
    return this.handleQuery(async () => {
      // This would require a method to list all sessions
      // For now, return empty array
      return []
    }, 'operation-name')
  }

  async previewGeneratedTemplates(_: unknown, args: PreviewGeneratedTemplatesArgs): Promise<unknown> {
    return this.handleQuery(async () => {
      const result = await this.tablePackageService.generateTableTemplates(args.tableIdentifier, args.options || {})

      return {
        success: result.success,
        templates: result.templates.map((t) => ({
          id: '', // Will be set after creation
          identifier: t.identifier,
          name: t.name,
          operationType: t.operationType,
        })),
        errors: result.errors,
      }
    }, 'operation-name')
  }

  // Mutation Resolvers

  async importTablePackage(_: unknown, args: ImportTablePackageArgs): Promise<unknown> {
    try {
      const packageData = this.mapTablePackageInput(args.input.packageData)
      const options = args.input.options ? this.mapImportOptions(args.input.options) : { conflictResolution: 'skip' as const }

      const result = await this.tablePackageService.importTablePackage(packageData, options)

      // Debug logging to understand what's being returned
      this.logger.info('Import result details', {
        success: result.success,
        importedTable: result.importedTable,
        importedTableType: typeof result.importedTable,
        importedTableId: result.importedTable?.id,
        importedTableIdType: typeof result.importedTable?.id,
      })

      return {
        success: result.success,
        importedTable: result.success ? result.importedTable : null,
        generatedTemplates: result.generatedTemplates || [],
        resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }
    } catch (error) {
      this.logger.error(`Import table package failed`, toErrorMeta(error))
      return {
        success: false,
        importedTable: null,
        generatedTemplates: [],
        resolvedConflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown import error'],
        warnings: [],
      }
    }
  }

  async importTablePackages(_: unknown, args: ImportTablePackagesArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const packages = args.packages.map((pkg) => this.mapTablePackageInput(pkg))
      const options = args.options ? this.mapImportOptions(args.options) : { conflictResolution: 'skip' as const }

      const results = await this.tablePackageService.importTablePackages(packages, options)

      return results.map((result) => ({
        success: result.success,
        importedTable: result.importedTable,
        generatedTemplates: result.generatedTemplates || [],
        resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }))
    }, 'importTablePackages')
  }

  async batchExportTablePackages(_: unknown, args: BatchExportTablePackagesArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const results = await this.tablePackageService.exportRelatedTables(
        args.input.tableIdentifiers,
        args.input.options || {},
      )

      let exportedCount = 0
      let failedCount = 0
      const mappedResults = results.map((result) => {
        if (result.success) {
          exportedCount++
        } else {
          failedCount++
        }

        return {
          success: result.success,
          tablePackage: result.tablePackage ? this.mapTablePackageFormat(result.tablePackage) : null,
          dependencyOrder: result.dependencyOrder || [],
          packagePath: result.packagePath || null,
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        }
      })

      return {
        success: failedCount === 0,
        results: mappedResults,
        exportedCount,
        failedCount,
        outputDirectory: args.input.outputDirectory || null,
        errors: results.flatMap((r) => r.errors || []),
      }
    }, 'operation-name')
  }

  async batchImportTablePackages(_: unknown, args: BatchImportTablePackagesArgs): Promise<unknown> {
    try {
      const packages = args.input.packages.map((pkg) => this.mapTablePackageInput(pkg))
      const options = args.input.options ? this.mapImportOptions(args.input.options) : { conflictResolution: 'skip' as const }

      // Create session if requested
      let session = null
      if (args.input.createSession) {
        session = await this.tablePackageService.createImportSession(packages)
      }

      const results = await this.tablePackageService.importTablePackages(packages, options)

      let importedCount = 0
      let failedCount = 0
      results.forEach((result) => {
        if (result.success) {
          importedCount++
        } else {
          failedCount++
        }
      })

      return {
        success: failedCount === 0,
        results: results.map((result, index) => ({
          packageIdentifier: packages[index]?.sourceTable?.identifier || `package-${index}`,
          success: result.success,
          importedTable: result.importedTable,
          generatedTemplates: result.generatedTemplates || [],
          resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        })),
        summary: {
          total: results.length,
          succeeded: importedCount,
          failed: failedCount,
          skipped: 0,
        },
        importedCount,
        failedCount,
        session: session ? this.mapImportSession(session) : null,
        errors: results.flatMap((r) => r.errors ?? []),
      }
    } catch (error) {
      this.logger.error(`Batch import table packages failed`, toErrorMeta(error))
      return {
        success: false,
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 1,
          skipped: 0,
        },
        importedCount: 0,
        failedCount: 1,
        session: null,
        errors: [error instanceof Error ? error.message : 'Unknown batch import error'],
      }
    }
  }

  async createImportSession(_: unknown, args: CreateImportSessionArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const request = this.unwrapCreateImportSessionArgs(args)
      const packages = request.packages.map((pkg) => this.mapTablePackageInput(pkg))
      const session = await this.tablePackageService.createImportSession(packages)

      return this.mapImportSession(session)
    }, 'operation-name')
  }

  async rollbackImportSession(_: unknown, args: RollbackImportSessionArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      await this.tablePackageService.rollbackImportSession(args.sessionId)
      const session = await this.tablePackageService.getImportSession(args.sessionId)

      return session ? this.mapImportSession(session) : null
    }, 'operation-name')
  }

  async generateTableTemplates(_: unknown, args: GenerateTableTemplatesArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const request = this.unwrapGenerateTableTemplatesArgs(args)
      const result = await this.tablePackageService.generateTableTemplates(
        request.tableIdentifier,
        request.options || {},
      )

      return {
        success: result.success,
        templates: result.templates.map((t) => ({
          id: '', // Will be set after creation
          identifier: t.identifier,
          name: t.name,
          operationType: t.operationType,
        })),
        errors: result.errors,
      }
    }, 'operation-name')
  }

  async exportTablePackageToFile(_: unknown, args: ExportTablePackageToFileArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const useCase = new ExportTablePackageUseCase(this.tablePackageService, this.logger)

      const response = await useCase.execute({
        tableIdentifier: args.tableIdentifier,
        options: args.options || {},
        outputPath: args.outputPath,
      })

      if (!response.success) {
        return {
          success: false,
          exportPath: null,
          package: null,
          errors: [response.error || 'Export failed'],
          warnings: [],
        }
      }

      return {
        success: true,
        exportPath: response.exportPath || null,
        package: response.result?.tablePackage ? this.mapTablePackageFormat(response.result.tablePackage) : null,
        errors: response.result?.errors || [],
        warnings: response.result?.warnings || [],
      }
    }, 'operation-name')
  }

  async importTablePackageFromFile(_: unknown, args: ImportTablePackageFromFileArgs): Promise<unknown> {
    return this.handleMutation(async () => {
      const fs = await import('node:fs/promises')

      try {
        // Read the package file
        const fileContent = await fs.readFile(args.filePath, 'utf8')
        const packageData = this.mapTablePackageInput(JSON.parse(fileContent) as ResolverTablePackageSource)

        const options = args.options ? this.mapImportOptions(args.options) : { conflictResolution: 'skip' as const }
        const result = await this.tablePackageService.importTablePackage(packageData, options)

        return {
          success: result.success,
          importedTable: result.importedTable,
          generatedTemplates: result.generatedTemplates || [],
          resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        }
      } catch (error) {
        return {
          success: false,
          importedTable: null,
          generatedTemplates: [],
          resolvedConflicts: [],
          errors: [error instanceof Error ? error.message : 'Failed to read package file'],
          warnings: [],
        }
      }
    }, 'operation-name')
  }

  // Helper mapping methods

  private unwrapValidateTablePackageArgs(args: ValidateTablePackageArgs): ValidateTablePackageRequest {
    return 'input' in args ? args.input : args
  }

  private unwrapCreateImportSessionArgs(args: CreateImportSessionArgs): CreateImportSessionRequest {
    return 'input' in args ? args.input : args
  }

  private unwrapGenerateTableTemplatesArgs(args: GenerateTableTemplatesArgs): GenerateTableTemplatesRequest {
    return 'input' in args ? args.input : args
  }

  private isLegacyTablePackageInput(input: ResolverTablePackageSource): input is ResolverTablePackageInput {
    return (
      'attributeType' in (input.package.schema.attributes?.[0] ?? {}) ||
      'id' in (input.package.dataset.nodes?.[0] ?? {}) ||
      'fromNodeId' in (input.package.relations.nodeRelations?.[0] ?? {}) ||
      'metadata' in (input.package.templates.templates?.[0] ?? {})
    )
  }

  private isConflictResolution(
    value: string | undefined,
  ): value is TablePackageImportOptions['conflictResolution'] {
    return value === 'overwrite' || value === 'merge' || value === 'rename' || value === 'skip'
  }

  private toSafeJsonRecord(value: unknown): Record<string, SafeJsonValue> | null {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return sanitizeJsonValue(value) as Record<string, SafeJsonValue>
  }

  private toNodeContent(value: unknown): TablePackageFormat['package']['dataset']['nodes'][number]['content'] {
    if (value === null || value === undefined || typeof value === 'string') {
      return value ?? null
    }

    return this.toSafeJsonRecord(value)
  }

  private toNodeAttributeValue(value: unknown): SafeJsonValue {
    return sanitizeJsonValue(value)
  }

  private toOperationType(
    value: ResolverTablePackageInputTemplate['operationType'],
  ): TablePackageFormat['package']['templates']['templates'][number]['operationType'] {
    const normalizedValue = String(value ?? 'query').toLowerCase()

    if (normalizedValue === 'mutation' || normalizedValue === 'subscription') {
      return normalizedValue
    }

    return 'query'
  }

  private toInputSchema(value: unknown): QueryVariablesSchema | null {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as QueryVariablesSchema
  }

  private mapTablePackageFormat(packageData: ResolverTablePackageExport): ResolverTablePackageMapped {
    const attributeTypeById = new Map<string, string>(
      (packageData.package.schema.attributeTypes || []).map((attrType) => [attrType.id, attrType.identifier]),
    )
    const relationTypeById = new Map<string, string>(
      (packageData.package.relations.relationTypes || []).map((relType) => [relType.id, relType.identifier]),
    )

    return {
      version: packageData.version,
      exportedAt: packageData.exportedAt,
      sourceTable: packageData.sourceTable,
      dependencies: packageData.dependencies,
      package: {
        schema: {
          table: packageData.package.schema.table,
          attributes: (packageData.package.schema.attributes || []).map((attr) => ({
            identifier: attr.identifier,
            name: attr.identifier,
            description: attr.description,
            attributeType: attributeTypeById.get(attr.attributeTypeId) || attr.attributeTypeId,
            isRequired: attr.isRequired,
            defaultValue: null,
          })),
          attributeTypes: (packageData.package.schema.attributeTypes || []).map((attrType) => ({
            identifier: attrType.identifier,
            name: attrType.identifier,
            description: attrType.description,
            dataType: attrType.dataType,
            validationRules: attrType.validation ?? null,
          })),
        },
        dataset: {
          nodes: (packageData.package.dataset.nodes || []).map((node) => ({
            id: node.externalId,
            content:
              typeof node.content === 'string'
                ? node.content
                : node.content === null || node.content === undefined
                  ? ''
                  : JSON.stringify(node.content),
            contentHash: null,
            metadata: node.metadata ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
          })),
          nodeAttributes: (packageData.package.dataset.nodeAttributes || []).map((nodeAttr) => ({
            nodeId: nodeAttr.nodeExternalId,
            attributeIdentifier: nodeAttr.attributeIdentifier,
            value: String(nodeAttr.value ?? ''),
            metadata: null,
          })),
        },
        relations: {
          relationTypes: (packageData.package.relations.relationTypes || []).map((relType) => ({
            identifier: relType.identifier,
            name: relType.identifier,
            description: relType.description,
            isDirectional: false,
            metadata: relType.properties ?? null,
          })),
          nodeRelations: (packageData.package.relations.nodeRelations || []).map((relation) => ({
            fromNodeId: relation.sourceExternalId,
            toNodeId: relation.targetExternalId,
            relationTypeIdentifier: relationTypeById.get(relation.relationTypeId) || relation.relationTypeId,
            strength: relation.strength,
            confidence: relation.confidence ?? null,
            metadata: relation.properties ?? null,
            createdAt: relation.createdAt,
          })),
        },
        templates: {
          templates: (packageData.package.templates.templates || []).map((template) => ({
            identifier: template.identifier,
            name: template.name,
            description: template.description,
            query: template.query,
            variables: template.defaultVariables ?? template.variables ?? null,
            operationType: template.operationType,
            tags: template.tags,
            complexityScore: template.complexityScore,
            metadata: {
              version: template.version,
              isActive: template.isActive,
              applicableTables: template.applicableTables,
              inputSchema: template.inputSchema,
              statistics: template.statistics ?? null,
            },
          })),
        },
      },
    }
  }

  private mapTablePackageInput(input: ResolverTablePackageSource): TablePackageFormat {
    if (!this.isLegacyTablePackageInput(input)) {
      return input
    }

    const now = new Date().toISOString()
    const attributeTypeIdByIdentifier = new Map<string, string>()
    const relationTypeIdByIdentifier = new Map<string, string>()

    const attributeTypes = (input.package.schema.attributeTypes || []).map((attrType, index: number) => {
      const id = `attr-type-${index + 1}`
      attributeTypeIdByIdentifier.set(attrType.identifier, id)

      return {
        id,
        identifier: attrType.identifier,
        description: attrType.description || null,
        dataType: attrType.dataType,
        validation: attrType.validationRules ? JSON.stringify(attrType.validationRules) : null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      }
    })

    const relationTypes = (input.package.relations.relationTypes || []).map((relType, index: number) => {
      const id = `relation-type-${index + 1}`
      relationTypeIdByIdentifier.set(relType.identifier, id)

      return {
        id,
        identifier: relType.identifier,
        description: relType.description || null,
        properties: this.toSafeJsonRecord(relType.metadata),
        createdAt: now,
        updatedAt: now,
      }
    })

    return {
      version: input.version,
      exportedAt: input.exportedAt,
      sourceTable: input.sourceTable,
      dependencies: input.dependencies,
      package: {
        schema: {
          table: input.package.schema.table,
          attributes: (input.package.schema.attributes || []).map((attr) => ({
            identifier: attr.identifier,
            attributeTypeId: attributeTypeIdByIdentifier.get(attr.attributeType) || attr.attributeType,
            description: attr.description || null,
            isRequired: attr.isRequired ?? false,
            metadata: null,
            createdAt: now,
            updatedAt: now,
          })),
          attributeTypes,
        },
        dataset: {
          nodes: (input.package.dataset.nodes || []).map((node) => ({
            externalId: node.id,
            nodeType: 'node',
            content: this.toNodeContent(node.content),
            metadata: this.toSafeJsonRecord(node.metadata),
            createdAt: node.createdAt || now,
            updatedAt: node.updatedAt || now,
          })),
          nodeAttributes: (input.package.dataset.nodeAttributes || []).map((nodeAttr) => ({
            nodeExternalId: nodeAttr.nodeId,
            attributeIdentifier: nodeAttr.attributeIdentifier,
            value: this.toNodeAttributeValue(nodeAttr.value),
            createdAt: now,
            updatedAt: now,
          })),
        },
        relations: {
          relationTypes,
          nodeRelations: (input.package.relations.nodeRelations || []).map((relation) => ({
            sourceExternalId: relation.fromNodeId,
            targetExternalId: relation.toNodeId,
            relationTypeId:
              relationTypeIdByIdentifier.get(relation.relationTypeIdentifier) || relation.relationTypeIdentifier,
            properties: this.toSafeJsonRecord(relation.metadata),
            strength: relation.strength ?? 1,
            createdAt: relation.createdAt || now,
            updatedAt: relation.createdAt || now,
          })),
        },
        templates: {
          templates: (input.package.templates.templates || []).map((template) => ({
            identifier: template.identifier,
            name: template.name,
            description: template.description || null,
            query: template.query,
            queryName: [],
            operationType: this.toOperationType(template.operationType),
            variables: null,
            inputSchema: this.toInputSchema(template.metadata?.inputSchema),
            defaultVariables:
              template.variables && typeof template.variables === 'object' && !Array.isArray(template.variables)
                ? template.variables
                : null,
            applicableTables: template.metadata?.applicableTables || null,
            complexityScore: template.complexityScore ?? 1,
            version: template.metadata?.version || '1.0.0',
            tags: template.tags || [],
            isActive: template.metadata?.isActive ?? true,
          })),
        },
      },
    }
  }

  private mapImportOptions(options: ResolverImportOptionsInput): TablePackageImportOptions {
    const normalizedConflictResolution = options.conflictResolution?.toLowerCase()

    return {
      conflictResolution: this.isConflictResolution(normalizedConflictResolution)
        ? normalizedConflictResolution
        : 'skip',
      importData: options.importData,
      importRelations: options.importRelations,
      importTemplates: options.importTemplates,
      preserveStatistics: options.preserveStatistics,
      validateIntegrity: options.validateIntegrity,
      generateTemplates: options.generateTemplates,
      newTablePrefix: options.newTablePrefix,
    }
  }

  private mapResolvedConflict(conflict: ResolvedConflictInput): ResolverResolvedConflict {
    return {
      type: conflict.type.toUpperCase() as ResolverResolvedConflict['type'],
      originalName: conflict.originalName,
      resolvedName: conflict.resolvedName,
      action: conflict.action.toUpperCase() as ResolverResolvedConflict['action'],
    }
  }

  private mapImportSession(session: ImportSession): ResolverImportSessionInfo {
    return {
      sessionId: session.sessionId,
      status: session.status.toUpperCase() as ResolverImportSessionInfo['status'],
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
      packagesImported: session.packagesImported,
      packagesRemaining: session.packagesRemaining,
      rollbackInfo: session.rollbackInfo,
      errors: session.errors,
    }
  }

  private mapPackageConflict(conflict: TablePackageConflict): ResolverPackageConflict {
    return {
      type: conflict.type.toUpperCase() as ResolverPackageConflict['type'],
      severity: conflict.severity.toUpperCase() as ResolverPackageConflict['severity'],
      message: conflict.message,
      context: conflict.context,
      suggestedResolution: conflict.suggestedResolution,
    }
  }
}
