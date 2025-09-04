# Template-based Node Mutations - Quick Start

Complete implementation of GraphQL query templates for node creation with comprehensive testing and documentation.

## 🎯 What's Implemented

Template system allows users to:
- **Create reusable GraphQL mutation templates** for node creation
- **Store templates with metadata** (tags, schemas, usage tracking)
- **Execute templates with runtime variables** for dynamic node creation
- **Search templates by tags, tables, and criteria**
- **Track usage analytics and popular templates**

## 📁 Files Created

### Core Implementation (Already Complete)
- `src/domain/entities/QueryTemplate.ts` - Domain entity with business rules
- `src/domain/repositories/IQueryTemplateRepository.ts` - Repository interface
- `src/infrastructure/database/repositories/SQLiteQueryTemplateRepository.ts` - SQLite implementation
- `src/presentation/graphql/resolvers/QueryTemplateResolver.ts` - GraphQL resolvers
- `src/presentation/graphql/schemas/query-template.graphql` - GraphQL schema

### New Test & Documentation Files
- ✅ `tests/template-based-node-mutations.test.ts` - Comprehensive test suite
- ✅ `examples/sample-node-templates.ts` - 6 sample templates with usage examples
- ✅ `scripts/run-template-tests.ts` - Test runner with setup and demonstration
- ✅ `docs/template-workflow.md` - Complete documentation (50+ pages)
- ✅ `README-TEMPLATES.md` - This quick reference

## 🚀 Quick Start

### 1. Run Tests
```bash
# Run comprehensive test suite
bun test tests/template-based-node-mutations.test.ts

# Run with custom test runner (includes setup and demo)
bun run scripts/run-template-tests.ts
```

### 2. Explore Sample Templates
```bash
# View 6 sample templates for different domains
cat examples/sample-node-templates.ts

# Templates include:
# - User Profile Creation
# - Product Inventory Management  
# - Project Task Creation
# - Customer Order Processing
# - Event Registration
# - Blog Article Publishing
```

### 3. Read Full Documentation
```bash
# Complete workflow guide
open docs/template-workflow.md
```

## 🎯 Example Usage

### Create Template
```graphql
mutation CreateQueryTemplate($input: CreateQueryTemplateInput!) {
  createQueryTemplate(input: $input) {
    id
    identifier
    name
    tags
    usageCount
  }
}
```

### Search Templates
```graphql
query SearchTemplates($input: SearchTemplatesInput!) {
  searchTemplates(input: $input) {
    id
    identifier
    name
    tags
    templateType
    usageCount
  }
}
```

### Execute Template
```graphql
mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
  executeTemplate(input: $input)
}
```

## 📊 Test Coverage

The test suite covers:
- ✅ Template creation and validation
- ✅ Template search with tag filtering
- ✅ Template execution with variables
- ✅ Usage tracking and analytics
- ✅ Variable validation and error handling
- ✅ Popular templates retrieval
- ✅ Multiple node creation scenarios

## 🏗️ Architecture

```
GraphQL Layer → Application Layer → Domain Layer → Infrastructure Layer
     ↓              ↓                  ↓              ↓
 Resolvers    Template Execution   QueryTemplate   SQLite Repository
 Input/Output    Variable Processing   Entity        JSON Queries
 Type Defs       Usage Tracking      Business Rules   Indexes
```

## 📝 Sample Templates

1. **User Profile** - Personal information with validation
2. **Product Inventory** - E-commerce products with pricing
3. **Project Tasks** - Task management with assignments  
4. **Customer Orders** - Order processing with billing
5. **Event Registration** - Event attendee management
6. **Blog Articles** - Content publishing with SEO

## 🎉 Ready to Use!

The template system is fully implemented and tested. You can:
- Start the server: `bun run dev`
- Test templates: `bun run scripts/run-template-tests.ts`
- Explore examples: Check `/examples/sample-node-templates.ts`
- Read docs: Review `/docs/template-workflow.md`
- Use GraphiQL: Visit `http://localhost:4000/graphql`