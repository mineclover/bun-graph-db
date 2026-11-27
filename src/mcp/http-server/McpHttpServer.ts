/**
 * MCP HTTP Server implementing dual-era MCP compatibility.
 *
 * Modern requests use MCP 2026-07-28's stateless, per-request metadata model.
 * Initialize-based clients continue through 2025-11-25 LTS and earlier 2025/2024 revisions.
 */

import Ajv, { type ValidateFunction } from "ajv";
import type { AiMemoryService } from "../../application/services/AiMemoryService.js";
import type { InformationArchitectureService } from "../../application/services/InformationArchitectureService.js";
import {
	type McpToolAction,
	type McpToolAudience,
	McpToolRegistry,
	type ResolvedMcpToolAccess,
} from "../../application/services/McpToolRegistry.ts";
import { RestApiClient } from "../../application/services/RestApiClient.js";
import { DEFAULT_PORTS } from "../../core/config/PortConfiguration.js";
import { BUN_GRAPH_DB_API_VERSION } from "../../core/contracts/RestRouteContract.js";
import {
	type FetchLike,
	type GraphQLExecutionResult,
	type GraphQLOperation,
	GraphQLOperationExecutor,
	type GraphQLVariables,
} from "../../models/GraphQLOperation.ts";
import { API_ENDPOINT_MAPPING } from "../../presentation/http/routes/ApiEndpointMapping.js";
import {
	handleRootCustomTool,
	type McpRootToolHost,
} from "./McpRootToolHandlers.js";
import {
	extractTraceMeta,
	isJsonRpcNotification,
	isModernMcpRequest,
	isModernProtocolVersion,
	isSupportedProtocolVersion,
	isValidMcpOrigin,
	LATEST_LEGACY_MCP_PROTOCOL_VERSION,
	MODERN_MCP_PROTOCOL_VERSION,
	normalizeHeaderOws,
	SUPPORTED_MCP_PROTOCOL_VERSIONS,
	usesStrictProtocolSemantics,
	validateJsonRpcBatch,
	validateModernMcpRequest,
	withModernResult,
	withStructuredToolResult,
} from "./modern-protocol.js";

interface McpRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: unknown;
}

export interface McpResponse {
	jsonrpc: "2.0";
	id?: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

type McpToolArgs = Record<string, unknown>;

interface McpToolCallParams {
	name?: string;
	arguments?: McpToolArgs;
}

type McpRequestAudience = McpToolAudience;

interface McpInitializeParams {
	protocolVersion: string;
	capabilities: {
		roots?: {
			listChanged?: boolean;
		};
		sampling?: object;
	};
	clientInfo: {
		name: string;
		version: string;
	};
}

interface RootToolsListCacheEntry {
	legacyResult: Record<string, unknown>;
	legacyResultJson: string;
	modernResultJson: string;
}

export class McpHttpServer {
	private toolRegistry: McpToolRegistry;
	private graphqlExecutor: GraphQLOperationExecutor;
	private restApiClient: RestApiClient;
	private initialized: boolean = false;
	private initializationPromise: Promise<void> | undefined;
	private closePromise: Promise<void> | undefined;
	private closed: boolean = false;
	private protocolVersion: string = LATEST_LEGACY_MCP_PROTOCOL_VERSION;
	private ajv: Ajv;
	private validatorCache: WeakMap<object, ValidateFunction> = new WeakMap();
	private toolsListCache: Map<string, RootToolsListCacheEntry> = new Map();
	private readonly debugHotpathEnabled =
		process.env.BUN_GRAPH_DB_MCP_DEBUG === "1" ||
		process.env.BUN_GRAPH_DB_MCP_DEBUG === "true";

	// Server capabilities according to MCP spec
	private capabilities = {
		tools: {},
		logging: {},
	};

	// `logging` was deprecated in MCP 2026-07-28, so only advertise tools to
	// stateless clients. Keep the legacy capability set above for 2025 clients.
	private modernCapabilities = {
		tools: {},
	};

	// Server info
	private serverInfo = {
		name: "Bun Graph Database - MCP Server",
		version: BUN_GRAPH_DB_API_VERSION,
		description:
			"GraphQL-based graph database with AI integration. Manage tables, nodes, relationships, and execute graph queries via Model Context Protocol.",
	};

	constructor(
		graphqlEndpoint: string,
		restApiBaseUrl?: string,
		internalBridgeToken = process.env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN,
		fetchImpl?: FetchLike,
		private readonly aiMemoryService?: AiMemoryService,
		private readonly iaService?: InformationArchitectureService,
	) {
		this.toolRegistry = new McpToolRegistry();
		this.graphqlExecutor = new GraphQLOperationExecutor(
			graphqlEndpoint,
			internalBridgeToken,
			fetchImpl,
		);
		this.restApiClient = new RestApiClient(
			restApiBaseUrl || `http://localhost:${DEFAULT_PORTS.development}/api`,
			internalBridgeToken,
			fetchImpl,
		);
		this.ajv = new Ajv();
	}

	async initialize(): Promise<void> {
		this.assertOpen();
		if (this.initialized) return;
		if (this.initializationPromise) return this.initializationPromise;

		this.initializationPromise = (async () => {
			this.debugHotpath("Initializing MCP server...");

			// Initialize tools (contract + built-in tools)
			await this.toolRegistry.initialize();
			this.assertOpen();
			this.toolsListCache.clear();

			const toolCount = (await this.toolRegistry.getAllTools()).length;
			this.debugHotpath(`Loaded ${toolCount} MCP tools`);

			this.initialized = true;
			this.debugHotpath("MCP server initialized successfully");
		})();

		try {
			await this.initializationPromise;
		} finally {
			this.initializationPromise = undefined;
		}
	}

	/**
	 * Release the server's in-memory lifecycle state. HTTP transports own their
	 * sockets, so this server only needs to close its request-facing state.
	 */
	async close(): Promise<void> {
		if (this.closePromise) return this.closePromise;

		this.closed = true;
		this.closePromise = (async () => {
			try {
				await this.initializationPromise;
			} catch {
				// A failed initialization has no additional resources to release.
			}

			this.initialized = false;
			this.toolsListCache.clear();
			this.validatorCache = new WeakMap();
			this.ajv.removeSchema();
		})();

		return this.closePromise;
	}

	isClosed(): boolean {
		return this.closed;
	}

	/**
	 * Table-scoped servers use this typed boundary instead of reaching into the
	 * root server's private GraphQL executor.
	 */
	async executeGraphQLOperation<TData = unknown>(
		operation: GraphQLOperation,
		variables?: GraphQLVariables,
	): Promise<GraphQLExecutionResult<TData>> {
		this.assertOpen();
		return this.graphqlExecutor.execute(operation, variables) as Promise<
			GraphQLExecutionResult<TData>
		>;
	}

	/**
	 * Compatibility entry point for table-scoped legacy initialize requests.
	 */
	async handleLegacyInitialize(
		id: string | number | undefined,
		params: unknown,
	): Promise<McpResponse> {
		if (!isMcpInitializeParams(params)) {
			return this.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"Initialize params required",
			);
		}

		return this.handleInitialize(id, params);
	}

	getToolAction(name: string): McpToolAction | undefined {
		return this.toolRegistry.getTool(name).tool?.access?.action;
	}

	resolveToolAccess(
		name: string,
		argumentsValue: unknown,
	): ResolvedMcpToolAccess | undefined {
		return this.toolRegistry.resolveAccess(name, argumentsValue);
	}

	// Main HTTP request handler according to MCP HTTP transport spec
	async handleRequest(
		request: Request,
		audience?: McpRequestAudience,
	): Promise<Response> {
		if (this.closed) return this.createClosedResponse();

		// Validate HTTP method
		if (request.method !== "POST" && request.method !== "GET") {
			return new Response(
				JSON.stringify(
					this.createErrorMcpResponse(
						null,
						-32600,
						"Invalid Request",
						"Only POST and GET methods are supported",
					),
				),
				{
					status: 405,
					headers: {
						"Content-Type": "application/json",
						Allow: "POST, GET",
					},
				},
			);
		}

		// Validate protocol version header (defer unsupported modern revisions to JSON-RPC handler so request id is preserved)
		const protocolVersion = normalizeHeaderOws(
			request.headers.get("MCP-Protocol-Version"),
		);
		if (
			protocolVersion &&
			!isSupportedProtocolVersion(protocolVersion) &&
			!(request.method === "POST" && isModernProtocolVersion(protocolVersion))
		) {
			return new Response(
				JSON.stringify(
					this.createErrorMcpResponse(
						null,
						-32022,
						"Unsupported protocol version",
						{
							requested: protocolVersion,
							supported: [...SUPPORTED_MCP_PROTOCOL_VERSIONS],
						},
					),
				),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate Origin header for security (DNS rebinding protection)
		const origin = request.headers.get("Origin");
		if (origin && !isValidMcpOrigin(origin)) {
			return new Response(
				JSON.stringify({
					error: "Invalid origin",
				}),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Handle GET requests (server discovery)
		if (request.method === "GET") {
			return new Response(
				JSON.stringify({
					name: this.serverInfo.name,
					version: this.serverInfo.version,
					protocolVersion: MODERN_MCP_PROTOCOL_VERSION,
					supportedVersions: [...SUPPORTED_MCP_PROTOCOL_VERSIONS],
					capabilities: this.modernCapabilities,
					modernCapabilities: this.modernCapabilities,
					legacyCapabilities: this.capabilities,
				}),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-cache",
						"MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION,
					},
				},
			);
		}

		// Handle POST requests (JSON-RPC)
		try {
			const contentType = request.headers.get("Content-Type");
			if (
				contentType !== null &&
				!contentType.toLowerCase().includes("application/json")
			) {
				return new Response(
					JSON.stringify({
						error: "Unsupported Media Type",
						details: "Content-Type must be application/json",
					}),
					{
						status: 415,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			await this.initialize();

			if (this.closed) return this.createClosedResponse();

			const body = await request.text();
			if (!body) {
				return this.createErrorResponse(
					null,
					-32600,
					"Invalid Request",
					"Empty request body",
				);
			}

			let parsedBody: unknown;
			try {
				parsedBody = JSON.parse(body);
			} catch (_error) {
				return this.createErrorResponse(
					null,
					-32700,
					"Parse error",
					"Invalid JSON",
				);
			}

			const batchError = validateJsonRpcBatch(parsedBody);
			if (batchError) {
				return this.createErrorResponse(
					null,
					batchError.code,
					batchError.message,
					batchError.data,
				);
			}

			if (!parsedBody || typeof parsedBody !== "object") {
				return this.createErrorResponse(
					null,
					-32600,
					"Invalid Request",
					"Request body must be a JSON object",
				);
			}

			const jsonRpcRequest = parsedBody as McpRequest;

			// Validate JSON-RPC format
			if (jsonRpcRequest.jsonrpc !== "2.0") {
				return this.createErrorResponse(
					jsonRpcRequest.id,
					-32600,
					"Invalid Request",
					"Invalid JSON-RPC version",
				);
			}

			if (isModernMcpRequest(jsonRpcRequest, request.headers)) {
				return await this.handleModernRequest(
					jsonRpcRequest,
					request.headers,
					audience,
				);
			}

			const strictLegacy = usesStrictProtocolSemantics(protocolVersion);
			if (
				isJsonRpcNotification(jsonRpcRequest) &&
				(jsonRpcRequest.method === "notifications/initialized" ||
					jsonRpcRequest.method === "initialized" ||
					jsonRpcRequest.method === "notifications/cancelled")
			) {
				if (strictLegacy) {
					return new Response(null, {
						status: 202,
						headers: {
							"Cache-Control": "no-cache",
							"MCP-Protocol-Version": LATEST_LEGACY_MCP_PROTOCOL_VERSION,
						},
					});
				}
				return new Response(JSON.stringify(this.createNotificationResponse()), {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-cache",
					},
				});
			}

			if (jsonRpcRequest.method === "tools/list") {
				return this.createCachedToolsListResponse(
					jsonRpcRequest.id,
					audience,
					false,
					undefined,
					strictLegacy ? LATEST_LEGACY_MCP_PROTOCOL_VERSION : undefined,
				);
			}

			// Route the request based on method
			const result = await this.handleMethod(
				jsonRpcRequest,
				audience,
				strictLegacy,
			);
			const responseHeaders: Record<string, string> = {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
			};
			if (strictLegacy) {
				responseHeaders["MCP-Protocol-Version"] =
					LATEST_LEGACY_MCP_PROTOCOL_VERSION;
			} else if (
				jsonRpcRequest.method === "initialize" &&
				result.result &&
				typeof result.result === "object" &&
				(result.result as { protocolVersion?: unknown }).protocolVersion ===
					LATEST_LEGACY_MCP_PROTOCOL_VERSION
			) {
				responseHeaders["MCP-Protocol-Version"] =
					LATEST_LEGACY_MCP_PROTOCOL_VERSION;
			}

			return new Response(JSON.stringify(result), {
				status: 200,
				headers: responseHeaders,
			});
		} catch (error) {
			if (this.closed) return this.createClosedResponse();
			console.error("MCP request error:", error);
			return this.createErrorResponse(
				null,
				-32603,
				"Internal error",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async handleModernRequest(
		request: McpRequest,
		headers: Headers,
		audience?: McpRequestAudience,
	): Promise<Response> {
		const validationError = validateModernMcpRequest(request, headers);
		if (validationError) {
			return new Response(
				JSON.stringify(
					this.createErrorMcpResponse(
						request.id,
						validationError.code,
						validationError.message,
						validationError.data,
					),
				),
				{
					status: 400,
					headers: {
						"Content-Type": "application/json",
						...(validationError.code === -32020
							? { "MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION }
							: {}),
					},
				},
			);
		}

		const traceMeta = extractTraceMeta(request);
		const modernHeaders = {
			"Content-Type": "application/json",
			"Cache-Control": "no-cache",
			"MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION,
		};

		if (
			isJsonRpcNotification(request) &&
			(request.method === "notifications/initialized" ||
				request.method === "initialized" ||
				request.method === "notifications/cancelled")
		) {
			return new Response(null, {
				status: 202,
				headers: {
					"Cache-Control": "no-cache",
					"MCP-Protocol-Version": MODERN_MCP_PROTOCOL_VERSION,
				},
			});
		}

		if (request.method === "tools/list") {
			return this.createCachedToolsListResponse(
				request.id,
				audience,
				true,
				traceMeta,
				MODERN_MCP_PROTOCOL_VERSION,
			);
		}

		let response: McpResponse;
		switch (request.method) {
			case "server/discover":
				response = {
					jsonrpc: "2.0",
					id: request.id,
					result: {
						supportedVersions: [...SUPPORTED_MCP_PROTOCOL_VERSIONS],
						capabilities: this.modernCapabilities,
						instructions:
							"Manage tables, nodes, relationships, and graph queries through the available tools.",
						ttlMs: 300000,
						cacheScope: "public",
					},
				};
				break;
			case "ping":
				response = {
					jsonrpc: "2.0",
					id: request.id,
					result: {},
				};
				break;
			case "tools/call":
				response = await this.handleToolsCall(
					request.id,
					request.params as McpToolCallParams | undefined,
					audience,
					true,
				);
				break;
			default:
				response = this.createErrorMcpResponse(
					request.id,
					-32601,
					"Method not found",
					`Unknown method: ${request.method}`,
				);
		}

		if (
			response.error ||
			!response.result ||
			typeof response.result !== "object" ||
			Array.isArray(response.result)
		) {
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: modernHeaders,
			});
		}

		return new Response(
			JSON.stringify({
				...response,
				result: withModernResult(
					response.result as Record<string, unknown>,
					this.serverInfo,
					traceMeta,
				),
			}),
			{ status: 200, headers: modernHeaders },
		);
	}

	private async handleMethod(
		request: McpRequest,
		audience?: McpRequestAudience,
		toolValidationAsExecutionError = false,
	): Promise<McpResponse> {
		const { method, params, id } = request;

		try {
			switch (method) {
				case "initialize":
					return await this.handleInitialize(id, params as McpInitializeParams);

				case "initialized":
				case "notifications/initialized":
				case "notifications/cancelled":
					// Client notification
					return this.createNotificationResponse();

				case "ping":
					return {
						jsonrpc: "2.0",
						id,
						result: {},
					};

				case "tools/list":
					return await this.handleToolsList(id, audience);

				case "tools/call":
					return await this.handleToolsCall(
						id,
						params as McpToolCallParams | undefined,
						audience,
						toolValidationAsExecutionError,
					);

				default:
					return this.createErrorMcpResponse(
						id,
						-32601,
						"Method not found",
						`Unknown method: ${method}`,
					);
			}
		} catch (error) {
			console.error(`Error handling method ${method}:`, error);
			return this.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async handleInitialize(
		id: string | number | undefined,
		params: McpInitializeParams,
	): Promise<McpResponse> {
		if (!params) {
			return this.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"Initialize params required",
			);
		}

		// Validate protocol version
		const clientVersion = params.protocolVersion || this.protocolVersion;
		if (!isSupportedProtocolVersion(clientVersion)) {
			return this.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				`Unsupported protocol version: ${clientVersion}`,
			);
		}

		// Use client's version if supported, otherwise use our latest compatible version
		const negotiatedVersion = this.negotiateProtocolVersion(clientVersion);

		return {
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: negotiatedVersion,
				capabilities: this.capabilities,
				serverInfo: this.serverInfo,
				instructions:
					"Manage tables, nodes, relationships, and graph queries through the available tools.",
			},
		};
	}

	private async handleToolsList(
		id: string | number | undefined,
		audience?: McpRequestAudience,
	): Promise<McpResponse> {
		return {
			jsonrpc: "2.0",
			id,
			result: this.getToolsListCacheEntry(audience).legacyResult,
		};
	}

	private getToolsListCacheEntry(
		audience?: McpRequestAudience,
	): RootToolsListCacheEntry {
		const cacheKey = audience?.role ?? "public";
		const cached = this.toolsListCache.get(cacheKey);
		if (cached) return cached;

		// McpToolRegistry returns a deterministic ordering. Cache the projected
		// list and its wire representations until the registry lifecycle changes.
		const legacyResult: Record<string, unknown> = {
			tools: this.toolRegistry.listTools(audience).tools,
		};
		const modernResult = withModernResult(
			{
				...legacyResult,
				ttlMs: 300000,
				cacheScope: audience ? "private" : "public",
			},
			this.serverInfo,
		);
		const entry = {
			legacyResult,
			legacyResultJson: JSON.stringify(legacyResult),
			modernResultJson: JSON.stringify(modernResult),
		};
		this.toolsListCache.set(cacheKey, entry);
		return entry;
	}

	private createCachedToolsListResponse(
		id: string | number | undefined,
		audience: McpRequestAudience | undefined,
		modern: boolean,
		traceMeta?: Record<string, unknown>,
		protocolVersionHeader?: string,
	): Response {
		const cached = this.getToolsListCacheEntry(audience);
		let resultJson = modern ? cached.modernResultJson : cached.legacyResultJson;
		if (modern && traceMeta) {
			const resultWithTrace = withModernResult(
				{
					...cached.legacyResult,
					ttlMs: 300000,
					cacheScope: audience ? "private" : "public",
				},
				this.serverInfo,
				traceMeta,
			);
			resultJson = JSON.stringify(resultWithTrace);
		}
		return new Response(this.serializeJsonRpcResult(id, resultJson), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
				...(protocolVersionHeader
					? { "MCP-Protocol-Version": protocolVersionHeader }
					: {}),
			},
		});
	}

	private serializeJsonRpcResult(
		id: string | number | undefined,
		resultJson: string,
	): string {
		const serializedId = id === undefined ? "" : `,"id":${JSON.stringify(id)}`;
		return `{"jsonrpc":"2.0"${serializedId},"result":${resultJson}}`;
	}

	private async handleToolsCall(
		id: string | number | undefined,
		params?: McpToolCallParams,
		audience?: McpRequestAudience,
		toolValidationAsExecutionError = false,
	): Promise<McpResponse> {
		const response = await this.executeToolsCall(
			id,
			params,
			audience,
			toolValidationAsExecutionError,
		);
		return this.finalizeToolCallResponse(response);
	}

	private finalizeToolCallResponse(response: McpResponse): McpResponse {
		if (
			response.error ||
			!response.result ||
			typeof response.result !== "object" ||
			Array.isArray(response.result)
		) {
			return response;
		}
		return {
			...response,
			result: withStructuredToolResult(
				response.result as Record<string, unknown>,
			),
		};
	}

	private async executeToolsCall(
		id: string | number | undefined,
		params?: McpToolCallParams,
		audience?: McpRequestAudience,
		toolValidationAsExecutionError = false,
	): Promise<McpResponse> {
		if (!params?.name) {
			return this.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"Tool name required",
			);
		}

		const { name, arguments: args } = params;

		try {
			// Get tool definition
			const toolLookup = await this.toolRegistry.getTool(name);
			if (!toolLookup.found || !toolLookup.tool) {
				if (name in API_ENDPOINT_MAPPING) {
					const proxiedResult = await this.restApiClient.callMcpTool(
						name,
						args || {},
					);
					return {
						jsonrpc: "2.0",
						id,
						result: {
							content: [
								{
									type: "text",
									text: JSON.stringify(proxiedResult, null, 2),
								},
							],
							isError: false,
						},
					};
				}
				return this.createErrorMcpResponse(
					id,
					-32602,
					`Tool not found: ${name}`,
				);
			}

			const tool = toolLookup.tool;

			if (audience?.role === "reader" && tool.access?.action !== "read") {
				return this.createErrorMcpResponse(
					id,
					-32602,
					`Tool not found: ${name}`,
				);
			}

			// Validate input against tool's input schema
			if (tool.inputSchema) {
				const validate = this.getOrCompileValidator(tool.inputSchema);
				const valid = validate(args || {});

				if (!valid) {
					const errors =
						validate.errors
							?.map((err) => `${err.instancePath} ${err.message}`)
							.join(", ") || "Unknown validation error";
					if (
						toolValidationAsExecutionError ||
						(name === "createTable" &&
							args &&
							Object.keys(args).some(
								(key) => !["identifier", "name", "description"].includes(key),
							))
					) {
						return {
							jsonrpc: "2.0",
							id,
							result: {
								content: [
									{
										type: "text",
										text: JSON.stringify(
											{
												success: false,
												error: `Schema validation failed: ${errors}`,
											},
											null,
											2,
										),
									},
								],
								isError: true,
							},
						};
					}
					return this.createErrorMcpResponse(
						id,
						-32602,
						`Schema validation failed: ${errors}`,
						undefined,
					);
				}
			}

			// Handle custom tools that require special processing
			if (tool.graphqlOperation?.operationType === "custom") {
				this.debugHotpath(`Handling custom tool: ${name}`);
				return await this.handleCustomTool(id, name, args || {}, audience);
			}

			// Validate tool has GraphQL operation for non-custom tools
			if (!tool.graphqlOperation?.query) {
				return this.createErrorMcpResponse(
					id,
					-32603,
					"Internal error",
					`Tool ${name} has no valid GraphQL operation`,
				);
			}

			// Route REST-mapped tools through RestApiClient; execute GraphQL-only registry tools directly via GraphQLOperationExecutor
			if (!this.restApiClient.hasEndpointForTool(name)) {
				const operationName =
					tool.graphqlOperation.query.match(
						/\b(?:query|mutation)\s+(\w+)/,
					)?.[1] || name.replace(/[^a-zA-Z0-9_]/g, "_");
				const operationType =
					tool.graphqlOperation.operationType === "mutation"
						? "mutation"
						: "query";
				const rawArgs = (args || {}) as Record<string, unknown>;
				const hasArgs = Object.keys(rawArgs).length > 0;
				const variables: GraphQLVariables = /\(\s*\$input\s*:/.test(
					tool.graphqlOperation.query,
				)
					? { input: hasArgs ? rawArgs : undefined }
					: /\(\s*\$filter\s*:/.test(tool.graphqlOperation.query)
						? { filter: hasArgs ? rawArgs : undefined }
						: rawArgs;
				const graphqlResult = await this.graphqlExecutor.execute({
					operationName,
					operationType,
					query: tool.graphqlOperation.query,
					variables,
				});
				if (graphqlResult.errors && graphqlResult.errors.length > 0) {
					return {
						jsonrpc: "2.0",
						id,
						result: {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											success: false,
											errors: graphqlResult.errors,
										},
										null,
										2,
									),
								},
							],
							isError: true,
						},
					};
				}
				return {
					jsonrpc: "2.0",
					id,
					result: {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									graphqlResult.data ?? graphqlResult,
									null,
									2,
								),
							},
						],
						isError: false,
					},
				};
			}

			const result = await this.restApiClient.callMcpTool(name, args || {});

			// Return MCP-compliant response
			return {
				jsonrpc: "2.0",
				id,
				result: {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
					isError: false,
				},
			};
		} catch (error) {
			console.error(`Tool execution error for ${name}:`, error);
			return this.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private getOrCompileValidator(schema: object): ValidateFunction {
		const cached = this.validatorCache.get(schema);
		if (cached) return cached;

		const validator = this.ajv.compile(schema);
		this.validatorCache.set(schema, validator);
		return validator;
	}

	private async handleCustomTool(
		id: string | number | undefined,
		toolName: string,
		args: McpToolArgs,
		audience?: McpRequestAudience,
	): Promise<McpResponse> {
		const host: McpRootToolHost = {
			toolRegistry: this.toolRegistry,
			graphqlExecutor: this.graphqlExecutor,
			restApiClient: this.restApiClient,
			aiMemoryService: this.aiMemoryService,
			iaService: this.iaService,
			createErrorMcpResponse: (errId, code, message, data) =>
				this.createErrorMcpResponse(errId, code, message, data),
			debugHotpath: (...debugArgs) => this.debugHotpath(...debugArgs),
		};
		return await handleRootCustomTool(host, id, toolName, args, audience);
	}

	private createErrorResponse(
		id: string | number | undefined | null,
		code: number,
		message: string,
		data?: unknown,
	): Response {
		const errorResponse = this.createErrorMcpResponse(id, code, message, data);
		let status = 500;

		switch (code) {
			case -32600: // Invalid Request
				status = 400;
				break;
			case -32601: // Method not found
				status = 404;
				break;
			case -32602: // Invalid params
				status = 400;
				break;
			case -32700: // Parse error
				status = 400;
				break;
			default:
				status = 500;
		}

		return new Response(JSON.stringify(errorResponse), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}

	private createErrorMcpResponse(
		id: string | number | undefined | null,
		code: number,
		message: string,
		data?: unknown,
	): McpResponse {
		const error =
			data === undefined ? { code, message } : { code, message, data };

		return {
			jsonrpc: "2.0",
			id: id ?? null,
			error,
		};
	}

	private createNotificationResponse(): McpResponse {
		// Notifications don't have responses in JSON-RPC
		return {
			jsonrpc: "2.0",
		};
	}

	private negotiateProtocolVersion(clientVersion: string): string {
		// Prefer client's version if we support it
		if (isSupportedProtocolVersion(clientVersion)) {
			return clientVersion;
		}

		// Otherwise use our latest supported version
		return this.protocolVersion;
	}

	private assertOpen(): void {
		if (this.closed) {
			throw new Error("MCP server is closed");
		}
	}

	private debugHotpath(...args: unknown[]): void {
		if (this.debugHotpathEnabled) console.debug(...args);
	}

	private createClosedResponse(): Response {
		return new Response(
			JSON.stringify(
				this.createErrorMcpResponse(
					null,
					-32000,
					"Server unavailable",
					"MCP server is shutting down or closed",
				),
			),
			{
				status: 503,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				},
			},
		);
	}
}

function isMcpInitializeParams(value: unknown): value is McpInitializeParams {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const params = value as Record<string, unknown>;
	return (
		typeof params.protocolVersion === "string" &&
		typeof params.capabilities === "object" &&
		params.capabilities !== null
	);
}
