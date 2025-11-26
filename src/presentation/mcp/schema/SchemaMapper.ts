/**
 * Schema Mapping Utilities Implementation
 *
 * Purpose: Converts template inputSchema to MCP-compatible format
 * Task: Phase 2, Task 8 - Schema Mapping Utilities Implementation
 * Dependencies: Tasks 6-7 (RED phase complete)
 * Sequential: Implements after tests written
 */

export interface JsonSchema {
  type: string
  description: string
  format?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: boolean
  exclusiveMaximum?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  default?: any
  enum?: any[]
  additionalProperties?: boolean
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
}

export interface TemplateParameter {
  name: string
  type: string
  description: string
  required: boolean
  default?: any
  constraints?: string
}

export interface McpInputSchema {
  type: 'object'
  properties: Record<string, JsonSchema>
  required: string[]
  additionalProperties?: boolean
}

/**
 * Schema mapping utilities for converting SQLite types and template parameters
 * to MCP-compatible JSON Schema format
 */
export class SchemaMapper {
  private static readonly TYPE_MAPPINGS: Record<string, JsonSchema> = {
    // Text types
    TEXT: { type: 'string', description: 'Text value' },
    VARCHAR: { type: 'string', description: 'Variable length text' },
    CHAR: { type: 'string', description: 'Fixed length text' },
    STRING: { type: 'string', description: 'String value' },

    // Numeric types
    INTEGER: { type: 'number', description: 'Integer value' },
    INT: { type: 'number', description: 'Integer value' },
    REAL: { type: 'number', description: 'Numeric value' },
    NUMERIC: { type: 'number', description: 'Numeric value' },
    DECIMAL: { type: 'number', description: 'Decimal value' },
    FLOAT: { type: 'number', description: 'Floating point value' },
    DOUBLE: { type: 'number', description: 'Double precision value' },

    // Boolean types
    BOOLEAN: { type: 'boolean', description: 'Boolean value' },
    BOOL: { type: 'boolean', description: 'Boolean value' },
    BIT: { type: 'boolean', description: 'Bit value' },

    // Date/Time types
    DATE: { type: 'string', description: 'Date value', format: 'date' },
    DATETIME: { type: 'string', description: 'Date and time value', format: 'date-time' },
    TIMESTAMP: { type: 'string', description: 'Timestamp value', format: 'date-time' },
    TIME: { type: 'string', description: 'Time value', format: 'time' },

    // Object/Binary types
    JSON: { type: 'object', description: 'JSON object', additionalProperties: true },
    BLOB: { type: 'string', description: 'Binary data (base64 encoded)', format: 'base64' },

    // UUID type
    UUID: { type: 'string', description: 'UUID value', format: 'uuid' }
  }

  /**
   * Map SQLite type to JSON Schema
   */
  static mapSqliteTypeToJsonSchema(sqliteType: string | null | undefined): JsonSchema {
    if (!sqliteType || typeof sqliteType !== 'string' || sqliteType.trim() === '') {
      throw new Error('SQLite type must be a non-empty string')
    }

    const normalizedType = sqliteType.trim().toUpperCase()

    // Extract base type from complex definitions like "VARCHAR(255)" or "INTEGER NOT NULL"
    const baseType = this.extractBaseType(normalizedType)

    // Get base schema from type mappings
    const baseSchema = this.TYPE_MAPPINGS[baseType] || {
      type: 'string',
      description: 'Unknown type (treated as string)'
    }

    // Clone the base schema to avoid mutations
    const schema: JsonSchema = { ...baseSchema }

    // Apply constraints and modifiers
    this.applyConstraints(schema, normalizedType)

    return schema
  }

  /**
   * Extract base type from complex SQLite type definition
   */
  private static extractBaseType(normalizedType: string): string {
    // Handle types with parentheses like VARCHAR(255), DECIMAL(10,2)
    const parenthesesMatch = normalizedType.match(/^(\w+)(?:\([^)]*\))?/)
    if (parenthesesMatch && parenthesesMatch[1]) {
      return parenthesesMatch[1]
    }

    // Handle types with constraints like "INTEGER NOT NULL"
    const constraintMatch = normalizedType.match(/^(\w+)/)
    if (constraintMatch && constraintMatch[1]) {
      return constraintMatch[1]
    }

    return normalizedType
  }

  /**
   * Apply constraints and modifiers from SQLite type definition to JSON Schema
   */
  private static applyConstraints(schema: JsonSchema, normalizedType: string): void {
    // Handle NOT NULL constraint
    if (normalizedType.includes('NOT NULL')) {
      schema.description = schema.description + ' (required)'
    }

    // Handle DEFAULT values
    const defaultMatch = normalizedType.match(/DEFAULT\s+(.+?)(?:\s|$)/)
    if (defaultMatch && defaultMatch[1]) {
      const defaultValue = this.parseDefaultValue(defaultMatch[1], schema.type)
      if (defaultValue !== null) {
        schema.default = defaultValue
      }
    }

    // Handle VARCHAR length constraints
    const varcharMatch = normalizedType.match(/VARCHAR\((\d+)\)/)
    if (varcharMatch && varcharMatch[1]) {
      schema.maxLength = parseInt(varcharMatch[1], 10)
    }

    // Handle CHAR length constraints
    const charMatch = normalizedType.match(/CHAR\((\d+)\)/)
    if (charMatch && charMatch[1]) {
      const length = parseInt(charMatch[1], 10)
      schema.minLength = length
      schema.maxLength = length
    }

    // Handle CHECK constraints for numeric types
    if (schema.type === 'number') {
      const checkMatch = normalizedType.match(/CHECK\s*\(\s*\w+\s*([><=]+)\s*([^)]+)\s*\)/)
      if (checkMatch && checkMatch[1] && checkMatch[2]) {
        const operator = checkMatch[1].trim()
        const value = parseFloat(checkMatch[2].trim())

        if (!isNaN(value)) {
          switch (operator) {
            case '>':
              schema.minimum = value
              schema.exclusiveMinimum = true
              break
            case '>=':
              schema.minimum = value
              break
            case '<':
              schema.maximum = value
              schema.exclusiveMaximum = true
              break
            case '<=':
              schema.maximum = value
              break
          }
        }
      }
    }
  }

  /**
   * Parse default value from SQLite type definition
   */
  private static parseDefaultValue(defaultStr: string, schemaType: string): any {
    const cleanDefault = defaultStr.replace(/['"`]/g, '').trim()

    switch (schemaType) {
      case 'string':
        return cleanDefault
      case 'number':
        const numValue = parseFloat(cleanDefault)
        return isNaN(numValue) ? null : numValue
      case 'boolean':
        return cleanDefault.toLowerCase() === 'true' || cleanDefault === '1'
      default:
        return cleanDefault
    }
  }

  /**
   * Map template parameters to MCP input schema
   */
  static mapTemplateParameterToMcpSchema(parameters: TemplateParameter[]): McpInputSchema {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []

    parameters.forEach(param => {
      try {
        const jsonSchema = this.mapSqliteTypeToJsonSchema(param.type)

        // Override description if provided in parameter
        if (param.description) {
          jsonSchema.description = param.description
        }

        // Add default value if provided
        if (param.default !== undefined) {
          jsonSchema.default = param.default
        }

        properties[param.name] = jsonSchema

        if (param.required) {
          required.push(param.name)
        }
      } catch (error) {
        console.warn(`Failed to map parameter ${param.name}: ${error}`)
        // Fallback to string type
        properties[param.name] = {
          type: 'string',
          description: param.description || 'Parameter value'
        }
        if (param.required) {
          required.push(param.name)
        }
      }
    })

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    }
  }

  /**
   * Validate JSON Schema structure
   */
  static validateJsonSchema(schema: any): boolean {
    if (!schema || typeof schema !== 'object') {
      return false
    }

    // Check required properties
    if (!schema.type || typeof schema.type !== 'string') {
      return false
    }

    // Validate type values
    const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']
    if (!validTypes.includes(schema.type)) {
      return false
    }

    // Check description
    if (schema.description !== undefined && typeof schema.description !== 'string') {
      return false
    }

    // Validate additionalProperties if present
    if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
      return false
    }

    // Validate properties if object type
    if (schema.type === 'object' && schema.properties) {
      if (typeof schema.properties !== 'object') {
        return false
      }

      // Recursively validate nested properties
      for (const prop of Object.values(schema.properties)) {
        if (!this.validateJsonSchema(prop)) {
          return false
        }
      }
    }

    // Validate required array if present
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) {
        return false
      }

      for (const req of schema.required) {
        if (typeof req !== 'string') {
          return false
        }
      }
    }

    return true
  }

  /**
   * Convert template definition to MCP tool schema
   */
  static convertTemplateToMcpTool(template: {
    identifier: string
    name: string
    description?: string
    inputSchema?: any
    parameters?: TemplateParameter[]
  }): {
    name: string
    description: string
    inputSchema: McpInputSchema
  } {
    let mcpInputSchema: McpInputSchema

    // If template has parameters array, use that
    if (template.parameters && Array.isArray(template.parameters)) {
      mcpInputSchema = this.mapTemplateParameterToMcpSchema(template.parameters)
    }
    // If template has inputSchema, try to convert or use as-is
    else if (template.inputSchema) {
      if (this.validateJsonSchema(template.inputSchema)) {
        mcpInputSchema = template.inputSchema as McpInputSchema
      } else {
        console.warn(`Invalid inputSchema for template ${template.identifier}, using empty schema`)
        mcpInputSchema = {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
    // Fallback to empty schema
    else {
      mcpInputSchema = {
        type: 'object',
        properties: {},
        required: []
      }
    }

    return {
      name: template.identifier,
      description: template.description || template.name || 'Template execution tool',
      inputSchema: mcpInputSchema
    }
  }
}

/**
 * Error handling for schema mapping
 */
export class SchemaMappingError extends Error {
  constructor(message: string, public readonly originalType?: string) {
    super(message)
    this.name = 'SchemaMappingError'
  }
}

/**
 * Validation error with detailed information
 */
export interface SchemaValidationError {
  path: string
  message: string
  value?: any
  expected?: string
}

/**
 * Validation result with errors
 */
export interface SchemaValidationResult {
  valid: boolean
  errors: SchemaValidationError[]
  warnings: SchemaValidationError[]
}

/**
 * MCP-specific schema validator (JSON Schema Draft-07 compliant)
 */
export class McpSchemaValidator {
  private static readonly VALID_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']
  private static readonly VALID_FORMATS = ['date', 'date-time', 'time', 'email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6', 'regex']

  /**
   * Validate inputSchema for MCP tool compatibility
   * MCP requires type: "object" at the root level
   */
  static validateMcpInputSchema(schema: any): SchemaValidationResult {
    const errors: SchemaValidationError[] = []
    const warnings: SchemaValidationError[] = []

    // Check if schema exists
    if (!schema || typeof schema !== 'object') {
      errors.push({
        path: '$',
        message: 'Schema must be a non-null object',
        value: schema,
        expected: 'object'
      })
      return { valid: false, errors, warnings }
    }

    // MCP requires root type to be "object"
    if (schema.type !== 'object') {
      errors.push({
        path: '$.type',
        message: 'MCP inputSchema must have type "object" at root level',
        value: schema.type,
        expected: 'object'
      })
    }

    // Validate properties object
    if (schema.properties !== undefined) {
      if (typeof schema.properties !== 'object' || schema.properties === null) {
        errors.push({
          path: '$.properties',
          message: 'properties must be an object',
          value: typeof schema.properties,
          expected: 'object'
        })
      } else {
        // Validate each property
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          this.validatePropertySchema(propSchema, `$.properties.${propName}`, errors, warnings)
        }
      }
    }

    // Validate required array
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) {
        errors.push({
          path: '$.required',
          message: 'required must be an array of strings',
          value: typeof schema.required,
          expected: 'array'
        })
      } else {
        // Check all required items are strings
        schema.required.forEach((item: any, index: number) => {
          if (typeof item !== 'string') {
            errors.push({
              path: `$.required[${index}]`,
              message: 'required array items must be strings',
              value: typeof item,
              expected: 'string'
            })
          }
        })

        // Check required fields exist in properties
        if (schema.properties) {
          schema.required.forEach((field: string) => {
            if (!(field in schema.properties)) {
              warnings.push({
                path: `$.required`,
                message: `Required field "${field}" not found in properties`,
                value: field,
                expected: 'defined property'
              })
            }
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate individual property schema
   */
  private static validatePropertySchema(
    schema: any,
    path: string,
    errors: SchemaValidationError[],
    warnings: SchemaValidationError[]
  ): void {
    if (!schema || typeof schema !== 'object') {
      errors.push({
        path,
        message: 'Property schema must be an object',
        value: typeof schema,
        expected: 'object'
      })
      return
    }

    // Validate type
    if (!schema.type) {
      errors.push({
        path: `${path}.type`,
        message: 'Property must have a type',
        expected: this.VALID_TYPES.join(' | ')
      })
    } else if (!this.VALID_TYPES.includes(schema.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid type "${schema.type}"`,
        value: schema.type,
        expected: this.VALID_TYPES.join(' | ')
      })
    }

    // Validate description (recommended)
    if (!schema.description) {
      warnings.push({
        path: `${path}.description`,
        message: 'Property should have a description for better AI understanding'
      })
    } else if (typeof schema.description !== 'string') {
      errors.push({
        path: `${path}.description`,
        message: 'description must be a string',
        value: typeof schema.description,
        expected: 'string'
      })
    }

    // Validate format if present
    if (schema.format !== undefined) {
      if (typeof schema.format !== 'string') {
        errors.push({
          path: `${path}.format`,
          message: 'format must be a string',
          value: typeof schema.format,
          expected: 'string'
        })
      } else if (!this.VALID_FORMATS.includes(schema.format)) {
        warnings.push({
          path: `${path}.format`,
          message: `Non-standard format "${schema.format}"`,
          value: schema.format,
          expected: this.VALID_FORMATS.join(' | ')
        })
      }
    }

    // Validate enum if present
    if (schema.enum !== undefined) {
      if (!Array.isArray(schema.enum)) {
        errors.push({
          path: `${path}.enum`,
          message: 'enum must be an array',
          value: typeof schema.enum,
          expected: 'array'
        })
      } else if (schema.enum.length === 0) {
        errors.push({
          path: `${path}.enum`,
          message: 'enum array must not be empty'
        })
      }
    }

    // Validate numeric constraints
    if (schema.type === 'number' || schema.type === 'integer') {
      this.validateNumericConstraints(schema, path, errors)
    }

    // Validate string constraints
    if (schema.type === 'string') {
      this.validateStringConstraints(schema, path, errors)
    }

    // Validate array items
    if (schema.type === 'array') {
      if (schema.items) {
        this.validatePropertySchema(schema.items, `${path}.items`, errors, warnings)
      } else {
        warnings.push({
          path: `${path}.items`,
          message: 'Array type should define items schema'
        })
      }
    }

    // Validate nested object properties
    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        this.validatePropertySchema(propSchema, `${path}.properties.${propName}`, errors, warnings)
      }
    }
  }

  /**
   * Validate numeric constraints
   */
  private static validateNumericConstraints(
    schema: any,
    path: string,
    errors: SchemaValidationError[]
  ): void {
    if (schema.minimum !== undefined && typeof schema.minimum !== 'number') {
      errors.push({
        path: `${path}.minimum`,
        message: 'minimum must be a number',
        value: typeof schema.minimum,
        expected: 'number'
      })
    }

    if (schema.maximum !== undefined && typeof schema.maximum !== 'number') {
      errors.push({
        path: `${path}.maximum`,
        message: 'maximum must be a number',
        value: typeof schema.maximum,
        expected: 'number'
      })
    }

    // Check minimum <= maximum
    if (typeof schema.minimum === 'number' && typeof schema.maximum === 'number') {
      if (schema.minimum > schema.maximum) {
        errors.push({
          path: `${path}`,
          message: 'minimum cannot be greater than maximum',
          value: `min: ${schema.minimum}, max: ${schema.maximum}`
        })
      }
    }
  }

  /**
   * Validate string constraints
   */
  private static validateStringConstraints(
    schema: any,
    path: string,
    errors: SchemaValidationError[]
  ): void {
    if (schema.minLength !== undefined) {
      if (typeof schema.minLength !== 'number' || schema.minLength < 0) {
        errors.push({
          path: `${path}.minLength`,
          message: 'minLength must be a non-negative number',
          value: schema.minLength,
          expected: 'number >= 0'
        })
      }
    }

    if (schema.maxLength !== undefined) {
      if (typeof schema.maxLength !== 'number' || schema.maxLength < 0) {
        errors.push({
          path: `${path}.maxLength`,
          message: 'maxLength must be a non-negative number',
          value: schema.maxLength,
          expected: 'number >= 0'
        })
      }
    }

    // Check minLength <= maxLength
    if (typeof schema.minLength === 'number' && typeof schema.maxLength === 'number') {
      if (schema.minLength > schema.maxLength) {
        errors.push({
          path: `${path}`,
          message: 'minLength cannot be greater than maxLength',
          value: `min: ${schema.minLength}, max: ${schema.maxLength}`
        })
      }
    }

    // Validate pattern if present
    if (schema.pattern !== undefined) {
      if (typeof schema.pattern !== 'string') {
        errors.push({
          path: `${path}.pattern`,
          message: 'pattern must be a string',
          value: typeof schema.pattern,
          expected: 'string'
        })
      } else {
        try {
          new RegExp(schema.pattern)
        } catch {
          errors.push({
            path: `${path}.pattern`,
            message: 'pattern is not a valid regular expression',
            value: schema.pattern
          })
        }
      }
    }
  }

  /**
   * Format validation result as human-readable string
   */
  static formatValidationResult(result: SchemaValidationResult): string {
    const lines: string[] = []

    if (result.valid) {
      lines.push('✅ Schema is valid for MCP')
    } else {
      lines.push('❌ Schema validation failed')
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:')
      result.errors.forEach(err => {
        lines.push(`  • ${err.path}: ${err.message}`)
        if (err.value !== undefined) lines.push(`    Got: ${JSON.stringify(err.value)}`)
        if (err.expected) lines.push(`    Expected: ${err.expected}`)
      })
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:')
      result.warnings.forEach(warn => {
        lines.push(`  ⚠ ${warn.path}: ${warn.message}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Quick validation check (returns boolean)
   */
  static isValid(schema: any): boolean {
    return this.validateMcpInputSchema(schema).valid
  }

  /**
   * Create a valid empty MCP inputSchema
   */
  static createEmptySchema(): McpInputSchema {
    return {
      type: 'object',
      properties: {},
      required: []
    }
  }

  /**
   * Create schema from simple field definitions
   */
  static createSchemaFromFields(fields: Array<{
    name: string
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
    description?: string
    required?: boolean
    enum?: any[]
    default?: any
  }>): McpInputSchema {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []

    fields.forEach(field => {
      const prop: JsonSchema = {
        type: field.type,
        description: field.description || `${field.name} parameter`
      }

      if (field.enum) prop.enum = field.enum
      if (field.default !== undefined) prop.default = field.default

      properties[field.name] = prop

      if (field.required) {
        required.push(field.name)
      }
    })

    return {
      type: 'object',
      properties,
      required
    }
  }
}

/**
 * Utility functions for schema operations
 */
export const SchemaUtils = {
  /**
   * Check if a schema is compatible with MCP requirements
   */
  isCompatibleWithMcp(schema: any): boolean {
    return SchemaMapper.validateJsonSchema(schema) &&
           schema.type === 'object' &&
           typeof schema.properties === 'object'
  },

  /**
   * Merge multiple schemas (for complex template compositions)
   */
  mergeSchemas(schemas: JsonSchema[]): JsonSchema {
    const merged: JsonSchema = {
      type: 'object',
      description: 'Merged schema',
      properties: {},
      required: []
    }

    schemas.forEach(schema => {
      if (schema.type === 'object' && schema.properties) {
        Object.assign(merged.properties!, schema.properties)

        if (schema.required) {
          merged.required = [...(merged.required || []), ...schema.required]
        }
      }
    })

    // Remove duplicates from required array
    if (merged.required) {
      merged.required = [...new Set(merged.required)]
    }

    return merged
  },

  /**
   * Extract schema requirements for validation
   */
  getSchemaRequirements(schema: JsonSchema): {
    requiredFields: string[]
    optionalFields: string[]
    fieldTypes: Record<string, string>
  } {
    const requirements = {
      requiredFields: schema.required || [],
      optionalFields: [] as string[],
      fieldTypes: {} as Record<string, string>
    }

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, fieldSchema]) => {
        requirements.fieldTypes[field] = fieldSchema.type

        if (!requirements.requiredFields.includes(field)) {
          requirements.optionalFields.push(field)
        }
      })
    }

    return requirements
  }
}