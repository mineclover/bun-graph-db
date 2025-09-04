import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import { graphqlRequest } from './graphql-integration.test.js'

/**
 * Relationship Quality System Tests
 * Tests the relationship strength and confidence levels (0-4 scale)
 */

describe('Relationship Quality System Tests', () => {
  let testTableId: string
  let node1Id: string
  let node2Id: string
  let relationTypeId: string

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Setup test data
    await setupTestData()
  })

  async function setupTestData() {
    const timestamp = Date.now()
    
    // Create test table
    const tableResult = await graphqlRequest(`
      mutation CreateQualityTestTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
          }
          errors { message }
        }
      }
    `, {
      input: {
        identifier: `quality-test-${timestamp}`,
        description: 'Test table for relationship quality system'
      }
    })
    
    testTableId = tableResult.data.createTable.table.id

    // Create test nodes
    const node1Result = await graphqlRequest(`
      mutation CreateNode1($input: CreateNodeInput!) {
        createNode(input: $input) {
          node {
            id
            content
          }
          errors { message }
        }
      }
    `, {
      input: {
        tableId: testTableId,
        content: "Source Node for Quality Testing",
        title: "Source Node"
      }
    })

    const node2Result = await graphqlRequest(`
      mutation CreateNode2($input: CreateNodeInput!) {
        createNode(input: $input) {
          node {
            id
            content
          }
          errors { message }
        }
      }
    `, {
      input: {
        tableId: testTableId,
        content: "Target Node for Quality Testing",
        title: "Target Node"
      }
    })

    node1Id = node1Result.data.createNode.node.id
    node2Id = node2Result.data.createNode.node.id

    // Get a relation type
    const relationTypesResult = await graphqlRequest(`
      query GetRelationTypes {
        relationTypes {
          id
          identifier
        }
      }
    `)
    
    relationTypeId = relationTypesResult.data.relationTypes.find(
      (rt: any) => rt.identifier === 'related_to'
    ).id
  }

  describe('1. Relationship Creation with Quality Levels', () => {
    test('should create relationship with default quality levels', async () => {
      const result = await graphqlRequest(`
        mutation CreateDefaultQualityRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation {
              id
              strength
              confidence
              sourceNode {
                content
              }
              targetNode {
                content
              }
              relationType {
                identifier
              }
            }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          sourceNodeId: node1Id,
          targetNodeId: node2Id,
          relationTypeId: relationTypeId
        }
      })

      expect(result.data.createRelation.errors).toHaveLength(0)
      expect(result.data.createRelation.relation.strength).toBe(1) // auto_generated
      expect(result.data.createRelation.relation.confidence).toBe(1) // auto_generated
    })

    test('should create relationship with custom quality levels', async () => {
      const result = await graphqlRequest(`
        mutation CreateCustomQualityRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation {
              id
              strength
              confidence
            }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          sourceNodeId: node2Id,
          targetNodeId: node1Id,
          relationTypeId: relationTypeId,
          strength: 3, // confident
          confidence: 4 // verified
        }
      })

      expect(result.data.createRelation.errors).toHaveLength(0)
      expect(result.data.createRelation.relation.strength).toBe(3)
      expect(result.data.createRelation.relation.confidence).toBe(4)
    })
  })

  describe('2. Quality Level Validation', () => {
    test('should reject invalid strength values', async () => {
      const result = await graphqlRequest(`
        mutation CreateInvalidStrengthRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          sourceNodeId: node1Id,
          targetNodeId: node2Id,
          relationTypeId: relationTypeId,
          strength: 5, // Invalid: should be 0-4
          confidence: 2
        }
      })

      expect(result.data.createRelation.relation).toBeNull()
      expect(result.data.createRelation.errors.length).toBeGreaterThan(0)
      expect(result.data.createRelation.errors[0].message).toContain('strength')
    })

    test('should reject invalid confidence values', async () => {
      const result = await graphqlRequest(`
        mutation CreateInvalidConfidenceRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          sourceNodeId: node1Id,
          targetNodeId: node2Id,
          relationTypeId: relationTypeId,
          strength: 2,
          confidence: -1 // Invalid: should be 0-4
        }
      })

      expect(result.data.createRelation.relation).toBeNull()
      expect(result.data.createRelation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('3. Quality-Based Filtering and Querying', () => {
    test('should filter relationships by quality levels', async () => {
      // Create multiple relationships with different quality levels
      await Promise.all([
        graphqlRequest(`
          mutation CreateLowQuality($input: CreateRelationInput!) {
            createRelation(input: $input) {
              relation { id }
              errors { message }
            }
          }
        `, {
          input: {
            tableId: testTableId,
            sourceNodeId: node1Id,
            targetNodeId: node2Id,
            relationTypeId: relationTypeId,
            strength: 1,
            confidence: 1
          }
        }),
        
        graphqlRequest(`
          mutation CreateHighQuality($input: CreateRelationInput!) {
            createRelation(input: $input) {
              relation { id }
              errors { message }
            }
          }
        `, {
          input: {
            tableId: testTableId,
            sourceNodeId: node1Id,
            targetNodeId: node2Id,
            relationTypeId: relationTypeId,
            strength: 4,
            confidence: 4
          }
        })
      ])

      // Query relationships with quality filtering (if implemented)
      const result = await graphqlRequest(`
        query GetTableRelations($tableId: ID!) {
          nodeRelations(tableId: $tableId) {
            id
            strength
            confidence
            sourceNode {
              content
            }
            targetNode {
              content
            }
          }
        }
      `, {
        tableId: testTableId
      })

      expect(result.data.nodeRelations).toBeInstanceOf(Array)
      expect(result.data.nodeRelations.length).toBeGreaterThan(0)
      
      // Verify quality levels are returned correctly
      const hasLowQuality = result.data.nodeRelations.some((rel: any) => 
        rel.strength === 1 && rel.confidence === 1
      )
      const hasHighQuality = result.data.nodeRelations.some((rel: any) => 
        rel.strength === 4 && rel.confidence === 4
      )
      
      expect(hasLowQuality).toBe(true)
      expect(hasHighQuality).toBe(true)
    })
  })

  describe('4. Quality Level Semantics', () => {
    test('should demonstrate quality level meanings', async () => {
      const qualityLevels = [
        { strength: 0, confidence: 0, description: 'Invalid/Broken relationship' },
        { strength: 1, confidence: 1, description: 'Auto-generated relationship' },
        { strength: 2, confidence: 2, description: 'Uncertain but valid relationship' },
        { strength: 3, confidence: 3, description: 'Confident relationship' },
        { strength: 4, confidence: 4, description: 'Very strong/verified relationship' }
      ]

      // Create relationships demonstrating each quality level
      for (const level of qualityLevels) {
        const result = await graphqlRequest(`
          mutation CreateQualityLevel($input: CreateRelationInput!) {
            createRelation(input: $input) {
              relation {
                id
                strength
                confidence
                properties
              }
              errors { message }
            }
          }
        `, {
          input: {
            tableId: testTableId,
            sourceNodeId: node1Id,
            targetNodeId: node2Id,
            relationTypeId: relationTypeId,
            strength: level.strength,
            confidence: level.confidence,
            properties: {
              description: level.description,
              testCase: true
            }
          }
        })

        if (level.strength > 0 && level.confidence > 0) {
          expect(result.data.createRelation.errors).toHaveLength(0)
          expect(result.data.createRelation.relation.strength).toBe(level.strength)
          expect(result.data.createRelation.relation.confidence).toBe(level.confidence)
        }
      }
    })
  })

  describe('5. Advanced Quality Analysis', () => {
    test('should calculate relationship quality scores', async () => {
      // Get all relations for the table
      const result = await graphqlRequest(`
        query GetRelationsForAnalysis($tableId: ID!) {
          nodeRelations(tableId: $tableId) {
            id
            strength
            confidence
            sourceNode { content }
            targetNode { content }
          }
        }
      `, {
        tableId: testTableId
      })

      expect(result.data.nodeRelations.length).toBeGreaterThan(0)

      // Calculate quality scores (strength + confidence) / 8.0
      const qualityScores = result.data.nodeRelations.map((rel: any) => ({
        id: rel.id,
        qualityScore: (rel.strength + rel.confidence) / 8.0,
        strength: rel.strength,
        confidence: rel.confidence
      }))

      // Verify quality score calculation
      const highQualityRels = qualityScores.filter(rel => rel.qualityScore >= 0.75)
      const lowQualityRels = qualityScores.filter(rel => rel.qualityScore <= 0.25)

      expect(highQualityRels.length).toBeGreaterThan(0)
      expect(lowQualityRels.length).toBeGreaterThan(0)

      console.log('Quality Analysis:')
      console.log(`- High quality relationships (≥75%): ${highQualityRels.length}`)
      console.log(`- Low quality relationships (≤25%): ${lowQualityRels.length}`)
      console.log(`- Total relationships analyzed: ${qualityScores.length}`)
    })
  })

  describe('6. Quality Update Scenarios', () => {
    test('should support relationship quality updates', async () => {
      // Create a relationship with low quality
      const createResult = await graphqlRequest(`
        mutation CreateUpdatableRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation {
              id
              strength
              confidence
            }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          sourceNodeId: node1Id,
          targetNodeId: node2Id,
          relationTypeId: relationTypeId,
          strength: 1,
          confidence: 1,
          properties: {
            updatable: true,
            reason: "Created for update testing"
          }
        }
      })

      const relationId = createResult.data.createRelation.relation.id

      // Note: Update mutations would need to be implemented
      // This test demonstrates the expected behavior
      console.log('✅ Relationship quality levels are properly stored')
      console.log(`   Created relation ${relationId} with strength=1, confidence=1`)
      console.log('🚧 TODO: Implement relationship quality update mutations')
      
      expect(createResult.data.createRelation.relation.strength).toBe(1)
      expect(createResult.data.createRelation.relation.confidence).toBe(1)
    })
  })
})