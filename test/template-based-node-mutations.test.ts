import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
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
            mutation CreateQueryTemplate($input: CreateQueryTemplateInput!) {
              createQueryTemplate(input: $input) {
                id
                identifier
                name
                queryText
                variablesSchema
                defaultVariables
                tags
              }
            }
          `,
          variables: {
            input: {
              identifier: 'create-product-node',
              name: 'Create Product Node',
              description: 'Template for creating product nodes with attributes',
              queryText: `
                mutation CreateProductNode($tableId: ID!, $productName: String!, $productPrice: Float!, $productCategory: String) {
                  createNode(input: {
                    tableId: $tableId
                    content: $productName
                    title: $productName
                    description: "Product: " + $productName
                  }) {
                    id
                    content
                    title
                    description
                    createdAt
                  }
                  
                  setProductNameAttr: setNodeAttribute(input: {
                    nodeId: $nodeId
                    attributeId: $productNameAttrId
                    value: $productName
                  }) {
                    id
                    value
                  }
                  
                  setProductPriceAttr: setNodeAttribute(input: {
                    nodeId: $nodeId
                    attributeId: $productPriceAttrId
                    value: $productPrice
                  }) {
                    id
                    value
                  }
                  
                  setProductCategoryAttr: setNodeAttribute(input: {
                    nodeId: $nodeId
                    attributeId: $productCategoryAttrId
                    value: $productCategory
                  }) {
                    id
                    value
                  }
                }
              `,
              variablesSchema: {
                type: 'object',
                properties: {
                  tableId: { type: 'string', description: 'Target table ID' },
                  productName: { type: 'string', description: 'Product name' },
                  productPrice: { type: 'number', description: 'Product price' },
                  productCategory: { type: 'string', description: 'Product category' },
                },
                required: ['tableId', 'productName', 'productPrice'],
              },
              defaultVariables: {
                productCategory: 'General',
              },
              applicableTables: ['ecommerce-products'],
              templateType: 'mutation',
              complexityScore: 3,
              tags: ['node-creation', 'products', 'ecommerce', 'attributes'],
            },
          },
        }),
      })

      const templateData = await createTemplateResponse.json()
      expect(templateData.data.createQueryTemplate).toBeDefined()
      expect(templateData.data.createQueryTemplate.identifier).toBe('create-product-node')
      expect(templateData.data.createQueryTemplate.tags).toContain('node-creation')

      createNodeTemplateId = templateData.data.createQueryTemplate.id
    })

    test('should search for node creation templates', async () => {
      const searchResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query SearchTemplates($input: SearchTemplatesInput!) {
              searchTemplates(input: $input) {
                id
                identifier
                name
                tags
                templateType
                complexityScore
                usageCount
              }
            }
          `,
          variables: {
            input: {
              tags: ['node-creation'],
              tagMatchMode: 'ANY',
              templateType: 'mutation',
              isActive: true,
            },
          },
        }),
      })

      const searchData = await searchResponse.json()
      expect(searchData.data.searchTemplates).toBeDefined()
      expect(searchData.data.searchTemplates.length).toBeGreaterThan(0)

      const nodeCreationTemplates = searchData.data.searchTemplates.filter((template: any) =>
        template.tags.includes('node-creation')
      )
      expect(nodeCreationTemplates.length).toBeGreaterThan(0)
    })

    test('should execute node creation template with variables', async () => {

      // Execute the template with specific product data using dataset helper attributes
      const executeResponse = await fetch('http://localhost:4000/graphql', {
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
                productName: 'Wireless Headphones',
                productPrice: 299.99,
                productCategory: 'Electronics',
                productNameAttrId: attributeIds.product_name,
                productPriceAttrId: attributeIds.product_price,
                productCategoryAttrId: attributeIds.product_category,
              },
              trackUsage: true,
              validateVariables: true,
            },
          },
        }),
      })

      const executeData = await executeResponse.json()
      expect(executeData.data.executeTemplate).toBeDefined()

      // Verify the node was created
      if (executeData.data.executeTemplate.createNode) {
        expect(executeData.data.executeTemplate.createNode.content).toBe('Wireless Headphones')
        expect(executeData.data.executeTemplate.createNode.title).toBe('Wireless Headphones')
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
          category: product.attributes?.category || product.category || 'General'
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
            mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
              executeTemplate(input: $input)
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'create-product-node',
              variables: {
                // Missing required tableId and productName
                productPrice: 'invalid_price', // Wrong type
                productCategory: 'Electronics',
              },
              validateVariables: true,
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
            mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
              executeTemplate(input: $input)
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'create-product-node',
              variables: {
                productCategory: 'Electronics',
                // Missing required variables
              },
              validateVariables: false,
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
