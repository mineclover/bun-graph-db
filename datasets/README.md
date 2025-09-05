# Dataset Management for Graph DB Template Testing

## Overview
This directory contains structured datasets for testing GraphQL query templates at scale. The organization supports multiple domains, data sizes, and testing scenarios.

## Directory Structure

```
datasets/
├── schemas/                    # Table and attribute definitions
│   ├── domains/               # Domain-specific schemas
│   │   ├── ecommerce/         # E-commerce domain (products, orders, users)
│   │   ├── social/            # Social network domain (users, posts, relationships)
│   │   ├── enterprise/        # Enterprise domain (projects, tasks, teams)
│   │   └── knowledge/         # Knowledge graph domain (concepts, relations)
│   ├── base/                  # Reusable base schemas
│   └── templates/             # Schema templates for generation
│
├── fixtures/                  # Test data by domain and size
│   ├── ecommerce/
│   │   ├── small/             # 100-1K records per table
│   │   ├── medium/            # 1K-10K records per table
│   │   ├── large/             # 10K-100K records per table
│   │   └── enterprise/        # 100K+ records per table
│   ├── social/
│   ├── enterprise/
│   └── knowledge/
│
├── templates/                 # Template definitions by domain
│   ├── queries/               # Query templates
│   ├── mutations/             # Mutation templates
│   ├── subscriptions/         # Subscription templates
│   └── complex/               # Multi-operation templates
│
├── loaders/                   # Data loading utilities
│   ├── generators/            # Data generators
│   ├── importers/            # Import utilities
│   └── validators/           # Data validation tools
│
├── benchmarks/               # Performance test data
│   ├── query-performance/    # Query performance datasets
│   ├── mutation-stress/      # High-volume mutation tests
│   └── concurrent-access/    # Concurrency test scenarios
│
└── utils/                    # Dataset utilities
    ├── cleanup/              # Cleanup scripts
    ├── migration/            # Data migration tools
    └── analysis/             # Dataset analysis tools
```

## Data Size Categories

- **Small**: 100-1,000 records per table (development/unit tests)
- **Medium**: 1,000-10,000 records per table (integration tests)
- **Large**: 10,000-100,000 records per table (performance tests)
- **Enterprise**: 100,000+ records per table (stress tests)

## Domain Categories

### E-commerce
- Tables: products, users, orders, categories, reviews
- Relations: user-orders, order-products, product-reviews
- Use cases: Product catalogs, order management, recommendation systems

### Social Network
- Tables: users, posts, comments, groups, events
- Relations: user-follows, post-likes, group-memberships
- Use cases: Social graphs, content feeds, engagement analytics

### Enterprise
- Tables: projects, tasks, teams, employees, departments
- Relations: project-teams, task-assignments, employee-departments
- Use cases: Project management, resource allocation, organizational charts

### Knowledge Graph
- Tables: concepts, documents, authors, topics
- Relations: concept-relationships, document-citations, author-collaborations
- Use cases: Knowledge discovery, semantic search, research networks

## Usage Examples

### Loading a Domain Schema
```typescript
import { loadSchema } from './loaders/schema-loader'
const schema = await loadSchema('ecommerce/complete')
```

### Loading Test Fixtures
```typescript
import { loadFixtures } from './loaders/fixture-loader'
const data = await loadFixtures('ecommerce/medium')
```

### Template Testing
```typescript
import { loadTemplates } from './loaders/template-loader'
const templates = await loadTemplates('queries/ecommerce')
```