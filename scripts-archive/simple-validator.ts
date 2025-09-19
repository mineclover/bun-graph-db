#!/usr/bin/env bun

/**
 * Unified Template Validation & Export Tool
 *
 * 기존 두 스크립트의 기능을 통합:
 * - 검증 기능 (원래 simple-validator 기능)
 * - 배치 처리 및 통계 포함 export (template-export 기능 통합)
 * - 안전성 우선 접근법으로 검증 후 export 수행
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GraphQLClient } from 'graphql-request'

interface ExportResult {
  identifier: string
  status: 'success' | 'not_found' | 'validation_failed' | 'error'
  filename?: string
  message?: string
}

interface ValidationOptions {
  includeStatistics?: boolean
  outputDir?: string
  skipValidation?: boolean
  batchMode?: boolean
}

class UnifiedTemplateValidator {
  private client: GraphQLClient
  private outputDir: string

  constructor(graphqlEndpoint = 'http://localhost:4000/graphql', outputDir = './demo/templates') {
    this.client = new GraphQLClient(graphqlEndpoint)
    this.outputDir = outputDir
  }

  /**
   * 모든 활성 템플릿 목록 조회
   */
  async getAllActiveTemplates(): Promise<string[]> {
    const query = `
      query GetAllTemplates {
        searchTemplates(pagination: { limit: 100 }) {
          nodes {
            identifier
            isActive
          }
        }
      }
    `

    try {
      const result = await this.client.request(query)
      return result.searchTemplates.nodes
        .filter((template: any) => template.isActive)
        .map((template: any) => template.identifier)
    } catch (error) {
      console.error(`❌ Failed to get template list: ${error}`)
      return []
    }
  }

  /**
   * 단일 템플릿 검증 및 export
   */
  async validateAndExportTemplate(
    templateIdentifier: string,
    options: ValidationOptions = {}
  ): Promise<ExportResult> {
    const { includeStatistics = true, skipValidation = false } = options

    console.log(`🔍 템플릿 검증${skipValidation ? ' 스킵' : ''}: ${templateIdentifier}`)

    try {
      // 1. 템플릿 정보 조회
      const templateQuery = `
        query GetTemplate($identifier: String!) {
          getTemplateByIdentifier(identifier: $identifier) {
            id
            identifier
            name
            query
            variables
          }
        }
      `

      const templateResult = await this.client.request(templateQuery, {
        identifier: templateIdentifier,
      })
      const template = templateResult.getTemplateByIdentifier

      if (!template) {
        console.log(`❌ 템플릿을 찾을 수 없음: ${templateIdentifier}`)
        return {
          identifier: templateIdentifier,
          status: 'not_found',
          message: 'Template not found',
        }
      }

      console.log(`✅ 템플릿 발견: ${template.name}`)

      // 2. 실행 테스트 (skipValidation이 false일 때만)
      if (!skipValidation) {
        const testQuery = `
          mutation TestTemplate($templateIdentifier: String!, $variables: JSON) {
            executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
              success
              data
            }
          }
        `

        const testResult = await this.client.request(testQuery, {
          templateIdentifier,
          variables: {},
        })

        const execution = testResult.executeTemplateWithGraphQL

        if (!execution.success) {
          console.log(`❌ 실행 테스트 실패`)
          return {
            identifier: templateIdentifier,
            status: 'validation_failed',
            message: 'Template execution test failed',
          }
        }

        console.log(`✅ 실행 테스트 통과`)
      }

      // 3. Export 실행 (통계 포함)
      const exportQuery = `
        mutation ExportTemplate($templateIdentifier: String!, $includeStatistics: Boolean) {
          exportTemplate(templateIdentifier: $templateIdentifier, includeStatistics: $includeStatistics) {
            success
            exportData
            filename
            errors {
              message
            }
          }
        }
      `

      const exportResult = await this.client.request(exportQuery, {
        templateIdentifier,
        includeStatistics,
      })

      if (!exportResult.exportTemplate.success) {
        return {
          identifier: templateIdentifier,
          status: 'error',
          message:
            exportResult.exportTemplate.errors?.map((e: any) => e.message).join(', ') ||
            'Export failed',
        }
      }

      // 파일로 저장
      await this.ensureOutputDirectory()
      const filename = exportResult.exportTemplate.filename || `${templateIdentifier}_v1-0-0.json`
      const filepath = join(this.outputDir, filename)

      await writeFile(filepath, exportResult.exportTemplate.exportData, 'utf-8')

      console.log(`📁 Export 완료: ${filepath}`)
      return {
        identifier: templateIdentifier,
        status: 'success',
        filename,
        message: `Exported to ${filepath}`,
      }
    } catch (error) {
      console.log(`❌ 오류: ${error}`)
      return {
        identifier: templateIdentifier,
        status: 'error',
        message: `Export error: ${error}`,
      }
    }
  }

  /**
   * 여러 템플릿 일괄 처리
   */
  async exportMultiple(
    identifiers: string[],
    options: ValidationOptions = {}
  ): Promise<ExportResult[]> {
    const { skipValidation = false } = options

    console.log(`\n📤 Exporting ${identifiers.length} templates`)
    console.log(`📁 Output directory: ${this.outputDir}`)
    console.log(`🔍 Validation: ${skipValidation ? 'Skipped' : 'Enabled'}\n`)

    const results: ExportResult[] = []
    let successCount = 0
    let errorCount = 0

    for (const identifier of identifiers) {
      console.log(`🔄 Processing: ${identifier}`)

      const result = await this.validateAndExportTemplate(identifier, options)
      results.push(result)

      switch (result.status) {
        case 'success':
          console.log(`✅ ${identifier}: Exported as ${result.filename}`)
          successCount++
          break
        case 'not_found':
          console.log(`❓ ${identifier}: Template not found`)
          errorCount++
          break
        case 'validation_failed':
          console.log(`⚠️ ${identifier}: Validation failed`)
          errorCount++
          break
        case 'error':
          console.log(`❌ ${identifier}: ${result.message}`)
          errorCount++
          break
      }

      // 서버 부하 방지
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(`\n📊 Export Summary:`)
    console.log(`✅ Exported: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    console.log(`📈 Success Rate: ${((successCount / identifiers.length) * 100).toFixed(1)}%`)

    return results
  }

  /**
   * 모든 활성 템플릿 export
   */
  async exportAll(options: ValidationOptions = {}): Promise<ExportResult[]> {
    console.log(`\n🚀 Exporting all active templates`)

    const identifiers = await this.getAllActiveTemplates()
    if (identifiers.length === 0) {
      console.log('⚠️  No active templates found')
      return []
    }

    console.log(`📋 Found ${identifiers.length} active templates`)
    return await this.exportMultiple(identifiers, options)
  }

  /**
   * 템플릿 목록만 조회 (export 없이)
   */
  async listTemplates(): Promise<void> {
    console.log(`\n📋 Active Templates List`)

    const identifiers = await this.getAllActiveTemplates()
    if (identifiers.length === 0) {
      console.log('⚠️  No active templates found')
      return
    }

    console.log(`\nFound ${identifiers.length} active templates:`)
    identifiers.forEach((id, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${id}`)
    })
    console.log('')
  }

  /**
   * 출력 디렉토리 확인 및 생성
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true })
    } catch (_error) {
      // Directory already exists or creation failed
      // We'll let the writeFile operation handle the error if needed
    }
  }
}

// CLI 실행부
if (import.meta.main) {
  const args = process.argv.slice(2)
  const command = args[0]

  // 출력 디렉토리 옵션 처리
  const outputDirIndex = args.indexOf('--output')
  const outputDir =
    outputDirIndex !== -1 && args[outputDirIndex + 1]
      ? args[outputDirIndex + 1]
      : './demo/templates'

  // 검증 스킵 옵션
  const skipValidation = args.includes('--skip-validation')

  const validator = new UnifiedTemplateValidator(undefined, outputDir)
  const options: ValidationOptions = {
    includeStatistics: true,
    outputDir,
    skipValidation,
    batchMode: true,
  }

  if (command === 'all') {
    // 모든 템플릿 export
    validator
      .exportAll(options)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Export all failed:', error)
        process.exit(1)
      })
  } else if (command === 'list') {
    // 템플릿 목록만 표시
    validator
      .listTemplates()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ List failed:', error)
        process.exit(1)
      })
  } else if (command === 'templates' && args.length > 1) {
    // 특정 템플릿들 export
    const identifiers = args.slice(1).filter((arg) => !arg.startsWith('--'))
    validator
      .exportMultiple(identifiers, options)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Export templates failed:', error)
        process.exit(1)
      })
  } else if (command && !command.startsWith('--')) {
    // 단일 템플릿 처리 (기존 호환성 유지)
    const templateIdentifier = command
    validator
      .validateAndExportTemplate(templateIdentifier, {
        includeStatistics: true,
        skipValidation: false,
      })
      .then((result) => {
        process.exit(result.status === 'success' ? 0 : 1)
      })
      .catch((error) => {
        console.error('실행 실패:', error)
        process.exit(1)
      })
  } else {
    console.log(`
🔧 Unified Template Validation & Export Tool

사용법:
  bun scripts/simple-validator.ts <template-identifier>                    # 단일 템플릿 검증 및 export
  bun scripts/simple-validator.ts all [--skip-validation] [--output <dir>] # 모든 활성 템플릿 export
  bun scripts/simple-validator.ts list                                     # 활성 템플릿 목록 조회
  bun scripts/simple-validator.ts templates <id1> <id2>... [옵션]          # 특정 템플릿들 export

옵션:
  --output <dir>         출력 디렉토리 (기본값: ./demo/templates)
  --skip-validation      실행 테스트 건너뛰기 (빠른 export)

예제:
  bun scripts/simple-validator.ts test-health-check
  bun scripts/simple-validator.ts all
  bun scripts/simple-validator.ts all --skip-validation --output ./backups/templates
  bun scripts/simple-validator.ts list
  bun scripts/simple-validator.ts templates test-health-check search-templates-advanced

기능:
  ✅ 템플릿 검증 (실행 테스트 포함)
  ✅ 사용 통계 포함 export
  ✅ 배치 처리 지원
  ✅ 서버 부하 방지 지연
  ✅ 포괄적인 에러 처리
  ✅ 사용자 정의 출력 디렉토리
  ✅ 진행 상황 추적 및 요약 보고서
`)
    process.exit(1)
  }
}

export { UnifiedTemplateValidator, type ExportResult, type ValidationOptions }
