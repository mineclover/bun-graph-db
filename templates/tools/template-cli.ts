#!/usr/bin/env bun
/**
 * Template CLI - 템플릿 시스템 관리를 위한 명령줄 도구
 */

import { parseArgs } from 'node:util'
import { TemplateLoader } from '../loaders/template-loader.js'
import { TemplateValidator } from '../validators/template-validator.js'
import type { ILogger } from '@/application/ports/ILogger.js'

interface CliOptions {
  command: string
  environment?: 'production' | 'development' | 'migration'
  templateId?: string
  validate?: boolean
  output?: 'json' | 'table' | 'summary'
  verbose?: boolean
}

interface CliLogger extends ILogger {
  info(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  debug(message: string, meta?: Record<string, unknown>): void
}

class ConsoleLogger implements CliLogger {
  constructor(private verbose: boolean = false) {}

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`ℹ️  ${message}`, meta ? JSON.stringify(meta, null, 2) : '')
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`❌ ${message}`, meta ? JSON.stringify(meta, null, 2) : '')
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`⚠️  ${message}`, meta ? JSON.stringify(meta, null, 2) : '')
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.verbose) {
      console.debug(`🔍 ${message}`, meta ? JSON.stringify(meta, null, 2) : '')
    }
  }
}

class TemplateCLI {
  private loader: TemplateLoader
  private validator: TemplateValidator
  private logger: CliLogger

  constructor(verbose: boolean = false) {
    this.logger = new ConsoleLogger(verbose)
    this.loader = new TemplateLoader(this.logger)
    this.validator = new TemplateValidator(this.logger)
  }

  async run(): Promise<void> {
    try {
      const options = this.parseArguments()
      
      this.logger.debug('CLI started', { options })

      switch (options.command) {
        case 'load':
          await this.handleLoad(options)
          break
        case 'list':
          await this.handleList(options)
          break
        case 'validate':
          await this.handleValidate(options)
          break
        case 'info':
          await this.handleInfo(options)
          break
        case 'generate':
          await this.handleGenerate(options)
          break
        case 'migrate':
          await this.handleMigrate(options)
          break
        default:
          this.showHelp()
      }
    } catch (error) {
      this.logger.error('CLI execution failed', { error })
      process.exit(1)
    }
  }

  /**
   * 템플릿 로드 명령어
   */
  private async handleLoad(options: CliOptions): Promise<void> {
    const environment = options.environment || 'development'
    
    console.log(`🔄 Loading templates from ${environment} environment...`)
    
    const result = await this.loader.loadTemplates({
      environment,
      includeExamples: true,
      validateSchemas: options.validate || false,
      hotReload: false
    })

    if (options.output === 'json') {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`✅ Loaded ${result.metadata.loadedCount} templates`)
      console.log(`📊 Total files processed: ${result.metadata.totalFiles}`)
      console.log(`⚡ Load time: ${result.metadata.loadTimeMs}ms`)
      
      if (result.errors.length > 0) {
        console.log(`❌ Errors: ${result.errors.length}`)
        result.errors.forEach(error => {
          console.log(`   - ${error.file}: ${error.error}`)
        })
      }
    }
  }

  /**
   * 템플릿 목록 명령어
   */
  private async handleList(options: CliOptions): Promise<void> {
    const environment = options.environment || 'development'
    
    await this.loader.loadTemplates({
      environment,
      includeExamples: false,
      validateSchemas: false,
      hotReload: false
    })

    const templates = this.loader.getAllTemplates()

    if (options.output === 'json') {
      console.log(JSON.stringify(templates, null, 2))
    } else if (options.output === 'table') {
      console.table(templates.map(t => ({
        ID: t.id,
        Name: t.name,
        Type: t.templateType,
        Tags: t.tags.join(', '),
        Source: t.source.split('/').pop()
      })))
    } else {
      console.log(`📋 Found ${templates.length} templates:`)
      templates.forEach(template => {
        console.log(`  📄 ${template.id} - ${template.name} (${template.templateType})`)
        if (template.tags.length > 0) {
          console.log(`     Tags: ${template.tags.join(', ')}`)
        }
      })
    }
  }

  /**
   * 템플릿 검증 명령어
   */
  private async handleValidate(options: CliOptions): Promise<void> {
    const environment = options.environment || 'development'
    
    console.log(`🔍 Validating templates in ${environment} environment...`)
    
    const loadResult = await this.loader.loadTemplates({
      environment,
      includeExamples: false,
      validateSchemas: false,
      hotReload: false
    })

    const templates = loadResult.templates.map(t => ({
      identifier: t.id,
      name: t.name,
      description: t.description,
      queryText: t.queryText,
      variablesSchema: t.variablesSchema,
      defaultVariables: t.defaultVariables,
      templateType: t.templateType,
      tags: t.tags
    }))

    if (options.templateId) {
      // 특정 템플릿만 검증
      const template = templates.find(t => t.identifier === options.templateId)
      if (!template) {
        this.logger.error(`Template not found: ${options.templateId}`)
        return
      }

      const result = await this.validator.validateTemplate(template)
      this.displayValidationResult(template.identifier, result)
    } else {
      // 모든 템플릿 검증
      const results = await this.validator.validateBatch(templates)
      
      let validCount = 0
      let invalidCount = 0
      
      for (const [templateId, result] of results) {
        if (result.isValid) {
          validCount++
        } else {
          invalidCount++
          this.displayValidationResult(templateId, result)
        }
      }

      console.log(`\n📊 Validation Summary:`)
      console.log(`✅ Valid: ${validCount}`)
      console.log(`❌ Invalid: ${invalidCount}`)
      console.log(`📋 Total: ${templates.length}`)
    }
  }

  /**
   * 템플릿 정보 명령어
   */
  private async handleInfo(options: CliOptions): Promise<void> {
    if (!options.templateId) {
      this.logger.error('Template ID is required for info command')
      return
    }

    const environment = options.environment || 'development'
    
    await this.loader.loadTemplates({
      environment,
      includeExamples: true,
      validateSchemas: false,
      hotReload: false
    })

    const template = this.loader.getTemplate(options.templateId)
    if (!template) {
      this.logger.error(`Template not found: ${options.templateId}`)
      return
    }

    console.log(`📄 Template Information: ${template.id}`)
    console.log(`Name: ${template.name}`)
    console.log(`Type: ${template.templateType}`)
    console.log(`Description: ${template.description}`)
    console.log(`Tags: ${template.tags.join(', ')}`)
    console.log(`Source: ${template.source}`)
    console.log(`Loaded: ${template.loadedAt.toISOString()}`)
    console.log(`\nQuery Text:`)
    console.log(template.queryText)
    
    if (Object.keys(template.variablesSchema).length > 0) {
      console.log(`\nVariables Schema:`)
      console.log(JSON.stringify(template.variablesSchema, null, 2))
    }
    
    if (Object.keys(template.defaultVariables).length > 0) {
      console.log(`\nDefault Variables:`)
      console.log(JSON.stringify(template.defaultVariables, null, 2))
    }
  }

  /**
   * 템플릿 생성 명령어
   */
  private async handleGenerate(options: CliOptions): Promise<void> {
    console.log('🏭 Template generation feature coming soon...')
    // TODO: 템플릿 생성기 연동
  }

  /**
   * 템플릿 마이그레이션 명령어
   */
  private async handleMigrate(options: CliOptions): Promise<void> {
    console.log('🔄 Template migration feature coming soon...')
    // TODO: 마이그레이션 도구 연동
  }

  /**
   * 검증 결과 출력
   */
  private displayValidationResult(templateId: string, result: any): void {
    console.log(`\n📄 ${templateId}: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`)
    
    if (result.errors.length > 0) {
      console.log('  Errors:')
      result.errors.forEach((error: any) => {
        console.log(`    - ${error.field}: ${error.message}`)
      })
    }
    
    if (result.warnings.length > 0) {
      console.log('  Warnings:')
      result.warnings.forEach((warning: any) => {
        console.log(`    - ${warning.field}: ${warning.message}`)
      })
    }
  }

  /**
   * 명령줄 인자 파싱
   */
  private parseArguments(): CliOptions {
    const { values, positionals } = parseArgs({
      args: Bun.argv.slice(2),
      options: {
        environment: {
          type: 'string',
          short: 'e',
          default: 'development'
        },
        'template-id': {
          type: 'string',
          short: 't'
        },
        validate: {
          type: 'boolean',
          short: 'v',
          default: false
        },
        output: {
          type: 'string',
          short: 'o',
          default: 'summary'
        },
        verbose: {
          type: 'boolean',
          default: false
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false
        }
      },
      allowPositionals: true
    })

    if (values.help || positionals.length === 0) {
      this.showHelp()
      process.exit(0)
    }

    return {
      command: positionals[0],
      environment: values.environment as any,
      templateId: values['template-id'],
      validate: values.validate,
      output: values.output as any,
      verbose: values.verbose
    }
  }

  /**
   * 도움말 출력
   */
  private showHelp(): void {
    console.log(`
🛠️  Template CLI - bun-graph-db Template Management Tool

Usage: bun templates/tools/template-cli.ts <command> [options]

Commands:
  load        Load templates from specified environment
  list        List all available templates
  validate    Validate template structure and syntax
  info        Show detailed information about a specific template
  generate    Generate new templates (coming soon)
  migrate     Migrate templates between versions (coming soon)

Options:
  -e, --environment <env>    Target environment (production|development|migration)
  -t, --template-id <id>     Specific template ID for info/validate commands
  -v, --validate            Enable validation during load
  -o, --output <format>     Output format (json|table|summary)
  --verbose                 Enable verbose logging
  -h, --help               Show this help message

Examples:
  bun templates/tools/template-cli.ts load -e development
  bun templates/tools/template-cli.ts list -o table
  bun templates/tools/template-cli.ts validate -t my-template
  bun templates/tools/template-cli.ts info -t basic-nodes-query
`)
  }
}

// CLI 실행
if (import.meta.main) {
  const cli = new TemplateCLI(Bun.argv.includes('--verbose'))
  await cli.run()
}