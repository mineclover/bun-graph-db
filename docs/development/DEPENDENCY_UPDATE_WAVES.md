# Dependency Update Policy

Last updated: 2026-11-27

This is the operational dependency policy for Bun Graph DB. The product contract remains the single canonical Korean specification at [`specs/008-production-readiness/spec.md`](../../specs/008-production-readiness/spec.md); this document records only package-version and verification decisions.

## Supported Baselines

| Area | Runtime / Tooling Baseline | Current Package Baseline | Policy |
| --- | --- | --- | --- |
| Runtime & package manager | Node.js `>=26.0.0`, pnpm `12.21.0` | Built-in `node:sqlite` (`SQLite 3.54.1`) | Primary runtime and lockfile (`pnpm-lock.yaml`). |
| TypeScript & bundler | `typescript` `7.0.2`, `tsup` `9.0.0`, `tsx` `4.23.15` | `@types/node` `^26.6.11` | `tsup` keeps `node:sqlite` and optional `xlsx` external. |
| Test & lint stack | `vitest` `^5.1.2` | `@biomejs/biome` `2.6.9` | Isolated 4-lane runner via `scripts/test-lanes.ts` (`vitest run`). |
| GraphQL & MCP stack | GraphQL `17.1.0`, Yoga `^6.1.1` | `@modelcontextprotocol/server` `^2.4.0`, Codegen CLI `^8.0.0` | Previous GraphQL 16 ceiling removed upon Yoga 6 upgrade. |

## Applied Update: 2026-11-27 (Node 26 Migration & Full Dependency Refresh)

| Group | Updated packages |
| --- | --- |
| Runtime & tooling | Migrated from Bun 1.3 to Node.js `>=26.0.0` (`node:sqlite`, `NodeHttpServer`), pnpm `12.21.0`, `tsx` `^4.23.15`, `tsup` `^9.0.0`, `vitest` `^5.1.2`, `@biomejs/biome` `2.6.9`, `@types/node` `^26.6.11` |
| GraphQL code generation | `@graphql-codegen/cli` `^8.0.0`, introspection `^7.0.0`, TypeScript plugin `^7.0.1`, operations plugin `^7.0.3` |
| GraphQL & MCP runtime | `graphql` `17.1.0`, `graphql-yoga` `^6.1.1`, `@graphql-tools/load-files` `^8.0.10`, `merge` `^10.0.10`, `schema` `^11.0.10`, `utils` `^13.2.3`, `@modelcontextprotocol/server` `^2.4.0`, `@whatwg-node/server` `^0.13.3` |
| Validation & utilities | `ajv` `^8.20.0`, `ws` `^8.23.0`, `yaml` `^2.9.1`, `zod` `^4.6.7`, `graphql-request` `^7.4.0`, `rimraf` `^6.1.4` |

TypeScript is a development dependency, not a peer dependency: Bun Graph DB is deployed as one service rather than consumed as a TypeScript library. `tsconfig.json` uses TypeScript 7 relative `paths` mappings without `baseUrl`.

## Update Procedure

1. Inspect outdated dependencies with `pnpm outdated` or workspace dependency checks and review peer ranges.
2. Upgrade tightly coupled stacks together: GraphQL runtime (`graphql` + `graphql-yoga` + `@graphql-tools/*`), GraphQL codegen, MCP transport, and compiler/tooling (`typescript`, `vitest`, `tsup`, `@biomejs/biome`).
3. Refresh `pnpm-lock.yaml` with `pnpm install`, then run the full verification suite below.
4. Record any intentional peer ceilings or major migrations in this document.

## Required Verification

```bash
pnpm install --frozen-lockfile
pnpm run check:static
pnpm run test:lanes:audit
pnpm run test
pnpm run projection:check
pnpm run benchmark:hotpaths:ci
pnpm run benchmark:vector-storage
git diff --check
```

## 2026-11-27 Verification Record (Node.js v26.13.1 + pnpm 12.21.0)

- `pnpm run check:static` passed (`check:docs`, `ci:versions`, `check:biome`, `typecheck`, `typecheck:contract`, `typecheck:benchmark`, `check:codegen`, `build`).
- `pnpm run test` passed across all 4 Vitest 5 lanes (126 test files).
- `pnpm run projection:check` passed (4/4).
- `pnpm run benchmark:hotpaths:ci` and `pnpm run benchmark:vector-storage` passed.

## Historical Update Record: 2026-08-10 (Bun 1.3.x Era)

- Previously verified on `bun` (`typescript` 7.0.2, `graphql` 16.14.2 with Yoga 5.21.2 ceiling, 98 test files). Superseded by the 2026-11-27 Node 26 + GraphQL 17 + Yoga 6 + Vitest 5 wave above.
