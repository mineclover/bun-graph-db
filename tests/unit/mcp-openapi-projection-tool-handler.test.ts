import {
	OPENAPI_PROJECTION_PROFILE_EXTENSION,
	OPENAPI_PROJECTION_REFS_EXTENSION,
	OPENAPI_PROJECTION_SOURCES_EXTENSION,
	OPENAPI_PROJECTION_VERSION_HASH_EXTENSION,
	validateOpenApiProjection,
} from "@oa-sdk/openapi-projection-contract";
import { describe, expect, test } from "vitest";
import { projectTableSchema } from "../../src/core/schema/TableSchemaProjection";
import type { TableSchemaProjection } from "../../src/core/schema/TableSchemaProjection";
import { TableMcpServer } from "../../src/presentation/mcp/factory/TableMcpServer";

type ProjectionProfile = "component-bundle" | "operation-contract";

type ProjectionRecord = {
	profile: ProjectionProfile;
	projection: Record<string, unknown> & {
		paths?: Record<string, unknown>;
		components?: {
			schemas?: Record<string, unknown>;
		};
	};
	refs: unknown[];
	diagnostics: unknown[];
	sources: Record<string, unknown>;
	versionHash: string;
	typeTargets: unknown[];
};

type ProjectionToolOutput = {
	projection: ProjectionRecord | null;
	validation: {
		valid: boolean;
		diagnostics: unknown[];
	};
	error?: {
		code: string;
		message: string;
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

type TableMcpServerHarness = TableMcpServer & {
	addOpenApiProjectionTool(): void;
	tableInitialized: boolean;
};

describe("TableMcpServer OpenAPI projection export handler", () => {
	test("defaults to the component-bundle profile", async () => {
		const { server, projectCalls, tableId } = createProjectionServerHarness();

		const { response, output } = await callProjectionTool(server, tableId, {});

		expect(response.result?.isError).toBe(false);
		expect(projectCalls).toEqual([{ tableId }]);
		expectProjectionOutput(output);
		expect(output.projection.profile).toBe("component-bundle");
		expect(output.projection.projection.paths).toEqual({});
		expect(output.validation.valid).toBe(true);
	});

	test("returns component-bundle projection and validation output shape", async () => {
		const { server, tableId } = createProjectionServerHarness();

		const { response, output } = await callProjectionTool(server, tableId, {
			profile: "component-bundle",
		});

		expect(response.result?.isError).toBe(false);
		expectProjectionOutput(output);
		expect(output.validation).toEqual(
			validateOpenApiProjection(output.projection),
		);
		expect(output.validation.valid).toBe(true);
		expect(output.projection.profile).toBe("component-bundle");
		expect(output.projection.projection.paths).toEqual({});
		expect(output.projection.projection.components?.schemas).toEqual(
			expect.objectContaining({
				NodeAttributes_ProjectionHandlerTasks: expect.objectContaining({
					type: "object",
				}),
				NodeInput_ProjectionHandlerTasks: expect.objectContaining({
					type: "object",
				}),
			}),
		);
		expectProjectionEnvelopeMetadata(output.projection, "component-bundle");
	});

	test("returns operation-contract projection and validation output shape", async () => {
		const { server, tableId } = createProjectionServerHarness();

		const { response, output } = await callProjectionTool(server, tableId, {
			profile: "operation-contract",
		});

		expect(response.result?.isError).toBe(false);
		expectProjectionOutput(output);
		expect(output.validation).toEqual(
			validateOpenApiProjection(output.projection),
		);
		expect(output.validation.valid).toBe(true);
		expect(output.projection.profile).toBe("operation-contract");
		expect(output.projection.projection.paths).toEqual(
			expect.objectContaining({
				"/schema-engine/tables/projection_handler_tasks/nodes":
					expect.objectContaining({
						post: expect.objectContaining({
							operationId: "createProjectionHandlerTasksNode",
							requestBody: expect.objectContaining({
								required: true,
							}),
						}),
					}),
				"/schema-engine/tables/projection_handler_tasks/nodes/{nodeId}":
					expect.objectContaining({
						patch: expect.objectContaining({
							operationId: "updateProjectionHandlerTasksNode",
							parameters: expect.arrayContaining([
								expect.objectContaining({
									name: "nodeId",
									in: "path",
									required: true,
								}),
							]),
						}),
					}),
			}),
		);
		expectProjectionEnvelopeMetadata(output.projection, "operation-contract");
	});

	test("returns invalid projection diagnostics without a JSON-RPC error", async () => {
		const projection = createInvalidTableProjection();
		const server = createInitializedProjectionServer(projection.tableId, {
			project: async () => projection,
		});

		const { response, output } = await callProjectionTool(
			server,
			projection.tableId,
			{ profile: "operation-contract" },
		);

		expect(response.error).toBeUndefined();
		expect(response.result?.isError).toBe(true);
		expectProjectionOutput(output);
		expect(output.error).toBeUndefined();
		expect(output.projection.profile).toBe("operation-contract");
		expect(output.validation).toEqual(
			validateOpenApiProjection(output.projection),
		);
		expect(output.validation.valid).toBe(false);
		expect(output.projection.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					severity: "error",
					code: "attribute-type-not-found",
					source: expect.objectContaining({
						kind: "db",
						entity: "attribute",
						id: "attr_missing_type",
						pointer: "#",
					}),
				}),
			]),
		);
		expect(output.validation.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					severity: "error",
					code: "attribute-type-not-found",
					source: expect.objectContaining({
						kind: "db",
						entity: "attribute",
						id: "attr_missing_type",
						pointer: "#",
					}),
				}),
			]),
		);
	});

	test("returns a structured error for unsupported profiles", async () => {
		const projection = createTableProjection();
		const projectCalls: Array<{ tableId: string }> = [];
		const server = createInitializedProjectionServer(projection.tableId, {
			project: async (request: { tableId: string }) => {
				projectCalls.push({ tableId: request.tableId });
				return projection;
			},
		});

		const { response, output } = await callProjectionTool(
			server,
			projection.tableId,
			{ profile: "full-api-document" },
		);

		expect(response.result?.isError).toBe(true);
		expect(projectCalls).toEqual([]);
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
				error: {
					code: "openapi-projection/invalid-profile",
					message: "profile must be component-bundle or operation-contract",
				},
			}),
		);
	});

	test("returns a structured error for an empty profile string", async () => {
		const projection = createTableProjection();
		const projectCalls: Array<{ tableId: string }> = [];
		const server = createInitializedProjectionServer(projection.tableId, {
			project: async (request: { tableId: string }) => {
				projectCalls.push({ tableId: request.tableId });
				return projection;
			},
		});

		const { response, output } = await callProjectionTool(
			server,
			projection.tableId,
			{ profile: "" },
		);

		expect(response.result?.isError).toBe(true);
		expect(projectCalls).toEqual([]);
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
				error: {
					code: "openapi-projection/invalid-profile",
					message: "profile must be component-bundle or operation-contract",
				},
			}),
		);
	});

	test("returns a structured error when projection service is missing", async () => {
		const tableId = "table_projection_handler";
		const server = createInitializedProjectionServer(tableId);

		const { response, output } = await callProjectionTool(server, tableId, {});

		expect(response.result?.isError).toBe(true);
		expect(output).toEqual(
			expect.objectContaining({
				projection: null,
				validation: expect.objectContaining({
					valid: false,
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							severity: "error",
							code: "openapi-projection/service-unavailable",
							message:
								"Table schema projection service is not configured for this table MCP server.",
						}),
					]),
				}),
				error: {
					code: "openapi-projection/service-unavailable",
					message:
						"Table schema projection service is not configured for this table MCP server.",
				},
			}),
		);
	});
});

function createProjectionServerHarness(): {
	server: TableMcpServer;
	tableId: string;
	projectCalls: Array<{ tableId: string }>;
} {
	const projection = createTableProjection();
	const projectCalls: Array<{ tableId: string }> = [];
	const server = createInitializedProjectionServer(projection.tableId, {
		project: async (request: { tableId: string }) => {
			projectCalls.push({ tableId: request.tableId });
			return projection;
		},
	});

	return {
		server,
		tableId: projection.tableId,
		projectCalls,
	};
}

function createInitializedProjectionServer(
	tableId: string,
	projectionService?: {
		project: (request: { tableId: string }) => Promise<TableSchemaProjection>;
	},
): TableMcpServer {
	const server = new TableMcpServer(
		tableId,
		"http://mcp-projection-handler.test/graphql",
		"http://mcp-projection-handler.test/api",
		{ projectionService },
	);
	const harness = server as unknown as TableMcpServerHarness;
	harness.addOpenApiProjectionTool();
	harness.tableInitialized = true;
	return server;
}

async function callProjectionTool(
	server: TableMcpServer,
	tableId: string,
	args: Record<string, unknown>,
): Promise<{ response: ToolCallResponse; output: ProjectionToolOutput }> {
	const response = (await server.handleToolsCall("unit-call", {
		name: `get-openapi-projection-${tableId}`,
		arguments: args,
	})) as ToolCallResponse;
	expect(response.error).toBeUndefined();

	return {
		response,
		output: readToolOutput(response),
	};
}

function readToolOutput(response: ToolCallResponse): ProjectionToolOutput {
	const text = response.result?.content?.find(
		(entry) => typeof entry.text === "string",
	)?.text;
	expect(text).toBeDefined();
	if (!text) {
		throw new Error("Expected projection tool to return text content");
	}
	return JSON.parse(text) as ProjectionToolOutput;
}

function expectProjectionOutput(
	output: ProjectionToolOutput,
): asserts output is ProjectionToolOutput & { projection: ProjectionRecord } {
	expect(output.projection).not.toBeNull();
	if (!output.projection) {
		throw new Error("Expected projection output");
	}
}

function expectProjectionEnvelopeMetadata(
	projection: ProjectionRecord,
	profile: ProjectionProfile,
): void {
	const document = projection.projection;

	expect(projection).toEqual(
		expect.objectContaining({
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
	expect(document[OPENAPI_PROJECTION_PROFILE_EXTENSION]).toBe(profile);
	expect(document[OPENAPI_PROJECTION_VERSION_HASH_EXTENSION]).toBe(
		projection.versionHash,
	);
	expect(document[OPENAPI_PROJECTION_REFS_EXTENSION]).toEqual(projection.refs);
	expect(document[OPENAPI_PROJECTION_SOURCES_EXTENSION]).toEqual(
		projection.sources,
	);
}

function createTableProjection(): TableSchemaProjection {
	return projectTableSchema({
		table: {
			id: "table_projection_handler",
			identifier: "projection_handler_tasks",
			description: "Projection handler unit table",
			updatedAt: "2026-04-16T00:00:00.000Z",
		},
		attributeTypes: [
			{
				id: "type_status",
				identifier: "status",
				jsonType: "string",
				validationSchema: JSON.stringify({
					enum: ["todo", "doing", "done"],
				}),
			},
			{
				id: "type_effort",
				identifier: "effort",
				jsonType: "integer",
				validationSchema: JSON.stringify({
					minimum: 0,
					maximum: 8,
				}),
			},
		],
		attributes: [
			{
				id: "attr_status",
				tableId: "table_projection_handler",
				identifier: "status",
				attributeTypeId: "type_status",
				isRequired: true,
			},
			{
				id: "attr_effort",
				tableId: "table_projection_handler",
				identifier: "effort",
				attributeTypeId: "type_effort",
				isRequired: false,
			},
		],
	});
}

function createInvalidTableProjection(): TableSchemaProjection {
	return projectTableSchema({
		table: {
			id: "table_projection_invalid_handler",
			identifier: "projection_invalid_handler_tasks",
			description: "Projection handler invalid unit table",
			updatedAt: "2026-04-16T00:00:00.000Z",
		},
		attributeTypes: [],
		attributes: [
			{
				id: "attr_missing_type",
				tableId: "table_projection_invalid_handler",
				identifier: "missing_type",
				attributeTypeId: "missing-type",
				isRequired: true,
			},
		],
	});
}
