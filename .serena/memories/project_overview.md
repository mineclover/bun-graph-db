# Bun Graph Database - Project Overview

## Purpose
Production-ready GraphQL-based Graph Database System with TypeScript/Bun runtime and advanced batch operations. The system provides:
- SQLite-backed graph storage with relationship scoring
- GraphQL API layer for type-safe operations
- Template system for parameterized queries
- Batch operations with transaction safety
- Real-time synchronization capabilities

## Tech Stack
- **Runtime**: Bun (primary) with Node.js compatibility
- **Language**: TypeScript 5.x with strict mode
- **Database**: SQLite3 with custom graph extensions
- **API**: GraphQL with Yoga server
- **Testing**: Bun test runner + Jest
- **Code Quality**: Biome (linting + formatting)
- **Architecture**: Hexagonal/Clean Architecture

## Project Structure
```
src/
├── core/           # Core business logic & abstractions
├── domain/         # Domain entities, repositories, services
├── application/    # Use cases & application services
├── infrastructure/ # Database, container, logging
├── presentation/   # GraphQL resolvers, HTTP controllers
├── lib/           # Feature libraries (schema-sync, variable-transformer, sync-monitor)
├── models/        # Data models
└── services/      # Application services
```

## Current Implementation Status
Phase 006 - GraphQL Schema Sync & Variable Mapping is partially implemented:
- ✅ Database schema (migration 006) - COMPLETED
- ✅ Library structure directories - COMPLETED
- ⚠️ Contract tests - IN PROGRESS (some exist in tests/contract/)
- ❌ Entity models - NOT STARTED
- ❌ Core libraries - NOT STARTED
- ❌ GraphQL resolvers - NOT STARTED