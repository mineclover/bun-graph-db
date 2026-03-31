# Dependency Update Waves

Last updated: 2026-03-27

This document defines the dependency upgrade order for this repository, based on the current `package.json`, `bun outdated`, and the test lanes already stabilized in this codebase.

## Goals

- Keep each upgrade batch small enough to debug quickly.
- Upgrade tightly-coupled packages together.
- Preserve the current green status of `typecheck`, `comprehensive`, `contract`, `integration`, and `e2e` lanes.
- Separate "upgrade" work from "remove unused dependency" work.

## Baseline

Before each wave:

```bash
bun install
bun run typecheck
bun run test
```

After each wave:

```bash
bun install
bun run typecheck
```

Then run the wave-specific verification commands listed below.

## Current Upgrade Candidates

Observed from `bun outdated` on 2026-03-27:

| Package | Current | Latest | Notes |
| --- | --- | --- | --- |
| `@biomejs/biome` | `2.2.2` | `2.4.9` | low-risk dev tooling |
| `rimraf` | `6.0.1` | `6.1.3` | low-risk dev tooling |
| `@types/express` | `5.0.3` | `5.0.6` | low-risk typings |
| `@types/node` | `24.3.0` | `25.5.0` | prefer minor step first |
| `@graphql-tools/merge` | `9.1.1` | `9.1.7` | GraphQL core wave |
| `@graphql-tools/schema` | `10.0.25` | `10.0.31` | GraphQL core wave |
| `@graphql-tools/utils` | `10.9.1` | `11.0.0` | major jump, isolate with GraphQL wave |
| `graphql` | `16.11.0` | `16.13.2` | GraphQL core wave |
| `graphql-request` | `7.2.0` | `7.4.0` | GraphQL core wave |
| `graphql-scalars` | `1.24.2` | `1.25.0` | GraphQL core wave |
| `graphql-yoga` | `5.15.1` | `5.18.1` | GraphQL core wave |
| `@modelcontextprotocol/sdk` | `1.18.1` | `1.28.0` | MCP wave |
| `ajv` | `8.17.1` | `8.18.0` | MCP/validation wave |
| `ws` | `8.18.3` | `8.20.0` | transport wave |
| `yaml` | `2.8.1` | `2.8.3` | low-risk infra |
| `@graphql-codegen/*` | `4.x/5.x` | `5.x/6.x` | tooling wave, larger surface |
| `jest` | `30.1.3` | `30.3.0` | tooling wave |
| `@types/bun` | `1.2.21` | `1.3.11` | Bun policy wave |
| `typescript` | `5.9.2` | `6.0.2` | keep pinned to v5 first |
| `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `uuid`, `@types/uuid` | mixed | newer available | currently appear unused in runtime code; treat as cleanup wave |

## Wave Order

### Wave 0: Baseline Snapshot

Purpose:

- Confirm the repo is green before changing dependencies.
- Capture current lockfile and failure baseline if anything regresses later.

Commands:

```bash
bun install
bun run typecheck
bun run test
```

### Wave 1: Low-Risk Dev Tooling

Packages:

- `@biomejs/biome`
- `rimraf`
- `@types/express`
- `yaml`

Optional in the same wave if no typing regressions appear:

- `@types/node` to latest v24-compatible minor or direct latest if clean

Why this wave first:

- Minimal runtime impact.
- Good first check that lockfile refresh is healthy.

Verification:

```bash
bun run typecheck
bun run lint
bun run test:parallel-safe
```

### Wave 2: GraphQL Core

Packages:

- `graphql`
- `graphql-yoga`
- `graphql-scalars`
- `graphql-request`
- `@graphql-tools/load-files`
- `@graphql-tools/merge`
- `@graphql-tools/schema`
- `@graphql-tools/utils`

Why grouped:

- These packages are tightly coupled by schema building, execution, and tooling expectations.

Verification:

```bash
bun run typecheck
bun test tests/comprehensive/*.test.ts --timeout 15000 --bail
bun test tests/contract/*.test.ts --timeout 30000 --bail
bun test tests/integration/*.test.ts --timeout 30000 --bail
bun test tests/e2e/*.test.ts --timeout 30000 --bail
```

### Wave 3: MCP / Validation / Transport

Packages:

- `@modelcontextprotocol/sdk`
- `ajv`
- `ws`

Why grouped:

- They affect the MCP HTTP server, tool schema validation, and transport behavior.

Verification:

```bash
bun run typecheck
bun test tests/contract/*.test.ts --timeout 30000 --bail
bun test tests/integration/mcp-*.test.ts --timeout 30000 --bail
bun test tests/e2e/mcp-*.test.ts --timeout 30000 --bail
```

### Wave 4: Codegen and Test Tooling

Packages:

- `@graphql-codegen/cli`
- `@graphql-codegen/introspection`
- `@graphql-codegen/typescript`
- `@graphql-codegen/typescript-operations`
- `jest`
- `@types/jest`

Why later:

- Larger developer workflow surface.
- Lower runtime risk, but higher tooling churn.

Verification:

```bash
bun run typecheck
bun run codegen
bun test tests/contract/*.test.ts --timeout 30000 --bail
```

### Wave 5: Unused Dependency Cleanup

Candidates to review before upgrading:

- `react`
- `react-dom`
- `@tanstack/react-query`
- `@tanstack/react-query-devtools`
- `uuid`
- `@types/react`
- `@types/react-dom`
- `@types/uuid`

Current observation:

- Runtime code appears to use `node:crypto` for request IDs.
- No active TypeScript imports were found for React or TanStack Query.

Action:

- Confirm they are truly unused.
- Remove instead of upgrading if they are not needed.

Verification:

```bash
bun run typecheck
bun run test
```

### Wave 6: Bun / TypeScript Policy

Packages:

- `@types/bun`
- `typescript`

Policy:

- Replace `"@types/bun": "latest"` with an explicit version.
- Move `typescript` from `peerDependencies`-only to `devDependencies` with an explicit version.
- Keep TypeScript on the latest v5 release first.
- Treat TypeScript v6 as a separate follow-up after v5 is stable.

Verification:

```bash
bun run typecheck
bun run test
```

## Execution Rules

- Do not mix multiple waves in one commit.
- Stop after the first failing wave and fix regressions before continuing.
- Refresh `bun.lock` with each wave.
- Prefer targeted lane verification first, then broader `bun run test` once the wave is stable.

## Progress Tracker

- [ ] Wave 0 baseline snapshot
- [x] Wave 1 low-risk dev tooling
- [x] Wave 2 GraphQL core
- [x] Wave 3 MCP / validation / transport
- [x] Wave 4 codegen and test tooling
- [x] Wave 5 unused dependency cleanup
- [x] Wave 6 Bun / TypeScript policy

## Execution Notes

### 2026-03-27

Completed Wave 1:

- Updated `@biomejs/biome` to `2.4.9`
- Updated `rimraf` to `6.1.3`
- Updated `@types/express` to `5.0.6`
- Updated `yaml` to `2.8.3`
- Verification:
  - `bun run typecheck` ✅
  - `bun run test:parallel-safe` ✅
  - `bun run lint` ⚠️ blocked by pre-existing parse errors in repository docs/sample files, not by dependency regressions

Completed Wave 2:

- Updated `@graphql-tools/merge` to `9.1.7`
- Updated `@graphql-tools/schema` to `10.0.31`
- Updated `@graphql-tools/utils` to `11.0.0`
- Updated `graphql` to `16.13.2`
- Updated `graphql-request` to `7.4.0`
- Updated `graphql-scalars` to `1.25.0`
- Updated `graphql-yoga` to `5.18.1`
- Verification:
  - `bun run typecheck` ✅
  - `bun test tests/comprehensive/*.test.ts --timeout 15000 --bail` ✅
  - `bun test tests/contract/*.test.ts tests/e2e/*.test.ts tests/integration/*.test.ts tests/graph-traversal-advanced.test.ts --timeout 30000 --bail` ✅

Completed Wave 3:

- Updated `@modelcontextprotocol/sdk` to `1.28.0`
- Updated `ajv` to `8.18.0`
- Updated `ws` to `8.20.0`
- Verification:
  - `bun run typecheck` ✅
  - `bun test tests/contract/mcp-*.test.ts tests/contract/mcp-route-validation.test.ts tests/contract/table-isolation-contract.test.ts tests/contract/tool-schema-validation.test.ts tests/contract/graphql-mapping.test.ts tests/integration/mcp-*.test.ts tests/integration/mcp-table-integration.test.ts tests/e2e/mcp-*.test.ts --timeout 30000 --bail` ✅

Completed Wave 4:

- Updated `@graphql-codegen/cli` to `6.2.1`
- Updated `@graphql-codegen/introspection` to `5.0.1`
- Updated `@graphql-codegen/typescript` to `5.0.9`
- Updated `@graphql-codegen/typescript-operations` to `5.0.9`
- Updated `jest` to `30.3.0`
- Verification:
  - `bun run typecheck` ✅
  - `bun run codegen` ✅
  - `bun test tests/contract/*.test.ts --timeout 30000 --bail` ✅

Completed Wave 5:

- Removed unused `react` / `react-dom` / `@tanstack/react-query` / `@tanstack/react-query-devtools`
- Removed unused `@types/react` / `@types/react-dom`
- Removed unused `uuid` / `@types/uuid`
- Test harness hardening added for long serial lanes:
  - increased isolated GraphQL server readiness timeout
  - relaxed a few flaky long-lane test hook timeouts
  - guarded cleanup hooks when setup fails early
- Verification:
  - `bun run typecheck` ✅
  - `bun run test` ✅

Completed Wave 6:

- Pinned `@types/bun` to `1.3.11`
- Added `typescript` as explicit `devDependency` at `^5.9.3`
- Kept `peerDependencies.typescript` for package compatibility
- Verification:
  - `bun run typecheck` ✅
  - `bun test tests/integration/server-independence-validation.test.ts tests/node-queries-isolated.test.ts tests/integration/mcp-rest-proxy-improved.test.ts --timeout 60000 --bail` ✅
