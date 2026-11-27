import { describe, expect, it } from "vitest";
import type { GraphQLDependencies } from "@/presentation/graphql/GraphQLSchemaBuilder.js";
import { createRootResolvers } from "@/presentation/graphql/resolvers/root-resolvers.js";

type RootField = (
	parent: Record<string, never>,
	args: Record<string, unknown>,
) => unknown;

const createDependencies = (
	overrides: Record<string, unknown>,
): GraphQLDependencies => overrides as GraphQLDependencies;

describe("GraphQL root resolver assembly", () => {
	it("prefers a unified resolver and otherwise preserves the query resolver fallback", () => {
		const resolvers = createRootResolvers(
			createDependencies({
				tableResolver: {
					table: () => undefined,
				},
				tableQueries: {
					table: (_parent: unknown, args: { id: string }) => ({
						source: "query",
						id: args.id,
					}),
				},
			}),
		);

		const table = resolvers.Query.table as RootField;
		expect(table({}, { id: "table-1" })).toEqual({
			source: "query",
			id: "table-1",
		});
	});

	it("keeps the legacy getTables input-to-pagination adaptation", () => {
		let receivedArgs: unknown;
		const resolvers = createRootResolvers(
			createDependencies({
				tableQueries: {
					tables: (_parent: unknown, args: unknown) => {
						receivedArgs = args;
						return [];
					},
				},
			}),
		);

		const getTables = resolvers.Query.getTables as RootField;
		expect(getTables({}, { input: { limit: 25, offset: 10 } })).toEqual([]);
		expect(receivedArgs).toEqual({ pagination: { limit: 25, offset: 10 } });
	});

	it("uses mutation fallbacks without changing root argument forwarding", () => {
		const resolvers = createRootResolvers(
			createDependencies({
				tableResolver: {
					createTable: () => undefined,
				},
				tableMutations: {
					createTable: (
						_parent: unknown,
						args: { input: { identifier: string } },
					) => args.input.identifier,
				},
			}),
		);

		const createTable = resolvers.Mutation.createTable as RootField;
		expect(createTable({}, { input: { identifier: "orders" } })).toBe("orders");
	});
});
