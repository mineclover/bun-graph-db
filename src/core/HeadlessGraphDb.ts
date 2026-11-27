import {
	getPresetBlueprint,
	type PresetBlueprintName,
} from "@/application/blueprints/PresetBlueprints.js";
import {
	fromEntity as attributeFromEntity,
	type CreateAttributeInput,
	type CreateAttributeOutput,
} from "@/application/dtos/AttributeDto.js";
import type {
	CreateNodeInput,
	CreateNodeOutput,
	UpdateNodeInput,
	UpdateNodeOutput,
} from "@/application/dtos/NodeDto.js";
import { fromEntity as nodeFromEntity } from "@/application/dtos/NodeDto.js";
import type {
	CreateTableInput,
	CreateTableOutput,
	TableDto,
} from "@/application/dtos/TableDto.js";
import { fromEntity as tableFromEntity } from "@/application/dtos/TableDto.js";
import { type ILogger, LogLevel } from "@/application/ports/ILogger.js";
import { AiMemoryService } from "@/application/services/AiMemoryService.js";
import { GraphHierarchyService } from "@/application/services/GraphHierarchyService.js";
import { GraphTraversalService } from "@/application/services/GraphTraversalService.js";
import { InformationArchitectureService } from "@/application/services/InformationArchitectureService.js";
import { NodeAttributeSchemaGate } from "@/application/services/NodeAttributeSchemaGate.js";
import { TableSchemaProjectionService } from "@/application/services/TableSchemaProjectionService.js";
import { CreateDocUseCase } from "@/application/use-cases/docs/CreateDoc.js";
import { CreateNodeUseCase } from "@/application/use-cases/nodes/CreateNode.js";
import { EmbedNodesUseCase } from "@/application/use-cases/nodes/EmbedNodes.js";
import {
	type HybridSearchNodesInput,
	type HybridSearchNodesOutput,
	HybridSearchNodesUseCase,
} from "@/application/use-cases/nodes/HybridSearchNodes.js";
import {
	type SearchNodesInput,
	type SearchNodesOutput,
	SearchNodesUseCase,
} from "@/application/use-cases/nodes/SearchNodes.js";
import { UpdateNodeUseCase } from "@/application/use-cases/nodes/UpdateNode.js";
import {
	type CreateRelationInput,
	type CreateRelationOutput,
	CreateRelationUseCase,
} from "@/application/use-cases/relations/CreateRelation.js";
import type {
	AttributeTypeId,
	NodeId,
	PaginatedResult,
	PaginationOptions,
	TableId,
} from "@/core/types/CommonTypes.js";
import { Attribute } from "@/domain/entities/Attribute.js";
import { Table } from "@/domain/entities/Table.js";
import type { IEmbeddingProvider } from "@/domain/ports/IEmbeddingProvider.js";
import type { ISnapshotStoragePort } from "@/domain/ports/ISnapshotStoragePort.js";
import { EMBEDDED_INITIAL_SCHEMA_SQL } from "@/generated/embedded-assets.js";
import {
	applyDatabaseMigrations,
	createDatabaseMigrations,
} from "@/infrastructure/database/sqlite/DatabaseMigrationRunner.js";
import { SqliteAttributeRepository } from "@/infrastructure/database/sqlite/SqliteAttributeRepository.js";
import { SqliteAttributeTypeRepository } from "@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js";
import { SqliteDocRepository } from "@/infrastructure/database/sqlite/SqliteDocRepository.js";
import { SqliteNodeAttributeRepository } from "@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js";
import { SqliteNodeEmbeddingRepository } from "@/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js";
import { SqliteNodeMutationRepository } from "@/infrastructure/database/sqlite/SqliteNodeMutationRepository.js";
import { SqliteNodeRelationRepository } from "@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js";
import { SqliteNodeRepository } from "@/infrastructure/database/sqlite/SqliteNodeRepository.js";
import { SqliteNodeSearchRepository } from "@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js";
import type { ISqliteDatabase } from "@/infrastructure/database/sqlite/SqlitePort.js";
import { configureSqliteDatabase } from "@/infrastructure/database/sqlite/SqlitePragmas.js";
import { SqliteRelationTypeRepository } from "@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js";
import { SqliteTableRepository } from "@/infrastructure/database/sqlite/SqliteTableRepository.js";
import {
	type SqliteWasmOo1DatabaseLike,
	type SqlJsDatabaseLike,
	WebSqliteDatabase,
	wrapWebSqliteDatabase,
} from "@/infrastructure/database/sqlite/WebSqliteAdapter.js";
import { ConsoleLogger } from "@/infrastructure/logging/ConsoleLogger.js";
import {
	ConflictException,
	NotFoundException,
	ValidationException,
} from "@/shared/exceptions/DomainException.js";

export interface HeadlessGraphDbOptions {
	database: ISqliteDatabase | SqlJsDatabaseLike | SqliteWasmOo1DatabaseLike;
	databaseLabel?: string;
	runMigrations?: boolean;
	embeddingProvider?: IEmbeddingProvider;
	snapshotStorage?: ISnapshotStoragePort;
	logger?: ILogger;
}

export interface HeadlessGraphDbRepositories {
	readonly tables: SqliteTableRepository;
	readonly attributeTypes: SqliteAttributeTypeRepository;
	readonly attributes: SqliteAttributeRepository;
	readonly nodes: SqliteNodeRepository;
	readonly nodeMutations: SqliteNodeMutationRepository;
	readonly nodeAttributes: SqliteNodeAttributeRepository;
	readonly nodeRelations: SqliteNodeRelationRepository;
	readonly relationTypes: SqliteRelationTypeRepository;
	readonly docs: SqliteDocRepository;
	readonly nodeEmbeddings: SqliteNodeEmbeddingRepository;
	readonly nodeSearch: SqliteNodeSearchRepository;
}

export interface HeadlessGraphDb {
	readonly database: ISqliteDatabase;
	readonly ia: InformationArchitectureService;
	readonly aiMemory: AiMemoryService;
	readonly hierarchy: GraphHierarchyService;
	readonly traversal: GraphTraversalService;
	readonly schemaGate: NodeAttributeSchemaGate;
	readonly schemaProjection: TableSchemaProjectionService;
	readonly embedNodes?: EmbedNodesUseCase;
	readonly snapshotStorage?: ISnapshotStoragePort;
	readonly repositories: HeadlessGraphDbRepositories;
	createTable(input: CreateTableInput): Promise<CreateTableOutput>;
	getTable(idOrIdentifier: string): Promise<TableDto | null>;
	listTables(options?: PaginationOptions): Promise<PaginatedResult<TableDto>>;
	createAttribute(input: CreateAttributeInput): Promise<CreateAttributeOutput>;
	createNode(input: CreateNodeInput): Promise<CreateNodeOutput>;
	getNode(nodeId: string): Promise<ReturnType<typeof nodeFromEntity> | null>;
	updateNode(nodeId: string, input: UpdateNodeInput): Promise<UpdateNodeOutput>;
	deleteNode(nodeId: string): Promise<void>;
	createRelation(input: CreateRelationInput): Promise<CreateRelationOutput>;
	searchNodes(input: SearchNodesInput): Promise<SearchNodesOutput>;
	hybridSearch(input: HybridSearchNodesInput): Promise<HybridSearchNodesOutput>;
	applyPresetBlueprint(
		preset: PresetBlueprintName,
	): ReturnType<InformationArchitectureService["applyBlueprint"]>;
	exportDatabaseBytes(): Uint8Array | null;
	saveSnapshot(
		key: string,
		customMetadata?: Record<string, string>,
	): Promise<{ key: string; bytes: number }>;
	dispose(): Promise<void>;
}

/**
 * Zero-dependency headless core engine entrypoint.
 * Wires SQLite, Typed EAV schema validation, zero-embedding Information Architecture,
 * 5-signal AI Agent Memory, graph traversal, and optional embeddings without loading
 * GraphQL, HTTP servers, or Node-only runtime modules.
 */
export async function createHeadlessGraphDb(
	options: HeadlessGraphDbOptions,
): Promise<HeadlessGraphDb> {
	const logger = options.logger ?? new ConsoleLogger(LogLevel.WARN, false);
	const databaseLabel = options.databaseLabel ?? ":headless:";
	const database = wrapWebSqliteDatabase(options.database, {
		filename: databaseLabel,
	});

	if (options.runMigrations !== false) {
		configureSqliteDatabase(database, databaseLabel);
		applyDatabaseMigrations(
			database,
			createDatabaseMigrations(EMBEDDED_INITIAL_SCHEMA_SQL),
		);
	}

	const tables = new SqliteTableRepository(database);
	const attributeTypes = new SqliteAttributeTypeRepository(database);
	const attributes = new SqliteAttributeRepository(database);
	const nodes = new SqliteNodeRepository(database);
	const nodeMutations = new SqliteNodeMutationRepository(database);
	const nodeAttributes = new SqliteNodeAttributeRepository(database);
	const nodeRelations = new SqliteNodeRelationRepository(database);
	const relationTypes = new SqliteRelationTypeRepository(database);
	const docs = new SqliteDocRepository(database);
	const nodeEmbeddings = new SqliteNodeEmbeddingRepository(database);
	const nodeSearch = new SqliteNodeSearchRepository(database);

	const schemaProjection = new TableSchemaProjectionService(
		tables,
		attributes,
		attributeTypes,
		logger,
	);
	const schemaGate = new NodeAttributeSchemaGate(
		schemaProjection,
		nodes,
		attributes,
		nodeAttributes,
	);
	const schemaLifecycle = {
		async onTableSchemaChanged(
			tableReferences: string | string[],
		): Promise<void> {
			const refs = Array.isArray(tableReferences)
				? tableReferences
				: [tableReferences];
			for (const ref of refs) {
				const trimmed = ref?.trim();
				if (trimmed) TableSchemaProjectionService.clearCache(trimmed);
			}
		},
	};

	const createTableUseCase = {
		async execute(input: CreateTableInput): Promise<CreateTableOutput> {
			if (!input.identifier?.trim()) {
				throw new ValidationException("Table identifier is required");
			}
			const existingTable = await tables.findByIdentifier(input.identifier);
			if (existingTable) {
				throw new ConflictException(
					`Table with identifier '${input.identifier}' already exists`,
				);
			}
			const savedTable = await tables.save(
				Table.create(input.identifier, input.description),
			);
			if (!savedTable) {
				throw new Error("Table save returned void unexpectedly");
			}
			return { table: tableFromEntity(savedTable) };
		},
	};

	const createAttributeUseCase = {
		async execute(input: CreateAttributeInput): Promise<CreateAttributeOutput> {
			if (!input.tableId?.trim()) {
				throw new ValidationException("Table ID is required");
			}
			if (!input.identifier?.trim()) {
				throw new ValidationException("Attribute identifier is required");
			}
			if (!input.attributeTypeId?.trim()) {
				throw new ValidationException("Attribute type ID is required");
			}
			const table = await tables.findById(input.tableId as TableId);
			if (!table) {
				throw new NotFoundException(
					`Table with ID '${input.tableId}' not found`,
				);
			}
			let attributeType = await attributeTypes.findById(
				input.attributeTypeId as AttributeTypeId,
			);
			if (!attributeType) {
				attributeType = await attributeTypes.findByIdentifier(
					input.attributeTypeId,
				);
			}
			if (!attributeType) {
				throw new NotFoundException(
					`AttributeType with ID '${input.attributeTypeId}' not found`,
				);
			}
			const existing = await attributes.findByTableIdAndIdentifier(
				table.id,
				input.identifier,
			);
			if (existing) {
				throw new ConflictException(
					`Attribute with identifier '${input.identifier}' already exists in table '${input.tableId}'`,
				);
			}
			const metadataJson =
				input.metadata === undefined || input.metadata === null
					? undefined
					: typeof input.metadata === "string"
						? input.metadata
						: JSON.stringify(input.metadata);

			const attribute = Attribute.create(
				table.id,
				input.identifier,
				attributeType.getId() as AttributeTypeId,
				input.name,
				input.description,
				input.isRequired || false,
				metadataJson,
			);
			await attributes.save(attribute);
			TableSchemaProjectionService.clearCache(table.id);
			const saved = await attributes.findByTableIdAndIdentifier(
				table.id,
				input.identifier,
			);
			if (!saved) {
				throw new Error("Failed to retrieve saved attribute");
			}
			return { attribute: attributeFromEntity(saved) };
		},
	};
	const createNodeUseCase = new CreateNodeUseCase(
		nodes,
		nodeAttributes,
		tables,
		attributes,
		logger,
		schemaProjection,
		nodeMutations,
	);
	const updateNodeUseCase = new UpdateNodeUseCase(
		nodes,
		nodeAttributes,
		tables,
		attributes,
		logger,
		schemaProjection,
		nodeMutations,
	);
	const createRelationUseCase = new CreateRelationUseCase(
		nodeRelations,
		relationTypes,
		nodes,
		tables,
		logger,
	);
	const createDocUseCase = new CreateDocUseCase(docs, tables, logger);
	const searchNodesUseCase = new SearchNodesUseCase(
		nodes,
		nodeSearch,
		attributes,
		tables,
		logger,
	);
	const hybridSearchNodesUseCase = new HybridSearchNodesUseCase(
		nodes,
		nodeSearch,
		nodeEmbeddings,
		nodeRelations,
		relationTypes,
		attributes,
		tables,
		logger,
		undefined,
		options.embeddingProvider,
	);
	const embedNodesUseCase = options.embeddingProvider
		? new EmbedNodesUseCase(
				options.embeddingProvider,
				nodes,
				nodeEmbeddings,
				attributes,
				nodeAttributes,
				logger,
			)
		: undefined;

	const hierarchy = new GraphHierarchyService(
		nodes,
		nodeRelations,
		relationTypes,
		tables,
	);
	const traversal = new GraphTraversalService(nodes, nodeRelations);

	const iaDeps = {
		tableRepository: tables,
		attributeTypeRepository: attributeTypes,
		attributeRepository: attributes,
		nodeRepository: nodes,
		nodeAttributeRepository: nodeAttributes,
		nodeRelationRepository: nodeRelations,
		relationTypeRepository: relationTypes,
		nodeEmbeddingRepository: nodeEmbeddings,
		docRepository: docs,
		createTableUseCase,
		createAttributeUseCase,
		createNodeUseCase,
		updateNodeUseCase,
		createRelationUseCase,
		createDocUseCase,
		hybridSearchNodesUseCase,
		hierarchyService: hierarchy,
		schemaGate,
		schemaLifecycle,
		embedNodesUseCase,
		logger,
	};

	const ia = new InformationArchitectureService(iaDeps);
	const aiMemory = new AiMemoryService(iaDeps);

	const exportDatabaseBytes = (): Uint8Array | null => {
		if (database instanceof WebSqliteDatabase) {
			return database.exportBytes();
		}
		return null;
	};

	return {
		database,
		ia,
		aiMemory,
		hierarchy,
		traversal,
		schemaGate,
		schemaProjection,
		embedNodes: embedNodesUseCase,
		snapshotStorage: options.snapshotStorage,
		repositories: {
			tables,
			attributeTypes,
			attributes,
			nodes,
			nodeMutations,
			nodeAttributes,
			nodeRelations,
			relationTypes,
			docs,
			nodeEmbeddings,
			nodeSearch,
		},
		async createTable(input) {
			return await createTableUseCase.execute(input);
		},
		async getTable(idOrIdentifier) {
			const found =
				(await tables.findById(idOrIdentifier as TableId)) ??
				(await tables.findByIdentifier(idOrIdentifier));
			return found ? tableFromEntity(found) : null;
		},
		async listTables(pagination) {
			const page = await tables.findAll(pagination);
			const items = (page.data ?? page.nodes ?? []).map((table) =>
				tableFromEntity(table),
			);
			return {
				nodes: items,
				totalCount: page.totalCount,
				hasNextPage: page.hasNextPage,
				hasPreviousPage: page.hasPreviousPage,
				data: items,
				items,
				total: page.total,
				hasMore: page.hasMore,
			};
		},
		async createAttribute(input) {
			return await createAttributeUseCase.execute(input);
		},
		async createNode(input) {
			return await createNodeUseCase.execute(input);
		},
		async getNode(nodeId) {
			const found = await nodes.findById(nodeId as NodeId);
			return found ? nodeFromEntity(found) : null;
		},
		async updateNode(nodeId, input) {
			return await updateNodeUseCase.execute(nodeId, input);
		},
		async deleteNode(nodeId) {
			await nodes.delete(nodeId as NodeId);
		},
		async createRelation(input) {
			return await createRelationUseCase.execute(input);
		},
		async searchNodes(input) {
			return await searchNodesUseCase.execute(input);
		},
		async hybridSearch(input) {
			return await hybridSearchNodesUseCase.execute(input);
		},
		async applyPresetBlueprint(preset) {
			return await ia.applyBlueprint(getPresetBlueprint(preset));
		},
		exportDatabaseBytes,
		async saveSnapshot(key, customMetadata) {
			if (!options.snapshotStorage) {
				throw new Error("snapshotStorage is not configured for saveSnapshot()");
			}
			const bytes = exportDatabaseBytes();
			if (!bytes) {
				throw new Error(
					"Underlying SQLite driver does not expose exportBytes()",
				);
			}
			const meta = await options.snapshotStorage.putSnapshot(
				key,
				bytes,
				customMetadata,
			);
			return { key, bytes: meta.size };
		},
		async dispose() {
			database.close?.();
		},
	};
}
