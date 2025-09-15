import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DatasetSize,
  DomainFixtures,
  DomainType,
  LoaderOptions,
} from './types/DatasetTypes.js'

export class FixtureLoader {
  private cache: Map<string, DomainFixtures> = new Map()
  private readonly basePath: string

  constructor(basePath = 'datasets/fixtures') {
    this.basePath = basePath
  }

  async loadFixtures(
    domain: DomainType,
    size: DatasetSize,
    fixtureSet = 'sample-data',
    options: LoaderOptions = {}
  ): Promise<DomainFixtures> {
    const cacheKey = `${domain}/${size}/${fixtureSet}`

    if (options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const fixturePath = join(this.basePath, domain, size, `${fixtureSet}.json`)

    try {
      const content = await readFile(fixturePath, 'utf-8')
      const fixtures: DomainFixtures = JSON.parse(content)

      if (options.validate) {
        this.validateFixtures(fixtures)
      }

      if (options.cache) {
        this.cache.set(cacheKey, fixtures)
      }

      return fixtures
    } catch (error) {
      throw new Error(
        `Failed to load fixtures ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async loadMultipleFixtures(
    domain: DomainType,
    sizes: DatasetSize[],
    fixtureSet = 'sample-data',
    options: LoaderOptions = {}
  ): Promise<Record<DatasetSize, DomainFixtures>> {
    const result: Record<string, DomainFixtures> = {}

    const loadPromises = sizes.map(async (size) => {
      const fixtures = await this.loadFixtures(domain, size, fixtureSet, options)
      result[size] = fixtures
    })

    await Promise.all(loadPromises)
    return result as Record<DatasetSize, DomainFixtures>
  }

  async listAvailableFixtures(): Promise<Record<DomainType, Record<DatasetSize, string[]>>> {
    const result = {} as Record<DomainType, Record<DatasetSize, string[]>>

    try {
      const domainDirs = await readdir(this.basePath, { withFileTypes: true })

      for (const domainDir of domainDirs.filter((d) => d.isDirectory())) {
        const domain = domainDir.name as DomainType
        result[domain] = {} as Record<DatasetSize, string[]>

        const sizeDirs = await readdir(join(this.basePath, domain), { withFileTypes: true })

        for (const sizeDir of sizeDirs.filter((d) => d.isDirectory())) {
          const size = sizeDir.name as DatasetSize
          const fixtureFiles = await readdir(join(this.basePath, domain, size))

          result[domain][size] = fixtureFiles
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.replace('.json', ''))
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to list fixtures: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return result
  }

  async mergeFixtures(fixtures: DomainFixtures[]): Promise<DomainFixtures> {
    if (fixtures.length === 0) {
      throw new Error('No fixtures provided for merging')
    }

    const firstFixture = fixtures[0]
    if (!firstFixture) {
      throw new Error('First fixture is undefined')
    }

    const merged: DomainFixtures = {
      version: '1.0',
      domain: firstFixture.domain,
      size: 'large', // Merged is typically large
      tables: {},
      relations: [],
      metadata: {
        totalNodes: 0,
        totalRelations: 0,
        generated: new Date().toISOString(),
        description: `Merged from ${fixtures.length} fixture sets`,
      },
    }

    for (const fixture of fixtures) {
      // Merge tables
      for (const [tableName, nodes] of Object.entries(fixture.tables)) {
        if (!merged.tables[tableName]) {
          merged.tables[tableName] = []
        }
        merged.tables[tableName].push(...nodes)
      }

      // Merge relations
      merged.relations.push(...fixture.relations)

      // Update metadata
      merged.metadata.totalNodes += fixture.metadata.totalNodes
      merged.metadata.totalRelations += fixture.metadata.totalRelations
    }

    return merged
  }

  async getFixtureStats(
    domain: DomainType,
    size: DatasetSize,
    fixtureSet = 'sample-data'
  ): Promise<{
    totalNodes: number
    totalRelations: number
    nodesByTable: Record<string, number>
    relationsByType: Record<string, number>
    averageNodesPerTable: number
    relationDensity: number
  }> {
    const fixtures = await this.loadFixtures(domain, size, fixtureSet, { cache: true })

    const stats = {
      totalNodes: fixtures.metadata.totalNodes,
      totalRelations: fixtures.metadata.totalRelations,
      nodesByTable: {} as Record<string, number>,
      relationsByType: {} as Record<string, number>,
      averageNodesPerTable: 0,
      relationDensity: 0,
    }

    // Count nodes by table
    for (const [tableName, nodes] of Object.entries(fixtures.tables)) {
      stats.nodesByTable[tableName] = nodes.length
    }

    // Count relations by type
    for (const relation of fixtures.relations) {
      const relType = relation.relationTypeIdentifier
      stats.relationsByType[relType] = (stats.relationsByType[relType] || 0) + 1
    }

    // Calculate averages
    const tableCount = Object.keys(fixtures.tables).length
    stats.averageNodesPerTable = tableCount > 0 ? stats.totalNodes / tableCount : 0
    stats.relationDensity = stats.totalNodes > 0 ? stats.totalRelations / stats.totalNodes : 0

    return stats
  }

  private validateFixtures(fixtures: DomainFixtures): void {
    if (!fixtures.version || !fixtures.domain || !fixtures.size || !fixtures.tables) {
      throw new Error('Invalid fixtures: missing required fields (version, domain, size, tables)')
    }

    if (!['small', 'medium', 'large', 'enterprise'].includes(fixtures.size)) {
      throw new Error(`Invalid fixture size: ${fixtures.size}`)
    }

    // Validate tables
    for (const [tableName, nodes] of Object.entries(fixtures.tables)) {
      if (!Array.isArray(nodes)) {
        throw new Error(`Invalid table ${tableName}: nodes must be an array`)
      }

      for (const node of nodes) {
        if (!node.content) {
          throw new Error(`Invalid node in table ${tableName}: missing content`)
        }
      }
    }

    // Validate relations
    if (fixtures.relations && Array.isArray(fixtures.relations)) {
      for (const relation of fixtures.relations) {
        if (
          !relation.sourceNodeContent ||
          !relation.targetNodeContent ||
          !relation.relationTypeIdentifier
        ) {
          throw new Error('Invalid relation: missing required fields')
        }
      }
    }

    // Validate metadata
    if (!fixtures.metadata || typeof fixtures.metadata.totalNodes !== 'number') {
      throw new Error('Invalid fixtures: missing or invalid metadata')
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
