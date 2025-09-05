/**
 * Template Validator - 템플릿의 구조적/의미적 검증 시스템
 */

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { ILogger } from '@/application/ports/ILogger.js'

export interface TemplateValidationOptions {
  validateStructure: boolean
  validateVariables: boolean
  validateExecution: boolean
  skipWarnings: boolean
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  metadata: {
    validationTimeMs: number
    checksPerformed: string[]
    templateId: string
  }
}

export interface ValidationError {
  type: 'structure' | 'variable' | 'execution' | 'schema'
  field: string
  message: string
  details?: unknown
  severity: 'error' | 'critical'
}

export interface ValidationWarning {
  type: 'performance' | 'compatibility' | 'style' | 'security'
  field: string
  message: string
  suggestion?: string
}

export interface TemplateStructure {
  identifier: string
  name: string
  description?: string
  queryText: string
  variablesSchema: Record<string, unknown>
  defaultVariables: Record<string, unknown>
  templateType: 'query' | 'mutation'
  tags: string[]
  metadata?: {
    version?: string
    author?: string
    lastModified?: string
    dependencies?: string[]
  }
}

export class TemplateValidator {
  private ajv: Ajv
  private structureSchema: object
  
  constructor(private readonly logger: ILogger) {
    this.ajv = new Ajv({ 
      allErrors: true,
      verbose: true,
      strict: false 
    })
    addFormats(this.ajv)
    
    this.structureSchema = this.createTemplateStructureSchema()
  }

  /**
   * 템플릿 종합 검증
   */
  async validateTemplate(
    template: TemplateStructure, 
    options: TemplateValidationOptions = {
      validateStructure: true,
      validateVariables: true,
      validateExecution: true,
      skipWarnings: false
    }
  ): Promise<TemplateValidationResult> {
    const startTime = Date.now()
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        validationTimeMs: 0,
        checksPerformed: [],
        templateId: template.identifier
      }
    }

    try {
      this.logger.debug('Starting template validation', { 
        templateId: template.identifier,
        options 
      })

      // 1. 구조적 검증
      if (options.validateStructure) {
        await this.validateStructure(template, result)
        result.metadata.checksPerformed.push('structure')
      }

      // 2. 변수 스키마 검증
      if (options.validateVariables) {
        await this.validateVariables(template, result)
        result.metadata.checksPerformed.push('variables')
      }

      // 3. 실행 가능성 검증
      if (options.validateExecution) {
        await this.validateExecution(template, result)
        result.metadata.checksPerformed.push('execution')
      }

      // 4. 경고 검사 (옵션)
      if (!options.skipWarnings) {
        await this.generateWarnings(template, result)
        result.metadata.checksPerformed.push('warnings')
      }

      // 최종 검증 결과
      result.isValid = result.errors.length === 0
      result.metadata.validationTimeMs = Date.now() - startTime

      this.logger.debug('Template validation completed', {
        templateId: template.identifier,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        validationTimeMs: result.metadata.validationTimeMs
      })

      return result
    } catch (error) {
      this.logger.error('Template validation failed', { 
        templateId: template.identifier, 
        error 
      })
      
      result.isValid = false
      result.errors.push({
        type: 'schema',
        field: 'validation',
        message: 'Validation process failed',
        details: error,
        severity: 'critical'
      })
      
      return result
    }
  }

  /**
   * 배치 검증 - 여러 템플릿 동시 검증
   */
  async validateBatch(
    templates: TemplateStructure[],
    options?: TemplateValidationOptions
  ): Promise<Map<string, TemplateValidationResult>> {
    const results = new Map<string, TemplateValidationResult>()
    
    this.logger.info('Starting batch template validation', { 
      templateCount: templates.length 
    })

    const validationPromises = templates.map(async template => {
      const result = await this.validateTemplate(template, options)
      results.set(template.identifier, result)
    })

    await Promise.all(validationPromises)

    const summary = {
      total: templates.length,
      valid: Array.from(results.values()).filter(r => r.isValid).length,
      invalid: Array.from(results.values()).filter(r => !r.isValid).length
    }

    this.logger.info('Batch validation completed', summary)
    return results
  }

  /**
   * 구조적 검증
   */
  private async validateStructure(
    template: TemplateStructure, 
    result: TemplateValidationResult
  ): Promise<void> {
    // JSON Schema 기반 구조 검증
    const validate = this.ajv.compile(this.structureSchema)
    const isValid = validate(template)

    if (!isValid && validate.errors) {
      for (const error of validate.errors) {
        result.errors.push({
          type: 'structure',
          field: error.instancePath || error.schemaPath,
          message: error.message || 'Structure validation failed',
          details: error,
          severity: 'error'
        })
      }
    }

    // 추가 구조적 검사
    if (!template.identifier || template.identifier.length === 0) {
      result.errors.push({
        type: 'structure',
        field: 'identifier',
        message: 'Template identifier is required',
        severity: 'critical'
      })
    }

    if (!template.queryText || template.queryText.trim().length === 0) {
      result.errors.push({
        type: 'structure',
        field: 'queryText',
        message: 'Query text is required',
        severity: 'critical'
      })
    }
  }

  /**
   * 변수 스키마 검증
   */
  private async validateVariables(
    template: TemplateStructure, 
    result: TemplateValidationResult
  ): Promise<void> {
    // 변수 스키마가 유효한 JSON Schema인지 검증
    try {
      if (template.variablesSchema && Object.keys(template.variablesSchema).length > 0) {
        const validator = new Ajv({ strict: false })
        validator.compile(template.variablesSchema)
      }
    } catch (error) {
      result.errors.push({
        type: 'variable',
        field: 'variablesSchema',
        message: 'Variables schema is not a valid JSON schema',
        details: error,
        severity: 'error'
      })
    }

    // 기본 변수가 스키마와 일치하는지 검증
    if (template.defaultVariables && template.variablesSchema) {
      try {
        const validator = this.ajv.compile(template.variablesSchema)
        const isValid = validator(template.defaultVariables)
        
        if (!isValid && validator.errors) {
          for (const error of validator.errors) {
            result.errors.push({
              type: 'variable',
              field: `defaultVariables${error.instancePath}`,
              message: `Default variable validation failed: ${error.message}`,
              details: error,
              severity: 'error'
            })
          }
        }
      } catch (error) {
        result.errors.push({
          type: 'variable',
          field: 'defaultVariables',
          message: 'Default variables validation failed',
          details: error,
          severity: 'error'
        })
      }
    }
  }

  /**
   * 실행 가능성 검증
   */
  private async validateExecution(
    template: TemplateStructure, 
    result: TemplateValidationResult
  ): Promise<void> {
    // GraphQL 구문 검증
    try {
      // TODO: GraphQL 파서로 쿼리 구문 검증
      const queryText = template.queryText.trim()
      
      // 기본적인 GraphQL 구조 검사
      if (template.templateType === 'query' && !queryText.includes('query')) {
        result.warnings.push({
          type: 'compatibility',
          field: 'queryText',
          message: 'Query template should contain query operation',
          suggestion: 'Add explicit query operation declaration'
        })
      }
      
      if (template.templateType === 'mutation' && !queryText.includes('mutation')) {
        result.warnings.push({
          type: 'compatibility',
          field: 'queryText',
          message: 'Mutation template should contain mutation operation',
          suggestion: 'Add explicit mutation operation declaration'
        })
      }

      // 변수 참조 검증
      this.validateVariableReferences(template, result)
      
    } catch (error) {
      result.errors.push({
        type: 'execution',
        field: 'queryText',
        message: 'GraphQL syntax validation failed',
        details: error,
        severity: 'error'
      })
    }
  }

  /**
   * 변수 참조 검증
   */
  private validateVariableReferences(
    template: TemplateStructure,
    result: TemplateValidationResult
  ): void {
    const queryText = template.queryText
    const variableSchema = template.variablesSchema || {}
    
    // 쿼리에서 변수 참조 추출 ($variable 패턴)
    const variableReferences = queryText.match(/\$\w+/g) || []
    const referencedVars = variableReferences.map(ref => ref.substring(1))
    const definedVars = Object.keys(variableSchema)
    
    // 정의되지 않은 변수 참조 검사
    for (const referencedVar of referencedVars) {
      if (!definedVars.includes(referencedVar)) {
        result.errors.push({
          type: 'execution',
          field: 'queryText',
          message: `Referenced variable '$${referencedVar}' is not defined in variablesSchema`,
          severity: 'error'
        })
      }
    }
    
    // 사용되지 않는 변수 정의 검사
    for (const definedVar of definedVars) {
      if (!referencedVars.includes(definedVar)) {
        result.warnings.push({
          type: 'style',
          field: 'variablesSchema',
          message: `Variable '${definedVar}' is defined but not used in query`,
          suggestion: 'Remove unused variable or add it to query'
        })
      }
    }
  }

  /**
   * 경고 생성
   */
  private async generateWarnings(
    template: TemplateStructure,
    result: TemplateValidationResult
  ): Promise<void> {
    // 성능 관련 경고
    if (template.queryText.length > 5000) {
      result.warnings.push({
        type: 'performance',
        field: 'queryText',
        message: 'Very large query text may impact performance',
        suggestion: 'Consider breaking down into smaller templates'
      })
    }

    // 보안 관련 경고
    if (template.queryText.toLowerCase().includes('delete') || 
        template.queryText.toLowerCase().includes('drop')) {
      result.warnings.push({
        type: 'security',
        field: 'queryText',
        message: 'Template contains potentially dangerous operations',
        suggestion: 'Review security implications carefully'
      })
    }

    // 스타일 관련 경고
    if (!template.description || template.description.length < 10) {
      result.warnings.push({
        type: 'style',
        field: 'description',
        message: 'Template description is too short or missing',
        suggestion: 'Add detailed description for better documentation'
      })
    }
  }

  /**
   * 템플릿 구조 스키마 생성
   */
  private createTemplateStructureSchema(): object {
    return {
      type: 'object',
      required: ['identifier', 'name', 'queryText', 'templateType'],
      properties: {
        identifier: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-zA-Z0-9_-]+$'
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 200
        },
        description: {
          type: 'string',
          maxLength: 1000
        },
        queryText: {
          type: 'string',
          minLength: 1
        },
        variablesSchema: {
          type: 'object'
        },
        defaultVariables: {
          type: 'object'
        },
        templateType: {
          type: 'string',
          enum: ['query', 'mutation']
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          }
        },
        metadata: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            author: { type: 'string' },
            lastModified: { type: 'string' },
            dependencies: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }
}