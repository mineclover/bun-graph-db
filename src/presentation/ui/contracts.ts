import type { PresetBlueprintName } from "@/application/blueprints/PresetBlueprints.js";
import type { NodeDto } from "@/application/dtos/NodeDto.js";
import type {
	ConsolidateInput,
	ConsolidateOutput,
	MemoryStatsOutput,
	RecalledMemoryHit,
	RecallInput,
	RecallOutput,
	RememberInput,
	RememberOutput,
} from "@/application/services/AiMemoryService.js";
import type { HierarchyValidationResultDto } from "@/application/services/GraphHierarchyService.js";
import type {
	AppliedBlueprintResult,
	ArchitectureAuditResult,
	BlueprintDiffResult,
	IaBreadcrumbSummary,
	IaFacetBucket,
	IaOutlineOptions,
	IaOutlineResult,
	IaStructuredQuery,
	IaStructuredQueryResult,
	InformationArchitectureBlueprint,
} from "@/application/services/InformationArchitectureTypes.js";
import type {
	ColumnConfig,
	TableColumnProfile,
	TableColumnSummary,
} from "@/domain/value-objects/ColumnConfig.js";

export type ChangeScope =
	| "schema"
	| "rows"
	| "relations"
	| "memory"
	| "views"
	| "snapshot";

export type PlatformMode = "local-headless" | "remote-http" | "cloudflare-do";

export type ViewPluginId =
	| "table"
	| "outline"
	| "board"
	| "graph"
	| "timeline"
	| "audit";

export interface PlatformTableSummary {
	id: string;
	identifier: string;
	description: string | null;
	attributeCount: number;
	nodeCount: number;
	treeValidation?: HierarchyValidationResultDto;
	dagValidation?: HierarchyValidationResultDto;
}

export interface PlatformSignalBreakdown {
	lexical?: number;
	vector?: number;
	recency?: number;
	importance?: number;
	graph?: number;
}

export interface PlatformRow {
	id: string;
	tableId: string;
	tableIdentifier: string;
	title: string | null;
	content: string;
	description?: string | null;
	attributes: Record<string, unknown>;
	createdAt?: string;
	updatedAt?: string;
	score?: number;
	signalBreakdown?: PlatformSignalBreakdown;
	breadcrumbs?: IaBreadcrumbSummary[];
	topicBreadcrumbs?: IaBreadcrumbSummary[];
}

export interface PlatformRelation {
	id: string;
	tableId: string;
	sourceNodeId: string;
	targetNodeId: string;
	relationType: string;
	strength?: number | null;
	confidence?: number | null;
	properties?: Record<string, unknown> | null;
}

export interface PlatformRelationType {
	id: string;
	identifier: string;
	description?: string | null;
	category?: string | null;
}

export interface PlatformValidationIssue {
	field: string;
	message: string;
}

export interface PlatformValidationReport {
	valid: boolean;
	issues: PlatformValidationIssue[];
}

export interface CreateRowCommand {
	tableId: string;
	tableIdentifier?: string;
	title?: string | null;
	content: string;
	description?: string | null;
	metadata?: Record<string, unknown>;
	attributes?: Record<string, unknown>;
}

export interface UpdateRowCommand {
	tableId?: string;
	tableIdentifier?: string;
	title?: string | null;
	content?: string;
	description?: string | null;
	metadata?: Record<string, unknown>;
	attributes?: Record<string, unknown>;
}

export interface RelationCommand {
	tableId: string;
	sourceNodeId: string;
	targetNodeId: string;
	relationType: string;
	strength?: number;
	confidence?: number;
}

export interface MoveHierarchyCommand {
	nodeId: string;
	newParentId: string | null;
	relationType?: string;
}

export interface GraphSubgraphNode {
	id: string;
	label: string;
	tableIdentifier: string;
	pageRank: number;
	sccClusterId: number;
	inImpactSet: boolean;
	degree: number;
}

export interface GraphSubgraphEdge {
	id: string;
	sourceId: string;
	targetId: string;
	relationType: string;
	strength?: number | null;
}

export interface GraphSubgraph {
	nodes: GraphSubgraphNode[];
	edges: GraphSubgraphEdge[];
	focusNodeId?: string;
	impactNodeIds: string[];
	relationTypes: string[];
}

export interface DependencyGraphQuery {
	tableIdentifier: string;
	focusNodeId?: string;
	relationTypes?: string[];
	limit?: number;
}

export interface SavedViewConfig {
	id: string;
	name: string;
	tableIdentifier: string;
	viewType: ViewPluginId;
	sortColumn?: string;
	sortDirection?: "ascending" | "descending";
	filterQuery?: string;
	searchQuery?: string;
	groupByColumn?: string;
	graphRelationTypes?: string[];
	createdAt?: string;
}

export interface ViewDataSlice {
	mode: PlatformMode;
	table: PlatformTableSummary | null;
	tables: PlatformTableSummary[];
	columns: TableColumnSummary[];
	columnProfile: TableColumnProfile | null;
	rows: PlatformRow[];
	relations: PlatformRelation[];
	relationTypes: PlatformRelationType[];
	facets: Record<string, IaFacetBucket[]>;
	outline?: IaOutlineResult;
	graph?: GraphSubgraph;
	memoryHits?: RecalledMemoryHit[];
	memoryStats?: MemoryStatsOutput;
	audit?: ArchitectureAuditResult;
	opsHealth?: Record<string, unknown>;
	opsMetrics?: Record<string, unknown>;
	opsAuditLog?: Record<string, unknown>;
	selection: ReadonlySet<string>;
	activeSubtreeRootId: string | null;
	activeFacets: Record<string, string>;
	sortColumn: string | null;
	sortDirection: "ascending" | "descending";
	searchQuery: string;
}

export type ViewIntent =
	| { type: "select"; nodeIds: string[] }
	| { type: "open-detail"; nodeId: string }
	| { type: "sort"; columnKey: string; direction: "ascending" | "descending" }
	| { type: "filter-facet"; key: string; value: string | null }
	| { type: "clear-facets" }
	| {
			type: "inline-update";
			nodeId: string;
			patch: {
				title?: string | null;
				content?: string;
				attributes?: Record<string, unknown>;
			};
	  }
	| { type: "delete-row"; nodeId: string }
	| {
			type: "reparent";
			nodeId: string;
			newParentId: string | null;
			relationType?: string;
	  }
	| { type: "focus-subtree"; rootNodeId: string }
	| { type: "clear-subtree" }
	| {
			type: "create-relation";
			sourceNodeId: string;
			targetNodeId: string;
			relationType: string;
			strength?: number;
			confidence?: number;
	  }
	| { type: "delete-relation"; relationId: string }
	| { type: "focus-graph-node"; nodeId: string | null }
	| { type: "filter-graph-relations"; relationTypes: string[] }
	| { type: "consolidate-memory"; namespace?: string; dryRun?: boolean }
	| { type: "apply-preset"; preset: PresetBlueprintName }
	| { type: "refresh-ops" }
	| { type: "refresh" };

export interface FieldEditorContext {
	column: TableColumnSummary;
	value: unknown;
	onChange: (nextValue: unknown) => void;
	onCommit: () => void;
	onCancel?: () => void;
	error?: string;
	referenceCandidates?: Array<{ id: string; label: string }>;
}

export interface FieldEditorSpec {
	id: string;
	matches(col: TableColumnSummary): boolean;
	renderCell(value: unknown, col: TableColumnSummary): HTMLElement;
	renderEditor(ctx: FieldEditorContext): HTMLElement;
}

export interface IVisualizationPlugin {
	readonly id: ViewPluginId;
	readonly label: string;
	supports(
		table: PlatformTableSummary | null,
		columns: readonly TableColumnSummary[],
		slice?: ViewDataSlice,
	): boolean;
	mount(container: HTMLElement, onIntent: (intent: ViewIntent) => void): void;
	update(slice: ViewDataSlice): void;
	destroy(): void;
}

export interface AuthoringCommand<T = unknown> {
	readonly label: string;
	execute(): Promise<T>;
	undo(): Promise<void>;
}

export interface IGraphPlatformClient {
	readonly mode: PlatformMode;
	setAuthToken?(token: string): void;
	getAuthToken?(): string;

	inspectArchitecture(): Promise<PlatformTableSummary[]>;
	getTableColumns(tableIdOrIdentifier: string): Promise<TableColumnProfile>;
	configureColumn(
		tableIdOrIdentifier: string,
		attributeIdentifier: string,
		config: ColumnConfig,
	): Promise<void>;
	applyPreset(preset: PresetBlueprintName): Promise<AppliedBlueprintResult>;
	applyBlueprint(
		bp: InformationArchitectureBlueprint,
	): Promise<AppliedBlueprintResult>;
	diffBlueprint(
		bp: InformationArchitectureBlueprint,
	): Promise<BlueprintDiffResult>;

	validateRow(
		columns: readonly TableColumnSummary[],
		draft: { content?: string; attributes?: Record<string, unknown> },
		isCreate?: boolean,
	): Promise<PlatformValidationReport>;
	createRow(input: CreateRowCommand): Promise<NodeDto>;
	updateRow(nodeId: string, patch: UpdateRowCommand): Promise<NodeDto>;
	deleteRow(nodeId: string): Promise<void>;
	listRelations(tableIdOrIdentifier?: string): Promise<PlatformRelation[]>;
	listRelationTypes(): Promise<PlatformRelationType[]>;
	upsertRelation(input: RelationCommand): Promise<PlatformRelation | null>;
	deleteRelation(relationId: string): Promise<void>;
	moveHierarchyNode(input: MoveHierarchyCommand): Promise<void>;

	queryTable(query: IaStructuredQuery): Promise<IaStructuredQueryResult>;
	getOutline(opts: IaOutlineOptions): Promise<IaOutlineResult>;
	getDependencyGraph(opts: DependencyGraphQuery): Promise<GraphSubgraph>;
	auditArchitecture(): Promise<ArchitectureAuditResult>;

	remember(input: RememberInput): Promise<RememberOutput>;
	recall(input: RecallInput): Promise<RecallOutput>;
	consolidate(input: ConsolidateInput): Promise<ConsolidateOutput>;
	getMemoryStats(namespace?: string): Promise<MemoryStatsOutput>;

	listSavedViews(): Promise<SavedViewConfig[]>;
	saveView(view: SavedViewConfig): Promise<SavedViewConfig>;
	deleteSavedView(viewId: string): Promise<void>;

	saveSnapshot?(key: string): Promise<{ key: string; bytes: number }>;
	restoreSnapshot?(key: string): Promise<void>;

	getHealth?(): Promise<Record<string, unknown>>;
	getMetricsJson?(): Promise<Record<string, unknown>>;
	getAuditLog?(limit?: number): Promise<Record<string, unknown>>;

	subscribe(
		listener: (event: { scope: ChangeScope; tableId?: string }) => void,
	): () => void;
}
