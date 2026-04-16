import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TableSchemaProjectionService } from "../../src/application/services/TableSchemaProjectionService";
import type { IAttributeRepository } from "../../src/domain/repositories/IAttributeRepository";
import type { IAttributeTypeRepository } from "../../src/domain/repositories/IAttributeTypeRepository";
import type { ITableRepository } from "../../src/domain/repositories/ITableRepository";
import {
	createContainer,
	resetContainer,
} from "../../src/infrastructure/container/ContainerBootstrap";
import type { DIContainer } from "../../src/infrastructure/container/DIContainer";
import { RepositoryTokens } from "../../src/infrastructure/container/tokens/RepositoryTokens";
import { createTableMcpMiddleware } from "../../src/presentation/mcp/routes/mcp-routes";
import { createGraphQLYoga } from "../fixtures/graphql-yoga-helper";
import {
	createTestEnvironment,
	type TestEnvironment,
} from "../fixtures/test-database-factory";

const SUITE_NAME = "projection-graphql-mcp-smoke";
const TEST_TIMEOUT = 60000;
const GRAPHQL_ENDPOINT = "http://projection-graphql-mcp-smoke.test/graphql";
const MCP_BASE_URL = "http://projection-graphql-mcp-smoke.test";

type GraphQLError = {
	message: string;
	code?: string;
	field?: string | null;
};

type GraphQLResponse<TData> = {
	data?: TData;
	errors?: GraphQLError[];
};

type MutationPayload<TNode> = {
	success: boolean;
	errors: GraphQLError[];
} & TNode;

type CreatedTable = {
	id: string;
	identifier: string;
};

type CreatedAttributeType = {
	id: string;
	identifier: string;
	dataType: string;
};

type ListedTool = {
	name: string;
	inputSchema: {
		properties: Record<string, any>;
		required: string[];
	};
	_meta?: Record<string, any>;
};

describe("Projection GraphQL + table MCP smoke", () => {
	let container: DIContainer;
	let testEnvironment: TestEnvironment;
	let tableMcpMiddleware: ReturnType<typeof createTableMcpMiddleware>;
	let originalFetch: typeof fetch;
	let restoreDatabasePath: () => void;

	beforeAll(async () => {
		originalFetch = globalThis.fetch;
		const previousDatabasePath = process.env.DATABASE_PATH;
		restoreDatabasePath = () => {
			if (previousDatabasePath === undefined) {
				delete process.env.DATABASE_PATH;
			} else {
				process.env.DATABASE_PATH = previousDatabasePath;
			}
		};

		testEnvironment = await createTestEnvironment(SUITE_NAME, "integration");
		process.env.DATABASE_PATH = testEnvironment.databasePath;
		container = await createContainer();

		const yoga = await createGraphQLYoga(container);
		connectGraphqlFetchToYoga(yoga, originalFetch);

		const projectionService = new TableSchemaProjectionService(
			(await container.resolve(
				RepositoryTokens.TABLE_REPOSITORY,
			)) as ITableRepository,
			(await container.resolve(
				RepositoryTokens.ATTRIBUTE_REPOSITORY,
			)) as IAttributeRepository,
			(await container.resolve(
				RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
			)) as IAttributeTypeRepository,
		);
		tableMcpMiddleware = createTableMcpMiddleware({
			graphqlEndpoint: GRAPHQL_ENDPOINT,
			restApiBaseUrl: `${MCP_BASE_URL}/api`,
			projectionService,
		});
	}, TEST_TIMEOUT);

	afterAll(async () => {
		globalThis.fetch = originalFetch;
		resetContainer();
		restoreDatabasePath?.();
		await testEnvironment.cleanup();
	}, TEST_TIMEOUT);

	test(
		"refreshes table-scoped MCP schema after GraphQL projection changes",
		async () => {
			const suffix = Date.now();
			const tableIdentifier = `projection_smoke_${suffix}`;
			const statusTypeIdentifier = `smoke_status_${suffix}`;
			const rankTypeIdentifier = `smoke_rank_${suffix}`;

			const tableResult = await graphql<{
				createTable: MutationPayload<{ table: CreatedTable }>;
			}>(
				`
          mutation CreateProjectionSmokeTable($input: CreateTableInput!) {
            createTable(input: $input) {
              success
              table {
                id
                identifier
              }
              errors {
                message
                code
                field
              }
            }
          }
        `,
				{
					input: {
						identifier: tableIdentifier,
						description: "Projection smoke test table",
					},
				},
			);
			const table = expectSuccessfulMutation(
				tableResult.createTable,
				"createTable",
			).table;

			const statusType = await createAttributeType({
				identifier: statusTypeIdentifier,
				name: "Smoke Status",
				dataType: "string",
				constraints: { enum: ["todo", "doing"] },
			});
			const rankType = await createAttributeType({
				identifier: rankTypeIdentifier,
				name: "Smoke Rank",
				dataType: "integer",
				constraints: { minimum: 0, maximum: 10 },
			});

			await createAttribute({
				tableId: table.id,
				identifier: "status",
				name: "Status",
				attributeTypeId: statusType.id,
			});
			await createAttribute({
				tableId: table.id,
				identifier: "rank",
				name: "Rank",
				attributeTypeId: rankType.id,
			});

			const componentProjection = await graphql<{
				tableOpenApiProjection: {
					profile: string;
					projection: {
						openapi: string;
						components: { schemas: Record<string, unknown> };
					};
					refs: unknown[];
					sources: Record<string, unknown>;
					diagnostics: unknown[];
				};
			}>(
				`
          query TableProjection($tableId: ID!, $profile: String!) {
            tableOpenApiProjection(tableId: $tableId, profile: $profile)
          }
        `,
				{
					tableId: table.id,
					profile: "component-bundle",
				},
			);
			expect(componentProjection.tableOpenApiProjection.profile).toBe(
				"component-bundle",
			);
			expect(
				Object.keys(
					componentProjection.tableOpenApiProjection.projection.components
						.schemas,
				),
			).toEqual(
				expect.arrayContaining([
					expect.stringContaining("NodeInput_"),
					expect.stringContaining("NodeAttributes_"),
					expect.stringContaining("AttributeType_"),
				]),
			);
			expect(componentProjection.tableOpenApiProjection.refs.length).toBeGreaterThan(0);
			expect(
				Object.keys(componentProjection.tableOpenApiProjection.sources).length,
			).toBeGreaterThan(0);
			expect(componentProjection.tableOpenApiProjection.diagnostics).toEqual([]);

			const operationProjection = await graphql<{
				tableOpenApiProjection: {
					profile: string;
					projection: {
						paths: Record<string, Record<string, unknown>>;
					};
				};
			}>(
				`
          query TableOperationProjection($identifier: String!, $profile: String!) {
            tableOpenApiProjection(identifier: $identifier, profile: $profile)
          }
        `,
				{
					identifier: table.identifier,
					profile: "operation-contract",
				},
			);
			expect(operationProjection.tableOpenApiProjection.profile).toBe(
				"operation-contract",
			);
			expect(
				Object.keys(operationProjection.tableOpenApiProjection.projection.paths),
			).toEqual([
				`/schema-engine/tables/${table.identifier}/nodes`,
				`/schema-engine/tables/${table.identifier}/nodes/{nodeId}`,
			]);

			const beforeTools = await listTableMcpTools(table.id);
			const beforeCreateNodeTool = getCreateNodeTool(beforeTools, table.id);
			const beforeUpdateNodeTool = getUpdateNodeTool(beforeTools, table.id);
			const beforeAttributesSchema =
				beforeCreateNodeTool.inputSchema.properties.attributes;
			const beforeProjectionHash =
				beforeCreateNodeTool._meta?.tableSchemaProjection?.versionHash;

			expect(beforeAttributesSchema.properties.status).toEqual(
				expect.objectContaining({
					type: "string",
					enum: ["todo", "doing"],
				}),
			);
			expect(beforeAttributesSchema.properties.rank).toEqual(
				expect.objectContaining({
					type: "integer",
					minimum: 0,
					maximum: 10,
				}),
			);
			expect(beforeCreateNodeTool._meta?.tableSchemaProjection).toEqual(
				expect.objectContaining({
					available: true,
					usable: true,
					profile: "operation-contract",
					schemaSource: "openapi-projection",
					tableId: table.id,
					tableIdentifier,
				}),
			);
			expect(beforeUpdateNodeTool.inputSchema.required).toEqual(["nodeId"]);
			expect(beforeUpdateNodeTool.inputSchema.properties.attributes).toEqual(
				expect.objectContaining({
					type: "object",
					additionalProperties: false,
					required: [],
				}),
			);

			const updateResult = await graphql<{
				updateAttributeType: MutationPayload<{ attributeType: { id: string } }>;
			}>(
				`
          mutation UpdateStatusType($id: ID!, $input: UpdateAttributeTypeInput!) {
            updateAttributeType(id: $id, input: $input) {
              success
              attributeType {
                id
              }
              errors {
                message
                code
                field
              }
            }
          }
        `,
				{
					id: statusType.id,
					input: {
						description: "Expanded status values for smoke test",
						constraints: { enum: ["todo", "doing", "done"] },
					},
				},
			);
			expectSuccessfulMutation(
				updateResult.updateAttributeType,
				"updateAttributeType",
			);

			const afterTools = await listTableMcpTools(table.id);
			const afterCreateNodeTool = getCreateNodeTool(afterTools, table.id);
			const afterUpdateNodeTool = getUpdateNodeTool(afterTools, table.id);
			const afterAttributesSchema =
				afterCreateNodeTool.inputSchema.properties.attributes;
			const afterProjectionHash =
				afterCreateNodeTool._meta?.tableSchemaProjection?.versionHash;

			expect(afterAttributesSchema.properties.status).toEqual(
				expect.objectContaining({
					type: "string",
					enum: ["todo", "doing", "done"],
				}),
			);
			expect(afterAttributesSchema.properties.rank).toEqual(
				expect.objectContaining({
					type: "integer",
					minimum: 0,
					maximum: 10,
				}),
			);
			expect(afterProjectionHash).toBeDefined();
			expect(afterProjectionHash).not.toBe(beforeProjectionHash);
			expect(
				afterUpdateNodeTool.inputSchema.properties.attributes.properties.status,
			).toEqual(
				expect.objectContaining({
					type: "string",
					enum: ["todo", "doing", "done"],
				}),
			);

			const lookupResult = await graphql<{
				table: CreatedTable | null;
			}>(
				`
          query ProjectionSmokeTableLookup($id: ID!) {
            table(id: $id) {
              id
              identifier
            }
          }
        `,
				{ id: table.id },
			);

			expect(lookupResult.table).toEqual({
				id: table.id,
				identifier: tableIdentifier,
			});
		},
		TEST_TIMEOUT,
	);

	async function graphql<TData>(
		query: string,
		variables?: Record<string, unknown>,
	): Promise<TData> {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
		});
		expect(response.status).toBe(200);

		const result = (await response.json()) as GraphQLResponse<TData>;
		expect(result.errors).toBeUndefined();
		expect(result.data).toBeDefined();

		return result.data as TData;
	}

	async function createAttributeType(input: {
		identifier: string;
		name: string;
		dataType: string;
		constraints: Record<string, unknown>;
	}): Promise<CreatedAttributeType> {
		const result = await graphql<{
			createAttributeType: MutationPayload<{
				attributeType: CreatedAttributeType;
			}>;
		}>(
			`
        mutation CreateProjectionSmokeAttributeType($input: CreateAttributeTypeInput!) {
          createAttributeType(input: $input) {
            success
            attributeType {
              id
              identifier
              dataType
            }
            errors {
              message
              code
              field
            }
          }
        }
      `,
			{ input },
		);

		return expectSuccessfulMutation(
			result.createAttributeType,
			"createAttributeType",
		).attributeType;
	}

	async function createAttribute(input: {
		tableId: string;
		identifier: string;
		name: string;
		attributeTypeId: string;
	}): Promise<void> {
		const result = await graphql<{
			createAttribute: MutationPayload<{
				attribute: {
					id: string;
					identifier: string;
					tableId: string;
				};
			}>;
		}>(
			`
        mutation CreateProjectionSmokeAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            success
            attribute {
              id
              identifier
              tableId
            }
            errors {
              message
              code
              field
            }
          }
        }
      `,
			{ input },
		);

		expectSuccessfulMutation(result.createAttribute, "createAttribute");
	}

	async function listTableMcpTools(tableId: string): Promise<ListedTool[]> {
		const response = await tableMcpMiddleware(
			new Request(`${MCP_BASE_URL}/sub/${tableId}/mcp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: `tools-list-${tableId}`,
					method: "tools/list",
					params: {},
				}),
			}),
		);

		expect(response.status).toBe(200);

		const result = await response.json();
		expect(result.error).toBeUndefined();
		expect(Array.isArray(result.result?.tools)).toBe(true);

		return result.result.tools as ListedTool[];
	}

	function getCreateNodeTool(tools: ListedTool[], tableId: string): ListedTool {
		const tool = tools.find(
			(candidate) => candidate.name === `create-table-${tableId}-node`,
		);
		expect(tool).toBeDefined();
		return tool as ListedTool;
	}

	function getUpdateNodeTool(tools: ListedTool[], tableId: string): ListedTool {
		const tool = tools.find(
			(candidate) => candidate.name === `update-table-${tableId}-node`,
		);
		expect(tool).toBeDefined();
		return tool as ListedTool;
	}

	function expectSuccessfulMutation<
		TPayload extends { success: boolean; errors: GraphQLError[] },
	>(payload: TPayload, operation: string): TPayload {
		expect(
			payload.success,
			`${operation} failed: ${JSON.stringify(payload.errors)}`,
		).toBe(true);
		expect(payload.errors).toEqual([]);
		return payload;
	}
});

function connectGraphqlFetchToYoga(
	yoga: Awaited<ReturnType<typeof createGraphQLYoga>>,
	fallbackFetch: typeof fetch,
): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string" || input instanceof URL
				? String(input)
				: input.url;
		if (url === GRAPHQL_ENDPOINT) {
			return yoga.fetch(url, init);
		}
		return fallbackFetch(input, init);
	}) as typeof fetch;
}
