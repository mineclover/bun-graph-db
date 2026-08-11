export type OpenApiReference = {
	$ref: string;
};

export type OpenApiSchema = {
	type?: string | string[];
	const?: unknown;
	enum?: unknown[];
	format?: string;
	description?: string;
	default?: unknown;
	example?: unknown;
	properties?: Record<string, OpenApiSchema | OpenApiReference>;
	required?: string[];
	items?: OpenApiSchema | OpenApiReference;
	additionalProperties?: boolean | OpenApiSchema | OpenApiReference;
	oneOf?: Array<OpenApiSchema | OpenApiReference>;
	anyOf?: Array<OpenApiSchema | OpenApiReference>;
	minItems?: number;
};

export type OpenApiParameter = {
	name: string;
	in: "path" | "query" | "header" | "cookie";
	required?: boolean;
	description?: string;
	schema: OpenApiSchema | OpenApiReference;
};

export type OpenApiParameterOrReference = OpenApiParameter | OpenApiReference;

export type OpenApiMediaType = {
	schema: OpenApiSchema | OpenApiReference;
};

export type OpenApiRequestBody = {
	required?: boolean;
	description?: string;
	content: Record<string, OpenApiMediaType>;
};

export type OpenApiResponse = {
	description: string;
	headers?: Record<string, { description: string; schema: OpenApiSchema | OpenApiReference }>;
	content?: Record<string, OpenApiMediaType>;
};

export type OpenApiOperation = {
	operationId: string;
	summary: string;
	description?: string;
	tags?: string[];
	parameters?: OpenApiParameterOrReference[];
	requestBody?: OpenApiRequestBody;
	responses: Record<string, OpenApiResponse>;
};

export type OpenApiPathItem = {
	get?: OpenApiOperation;
	post?: OpenApiOperation;
};

export type BunGraphDbOpenApiDocument = {
	openapi: "3.2.0";
	info: {
		title: string;
		version: string;
		description: string;
	};
	paths: Record<string, OpenApiPathItem>;
	components: {
		parameters: Record<string, OpenApiParameter>;
		schemas: Record<string, OpenApiSchema>;
	};
};

const JSON_MEDIA_TYPE = "application/json";

export function buildBunGraphDbOpenApiDocument(): BunGraphDbOpenApiDocument {
	return {
		openapi: "3.2.0",
		info: {
			title: "bun-graph-db API",
			version: "1.0.0",
			description:
				"Stable REST and MCP JSON-RPC API surface for bun-graph-db. Runtime table schemas are exported separately through table OpenAPI projection profiles.",
		},
		paths: {
			"/api/openapi": {
				get: {
					operationId: "getOpenApiDocument",
					summary: "Fetch the static OpenAPI document",
					description:
						"Returns the stable bun-graph-db OpenAPI 3.2 document. Runtime table-specific schemas are discovered through table projection exports instead of being inlined here.",
					tags: ["OpenAPI"],
					responses: {
						"200": jsonResponse(
							"Static bun-graph-db OpenAPI document.",
							"#/components/schemas/BunGraphDbFullOpenApiDocument",
						),
					},
				},
			},
			"/api/tables/{tableId}/openapi-projection": {
				get: {
					operationId: "getTableOpenApiProjection",
					summary: "Export a table OpenAPI projection",
					description:
						"Returns the current OpenAPI projection envelope for one runtime table inside the standard REST success envelope. Use component-bundle for reusable schemas or operation-contract for table node operation request contracts; unsupported profiles such as full-api-document are rejected.",
					tags: ["OpenAPI projections"],
					parameters: [
						ref("#/components/parameters/TableId"),
						ref("#/components/parameters/ProjectionProfile"),
						ref("#/components/parameters/ProjectionIfNoneMatch"),
					],
					responses: {
						"200": {
							...jsonResponse(
								"REST success envelope containing the table OpenAPI projection.",
								"#/components/schemas/OpenApiProjectionRestResponse",
							),
							headers: projectionCacheHeaders(),
						},
						"304": {
							description: "The current projection version matches If-None-Match; no response body is returned.",
							headers: projectionCacheHeaders(),
						},
						"400": jsonResponse(
							"Invalid table id or projection profile.",
							"#/components/schemas/TableOpenApiProjectionBadRequestResponse",
						),
						"503": jsonResponse(
							"Projection service is unavailable.",
							"#/components/schemas/ApiErrorResponse",
						),
					},
				},
			},
			"/mcp": {
				post: createMcpJsonRpcOperation({
					operationId: "callRootMcpJsonRpc",
					summary: "Call the root MCP JSON-RPC endpoint",
					description:
						"Accepts MCP JSON-RPC requests for root server capabilities and tools. Tool-specific argument schemas are discovered dynamically through tools/list.",
					requestSchemaRef: "#/components/schemas/McpJsonRpcRequest",
				}),
			},
			"/sub/{tableId}/mcp": {
				post: createMcpJsonRpcOperation({
					operationId: "callTableMcpJsonRpc",
					summary: "Call a table-scoped MCP JSON-RPC endpoint",
					description:
						"Accepts MCP JSON-RPC requests scoped to one table. Table-specific tool argument schemas are discovered dynamically through tools/list or the get-openapi-projection-{tableId} projection export tool.",
					parameters: [ref("#/components/parameters/TableId")],
					requestSchemaRef: "#/components/schemas/TableMcpJsonRpcRequest",
				}),
			},
		},
		components: {
			parameters: createCommonParameters(),
			schemas: createReusableSchemas(),
		},
	};
}

function createMcpJsonRpcOperation(options: {
	operationId: string;
	summary: string;
	description: string;
	requestSchemaRef: string;
	parameters?: OpenApiParameterOrReference[];
}): OpenApiOperation {
	return {
		operationId: options.operationId,
		summary: options.summary,
		description: options.description,
		tags: ["MCP"],
		...(options.parameters ? { parameters: options.parameters } : {}),
		requestBody: {
			required: true,
			description:
				"JSON-RPC 2.0 request. Batch requests are not currently supported by this MCP server.",
			content: {
				[JSON_MEDIA_TYPE]: {
					schema: ref(options.requestSchemaRef),
				},
			},
		},
		responses: {
			"200": jsonResponse(
				"JSON-RPC response.",
				"#/components/schemas/McpJsonRpcResponse",
			),
			"400": jsonResponse(
				"Malformed JSON-RPC request.",
				"#/components/schemas/JsonRpcErrorResponse",
			),
			"404": jsonResponse(
				"Table-scoped MCP server was not found.",
				"#/components/schemas/JsonRpcErrorResponse",
			),
		},
	};
}

function createCommonParameters(): Record<string, OpenApiParameter> {
	return {
		TableId: {
			name: "tableId",
			in: "path",
			required: true,
			description: "Runtime table id used by REST projection and table-scoped MCP endpoints.",
			schema: {
				type: "string",
			},
		},
		ProjectionProfile: {
			name: "profile",
			in: "query",
			required: false,
			description:
				"Projection profile to export. Defaults to component-bundle when omitted. Unsupported values return HTTP 400.",
			schema: ref("#/components/schemas/TableOpenApiProjectionProfile"),
		},
		ProjectionIfNoneMatch: {
			name: "If-None-Match",
			in: "header",
			required: false,
			description: "Previously observed quoted projection version hash. A match returns HTTP 304.",
			schema: { type: "string" },
		},
	};
}

function createReusableSchemas(): Record<string, OpenApiSchema> {
	return {
		BunGraphDbFullOpenApiDocument: {
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
		},
		TableOpenApiProjectionProfile: {
			type: "string",
			enum: ["component-bundle", "operation-contract"],
			default: "component-bundle",
			description:
				"Supported table projection export profiles. full-api-document and empty strings are invalid because table-scoped export only returns one current table projection.",
		},
		OpenApiProjectionRestResponse: {
			type: "object",
			description:
				"Standard REST success envelope for a table OpenAPI projection export. Read data.versionHash to track freshness of the runtime table schema projection.",
			required: ["success", "data"],
			properties: {
				success: { type: "boolean", const: true },
				data: ref("#/components/schemas/OpenApiProjectionResult"),
			},
			additionalProperties: false,
		},
		TableOpenApiProjectionBadRequestResponse: {
			description:
				"Bad request response for table projection export. Unsupported profile values such as full-api-document return the InvalidTableProjectionProfileResponse shape.",
			anyOf: [
				ref("#/components/schemas/InvalidTableProjectionProfileResponse"),
				ref("#/components/schemas/ApiErrorResponse"),
			],
		},
		InvalidTableProjectionProfileResponse: {
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
		},
		OpenApiProjectionResult: {
			type: "object",
			description:
				"OpenAPI projection envelope for a runtime table projection export.",
			required: [
				"profile",
				"projection",
				"refs",
				"diagnostics",
				"sources",
				"versionHash",
			],
			properties: {
				profile: ref("#/components/schemas/TableOpenApiProjectionProfile"),
				projection: ref("#/components/schemas/OpenApiProjectionDocument"),
				refs: {
					type: "array",
					items: ref("#/components/schemas/SchemaRefEdge"),
				},
				diagnostics: {
					type: "array",
					items: ref("#/components/schemas/SchemaDiagnostic"),
				},
				sources: {
					type: "object",
					additionalProperties: ref("#/components/schemas/SchemaSourceCoordinate"),
				},
				versionHash: {
					type: "string",
					description: "Projection content freshness hash.",
				},
				typeTargets: {
					type: "array",
					items: ref("#/components/schemas/SchemaTypeTarget"),
				},
			},
			additionalProperties: true,
		},
		OpenApiProjectionDocument: {
			type: "object",
			description:
				"OpenAPI 3.2 document emitted by a projection profile. Table-specific schemas are provided by the projection response, not this static full document.",
			required: ["openapi", "info", "paths"],
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
		},
		SchemaRefEdge: {
			type: "object",
			required: ["from", "ref", "kind", "source"],
			properties: {
				from: { type: "string" },
				to: { type: "string" },
				ref: { type: "string" },
				kind: { type: "string" },
				source: ref("#/components/schemas/SchemaSourceCoordinate"),
			},
			additionalProperties: false,
		},
		SchemaDiagnostic: {
			type: "object",
			required: ["severity", "code", "message"],
			properties: {
				severity: {
					type: "string",
					enum: ["error", "warning", "info"],
				},
				code: { type: "string" },
				message: { type: "string" },
				source: ref("#/components/schemas/SchemaSourceCoordinate"),
			},
			additionalProperties: false,
		},
		SchemaSourceCoordinate: {
			type: "object",
			description: "Source coordinate for schema projection metadata.",
			additionalProperties: true,
		},
		SchemaTypeTarget: {
			type: "object",
			required: ["id", "name", "kind"],
			properties: {
				id: { type: "string" },
				name: { type: "string" },
				kind: { type: "string" },
				source: ref("#/components/schemas/SchemaSourceCoordinate"),
			},
			additionalProperties: false,
		},
		JsonValue: {
			description: "Any JSON value.",
		},
		JsonObject: {
			type: "object",
			description: "JSON object with arbitrary JSON-compatible property values.",
			additionalProperties: ref("#/components/schemas/JsonValue"),
		},
		JsonSchemaObject: {
			type: "object",
			description:
				"JSON Schema object. For MCP tools, concrete tool argument schemas are discovered dynamically from tools/list inputSchema values instead of being inlined into this static document.",
			additionalProperties: true,
		},
		JsonRpcId: {
			description: "JSON-RPC request identifier.",
			oneOf: [
				{ type: "string" },
				{ type: "number" },
				{ type: "null" },
			],
		},
		McpClientInfo: {
			type: "object",
			required: ["name", "version"],
			properties: {
				name: { type: "string" },
				version: { type: "string" },
			},
			additionalProperties: true,
		},
		McpCapabilities: {
			type: "object",
			description: "MCP capability advertisement object.",
			additionalProperties: ref("#/components/schemas/JsonValue"),
		},
		McpInitializeParams: {
			type: "object",
			required: ["protocolVersion", "capabilities", "clientInfo"],
			properties: {
				protocolVersion: { type: "string" },
				capabilities: ref("#/components/schemas/McpCapabilities"),
				clientInfo: ref("#/components/schemas/McpClientInfo"),
			},
			additionalProperties: true,
		},
		McpInitializeRequest: {
			type: "object",
			description: "MCP initialize JSON-RPC request.",
			required: ["jsonrpc", "method", "params"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: ref("#/components/schemas/JsonRpcId"),
				method: { type: "string", const: "initialize" },
				params: ref("#/components/schemas/McpInitializeParams"),
			},
			additionalProperties: false,
		},
		McpToolsListParams: {
			type: "object",
			description: "Optional MCP tools/list pagination parameters.",
			properties: {
				cursor: { type: "string" },
			},
			additionalProperties: true,
		},
		McpToolsListRequest: {
			type: "object",
			description:
				"MCP tools/list JSON-RPC request. The response advertises available tools and their current inputSchema contracts.",
			required: ["jsonrpc", "method"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: ref("#/components/schemas/JsonRpcId"),
				method: { type: "string", const: "tools/list" },
				params: ref("#/components/schemas/McpToolsListParams"),
			},
			additionalProperties: false,
		},
		McpToolArguments: {
			type: "object",
			description:
				"Arguments for the selected MCP tool. Validate these against the tool definition inputSchema returned by tools/list for the current root or table-scoped endpoint.",
			additionalProperties: ref("#/components/schemas/JsonValue"),
		},
		McpToolsCallParams: {
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				arguments: ref("#/components/schemas/McpToolArguments"),
			},
			additionalProperties: false,
		},
		McpToolsCallRequest: {
			type: "object",
			description:
				"MCP tools/call JSON-RPC request. Tool-specific argument schemas are dynamic and must be discovered through tools/list.",
			required: ["jsonrpc", "method", "params"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: ref("#/components/schemas/JsonRpcId"),
				method: { type: "string", const: "tools/call" },
				params: ref("#/components/schemas/McpToolsCallParams"),
			},
			additionalProperties: false,
		},
		McpTextContentBlock: {
			type: "object",
			required: ["type", "text"],
			properties: {
				type: { type: "string", const: "text" },
				text: { type: "string" },
				annotations: ref("#/components/schemas/JsonObject"),
			},
			additionalProperties: true,
		},
		McpImageContentBlock: {
			type: "object",
			required: ["type", "data", "mimeType"],
			properties: {
				type: { type: "string", const: "image" },
				data: { type: "string", format: "byte" },
				mimeType: { type: "string" },
				annotations: ref("#/components/schemas/JsonObject"),
			},
			additionalProperties: true,
		},
		McpResourceContentBlock: {
			type: "object",
			required: ["type", "resource"],
			properties: {
				type: { type: "string", const: "resource" },
				resource: ref("#/components/schemas/JsonObject"),
				annotations: ref("#/components/schemas/JsonObject"),
			},
			additionalProperties: true,
		},
		McpContentBlock: {
			description: "MCP content block returned by tools/call results.",
			oneOf: [
				ref("#/components/schemas/McpTextContentBlock"),
				ref("#/components/schemas/McpImageContentBlock"),
				ref("#/components/schemas/McpResourceContentBlock"),
			],
		},
		McpToolDefinition: {
			type: "object",
			description:
				"MCP tool definition as returned by tools/list. inputSchema contains the dynamic argument contract for tools/call.",
			required: ["name", "description", "inputSchema"],
			properties: {
				name: { type: "string" },
				description: { type: "string" },
				inputSchema: ref("#/components/schemas/JsonSchemaObject"),
				annotations: ref("#/components/schemas/JsonObject"),
				_meta: ref("#/components/schemas/JsonObject"),
			},
			additionalProperties: true,
		},
		McpToolsListResult: {
			type: "object",
			required: ["tools"],
			properties: {
				tools: {
					type: "array",
					items: ref("#/components/schemas/McpToolDefinition"),
				},
			},
			additionalProperties: true,
		},
		McpToolsCallResult: {
			type: "object",
			required: ["content"],
			properties: {
				content: {
					type: "array",
					items: ref("#/components/schemas/McpContentBlock"),
				},
				isError: { type: "boolean" },
			},
			additionalProperties: true,
		},
		JsonRpcRequest: {
			type: "object",
			required: ["jsonrpc", "method"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				id: ref("#/components/schemas/JsonRpcId"),
				method: { type: "string" },
				params: ref("#/components/schemas/JsonValue"),
			},
			additionalProperties: false,
		},
		McpJsonRpcRequest: {
			description:
				"Root MCP endpoint JSON-RPC request. Known protocol methods are modeled explicitly; other compatible JSON-RPC requests remain accepted for forward compatibility.",
			anyOf: [
				ref("#/components/schemas/McpInitializeRequest"),
				ref("#/components/schemas/McpToolsListRequest"),
				ref("#/components/schemas/McpToolsCallRequest"),
				ref("#/components/schemas/JsonRpcRequest"),
			],
		},
		TableMcpJsonRpcRequest: {
			description:
				"Table-scoped MCP endpoint JSON-RPC request. Tool names and argument schemas are scoped to the path tableId and discovered dynamically through tools/list.",
			anyOf: [
				ref("#/components/schemas/McpInitializeRequest"),
				ref("#/components/schemas/McpToolsListRequest"),
				ref("#/components/schemas/McpToolsCallRequest"),
				ref("#/components/schemas/JsonRpcRequest"),
			],
		},
		JsonRpcSuccessResponse: {
			type: "object",
			required: ["jsonrpc", "result", "id"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				result: ref("#/components/schemas/JsonValue"),
				id: ref("#/components/schemas/JsonRpcId"),
			},
			additionalProperties: false,
		},
		JsonRpcError: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "integer" },
				message: { type: "string" },
				data: ref("#/components/schemas/JsonValue"),
			},
			additionalProperties: false,
		},
		JsonRpcErrorResponse: {
			type: "object",
			required: ["jsonrpc", "error", "id"],
			properties: {
				jsonrpc: { type: "string", const: "2.0" },
				error: ref("#/components/schemas/JsonRpcError"),
				id: ref("#/components/schemas/JsonRpcId"),
			},
			additionalProperties: false,
		},
		JsonRpcResponse: {
			oneOf: [
				ref("#/components/schemas/JsonRpcSuccessResponse"),
				ref("#/components/schemas/JsonRpcErrorResponse"),
			],
		},
		McpJsonRpcResponse: {
			oneOf: [ref("#/components/schemas/JsonRpcResponse")],
		},
		ApiErrorResponse: {
			type: "object",
			required: ["success", "error"],
			properties: {
				success: { type: "boolean", const: false },
				error: { type: "string" },
				message: { type: "string" },
			},
			additionalProperties: true,
		},
	};
}

function jsonResponse(description: string, schemaRef: string): OpenApiResponse {
	return {
		description,
		content: {
			[JSON_MEDIA_TYPE]: {
				schema: ref(schemaRef),
			},
		},
	};
}

function projectionCacheHeaders(): NonNullable<OpenApiResponse['headers']> {
	return {
		ETag: {
			description: "Quoted content hash for the current runtime table projection.",
			schema: { type: "string" },
		},
		"Cache-Control": {
			description: "Projection responses require revalidation before reuse.",
			schema: { type: "string", const: "private, must-revalidate" },
		},
	};
}

function ref($ref: string): OpenApiReference {
	return { $ref };
}
