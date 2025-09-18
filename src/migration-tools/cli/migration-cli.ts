#!/usr/bin/env bun
/**
 * Migration CLI - Command line interface for the test migration system
 */

import { MigrationService } from '../services/MigrationService'
import { TestContextManager } from '../services/TestContextManager'
import { PerformanceMonitor } from '../services/PerformanceMonitor'
import { MigrationTargetValidator, type MigrationTarget } from '../models/MigrationTarget'
import { TestDatabaseFactory } from '../../../tests/fixtures/test-database-factory'

interface CLIOptions {
  target?: string
  type?: 'unit' | 'integration' | 'e2e'
  dryRun?: boolean
  backup?: boolean
  verbose?: boolean
  outputFormat?: 'json' | 'text'
  configFile?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  enforceFileBased?: boolean
  performanceMonitoring?: boolean
}

class MigrationCLI {
  private migrationService: MigrationService
  private contextManager: TestContextManager
  private performanceMonitor: PerformanceMonitor

  constructor() {
    this.migrationService = MigrationService.getInstance()
    this.contextManager = new TestContextManager()
    this.performanceMonitor = new PerformanceMonitor()
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    try {
      if (args.length === 0) {
        this.showHelp()
        return
      }

      const command = args[0]
      const options = this.parseOptions(args.slice(1))

      switch (command) {
        case 'analyze':
          await this.handleAnalyze(options)
          break
        case 'execute':
          await this.handleExecute(options)
          break
        case 'validate':
          await this.handleValidate(options)
          break
        case 'report':
          await this.handleReport(options)
          break
        case 'rollback':
          await this.handleRollback(options)
          break
        case 'help':
        case '--help':
        case '-h':
          this.showHelp()
          break
        default:
          console.error(`Unknown command: ${command}`)
          this.showHelp()
          process.exit(1)
      }
    } catch (error) {
      console.error('Migration CLI error:', error)
      process.exit(1)
    }
  }

  /**
   * Analyze migration target
   */
  private async handleAnalyze(options: CLIOptions): Promise<void> {
    if (!options.target) {
      console.error('Error: --target is required for analyze command')
      process.exit(1)
    }

    const target = this.createMigrationTarget(options)
    const analysis = await this.migrationService.analyzeMigrationTarget(target)

    if (options.outputFormat === 'json') {
      console.log(JSON.stringify(analysis, null, 2))
    } else {
      this.printAnalysis(analysis)
    }
  }

  /**
   * Execute migration
   */
  private async handleExecute(options: CLIOptions): Promise<void> {
    if (!options.target) {
      console.error('Error: --target is required for execute command')
      process.exit(1)
    }

    const target = this.createMigrationTarget(options)

    if (options.verbose) {
      console.log(`Executing migration for: ${target.testFilePath}`)
      console.log(`Type: ${target.testType}`)
      console.log(`Priority: ${target.migrationPriority}`)
      console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}`)
    }

    const migrationOptions = {
      dryRun: options.dryRun || false,
      createBackup: options.backup !== false, // Default to true
      enforceFileBased: options.enforceFileBased !== false, // Default to true
      performanceMonitoring: options.performanceMonitoring !== false // Default to true
    }

    const result = await this.migrationService.executeMigration(target, migrationOptions)

    if (options.outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2))
    } else {
      this.printMigrationResult(result)
    }

    if (!result.success) {
      process.exit(1)
    }
  }

  /**
   * Validate migration target
   */
  private async handleValidate(options: CLIOptions): Promise<void> {
    if (!options.target) {
      console.error('Error: --target is required for validate command')
      process.exit(1)
    }

    const target = this.createMigrationTarget(options)
    const validation = await this.migrationService.validateMigration(target)

    if (options.outputFormat === 'json') {
      console.log(JSON.stringify(validation, null, 2))
    } else {
      this.printValidationResult(validation)
    }

    if (!validation.isValid) {
      process.exit(1)
    }
  }

  /**
   * Generate migration report
   */
  private async handleReport(options: CLIOptions): Promise<void> {
    console.log('Migration System Report')
    console.log('=====================')

    // Global validation
    const globalValidation = TestDatabaseFactory.validateFileBasedEnforcement()
    console.log(`\nFile-based Database Enforcement: ${globalValidation.isValid ? 'PASS' : 'FAIL'}`)

    if (!globalValidation.isValid) {
      console.log('Violations:')
      globalValidation.violations.forEach(violation => {
        console.log(`  - ${violation}`)
      })
    }

    // Performance monitoring status
    console.log('\nPerformance Monitoring: Enabled')

    // Available test files for migration
    const testFiles = await this.findTestFiles()
    console.log(`\nAvailable test files: ${testFiles.length}`)

    testFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`)
    })

    if (options.outputFormat === 'json') {
      const report = {
        fileBasedEnforcement: globalValidation,
        availableTestFiles: testFiles,
        timestamp: new Date().toISOString()
      }
      console.log('\nJSON Report:')
      console.log(JSON.stringify(report, null, 2))
    }
  }

  /**
   * Handle rollback operation
   */
  private async handleRollback(options: CLIOptions): Promise<void> {
    console.log('Rollback functionality not yet implemented')
    console.log('For manual rollback, restore from .backup files created during migration')
  }

  /**
   * Parse command line options
   */
  private parseOptions(args: string[]): CLIOptions {
    const options: CLIOptions = {}

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const nextArg = args[i + 1]

      switch (arg) {
        case '--target':
        case '-t':
          options.target = nextArg
          i++
          break
        case '--type':
          if (nextArg && ['unit', 'integration', 'e2e'].includes(nextArg)) {
            options.type = nextArg as 'unit' | 'integration' | 'e2e'
            i++
          }
          break
        case '--dry-run':
        case '--dry':
          options.dryRun = true
          break
        case '--no-backup':
          options.backup = false
          break
        case '--verbose':
        case '-v':
          options.verbose = true
          break
        case '--json':
          options.outputFormat = 'json'
          break
        case '--priority':
          if (nextArg && ['low', 'medium', 'high', 'critical'].includes(nextArg)) {
            options.priority = nextArg as 'low' | 'medium' | 'high' | 'critical'
            i++
          }
          break
        case '--no-file-based':
          options.enforceFileBased = false
          break
        case '--no-performance':
          options.performanceMonitoring = false
          break
        case '--config':
          options.configFile = nextArg
          i++
          break
      }
    }

    return options
  }

  /**
   * Create migration target from options
   */
  private createMigrationTarget(options: CLIOptions): MigrationTarget {
    if (!options.target) {
      throw new Error('Target file path is required')
    }

    // Infer test type from path if not specified
    let testType = options.type
    if (!testType) {
      if (options.target.includes('/unit/')) testType = 'unit'
      else if (options.target.includes('/integration/')) testType = 'integration'
      else if (options.target.includes('/e2e/')) testType = 'e2e'
      else testType = 'unit' // Default
    }

    const target = MigrationTargetValidator.createDefault(options.target, testType)

    // Override with CLI options
    if (options.priority) {
      target.migrationPriority = options.priority
    }

    return target
  }

  /**
   * Find test files in the project
   */
  private async findTestFiles(): Promise<string[]> {
    // This is a simplified implementation
    // In a real implementation, would scan the filesystem
    return [
      'tests/unit/template-creation.test.ts',
      'tests/unit/query-name-indexing.test.ts',
      'tests/unit/performance-tracking.test.ts',
      'tests/integration/system-queries-integration.test.ts',
      'tests/integration/doc-system-comprehensive.test.ts',
      'tests/e2e/doc-system-e2e.test.ts'
    ]
  }

  /**
   * Print analysis results in human-readable format
   */
  private printAnalysis(analysis: any): void {
    console.log('Migration Analysis')
    console.log('==================')
    console.log(`Target: ${analysis.target.testFilePath}`)
    console.log(`Type: ${analysis.target.testType}`)
    console.log(`Estimated Time: ${analysis.estimatedTime} minutes`)
    console.log(`Feasibility: ${(analysis.feasibility * 100).toFixed(1)}%`)

    if (analysis.requiredTools && analysis.requiredTools.length > 0) {
      console.log('\nRequired Tools:')
      analysis.requiredTools.forEach((tool: string) => {
        console.log(`  - ${tool}`)
      })
    }

    if (analysis.risks && analysis.risks.length > 0) {
      console.log('\nRisks:')
      analysis.risks.forEach((risk: string) => {
        console.log(`  - ${risk}`)
      })
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      console.log('\nRecommendations:')
      analysis.recommendations.forEach((rec: string) => {
        console.log(`  - ${rec}`)
      })
    }

    if (analysis.performanceImpact) {
      console.log('\nPerformance Impact:')
      console.log(`  Execution Time: ${analysis.performanceImpact.executionTime}ms`)
      console.log(`  Memory Usage: ${analysis.performanceImpact.resourceUsage.memory}MB`)
      console.log(`  CPU Usage: ${analysis.performanceImpact.resourceUsage.cpu}%`)
      console.log(`  Parallelizable: ${analysis.performanceImpact.parallelizability ? 'Yes' : 'No'}`)
    }
  }

  /**
   * Print migration result in human-readable format
   */
  private printMigrationResult(result: any): void {
    console.log('Migration Result')
    console.log('================')
    console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`Phase: ${result.status}`)

    if (result.migratedFilePath) {
      console.log(`Migrated File: ${result.migratedFilePath}`)
    }

    if (result.logs && result.logs.length > 0) {
      console.log('\nLogs:')
      result.logs.forEach((log: string) => {
        console.log(`  ${log}`)
      })
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\nErrors:')
      result.errors.forEach((error: string) => {
        console.log(`  - ${error}`)
      })
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log('\nWarnings:')
      result.warnings.forEach((warning: string) => {
        console.log(`  - ${warning}`)
      })
    }

    if (result.risks && result.risks.length > 0) {
      console.log('\nRisks:')
      result.risks.forEach((risk: any) => {
        console.log(`  - ${risk.level.toUpperCase()}: ${risk.description}`)
      })
    }
  }

  /**
   * Print validation result in human-readable format
   */
  private printValidationResult(validation: any): void {
    console.log('Validation Result')
    console.log('=================')
    console.log(`Status: ${validation.isValid ? 'VALID' : 'INVALID'}`)
    console.log(`Score: ${validation.complianceScore}/100`)

    if (validation.errors && validation.errors.length > 0) {
      console.log('\nErrors:')
      validation.errors.forEach((error: any) => {
        console.log(`  - ${error.description}`)
        if (error.suggestion) {
          console.log(`    Suggestion: ${error.suggestion}`)
        }
      })
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.log('\nWarnings:')
      validation.warnings.forEach((warning: any) => {
        console.log(`  - ${warning.description}`)
        if (warning.suggestion) {
          console.log(`    Suggestion: ${warning.suggestion}`)
        }
      })
    }
  }

  /**
   * Show CLI help
   */
  private showHelp(): void {
    console.log(`
Migration CLI - Test Migration System

USAGE:
  migration-cli <command> [options]

COMMANDS:
  analyze     Analyze a migration target
  execute     Execute migration
  validate    Validate migration target
  report      Generate migration system report
  rollback    Rollback migration (not yet implemented)
  help        Show this help message

OPTIONS:
  --target, -t <path>     Target test file path (required for most commands)
  --type <type>           Test type: unit, integration, e2e
  --dry-run, --dry        Perform dry run without making changes
  --no-backup             Skip creating backup files
  --verbose, -v           Verbose output
  --json                  Output in JSON format
  --priority <level>      Migration priority: low, medium, high, critical
  --no-file-based         Disable file-based database enforcement
  --no-performance        Disable performance monitoring
  --config <file>         Configuration file path

EXAMPLES:
  # Analyze a test file
  migration-cli analyze --target tests/unit/template-creation.test.ts

  # Execute migration with dry run
  migration-cli execute --target tests/unit/sample.test.ts --dry-run --verbose

  # Validate multiple files
  migration-cli validate --target tests/integration/system.test.ts --json

  # Generate system report
  migration-cli report

  # Execute migration with specific options
  migration-cli execute --target tests/e2e/full.test.ts --priority high --no-backup

For more information, see: specs/004-testing-md/
`)
  }
}

// CLI entry point
if (import.meta.main) {
  const cli = new MigrationCLI()
  const args = process.argv.slice(2)
  cli.run(args).catch(error => {
    console.error('CLI error:', error)
    process.exit(1)
  })
}

export { MigrationCLI }