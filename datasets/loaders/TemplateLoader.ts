import { readdir, readFile } from 'fs/promises'
import { extname, join } from 'path'
import type {
  LoaderOptions,
  QueryTemplate,
  TemplateCollection,
  TemplateType,
} from './types/DatasetTypes.js'

export class TemplateLoader {
  private cache: Map<string, TemplateCollection> = new Map()
  private readonly basePath: string

  constructor(basePath = 'datasets/templates') {
    this.basePath = basePath
  }

  async loadTemplateCollection(
    type: TemplateType,
    collectionName: string,
    options: LoaderOptions = {}
  ): Promise<TemplateCollection> {
    const cacheKey = `${type}/${collectionName}`

    if (options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const templatePath = join(this.basePath, type, `${collectionName}.json`)

    try {
      const content = await readFile(templatePath, 'utf-8')
      const collection: TemplateCollection = JSON.parse(content)

      if (options.validate) {
        this.validateTemplateCollection(collection)
      }

      if (options.cache) {
        this.cache.set(cacheKey, collection)
      }

      return collection
    } catch (error) {
      throw new Error(
        `Failed to load template collection ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async loadTemplatesByDomain(
    domain: string,
    options: LoaderOptions = {}
  ): Promise<QueryTemplate[]> {
    const templates: QueryTemplate[] = []

    try {
      const types: TemplateType[] = ['queries', 'mutations', 'subscriptions', 'complex']

      for (const type of types) {
        try {
          const typeDir = join(this.basePath, type)
          const files = await readdir(typeDir)

          for (const file of files) {
            if (extname(file) === '.json' && file.includes(domain)) {
              const collectionName = file.replace('.json', '')
              const collection = await this.loadTemplateCollection(type, collectionName, options)
              templates.push(...collection.templates)
            }
          }
        } catch (error) {
          // Skip if directory doesn't exist
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to load templates for domain ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return templates
  }

  async searchTemplates(
    criteria: {
      tags?: string[]
      templateType?: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
      domain?: string
      complexityRange?: { min?: number; max?: number }
      textSearch?: string
    },
    options: LoaderOptions = {}
  ): Promise<QueryTemplate[]> {
    const allTemplates: QueryTemplate[] = []

    // Load all templates
    const types: TemplateType[] = ['queries', 'mutations', 'subscriptions', 'complex']

    for (const type of types) {
      try {
        const typeDir = join(this.basePath, type)
        const files = await readdir(typeDir)

        for (const file of files) {
          if (extname(file) === '.json') {
            const collectionName = file.replace('.json', '')
            const collection = await this.loadTemplateCollection(type, collectionName, options)
            allTemplates.push(...collection.templates)
          }
        }
      } catch (error) {
        // Skip if directory doesn't exist
      }
    }

    // Filter based on criteria
    return allTemplates.filter((template) => {
      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        const hasRequiredTags = criteria.tags.some((tag) => template.tags.includes(tag))
        if (!hasRequiredTags) return false
      }

      // Filter by template type
      if (criteria.templateType && template.templateType !== criteria.templateType) {
        return false
      }

      // Filter by domain (check in tags or collection name)
      if (criteria.domain) {
        const hasDomain =
          template.tags.includes(criteria.domain) ||
          (template.applicableTables &&
            template.applicableTables.some((table) => table.includes(criteria.domain!)))
        if (!hasDomain) return false
      }

      // Filter by complexity range
      if (criteria.complexityRange) {
        if (
          criteria.complexityRange.min !== undefined &&
          template.complexityScore < criteria.complexityRange.min
        ) {
          return false
        }
        if (
          criteria.complexityRange.max !== undefined &&
          template.complexityScore > criteria.complexityRange.max
        ) {
          return false
        }
      }

      // Filter by text search
      if (criteria.textSearch) {
        const searchText = criteria.textSearch.toLowerCase()
        const searchableText =
          `${template.name} ${template.description} ${template.queryText}`.toLowerCase()
        if (!searchableText.includes(searchText)) {
          return false
        }
      }

      return true
    })
  }

  async getTemplatesByComplexity(
    complexityLevel: 'simple' | 'moderate' | 'complex' | 'advanced',
    options: LoaderOptions = {}
  ): Promise<QueryTemplate[]> {
    const complexityRanges = {
      simple: { min: 1, max: 3 },
      moderate: { min: 3, max: 5 },
      complex: { min: 5, max: 7 },
      advanced: { min: 7, max: 10 },
    }

    return this.searchTemplates(
      {
        complexityRange: complexityRanges[complexityLevel],
      },
      options
    )
  }

  async listAvailableTemplates(): Promise<Record<TemplateType, string[]>> {
    const result: Record<string, string[]> = {
      queries: [],
      mutations: [],
      subscriptions: [],
      complex: [],
    }

    try {
      const types: TemplateType[] = ['queries', 'mutations', 'subscriptions', 'complex']

      for (const type of types) {
        try {
          const typeDir = join(this.basePath, type)
          const files = await readdir(typeDir)
          result[type] = files
            .filter((f) => extname(f) === '.json')
            .map((f) => f.replace('.json', ''))
        } catch (error) {
          // Directory doesn't exist, keep empty array
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to list templates: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return result as Record<TemplateType, string[]>
  }

  async getTemplateStats(): Promise<{
    totalTemplates: number
    byType: Record<string, number>
    byComplexity: Record<number, number>
    mostCommonTags: Array<{ tag: string; count: number }>
    averageComplexity: number
  }> {
    const allTemplates: QueryTemplate[] = []

    // Load all templates
    const types: TemplateType[] = ['queries', 'mutations', 'subscriptions', 'complex']

    for (const type of types) {
      try {
        const typeDir = join(this.basePath, type)
        const files = await readdir(typeDir)

        for (const file of files) {
          if (extname(file) === '.json') {
            const collectionName = file.replace('.json', '')
            const collection = await this.loadTemplateCollection(type, collectionName, {
              cache: true,
            })
            allTemplates.push(...collection.templates)
          }
        }
      } catch (error) {
        // Skip if directory doesn't exist
      }
    }

    // Calculate statistics
    const stats = {
      totalTemplates: allTemplates.length,
      byType: {} as Record<string, number>,
      byComplexity: {} as Record<number, number>,
      mostCommonTags: [] as Array<{ tag: string; count: number }>,
      averageComplexity: 0,
    }

    // Count by type
    for (const template of allTemplates) {
      stats.byType[template.templateType] = (stats.byType[template.templateType] || 0) + 1
    }

    // Count by complexity
    for (const template of allTemplates) {
      stats.byComplexity[template.complexityScore] =
        (stats.byComplexity[template.complexityScore] || 0) + 1
    }

    // Count tags
    const tagCounts = new Map<string, number>()
    for (const template of allTemplates) {
      for (const tag of template.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    stats.mostCommonTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate average complexity
    const totalComplexity = allTemplates.reduce((sum, t) => sum + t.complexityScore, 0)
    stats.averageComplexity = allTemplates.length > 0 ? totalComplexity / allTemplates.length : 0

    return stats
  }

  private validateTemplateCollection(collection: TemplateCollection): void {
    if (!collection.version || !collection.name || !collection.templates) {
      throw new Error(
        'Invalid template collection: missing required fields (version, name, templates)'
      )
    }

    if (!Array.isArray(collection.templates)) {
      throw new Error('Invalid template collection: templates must be an array')
    }

    const templateIds = new Set<string>()

    for (const template of collection.templates) {
      if (!template.identifier || !template.name || !template.queryText || !template.templateType) {
        throw new Error('Invalid template: missing required fields')
      }

      if (templateIds.has(template.identifier)) {
        throw new Error(`Duplicate template identifier: ${template.identifier}`)
      }
      templateIds.add(template.identifier)

      if (!['QUERY', 'MUTATION', 'SUBSCRIPTION'].includes(template.templateType)) {
        throw new Error(`Invalid template type: ${template.templateType}`)
      }

      if (!Array.isArray(template.tags)) {
        throw new Error(`Template ${template.identifier}: tags must be an array`)
      }

      if (
        typeof template.complexityScore !== 'number' ||
        template.complexityScore < 1 ||
        template.complexityScore > 10
      ) {
        throw new Error(
          `Template ${template.identifier}: complexityScore must be a number between 1 and 10`
        )
      }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
