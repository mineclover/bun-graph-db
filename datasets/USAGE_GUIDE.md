# Dataset Management Usage Guide

## Quick Start

### 1. Generate Sample Data
```bash
npm run dataset:generate
```

### 2. List Available Datasets
```bash
npm run dataset:list
npm run template:list
```

### 3. Get Dataset Statistics
```bash
npm run dataset:stats
npm run template:validate
```

### 4. Import Templates to Server
```bash
# Start server first
bun run dev

# In another terminal, import templates
npm run template:import
# or
npm run dataset:import
```

## Programming Usage

### Loading Datasets in Tests

```typescript
import { TestDatasetHelper } from '../test/helpers/dataset-helper.js'

// In your test file
const helper = TestDatasetHelper.getInstance()

// Load complete domain setup
const { schema, fixtures, templates } = await helper.loadDomainSetup('ecommerce', 'small')

// Setup test table and attributes
const { tableId, attributeIds } = await helper.setupTestTable(yoga, 'ecommerce')

// Create test nodes
const nodeIds = await helper.createTestNodes(yoga, tableId, [
  { content: 'Test Product', attributes: { product_name: 'Test', product_price: 99.99 } }
], attributeIds)
```

### Using Dataset Loaders Directly

```typescript
import { DatasetManager } from './datasets/loaders/index.js'

const manager = new DatasetManager()

// Load schema
const schema = await manager.schemas.loadDomainSchema('ecommerce', 'base-schema')

// Load fixtures
const fixtures = await manager.fixtures.loadFixtures('ecommerce', 'medium')

// Load templates
const templates = await manager.templates.loadTemplatesByDomain('ecommerce')

// Generate new data
const newFixtures = await manager.generator.generateDomainFixtures({
  domain: 'social',
  size: 'large',
  seed: 42
})
```

### Searching Templates

```typescript
// Search by criteria
const searchResults = await manager.templates.searchTemplates({
  tags: ['node-creation'],
  templateType: 'MUTATION',
  complexityRange: { min: 3, max: 7 }
})

// Get templates by complexity
const simpleTemplates = await manager.templates.getTemplatesByComplexity('simple')
```

## Dataset Structure

### Domains
- **ecommerce**: Products, users, orders, categories, reviews
- **social**: Users, posts, comments, groups, events  
- **enterprise**: Employees, projects, tasks, departments, teams
- **knowledge**: Concepts, documents, authors, topics, keywords

### Sizes
- **small**: 100-1,000 records per table
- **medium**: 1,000-10,000 records per table
- **large**: 10,000-100,000 records per table
- **enterprise**: 100,000+ records per table

### File Locations
```
datasets/
├── schemas/domains/{domain}/        # Domain schemas
├── fixtures/{domain}/{size}/        # Test fixtures
├── templates/{type}/                # Query templates
├── loaders/                         # Loading utilities
└── scripts/                         # Data generation scripts
```

## Template Management

### CLI Template Manager
```bash
# List all templates
npm run template:list

# Search for templates
bun datasets/scripts/template-manager.ts search "product"

# Check complexity distribution
npm run template:complexity

# Validate all templates
npm run template:validate

# Import all templates to server (requires running server)
npm run template:import
```

### Server Import Methods

#### Method 1: Bulk Import (Recommended)
```bash
# Start server
bun run dev

# Import all templates
npm run template:import
```

#### Method 2: Individual GraphQL Mutations
```graphql
mutation CreateTemplate($input: CreateQueryTemplateInput!) {
  createTemplate(input: $input) {
    success
    template {
      id
      identifier 
      name
    }
    errors {
      message
    }
  }
}
```

#### Method 3: Programmatic Import
```typescript
import { createTemplateOnServer } from './datasets/scripts/import-templates-to-server.js'

const result = await createTemplateOnServer(templateObject)
if (result.success) {
  console.log(`Imported: ${result.serverId}`)
}
```

## Advanced Usage

### Custom Data Generation

```typescript
import { DataGenerator } from './datasets/loaders/generators/DataGenerator.js'

const generator = new DataGenerator()

const customData = await generator.generateDomainFixtures({
  domain: 'ecommerce',
  size: 'medium',
  seed: 12345,
  customRatio: {
    nodes: { products: 0.6, users: 0.3, orders: 0.1 }
  }
})
```

### Template Management

```typescript
// Get template statistics
const stats = await manager.templates.getTemplateStats()
console.log(`Total templates: ${stats.totalTemplates}`)
console.log(`Average complexity: ${stats.averageComplexity}`)

// List available templates
const available = await manager.templates.listAvailableTemplates()
console.log('Query templates:', available.queries)
```

### Performance Testing

```typescript
// Load large datasets for performance testing
const largeFixtures = await manager.fixtures.loadFixtures('enterprise', 'large')
console.log(`Loaded ${largeFixtures.metadata.totalNodes} nodes for testing`)

// Get fixture statistics
const stats = await manager.fixtures.getFixtureStats('ecommerce', 'large')
console.log(`Relation density: ${stats.relationDensity}`)
```

## Best Practices

1. **Use appropriate sizes** for different test scenarios
2. **Cache frequently used datasets** with `{ cache: true }`
3. **Generate deterministic data** with fixed seeds for reproducible tests
4. **Clean up caches** in test cleanup to prevent memory leaks
5. **Validate data** with `{ validate: true }` in production environments

## Extending the System

### Adding New Domains

1. Create domain directory: `datasets/schemas/domains/my-domain/`
2. Add schema file: `base-schema.json`
3. Update `DataGenerator` with domain-specific generators
4. Update `TestDatasetHelper` with attribute configurations

### Creating Custom Templates

1. Create template collection in appropriate type directory
2. Follow the `QueryTemplate` interface specification  
3. Add validation and complexity scoring
4. Test with `TemplateLoader.loadTemplateCollection()`

### Performance Optimization

- Use caching for frequently accessed datasets
- Implement lazy loading for large fixtures
- Use database seeding for very large datasets
- Implement pagination for enterprise-size data