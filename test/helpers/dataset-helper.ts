import { join } from 'path'
import { DatasetManager, type DatasetSize, type DomainType } from '../../datasets/loaders/index.js'

/**
 * Helper class for managing datasets in tests
 */
export class TestDatasetHelper {
  private static instance: TestDatasetHelper
  private datasetManager: DatasetManager
  private loadedDatasets: Map<string, any> = new Map()

  private constructor() {
    // Use absolute path relative to project root
    const projectRoot = process.cwd()
    this.datasetManager = new DatasetManager(join(projectRoot, 'datasets'))
  }

  static getInstance(): TestDatasetHelper {
    if (!TestDatasetHelper.instance) {
      TestDatasetHelper.instance = new TestDatasetHelper()
    }
    return TestDatasetHelper.instance
  }

  /**
   * Load schema, fixtures, and templates for a domain
   */
  async loadDomainSetup(domain: DomainType, size: DatasetSize = 'small') {
    const cacheKey = `${domain}-${size}`

    if (this.loadedDatasets.has(cacheKey)) {
      return this.loadedDatasets.get(cacheKey)
    }

    try {
      const setup = await this.datasetManager.loadDomainSetup(domain, size)
      this.loadedDatasets.set(cacheKey, setup)
      return setup
    } catch (error) {
      // Fallback to minimal setup if datasets don't exist yet
      console.warn(`Failed to load dataset for ${domain}/${size}, using fallback`)
      return this.createFallbackSetup(domain)
    }
  }

  /**
   * Get template queries for testing
   */
  async getTestTemplates(domain: DomainType, templateType?: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION') {
    try {
      const templates = await this.datasetManager.templates.loadTemplatesByDomain(domain, {
        cache: true,
      })

      if (templateType) {
        return templates.filter((t) => t.templateType === templateType)
      }

      return templates
    } catch (error) {
      console.warn(`Failed to load templates for ${domain}, returning empty array`)
      return []
    }
  }

  /**
   * Generate test data on demand
   */
  async generateTestData(domain: DomainType, size: DatasetSize = 'small', seed = 42) {
    return this.datasetManager.generator.generateDomainFixtures({
      domain,
      size,
      seed,
      includeMetadata: true,
    })
  }

  /**
   * Create table and attributes for testing
   */
  async setupTestTable(
    yoga: any,
    domain: DomainType,
    tableSuffix?: string
  ): Promise<{
    tableId: string
    attributeIds: Record<string, string>
  }> {
    const timestamp = Date.now()
    const suffix = tableSuffix || timestamp.toString()

    // Create test table
    const createTableResponse = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateTestTable($input: CreateTableInput!) {
            createTable(input: $input) {
              id
              identifier
              name
            }
          }
        `,
        variables: {
          input: {
            identifier: `test-${domain}-${suffix}`,
            name: `Test ${domain} Table`,
            description: `Test table for ${domain} domain testing`,
          },
        },
      }),
    })

    const tableData = await createTableResponse.json()
    const tableId = tableData.data.createTable.id

    // Create test attributes based on domain
    const attributeConfigs = this.getDomainAttributeConfigs(domain)
    const attributeIds: Record<string, string> = {}

    for (const config of attributeConfigs) {
      const createAttrResponse = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateAttribute($input: CreateAttributeInput!) {
              createAttribute(input: $input) {
                id
                identifier
              }
            }
          `,
          variables: {
            input: {
              tableId,
              identifier: config.identifier,
              name: config.name,
              description: config.description,
              dataType: config.dataType,
              isRequired: config.isRequired,
            },
          },
        }),
      })

      const attrData = await createAttrResponse.json()
      if (attrData.data?.createAttribute) {
        attributeIds[config.identifier] = attrData.data.createAttribute.id
      }
    }

    return { tableId, attributeIds }
  }

  /**
   * Create test nodes with attributes
   */
  async createTestNodes(
    yoga: any,
    tableId: string,
    nodeConfigs: Array<{
      content: string
      title?: string
      description?: string
      attributes?: Record<string, any>
    }>,
    attributeIds: Record<string, string>
  ): Promise<string[]> {
    const nodeIds: string[] = []

    for (const config of nodeConfigs) {
      // Create node
      const createNodeResponse = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateNode($input: CreateNodeInput!) {
              createNode(input: $input) {
                success
                data {
                  id
                  content
                }
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              tableId,
              content: config.content,
              title: config.title,
              description: config.description,
            },
          },
        }),
      })

      const nodeData = await createNodeResponse.json()
      if (nodeData.data?.createNode?.success && nodeData.data.createNode.data) {
        const nodeId = nodeData.data.createNode.data.id
        nodeIds.push(nodeId)

        // Set attributes if provided
        if (config.attributes) {
          for (const [attrName, attrValue] of Object.entries(config.attributes)) {
            const attributeId = attributeIds[attrName]
            if (attributeId) {
              await yoga.fetch('http://localhost:4000/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: `
                    mutation SetNodeAttribute($nodeId: String!, $attributeId: String!, $value: String!) {
                      setNodeAttribute(nodeId: $nodeId, attributeId: $attributeId, value: $value) {
                        node {
                          id
                        }
                        errors {
                          message
                        }
                      }
                    }
                  `,
                  variables: {
                    nodeId,
                    attributeId,
                    value: String(attrValue),
                  },
                }),
              })
            }
          }
        }
      }
    }

    return nodeIds
  }

  private createFallbackSetup(domain: DomainType) {
    // Create minimal fallback schema and fixtures
    return {
      schema: {
        version: '1.0',
        name: `Fallback ${domain} Schema`,
        description: 'Minimal fallback schema for testing',
        tables: [],
        relationTypes: [],
      },
      fixtures: {
        version: '1.0',
        domain,
        size: 'small' as DatasetSize,
        tables: {},
        relations: [],
        metadata: {
          totalNodes: 0,
          totalRelations: 0,
          generated: new Date().toISOString(),
          description: 'Fallback fixtures for testing',
        },
      },
      templates: [],
    }
  }

  private getDomainAttributeConfigs(domain: DomainType): Array<{
    identifier: string
    name: string
    description: string
    dataType: string
    isRequired: boolean
  }> {
    const configs: Record<DomainType, any[]> = {
      ecommerce: [
        {
          identifier: 'product_name',
          name: 'Product Name',
          description: 'Name of the product',
          dataType: 'STRING',
          isRequired: true,
        },
        {
          identifier: 'product_price',
          name: 'Product Price',
          description: 'Price of the product',
          dataType: 'DECIMAL',
          isRequired: true,
        },
        {
          identifier: 'product_category',
          name: 'Product Category',
          description: 'Category of the product',
          dataType: 'STRING',
          isRequired: false,
        },
      ],
      social: [
        {
          identifier: 'username',
          name: 'Username',
          description: 'User handle',
          dataType: 'STRING',
          isRequired: true,
        },
        {
          identifier: 'bio',
          name: 'Biography',
          description: 'User biography',
          dataType: 'TEXT',
          isRequired: false,
        },
      ],
      enterprise: [
        {
          identifier: 'employee_id',
          name: 'Employee ID',
          description: 'Unique employee identifier',
          dataType: 'STRING',
          isRequired: true,
        },
        {
          identifier: 'department',
          name: 'Department',
          description: 'Employee department',
          dataType: 'STRING',
          isRequired: true,
        },
      ],
      knowledge: [
        {
          identifier: 'concept_domain',
          name: 'Domain',
          description: 'Knowledge domain',
          dataType: 'STRING',
          isRequired: true,
        },
        {
          identifier: 'complexity_score',
          name: 'Complexity Score',
          description: 'Concept complexity rating',
          dataType: 'INTEGER',
          isRequired: false,
        },
      ],
    }

    return configs[domain] || []
  }

  /**
   * Clean up test data
   */
  clearCache() {
    this.loadedDatasets.clear()
    this.datasetManager.clearAllCaches()
  }
}
