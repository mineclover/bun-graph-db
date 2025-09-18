import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  TablePackageExportOptions,
  TablePackageImportOptions,
  TablePackageFormat,
} from '@/core/types/TablePackage.js'
import { ExportTablePackageUseCase } from '@/application/use-cases/table-packages/ExportTablePackageUseCase.js'
import { ImportTablePackageUseCase } from '@/application/use-cases/table-packages/ImportTablePackageUseCase.js'
import { BatchImportTablePackagesUseCase } from '@/application/use-cases/table-packages/BatchImportTablePackagesUseCase.js'

/**
 * CLI Commands for Table Package Export/Import System
 *
 * Provides command-line interface for:
 * - Single table export/import operations
 * - Batch table package management
 * - Dependency analysis and resolution
 * - Template generation and validation
 */
export class TablePackageCommands {
  constructor(
    private readonly tablePackageService: ITablePackageService,
    private readonly logger: ILogger
  ) {}

  /**
   * Export a single table as a package
   *
   * Usage: bun run table:export <tableIdentifier> [options]
   */
  async exportTable(args: {
    tableIdentifier: string
    outputPath?: string
    includeData?: boolean
    includeRelations?: boolean
    includeTemplates?: boolean
    includeStatistics?: boolean
    resolveDependencies?: boolean
    prettyPrint?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting table export...', {
        tableIdentifier: args.tableIdentifier,
        outputPath: args.outputPath,
      })

      const options: TablePackageExportOptions = {
        includeData: args.includeData ?? true,
        includeRelations: args.includeRelations ?? true,
        includeTemplates: args.includeTemplates ?? true,
        includeStatistics: args.includeStatistics ?? false,
        resolveDependencies: args.resolveDependencies ?? true,
        prettyPrint: args.prettyPrint ?? true,
      }

      const useCase = new ExportTablePackageUseCase(this.tablePackageService, this.logger)
      const result = await useCase.execute({
        tableIdentifier: args.tableIdentifier,
        options,
        outputPath: args.outputPath,
      })

      if (!result.success) {
        console.error('❌ Export failed:', result.error)
        console.error('Errors:', result.result?.errors || [])
        process.exit(1)
      }

      console.log('✅ Table export completed successfully!')
      console.log(`📦 Package contains:`)
      if (result.result?.tablePackage) {
        const pkg = result.result.tablePackage
        console.log(`   - ${pkg.package.dataset.nodes.length} nodes`)
        console.log(`   - ${pkg.package.schema.attributes.length} attributes`)
        console.log(`   - ${pkg.package.relations.nodeRelations.length} relations`)
        console.log(`   - ${pkg.package.templates.templates.length} templates`)
        console.log(`   - Dependencies: ${pkg.dependencies.join(', ') || 'none'}`)
      }

      if (result.exportPath) {
        console.log(`📁 Exported to: ${result.exportPath}`)
      }

      if (result.result?.warnings && result.result.warnings.length > 0) {
        console.log('⚠️  Warnings:')
        for (const warning of result.result.warnings) {
          console.log(`   - ${warning}`)
        }
      }
    } catch (error) {
      this.logger.error('Table export command failed', { error })
      console.error('❌ Export failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Import a table package
   *
   * Usage: bun run table:import <packagePath> [options]
   */
  async importTable(args: {
    packagePath?: string
    packageData?: TablePackageFormat
    conflictResolution?: 'overwrite' | 'merge' | 'rename' | 'skip'
    importData?: boolean
    importRelations?: boolean
    importTemplates?: boolean
    preserveStatistics?: boolean
    validateIntegrity?: boolean
    generateTemplates?: boolean
    newTablePrefix?: string
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting table import...', {
        packagePath: args.packagePath,
        conflictResolution: args.conflictResolution,
      })

      const options: TablePackageImportOptions = {
        conflictResolution: args.conflictResolution || 'skip',
        importData: args.importData ?? true,
        importRelations: args.importRelations ?? true,
        importTemplates: args.importTemplates ?? true,
        preserveStatistics: args.preserveStatistics ?? true,
        validateIntegrity: args.validateIntegrity ?? true,
        generateTemplates: args.generateTemplates ?? true,
        newTablePrefix: args.newTablePrefix,
      }

      const useCase = new ImportTablePackageUseCase(this.tablePackageService, this.logger)
      const result = await useCase.execute({
        packagePath: args.packagePath,
        packageData: args.packageData,
        options,
      })

      if (!result.success) {
        console.error('❌ Import failed:', result.error)
        console.error('Errors:', result.result?.errors || [])
        process.exit(1)
      }

      console.log('✅ Table import completed successfully!')

      if (result.result?.importedTable) {
        const table = result.result.importedTable
        console.log(`📦 Imported table:`)
        console.log(`   - ID: ${table.id}`)
        console.log(`   - Identifier: ${table.identifier}`)
        console.log(`   - Original: ${table.originalIdentifier}`)
      }

      if (result.result?.generatedTemplates && result.result.generatedTemplates.length > 0) {
        console.log(`🔧 Generated templates:`)
        for (const template of result.result.generatedTemplates) {
          console.log(`   - ${template.name} (${template.operationType})`)
        }
      }

      if (result.result?.resolvedConflicts && result.result.resolvedConflicts.length > 0) {
        console.log(`⚡ Resolved conflicts:`)
        for (const conflict of result.result.resolvedConflicts) {
          console.log(`   - ${conflict.type}: ${conflict.originalName} → ${conflict.resolvedName} (${conflict.action})`)
        }
      }

      if (result.result?.warnings && result.result.warnings.length > 0) {
        console.log('⚠️  Warnings:')
        for (const warning of result.result.warnings) {
          console.log(`   - ${warning}`)
        }
      }
    } catch (error) {
      this.logger.error('Table import command failed', { error })
      console.error('❌ Import failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Batch export multiple tables
   *
   * Usage: bun run table:batch-export <tableIdentifiers...> [options]
   */
  async batchExport(args: {
    tableIdentifiers: string[]
    outputDirectory?: string
    includeData?: boolean
    includeRelations?: boolean
    includeTemplates?: boolean
    includeStatistics?: boolean
    resolveDependencies?: boolean
    prettyPrint?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting batch table export...', {
        tableCount: args.tableIdentifiers.length,
        outputDirectory: args.outputDirectory,
      })

      const options: TablePackageExportOptions = {
        includeData: args.includeData ?? true,
        includeRelations: args.includeRelations ?? true,
        includeTemplates: args.includeTemplates ?? true,
        includeStatistics: args.includeStatistics ?? false,
        resolveDependencies: args.resolveDependencies ?? true,
        prettyPrint: args.prettyPrint ?? true,
      }

      const results = await this.tablePackageService.exportRelatedTables(
        args.tableIdentifiers,
        options
      )

      let successCount = 0
      let failureCount = 0

      console.log('📊 Batch export results:')
      for (const [index, result] of results.entries()) {
        const identifier = args.tableIdentifiers[index]

        if (result.success) {
          successCount++
          console.log(`✅ ${identifier}: exported successfully`)
          if (result.packagePath) {
            console.log(`   📁 Path: ${result.packagePath}`)
          }
        } else {
          failureCount++
          console.log(`❌ ${identifier}: export failed`)
          console.log(`   Error: ${result.errors?.[0] || 'Unknown error'}`)
        }
      }

      console.log(`\n📈 Summary: ${successCount} successful, ${failureCount} failed`)

      if (args.outputDirectory) {
        console.log(`📁 All packages exported to: ${args.outputDirectory}`)
      }

      if (failureCount > 0) {
        process.exit(1)
      }
    } catch (error) {
      this.logger.error('Batch export command failed', { error })
      console.error('❌ Batch export failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Batch import multiple table packages
   *
   * Usage: bun run table:batch-import <packagePaths...> [options]
   */
  async batchImport(args: {
    packagePaths: string[]
    conflictResolution?: 'overwrite' | 'merge' | 'rename' | 'skip'
    importData?: boolean
    importRelations?: boolean
    importTemplates?: boolean
    preserveStatistics?: boolean
    validateIntegrity?: boolean
    generateTemplates?: boolean
    newTablePrefix?: string
    createSession?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting batch table import...', {
        packageCount: args.packagePaths.length,
        conflictResolution: args.conflictResolution,
        createSession: args.createSession,
      })

      // Load all package files
      const fs = await import('node:fs/promises')
      const packages: TablePackageFormat[] = []

      for (const packagePath of args.packagePaths) {
        try {
          const fileContent = await fs.readFile(packagePath, 'utf8')
          const packageData = JSON.parse(fileContent)
          packages.push(packageData)
          console.log(`📦 Loaded package: ${packageData.sourceTable.identifier}`)
        } catch (error) {
          console.error(`❌ Failed to load package from ${packagePath}:`, error)
          process.exit(1)
        }
      }

      const options: TablePackageImportOptions = {
        conflictResolution: args.conflictResolution || 'skip',
        importData: args.importData ?? true,
        importRelations: args.importRelations ?? true,
        importTemplates: args.importTemplates ?? true,
        preserveStatistics: args.preserveStatistics ?? true,
        validateIntegrity: args.validateIntegrity ?? true,
        generateTemplates: args.generateTemplates ?? true,
        newTablePrefix: args.newTablePrefix,
      }

      const useCase = new BatchImportTablePackagesUseCase(this.tablePackageService, this.logger)
      const result = await useCase.execute({
        packages,
        options,
        createSession: args.createSession ?? true,
      })

      if (!result.success) {
        console.error('❌ Batch import failed:', result.error)
        process.exit(1)
      }

      console.log('✅ Batch import completed!')
      console.log('📊 Import summary:', result.summary)

      if (result.session) {
        console.log(`📋 Import session: ${result.session.sessionId}`)
        console.log(`   Status: ${result.session.status}`)
        console.log(`   Imported: ${result.session.packagesImported.length}`)
        console.log(`   Remaining: ${result.session.packagesRemaining.length}`)
      }

      if (result.results && result.results.length > 0) {
        console.log('\n📈 Individual results:')
        for (const [index, res] of result.results.entries()) {
          const packageId = packages[index]?.sourceTable.identifier || `Package ${index + 1}`

          if (res.success) {
            console.log(`✅ ${packageId}: imported successfully`)
            if (res.importedTable) {
              console.log(`   Table: ${res.importedTable.identifier} (ID: ${res.importedTable.id})`)
            }
            if (res.generatedTemplates && res.generatedTemplates.length > 0) {
              console.log(`   Templates: ${res.generatedTemplates.length} generated`)
            }
          } else {
            console.log(`❌ ${packageId}: import failed`)
            console.log(`   Errors: ${res.errors?.join(', ') || 'Unknown error'}`)
          }
        }
      }
    } catch (error) {
      this.logger.error('Batch import command failed', { error })
      console.error('❌ Batch import failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Analyze table dependencies
   *
   * Usage: bun run table:analyze-deps <tableIdentifier>
   */
  async analyzeDependencies(args: { tableIdentifier: string }): Promise<void> {
    try {
      console.log(`🔍 Analyzing dependencies for table: ${args.tableIdentifier}`)

      const dependencies = await this.tablePackageService.analyzeDependencies(args.tableIdentifier)

      console.log('\n📊 Dependency Analysis:')
      console.log(`Table: ${dependencies.tableIdentifier}`)
      console.log(`Depth: ${dependencies.depth}`)

      if (dependencies.dependencies.length > 0) {
        console.log('\n⬇️  Dependencies (tables this table depends on):')
        for (const dep of dependencies.dependencies) {
          console.log(`   - ${dep}`)
        }
      } else {
        console.log('\n✅ No dependencies found')
      }

      if (dependencies.dependents.length > 0) {
        console.log('\n⬆️  Dependents (tables that depend on this table):')
        for (const dep of dependencies.dependents) {
          console.log(`   - ${dep}`)
        }
      } else {
        console.log('\n✅ No dependents found')
      }

      if (dependencies.circularReferences.length > 0) {
        console.log('\n🔄 Circular Dependencies:')
        for (const ref of dependencies.circularReferences) {
          console.log(`   - ${ref}`)
        }
        console.log('\n⚠️  Warning: Circular dependencies may cause import issues')
      }
    } catch (error) {
      this.logger.error('Dependency analysis command failed', { error })
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Resolve import order for multiple tables
   *
   * Usage: bun run table:resolve-order <tableIdentifiers...>
   */
  async resolveImportOrder(args: { tableIdentifiers: string[] }): Promise<void> {
    try {
      console.log(`🔍 Resolving import order for ${args.tableIdentifiers.length} tables...`)

      const importOrder = await this.tablePackageService.resolveImportOrder(args.tableIdentifiers)

      console.log('\n📋 Recommended Import Order:')
      for (const [index, identifier] of importOrder.entries()) {
        console.log(`${index + 1}. ${identifier}`)
      }

      console.log('\n💡 Import in this order to resolve dependencies correctly')
    } catch (error) {
      this.logger.error('Import order resolution command failed', { error })
      console.error('❌ Resolution failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Generate templates for a table
   *
   * Usage: bun run table:generate-templates <tableIdentifier> [options]
   */
  async generateTemplates(args: {
    tableIdentifier: string
    includeCreate?: boolean
    includeRead?: boolean
    includeUpdate?: boolean
    includeDelete?: boolean
    includeSearch?: boolean
    includeBatch?: boolean
  }): Promise<void> {
    try {
      console.log(`🔧 Generating templates for table: ${args.tableIdentifier}`)

      const result = await this.tablePackageService.generateTableTemplates(
        args.tableIdentifier,
        {
          includeCreate: args.includeCreate ?? true,
          includeRead: args.includeRead ?? true,
          includeUpdate: args.includeUpdate ?? true,
          includeDelete: args.includeDelete ?? true,
          includeSearch: args.includeSearch ?? true,
          includeBatch: args.includeBatch ?? false,
        }
      )

      if (!result.success) {
        console.error('❌ Template generation failed')
        console.error('Errors:', result.errors)
        process.exit(1)
      }

      console.log('✅ Templates generated successfully!')
      console.log(`📝 Generated ${result.templates.length} templates:`)

      for (const template of result.templates) {
        console.log(`   - ${template.name} (${template.operationType})`)
        console.log(`     Identifier: ${template.identifier}`)
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors during generation:')
        for (const error of result.errors) {
          console.log(`   - ${error}`)
        }
      }
    } catch (error) {
      this.logger.error('Template generation command failed', { error })
      console.error('❌ Generation failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Validate a table package
   *
   * Usage: bun run table:validate <packagePath>
   */
  async validatePackage(args: { packagePath: string }): Promise<void> {
    try {
      console.log(`🔍 Validating package: ${args.packagePath}`)

      // Load package file
      const fs = await import('node:fs/promises')
      const fileContent = await fs.readFile(args.packagePath, 'utf8')
      const packageData = JSON.parse(fileContent)

      const conflicts = await this.tablePackageService.validatePackage(
        packageData,
        { conflictResolution: 'skip' }
      )

      console.log('\n📊 Validation Results:')
      console.log(`Package: ${packageData.sourceTable.identifier}`)
      console.log(`Version: ${packageData.version}`)
      console.log(`Exported: ${packageData.exportedAt}`)

      const errors = conflicts.filter(c => c.severity === 'error')
      const warnings = conflicts.filter(c => c.severity === 'warning')

      if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ Package is valid and ready for import!')
      } else {
        if (errors.length > 0) {
          console.log('\n❌ Errors found:')
          for (const error of errors) {
            console.log(`   - ${error.message}`)
            if (error.suggestedResolution) {
              console.log(`     💡 Suggestion: ${error.suggestedResolution}`)
            }
          }
        }

        if (warnings.length > 0) {
          console.log('\n⚠️  Warnings:')
          for (const warning of warnings) {
            console.log(`   - ${warning.message}`)
          }
        }

        if (errors.length > 0) {
          console.log('\n🚫 Package cannot be imported due to errors')
          process.exit(1)
        }
      }
    } catch (error) {
      this.logger.error('Package validation command failed', { error })
      console.error('❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }
}