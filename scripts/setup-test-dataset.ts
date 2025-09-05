#!/usr/bin/env bun

/**
 * Test Dataset Setup Script
 *
 * This script creates a comprehensive test dataset for GraphQL API testing
 * and template-based query execution testing.
 */

import { Attribute } from '../src/domain/entities/Attribute.js'
import { AttributeType } from '../src/domain/entities/AttributeType.js'
import { Node } from '../src/domain/entities/Node.js'
import { NodeRelation } from '../src/domain/entities/NodeRelation.js'
import { RelationType } from '../src/domain/entities/RelationType.js'
import { Table } from '../src/domain/entities/Table.js'
import type { IAttributeRepository } from '../src/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '../src/domain/repositories/IAttributeTypeRepository.js'
import type { INodeRelationRepository } from '../src/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '../src/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '../src/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '../src/domain/repositories/ITableRepository.js'
import type { SchemaExportUseCase } from '../src/application/use-cases/export/SchemaExportUseCase.js'
import { ContainerBootstrap } from '../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../src/infrastructure/container/DIContainer.js'
import { RepositoryTokens, UseCaseTokens } from '../src/infrastructure/container/tokens/index.js'

interface TestDatasetConfig {
  name: string
  description: string
  tables: TestTableConfig[]
}

interface TestTableConfig {
  identifier: string
  description: string
  attributeTypes: TestAttributeTypeConfig[]
  attributes: TestAttributeConfig[]
  relationTypes: TestRelationTypeConfig[]
  nodes: TestNodeConfig[]
  relations: TestRelationConfig[]
}

interface TestAttributeTypeConfig {
  identifier: string
  name: string
  dataType: string
  description?: string
  allowedValues?: string[]
  constraints?: any
}

interface TestAttributeConfig {
  identifier: string
  name: string
  attributeTypeIdentifier: string
  description?: string
  isRequired: boolean
  defaultValue?: any
}

interface TestRelationTypeConfig {
  identifier: string
  name: string
  description?: string
}

interface TestNodeConfig {
  content: string
  title?: string
  description?: string
  attributes: Record<string, any>
}

interface TestRelationConfig {
  sourceNodeContent: string
  targetNodeContent: string
  relationTypeIdentifier: string
  properties?: any
  strength?: number
}

// Comprehensive test dataset configuration
const TEST_DATASETS: TestDatasetConfig[] = [
  {
    name: 'Software Architecture Analysis',
    description: 'Test dataset for software architecture and dependency analysis',
    tables: [
      {
        identifier: 'software_components',
        description: 'Software components and their relationships',
        attributeTypes: [
          {
            identifier: 'component_type',
            name: 'Component Type',
            dataType: 'ENUM',
            description: 'Type of software component',
            allowedValues: ['service', 'library', 'database', 'api', 'ui', 'middleware'],
          },
          {
            identifier: 'programming_language',
            name: 'Programming Language',
            dataType: 'STRING',
            description: 'Primary programming language',
          },
          {
            identifier: 'version',
            name: 'Version',
            dataType: 'STRING',
            description: 'Component version',
          },
          {
            identifier: 'complexity_score',
            name: 'Complexity Score',
            dataType: 'NUMBER',
            description: 'Cyclomatic complexity score',
            constraints: { min: 1, max: 100 },
          },
          {
            identifier: 'maintenance_status',
            name: 'Maintenance Status',
            dataType: 'ENUM',
            allowedValues: ['active', 'deprecated', 'legacy', 'experimental'],
          },
          {
            identifier: 'test_coverage',
            name: 'Test Coverage',
            dataType: 'NUMBER',
            description: 'Code test coverage percentage',
            constraints: { min: 0, max: 100 },
          },
        ],
        attributes: [
          {
            identifier: 'component_type',
            name: 'Component Type',
            attributeTypeIdentifier: 'component_type',
            description: 'Type of software component',
            isRequired: true,
          },
          {
            identifier: 'language',
            name: 'Programming Language',
            attributeTypeIdentifier: 'programming_language',
            isRequired: true,
          },
          {
            identifier: 'version',
            name: 'Version',
            attributeTypeIdentifier: 'version',
            isRequired: false,
            defaultValue: '1.0.0',
          },
          {
            identifier: 'complexity',
            name: 'Complexity Score',
            attributeTypeIdentifier: 'complexity_score',
            isRequired: false,
          },
          {
            identifier: 'status',
            name: 'Maintenance Status',
            attributeTypeIdentifier: 'maintenance_status',
            isRequired: true,
            defaultValue: 'active',
          },
          {
            identifier: 'coverage',
            name: 'Test Coverage',
            attributeTypeIdentifier: 'test_coverage',
            isRequired: false,
          },
        ],
        relationTypes: [
          {
            identifier: 'depends_on',
            name: 'Depends On',
            description: 'Component dependency relationship',
          },
          {
            identifier: 'implements',
            name: 'Implements',
            description: 'Implementation relationship',
          },
          {
            identifier: 'calls',
            name: 'Calls',
            description: 'Function/service call relationship',
          },
          {
            identifier: 'extends',
            name: 'Extends',
            description: 'Inheritance or extension relationship',
          },
        ],
        nodes: [
          {
            content: 'UserService',
            title: 'User Management Service',
            description: 'Core user management and authentication service',
            attributes: {
              component_type: 'service',
              language: 'TypeScript',
              version: '2.1.0',
              complexity: 15,
              status: 'active',
              coverage: 85,
            },
          },
          {
            content: 'AuthMiddleware',
            title: 'Authentication Middleware',
            description: 'JWT-based authentication middleware',
            attributes: {
              component_type: 'middleware',
              language: 'TypeScript',
              version: '1.5.0',
              complexity: 8,
              status: 'active',
              coverage: 92,
            },
          },
          {
            content: 'DatabaseConnection',
            title: 'Database Connection Pool',
            description: 'PostgreSQL connection pool manager',
            attributes: {
              component_type: 'database',
              language: 'TypeScript',
              version: '3.0.1',
              complexity: 25,
              status: 'active',
              coverage: 78,
            },
          },
          {
            content: 'UserRepository',
            title: 'User Data Repository',
            description: 'User data access layer',
            attributes: {
              component_type: 'library',
              language: 'TypeScript',
              version: '1.8.0',
              complexity: 12,
              status: 'active',
              coverage: 88,
            },
          },
          {
            content: 'ValidationUtils',
            title: 'Input Validation Utilities',
            description: 'Common validation functions and schemas',
            attributes: {
              component_type: 'library',
              language: 'TypeScript',
              version: '2.0.0',
              complexity: 6,
              status: 'active',
              coverage: 95,
            },
          },
          {
            content: 'UserInterface',
            title: 'User Management UI',
            description: 'React-based user interface components',
            attributes: {
              component_type: 'ui',
              language: 'TypeScript',
              version: '1.2.3',
              complexity: 18,
              status: 'active',
              coverage: 70,
            },
          },
          {
            content: 'LegacyUserAPI',
            title: 'Legacy User API',
            description: 'Deprecated REST API for user management',
            attributes: {
              component_type: 'api',
              language: 'JavaScript',
              version: '0.9.2',
              complexity: 45,
              status: 'deprecated',
              coverage: 35,
            },
          },
        ],
        relations: [
          {
            sourceNodeContent: 'UserService',
            targetNodeContent: 'AuthMiddleware',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: true },
            strength: 8,
          },
          {
            sourceNodeContent: 'UserService',
            targetNodeContent: 'UserRepository',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: true },
            strength: 9,
          },
          {
            sourceNodeContent: 'UserRepository',
            targetNodeContent: 'DatabaseConnection',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: true },
            strength: 10,
          },
          {
            sourceNodeContent: 'UserService',
            targetNodeContent: 'ValidationUtils',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: false },
            strength: 6,
          },
          {
            sourceNodeContent: 'UserInterface',
            targetNodeContent: 'UserService',
            relationTypeIdentifier: 'calls',
            properties: { protocol: 'HTTP', frequency: 'high' },
            strength: 7,
          },
          {
            sourceNodeContent: 'AuthMiddleware',
            targetNodeContent: 'ValidationUtils',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: false },
            strength: 4,
          },
          {
            sourceNodeContent: 'LegacyUserAPI',
            targetNodeContent: 'UserRepository',
            relationTypeIdentifier: 'depends_on',
            properties: { critical: false, deprecated: true },
            strength: 3,
          },
        ],
      },
    ],
  },
  {
    name: 'E-commerce Product Catalog',
    description: 'Test dataset for e-commerce product relationships and categories',
    tables: [
      {
        identifier: 'product_catalog',
        description: 'Product catalog with categories and relationships',
        attributeTypes: [
          {
            identifier: 'price',
            name: 'Price',
            dataType: 'NUMBER',
            description: 'Product price in USD',
            constraints: { min: 0 },
          },
          {
            identifier: 'category',
            name: 'Category',
            dataType: 'ENUM',
            allowedValues: ['electronics', 'books', 'clothing', 'home', 'sports', 'toys'],
          },
          {
            identifier: 'brand',
            name: 'Brand',
            dataType: 'STRING',
            description: 'Product brand name',
          },
          {
            identifier: 'rating',
            name: 'Rating',
            dataType: 'NUMBER',
            description: 'Average customer rating',
            constraints: { min: 1, max: 5 },
          },
          {
            identifier: 'stock_quantity',
            name: 'Stock Quantity',
            dataType: 'NUMBER',
            constraints: { min: 0 },
          },
          {
            identifier: 'availability_status',
            name: 'Availability',
            dataType: 'ENUM',
            allowedValues: ['in_stock', 'out_of_stock', 'discontinued', 'pre_order'],
          },
        ],
        attributes: [
          {
            identifier: 'price',
            name: 'Price',
            attributeTypeIdentifier: 'price',
            isRequired: true,
          },
          {
            identifier: 'category',
            name: 'Category',
            attributeTypeIdentifier: 'category',
            isRequired: true,
          },
          {
            identifier: 'brand',
            name: 'Brand',
            attributeTypeIdentifier: 'brand',
            isRequired: false,
          },
          {
            identifier: 'rating',
            name: 'Rating',
            attributeTypeIdentifier: 'rating',
            isRequired: false,
          },
          {
            identifier: 'stock',
            name: 'Stock Quantity',
            attributeTypeIdentifier: 'stock_quantity',
            isRequired: false,
            defaultValue: 0,
          },
          {
            identifier: 'availability',
            name: 'Availability',
            attributeTypeIdentifier: 'availability_status',
            isRequired: true,
            defaultValue: 'in_stock',
          },
        ],
        relationTypes: [
          {
            identifier: 'similar_to',
            name: 'Similar To',
            description: 'Product similarity relationship',
          },
          {
            identifier: 'frequently_bought_with',
            name: 'Frequently Bought With',
            description: 'Co-purchase relationship',
          },
          {
            identifier: 'replacement_for',
            name: 'Replacement For',
            description: 'Product replacement relationship',
          },
          {
            identifier: 'accessory_for',
            name: 'Accessory For',
            description: 'Product accessory relationship',
          },
        ],
        nodes: [
          {
            content: 'iPhone 15 Pro',
            title: 'Apple iPhone 15 Pro 128GB',
            description: 'Latest iPhone with advanced camera system',
            attributes: {
              price: 999.99,
              category: 'electronics',
              brand: 'Apple',
              rating: 4.8,
              stock: 50,
              availability: 'in_stock',
            },
          },
          {
            content: 'iPhone 15 Case',
            title: 'Leather Case for iPhone 15',
            description: 'Premium leather protective case',
            attributes: {
              price: 59.99,
              category: 'electronics',
              brand: 'Apple',
              rating: 4.5,
              stock: 200,
              availability: 'in_stock',
            },
          },
          {
            content: 'AirPods Pro',
            title: 'Apple AirPods Pro (2nd Gen)',
            description: 'Wireless earbuds with active noise cancellation',
            attributes: {
              price: 249.99,
              category: 'electronics',
              brand: 'Apple',
              rating: 4.7,
              stock: 75,
              availability: 'in_stock',
            },
          },
          {
            content: 'Samsung Galaxy S24',
            title: 'Samsung Galaxy S24 Ultra',
            description: 'Android smartphone with S Pen',
            attributes: {
              price: 899.99,
              category: 'electronics',
              brand: 'Samsung',
              rating: 4.6,
              stock: 30,
              availability: 'in_stock',
            },
          },
          {
            content: 'Wireless Charger',
            title: '15W Wireless Charging Pad',
            description: 'Fast wireless charging for smartphones',
            attributes: {
              price: 39.99,
              category: 'electronics',
              brand: 'Anker',
              rating: 4.3,
              stock: 150,
              availability: 'in_stock',
            },
          },
        ],
        relations: [
          {
            sourceNodeContent: 'iPhone 15 Case',
            targetNodeContent: 'iPhone 15 Pro',
            relationTypeIdentifier: 'accessory_for',
            properties: { compatibility: 'perfect', essential: true },
            strength: 9,
          },
          {
            sourceNodeContent: 'AirPods Pro',
            targetNodeContent: 'iPhone 15 Pro',
            relationTypeIdentifier: 'frequently_bought_with',
            properties: { purchase_correlation: 0.75 },
            strength: 8,
          },
          {
            sourceNodeContent: 'iPhone 15 Pro',
            targetNodeContent: 'Samsung Galaxy S24',
            relationTypeIdentifier: 'similar_to',
            properties: { category_match: true, price_similar: true },
            strength: 7,
          },
          {
            sourceNodeContent: 'Wireless Charger',
            targetNodeContent: 'iPhone 15 Pro',
            relationTypeIdentifier: 'accessory_for',
            properties: { compatibility: 'full', convenience: 'high' },
            strength: 6,
          },
          {
            sourceNodeContent: 'Wireless Charger',
            targetNodeContent: 'Samsung Galaxy S24',
            relationTypeIdentifier: 'accessory_for',
            properties: { compatibility: 'full', convenience: 'high' },
            strength: 6,
          },
        ],
      },
    ],
  },
]

export class TestDatasetSetup {
  private container: DIContainer

  constructor(container: DIContainer) {
    this.container = container
  }

  async createTestDatasets(): Promise<void> {
    console.log('🚀 Starting test dataset creation...')

    for (const dataset of TEST_DATASETS) {
      console.log(`\n📊 Creating dataset: ${dataset.name}`)
      await this.createDataset(dataset)
    }

    console.log('\n✅ All test datasets created successfully!')
  }

  private async createDataset(config: TestDatasetConfig): Promise<void> {
    for (const tableConfig of config.tables) {
      await this.createTable(tableConfig)
    }
  }

  private async createTable(config: TestTableConfig): Promise<void> {
    const tableRepository = (await this.container.resolve(
      RepositoryTokens.TABLE_REPOSITORY
    )) as ITableRepository
    const attributeTypeRepository = (await this.container.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY
    )) as IAttributeTypeRepository
    const attributeRepository = (await this.container.resolve(
      RepositoryTokens.ATTRIBUTE_REPOSITORY
    )) as IAttributeRepository
    const nodeRepository = (await this.container.resolve(
      RepositoryTokens.NODE_REPOSITORY
    )) as INodeRepository
    const relationTypeRepository = (await this.container.resolve(
      RepositoryTokens.RELATION_TYPE_REPOSITORY
    )) as IRelationTypeRepository
    const relationRepository = (await this.container.resolve(
      RepositoryTokens.NODE_RELATION_REPOSITORY
    )) as INodeRelationRepository

    console.log(`  📋 Creating table: ${config.identifier}`)

    // 1. Create attribute types
    const attributeTypeMap = new Map<string, string>()
    for (const atConfig of config.attributeTypes) {
      const allowedValuesString = Array.isArray(atConfig.allowedValues) 
        ? atConfig.allowedValues.join(',') 
        : atConfig.allowedValues
      
      const attributeType = AttributeType.create(
        atConfig.identifier,
        atConfig.name,
        atConfig.dataType,
        atConfig.description,
        allowedValuesString,
        atConfig.constraints
      )
      await attributeTypeRepository.save(attributeType)
      attributeTypeMap.set(atConfig.identifier, attributeType.getId())
      console.log(`    🏷️  Created attribute type: ${atConfig.identifier}`)
    }

    // 2. Create relation types
    const relationTypeMap = new Map<string, string>()
    for (const rtConfig of config.relationTypes) {
      const relationType = RelationType.create(
        rtConfig.identifier,
        rtConfig.name,
        rtConfig.description
      )
      await relationTypeRepository.save(relationType)
      relationTypeMap.set(rtConfig.identifier, relationType.getId())
      console.log(`    🔗 Created relation type: ${rtConfig.identifier}`)
    }

    // 3. Create table
    const table = Table.create(config.identifier, config.description)
    await tableRepository.save(table)
    console.log(`    📊 Created table: ${config.identifier}`)

    // 4. Create attributes
    for (const attrConfig of config.attributes) {
      const attributeTypeId = attributeTypeMap.get(attrConfig.attributeTypeIdentifier)
      if (!attributeTypeId) {
        throw new Error(`Attribute type not found: ${attrConfig.attributeTypeIdentifier}`)
      }

      const attribute = Attribute.create(
        table.id,
        attrConfig.identifier,
        attributeTypeId,
        attrConfig.description,
        attrConfig.isRequired
      )
      await attributeRepository.save(attribute)
      console.log(`    📝 Created attribute: ${attrConfig.identifier}`)
    }

    // 5. Create nodes
    const nodeMap = new Map<string, string>()
    for (const nodeConfig of config.nodes) {
      const node = Node.create(
        table.id,
        nodeConfig.content,
        nodeConfig.title,
        nodeConfig.description
      )
      await nodeRepository.save(node)
      nodeMap.set(nodeConfig.content, node.getId())
      console.log(`    🔘 Created node: ${nodeConfig.content}`)
    }

    // 6. Create relations
    for (const relationConfig of config.relations) {
      const sourceNodeId = nodeMap.get(relationConfig.sourceNodeContent)
      const targetNodeId = nodeMap.get(relationConfig.targetNodeContent)
      const relationTypeId = relationTypeMap.get(relationConfig.relationTypeIdentifier)

      if (!sourceNodeId || !targetNodeId || !relationTypeId) {
        console.error(`❌ Failed to create relation: missing references`)
        continue
      }

      const relation = NodeRelation.create(
        table.id,
        sourceNodeId,
        targetNodeId,
        relationTypeId,
        relationConfig.properties,
        relationConfig.strength
      )
      await relationRepository.save(relation)
      console.log(
        `    🔗 Created relation: ${relationConfig.sourceNodeContent} → ${relationConfig.targetNodeContent}`
      )
    }
  }

  async exportDatasets(): Promise<void> {
    console.log('\n📤 Exporting test datasets...')

    const exportUseCase = (await this.container.resolve(
      UseCaseTokens.SCHEMA_EXPORT_USE_CASE
    )) as SchemaExportUseCase
    const result = await exportUseCase.exportAllTables({
      includeData: true,
      includeRelations: true,
      format: 'json',
    })

    // Save to file
    const exportPath = './datasets/test-export.json'
    await Bun.write(exportPath, JSON.stringify(result, null, 2))

    console.log(`✅ Export completed: ${exportPath}`)
    console.log(`📊 Statistics:`)
    console.log(`   Tables: ${result.statistics.totalTables}`)
    console.log(`   Nodes: ${result.statistics.totalNodes}`)
    console.log(`   Relations: ${result.statistics.totalRelations}`)
    console.log(`   Size: ${result.statistics.exportSize}`)
  }

  async cleanupExistingData(): Promise<void> {
    console.log('🧹 Cleaning up existing data...')
    // This would typically delete existing test data
    // For now, we'll just log the intention
    console.log('⚠️  Manual cleanup required before running setup')
  }
}

// Main execution
if (import.meta.main) {
  try {
    const container = await ContainerBootstrap.createContainer()
    const setup = new TestDatasetSetup(container)

    await setup.cleanupExistingData()
    await setup.createTestDatasets()
    await setup.exportDatasets()
    console.log('\n🎉 Test dataset setup completed successfully!')
  } catch (error) {
    console.error('❌ Test dataset setup failed:', error)
    process.exit(1)
  }
}
