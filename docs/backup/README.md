# Documentation Backup

This directory contains backup copies of all comprehensive usage documentation that was created and stored in the database.

## Contents

1. **01-usage-overview.md** - Complete API usage guide and overview
   - Source: Database Doc ID 51 (category: usage, version: 1)
   - Overview of system architecture, endpoints, core workflow, and health checks

2. **02-graphql-queries-guide.md** - GraphQL queries reference
   - Source: Database Doc ID 52 (category: guide, version: 1)
   - Complete guide to all available GraphQL queries with examples

3. **03-graphql-mutations-reference.md** - GraphQL mutations reference
   - Source: Database Doc ID 53 (category: spec, version: 1)
   - Comprehensive reference for all GraphQL mutations and operations

4. **04-complete-api-usage-examples.md** - Complete API usage examples
   - Source: Database Doc ID 54 (category: example, version: 1)
   - Practical curl examples and complete workflow demonstrations

## Database Integration

All documentation is now stored in the database and served dynamically through:

- **MCP Tools**: The UsageGuideTool now queries the database directly
- **Database Table**: Documentation stored in table ID 106
- **Categories**: usage, guide, spec, example
- **Dynamic Serving**: No more hardcoded content

## MCP Integration

The MCP UsageGuideTool (`src/mcp/tools/query-tools/UsageGuideTool.ts`) has been completely refactored to:

1. **Query database first** - Primary source is now the database
2. **Remove hardcoded fallbacks** - No more static content
3. **Dynamic section mapping** - Maps sections to database categories
4. **Error handling** - Graceful handling when database is unavailable

## Usage

The MCP tool can be accessed via:
- **Endpoint**: `http://localhost:4000/mcp`
- **Tool**: `getUsageGuide`
- **Sections**: overview, queries, mutations, templates, examples, schema, all

## Backup Created

- **Date**: 2025-09-20
- **Total Documents**: 4
- **Status**: Complete database-driven system with MD backups