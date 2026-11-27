# Development Environment Setup Guide

Complete guide for setting up your development environment for the Bun Graph Database project.

## Prerequisites

- **Node.js**: >= 26.0.0 (`node:sqlite` built-in SQLite runtime)
- **pnpm**: 12.21.0 (`packageManager` in `package.json`)
- **Git**: For version control

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd bun-graph-db

# Install dependencies
pnpm install

# Verify installation
pnpm run typecheck
```

### 2. Start Development Server

```bash
# Start with hot reload
pnpm run dev

# Start on custom port
pnpm run dev --port 4141

# View all server options
pnpm run dev --help
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
# Run all isolated Vitest 5 test lanes
pnpm run test

# Run raw Vitest directly
pnpm run test:direct

# Run specific test suites
pnpm exec vitest run tests/unit/
pnpm exec vitest run tests/integration/
pnpm exec vitest run tests/e2e/

# Run with coverage
pnpm run test:coverage

# Run specific test file
pnpm exec vitest run tests/unit/breadth-first-search.test.ts
```

**Current Test Status**:
- ✅ Static gate (`pnpm run check:static`): `check:embedded`, `check:docs`, `ci:versions`, `check:biome`, `typecheck`, `typecheck:contract`, `typecheck:benchmark`, `check:codegen`, `build`
- ✅ Golden dataset gate (`pnpm run test:golden`): cross-runtime verification across Node 26 SQLite, Cloudflare DO SQLite, and JSONL round-trip ([GOLDEN_DATASET.md](./GOLDEN_DATASET.md))
- ✅ Full lane audit & run: `pnpm run test:lanes:audit` & `pnpm run test` pass (140 test files)
- 📄 운영 완료 조건: [운영 준비도 명세](../../specs/008-production-readiness/spec.md)

### Code Quality

```bash
# Type checking
pnpm run typecheck

# Full static verification gate
pnpm run check:static

# Format
pnpm run format

# Lint
pnpm run lint
```

### Database Operations

The database file is automatically created at `./data/bun-graph-db.sqlite`.

```bash
# Reset database (development)
rm -f ./data/bun-graph-db.sqlite
pnpm run dev

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
pnpm run codegen

# View schema in GraphQL Playground
# Open http://localhost:4141/graphql in browser
```

### Debugging

```bash
# Enable debug logging
DEBUG=* pnpm run dev

# Use Node.js inspector
node --inspect --import tsx index.ts

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

# Or use a different port (dev range: 4000-4999)
pnpm run dev --port 4200
```

### TypeScript Errors

```bash
# Clean and reinstall
rm -rf node_modules
pnpm install

# Run typecheck
pnpm run typecheck
```

### Database Issues

```bash
# Reset database
rm -f ./data/bun-graph-db.sqlite

# Server will recreate on next start
pnpm run dev
```

### Test Failures

```bash
# Run specific test file to see detailed errors
pnpm exec vitest run tests/unit/breadth-first-search.test.ts

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

1. **Use `pnpm run dev`** for hot reload during development
2. **Run tests in parallel** when possible
3. **Use type checking** before commits to catch errors early
4. **Keep database small** during development for faster operations

## Getting Help

- **Documentation**: Check `docs/` directory
- **API Reference**: `docs/api/doc-api-reference.md`
- **Quick Start**: `GETTING_STARTED.md`
- **Issues**: Check GitHub issues or create a new one

## Next Steps

1. ✅ Set up development environment
2. ✅ Run tests to verify setup
3. ✅ Start development server
4. ✅ Open GraphQL Playground
5. 📖 Read the [Getting Started Guide](../../GETTING_STARTED.md)
6. 🚀 Start building!

## Verified System Status

As of last verification:
- ✅ Runtime: Node.js `v26.13.1` + `pnpm 12.21.0` + `node:sqlite` (`SQLite 3.54.1`)
- ✅ Static gate (`pnpm run check:static`): 0 errors (TypeScript 7, Biome, GraphQL codegen, canonical docs, build)
- ✅ Server: Running normally on ports `4000`–`4999` (dev) / `8000`–`8999` (prod)
- ✅ GraphQL / MCP API: core CRUD, FTS5, 4-signal hybrid search, JSONL backup/restore, AccessControl, MCP `2026-07-28` / `2025-11-25` LTS verified
- ✅ `pnpm run test`: passing across all 4 Vitest 5 lanes (140 test files, including `pnpm run test:golden`)

---

**Last Updated**: 2026-11-27
**Verified By**: Node 26 Verification Harness
