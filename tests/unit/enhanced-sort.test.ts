import { describe, expect, test } from 'bun:test'
import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'
import { DateTimeSortStrategy } from '@/application/services/sorting/DateTimeSortStrategy.js'
import { NumericSortStrategy } from '@/application/services/sorting/NumericSortStrategy.js'
import {
  buildMultiCriteriaSort,
  getStrategy,
  validateSortOptions,
} from '@/application/services/sorting/SortStrategyFactory.js'
import { TextSortStrategy } from '@/application/services/sorting/TextSortStrategy.js'

describe('Enhanced Sort Functionality', () => {
  const mockAttributes: AttributeTypeInfo[] = [
    { identifier: 'age', dataType: 'number', name: 'Age' },
    { identifier: 'name', dataType: 'string', name: 'Name' },
    { identifier: 'created_date', dataType: 'datetime', name: 'Created Date' },
    { identifier: 'score', dataType: 'decimal', name: 'Score' },
  ]

  describe('SortStrategyFactory', () => {
    test('should select NumericSortStrategy for numeric fields', () => {
      const strategy = getStrategy('age', mockAttributes)
      expect(strategy).toBeInstanceOf(NumericSortStrategy)
    })

    test('should select DateTimeSortStrategy for datetime fields', () => {
      const strategy = getStrategy('created_date', mockAttributes)
      expect(strategy).toBeInstanceOf(DateTimeSortStrategy)
    })

    test('should select TextSortStrategy for string fields', () => {
      const strategy = getStrategy('name', mockAttributes)
      expect(strategy).toBeInstanceOf(TextSortStrategy)
    })

    test('should select DateTimeSortStrategy for system date fields', () => {
      const strategy = getStrategy('created_at', mockAttributes)
      expect(strategy).toBeInstanceOf(DateTimeSortStrategy)
    })

    test('should build multi-criteria sort clauses', () => {
      const sortOptions = [
        { field: 'age', direction: 'desc' as const },
        { field: 'name', direction: 'asc' as const },
      ]

      const sortContext = {
        availableAttributes: mockAttributes,
        tableAlias: 'tables',
        nodeAlias: 'n',
        attributeAlias: 'nav',
      }

      const result = buildMultiCriteriaSort(sortOptions, sortContext)

      expect(result.sqlClause).toContain('ORDER BY')
      expect(result.sortFields).toEqual(['age', 'name'])
      expect(result.parameters).toBeArray()
    })

    test('should validate sort options correctly', () => {
      const sortOptions = [
        { field: 'age', direction: 'asc' as const },
        { field: 'invalid_field', direction: 'desc' as const },
        { field: 'created_at', direction: 'asc' as const },
      ]

      const { valid, invalid } = validateSortOptions(sortOptions, mockAttributes)

      expect(valid).toHaveLength(2)
      expect(invalid).toHaveLength(1)
      expect(invalid[0].field).toBe('invalid_field')
    })
  })

  describe('NumericSortStrategy', () => {
    const strategy = new NumericSortStrategy()

    test('should handle numeric data types', () => {
      expect(strategy.canHandle('age', 'number')).toBe(true)
      expect(strategy.canHandle('score', 'decimal')).toBe(true)
      expect(strategy.canHandle('name', 'string')).toBe(false)
    })

    test('should validate numeric values', () => {
      expect(NumericSortStrategy.isValidNumeric('123')).toBe(true)
      expect(NumericSortStrategy.isValidNumeric('123.45')).toBe(true)
      expect(NumericSortStrategy.isValidNumeric('abc')).toBe(false)
      expect(NumericSortStrategy.isValidNumeric('')).toBe(false)
    })

    test('should safely parse numbers', () => {
      expect(NumericSortStrategy.safeParseNumber('123')).toBe(123)
      expect(NumericSortStrategy.safeParseNumber('abc', 999)).toBe(999)
      expect(NumericSortStrategy.safeParseNumber('', 0)).toBe(0)
    })
  })

  describe('DateTimeSortStrategy', () => {
    const strategy = new DateTimeSortStrategy()

    test('should handle datetime data types', () => {
      expect(strategy.canHandle('created_date', 'datetime')).toBe(true)
      expect(strategy.canHandle('created_at', 'datetime')).toBe(true)
      expect(strategy.canHandle('age', 'number')).toBe(false)
    })

    test('should validate datetime values', () => {
      expect(DateTimeSortStrategy.isValidDateTime('2023-12-25')).toBe(true)
      expect(DateTimeSortStrategy.isValidDateTime('2023-12-25T10:30:00Z')).toBe(true)
      expect(DateTimeSortStrategy.isValidDateTime('invalid-date')).toBe(false)
      expect(DateTimeSortStrategy.isValidDateTime('')).toBe(false)
    })

    test('should format datetime for SQLite', () => {
      const date = new Date('2023-12-25T10:30:00.000Z')
      const formatted = DateTimeSortStrategy.formatForSQLite(date)
      expect(formatted).toBe('2023-12-25 10:30:00')
    })
  })

  describe('TextSortStrategy', () => {
    const strategy = new TextSortStrategy()

    test('should handle text data types', () => {
      expect(strategy.canHandle('name', 'string')).toBe(true)
      expect(strategy.canHandle('description', 'text')).toBe(true)
      expect(strategy.canHandle('age', 'number')).toBe(false)
    })

    test('should normalize text values', () => {
      expect(TextSortStrategy.normalizeText('  hello  ')).toBe('hello')
      expect(TextSortStrategy.normalizeText('')).toBe('')
    })

    test('should detect empty text', () => {
      expect(TextSortStrategy.isEmptyText('')).toBe(true)
      expect(TextSortStrategy.isEmptyText('   ')).toBe(true)
      expect(TextSortStrategy.isEmptyText('hello')).toBe(false)
    })

    test('should compare text case-insensitively', () => {
      expect(TextSortStrategy.compareText('apple', 'banana', 'asc')).toBe(-1)
      expect(TextSortStrategy.compareText('Apple', 'apple', 'asc')).toBe(0)
      expect(TextSortStrategy.compareText('banana', 'apple', 'desc')).toBe(-1)
    })

    test('should sort text arrays naturally', () => {
      const values = ['item10', 'item2', 'item1']
      const sorted = TextSortStrategy.sortTextArray(values, 'asc', true)
      expect(sorted).toEqual(['item1', 'item2', 'item10'])
    })
  })
})
