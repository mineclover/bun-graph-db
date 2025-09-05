import type { GraphQLTestClient } from './GraphQLTestClient.js'

export interface TableFixture {
  identifier: string
  description: string
  attributeTypes: AttributeTypeFixture[]
  attributes: AttributeFixture[]
  nodes: NodeFixture[]
  relationTypes: RelationTypeFixture[]
  relations: RelationFixture[]
}

export interface AttributeTypeFixture {
  identifier: string
  description: string
  category?: string
}

export interface AttributeFixture {
  identifier: string
  description: string
  isRequired: boolean
  isSearchable: boolean
}

export interface NodeFixture {
  content: string
  description: string
  externalId?: string
  attributes?: Record<string, any>
}

export interface RelationTypeFixture {
  identifier: string
  description: string
  category?: string
}

export interface RelationFixture {
  relationType: string
  sourceExternalId: string
  targetExternalId: string
  strength: number
  confidence: number
  properties?: Record<string, any>
}

export class TestDataFixtures {
  constructor(private client: GraphQLTestClient) {}

  // E-commerce sample data
  getEcommerceFixture(): TableFixture {
    return {
      identifier: `ecommerce-${Date.now()}`,
      description: 'E-commerce product catalog test data',
      attributeTypes: [
        { identifier: 'price', description: 'Product price in currency' },
        { identifier: 'category', description: 'Product category' },
        { identifier: 'brand', description: 'Product brand name' },
        { identifier: 'rating', description: 'Product rating (1-5)' },
        { identifier: 'stock', description: 'Stock quantity' },
      ],
      attributes: [
        { identifier: 'price', description: 'Price in USD', isRequired: true, isSearchable: true },
        {
          identifier: 'category',
          description: 'Product category',
          isRequired: true,
          isSearchable: true,
        },
        { identifier: 'brand', description: 'Brand name', isRequired: false, isSearchable: true },
        {
          identifier: 'rating',
          description: 'Customer rating',
          isRequired: false,
          isSearchable: false,
        },
        {
          identifier: 'stock_count',
          description: 'Items in stock',
          isRequired: true,
          isSearchable: false,
        },
      ],
      nodes: [
        {
          content: 'iPhone 15 Pro',
          description: 'Latest iPhone with advanced features',
          externalId: 'iphone-15-pro',
          attributes: {
            price: 999.99,
            category: 'smartphones',
            brand: 'Apple',
            rating: 4.8,
            stock_count: 50,
          },
        },
        {
          content: 'MacBook Pro M3',
          description: 'Professional laptop with M3 chip',
          externalId: 'macbook-pro-m3',
          attributes: {
            price: 1999.99,
            category: 'laptops',
            brand: 'Apple',
            rating: 4.9,
            stock_count: 25,
          },
        },
        {
          content: 'AirPods Pro',
          description: 'Wireless earbuds with noise cancellation',
          externalId: 'airpods-pro',
          attributes: {
            price: 249.99,
            category: 'audio',
            brand: 'Apple',
            rating: 4.7,
            stock_count: 100,
          },
        },
        {
          content: 'USB-C Cable',
          description: 'High-quality USB-C charging cable',
          externalId: 'usb-c-cable',
          attributes: {
            price: 29.99,
            category: 'accessories',
            brand: 'Apple',
            rating: 4.5,
            stock_count: 200,
          },
        },
      ],
      relationTypes: [
        { identifier: 'compatible_with', description: 'Product compatibility relationship' },
        {
          identifier: 'frequently_bought_together',
          description: 'Products often purchased together',
        },
        { identifier: 'alternative_to', description: 'Alternative product options' },
        { identifier: 'requires', description: 'Product dependency relationship' },
      ],
      relations: [
        {
          relationType: 'compatible_with',
          sourceExternalId: 'usb-c-cable',
          targetExternalId: 'iphone-15-pro',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'compatible_with',
          sourceExternalId: 'usb-c-cable',
          targetExternalId: 'macbook-pro-m3',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'frequently_bought_together',
          sourceExternalId: 'iphone-15-pro',
          targetExternalId: 'airpods-pro',
          strength: 3,
          confidence: 3,
        },
        {
          relationType: 'frequently_bought_together',
          sourceExternalId: 'macbook-pro-m3',
          targetExternalId: 'airpods-pro',
          strength: 2,
          confidence: 3,
        },
      ],
    }
  }

  // Software project management sample data
  getProjectManagementFixture(): TableFixture {
    return {
      identifier: `project-mgmt-${Date.now()}`,
      description: 'Software project management test data',
      attributeTypes: [
        { identifier: 'status', description: 'Task or project status' },
        { identifier: 'priority', description: 'Priority level (1-5)' },
        { identifier: 'assignee', description: 'Person assigned to task' },
        { identifier: 'estimation', description: 'Time estimation in hours' },
        { identifier: 'completion', description: 'Completion percentage' },
      ],
      attributes: [
        {
          identifier: 'status',
          description: 'Current status',
          isRequired: true,
          isSearchable: true,
        },
        {
          identifier: 'priority',
          description: 'Priority level',
          isRequired: true,
          isSearchable: true,
        },
        {
          identifier: 'assignee',
          description: 'Assigned developer',
          isRequired: false,
          isSearchable: true,
        },
        {
          identifier: 'estimated_hours',
          description: 'Time estimate',
          isRequired: false,
          isSearchable: false,
        },
        {
          identifier: 'completion_percent',
          description: 'Progress percentage',
          isRequired: false,
          isSearchable: false,
        },
      ],
      nodes: [
        {
          content: 'User Authentication System',
          description: 'Implement OAuth 2.0 authentication',
          externalId: 'auth-system',
          attributes: {
            status: 'in_progress',
            priority: 5,
            assignee: 'john.doe',
            estimated_hours: 40,
            completion_percent: 75,
          },
        },
        {
          content: 'Database Migration',
          description: 'Migrate from MySQL to PostgreSQL',
          externalId: 'db-migration',
          attributes: {
            status: 'planning',
            priority: 4,
            assignee: 'jane.smith',
            estimated_hours: 60,
            completion_percent: 10,
          },
        },
        {
          content: 'API Rate Limiting',
          description: 'Implement rate limiting for public APIs',
          externalId: 'api-rate-limit',
          attributes: {
            status: 'todo',
            priority: 3,
            assignee: 'bob.wilson',
            estimated_hours: 20,
            completion_percent: 0,
          },
        },
        {
          content: 'Frontend Unit Tests',
          description: 'Add comprehensive unit test coverage',
          externalId: 'frontend-tests',
          attributes: {
            status: 'in_progress',
            priority: 3,
            assignee: 'alice.brown',
            estimated_hours: 30,
            completion_percent: 45,
          },
        },
        {
          content: 'CI/CD Pipeline',
          description: 'Set up automated deployment pipeline',
          externalId: 'ci-cd-pipeline',
          attributes: {
            status: 'completed',
            priority: 4,
            assignee: 'charlie.davis',
            estimated_hours: 35,
            completion_percent: 100,
          },
        },
      ],
      relationTypes: [
        { identifier: 'depends_on', description: 'Task dependency relationship' },
        { identifier: 'blocks', description: 'Blocking relationship' },
        { identifier: 'related_to', description: 'General relationship' },
        { identifier: 'assigned_with', description: 'Co-assignment relationship' },
      ],
      relations: [
        {
          relationType: 'depends_on',
          sourceExternalId: 'api-rate-limit',
          targetExternalId: 'auth-system',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'depends_on',
          sourceExternalId: 'ci-cd-pipeline',
          targetExternalId: 'frontend-tests',
          strength: 3,
          confidence: 4,
        },
        {
          relationType: 'blocks',
          sourceExternalId: 'db-migration',
          targetExternalId: 'auth-system',
          strength: 2,
          confidence: 3,
        },
        {
          relationType: 'related_to',
          sourceExternalId: 'frontend-tests',
          targetExternalId: 'auth-system',
          strength: 2,
          confidence: 2,
        },
      ],
    }
  }

  // Knowledge graph sample data
  getKnowledgeGraphFixture(): TableFixture {
    return {
      identifier: `knowledge-${Date.now()}`,
      description: 'Knowledge graph test data with concepts and relationships',
      attributeTypes: [
        { identifier: 'concept_type', description: 'Type of concept (person, place, thing, idea)' },
        { identifier: 'confidence_score', description: 'Confidence in the information (0-1)' },
        { identifier: 'source', description: 'Information source' },
        { identifier: 'last_verified', description: 'Last verification date' },
      ],
      attributes: [
        { identifier: 'type', description: 'Concept type', isRequired: true, isSearchable: true },
        {
          identifier: 'confidence',
          description: 'Data confidence',
          isRequired: false,
          isSearchable: false,
        },
        { identifier: 'source', description: 'Data source', isRequired: false, isSearchable: true },
        {
          identifier: 'verified_date',
          description: 'Verification date',
          isRequired: false,
          isSearchable: false,
        },
      ],
      nodes: [
        {
          content: 'Artificial Intelligence',
          description: 'Branch of computer science dealing with intelligent agents',
          externalId: 'ai-concept',
          attributes: {
            type: 'concept',
            confidence: 0.95,
            source: 'academic_papers',
            verified_date: '2024-01-15',
          },
        },
        {
          content: 'Machine Learning',
          description: 'Subset of AI focused on learning from data',
          externalId: 'ml-concept',
          attributes: {
            type: 'concept',
            confidence: 0.98,
            source: 'textbooks',
            verified_date: '2024-01-15',
          },
        },
        {
          content: 'Neural Networks',
          description: 'Computing systems inspired by biological neural networks',
          externalId: 'neural-networks',
          attributes: {
            type: 'concept',
            confidence: 0.92,
            source: 'research_papers',
            verified_date: '2024-01-10',
          },
        },
        {
          content: 'Deep Learning',
          description: 'ML technique using deep neural networks',
          externalId: 'deep-learning',
          attributes: {
            type: 'concept',
            confidence: 0.96,
            source: 'academic_papers',
            verified_date: '2024-01-12',
          },
        },
        {
          content: 'Natural Language Processing',
          description: 'AI field focused on language understanding',
          externalId: 'nlp-concept',
          attributes: {
            type: 'concept',
            confidence: 0.94,
            source: 'journals',
            verified_date: '2024-01-14',
          },
        },
      ],
      relationTypes: [
        { identifier: 'is_subset_of', description: 'Hierarchical subset relationship' },
        { identifier: 'uses', description: 'Utilization relationship' },
        { identifier: 'applies_to', description: 'Application relationship' },
        { identifier: 'related_field', description: 'Related field or domain' },
      ],
      relations: [
        {
          relationType: 'is_subset_of',
          sourceExternalId: 'ml-concept',
          targetExternalId: 'ai-concept',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'uses',
          sourceExternalId: 'ml-concept',
          targetExternalId: 'neural-networks',
          strength: 3,
          confidence: 4,
        },
        {
          relationType: 'is_subset_of',
          sourceExternalId: 'deep-learning',
          targetExternalId: 'ml-concept',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'uses',
          sourceExternalId: 'deep-learning',
          targetExternalId: 'neural-networks',
          strength: 4,
          confidence: 4,
        },
        {
          relationType: 'applies_to',
          sourceExternalId: 'nlp-concept',
          targetExternalId: 'deep-learning',
          strength: 3,
          confidence: 3,
        },
      ],
    }
  }

  // Create complete test environment with sample data
  async createTestEnvironment(fixture: TableFixture): Promise<{
    tableId: string
    attributeTypeIds: Record<string, string>
    attributeIds: Record<string, string>
    nodeIds: Record<string, string>
    relationTypeIds: Record<string, string>
    relationIds: string[]
  }> {
    console.log(`🏗️  Creating test environment: ${fixture.identifier}`)

    // Create table
    const tableId = await this.client.createTable(fixture.identifier, fixture.description)
    if (!tableId) throw new Error('Failed to create test table')

    // Create attribute types
    const attributeTypeIds: Record<string, string> = {}
    for (const attrType of fixture.attributeTypes) {
      const id = await this.client.createAttributeType(attrType.identifier, attrType.description)
      if (id) attributeTypeIds[attrType.identifier] = id
    }

    // Create attributes
    const attributeIds: Record<string, string> = {}
    for (const attr of fixture.attributes) {
      const attrTypeId = attributeTypeIds[attr.identifier] || Object.values(attributeTypeIds)[0]
      const id = await this.client.createAttribute(tableId, attr.identifier, attrTypeId)
      if (id) attributeIds[attr.identifier] = id
    }

    // Create nodes
    const nodeIds: Record<string, string> = {}
    for (const node of fixture.nodes) {
      const id = await this.client.createNode(tableId, node.content, node.description)
      if (id && node.externalId) nodeIds[node.externalId] = id
    }

    // Create relation types
    const relationTypeIds: Record<string, string> = {}
    for (const relType of fixture.relationTypes) {
      const id = await this.client.createRelationType(relType.identifier, relType.description)
      if (id) relationTypeIds[relType.identifier] = id
    }

    // Create relations
    const relationIds: string[] = []
    for (const relation of fixture.relations) {
      const relationTypeId = relationTypeIds[relation.relationType]
      if (relationTypeId) {
        const id = await this.client.createRelation(
          tableId,
          relationTypeId,
          relation.sourceExternalId,
          relation.targetExternalId,
          relation.strength,
          relation.confidence
        )
        if (id) relationIds.push(id)
      }
    }

    console.log(`✅ Test environment created:`)
    console.log(`   - Table: ${tableId}`)
    console.log(`   - Attribute Types: ${Object.keys(attributeTypeIds).length}`)
    console.log(`   - Attributes: ${Object.keys(attributeIds).length}`)
    console.log(`   - Nodes: ${Object.keys(nodeIds).length}`)
    console.log(`   - Relation Types: ${Object.keys(relationTypeIds).length}`)
    console.log(`   - Relations: ${relationIds.length}`)

    return {
      tableId,
      attributeTypeIds,
      attributeIds,
      nodeIds,
      relationTypeIds,
      relationIds,
    }
  }

  // Generate performance test data
  async createPerformanceTestData(
    tableIdentifier: string,
    nodeCount: number = 100,
    relationCount: number = 200
  ): Promise<{
    tableId: string
    nodeIds: string[]
    relationIds: string[]
  }> {
    console.log(`🚀 Creating performance test data: ${nodeCount} nodes, ${relationCount} relations`)

    const tableId = await this.client.createTable(
      tableIdentifier,
      `Performance test with ${nodeCount} nodes`
    )
    if (!tableId) throw new Error('Failed to create performance test table')

    // Create a basic relation type
    const relationTypeId = await this.client.createRelationType(
      'test_relation',
      'Performance test relation'
    )
    if (!relationTypeId) throw new Error('Failed to create relation type')

    // Create nodes in batches
    const nodeIds: string[] = []
    const batchSize = 10
    for (let i = 0; i < nodeCount; i += batchSize) {
      const batch = Math.min(batchSize, nodeCount - i)
      const promises = []

      for (let j = 0; j < batch; j++) {
        const nodeIndex = i + j
        promises.push(
          this.client.createNode(tableId, `Node ${nodeIndex}`, `Performance test node ${nodeIndex}`)
        )
      }

      const batchResults = await Promise.all(promises)
      nodeIds.push(...(batchResults.filter((id) => id !== null) as string[]))

      if (i % 50 === 0) {
        console.log(`   Created ${Math.min(i + batchSize, nodeCount)}/${nodeCount} nodes`)
      }
    }

    // Create random relations
    const relationIds: string[] = []
    for (let i = 0; i < relationCount && nodeIds.length >= 2; i++) {
      const sourceIdx = Math.floor(Math.random() * nodeIds.length)
      let targetIdx = Math.floor(Math.random() * nodeIds.length)
      while (targetIdx === sourceIdx) {
        targetIdx = Math.floor(Math.random() * nodeIds.length)
      }

      const strength = Math.floor(Math.random() * 4) + 1
      const confidence = Math.floor(Math.random() * 4) + 1

      const id = await this.client.createRelation(
        tableId,
        relationTypeId,
        `node_${sourceIdx}`,
        `node_${targetIdx}`,
        strength,
        confidence
      )
      if (id) relationIds.push(id)

      if (i % 50 === 0) {
        console.log(`   Created ${i}/${relationCount} relations`)
      }
    }

    console.log(
      `✅ Performance test data created: ${nodeIds.length} nodes, ${relationIds.length} relations`
    )

    return {
      tableId,
      nodeIds,
      relationIds,
    }
  }
}
