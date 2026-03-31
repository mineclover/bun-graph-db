import type { SortContext, SortResult } from '@/domain/value-objects/SortStrategy.js'

/**
 * Custom sort function definition
 */
export interface CustomSortFunction {
  id: string
  name: string
  description: string
  supportedDataTypes: string[]
  priority: number
  parameters?: Record<string, CustomSortParameter>
  handler: CustomSortHandler
  examples?: CustomSortExample[]
  version: string
  author?: string
  tags: string[]
}

/**
 * Parameter definition for custom sort functions
 */
export interface CustomSortParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description: string
  defaultValue?: unknown
  validation?: CustomSortParameterValidation
}

/**
 * Parameter validation rules
 */
export interface CustomSortParameterValidation {
  min?: number
  max?: number
  pattern?: string
  allowedValues?: unknown[]
  customValidator?: (value: unknown) => boolean | string
}

/**
 * Custom sort handler function
 */
export type CustomSortHandler = (
  field: string,
  direction: 'asc' | 'desc',
  context: SortContext,
  parameters?: Record<string, unknown>,
) => SortResult

/**
 * Usage example for custom sort functions
 */
export interface CustomSortExample {
  title: string
  description: string
  field: string
  direction: 'asc' | 'desc'
  parameters?: Record<string, unknown>
  expectedSql: string
}

/**
 * Registration result
 */
export interface RegistrationResult {
  success: boolean
  id?: string
  error?: string
  warnings?: string[]
}

/**
 * Custom sort function usage statistics
 */
export interface CustomSortUsageStats {
  functionId: string
  callCount: number
  averageExecutionTime: number
  lastUsed: Date
  errorCount: number
  successRate: number
}

/**
 * Registry for custom sort functions with extensible operations
 */
export class CustomSortFunctionRegistry {
  private functions = new Map<string, CustomSortFunction>()
  private usageStats = new Map<string, CustomSortUsageStats>()
  private enableStats: boolean

  constructor(options: { enableStats?: boolean } = {}) {
    this.enableStats = options.enableStats ?? true
  }

  /**
   * Register a new custom sort function
   */
  register(sortFunction: CustomSortFunction): RegistrationResult {
    const warnings: string[] = []

    // Validation
    if (!sortFunction.id) {
      return { success: false, error: 'Function ID is required' }
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(sortFunction.id)) {
      return { success: false, error: 'Function ID must be alphanumeric with underscores/hyphens' }
    }

    if (this.functions.has(sortFunction.id)) {
      return { success: false, error: `Function with ID '${sortFunction.id}' already exists` }
    }

    if (!sortFunction.handler || typeof sortFunction.handler !== 'function') {
      return { success: false, error: 'Handler function is required' }
    }

    if (!sortFunction.supportedDataTypes || sortFunction.supportedDataTypes.length === 0) {
      return { success: false, error: 'At least one supported data type is required' }
    }

    // Parameter validation
    if (sortFunction.parameters) {
      for (const [paramName, param] of Object.entries(sortFunction.parameters)) {
        if (!param.name || !param.type || typeof param.required !== 'boolean') {
          return { success: false, error: `Invalid parameter definition for '${paramName}'` }
        }
      }
    }

    // Warnings for best practices
    if (sortFunction.priority < 0 || sortFunction.priority > 100) {
      warnings.push('Priority should typically be between 0-100')
    }

    if (!sortFunction.description) {
      warnings.push('Description is recommended for better documentation')
    }

    if (!sortFunction.examples || sortFunction.examples.length === 0) {
      warnings.push('Usage examples are recommended for better documentation')
    }

    // Store the function
    this.functions.set(sortFunction.id, { ...sortFunction })

    // Initialize stats
    if (this.enableStats) {
      this.usageStats.set(sortFunction.id, {
        functionId: sortFunction.id,
        callCount: 0,
        averageExecutionTime: 0,
        lastUsed: new Date(),
        errorCount: 0,
        successRate: 100,
      })
    }

    return {
      success: true,
      id: sortFunction.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Unregister a custom sort function
   */
  unregister(functionId: string): boolean {
    const removed = this.functions.delete(functionId)
    if (removed && this.enableStats) {
      this.usageStats.delete(functionId)
    }
    return removed
  }

  /**
   * Get a registered function by ID
   */
  get(functionId: string): CustomSortFunction | undefined {
    return this.functions.get(functionId)
  }

  /**
   * Get all registered functions
   */
  getAll(): CustomSortFunction[] {
    return Array.from(this.functions.values())
  }

  /**
   * Get functions that can handle a specific data type
   */
  getByDataType(dataType: string): CustomSortFunction[] {
    return Array.from(this.functions.values())
      .filter((func) => func.supportedDataTypes.includes(dataType) || func.supportedDataTypes.includes('*'))
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get functions by tag
   */
  getByTag(tag: string): CustomSortFunction[] {
    return Array.from(this.functions.values())
      .filter((func) => func.tags.includes(tag))
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Search functions by name or description
   */
  search(query: string): CustomSortFunction[] {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(this.functions.values())
      .filter(
        (func) =>
          func.name.toLowerCase().includes(lowercaseQuery) ||
          func.description.toLowerCase().includes(lowercaseQuery) ||
          func.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
      )
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Execute a custom sort function
   */
  execute(
    functionId: string,
    field: string,
    direction: 'asc' | 'desc',
    context: SortContext,
    parameters?: Record<string, unknown>,
  ): SortResult {
    const func = this.functions.get(functionId)
    if (!func) {
      throw new Error(`Custom sort function '${functionId}' not found`)
    }

    // Validate parameters
    if (func.parameters) {
      const validationResult = this.validateParameters(func.parameters, parameters || {})
      if (!validationResult.valid) {
        throw new Error(`Parameter validation failed: ${validationResult.errors.join(', ')}`)
      }
    }

    const startTime = this.enableStats ? Date.now() : 0

    try {
      // Execute the function
      const result = func.handler(field, direction, context, parameters)

      // Update stats
      if (this.enableStats) {
        this.updateUsageStats(functionId, Date.now() - startTime, true)
      }

      return result
    } catch (error) {
      // Update error stats
      if (this.enableStats) {
        this.updateUsageStats(functionId, Date.now() - startTime, false)
      }
      throw error
    }
  }

  /**
   * Get usage statistics for a function
   */
  getUsageStats(functionId: string): CustomSortUsageStats | undefined {
    return this.usageStats.get(functionId)
  }

  /**
   * Get all usage statistics
   */
  getAllUsageStats(): CustomSortUsageStats[] {
    return Array.from(this.usageStats.values())
  }

  /**
   * Clear usage statistics
   */
  clearStats(): void {
    this.usageStats.clear()
  }

  /**
   * Export registry to JSON
   */
  exportToJSON(): string {
    const exportData = {
      functions: Array.from(this.functions.entries()).map(([_id, func]) => ({
        ...func,
        // Convert handler function to string representation
        handler: func.handler.toString(),
      })),
      stats: this.enableStats ? Array.from(this.usageStats.values()) : [],
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Get registry information
   */
  getInfo(): {
    totalFunctions: number
    functionsByDataType: Record<string, number>
    functionsByTag: Record<string, number>
    averageUsage: number
  } {
    const functions = Array.from(this.functions.values())

    const functionsByDataType: Record<string, number> = {}
    const functionsByTag: Record<string, number> = {}

    functions.forEach((func) => {
      func.supportedDataTypes.forEach((type) => {
        functionsByDataType[type] = (functionsByDataType[type] || 0) + 1
      })
      func.tags.forEach((tag) => {
        functionsByTag[tag] = (functionsByTag[tag] || 0) + 1
      })
    })

    const totalUsage = Array.from(this.usageStats.values()).reduce((sum, stats) => sum + stats.callCount, 0)
    const averageUsage = functions.length > 0 ? totalUsage / functions.length : 0

    return {
      totalFunctions: functions.length,
      functionsByDataType,
      functionsByTag,
      averageUsage,
    }
  }

  // Private helper methods

  private validateParameters(
    paramDefs: Record<string, CustomSortParameter>,
    actualParams: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required parameters
    for (const [paramName, paramDef] of Object.entries(paramDefs)) {
      if (paramDef.required && !(paramName in actualParams)) {
        errors.push(`Required parameter '${paramName}' is missing`)
        continue
      }

      if (paramName in actualParams) {
        const value = actualParams[paramName]

        // Type validation
        if (!this.validateParameterType(value, paramDef.type)) {
          errors.push(`Parameter '${paramName}' must be of type ${paramDef.type}`)
          continue
        }

        // Custom validation
        if (paramDef.validation) {
          const validationError = this.validateParameterValue(value, paramDef.validation)
          if (validationError) {
            errors.push(`Parameter '${paramName}': ${validationError}`)
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  private validateParameterType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return false
    }
  }

  private validateParameterValue(value: unknown, validation: CustomSortParameterValidation): string | null {
    if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
      return `must be at least ${validation.min}`
    }

    if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
      return `must be at most ${validation.max}`
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(value)) {
        return `must match pattern ${validation.pattern}`
      }
    }

    if (validation.allowedValues && !validation.allowedValues.includes(value)) {
      return `must be one of: ${validation.allowedValues.join(', ')}`
    }

    if (validation.customValidator) {
      const result = validation.customValidator(value)
      if (result !== true) {
        return typeof result === 'string' ? result : 'custom validation failed'
      }
    }

    return null
  }

  private updateUsageStats(functionId: string, executionTime: number, success: boolean): void {
    const stats = this.usageStats.get(functionId)
    if (!stats) return

    stats.callCount++
    stats.lastUsed = new Date()

    if (success) {
      // Update average execution time
      stats.averageExecutionTime =
        (stats.averageExecutionTime * (stats.callCount - 1) + executionTime) / stats.callCount
    } else {
      stats.errorCount++
    }

    // Update success rate
    stats.successRate = ((stats.callCount - stats.errorCount) / stats.callCount) * 100
  }
}

/**
 * Global registry instance
 */
export const globalCustomSortRegistry = new CustomSortFunctionRegistry({ enableStats: true })
