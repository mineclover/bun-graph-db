import type { HierarchyMode } from "@/application/services/GraphHierarchyService.js";
import type {
	ArchitectureAuditIssue,
	ArchitectureAuditOptions,
	ArchitectureAuditResult,
	ArchitectureExpectedLinkRule,
	ArchitectureInspectionResult,
	ArchitectureTableAudit,
	ArchitectureTableSummary,
	InformationArchitectureDeps,
} from "@/application/services/InformationArchitectureTypes.js";
import { resolveTableColumnSchema } from "@/domain/value-objects/ColumnConfig.js";
import {
	loadNodeAttributesMap,
	loadTableAttrsList,
	serializeAttrValue,
} from "./IaSharedHelpers.js";

export class IaArchitectureAuditor {
	constructor(private readonly deps: InformationArchitectureDeps) {}

	async auditArchitecture(
		options: ArchitectureAuditOptions = {},
	): Promise<ArchitectureAuditResult> {
		const tablesPage = await this.deps.tableRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const allTables = (tablesPage.data ?? tablesPage.nodes ?? []).sort((a, b) =>
			a.identifier.localeCompare(b.identifier),
		);
		const selectedSet =
			options.tableIdentifiers && options.tableIdentifiers.length > 0
				? new Set(options.tableIdentifiers)
				: null;
		const tablesToAudit = selectedSet
			? allTables.filter((t) => selectedSet.has(t.identifier))
			: allTables;

		const tableAudits: ArchitectureTableAudit[] = [];
		const issues: ArchitectureAuditIssue[] = [];
		let errorCount = 0;
		let warningCount = 0;

		const expectedByTable = new Map<string, ArchitectureExpectedLinkRule[]>();
		for (const rule of options.expectedLinks ?? []) {
			const list = expectedByTable.get(rule.tableIdentifier) ?? [];
			list.push(rule);
			expectedByTable.set(rule.tableIdentifier, list);
		}

		const rtPage = await this.deps.relationTypeRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const rtIdByIdent = new Map<string, string>();
		for (const rt of rtPage.data ?? rtPage.nodes ?? []) {
			rtIdByIdent.set(rt.getIdentifier(), String(rt.getId()));
		}

		for (const table of tablesToAudit) {
			const tableId = String(table.id);
			const [tableAttrs, nodesPage, conformance] = await Promise.all([
				loadTableAttrsList(this.deps, tableId),
				this.deps.nodeRepository.findByTableId(tableId, {
					limit: 5000,
					offset: 0,
				}),
				this.deps.schemaGate.auditTableConformance({ tableId }),
			]);
			const attrCount = tableAttrs.length;
			const columnProfile = resolveTableColumnSchema(
				tableId,
				tableAttrs,
				table.identifier,
			);
			const nodes = nodesPage.data ?? nodesPage.nodes ?? [];
			const nodeIds = new Set(nodes.map((n) => String(n.getId())));

			const explicitRule = options.hierarchyRules?.[table.identifier];
			let hierarchyRelationType = explicitRule?.relationType ?? "parentOf";
			let hierarchyMode: HierarchyMode = explicitRule?.mode ?? "TREE";

			if (!explicitRule) {
				const dependsOnRtId = rtIdByIdent.get("dependsOn");
				const parentOfRtId = rtIdByIdent.get("parentOf");
				let hasParentOf = false;
				let hasDependsOn = false;
				for (const nid of nodeIds) {
					const { outgoing } =
						await this.deps.nodeRelationRepository.findByNodeId(nid, {
							limit: 500,
							offset: 0,
						});
					for (const rel of outgoing) {
						const tgt = rel.getTargetNodeId()
							? String(rel.getTargetNodeId())
							: null;
						if (!tgt || !nodeIds.has(tgt)) continue;
						const rtId = String(rel.getRelationTypeId());
						if (parentOfRtId && rtId === parentOfRtId) hasParentOf = true;
						if (dependsOnRtId && rtId === dependsOnRtId) hasDependsOn = true;
					}
				}
				if (!hasParentOf && hasDependsOn) {
					hierarchyRelationType = "dependsOn";
					hierarchyMode = "DAG";
				}
			}

			const hierarchyValidation =
				await this.deps.hierarchyService.validateHierarchy(
					tableId,
					hierarchyRelationType,
					hierarchyMode,
				);

			if (!hierarchyValidation.valid) {
				errorCount += 1;
				issues.push({
					severity: "error",
					code: "HIERARCHY_INVALID",
					tableIdentifier: table.identifier,
					message: `Hierarchy '${hierarchyRelationType}' (${hierarchyMode}) invalid: cycles=${hierarchyValidation.cycleNodeIds.length}, multiParent=${hierarchyValidation.multiParentNodeIds.length}`,
				});
			}

			if (!conformance.valid) {
				errorCount += 1;
				issues.push({
					severity: "error",
					code: "SCHEMA_CONFORMANCE_FAILED",
					tableIdentifier: table.identifier,
					message: `Schema conformance failed for '${table.identifier}' with ${conformance.nonConformantNodes} non-conformant node(s) (${conformance.violationCount} violation(s))`,
				});
			}

			const orphanNodeIds: string[] = [];
			const hierarchyRtId = rtIdByIdent.get(hierarchyRelationType);
			let intraHierarchyEdgeCount = 0;
			const connectedHierarchyNodes = new Set<string>();
			if (hierarchyRtId && nodes.length > 1) {
				for (const nid of nodeIds) {
					const { incoming, outgoing } =
						await this.deps.nodeRelationRepository.findByNodeId(nid, {
							limit: 500,
							offset: 0,
						});
					for (const rel of outgoing) {
						const tgt = rel.getTargetNodeId()
							? String(rel.getTargetNodeId())
							: null;
						if (
							String(rel.getRelationTypeId()) === hierarchyRtId &&
							tgt &&
							nodeIds.has(tgt)
						) {
							intraHierarchyEdgeCount += 1;
							connectedHierarchyNodes.add(nid);
							connectedHierarchyNodes.add(tgt);
						}
					}
					for (const rel of incoming) {
						const src = rel.getSourceNodeId()
							? String(rel.getSourceNodeId())
							: null;
						if (
							String(rel.getRelationTypeId()) === hierarchyRtId &&
							src &&
							nodeIds.has(src)
						) {
							connectedHierarchyNodes.add(nid);
							connectedHierarchyNodes.add(src);
						}
					}
				}
				if (explicitRule || intraHierarchyEdgeCount > 0) {
					for (const nid of nodeIds) {
						if (!connectedHierarchyNodes.has(nid)) {
							orphanNodeIds.push(nid);
							warningCount += 1;
							issues.push({
								severity: "warning",
								code: "ORPHAN_HIERARCHY_NODE",
								tableIdentifier: table.identifier,
								nodeId: nid,
								message: `Node '${nid}' has no '${hierarchyRelationType}' edges in hierarchy table '${table.identifier}'`,
							});
						}
					}
				}
			}

			const unlinkedNodeSet = new Set<string>();
			const tableLinkRules = expectedByTable.get(table.identifier) ?? [];
			if (tableLinkRules.length > 0) {
				for (const rule of tableLinkRules) {
					const reqRtId = rtIdByIdent.get(rule.relationType);
					for (const nid of nodeIds) {
						let hasExpected = false;
						if (reqRtId) {
							const { incoming, outgoing } =
								await this.deps.nodeRelationRepository.findByNodeId(nid, {
									limit: 500,
									offset: 0,
								});
							const pool = rule.direction === "INCOMING" ? incoming : outgoing;
							hasExpected = pool.some(
								(rel) => String(rel.getRelationTypeId()) === reqRtId,
							);
						}
						if (!hasExpected) {
							unlinkedNodeSet.add(nid);
							errorCount += 1;
							issues.push({
								severity: "error",
								code: "MISSING_EXPECTED_LINK",
								tableIdentifier: table.identifier,
								nodeId: nid,
								message: `Node '${nid}' in '${table.identifier}' lacks expected ${rule.direction} relation '${rule.relationType}'`,
							});
						}
					}
				}
			}

			tableAudits.push({
				id: tableId,
				identifier: table.identifier,
				nodeCount: nodes.length,
				attributeCount: attrCount,
				hierarchyMode,
				hierarchyRelationType,
				hierarchyValidation,
				conformance,
				orphanNodeIds,
				unlinkedNodeIds: [...unlinkedNodeSet],
			});

			const enumEntries = Object.entries(columnProfile.enumConstraints);
			if (enumEntries.length > 0) {
				for (const node of nodes) {
					const nid = String(node.getId());
					const nodeAttrs = await loadNodeAttributesMap(
						this.deps,
						nid,
						tableAttrs,
					);
					for (const [colIdent, allowed] of enumEntries) {
						const rawVal = nodeAttrs[colIdent];
						if (rawVal === undefined || rawVal === null) continue;
						const serialized = serializeAttrValue(rawVal);
						if (!allowed.includes(serialized)) {
							errorCount += 1;
							issues.push({
								severity: "error",
								code: "INVALID_ENUM_VALUE",
								tableIdentifier: table.identifier,
								nodeId: nid,
								message: `Node '${nid}' has disallowed value '${serialized}' for column '${colIdent}' (allowed: ${allowed.join(", ")})`,
							});
						}
					}
				}
			}

			if (
				columnProfile.embeddingColumns.length > 0 &&
				!this.deps.embedNodesUseCase
			) {
				issues.push({
					severity: "info",
					code: "EMBEDDING_PROVIDER_UNCONFIGURED",
					tableIdentifier: table.identifier,
					message: `Table '${table.identifier}' has embedding-enabled column(s) (${columnProfile.embeddingColumns.map((c) => c.identifier).join(", ")}) but no embeddingProvider is attached`,
				});
			}
		}

		return {
			healthy: errorCount === 0,
			totalTables: tableAudits.length,
			errorCount,
			warningCount,
			tables: tableAudits,
			issues,
		};
	}

	async inspectArchitecture(): Promise<ArchitectureInspectionResult> {
		const tablesPage = await this.deps.tableRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const allTables = tablesPage.data ?? tablesPage.nodes ?? [];
		const summaries: ArchitectureTableSummary[] = [];

		for (const table of allTables) {
			const tableId = String(table.id);
			const [attrCount, nodeCount, treeValidation, dagValidation] =
				await Promise.all([
					this.deps.attributeRepository.countByTableId(tableId),
					this.deps.nodeRepository.countByTableId(tableId),
					this.deps.hierarchyService.validateHierarchy(
						tableId,
						"parentOf",
						"TREE",
					),
					this.deps.hierarchyService.validateHierarchy(
						tableId,
						"parentOf",
						"DAG",
					),
				]);
			summaries.push({
				id: tableId,
				identifier: table.identifier,
				description: table.description,
				attributeCount: attrCount,
				nodeCount,
				treeValidation,
				dagValidation,
			});
		}

		return {
			totalTables: summaries.length,
			tables: summaries,
		};
	}
}
