import type {
  DatasetSize,
  DomainFixtures,
  DomainType,
  FixtureNode,
  FixtureRelation,
  GeneratorOptions,
} from '../types/DatasetTypes.js'

export class DataGenerator {
  private readonly domains: Record<DomainType, DomainConfig> = {
    ecommerce: {
      tables: {
        users: { ratio: 0.15, relationWeight: 0.8 },
        products: { ratio: 0.4, relationWeight: 0.6 },
        orders: { ratio: 0.25, relationWeight: 0.9 },
        categories: { ratio: 0.05, relationWeight: 0.4 },
        reviews: { ratio: 0.15, relationWeight: 0.7 },
      },
      relations: {
        'user-orders': { density: 3.5, strength: 0.9 },
        'order-products': { density: 2.8, strength: 0.8 },
        'product-reviews': { density: 1.2, strength: 0.6 },
        'product-categories': { density: 0.8, strength: 0.9 },
        'user-reviews': { density: 0.5, strength: 0.7 },
      },
    },
    social: {
      tables: {
        users: { ratio: 0.3, relationWeight: 0.9 },
        posts: { ratio: 0.35, relationWeight: 0.8 },
        comments: { ratio: 0.25, relationWeight: 0.7 },
        groups: { ratio: 0.05, relationWeight: 0.6 },
        events: { ratio: 0.05, relationWeight: 0.5 },
      },
      relations: {
        'user-follows': { density: 15.0, strength: 0.6 },
        'user-posts': { density: 8.0, strength: 0.9 },
        'post-comments': { density: 4.5, strength: 0.8 },
        'user-groups': { density: 2.0, strength: 0.7 },
        'group-events': { density: 1.5, strength: 0.8 },
      },
    },
    enterprise: {
      tables: {
        employees: { ratio: 0.25, relationWeight: 0.8 },
        projects: { ratio: 0.2, relationWeight: 0.9 },
        tasks: { ratio: 0.4, relationWeight: 0.7 },
        departments: { ratio: 0.05, relationWeight: 0.6 },
        teams: { ratio: 0.1, relationWeight: 0.8 },
      },
      relations: {
        'employee-departments': { density: 1.2, strength: 0.9 },
        'project-teams': { density: 2.5, strength: 0.8 },
        'task-assignments': { density: 3.0, strength: 0.9 },
        'employee-projects': { density: 2.8, strength: 0.7 },
        'team-tasks': { density: 4.0, strength: 0.8 },
      },
    },
    knowledge: {
      tables: {
        concepts: { ratio: 0.3, relationWeight: 0.8 },
        documents: { ratio: 0.25, relationWeight: 0.7 },
        authors: { ratio: 0.15, relationWeight: 0.6 },
        topics: { ratio: 0.2, relationWeight: 0.5 },
        keywords: { ratio: 0.1, relationWeight: 0.4 },
      },
      relations: {
        'concept-relationships': { density: 5.0, strength: 0.7 },
        'document-citations': { density: 3.5, strength: 0.8 },
        'author-collaborations': { density: 2.0, strength: 0.6 },
        'document-topics': { density: 4.0, strength: 0.9 },
        'concept-keywords': { density: 6.0, strength: 0.5 },
      },
    },
  }

  private readonly sizeMultipliers: Record<DatasetSize, number> = {
    small: 100,
    medium: 1000,
    large: 10000,
    enterprise: 100000,
  }

  async generateDomainFixtures(options: GeneratorOptions): Promise<DomainFixtures> {
    const { size, domain, seed = 42 } = options

    // Set up deterministic random generator
    this.seed = seed

    const config = this.domains[domain]
    if (!config) {
      throw new Error(`Unknown domain: ${domain}`)
    }

    const baseCount = this.sizeMultipliers[size]
    const fixtures: DomainFixtures = {
      version: '1.0',
      domain,
      size,
      tables: {},
      relations: [],
      metadata: {
        totalNodes: 0,
        totalRelations: 0,
        generated: new Date().toISOString(),
        description: `Generated ${size} dataset for ${domain} domain`,
      },
    }

    // Generate nodes for each table
    const nodesByTable: Record<string, FixtureNode[]> = {}
    let totalNodes = 0

    for (const [tableName, tableConfig] of Object.entries(config.tables)) {
      const nodeCount = Math.floor(baseCount * tableConfig.ratio)
      const nodes = this.generateNodesForTable(tableName, nodeCount, domain)

      nodesByTable[tableName] = nodes
      fixtures.tables[tableName] = nodes
      totalNodes += nodeCount
    }

    // Generate relations
    const relations: FixtureRelation[] = []

    for (const [relationIdentifier, relationConfig] of Object.entries(config.relations)) {
      const [sourceTable, targetTable] = this.parseRelationIdentifier(relationIdentifier)

      if (nodesByTable[sourceTable] && nodesByTable[targetTable]) {
        const relationCount = Math.floor(
          Math.min(nodesByTable[sourceTable].length, nodesByTable[targetTable].length) *
            relationConfig.density
        )

        const tableRelations = this.generateRelations(
          nodesByTable[sourceTable],
          nodesByTable[targetTable],
          relationIdentifier,
          relationCount,
          relationConfig.strength
        )

        relations.push(...tableRelations)
      }
    }

    fixtures.relations = relations
    fixtures.metadata.totalNodes = totalNodes
    fixtures.metadata.totalRelations = relations.length

    return fixtures
  }

  private generateNodesForTable(
    tableName: string,
    count: number,
    domain: DomainType
  ): FixtureNode[] {
    const nodes: FixtureNode[] = []
    const generators = this.getNodeGenerators(domain, tableName)

    for (let i = 0; i < count; i++) {
      const node: FixtureNode = {
        content: generators.content(i),
        title: generators.title?.(i),
        description: generators.description?.(i),
        attributes: generators.attributes?.(i),
        metadata: {
          weight: this.randomFloat(0.1, 1.0),
          importance: this.randomInt(1, 10),
          tags: generators.tags?.(i) || [],
        },
      }

      nodes.push(node)
    }

    return nodes
  }

  private generateRelations(
    sourceNodes: FixtureNode[],
    targetNodes: FixtureNode[],
    relationTypeIdentifier: string,
    count: number,
    baseStrength: number
  ): FixtureRelation[] {
    const relations: FixtureRelation[] = []
    const usedPairs = new Set<string>()

    for (let i = 0; i < count; i++) {
      let attempts = 0
      let sourceNode: FixtureNode | undefined
      let targetNode: FixtureNode | undefined
      let pairKey: string | undefined

      // Find unique pair
      do {
        const sourceIndex = this.randomInt(0, sourceNodes.length - 1)
        const targetIndex = this.randomInt(0, targetNodes.length - 1)
        const selectedSource = sourceNodes[sourceIndex]
        const selectedTarget = targetNodes[targetIndex]

        if (!selectedSource || !selectedTarget) {
          attempts++
          continue
        }

        sourceNode = selectedSource
        targetNode = selectedTarget
        pairKey = `${sourceNode.content}:${targetNode.content}`
        attempts++
      } while (pairKey && usedPairs.has(pairKey) && attempts < 10)

      if (attempts < 10 && sourceNode && targetNode && pairKey) {
        usedPairs.add(pairKey)

        relations.push({
          sourceNodeContent: sourceNode.content,
          targetNodeContent: targetNode.content,
          relationTypeIdentifier,
          properties: {
            strength: Math.min(1.0, baseStrength + this.randomFloat(-0.2, 0.2)),
            confidence: this.randomFloat(0.6, 1.0),
          },
        })
      }
    }

    return relations
  }

  private getNodeGenerators(domain: DomainType, tableName: string): NodeGenerators {
    const generators: Record<DomainType, Record<string, NodeGenerators>> = {
      ecommerce: {
        users: {
          content: (i) => `user_${i.toString().padStart(6, '0')}`,
          title: (i) => `User ${i + 1}`,
          attributes: (i) => ({
            username: `user${i + 1}`,
            email: `user${i + 1}@example.com`,
            fullName: this.generateName(),
            role: this.randomChoice(['customer', 'admin', 'moderator']),
          }),
          tags: () => ['user', 'account'],
        },
        products: {
          content: (i) => `product_${i.toString().padStart(6, '0')}`,
          title: (_i) => this.generateProductName(),
          attributes: (_i) => ({
            name: this.generateProductName(),
            price: this.randomFloat(9.99, 999.99),
            category: this.randomChoice(['Electronics', 'Clothing', 'Books', 'Home', 'Sports']),
            stock: this.randomInt(0, 1000),
          }),
          tags: () => ['product', 'catalog'],
        },
        orders: {
          content: (i) => `order_${i.toString().padStart(8, '0')}`,
          title: (i) => `Order #${i + 1000}`,
          attributes: (i) => ({
            orderNumber: `ORD-${i + 1000}`,
            customerName: this.generateName(),
            totalAmount: this.randomFloat(19.99, 1999.99),
            status: this.randomChoice([
              'pending',
              'processing',
              'shipped',
              'delivered',
              'cancelled',
            ]),
          }),
          tags: () => ['order', 'transaction'],
        },
      },
      // Add other domain generators...
      social: {
        users: {
          content: (i) => `social_user_${i}`,
          title: (_i) => this.generateName(),
          attributes: (i) => ({
            username: `@user${i + 1}`,
            bio: this.generateBio(),
            followers: this.randomInt(0, 10000),
            following: this.randomInt(0, 1000),
          }),
        },
      },
      enterprise: {
        employees: {
          content: (i) => `emp_${i.toString().padStart(4, '0')}`,
          title: (_i) => this.generateName(),
          attributes: (i) => ({
            employeeId: `EMP${i + 1000}`,
            department: this.randomChoice(['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']),
            position: this.generateJobTitle(),
            salary: this.randomInt(40000, 150000),
          }),
        },
      },
      knowledge: {
        concepts: {
          content: (i) => `concept_${i}`,
          title: (_i) => this.generateConceptName(),
          attributes: (_i) => ({
            definition: this.generateDefinition(),
            domain: this.randomChoice(['Science', 'Technology', 'Arts', 'Philosophy', 'History']),
            complexity: this.randomInt(1, 10),
          }),
        },
      },
    }

    return (
      generators[domain]?.[tableName] || {
        content: (i) => `${tableName}_${i}`,
        title: (i) => `${tableName} ${i + 1}`,
      }
    )
  }

  private parseRelationIdentifier(identifier: string): [string, string] {
    const parts = identifier.split('-')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid relation identifier format: ${identifier}`)
    }
    return [parts[0], parts[1]]
  }

  // Random number generation with seed
  private seed: number = 42

  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  private randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min
  }

  private randomChoice<T>(choices: T[]): T {
    if (choices.length === 0) {
      throw new Error('Cannot choose from empty array')
    }
    const index = this.randomInt(0, choices.length - 1)
    const selected = choices[index]
    if (selected === undefined) {
      throw new Error('Selected item is undefined')
    }
    return selected
  }

  // Data generators
  private generateName(): string {
    const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa']
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
    ]
    return `${this.randomChoice(firstNames)} ${this.randomChoice(lastNames)}`
  }

  private generateProductName(): string {
    const adjectives = ['Premium', 'Deluxe', 'Professional', 'Smart', 'Ultra', 'Advanced']
    const nouns = ['Widget', 'Device', 'Tool', 'System', 'Solution', 'Kit', 'Set', 'Package']
    return `${this.randomChoice(adjectives)} ${this.randomChoice(nouns)} ${this.randomInt(1, 999)}`
  }

  private generateBio(): string {
    const bios = [
      'Software developer passionate about technology',
      'Digital marketing enthusiast and blogger',
      'Creative designer with an eye for detail',
      'Data scientist exploring AI and ML',
      'Entrepreneur building the future',
    ]
    return this.randomChoice(bios)
  }

  private generateJobTitle(): string {
    const titles = [
      'Software Engineer',
      'Product Manager',
      'Data Analyst',
      'UX Designer',
      'Marketing Manager',
      'Sales Representative',
      'HR Specialist',
      'Financial Analyst',
    ]
    return this.randomChoice(titles)
  }

  private generateConceptName(): string {
    const concepts = [
      'Machine Learning',
      'Quantum Computing',
      'Blockchain Technology',
      'Artificial Intelligence',
      'Cloud Computing',
      'Data Science',
      'Cybersecurity',
      'Internet of Things',
      'Virtual Reality',
    ]
    return this.randomChoice(concepts)
  }

  private generateDefinition(): string {
    return 'A comprehensive explanation of the concept and its applications in modern technology.'
  }
}

interface DomainConfig {
  tables: Record<string, { ratio: number; relationWeight: number }>
  relations: Record<string, { density: number; strength: number }>
}

interface NodeGenerators {
  content: (index: number) => string
  title?: (index: number) => string
  description?: (index: number) => string
  attributes?: (index: number) => Record<string, unknown>
  tags?: (index: number) => string[]
}
