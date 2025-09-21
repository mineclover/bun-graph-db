# Essential Development Commands

## Primary Development
```bash
bun install              # Install dependencies
bun run dev              # Start development server (port 4000)
bun run typecheck        # TypeScript type checking
bun run check           # Format + lint + fix (Biome)
```

## Testing
```bash
bun test                 # Run all tests
bun test tests/unit/     # Unit tests only
bun test tests/integration/ # Integration tests only
bun run test:isolated    # Isolated test runner
```

## Quality & Validation
```bash
bun run lint            # Biome linting
bun run format          # Biome formatting
bun run typecheck       # Type validation
```

## GraphQL Development
```bash
bun run schema:generate  # Generate GraphQL schema
bun run codegen         # GraphQL code generation
bun run schema:update   # Schema generation + codegen
```

## System Utilities (Darwin/macOS)
```bash
ls -la                  # List files with details
grep -r "pattern" .     # Search in files
find . -name "*.ts"     # Find TypeScript files
lsof -i :4000          # Check port 4000 usage
ps aux | grep bun      # Check running Bun processes
```

## Task Completion Workflow
After completing any development task:
1. `bun run typecheck` - Ensure type safety
2. `bun run check` - Apply formatting & linting
3. `bun test` - Run relevant tests
4. Commit changes with descriptive message