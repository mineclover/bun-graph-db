/**
 * TypeScript validation test for migration system
 * Tests all core types and interfaces compile correctly
 */

import { describe, it, expect } from 'bun:test'
import type {
  MigrationTarget,
  TestType,
  MigrationPriority,
  EstimatedEffort,
  TestComplexity,
  DatabasePath,
  TestIsolationConfig,
  MigrationAnalysis,
  PerformanceImpact,
} from '../types/MigrationTypes'

import {
  validateMigrationTarget,
  isValidTestType,
  isValidMigrationPriority,
  isValidComplexity,
  MigrationError,
  ValidationError,
  FileSystemError
} from '../types/MigrationTypes'

describe('TypeScript Migration System Validation', () => {
  describe('Type Guards', () => {
    it('should validate test types correctly', () => {
      expect(isValidTestType('unit')).toBe(true)
      expect(isValidTestType('integration')).toBe(true)
      expect(isValidTestType('e2e')).toBe(true)
      expect(isValidTestType('invalid')).toBe(false)
    })

    it('should validate migration priorities correctly', () => {
      expect(isValidMigrationPriority('low')).toBe(true)
      expect(isValidMigrationPriority('medium')).toBe(true)
      expect(isValidMigrationPriority('high')).toBe(true)
      expect(isValidMigrationPriority('critical')).toBe(true)
      expect(isValidMigrationPriority('invalid')).toBe(false)
    })

    it('should validate complexity values correctly', () => {
      expect(isValidComplexity(0.0)).toBe(true)
      expect(isValidComplexity(0.5)).toBe(true)
      expect(isValidComplexity(1.0)).toBe(true)
      expect(isValidComplexity(-0.1)).toBe(false)
      expect(isValidComplexity(1.1)).toBe(false)
    })
  })

  describe('MigrationTarget Validation', () => {
    it('should validate correct migration target', () => {
      const target: MigrationTarget = {
        testFilePath: '/path/to/test.test.ts',
        testType: 'unit',
        migrationPriority: 'medium',
        complexity: 0.5,
        dependencies: ['dep1', 'dep2'],
        estimatedEffort: 'medium'
      }

      expect(validateMigrationTarget(target)).toBe(true)
    })

    it('should reject invalid migration target', () => {
      const target = {
        testFilePath: '',
        testType: 'invalid',
        migrationPriority: 'invalid',
        complexity: 2.0,
        dependencies: [123], // Invalid: should be strings
        estimatedEffort: 'invalid'
      }

      expect(validateMigrationTarget(target)).toBe(false)
    })
  })

  describe('Error Types', () => {
    it('should create MigrationError with correct properties', () => {
      const error = new MigrationError('Test error', 'TEST_CODE', { key: 'value' })

      expect(error.name).toBe('MigrationError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.details).toEqual({ key: 'value' })
    })

    it('should create ValidationError as MigrationError subclass', () => {
      const error = new ValidationError('Validation failed', { field: 'test' })

      expect(error.name).toBe('ValidationError')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error instanceof MigrationError).toBe(true)
    })

    it('should create FileSystemError as MigrationError subclass', () => {
      const error = new FileSystemError('File not found', { path: '/test' })

      expect(error.name).toBe('FileSystemError')
      expect(error.code).toBe('FILESYSTEM_ERROR')
      expect(error instanceof MigrationError).toBe(true)
    })
  })

  describe('Complex Type Composition', () => {
    it('should handle DatabasePath with readonly properties', () => {
      const dbPath: DatabasePath = {
        path: '/tmp/test.sqlite',
        isFileBase: true,
        isTemporary: true
      }

      // TypeScript should enforce readonly - this should be a compile-time check
      expect(dbPath.path).toBe('/tmp/test.sqlite')
      expect(dbPath.isFileBase).toBe(true)
      expect(dbPath.isTemporary).toBe(true)
    })

    it('should handle TestIsolationConfig with all properties', () => {
      const config: TestIsolationConfig = {
        enforceFileBased: true,
        tempDirectory: '/tmp/bun-graph-db-tests',
        uniqueNaming: true,
        cleanupOnExit: true
      }

      expect(config.enforceFileBased).toBe(true)
      expect(config.tempDirectory).toBe('/tmp/bun-graph-db-tests')
    })

    it('should handle PerformanceImpact with nested objects', () => {
      const impact: PerformanceImpact = {
        executionTime: 1000,
        resourceUsage: {
          memory: 50,
          cpu: 30
        },
        parallelizability: true
      }

      expect(impact.executionTime).toBe(1000)
      expect(impact.resourceUsage.memory).toBe(50)
      expect(impact.resourceUsage.cpu).toBe(30)
      expect(impact.parallelizability).toBe(true)
    })
  })

  describe('Array and Readonly Properties', () => {
    it('should handle readonly arrays correctly', () => {
      const target: MigrationTarget = {
        testFilePath: '/path/to/test.test.ts',
        testType: 'unit',
        migrationPriority: 'medium',
        complexity: 0.5,
        dependencies: ['dep1', 'dep2', 'dep3'],
        estimatedEffort: 'medium'
      }

      // TypeScript should enforce readonly array
      expect(target.dependencies.length).toBe(3)
      expect(target.dependencies).toContain('dep1')

      // This should work (reading)
      const firstDep = target.dependencies[0]
      expect(firstDep).toBe('dep1')
    })

    it('should handle MigrationAnalysis with complex nested structure', () => {
      const analysis: MigrationAnalysis = {
        target: {
          testFilePath: '/path/to/test.test.ts',
          testType: 'integration',
          migrationPriority: 'high',
          complexity: 0.8,
          dependencies: ['db', 'auth'],
          estimatedEffort: 'high'
        },
        feasibility: 0.7,
        risks: ['Database dependencies', 'Complex async patterns'],
        recommendations: ['Use file-based isolation', 'Add timeout handling'],
        estimatedTime: 120,
        requiredTools: ['TestDatabaseFactory', 'AsyncHelpers'],
        performanceImpact: {
          executionTime: 2000,
          resourceUsage: {
            memory: 100,
            cpu: 60
          },
          parallelizability: false
        }
      }

      expect(analysis.feasibility).toBe(0.7)
      expect(analysis.risks.length).toBe(2)
      expect(analysis.recommendations.length).toBe(2)
      expect(analysis.performanceImpact.parallelizability).toBe(false)
    })
  })

  describe('Type Inference and Strict Typing', () => {
    it('should infer types correctly', () => {
      const createTarget = (
        path: string,
        type: TestType,
        priority: MigrationPriority,
        complexity: TestComplexity
      ): MigrationTarget => ({
        testFilePath: path,
        testType: type,
        migrationPriority: priority,
        complexity,
        dependencies: [],
        estimatedEffort: 'low'
      })

      const target = createTarget('/test.ts', 'unit', 'low', 0.2)

      expect(target.testType).toBe('unit')
      expect(target.migrationPriority).toBe('low')
      expect(target.complexity).toBe(0.2)
    })

    it('should enforce strict typing for enums', () => {
      // These should compile without issues
      const testType: TestType = 'unit'
      const priority: MigrationPriority = 'medium'
      const effort: EstimatedEffort = 'high'

      expect(testType).toBe('unit')
      expect(priority).toBe('medium')
      expect(effort).toBe('high')
    })
  })

  describe('Optional Properties and Metadata', () => {
    it('should handle optional metadata correctly', () => {
      const targetWithMetadata: MigrationTarget = {
        testFilePath: '/path/to/test.test.ts',
        testType: 'e2e',
        migrationPriority: 'critical',
        complexity: 0.9,
        dependencies: ['playwright', 'database'],
        estimatedEffort: 'extreme',
        metadata: {
          author: 'test-author',
          created: new Date().toISOString(),
          tags: ['e2e', 'critical']
        }
      }

      expect(targetWithMetadata.metadata).toBeDefined()
      expect(targetWithMetadata.metadata?.author).toBe('test-author')
      expect(targetWithMetadata.metadata?.tags).toContain('e2e')
    })

    it('should handle missing optional properties', () => {
      const targetWithoutMetadata: MigrationTarget = {
        testFilePath: '/path/to/test.test.ts',
        testType: 'unit',
        migrationPriority: 'low',
        complexity: 0.1,
        dependencies: [],
        estimatedEffort: 'low'
        // metadata is optional, so this should compile
      }

      expect(targetWithoutMetadata.metadata).toBeUndefined()
    })
  })
})