#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

const sampleDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultMemoryPath = path.join(sampleDirectory, 'memory.json')
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH
  ? path.isAbsolute(process.env.MEMORY_FILE_PATH)
    ? process.env.MEMORY_FILE_PATH
    : path.join(sampleDirectory, process.env.MEMORY_FILE_PATH)
  : defaultMemoryPath

interface Entity {
  name: string
  entityType: string
  observations: string[]
}

interface Relation {
  from: string
  to: string
  relationType: string
}

interface KnowledgeGraph {
  entities: Entity[]
  relations: Relation[]
}

class KnowledgeGraphManager {
  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(MEMORY_FILE_PATH, 'utf-8')
      return data
        .split('\n')
        .filter((line) => line.trim() !== '')
        .reduce(
          (graph: KnowledgeGraph, line) => {
            const item = JSON.parse(line) as { type?: string }
            if (item.type === 'entity') graph.entities.push(item as Entity)
            if (item.type === 'relation') graph.relations.push(item as Relation)
            return graph
          },
          { entities: [], relations: [] },
        )
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { entities: [], relations: [] }
      }
      throw error
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map((entity) => JSON.stringify({ type: 'entity', ...entity })),
      ...graph.relations.map((relation) => JSON.stringify({ type: 'relation', ...relation })),
    ]
    await fs.writeFile(MEMORY_FILE_PATH, lines.join('\n'))
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const graph = await this.loadGraph()
    const created = entities.filter((entity) => !graph.entities.some((existing) => existing.name === entity.name))
    graph.entities.push(...created)
    await this.saveGraph(graph)
    return created
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph()
    const created = relations.filter(
      (relation) =>
        !graph.relations.some(
          (existing) =>
            existing.from === relation.from &&
            existing.to === relation.to &&
            existing.relationType === relation.relationType,
        ),
    )
    graph.relations.push(...created)
    await this.saveGraph(graph)
    return created
  }

  async addObservations(
    observations: { entityName: string; contents: string[] }[],
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph()
    const results = observations.map((observation) => {
      const entity = graph.entities.find((candidate) => candidate.name === observation.entityName)
      if (!entity) throw new Error(`Entity with name ${observation.entityName} not found`)
      const addedObservations = observation.contents.filter((content) => !entity.observations.includes(content))
      entity.observations.push(...addedObservations)
      return { entityName: observation.entityName, addedObservations }
    })
    await this.saveGraph(graph)
    return results
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph()
    graph.entities = graph.entities.filter((entity) => !entityNames.includes(entity.name))
    graph.relations = graph.relations.filter(
      (relation) => !entityNames.includes(relation.from) && !entityNames.includes(relation.to),
    )
    await this.saveGraph(graph)
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph()
    for (const deletion of deletions) {
      const entity = graph.entities.find((candidate) => candidate.name === deletion.entityName)
      if (entity) entity.observations = entity.observations.filter((value) => !deletion.observations.includes(value))
    }
    await this.saveGraph(graph)
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph()
    graph.relations = graph.relations.filter(
      (relation) =>
        !relations.some(
          (deletion) =>
            relation.from === deletion.from &&
            relation.to === deletion.to &&
            relation.relationType === deletion.relationType,
        ),
    )
    await this.saveGraph(graph)
  }

  async readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph()
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph()
    const normalizedQuery = query.toLowerCase()
    const entities = graph.entities.filter(
      (entity) =>
        entity.name.toLowerCase().includes(normalizedQuery) ||
        entity.entityType.toLowerCase().includes(normalizedQuery) ||
        entity.observations.some((observation) => observation.toLowerCase().includes(normalizedQuery)),
    )
    const names = new Set(entities.map((entity) => entity.name))
    return {
      entities,
      relations: graph.relations.filter((relation) => names.has(relation.from) && names.has(relation.to)),
    }
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph()
    const entities = graph.entities.filter((entity) => names.includes(entity.name))
    const selectedNames = new Set(entities.map((entity) => entity.name))
    return {
      entities,
      relations: graph.relations.filter(
        (relation) => selectedNames.has(relation.from) && selectedNames.has(relation.to),
      ),
    }
  }
}

const knowledgeGraphManager = new KnowledgeGraphManager()
const entitySchema = z.object({
  name: z.string().describe('The name of the entity'),
  entityType: z.string().describe('The type of the entity'),
  observations: z.array(z.string()).describe('Observation contents associated with the entity'),
})
const relationSchema = z.object({
  from: z.string().describe('The name of the entity where the relation starts'),
  to: z.string().describe('The name of the entity where the relation ends'),
  relationType: z.string().describe('The type of the relation'),
})

function textResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  }
}

function createServer(): McpServer {
  const server = new McpServer({ name: 'memory-server', version: '0.6.3' })

  server.registerTool(
    'create_entities',
    { description: 'Create multiple new entities in the knowledge graph', inputSchema: z.object({ entities: z.array(entitySchema) }) },
    async ({ entities }) => textResult(await knowledgeGraphManager.createEntities(entities)),
  )
  server.registerTool(
    'create_relations',
    {
      description: 'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice',
      inputSchema: z.object({ relations: z.array(relationSchema) }),
    },
    async ({ relations }) => textResult(await knowledgeGraphManager.createRelations(relations)),
  )
  server.registerTool(
    'add_observations',
    {
      description: 'Add new observations to existing entities in the knowledge graph',
      inputSchema: z.object({ observations: z.array(z.object({ entityName: z.string(), contents: z.array(z.string()) })) }),
    },
    async ({ observations }) => textResult(await knowledgeGraphManager.addObservations(observations)),
  )
  server.registerTool(
    'delete_entities',
    {
      description: 'Delete multiple entities and their associated relations from the knowledge graph',
      inputSchema: z.object({ entityNames: z.array(z.string()) }),
    },
    async ({ entityNames }) => {
      await knowledgeGraphManager.deleteEntities(entityNames)
      return textResult('Entities deleted successfully')
    },
  )
  server.registerTool(
    'delete_observations',
    {
      description: 'Delete specific observations from entities in the knowledge graph',
      inputSchema: z.object({ deletions: z.array(z.object({ entityName: z.string(), observations: z.array(z.string()) })) }),
    },
    async ({ deletions }) => {
      await knowledgeGraphManager.deleteObservations(deletions)
      return textResult('Observations deleted successfully')
    },
  )
  server.registerTool(
    'delete_relations',
    { description: 'Delete multiple relations from the knowledge graph', inputSchema: z.object({ relations: z.array(relationSchema) }) },
    async ({ relations }) => {
      await knowledgeGraphManager.deleteRelations(relations)
      return textResult('Relations deleted successfully')
    },
  )
  server.registerTool('read_graph', { description: 'Read the entire knowledge graph' }, async () =>
    textResult(await knowledgeGraphManager.readGraph()),
  )
  server.registerTool(
    'search_nodes',
    {
      description: 'Search for nodes in the knowledge graph based on a query',
      inputSchema: z.object({ query: z.string().describe('The search query to match against entity names, types, and observations') }),
    },
    async ({ query }) => textResult(await knowledgeGraphManager.searchNodes(query)),
  )
  server.registerTool(
    'open_nodes',
    {
      description: 'Open specific nodes in the knowledge graph by their names',
      inputSchema: z.object({ names: z.array(z.string()).describe('An array of entity names to retrieve') }),
    },
    async ({ names }) => textResult(await knowledgeGraphManager.openNodes(names)),
  )
  return server
}

function main(): void {
  serveStdio(createServer, {
    onerror: (error) => console.error('MCP stdio transport error:', error),
  })
  console.error('Knowledge Graph MCP Server running on stdio')
}

try {
  main()
} catch (error) {
  console.error('Fatal error in main():', error)
  process.exit(1)
}
