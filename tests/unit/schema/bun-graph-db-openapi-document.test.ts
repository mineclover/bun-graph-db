import { describe, expect, it } from "bun:test";
import { validateOpenApiProjection } from "@oa-sdk/openapi-projection-contract";
import { buildBunGraphDbOpenApiDocument } from "@/core/schema/BunGraphDbOpenApiDocument.js";

describe("bun-graph-db static OpenAPI document builder", () => {
	it("builds an OpenAPI 3.2 document with stable top-level sections", () => {
		const document = buildBunGraphDbOpenApiDocument();

		expect(document.openapi).toBe("3.2.0");
		expect(document.info).toEqual(
			expect.objectContaining({
				title: "bun-graph-db API",
				version: "1.0.0",
			}),
		);
		expect(document.paths).toHaveProperty(
			"/api/openapi",
		);
		expect(document.paths).toHaveProperty(
			"/api/tables/{tableId}/openapi-projection",
		);
		expect(document.paths).toHaveProperty("/mcp");
		expect(document.paths).toHaveProperty("/sub/{tableId}/mcp");
		expect(document.components.schemas).toHaveProperty("JsonRpcRequest");
		expect(document.components.schemas).toHaveProperty("JsonRpcResponse");
		expect(document.components.schemas).toHaveProperty("JsonRpcError");
		expect(document.components.schemas).toHaveProperty("McpInitializeRequest");
		expect(document.components.schemas).toHaveProperty("McpToolsListRequest");
		expect(document.components.schemas).toHaveProperty("McpToolsCallRequest");
		expect(document.components.schemas).toHaveProperty("McpContentBlock");
		expect(document.components.schemas).toHaveProperty("McpToolDefinition");

		expect(
			validateOpenApiProjection({
				profile: "full-api-document",
				projection: document,
				refs: [],
				diagnostics: [],
				sources: {},
				versionHash: "static-test",
			}),
		).toEqual({
			valid: true,
			diagnostics: [],
		});
	});

	it("documents the REST full document export endpoint without table parameters", () => {
		const document = buildBunGraphDbOpenApiDocument();
		const operation = document.paths["/api/openapi"]?.get;

		expect(operation?.operationId).toBe("getOpenApiDocument");
		expect(operation?.parameters).toBeUndefined();
		expect(operation?.responses["200"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/BunGraphDbFullOpenApiDocument",
		});
		expect(document.components.schemas.BunGraphDbFullOpenApiDocument).toEqual({
			type: "object",
			description:
				"Static OpenAPI 3.2 document for stable bun-graph-db REST and MCP discovery.",
			required: ["openapi", "info", "paths", "components"],
			properties: {
				openapi: { type: "string", const: "3.2.0" },
				info: {
					type: "object",
					additionalProperties: true,
				},
				paths: {
					type: "object",
					additionalProperties: true,
				},
				components: {
					type: "object",
					additionalProperties: true,
				},
			},
			additionalProperties: true,
		});
	});

	it("documents the REST table projection export endpoint", () => {
		const document = buildBunGraphDbOpenApiDocument();
		const operation =
			document.paths["/api/tables/{tableId}/openapi-projection"]?.get;

		expect(operation?.operationId).toBe("getTableOpenApiProjection");
		expect(operation?.parameters).toEqual([
			{ $ref: "#/components/parameters/TableId" },
			{ $ref: "#/components/parameters/ProjectionProfile" },
		]);
		expect(operation?.responses["200"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/OpenApiProjectionRestResponse",
		});
		expect(operation?.responses["400"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/TableOpenApiProjectionBadRequestResponse",
		});
		expect(document.components.parameters.TableId).toEqual({
			name: "tableId",
			in: "path",
			required: true,
			description:
				"Runtime table id used by REST projection and table-scoped MCP endpoints.",
			schema: { type: "string" },
		});
		expect(document.components.parameters.ProjectionProfile).toEqual({
			name: "profile",
			in: "query",
			required: false,
			description:
				"Projection profile to export. Defaults to component-bundle when omitted. Unsupported values return HTTP 400.",
			schema: { $ref: "#/components/schemas/TableOpenApiProjectionProfile" },
		});
		expect(document.components.schemas.TableOpenApiProjectionProfile).toEqual({
			type: "string",
			enum: ["component-bundle", "operation-contract"],
			default: "component-bundle",
			description:
				"Supported table projection export profiles. full-api-document and empty strings are invalid because table-scoped export only returns one current table projection.",
		});
		expect(document.components.schemas.OpenApiProjectionRestResponse).toEqual({
			type: "object",
			description:
				"Standard REST success envelope for a table OpenAPI projection export. Read data.versionHash to track freshness of the runtime table schema projection.",
			required: ["success", "data"],
			properties: {
				success: { type: "boolean", const: true },
				data: { $ref: "#/components/schemas/OpenApiProjectionResult" },
			},
			additionalProperties: false,
		});
		expect(document.components.schemas.TableOpenApiProjectionBadRequestResponse).toEqual({
			description:
				"Bad request response for table projection export. Unsupported profile values such as full-api-document return the InvalidTableProjectionProfileResponse shape.",
			anyOf: [
				{ $ref: "#/components/schemas/InvalidTableProjectionProfileResponse" },
				{ $ref: "#/components/schemas/ApiErrorResponse" },
			],
		});
		expect(document.components.schemas.InvalidTableProjectionProfileResponse).toEqual({
			type: "object",
			description:
				"Returned when profile is not component-bundle or operation-contract.",
			required: ["success", "error"],
			properties: {
				success: { type: "boolean", const: false },
				error: {
					type: "string",
					const: "profile must be component-bundle or operation-contract",
				},
			},
			additionalProperties: true,
		});
	});

	it("documents root and table-scoped MCP endpoints as JSON-RPC POST operations", () => {
		const document = buildBunGraphDbOpenApiDocument();
		const rootOperation = document.paths["/mcp"]?.post;
		const tableOperation = document.paths["/sub/{tableId}/mcp"]?.post;

		expect(rootOperation?.operationId).toBe("callRootMcpJsonRpc");
		expect(rootOperation?.requestBody?.content["application/json"].schema).toEqual({
			$ref: "#/components/schemas/McpJsonRpcRequest",
		});
		expect(rootOperation?.responses["200"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/McpJsonRpcResponse",
		});

		expect(tableOperation?.operationId).toBe("callTableMcpJsonRpc");
		expect(tableOperation?.parameters).toEqual([
			{ $ref: "#/components/parameters/TableId" },
		]);
		expect(tableOperation?.requestBody?.content["application/json"].schema).toEqual({
			$ref: "#/components/schemas/TableMcpJsonRpcRequest",
		});
		expect(tableOperation?.responses["200"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/McpJsonRpcResponse",
		});
		expect(rootOperation?.description).toContain(
			"Tool-specific argument schemas are discovered dynamically through tools/list",
		);
		expect(tableOperation?.description).toContain(
			"Table-specific tool argument schemas are discovered dynamically through tools/list",
		);
		expect(tableOperation?.description).toContain(
			"get-openapi-projection-{tableId}",
		);
	});

	it("includes MCP initialize, tools/list, and tools/call request schemas", () => {
		const { schemas } = buildBunGraphDbOpenApiDocument().components;

		expect(schemas.McpInitializeRequest).toEqual({
			type: "object",
			description: "MCP initialize JSON-RPC request.",
			required: ["jsonrpc", "method", "params"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: { $ref: "#/components/schemas/JsonRpcId" },
				method: { type: "string", const: "initialize" },
				params: { $ref: "#/components/schemas/McpInitializeParams" },
			},
			additionalProperties: false,
		});
		expect(schemas.McpToolsListRequest).toEqual({
			type: "object",
			description:
				"MCP tools/list JSON-RPC request. The response advertises available tools and their current inputSchema contracts.",
			required: ["jsonrpc", "method"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: { $ref: "#/components/schemas/JsonRpcId" },
				method: { type: "string", const: "tools/list" },
				params: { $ref: "#/components/schemas/McpToolsListParams" },
			},
			additionalProperties: false,
		});
		expect(schemas.McpToolsCallRequest).toEqual({
			type: "object",
			description:
				"MCP tools/call JSON-RPC request. Tool-specific argument schemas are dynamic and must be discovered through tools/list.",
			required: ["jsonrpc", "method", "params"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: { $ref: "#/components/schemas/JsonRpcId" },
				method: { type: "string", const: "tools/call" },
				params: { $ref: "#/components/schemas/McpToolsCallParams" },
			},
			additionalProperties: false,
		});
		expect(schemas.McpJsonRpcRequest.anyOf).toEqual([
			{ $ref: "#/components/schemas/McpInitializeRequest" },
			{ $ref: "#/components/schemas/McpToolsListRequest" },
			{ $ref: "#/components/schemas/McpToolsCallRequest" },
			{ $ref: "#/components/schemas/JsonRpcRequest" },
		]);
		expect(schemas.JsonRpcBatchRequest).toBeUndefined();
		expect(schemas.TableMcpJsonRpcRequest.description).toContain("tableId");
		expect(schemas.TableMcpJsonRpcRequest.anyOf).toEqual(
			schemas.McpJsonRpcRequest.anyOf,
		);
	});

	it("includes MCP content block and tool definition schemas", () => {
		const { schemas } = buildBunGraphDbOpenApiDocument().components;

		expect(schemas.McpContentBlock).toEqual({
			description: "MCP content block returned by tools/call results.",
			oneOf: [
				{ $ref: "#/components/schemas/McpTextContentBlock" },
				{ $ref: "#/components/schemas/McpImageContentBlock" },
				{ $ref: "#/components/schemas/McpResourceContentBlock" },
			],
		});
		expect(schemas.McpToolDefinition).toEqual({
			type: "object",
			description:
				"MCP tool definition as returned by tools/list. inputSchema contains the dynamic argument contract for tools/call.",
			required: ["name", "description", "inputSchema"],
			properties: {
				name: { type: "string" },
				description: { type: "string" },
				inputSchema: { $ref: "#/components/schemas/JsonSchemaObject" },
				annotations: { $ref: "#/components/schemas/JsonObject" },
				_meta: { $ref: "#/components/schemas/JsonObject" },
			},
			additionalProperties: true,
		});
		expect(schemas.McpToolArguments.description).toContain(
			"tools/list",
		);
		expect(schemas.JsonSchemaObject.description).toContain(
			"discovered dynamically from tools/list",
		);
		expect(schemas.McpToolsListResult.properties?.tools).toEqual({
			type: "array",
			items: { $ref: "#/components/schemas/McpToolDefinition" },
		});
		expect(schemas.McpToolsCallResult.properties?.content).toEqual({
			type: "array",
			items: { $ref: "#/components/schemas/McpContentBlock" },
		});
	});

	it("includes reusable JSON-RPC request response and error schemas", () => {
		const { schemas } = buildBunGraphDbOpenApiDocument().components;

		expect(schemas.JsonRpcRequest).toEqual({
			type: "object",
			required: ["jsonrpc", "method"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: { $ref: "#/components/schemas/JsonRpcId" },
				method: { type: "string" },
				params: { $ref: "#/components/schemas/JsonValue" },
			},
			additionalProperties: false,
		});
		expect(schemas.JsonRpcResponse).toEqual({
			oneOf: [
				{ $ref: "#/components/schemas/JsonRpcSuccessResponse" },
				{ $ref: "#/components/schemas/JsonRpcErrorResponse" },
			],
		});
		expect(schemas.McpJsonRpcResponse).toEqual({
			oneOf: [{ $ref: "#/components/schemas/JsonRpcResponse" }],
		});
		expect(schemas.JsonRpcBatchResponse).toBeUndefined();
		expect(schemas.JsonRpcError).toEqual({
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "integer" },
				message: { type: "string" },
				data: { $ref: "#/components/schemas/JsonValue" },
			},
			additionalProperties: false,
		});
	});

	it("does not inline runtime table schemas into the static full document", () => {
		const document = buildBunGraphDbOpenApiDocument();
		const serialized = JSON.stringify(document);

		expect(serialized).not.toContain("NodeInput_");
		expect(serialized).not.toContain("NodeAttributes_");
		expect(serialized).not.toContain("AttributeType_");
		expect(serialized).not.toContain("test_table");
		expect(serialized).not.toContain("/schema-engine/tables/");
		expect(
			document.components.schemas.OpenApiProjectionDocument.properties?.components,
		).toEqual({
			type: "object",
			additionalProperties: true,
		});
	});
});
