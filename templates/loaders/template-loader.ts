/**
 * Template Loader - 템플릿 데이터셋의 중앙 집중식 로딩 시스템
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { ILogger } from '@/application/ports/ILogger.js'

export interface TemplateLoadOptions {
  environment: 'production' | 'development' | 'migration'
  includeExamples?: boolean
  validateSchemas?: boolean
  hotReload?: boolean
}

export interface LoadedTemplate {
  id: string
  name: string
  description: string
  queryText: string
  variablesSchema: Record<string, unknown>
  defaultVariables: Record<string, unknown>
  templateType: 'query' | 'mutation'
  tags: string[]
  source: string
  loadedAt: Date
}

export interface TemplateLoadResult {
  templates: LoadedTemplate[]
  errors: TemplateLoadError[]
  metadata: {
    totalFiles: number
    loadedCount: number
    errorCount: number
    loadTimeMs: number
    environment: string
  }
}

export interface TemplateLoadError {
  file: string
  error: string
  details?: unknown
}

export class TemplateLoader {
  private static readonly TEMPLATES_BASE_PATH = join(process.cwd(), 'templates')
  private loadedTemplates = new Map<string, LoadedTemplate>()
  private watcherAbortController?: AbortController
  
  constructor(private readonly logger: ILogger) {}

  /**
   * 지정된 환경의 모든 템플릿을 로드
   */
  async loadTemplates(options: TemplateLoadOptions): Promise<TemplateLoadResult> {
    const startTime = Date.now()
    const result: TemplateLoadResult = {
      templates: [],
      errors: [],
      metadata: {
        totalFiles: 0,
        loadedCount: 0,
        errorCount: 0,
        loadTimeMs: 0,
        environment: options.environment
      }
    }

    try {
      this.logger.info('Starting template loading', { environment: options.environment })

      // 환경별 데이터셋 디렉토리 경로
      const datasetPath = join(TemplateLoader.TEMPLATES_BASE_PATH, 'datasets', options.environment)
      
      // JSON 파일들 스캔
      const templateFiles = await this.scanTemplateFiles(datasetPath)
      result.metadata.totalFiles = templateFiles.length

      // 파일별 로딩
      for (const filePath of templateFiles) {
        try {
          const templates = await this.loadTemplateFile(filePath)
          result.templates.push(...templates)
          result.metadata.loadedCount += templates.length
          
          // 캐시에 저장
          templates.forEach(template => {
            this.loadedTemplates.set(template.id, template)
          })
          
        } catch (error) {
          result.errors.push({
            file: filePath,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error
          })
          result.metadata.errorCount++
        }
      }

      // 예제 파일들도 로드 (옵션)
      if (options.includeExamples) {
        await this.loadExampleTemplates(result)
      }

      // Hot Reload 설정 (개발 환경)
      if (options.hotReload && options.environment === 'development') {
        await this.setupHotReload(datasetPath)
      }

      result.metadata.loadTimeMs = Date.now() - startTime
      
      this.logger.info('Template loading completed', {
        environment: options.environment,
        loadedCount: result.metadata.loadedCount,
        errorCount: result.metadata.errorCount,
        loadTimeMs: result.metadata.loadTimeMs
      })

      return result
    } catch (error) {
      this.logger.error('Template loading failed', { error, options })
      throw error
    }
  }

  /**
   * 특정 템플릿 ID로 로드된 템플릿 조회
   */
  getTemplate(id: string): LoadedTemplate | null {
    return this.loadedTemplates.get(id) || null
  }

  /**
   * 모든 로드된 템플릿 조회
   */
  getAllTemplates(): LoadedTemplate[] {
    return Array.from(this.loadedTemplates.values())
  }

  /**
   * 태그로 템플릿 필터링
   */
  getTemplatesByTags(tags: string[]): LoadedTemplate[] {
    return this.getAllTemplates().filter(template => 
      tags.some(tag => template.tags.includes(tag))
    )
  }

  /**
   * 템플릿 타입으로 필터링
   */
  getTemplatesByType(type: 'query' | 'mutation'): LoadedTemplate[] {
    return this.getAllTemplates().filter(template => template.templateType === type)
  }

  /**
   * Hot Reload 중지
   */
  stopHotReload(): void {
    if (this.watcherAbortController) {
      this.watcherAbortController.abort()
      this.watcherAbortController = undefined
      this.logger.info('Template hot reload stopped')
    }
  }

  /**
   * 템플릿 파일들 스캔
   */
  private async scanTemplateFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          // 재귀적으로 하위 디렉토리 스캔
          const subFiles = await this.scanTemplateFiles(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile() && extname(entry.name) === '.json') {
          files.push(fullPath)
        }
      }
    } catch (error) {
      this.logger.warn('Failed to scan template directory', { dirPath, error })
    }
    
    return files
  }

  /**
   * 개별 템플릿 파일 로드
   */
  private async loadTemplateFile(filePath: string): Promise<LoadedTemplate[]> {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    // 단일 템플릿 또는 템플릿 배열 처리
    const templates = Array.isArray(data) ? data : [data]
    
    return templates.map((template: any) => ({
      id: template.identifier || template.id,
      name: template.name,
      description: template.description || '',
      queryText: template.queryText,
      variablesSchema: template.variablesSchema || {},
      defaultVariables: template.defaultVariables || {},
      templateType: template.templateType || 'query',
      tags: template.tags || [],
      source: filePath,
      loadedAt: new Date()
    }))
  }

  /**
   * 예제 템플릿들 로드
   */
  private async loadExampleTemplates(result: TemplateLoadResult): Promise<void> {
    const examplesPath = join(TemplateLoader.TEMPLATES_BASE_PATH, 'examples')
    
    try {
      // TypeScript 예제 파일들 처리
      const exampleFiles = await this.scanTemplateFiles(examplesPath)
      const tsFiles = exampleFiles.filter(file => extname(file) === '.ts')
      
      // TODO: TypeScript 예제 파일에서 템플릿 추출 로직 구현
      this.logger.debug('Example templates scan completed', { 
        totalFiles: tsFiles.length 
      })
      
    } catch (error) {
      this.logger.warn('Failed to load example templates', { error })
    }
  }

  /**
   * Hot Reload 설정 (개발 환경용)
   */
  private async setupHotReload(watchPath: string): Promise<void> {
    try {
      this.watcherAbortController = new AbortController()
      
      // Node.js fs.watch 또는 Bun watch API 사용
      this.logger.info('Template hot reload enabled', { watchPath })
      
      // TODO: 파일 변경 감지 및 자동 리로드 구현
      // Bun의 watch API 또는 chokidar 사용 검토
      
    } catch (error) {
      this.logger.error('Failed to setup hot reload', { error, watchPath })
    }
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.loadedTemplates.clear()
    this.logger.info('Template cache cleared')
  }
}