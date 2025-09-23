/**
 * Comprehensive Graph Traversal Algorithm Test Suite
 *
 * Purpose: Test all graph traversal algorithms and path finding
 * Coverage: BFS, DFS, shortest path, connected components, cycle detection
 * Scenarios: Simple graphs, complex networks, edge cases, performance
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { TestIsolationHelpers } from '../fixtures/test-isolation-helpers'

describe('Comprehensive Graph Traversal Test Suite', () => {
  let container: any
  let testDbFactory: TestDatabaseFactory
  let isolationHelpers: TestIsolationHelpers
  let nodeRepository: any
  let relationRepository: any

  beforeAll(async () => {
    container = await ContainerBootstrap.createContainer()
    testDbFactory = new TestDatabaseFactory()
    isolationHelpers = new TestIsolationHelpers()

    nodeRepository = container.get('INodeRepository')
    relationRepository = container.get('IRelationRepository')
  })

  beforeEach(async () => {
    await isolationHelpers.cleanDatabase()
  })

  afterAll(async () => {
    await testDbFactory.cleanup()
  })

  describe('Basic Graph Traversal Operations', () => {
    let tableId: string
    const nodeIds: string[] = []

    beforeEach(async () => {
      // Create test table
      const table = await testDbFactory.createTestTable('traversal-test-table')
      tableId = table.id

      // Create nodes for basic graph
      for (let i = 1; i <= 6; i++) {
        const node = await testDbFactory.createTestNode(tableId, {
          title: `Node ${i}`,
          content: `Content for node ${i}`,
        })
        nodeIds.push(node.id)
      }

      // Create basic graph structure
      // 1 -> 2 -> 3
      // |    |    |
      // v    v    v
      // 4 -> 5 -> 6
      const relations = [
        { from: 0, to: 1, type: 'connects' }, // 1 -> 2
        { from: 1, to: 2, type: 'connects' }, // 2 -> 3
        { from: 0, to: 3, type: 'connects' }, // 1 -> 4
        { from: 1, to: 4, type: 'connects' }, // 2 -> 5
        { from: 2, to: 5, type: 'connects' }, // 3 -> 6
        { from: 3, to: 4, type: 'connects' }, // 4 -> 5
        { from: 4, to: 5, type: 'connects' }, // 5 -> 6
      ]

      for (const rel of relations) {
        await testDbFactory.createTestRelation(
          nodeIds[rel.from],
          nodeIds[rel.to],
          rel.type,
          tableId
        )
      }
    })

    test('should find direct neighbors correctly', async () => {
      // Test outgoing neighbors of node 1
      const outgoingNeighbors = await nodeRepository.getConnectedNodes(
        nodeIds[0], // Node 1
        { depth: 1, direction: 'OUTGOING' }
      )

      expect(outgoingNeighbors).toHaveLength(2) // Should find nodes 2 and 4
      const neighborTitles = outgoingNeighbors.map((n: any) => n.title).sort()
      expect(neighborTitles).toEqual(['Node 2', 'Node 4'])

      // Test incoming neighbors of node 5
      const incomingNeighbors = await nodeRepository.getConnectedNodes(
        nodeIds[4], // Node 5
        { depth: 1, direction: 'INCOMING' }
      )

      expect(incomingNeighbors).toHaveLength(2) // Should find nodes 2 and 4
      const incomingTitles = incomingNeighbors.map((n: any) => n.title).sort()
      expect(incomingTitles).toEqual(['Node 2', 'Node 4'])
    })

    test('should perform breadth-first traversal with depth limits', async () => {
      // Traverse from node 1 with depth 2
      const bfsResult = await nodeRepository.getConnectedNodes(
        nodeIds[0], // Node 1
        {
          depth: 2,
          direction: 'OUTGOING',
          algorithm: 'BFS',
        }
      )

      // Should reach: Node 2, Node 4 (depth 1) + Node 3, Node 5 (depth 2)
      expect(bfsResult).toHaveLength(4)
      const reachableTitles = bfsResult.map((n: any) => n.title).sort()
      expect(reachableTitles).toEqual(['Node 2', 'Node 3', 'Node 4', 'Node 5'])

      // Verify traversal order (BFS should visit all depth-1 nodes before depth-2)
      const visitOrder = bfsResult.map((n: any) => n.title)
      const depth1Nodes = ['Node 2', 'Node 4']
      const depth2Nodes = ['Node 3', 'Node 5']

      const lastDepth1Index = Math.max(visitOrder.indexOf('Node 2'), visitOrder.indexOf('Node 4'))
      const firstDepth2Index = Math.min(visitOrder.indexOf('Node 3'), visitOrder.indexOf('Node 5'))

      expect(lastDepth1Index).toBeLessThan(firstDepth2Index)
    })

    test('should perform depth-first traversal', async () => {
      // Traverse from node 1 with DFS
      const dfsResult = await nodeRepository.getConnectedNodes(
        nodeIds[0], // Node 1
        {
          depth: 3,
          direction: 'OUTGOING',
          algorithm: 'DFS',
        }
      )

      // Should reach all nodes except node 1 itself
      expect(dfsResult).toHaveLength(5)
      const reachableTitles = dfsResult.map((n: any) => n.title).sort()
      expect(reachableTitles).toEqual(['Node 2', 'Node 3', 'Node 4', 'Node 5', 'Node 6'])
    })

    test('should respect relationship type filters', async () => {
      // Add different relationship types
      await testDbFactory.createTestRelation(nodeIds[0], nodeIds[2], 'shortcut', tableId)
      await testDbFactory.createTestRelation(nodeIds[1], nodeIds[5], 'special', tableId)

      // Traverse with specific relationship type filter
      const filteredResult = await nodeRepository.getConnectedNodes(
        nodeIds[0], // Node 1
        {
          depth: 2,
          direction: 'OUTGOING',
          relationTypes: ['connects'], // Only 'connects' relations
        }
      )

      // Should not include direct path to node 3 via 'shortcut'
      const titles = filteredResult.map((n: any) => n.title)
      expect(titles).not.toContain('Node 3') // Node 3 only reachable via 'shortcut' at depth 1
    })
  })

  describe('Shortest Path Algorithms', () => {
    let tableId: string
    const nodeIds: string[] = []

    beforeEach(async () => {
      const table = await testDbFactory.createTestTable('shortest-path-table')
      tableId = table.id

      // Create nodes for path finding tests
      for (let i = 1; i <= 7; i++) {
        const node = await testDbFactory.createTestNode(tableId, {
          title: `PathNode ${i}`,
          content: `Content for path node ${i}`,
        })
        nodeIds.push(node.id)
      }

      // Create graph with multiple paths
      // 1 -> 2 -> 3 -> 7
      // |         |
      // v         v
      // 4 -> 5 -> 6 -> 7
      const relations = [
        { from: 0, to: 1, type: 'path', weight: 1 }, // 1 -> 2
        { from: 1, to: 2, type: 'path', weight: 1 }, // 2 -> 3
        { from: 2, to: 6, type: 'path', weight: 1 }, // 3 -> 7
        { from: 0, to: 3, type: 'path', weight: 2 }, // 1 -> 4 (heavier)
        { from: 3, to: 4, type: 'path', weight: 1 }, // 4 -> 5
        { from: 4, to: 5, type: 'path', weight: 1 }, // 5 -> 6
        { from: 5, to: 6, type: 'path', weight: 1 }, // 6 -> 7
        { from: 2, to: 5, type: 'shortcut', weight: 2 }, // 3 -> 6 (alternative)
      ]

      for (const rel of relations) {
        await testDbFactory.createTestRelation(
          nodeIds[rel.from],
          nodeIds[rel.to],
          rel.type,
          tableId,
          { weight: rel.weight }
        )
      }
    })

    test('should find shortest path between two nodes', async () => {
      const shortestPath = await nodeRepository.findShortestPath(
        nodeIds[0], // PathNode 1
        nodeIds[6], // PathNode 7
        { maxDepth: 10 }
      )

      expect(shortestPath.found).toBe(true)
      expect(shortestPath.distance).toBe(3) // 1 -> 2 -> 3 -> 7
      expect(shortestPath.path).toHaveLength(4)

      const pathTitles = shortestPath.path.map((n: any) => n.title)
      expect(pathTitles).toEqual(['PathNode 1', 'PathNode 2', 'PathNode 3', 'PathNode 7'])
    })

    test('should handle no path scenarios', async () => {
      // Create isolated node
      const isolatedNode = await testDbFactory.createTestNode(tableId, {
        title: 'Isolated Node',
        content: 'This node has no connections',
      })

      const noPath = await nodeRepository.findShortestPath(
        nodeIds[0], // PathNode 1
        isolatedNode.id, // Isolated node
        { maxDepth: 10 }
      )

      expect(noPath.found).toBe(false)
      expect(noPath.path).toEqual([])
      expect(noPath.distance).toBe(-1)
    })

    test('should respect maximum depth limits', async () => {
      const limitedPath = await nodeRepository.findShortestPath(
        nodeIds[0], // PathNode 1
        nodeIds[6], // PathNode 7
        { maxDepth: 2 } // Too shallow to reach
      )

      expect(limitedPath.found).toBe(false)
      expect(limitedPath.path).toEqual([])
    })

    test('should find weighted shortest paths', async () => {
      // Test with weights (if implemented)
      const weightedPath = await nodeRepository.findShortestPath(
        nodeIds[0], // PathNode 1
        nodeIds[6], // PathNode 7
        {
          maxDepth: 10,
          considerWeights: true,
        }
      )

      expect(weightedPath.found).toBe(true)
      // With weights: 1->2->3->7 (cost: 3) vs 1->4->5->6->7 (cost: 5)
      expect(weightedPath.totalWeight).toBe(3)
    })

    test('should find multiple paths and compare them', async () => {
      const allPaths = await nodeRepository.findAllPaths(
        nodeIds[0], // PathNode 1
        nodeIds[6], // PathNode 7
        {
          maxDepth: 5,
          maxPaths: 10,
        }
      )

      expect(allPaths.paths.length).toBeGreaterThan(1)

      // Should find at least these paths:
      // 1. 1 -> 2 -> 3 -> 7
      // 2. 1 -> 4 -> 5 -> 6 -> 7
      const pathLengths = allPaths.paths.map((p: any) => p.path.length)
      expect(pathLengths).toContain(4) // First path
      expect(pathLengths).toContain(5) // Second path
    })
  })

  describe('Complex Graph Structures', () => {
    let tableId: string
    const nodeIds: string[] = []

    beforeEach(async () => {
      const table = await testDbFactory.createTestTable('complex-graph-table')
      tableId = table.id

      // Create larger, more complex graph
      for (let i = 1; i <= 15; i++) {
        const node = await testDbFactory.createTestNode(tableId, {
          title: `ComplexNode ${i}`,
          content: `Content for complex node ${i}`,
          metadata: {
            cluster: Math.floor((i - 1) / 5) + 1, // 3 clusters of 5 nodes each
            importance: Math.random(),
          },
        })
        nodeIds.push(node.id)
      }

      // Create complex relationship structure
      const relations = []

      // Intra-cluster connections (dense within clusters)
      for (let cluster = 0; cluster < 3; cluster++) {
        const start = cluster * 5
        for (let i = start; i < start + 5; i++) {
          for (let j = i + 1; j < start + 5; j++) {
            relations.push({
              from: i,
              to: j,
              type: 'intra_cluster',
              weight: Math.random(),
            })
          }
        }
      }

      // Inter-cluster connections (sparse between clusters)
      relations.push({ from: 2, to: 7, type: 'inter_cluster', weight: 2 }) // Cluster 1 to 2
      relations.push({ from: 4, to: 10, type: 'inter_cluster', weight: 3 }) // Cluster 1 to 3
      relations.push({ from: 8, to: 12, type: 'inter_cluster', weight: 2 }) // Cluster 2 to 3

      // Random additional connections
      for (let i = 0; i < 20; i++) {
        const from = Math.floor(Math.random() * 15)
        const to = Math.floor(Math.random() * 15)
        if (from !== to) {
          relations.push({
            from,
            to,
            type: 'random',
            weight: Math.random() * 3,
          })
        }
      }

      for (const rel of relations) {
        await testDbFactory.createTestRelation(
          nodeIds[rel.from],
          nodeIds[rel.to],
          rel.type,
          tableId,
          { weight: rel.weight }
        )
      }
    })

    test('should detect connected components', async () => {
      const components = await nodeRepository.findConnectedComponents(tableId)

      expect(components.componentCount).toBeGreaterThanOrEqual(1)
      expect(components.components).toBeDefined()

      // All nodes should be assigned to components
      const totalNodes = components.components.reduce(
        (sum: number, comp: any) => sum + comp.nodes.length,
        0
      )
      expect(totalNodes).toBe(15)

      // Largest component should contain most nodes (due to inter-cluster connections)
      const largestComponent = components.components.reduce((largest: any, current: any) =>
        current.nodes.length > largest.nodes.length ? current : largest
      )
      expect(largestComponent.nodes.length).toBeGreaterThanOrEqual(10)
    })

    test('should calculate graph centrality measures', async () => {
      const centralityMeasures = await nodeRepository.calculateCentrality(tableId, {
        measures: ['degree', 'betweenness', 'closeness', 'pagerank'],
      })

      expect(centralityMeasures.nodes).toHaveLength(15)

      centralityMeasures.nodes.forEach((node: any) => {
        expect(node.centrality.degree).toBeGreaterThanOrEqual(0)
        expect(node.centrality.betweenness).toBeGreaterThanOrEqual(0)
        expect(node.centrality.closeness).toBeGreaterThanOrEqual(0)
        expect(node.centrality.pagerank).toBeGreaterThanOrEqual(0)
      })

      // Nodes with higher degree should generally have higher centrality
      const sortedByDegree = centralityMeasures.nodes.sort(
        (a: any, b: any) => b.centrality.degree - a.centrality.degree
      )
      const highestDegreeNode = sortedByDegree[0]
      const lowestDegreeNode = sortedByDegree[sortedByDegree.length - 1]

      expect(highestDegreeNode.centrality.pagerank).toBeGreaterThanOrEqual(
        lowestDegreeNode.centrality.pagerank
      )
    })

    test('should perform community detection', async () => {
      const communities = await nodeRepository.detectCommunities(tableId, {
        algorithm: 'modularity',
        resolution: 1.0,
      })

      expect(communities.communities).toBeDefined()
      expect(communities.communities.length).toBeGreaterThanOrEqual(2)
      expect(communities.modularity).toBeGreaterThan(0)

      // Communities should roughly correspond to our clusters
      const communitySizes = communities.communities.map((c: any) => c.nodes.length)
      expect(Math.max(...communitySizes)).toBeGreaterThanOrEqual(4) // Should find cluster-like communities
    })

    test('should find graph diameter and radius', async () => {
      const graphMetrics = await nodeRepository.calculateGraphMetrics(tableId)

      expect(graphMetrics.diameter).toBeGreaterThan(0)
      expect(graphMetrics.radius).toBeGreaterThan(0)
      expect(graphMetrics.radius).toBeLessThanOrEqual(graphMetrics.diameter)
      expect(graphMetrics.averagePathLength).toBeGreaterThan(0)
      expect(graphMetrics.clusteringCoefficient).toBeGreaterThanOrEqual(0)
      expect(graphMetrics.clusteringCoefficient).toBeLessThanOrEqual(1)
    })
  })

  describe('Cycle Detection and Analysis', () => {
    let tableId: string
    const nodeIds: string[] = []

    beforeEach(async () => {
      const table = await testDbFactory.createTestTable('cycle-detection-table')
      tableId = table.id

      // Create nodes for cycle detection
      for (let i = 1; i <= 8; i++) {
        const node = await testDbFactory.createTestNode(tableId, {
          title: `CycleNode ${i}`,
          content: `Content for cycle node ${i}`,
        })
        nodeIds.push(node.id)
      }

      // Create graph with multiple cycles
      const relations = [
        // Triangle cycle: 1 -> 2 -> 3 -> 1
        { from: 0, to: 1, type: 'cycle' }, // 1 -> 2
        { from: 1, to: 2, type: 'cycle' }, // 2 -> 3
        { from: 2, to: 0, type: 'cycle' }, // 3 -> 1

        // Square cycle: 4 -> 5 -> 6 -> 7 -> 4
        { from: 3, to: 4, type: 'cycle' }, // 4 -> 5
        { from: 4, to: 5, type: 'cycle' }, // 5 -> 6
        { from: 5, to: 6, type: 'cycle' }, // 6 -> 7
        { from: 6, to: 3, type: 'cycle' }, // 7 -> 4

        // Connection between cycles
        { from: 1, to: 4, type: 'bridge' }, // 2 -> 5

        // Self-loop
        { from: 7, to: 7, type: 'self' }, // 8 -> 8
      ]

      for (const rel of relations) {
        await testDbFactory.createTestRelation(
          nodeIds[rel.from],
          nodeIds[rel.to],
          rel.type,
          tableId
        )
      }
    })

    test('should detect simple cycles', async () => {
      const cycles = await nodeRepository.detectCycles(tableId)

      expect(cycles.hasCycles).toBe(true)
      expect(cycles.cycles.length).toBeGreaterThanOrEqual(2)

      // Should find triangle cycle
      const triangleCycle = cycles.cycles.find((cycle: any) => cycle.length === 3)
      expect(triangleCycle).toBeDefined()

      // Should find square cycle
      const squareCycle = cycles.cycles.find((cycle: any) => cycle.length === 4)
      expect(squareCycle).toBeDefined()

      // Should detect self-loop
      const selfLoop = cycles.cycles.find((cycle: any) => cycle.length === 1)
      expect(selfLoop).toBeDefined()
    })

    test('should identify strongly connected components', async () => {
      const scc = await nodeRepository.findStronglyConnectedComponents(tableId)

      expect(scc.components.length).toBeGreaterThanOrEqual(2)

      // Triangle nodes should be in same SCC
      const triangleNodes = [nodeIds[0], nodeIds[1], nodeIds[2]]
      const triangleSCC = scc.components.find((comp: any) =>
        triangleNodes.every((nodeId) => comp.nodes.includes(nodeId))
      )
      expect(triangleSCC).toBeDefined()

      // Square nodes should be in same SCC
      const squareNodes = [nodeIds[3], nodeIds[4], nodeIds[5], nodeIds[6]]
      const squareSCC = scc.components.find((comp: any) =>
        squareNodes.every((nodeId) => comp.nodes.includes(nodeId))
      )
      expect(squareSCC).toBeDefined()
    })

    test('should check graph acyclicity', async () => {
      // Current graph has cycles
      const isAcyclic = await nodeRepository.isAcyclic(tableId)
      expect(isAcyclic).toBe(false)

      // Create new acyclic graph
      const acyclicTable = await testDbFactory.createTestTable('acyclic-table')
      const acyclicNodes = []

      for (let i = 1; i <= 5; i++) {
        const node = await testDbFactory.createTestNode(acyclicTable.id, {
          title: `AcyclicNode ${i}`,
          content: `Content ${i}`,
        })
        acyclicNodes.push(node.id)
      }

      // Create DAG: 1 -> 2 -> 4, 1 -> 3 -> 4, 2 -> 5
      await testDbFactory.createTestRelation(
        acyclicNodes[0],
        acyclicNodes[1],
        'dag',
        acyclicTable.id
      )
      await testDbFactory.createTestRelation(
        acyclicNodes[1],
        acyclicNodes[3],
        'dag',
        acyclicTable.id
      )
      await testDbFactory.createTestRelation(
        acyclicNodes[0],
        acyclicNodes[2],
        'dag',
        acyclicTable.id
      )
      await testDbFactory.createTestRelation(
        acyclicNodes[2],
        acyclicNodes[3],
        'dag',
        acyclicTable.id
      )
      await testDbFactory.createTestRelation(
        acyclicNodes[1],
        acyclicNodes[4],
        'dag',
        acyclicTable.id
      )

      const acyclicCheck = await nodeRepository.isAcyclic(acyclicTable.id)
      expect(acyclicCheck).toBe(true)
    })

    test('should perform topological sorting on DAG', async () => {
      // Create DAG for topological sorting
      const dagTable = await testDbFactory.createTestTable('dag-table')
      const dagNodes = []

      for (let i = 1; i <= 6; i++) {
        const node = await testDbFactory.createTestNode(dagTable.id, {
          title: `DAGNode ${i}`,
          content: `DAG Content ${i}`,
        })
        dagNodes.push(node.id)
      }

      // Create dependencies: 1 -> 2, 1 -> 3, 2 -> 4, 3 -> 4, 4 -> 5, 3 -> 6
      const dagRelations = [
        { from: 0, to: 1 }, // 1 -> 2
        { from: 0, to: 2 }, // 1 -> 3
        { from: 1, to: 3 }, // 2 -> 4
        { from: 2, to: 3 }, // 3 -> 4
        { from: 3, to: 4 }, // 4 -> 5
        { from: 2, to: 5 }, // 3 -> 6
      ]

      for (const rel of dagRelations) {
        await testDbFactory.createTestRelation(
          dagNodes[rel.from],
          dagNodes[rel.to],
          'dependency',
          dagTable.id
        )
      }

      const topologicalOrder = await nodeRepository.topologicalSort(dagTable.id)

      expect(topologicalOrder.success).toBe(true)
      expect(topologicalOrder.sortedNodes).toHaveLength(6)

      // Verify topological ordering
      const nodePositions = new Map()
      topologicalOrder.sortedNodes.forEach((nodeId: string, index: number) => {
        nodePositions.set(nodeId, index)
      })

      // Check that dependencies come before dependents
      for (const rel of dagRelations) {
        const fromPos = nodePositions.get(dagNodes[rel.from])
        const toPos = nodePositions.get(dagNodes[rel.to])
        expect(fromPos).toBeLessThan(toPos)
      }
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large graph traversal efficiently', async () => {
      // Create large graph
      const largeTable = await testDbFactory.createTestTable('large-graph-table')
      const largeNodeIds = []

      console.log('Creating large graph with 1000 nodes...')

      // Create 1000 nodes
      for (let i = 1; i <= 1000; i++) {
        const node = await testDbFactory.createTestNode(largeTable.id, {
          title: `LargeNode ${i}`,
          content: `Content for large node ${i}`,
          metadata: { batch: Math.floor((i - 1) / 100) },
        })
        largeNodeIds.push(node.id)
      }

      // Create scale-free network (power-law degree distribution)
      const relations = []
      for (let i = 0; i < largeNodeIds.length; i++) {
        // Each node connects to a few others based on preferential attachment
        const numConnections = Math.floor(Math.random() * 5) + 1
        for (let j = 0; j < numConnections; j++) {
          const target = Math.floor(Math.random() * largeNodeIds.length)
          if (target !== i) {
            relations.push({ from: i, to: target })
          }
        }
      }

      console.log(`Creating ${relations.length} relationships...`)

      // Create relationships in batches
      const batchSize = 100
      for (let i = 0; i < relations.length; i += batchSize) {
        const batch = relations.slice(i, i + batchSize)
        await Promise.all(
          batch.map((rel) =>
            testDbFactory.createTestRelation(
              largeNodeIds[rel.from],
              largeNodeIds[rel.to],
              'large_graph',
              largeTable.id
            )
          )
        )
      }

      console.log('Testing traversal performance...')

      // Test traversal performance
      const startTime = Date.now()
      const connectedNodes = await nodeRepository.getConnectedNodes(largeNodeIds[0], {
        depth: 3,
        direction: 'BOTH',
      })
      const traversalTime = Date.now() - startTime

      expect(connectedNodes).toBeDefined()
      expect(traversalTime).toBeLessThan(10000) // Should complete within 10 seconds

      console.log(
        `Traversal completed in ${traversalTime}ms, found ${connectedNodes.length} connected nodes`
      )

      // Test shortest path performance
      const pathStartTime = Date.now()
      const shortestPath = await nodeRepository.findShortestPath(
        largeNodeIds[0],
        largeNodeIds[999],
        { maxDepth: 10 }
      )
      const pathTime = Date.now() - pathStartTime

      expect(pathTime).toBeLessThan(15000) // Should complete within 15 seconds
      console.log(`Shortest path search completed in ${pathTime}ms`)

      if (shortestPath.found) {
        expect(shortestPath.path.length).toBeGreaterThan(0)
        expect(shortestPath.distance).toBeGreaterThan(0)
      }
    }, 60000) // 60 second timeout for large graph test

    test('should optimize memory usage during traversal', async () => {
      const table = await testDbFactory.createTestTable('memory-test-table')
      const nodeIds = []

      // Create moderate-sized graph for memory testing
      for (let i = 1; i <= 500; i++) {
        const node = await testDbFactory.createTestNode(table.id, {
          title: `MemNode ${i}`,
          content: `Memory test node ${i}`,
        })
        nodeIds.push(node.id)
      }

      // Create dense connections
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = 0; j < 5; j++) {
          const target = Math.floor(Math.random() * nodeIds.length)
          if (target !== i) {
            await testDbFactory.createTestRelation(
              nodeIds[i],
              nodeIds[target],
              'memory_test',
              table.id
            )
          }
        }
      }

      // Monitor memory usage during traversal
      const initialMemory = process.memoryUsage().heapUsed

      const result = await nodeRepository.getConnectedNodes(nodeIds[0], {
        depth: 5,
        direction: 'BOTH',
      })

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      expect(result).toBeDefined()
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase

      console.log(`Memory increase during traversal: ${Math.round(memoryIncrease / 1024 / 1024)}MB`)
    })
  })
})
