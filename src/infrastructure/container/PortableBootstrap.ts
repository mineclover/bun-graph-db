import { type ExecutionResult, type GraphQLSchema, graphql } from "graphql";
import { createYoga } from "graphql-yoga";
import type { ILogger } from "@/application/ports/ILogger.js";
import {
	type AccessControl,
	type AccessPrincipal,
	authorizeExternalRequest,
} from "@/application/security/AccessControl.js";
import type { AiMemoryService } from "@/application/services/AiMemoryService.js";
import type { InformationArchitectureService } from "@/application/services/InformationArchitectureService.js";
import type { EmbedNodesUseCase } from "@/application/use-cases/nodes/EmbedNodes.js";
import type { IEmbeddingProvider } from "@/domain/ports/IEmbeddingProvider.js";
import type { ISnapshotStoragePort } from "@/domain/ports/ISnapshotStoragePort.js";
import {
	EMBEDDED_ASSETS_VERSION_HASH,
	EMBEDDED_INITIAL_SCHEMA_SQL,
} from "@/generated/embedded-assets.js";
import {
	applyDatabaseMigrations,
	createDatabaseMigrations,
} from "@/infrastructure/database/sqlite/DatabaseMigrationRunner.js";
import {
	getMaxBindParams,
	type ISqliteDatabase,
} from "@/infrastructure/database/sqlite/SqlitePort.js";
import { configureSqliteDatabase } from "@/infrastructure/database/sqlite/SqlitePragmas.js";
import type { McpHttpServer } from "@/mcp/http-server/McpHttpServer.js";
import type { FetchLike } from "@/models/GraphQLOperation.js";
import { GraphQLSchemaBuilder } from "@/presentation/graphql/GraphQLSchemaBuilder.js";
import { MetricsRegistry } from "@/presentation/http/observability/MetricsRegistry.js";
import {
	handleOpsOrStudioRoute,
	recordHttpResponseMetric,
} from "@/presentation/http/observability/OpsRoutes.js";
import { DIContainer } from "./DIContainer.js";
import { registerCoreModule } from "./modules/CoreModule.js";
import { registerGraphQLModule } from "./modules/GraphQLModule.js";
import { registerRepositoryModule } from "./modules/RepositoryModule.js";
import { registerTablePackageModule } from "./modules/TablePackageModule.js";
import { registerUseCaseModule } from "./modules/UseCaseModule.js";
import { createGraphDbRuntimeSurface } from "./RuntimeSurfaceFactory.js";
import { CommonTokens, DatabaseTokens } from "./tokens/index.js";

export interface PortableGraphNodeOptions {
	databaseLabel?: string;
	runMigrations?: boolean;
	snapshotStorage?: ISnapshotStoragePort;
	embeddingProvider?: IEmbeddingProvider;
	graphqlEndpoint?: string;
	accessControl?: AccessControl;
	internalBridgeToken?: string;
	logger?: ILogger;
}

export interface PortableGraphNode {
	readonly database: ISqliteDatabase;
	readonly container: DIContainer;
	readonly schema: GraphQLSchema;
	readonly mcpServer: McpHttpServer;
	readonly snapshotStorage?: ISnapshotStoragePort;
	readonly embeddingProvider?: IEmbeddingProvider;
	readonly embedNodes?: EmbedNodesUseCase;
	readonly ia: InformationArchitectureService;
	readonly aiMemory: AiMemoryService;
	readonly metrics: MetricsRegistry;
	fetch(request: Request): Promise<Response>;
	executeGraphQL(
		query: string,
		variables?: Record<string, unknown>,
		operationName?: string,
	): Promise<ExecutionResult>;
	dispose(): Promise<void>;
}

export async function createPortableGraphNode(
	database: ISqliteDatabase,
	options: PortableGraphNodeOptions = {},
): Promise<PortableGraphNode> {
	const databaseLabel = options.databaseLabel ?? ":portable:";
	const graphqlEndpoint = options.graphqlEndpoint ?? "/graphql";
	const internalBridgeToken = options.internalBridgeToken?.trim() || undefined;

	if (options.runMigrations !== false) {
		configureSqliteDatabase(database, databaseLabel);
		applyDatabaseMigrations(
			database,
			createDatabaseMigrations(EMBEDDED_INITIAL_SCHEMA_SQL),
		);
	}

	const container = new DIContainer();
	registerCoreModule(container);
	if (options.logger) {
		const customLogger = options.logger;
		container.registerSingleton(CommonTokens.LOGGER, () => customLogger, []);
	}
	container.registerSingleton(DatabaseTokens.DATABASE_CONFIG, async () => ({
		url: databaseLabel,
		type: "sqlite" as const,
	}));
	container.registerSingleton(
		DatabaseTokens.DATABASE_CONNECTION,
		async () => database,
	);
	if (options.embeddingProvider) {
		const provider = options.embeddingProvider;
		container.registerSingleton(
			CommonTokens.EMBEDDING_PROVIDER,
			async () => provider,
		);
	}
	registerRepositoryModule(container);
	registerTablePackageModule(container);
	registerUseCaseModule(container);
	registerGraphQLModule(container);

	const schemaBuilder = new GraphQLSchemaBuilder(container);
	const schema = await schemaBuilder.build();

	const yoga = createYoga({
		schema,
		graphqlEndpoint,
		maskedErrors: false,
		graphiql: false,
		landingPage: false,
		...(options.logger ? { logging: false } : {}),
	});

	const metrics = new MetricsRegistry();

	let fetchHandler!: (request: Request) => Promise<Response>;
	const inProcessFetch: FetchLike = async (input, init) => {
		const internalRequest =
			input instanceof Request ? input : new Request(String(input), init);
		return await fetchHandler(internalRequest);
	};

	const surface = await createGraphDbRuntimeSurface(container, {
		graphqlEndpointUrl: `http://localhost${graphqlEndpoint}`,
		restApiBaseUrl: "http://localhost/api",
		port: 0,
		inProcessFetch,
		internalBridgeToken,
		embeddingProvider: options.embeddingProvider,
	});

	fetchHandler = async (request: Request): Promise<Response> => {
		const startedAt = Date.now();
		const url = new URL(request.url);
		const pathname = url.pathname;

		let requestPrincipal: AccessPrincipal | undefined;
		if (options.accessControl) {
			const accessDecision = await authorizeExternalRequest(
				options.accessControl,
				request,
				(toolName, argumentsValue) =>
					surface.mcpServer.resolveToolAccess(toolName, argumentsValue),
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
					options.accessControl.responseFor(accessDecision),
					startedAt,
				);
			}
			requestPrincipal = accessDecision.principal;
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
						driver: database.driver ?? "custom",
						maxBindParams: getMaxBindParams(database),
						embeddedAssetsVersion: EMBEDDED_ASSETS_VERSION_HASH,
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
			options.accessControl,
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

		const tableMcpResponse = await surface.tableMcpMiddleware(
			request,
			requestPrincipal,
		);
		if (tableMcpResponse) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				tableMcpResponse,
				startedAt,
			);
		}

		if (pathname === "/mcp") {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await surface.mcpServer.handleRequest(request, requestPrincipal),
				startedAt,
			);
		}

		if (pathname === graphqlEndpoint) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await yoga.fetch(request),
				startedAt,
			);
		}

		if (pathname.startsWith("/api")) {
			return recordHttpResponseMetric(
				metrics,
				request,
				pathname,
				await surface.apiRouter(request),
				startedAt,
			);
		}

		return recordHttpResponseMetric(
			metrics,
			request,
			pathname,
			new Response(
				JSON.stringify({
					success: false,
					error: `Route not found: ${request.method} ${pathname}`,
				}),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			),
			startedAt,
		);
	};

	return {
		database,
		container,
		schema,
		mcpServer: surface.mcpServer,
		snapshotStorage: options.snapshotStorage,
		embeddingProvider: options.embeddingProvider,
		embedNodes: surface.embedNodesUseCase,
		ia: surface.iaService,
		aiMemory: surface.aiMemoryService,
		metrics,
		fetch: fetchHandler,
		async executeGraphQL(
			query: string,
			variables?: Record<string, unknown>,
			operationName?: string,
		): Promise<ExecutionResult> {
			return await graphql({
				schema,
				source: query,
				variableValues: variables,
				operationName,
			});
		},
		async dispose(): Promise<void> {
			await surface.dispose();
			await container.dispose();
		},
	};
}
