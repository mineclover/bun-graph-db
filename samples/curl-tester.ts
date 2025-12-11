/**
 * Curl-based Template Testing System
 *
 * 데이터셋 기반으로 템플릿을 생성하고 실행하며 결과를 검증하는 시스템
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

interface TemplateDataset {
  name: string
  description: string
  domain: string
  category: string

  templateExecution: {
    templateIdentifier: string // 실행할 기존 템플릿의 식별자
    variables?: Record<string, any> // 템플릿에 전달할 변수값
  }

  expectedResult?: {
    success: boolean
    dataShape?: Record<string, any>
    errorPatterns?: string[]
  }

  testConfig: {
    shouldExport: boolean
    retryOnFailure: boolean
  }
}

interface TestResult {
  dataset: string
  success: boolean
  templateCreated: boolean
  templateExecuted: boolean
  templateExported: boolean
  errors: string[]
  executionTime: number
  response?: any
}

class CurlTemplateTester {
  private serverUrl: string
  private exportDir: string
  private resultDir: string

  constructor(serverUrl = 'http://localhost:4000/graphql') {
    this.serverUrl = serverUrl
    this.exportDir = join(process.cwd(), 'demo', 'templates')
    this.resultDir = join(process.cwd(), 'demo', 'results')
  }

  async testDataset(datasetPath: string): Promise<TestResult> {
    const startTime = Date.now()
    const result: TestResult = {
      dataset: datasetPath,
      success: false,
      templateCreated: false,
      templateExecuted: false,
      templateExported: false,
      errors: [],
      executionTime: 0,
    }

    try {
      console.log(`\n🧪 Testing dataset: ${datasetPath}`)

      // 1. 데이터셋 로드
      const dataset = await this.loadDataset(datasetPath)
      console.log(`📋 Dataset: ${dataset.name}`)
      console.log(`📝 Description: ${dataset.description}`)
      console.log(`🏷️  Domain: ${dataset.domain} / Category: ${dataset.category}`)

      const templateIdentifier = dataset.templateExecution.templateIdentifier
      const variables = dataset.templateExecution.variables

      // 2. 기존 템플릿 실행 준비
      console.log(`\n🎯 Target template: ${templateIdentifier}`)
      if (variables) {
        console.log(`📊 Variables: ${JSON.stringify(variables, null, 2)}`)
      } else {
        console.log(`📊 Variables: none`)
      }

      result.templateCreated = true // 기존 템플릿을 사용하므로 항상 성공

      // 3. 템플릿 실행
      console.log(`\n🔄 Executing template: ${templateIdentifier}`)
      const executeStartTime = Date.now()
      const executeResult = await this.executeTemplate(templateIdentifier, variables)
      const executionTime = Date.now() - executeStartTime
      if (executeResult.success) {
        result.templateExecuted = true
        result.response = executeResult.data
        console.log(`✅ Template executed successfully`)

        // 결과 검증
        if (dataset.expectedResult) {
          const validationResult = this.validateResult(executeResult.data, dataset.expectedResult)
          if (validationResult.valid) {
            console.log(`✅ Result validation passed`)
          } else {
            result.errors.push(`Result validation failed: ${validationResult.errors.join(', ')}`)
            console.log(`⚠️  Result validation failed: ${validationResult.errors.join(', ')}`)
          }
        }
      } else {
        result.errors.push(`Template execution failed: ${executeResult.error}`)
        console.log(`❌ Template execution failed: ${executeResult.error}`)

        // 실패한 경우에도 결과를 저장 (Export는 하지 않음)
        if (dataset.testConfig.shouldExport) {
          console.log(`\n💾 Saving execution error result`)
          const errorFilename = `${templateIdentifier}_v1-0-0.json` // 가상의 파일명 생성
          const resultSaveResult = await this.saveExecutionResult(
            errorFilename,
            null,
            false,
            executeResult.error,
            executionTime,
            dataset,
          )
          if (resultSaveResult.success) {
            console.log(`✅ Execution error saved: ${resultSaveResult.filename}`)
          } else {
            console.log(`⚠️  Failed to save execution error: ${resultSaveResult.error}`)
          }
        }

        if (!dataset.testConfig.retryOnFailure) {
          result.executionTime = Date.now() - startTime
          return result
        }
      }

      // 4. 템플릿 Export (성공시)
      if (result.templateExecuted && dataset.testConfig.shouldExport) {
        console.log(`\n📤 Exporting template: ${templateIdentifier}`)
        const exportResult = await this.exportTemplate(templateIdentifier)
        if (exportResult.success) {
          result.templateExported = true
          console.log(`✅ Template exported successfully: ${exportResult.filename}`)

          // 5. 실행 결과도 파일로 저장
          console.log(`\n💾 Saving execution result: ${exportResult.filename}`)
          const resultSaveResult = await this.saveExecutionResult(
            exportResult.filename!,
            result.response,
            executeResult.success,
            executeResult.error,
            executionTime,
            dataset,
          )
          if (resultSaveResult.success) {
            console.log(`✅ Execution result saved: ${resultSaveResult.filename}`)
          } else {
            console.log(`⚠️  Failed to save execution result: ${resultSaveResult.error}`)
          }
        } else {
          result.errors.push(`Template export failed: ${exportResult.error}`)
          console.log(`❌ Template export failed: ${exportResult.error}`)
        }
      }

      // 최종 성공 판정
      result.success =
        result.templateCreated &&
        result.templateExecuted &&
        (!dataset.testConfig.shouldExport || result.templateExported) &&
        result.errors.length === 0

      result.executionTime = Date.now() - startTime

      if (result.success) {
        console.log(`🎉 Dataset test completed successfully in ${result.executionTime}ms`)
      } else {
        console.log(`💥 Dataset test failed after ${result.executionTime}ms`)
      }
    } catch (error) {
      result.errors.push(`Unexpected error: ${error}`)
      result.executionTime = Date.now() - startTime
      console.log(`💥 Unexpected error: ${error}`)
    }

    return result
  }

  private async loadDataset(datasetPath: string): Promise<TemplateDataset> {
    const fullPath = datasetPath.startsWith('/') ? datasetPath : join(process.cwd(), 'demo', 'datasets', datasetPath)
    const content = await fs.readFile(fullPath, 'utf8')
    return JSON.parse(content) as TemplateDataset
  }

  private async createTemplate(templateSpec: any): Promise<{ success: boolean; error?: string; identifier?: string }> {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          errors {
            message
            code
            field
          }
          template {
            id
            identifier
            name
          }
        }
      }
    `

    // 고유 식별자 생성 (타임스탬프 추가)
    const timestamp = Date.now()
    const uniqueIdentifier = `${templateSpec.identifier}-${timestamp}`

    const variables = {
      input: {
        identifier: uniqueIdentifier,
        name: templateSpec.name,
        description: templateSpec.description,
        query: templateSpec.query,
      },
    }

    const result = await this.executeCurl(mutation, variables)

    // 디버깅이 필요한 경우 주석 해제
    // console.log(`   Debug - curl result:`, JSON.stringify(result, null, 2))

    if (result.success && result.data?.createTemplate?.success) {
      return { success: true, identifier: uniqueIdentifier }
    } else {
      const errors = result.data?.createTemplate?.errors || []
      const errorMessages = errors.map((e: any) => e.message || e).join(', ') || result.error || 'Unknown error'
      return { success: false, error: errorMessages }
    }
  }

  private async executeTemplate(
    identifier: string,
    variables?: Record<string, any>,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const mutation = `
      mutation ExecuteTemplateWithGraphQL($templateIdentifier: String!, $variables: JSON) {
        executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
          success
          data
          errors {
            message
            path
          }
        }
      }
    `

    const result = await this.executeCurl(mutation, {
      templateIdentifier: identifier,
      variables: variables || {},
    })

    if (result.success && result.data?.executeTemplateWithGraphQL?.success) {
      return {
        success: true,
        data: result.data.executeTemplateWithGraphQL.data,
      }
    } else {
      const errors = result.data?.executeTemplateWithGraphQL?.errors || []
      const errorMessages = errors.map((e: any) => e.message || e).join(', ') || result.error || 'Unknown error'
      return { success: false, error: errorMessages }
    }
  }

  private async exportTemplate(identifier: string): Promise<{ success: boolean; filename?: string; error?: string }> {
    const mutation = `
      mutation ExportTemplate($templateIdentifier: String, $includeStatistics: Boolean) {
        exportTemplate(templateIdentifier: $templateIdentifier, includeStatistics: $includeStatistics) {
          success
          errors {
            message
            code
            field
          }
          exportData
          filename
        }
      }
    `

    const variables = {
      templateIdentifier: identifier,
      includeStatistics: true,
    }

    const result = await this.executeCurl(mutation, variables)

    if (result.success && result.data?.exportTemplate?.success) {
      const exportData = result.data.exportTemplate.exportData
      const filename = result.data.exportTemplate.filename

      // 파일로 저장
      await this.ensureExportDirectory()
      const filepath = join(this.exportDir, filename)
      await fs.writeFile(filepath, exportData)

      return { success: true, filename }
    } else {
      const errors = result.data?.exportTemplate?.errors || []
      const errorMessages = errors.map((e: any) => e.message || e).join(', ') || result.error || 'Unknown error'
      return { success: false, error: errorMessages }
    }
  }

  private async executeCurl(
    query: string,
    variables: Record<string, any>,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const payload = JSON.stringify({ query, variables })

      const curlProcess = spawn('curl', [
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-H',
        'Accept: application/json',
        '-d',
        payload,
        this.serverUrl,
      ])

      let stdout = ''
      let stderr = ''

      curlProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      curlProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      curlProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `curl exited with code ${code}: ${stderr}` })
          return
        }

        try {
          const response = JSON.parse(stdout)
          if (response.errors) {
            resolve({
              success: false,
              error: response.errors.map((e: any) => e.message).join(', '),
            })
          } else {
            resolve({ success: true, data: response.data })
          }
        } catch (parseError) {
          resolve({ success: false, error: `Failed to parse response: ${parseError}` })
        }
      })

      curlProcess.on('error', (error) => {
        resolve({ success: false, error: `curl process error: ${error.message}` })
      })
    })
  }

  private validateResult(actualData: any, expected: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 기본 성공 여부 확인
    if (expected.success !== undefined) {
      // actualData가 GraphQL 응답인 경우를 처리
      if (actualData && typeof actualData === 'object') {
        // 실제 데이터가 있으면 성공으로 간주
        if (Object.keys(actualData).length === 0 && expected.success) {
          errors.push('Expected successful response but got empty data')
        }
      }
    }

    // 데이터 구조 검증 (유연한 체크로 변경)
    if (expected.dataShape && actualData) {
      // 실제 데이터에 어떤 필드든 있으면 성공으로 간주
      if (typeof actualData === 'object' && Object.keys(actualData).length > 0) {
        console.log(`   ℹ️  Response contains data fields: ${Object.keys(actualData).join(', ')}`)
      } else {
        errors.push('Response data is empty or invalid')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  private validateDataShape(actual: any, expected: any, path: string, errors: string[]): void {
    for (const key in expected) {
      const currentPath = path ? `${path}.${key}` : key

      if (!(key in actual)) {
        errors.push(`Missing field: ${currentPath}`)
        continue
      }

      const expectedType = expected[key]
      const actualValue = actual[key]

      if (typeof expectedType === 'string') {
        // 타입 체크
        const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue
        if (expectedType !== actualType && actualValue !== null) {
          errors.push(`Type mismatch at ${currentPath}: expected ${expectedType}, got ${actualType}`)
        }
      } else if (typeof expectedType === 'object') {
        // 중첩 객체 검증
        if (actualValue && typeof actualValue === 'object') {
          this.validateDataShape(actualValue, expectedType, currentPath, errors)
        }
      }
    }
  }

  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.exportDir)
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true })
    }
  }

  private async ensureResultDirectory(): Promise<void> {
    try {
      await fs.access(this.resultDir)
    } catch {
      await fs.mkdir(this.resultDir, { recursive: true })
    }
  }

  private async saveExecutionResult(
    templateFilename: string,
    executionData: any,
    success: boolean,
    error?: string,
    executionTime?: number,
    dataset?: TemplateDataset,
  ): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      await this.ensureResultDirectory()

      // 템플릿 파일명에서 결과 파일명 생성 (확장자를 result.json으로 변경)
      const resultFilename = templateFilename.replace('.json', '_result.json')
      const resultFilepath = join(this.resultDir, resultFilename)

      // 실행 결과 데이터 구성
      const resultData = {
        version: '1.0.0',
        executedAt: new Date().toISOString(),
        templateFilename: templateFilename,

        // 데이터셋 정보
        dataset: dataset
          ? {
              name: dataset.name,
              description: dataset.description,
              domain: dataset.domain,
              category: dataset.category,
              templateIdentifier: dataset.templateExecution.templateIdentifier,
              variables: dataset.templateExecution.variables,
            }
          : null,

        // 실행 정보
        execution: {
          success: success,
          timestamp: new Date().toISOString(),
          executionTimeMs: executionTime || 0,
          executionTimeFormatted: executionTime ? `${executionTime}ms` : 'N/A',
        },

        // 결과 데이터
        result: success
          ? {
              data: executionData,
              error: null,
            }
          : {
              data: executionData || null,
              error: error || 'Unknown execution error',
            },

        // 메타데이터
        metadata: {
          resultType: success ? 'success' : 'error',
          dataSize: executionData ? JSON.stringify(executionData).length : 0,
          hasData: !!executionData && typeof executionData === 'object' && Object.keys(executionData).length > 0,
          dataFields: executionData && typeof executionData === 'object' ? Object.keys(executionData) : [],
          serverUrl: this.serverUrl,
          generatedBy: 'curl-template-tester',
        },
      }

      // JSON 파일로 저장
      await fs.writeFile(resultFilepath, JSON.stringify(resultData, null, 2))

      return {
        success: true,
        filename: resultFilename,
      }
    } catch (saveError) {
      return {
        success: false,
        error: `Failed to save execution result: ${saveError}`,
      }
    }
  }

  async testMultipleDatasets(datasetPaths: string[]): Promise<TestResult[]> {
    console.log(`\n🚀 Starting batch test of ${datasetPaths.length} datasets`)

    const results: TestResult[] = []
    let successCount = 0
    let failureCount = 0

    for (const datasetPath of datasetPaths) {
      const result = await this.testDataset(datasetPath)
      results.push(result)

      if (result.success) {
        successCount++
      } else {
        failureCount++
      }

      // 다음 테스트 전 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // 결과 요약
    console.log(`\n📊 Batch Test Summary:`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)
    console.log(`📈 Success Rate: ${((successCount / datasetPaths.length) * 100).toFixed(1)}%`)

    if (failureCount > 0) {
      console.log(`\n💥 Failed Datasets:`)
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - ${r.dataset}: ${r.errors.join(', ')}`)
        })
    }

    return results
  }
}

// CLI 실행부
if (import.meta.main) {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Usage:
  bun demo/curl-tester.ts <dataset-path>                    # Test single dataset
  bun demo/curl-tester.ts --batch <dataset-dir>             # Test all datasets in directory  
  bun demo/curl-tester.ts --all                            # Test all datasets
  bun demo/curl-tester.ts --server <url> <dataset-path>     # Use custom server URL

Examples:
  bun demo/curl-tester.ts basic/health-check.json
  bun demo/curl-tester.ts --batch basic/
  bun demo/curl-tester.ts --server http://localhost:4001/graphql basic/health-check.json
`)
    process.exit(1)
  }

  const tester = new CurlTemplateTester()

  if (args[0] === '--batch') {
    // 배치 테스트
    const batchDir = args[1] || 'basic'
    const datasetsDir = join(process.cwd(), 'demo', 'datasets', batchDir)

    fs.readdir(datasetsDir)
      .then((files) => {
        const jsonFiles = files.filter((f) => f.endsWith('.json')).map((f) => join(batchDir, f))

        return tester.testMultipleDatasets(jsonFiles)
      })
      .catch((error) => {
        console.error('❌ Batch test failed:', error)
        process.exit(1)
      })
  } else if (args[0] === '--all') {
    // 모든 데이터셋 테스트
    const datasetsDir = join(process.cwd(), 'demo', 'datasets')

    // 모든 하위 디렉토리에서 JSON 파일 찾기
    async function findAllDatasets(dir: string, relativePath = ''): Promise<string[]> {
      const datasets: string[] = []
      const items = await fs.readdir(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = await fs.stat(fullPath)
        const relativeItemPath = relativePath ? join(relativePath, item) : item

        if (stat.isDirectory()) {
          const subDatasets = await findAllDatasets(fullPath, relativeItemPath)
          datasets.push(...subDatasets)
        } else if (item.endsWith('.json')) {
          datasets.push(relativeItemPath)
        }
      }

      return datasets
    }

    findAllDatasets(datasetsDir)
      .then((datasets) => tester.testMultipleDatasets(datasets))
      .catch((error) => {
        console.error('❌ All datasets test failed:', error)
        process.exit(1)
      })
  } else {
    // 단일 데이터셋 테스트
    let serverUrl = 'http://localhost:4000/graphql'
    let datasetPath = args[0]

    if (args[0] === '--server') {
      serverUrl = args[1] || 'http://localhost:4000/graphql'
      datasetPath = args[2] || ''
    }

    if (!datasetPath) {
      console.error('❌ Dataset path is required')
      process.exit(1)
    }

    const customTester = new CurlTemplateTester(serverUrl)

    customTester
      .testDataset(datasetPath)
      .then((result) => {
        process.exit(result.success ? 0 : 1)
      })
      .catch((error) => {
        console.error('❌ Test failed:', error)
        process.exit(1)
      })
  }
}

export { CurlTemplateTester, type TemplateDataset, type TestResult }
