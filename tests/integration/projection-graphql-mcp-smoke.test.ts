import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	OPENAPI_PROJECTION_VERSION_HASH_EXTENSION,
	validateOpenApiProjection,
} from "@oa-sdk/openapi-projection-contract";
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

type ProjectionProfile = "component-bundle" | "operation-contract";

type ProjectionEnvelope = {
	profile: ProjectionProfile;
	projection: {
		openapi: string;
		paths: Record<string, Record<string, unknown>>;
		components?: {
			schemas?: Record<string, unknown>;
		};
		[OPENAPI_PROJECTION_VERSION_HASH_EXTENSION]?: string;
	};
	refs: unknown[];
	sources: Record<string, unknown>;
	diagnostics: unknown[];
	versionHash: string;
	typeTargets: unknown[];
};

type ProjectionToolOutput = {
	projection: ProjectionEnvelope | null;
	validation: {
		valid: boolean;
		diagnostics: unknown[];
	};
};

type ToolCallResponse = {
	result?: {
		content?: Array<{
			type?: string;
			text?: string;
		}>;
		isError?: boolean;
	};
	error?: unknown;
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
		"exports a newly created table OpenAPI projection through table-scoped MCP",
		async () => {
			const suffix = Date.now();
			const tableIdentifier = `mcp_projection_export_${suffix}`;
			const statusTypeIdentifier = `mcp_export_status_${suffix}`;
			const priorityTypeIdentifier = `mcp_export_priority_${suffix}`;

			const tableResult = await graphql<{
				createTable: MutationPayload<{ table: CreatedTable }>;
			}>(
				`
          mutation CreateMcpProjectionExportTable($input: CreateTableInput!) {
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
						description: "MCP projection export integration table",
					},
				},
			);
			const table = expectSuccessfulMutation(
				tableResult.createTable,
				"createTable",
			).table;

			const statusType = await createAttributeType({
				identifier: statusTypeIdentifier,
				name: "Export Status",
				dataType: "string",
				constraints: { enum: ["draft", "ready", "archived"] },
			});
			const priorityType = await createAttributeType({
				identifier: priorityTypeIdentifier,
				name: "Export Priority",
				dataType: "integer",
				constraints: { minimum: 1, maximum: 5 },
			});

			await createAttribute({
				tableId: table.id,
				identifier: "status",
				name: "Status",
				attributeTypeId: statusType.id,
			});
			await createAttribute({
				tableId: table.id,
				identifier: "priority",
				name: "Priority",
				attributeTypeId: priorityType.id,
			});

			const tools = await listTableMcpTools(table.id);
			const projectionTool = tools.find(
				(tool) => tool.name === `get-openapi-projection-${table.id}`,
			);
			expect(projectionTool).toBeDefined();
			if (!projectionTool) {
				throw new Error("Expected MCP projection export tool");
			}

			const componentCall = await callTableMcpTool(
				table.id,
				projectionTool.name,
				{ profile: "component-bundle" },
			);
			const componentOutput = readProjectionToolOutput(componentCall);
			expect(componentCall.result?.isError).toBe(false);
			expectProjectionOutput(componentOutput);
			expect(componentOutput.validation).toEqual(
				validateOpenApiProjection(componentOutput.projection),
			);
			expect(componentOutput.validation).toEqual({
				valid: true,
				diagnostics: [],
			});
			expectProjectionEnvelopeFields(
				componentOutput.projection,
				"component-bundle",
			);
			const componentSchemas =
				componentOutput.projection.projection.components?.schemas;
			expect(componentSchemas).toBeDefined();
			expect(Object.keys(componentSchemas ?? {})).toEqual(
				expect.arrayContaining([
					expect.stringContaining("NodeInput_"),
					expect.stringContaining("NodeAttributes_"),
					expect.stringContaining("AttributeType_"),
				]),
			);

			const operationCall = await callTableMcpTool(
				table.id,
				projectionTool.name,
				{ profile: "operation-contract" },
			);
			const operationOutput = readProjectionToolOutput(operationCall);
			expect(operationCall.result?.isError).toBe(false);
			expectProjectionOutput(operationOutput);
			expect(operationOutput.validation).toEqual(
				validateOpenApiProjection(operationOutput.projection),
			);
			expect(operationOutput.validation).toEqual({
				valid: true,
				diagnostics: [],
			});
			expectProjectionEnvelopeFields(
				operationOutput.projection,
				"operation-contract",
			);
			expect(operationOutput.projection.projection.paths).toEqual(
				expect.objectContaining({
					[`/schema-engine/tables/${table.identifier}/nodes`]:
						expect.objectContaining({
							post: expect.objectContaining({
								operationId: expect.stringContaining("create"),
							}),
						}),
					[`/schema-engine/tables/${table.identifier}/nodes/{nodeId}`]:
						expect.objectContaining({
							patch: expect.objectContaining({
								operationId: expect.stringContaining("update"),
							}),
						}),
				}),
			);
		},
		TEST_TIMEOUT,
	);

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
			const beforeProjectionTool = getProjectionTool(beforeTools, table.id);
			const beforeCreateNodeTool = getCreateNodeTool(beforeTools, table.id);
			const beforeUpdateNodeTool = getUpdateNodeTool(beforeTools, table.id);
			const beforeAttributesSchema =
				beforeCreateNodeTool.inputSchema.properties.attributes;
			const beforeProjectionHash =
				beforeCreateNodeTool._meta?.tableSchemaProjection?.versionHash;

			expect(beforeProjectionHash).toBeDefined();
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
			const beforeProjectionCall = await callTableMcpTool(
				table.id,
				beforeProjectionTool.name,
				{ profile: "component-bundle" },
			);
			const beforeProjectionOutput =
				readProjectionToolOutput(beforeProjectionCall);
			expect(beforeProjectionCall.result?.isError).toBe(false);
			expectProjectionOutput(beforeProjectionOutput);
			expect(beforeProjectionOutput.validation).toEqual(
				validateOpenApiProjection(beforeProjectionOutput.projection),
			);
			expect(beforeProjectionOutput.projection.versionHash).toBe(
				beforeProjectionHash,
			);
			expect(
				beforeProjectionOutput.projection.projection[
					OPENAPI_PROJECTION_VERSION_HASH_EXTENSION
				],
			).toBe(beforeProjectionOutput.projection.versionHash);
			const beforeProjectionSchemas = expectProjectionComponentSchemas(
				beforeProjectionOutput.projection,
			);
			const beforeNodeAttributesSchema = getComponentSchemaByPrefix(
				beforeProjectionSchemas,
				"NodeAttributes_",
			);
			expect(beforeNodeAttributesSchema.properties.status).toEqual(
				expect.objectContaining({
					$ref: expect.stringContaining("AttributeType_SmokeStatus"),
				}),
			);
			const beforeStatusTypeSchema = getComponentSchemaByPrefix(
				beforeProjectionSchemas,
				"AttributeType_SmokeStatus",
			);
			expect(beforeStatusTypeSchema.enum).toEqual(["todo", "doing"]);

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
			const afterProjectionTool = getProjectionTool(afterTools, table.id);
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
			expect(
				afterUpdateNodeTool._meta?.tableSchemaProjection?.versionHash,
			).toBe(afterProjectionHash);
			const afterProjectionCall = await callTableMcpTool(
				table.id,
				afterProjectionTool.name,
				{ profile: "component-bundle" },
			);
			const afterProjectionOutput = readProjectionToolOutput(afterProjectionCall);
			expect(afterProjectionCall.result?.isError).toBe(false);
			expectProjectionOutput(afterProjectionOutput);
			expect(afterProjectionOutput.validation).toEqual(
				validateOpenApiProjection(afterProjectionOutput.projection),
			);
			expect(afterProjectionOutput.projection.versionHash).toBe(
				afterProjectionHash,
			);
			expect(afterProjectionOutput.projection.versionHash).not.toBe(
				beforeProjectionOutput.projection.versionHash,
			);
			expect(
				afterProjectionOutput.projection.projection[
					OPENAPI_PROJECTION_VERSION_HASH_EXTENSION
				],
			).toBe(afterProjectionOutput.projection.versionHash);
			const afterProjectionSchemas = expectProjectionComponentSchemas(
				afterProjectionOutput.projection,
			);
			const afterNodeAttributesSchema = getComponentSchemaByPrefix(
				afterProjectionSchemas,
				"NodeAttributes_",
			);
			expect(afterNodeAttributesSchema.properties.status).toEqual(
				beforeNodeAttributesSchema.properties.status,
			);
			const afterStatusTypeSchema = getComponentSchemaByPrefix(
				afterProjectionSchemas,
				"AttributeType_SmokeStatus",
			);
			expect(afterStatusTypeSchema.enum).toEqual(["todo", "doing", "done"]);
			expect(afterStatusTypeSchema.enum).not.toEqual(beforeStatusTypeSchema.enum);

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

	async function callTableMcpTool(
		tableId: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<ToolCallResponse> {
		const response = await tableMcpMiddleware(
			new Request(`${MCP_BASE_URL}/sub/${tableId}/mcp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: `tools-call-${tableId}`,
					method: "tools/call",
					params: {
						name: toolName,
						arguments: args,
					},
				}),
			}),
		);

		expect(response.status).toBe(200);

		const result = (await response.json()) as ToolCallResponse;
		expect(result.error).toBeUndefined();

		return result;
	}

	function readProjectionToolOutput(
		response: ToolCallResponse,
	): ProjectionToolOutput {
		const text = response.result?.content?.find(
			(entry) => typeof entry.text === "string",
		)?.text;
		expect(text).toBeDefined();
		if (!text) {
			throw new Error("Expected projection MCP tool to return text content");
		}

		return JSON.parse(text) as ProjectionToolOutput;
	}

	function expectProjectionOutput(
		output: ProjectionToolOutput,
	): asserts output is ProjectionToolOutput & { projection: ProjectionEnvelope } {
		expect(output.projection).not.toBeNull();
		if (!output.projection) {
			throw new Error("Expected MCP projection output");
		}
	}

	function expectProjectionEnvelopeFields(
		projection: ProjectionEnvelope,
		profile: ProjectionProfile,
	): void {
		expect(projection).toEqual(
			expect.objectContaining({
				profile,
				refs: expect.any(Array),
				sources: expect.any(Object),
				diagnostics: expect.any(Array),
				versionHash: expect.any(String),
				typeTargets: expect.any(Array),
			}),
		);
		expect(projection.refs.length).toBeGreaterThan(0);
		expect(Object.keys(projection.sources).length).toBeGreaterThan(0);
		expect(projection.diagnostics).toEqual([]);
		expect(projection.versionHash.length).toBeGreaterThan(0);
		expect(projection.typeTargets.length).toBeGreaterThan(0);
	}

	function expectProjectionComponentSchemas(
		projection: ProjectionEnvelope,
	): Record<string, any> {
		const schemas = projection.projection.components?.schemas;
		expect(schemas).toBeDefined();
		if (!schemas) {
			throw new Error("Expected projection components.schemas");
		}
		return schemas as Record<string, any>;
	}

	function getComponentSchemaByPrefix(
		schemas: Record<string, any>,
		prefix: string,
	): Record<string, any> {
		const entry = Object.entries(schemas).find(([name]) =>
			name.startsWith(prefix),
		);
		expect(entry).toBeDefined();
		if (!entry) {
			throw new Error(`Expected component schema starting with ${prefix}`);
		}
		return entry[1] as Record<string, any>;
	}

	function getProjectionTool(tools: ListedTool[], tableId: string): ListedTool {
		const tool = tools.find(
			(candidate) => candidate.name === `get-openapi-projection-${tableId}`,
		);
		expect(tool).toBeDefined();
		return tool as ListedTool;
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
