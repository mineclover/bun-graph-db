/**
 * Format Mapper Service
 *
 * Transforms Flat JSON data to custom formats and vice versa using address-based mapping.
 *
 * Core Features:
 * 1. Export: Flat JSON → Custom Format (using mapping template)
 * 2. Import: Custom Format → Flat JSON (reverse mapping)
 * 3. Patch: Custom Format → FlatNodePatch[] (for updates)
 *
 * Address Syntax:
 * - $.nodes[*].id → All node IDs
 * - $.nodes[0].title → First node's title
 * - $.table.identifier → Table identifier
 * - output.users[*].email → Target path in custom format
 */

import type {
  ExportTransformOptions,
  FlatJsonPath,
  FormatExportResult,
  FormatImportResult,
  FormatMappingTemplate,
  ImportTransformOptions,
  MappingValidationError,
  MappingValidationResult,
  MappingValidationWarning,
  NodeLevelMapping,
  SimpleMappingDefinition,
  TransformType,
} from '../../core/types/FormatMapping.js'
import {
  isNodeLevelMapping,
  normalizeMapping,
  PRESET_MAPPINGS,
} from '../../core/types/FormatMapping.js'
import type { FlatJsonExport, FlatNodePatch } from '../../core/types/JsonExport.js'

// =============================================================================
// Types
// =============================================================================

/** Path segment types for JSONPath parsing */
type PathSegment =
  | { type: 'property'; key: string }
  | { type: 'index'; index: number }
  | { type: 'wildcard' }

/** Export statistics tracking */
interface ExportStats {
  mappedFields: number
  skippedFields: number
  transformedValues: number
  defaultsApplied: number
}

/** Import statistics tracking */
interface ImportStats {
  mappedFields: number
  skippedFields: number
  transformedValues: number
  unknownFields: number
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum nesting depth before warning */
const MAX_NESTING_DEPTH = 5

/** Valid transform types for validation */
const VALID_TRANSFORMS: readonly TransformType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'timestamp',
  'uppercase',
  'lowercase',
  'trim',
  'json',
  'array',
  'flatten',
] as const

/** Current format version */
const FORMAT_VERSION = '1.0.0'

// =============================================================================
// Helper Functions
// =============================================================================

/** Create initial export stats */
const createExportStats = (): ExportStats => ({
  mappedFields: 0,
  skippedFields: 0,
  transformedValues: 0,
  defaultsApplied: 0,
})

/** Create initial import stats */
const createImportStats = (): ImportStats => ({
  mappedFields: 0,
  skippedFields: 0,
  transformedValues: 0,
  unknownFields: 0,
})

/** Extract error message from unknown error */
const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Format Mapper Service
 * Handles bidirectional transformation between Flat JSON and custom formats
 */
export class FormatMapperService {
  /**
   * Transform Flat JSON to custom format
   */
  transformToCustomFormat(
    flatData: FlatJsonExport,
    options: ExportTransformOptions
  ): FormatExportResult {
    const errors: string[] = []
    const warnings: string[] = []
    const stats = createExportStats()

    try {
      // Normalize mapping template
      const template = normalizeMapping(options.template)

      // Validate mapping
      const validation = this.validateMapping(template, flatData)
      if (!validation.valid && options.strictMode) {
        return {
          success: false,
          itemCount: 0,
          stats,
          errors: validation.errors.map((e) => e.message),
          warnings: validation.warnings.map((w) => w.message),
        }
      }
      warnings.push(...validation.warnings.map((w) => w.message))

      // Initialize output with root template or empty object
      const output: Record<string, unknown> = template.rootTemplate
        ? JSON.parse(JSON.stringify(template.rootTemplate))
        : {}

      // Apply each mapping
      for (const mapping of template.mappings) {
        try {
          const sourceValue = this.getValueByPath(flatData, mapping.source)

          if (sourceValue === undefined) {
            if (mapping.defaultValue !== undefined) {
              this.setValueByPath(output, mapping.target, mapping.defaultValue)
              stats.defaultsApplied++
            } else if (options.strictMode) {
              errors.push(`Source path not found: ${mapping.source}`)
              stats.skippedFields++
            } else if (options.includeNulls) {
              this.setValueByPath(output, mapping.target, null)
              stats.skippedFields++
            } else {
              stats.skippedFields++
            }
            continue
          }

          // Apply transform if specified
          const transformedValue = mapping.transform
            ? this.applyTransform(sourceValue, mapping.transform)
            : sourceValue

          if (mapping.transform) {
            stats.transformedValues++
          }

          // Set value in output
          this.setValueByPath(output, mapping.target, transformedValue)
          stats.mappedFields++
        } catch (err) {
          const message = getErrorMessage(err)
          if (options.strictMode) {
            errors.push(`Mapping error for ${mapping.target}: ${message}`)
          } else {
            warnings.push(`Mapping warning for ${mapping.target}: ${message}`)
          }
          stats.skippedFields++
        }
      }

      if (errors.length > 0 && options.strictMode) {
        return {
          success: false,
          itemCount: 0,
          stats,
          errors,
          warnings,
        }
      }

      return {
        success: true,
        data: output,
        json:
          options.prettyPrint !== false ? JSON.stringify(output, null, 2) : JSON.stringify(output),
        itemCount: flatData.nodes?.length || 0,
        stats,
        errors,
        warnings,
      }
    } catch (err) {
      return {
        success: false,
        itemCount: 0,
        stats,
        errors: [`Transform failed: ${getErrorMessage(err)}`],
        warnings,
      }
    }
  }

  /**
   * Transform custom format back to Flat JSON structure
   */
  transformToFlatJson(customData: unknown, options: ImportTransformOptions): FormatImportResult {
    const errors: string[] = []
    const warnings: string[] = []
    const stats = createImportStats()

    try {
      // Normalize mapping template
      const template = normalizeMapping(options.template)

      // Create inverted mappings (target becomes source, source becomes target)
      const invertedMappings = template.mappings.map((m) => ({
        target: m.source,
        source: m.target,
        transform: m.transform,
        defaultValue: m.defaultValue,
      }))

      // Initialize output Flat JSON structure
      const flatData: FlatJsonExport = {
        version: FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        table: {
          id: '',
          identifier: '',
        },
        nodes: [],
      }

      // Process inverted mappings
      for (const mapping of invertedMappings) {
        try {
          const sourceValue = this.getValueByPath(customData, mapping.source)

          if (sourceValue === undefined) {
            if (mapping.defaultValue !== undefined) {
              this.setValueByPath(
                flatData as unknown as Record<string, unknown>,
                mapping.target,
                mapping.defaultValue
              )
              stats.mappedFields++
            } else {
              stats.skippedFields++
            }
            continue
          }

          // Apply transform if specified
          const transformedValue = mapping.transform
            ? this.applyTransform(sourceValue, mapping.transform)
            : sourceValue

          if (mapping.transform) {
            stats.transformedValues++
          }

          // Set value in flat data
          this.setValueByPath(
            flatData as unknown as Record<string, unknown>,
            mapping.target,
            transformedValue
          )
          stats.mappedFields++
        } catch (err) {
          const message = getErrorMessage(err)
          if (options.strictMode) {
            errors.push(`Import mapping error for ${mapping.target}: ${message}`)
          } else {
            warnings.push(`Import mapping warning for ${mapping.target}: ${message}`)
          }
          stats.skippedFields++
        }
      }

      if (errors.length > 0 && options.strictMode) {
        return {
          success: false,
          itemCount: 0,
          stats,
          errors,
          warnings,
        }
      }

      return {
        success: true,
        flatData,
        itemCount: flatData.nodes?.length || 0,
        stats,
        errors,
        warnings,
      }
    } catch (err) {
      return {
        success: false,
        itemCount: 0,
        stats,
        errors: [`Import transform failed: ${getErrorMessage(err)}`],
        warnings,
      }
    }
  }

  /**
   * Generate patches from custom format data
   * Used for partial updates
   */
  generatePatches(customData: unknown, options: ImportTransformOptions): FormatImportResult {
    const errors: string[] = []
    const warnings: string[] = []
    const stats = createImportStats()

    try {
      // Normalize mapping template
      const template = normalizeMapping(options.template)

      // Find node ID mapping
      const idMapping = template.mappings.find(
        (m) => m.source === '$.nodes[*].id' || m.source.endsWith('.id')
      )

      if (!idMapping) {
        return {
          success: false,
          itemCount: 0,
          stats,
          errors: ['No ID mapping found. Cannot generate patches without node ID mapping.'],
          warnings,
        }
      }

      // Extract nodes array from custom data
      const nodesPath = idMapping.target.replace(/\[\*\]\.id$/, '')
      const customNodes = this.getValueByPath(customData, `${nodesPath}[*]`) as unknown[]

      if (!Array.isArray(customNodes)) {
        return {
          success: false,
          itemCount: 0,
          stats,
          errors: [`Expected array at path: ${nodesPath}`],
          warnings,
        }
      }

      const patches: FlatNodePatch[] = []

      // Process each node in custom data
      for (const customNode of customNodes) {
        if (typeof customNode !== 'object' || customNode === null) {
          warnings.push('Skipping non-object node')
          stats.skippedFields++
          continue
        }

        const nodeObj = customNode as Record<string, unknown>

        // Find node ID
        const idField = idMapping.target.split('[*].').pop() || 'id'
        const nodeId = nodeObj[idField]

        if (!nodeId || typeof nodeId !== 'string') {
          warnings.push('Skipping node without valid ID')
          stats.skippedFields++
          continue
        }

        const patch: FlatNodePatch = {
          id: nodeId,
          attributes: {},
        }

        // Map other fields
        for (const mapping of template.mappings) {
          if (mapping.source === '$.nodes[*].id') continue

          // Extract field name from target path
          const targetField = mapping.target.split('[*].').pop()
          if (!targetField) continue

          const value = nodeObj[targetField]
          if (value === undefined) continue

          // Map to flat field
          const sourceField = mapping.source.split('[*].').pop()
          if (!sourceField) continue

          // Apply transform
          const transformedValue = mapping.transform
            ? this.applyTransform(value, mapping.transform)
            : value

          if (mapping.transform) {
            stats.transformedValues++
          }

          // Determine if it's a core field or attribute
          if (sourceField === 'title') {
            patch.title = String(transformedValue)
          } else if (sourceField === 'content') {
            patch.content = String(transformedValue)
          } else {
            patch.attributes![sourceField] = transformedValue
          }

          stats.mappedFields++
        }

        patches.push(patch)
      }

      return {
        success: true,
        patches,
        itemCount: patches.length,
        stats,
        errors,
        warnings,
      }
    } catch (err) {
      return {
        success: false,
        itemCount: 0,
        stats,
        errors: [`Patch generation failed: ${getErrorMessage(err)}`],
        warnings,
      }
    }
  }

  /**
   * Validate mapping template against source data
   */
  validateMapping(
    template: FormatMappingTemplate | SimpleMappingDefinition,
    sourceData?: FlatJsonExport
  ): MappingValidationResult {
    const errors: MappingValidationError[] = []
    const warnings: MappingValidationWarning[] = []

    const normalizedTemplate = normalizeMapping(template)

    // Check for duplicate target paths
    const targetPaths = new Set<string>()
    for (const mapping of normalizedTemplate.mappings) {
      if (targetPaths.has(mapping.target)) {
        errors.push({
          code: 'DUPLICATE_TARGET',
          message: `Duplicate target path: ${mapping.target}`,
          path: mapping.target,
        })
      }
      targetPaths.add(mapping.target)

      // Validate source path syntax
      if (!this.isValidPath(mapping.source)) {
        errors.push({
          code: 'INVALID_SOURCE_PATH',
          message: `Invalid source path syntax: ${mapping.source}`,
          path: mapping.source,
        })
      }

      // Validate target path syntax
      if (!this.isValidPath(mapping.target)) {
        errors.push({
          code: 'INVALID_TARGET_PATH',
          message: `Invalid target path syntax: ${mapping.target}`,
          path: mapping.target,
        })
      }

      // Validate transform type
      if (mapping.transform && !this.isValidTransform(mapping.transform)) {
        errors.push({
          code: 'INVALID_TRANSFORM',
          message: `Invalid transform type: ${mapping.transform}`,
          path: mapping.target,
        })
      }

      // Check source path exists in data
      if (sourceData) {
        const value = this.getValueByPath(sourceData, mapping.source)
        if (value === undefined && mapping.defaultValue === undefined) {
          warnings.push({
            code: 'UNUSED_SOURCE_FIELD',
            message: `Source path not found in data: ${mapping.source}`,
            path: mapping.source,
            suggestion: 'Add a defaultValue or verify the source path',
          })
        }
      }

      // Check for deep nesting
      const depth = mapping.target.split('.').length
      if (depth > MAX_NESTING_DEPTH) {
        warnings.push({
          code: 'DEEP_NESTING',
          message: `Target path has deep nesting (${depth} levels): ${mapping.target}`,
          path: mapping.target,
          suggestion: 'Consider flattening the output structure',
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get value from object by JSONPath-like path
   */
  private getValueByPath(obj: unknown, path: FlatJsonPath): unknown {
    if (!path || typeof obj !== 'object' || obj === null) {
      return undefined
    }

    // Remove leading $ if present
    const normalizedPath = path.startsWith('$.')
      ? path.slice(2)
      : path.startsWith('$')
        ? path.slice(1)
        : path

    // Handle special case for array length
    if (normalizedPath.endsWith('.length')) {
      const arrayPath = normalizedPath.slice(0, -7)
      const arr = this.getValueByPath(obj, arrayPath)
      return Array.isArray(arr) ? arr.length : undefined
    }

    // Split path into segments
    const segments = this.parsePathSegments(normalizedPath)
    let current: unknown = obj

    for (const segment of segments) {
      if (current === undefined || current === null) {
        return undefined
      }

      if (segment.type === 'property') {
        current = (current as Record<string, unknown>)[segment.key]
      } else if (segment.type === 'index') {
        if (!Array.isArray(current)) return undefined
        current = current[segment.index]
      } else if (segment.type === 'wildcard') {
        // Handle [*] - return array of values from remaining path
        if (!Array.isArray(current)) return undefined

        const remainingSegments = segments.slice(segments.indexOf(segment) + 1)
        if (remainingSegments.length === 0) {
          return current
        }

        // Apply remaining path to each item
        const remainingPath = remainingSegments
          .map((s) => (s.type === 'property' ? s.key : s.type === 'index' ? `[${s.index}]` : '[*]'))
          .join('.')
          .replace(/\.\[/g, '[')

        return current.map((item) => this.getValueByPath(item, remainingPath))
      }
    }

    return current
  }

  /**
   * Set value in object by JSONPath-like path
   */
  private setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    // Remove leading $ if present
    const normalizedPath = path.startsWith('$.')
      ? path.slice(2)
      : path.startsWith('$')
        ? path.slice(1)
        : path

    const segments = this.parsePathSegments(normalizedPath)
    let current: Record<string, unknown> = obj

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!
      const nextSegment = segments[i + 1]!

      if (segment.type === 'property') {
        if (current[segment.key] === undefined) {
          // Create array or object based on next segment
          current[segment.key] =
            nextSegment.type === 'index' || nextSegment.type === 'wildcard' ? [] : {}
        }
        current = current[segment.key] as Record<string, unknown>
      } else if (segment.type === 'index') {
        const arr = current as unknown as unknown[]
        if (arr[segment.index] === undefined) {
          arr[segment.index] =
            nextSegment.type === 'index' || nextSegment.type === 'wildcard' ? [] : {}
        }
        current = arr[segment.index] as Record<string, unknown>
      } else if (segment.type === 'wildcard') {
        // Handle array wildcard - apply value to all items
        const arr = current as unknown as unknown[]
        const remainingPath = segments
          .slice(i + 1)
          .map((s) => (s.type === 'property' ? s.key : s.type === 'index' ? `[${s.index}]` : '[*]'))
          .join('.')
          .replace(/\.\[/g, '[')

        if (Array.isArray(value)) {
          // Value is array - match items
          for (let j = 0; j < value.length; j++) {
            if (arr[j] === undefined) arr[j] = {}
            this.setValueByPath(arr[j] as Record<string, unknown>, remainingPath, value[j])
          }
        } else {
          // Single value - apply to all items
          for (const item of arr) {
            this.setValueByPath(item as Record<string, unknown>, remainingPath, value)
          }
        }
        return
      }
    }

    // Set final value
    const lastSegment = segments[segments.length - 1]
    if (!lastSegment) return

    if (lastSegment.type === 'property') {
      current[lastSegment.key] = value
    } else if (lastSegment.type === 'index') {
      ;(current as unknown as unknown[])[lastSegment.index] = value
    } else if (lastSegment.type === 'wildcard') {
      // Replace entire array
      if (Array.isArray(value)) {
        Object.assign(current, value)
      }
    }
  }

  /**
   * Parse path string into segments
   */
  private parsePathSegments(path: string): PathSegment[] {
    const segments: PathSegment[] = []

    // Match property names and array indices
    const regex = /\.?([^.[\]]+)|\[(\d+|\*)\]/g
    let match: RegExpExecArray | null = regex.exec(path)

    while (match !== null) {
      if (match[1]) {
        // Property name
        segments.push({ type: 'property', key: match[1] })
      } else if (match[2] === '*') {
        // Wildcard
        segments.push({ type: 'wildcard' })
      } else if (match[2]) {
        // Array index
        segments.push({ type: 'index', index: parseInt(match[2], 10) })
      }
      match = regex.exec(path)
    }

    return segments
  }

  /**
   * Apply transform to value
   */
  private applyTransform(value: unknown, transform: TransformType): unknown {
    switch (transform) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'date':
        return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString()
      case 'timestamp':
        return value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      case 'trim':
        return String(value).trim()
      case 'json':
        return JSON.stringify(value)
      case 'array':
        return Array.isArray(value) ? value : [value]
      case 'flatten':
        if (typeof value === 'object' && value !== null) {
          return this.flattenObject(value as Record<string, unknown>)
        }
        return value
      default:
        return value
    }
  }

  /**
   * Flatten nested object
   */
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey))
      } else {
        result[newKey] = value
      }
    }

    return result
  }

  /**
   * Validate path syntax
   */
  private isValidPath(path: string): boolean {
    // Basic validation for JSONPath-like syntax
    if (!path) return false

    // Should start with $ or a property name
    if (!/^(\$\.?)?[a-zA-Z_]/.test(path) && !/^(\$)?\[/.test(path)) {
      return false
    }

    // Check for valid characters
    if (!/^[$.[\]*\w]+$/.test(path)) {
      return false
    }

    return true
  }

  /**
   * Validate transform type
   */
  private isValidTransform(transform: string): transform is TransformType {
    return VALID_TRANSFORMS.includes(transform as TransformType)
  }

  // =============================================================================
  // Guide Generation
  // =============================================================================

  /**
   * Generate mapping guide markdown from a template
   * Creates documentation for how to use a specific mapping
   */
  generateMappingGuide(
    template: FormatMappingTemplate | SimpleMappingDefinition | NodeLevelMapping,
    options?: {
      includeExamples?: boolean
      language?: 'ko' | 'en'
    }
  ): string {
    const normalized = normalizeMapping(template)
    const lang = options?.language ?? 'ko'
    const includeExamples = options?.includeExamples ?? true

    const lines: string[] = []

    // Header
    lines.push(`# ${normalized.name}`)
    lines.push('')
    if (normalized.description) {
      lines.push(normalized.description)
      lines.push('')
    }

    // Metadata
    lines.push(`**Version**: ${normalized.version}`)
    lines.push(`**ID**: ${normalized.id}`)
    if (normalized.metadata?.author) {
      lines.push(`**Author**: ${normalized.metadata.author}`)
    }
    if (normalized.metadata?.tags?.length) {
      lines.push(`**Tags**: ${normalized.metadata.tags.join(', ')}`)
    }
    lines.push('')

    // Mapping Table
    lines.push(lang === 'ko' ? '## 필드 매핑' : '## Field Mappings')
    lines.push('')
    lines.push(
      lang === 'ko'
        ? '| 출력 필드 | 소스 경로 | Transform | 기본값 |'
        : '| Output Field | Source Path | Transform | Default |'
    )
    lines.push('|------------|------------|-----------|---------|')

    for (const mapping of normalized.mappings) {
      const transform = mapping.transform ?? '-'
      const defaultVal =
        mapping.defaultValue !== undefined ? `\`${JSON.stringify(mapping.defaultValue)}\`` : '-'
      lines.push(`| \`${mapping.target}\` | \`${mapping.source}\` | ${transform} | ${defaultVal} |`)
    }
    lines.push('')

    // Root Template
    if (normalized.rootTemplate) {
      lines.push(lang === 'ko' ? '## 출력 구조' : '## Output Structure')
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify(normalized.rootTemplate, null, 2))
      lines.push('```')
      lines.push('')
    }

    // NodeLevelMapping 간소화 문법 설명
    if (isNodeLevelMapping(template)) {
      lines.push(
        lang === 'ko'
          ? '## 간소화 문법 (NodeLevelMapping)'
          : '## Simplified Syntax (NodeLevelMapping)'
      )
      lines.push('')
      lines.push(
        lang === 'ko'
          ? '이 매핑은 NodeLevelMapping 문법으로 정의되었습니다:'
          : 'This mapping was defined using NodeLevelMapping syntax:'
      )
      lines.push('')
      lines.push('```typescript')
      lines.push(JSON.stringify(template, null, 2))
      lines.push('```')
      lines.push('')

      lines.push(lang === 'ko' ? '### 접두사 규칙' : '### Prefix Convention')
      lines.push('')
      lines.push(lang === 'ko' ? '| 접두사 | 의미 | 예시 |' : '| Prefix | Meaning | Example |')
      lines.push('|--------|------|------|')
      lines.push(
        lang === 'ko'
          ? '| (없음) | 코어 필드 | `title` → `$.nodes[*].title` |'
          : '| (none) | Core field | `title` → `$.nodes[*].title` |'
      )
      lines.push(
        lang === 'ko'
          ? '| `@` | attributes 필드 | `@email` → `$.nodes[*].attributes.email` |'
          : '| `@` | Attribute field | `@email` → `$.nodes[*].attributes.email` |'
      )
      lines.push(
        lang === 'ko'
          ? '| `@@` | 시스템 필드 | `@@createdAt` → `$.nodes[*].createdAt` |'
          : '| `@@` | System field | `@@createdAt` → `$.nodes[*].createdAt` |'
      )
      lines.push('')
    }

    // Usage Examples
    if (includeExamples) {
      lines.push(lang === 'ko' ? '## 사용 예시' : '## Usage Examples')
      lines.push('')

      lines.push(lang === 'ko' ? '### Export (Flat → Custom)' : '### Export (Flat → Custom)')
      lines.push('')
      lines.push('```typescript')
      lines.push(`import { FormatMapperService } from './FormatMapperService'`)
      lines.push('')
      lines.push('const mapper = new FormatMapperService()')
      lines.push('const flatData = { /* Flat JSON data */ }')
      lines.push('')
      lines.push('const result = mapper.transformToCustomFormat(flatData, {')
      lines.push(`  template: ${JSON.stringify(normalized.id)},`)
      lines.push('  prettyPrint: true,')
      lines.push('})')
      lines.push('')
      lines.push('console.log(result.json)')
      lines.push('```')
      lines.push('')

      lines.push(lang === 'ko' ? '### Import (Custom → Flat)' : '### Import (Custom → Flat)')
      lines.push('')
      lines.push('```typescript')
      lines.push('const customData = { /* Custom format data */ }')
      lines.push('')
      lines.push('const result = mapper.transformToFlatJson(customData, {')
      lines.push(`  template: ${JSON.stringify(normalized.id)},`)
      lines.push('})')
      lines.push('')
      lines.push('console.log(result.flatData)')
      lines.push('```')
      lines.push('')
    }

    // Transform Reference
    lines.push(lang === 'ko' ? '## Transform 참조' : '## Transform Reference')
    lines.push('')
    lines.push(lang === 'ko' ? '| Transform | 설명 |' : '| Transform | Description |')
    lines.push('|-----------|------|')
    const transformDescs =
      lang === 'ko'
        ? {
            string: '문자열 변환',
            number: '숫자 변환',
            boolean: '불리언 변환',
            date: 'ISO 날짜 포맷',
            timestamp: 'Unix 타임스탬프',
            uppercase: '대문자 변환',
            lowercase: '소문자 변환',
            trim: '공백 제거',
            json: 'JSON 문자열화',
            array: '배열 래핑',
            flatten: '객체 평탄화',
          }
        : {
            string: 'Convert to string',
            number: 'Convert to number',
            boolean: 'Convert to boolean',
            date: 'Format as ISO date',
            timestamp: 'Unix timestamp',
            uppercase: 'Uppercase string',
            lowercase: 'Lowercase string',
            trim: 'Trim whitespace',
            json: 'JSON stringify',
            array: 'Wrap in array',
            flatten: 'Flatten nested object',
          }
    for (const [key, desc] of Object.entries(transformDescs)) {
      lines.push(`| \`${key}\` | ${desc} |`)
    }
    lines.push('')

    // Footer
    lines.push('---')
    lines.push(`*Generated at: ${new Date().toISOString()}*`)

    return lines.join('\n')
  }

  /**
   * Generate guide for all preset mappings
   */
  generatePresetsGuide(options?: { language?: 'ko' | 'en' }): string {
    const lang = options?.language ?? 'ko'
    const lines: string[] = []

    lines.push(lang === 'ko' ? '# 프리셋 매핑 가이드' : '# Preset Mappings Guide')
    lines.push('')
    lines.push(
      lang === 'ko'
        ? '자주 사용되는 내장 매핑 템플릿입니다.'
        : 'Built-in mapping templates for common use cases.'
    )
    lines.push('')

    for (const [key, preset] of Object.entries(PRESET_MAPPINGS)) {
      lines.push(`## ${key}`)
      lines.push('')
      lines.push(`**${preset.name}**`)
      lines.push('')
      if (preset.description) {
        lines.push(preset.description)
        lines.push('')
      }
      lines.push('```typescript')
      lines.push(`import { PRESET_MAPPINGS } from './FormatMapping'`)
      lines.push('')
      lines.push(`const template = PRESET_MAPPINGS.${key}`)
      lines.push('```')
      lines.push('')

      // Mappings table
      lines.push(lang === 'ko' ? '### 매핑 정의' : '### Mapping Definition')
      lines.push('')
      lines.push('| Target | Source |')
      lines.push('|--------|--------|')
      for (const mapping of preset.mappings) {
        lines.push(`| \`${mapping.target}\` | \`${mapping.source}\` |`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push(`*Generated at: ${new Date().toISOString()}*`)

    return lines.join('\n')
  }

  /**
   * Write guide to file
   */
  async writeGuideToFile(
    content: string,
    filename: string,
    outputDir = 'generated'
  ): Promise<{ success: boolean; path: string; error?: string }> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true })

      const filePath = path.join(outputDir, filename)
      await fs.writeFile(filePath, content, 'utf-8')

      return { success: true, path: filePath }
    } catch (err) {
      return {
        success: false,
        path: '',
        error: getErrorMessage(err),
      }
    }
  }
}
