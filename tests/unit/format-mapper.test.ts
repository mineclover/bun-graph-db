/**
 * Format Mapper Service Tests
 *
 * Tests for the FormatMapperService that transforms between Flat JSON and custom formats
 */

import { describe, expect, it } from 'vitest'
import type {
  FormatMappingTemplate,
  NodeLevelMapping,
  SimpleMappingDefinition,
} from '../../src/core/types/FormatMapping.js'
import {
  expandNodeMapping,
  isNodeLevelMapping,
  normalizeMapping,
  PRESET_MAPPINGS,
} from '../../src/core/types/FormatMapping.js'
import type { FlatJsonExport } from '../../src/core/types/JsonExport.js'
import { FormatMapperService } from '../../src/domain/services/FormatMapperService.js'

describe('FormatMapperService', () => {
  const service = new FormatMapperService()

  // Sample Flat JSON data for testing
  const sampleFlatData: FlatJsonExport = {
    version: '1.0.0',
    exportedAt: '2025-01-01T00:00:00.000Z',
    table: {
      id: '123',
      identifier: 'users',
      description: 'User table',
    },
    nodes: [
      { id: '1', title: 'Alice', content: 'Developer', email: 'alice@example.com', age: 30 },
      { id: '2', title: 'Bob', content: 'Designer', email: 'bob@example.com', age: 25 },
      { id: '3', title: 'Charlie', content: 'Manager', email: 'charlie@example.com', age: 35 },
    ],
  }

  describe('normalizeMapping', () => {
    it('should return FormatMappingTemplate as-is', () => {
      const template: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'output.id', source: '$.nodes[*].id' }],
      }

      const result = normalizeMapping(template)
      expect(result).toEqual(template)
    })

    it('should convert SimpleMappingDefinition to FormatMappingTemplate', () => {
      const simple: SimpleMappingDefinition = {
        'users[*].id': '$.nodes[*].id',
        'users[*].name': '$.nodes[*].title',
      }

      const result = normalizeMapping(simple, 'Users Mapping')

      expect(result.name).toBe('Users Mapping')
      expect(result.mappings).toHaveLength(2)
      expect(result.mappings[0].target).toBe('users[*].id')
      expect(result.mappings[0].source).toBe('$.nodes[*].id')
    })
  })

  describe('transformToCustomFormat', () => {
    it('should transform flat data using simple mapping', () => {
      const mapping: SimpleMappingDefinition = {
        'data.tableId': '$.table.id',
        'data.tableName': '$.table.identifier',
      }

      const result = service.transformToCustomFormat(sampleFlatData, { template: mapping })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect((result.data as any).data.tableId).toBe('123')
      expect((result.data as any).data.tableName).toBe('users')
    })

    it('should handle array wildcard mapping', () => {
      const mapping: SimpleMappingDefinition = {
        'items[*].id': '$.nodes[*].id',
        'items[*].displayName': '$.nodes[*].title',
      }

      const result = service.transformToCustomFormat(sampleFlatData, { template: mapping })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.items).toBeDefined()
      expect(data.items).toHaveLength(3)
      expect(data.items[0].id).toBe('1')
      expect(data.items[0].displayName).toBe('Alice')
    })

    it('should apply transforms', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'tableName', source: '$.table.identifier', transform: 'uppercase' }],
      }

      const result = service.transformToCustomFormat(sampleFlatData, { template: mapping })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.tableName).toBe('USERS')
    })

    it('should use default values for missing sources', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [
          { target: 'tableId', source: '$.table.id' },
          { target: 'status', source: '$.table.nonexistent', defaultValue: 'active' },
        ],
      }

      const result = service.transformToCustomFormat(sampleFlatData, { template: mapping })

      expect(result.success).toBe(true)
      expect(result.stats.defaultsApplied).toBe(1)
      expect((result.data as any).status).toBe('active')
    })

    it('should use preset mappings', () => {
      const result = service.transformToCustomFormat(sampleFlatData, {
        template: PRESET_MAPPINGS.CSV_FLAT,
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.rows).toBeDefined()
    })

    it('should fail in strict mode for missing sources', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'missingField', source: '$.table.nonexistent' }],
      }

      const result = service.transformToCustomFormat(sampleFlatData, {
        template: mapping,
        strictMode: true,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should include nulls when option is set', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [
          { target: 'id', source: '$.table.id' },
          { target: 'missing', source: '$.table.nonexistent' },
        ],
      }

      const result = service.transformToCustomFormat(sampleFlatData, {
        template: mapping,
        includeNulls: true,
      })

      expect(result.success).toBe(true)
      expect((result.data as any).missing).toBe(null)
    })
  })

  describe('transformToFlatJson', () => {
    it('should transform custom format back to flat JSON', () => {
      const customData = {
        users: [
          { userId: '1', displayName: 'Alice', description: 'Developer' },
          { userId: '2', displayName: 'Bob', description: 'Designer' },
        ],
        meta: {
          tableId: '123',
          tableName: 'users',
        },
      }

      const mapping: SimpleMappingDefinition = {
        'users[*].userId': '$.nodes[*].id',
        'users[*].displayName': '$.nodes[*].title',
        'users[*].description': '$.nodes[*].content',
        'meta.tableId': '$.table.id',
        'meta.tableName': '$.table.identifier',
      }

      const result = service.transformToFlatJson(customData, { template: mapping })

      expect(result.success).toBe(true)
      expect(result.flatData).toBeDefined()
    })
  })

  describe('generatePatches', () => {
    it('should generate patches from custom format data', () => {
      const customData = {
        users: [
          { id: '1', name: 'Alice Updated', role: 'Senior Developer' },
          { id: '2', name: 'Bob Updated', role: 'Lead Designer' },
        ],
      }

      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [
          { target: 'users[*].id', source: '$.nodes[*].id' },
          { target: 'users[*].name', source: '$.nodes[*].title' },
          { target: 'users[*].role', source: '$.nodes[*].content' },
        ],
      }

      const result = service.generatePatches(customData, { template: mapping })

      expect(result.success).toBe(true)
      expect(result.patches).toBeDefined()
      expect(result.patches).toHaveLength(2)
      expect(result.patches?.[0].id).toBe('1')
      expect(result.patches?.[0].title).toBe('Alice Updated')
      expect(result.patches?.[0].content).toBe('Senior Developer')
    })

    it('should fail without ID mapping', () => {
      const customData = {
        users: [{ name: 'Alice' }],
      }

      const mapping: SimpleMappingDefinition = {
        'users[*].name': '$.nodes[*].title',
      }

      const result = service.generatePatches(customData, { template: mapping })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('ID mapping')
    })
  })

  describe('validateMapping', () => {
    it('should validate correct mapping', () => {
      const mapping: SimpleMappingDefinition = {
        'output.id': '$.nodes[*].id',
        'output.name': '$.nodes[*].title',
      }

      const result = service.validateMapping(mapping)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect duplicate target paths', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [
          { target: 'output.id', source: '$.nodes[*].id' },
          { target: 'output.id', source: '$.nodes[*].title' },
        ],
      }

      const result = service.validateMapping(mapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'DUPLICATE_TARGET')).toBe(true)
    })

    it('should detect invalid transform types', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'output.id', source: '$.nodes[*].id', transform: 'invalid' as any }],
      }

      const result = service.validateMapping(mapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_TRANSFORM')).toBe(true)
    })

    it('should warn about missing sources when validating against data', () => {
      const mapping: SimpleMappingDefinition = {
        'output.id': '$.table.id',
        'output.missing': '$.table.nonexistent',
      }

      const result = service.validateMapping(mapping, sampleFlatData)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.code === 'UNUSED_SOURCE_FIELD')).toBe(true)
    })

    it('should warn about deep nesting', () => {
      const mapping: SimpleMappingDefinition = {
        'a.b.c.d.e.f.g': '$.nodes[*].id',
      }

      const result = service.validateMapping(mapping)

      expect(result.warnings.some((w) => w.code === 'DEEP_NESTING')).toBe(true)
    })
  })

  describe('preset mappings', () => {
    it('should have CSV_FLAT preset', () => {
      expect(PRESET_MAPPINGS.CSV_FLAT).toBeDefined()
      expect(PRESET_MAPPINGS.CSV_FLAT.id).toBe('preset:csv-flat')
      expect(PRESET_MAPPINGS.CSV_FLAT.mappings.length).toBeGreaterThan(0)
    })

    it('should have API_RESPONSE preset', () => {
      expect(PRESET_MAPPINGS.API_RESPONSE).toBeDefined()
      expect(PRESET_MAPPINGS.API_RESPONSE.id).toBe('preset:api-response')
    })

    it('should have GRAPH_FORMAT preset', () => {
      expect(PRESET_MAPPINGS.GRAPH_FORMAT).toBeDefined()
      expect(PRESET_MAPPINGS.GRAPH_FORMAT.id).toBe('preset:graph')
    })
  })

  describe('NodeLevelMapping', () => {
    it('should detect NodeLevelMapping correctly', () => {
      const nodeMapping: NodeLevelMapping = {
        nodeMapping: { id: 'id', name: 'title' },
      }

      expect(isNodeLevelMapping(nodeMapping)).toBe(true)
      expect(isNodeLevelMapping({ 'output.id': '$.nodes[*].id' })).toBe(false)
    })

    it('should expand basic NodeLevelMapping to FormatMappingTemplate', () => {
      const nodeMapping: NodeLevelMapping = {
        outputKey: 'users',
        nodeMapping: {
          id: 'id',
          name: 'title',
          role: 'content',
        },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.id).toContain('node-level:')
      expect(template.mappings).toHaveLength(3)
      expect(template.mappings[0].target).toBe('users[*].id')
      expect(template.mappings[0].source).toBe('$.nodes[*].id')
      expect(template.mappings[1].target).toBe('users[*].name')
      expect(template.mappings[1].source).toBe('$.nodes[*].title')
    })

    it('should handle @ prefix for attributes', () => {
      const nodeMapping: NodeLevelMapping = {
        nodeMapping: {
          email: '@email',
          age: '@age',
        },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.mappings[0].source).toBe('$.nodes[*].attributes.email')
      expect(template.mappings[1].source).toBe('$.nodes[*].attributes.age')
    })

    it('should handle @@ prefix for system fields', () => {
      const nodeMapping: NodeLevelMapping = {
        nodeMapping: {
          created: '@@createdAt',
          updated: '@@updatedAt',
        },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.mappings[0].source).toBe('$.nodes[*].createdAt')
      expect(template.mappings[1].source).toBe('$.nodes[*].updatedAt')
    })

    it('should handle transform in NodeFieldMapping', () => {
      const nodeMapping: NodeLevelMapping = {
        nodeMapping: {
          upperName: { field: 'title', transform: 'uppercase' },
          trimmedContent: { field: 'content', transform: 'trim' },
        },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.mappings[0].transform).toBe('uppercase')
      expect(template.mappings[1].transform).toBe('trim')
    })

    it('should handle metaMapping for table fields', () => {
      const nodeMapping: NodeLevelMapping = {
        outputKey: 'users',
        nodeMapping: { id: 'id' },
        metaMapping: {
          tableId: 'id',
          tableName: 'identifier',
        },
        metaKey: 'info',
      }

      const template = expandNodeMapping(nodeMapping)

      const metaMappings = template.mappings.filter((m) => m.target.startsWith('info.'))
      expect(metaMappings).toHaveLength(2)
      expect(metaMappings[0].target).toBe('info.tableId')
      expect(metaMappings[0].source).toBe('$.table.id')
    })

    it('should work with normalizeMapping', () => {
      const nodeMapping: NodeLevelMapping = {
        outputKey: 'items',
        nodeMapping: { id: 'id', name: 'title' },
      }

      const template = normalizeMapping(nodeMapping, 'Test Node Mapping')

      expect(template.name).toBe('Test Node Mapping')
      expect(template.mappings).toHaveLength(2)
    })

    it('should generate correct rootTemplate', () => {
      const nodeMapping: NodeLevelMapping = {
        outputKey: 'users',
        nodeMapping: { id: 'id' },
        metaMapping: { tableId: 'id' },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.rootTemplate).toEqual({
        users: [],
        meta: {},
      })
    })

    it('should use default outputKey and metaKey', () => {
      const nodeMapping: NodeLevelMapping = {
        nodeMapping: { id: 'id' },
      }

      const template = expandNodeMapping(nodeMapping)

      expect(template.mappings[0].target).toBe('items[*].id')
      expect(template.rootTemplate).toEqual({ items: [] })
    })
  })

  describe('transforms', () => {
    const testData: FlatJsonExport = {
      version: '1.0.0',
      exportedAt: '2025-01-01T00:00:00.000Z',
      table: { id: '1', identifier: ' Hello World ' },
      nodes: [{ id: '1', title: ' Hello World ', content: 'test' }],
    }

    it('should apply string transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'tableId', source: '$.table.id', transform: 'string' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect(result.success).toBe(true)
      expect(typeof (result.data as any).tableId).toBe('string')
    })

    it('should apply uppercase transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'name', source: '$.table.identifier', transform: 'uppercase' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect((result.data as any).name).toBe(' HELLO WORLD ')
    })

    it('should apply lowercase transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'name', source: '$.table.identifier', transform: 'lowercase' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect((result.data as any).name).toBe(' hello world ')
    })

    it('should apply trim transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'name', source: '$.table.identifier', transform: 'trim' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect((result.data as any).name).toBe('Hello World')
    })

    it('should apply array transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'tags', source: '$.table.identifier', transform: 'array' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect(Array.isArray((result.data as any).tags)).toBe(true)
    })

    it('should apply json transform', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'tableData', source: '$.table', transform: 'json' }],
      }

      const result = service.transformToCustomFormat(testData, { template: mapping })
      expect(typeof (result.data as any).tableData).toBe('string')
    })
  })

  describe('generateMappingGuide', () => {
    it('should generate guide for SimpleMappingDefinition', () => {
      const mapping: SimpleMappingDefinition = {
        'users[*].id': '$.nodes[*].id',
        'users[*].name': '$.nodes[*].title',
      }

      const guide = service.generateMappingGuide(mapping)

      expect(guide).toContain('# Custom Mapping')
      expect(guide).toContain('## 필드 매핑')
      expect(guide).toContain('`users[*].id`')
      expect(guide).toContain('`$.nodes[*].id`')
    })

    it('should generate guide with English language option', () => {
      const mapping: SimpleMappingDefinition = {
        'output.id': '$.nodes[*].id',
      }

      const guide = service.generateMappingGuide(mapping, { language: 'en' })

      expect(guide).toContain('## Field Mappings')
      expect(guide).toContain('Output Field')
      expect(guide).toContain('Source Path')
    })

    it('should generate guide for FormatMappingTemplate with metadata', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test-mapping',
        name: 'Test Mapping',
        version: '2.0.0',
        description: 'A test mapping description',
        metadata: {
          author: 'Test Author',
          tags: ['test', 'sample'],
        },
        mappings: [
          { target: 'id', source: '$.nodes[*].id', defaultValue: 'N/A' },
          { target: 'name', source: '$.nodes[*].title', transform: 'uppercase' },
        ],
      }

      const guide = service.generateMappingGuide(mapping)

      expect(guide).toContain('# Test Mapping')
      expect(guide).toContain('A test mapping description')
      expect(guide).toContain('**Version**: 2.0.0')
      expect(guide).toContain('**ID**: test-mapping')
      expect(guide).toContain('**Author**: Test Author')
      expect(guide).toContain('**Tags**: test, sample')
      expect(guide).toContain('uppercase')
      expect(guide).toContain('`"N/A"`')
    })

    it('should generate guide for NodeLevelMapping', () => {
      const mapping: NodeLevelMapping = {
        outputKey: 'users',
        nodeMapping: {
          id: 'id',
          name: 'title',
          email: '@email',
          created: '@@createdAt',
        },
        metaMapping: {
          tableId: 'id',
        },
        metaKey: 'info',
      }

      const guide = service.generateMappingGuide(mapping)

      expect(guide).toContain('## 간소화 문법 (NodeLevelMapping)')
      expect(guide).toContain('### 접두사 규칙')
      expect(guide).toContain('`users[*].id`')
      expect(guide).toContain('`info.tableId`')
    })

    it('should generate guide with rootTemplate', () => {
      const mapping: FormatMappingTemplate = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        mappings: [{ target: 'items[*].id', source: '$.nodes[*].id' }],
        rootTemplate: { items: [] },
      }

      const guide = service.generateMappingGuide(mapping)

      expect(guide).toContain('## 출력 구조')
      expect(guide).toContain('```json')
      expect(guide).toContain('"items": []')
    })

    it('should include examples when requested', () => {
      const mapping: SimpleMappingDefinition = {
        'output.id': '$.table.id',
      }

      const guide = service.generateMappingGuide(mapping, { includeExamples: true })

      expect(guide).toContain('## 사용 예시')
    })
  })

  describe('generatePresetsGuide', () => {
    it('should generate guide for all presets in Korean', () => {
      const guide = service.generatePresetsGuide()

      expect(guide).toContain('# 프리셋 매핑 가이드')
      expect(guide).toContain('## CSV_FLAT')
      expect(guide).toContain('## API_RESPONSE')
      expect(guide).toContain('## GRAPH_FORMAT')
      expect(guide).toContain('PRESET_MAPPINGS')
    })

    it('should generate guide for all presets in English', () => {
      const guide = service.generatePresetsGuide({ language: 'en' })

      expect(guide).toContain('# Preset Mappings Guide')
      expect(guide).toContain('## CSV_FLAT')
      expect(guide).toContain('Mapping Definition')
    })
  })

  describe('writeGuideToFile', () => {
    it('should write guide to file successfully', async () => {
      const result = await service.writeGuideToFile('test content', 'test-guide.md', '/tmp')

      expect(result.success).toBe(true)
      expect(result.path).toContain('test-guide.md')
    })
  })
})
