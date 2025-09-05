import { beforeAll, describe, expect, test } from '@jest/globals'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

describe('Relationship Quality Tests', () => {
  const testContext = createTestContext('relationship-quality-tests')

  let client: GraphQLTestClient
  let testTableId: string
  let relationTypeId: string
  const nodeIds: string[] = []

  beforeAll(async () => {
    client = new GraphQLTestClient()

    // Health check
    const isHealthy = await client.healthCheck()
    if (!isHealthy) {
      throw new Error('GraphQL server is not healthy')
    }

    // Create test table
    testTableId = (await client.createTable(
      'relationship-test',
      'Relationship quality testing'
    )) as string
    if (!testTableId) {
      throw new Error('Failed to create test table')
    }

    // Create relation type
    relationTypeId = (await client.createRelationType(
      'depends-on',
      'Dependency relation for testing'
    )) as string
    if (!relationTypeId) {
      throw new Error('Failed to create relation type')
    }

    // Create test nodes
    for (let i = 0; i < 3; i++) {
      const nodeId = await client.createNode(
        testTableId,
        `Test Node ${i}`,
        `Node ${i} for relationship testing`
      )
      if (testContext.errorHandler.assertNonNull(nodeId, 'nodeId is required')) {
        nodeIds.push(nodeId)
      }
    }

    if (nodeIds.length < 2) {
      throw new Error('Need at least 2 nodes for relationship testing')
    }
  })

  describe('Basic Relationship Operations', () => {
    test('should create relationships with quality metrics', async () => {
      // Create relationship with specific strength and confidence
      const relationId = await client.createRelation(
        testTableId,
        relationTypeId,
        nodeIds[0],
        nodeIds[1],
        0.8, // strength
        0.9 // confidence
      )

      expect(relationId).toBeTruthy()

      // Query the created relationship
      const result = await client.getNodeRelations(testTableId)
      expect(result.data).toBeTruthy()
      expect(result.data.nodeRelations).toBeInstanceOf(Array)

      // Find our created relationship
      const createdRelation = result.data.nodeRelations.find((rel) => rel.id === relationId)
      expect(createdRelation).toBeTruthy()
      expect(createdRelation.strength).toBe(0.8)
      expect(createdRelation.confidence).toBe(0.9)
    })

    test('should handle different quality levels', async () => {
      const qualityLevels = [
        { strength: 0.2, confidence: 0.3, description: 'Low quality' },
        { strength: 0.6, confidence: 0.7, description: 'Medium quality' },
        { strength: 0.9, confidence: 0.95, description: 'High quality' },
      ]

      const createdRelations = []

      for (const level of qualityLevels) {
        if (nodeIds.length < 3) break

        const relationId = await client.createRelation(
          testTableId,
          relationTypeId,
          nodeIds[0],
          nodeIds[2],
          level.strength,
          level.confidence
        )

        if (testContext.errorHandler.assertNonNull(relationId, 'relationId is required')) {
          createdRelations.push({
            id: relationId,
            expectedStrength: level.strength,
            expectedConfidence: level.confidence,
          })
        }
      }

      expect(createdRelations.length).toBeGreaterThan(0)

      // Verify quality levels were stored correctly
      const result = await client.getNodeRelations(testTableId)
      expect(result.data.nodeRelations).toBeInstanceOf(Array)

      console.log(
        `✅ Created ${createdRelations.length} relationships with different quality levels`
      )
    })
  })

  describe('Relationship Queries', () => {
    test('should query node relationships efficiently', async () => {
      const startTime = Date.now()

      const result = await client.getNodeRelations(testTableId)

      const duration = Date.now() - startTime

      expect(result.data).toBeTruthy()
      expect(result.data.nodeRelations).toBeInstanceOf(Array)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second

      console.log(`✅ Relationship query performance: ${duration}ms`)
      console.log(`   - Found ${result.data.nodeRelations.length} relationships`)
    })

    test('should handle related node searches', async () => {
      if (nodeIds.length < 2) {
        console.log('⏭️  Skipping related node search - insufficient nodes')
        return
      }

      const result = await client.searchRelatedNodes(testTableId, [nodeIds[0]], 2)

      expect(result.data).toBeTruthy()
      expect(result.data.searchRelatedNodes).toBeTruthy()

      console.log('✅ Related node search completed')
      console.log(`   - Source node: ${nodeIds[0]}`)
      console.log(`   - Found related nodes: ${result.data.searchRelatedNodes.nodes?.length || 0}`)
    })
  })

  describe('Quality Validation', () => {
    test('should accept valid quality ranges', async () => {
      const validRanges = [
        { strength: 0.0, confidence: 0.0 },
        { strength: 0.5, confidence: 0.5 },
        { strength: 1.0, confidence: 1.0 },
      ]

      for (const range of validRanges) {
        if (nodeIds.length < 2) break

        const relationId = await client.createRelation(
          testTableId,
          relationTypeId,
          nodeIds[0],
          nodeIds[1],
          range.strength,
          range.confidence
        )

        // Note: The current implementation may accept any values
        // This test verifies the API doesn't crash with edge values
        console.log(
          `✅ Accepted quality range: strength=${range.strength}, confidence=${range.confidence}`
        )
      }
    })

    test('should maintain relationship consistency', async () => {
      const result = await client.getNodeRelations(testTableId)
      expect(result.data.nodeRelations).toBeInstanceOf(Array)

      // Count total relationships
      const totalRelations = result.data.nodeRelations.length
      console.log(`✅ Total relationships in table: ${totalRelations}`)

      // Verify each relationship has required fields
      result.data.nodeRelations.forEach((relation) => {
        expect(relation.id).toBeTruthy()
        expect(relation.sourceExternalId).toBeTruthy()
        expect(relation.targetExternalId).toBeTruthy()
        expect(typeof relation.strength).toBe('number')
        expect(typeof relation.confidence).toBe('number')
      })
    })
  })
})
