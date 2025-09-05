import { GraphQLClient } from 'graphql-request'

export interface GraphQLTestResult<T = any> {
  data: T | null
  errors?: Array<{
    message: string
    code?: string
    field?: string
    path?: (string | number)[]
  }>
}

export interface TestContext {
  createdTables: string[]
  createdAttributeTypes: string[]
  createdAttributes: string[]
  createdNodes: string[]
  createdRelations: string[]
  createdRelationTypes: string[]
}

export class GraphQLTestClient {
  private client: GraphQLClient
  private context: TestContext

  constructor(endpoint: string = 'http://localhost:4000/graphql') {
    this.client = new GraphQLClient(endpoint)
    this.context = {
      createdTables: [],
      createdAttributeTypes: [],
      createdAttributes: [],
      createdNodes: [],
      createdRelations: [],
      createdRelationTypes: [],
    }
  }

  async query<T = any>(query: string, variables?: any): Promise<GraphQLTestResult<T>> {
    try {
      const data = await this.client.request<T>(query, variables)
      return { data }
    } catch (error: any) {
      if (error.response?.errors) {
        return {
          data: null,
          errors: error.response.errors,
        }
      }
      throw error
    }
  }

  getContext(): TestContext {
    return { ...this.context }
  }

  trackResource(type: keyof TestContext, id: string) {
    this.context[type].push(id)
  }

  clearContext() {
    this.context = {
      createdTables: [],
      createdAttributeTypes: [],
      createdAttributes: [],
      createdNodes: [],
      createdRelations: [],
      createdRelationTypes: [],
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query(`
        query HealthCheck {
          health {
            status
            timestamp
            database
            version
          }
        }
      `)
      return result.data?.health?.status === 'OK'
    } catch {
      return false
    }
  }

  // Table operations
  async createTable(identifier: string, description?: string): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
            description
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          identifier,
          description: description || `Test table: ${identifier}`,
        },
      }
    )

    if (result.data?.createTable?.table?.id) {
      this.trackResource('createdTables', result.data.createTable.table.id)
      return result.data.createTable.table.id
    }
    return null
  }

  async getTables(): Promise<any> {
    return await this.query(`
      query GetTables {
        tables {
          nodes {
            id
            identifier
            description
            createdAt
            updatedAt
            nodeCount
            attributeCount
          }
          totalCount
          hasNextPage
        }
      }
    `)
  }

  async getTable(id: string): Promise<any> {
    return await this.query(
      `
      query GetTable($id: ID!) {
        table(id: $id) {
          id
          identifier
          description
          metadata
          createdAt
          updatedAt
          nodeCount
          attributeCount
        }
      }
    `,
      { id }
    )
  }

  // Attribute type operations
  async createAttributeType(identifier: string, description?: string): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
        createAttributeType(input: $input) {
          attributeType {
            id
            identifier
            description
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          identifier,
          description: description || `Test attribute type: ${identifier}`,
        },
      }
    )

    if (result.data?.createAttributeType?.attributeType?.id) {
      this.trackResource('createdAttributeTypes', result.data.createAttributeType.attributeType.id)
      return result.data.createAttributeType.attributeType.id
    }
    return null
  }

  async getAttributeTypes(): Promise<any> {
    return await this.query(`
      query GetAttributeTypes {
        attributeTypes {
          id
          identifier
          description
          category
          createdAt
          updatedAt
        }
      }
    `)
  }

  // Attribute operations
  async createAttribute(
    tableId: string,
    identifier: string,
    attributeTypeId: string
  ): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateAttribute($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          attribute {
            id
            identifier
            description
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          tableId,
          identifier,
          attributeTypeId,
          description: `Test attribute: ${identifier}`,
          isRequired: false,
          isSearchable: true,
        },
      }
    )

    if (result.data?.createAttribute?.attribute?.id) {
      this.trackResource('createdAttributes', result.data.createAttribute.attribute.id)
      return result.data.createAttribute.attribute.id
    }
    return null
  }

  async getAttributes(tableId: string): Promise<any> {
    return await this.query(
      `
      query GetAttributes($tableId: ID!) {
        attributes(tableId: $tableId) {
          id
          identifier
          description
          attributeType {
            id
            identifier
          }
          table {
            id
            identifier
          }
          isRequired
          isSearchable
          createdAt
          updatedAt
        }
      }
    `,
      { tableId }
    )
  }

  // Node operations
  async createNode(tableId: string, content: string, description?: string): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateNode($input: CreateNodeInput!) {
        createNode(input: $input) {
          node {
            id
            content
            description
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          tableId,
          content,
          description: description || `Test node: ${content}`,
        },
      }
    )

    if (result.data?.createNode?.node?.id) {
      this.trackResource('createdNodes', result.data.createNode.node.id)
      return result.data.createNode.node.id
    }
    return null
  }

  async getNodes(tableId: string): Promise<any> {
    return await this.query(
      `
      query GetNodes($tableId: ID!) {
        nodes(tableId: $tableId) {
          nodes {
            id
            content
            description
            externalId
            table {
              id
              identifier
            }
            attributeCount
            relationCount
            createdAt
            updatedAt
          }
          totalCount
          hasNextPage
        }
      }
    `,
      { tableId }
    )
  }

  async searchNodes(tableId: string, query?: string, limit = 10): Promise<any> {
    return await this.query(
      `
      query SearchNodes($input: SearchNodesInput!) {
        searchNodes(input: $input) {
          nodes {
            id
            content
            description
            createdAt
          }
          total
          hasMore
          query {
            originalQuery
          }
        }
      }
    `,
      {
        input: {
          tableId,
          query,
          limit,
        },
      }
    )
  }

  // Relation operations
  async createRelationType(identifier: string, description?: string): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateRelationType($input: CreateRelationTypeInput!) {
        createRelationType(input: $input) {
          relationType {
            id
            identifier
            description
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          identifier,
          description: description || `Test relation type: ${identifier}`,
        },
      }
    )

    if (result.data?.createRelationType?.relationType?.id) {
      this.trackResource('createdRelationTypes', result.data.createRelationType.relationType.id)
      return result.data.createRelationType.relationType.id
    }
    return null
  }

  async getRelationTypes(): Promise<any> {
    return await this.query(`
      query GetRelationTypes {
        relationTypes {
          id
          identifier
          description
          category
          createdAt
          updatedAt
        }
      }
    `)
  }

  async createRelation(
    tableId: string,
    relationTypeId: string,
    sourceExternalId: string,
    targetExternalId: string,
    strength = 1,
    confidence = 1
  ): Promise<string | null> {
    const result = await this.query(
      `
      mutation CreateRelation($input: CreateRelationInput!) {
        createRelation(input: $input) {
          relation {
            id
            sourceExternalId
            targetExternalId
            strength
            confidence
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
      {
        input: {
          tableId,
          relationTypeId,
          sourceExternalId,
          targetExternalId,
          strength,
          confidence,
        },
      }
    )

    if (result.data?.createRelation?.relation?.id) {
      this.trackResource('createdRelations', result.data.createRelation.relation.id)
      return result.data.createRelation.relation.id
    }
    return null
  }

  async getNodeRelations(tableId: string): Promise<any> {
    return await this.query(
      `
      query GetNodeRelations($tableId: ID!) {
        nodeRelations(tableId: $tableId) {
          id
          sourceExternalId
          targetExternalId
          strength
          confidence
          properties
          relationType {
            id
            identifier
          }
          table {
            id
            identifier
          }
          createdAt
          updatedAt
        }
      }
    `,
      { tableId }
    )
  }

  // Analytics operations
  async getSystemHealth(): Promise<any> {
    return await this.query(`
      query GetSystemHealth {
        getSystemHealth {
          status
          uptime
          memory {
            used
            total
            percent
          }
          database {
            connections
            queries
            errors
          }
          performance {
            avgResponseTime
            requestsPerSecond
          }
        }
      }
    `)
  }

  // Schema operations
  async exportTable(tableId: string): Promise<any> {
    return await this.query(
      `
      query ExportTable($tableId: ID!) {
        exportTable(tableId: $tableId) {
          success
          data
          format
          timestamp
        }
      }
    `,
      { tableId }
    )
  }

  async exportAllTables(): Promise<any> {
    return await this.query(`
      query ExportAllTables {
        exportAllTables {
          success
          data
          format
          timestamp
        }
      }
    `)
  }

  // Complex query operations
  async searchRelatedNodes(tableId: string, sourceNodeIds: string[], depth = 2): Promise<any> {
    return await this.query(
      `
      query SearchRelatedNodes($input: SearchRelatedNodesInput!) {
        searchRelatedNodes(input: $input) {
          nodes {
            node {
              id
              content
              description
            }
            attributes
            sourceNodeId
            targetNodeId
            relationTypeId
            strength
          }
          relations {
            id
            sourceExternalId
            targetExternalId
            strength
            confidence
          }
          paths {
            startNodeId
            endNodeId
            path
            length
          }
          total
          hasMore
        }
      }
    `,
      {
        input: {
          tableId,
          sourceNodeIds,
          relationFilters: [
            {
              direction: 'OUTGOING',
              depth,
            },
          ],
        },
      }
    )
  }
}
