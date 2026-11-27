import type { HierarchyEntryDto } from "@/application/services/GraphHierarchyService.js";
import {
	type GraphTraversalService,
	resolveRelationTypeRefs,
	type TraversalDirection,
} from "@/application/services/GraphTraversalService.js";
import type {
	IaBreadcrumbSummary,
	IaContextPackInput,
	IaContextPackItem,
	IaContextPackResult,
	IaFacetBucket,
	IaOutlineNode,
	IaOutlineOptions,
	IaOutlineResult,
	IaPathMatch,
	IaPathQueryInput,
	IaPathQueryResult,
	IaPathStep,
	IaStructuredHit,
	IaStructuredQuery,
	IaStructuredQueryResult,
	InformationArchitectureDeps,
} from "@/application/services/InformationArchitectureTypes.js";
import type { Node } from "@/domain/entities/Node.js";
import {
	NotFoundException,
	ValidationException,
} from "@/shared/exceptions/DomainException.js";
import type { IaBlueprintManager } from "./IaBlueprintManager.js";
import {
	collectFilteredNodeIds,
	emptyStructuredResult,
	extractIaKey,
	loadNodeAttributesMap,
	loadTableAttrsList,
	serializeAttrValue,
} from "./IaSharedHelpers.js";

export class IaQueryEngine {
	constructor(
		private readonly deps: InformationArchitectureDeps,
		private readonly graphTraversal: GraphTraversalService,
		private readonly blueprints: IaBlueprintManager,
	) {}

	async queryStructured(
		query: IaStructuredQuery,
	): Promise<IaStructuredQueryResult> {
		const table = await this.deps.tableRepository.findByIdentifier(
			query.tableIdentifier,
		);
		if (!table) {
			throw new NotFoundException(`Table '${query.tableIdentifier}' not found`);
		}
		const tableId = String(table.id);

		let scopedRootId: string | undefined;
		if (query.underNodeId) {
			scopedRootId = query.underNodeId;
		} else if (query.underNodeKey) {
			scopedRootId = await this.blueprints.resolveNodeIdByKey(
				query.underNodeKey,
			);
			if (!scopedRootId) {
				throw new NotFoundException(`Unknown node key '${query.underNodeKey}'`);
			}
		}

		let graphFilter:
			| {
					anchorNodeIds: string[];
					maxDepth: number;
					direction: TraversalDirection;
					relationTypes?: string[];
					includeAnchors: boolean;
			  }
			| undefined;
		let subtreeCandidateCount: number | undefined;
		const scopedTaxonomyIds = new Set<string>();
		let scopedHierarchyRel = query.hierarchyRelationType ?? "parentOf";

		if (query.scopedByRelation) {
			const scope = query.scopedByRelation;
			let taxonomyRootId = scope.rootNodeId;
			if (!taxonomyRootId && scope.rootNodeKey) {
				taxonomyRootId = await this.blueprints.resolveNodeIdByKey(
					scope.rootNodeKey,
				);
				if (!taxonomyRootId) {
					throw new NotFoundException(
						`Unknown scopedByRelation rootNodeKey '${scope.rootNodeKey}'`,
					);
				}
			}
			if (!taxonomyRootId) {
				throw new ValidationException(
					"scopedByRelation requires either rootNodeId or rootNodeKey",
				);
			}
			scopedRootId = scopedRootId ?? taxonomyRootId;
			scopedHierarchyRel = scope.hierarchyRelationType ?? "parentOf";
			const maxDepth = scope.maxHierarchyDepth ?? 16;
			const descendants = await this.deps.hierarchyService.getDescendants(
				taxonomyRootId,
				scopedHierarchyRel,
				maxDepth,
			);
			const taxonomyIds = [
				...(scope.includeRoot !== false ? [taxonomyRootId] : []),
				...descendants.entries.map((entry: HierarchyEntryDto) => entry.node.id),
			];
			for (const id of taxonomyIds) {
				scopedTaxonomyIds.add(id);
			}
			subtreeCandidateCount = taxonomyIds.length;
			if (taxonomyIds.length === 0) {
				return emptyStructuredResult(
					tableId,
					query.tableIdentifier,
					scopedRootId,
					0,
				);
			}
			graphFilter = {
				anchorNodeIds: taxonomyIds,
				maxDepth: 1,
				direction: scope.linkDirection ?? "OUTGOING",
				relationTypes: [scope.linkRelationType],
				includeAnchors: false,
			};
		} else if (scopedRootId) {
			const hierarchyRel = query.hierarchyRelationType ?? "parentOf";
			const maxDepth = query.maxHierarchyDepth ?? 16;
			const descendants = await this.deps.hierarchyService.getDescendants(
				scopedRootId,
				hierarchyRel,
				maxDepth,
			);
			const subtreeIds = [
				...(query.includeRoot !== false ? [scopedRootId] : []),
				...descendants.entries.map((entry: HierarchyEntryDto) => entry.node.id),
			];
			subtreeCandidateCount = subtreeIds.length;
			if (subtreeIds.length === 0) {
				return emptyStructuredResult(
					tableId,
					query.tableIdentifier,
					scopedRootId,
					0,
				);
			}
			graphFilter = {
				anchorNodeIds: [scopedRootId],
				maxDepth,
				direction: "OUTGOING",
				relationTypes: [hierarchyRel],
				includeAnchors: query.includeRoot !== false,
			};
		}

		const hybridResult = await this.deps.hybridSearchNodesUseCase.execute({
			tableId,
			textQuery: query.textQuery,
			vector: query.vector,
			model: query.model,
			filterQuery: query.filterQuery,
			graph: graphFilter,
			weights: query.weights,
			limit: Math.min(200, query.limit ?? 20),
			offset: query.offset ?? 0,
		});

		const facets: Record<string, IaFacetBucket[]> = {};
		const facetFields =
			query.facets === "auto"
				? (await this.blueprints.getTableColumns(query.tableIdentifier))
						.facetableColumns
				: (query.facets ?? []);
		if (facetFields.length > 0) {
			const counts = new Map<string, Map<string, number>>();
			for (const facetAttr of facetFields) {
				counts.set(facetAttr, new Map());
			}
			for (const hit of hybridResult.results) {
				const attrs = (hit.node.attributes ?? {}) as Record<string, unknown>;
				for (const facetAttr of facetFields) {
					const val = attrs[facetAttr];
					if (val === undefined || val === null) continue;
					const bucketMap = counts.get(facetAttr);
					if (!bucketMap) continue;
					const key = serializeAttrValue(val);
					bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
				}
			}
			for (const [facetAttr, bucketMap] of counts) {
				facets[facetAttr] = [...bucketMap.entries()]
					.map(([value, count]) => ({ value, count }))
					.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
			}
		}

		const relFilterTypes = query.includeRelated?.relationTypes
			? (
					await resolveRelationTypeRefs(
						this.deps.relationTypeRepository,
						query.includeRelated.relationTypes,
					)
				)?.ids
			: undefined;

		const linkRelationTypeIds = query.scopedByRelation
			? (
					await resolveRelationTypeRefs(this.deps.relationTypeRepository, [
						query.scopedByRelation.linkRelationType,
					])
				)?.ids
			: undefined;

		const enrichedHits: IaStructuredHit[] = await Promise.all(
			hybridResult.results.map(async (hit) => {
				const nodeEntity = await this.deps.nodeRepository.findById(hit.node.id);
				const enriched: IaStructuredHit = {
					...hit,
					nodeKey: nodeEntity ? extractIaKey(nodeEntity) : null,
				};
				if (query.includeBreadcrumbs) {
					const ancestors = await this.deps.hierarchyService.getAncestors(
						hit.node.id,
						query.hierarchyRelationType ?? "parentOf",
					);
					enriched.breadcrumbs = [
						...ancestors.ancestors.map((a) => ({
							id: a.node.id,
							title: a.node.title ?? null,
							content: a.node.content,
						})),
						{
							id: hit.node.id,
							title: hit.node.title ?? null,
							content: hit.node.content,
						},
					];
				}
				if (
					query.includeTopicBreadcrumbs &&
					query.scopedByRelation &&
					linkRelationTypeIds
				) {
					const { incoming, outgoing } =
						await this.deps.nodeRelationRepository.findByNodeId(hit.node.id, {
							limit: 200,
							offset: 0,
						});
					const linkRtSet = new Set(linkRelationTypeIds);
					const attachedIds: string[] = [];
					for (const rel of incoming) {
						if (!linkRtSet.has(String(rel.getRelationTypeId()))) continue;
						const src = rel.getSourceNodeId();
						if (
							src &&
							(scopedTaxonomyIds.size === 0 ||
								scopedTaxonomyIds.has(String(src)))
						) {
							attachedIds.push(String(src));
						}
					}
					for (const rel of outgoing) {
						if (!linkRtSet.has(String(rel.getRelationTypeId()))) continue;
						const dst = rel.getTargetNodeId();
						if (
							dst &&
							(scopedTaxonomyIds.size === 0 ||
								scopedTaxonomyIds.has(String(dst)))
						) {
							attachedIds.push(String(dst));
						}
					}
					const primaryTopicId = attachedIds[0];
					if (primaryTopicId) {
						const topicEntity =
							await this.deps.nodeRepository.findById(primaryTopicId);
						const topicAncestors =
							await this.deps.hierarchyService.getAncestors(
								primaryTopicId,
								scopedHierarchyRel,
							);
						const crumbs: IaBreadcrumbSummary[] = [];
						for (const a of topicAncestors.ancestors) {
							const ent = await this.deps.nodeRepository.findById(a.node.id);
							crumbs.push({
								id: a.node.id,
								key: ent ? extractIaKey(ent) : null,
								title: a.node.title ?? null,
								content: a.node.content,
							});
						}
						if (topicEntity) {
							crumbs.push({
								id: primaryTopicId,
								key: extractIaKey(topicEntity),
								title: topicEntity.getTitle(),
								content: topicEntity.getContent(),
							});
						}
						enriched.topicBreadcrumbs = crumbs;
					}
				}
				if (query.includeRelated) {
					const relatedNodes = await this.graphTraversal.connectedNodes(
						hit.node.id,
						query.includeRelated.maxDepth ?? 1,
						query.includeRelated.direction ?? "OUTGOING",
						relFilterTypes,
					);
					enriched.related = relatedNodes
						.filter((n) => String(n.getId()) !== hit.node.id)
						.map((n) => ({
							id: String(n.getId()),
							tableId: String(n.getTableId()),
							title: n.getTitle(),
							content: n.getContent(),
						}));
				}
				return enriched;
			}),
		);

		return {
			tableId,
			tableIdentifier: query.tableIdentifier,
			...(scopedRootId ? { scopedRootId } : {}),
			hits: enrichedHits,
			total: hybridResult.total,
			hasMore: hybridResult.hasMore,
			facets,
			metrics: {
				...hybridResult.metrics,
				...(subtreeCandidateCount !== undefined
					? { subtreeCandidateCount }
					: {}),
			},
		};
	}

	async getOutline(options: IaOutlineOptions): Promise<IaOutlineResult> {
		const table = await this.deps.tableRepository.findByIdentifier(
			options.tableIdentifier,
		);
		if (!table) {
			throw new NotFoundException(
				`Table '${options.tableIdentifier}' not found`,
			);
		}
		const tableId = String(table.id);
		const relationType = options.relationType ?? "parentOf";
		const maxDepth = Math.max(0, options.maxDepth ?? 16);
		const includeAttributes = options.includeAttributes !== false;

		let explicitRootId = options.rootNodeId;
		if (!explicitRootId && options.rootNodeKey) {
			explicitRootId = await this.blueprints.resolveNodeIdByKey(
				options.rootNodeKey,
			);
			if (!explicitRootId) {
				throw new NotFoundException(
					`Unknown rootNodeKey '${options.rootNodeKey}'`,
				);
			}
		}

		const [nodesPage, attrsPage, hierarchyRtResolved, linkedRtsResolved] =
			await Promise.all([
				this.deps.nodeRepository.findByTableId(tableId, {
					limit: 5000,
					offset: 0,
				}),
				includeAttributes
					? this.deps.attributeRepository.findByTableId(tableId, {
							limit: 500,
							offset: 0,
						})
					: Promise.resolve(null),
				resolveRelationTypeRefs(this.deps.relationTypeRepository, [
					relationType,
				]),
				options.countLinkedRelationTypes &&
				options.countLinkedRelationTypes.length > 0
					? resolveRelationTypeRefs(
							this.deps.relationTypeRepository,
							options.countLinkedRelationTypes,
						)
					: Promise.resolve(null),
			]);

		const tableNodes = nodesPage.data ?? nodesPage.nodes ?? [];
		const nodeById = new Map<string, Node>();
		for (const node of tableNodes) {
			nodeById.set(String(node.getId()), node);
		}

		const tableAttrs = attrsPage
			? (attrsPage.data ?? attrsPage.nodes ?? [])
			: [];
		const hierarchyRtId = hierarchyRtResolved?.ids[0];

		const linkedIdToName = new Map<string, string>();
		if (options.countLinkedRelationTypes && linkedRtsResolved) {
			for (const rtName of options.countLinkedRelationTypes) {
				const rtEntity =
					await this.deps.relationTypeRepository.findByIdentifier(rtName);
				if (rtEntity) {
					linkedIdToName.set(
						String(rtEntity.getId()),
						rtEntity.getIdentifier(),
					);
				}
			}
		}

		const childrenMap = new Map<string, Set<string>>();
		const inDegree = new Map<string, number>();
		const linkedCountsMap = new Map<string, Record<string, number>>();

		for (const node of tableNodes) {
			const nid = String(node.getId());
			inDegree.set(nid, 0);
			childrenMap.set(nid, new Set());
			const initLinked: Record<string, number> = {};
			for (const name of options.countLinkedRelationTypes ?? []) {
				initLinked[name] = 0;
			}
			linkedCountsMap.set(nid, initLinked);
		}

		for (const node of tableNodes) {
			const nid = String(node.getId());
			const { incoming, outgoing } =
				await this.deps.nodeRelationRepository.findByNodeId(nid, {
					limit: 2000,
					offset: 0,
				});

			for (const rel of outgoing) {
				const rtId = String(rel.getRelationTypeId());
				const targetId = rel.getTargetNodeId()
					? String(rel.getTargetNodeId())
					: null;
				if (
					hierarchyRtId &&
					rtId === hierarchyRtId &&
					targetId &&
					nodeById.has(targetId) &&
					targetId !== nid
				) {
					const children = childrenMap.get(nid);
					if (children && !children.has(targetId)) {
						children.add(targetId);
						inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
					}
				}
				const linkedName = linkedIdToName.get(rtId);
				if (linkedName && targetId && targetId !== nid) {
					const counts = linkedCountsMap.get(nid);
					if (counts) counts[linkedName] = (counts[linkedName] ?? 0) + 1;
				}
			}

			for (const rel of incoming) {
				const rtId = String(rel.getRelationTypeId());
				const sourceId = rel.getSourceNodeId()
					? String(rel.getSourceNodeId())
					: null;
				const linkedName = linkedIdToName.get(rtId);
				if (linkedName && sourceId && sourceId !== nid) {
					const counts = linkedCountsMap.get(nid);
					if (counts) counts[linkedName] = (counts[linkedName] ?? 0) + 1;
				}
			}
		}

		const rootIds: string[] = explicitRootId
			? nodeById.has(explicitRootId)
				? [explicitRootId]
				: []
			: [...nodeById.keys()].filter((id) => (inDegree.get(id) ?? 0) === 0);

		const sortIds = (ids: string[]) =>
			[...ids].sort((a, b) => {
				const na = nodeById.get(a);
				const nb = nodeById.get(b);
				const la = na ? (na.getTitle() ?? na.getContent()) : a;
				const lb = nb ? (nb.getTitle() ?? nb.getContent()) : b;
				return la.localeCompare(lb) || a.localeCompare(b);
			});

		let maxDepthReached = 0;
		const seenTotal = new Set<string>();
		const mdLines: string[] = [];

		const buildTree = async (
			nodeId: string,
			depth: number,
			pathIds: string[],
			pathTitles: string[],
			ancestorsOnPath: Set<string>,
		): Promise<IaOutlineNode | null> => {
			const entity = nodeById.get(nodeId);
			if (!entity) return null;
			seenTotal.add(nodeId);
			if (depth > maxDepthReached) maxDepthReached = depth;

			const key = extractIaKey(entity);
			const label = entity.getTitle() ?? entity.getContent();
			const nextPathIds = [...pathIds, nodeId];
			const nextPathTitles = [...pathTitles, label];
			const linkedCounts = linkedCountsMap.get(nodeId) ?? {};

			const linkedSummary = Object.entries(linkedCounts)
				.filter(([, count]) => count > 0)
				.map(([name, count]) => `${name}:${count}`)
				.join(", ");
			const keyBadge = key ? ` (\`${key}\`)` : "";
			const linkedSuffix = linkedSummary ? ` [${linkedSummary}]` : "";
			mdLines.push(`${"  ".repeat(depth)}- ${label}${keyBadge}${linkedSuffix}`);

			const childNodes: IaOutlineNode[] = [];
			let subtreeNodeCount = 1;
			if (depth < maxDepth) {
				const nextAncestors = new Set(ancestorsOnPath);
				nextAncestors.add(nodeId);
				const sortedChildren = sortIds([...(childrenMap.get(nodeId) ?? [])]);
				for (const childId of sortedChildren) {
					if (nextAncestors.has(childId)) continue;
					const childTree = await buildTree(
						childId,
						depth + 1,
						nextPathIds,
						nextPathTitles,
						nextAncestors,
					);
					if (childTree) {
						childNodes.push(childTree);
						subtreeNodeCount += childTree.subtreeNodeCount;
					}
				}
			}

			const attrs = includeAttributes
				? await loadNodeAttributesMap(this.deps, nodeId, tableAttrs)
				: undefined;

			return {
				id: nodeId,
				key,
				title: entity.getTitle(),
				content: entity.getContent(),
				depth,
				childCount: childNodes.length,
				subtreeNodeCount,
				linkedCounts,
				pathIds: nextPathIds,
				pathTitles: nextPathTitles,
				...(attrs !== undefined ? { attributes: attrs } : {}),
				children: childNodes,
			};
		};

		const roots: IaOutlineNode[] = [];
		for (const rootId of sortIds(rootIds)) {
			const built = await buildTree(rootId, 0, [], [], new Set());
			if (built) roots.push(built);
		}

		return {
			tableId,
			tableIdentifier: options.tableIdentifier,
			relationType,
			totalNodes: seenTotal.size,
			maxDepthReached,
			roots,
			markdown: mdLines.join("\n"),
		};
	}

	async queryPath(input: IaPathQueryInput): Promise<IaPathQueryResult> {
		if (!Array.isArray(input.hops) || input.hops.length === 0) {
			throw new ValidationException(
				"queryPath requires at least one hop specification",
			);
		}
		const limit = Math.max(1, Math.min(200, input.limit ?? 50));

		const tablesPage = await this.deps.tableRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const tableIdentifierById = new Map<string, string>();
		const tableIdByIdentifier = new Map<string, string>();
		for (const t of tablesPage.data ?? tablesPage.nodes ?? []) {
			const tid = String(t.id);
			tableIdentifierById.set(tid, t.identifier);
			tableIdByIdentifier.set(t.identifier, tid);
		}

		const rtPage = await this.deps.relationTypeRepository.findAll({
			limit: 500,
			offset: 0,
		});
		const rtIdentifierById = new Map<string, string>();
		for (const rt of rtPage.data ?? rtPage.nodes ?? []) {
			rtIdentifierById.set(String(rt.getId()), rt.getIdentifier());
		}

		const nodeCache = new Map<string, Node>();
		const loadNode = async (id: string): Promise<Node | null> => {
			const hit = nodeCache.get(id);
			if (hit) return hit;
			const fetched = await this.deps.nodeRepository.findById(id);
			if (fetched) nodeCache.set(id, fetched);
			return fetched;
		};

		const toStep = async (
			nodeId: string,
			hopIndex: number,
			viaRelationType: string | null,
		): Promise<IaPathStep | null> => {
			const entity = await loadNode(nodeId);
			if (!entity) return null;
			const tid = String(entity.getTableId());
			return {
				hopIndex,
				viaRelationType,
				nodeId,
				key: extractIaKey(entity),
				tableId: tid,
				tableIdentifier: tableIdentifierById.get(tid) ?? tid,
				title: entity.getTitle(),
				content: entity.getContent(),
			};
		};

		let frontier = new Map<string, IaPathStep[]>();
		const seedIds = new Set<string>(input.startNodeIds ?? []);
		for (const key of input.startNodeKeys ?? []) {
			const id = await this.blueprints.resolveNodeIdByKey(key);
			if (!id) {
				throw new NotFoundException(`Unknown startNodeKey '${key}'`);
			}
			seedIds.add(id);
		}

		if (input.startTableIdentifier) {
			const startTableId = tableIdByIdentifier.get(input.startTableIdentifier);
			if (!startTableId) {
				throw new NotFoundException(
					`Unknown startTableIdentifier '${input.startTableIdentifier}'`,
				);
			}
			if (input.startFilterQuery?.trim()) {
				const filteredIds = await collectFilteredNodeIds(
					this.deps,
					startTableId,
					input.startFilterQuery,
				);
				if (seedIds.size > 0) {
					for (const id of [...seedIds]) {
						if (!filteredIds.has(id)) seedIds.delete(id);
					}
				} else {
					for (const id of filteredIds) seedIds.add(id);
				}
			} else if (seedIds.size === 0) {
				const page = await this.deps.nodeRepository.findByTableId(
					startTableId,
					{
						limit: 5000,
						offset: 0,
					},
				);
				for (const n of page.data ?? page.nodes ?? []) {
					seedIds.add(String(n.getId()));
				}
			}
		}

		for (const id of seedIds) {
			const step = await toStep(id, -1, null);
			if (step) frontier.set(id, [step]);
		}

		const startCount = frontier.size;
		const hopCounts: number[] = [];

		for (let hopIndex = 0; hopIndex < input.hops.length; hopIndex += 1) {
			const hop = input.hops[hopIndex];
			if (!hop || frontier.size === 0) {
				hopCounts.push(0);
				frontier = new Map();
				continue;
			}

			const rtResolved = await resolveRelationTypeRefs(
				this.deps.relationTypeRepository,
				hop.relationTypes,
			);
			const rtIdSet = new Set(rtResolved?.ids ?? []);
			const minDepth = Math.max(0, hop.minDepth ?? 1);
			const maxDepth = Math.max(minDepth, hop.maxDepth ?? 1);
			const direction: TraversalDirection = hop.direction ?? "OUTGOING";

			const reachedAtHop = new Map<string, IaPathStep[]>();
			const bfsQueue: Array<{
				nodeId: string;
				depth: number;
				steps: IaPathStep[];
			}> = [];
			const visitedInHop = new Set<string>();

			for (const [nodeId, steps] of frontier) {
				visitedInHop.add(nodeId);
				bfsQueue.push({ nodeId, depth: 0, steps });
				if (minDepth === 0) {
					reachedAtHop.set(nodeId, steps);
				}
			}

			let cursor = 0;
			while (cursor < bfsQueue.length) {
				const item = bfsQueue[cursor];
				cursor += 1;
				if (!item || item.depth >= maxDepth) continue;

				const { incoming, outgoing } =
					await this.deps.nodeRelationRepository.findByNodeId(item.nodeId, {
						limit: 2000,
						offset: 0,
					});

				const neighbors: Array<{ nextId: string; relName: string }> = [];
				if (direction === "OUTGOING" || direction === "BOTH") {
					for (const rel of outgoing) {
						const rtId = String(rel.getRelationTypeId());
						if (rtIdSet.size > 0 && !rtIdSet.has(rtId)) continue;
						const targetId = rel.getTargetNodeId();
						if (targetId) {
							neighbors.push({
								nextId: String(targetId),
								relName: rtIdentifierById.get(rtId) ?? rtId,
							});
						}
					}
				}
				if (direction === "INCOMING" || direction === "BOTH") {
					for (const rel of incoming) {
						const rtId = String(rel.getRelationTypeId());
						if (rtIdSet.size > 0 && !rtIdSet.has(rtId)) continue;
						const sourceId = rel.getSourceNodeId();
						if (sourceId) {
							neighbors.push({
								nextId: String(sourceId),
								relName: rtIdentifierById.get(rtId) ?? rtId,
							});
						}
					}
				}

				const nextDepth = item.depth + 1;
				for (const neighbor of neighbors) {
					if (visitedInHop.has(neighbor.nextId)) continue;
					visitedInHop.add(neighbor.nextId);
					const step = await toStep(
						neighbor.nextId,
						hopIndex,
						neighbor.relName,
					);
					if (!step) continue;
					const nextSteps = [...item.steps, step];
					bfsQueue.push({
						nodeId: neighbor.nextId,
						depth: nextDepth,
						steps: nextSteps,
					});
					if (
						nextDepth >= minDepth &&
						nextDepth <= maxDepth &&
						!reachedAtHop.has(neighbor.nextId)
					) {
						reachedAtHop.set(neighbor.nextId, nextSteps);
					}
				}
			}

			let targetTableId: string | undefined;
			if (hop.targetTableIdentifier) {
				targetTableId = tableIdByIdentifier.get(hop.targetTableIdentifier);
				if (!targetTableId) {
					throw new NotFoundException(
						`Unknown targetTableIdentifier '${hop.targetTableIdentifier}'`,
					);
				}
			}

			const nextFrontier = new Map<string, IaPathStep[]>();
			const candidateIdsByTable = new Map<string, Set<string>>();

			for (const [nodeId, steps] of reachedAtHop) {
				const ent = await loadNode(nodeId);
				if (!ent) continue;
				const tid = String(ent.getTableId());
				if (targetTableId && tid !== targetTableId) continue;
				let set = candidateIdsByTable.get(tid);
				if (!set) {
					set = new Set<string>();
					candidateIdsByTable.set(tid, set);
				}
				set.add(nodeId);
				nextFrontier.set(nodeId, steps);
			}

			if (hop.filterQuery?.trim() && nextFrontier.size > 0) {
				const allowedIds = new Set<string>();
				for (const tid of candidateIdsByTable.keys()) {
					const tableMatched = await collectFilteredNodeIds(
						this.deps,
						tid,
						hop.filterQuery,
					);
					for (const id of tableMatched) {
						allowedIds.add(id);
					}
				}
				for (const id of [...nextFrontier.keys()]) {
					if (!allowedIds.has(id)) nextFrontier.delete(id);
				}
			}

			frontier = nextFrontier;
			hopCounts.push(frontier.size);
		}

		const attrDefsCache = new Map<
			string,
			Awaited<ReturnType<typeof loadTableAttrsList>>
		>();
		const matches: IaPathMatch[] = [];

		const materialized: Array<{ entity: Node; steps: IaPathStep[] }> = [];
		for (const [nodeId, steps] of frontier) {
			const entity = await loadNode(nodeId);
			if (entity) materialized.push({ entity, steps });
		}
		materialized.sort((a, b) => {
			const la = a.entity.getTitle() ?? a.entity.getContent();
			const lb = b.entity.getTitle() ?? b.entity.getContent();
			return (
				la.localeCompare(lb) ||
				String(a.entity.getId()).localeCompare(String(b.entity.getId()))
			);
		});

		for (const { entity, steps } of materialized.slice(0, limit)) {
			const nid = String(entity.getId());
			const tid = String(entity.getTableId());
			let attrDefs = attrDefsCache.get(tid);
			if (!attrDefs) {
				attrDefs = await loadTableAttrsList(this.deps, tid);
				attrDefsCache.set(tid, attrDefs);
			}
			const attrs = await loadNodeAttributesMap(this.deps, nid, attrDefs);
			matches.push({
				node: {
					id: nid,
					key: extractIaKey(entity),
					tableId: tid,
					tableIdentifier: tableIdentifierById.get(tid) ?? tid,
					title: entity.getTitle(),
					content: entity.getContent(),
					attributes: attrs,
				},
				steps,
			});
		}

		return {
			startCount,
			matches,
			hopCounts,
		};
	}

	async assembleContextPack(
		input: IaContextPackInput,
	): Promise<IaContextPackResult> {
		const maxChars = Math.max(256, input.maxChars ?? 8000);

		let outline: IaOutlineResult | undefined;
		if (input.outlineTableIdentifier) {
			outline = await this.getOutline({
				tableIdentifier: input.outlineTableIdentifier,
				rootNodeKey: input.outlineRootKey,
				relationType: input.outlineRelationType ?? "parentOf",
				maxDepth: 6,
				includeAttributes: false,
			});
		}

		const queryRes = await this.queryStructured({
			tableIdentifier: input.tableIdentifier,
			textQuery: input.textQuery,
			filterQuery: input.filterQuery,
			underNodeId: input.underNodeId,
			underNodeKey: input.underNodeKey,
			hierarchyRelationType: input.hierarchyRelationType,
			includeRoot: input.includeRoot,
			scopedByRelation: input.scopedByRelation,
			facets: input.facets,
			includeBreadcrumbs: true,
			includeTopicBreadcrumbs: Boolean(input.scopedByRelation),
			includeRelated:
				input.expandRelationTypes && input.expandRelationTypes.length > 0
					? {
							relationTypes: input.expandRelationTypes,
							direction: input.expandDirection ?? "BOTH",
							maxDepth: 1,
						}
					: undefined,
			limit: input.limit ?? 15,
		});

		const candidateItems: IaContextPackItem[] = [];
		const seenIds = new Set<string>();
		const tableAttrsCache = new Map<
			string,
			Awaited<ReturnType<typeof loadTableAttrsList>>
		>();

		for (const hit of queryRes.hits) {
			if (seenIds.has(hit.node.id)) continue;
			seenIds.add(hit.node.id);
			candidateItems.push({
				id: hit.node.id,
				key: hit.nodeKey ?? null,
				tableId: hit.node.tableId,
				title: hit.node.title ?? null,
				content: hit.node.content,
				matchedVia: "query",
				...(hit.breadcrumbs ? { breadcrumbs: hit.breadcrumbs } : {}),
				...(hit.topicBreadcrumbs
					? { topicBreadcrumbs: hit.topicBreadcrumbs }
					: {}),
				attributes: (hit.node.attributes ?? {}) as Record<string, unknown>,
			});
		}

		for (const hit of queryRes.hits) {
			for (const rel of hit.related ?? []) {
				if (seenIds.has(rel.id)) continue;
				seenIds.add(rel.id);
				const entity = await this.deps.nodeRepository.findById(rel.id);
				let attrDefs = tableAttrsCache.get(rel.tableId);
				if (!attrDefs) {
					attrDefs = await loadTableAttrsList(this.deps, rel.tableId);
					tableAttrsCache.set(rel.tableId, attrDefs);
				}
				const attrs = await loadNodeAttributesMap(this.deps, rel.id, attrDefs);
				candidateItems.push({
					id: rel.id,
					key: entity ? extractIaKey(entity) : null,
					tableId: rel.tableId,
					title: rel.title,
					content: rel.content,
					matchedVia: "neighbor",
					attributes: attrs,
				});
			}
		}

		const sections: string[] = [];
		let usedChars = 0;
		let truncated = false;

		const appendSection = (block: string): boolean => {
			const separator = sections.length > 0 ? "\n\n" : "";
			if (usedChars + separator.length + block.length > maxChars) {
				return false;
			}
			sections.push(block);
			usedChars += separator.length + block.length;
			return true;
		};

		if (outline && outline.markdown.trim().length > 0) {
			const outlineBlock = `## Outline (${outline.tableIdentifier})\n${outline.markdown}`;
			if (!appendSection(outlineBlock)) {
				truncated = true;
			}
		}

		const facetEntries = Object.entries(queryRes.facets);
		if (facetEntries.length > 0) {
			const facetLines = ["## Facets"];
			for (const [facetName, buckets] of facetEntries) {
				const rendered = buckets
					.map((b) => `${b.value}(${b.count})`)
					.join(", ");
				facetLines.push(`- ${facetName}: ${rendered}`);
			}
			if (!appendSection(facetLines.join("\n"))) {
				truncated = true;
			}
		}

		const columnProfile = await this.blueprints.getTableColumns(
			input.tableIdentifier,
		);
		const columnOrder = new Map<string, number>();
		columnProfile.columns.forEach((col, idx) => {
			columnOrder.set(col.identifier, col.config.displayOrder ?? 10_000 + idx);
		});
		const hiddenColumns = new Set(columnProfile.hiddenColumns);

		const includedItems: IaContextPackItem[] = [];
		const itemLines: string[] = [`## Items (${input.tableIdentifier})`];

		for (const item of candidateItems) {
			const crumb =
				item.topicBreadcrumbs && item.topicBreadcrumbs.length > 0
					? ` | path=${item.topicBreadcrumbs.map((c) => c.title ?? c.content).join(" > ")}`
					: item.breadcrumbs && item.breadcrumbs.length > 1
						? ` | path=${item.breadcrumbs.map((c) => c.title ?? c.content).join(" > ")}`
						: "";
			const attrSummary = Object.entries(item.attributes)
				.filter(([k]) => !hiddenColumns.has(k))
				.sort(
					([a], [b]) =>
						(columnOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
							(columnOrder.get(b) ?? Number.MAX_SAFE_INTEGER) ||
						a.localeCompare(b),
				)
				.map(([k, v]) => `${k}=${serializeAttrValue(v)}`)
				.join(", ");
			const header = `- [${item.matchedVia}] ${item.title ?? item.id}${item.key ? ` (\`${item.key}\`)` : ""}${crumb}${attrSummary ? ` | ${attrSummary}` : ""}`;
			const block = `${header}\n  ${item.content}`;

			const currentItemsLength = itemLines.join("\n").length;
			const sepCost = sections.length > 0 ? 2 : 0;
			if (
				usedChars + sepCost + currentItemsLength + 1 + block.length >
				maxChars
			) {
				truncated = true;
				break;
			}
			itemLines.push(block);
			includedItems.push(item);
		}

		if (includedItems.length > 0) {
			appendSection(itemLines.join("\n"));
		}

		const markdown = sections.join("\n\n");
		return {
			tableIdentifier: input.tableIdentifier,
			...(outline ? { outline } : {}),
			items: includedItems,
			facets: queryRes.facets,
			totalChars: markdown.length,
			truncated,
			markdown,
		};
	}
}
