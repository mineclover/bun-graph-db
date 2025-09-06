/**
 * Performance Tracking Tests
 * 
 * Tests for execution time tracking and statistics:
 * - updateExecutionStats() method
 * - Average execution time calculation
 * - Usage count tracking
 * - last_used_at timestamp updates
 * - Repository-level performance updates
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SqliteQueryTemplateRepository } from '@/infrastructure/database/sqlite/SqliteQueryTemplateRepository.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { testTemplates } from '../fixtures/test-templates.js'
import Database from 'bun:sqlite'

describe('Performance Tracking Functionality', () => {
  let testDb: Database
  let repository: SqliteQueryTemplateRepository

  beforeEach(async () => {
    testDb = new Database(':memory:')
    
    // Create schema
    testDb.exec(`
      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        query_text TEXT NOT NULL,
        query_name TEXT,
        operation_type TEXT,
        variables_schema TEXT,
        default_variables TEXT,
        applicable_tables TEXT,
        complexity_score INTEGER DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        avg_execution_time_ms INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        is_active BOOLEAN DEFAULT TRUE,
        tags TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_templates_performance ON templates(avg_execution_time_ms, usage_count);
      CREATE INDEX idx_templates_last_used ON templates(last_used_at);
    `)

    repository = new SqliteQueryTemplateRepository(testDb, console)

    // Insert a test template
    const template = QueryTemplate.create(
      'perf-test-template',
      'Performance Test Template',
      testTemplates[0].queryText,
      ['performance-tracking'],
      {
        description: 'Template for performance tracking tests'
      }
    )
    await repository.create(template)
  })

  afterEach(() => {
    testDb.close()
  })

  describe('Entity-Level Performance Tracking', () => {
    it('should initialize with zero performance metrics', () => {
      const template = QueryTemplate.create(
        'test-init',
        'Test Init',
        'query { health }',
        ['test']
      )

      expect(template.usageCount).toBe(0)
      expect(template.avgExecutionTimeMs).toBe(0)
      expect(template.lastUsedAt).toBeNull()
    })

    it('should update execution statistics correctly', () => {
      const template = QueryTemplate.create(
        'test-stats',
        'Test Stats',
        'query { health }',
        ['test']
      )

      // First execution - 100ms
      const beforeUpdate = new Date()
      template.updateExecutionStats(100)
      const afterUpdate = new Date()

      expect(template.usageCount).toBe(1)
      expect(template.avgExecutionTimeMs).toBe(100)
      expect(template.lastUsedAt).toBeInstanceOf(Date)
      expect(template.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      expect(template.lastUsedAt!.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())

      // Second execution - 200ms
      template.updateExecutionStats(200)
      expect(template.usageCount).toBe(2)
      expect(template.avgExecutionTimeMs).toBe(150) // (100 + 200) / 2

      // Third execution - 300ms
      template.updateExecutionStats(300)
      expect(template.usageCount).toBe(3)
      expect(template.avgExecutionTimeMs).toBe(200) // (100 + 200 + 300) / 3
    })

    it('should handle floating point execution times', () => {
      const template = QueryTemplate.create(
        'test-float',
        'Test Float',
        'query { health }',
        ['test']
      )

      template.updateExecutionStats(123.456)
      expect(template.avgExecutionTimeMs).toBe(123) // Rounded down

      template.updateExecutionStats(234.789)
      expect(template.avgExecutionTimeMs).toBe(179) // (123.456 + 234.789) / 2 = 179.1225, rounded to 179
    })

    it('should handle zero and negative execution times gracefully', () => {
      const template = QueryTemplate.create(
        'test-edge-cases',
        'Test Edge Cases',
        'query { health }',
        ['test']
      )

      // Zero execution time
      template.updateExecutionStats(0)
      expect(template.usageCount).toBe(1)
      expect(template.avgExecutionTimeMs).toBe(0)

      // Negative execution time (should be treated as 0)
      template.updateExecutionStats(-50)
      expect(template.usageCount).toBe(2)
      expect(template.avgExecutionTimeMs).toBe(0) // (0 + 0) / 2
    })

    it('should maintain accuracy over multiple executions', () => {
      const template = QueryTemplate.create(
        'test-accuracy',
        'Test Accuracy',
        'query { health }',
        ['test']
      )

      const executionTimes = [50, 100, 150, 200, 250]
      let expectedSum = 0

      for (let i = 0; i < executionTimes.length; i++) {
        const time = executionTimes[i]
        expectedSum += time
        template.updateExecutionStats(time)

        expect(template.usageCount).toBe(i + 1)
        expect(template.avgExecutionTimeMs).toBe(Math.round(expectedSum / (i + 1)))
      }

      // Final check
      expect(template.usageCount).toBe(5)
      expect(template.avgExecutionTimeMs).toBe(150) // Average of [50, 100, 150, 200, 250]
    })
  })

  describe('Repository-Level Performance Updates', () => {
    it('should persist performance updates to database', async () => {
      const identifier = 'perf-test-template'
      
      // Update execution statistics
      await repository.updateExecutionStats(identifier, 125)
      
      // Retrieve and verify
      const template = await repository.findByIdentifier(identifier)
      expect(template).toBeTruthy()
      expect(template!.usageCount).toBe(1)
      expect(template!.avgExecutionTimeMs).toBe(125)
      expect(template!.lastUsedAt).toBeInstanceOf(Date)
    })

    it('should handle multiple performance updates correctly', async () => {
      const identifier = 'perf-test-template'
      
      // Multiple executions
      await repository.updateExecutionStats(identifier, 100)
      await repository.updateExecutionStats(identifier, 200)
      await repository.updateExecutionStats(identifier, 300)
      
      const template = await repository.findByIdentifier(identifier)
      expect(template).toBeTruthy()
      expect(template!.usageCount).toBe(3)
      expect(template!.avgExecutionTimeMs).toBe(200) // (100 + 200 + 300) / 3
    })

    it('should handle non-existent template gracefully', async () => {
      // Should not throw error for non-existent template
      await expect(
        repository.updateExecutionStats('non-existent', 100)
      ).resolves.toBeUndefined()
    })

    it('should maintain database consistency during concurrent updates', async () => {
      const identifier = 'perf-test-template'
      
      // Simulate concurrent updates
      const updates = Promise.all([
        repository.updateExecutionStats(identifier, 100),
        repository.updateExecutionStats(identifier, 200),
        repository.updateExecutionStats(identifier, 300),
        repository.updateExecutionStats(identifier, 400),
        repository.updateExecutionStats(identifier, 500)
      ])

      await updates

      const template = await repository.findByIdentifier(identifier)
      expect(template).toBeTruthy()
      expect(template!.usageCount).toBe(5)
      expect(template!.avgExecutionTimeMs).toBe(300) // (100 + 200 + 300 + 400 + 500) / 5
    })
  })

  describe('Performance Analytics and Queries', () => {
    beforeEach(async () => {
      // Insert multiple templates with different performance characteristics
      const templates = [
        { id: 'fast-template', times: [10, 15, 12, 18, 14] },
        { id: 'medium-template', times: [50, 60, 45, 55, 50] },
        { id: 'slow-template', times: [200, 250, 180, 220, 190] }
      ]

      for (const { id, times } of templates) {
        const template = QueryTemplate.create(
          id,
          `${id} template`,
          `query ${id.replace('-', '')} { health }`,
          ['performance-analytics']
        )
        await repository.create(template)

        // Add performance data
        for (const time of times) {
          await repository.updateExecutionStats(id, time)
        }
      }
    })

    it('should query templates by performance characteristics', async () => {
      // Find fast templates (avg < 30ms)
      const fastTemplates = testDb.prepare(`
        SELECT identifier, avg_execution_time_ms, usage_count 
        FROM templates 
        WHERE avg_execution_time_ms < ? AND usage_count > 0
        ORDER BY avg_execution_time_ms
      `).all(30)

      expect(fastTemplates).toHaveLength(1)
      expect(fastTemplates[0].identifier).toBe('fast-template')

      // Find slow templates (avg > 100ms)
      const slowTemplates = testDb.prepare(`
        SELECT identifier, avg_execution_time_ms, usage_count 
        FROM templates 
        WHERE avg_execution_time_ms > ? AND usage_count > 0
        ORDER BY avg_execution_time_ms DESC
      `).all(100)

      expect(slowTemplates).toHaveLength(1)
      expect(slowTemplates[0].identifier).toBe('slow-template')
    })

    it('should calculate performance statistics accurately', async () => {
      // Verify calculated averages
      const stats = testDb.prepare(`
        SELECT identifier, avg_execution_time_ms, usage_count
        FROM templates 
        WHERE usage_count > 0
        ORDER BY avg_execution_time_ms
      `).all()

      expect(stats).toHaveLength(3)
      
      // Fast template: (10+15+12+18+14)/5 = 13.8 → 14
      expect(stats[0].identifier).toBe('fast-template')
      expect(stats[0].avg_execution_time_ms).toBe(14)
      expect(stats[0].usage_count).toBe(5)

      // Medium template: (50+60+45+55+50)/5 = 52
      expect(stats[1].identifier).toBe('medium-template')
      expect(stats[1].avg_execution_time_ms).toBe(52)
      expect(stats[1].usage_count).toBe(5)

      // Slow template: (200+250+180+220+190)/5 = 208
      expect(stats[2].identifier).toBe('slow-template')
      expect(stats[2].avg_execution_time_ms).toBe(208)
      expect(stats[2].usage_count).toBe(5)
    })

    it('should support performance-based sorting and pagination', async () => {
      // Get top 2 fastest templates
      const fastestTemplates = testDb.prepare(`
        SELECT identifier, avg_execution_time_ms
        FROM templates 
        WHERE usage_count > 0
        ORDER BY avg_execution_time_ms ASC
        LIMIT 2
      `).all()

      expect(fastestTemplates).toHaveLength(2)
      expect(fastestTemplates[0].identifier).toBe('fast-template')
      expect(fastestTemplates[1].identifier).toBe('medium-template')

      // Get most used templates
      const mostUsed = testDb.prepare(`
        SELECT identifier, usage_count, avg_execution_time_ms
        FROM templates 
        ORDER BY usage_count DESC, avg_execution_time_ms ASC
        LIMIT 3
      `).all()

      expect(mostUsed).toHaveLength(3)
      expect(mostUsed.every(t => t.usage_count === 5)).toBe(true)
    })

    it('should track last used timestamps correctly', async () => {
      const beforeTime = new Date()
      await repository.updateExecutionStats('fast-template', 25)
      const afterTime = new Date()

      const template = await repository.findByIdentifier('fast-template')
      expect(template!.lastUsedAt).toBeInstanceOf(Date)
      expect(template!.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(template!.lastUsedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })

  describe('Performance Index Utilization', () => {
    it('should use performance index for sorting by execution time', () => {
      const plan = testDb.prepare(`
        EXPLAIN QUERY PLAN 
        SELECT * FROM templates 
        ORDER BY avg_execution_time_ms, usage_count
      `).all()

      const planText = plan.map(row => row.detail).join(' ')
      expect(planText).toContain('idx_templates_performance')
    })

    it('should efficiently filter by performance ranges', () => {
      const startTime = performance.now()
      
      const results = testDb.prepare(`
        SELECT * FROM templates 
        WHERE avg_execution_time_ms BETWEEN ? AND ?
      `).all(50, 100)
      
      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(0.1) // Sub-millisecond performance
    })

    it('should efficiently query recently used templates', () => {
      const startTime = performance.now()
      
      const results = testDb.prepare(`
        SELECT * FROM templates 
        WHERE last_used_at IS NOT NULL
        ORDER BY last_used_at DESC
      `).all()
      
      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(0.1) // Sub-millisecond performance
    })
  })
})