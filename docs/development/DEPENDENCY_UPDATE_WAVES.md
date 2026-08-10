# Dependency Update Policy

Last updated: 2026-08-10

This is the operational dependency policy for Bun Graph DB. The product contract remains the single canonical Korean specification at [`specs/008-production-readiness/spec.md`](../../specs/008-production-readiness/spec.md); this document records only package-version and verification decisions.

## Supported Baselines

| Area | Stable compatibility baseline | Current development baseline | Policy |
| --- | --- | --- | --- |
| TypeScript compiler | — | `7.0.2` | This single-service repository runs CI typechecking only with TypeScript 7. |
| Bun types | Bun 1.3 | `@types/bun` 1.3.14 | Keep the type package explicit, not `latest`. |
| Node types | Node 24-compatible source | `@types/node` 26.2.0 | Development typing only; this Bun-first package does not claim Node runtime support. |

## Applied Update: 2026-08-10

| Group | Updated packages |
| --- | --- |
| Compiler and tooling | `typescript` 7.0.2, `@types/node` 26.2.0, `@types/bun` 1.3.14, Biome 2.5.7, Jest 30.4.2 |
| GraphQL code generation | `@graphql-codegen/cli` 7.2.0, introspection 6.1.0, TypeScript plugin 6.1.0, operations plugin 6.1.5 |
| GraphQL runtime | GraphQL Tools merge 9.2.2, schema 10.0.38, utils 11.2.2, GraphQL Yoga 5.21.2, GraphQL 16.14.2 |
| Transport and validation | AJV 8.20.0, `ws` 8.21.3, YAML 2.9.0, Zod 4.4.3 |

TypeScript is a development dependency, not a peer dependency: Bun Graph DB is deployed as one service rather than consumed as a TypeScript library. `tsconfig.json` no longer uses `baseUrl`, which TypeScript 7 has removed; the existing `paths` mappings work relative to the configuration file.

## Intentional Compatibility Ceiling

`bun outdated` will report GraphQL 17.0.2, but it must not be installed while this repository uses GraphQL Yoga 5.21.2. That package declares GraphQL peer support only for major versions 15 and 16. Keep GraphQL pinned at the latest supported 16.x release (`16.14.2`) until a compatible Yoga release is available and its migration is validated.

This exception is deliberate compatibility management, not an ignored update. Re-evaluate it whenever GraphQL Yoga publishes GraphQL 17 peer support.

## Update Procedure

1. Inspect candidates with `bun outdated` and peer ranges with the package registry.
2. Upgrade tightly coupled stacks together: GraphQL runtime, GraphQL codegen, MCP transport, and compiler/tooling.
3. Use `bun update --latest`; immediately constrain a package where the latest release violates a direct peer range.
4. Refresh `bun.lock`, then run the verification suite below.
5. Record a deliberate ceiling in this document instead of silencing peer warnings.

## Required Verification

```bash
bun install --frozen-lockfile
bun run typecheck
bun run codegen
bun run test:serial
bun run build
bunx biome lint index.ts src/application src/infrastructure src/mcp src/presentation tests/unit tests/contract package.json tsconfig.json
git diff --check
```

## 2026-08-10 Verification Record

- `bun install --frozen-lockfile` passed.
- `bun run typecheck` passed with TypeScript 7.0.2.
- `bun run codegen` passed with GraphQL Code Generator 7.
- `bun run test:serial` passed (98 files: 58 parallel-safe, 40 serial-only).
- `bun run build` passed.
- Biome lint completed with no warnings after the optional-chaining updates.
- `git diff --check` passed.
