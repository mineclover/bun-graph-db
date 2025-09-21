# Code Style & Conventions

## TypeScript Configuration
- **Strict mode**: Enabled with comprehensive type checking
- **Target**: ESNext with bundler module resolution
- **Path mapping**: `@/*` and `~/*` map to `./src/*`
- **No emit**: TypeScript used for type checking only

## Biome Formatting Rules
- **Indentation**: 2 spaces (no tabs)
- **Line width**: 100 characters
- **Quote style**: Single quotes for JavaScript/TypeScript
- **Semicolons**: As needed (not mandatory)
- **Trailing commas**: ES5 style
- **Line endings**: LF (Unix style)

## Naming Conventions
- **Files**: kebab-case for regular files, PascalCase for classes/components
- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Directories**: kebab-case

## Architecture Patterns
- **Hexagonal Architecture**: Clear separation between core, domain, application, infrastructure, presentation
- **Dependency Injection**: Using custom DI container in `src/infrastructure/container/`
- **Repository Pattern**: Database abstractions in `src/domain/repositories/`
- **Use Cases**: Application logic in `src/application/use-cases/`

## GraphQL Conventions
- **Schema files**: `.graphql` extension in `src/presentation/graphql/schema/`
- **Resolvers**: Organized by domain in `src/presentation/graphql/resolvers/`
- **Types**: Centralized in schema definitions
- **Mutations**: Grouped by entity type

## Database Conventions
- **Migrations**: Numbered sequential files in `src/infrastructure/database/migrations/`
- **Repositories**: SQLite implementations in `src/infrastructure/database/sqlite/`
- **Entities**: Domain models in `src/domain/entities/`

## Testing Structure
- **Unit tests**: `tests/unit/` directory
- **Integration tests**: `tests/integration/` directory
- **Contract tests**: `tests/contract/` directory  
- **Test files**: `.test.ts` suffix
- **Fixtures**: Centralized in `tests/fixtures/`