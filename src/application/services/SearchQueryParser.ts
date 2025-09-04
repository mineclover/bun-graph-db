// Search query parser for converting query strings to SearchQuery objects

import { 
  SearchOperator, 
  LogicalOperator, 
  SearchQueryBuilder
} from '@/domain/value-objects/SearchFilter.js'
import type { 
  SearchQuery, 
  SearchFilter, 
  RangeValue
} from '@/domain/value-objects/SearchFilter.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface AttributeTypeInfo {
  identifier: string
  dataType: string
}

export class SearchQueryParser {
  constructor(private readonly availableAttributes: AttributeTypeInfo[]) {}

  parse(queryString: string): SearchQuery {
    if (!queryString || queryString.trim().length === 0) {
      return SearchQueryBuilder.create().build()
    }

    const builder = SearchQueryBuilder.create()
    
    // Split by logical operators (AND, OR)
    const parts = this.splitByLogicalOperators(queryString.trim())
    
    let currentLogicalOperator: LogicalOperator = LogicalOperator.AND
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]?.trim()
      if (!part) continue
      
      if (part === 'AND' || part === 'OR') {
        currentLogicalOperator = part === 'AND' ? LogicalOperator.AND : LogicalOperator.OR
        if (i < parts.length - 1) {
          builder.addCondition(currentLogicalOperator)
        }
        continue
      }

      // Parse individual filter
      const filter = this.parseFilter(part)
      if (filter) {
        builder.addFilter(filter.field, filter.operator, filter.value, filter.valueType)
      }
    }

    return builder.build()
  }

  private splitByLogicalOperators(query: string): string[] {
    // Split by AND/OR while preserving quoted strings
    const regex = /\s+(AND|OR)\s+|([^\s]+(?:\s+[^\s]*)*?)(?=\s+(?:AND|OR)\s+|$)/g
    const parts: string[] = []
    let match

    while ((match = regex.exec(query)) !== null) {
      if (match[1]) {
        // Logical operator
        parts.push(match[1])
      } else if (match[2]) {
        // Filter part
        parts.push(match[2])
      }
    }

    // Fallback: if no matches, return the original query as single part
    if (parts.length === 0) {
      parts.push(query)
    }

    return parts
  }

  private parseFilter(filterString: string): SearchFilter | null {
    const trimmed = filterString.trim()
    
    // Handle quoted text search (general content search)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return {
        field: '_text_search',
        operator: SearchOperator.CONTAINS,
        value: trimmed.slice(1, -1),
        valueType: 'string'
      }
    }

    // Handle attribute-based filters (field:value)
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) {
      // No colon found, treat as general text search
      return {
        field: '_text_search',
        operator: SearchOperator.CONTAINS,
        value: trimmed,
        valueType: 'string'
      }
    }

    const field = trimmed.substring(0, colonIndex).trim()
    const valueString = trimmed.substring(colonIndex + 1).trim()

    // Find attribute type
    const attributeInfo = this.availableAttributes.find(attr => attr.identifier === field)
    if (!attributeInfo) {
      throw new ValidationException(`Unknown attribute: ${field}`)
    }

    // Parse value and operator based on attribute type
    return this.parseValueAndOperator(field, valueString, attributeInfo.dataType)
  }

  private parseValueAndOperator(field: string, valueString: string, dataType: string): SearchFilter {
    // Handle comparison operators for numbers and dates
    if (dataType === 'number' || dataType === 'datetime') {
      if (valueString.startsWith('>=')) {
        return {
          field,
          operator: SearchOperator.GREATER_THAN_OR_EQUAL,
          value: this.parseValue(valueString.substring(2).trim(), dataType),
          valueType: dataType as any
        }
      } else if (valueString.startsWith('<=')) {
        return {
          field,
          operator: SearchOperator.LESS_THAN_OR_EQUAL,
          value: this.parseValue(valueString.substring(2).trim(), dataType),
          valueType: dataType as any
        }
      } else if (valueString.startsWith('>')) {
        return {
          field,
          operator: SearchOperator.GREATER_THAN,
          value: this.parseValue(valueString.substring(1).trim(), dataType),
          valueType: dataType as any
        }
      } else if (valueString.startsWith('<')) {
        return {
          field,
          operator: SearchOperator.LESS_THAN,
          value: this.parseValue(valueString.substring(1).trim(), dataType),
          valueType: dataType as any
        }
      } else if (valueString.includes('..')) {
        // Range: 80..95
        const [min, max] = valueString.split('..').map(v => this.parseValue(v.trim(), dataType))
        return {
          field,
          operator: SearchOperator.RANGE,
          value: { min, max } as RangeValue,
          valueType: dataType as any
        }
      }
    }

    // Handle wildcard for strings
    if (dataType === 'string' && valueString.includes('*')) {
      if (valueString.endsWith('*')) {
        return {
          field,
          operator: SearchOperator.STARTS_WITH,
          value: valueString.slice(0, -1),
          valueType: 'string'
        }
      } else if (valueString.startsWith('*')) {
        return {
          field,
          operator: SearchOperator.ENDS_WITH,
          value: valueString.slice(1),
          valueType: 'string'
        }
      } else {
        return {
          field,
          operator: SearchOperator.CONTAINS,
          value: valueString.replace(/\*/g, ''),
          valueType: 'string'
        }
      }
    }

    // Handle quoted strings
    if (valueString.startsWith('"') && valueString.endsWith('"')) {
      return {
        field,
        operator: SearchOperator.EQUALS,
        value: valueString.slice(1, -1),
        valueType: dataType as any
      }
    }

    // Default: exact match
    return {
      field,
      operator: SearchOperator.EQUALS,
      value: this.parseValue(valueString, dataType),
      valueType: dataType as any
    }
  }

  private parseValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          throw new ValidationException(`Invalid number: ${value}`)
        }
        return num
      
      case 'boolean':
        if (value.toLowerCase() === 'true') return true
        if (value.toLowerCase() === 'false') return false
        throw new ValidationException(`Invalid boolean: ${value}`)
      
      case 'datetime':
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          throw new ValidationException(`Invalid date: ${value}`)
        }
        return date.toISOString()
      
      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          // If not valid JSON, treat as string for JSON field search
          return value
        }
      
      case 'string':
      default:
        return value
    }
  }
}