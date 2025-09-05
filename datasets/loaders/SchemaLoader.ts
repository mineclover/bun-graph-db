import { readdir, readFile } from 'fs/promises'
import { extname, join } from 'path'
import type { DomainSchema, LoaderOptions } from './types/DatasetTypes.js'

export class SchemaLoader {
  private cache: Map<string, DomainSchema> = new Map()
  private readonly basePath: string

  constructor(basePath = 'datasets/schemas') {
    this.basePath = basePath
  }

  async loadDomainSchema(
    domain: string,
    schemaName = 'base-schema',
    options: LoaderOptions = {}
  ): Promise<DomainSchema> {
    const cacheKey = `${domain}/${schemaName}`

    if (options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const schemaPath = join(this.basePath, 'domains', domain, `${schemaName}.json`)

    try {
      const content = await readFile(schemaPath, 'utf-8')
      const schema: DomainSchema = JSON.parse(content)

      if (options.validate) {
        this.validateSchema(schema)
      }

      if (options.cache) {
        this.cache.set(cacheKey, schema)
      }

      return schema
    } catch (error) {
      throw new Error(
        `Failed to load schema ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async loadBaseSchema(schemaName: string, options: LoaderOptions = {}): Promise<DomainSchema> {
    const cacheKey = `base/${schemaName}`

    if (options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const schemaPath = join(this.basePath, 'base', `${schemaName}.json`)

    try {
      const content = await readFile(schemaPath, 'utf-8')
      const schema: DomainSchema = JSON.parse(content)

      if (options.validate) {
        this.validateSchema(schema)
      }

      if (options.cache) {
        this.cache.set(cacheKey, schema)
      }

      return schema
    } catch (error) {
      throw new Error(
        `Failed to load base schema ${schemaName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async listAvailableSchemas(): Promise<{
    domains: Record<string, string[]>
    base: string[]
    templates: string[]
  }> {
    const result = {
      domains: {} as Record<string, string[]>,
      base: [] as string[],
      templates: [] as string[],
    }

    try {
      // Load domain schemas
      const domainDirs = await readdir(join(this.basePath, 'domains'), { withFileTypes: true })
      for (const dir of domainDirs.filter((d) => d.isDirectory())) {
        const schemaFiles = await readdir(join(this.basePath, 'domains', dir.name))
        result.domains[dir.name] = schemaFiles
          .filter((f) => extname(f) === '.json')
          .map((f) => f.replace('.json', ''))
      }

      // Load base schemas
      try {
        const baseFiles = await readdir(join(this.basePath, 'base'))
        result.base = baseFiles
          .filter((f) => extname(f) === '.json')
          .map((f) => f.replace('.json', ''))
      } catch (error) {
        // Base directory might not exist
      }

      // Load template schemas
      try {
        const templateFiles = await readdir(join(this.basePath, 'templates'))
        result.templates = templateFiles
          .filter((f) => extname(f) === '.json')
          .map((f) => f.replace('.json', ''))
      } catch (error) {
        // Templates directory might not exist
      }
    } catch (error) {
      throw new Error(
        `Failed to list schemas: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return result
  }

  async mergeSchemas(schemas: DomainSchema[]): Promise<DomainSchema> {
    if (schemas.length === 0) {
      throw new Error('No schemas provided for merging')
    }

    const merged: DomainSchema = {
      version: '1.0',
      name: 'Merged Schema',
      description: `Merged from ${schemas.length} schemas`,
      tables: [],
      relationTypes: [],
    }

    const tableMap = new Map<string, any>()
    const relationTypeMap = new Map<string, any>()

    for (const schema of schemas) {
      // Merge tables
      for (const table of schema.tables) {
        if (!tableMap.has(table.identifier)) {
          tableMap.set(table.identifier, table)
        } else {
          // Merge attributes if table already exists
          const existing = tableMap.get(table.identifier)
          const existingAttributeIds = new Set(existing.attributes.map((a: any) => a.identifier))

          for (const attr of table.attributes) {
            if (!existingAttributeIds.has(attr.identifier)) {
              existing.attributes.push(attr)
            }
          }
        }
      }

      // Merge relation types
      for (const relationType of schema.relationTypes) {
        if (!relationTypeMap.has(relationType.identifier)) {
          relationTypeMap.set(relationType.identifier, relationType)
        }
      }
    }

    merged.tables = Array.from(tableMap.values())
    merged.relationTypes = Array.from(relationTypeMap.values())

    return merged
  }

  private validateSchema(schema: DomainSchema): void {
    if (!schema.version || !schema.name || !schema.tables) {
      throw new Error('Invalid schema: missing required fields (version, name, tables)')
    }

    if (!Array.isArray(schema.tables) || schema.tables.length === 0) {
      throw new Error('Invalid schema: tables must be a non-empty array')
    }

    // Validate tables
    const tableIds = new Set<string>()
    for (const table of schema.tables) {
      if (!table.identifier || !table.name || !table.attributes) {
        throw new Error(`Invalid table: missing required fields`)
      }

      if (tableIds.has(table.identifier)) {
        throw new Error(`Duplicate table identifier: ${table.identifier}`)
      }
      tableIds.add(table.identifier)

      // Validate attributes
      const attributeIds = new Set<string>()
      for (const attr of table.attributes) {
        if (!attr.identifier || !attr.name || !attr.dataType) {
          throw new Error(`Invalid attribute in table ${table.identifier}: missing required fields`)
        }

        if (attributeIds.has(attr.identifier)) {
          throw new Error(
            `Duplicate attribute identifier ${attr.identifier} in table ${table.identifier}`
          )
        }
        attributeIds.add(attr.identifier)
      }
    }

    // Validate relation types
    if (schema.relationTypes) {
      const relationTypeIds = new Set<string>()
      for (const relationType of schema.relationTypes) {
        if (!relationType.identifier || !relationType.sourceTable || !relationType.targetTable) {
          throw new Error('Invalid relation type: missing required fields')
        }

        if (relationTypeIds.has(relationType.identifier)) {
          throw new Error(`Duplicate relation type identifier: ${relationType.identifier}`)
        }
        relationTypeIds.add(relationType.identifier)

        // Validate table references
        if (!tableIds.has(relationType.sourceTable)) {
          throw new Error(
            `Relation type ${relationType.identifier} references unknown source table: ${relationType.sourceTable}`
          )
        }

        if (!tableIds.has(relationType.targetTable)) {
          throw new Error(
            `Relation type ${relationType.identifier} references unknown target table: ${relationType.targetTable}`
          )
        }
      }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
