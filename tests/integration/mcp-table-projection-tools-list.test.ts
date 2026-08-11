import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { validateOpenApiProjection } from "@oa-sdk/openapi-projection-contract";
import type { Database } from "bun:sqlite";
import { TableSchemaProjectionService } from "../../src/application/services/TableSchemaProjectionService";
import { projectTableSchema } from "../../src/core/schema/TableSchemaProjection";
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

describe("Table MCP tools/list projection schemas", () => {
	let container: DIContainer;
	let testEnvironment: TestEnvironment;
	let restoreDatabasePath: () => void;
	let originalFetch: typeof fetch;
	const tableMcpMiddlewares: Array<
		ReturnType<typeof createTableMcpMiddleware>
	> = [];
	const createTrackedTableMcpMiddleware = (
		config: Parameters<typeof createTableMcpMiddleware>[0],
	) => {
		const middleware = createTableMcpMiddleware(config);
		tableMcpMiddlewares.push(middleware);
		return middleware;
	};

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

		testEnvironment = await createTestEnvironment(
			"mcp-table-projection-tools-list",
			"integration",
		);
		process.env.DATABASE_PATH = testEnvironment.databasePath;
		container = await createContainer();
	});

	afterAll(async () => {
		globalThis.fetch = originalFetch;
		await Promise.all(tableMcpMiddlewares.map((middleware) => middleware.close()));
		await resetContainer();
		restoreDatabasePath?.();
		await testEnvironment.cleanup();
	});

	test("includes projection-derived attributes on table-scoped create node tool schema", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db);
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

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
		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection.test/api",
			projectionService,
		});

		const tools = await listTableMcpTools(tableMcpMiddleware, tableId);

		expect(
			tools.some((tool) => tool.name === `get-table-metadata-${tableId}`),
		).toBe(true);
		expect(
			tools.some((tool) => tool.name === `get-table-${tableId}-attributes`),
		).toBe(true);

		const openApiProjectionTool = tools.find(
			(tool) => tool.name === `get-openapi-projection-${tableId}`,
		);
		expect(openApiProjectionTool).toBeDefined();
		expect(openApiProjectionTool?.description).toContain(
			"OpenAPI 3.2 projection artifact for the current table",
		);
		expect(openApiProjectionTool?.inputSchema).toEqual(
			expect.objectContaining({
				type: "object",
				required: [],
				additionalProperties: false,
				properties: expect.objectContaining({
					profile: expect.objectContaining({
						type: "string",
						enum: ["component-bundle", "operation-contract"],
						default: "component-bundle",
					}),
				}),
			}),
		);

		const createNodeTool = tools.find(
			(tool) => tool.name === `create-table-${tableId}-node`,
		);
		const updateNodeTool = tools.find(
			(tool) => tool.name === `update-table-${tableId}-node`,
		);
		expect(createNodeTool).toBeDefined();
		expect(updateNodeTool).toBeDefined();
		expect(createNodeTool?.inputSchema.required).toEqual([
			"content",
			"attributes",
		]);
		expect(updateNodeTool?.inputSchema.required).toEqual(["nodeId"]);
		expect(updateNodeTool?.inputSchema.properties.content).toEqual({
			type: "string",
		});

		const attributesSchema = createNodeTool?.inputSchema.properties.attributes;
		expect(attributesSchema).toEqual(
			expect.objectContaining({
				type: "object",
				additionalProperties: false,
				required: ["status"],
				properties: expect.objectContaining({
					status: expect.objectContaining({
						type: "string",
						enum: ["todo", "doing", "done"],
					}),
					effort: expect.objectContaining({
						type: "integer",
						minimum: 0,
						maximum: 8,
					}),
				}),
			}),
		);
		expect(createNodeTool?._meta?.tableSchemaProjection).toEqual(
			expect.objectContaining({
				available: true,
				usable: true,
				profile: "operation-contract",
				schemaSource: "openapi-projection",
				tableId: String(tableId),
				tableIdentifier: "projection_tasks",
				diagnostics: [],
			}),
		);
		expect(updateNodeTool?.inputSchema.properties.attributes).toEqual(
			expect.objectContaining({
				type: "object",
				additionalProperties: false,
				required: [],
				properties: attributesSchema.properties,
			}),
		);
	});

	test("refreshes cached table-scoped schema after attribute creation", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db, "projection_refresh_tasks");
		const dueDateTypeId = seedAttributeType(
			db,
			"projection_refresh_due_date",
			"string",
		);
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection-refresh.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

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
		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection-refresh.test/api",
			projectionService,
		});

		const beforeTools = await listTableMcpTools(tableMcpMiddleware, tableId);
		const beforeCreateNodeTool = beforeTools.find(
			(tool) => tool.name === `create-table-${tableId}-node`,
		);
		expect(
			beforeCreateNodeTool?.inputSchema.properties.attributes.properties
				.due_date,
		).toBeUndefined();

		const mutationResponse = await yoga.fetch(graphqlEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				query: `
          mutation CreateAttribute($input: CreateAttributeInput!) {
            createAttribute(input: $input) {
              success
              attribute {
                id
                tableId
                identifier
              }
              errors {
                message
                code
              }
            }
          }
        `,
				variables: {
					input: {
						tableId,
						identifier: "due_date",
						name: "Due Date",
						attributeTypeId: dueDateTypeId,
					},
				},
			}),
		});
		const mutationResult = await mutationResponse.json();
		expect(mutationResult.errors).toBeUndefined();
		expect(mutationResult.data.createAttribute.success).toBe(true);

		const afterTools = await listTableMcpTools(tableMcpMiddleware, tableId);
		const afterCreateNodeTool = afterTools.find(
			(tool) => tool.name === `create-table-${tableId}-node`,
		);
		const afterAttributesSchema =
			afterCreateNodeTool?.inputSchema.properties.attributes;

		expect(afterAttributesSchema.properties.due_date).toEqual(
			expect.objectContaining({
				type: "string",
			}),
		);
	});

	test("lists projection export tool without projection service and reports service absence on call", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db, "projection_no_service_tasks");
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection-no-service.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection-no-service.test/api",
		});

		const tools = await listTableMcpTools(tableMcpMiddleware, tableId);
		const openApiProjectionTool = tools.find(
			(tool) => tool.name === `get-openapi-projection-${tableId}`,
		);

		expect(openApiProjectionTool).toBeDefined();
		expect(openApiProjectionTool?.description).toContain(
			"OpenAPI 3.2 projection artifact for the current table",
		);
		expect(openApiProjectionTool?.inputSchema).toEqual(
			expect.objectContaining({
				type: "object",
				required: [],
				additionalProperties: false,
				properties: expect.objectContaining({
					profile: expect.objectContaining({
						type: "string",
						enum: ["component-bundle", "operation-contract"],
						default: "component-bundle",
					}),
				}),
			}),
		);

		const callResult = await callTableMcpTool(
			tableMcpMiddleware,
			tableId,
			`get-openapi-projection-${tableId}`,
			{},
		);
		const output = readToolTextPayload(callResult);

		expect(callResult.result.isError).toBe(true);
		expect(output).toEqual(
			expect.objectContaining({
				projection: null,
				validation: expect.objectContaining({
					valid: false,
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							severity: "error",
							code: "openapi-projection/service-unavailable",
						}),
					]),
				}),
				error: expect.objectContaining({
					code: "openapi-projection/service-unavailable",
					message:
						"Table schema projection service is not configured for this table MCP server.",
				}),
			}),
		);
	});

	test("exports current table OpenAPI projection result and validation for supported profiles", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db, "projection_export_tasks");
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection-export.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

		const realProjectionService = new TableSchemaProjectionService(
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
		const projectCalls: Array<{ tableId: string }> = [];
		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection-export.test/api",
			projectionService: {
				project: async (request) => {
					projectCalls.push({ tableId: request.tableId });
					return realProjectionService.project(request);
				},
			},
		});

		await listTableMcpTools(tableMcpMiddleware, tableId);
		projectCalls.length = 0;

		const componentCall = await callTableMcpTool(
			tableMcpMiddleware,
			tableId,
			`get-openapi-projection-${tableId}`,
			{},
		);
		const componentOutput = readToolTextPayload(componentCall);
		const componentProjection = componentOutput.projection;

		expect(componentCall.result.isError).toBe(false);
		expect(projectCalls).toEqual([{ tableId }]);
		expect(componentOutput.validation).toEqual(
			validateOpenApiProjection(componentProjection),
		);
		expect(componentOutput.validation).toEqual({
			valid: true,
			diagnostics: [],
		});
		expectProjectionEnvelopeFields(componentProjection, "component-bundle");
		expect(componentProjection.projection.paths).toEqual({});
		expect(componentProjection.projection.components.schemas).toEqual(
			expect.objectContaining({
				NodeAttributes_ProjectionExportTasks: expect.objectContaining({
					type: "object",
				}),
			}),
		);

		const operationCall = await callTableMcpTool(
			tableMcpMiddleware,
			tableId,
			`get-openapi-projection-${tableId}`,
			{ profile: "operation-contract" },
		);
		const operationOutput = readToolTextPayload(operationCall);
		const operationProjection = operationOutput.projection;

		expect(operationCall.result.isError).toBe(false);
		expect(projectCalls).toEqual([{ tableId }, { tableId }]);
		expect(operationOutput.validation).toEqual(
			validateOpenApiProjection(operationProjection),
		);
		expect(operationOutput.validation).toEqual({
			valid: true,
			diagnostics: [],
		});
		expectProjectionEnvelopeFields(operationProjection, "operation-contract");
		expect(operationProjection.projection.paths).toEqual(
			expect.objectContaining({
				"/schema-engine/tables/projection_export_tasks/nodes":
					expect.objectContaining({
						post: expect.objectContaining({
							operationId: "createProjectionExportTasksNode",
						}),
					}),
				"/schema-engine/tables/projection_export_tasks/nodes/{nodeId}":
					expect.objectContaining({
						patch: expect.objectContaining({
							operationId: "updateProjectionExportTasksNode",
						}),
					}),
			}),
		);
	});

	test("returns structured projection error for unsupported profile", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db, "projection_invalid_profile_tasks");
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection-invalid-profile.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection-invalid-profile.test/api",
		});

		const callResult = await callTableMcpTool(
			tableMcpMiddleware,
			tableId,
			`get-openapi-projection-${tableId}`,
			{ profile: "full-api-document" },
		);
		const output = readToolTextPayload(callResult);

		expect(callResult.result.isError).toBe(true);
		expect(output).toEqual(
			expect.objectContaining({
				projection: null,
				validation: expect.objectContaining({
					valid: false,
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							severity: "error",
							code: "openapi-projection/invalid-profile",
							message:
								"profile must be component-bundle or operation-contract",
						}),
					]),
				}),
				error: expect.objectContaining({
					code: "openapi-projection/invalid-profile",
					message: "profile must be component-bundle or operation-contract",
				}),
			}),
		);
	});

	test("marks projection error diagnostics unusable on table-scoped tools", async () => {
		const db = testEnvironment.database.getConnection();
		const tableId = seedProjectedTable(db, "projection_broken_tasks");
		const yoga = await createGraphQLYoga(container);
		const graphqlEndpoint = "http://mcp-projection-broken.test/graphql";
		connectGraphqlFetchToYoga(graphqlEndpoint, yoga, originalFetch);

		const projection = projectTableSchema({
			table: {
				id: tableId,
				identifier: "projection_broken_tasks",
			},
			attributeTypes: [],
			attributes: [
				{
					id: "attr_missing_type",
					tableId,
					identifier: "missing_type",
					attributeTypeId: "missing-type",
					isRequired: true,
				},
			],
		});
		const tableMcpMiddleware = createTrackedTableMcpMiddleware({
			graphqlEndpoint,
			restApiBaseUrl: "http://mcp-projection-broken.test/api",
			projectionService: {
				project: async () => projection,
			},
		});

		const tools = await listTableMcpTools(tableMcpMiddleware, tableId);
		const createNodeTool = tools.find(
			(tool) => tool.name === `create-table-${tableId}-node`,
		);
		const updateNodeTool = tools.find(
			(tool) => tool.name === `update-table-${tableId}-node`,
		);

		expect(createNodeTool?.inputSchema.properties.attributes).toEqual(
			expect.objectContaining({
				type: "object",
				additionalProperties: true,
			}),
		);
		expect(updateNodeTool?.inputSchema).toEqual(
			expect.objectContaining({
				type: "object",
				required: ["nodeId", "attributes"],
				properties: expect.objectContaining({
					nodeId: expect.objectContaining({ type: "string" }),
					attributes: expect.objectContaining({
						type: "object",
						additionalProperties: true,
						required: [],
					}),
				}),
			}),
		);
		expect(createNodeTool?._meta?.tableSchemaProjection).toEqual(
			expect.objectContaining({
				available: true,
				usable: false,
				profile: "operation-contract",
				schemaSource: "openapi-projection",
				tableId,
				errors: expect.arrayContaining([
					expect.objectContaining({ code: "attribute-type-not-found" }),
				]),
			}),
		);
		expect(updateNodeTool?._meta?.tableSchemaProjection).toEqual(
			expect.objectContaining({
				available: true,
				usable: false,
				profile: "operation-contract",
				schemaSource: "openapi-projection",
				tableId,
				errors: expect.arrayContaining([
					expect.objectContaining({ code: "attribute-type-not-found" }),
				]),
			}),
		);
	});
});

type ListedTool = {
	name: string;
	description: string;
	inputSchema: {
		type?: string;
		properties: Record<string, any>;
		required: string[];
		additionalProperties?: boolean;
	};
	_meta?: Record<string, any>;
};

function connectGraphqlFetchToYoga(
	graphqlEndpoint: string,
	yoga: Awaited<ReturnType<typeof createGraphQLYoga>>,
	fallbackFetch: typeof fetch,
): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string" || input instanceof URL
				? String(input)
				: input.url;
		if (url === graphqlEndpoint) {
			return yoga.fetch(url, init);
		}
		return fallbackFetch(input, init);
	}) as typeof fetch;
}

async function listTableMcpTools(
	tableMcpMiddleware: ReturnType<typeof createTableMcpMiddleware>,
	tableId: string,
): Promise<ListedTool[]> {
	const response = await tableMcpMiddleware(
		new Request(`http://mcp-projection.test/sub/${tableId}/mcp`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "tools-list",
				method: "tools/list",
				params: {},
			}),
		}),
	);

	expect(response).not.toBeNull();
	expect(response?.status).toBe(200);

	const result = await response!.json();
	return result.result.tools as ListedTool[];
}

async function callTableMcpTool(
	tableMcpMiddleware: ReturnType<typeof createTableMcpMiddleware>,
	tableId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<{
	result: {
		content: Array<{ type: string; text: string }>;
		isError: boolean;
	};
}> {
	const response = await tableMcpMiddleware(
		new Request(`http://mcp-projection.test/sub/${tableId}/mcp`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "tools-call",
				method: "tools/call",
				params: {
					name: toolName,
					arguments: args,
				},
			}),
		}),
	);

	expect(response).not.toBeNull();
	expect(response?.status).toBe(200);

	const result = await response!.json();
	expect(result.error).toBeUndefined();
	return result;
}

function readToolTextPayload(callResult: {
	result: { content: Array<{ text: string }> };
}): Record<string, any> {
	const textContent = callResult.result.content.find(
		(content) => typeof content.text === "string",
	);
	expect(textContent).toBeDefined();
	return JSON.parse(textContent!.text);
}

function expectProjectionEnvelopeFields(
	projection: Record<string, any>,
	profile: "component-bundle" | "operation-contract",
): void {
	expect(projection).toEqual(
		expect.objectContaining({
			profile,
			projection: expect.objectContaining({
				openapi: "3.2.0",
				"x-schema-engine-profile": profile,
				"x-schema-engine-version-hash": projection.versionHash,
				"x-schema-engine-refs": projection.refs,
				"x-schema-engine-sources": projection.sources,
			}),
			refs: expect.any(Array),
			diagnostics: expect.any(Array),
			sources: expect.any(Object),
			versionHash: expect.any(String),
			typeTargets: expect.any(Array),
		}),
	);
	expect(projection.refs.length).toBeGreaterThan(0);
	expect(Object.keys(projection.sources).length).toBeGreaterThan(0);
	expect(projection.typeTargets.length).toBeGreaterThan(0);
}

function seedProjectedTable(
	db: Database,
	tableIdentifier = "projection_tasks",
): string {
	db.prepare("INSERT INTO tables (identifier, description) VALUES (?, ?)").run(
		tableIdentifier,
		"Projection-backed MCP table",
	);

	const table = db
		.prepare("SELECT id FROM tables WHERE identifier = ?")
		.get(tableIdentifier) as { id: number };

	const statusTypeId = seedAttributeType(
		db,
		`${tableIdentifier}_task_status`,
		"string",
		JSON.stringify({ enum: ["todo", "doing", "done"] }),
	);
	const effortTypeId = seedAttributeType(
		db,
		`${tableIdentifier}_task_effort`,
		"integer",
		JSON.stringify({ minimum: 0, maximum: 8 }),
	);

	db.prepare(`
    INSERT INTO attributes (table_id, identifier, name, attribute_type_id, description, is_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(table.id, "status", "Status", statusTypeId, "Workflow status", 1);

	db.prepare(`
    INSERT INTO attributes (table_id, identifier, name, attribute_type_id, description, is_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(table.id, "effort", "Effort", effortTypeId, "Estimated effort", 0);

	return String(table.id);
}

function seedAttributeType(
	db: Database,
	identifier: string,
	jsonType: string,
	validationSchema?: string,
): string {
	db.prepare(`
    INSERT INTO attribute_types (identifier, json_type, description, validation_schema)
    VALUES (?, ?, ?, ?)
  `).run(identifier, jsonType, identifier, validationSchema ?? null);

	const attributeType = db
		.prepare("SELECT id FROM attribute_types WHERE identifier = ?")
		.get(identifier) as {
		id: number;
	};

	return String(attributeType.id);
}
