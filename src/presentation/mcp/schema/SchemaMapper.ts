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
    UUID: { type: 'string', description: 'UUID value', format: 'uuid' },
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
    const baseType = SchemaMapper.extractBaseType(normalizedType)

    // Get base schema from type mappings
    const baseSchema = SchemaMapper.TYPE_MAPPINGS[baseType] || {
      type: 'string',
      description: 'Unknown type (treated as string)',
    }

    // Clone the base schema to avoid mutations
    const schema: JsonSchema = { ...baseSchema }

    // Apply constraints and modifiers
    SchemaMapper.applyConstraints(schema, normalizedType)

    return schema
  }

  /**
   * Extract base type from complex SQLite type definition
   */
  private static extractBaseType(normalizedType: string): string {
    // Handle types with parentheses like VARCHAR(255), DECIMAL(10,2)
    const parenthesesMatch = normalizedType.match(/^(\w+)(?:\([^)]*\))?/)
    if (parenthesesMatch?.[1]) {
      return parenthesesMatch[1]
    }

    // Handle types with constraints like "INTEGER NOT NULL"
    const constraintMatch = normalizedType.match(/^(\w+)/)
    if (constraintMatch?.[1]) {
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
      schema.description = `${schema.description} (required)`
    }

    // Handle DEFAULT values
    const defaultMatch = normalizedType.match(/DEFAULT\s+(.+?)(?:\s|$)/)
    if (defaultMatch?.[1]) {
      const defaultValue = SchemaMapper.parseDefaultValue(defaultMatch[1], schema.type)
      if (defaultValue !== null) {
        schema.default = defaultValue
      }
    }

    // Handle VARCHAR length constraints
    const varcharMatch = normalizedType.match(/VARCHAR\((\d+)\)/)
    if (varcharMatch?.[1]) {
      schema.maxLength = parseInt(varcharMatch[1], 10)
    }

    // Handle CHAR length constraints
    const charMatch = normalizedType.match(/CHAR\((\d+)\)/)
    if (charMatch?.[1]) {
      const length = parseInt(charMatch[1], 10)
      schema.minLength = length
      schema.maxLength = length
    }

    // Handle CHECK constraints for numeric types
    if (schema.type === 'number') {
      const checkMatch = normalizedType.match(/CHECK\s*\(\s*\w+\s*([><=]+)\s*([^)]+)\s*\)/)
      if (checkMatch?.[1] && checkMatch[2]) {
        const operator = checkMatch[1].trim()
        const value = parseFloat(checkMatch[2].trim())

        if (!Number.isNaN(value)) {
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
      case 'number': {
        const numValue = parseFloat(cleanDefault)
        return Number.isNaN(numValue) ? null : numValue
      }
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

    parameters.forEach((param) => {
      try {
        const jsonSchema = SchemaMapper.mapSqliteTypeToJsonSchema(param.type)

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
          description: param.description || 'Parameter value',
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
      additionalProperties: false,
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
        if (!SchemaMapper.validateJsonSchema(prop)) {
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
      mcpInputSchema = SchemaMapper.mapTemplateParameterToMcpSchema(template.parameters)
    }
    // If template has inputSchema, try to convert or use as-is
    else if (template.inputSchema) {
      if (SchemaMapper.validateJsonSchema(template.inputSchema)) {
        mcpInputSchema = template.inputSchema as McpInputSchema
      } else {
        console.warn(`Invalid inputSchema for template ${template.identifier}, using empty schema`)
        mcpInputSchema = {
          type: 'object',
          properties: {},
          required: [],
        }
      }
    }
    // Fallback to empty schema
    else {
      mcpInputSchema = {
        type: 'object',
        properties: {},
        required: [],
      }
    }

    return {
      name: template.identifier,
      description: template.description || template.name || 'Template execution tool',
      inputSchema: mcpInputSchema,
    }
  }
}

/**
 * Error handling for schema mapping
 */
export class SchemaMappingError extends Error {
  constructor(
    message: string,
    public readonly originalType?: string,
  ) {
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
  private static readonly VALID_FORMATS = [
    'date',
    'date-time',
    'time',
    'email',
    'uri',
    'uuid',
    'hostname',
    'ipv4',
    'ipv6',
    'regex',
  ]

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
        expected: 'object',
      })
      return { valid: false, errors, warnings }
    }

    // MCP requires root type to be "object"
    if (schema.type !== 'object') {
      errors.push({
        path: '$.type',
        message: 'MCP inputSchema must have type "object" at root level',
        value: schema.type,
        expected: 'object',
      })
    }

    // Validate properties object
    if (schema.properties !== undefined) {
      if (typeof schema.properties !== 'object' || schema.properties === null) {
        errors.push({
          path: '$.properties',
          message: 'properties must be an object',
          value: typeof schema.properties,
          expected: 'object',
        })
      } else {
        // Validate each property
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          McpSchemaValidator.validatePropertySchema(propSchema, `$.properties.${propName}`, errors, warnings)
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
          expected: 'array',
        })
      } else {
        // Check all required items are strings
        schema.required.forEach((item: any, index: number) => {
          if (typeof item !== 'string') {
            errors.push({
              path: `$.required[${index}]`,
              message: 'required array items must be strings',
              value: typeof item,
              expected: 'string',
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
                expected: 'defined property',
              })
            }
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate individual property schema
   */
  private static validatePropertySchema(
    schema: any,
    path: string,
    errors: SchemaValidationError[],
    warnings: SchemaValidationError[],
  ): void {
    if (!schema || typeof schema !== 'object') {
      errors.push({
        path,
        message: 'Property schema must be an object',
        value: typeof schema,
        expected: 'object',
      })
      return
    }

    // Validate type
    if (!schema.type) {
      errors.push({
        path: `${path}.type`,
        message: 'Property must have a type',
        expected: McpSchemaValidator.VALID_TYPES.join(' | '),
      })
    } else if (!McpSchemaValidator.VALID_TYPES.includes(schema.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid type "${schema.type}"`,
        value: schema.type,
        expected: McpSchemaValidator.VALID_TYPES.join(' | '),
      })
    }

    // Validate description (recommended)
    if (!schema.description) {
      warnings.push({
        path: `${path}.description`,
        message: 'Property should have a description for better AI understanding',
      })
    } else if (typeof schema.description !== 'string') {
      errors.push({
        path: `${path}.description`,
        message: 'description must be a string',
        value: typeof schema.description,
        expected: 'string',
      })
    }

    // Validate format if present
    if (schema.format !== undefined) {
      if (typeof schema.format !== 'string') {
        errors.push({
          path: `${path}.format`,
          message: 'format must be a string',
          value: typeof schema.format,
          expected: 'string',
        })
      } else if (!McpSchemaValidator.VALID_FORMATS.includes(schema.format)) {
        warnings.push({
          path: `${path}.format`,
          message: `Non-standard format "${schema.format}"`,
          value: schema.format,
          expected: McpSchemaValidator.VALID_FORMATS.join(' | '),
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
          expected: 'array',
        })
      } else if (schema.enum.length === 0) {
        errors.push({
          path: `${path}.enum`,
          message: 'enum array must not be empty',
        })
      }
    }

    // Validate numeric constraints
    if (schema.type === 'number' || schema.type === 'integer') {
      McpSchemaValidator.validateNumericConstraints(schema, path, errors)
    }

    // Validate string constraints
    if (schema.type === 'string') {
      McpSchemaValidator.validateStringConstraints(schema, path, errors)
    }

    // Validate array items
    if (schema.type === 'array') {
      if (schema.items) {
        McpSchemaValidator.validatePropertySchema(schema.items, `${path}.items`, errors, warnings)
      } else {
        warnings.push({
          path: `${path}.items`,
          message: 'Array type should define items schema',
        })
      }
    }

    // Validate nested object properties
    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        McpSchemaValidator.validatePropertySchema(propSchema, `${path}.properties.${propName}`, errors, warnings)
      }
    }
  }

  /**
   * Validate numeric constraints
   */
  private static validateNumericConstraints(schema: any, path: string, errors: SchemaValidationError[]): void {
    if (schema.minimum !== undefined && typeof schema.minimum !== 'number') {
      errors.push({
        path: `${path}.minimum`,
        message: 'minimum must be a number',
        value: typeof schema.minimum,
        expected: 'number',
      })
    }

    if (schema.maximum !== undefined && typeof schema.maximum !== 'number') {
      errors.push({
        path: `${path}.maximum`,
        message: 'maximum must be a number',
        value: typeof schema.maximum,
        expected: 'number',
      })
    }

    // Check minimum <= maximum
    if (typeof schema.minimum === 'number' && typeof schema.maximum === 'number') {
      if (schema.minimum > schema.maximum) {
        errors.push({
          path: `${path}`,
          message: 'minimum cannot be greater than maximum',
          value: `min: ${schema.minimum}, max: ${schema.maximum}`,
        })
      }
    }
  }

  /**
   * Validate string constraints
   */
  private static validateStringConstraints(schema: any, path: string, errors: SchemaValidationError[]): void {
    if (schema.minLength !== undefined) {
      if (typeof schema.minLength !== 'number' || schema.minLength < 0) {
        errors.push({
          path: `${path}.minLength`,
          message: 'minLength must be a non-negative number',
          value: schema.minLength,
          expected: 'number >= 0',
        })
      }
    }

    if (schema.maxLength !== undefined) {
      if (typeof schema.maxLength !== 'number' || schema.maxLength < 0) {
        errors.push({
          path: `${path}.maxLength`,
          message: 'maxLength must be a non-negative number',
          value: schema.maxLength,
          expected: 'number >= 0',
        })
      }
    }

    // Check minLength <= maxLength
    if (typeof schema.minLength === 'number' && typeof schema.maxLength === 'number') {
      if (schema.minLength > schema.maxLength) {
        errors.push({
          path: `${path}`,
          message: 'minLength cannot be greater than maxLength',
          value: `min: ${schema.minLength}, max: ${schema.maxLength}`,
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
          expected: 'string',
        })
      } else {
        try {
          new RegExp(schema.pattern)
        } catch {
          errors.push({
            path: `${path}.pattern`,
            message: 'pattern is not a valid regular expression',
            value: schema.pattern,
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
      result.errors.forEach((err) => {
        lines.push(`  • ${err.path}: ${err.message}`)
        if (err.value !== undefined) lines.push(`    Got: ${JSON.stringify(err.value)}`)
        if (err.expected) lines.push(`    Expected: ${err.expected}`)
      })
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:')
      result.warnings.forEach((warn) => {
        lines.push(`  ⚠ ${warn.path}: ${warn.message}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Quick validation check (returns boolean)
   */
  static isValid(schema: any): boolean {
    return McpSchemaValidator.validateMcpInputSchema(schema).valid
  }

  /**
   * Create a valid empty MCP inputSchema
   */
  static createEmptySchema(): McpInputSchema {
    return {
      type: 'object',
      properties: {},
      required: [],
    }
  }

  /**
   * Create schema from simple field definitions
   */
  static createSchemaFromFields(
    fields: Array<{
      name: string
      type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
      description?: string
      required?: boolean
      enum?: any[]
      default?: any
    }>,
  ): McpInputSchema {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []

    fields.forEach((field) => {
      const prop: JsonSchema = {
        type: field.type,
        description: field.description || `${field.name} parameter`,
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
      required,
    }
  }
}

/**
 * Utility functions for schema operations
 */

/**
 * Standardized validation error codes
 * Format: {category}_{specific_error}
 */
export enum ValidationErrorCode {
  // Schema structure errors (SCHEMA_*)
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  SCHEMA_TYPE_INVALID = 'SCHEMA_TYPE_INVALID',

  // Data structure errors (DATA_*)
  DATA_NULL_OR_UNDEFINED = 'DATA_NULL_OR_UNDEFINED',
  DATA_NOT_OBJECT = 'DATA_NOT_OBJECT',

  // Type errors (TYPE_*)
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  TYPE_STRING_EXPECTED = 'TYPE_STRING_EXPECTED',
  TYPE_NUMBER_EXPECTED = 'TYPE_NUMBER_EXPECTED',
  TYPE_INTEGER_EXPECTED = 'TYPE_INTEGER_EXPECTED',
  TYPE_BOOLEAN_EXPECTED = 'TYPE_BOOLEAN_EXPECTED',
  TYPE_ARRAY_EXPECTED = 'TYPE_ARRAY_EXPECTED',
  TYPE_OBJECT_EXPECTED = 'TYPE_OBJECT_EXPECTED',
  TYPE_NULL_EXPECTED = 'TYPE_NULL_EXPECTED',

  // Constraint errors (CONSTRAINT_*)
  CONSTRAINT_REQUIRED = 'CONSTRAINT_REQUIRED',
  CONSTRAINT_ENUM = 'CONSTRAINT_ENUM',
  CONSTRAINT_MIN_LENGTH = 'CONSTRAINT_MIN_LENGTH',
  CONSTRAINT_MAX_LENGTH = 'CONSTRAINT_MAX_LENGTH',
  CONSTRAINT_PATTERN = 'CONSTRAINT_PATTERN',
  CONSTRAINT_FORMAT = 'CONSTRAINT_FORMAT',
  CONSTRAINT_MINIMUM = 'CONSTRAINT_MINIMUM',
  CONSTRAINT_MAXIMUM = 'CONSTRAINT_MAXIMUM',
  CONSTRAINT_EXCLUSIVE_MINIMUM = 'CONSTRAINT_EXCLUSIVE_MINIMUM',
  CONSTRAINT_EXCLUSIVE_MAXIMUM = 'CONSTRAINT_EXCLUSIVE_MAXIMUM',
  CONSTRAINT_MULTIPLE_OF = 'CONSTRAINT_MULTIPLE_OF',
  CONSTRAINT_MIN_ITEMS = 'CONSTRAINT_MIN_ITEMS',
  CONSTRAINT_MAX_ITEMS = 'CONSTRAINT_MAX_ITEMS',
  CONSTRAINT_UNIQUE_ITEMS = 'CONSTRAINT_UNIQUE_ITEMS',
  CONSTRAINT_ADDITIONAL_PROPERTIES = 'CONSTRAINT_ADDITIONAL_PROPERTIES',
}

/**
 * Runtime data validation error
 */
export interface DataValidationError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode
  /** JSON path to the error location (e.g., $.name) */
  path: string
  /** Human-readable error message */
  message: string
  /** Actual value that caused the error */
  value?: any
  /** Expected value or type */
  expected?: string
  /** Constraint that was violated (legacy, use code instead) */
  constraint?: string
}

/**
 * Runtime data validation result
 */
export interface DataValidationResult {
  valid: boolean
  errors: DataValidationError[]
  coercedData?: Record<string, any>
}

/**
 * Runtime data validator - validates actual data against JSON Schema
 */
export class McpDataValidator {
  /**
   * Validate data against MCP inputSchema
   */
  static validate(data: any, schema: any): DataValidationResult {
    const errors: DataValidationError[] = []

    // Check if schema is valid first
    if (!schema || typeof schema !== 'object') {
      errors.push({
        code: ValidationErrorCode.SCHEMA_INVALID,
        path: '$schema',
        message: 'Invalid schema provided: schema must be a non-null object',
        expected: 'object',
      })
      return { valid: false, errors }
    }

    // Root must be object
    if (schema.type !== 'object') {
      errors.push({
        code: ValidationErrorCode.SCHEMA_TYPE_INVALID,
        path: '$schema.type',
        message: `Invalid schema type: expected "object" but got "${schema.type || 'undefined'}"`,
        value: schema.type,
        expected: 'object',
      })
      return { valid: false, errors }
    }

    // Data must be object (or undefined/null for optional)
    if (data === null || data === undefined) {
      // Check if there are required fields
      if (schema.required && schema.required.length > 0) {
        errors.push({
          code: ValidationErrorCode.DATA_NULL_OR_UNDEFINED,
          path: '$',
          message: 'Data is required but received null or undefined',
          value: data,
          expected: 'object with required fields',
        })
        return { valid: false, errors }
      }
      return { valid: true, errors: [], coercedData: {} }
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      errors.push({
        code: ValidationErrorCode.DATA_NOT_OBJECT,
        path: '$',
        message: `Data must be an object, received ${Array.isArray(data) ? 'array' : typeof data}`,
        value: typeof data,
        expected: 'object',
      })
      return { valid: false, errors }
    }

    const coercedData: Record<string, any> = {}

    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data) || data[field] === undefined) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_REQUIRED,
            path: `$.${field}`,
            message: `Required field "${field}" is missing`,
            expected: 'value',
            constraint: 'required',
          })
        }
      }
    }

    // Validate each property
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const value = data[propName]

        // Skip undefined optional fields
        if (value === undefined) {
          // Apply default if available
          if ((propSchema as any).default !== undefined) {
            coercedData[propName] = (propSchema as any).default
          }
          continue
        }

        const propResult = McpDataValidator.validateProperty(value, propSchema as any, `$.${propName}`)
        errors.push(...propResult.errors)

        if (propResult.coercedValue !== undefined) {
          coercedData[propName] = propResult.coercedValue
        } else {
          coercedData[propName] = value
        }
      }
    }

    // Check for extra properties if additionalProperties is false
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties))
      for (const key of Object.keys(data)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_ADDITIONAL_PROPERTIES,
            path: `$.${key}`,
            message: `Additional property "${key}" is not allowed by schema`,
            value: key,
            expected: `one of: ${Array.from(allowedKeys).join(', ')}`,
            constraint: 'additionalProperties',
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      coercedData: errors.length === 0 ? coercedData : undefined,
    }
  }

  /**
   * Validate individual property value
   */
  private static validateProperty(
    value: any,
    schema: any,
    path: string,
  ): { errors: DataValidationError[]; coercedValue?: any } {
    const errors: DataValidationError[] = []
    let coercedValue: any = value

    if (!schema || typeof schema !== 'object') {
      return { errors, coercedValue }
    }

    const expectedType = schema.type

    // Type validation with coercion
    const typeResult = McpDataValidator.validateType(value, expectedType, path)
    errors.push(...typeResult.errors)
    if (typeResult.coercedValue !== undefined) {
      coercedValue = typeResult.coercedValue
    }

    // If type is wrong, skip further validation
    if (typeResult.errors.length > 0) {
      return { errors, coercedValue }
    }

    // Enum validation
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(coercedValue)) {
        errors.push({
          code: ValidationErrorCode.CONSTRAINT_ENUM,
          path,
          message: `Value must be one of the allowed values: [${schema.enum.join(', ')}]`,
          value: coercedValue,
          expected: schema.enum.join(' | '),
          constraint: 'enum',
        })
      }
    }

    // Type-specific constraint validation
    switch (expectedType) {
      case 'string':
        errors.push(...McpDataValidator.validateStringConstraints(coercedValue, schema, path))
        break
      case 'number':
      case 'integer':
        errors.push(...McpDataValidator.validateNumericConstraints(coercedValue, schema, path))
        break
      case 'array':
        errors.push(...McpDataValidator.validateArrayConstraints(coercedValue, schema, path))
        break
      case 'object':
        if (schema.properties) {
          const nestedResult = McpDataValidator.validate(coercedValue, schema)
          errors.push(
            ...nestedResult.errors.map((e) => ({
              ...e,
              path: e.path.replace('$', path),
            })),
          )
        }
        break
    }

    return { errors, coercedValue }
  }

  /**
   * Validate and coerce type
   */
  private static validateType(
    value: any,
    expectedType: string,
    path: string,
  ): { errors: DataValidationError[]; coercedValue?: any } {
    const errors: DataValidationError[] = []
    let coercedValue = value

    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          // Try coercion
          if (value === null || value === undefined) {
            errors.push({
              code: ValidationErrorCode.TYPE_STRING_EXPECTED,
              path,
              message: `Type mismatch: expected string but received ${value === null ? 'null' : 'undefined'}`,
              value,
              expected: 'string',
            })
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            coercedValue = String(value)
          } else {
            errors.push({
              code: ValidationErrorCode.TYPE_STRING_EXPECTED,
              path,
              message: `Type mismatch: expected string but received ${typeof value}`,
              value,
              expected: 'string',
            })
          }
        }
        break

      case 'number':
        if (typeof value !== 'number') {
          if (typeof value === 'string') {
            const num = parseFloat(value)
            if (!Number.isNaN(num)) {
              coercedValue = num
            } else {
              errors.push({
                code: ValidationErrorCode.TYPE_NUMBER_EXPECTED,
                path,
                message: `Type mismatch: expected number but received non-numeric string "${value}"`,
                value,
                expected: 'number',
              })
            }
          } else {
            errors.push({
              code: ValidationErrorCode.TYPE_NUMBER_EXPECTED,
              path,
              message: `Type mismatch: expected number but received ${typeof value}`,
              value,
              expected: 'number',
            })
          }
        }
        break

      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          if (typeof value === 'string') {
            const num = parseInt(value, 10)
            if (!Number.isNaN(num) && String(num) === value.trim()) {
              coercedValue = num
            } else {
              errors.push({
                code: ValidationErrorCode.TYPE_INTEGER_EXPECTED,
                path,
                message: `Type mismatch: expected integer but received "${value}"`,
                value,
                expected: 'integer',
              })
            }
          } else if (typeof value === 'number' && !Number.isInteger(value)) {
            errors.push({
              code: ValidationErrorCode.TYPE_INTEGER_EXPECTED,
              path,
              message: `Type mismatch: expected integer but received float ${value}`,
              value,
              expected: 'integer',
            })
          } else {
            errors.push({
              code: ValidationErrorCode.TYPE_INTEGER_EXPECTED,
              path,
              message: `Type mismatch: expected integer but received ${typeof value}`,
              value,
              expected: 'integer',
            })
          }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          if (value === 'true' || value === 1) {
            coercedValue = true
          } else if (value === 'false' || value === 0) {
            coercedValue = false
          } else {
            errors.push({
              code: ValidationErrorCode.TYPE_BOOLEAN_EXPECTED,
              path,
              message: `Type mismatch: expected boolean but received ${typeof value} (value: ${JSON.stringify(value)})`,
              value,
              expected: 'boolean',
            })
          }
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            code: ValidationErrorCode.TYPE_ARRAY_EXPECTED,
            path,
            message: `Type mismatch: expected array but received ${typeof value}`,
            value,
            expected: 'array',
          })
        }
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            code: ValidationErrorCode.TYPE_OBJECT_EXPECTED,
            path,
            message: `Type mismatch: expected object but received ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`,
            value,
            expected: 'object',
          })
        }
        break

      case 'null':
        if (value !== null) {
          errors.push({
            code: ValidationErrorCode.TYPE_NULL_EXPECTED,
            path,
            message: `Type mismatch: expected null but received ${typeof value}`,
            value,
            expected: 'null',
          })
        }
        break
    }

    return { errors, coercedValue }
  }

  /**
   * Validate string constraints
   */
  private static validateStringConstraints(value: string, schema: any, path: string): DataValidationError[] {
    const errors: DataValidationError[] = []

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        code: ValidationErrorCode.CONSTRAINT_MIN_LENGTH,
        path,
        message: `String length violation: length ${value.length} is less than minimum ${schema.minLength}`,
        value,
        expected: `minLength: ${schema.minLength}`,
        constraint: 'minLength',
      })
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        code: ValidationErrorCode.CONSTRAINT_MAX_LENGTH,
        path,
        message: `String length violation: length ${value.length} exceeds maximum ${schema.maxLength}`,
        value,
        expected: `maxLength: ${schema.maxLength}`,
        constraint: 'maxLength',
      })
    }

    if (schema.pattern !== undefined) {
      try {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(value)) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_PATTERN,
            path,
            message: `Pattern violation: string does not match regex pattern "${schema.pattern}"`,
            value,
            expected: `pattern: ${schema.pattern}`,
            constraint: 'pattern',
          })
        }
      } catch {
        // Invalid regex, skip validation
      }
    }

    if (schema.format !== undefined) {
      const formatError = McpDataValidator.validateFormat(value, schema.format, path)
      if (formatError) {
        errors.push(formatError)
      }
    }

    return errors
  }

  /**
   * Validate numeric constraints
   */
  private static validateNumericConstraints(value: number, schema: any, path: string): DataValidationError[] {
    const errors: DataValidationError[] = []

    if (schema.minimum !== undefined) {
      if (schema.exclusiveMinimum === true) {
        if (value <= schema.minimum) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_EXCLUSIVE_MINIMUM,
            path,
            message: `Numeric constraint violation: value ${value} must be greater than ${schema.minimum} (exclusive)`,
            value,
            expected: `> ${schema.minimum}`,
            constraint: 'exclusiveMinimum',
          })
        }
      } else {
        if (value < schema.minimum) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_MINIMUM,
            path,
            message: `Numeric constraint violation: value ${value} is less than minimum ${schema.minimum}`,
            value,
            expected: `>= ${schema.minimum}`,
            constraint: 'minimum',
          })
        }
      }
    }

    if (schema.maximum !== undefined) {
      if (schema.exclusiveMaximum === true) {
        if (value >= schema.maximum) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_EXCLUSIVE_MAXIMUM,
            path,
            message: `Numeric constraint violation: value ${value} must be less than ${schema.maximum} (exclusive)`,
            value,
            expected: `< ${schema.maximum}`,
            constraint: 'exclusiveMaximum',
          })
        }
      } else {
        if (value > schema.maximum) {
          errors.push({
            code: ValidationErrorCode.CONSTRAINT_MAXIMUM,
            path,
            message: `Numeric constraint violation: value ${value} exceeds maximum ${schema.maximum}`,
            value,
            expected: `<= ${schema.maximum}`,
            constraint: 'maximum',
          })
        }
      }
    }

    if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
      if (value % schema.multipleOf !== 0) {
        errors.push({
          code: ValidationErrorCode.CONSTRAINT_MULTIPLE_OF,
          path,
          message: `Numeric constraint violation: value ${value} is not a multiple of ${schema.multipleOf}`,
          value,
          expected: `multiple of ${schema.multipleOf}`,
          constraint: 'multipleOf',
        })
      }
    }

    return errors
  }

  /**
   * Validate array constraints
   */
  private static validateArrayConstraints(value: any[], schema: any, path: string): DataValidationError[] {
    const errors: DataValidationError[] = []

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        code: ValidationErrorCode.CONSTRAINT_MIN_ITEMS,
        path,
        message: `Array constraint violation: length ${value.length} is less than minimum ${schema.minItems}`,
        value: value.length,
        expected: `minItems: ${schema.minItems}`,
        constraint: 'minItems',
      })
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        code: ValidationErrorCode.CONSTRAINT_MAX_ITEMS,
        path,
        message: `Array constraint violation: length ${value.length} exceeds maximum ${schema.maxItems}`,
        value: value.length,
        expected: `maxItems: ${schema.maxItems}`,
        constraint: 'maxItems',
      })
    }

    if (schema.uniqueItems === true) {
      const seen = new Set()
      const duplicates: any[] = []
      for (const item of value) {
        const key = JSON.stringify(item)
        if (seen.has(key)) {
          duplicates.push(item)
        }
        seen.add(key)
      }
      if (duplicates.length > 0) {
        errors.push({
          code: ValidationErrorCode.CONSTRAINT_UNIQUE_ITEMS,
          path,
          message: `Array constraint violation: contains ${duplicates.length} duplicate item(s)`,
          value: duplicates,
          expected: 'all unique items',
          constraint: 'uniqueItems',
        })
      }
    }

    // Validate each item against items schema
    if (schema.items) {
      value.forEach((item, index) => {
        const itemResult = McpDataValidator.validateProperty(item, schema.items, `${path}[${index}]`)
        errors.push(...itemResult.errors)
      })
    }

    return errors
  }

  /**
   * Validate string format
   */
  private static validateFormat(value: string, format: string, path: string): DataValidationError | null {
    const formatValidators: Record<string, { regex: RegExp | ((v: string) => boolean); example: string }> = {
      date: { regex: /^\d{4}-\d{2}-\d{2}$/, example: '2024-01-15' },
      'date-time': {
        regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
        example: '2024-01-15T10:30:00Z',
      },
      time: { regex: /^\d{2}:\d{2}:\d{2}(\.\d+)?$/, example: '10:30:00' },
      email: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, example: 'user@example.com' },
      uri: { regex: /^[a-zA-Z][a-zA-Z0-9+.-]*:/, example: 'https://example.com' },
      uuid: {
        regex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
      hostname: {
        regex: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/,
        example: 'example.com',
      },
      ipv4: { regex: /^(\d{1,3}\.){3}\d{1,3}$/, example: '192.168.1.1' },
      ipv6: {
        regex: (v: string) => {
          // Simplified IPv6 validation
          const parts = v.split(':')
          return parts.length <= 8 && parts.every((p) => /^[0-9a-f]{0,4}$/i.test(p))
        },
        example: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      },
    }

    const validatorEntry = formatValidators[format]
    if (!validatorEntry) {
      return null // Unknown format, skip validation
    }

    const { regex: validator, example } = validatorEntry
    const isValid = typeof validator === 'function' ? validator(value) : validator.test(value)

    if (!isValid) {
      return {
        code: ValidationErrorCode.CONSTRAINT_FORMAT,
        path,
        message: `Format violation: string does not match "${format}" format (example: ${example})`,
        value,
        expected: `${format} format (e.g., ${example})`,
        constraint: 'format',
      }
    }

    return null
  }

  /**
   * Format validation result as human-readable string
   */
  static formatValidationResult(result: DataValidationResult): string {
    const lines: string[] = []

    if (result.valid) {
      lines.push('✅ Data is valid')
    } else {
      lines.push(`❌ Data validation failed (${result.errors.length} error${result.errors.length > 1 ? 's' : ''})`)
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:')
      result.errors.forEach((err, index) => {
        lines.push(`  ${index + 1}. [${err.code}] ${err.path}`)
        lines.push(`     Message: ${err.message}`)
        if (err.value !== undefined) lines.push(`     Received: ${JSON.stringify(err.value)}`)
        if (err.expected) lines.push(`     Expected: ${err.expected}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Quick validation check (returns boolean)
   */
  static isValid(data: any, schema: any): boolean {
    return McpDataValidator.validate(data, schema).valid
  }
}

export const SchemaUtils = {
  /**
   * Check if a schema is compatible with MCP requirements
   */
  isCompatibleWithMcp(schema: any): boolean {
    return SchemaMapper.validateJsonSchema(schema) && schema.type === 'object' && typeof schema.properties === 'object'
  },

  /**
   * Merge multiple schemas (for complex template compositions)
   */
  mergeSchemas(schemas: JsonSchema[]): JsonSchema {
    const merged: JsonSchema = {
      type: 'object',
      description: 'Merged schema',
      properties: {},
      required: [],
    }

    schemas.forEach((schema) => {
      if (schema.type === 'object' && schema.properties) {
        const mergedProperties = merged.properties ?? {}
        if (!merged.properties) {
          merged.properties = mergedProperties
        }
        Object.assign(mergedProperties, schema.properties)

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
      fieldTypes: {} as Record<string, string>,
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
  },
}
