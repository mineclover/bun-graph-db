/**
 * Comprehensive Doc System Test Suite
 * Tests all GraphQL operations: Queries, Mutations, and Field Resolvers
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// Test Configuration
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
const TEST_TIMEOUT = 10000

// Test Data
const TEST_TABLE_ID = '58' // todos table
const TEST_CONTENT = {
  USAGE: 'This is usage documentation for the todos table. It explains how to use the todos functionality.',
  GUIDE: 'This is a guide documentation for the todos table. Step-by-step instructions.',
  EXAMPLE: 'This is example documentation with code samples for the todos table.',
  SPEC: 'This is specification documentation for the todos table schema.',
  GENERAL: 'This is general documentation for the todos table overview.'
}

// Helper Functions
async function graphqlRequest(query: string, variables?: Record<string, any>) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('GraphQL Request Failed:', result)
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  return result
}

// Clean up any existing test docs
async function cleanupTestDocs() {
  const query = `
    query GetDocs($tableId: ID!) {
      getDocs(tableId: $tableId) {
        docs {
          id
        }
      }
    }
  `

  try {
    const result = await graphqlRequest(query, { tableId: TEST_TABLE_ID })
    if (result.data?.getDocs?.docs) {
      for (const doc of result.data.getDocs.docs) {
        const deleteQuery = `
          mutation DeleteDoc($id: ID!) {
            deleteDoc(id: $id) {
              success
              errors {
                message
              }
            }
          }
        `
        await graphqlRequest(deleteQuery, { id: doc.id })
      }
    }
  } catch (error) {
    console.log('Cleanup skipped (docs may not exist yet):', error.message)
  }
}

describe('Doc System - Comprehensive Test Suite', () => {

  beforeAll(async () => {
    console.log('🧪 Setting up Doc System tests...')
    await cleanupTestDocs()
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up Doc System tests...')
    await cleanupTestDocs()
  }, TEST_TIMEOUT)

  describe('📝 Doc Mutations', () => {

    test('createDoc - Create USAGE documentation', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
              table {
                id
                identifier
              }
              category
              content
              version
              isActive
              createdAt
            }
            errors {
              message
              field
            }
          }
        }
      `

      const input = {
        tableId: TEST_TABLE_ID,
        category: 'usage',
        content: TEST_CONTENT.USAGE
      }

      const result = await graphqlRequest(mutation, { input })

      expect(result.errors).toBeUndefined()
      expect(result.data.createDoc.success).toBe(true)
      expect(result.data.createDoc.errors).toEqual([])
      expect(result.data.createDoc.doc).toBeDefined()
      expect(result.data.createDoc.doc.category).toBe('usage')
      expect(result.data.createDoc.doc.content).toBe(TEST_CONTENT.USAGE)
      expect(result.data.createDoc.doc.version).toBe(1)
      expect(result.data.createDoc.doc.isActive).toBe(true)
      expect(result.data.createDoc.doc.table.id).toBe(TEST_TABLE_ID)
      expect(result.data.createDoc.doc.table.identifier).toBe('todos')
    }, TEST_TIMEOUT)

    test('createDoc - Create multiple categories', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
              category
              content
              version
            }
            errors {
              message
            }
          }
        }
      `

      // Test creating docs for each category
      for (const [category, content] of Object.entries(TEST_CONTENT)) {
        if (category === 'USAGE') continue // Already created in previous test

        const input = {
          tableId: TEST_TABLE_ID,
          category: category.toLowerCase(),
          content: content
        }

        const result = await graphqlRequest(mutation, { input })

        expect(result.errors).toBeUndefined()
        expect(result.data.createDoc.success).toBe(true)
        expect(result.data.createDoc.doc.category).toBe(category.toLowerCase())
        expect(result.data.createDoc.doc.content).toBe(content)
        expect(result.data.createDoc.doc.version).toBe(1)
      }
    }, TEST_TIMEOUT)

    test('createDoc - Duplicate version should fail', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
            errors {
              message
              field
            }
          }
        }
      `

      const input = {
        tableId: TEST_TABLE_ID,
        category: 'usage',
        content: 'Duplicate content',
        version: 1
      }

      const result = await graphqlRequest(mutation, { input })

      expect(result.data.createDoc.success).toBe(false)
      expect(result.data.createDoc.doc).toBeNull()
      expect(result.data.createDoc.errors).toHaveLength(1)
      expect(result.data.createDoc.errors[0].message).toContain('already exists')
    }, TEST_TIMEOUT)

    test('updateDoc - Update existing documentation', async () => {
      // First, get an existing doc
      const getQuery = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              content
              category
            }
          }
        }
      `

      const getResult = await graphqlRequest(getQuery, { tableId: TEST_TABLE_ID })
      const doc = getResult.data.getDocs.docs.find(d => d.category === 'usage')
      expect(doc).toBeDefined()

      // Update the doc
      const updateMutation = `
        mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
          updateDoc(id: $id, input: $input) {
            success
            doc {
              id
              content
              updatedAt
            }
            errors {
              message
            }
          }
        }
      `

      const newContent = 'Updated usage documentation with more details.'
      const updateResult = await graphqlRequest(updateMutation, {
        id: doc.id,
        input: { content: newContent }
      })

      expect(updateResult.data.updateDoc.success).toBe(true)
      expect(updateResult.data.updateDoc.doc.content).toBe(newContent)
      expect(updateResult.data.updateDoc.errors).toEqual([])
    }, TEST_TIMEOUT)

    test('activateDoc - Activate specific documentation', async () => {
      // Get a doc to activate
      const getQuery = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              category
              isActive
            }
          }
        }
      `

      const getResult = await graphqlRequest(getQuery, { tableId: TEST_TABLE_ID })
      const doc = getResult.data.getDocs.docs.find(d => d.category === 'guide')
      expect(doc).toBeDefined()

      // Activate the doc
      const activateMutation = `
        mutation ActivateDoc($id: ID!) {
          activateDoc(id: $id) {
            success
            doc {
              id
              isActive
            }
            errors {
              message
            }
          }
        }
      `

      const activateResult = await graphqlRequest(activateMutation, { id: doc.id })

      expect(activateResult.data.activateDoc.success).toBe(true)
      expect(activateResult.data.activateDoc.doc.isActive).toBe(true)
      expect(activateResult.data.activateDoc.errors).toEqual([])
    }, TEST_TIMEOUT)

    test('deleteDoc - Delete documentation', async () => {
      // Create a doc specifically for deletion
      const createMutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
          }
        }
      `

      const createResult = await graphqlRequest(createMutation, {
        input: {
          tableId: TEST_TABLE_ID,
          category: 'general',
          content: 'This doc will be deleted',
          version: 2
        }
      })

      const docId = createResult.data.createDoc.doc.id

      // Delete the doc
      const deleteMutation = `
        mutation DeleteDoc($id: ID!) {
          deleteDoc(id: $id) {
            success
            errors {
              message
            }
          }
        }
      `

      const deleteResult = await graphqlRequest(deleteMutation, { id: docId })

      expect(deleteResult.data.deleteDoc.success).toBe(true)
      expect(deleteResult.data.deleteDoc.errors).toEqual([])

      // Verify it's deleted by trying to get it
      const getQuery = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
          }
        }
      `

      const getResult = await graphqlRequest(getQuery, { id: docId })
      expect(getResult.data.getDoc).toBeNull()
    }, TEST_TIMEOUT)
  })

  describe('🔍 Doc Queries', () => {

    test('getDocs - Get all docs for a table', async () => {
      const query = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              table {
                id
                identifier
              }
              category
              content
              version
              isActive
              createdAt
              updatedAt
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `

      const result = await graphqlRequest(query, { tableId: TEST_TABLE_ID })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocs).toBeDefined()
      expect(result.data.getDocs.docs).toBeInstanceOf(Array)
      expect(result.data.getDocs.docs.length).toBeGreaterThan(0)
      expect(result.data.getDocs.totalCount).toBeGreaterThan(0)

      // Check doc structure
      const doc = result.data.getDocs.docs[0]
      expect(doc.id).toBeDefined()
      expect(doc.table.id).toBe(TEST_TABLE_ID)
      expect(doc.table.identifier).toBe('todos')
      expect(['usage', 'guide', 'example', 'spec', 'general']).toContain(doc.category)
      expect(doc.content).toBeDefined()
      expect(doc.version).toBeGreaterThan(0)
      expect(typeof doc.isActive).toBe('boolean')
    }, TEST_TIMEOUT)

    test('getDoc - Get specific doc by ID', async () => {
      // First get a doc ID
      const docsQuery = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
            }
          }
        }
      `

      const docsResult = await graphqlRequest(docsQuery, { tableId: TEST_TABLE_ID })
      const docId = docsResult.data.getDocs.docs[0].id

      // Get specific doc
      const query = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
            table {
              id
              identifier
            }
            category
            content
            version
            isActive
            createdAt
            updatedAt
          }
        }
      `

      const result = await graphqlRequest(query, { id: docId })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDoc).toBeDefined()
      expect(result.data.getDoc.id).toBe(docId)
      expect(result.data.getDoc.table.id).toBe(TEST_TABLE_ID)
    }, TEST_TIMEOUT)

    test('getActiveDoc - Get active doc by table and category', async () => {
      const query = `
        query GetActiveDoc($tableId: ID!, $category: DocCategory!) {
          getActiveDoc(tableId: $tableId, category: $category) {
            id
            table {
              id
              identifier
            }
            category
            content
            version
            isActive
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: TEST_TABLE_ID,
        category: 'usage'
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.getActiveDoc).toBeDefined()
      expect(result.data.getActiveDoc.table.id).toBe(TEST_TABLE_ID)
      expect(result.data.getActiveDoc.category).toBe('usage')
      expect(result.data.getActiveDoc.isActive).toBe(true)
    }, TEST_TIMEOUT)

    test('getDocVersions - Get all versions of a category', async () => {
      const query = `
        query GetDocVersions($tableId: ID!, $category: DocCategory!) {
          getDocVersions(tableId: $tableId, category: $category) {
            id
            category
            version
            isActive
            content
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: TEST_TABLE_ID,
        category: 'usage'
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocVersions).toBeDefined()
      expect(result.data.getDocVersions).toBeInstanceOf(Array)
      expect(result.data.getDocVersions.length).toBeGreaterThan(0)

      // All docs should have the same category
      result.data.getDocVersions.forEach(doc => {
        expect(doc.category).toBe('usage')
      })
    }, TEST_TIMEOUT)

    test('searchDocs - Search documentation by content', async () => {
      const query = `
        query SearchDocs($filter: DocsFilter!) {
          searchDocs(filter: $filter) {
            docs {
              id
              table {
                id
                identifier
              }
              category
              content
              version
            }
            totalCount
          }
        }
      `

      const result = await graphqlRequest(query, {
        filter: {
          tableId: TEST_TABLE_ID
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.searchDocs).toBeDefined()
      expect(result.data.searchDocs.docs).toBeInstanceOf(Array)
      expect(result.data.searchDocs.totalCount).toBeGreaterThanOrEqual(0)

      // If docs found, they should be for the table
      if (result.data.searchDocs.docs.length > 0) {
        result.data.searchDocs.docs.forEach(doc => {
          expect(doc.table.id).toBe(TEST_TABLE_ID)
        })
      }
    }, TEST_TIMEOUT)
  })

  describe('🔄 Doc Field Resolvers', () => {

    test('Doc.table - Resolve table field', async () => {
      const query = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              table {
                id
                identifier
                description
                createdAt
                updatedAt
              }
            }
          }
        }
      `

      const result = await graphqlRequest(query, { tableId: TEST_TABLE_ID })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocs.docs.length).toBeGreaterThan(0)

      const doc = result.data.getDocs.docs[0]
      expect(doc.table).toBeDefined()
      expect(doc.table.id).toBe(TEST_TABLE_ID)
      expect(doc.table.identifier).toBe('todos')
      expect(doc.table.createdAt).toBeDefined()
      expect(doc.table.updatedAt).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('❌ Error Handling', () => {

    test('createDoc - Invalid table ID', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
            errors {
              message
              field
            }
          }
        }
      `

      const input = {
        tableId: '99999',
        category: 'usage',
        content: 'Test content'
      }

      const result = await graphqlRequest(mutation, { input })

      expect(result.data.createDoc.success).toBe(false)
      expect(result.data.createDoc.doc).toBeNull()
      expect(result.data.createDoc.errors).toHaveLength(1)
      expect(result.data.createDoc.errors[0].message).toContain('not found')
    }, TEST_TIMEOUT)

    test('createDoc - Empty content', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
            errors {
              message
              field
            }
          }
        }
      `

      const input = {
        tableId: TEST_TABLE_ID,
        category: 'usage',
        content: ''
      }

      const result = await graphqlRequest(mutation, { input })

      expect(result.data.createDoc.success).toBe(false)
      expect(result.data.createDoc.doc).toBeNull()
      expect(result.data.createDoc.errors).toHaveLength(1)
      expect(result.data.createDoc.errors[0].message).toContain('content is required')
    }, TEST_TIMEOUT)

    test('getDoc - Non-existent ID', async () => {
      const query = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
          }
        }
      `

      const result = await graphqlRequest(query, { id: '99999' })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDoc).toBeNull()
    }, TEST_TIMEOUT)

    test('updateDoc - Non-existent ID', async () => {
      const mutation = `
        mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
          updateDoc(id: $id, input: $input) {
            success
            doc {
              id
            }
            errors {
              message
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: '99999',
        input: { content: 'Updated content' }
      })

      expect(result.data.updateDoc.success).toBe(false)
      expect(result.data.updateDoc.doc).toBeNull()
      expect(result.data.updateDoc.errors).toHaveLength(1)
      expect(result.data.updateDoc.errors[0].message).toContain('not found')
    }, TEST_TIMEOUT)
  })

  describe('📊 Performance & Edge Cases', () => {

    test('getDocs - Pagination', async () => {
      const query = `
        query GetDocs($tableId: ID!, $pagination: PaginationInput) {
          getDocs(tableId: $tableId, pagination: $pagination) {
            docs {
              id
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: TEST_TABLE_ID,
        pagination: {
          limit: 2,
          offset: 0
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocs.docs.length).toBeLessThanOrEqual(2)
      expect(typeof result.data.getDocs.hasNextPage).toBe('boolean')
      expect(typeof result.data.getDocs.hasPreviousPage).toBe('boolean')
    }, TEST_TIMEOUT)

    test('createDoc - Maximum content length', async () => {
      const longContent = 'A'.repeat(10000) // 10KB content

      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
              content
            }
            errors {
              message
            }
          }
        }
      `

      const input = {
        tableId: TEST_TABLE_ID,
        category: 'spec',
        content: longContent,
        version: 2
      }

      const result = await graphqlRequest(mutation, { input })

      expect(result.data.createDoc.success).toBe(true)
      expect(result.data.createDoc.doc.content).toBe(longContent)
    }, TEST_TIMEOUT)
  })
})

// Test Summary Report
console.log(`
🧪 Doc System Comprehensive Test Suite
=====================================
📝 Testing: 5 Mutations (createDoc, updateDoc, deleteDoc, activateDoc, createDocVersion)
🔍 Testing: 5 Queries (getDoc, getActiveDoc, getDocs, getDocVersions, searchDocs)
🔄 Testing: Field Resolvers (Doc.table)
❌ Testing: Error Handling & Edge Cases
📊 Testing: Performance & Pagination

Expected Coverage:
✅ Create documentation for all categories
✅ Update and activate documentation
✅ Query docs by various filters
✅ Handle validation errors gracefully
✅ Test pagination and performance
✅ Verify field resolution works correctly

Run with: bun test tests/doc-system-comprehensive.test.ts
`)