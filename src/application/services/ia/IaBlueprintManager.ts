import type { HierarchyValidationResultDto } from "@/application/services/GraphHierarchyService.js";
import type {
	AppliedBlueprintResult,
	ApplyBlueprintOptions,
	BlueprintDiffResult,
	ExportBlueprintOptions,
	IaAttributeSpec,
	IaDocSpec,
	IaNodeSpec,
	IaRelationSpec,
	IaRelationTypeSpec,
	IaTableSpec,
	InformationArchitectureBlueprint,
	InformationArchitectureDeps,
} from "@/application/services/InformationArchitectureTypes.js";
import { TableSchemaProjectionService } from "@/application/services/TableSchemaProjectionService.js";
import type { TableSchemaConformanceReport } from "@/core/schema/TableSchemaProjection.js";
import type { DocCategory } from "@/domain/entities/Doc.js";
import type { Node } from "@/domain/entities/Node.js";
import { RelationType } from "@/domain/entities/RelationType.js";
import {
	type ColumnConfig,
	extractColumnConfig,
	mergeColumnConfigIntoMetadata,
	resolveEmbeddingColumnExecutionOptions,
	resolveTableColumnSchema,
	type TableColumnProfile,
	type TableColumnSummary,
	validateColumnConfig,
} from "@/domain/value-objects/ColumnConfig.js";
import {
	NotFoundException,
	ValidationException,
} from "@/shared/exceptions/DomainException.js";
import type { SafeJsonValue } from "@/shared/utils/safeJson.js";
import { sanitizeTextContent } from "@/shared/utils/sanitizeText.js";
import {
	canonicalJson,
	extractIaKey,
	loadNodeAttributesMap,
	loadTableAttrsList,
	loadTableNodesByIaKey,
	normalizeNodeMetadataForBlueprint,
	serializeAttrValue,
} from "./IaSharedHelpers.js";

export class IaBlueprintManager {
	constructor(
		private readonly deps: InformationArchitectureDeps,
		private readonly keyToNodeId: Map<string, string>,
	) {}

	getNodeIdByKey(key: string): string | undefined {
		return this.keyToNodeId.get(key);
	}

	async hydrateKeyIndex(): Promise<Map<string, string>> {
		const tablesPage = await this.deps.tableRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const allTables = tablesPage.data ?? tablesPage.nodes ?? [];
		for (const table of allTables) {
			const tableId = String(table.id);
			const nodesPage = await this.deps.nodeRepository.findByTableId(tableId, {
				limit: 5000,
				offset: 0,
			});
			const nodes = nodesPage.data ?? nodesPage.nodes ?? [];
			for (const node of nodes) {
				const key = extractIaKey(node);
				if (key) {
					this.keyToNodeId.set(key, String(node.getId()));
				}
			}
		}
		return new Map(this.keyToNodeId);
	}

	async resolveNodeIdByKey(key: string): Promise<string | undefined> {
		const cached = this.keyToNodeId.get(key);
		if (cached) {
			const existing = await this.deps.nodeRepository.findById(cached);
			if (existing) return cached;
			this.keyToNodeId.delete(key);
		}
		await this.hydrateKeyIndex();
		return this.keyToNodeId.get(key);
	}

	async applyBlueprint(
		blueprint: InformationArchitectureBlueprint,
		options: ApplyBlueprintOptions = {},
	): Promise<AppliedBlueprintResult> {
		if (!blueprint.name?.trim()) {
			throw new ValidationException("Blueprint name is required");
		}
		if (!Array.isArray(blueprint.tables) || blueprint.tables.length === 0) {
			throw new ValidationException(
				"Blueprint must declare at least one table",
			);
		}

		for (const rtSpec of blueprint.relationTypes ?? []) {
			await this.ensureRelationType(
				rtSpec.identifier,
				rtSpec.description,
				rtSpec.category,
			);
		}

		const updateExistingNodes = options.updateExistingNodes === true;
		const updateExistingColumns =
			options.updateExistingColumns === true || updateExistingNodes;
		const tablesMap: Record<string, string> = {};
		const nodesByKey: Record<string, string> = {};
		const nodeTableByKey = new Map<string, string>();
		const tableProfiles = new Map<string, TableColumnProfile>();
		const nodeIdsByTableId = new Map<string, string[]>();
		const pendingHierarchyEdges: Array<{
			tableId: string;
			parentKey: string;
			childKey: string;
			childId: string;
			relationType: string;
		}> = [];
		const nodeIdsToEmbed: string[] = [];
		let relationsCreated = 0;
		let nodesUpdated = 0;

		for (const tableSpec of blueprint.tables) {
			if (tableSpec.hierarchy?.relationType) {
				await this.ensureRelationType(
					tableSpec.hierarchy.relationType,
					undefined,
					"hierarchy",
				);
			}

			const table = await this.ensureTable(
				tableSpec.identifier,
				tableSpec.description,
			);
			const tableId = String(table.id);
			tablesMap[tableSpec.identifier] = tableId;

			const attrIdByIdentifier = new Map<string, string>();
			for (const attrSpec of tableSpec.attributes ?? []) {
				const attrId = await this.ensureAttribute(
					tableId,
					attrSpec,
					updateExistingColumns,
				);
				attrIdByIdentifier.set(attrSpec.identifier, attrId);
			}

			const tableAttrs = await loadTableAttrsList(this.deps, tableId);
			for (const existingAttr of tableAttrs) {
				attrIdByIdentifier.set(
					existingAttr.getIdentifier(),
					String(existingAttr.getId()),
				);
			}
			const columnProfile = resolveTableColumnSchema(
				tableId,
				tableAttrs,
				tableSpec.identifier,
			);
			tableProfiles.set(tableId, columnProfile);

			for (const docSpec of tableSpec.docs ?? []) {
				await this.ensureDoc(tableId, docSpec);
			}

			const existingNodesByKey = await loadTableNodesByIaKey(
				this.deps,
				tableId,
			);
			const tableNodeIds: string[] = [];

			for (let i = 0; i < (tableSpec.nodes ?? []).length; i += 1) {
				const nodeSpec = tableSpec.nodes?.[i];
				if (!nodeSpec) continue;
				const key = nodeSpec.key ?? `${tableSpec.identifier}:${i}`;
				const { nodeId, updated } = await this.ensureNode(
					tableId,
					nodeSpec,
					key,
					attrIdByIdentifier,
					columnProfile,
					existingNodesByKey,
					updateExistingNodes,
				);
				if (updated) nodesUpdated += 1;
				nodesByKey[key] = nodeId;
				nodeTableByKey.set(key, tableId);
				this.keyToNodeId.set(key, nodeId);
				tableNodeIds.push(nodeId);

				if (nodeSpec.embed !== false) {
					nodeIdsToEmbed.push(nodeId);
				}

				const parentKeys = [
					...(nodeSpec.parentKey ? [nodeSpec.parentKey] : []),
					...(nodeSpec.parentKeys ?? []),
				];
				const relType =
					nodeSpec.hierarchyRelationType ??
					tableSpec.hierarchy?.relationType ??
					"parentOf";
				for (const pKey of parentKeys) {
					pendingHierarchyEdges.push({
						tableId,
						parentKey: pKey,
						childKey: key,
						childId: nodeId,
						relationType: relType,
					});
				}
			}
			nodeIdsByTableId.set(tableId, tableNodeIds);
		}

		for (const edge of pendingHierarchyEdges) {
			const parentId =
				nodesByKey[edge.parentKey] ??
				(await this.resolveNodeIdByKey(edge.parentKey));
			if (!parentId) {
				throw new ValidationException(
					`Blueprint hierarchy parentKey '${edge.parentKey}' not found for child '${edge.childKey}'`,
				);
			}
			const created = await this.ensureRelation(
				edge.tableId,
				parentId,
				edge.childId,
				edge.relationType,
				4,
				4,
			);
			if (created) relationsCreated += 1;
		}

		for (const relSpec of blueprint.relations ?? []) {
			const sourceId =
				nodesByKey[relSpec.sourceKey] ??
				(await this.resolveNodeIdByKey(relSpec.sourceKey));
			const targetId =
				nodesByKey[relSpec.targetKey] ??
				(await this.resolveNodeIdByKey(relSpec.targetKey));
			if (!sourceId || !targetId) {
				throw new ValidationException(
					`Blueprint relation endpoints '${relSpec.sourceKey}' -> '${relSpec.targetKey}' could not be resolved`,
				);
			}
			const tableId = relSpec.tableIdentifier
				? tablesMap[relSpec.tableIdentifier]
				: (nodeTableByKey.get(relSpec.sourceKey) ??
					Object.values(tablesMap)[0]);
			if (!tableId) {
				throw new ValidationException(
					`Could not resolve tableId for relation '${relSpec.sourceKey}' -> '${relSpec.targetKey}'`,
				);
			}
			const created = await this.ensureRelation(
				tableId,
				sourceId,
				targetId,
				relSpec.relationType,
				relSpec.strength ?? 3,
				relSpec.confidence ?? 3,
				relSpec.properties,
			);
			if (created) relationsCreated += 1;
		}

		const hierarchyValidations: Record<string, HierarchyValidationResultDto> =
			{};
		for (const tableSpec of blueprint.tables) {
			if (!tableSpec.hierarchy) continue;
			const tableId = tablesMap[tableSpec.identifier];
			if (!tableId) continue;
			const validation = await this.deps.hierarchyService.validateHierarchy(
				tableId,
				tableSpec.hierarchy.relationType ?? "parentOf",
				tableSpec.hierarchy.mode,
			);
			hierarchyValidations[tableSpec.identifier] = validation;
			if (options.validateHierarchies !== false && !validation.valid) {
				throw new ValidationException(
					`Hierarchy validation failed for '${tableSpec.identifier}' (${tableSpec.hierarchy.mode}): cycles=${validation.cycleNodeIds.length}, multiParent=${validation.multiParentNodeIds.length}`,
				);
			}
		}

		let embeddedNodeCount = 0;
		const embeddingMode = options.embeddingMode ?? "auto";
		if (
			options.embedNodes !== false &&
			embeddingMode !== "none" &&
			this.deps.embedNodesUseCase
		) {
			const hasExplicitColumnEmbedding =
				blueprint.tables.some((ts) =>
					(ts.attributes ?? []).some((a) => a.options?.embedding !== undefined),
				) ||
				[...tableProfiles.values()].some((p) =>
					p.columns.some((c) => c.config.embedding !== undefined),
				);

			const useColumnPolicy =
				embeddingMode === "columns-only" ||
				(embeddingMode === "auto" && hasExplicitColumnEmbedding);

			if (useColumnPolicy) {
				const embedSet = new Set(nodeIdsToEmbed);
				for (const tableSpec of blueprint.tables) {
					const tableId = tablesMap[tableSpec.identifier];
					if (!tableId) continue;
					const profile = tableProfiles.get(tableId);
					const resolved = profile
						? resolveEmbeddingColumnExecutionOptions(profile)
						: null;
					if (!resolved) continue;

					for (const nodeId of nodeIdsByTableId.get(tableId) ?? []) {
						if (!embedSet.has(nodeId)) continue;
						await this.deps.embedNodesUseCase.embedNode(nodeId, {
							attributeIdentifiers: resolved.attributeIdentifiers,
							includeTitle: resolved.includeTitle,
							includeContent: resolved.includeContent,
							task: resolved.task,
							model: resolved.model,
						});
						embeddedNodeCount += 1;
					}
				}
			} else {
				for (const nodeId of nodeIdsToEmbed) {
					await this.deps.embedNodesUseCase.embedNode(nodeId);
					embeddedNodeCount += 1;
				}
			}
		}

		const conformanceReports: Record<string, TableSchemaConformanceReport> = {};
		for (const tableSpec of blueprint.tables) {
			const tableId = tablesMap[tableSpec.identifier];
			if (!tableId) continue;
			conformanceReports[tableSpec.identifier] =
				await this.deps.schemaGate.auditTableConformance({ tableId });
		}

		return {
			name: blueprint.name,
			tables: tablesMap,
			nodesByKey,
			nodesUpdated,
			hierarchyValidations,
			conformanceReports,
			embeddedNodeCount,
			relationsCreated,
		};
	}

	async diffBlueprint(
		blueprint: InformationArchitectureBlueprint,
	): Promise<BlueprintDiffResult> {
		if (!blueprint.name?.trim()) {
			throw new ValidationException("Blueprint name is required");
		}

		const tablesToCreate: string[] = [];
		const attributesToCreate: Array<{
			tableIdentifier: string;
			attributeIdentifier: string;
		}> = [];
		const attributesToUpdate: Array<{
			tableIdentifier: string;
			attributeIdentifier: string;
		}> = [];
		const nodesToCreate: Array<{
			tableIdentifier: string;
			key: string;
			content: string;
		}> = [];
		const nodesToUpdate: Array<{
			tableIdentifier: string;
			key: string;
			nodeId: string;
			fields: string[];
		}> = [];
		const relationsToCreate: Array<{
			sourceKey: string;
			targetKey: string;
			relationType: string;
		}> = [];

		const resolvedNodeIdsByKey = new Map<string, string>();
		const pendingRelations: Array<{
			sourceKey: string;
			targetKey: string;
			relationType: string;
		}> = [];

		for (const tableSpec of blueprint.tables) {
			const existingTable = await this.deps.tableRepository.findByIdentifier(
				tableSpec.identifier,
			);
			if (!existingTable) {
				tablesToCreate.push(tableSpec.identifier);
				for (const attrSpec of tableSpec.attributes ?? []) {
					attributesToCreate.push({
						tableIdentifier: tableSpec.identifier,
						attributeIdentifier: attrSpec.identifier,
					});
				}
				for (let i = 0; i < (tableSpec.nodes ?? []).length; i += 1) {
					const nodeSpec = tableSpec.nodes?.[i];
					if (!nodeSpec) continue;
					const key = nodeSpec.key ?? `${tableSpec.identifier}:${i}`;
					nodesToCreate.push({
						tableIdentifier: tableSpec.identifier,
						key,
						content: nodeSpec.content,
					});
					const relType =
						nodeSpec.hierarchyRelationType ??
						tableSpec.hierarchy?.relationType ??
						"parentOf";
					for (const pKey of [
						...(nodeSpec.parentKey ? [nodeSpec.parentKey] : []),
						...(nodeSpec.parentKeys ?? []),
					]) {
						pendingRelations.push({
							sourceKey: pKey,
							targetKey: key,
							relationType: relType,
						});
					}
				}
				continue;
			}

			const tableId = String(existingTable.id);
			const existingAttrs = await loadTableAttrsList(this.deps, tableId);
			const attrByIdent = new Map(
				existingAttrs.map((a) => [a.getIdentifier(), a]),
			);
			const attrIdByIdent = new Map<string, string>();
			for (const a of existingAttrs) {
				attrIdByIdent.set(a.getIdentifier(), String(a.getId()));
			}
			for (const attrSpec of tableSpec.attributes ?? []) {
				const existingAttr = attrByIdent.get(attrSpec.identifier);
				if (!existingAttr) {
					attributesToCreate.push({
						tableIdentifier: tableSpec.identifier,
						attributeIdentifier: attrSpec.identifier,
					});
				} else if (attrSpec.options !== undefined) {
					const currentOpts = extractColumnConfig(
						existingAttr.getParsedMetadata(),
					);
					if (
						canonicalJson(currentOpts ?? null) !==
						canonicalJson(attrSpec.options ?? null)
					) {
						attributesToUpdate.push({
							tableIdentifier: tableSpec.identifier,
							attributeIdentifier: attrSpec.identifier,
						});
					}
				}
			}

			const existingNodesByKey = await loadTableNodesByIaKey(
				this.deps,
				tableId,
			);
			for (let i = 0; i < (tableSpec.nodes ?? []).length; i += 1) {
				const nodeSpec = tableSpec.nodes?.[i];
				if (!nodeSpec) continue;
				const key = nodeSpec.key ?? `${tableSpec.identifier}:${i}`;
				const sanitizedContent =
					sanitizeTextContent(nodeSpec.content) ?? nodeSpec.content;
				const existingNode =
					existingNodesByKey.get(key) ??
					(await this.deps.nodeRepository.findByTableIdAndContent(
						tableId,
						sanitizedContent,
					));

				if (!existingNode) {
					nodesToCreate.push({
						tableIdentifier: tableSpec.identifier,
						key,
						content: nodeSpec.content,
					});
				} else {
					const existingId = String(existingNode.getId());
					resolvedNodeIdsByKey.set(key, existingId);
					const diffFields = await this.computeNodeDiffFields(
						existingNode,
						tableId,
						key,
						nodeSpec,
						attrIdByIdent,
					);
					if (diffFields.length > 0) {
						nodesToUpdate.push({
							tableIdentifier: tableSpec.identifier,
							key,
							nodeId: existingId,
							fields: diffFields,
						});
					}
				}

				const relType =
					nodeSpec.hierarchyRelationType ??
					tableSpec.hierarchy?.relationType ??
					"parentOf";
				for (const pKey of [
					...(nodeSpec.parentKey ? [nodeSpec.parentKey] : []),
					...(nodeSpec.parentKeys ?? []),
				]) {
					pendingRelations.push({
						sourceKey: pKey,
						targetKey: key,
						relationType: relType,
					});
				}
			}
		}

		for (const relSpec of blueprint.relations ?? []) {
			pendingRelations.push({
				sourceKey: relSpec.sourceKey,
				targetKey: relSpec.targetKey,
				relationType: relSpec.relationType,
			});
		}

		for (const pending of pendingRelations) {
			const sourceId =
				resolvedNodeIdsByKey.get(pending.sourceKey) ??
				(await this.resolveNodeIdByKey(pending.sourceKey));
			const targetId =
				resolvedNodeIdsByKey.get(pending.targetKey) ??
				(await this.resolveNodeIdByKey(pending.targetKey));
			const rt = await this.deps.relationTypeRepository.findByIdentifier(
				pending.relationType,
			);
			if (!sourceId || !targetId || !rt) {
				relationsToCreate.push(pending);
				continue;
			}
			const rtId = String(rt.getId());
			const { outgoing } = await this.deps.nodeRelationRepository.findByNodeId(
				sourceId,
				{
					limit: 1000,
					offset: 0,
				},
			);
			const exists = outgoing.some(
				(rel) =>
					String(rel.getTargetNodeId()) === targetId &&
					String(rel.getRelationTypeId()) === rtId,
			);
			if (!exists) {
				relationsToCreate.push(pending);
			}
		}

		const upToDate =
			tablesToCreate.length === 0 &&
			attributesToCreate.length === 0 &&
			attributesToUpdate.length === 0 &&
			nodesToCreate.length === 0 &&
			nodesToUpdate.length === 0 &&
			relationsToCreate.length === 0;

		return {
			name: blueprint.name,
			tablesToCreate,
			attributesToCreate,
			attributesToUpdate,
			nodesToCreate,
			nodesToUpdate,
			relationsToCreate,
			upToDate,
		};
	}

	async exportBlueprint(
		options: ExportBlueprintOptions = {},
	): Promise<InformationArchitectureBlueprint> {
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
		const tables = selectedSet
			? allTables.filter((t) => selectedSet.has(t.identifier))
			: allTables;

		const tableIdToIdentifier = new Map<string, string>();
		for (const t of tables) {
			tableIdToIdentifier.set(String(t.id), t.identifier);
		}

		const rtPage = await this.deps.relationTypeRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const rtById = new Map<
			string,
			{ identifier: string; description?: string; category?: string }
		>();
		for (const rt of rtPage.data ?? rtPage.nodes ?? []) {
			rtById.set(String(rt.getId()), {
				identifier: rt.getIdentifier(),
				...(rt.getDescription()
					? { description: rt.getDescription() ?? undefined }
					: {}),
				...(rt.getCategory()
					? { category: rt.getCategory() ?? undefined }
					: {}),
			});
		}

		const attrTypePage = await this.deps.attributeTypeRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const attrTypeById = new Map<string, string>();
		for (const at of attrTypePage.data ?? attrTypePage.nodes ?? []) {
			attrTypeById.set(String(at.getId()), at.getIdentifier());
		}

		const nodeKeyById = new Map<string, string>();
		const nodeTableIdById = new Map<string, string>();
		const perTableNodes = new Map<string, Node[]>();

		for (const table of tables) {
			const tableId = String(table.id);
			const nodesPage = await this.deps.nodeRepository.findByTableId(tableId, {
				limit: 5000,
				offset: 0,
			});
			const nodes = (nodesPage.data ?? nodesPage.nodes ?? []).sort((a, b) =>
				String(a.getId()).localeCompare(String(b.getId()), undefined, {
					numeric: true,
				}),
			);
			perTableNodes.set(tableId, nodes);
			for (const node of nodes) {
				const nodeId = String(node.getId());
				const key = extractIaKey(node) ?? `${table.identifier}:${nodeId}`;
				nodeKeyById.set(nodeId, key);
				nodeTableIdById.set(nodeId, tableId);
			}
		}

		const seenRelationKeys = new Set<string>();
		const exportedRelations: Array<{
			id: string;
			tableId: string;
			sourceNodeId: string;
			targetNodeId: string;
			relationType: string;
			strength: number;
			confidence: number;
			properties?: Record<string, SafeJsonValue>;
		}> = [];

		for (const nodeId of nodeKeyById.keys()) {
			const { outgoing } = await this.deps.nodeRelationRepository.findByNodeId(
				nodeId,
				{
					limit: 2000,
					offset: 0,
				},
			);
			for (const rel of outgoing) {
				const srcId = rel.getSourceNodeId()
					? String(rel.getSourceNodeId())
					: null;
				const dstId = rel.getTargetNodeId()
					? String(rel.getTargetNodeId())
					: null;
				if (!srcId || !dstId) continue;
				if (!nodeKeyById.has(srcId) || !nodeKeyById.has(dstId)) continue;
				const relId = String(rel.getId());
				const rtMeta = rtById.get(String(rel.getRelationTypeId()));
				if (!rtMeta) continue;
				const dedupKey = `${srcId}|${dstId}|${rtMeta.identifier}`;
				if (seenRelationKeys.has(dedupKey)) continue;
				seenRelationKeys.add(dedupKey);
				exportedRelations.push({
					id: relId,
					tableId: String(rel.getTableId()),
					sourceNodeId: srcId,
					targetNodeId: dstId,
					relationType: rtMeta.identifier,
					strength: rel.getStrength(),
					confidence: rel.getConfidence(),
					...(rel.getProperties()
						? { properties: rel.getProperties() ?? undefined }
						: {}),
				});
			}
		}

		const usedRelationTypes = new Set<string>();
		const tableSpecs: IaTableSpec[] = [];
		const consumedAsHierarchy = new Set<string>();

		for (const table of tables) {
			const tableId = String(table.id);
			const explicitRule = options.hierarchyRules?.[table.identifier];
			const intraTableRels = exportedRelations.filter(
				(r) =>
					nodeTableIdById.get(r.sourceNodeId) === tableId &&
					nodeTableIdById.get(r.targetNodeId) === tableId,
			);
			const detectedRelType =
				explicitRule?.relationType ??
				(intraTableRels.some((r) => r.relationType === "parentOf")
					? "parentOf"
					: intraTableRels.some((r) => r.relationType === "dependsOn")
						? "dependsOn"
						: undefined);
			const parentsByChildId = new Map<string, string[]>();
			if (detectedRelType) {
				for (const r of intraTableRels) {
					if (r.relationType !== detectedRelType) continue;
					const list = parentsByChildId.get(r.targetNodeId) ?? [];
					list.push(r.sourceNodeId);
					parentsByChildId.set(r.targetNodeId, list);
					consumedAsHierarchy.add(
						`${r.sourceNodeId}|${r.targetNodeId}|${r.relationType}`,
					);
					usedRelationTypes.add(r.relationType);
				}
			}

			const maxParents = [...parentsByChildId.values()].reduce(
				(max, list) => Math.max(max, list.length),
				0,
			);
			const hierarchySpec: IaTableSpec["hierarchy"] = explicitRule
				? explicitRule
				: detectedRelType
					? {
							mode:
								maxParents > 1 || detectedRelType === "dependsOn"
									? "DAG"
									: "TREE",
							relationType: detectedRelType,
						}
					: undefined;

			const attrsPage = await this.deps.attributeRepository.findByTableId(
				tableId,
				{
					limit: 500,
					offset: 0,
				},
			);
			const attrs = (attrsPage.data ?? attrsPage.nodes ?? []).sort((a, b) =>
				a.getIdentifier().localeCompare(b.getIdentifier()),
			);
			const attrSpecs: IaAttributeSpec[] = attrs.map((a) => {
				const optionsConfig = extractColumnConfig(a.getParsedMetadata());
				return {
					identifier: a.getIdentifier(),
					name: a.getName(),
					...(a.getDescription()
						? { description: a.getDescription() ?? undefined }
						: {}),
					typeIdentifier:
						attrTypeById.get(String(a.getAttributeTypeId())) ?? "string",
					isRequired: a.getIsRequired(),
					...(optionsConfig ? { options: optionsConfig } : {}),
				};
			});

			let docSpecs: IaDocSpec[] | undefined;
			if (options.includeDocs !== false) {
				const docsPage = await this.deps.docRepository.searchDocs({
					tableId,
					isActive: true,
					limit: 100,
				});
				const docs = docsPage.data ?? docsPage.nodes ?? [];
				if (docs.length > 0) {
					docSpecs = docs.map((d) => ({
						category: d.category as IaDocSpec["category"],
						content: d.content,
						version: d.version,
					}));
				}
			}

			const nodes = perTableNodes.get(tableId) ?? [];
			const nodeSpecs: IaNodeSpec[] = [];
			for (const node of nodes) {
				const nodeId = String(node.getId());
				const key = nodeKeyById.get(nodeId) ?? `${table.identifier}:${nodeId}`;
				const attrMap = await loadNodeAttributesMap(this.deps, nodeId, attrs);
				const parentIds = parentsByChildId.get(nodeId) ?? [];
				const parentKeys = parentIds
					.map((pid) => nodeKeyById.get(pid))
					.filter((k): k is string => Boolean(k));
				const metadata = normalizeNodeMetadataForBlueprint(
					node.getParsedMetadata(),
				);

				nodeSpecs.push({
					key,
					content: node.getContent(),
					...(node.getTitle() ? { title: node.getTitle() ?? undefined } : {}),
					...(node.getDescription()
						? { description: node.getDescription() ?? undefined }
						: {}),
					...(Object.keys(attrMap).length > 0 ? { attributes: attrMap } : {}),
					...(metadata ? { metadata } : {}),
					...(parentKeys.length === 1 && hierarchySpec?.mode !== "DAG"
						? { parentKey: parentKeys[0] }
						: parentKeys.length > 0
							? { parentKeys }
							: {}),
				});
			}

			tableSpecs.push({
				identifier: table.identifier,
				...(table.description ? { description: table.description } : {}),
				...(hierarchySpec ? { hierarchy: hierarchySpec } : {}),
				...(attrSpecs.length > 0 ? { attributes: attrSpecs } : {}),
				...(docSpecs ? { docs: docSpecs } : {}),
				...(nodeSpecs.length > 0 ? { nodes: nodeSpecs } : {}),
			});
		}

		const crossRelations: IaRelationSpec[] = [];
		for (const rel of exportedRelations) {
			const key = `${rel.sourceNodeId}|${rel.targetNodeId}|${rel.relationType}`;
			if (consumedAsHierarchy.has(key)) continue;
			const sourceKey = nodeKeyById.get(rel.sourceNodeId);
			const targetKey = nodeKeyById.get(rel.targetNodeId);
			if (!sourceKey || !targetKey) continue;
			usedRelationTypes.add(rel.relationType);
			const tableIdentifier = tableIdToIdentifier.get(rel.tableId);
			crossRelations.push({
				sourceKey,
				targetKey,
				relationType: rel.relationType,
				...(tableIdentifier ? { tableIdentifier } : {}),
				strength: rel.strength,
				confidence: rel.confidence,
				...(rel.properties ? { properties: rel.properties } : {}),
			});
		}

		const relationTypeSpecs: IaRelationTypeSpec[] = [];
		for (const rtMeta of rtById.values()) {
			if (usedRelationTypes.has(rtMeta.identifier)) {
				relationTypeSpecs.push(rtMeta);
			}
		}
		relationTypeSpecs.sort((a, b) => a.identifier.localeCompare(b.identifier));

		return {
			name: options.name ?? "exported-architecture-v1",
			version: options.version ?? "1.0.0",
			...(options.description ? { description: options.description } : {}),
			relationTypes: relationTypeSpecs,
			tables: tableSpecs,
			...(crossRelations.length > 0 ? { relations: crossRelations } : {}),
		};
	}

	async getTableColumns(tableIdentifier: string): Promise<TableColumnProfile> {
		const table =
			await this.deps.tableRepository.findByIdentifier(tableIdentifier);
		if (!table) {
			throw new NotFoundException(`Table '${tableIdentifier}' not found`);
		}
		const tableId = String(table.id);
		const attrs = await loadTableAttrsList(this.deps, tableId);
		return resolveTableColumnSchema(tableId, attrs, table.identifier);
	}

	async configureColumn(
		tableIdentifier: string,
		attributeIdentifier: string,
		options: ColumnConfig,
	): Promise<TableColumnSummary> {
		validateColumnConfig(options);
		const table =
			await this.deps.tableRepository.findByIdentifier(tableIdentifier);
		if (!table) {
			throw new NotFoundException(`Table '${tableIdentifier}' not found`);
		}
		const tableId = String(table.id);
		const existing =
			await this.deps.attributeRepository.findByTableIdAndIdentifier(
				tableId,
				attributeIdentifier,
			);
		if (!existing) {
			throw new NotFoundException(
				`Attribute '${attributeIdentifier}' not found on table '${tableIdentifier}'`,
			);
		}

		const merged = mergeColumnConfigIntoMetadata(
			existing.getParsedMetadata(),
			options,
		);
		const updated = await this.deps.attributeRepository.update(
			existing.getId(),
			{
				metadata: merged ? JSON.stringify(merged) : null,
			},
		);

		if (this.deps.schemaLifecycle) {
			await this.deps.schemaLifecycle.onTableSchemaChanged(
				tableId,
				"ia.configureColumn",
			);
		} else {
			TableSchemaProjectionService.clearCache(tableId);
		}

		return {
			id: String(updated.getId()),
			identifier: updated.getIdentifier(),
			name: updated.getName(),
			description: updated.getDescription(),
			attributeTypeId: String(updated.getAttributeTypeId()),
			isRequired: updated.getIsRequired(),
			config: extractColumnConfig(updated.getParsedMetadata()) ?? {},
		};
	}

	private async computeNodeDiffFields(
		existing: Node,
		tableId: string,
		key: string,
		spec: IaNodeSpec,
		attrIdByIdentifier: Map<string, string>,
	): Promise<string[]> {
		const diffs: string[] = [];
		const sanitizedContent = sanitizeTextContent(spec.content) ?? spec.content;
		if (existing.getContent() !== sanitizedContent) diffs.push("content");

		if (spec.title !== undefined) {
			const expectedTitle = sanitizeTextContent(spec.title) ?? null;
			if (existing.getTitle() !== expectedTitle) diffs.push("title");
		}
		if (spec.description !== undefined) {
			const expectedDesc = sanitizeTextContent(spec.description) ?? null;
			if (existing.getDescription() !== expectedDesc) diffs.push("description");
		}
		if (extractIaKey(existing) !== key) {
			diffs.push("metadata");
		}

		if (spec.attributes && Object.keys(spec.attributes).length > 0) {
			const tableAttrs = await loadTableAttrsList(this.deps, tableId);
			const currentAttrs = await loadNodeAttributesMap(
				this.deps,
				String(existing.getId()),
				tableAttrs,
			);
			for (const [attrIdent, rawVal] of Object.entries(spec.attributes)) {
				if (!attrIdByIdentifier.has(attrIdent)) continue;
				const desired = serializeAttrValue(rawVal);
				const actual =
					currentAttrs[attrIdent] === undefined ||
					currentAttrs[attrIdent] === null
						? undefined
						: serializeAttrValue(currentAttrs[attrIdent]);
				if (actual !== desired) {
					diffs.push("attributes");
					break;
				}
			}
		}

		return diffs;
	}

	private async ensureRelationType(
		identifier: string,
		description?: string,
		category?: string,
	): Promise<string> {
		const existing =
			await this.deps.relationTypeRepository.findByIdentifier(identifier);
		if (existing) return String(existing.getId());

		const rt = RelationType.create(identifier, description, category);
		await this.deps.relationTypeRepository.save(rt);
		const created =
			await this.deps.relationTypeRepository.findByIdentifier(identifier);
		if (!created) {
			throw new Error(`Failed to persist relation type '${identifier}'`);
		}
		return String(created.getId());
	}

	private async ensureTable(identifier: string, description?: string) {
		const existing =
			await this.deps.tableRepository.findByIdentifier(identifier);
		if (existing) return existing;
		const res = await this.deps.createTableUseCase.execute({
			identifier,
			description,
		});
		return res.table;
	}

	private async ensureAttribute(
		tableId: string,
		spec: IaAttributeSpec,
		updateExistingColumns = false,
	): Promise<string> {
		if (spec.options) {
			validateColumnConfig(spec.options);
		}
		const existing =
			await this.deps.attributeRepository.findByTableIdAndIdentifier(
				tableId,
				spec.identifier,
			);
		if (existing) {
			if (updateExistingColumns && spec.options !== undefined) {
				const currentOpts = extractColumnConfig(existing.getParsedMetadata());
				if (
					canonicalJson(currentOpts ?? null) !==
					canonicalJson(spec.options ?? null)
				) {
					const merged = mergeColumnConfigIntoMetadata(
						spec.metadata ?? existing.getParsedMetadata(),
						spec.options,
					);
					await this.deps.attributeRepository.update(existing.getId(), {
						metadata: merged ? JSON.stringify(merged) : null,
					});
					if (this.deps.schemaLifecycle) {
						await this.deps.schemaLifecycle.onTableSchemaChanged(
							tableId,
							"ia.applyBlueprint.updateColumn",
						);
					} else {
						TableSchemaProjectionService.clearCache(tableId);
					}
				}
			}
			return String(existing.getId());
		}

		const attrType = await this.deps.attributeTypeRepository.findByIdentifier(
			spec.typeIdentifier,
		);
		if (!attrType) {
			throw new NotFoundException(
				`Attribute type '${spec.typeIdentifier}' not found`,
			);
		}
		const mergedMetadata = mergeColumnConfigIntoMetadata(
			spec.metadata,
			spec.options,
		);
		const created = await this.deps.createAttributeUseCase.execute({
			tableId,
			identifier: spec.identifier,
			name: spec.name ?? spec.identifier,
			description: spec.description,
			attributeTypeId: String(attrType.getId()),
			isRequired: spec.isRequired ?? false,
			...(mergedMetadata ? { metadata: mergedMetadata } : {}),
		});
		return created.attribute.id;
	}

	private async ensureDoc(tableId: string, spec: IaDocSpec): Promise<void> {
		const category = spec.category as DocCategory;
		const version = spec.version ?? 1;
		const existing =
			await this.deps.docRepository.findVersionsByTableAndCategory(
				tableId,
				category,
			);
		if (existing.some((d) => d.version === version)) return;
		await this.deps.createDocUseCase.execute({
			tableId,
			category,
			content: spec.content,
			version,
		});
	}

	private async ensureNode(
		tableId: string,
		spec: IaNodeSpec,
		key: string,
		attrIdByIdentifier: Map<string, string>,
		columnProfile: TableColumnProfile,
		existingNodesByKey: Map<string, Node>,
		updateExistingNodes: boolean,
	): Promise<{ nodeId: string; updated: boolean }> {
		const sanitizedContent = sanitizeTextContent(spec.content) ?? spec.content;
		const existing =
			existingNodesByKey.get(key) ??
			(await this.deps.nodeRepository.findByTableIdAndContent(
				tableId,
				sanitizedContent,
			));

		const attributes: Record<string, string> = {};
		for (const [attrIdent, rawVal] of Object.entries(spec.attributes ?? {})) {
			if (!attrIdByIdentifier.has(attrIdent)) {
				throw new ValidationException(
					`Unknown attribute '${attrIdent}' in blueprint node '${spec.key ?? spec.content}'`,
				);
			}
			attributes[attrIdent] = serializeAttrValue(rawVal);
		}

		for (const [attrIdent, defVal] of Object.entries(
			columnProfile.defaultValues,
		)) {
			if (attrIdByIdentifier.has(attrIdent) && !(attrIdent in attributes)) {
				attributes[attrIdent] = serializeAttrValue(defVal);
			}
		}

		for (const [attrIdent, val] of Object.entries(attributes)) {
			const allowed = columnProfile.enumConstraints[attrIdent];
			if (allowed && allowed.length > 0 && !allowed.includes(val)) {
				throw new ValidationException(
					`Invalid value '${val}' for column '${attrIdent}'; allowed values: ${allowed.join(", ")}`,
				);
			}
		}

		const mergedMetadata: Record<string, SafeJsonValue> = {
			...(spec.metadata ?? {}),
			iaKey: key,
		};

		if (existing) {
			const existingId = String(existing.getId());
			if (updateExistingNodes && this.deps.updateNodeUseCase) {
				const diffFields = await this.computeNodeDiffFields(
					existing,
					tableId,
					key,
					spec,
					attrIdByIdentifier,
				);
				if (diffFields.length > 0) {
					await this.deps.updateNodeUseCase.execute(existingId, {
						tableId,
						content: spec.content,
						title: spec.title,
						description: spec.description,
						metadata: mergedMetadata,
						attributes:
							Object.keys(attributes).length > 0 ? attributes : undefined,
					});
					return { nodeId: existingId, updated: true };
				}
			}
			return { nodeId: existingId, updated: false };
		}

		const res = await this.deps.createNodeUseCase.execute({
			tableId,
			content: spec.content,
			title: spec.title,
			description: spec.description,
			metadata: mergedMetadata,
			attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
		});
		return { nodeId: res.node.id, updated: false };
	}

	private async ensureRelation(
		tableId: string,
		sourceNodeId: string,
		targetNodeId: string,
		relationTypeIdentifier: string,
		strength: number,
		confidence: number,
		properties?: Record<string, SafeJsonValue>,
	): Promise<boolean> {
		const relationTypeId = await this.ensureRelationType(
			relationTypeIdentifier,
		);
		const { outgoing } = await this.deps.nodeRelationRepository.findByNodeId(
			sourceNodeId,
			{
				limit: 1000,
				offset: 0,
			},
		);
		const duplicate = outgoing.some(
			(rel) =>
				String(rel.getTargetNodeId()) === targetNodeId &&
				String(rel.getRelationTypeId()) === relationTypeId,
		);
		if (duplicate) return false;

		await this.deps.createRelationUseCase.execute({
			tableId,
			sourceNodeId,
			targetNodeId,
			relationTypeId,
			strength,
			confidence,
			properties: properties ?? null,
		});
		return true;
	}
}
