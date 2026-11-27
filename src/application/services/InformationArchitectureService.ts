import { GraphTraversalService } from "@/application/services/GraphTraversalService.js";
import type {
	ColumnConfig,
	TableColumnProfile,
	TableColumnSummary,
} from "@/domain/value-objects/ColumnConfig.js";
import type {
	AppliedBlueprintResult,
	ApplyBlueprintOptions,
	ArchitectureAuditOptions,
	ArchitectureAuditResult,
	ArchitectureInspectionResult,
	BlueprintDiffResult,
	ExportBlueprintOptions,
	IaContextPackInput,
	IaContextPackResult,
	IaOutlineOptions,
	IaOutlineResult,
	IaPathQueryInput,
	IaPathQueryResult,
	IaStructuredQuery,
	IaStructuredQueryResult,
	InformationArchitectureBlueprint,
	InformationArchitectureDeps,
} from "./InformationArchitectureTypes.js";
import { IaArchitectureAuditor } from "./ia/IaArchitectureAuditor.js";
import { IaBlueprintManager } from "./ia/IaBlueprintManager.js";
import { IaQueryEngine } from "./ia/IaQueryEngine.js";

export * from "./InformationArchitectureTypes.js";

/**
 * Facade coordinating declarative Information Architecture (IA) blueprints,
 * zero-embedding structured queries/outlines/paths/context packs, column configuration,
 * and architecture auditing across modular collaborator services.
 */
export class InformationArchitectureService {
	private readonly keyToNodeId = new Map<string, string>();
	private readonly graphTraversal: GraphTraversalService;
	private readonly blueprints: IaBlueprintManager;
	private readonly queries: IaQueryEngine;
	private readonly auditor: IaArchitectureAuditor;

	constructor(private readonly deps: InformationArchitectureDeps) {
		this.graphTraversal = new GraphTraversalService(
			deps.nodeRepository,
			deps.nodeRelationRepository,
		);
		this.blueprints = new IaBlueprintManager(this.deps, this.keyToNodeId);
		this.queries = new IaQueryEngine(
			this.deps,
			this.graphTraversal,
			this.blueprints,
		);
		this.auditor = new IaArchitectureAuditor(this.deps);
	}

	getNodeIdByKey(key: string): string | undefined {
		return this.blueprints.getNodeIdByKey(key);
	}

	async hydrateKeyIndex(): Promise<Map<string, string>> {
		return await this.blueprints.hydrateKeyIndex();
	}

	async resolveNodeIdByKey(key: string): Promise<string | undefined> {
		return await this.blueprints.resolveNodeIdByKey(key);
	}

	async applyBlueprint(
		blueprint: InformationArchitectureBlueprint,
		options: ApplyBlueprintOptions = {},
	): Promise<AppliedBlueprintResult> {
		return await this.blueprints.applyBlueprint(blueprint, options);
	}

	async diffBlueprint(
		blueprint: InformationArchitectureBlueprint,
	): Promise<BlueprintDiffResult> {
		return await this.blueprints.diffBlueprint(blueprint);
	}

	async exportBlueprint(
		options: ExportBlueprintOptions = {},
	): Promise<InformationArchitectureBlueprint> {
		return await this.blueprints.exportBlueprint(options);
	}

	async queryStructured(
		query: IaStructuredQuery,
	): Promise<IaStructuredQueryResult> {
		return await this.queries.queryStructured(query);
	}

	async getOutline(options: IaOutlineOptions): Promise<IaOutlineResult> {
		return await this.queries.getOutline(options);
	}

	async queryPath(input: IaPathQueryInput): Promise<IaPathQueryResult> {
		return await this.queries.queryPath(input);
	}

	async assembleContextPack(
		input: IaContextPackInput,
	): Promise<IaContextPackResult> {
		return await this.queries.assembleContextPack(input);
	}

	async auditArchitecture(
		options: ArchitectureAuditOptions = {},
	): Promise<ArchitectureAuditResult> {
		return await this.auditor.auditArchitecture(options);
	}

	async inspectArchitecture(): Promise<ArchitectureInspectionResult> {
		return await this.auditor.inspectArchitecture();
	}

	async getTableColumns(tableIdentifier: string): Promise<TableColumnProfile> {
		return await this.blueprints.getTableColumns(tableIdentifier);
	}

	async configureColumn(
		tableIdentifier: string,
		attributeIdentifier: string,
		options: ColumnConfig,
	): Promise<TableColumnSummary> {
		return await this.blueprints.configureColumn(
			tableIdentifier,
			attributeIdentifier,
			options,
		);
	}
}
