#!/usr/bin/env bun

/**
 * Table Package CLI Runner
 *
 * Command-line interface for table package export/import operations
 */

import { Container } from '@/infrastructure/di/Container.js'
import { TablePackageCommands } from '@/application/cli/commands/TablePackageCommands.js'

const container = Container.getInstance()

// Get services from container
const tablePackageService = container.getTablePackageService()
const logger = container.getLogger()

// Create CLI commands instance
const commands = new TablePackageCommands(tablePackageService, logger)

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    switch (command) {
      case 'export': {
        const tableIdentifier = args[1]
        if (!tableIdentifier) {
          console.error('❌ Error: Table identifier is required')
          console.log('Usage: bun run table:export <tableIdentifier> [options]')
          process.exit(1)
        }

        const outputPath = args.find((_arg, i) => args[i - 1] === '--output')
        const includeData = !args.includes('--no-data')
        const includeRelations = !args.includes('--no-relations')
        const includeTemplates = !args.includes('--no-templates')
        const includeStatistics = args.includes('--statistics')
        const resolveDependencies = !args.includes('--no-dependencies')
        const prettyPrint = !args.includes('--compact')

        await commands.exportTable({
          tableIdentifier,
          outputPath,
          includeData,
          includeRelations,
          includeTemplates,
          includeStatistics,
          resolveDependencies,
          prettyPrint,
        })
        break
      }

      case 'import': {
        const packagePath = args[1]
        if (!packagePath) {
          console.error('❌ Error: Package path is required')
          console.log('Usage: bun run table:import <packagePath> [options]')
          process.exit(1)
        }

        const conflictResolution = (args.find((_arg, i) => args[i - 1] === '--conflict') || 'skip') as any
        const importData = !args.includes('--no-data')
        const importRelations = !args.includes('--no-relations')
        const importTemplates = !args.includes('--no-templates')
        const preserveStatistics = !args.includes('--no-preserve-stats')
        const validateIntegrity = !args.includes('--no-validate')
        const generateTemplates = !args.includes('--no-generate')
        const newTablePrefix = args.find((_arg, i) => args[i - 1] === '--prefix')

        await commands.importTable({
          packagePath,
          conflictResolution,
          importData,
          importRelations,
          importTemplates,
          preserveStatistics,
          validateIntegrity,
          generateTemplates,
          newTablePrefix,
        })
        break
      }

      case 'batch-export': {
        const tableIdentifiers = args.slice(1).filter(arg => !arg.startsWith('--'))
        if (tableIdentifiers.length === 0) {
          console.error('❌ Error: At least one table identifier is required')
          console.log('Usage: bun run table:batch-export <tableIdentifier1> [tableIdentifier2...] [options]')
          process.exit(1)
        }

        const outputDirectory = args.find((_arg, i) => args[i - 1] === '--output-dir')
        const includeData = !args.includes('--no-data')
        const includeRelations = !args.includes('--no-relations')
        const includeTemplates = !args.includes('--no-templates')
        const includeStatistics = args.includes('--statistics')
        const resolveDependencies = !args.includes('--no-dependencies')
        const prettyPrint = !args.includes('--compact')

        await commands.batchExport({
          tableIdentifiers,
          outputDirectory,
          includeData,
          includeRelations,
          includeTemplates,
          includeStatistics,
          resolveDependencies,
          prettyPrint,
        })
        break
      }

      case 'batch-import': {
        const packagePaths = args.slice(1).filter(arg => !arg.startsWith('--'))
        if (packagePaths.length === 0) {
          console.error('❌ Error: At least one package path is required')
          console.log('Usage: bun run table:batch-import <packagePath1> [packagePath2...] [options]')
          process.exit(1)
        }

        const conflictResolution = (args.find((_arg, i) => args[i - 1] === '--conflict') || 'skip') as any
        const importData = !args.includes('--no-data')
        const importRelations = !args.includes('--no-relations')
        const importTemplates = !args.includes('--no-templates')
        const preserveStatistics = !args.includes('--no-preserve-stats')
        const validateIntegrity = !args.includes('--no-validate')
        const generateTemplates = !args.includes('--no-generate')
        const newTablePrefix = args.find((_arg, i) => args[i - 1] === '--prefix')
        const createSession = !args.includes('--no-session')

        await commands.batchImport({
          packagePaths,
          conflictResolution,
          importData,
          importRelations,
          importTemplates,
          preserveStatistics,
          validateIntegrity,
          generateTemplates,
          newTablePrefix,
          createSession,
        })
        break
      }

      case 'analyze-deps': {
        const tableIdentifier = args[1]
        if (!tableIdentifier) {
          console.error('❌ Error: Table identifier is required')
          console.log('Usage: bun run table:analyze-deps <tableIdentifier>')
          process.exit(1)
        }

        await commands.analyzeDependencies({ tableIdentifier })
        break
      }

      case 'resolve-order': {
        const tableIdentifiers = args.slice(1)
        if (tableIdentifiers.length === 0) {
          console.error('❌ Error: At least one table identifier is required')
          console.log('Usage: bun run table:resolve-order <tableIdentifier1> [tableIdentifier2...]')
          process.exit(1)
        }

        await commands.resolveImportOrder({ tableIdentifiers })
        break
      }

      case 'generate-templates': {
        const tableIdentifier = args[1]
        if (!tableIdentifier) {
          console.error('❌ Error: Table identifier is required')
          console.log('Usage: bun run table:generate-templates <tableIdentifier> [options]')
          process.exit(1)
        }

        const includeCreate = !args.includes('--no-create')
        const includeRead = !args.includes('--no-read')
        const includeUpdate = !args.includes('--no-update')
        const includeDelete = !args.includes('--no-delete')
        const includeSearch = !args.includes('--no-search')
        const includeBatch = args.includes('--batch')

        await commands.generateTemplates({
          tableIdentifier,
          includeCreate,
          includeRead,
          includeUpdate,
          includeDelete,
          includeSearch,
          includeBatch,
        })
        break
      }

      case 'validate': {
        const packagePath = args[1]
        if (!packagePath) {
          console.error('❌ Error: Package path is required')
          console.log('Usage: bun run table:validate <packagePath>')
          process.exit(1)
        }

        await commands.validatePackage({ packagePath })
        break
      }
      default: {
        console.log('📦 Table Package CLI - Export/Import System')
        console.log('')
        console.log('Usage: bun run table:<command> [arguments] [options]')
        console.log('')
        console.log('Commands:')
        console.log('  export <tableIdentifier>           Export a single table package')
        console.log('  import <packagePath>                Import a table package')
        console.log('  batch-export <tables...>            Batch export multiple tables')
        console.log('  batch-import <packages...>          Batch import multiple packages')
        console.log('  analyze-deps <tableIdentifier>      Analyze table dependencies')
        console.log('  resolve-order <tables...>           Resolve import order for tables')
        console.log('  generate-templates <tableIdentifier> Generate CRUD templates for table')
        console.log('  validate <packagePath>              Validate a table package')
        console.log('  help                                Show this help message')
        console.log('')
        console.log('Export Options:')
        console.log('  --output <path>                     Output file path')
        console.log('  --no-data                           Exclude node data')
        console.log('  --no-relations                      Exclude relationships')
        console.log('  --no-templates                      Exclude query templates')
        console.log('  --statistics                        Include usage statistics')
        console.log('  --no-dependencies                   Skip dependency resolution')
        console.log('  --compact                           Compact JSON output')
        console.log('')
        console.log('Import Options:')
        console.log('  --conflict <strategy>               Conflict resolution: overwrite|merge|rename|skip')
        console.log('  --no-data                           Skip node data import')
        console.log('  --no-relations                      Skip relationships import')
        console.log('  --no-templates                      Skip templates import')
        console.log('  --no-preserve-stats                 Don\'t preserve statistics')
        console.log('  --no-validate                       Skip integrity validation')
        console.log('  --no-generate                       Skip template generation')
        console.log('  --prefix <string>                   Prefix for renamed tables')
        console.log('  --no-session                        Don\'t create import session')
        console.log('')
        console.log('Template Generation Options:')
        console.log('  --no-create                         Skip CREATE templates')
        console.log('  --no-read                           Skip READ templates')
        console.log('  --no-update                         Skip UPDATE templates')
        console.log('  --no-delete                         Skip DELETE templates')
        console.log('  --no-search                         Skip SEARCH templates')
        console.log('  --batch                             Include BATCH templates')
        console.log('')
        console.log('Examples:')
        console.log('  bun run table:export users --output ./packages/users.json')
        console.log('  bun run table:import ./packages/users.json --conflict rename')
        console.log('  bun run table:batch-export users posts comments --output-dir ./packages')
        console.log('  bun run table:analyze-deps users')
        console.log('  bun run table:generate-templates users --no-delete')
        break
      }
    }
  } catch (error) {
    logger.error('CLI command failed', { command, error })
    console.error('❌ Command failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

main()