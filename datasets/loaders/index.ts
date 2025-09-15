// Main entry point for dataset loaders

import { FixtureLoader } from './FixtureLoader.js'
import { DataGenerator } from './generators/DataGenerator.js'
import { SchemaLoader } from './SchemaLoader.js'
import { TemplateLoader } from './TemplateLoader.js'
import type {
  AttributeSchema,
  DatasetSize,
  DomainFixtures,
  DomainSchema,
  DomainType,
  FixtureNode,
  FixtureRelation,
  GeneratorOptions,
  LoaderOptions,
  QueryTemplate,
  RelationTypeSchema,
  TableSchema,
  TemplateCollection,
  TemplateType,
} from './types/DatasetTypes.js'

export { SchemaLoader, FixtureLoader, TemplateLoader, DataGenerator }

// Re-export types
export type {
  DomainSchema,
  TableSchema,
  AttributeSchema,
  RelationTypeSchema,
  DomainFixtures,
  FixtureNode,
  FixtureRelation,
  QueryTemplate,
  TemplateCollection,
  DatasetSize,
  DomainType,
  TemplateType,
  LoaderOptions,
  GeneratorOptions,
}

// Convenience factory class
export class DatasetManager {
  public readonly schemas: SchemaLoader
  public readonly fixtures: FixtureLoader
  public readonly templates: TemplateLoader
  public readonly generator: DataGenerator

  constructor(basePath = 'datasets') {
    this.schemas = new SchemaLoader(`${basePath}/schemas`)
    this.fixtures = new FixtureLoader(`${basePath}/fixtures`)
    this.templates = new TemplateLoader(`${basePath}/templates`)
    this.generator = new DataGenerator()
  }

  // Convenience method to load complete domain setup
  async loadDomainSetup(domain: DomainType, size: DatasetSize = 'small') {
    const [schema, fixtures, templates] = await Promise.all([
      this.schemas.loadDomainSchema(domain, 'base-schema', { cache: true }),
      this.fixtures.loadFixtures(domain, size, 'sample-data', { cache: true }),
      this.templates.loadTemplatesByDomain(domain, { cache: true }),
    ])

    return { schema, fixtures, templates }
  }

  // Convenience method to generate and save new datasets
  async generateDataset(options: GeneratorOptions, savePath?: string) {
    const fixtures = await this.generator.generateDomainFixtures(options)

    if (savePath) {
      const fs = await import('node:fs/promises')
      await fs.writeFile(savePath, JSON.stringify(fixtures, null, 2))
    }

    return fixtures
  }

  clearAllCaches() {
    this.schemas.clearCache()
    this.fixtures.clearCache()
    this.templates.clearCache()
  }
}
