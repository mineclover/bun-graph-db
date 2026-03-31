/**
 * MCP Tool: Bulk Template Import from exported-templates directory
 *
 * Purpose: Bridge between local file system and GraphQL template operations
 * Enables rapid population of templates from exported JSON files
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { RestApiClient } from './RestApiClient.js'

export interface BulkImportOptions {
  overwriteExisting?: boolean
  generateNewIdentifier?: boolean
  dryRun?: boolean
  filter?: string[] // filter by template identifiers
  batchSize?: number
}

export interface TemplateImportResult {
  identifier: string
  success: boolean
  error?: string
  skipped?: boolean
  reason?: string
}

export interface BulkImportSummary {
  totalFiles: number
  attempted: number
  successful: number
  failed: number
  skipped: number
  results: TemplateImportResult[]
  duration: number
}

export class BulkTemplateImportTool {
  private readonly templatesDir: string = 'exported-templates'

  constructor(private readonly restClient: RestApiClient) {}

  /**
   * Main MCP tool function: Import all templates from exported-templates directory
   */
  async bulkImportTemplates(options: BulkImportOptions = {}): Promise<BulkImportSummary> {
    const startTime = Date.now()
    const {
      overwriteExisting = false,
      generateNewIdentifier = false,
      dryRun = false,
      filter = [],
      batchSize = 10,
    } = options

    console.log(`🚀 Starting bulk template import from ${this.templatesDir}/`)
    console.log(`Options: overwrite=${overwriteExisting}, dryRun=${dryRun}, batchSize=${batchSize}`)

    // Discover template files
    const templateFiles = await this.discoverTemplateFiles()

    // Filter files if specified
    const filteredFiles =
      filter.length > 0 ? templateFiles.filter((file) => filter.some((f) => file.includes(f))) : templateFiles

    console.log(`📁 Found ${templateFiles.length} files, ${filteredFiles.length} after filtering`)

    const results: TemplateImportResult[] = []
    let successful = 0
    let failed = 0
    let skipped = 0

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < filteredFiles.length; i += batchSize) {
      const batch = filteredFiles.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filteredFiles.length / batchSize)}`)

      const batchResults = await Promise.allSettled(
        batch.map((file) => this.importSingleTemplate(file, { overwriteExisting, generateNewIdentifier, dryRun })),
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          if (result.value.success) successful++
          else if (result.value.skipped) skipped++
          else failed++
        } else {
          failed++
          results.push({
            identifier: 'unknown',
            success: false,
            error: `Batch processing error: ${result.reason}`,
          })
        }
      }

      // Small delay between batches to be gentle on the system
      if (i + batchSize < filteredFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    const duration = Date.now() - startTime

    const summary: BulkImportSummary = {
      totalFiles: templateFiles.length,
      attempted: filteredFiles.length,
      successful,
      failed,
      skipped,
      results,
      duration,
    }

    console.log(`✅ Bulk import completed in ${duration}ms`)
    console.log(`📊 Results: ${successful} successful, ${failed} failed, ${skipped} skipped`)

    return summary
  }

  /**
   * Discover all JSON template files in the exported-templates directory
   */
  private async discoverTemplateFiles(): Promise<string[]> {
    try {
      const templatesPath = join(process.cwd(), this.templatesDir)

      // Check if directory exists
      const dirStats = await stat(templatesPath)
      if (!dirStats.isDirectory()) {
        throw new Error(`${this.templatesDir} is not a directory`)
      }

      // Read directory contents
      const files = await readdir(templatesPath)

      // Filter for JSON files, exclude INDEX.md and other non-template files
      const templateFiles = files.filter(
        (file) => file.endsWith('.json') && !file.startsWith('.') && file !== 'INDEX.json',
      )

      console.log(`📄 Discovered ${templateFiles.length} template files`)

      return templateFiles.map((file) => join(templatesPath, file))
    } catch (error) {
      throw new Error(`Failed to discover template files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import a single template file
   */
  private async importSingleTemplate(
    filePath: string,
    options: { overwriteExisting: boolean; generateNewIdentifier: boolean; dryRun: boolean },
  ): Promise<TemplateImportResult> {
    try {
      // Extract identifier from filename for logging
      const filename = filePath.split('/').pop() || 'unknown'
      const identifier = filename.replace('_v1-0-0.json', '').replace('.json', '')

      console.log(`📝 Processing: ${identifier}`)

      // Read and parse the template file
      const fileContent = await readFile(filePath, 'utf-8')
      let templateData: {
        template?: {
          identifier?: string
        }
      }

      try {
        templateData = JSON.parse(fileContent) as {
          template?: {
            identifier?: string
          }
        }
      } catch (parseError) {
        return {
          identifier,
          success: false,
          error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
        }
      }

      // Validate template structure
      if (!templateData.template) {
        return {
          identifier,
          success: false,
          error: 'Invalid template structure: missing template object',
        }
      }

      // If dry run, just validate and return
      if (options.dryRun) {
        return {
          identifier: templateData.template.identifier || identifier,
          success: true,
          skipped: true,
          reason: 'Dry run - would have imported',
        }
      }

      // Call the GraphQL import through REST API
      const importResult = await this.restClient.importTemplate({
        jsonData: fileContent,
        overwriteExisting: options.overwriteExisting,
        generateNewIdentifier: options.generateNewIdentifier,
      })

      if (importResult.success) {
        console.log(`✅ ${identifier}: imported successfully`)
        return {
          identifier: templateData.template.identifier || identifier,
          success: true,
        }
      } else {
        console.log(`❌ ${identifier}: ${importResult.error}`)
        return {
          identifier: templateData.template.identifier || identifier,
          success: false,
          error: importResult.error,
        }
      }
    } catch (error) {
      const identifier = filePath.split('/').pop()?.replace('.json', '') || 'unknown'
      console.log(`💥 ${identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        identifier,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get import status and summary
   */
  async getImportStatus(): Promise<{
    availableTemplates: number
    templateFiles: string[]
    estimatedImportTime: number
  }> {
    try {
      const templateFiles = await this.discoverTemplateFiles()

      return {
        availableTemplates: templateFiles.length,
        templateFiles: templateFiles.map((path) => path.split('/').pop() || ''),
        estimatedImportTime: templateFiles.length * 100, // rough estimate: 100ms per template
      }
    } catch (error) {
      throw new Error(`Failed to get import status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List available templates for selective import
   */
  async listAvailableTemplates(): Promise<
    Array<{
      filename: string
      identifier: string
      name: string
      description: string
      tags: string[]
    }>
  > {
    const templateFiles = await this.discoverTemplateFiles()
    const templates = []

    for (const filePath of templateFiles) {
      try {
        const fileContent = await readFile(filePath, 'utf-8')
        const templateData = JSON.parse(fileContent)

        if (templateData.template) {
          templates.push({
            filename: filePath.split('/').pop() || '',
            identifier: templateData.template.identifier || '',
            name: templateData.template.name || '',
            description: templateData.template.description || '',
            tags: templateData.template.tags || [],
          })
        }
      } catch (error) {
        // Skip files that can't be parsed, but log for debugging
        console.warn(`Warning: Could not parse ${filePath}:`, error)
      }
    }

    return templates
  }
}
