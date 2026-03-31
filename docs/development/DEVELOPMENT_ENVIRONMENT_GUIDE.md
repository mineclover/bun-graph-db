# Development Environment Setup Guide

Complete guide for setting up your development environment for the Bun Graph Database project.

## Prerequisites

- **Bun**: >= 1.0.0 (JavaScript runtime)
- **Node.js**: >= 18.0.0 (for compatibility)
- **Git**: For version control
- **SQLite3**: Built into Bun

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd bun-graph-db

# Install dependencies
bun install

# Verify installation
bun run typecheck
```

### 2. Start Development Server

```bash
# Start with hot reload
bun run dev

# Start on custom port
bun run dev --port 3000

# View all server options
bun run dev --help
```

The server will start on:
- **GraphQL API**: http://localhost:4141/graphql
- **GraphQL Playground**: http://localhost:4141/graphql (GET request in browser)
- **MCP Protocol**: http://localhost:4141/mcp

### 3. Verify Server Health

```bash
# Health check
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'

# Expected response:
# {"data":{"healthCheck":{"status":"OK","database":true,"version":"1.0.0"}}}
```

## Development Workflow

### Running Tests

```bash
# Run all tests
bun test

# Run Bun's raw test runner directly
bun run test:direct

# Run specific test suites
bun test tests/unit/
bun test tests/integration/
bun test tests/e2e/

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/unit/use-cases/CreateTable.test.ts
```

**Current Test Status**:
- ✅ TypeScript: 0 type errors
- ✅ Lint: passes with `bun run lint --max-diagnostics=20`
- ✅ Build: `bun run build` passes
- ✅ Full lane run: `bun run test` passes
- 📄 Details: [SYSTEM_EVALUATION_2026-03-30.md](./SYSTEM_EVALUATION_2026-03-30.md)

### Code Quality

```bash
# Type checking
bun run typecheck

# Format and lint
bun run check

# Just format
bun run format

# Just lint
bun run lint
```

### Database Operations

The database file is automatically created at `./data/bun-graph-db.sqlite`.

```bash
# Reset database (development)
rm -f ./data/bun-graph-db.sqlite
bun run dev

# The database will be recreated on server start
```

## Project Structure

```
bun-graph-db/
├── src/
│   ├── application/        # Use cases and DTOs
│   ├── domain/            # Entities and repositories
│   ├── infrastructure/    # Database and DI container
│   ├── presentation/      # GraphQL and HTTP layers
│   └── core/              # Shared types and utilities
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Documentation
├── data/                  # Database files (gitignored)
└── index.ts              # Server entry point
```

## Common Development Tasks

### Creating New Features

1. **Start with the domain layer** (`src/domain/`)
   - Define entities
   - Define repository interfaces

2. **Implement use cases** (`src/application/`)
   - Create use case classes
   - Define input/output DTOs

3. **Add infrastructure** (`src/infrastructure/`)
   - Implement repository
   - Register in DI container

4. **Expose via GraphQL** (`src/presentation/graphql/`)
   - Add schema definitions
   - Implement resolvers

5. **Write tests** (`tests/`)
   - Unit tests for use cases
   - Integration tests for GraphQL API

### Working with GraphQL Schema

```bash
# Generate TypeScript types from schema
bun run codegen

# View schema in GraphQL Playground
# Open http://localhost:4141/graphql in browser
```

### Debugging

```bash
# Enable debug logging (modify index.ts or use environment variables)
DEBUG=* bun run dev

# Use Bun's built-in debugger
bun --inspect index.ts

# Check server logs
# All logs are output to stdout/stderr
```

## Environment Configuration

Create a `.env` file for local configuration (optional):

```bash
# Server configuration
PORT=4141
HOST=localhost

# Database
DATABASE_PATH=./data/bun-graph-db.sqlite

# Development mode
NODE_ENV=development
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 4141
lsof -i :4141

# Kill process
kill -9 <PID>

# Or use a different port
bun run dev --port 3000
```

### TypeScript Errors

```bash
# Clean and reinstall
rm -rf node_modules bun.lockb
bun install

# Run typecheck
bun run typecheck
```

### Database Issues

```bash
# Reset database
rm -f ./data/bun-graph-db.sqlite

# Server will recreate on next start
bun run dev
```

### Test Failures

```bash
# Run specific test file to see detailed errors
bun test tests/unit/use-cases/CreateTable.test.ts

# Check if issue is test-specific or code-specific
# If tests fail but server works, issue is likely in test mocks
```

## Working with Git

### Branch Strategy

- **main**: Production-ready code
- **claude/***: Feature branches created by AI assistant
- **feature/***: Manual feature branches

### Commit Guidelines

```bash
# Check current status
git status
git branch

# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push -u origin feature/my-feature
```

## IDE Setup

### VSCode Recommended Extensions

- **Biome**: For linting and formatting
- **GraphQL**: For GraphQL schema support
- **TypeScript**: Built-in TypeScript support

### VSCode Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Performance Tips

1. **Use `bun run dev`** for hot reload during development
2. **Run tests in parallel** when possible
3. **Use type checking** before commits to catch errors early
4. **Keep database small** during development for faster operations

## Getting Help

- **Documentation**: Check `docs/` directory
- **API Reference**: `docs/api/doc-api-reference.md`
- **Quick Start**: `docs/guides/GETTING_STARTED.md`
- **Issues**: Check GitHub issues or create a new one

## Next Steps

1. ✅ Set up development environment
2. ✅ Run tests to verify setup
3. ✅ Start development server
4. ✅ Open GraphQL Playground
5. 📖 Read the [Getting Started Guide](../guides/GETTING_STARTED.md)
6. 🚀 Start building!

## Verified System Status

As of last verification:
- ✅ Dependencies: 623 packages installed
- ✅ TypeScript: 0 type errors
- ✅ Lint: passes
- ✅ Build: passes
- ✅ Server: Running normally on port 4141
- ✅ GraphQL API: core CRUD and search paths verified
- ✅ MCP API: initialize + table-scoped route verified
- ✅ Database: SQLite working correctly
- ✅ `bun run test`: passing

---

**Last Updated**: 2026-03-30
**Verified By**: Codex AI Assistant
