# Task Completion Workflow

## After Completing Any Development Task

### 1. Type Safety Validation
```bash
bun run typecheck
```
- Ensures TypeScript compilation passes
- Catches type errors before runtime
- Required before any commit

### 2. Code Quality & Formatting
```bash
bun run check
```
- Applies Biome formatting (2 spaces, 100 char lines)
- Runs linting with recommended rules
- Auto-fixes issues where possible

### 3. Test Validation
```bash
bun test
# Or specific test categories:
bun test tests/unit/
bun test tests/integration/
```
- Run relevant tests for changed functionality
- Ensure no regressions introduced
- Integration tests for GraphQL changes

### 4. GraphQL Schema Updates (if applicable)
```bash
bun run schema:update
```
- Regenerates GraphQL schema from definitions
- Updates TypeScript types from schema
- Required for any GraphQL schema changes

### 5. Git Workflow
```bash
git add .
git commit -m "descriptive message following conventional commits"
```
- Use conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
- Include Claude Code attribution if applicable

## Quality Gates
- ✅ TypeScript compilation must pass
- ✅ All tests must pass  
- ✅ Biome linting must pass
- ✅ No console.log statements in production code
- ✅ All imports must be used
- ✅ GraphQL schema must be valid

## Performance Targets
- Schema sync operations: <200ms
- Tool execution: <100ms
- GraphQL queries: <50ms (simple), <500ms (complex)
- Database operations: <10ms (single), <100ms (batch)