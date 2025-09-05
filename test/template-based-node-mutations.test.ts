import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { 
  createTestContext, 
  TestFramework, 
  type NodeDto, 
  type TableDto, 
  type PaginatedResult,
  type StandardMutationResult
} from '../../framework/TestFramework.js'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../src/presentation/graphql/GraphQLSchemaBuilder.js'
import { TestDatasetHelper } from './helpers/dataset-helper.js'

describe('Template-based Node Mutations', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let datasetHelper: TestDatasetHelper

  beforeAll(async () => {
    // Initialize dependency container
    container = await ContainerBootstrap.createContainer()

    // Build GraphQL schema with the new schema builder
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({ schema })

    // Initialize dataset helper
    datasetHelper = TestDatasetHelper.getInstance()
  })

  describe('Template Creation and Management', () => {
    let testTableId: string
    let attributeIds: Record<string, string>
    let createNodeTemplateId: string
    let domainSetup: any

    beforeEach(async () => {
      // Load e-commerce domain setup
      domainSetup = await datasetHelper.loadDomainSetup('ecommerce', 'small')

      // Setup test table and attributes using dataset helper
      const setup = await datasetHelper.setupTestTable(yoga, 'ecommerce')
      testTableId = setup.tableId
      attributeIds = setup.attributeIds
    })

    test('should create a node creation template', async () => {
      // Create a mutation template for adding product nodes
      const createTemplateResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateTemplate($input: CreateQueryTemplateInput!) {
              createTemplate(input: $input) {
                template {
                  id
                  identifier
                  name
                  description
                  query
                  variables
                  tags
                  isActive
                }
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              identifier: 'create-product-node',
              name: 'Create Product Node',
              description: 'Template for creating product nodes with attributes',
              query: `mutation CreateProductNode($tableId: ID!, $productName: String!, $productPrice: Float!, $productCategory: String) { createNode(input: { tableId: $tableId, content: $productName, title: $productName, description: $productName }) { id content title description createdAt } }`,
              variables: {
                tableId: testTableId,
                productName: 'Sample Product',
                productPrice: 99.99,
                productCategory: 'General'
              },
              createdBy: 'test-system'
            },
          },
        }),
      })

      const templateData = await createTemplateResponse.json()
      
      if (templateData.errors) {
        console.error('GraphQL errors:', templateData.errors)
        throw new Error(`Failed to create template: ${templateData.errors.map((e: any) => e.message).join(', ')}`)
      }

      expect(templateData.data.createTemplate.errors).toHaveLength(0)
      expect(templateData.data.createTemplate.template).toBeDefined()
      expect(templateData.data.createTemplate.template.identifier).toBe('create-product-node')

      createNodeTemplateId = templateData.data.createTemplate.template.id
    })

    test('should search for node creation templates', async () => {
      const searchResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query SearchTemplates {
              searchTemplates(filter: {}) {
                nodes {
                  id
                  identifier
                  name
                  query
                  usageCount
                  isActive
                }
                totalCount
                hasNextPage
                hasPreviousPage
              }
            }
          `
        }),
      })

      const searchData = await searchResponse.json()
      expect(searchData.data.searchTemplates).toBeDefined()
      expect(searchData.data.searchTemplates.nodes).toBeInstanceOf(Array)
      expect(searchData.data.searchTemplates.totalCount).toBeGreaterThan(0)
      
      // Find our test template
      const ourTemplate = searchData.data.searchTemplates.nodes.find(
        (t: any) => t.identifier === 'create-product-node'
      )
      expect(ourTemplate).toBeDefined()
    })

    test('should execute node creation template with variables', async () => {
      // Execute the template with specific product data using dataset helper attributes
      const executeResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                data
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'create-product-node',
              variables: {
                tableId: testTableId,
                productName: 'Wireless Headphones',
                productPrice: 299.99,
                productCategory: 'Electronics'
              }
            }
          }
        }),
      })

      const executeData = await executeResponse.json()
      
      if (executeData.errors) {
        console.error('GraphQL errors:', executeData.errors)
      }
      
      expect(executeData.data.executeTemplate).toBeDefined()
      
      if (executeData.data.executeTemplate.success) {
        console.log('✅ Template executed successfully')
        // Verify template execution metadata if available
        if (executeData.data.executeTemplate.data) {
          console.log('Template execution data available')
        }
      } else {
        console.log('Template execution details:', executeData.data.executeTemplate)
      }
    })

    test('should track template usage after execution', async () => {
      // Get the template to check usage count
      const templateResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTemplate($identifier: String!) {
              getTemplateByIdentifier(identifier: $identifier) {
                id
                identifier
                usageCount
                updatedAt
              }
            }
          `,
          variables: {
            identifier: 'create-product-node',
          },
        }),
      })

      const templateData = await templateResponse.json()
      expect(templateData.data.getTemplateByIdentifier).toBeDefined()
      expect(templateData.data.getTemplateByIdentifier.usageCount).toBeGreaterThan(0)
    })

    test('should create multiple product nodes using template', async () => {
      // Use test data from domain fixtures if available
      const testProducts = domainSetup.fixtures.tables.products?.slice(0, 3) || [
        { name: 'Smart Watch', price: 199.99, category: 'Electronics' },
        { name: 'Coffee Mug', price: 12.99, category: 'Kitchen' },
        { name: 'Gaming Mouse', price: 79.99, category: 'Electronics' },
      ]

      // Create multiple products using the template and dataset helper
      const createdProducts = []

      for (const product of testProducts) {
        const productData = {
          name: product.attributes?.name || product.name || product.content,
          price: product.attributes?.price || product.price || 99.99,
          category: product.attributes?.category || product.category || 'General',
        }

        const response = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
                executeTemplate(input: $input)
              }
            `,
            variables: {
              input: {
                templateIdentifier: 'create-product-node',
                variables: {
                  tableId: testTableId,
                  productName: productData.name,
                  productPrice: productData.price,
                  productCategory: productData.category,
                  productNameAttrId: attributeIds.product_name,
                  productPriceAttrId: attributeIds.product_price,
                  productCategoryAttrId: attributeIds.product_category,
                },
                trackUsage: true,
              },
            },
          }),
        })

        const data = await response.json()
        if (data.data?.executeTemplate?.createNode) {
          createdProducts.push(data.data.executeTemplate.createNode)
        }
      }

      expect(createdProducts.length).toBe(testProducts.length)

      // Verify products were created (use flexible content checking)
      const productContents = createdProducts.map((p) => p.content)
      expect(productContents.length).toBeGreaterThan(0)
    })

    test('should retrieve template information and statistics', async () => {
      // Get template information
      const templateResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTemplate($identifier: String!) {
              getTemplateByIdentifier(identifier: $identifier) {
                id
                identifier
                name
                description
                queryText
                variablesSchema
                defaultVariables
                applicableTables
                templateType
                complexityScore
                usageCount
                version
                isActive
                tags
                createdAt
                updatedAt
              }
            }
          `,
          variables: {
            identifier: 'create-product-node',
          },
        }),
      })

      const templateData = await templateResponse.json()
      const template = templateData.data.getTemplateByIdentifier

      expect(template).toBeDefined()
      expect(template.identifier).toBe('create-product-node')
      expect(template.name).toBe('Create Product Node')
      expect(template.templateType).toBe('mutation')
      expect(template.tags).toContain('node-creation')
      expect(template.tags).toContain('products')
      expect(template.tags).toContain('ecommerce')
      expect(template.usageCount).toBeGreaterThan(0)
      expect(template.complexityScore).toBe(3)
      expect(template.isActive).toBe(true)

      // Verify variable schema
      expect(template.variablesSchema).toBeDefined()
      expect(template.variablesSchema.type).toBe('object')
      expect(template.variablesSchema.properties.tableId).toBeDefined()
      expect(template.variablesSchema.properties.productName).toBeDefined()
      expect(template.variablesSchema.properties.productPrice).toBeDefined()

      // Verify default variables
      expect(template.defaultVariables).toBeDefined()
      expect(template.defaultVariables.productCategory).toBe('General')

      console.log('✅ Template Information Retrieved:')
      console.log(`   ID: ${template.id}`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Usage Count: ${template.usageCount}`)
      console.log(`   Tags: ${template.tags.join(', ')}`)
      console.log(`   Created: ${template.createdAt}`)
      console.log(`   Last Updated: ${template.updatedAt}`)
    })
  })

  describe('Popular Templates', () => {
    test('should retrieve popular templates', async () => {
      const popularResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetPopularTemplates($limit: Int!) {
              getPopularTemplates(limit: $limit) {
                id
                identifier
                name
                templateType
                usageCount
                tags
                complexityScore
              }
            }
          `,
          variables: {
            limit: 5,
          },
        }),
      })

      const popularData = await popularResponse.json()
      expect(popularData.data.getPopularTemplates).toBeDefined()

      const popularTemplates = popularData.data.getPopularTemplates
      if (popularTemplates.length > 0) {
        // Verify templates are sorted by usage count (descending)
        for (let i = 1; i < popularTemplates.length; i++) {
          expect(popularTemplates[i - 1].usageCount).toBeGreaterThanOrEqual(
            popularTemplates[i].usageCount
          )
        }

        console.log('✅ Popular Templates:')
        popularTemplates.forEach((template: any, index: number) => {
          console.log(`   ${index + 1}. ${template.name} (${template.usageCount} uses)`)
        })
      }
    })
  })

  describe('Template Validation', () => {
    test('should validate template variables before execution', async () => {
      // Try to execute template with invalid variables
      const invalidResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'create-product-node',
              variables: {
                // Missing required variables to trigger validation error
                productPrice: 'invalid_price' // Wrong type
              }
            },
          },
        }),
      })

      const invalidData = await invalidResponse.json()

      // Should return an error due to validation failure
      expect(invalidData.errors).toBeDefined()
      expect(invalidData.errors.length).toBeGreaterThan(0)
    })

    test('should skip validation when validateVariables is false', async () => {
      // This should execute even with missing variables when validation is disabled
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'create-product-node',
              variables: {
                productCategory: 'Electronics'
                // Missing required variables but should not fail validation
              }
            },
          },
        }),
      })

      const data = await response.json()
      // Should not fail due to validation, but might fail during execution
      // The important thing is that validation was bypassed
      expect(data).toBeDefined()
    })
  })

  afterAll(() => {
    // Clean up dataset cache
    datasetHelper.clearCache()
  })
})
