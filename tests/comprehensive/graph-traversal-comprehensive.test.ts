/**
 * Comprehensive Graph Traversal Test Suite
 *
 * Purpose: Validate the currently supported graph traversal surface through GraphQL.
 * Coverage: connected nodes, depth-limited traversal, relation filtering, shortest path,
 * path enumeration, dependency chains, and a lightweight large-graph smoke test.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createContainer } from '../../src/infrastructure/container/ContainerBootstrap'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { DatabaseCleaner } from '../fixtures/database-cleaner'
import { createGraphQLExecutor, createGraphQLYoga } from '../fixtures/graphql-yoga-helper'
import { createTestEnvironment, type TestEnvironment } from '../fixtures/test-database-factory'

describe('Comprehensive Graph Traversal Test Suite', () => {
  let yoga: any
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let databaseCleaner: DatabaseCleaner
  let graphqlExecute: (query: string, variables?: any) => Promise<any>

  beforeAll(async () => {
    testEnvironment = await createTestEnvironment('graph-traversal', 'traversal')
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await createContainer()
    yoga = await createGraphQLYoga(container)
    graphqlExecute = createGraphQLExecutor(yoga)
    databaseCleaner = new DatabaseCleaner(container)
  })

  beforeEach(async () => {
    await databaseCleaner.clearAllData()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  async function createTable(identifier: string) {
    const result = await graphqlExecute(`
      mutation {
        createTable(input: {
          identifier: "${identifier}"
          description: "Graph Traversal Test Table"
        }) {
          table { id identifier }
        }
      }
    `)

    expect(result.errors).toBeUndefined()
    return result.data.createTable.table
  }

  async function createNode(tableId: string, content: string) {
    const result = await graphqlExecute(`
      mutation {
        createNode(input: {
          tableId: "${tableId}"
          content: "${content}"
        }) {
          node { id content }
        }
      }
    `)

    expect(result.errors).toBeUndefined()
    return result.data.createNode.node
  }

  async function createRelation(tableId: string, fromNodeId: string, toNodeId: string, relationshipType: string) {
    const result = await graphqlExecute(`
      mutation {
        createRelation(input: {
          tableId: "${tableId}"
          fromNodeId: "${fromNodeId}"
          toNodeId: "${toNodeId}"
          relationshipType: "${relationshipType}"
        }) {
          relation { id relationshipType }
        }
      }
    `)

    expect(result.errors).toBeUndefined()
    return result.data.createRelation.relation
  }

  async function getRelationTypeId(identifier: string) {
    const byIdentifierResult = await graphqlExecute(`
      query {
        relationTypeByIdentifier(identifier: "${identifier}") {
          id
          identifier
        }
      }
    `)

    expect(byIdentifierResult.errors).toBeUndefined()
    if (byIdentifierResult.data.relationTypeByIdentifier?.id) {
      return byIdentifierResult.data.relationTypeByIdentifier.id
    }

    const listResult = await graphqlExecute(`
      query {
        relationTypes {
          id
          identifier
        }
      }
    `)

    expect(listResult.errors).toBeUndefined()
    return listResult.data.relationTypes.find((relationType: any) => relationType.identifier === identifier)?.id || null
  }

  async function setupBasicGraph(identifier: string) {
    const table = await createTable(identifier)
    const nodeIds: string[] = []

    for (let i = 1; i <= 6; i++) {
      const node = await createNode(table.id, `Content for node ${i}`)
      nodeIds.push(node.id)
    }

    const relations = [
      { from: 0, to: 1, type: 'connects' },
      { from: 1, to: 2, type: 'connects' },
      { from: 0, to: 3, type: 'connects' },
      { from: 1, to: 4, type: 'connects' },
      { from: 2, to: 5, type: 'connects' },
      { from: 3, to: 4, type: 'connects' },
      { from: 4, to: 5, type: 'connects' },
    ]

    for (const rel of relations) {
      await createRelation(table.id, nodeIds[rel.from], nodeIds[rel.to], rel.type)
    }

    return { tableId: table.id, nodeIds }
  }

  describe('Connected Nodes', () => {
    test('should find direct neighbors correctly', async () => {
      const { nodeIds } = await setupBasicGraph('traversal-test-table')

      const outgoingQuery = await graphqlExecute(`
        query {
          getConnectedNodes(input: {
            nodeId: "${nodeIds[0]}"
            depth: 1
            direction: OUTGOING
          }) {
            nodes {
              id
              content
            }
          }
        }
      `)

      expect(outgoingQuery.errors).toBeUndefined()
      expect(outgoingQuery.data.getConnectedNodes.nodes).toHaveLength(2)
      const outgoingContents = outgoingQuery.data.getConnectedNodes.nodes.map((n: any) => n.content).sort()
      expect(outgoingContents).toEqual(['Content for node 2', 'Content for node 4'])

      const incomingQuery = await graphqlExecute(`
        query {
          getConnectedNodes(input: {
            nodeId: "${nodeIds[4]}"
            depth: 1
            direction: INCOMING
          }) {
            nodes {
              id
              content
            }
          }
        }
      `)

      expect(incomingQuery.errors).toBeUndefined()
      expect(incomingQuery.data.getConnectedNodes.nodes).toHaveLength(2)
      const incomingContents = incomingQuery.data.getConnectedNodes.nodes.map((n: any) => n.content).sort()
      expect(incomingContents).toEqual(['Content for node 2', 'Content for node 4'])
    })

    test('should perform depth-limited traversal', async () => {
      const { nodeIds } = await setupBasicGraph('traversal-depth-table')

      const result = await graphqlExecute(`
        query {
          getConnectedNodes(input: {
            nodeId: "${nodeIds[0]}"
            depth: 2
            direction: OUTGOING
          }) {
            nodes {
              id
              content
              distance
            }
          }
        }
      `)

      expect(result.errors).toBeUndefined()
      expect(result.data.getConnectedNodes.nodes).toHaveLength(4)

      const contents = result.data.getConnectedNodes.nodes.map((n: any) => n.content).sort()
      expect(contents).toEqual([
        'Content for node 2',
        'Content for node 3',
        'Content for node 4',
        'Content for node 5',
      ])

      const depthOne = result.data.getConnectedNodes.nodes
        .filter((node: any) => node.distance === 1)
        .map((node: any) => node.content)
        .sort()
      const depthTwo = result.data.getConnectedNodes.nodes
        .filter((node: any) => node.distance === 2)
        .map((node: any) => node.content)
        .sort()

      expect(depthOne).toEqual(['Content for node 2', 'Content for node 4'])
      expect(depthTwo).toEqual(['Content for node 3', 'Content for node 5'])
    })

    test('should respect relation type filters', async () => {
      const { tableId, nodeIds } = await setupBasicGraph('traversal-filter-table')

      await createRelation(tableId, nodeIds[0], nodeIds[2], 'shortcut')
      const connectsTypeId = await getRelationTypeId('connects')
      expect(connectsTypeId).toBeTruthy()

      const filtered = await graphqlExecute(`
        query {
          getConnectedNodes(input: {
            nodeId: "${nodeIds[0]}"
            depth: 1
            direction: OUTGOING
            relationTypeIds: ["${connectsTypeId}"]
          }) {
            nodes {
              content
            }
          }
        }
      `)

      expect(filtered.errors).toBeUndefined()
      const contents = filtered.data.getConnectedNodes.nodes.map((node: any) => node.content).sort()
      expect(contents).toEqual(['Content for node 2', 'Content for node 4'])
    })
  })

  describe('Shortest Path', () => {
    test('should find the shortest path between two nodes', async () => {
      const table = await createTable('shortest-path-table')
      const nodes: string[] = []

      for (let i = 1; i <= 7; i++) {
        const node = await createNode(table.id, `PathNode ${i}`)
        nodes.push(node.id)
      }

      const relations = [
        { from: 0, to: 1, type: 'path' },
        { from: 1, to: 2, type: 'path' },
        { from: 2, to: 6, type: 'path' },
        { from: 0, to: 3, type: 'path' },
        { from: 3, to: 4, type: 'path' },
        { from: 4, to: 5, type: 'path' },
        { from: 5, to: 6, type: 'path' },
      ]

      for (const relation of relations) {
        await createRelation(table.id, nodes[relation.from], nodes[relation.to], relation.type)
      }

      const result = await graphqlExecute(`
        query {
          node(id: "${nodes[0]}") {
            shortestPath(targetNodeId: "${nodes[6]}", maxDepth: 10) {
              id
              content
            }
          }
        }
      `)

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toHaveLength(4)
      const contents = result.data.node.shortestPath.map((node: any) => node.content)
      expect(contents).toEqual(['PathNode 1', 'PathNode 2', 'PathNode 3', 'PathNode 7'])
    })

    test('should return no path when nodes are disconnected or depth is too shallow', async () => {
      const table = await createTable('shortest-path-none-table')
      const source = await createNode(table.id, 'Source Node')
      const middle = await createNode(table.id, 'Middle Node')
      const target = await createNode(table.id, 'Target Node')
      const isolated = await createNode(table.id, 'Isolated Node')

      await createRelation(table.id, source.id, middle.id, 'path')
      await createRelation(table.id, middle.id, target.id, 'path')

      const noPathResult = await graphqlExecute(`
        query {
          node(id: "${source.id}") {
            shortestPath(targetNodeId: "${isolated.id}") {
              id
            }
          }
        }
      `)

      expect(noPathResult.errors).toBeUndefined()
      expect(noPathResult.data.node.shortestPath).toEqual([])

      const shallowResult = await graphqlExecute(`
        query {
          node(id: "${source.id}") {
            shortestPath(targetNodeId: "${target.id}", maxDepth: 1) {
              id
            }
          }
        }
      `)

      expect(shallowResult.errors).toBeUndefined()
      expect(shallowResult.data.node.shortestPath).toEqual([])
    })
  })

  describe('Path and Dependency Queries', () => {
    test('should find multiple paths between two nodes', async () => {
      const table = await createTable('paths-table')
      const source = await createNode(table.id, 'Source')
      const a = await createNode(table.id, 'A')
      const b = await createNode(table.id, 'B')
      const c = await createNode(table.id, 'C')
      const target = await createNode(table.id, 'Target')

      await createRelation(table.id, source.id, a.id, 'path')
      await createRelation(table.id, a.id, target.id, 'path')
      await createRelation(table.id, source.id, b.id, 'path')
      await createRelation(table.id, b.id, c.id, 'path')
      await createRelation(table.id, c.id, target.id, 'path')

      const result = await graphqlExecute(`
        query {
          findPathsBetweenNodes(input: {
            sourceNodeId: "${source.id}"
            targetNodeId: "${target.id}"
            maxDepth: 4
          }) {
            length
            nodes { id }
            relations { id }
          }
        }
      `)

      expect(result.errors).toBeUndefined()
      expect(result.data.findPathsBetweenNodes.length).toBeGreaterThanOrEqual(2)
      const lengths = result.data.findPathsBetweenNodes.map((path: any) => path.length).sort()
      expect(lengths[0]).toBe(2)
      expect(lengths[lengths.length - 1]).toBeGreaterThanOrEqual(3)
    })

    test('should build dependency chains in the requested direction', async () => {
      const table = await createTable('dependency-chain-table')
      const n1 = await createNode(table.id, 'Node 1')
      const n2 = await createNode(table.id, 'Node 2')
      const n3 = await createNode(table.id, 'Node 3')
      const n4 = await createNode(table.id, 'Node 4')

      await createRelation(table.id, n1.id, n2.id, 'depends_on')
      await createRelation(table.id, n2.id, n3.id, 'depends_on')
      await createRelation(table.id, n3.id, n4.id, 'depends_on')

      const outgoing = await graphqlExecute(`
        query {
          getDependencyChain(input: {
            nodeId: "${n1.id}"
            direction: OUTGOING
            maxDepth: 3
          }) {
            nodes { id }
            totalCount
          }
        }
      `)

      expect(outgoing.errors).toBeUndefined()
      expect(outgoing.data.getDependencyChain.totalCount).toBeGreaterThanOrEqual(3)

      const incoming = await graphqlExecute(`
        query {
          getDependencyChain(input: {
            nodeId: "${n4.id}"
            direction: INCOMING
            maxDepth: 3
          }) {
            nodes { id }
            totalCount
          }
        }
      `)

      expect(incoming.errors).toBeUndefined()
      expect(incoming.data.getDependencyChain.totalCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Performance Smoke', () => {
    test('should handle a moderately large traversal efficiently', async () => {
      const table = await createTable('large-graph-table')
      const nodeIds: string[] = []

      for (let i = 1; i <= 200; i++) {
        const node = await createNode(table.id, `LargeNode ${i}`)
        nodeIds.push(node.id)
      }

      for (let i = 0; i < nodeIds.length - 1; i++) {
        await createRelation(table.id, nodeIds[i], nodeIds[i + 1], 'chain')
        if (i + 5 < nodeIds.length) {
          await createRelation(table.id, nodeIds[i], nodeIds[i + 5], 'skip')
        }
      }

      const traversalStartedAt = Date.now()
      const traversal = await graphqlExecute(`
        query {
          getConnectedNodes(input: {
            nodeId: "${nodeIds[0]}"
            depth: 4
            direction: OUTGOING
          }) {
            nodes { id }
            totalCount
          }
        }
      `)
      const traversalDuration = Date.now() - traversalStartedAt

      expect(traversal.errors).toBeUndefined()
      expect(traversal.data.getConnectedNodes.totalCount).toBeGreaterThan(0)
      expect(traversalDuration).toBeLessThan(5000)

      const pathStartedAt = Date.now()
      const shortestPath = await graphqlExecute(`
        query {
          node(id: "${nodeIds[0]}") {
            shortestPath(targetNodeId: "${nodeIds[50]}", maxDepth: 10) {
              id
            }
          }
        }
      `)
      const pathDuration = Date.now() - pathStartedAt

      expect(shortestPath.errors).toBeUndefined()
      expect(Array.isArray(shortestPath.data.node.shortestPath)).toBe(true)
      expect(pathDuration).toBeLessThan(5000)
    }, 30000)
  })
})
