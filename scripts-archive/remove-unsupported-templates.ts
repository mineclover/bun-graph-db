#!/usr/bin/env bun
/**
 * Template Deletion Script for Unsupported Templates
 *
 * This script safely removes templates that are no longer supported due to:
 * - Missing implementation of required functions (e.g., bulkUpdateNodes)
 * - Missing TypeScript types (e.g., BulkCreateNodesInput)
 *
 * Features:
 * - Usage statistics backup before deletion
 * - Dependency checking (references from other templates)
 * - Safe deletion with soft delete option
 * - Interactive confirmation mode
 * - Comprehensive logging and recovery information
 * - Rollback capability
 *
 * Target Templates:
 * - bulk-update-todo-status (ID: 823)
 * - bulk-create-nodes-with-params (ID: 865)
 */

import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Configuration
const CONFIG = {
  DB_PATH: './data/bun-graph-db.sqlite',
  BACKUP_DIR: './backups/template-deletions',
  LOG_FILE: 'template-deletion.log',
  TARGET_TEMPLATES: [
    {
      id: 823,
      identifier: 'bulk-update-todo-status',
      reason: 'bulkUpdateNodes function not implemented',
    },
    {
      id: 865,
      identifier: 'bulk-create-nodes-with-params',
      reason: 'BulkCreateNodesInput type not implemented',
    },
  ],
}

interface Template {
  id: number
  identifier: string
  name: string
  description?: string
  query_text: string
  template_type: string
  usage_count: number
  version: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_used_at?: string
  avg_execution_time_ms: number
}

interface TemplateExecution {
  id: number
  template_id: number
  executed_at: string
  execution_time_ms: number
  variables_used?: string
  result_count: number
  success: boolean
  error_message?: string
  user_context?: string
}

interface DeletionResult {
  sessionId: string
  deletedTemplates: Template[]
  backupPath: string
  executionStats: Record<number, TemplateExecutionStats>
  dependencies: Record<number, string[]>
  timestamp: string
}

interface TemplateExecutionStats {
  totalExecutions: number
  successfulExecutions: number
  averageExecutionTime: number
  lastExecutedAt?: string
  uniqueUsers: number
}

class TemplateRemovalService {
  private db: Database
  private sessionId: string
  private logEntries: string[] = []

  constructor() {
    this.db = new Database(CONFIG.DB_PATH)
    this.sessionId = randomUUID()
    this.setupLogging()
  }

  private setupLogging() {
    // Ensure backup directory exists
    if (!existsSync(CONFIG.BACKUP_DIR)) {
      mkdirSync(CONFIG.BACKUP_DIR, { recursive: true })
    }

    this.log(`Session started: ${this.sessionId}`)
    this.log(`Database: ${CONFIG.DB_PATH}`)
    this.log(`Backup directory: ${CONFIG.BACKUP_DIR}`)
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${level}] ${message}`
    this.logEntries.push(logMessage)
    console.log(logMessage)
  }

  private saveLogFile(sessionId: string) {
    const logPath = join(CONFIG.BACKUP_DIR, `${sessionId}-${CONFIG.LOG_FILE}`)
    writeFileSync(logPath, this.logEntries.join('\n'), 'utf-8')
    this.log(`Log saved to: ${logPath}`)
  }

  async validateTargetTemplates(): Promise<Template[]> {
    this.log('Validating target templates...')

    const foundTemplates: Template[] = []

    for (const target of CONFIG.TARGET_TEMPLATES) {
      const template = this.db
        .query<Template, [number]>('SELECT * FROM templates WHERE id = ?')
        .get(target.id)

      if (template) {
        this.log(`Found template: ${template.identifier} (ID: ${template.id})`)
        foundTemplates.push(template)
      } else {
        this.log(`Template not found: ${target.identifier} (ID: ${target.id})`, 'WARN')
      }
    }

    if (foundTemplates.length === 0) {
      throw new Error('No target templates found in database')
    }

    return foundTemplates
  }

  async checkDependencies(templateIds: number[]): Promise<Record<number, string[]>> {
    this.log('Checking template dependencies...')

    const dependencies: Record<number, string[]> = {}

    for (const templateId of templateIds) {
      // Check if any templates reference this template in their query_text
      const referencingTemplates = this.db
        .query<{ id: number; identifier: string }, [number]>(
          `SELECT id, identifier FROM templates
         WHERE query_text LIKE '%' || (SELECT identifier FROM templates WHERE id = ?) || '%'
         AND id != ?
         AND is_active = 1`
        )
        .all(templateId, templateId)

      // Check for direct references in variables_schema or default_variables
      const schemaReferences = this.db
        .query<{ id: number; identifier: string }, [string]>(
          `SELECT id, identifier FROM templates
         WHERE (variables_schema LIKE ? OR default_variables LIKE ?)
         AND is_active = 1`
        )
        .all(`%${templateId}%`, `%${templateId}%`)

      const allReferences = [
        ...referencingTemplates.map((t) => `${t.identifier} (ID: ${t.id})`),
        ...schemaReferences.map((t) => `${t.identifier} (ID: ${t.id}) - schema reference`),
      ]

      if (allReferences.length > 0) {
        dependencies[templateId] = allReferences
        this.log(`Template ${templateId} has ${allReferences.length} dependencies`, 'WARN')
        for (const ref of allReferences) {
          this.log(`  - ${ref}`)
        }
      } else {
        dependencies[templateId] = []
        this.log(`Template ${templateId} has no dependencies`)
      }
    }

    return dependencies
  }

  async gatherExecutionStats(
    templateIds: number[]
  ): Promise<Record<number, TemplateExecutionStats>> {
    this.log('Gathering execution statistics...')

    const stats: Record<number, TemplateExecutionStats> = {}

    for (const templateId of templateIds) {
      const execStats = this.db
        .query<any, [number]>(
          `SELECT
           COUNT(*) as totalExecutions,
           COUNT(CASE WHEN success = 1 THEN 1 END) as successfulExecutions,
           AVG(execution_time_ms) as averageExecutionTime,
           MAX(executed_at) as lastExecutedAt,
           COUNT(DISTINCT user_context) as uniqueUsers
         FROM template_executions
         WHERE template_id = ?`
        )
        .get(templateId)

      stats[templateId] = {
        totalExecutions: execStats?.totalExecutions || 0,
        successfulExecutions: execStats?.successfulExecutions || 0,
        averageExecutionTime: execStats?.averageExecutionTime || 0,
        lastExecutedAt: execStats?.lastExecutedAt,
        uniqueUsers: execStats?.uniqueUsers || 0,
      }

      this.log(
        `Template ${templateId} stats: ${stats[templateId].totalExecutions} executions, ` +
          `${stats[templateId].successfulExecutions} successful`
      )
    }

    return stats
  }

  async backupTemplateData(templates: Template[]): Promise<string> {
    this.log('Creating backup of template data...')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupData = {
      sessionId: this.sessionId,
      timestamp,
      templates: [],
      executions: [],
    }

    for (const template of templates) {
      // Backup template
      backupData.templates.push(template)

      // Backup all executions for this template
      const executions = this.db
        .query<TemplateExecution, [number]>(
          'SELECT * FROM template_executions WHERE template_id = ? ORDER BY executed_at DESC'
        )
        .all(template.id)

      backupData.executions.push(...executions)
      this.log(`Backed up ${executions.length} executions for template ${template.identifier}`)
    }

    const backupPath = join(
      CONFIG.BACKUP_DIR,
      `${this.sessionId}-templates-backup-${timestamp}.json`
    )
    writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8')

    this.log(`Backup saved to: ${backupPath}`)
    return backupPath
  }

  async performSoftDelete(templateIds: number[]): Promise<void> {
    this.log('Performing soft delete (marking as inactive)...')

    const updateQuery = this.db.prepare(
      'UPDATE templates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )

    for (const templateId of templateIds) {
      updateQuery.run(templateId)
      this.log(`Soft deleted template ID: ${templateId}`)
    }
  }

  async performHardDelete(templateIds: number[]): Promise<void> {
    this.log('Performing hard delete (permanent removal)...', 'WARN')

    // Delete executions first (foreign key constraint)
    const deleteExecutionsQuery = this.db.prepare(
      'DELETE FROM template_executions WHERE template_id = ?'
    )

    const deleteTemplateQuery = this.db.prepare('DELETE FROM templates WHERE id = ?')

    for (const templateId of templateIds) {
      const executionCount =
        this.db
          .query<{ count: number }, [number]>(
            'SELECT COUNT(*) as count FROM template_executions WHERE template_id = ?'
          )
          .get(templateId)?.count || 0

      deleteExecutionsQuery.run(templateId)
      this.log(`Deleted ${executionCount} executions for template ID: ${templateId}`)

      deleteTemplateQuery.run(templateId)
      this.log(`Hard deleted template ID: ${templateId}`)
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    this.log(`Restoring templates from backup: ${backupPath}`)

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    const backupData = JSON.parse(readFileSync(backupPath, 'utf-8'))

    const insertTemplateQuery = this.db.prepare(`
      INSERT OR REPLACE INTO templates (
        id, identifier, name, description, query_text, variables_schema,
        default_variables, applicable_tables, template_type, complexity_score,
        usage_count, version, is_active, tags, created_at, updated_at,
        query_name, operation_type, last_used_at, avg_execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertExecutionQuery = this.db.prepare(`
      INSERT OR REPLACE INTO template_executions (
        id, template_id, executed_at, execution_time_ms, variables_used,
        result_count, success, error_message, user_context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Restore templates
    for (const template of backupData.templates) {
      insertTemplateQuery.run(
        template.id,
        template.identifier,
        template.name,
        template.description,
        template.query_text,
        template.variables_schema,
        template.default_variables,
        template.applicable_tables,
        template.template_type,
        template.complexity_score,
        template.usage_count,
        template.version,
        template.is_active,
        template.tags,
        template.created_at,
        template.updated_at,
        template.query_name,
        template.operation_type,
        template.last_used_at,
        template.avg_execution_time_ms
      )
    }

    // Restore executions
    for (const execution of backupData.executions) {
      insertExecutionQuery.run(
        execution.id,
        execution.template_id,
        execution.executed_at,
        execution.execution_time_ms,
        execution.variables_used,
        execution.result_count,
        execution.success,
        execution.error_message,
        execution.user_context
      )
    }

    this.log(
      `Restored ${backupData.templates.length} templates and ${backupData.executions.length} executions`
    )
  }

  async generateDeletionReport(result: DeletionResult): Promise<string> {
    const reportPath = join(CONFIG.BACKUP_DIR, `${result.sessionId}-deletion-report.md`)

    const report = `# Template Deletion Report

## Session Information
- **Session ID**: ${result.sessionId}
- **Timestamp**: ${result.timestamp}
- **Backup Location**: ${result.backupPath}

## Deleted Templates

${result.deletedTemplates
  .map(
    (template) => `
### ${template.name} (${template.identifier})
- **ID**: ${template.id}
- **Type**: ${template.template_type}
- **Version**: ${template.version}
- **Usage Count**: ${template.usage_count}
- **Last Used**: ${template.last_used_at || 'Never'}
- **Average Execution Time**: ${template.avg_execution_time_ms}ms

**Execution Statistics**:
- Total Executions: ${result.executionStats[template.id]?.totalExecutions || 0}
- Successful Executions: ${result.executionStats[template.id]?.successfulExecutions || 0}
- Unique Users: ${result.executionStats[template.id]?.uniqueUsers || 0}

**Dependencies**: ${
      result.dependencies[template.id]?.length
        ? result.dependencies[template.id].map((dep) => `\n- ${dep}`).join('')
        : '\nNone found'
    }

**Deletion Reason**: ${CONFIG.TARGET_TEMPLATES.find((t) => t.id === template.id)?.reason || 'Unknown'}
`
  )
  .join('\n')}

## Recovery Instructions

To restore these templates, run:
\`\`\`bash
bun scripts/remove-unsupported-templates.ts --restore "${result.backupPath}"
\`\`\`

## Files Created
- Backup: \`${result.backupPath}\`
- Log: \`${CONFIG.BACKUP_DIR}/${result.sessionId}-${CONFIG.LOG_FILE}\`
- Report: \`${reportPath}\`
`

    writeFileSync(reportPath, report, 'utf-8')
    this.log(`Deletion report saved to: ${reportPath}`)
    return reportPath
  }

  async promptConfirmation(
    templates: Template[],
    dependencies: Record<number, string[]>
  ): Promise<boolean> {
    console.log('\n🔍 TEMPLATE DELETION PREVIEW\n')
    console.log('The following templates will be removed:\n')

    templates.forEach((template) => {
      const target = CONFIG.TARGET_TEMPLATES.find((t) => t.id === template.id)
      console.log(`📋 ${template.name} (${template.identifier})`)
      console.log(`   ID: ${template.id}`)
      console.log(`   Usage Count: ${template.usage_count}`)
      console.log(`   Reason: ${target?.reason || 'Unknown'}`)

      const deps = dependencies[template.id]
      if (deps && deps.length > 0) {
        console.log(`   ⚠️  Dependencies: ${deps.length} found`)
        for (const dep of deps) {
          console.log(`      - ${dep}`)
        }
      } else {
        console.log(`   ✅ Dependencies: None`)
      }
      console.log('')
    })

    console.log('Options:')
    console.log('  s) Soft delete (mark as inactive, reversible)')
    console.log('  h) Hard delete (permanent removal)')
    console.log('  c) Cancel operation')

    const response = prompt('\nChoose an option (s/h/c): ')?.toLowerCase()

    if (response === 'c') {
      console.log('Operation cancelled by user.')
      return false
    }

    if (response === 'h') {
      console.log('\n⚠️  WARNING: Hard delete is PERMANENT!')
      const confirm = prompt('Type "DELETE" to confirm hard deletion: ')
      if (confirm !== 'DELETE') {
        console.log('Hard delete cancelled.')
        return false
      }
      return true
    }

    if (response === 's') {
      return true
    }

    console.log('Invalid option. Operation cancelled.')
    return false
  }

  async run(options: { restore?: string; hardDelete?: boolean; force?: boolean } = {}) {
    try {
      // Handle restore operation
      if (options.restore) {
        await this.restoreFromBackup(options.restore)
        this.saveLogFile(this.sessionId)
        return
      }

      // Validate target templates exist
      const templates = await this.validateTargetTemplates()
      const templateIds = templates.map((t) => t.id)

      // Check dependencies
      const dependencies = await this.checkDependencies(templateIds)

      // Gather execution statistics
      const executionStats = await this.gatherExecutionStats(templateIds)

      // Interactive confirmation (unless forced)
      if (!options.force) {
        const confirmed = await this.promptConfirmation(templates, dependencies)
        if (!confirmed) {
          this.log('Operation cancelled by user')
          return
        }
      }

      // Create backup
      const backupPath = await this.backupTemplateData(templates)

      // Perform deletion
      if (options.hardDelete) {
        await this.performHardDelete(templateIds)
      } else {
        await this.performSoftDelete(templateIds)
      }

      // Generate results
      const result: DeletionResult = {
        sessionId: this.sessionId,
        deletedTemplates: templates,
        backupPath,
        executionStats,
        dependencies,
        timestamp: new Date().toISOString(),
      }

      // Generate report
      await this.generateDeletionReport(result)

      this.log(
        `✅ Successfully ${options.hardDelete ? 'hard' : 'soft'} deleted ${templates.length} templates`
      )
      this.log(`📁 Backup saved to: ${backupPath}`)
    } catch (error) {
      this.log(`❌ Error during template deletion: ${error}`, 'ERROR')
      throw error
    } finally {
      this.saveLogFile(this.sessionId)
      this.db.close()
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const options = {
    restore: args.find((arg) => arg.startsWith('--restore='))?.split('=')[1],
    hardDelete: args.includes('--hard-delete'),
    force: args.includes('--force'),
    help: args.includes('--help') || args.includes('-h'),
  }

  if (options.help) {
    console.log(`
Template Removal Script

Usage:
  bun scripts/remove-unsupported-templates.ts [options]

Options:
  --force                Skip interactive confirmation
  --hard-delete         Permanently delete templates (default: soft delete)
  --restore=<path>      Restore templates from backup file
  --help, -h           Show this help message

Examples:
  # Interactive soft delete
  bun scripts/remove-unsupported-templates.ts

  # Force hard delete
  bun scripts/remove-unsupported-templates.ts --hard-delete --force

  # Restore from backup
  bun scripts/remove-unsupported-templates.ts --restore="./backups/template-deletions/session-id-templates-backup.json"

Target Templates:
${CONFIG.TARGET_TEMPLATES.map((t) => `  - ${t.identifier} (ID: ${t.id}) - ${t.reason}`).join('\n')}
`)
    return
  }

  const service = new TemplateRemovalService()
  await service.run(options)
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error)
}

export { TemplateRemovalService }
