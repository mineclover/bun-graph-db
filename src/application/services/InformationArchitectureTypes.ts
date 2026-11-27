import type { TableSchemaLifecycleAspect } from "@/application/aspects/TableSchemaLifecycleAspect.js";
import type { ILogger } from "@/application/ports/ILogger.js";
import type {
	GraphHierarchyService,
	HierarchyMode,
	HierarchyValidationResultDto,
} from "@/application/services/GraphHierarchyService.js";
import type { TraversalDirection } from "@/application/services/GraphTraversalService.js";
import type { NodeAttributeSchemaGate } from "@/application/services/NodeAttributeSchemaGate.js";
import type { CreateAttributeUseCase } from "@/application/use-cases/attributes/CreateAttribute.js";
import type { CreateDocUseCase } from "@/application/use-cases/docs/CreateDoc.js";
import type { CreateNodeUseCase } from "@/application/use-cases/nodes/CreateNode.js";
import type { EmbedNodesUseCase } from "@/application/use-cases/nodes/EmbedNodes.js";
import type {
	HybridSearchHitDto,
	HybridSearchMetrics,
	HybridSearchNodesUseCase,
	HybridSearchWeights,
} from "@/application/use-cases/nodes/HybridSearchNodes.js";
import type { UpdateNodeUseCase } from "@/application/use-cases/nodes/UpdateNode.js";
import type { CreateRelationUseCase } from "@/application/use-cases/relations/CreateRelation.js";
import type { CreateTableUseCase } from "@/application/use-cases/tables/CreateTable.js";
import type { TableSchemaConformanceReport } from "@/core/schema/TableSchemaProjection.js";
import type { IAttributeRepository } from "@/domain/repositories/IAttributeRepository.js";
import type { IAttributeTypeRepository } from "@/domain/repositories/IAttributeTypeRepository.js";
import type { IDocRepository } from "@/domain/repositories/IDocRepository.js";
import type { INodeAttributeRepository } from "@/domain/repositories/INodeAttributeRepository.js";
import type { INodeEmbeddingRepository } from "@/domain/repositories/INodeEmbeddingRepository.js";
import type { INodeRelationRepository } from "@/domain/repositories/INodeRelationRepository.js";
import type { INodeRepository } from "@/domain/repositories/INodeRepository.js";
import type { IRelationTypeRepository } from "@/domain/repositories/IRelationTypeRepository.js";
import type { ITableRepository } from "@/domain/repositories/ITableRepository.js";
import type { ColumnConfig } from "@/domain/value-objects/ColumnConfig.js";
import type { SafeJsonValue } from "@/shared/utils/safeJson.js";

export interface IaRelationTypeSpec {
	identifier: string;
	description?: string;
	category?: string;
}

export interface IaAttributeSpec {
	identifier: string;
	name?: string;
	description?: string;
	typeIdentifier: string;
	isRequired?: boolean;
	options?: ColumnConfig;
	metadata?: Record<string, SafeJsonValue>;
}

export interface IaDocSpec {
	category: "usage" | "guide" | "example" | "spec" | "general";
	content: string;
	version?: number;
}

export interface IaNodeSpec {
	key?: string;
	content: string;
	title?: string;
	description?: string;
	attributes?: Record<string, unknown>;
	metadata?: Record<string, SafeJsonValue>;
	parentKey?: string;
	parentKeys?: string[];
	hierarchyRelationType?: string;
	embed?: boolean;
}

export interface IaTableSpec {
	identifier: string;
	description?: string;
	hierarchy?: {
		mode: HierarchyMode;
		relationType?: string;
	};
	attributes?: IaAttributeSpec[];
	docs?: IaDocSpec[];
	nodes?: IaNodeSpec[];
}

export interface IaRelationSpec {
	sourceKey: string;
	targetKey: string;
	relationType: string;
	tableIdentifier?: string;
	strength?: number;
	confidence?: number;
	properties?: Record<string, SafeJsonValue>;
}

export interface InformationArchitectureBlueprint {
	name: string;
	version?: string;
	description?: string;
	relationTypes?: IaRelationTypeSpec[];
	tables: IaTableSpec[];
	relations?: IaRelationSpec[];
}

export interface ApplyBlueprintOptions {
	embedNodes?: boolean;
	embeddingMode?: "auto" | "columns-only" | "all" | "none";
	validateHierarchies?: boolean;
	updateExistingNodes?: boolean;
	updateExistingColumns?: boolean;
}

export interface AppliedBlueprintResult {
	name: string;
	tables: Record<string, string>;
	nodesByKey: Record<string, string>;
	nodesUpdated: number;
	hierarchyValidations: Record<string, HierarchyValidationResultDto>;
	conformanceReports: Record<string, TableSchemaConformanceReport>;
	embeddedNodeCount: number;
	relationsCreated: number;
}

export interface BlueprintDiffResult {
	name: string;
	tablesToCreate: string[];
	attributesToCreate: Array<{
		tableIdentifier: string;
		attributeIdentifier: string;
	}>;
	attributesToUpdate: Array<{
		tableIdentifier: string;
		attributeIdentifier: string;
	}>;
	nodesToCreate: Array<{
		tableIdentifier: string;
		key: string;
		content: string;
	}>;
	nodesToUpdate: Array<{
		tableIdentifier: string;
		key: string;
		nodeId: string;
		fields: string[];
	}>;
	relationsToCreate: Array<{
		sourceKey: string;
		targetKey: string;
		relationType: string;
	}>;
	upToDate: boolean;
}

export interface ExportBlueprintOptions {
	name?: string;
	version?: string;
	description?: string;
	tableIdentifiers?: string[];
	includeDocs?: boolean;
	hierarchyRules?: Record<
		string,
		{ mode: HierarchyMode; relationType?: string }
	>;
}

export interface IaScopedRelationFilter {
	rootNodeId?: string;
	rootNodeKey?: string;
	hierarchyRelationType?: string;
	maxHierarchyDepth?: number;
	includeRoot?: boolean;
	linkRelationType: string;
	linkDirection?: TraversalDirection;
}

export interface IaStructuredQuery {
	tableIdentifier: string;
	underNodeId?: string;
	underNodeKey?: string;
	hierarchyRelationType?: string;
	maxHierarchyDepth?: number;
	includeRoot?: boolean;
	scopedByRelation?: IaScopedRelationFilter;
	filterQuery?: string;
	textQuery?: string;
	vector?: readonly number[];
	model?: string;
	weights?: HybridSearchWeights;
	facets?: string[] | "auto";
	includeBreadcrumbs?: boolean;
	includeTopicBreadcrumbs?: boolean;
	includeRelated?: {
		relationTypes?: string[];
		direction?: TraversalDirection;
		maxDepth?: number;
	};
	limit?: number;
	offset?: number;
}

export interface IaFacetBucket {
	value: string;
	count: number;
}

export interface IaRelatedSummary {
	id: string;
	tableId: string;
	title: string | null;
	content: string;
}

export interface IaBreadcrumbSummary {
	id: string;
	key?: string | null;
	title: string | null;
	content: string;
}

export interface IaStructuredHit extends HybridSearchHitDto {
	nodeKey?: string | null;
	breadcrumbs?: Array<{ id: string; title: string | null; content: string }>;
	topicBreadcrumbs?: IaBreadcrumbSummary[];
	related?: IaRelatedSummary[];
}

export interface IaStructuredQueryResult {
	tableId: string;
	tableIdentifier: string;
	scopedRootId?: string;
	hits: IaStructuredHit[];
	total: number;
	hasMore: boolean;
	facets: Record<string, IaFacetBucket[]>;
	metrics: HybridSearchMetrics & { subtreeCandidateCount?: number };
}

export interface IaOutlineOptions {
	tableIdentifier: string;
	relationType?: string;
	rootNodeId?: string;
	rootNodeKey?: string;
	maxDepth?: number;
	countLinkedRelationTypes?: string[];
	includeAttributes?: boolean;
}

export interface IaOutlineNode {
	id: string;
	key: string | null;
	title: string | null;
	content: string;
	depth: number;
	childCount: number;
	subtreeNodeCount: number;
	linkedCounts: Record<string, number>;
	pathIds: string[];
	pathTitles: string[];
	attributes?: Record<string, unknown>;
	children: IaOutlineNode[];
}

export interface IaOutlineResult {
	tableId: string;
	tableIdentifier: string;
	relationType: string;
	totalNodes: number;
	maxDepthReached: number;
	roots: IaOutlineNode[];
	markdown: string;
}

export interface IaPathHopSpec {
	relationTypes: string[];
	direction?: TraversalDirection;
	minDepth?: number;
	maxDepth?: number;
	targetTableIdentifier?: string;
	filterQuery?: string;
}

export interface IaPathStep {
	hopIndex: number;
	viaRelationType: string | null;
	nodeId: string;
	key: string | null;
	tableId: string;
	tableIdentifier: string;
	title: string | null;
	content: string;
}

export interface IaPathMatch {
	node: {
		id: string;
		key: string | null;
		tableId: string;
		tableIdentifier: string;
		title: string | null;
		content: string;
		attributes: Record<string, unknown>;
	};
	steps: IaPathStep[];
}

export interface IaPathQueryInput {
	startNodeIds?: string[];
	startNodeKeys?: string[];
	startTableIdentifier?: string;
	startFilterQuery?: string;
	hops: IaPathHopSpec[];
	limit?: number;
}

export interface IaPathQueryResult {
	startCount: number;
	matches: IaPathMatch[];
	hopCounts: number[];
}

export interface IaContextPackInput {
	tableIdentifier: string;
	textQuery?: string;
	filterQuery?: string;
	underNodeId?: string;
	underNodeKey?: string;
	hierarchyRelationType?: string;
	includeRoot?: boolean;
	scopedByRelation?: IaScopedRelationFilter;
	facets?: string[] | "auto";
	outlineTableIdentifier?: string;
	outlineRootKey?: string;
	outlineRelationType?: string;
	expandRelationTypes?: string[];
	expandDirection?: TraversalDirection;
	maxChars?: number;
	limit?: number;
}

export interface IaContextPackItem {
	id: string;
	key: string | null;
	tableId: string;
	title: string | null;
	content: string;
	matchedVia: "query" | "neighbor";
	breadcrumbs?: Array<{ id: string; title: string | null; content: string }>;
	topicBreadcrumbs?: IaBreadcrumbSummary[];
	attributes: Record<string, unknown>;
}

export interface IaContextPackResult {
	tableIdentifier: string;
	outline?: IaOutlineResult;
	items: IaContextPackItem[];
	facets: Record<string, IaFacetBucket[]>;
	totalChars: number;
	truncated: boolean;
	markdown: string;
}

export interface ArchitectureExpectedLinkRule {
	tableIdentifier: string;
	relationType: string;
	direction: "INCOMING" | "OUTGOING";
}

export interface ArchitectureAuditOptions {
	tableIdentifiers?: string[];
	hierarchyRules?: Record<
		string,
		{ mode: HierarchyMode; relationType?: string }
	>;
	expectedLinks?: ArchitectureExpectedLinkRule[];
}

export interface ArchitectureAuditIssue {
	severity: "error" | "warning" | "info";
	code: string;
	tableIdentifier: string;
	nodeId?: string;
	message: string;
}

export interface ArchitectureTableAudit {
	id: string;
	identifier: string;
	nodeCount: number;
	attributeCount: number;
	hierarchyMode: HierarchyMode;
	hierarchyRelationType: string;
	hierarchyValidation: HierarchyValidationResultDto;
	conformance: TableSchemaConformanceReport;
	orphanNodeIds: string[];
	unlinkedNodeIds: string[];
}

export interface ArchitectureAuditResult {
	healthy: boolean;
	totalTables: number;
	errorCount: number;
	warningCount: number;
	tables: ArchitectureTableAudit[];
	issues: ArchitectureAuditIssue[];
}

export interface ArchitectureTableSummary {
	id: string;
	identifier: string;
	description: string | null;
	attributeCount: number;
	nodeCount: number;
	treeValidation: HierarchyValidationResultDto;
	dagValidation: HierarchyValidationResultDto;
}

export interface ArchitectureInspectionResult {
	totalTables: number;
	tables: ArchitectureTableSummary[];
}

export interface InformationArchitectureDeps {
	tableRepository: ITableRepository;
	attributeTypeRepository: IAttributeTypeRepository;
	attributeRepository: IAttributeRepository;
	nodeRepository: INodeRepository;
	nodeAttributeRepository: INodeAttributeRepository;
	nodeRelationRepository: INodeRelationRepository;
	relationTypeRepository: IRelationTypeRepository;
	nodeEmbeddingRepository: INodeEmbeddingRepository;
	docRepository: IDocRepository;
	createTableUseCase: Pick<CreateTableUseCase, "execute">;
	createAttributeUseCase: Pick<CreateAttributeUseCase, "execute">;
	createNodeUseCase: Pick<CreateNodeUseCase, "execute">;
	updateNodeUseCase?: Pick<UpdateNodeUseCase, "execute">;
	createRelationUseCase: Pick<CreateRelationUseCase, "execute">;
	createDocUseCase: Pick<CreateDocUseCase, "execute">;
	hybridSearchNodesUseCase: HybridSearchNodesUseCase;
	hierarchyService: GraphHierarchyService;
	schemaGate: NodeAttributeSchemaGate;
	schemaLifecycle?: Pick<TableSchemaLifecycleAspect, "onTableSchemaChanged">;
	embedNodesUseCase?: EmbedNodesUseCase;
	logger?: ILogger;
}
