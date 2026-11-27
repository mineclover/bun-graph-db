import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type {
	DefinitionNode,
	DocumentNode,
	ExecutionResult,
	OperationDefinitionNode,
} from "graphql";
import { createYoga } from "graphql-yoga";
import type { ILogger } from "@/application/ports/ILogger.js";
import {
	AccessControl,
	authorizeExternalRequest,
} from "@/application/security/AccessControl.js";
import { setDatabasePath } from "@/config/database.js";
import { createGraphQLConfig } from "@/config/graphql.js";
import { BUN_GRAPH_DB_API_VERSION } from "@/core/contracts/RestRouteContract.js";
import type { AutoPersistenceService } from "@/domain/services/AutoPersistenceService.js";
import {
	createContainer,
	disposeContainer,
} from "@/infrastructure/container/ContainerBootstrap.js";
import { createGraphDbRuntimeSurface } from "@/infrastructure/container/RuntimeSurfaceFactory.js";
import { CommonTokens } from "@/infrastructure/container/tokens/CommonTokens.js";
import type { FetchLike } from "@/models/GraphQLOperation.js";
import { GraphQLSchemaBuilder } from "@/presentation/graphql/GraphQLSchemaBuilder.js";
import {
	checkPortAvailable,
	startFetchHttpServer,
} from "@/presentation/http/NodeHttpServer.js";
import { MetricsRegistry } from "@/presentation/http/observability/MetricsRegistry.js";
import {
	handleOpsOrStudioRoute,
	recordHttpResponseMetric,
} from "@/presentation/http/observability/OpsRoutes.js";
import { toErrorMeta } from "@/presentation/http/utils/errorHelpers.js";
import { renderStudioHtml } from "@/presentation/studio/StudioHtml.js";
import {
	mergeWithEnvironment,
	parseCliArgs,
	printHelp,
	printVersion,
	validateOptions,
} from "@/utils/cli-parser.js";

type OptionalRouteHandler = (request: Request) => Promise<Response | null>;

const MCP_BACKUP_TOOLS = new Set([
	"backupDatabase",
	"restoreDatabase",
	"exportJsonl",
	"importJsonl",
]);

async function inspectMutatingMcpToolCall(
	request: Request,
	resolveToolAccess: (
		toolName: string,
		argumentsValue: unknown,
	) => { action: string } | undefined,
): Promise<boolean> {
	if (request.method !== "POST") return false;
	try {
		const payload = (await request.clone().json()) as {
			method?: unknown;
			params?: { name?: unknown; arguments?: unknown };
		};
		if (
			payload?.method !== "tools/call" ||
			typeof payload.params?.name !== "string"
		) {
			return false;
		}
		if (MCP_BACKUP_TOOLS.has(payload.params.name)) {
			return false;
		}
		return (
			resolveToolAccess(payload.params.name, payload.params?.arguments)
				?.action === "write"
		);
	} catch {
		return false;
	}
}

async function markDirtyIfMcpSucceeded(
	isMutatingMcpCall: boolean,
	response: Response,
	autoPersistence: AutoPersistenceService,
): Promise<Response> {
	if (!isMutatingMcpCall || response.status < 200 || response.status >= 300) {
		return response;
	}
	try {
		const body = (await response.clone().json()) as {
			error?: unknown;
			result?: { isError?: boolean };
		};
		if (!body?.error && body?.result?.isError !== true) {
			autoPersistence.markDirty();
		}
	} catch {
		// Non-JSON responses are ignored
	}
	return response;
}

export async function startStandaloneServer(
	argv: string[] = process.argv.slice(2),
): Promise<void> {
	const { options, unknown } = parseCliArgs(argv);
	const finalOptions = mergeWithEnvironment(options);

	if (finalOptions.help) {
		printHelp();
		process.exit(0);
	}

	if (finalOptions.version) {
		printVersion();
		process.exit(0);
	}

	try {
		validateOptions(finalOptions);
	} catch (error) {
		console.error(
			"❌ Invalid options:",
			error instanceof Error ? error.message : error,
		);
		console.error("Use --help for usage information");
		process.exit(1);
	}

	if (unknown.length > 0) {
		console.warn("⚠️  Unknown arguments:", unknown.join(" "));
	}

	if (finalOptions.env) {
		process.env.NODE_ENV = finalOptions.env;
	}

	if (finalOptions.databasePath) {
		setDatabasePath(finalOptions.databasePath);
	}

	const execFileAsync = promisify(execFile);
	const container = await createContainer();
	const schemaBuilder = new GraphQLSchemaBuilder(container);
	const schema = await schemaBuilder.build();

	const logger = await container.resolve<ILogger>(CommonTokens.LOGGER);
	const accessControl = AccessControl.fromEnvironment(process.env, logger);
	const metrics = new MetricsRegistry();
	const internalBridgeToken =
		process.env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN?.trim();
	if (
		accessControl.isAuthenticationRequired() &&
		(!internalBridgeToken || internalBridgeToken.length < 32)
	) {
		throw new Error(
			"BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN must be a non-empty high-entropy (32+ character) token when authentication is enabled.",
		);
	}

	const autoPersistence = await container.resolve<AutoPersistenceService>(
		CommonTokens.AUTO_PERSISTENCE_SERVICE,
	);
	const persistenceResult = await autoPersistence.initialize();
	if (persistenceResult.restored) {
		logger.info(`📂 Auto-restored from: ${persistenceResult.backupPath}`);
	} else if (persistenceResult.error) {
		logger.warn(`⚠️ Auto-restore skipped: ${persistenceResult.error}`);
	}

	const graphqlConfig = createGraphQLConfig(finalOptions);

	const yoga = createYoga({
		schema,
		context: async ({ request }) => ({
			requestId: request.headers.get("x-request-id") || randomUUID(),
			startTime: new Date(),
			requestCache: new Map(),
			principal: accessControl.principalFor(request),
		}),
		logging: process.env.DEBUG === "1" ? "debug" : "warn",
		plugins: [
			{
				onExecute() {
					return {
						onExecuteDone({
							result,
							args,
						}: {
							result: ExecutionResult;
							args: { document: DocumentNode };
						}) {
							const operationType = args.document.definitions.find(
								(def: DefinitionNode): def is OperationDefinitionNode =>
									def.kind === "OperationDefinition",
							);
							if (operationType?.operation === "mutation") {
								const queryText = args.document.loc?.source?.body || "";
								const isBackupMutation =
									queryText.includes("backupDatabase") ||
									queryText.includes("restoreDatabase") ||
									queryText.includes("exportJsonl") ||
									queryText.includes("importJsonl");
								if (isBackupMutation) {
									return;
								}
								const hasErrors =
									Array.isArray(result.errors) && result.errors.length > 0;
								if (!hasErrors) {
									autoPersistence.markDirty();
								}
							}
						},
					};
				},
			},
		],
		cors: graphqlConfig.cors,
		graphiql: {
			title: "Bun Graph DB - GraphQL API",
			defaultQuery: `
      # Welcome to Bun Graph DB GraphQL API
      # This API provides access to the SQLite-based graph database
      
      query HealthCheck {
        healthCheck {
          status
          timestamp
          database
          version
          memory {
            status
            percentage
            message
          }
        }
      }
      
      query GetTables {
        tables {
          nodes {
            id
            identifier
            description
            createdAt
            updatedAt
            tableNodeCount
            attributeCount
          }
          totalCount
          hasNextPage
        }
      }
    `,
		},
		landingPage: false,
	});

	let requestHandler!: (request: Request) => Promise<Response>;
	const inProcessFetch: FetchLike = async (input, init) => {
		const internalRequest =
			input instanceof Request ? input : new Request(String(input), init);
		return await requestHandler(internalRequest);
	};

	const surface = await createGraphDbRuntimeSurface(container, {
		graphqlEndpointUrl: `http://localhost:${graphqlConfig.port}/graphql`,
		restApiBaseUrl: `http://localhost:${graphqlConfig.port}/api`,
		port: graphqlConfig.port,
		inProcessFetch,
		internalBridgeToken,
		httpHooks: {
			onMutationSuccess: () => {
				autoPersistence.markDirty();
			},
		},
	});
	const { mcpServer, tableMcpMiddleware, apiRouter } = surface;

	let schemaHandlerPromise: Promise<OptionalRouteHandler> | undefined;
	const getSchemaHandler = (): Promise<OptionalRouteHandler> => {
		if (!schemaHandlerPromise) {
			schemaHandlerPromise = import(
				"@/presentation/http/routes/SchemaRoutes.js"
			).then(({ createSchemaHandler }) => createSchemaHandler(container));
		}
		return schemaHandlerPromise;
	};

	let templateFileHandlerPromise: Promise<OptionalRouteHandler> | undefined;
	const getTemplateFileHandler = (): Promise<OptionalRouteHandler> => {
		if (!templateFileHandlerPromise) {
			templateFileHandlerPromise = import(
				"@/presentation/http/routes/TemplateFileRoutes.js"
			).then(({ createTemplateFileHandler }) =>
				createTemplateFileHandler(container),
			);
		}
		return templateFileHandlerPromise;
	};

	let tabularSyncHandlerPromise: Promise<OptionalRouteHandler> | undefined;
	const getTabularSyncHandler = (): Promise<OptionalRouteHandler> => {
		if (!tabularSyncHandlerPromise) {
			tabularSyncHandlerPromise = Promise.all([
				import("@/presentation/http/routes/TabularSyncRoutes.js"),
				container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE),
				container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE),
				container.resolve(CommonTokens.TABULAR_SYNC_HOOK),
			]).then(
				([
					{ createTabularSyncHandler },
					configStore,
					activationService,
					syncHook,
				]) =>
					createTabularSyncHandler(
						configStore as never,
						logger,
						syncHook as never,
						activationService as never,
					),
			);
		}
		return tabularSyncHandlerPromise;
	};

	requestHandler = async (request: Request): Promise<Response> => {
		const startedAt = Date.now();
		const url = new URL(request.url);
		const pathname = url.pathname;

		const accessDecision = await authorizeExternalRequest(
			accessControl,
			request,
			(toolName, argumentsValue) =>
				mcpServer.resolveToolAccess(toolName, argumentsValue),
			surface.resourceAccessResolver,
		);
		metrics.recordAuthDecision(
			accessDecision.allowed ? "allowed" : "denied",
			accessDecision.allowed ? undefined : accessDecision.code,
		);
		if (!accessDecision.allowed) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				accessControl.responseFor(accessDecision),
				startedAt,
			);
		}

		if (request.method === "GET" && pathname === "/health") {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				new Response(
					JSON.stringify({
						status: "OK",
						timestamp: new Date().toISOString(),
						driver: "node-sqlite",
						version: BUN_GRAPH_DB_API_VERSION,
					}),
					{ headers: { "Content-Type": "application/json" } },
				),
				startedAt,
			);
		}

		const opsResponse = handleOpsOrStudioRoute(
			request,
			url,
			metrics,
			accessControl,
		);
		if (opsResponse) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				opsResponse,
				startedAt,
			);
		}

		if (pathname === "/") {
			try {
				const htmlContent = await readFile("./public/index.html", "utf8");
				return recordHttpResponseMetric(
					metrics,
					request,
					pathname,
					new Response(htmlContent, {
						headers: {
							"Content-Type": "text/html; charset=utf-8",
							"Cache-Control": "no-cache",
						},
					}),
					startedAt,
				);
			} catch {
				return recordHttpResponseMetric(
					metrics,
					request,
					pathname,
					new Response(
						renderStudioHtml({ version: BUN_GRAPH_DB_API_VERSION }),
						{
							headers: {
								"Content-Type": "text/html; charset=utf-8",
								"Cache-Control": "no-cache",
							},
						},
					),
					startedAt,
				);
			}
		}

		if (pathname.startsWith("/api/template-files")) {
			const templateFileResponse = await (await getTemplateFileHandler())(
				request,
			);
			if (templateFileResponse) {
				return recordHttpResponseMetric(
					metrics,
					request,
					pathname,
					templateFileResponse,
					startedAt,
				);
			}
		}

		if (
			pathname === "/tabular-sync" ||
			pathname.startsWith("/api/tabular-sync")
		) {
			const tabularSyncResponse = await (await getTabularSyncHandler())(
				request,
			);
			if (tabularSyncResponse) {
				return recordHttpResponseMetric(
					metrics,
					request,
					pathname,
					tabularSyncResponse,
					startedAt,
				);
			}
		}

		if (
			pathname === "/schema" ||
			pathname.startsWith("/schema/") ||
			pathname === "/schema.json" ||
			pathname === "/introspection.json" ||
			pathname === "/introspection"
		) {
			const schemaResponse = await (await getSchemaHandler())(request);
			if (schemaResponse) {
				return recordHttpResponseMetric(
					metrics,
					request,
					pathname,
					schemaResponse,
					startedAt,
				);
			}
		}

		const isMcpEndpoint =
			pathname === "/mcp" || /^\/sub\/[^/]+\/mcp\/?$/.test(pathname);
		const isMutatingMcpCall = isMcpEndpoint
			? await inspectMutatingMcpToolCall(request, (toolName, argumentsValue) =>
					mcpServer.resolveToolAccess(toolName, argumentsValue),
				)
			: false;

		const tableMcpResponse = await tableMcpMiddleware(
			request,
			accessDecision.principal,
		);
		if (tableMcpResponse) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await markDirtyIfMcpSucceeded(
					isMutatingMcpCall,
					tableMcpResponse,
					autoPersistence,
				),
				startedAt,
			);
		}

		if (pathname.startsWith("/api/")) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await apiRouter(request),
				startedAt,
			);
		}

		if (pathname === "/mcp") {
			const mcpResponse = await mcpServer.handleRequest(
				request,
				accessDecision.principal,
			);
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await markDirtyIfMcpSucceeded(
					isMutatingMcpCall,
					mcpResponse,
					autoPersistence,
				),
				startedAt,
			);
		}

		return recordHttpResponseMetric(
			metrics,
			request,
			pathname,
			await yoga.fetch(request),
			startedAt,
		);
	};

	if (!(await checkPortAvailable(graphqlConfig.port))) {
		console.error(`❌ Port ${graphqlConfig.port} is already in use`);
		console.error(
			"💡 Try a different port with --port option or stop the conflicting process",
		);

		try {
			const { stdout } = await execFileAsync("lsof", [
				"-ti",
				`:${graphqlConfig.port}`,
			]);
			if (stdout.trim()) {
				console.error(
					`🔍 Process(es) using port ${graphqlConfig.port}: ${stdout.trim().split("\n").join(", ")}`,
				);
			}
		} catch {
			// lsof might not be available on all systems
		}

		process.exit(1);
	}

	const server = await startFetchHttpServer({
		fetch: requestHandler,
		port: graphqlConfig.port,
		hostname: finalOptions.host || "0.0.0.0",
	});

	logger.info(
		`🚀 Bun Graph DB Server ready at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`,
	);
	logger.info(
		`📊 GraphiQL available at http://localhost:${graphqlConfig.port}${yoga.graphqlEndpoint}`,
	);
	logger.info(
		`🧭 Web Studio available at http://localhost:${graphqlConfig.port}/studio`,
	);
	logger.info(
		`🔌 MCP Protocol available at http://localhost:${graphqlConfig.port}/mcp`,
	);
	logger.info(`📋 Schema endpoints available:`);
	logger.info(`   • SDL: http://localhost:${graphqlConfig.port}/schema`);
	logger.info(`   • JSON: http://localhost:${graphqlConfig.port}/schema.json`);
	logger.info(
		`   • Introspection: http://localhost:${graphqlConfig.port}/introspection.json`,
	);
	logger.info(
		`   • TypeScript: http://localhost:${graphqlConfig.port}/schema/typescript`,
	);

	const shutdown = async () => {
		logger.info("🛑 Server shutting down...");

		try {
			const backupResult = await autoPersistence.shutdown();
			if (backupResult.backed) {
				logger.info(`✅ Auto-backup completed: ${backupResult.backupPath}`);
			} else if (backupResult.error) {
				logger.warn(`⚠️ Auto-backup failed: ${backupResult.error}`);
			}

			await server.stop();
			const mcpShutdown = await Promise.allSettled([
				mcpServer.close(),
				tableMcpMiddleware.close(),
			]);
			const mcpShutdownFailures = mcpShutdown.filter(
				(result) => result.status === "rejected",
			);
			if (mcpShutdownFailures.length > 0) {
				throw new Error(
					`Failed to stop ${mcpShutdownFailures.length} MCP server lifecycle(s).`,
				);
			}

			await disposeContainer();
			logger.info("✅ Graceful shutdown completed");
		} catch (error) {
			logger.error("❌ Error during shutdown", toErrorMeta(error));
			process.exit(1);
		}

		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	process.on("uncaughtException", (error) => {
		logger.error("💥 Uncaught Exception", { error });
		process.exit(1);
	});

	process.on("unhandledRejection", (reason) => {
		logger.error("💥 Unhandled Rejection", { reason });
		process.exit(1);
	});
}
