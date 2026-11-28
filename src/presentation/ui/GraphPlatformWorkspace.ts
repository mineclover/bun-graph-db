import type { PresetBlueprintName } from "@/application/blueprints/PresetBlueprints.js";
import type {
	MemoryStatsOutput,
	RecalledMemoryHit,
} from "@/application/services/AiMemoryService.js";
import type {
	ArchitectureAuditResult,
	IaOutlineNode,
	IaOutlineResult,
} from "@/application/services/InformationArchitectureTypes.js";
import { AuthoringCommandStack } from "@/presentation/ui/authoring/AuthoringController.js";
import { createDefaultFieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import { UI_VIEWS_TABLE_IDENTIFIER } from "@/presentation/ui/clients/sharedHelpers.js";
import { mountQuickCaptureDialog } from "@/presentation/ui/components/QuickCaptureDialog.js";
import { mountRightInspectorDrawer } from "@/presentation/ui/components/RightInspectorDrawer.js";
import type {
	GraphSubgraph,
	IGraphPlatformClient,
	IVisualizationPlugin,
	PlatformRelation,
	PlatformRelationType,
	PlatformRow,
	PlatformTableSummary,
	SavedViewConfig,
	ViewDataSlice,
	ViewIntent,
	ViewPluginId,
} from "@/presentation/ui/contracts.js";
import { createDefaultViewRegistry } from "@/presentation/ui/views/ViewRegistry.js";

export interface MountGraphPlatformWorkspaceOptions {
	title?: string;
	version?: string;
	initialTable?: string;
	initialView?: ViewPluginId;
	initialSnapshotKey?: string;
}

export interface GraphPlatformWorkspaceHandle {
	refresh(): Promise<void>;
	selectTable(tableIdentifier: string): Promise<void>;
	selectView(viewId: ViewPluginId): void;
	destroy(): void;
}

function installRovingFocusFallback(
	container: HTMLElement,
	selector: string,
	orientation: "horizontal" | "vertical" = "horizontal",
): void {
	if (typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype) {
		return;
	}
	const getItems = (): HTMLElement[] =>
		Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
			(el) => !el.hidden,
		);
	const syncIndices = (): void => {
		const items = getItems();
		const active =
			items.find((el) => el.getAttribute("aria-selected") === "true") ??
			items[0];
		for (const item of items) {
			item.tabIndex = item === active ? 0 : -1;
		}
	};
	syncIndices();
	container.addEventListener("focusin", (event) => {
		const target = event.target as HTMLElement | null;
		const items = getItems();
		if (target && items.includes(target)) {
			for (const item of items) item.tabIndex = item === target ? 0 : -1;
		}
	});
	container.addEventListener("keydown", (event) => {
		const items = getItems();
		if (items.length === 0) return;
		const currentIdx = items.indexOf(document.activeElement as HTMLElement);
		if (currentIdx < 0) return;
		const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
		const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
		let targetIdx = -1;
		if (event.key === nextKey) targetIdx = (currentIdx + 1) % items.length;
		else if (event.key === prevKey)
			targetIdx = (currentIdx - 1 + items.length) % items.length;
		else if (event.key === "Home") targetIdx = 0;
		else if (event.key === "End") targetIdx = items.length - 1;
		if (targetIdx >= 0) {
			event.preventDefault();
			const target = items[targetIdx];
			if (target) {
				target.tabIndex = 0;
				target.focus();
			}
		}
	});
}

function buildFilterQueryFromFacets(facets: Record<string, string>): string | undefined {
	const entries = Object.entries(facets).filter(([, v]) => v.length > 0);
	if (entries.length === 0) return undefined;
	return entries.map(([k, v]) => `${k}:"${v}"`).join(" AND ");
}

export function mountGraphPlatformWorkspace(
	root: HTMLElement,
	client: IGraphPlatformClient,
	options: MountGraphPlatformWorkspaceOptions = {},
): GraphPlatformWorkspaceHandle {
	const editors = createDefaultFieldEditorRegistry();
	const plugins: IVisualizationPlugin[] = createDefaultViewRegistry(editors);
	const commandStack = new AuthoringCommandStack();

	let activeTableIdentifier: string | null = options.initialTable ?? null;
	let activeViewId: ViewPluginId = options.initialView ?? "table";
	let activeSubtreeRootId: string | null = null;
	let activeFacets: Record<string, string> = {};
	let sortColumn: string | null = "id";
	let sortDirection: "ascending" | "descending" = "ascending";
	let searchQuery = "";
	let selectedNodeId: string | null = null;
	let focusGraphNodeId: string | null = null;
	let graphRelationTypes: string[] = [];
	let railCollapsed = false;
	let mountedPlugin: IVisualizationPlugin | null = null;

	// Last fetched slice cache
	let tables: PlatformTableSummary[] = [];
	let currentOutline: IaOutlineResult | undefined;
	let currentTopicOutline: IaOutlineResult | undefined;
	let currentGraph: GraphSubgraph | undefined;
	let currentAudit: ArchitectureAuditResult | undefined;
	let currentMemoryHits: RecalledMemoryHit[] = [];
	let currentMemoryStats: MemoryStatsOutput | undefined;
	let currentRelations: PlatformRelation[] = [];
	let currentRelationTypes: PlatformRelationType[] = [];
	let savedViews: SavedViewConfig[] = [];
	let opsHealth: Record<string, unknown> | undefined;
	let opsMetrics: Record<string, unknown> | undefined;
	let opsAuditLog: Record<string, unknown> | undefined;
	let currentSlice: ViewDataSlice = {
		mode: client.mode,
		table: null,
		tables: [],
		columns: [],
		columnProfile: null,
		rows: [],
		relations: [],
		relationTypes: [],
		facets: {},
		selection: new Set(),
		activeSubtreeRootId: null,
		activeFacets: {},
		sortColumn: "id",
		sortDirection: "ascending",
		searchQuery: "",
	};

	root.replaceChildren();
	const shell = document.createElement("div");
	shell.className = "workspace-shell";

	// 1. Top Command Bar
	const header = document.createElement("header");
	header.className = "top-bar";

	const topLeft = document.createElement("div");
	topLeft.className = "top-bar__left";
	const toggleRailBtn = document.createElement("button");
	toggleRailBtn.type = "button";
	toggleRailBtn.setAttribute("aria-label", "Toggle navigation rail");
	toggleRailBtn.setAttribute("aria-expanded", "true");
	toggleRailBtn.textContent = "☰ Nav";

	const h1 = document.createElement("h1");
	h1.className = "top-bar__title";
	h1.textContent = options.title ?? "Bun Graph DB Platform";
	const verBadge = document.createElement("span");
	verBadge.className = "badge";
	verBadge.textContent = `v${options.version ?? "1.0.0"}`;
	const modeBadge = document.createElement("span");
	modeBadge.className = "badge badge--accent";
	modeBadge.textContent = client.mode;
	h1.append(verBadge, modeBadge);
	topLeft.append(toggleRailBtn, h1);

	const topCenter = document.createElement("div");
	topCenter.className = "top-bar__center";
	const tablist = document.createElement("div");
	tablist.className = "view-tablist";
	tablist.setAttribute("focusgroup", "tablist nomemory");
	tablist.setAttribute("aria-label", "Visualization views");
	const tabButtons = new Map<ViewPluginId, HTMLButtonElement>();
	for (const plugin of plugins) {
		const tab = document.createElement("button");
		tab.type = "button";
		tab.className = "view-tab";
		tab.dataset.viewId = plugin.id;
		tab.textContent = plugin.label;
		tab.setAttribute("aria-selected", plugin.id === activeViewId ? "true" : "false");
		if (plugin.id === activeViewId) tab.setAttribute("focusgroupstart", "");
		tab.addEventListener("click", () => {
			selectView(plugin.id);
		});
		tabButtons.set(plugin.id, tab);
		tablist.append(tab);
	}
	installRovingFocusFallback(tablist, ".view-tab", "horizontal");
	topCenter.append(tablist);

	const topRight = document.createElement("div");
	topRight.className = "top-bar__right";
	const actionToolbar = document.createElement("div");
	actionToolbar.setAttribute("role", "toolbar");
	actionToolbar.setAttribute("focusgroup", "toolbar wrap");
	actionToolbar.setAttribute("aria-label", "Workspace authoring actions");

	const undoGroup = document.createElement("div");
	undoGroup.setAttribute("role", "group");
	undoGroup.setAttribute("aria-label", "History");
	const undoBtn = document.createElement("button");
	undoBtn.type = "button";
	undoBtn.textContent = "Undo";
	const redoBtn = document.createElement("button");
	redoBtn.type = "button";
	redoBtn.textContent = "Redo";
	undoGroup.append(undoBtn, redoBtn);

	const sep1 = document.createElement("span");
	sep1.setAttribute("role", "separator");
	sep1.setAttribute("aria-orientation", "vertical");

	const authorGroup = document.createElement("div");
	authorGroup.setAttribute("role", "group");
	authorGroup.setAttribute("aria-label", "Create and save");
	const newBtn = document.createElement("button");
	newBtn.type = "button";
	newBtn.className = "primary";
	newBtn.textContent = "+ New";
	const saveViewBtn = document.createElement("button");
	saveViewBtn.type = "button";
	saveViewBtn.textContent = "Save View";
	authorGroup.append(newBtn, saveViewBtn);

	actionToolbar.append(undoGroup, sep1, authorGroup);

	if (client.saveSnapshot) {
		const sep2 = document.createElement("span");
		sep2.setAttribute("role", "separator");
		sep2.setAttribute("aria-orientation", "vertical");
		const snapGroup = document.createElement("div");
		snapGroup.setAttribute("role", "group");
		snapGroup.setAttribute("aria-label", "Browser snapshots");
		const saveSnapBtn = document.createElement("button");
		saveSnapBtn.type = "button";
		saveSnapBtn.textContent = "Save Snapshot";
		const restoreSnapBtn = document.createElement("button");
		restoreSnapBtn.type = "button";
		restoreSnapBtn.textContent = "Restore Snapshot";
		saveSnapBtn.addEventListener("click", async () => {
			try {
				const res = await client.saveSnapshot?.(
					options.initialSnapshotKey ?? "latest",
				);
				setStatus(`Saved snapshot '${res?.key}' (${res?.bytes ?? 0} bytes).`);
			} catch (err) {
				setStatus(err instanceof Error ? err.message : String(err), true);
			}
		});
		restoreSnapBtn.addEventListener("click", async () => {
			try {
				await client.restoreSnapshot?.(options.initialSnapshotKey ?? "latest");
				await refresh();
				setStatus("Restored IndexedDB snapshot.");
			} catch (err) {
				setStatus(err instanceof Error ? err.message : String(err), true);
			}
		});
		snapGroup.append(saveSnapBtn, restoreSnapBtn);
		actionToolbar.append(sep2, snapGroup);
	}

	if (client.setAuthToken) {
		const authBtn = document.createElement("button");
		authBtn.type = "button";
		authBtn.setAttribute("popovertarget", "platform-auth-popover");
		authBtn.textContent = "Token";
		actionToolbar.append(authBtn);

		const authPop = document.createElement("div");
		authPop.id = "platform-auth-popover";
		authPop.setAttribute("popover", "auto");
		authPop.className = "platform-popover";
		const authForm = document.createElement("form");
		authForm.className = "form-grid";
		const authLbl = document.createElement("label");
		authLbl.textContent = "Bearer Token (sessionStorage)";
		const authInput = document.createElement("input");
		authInput.type = "password";
		authInput.value = client.getAuthToken?.() ?? "";
		authInput.placeholder = "Paste access token...";
		const applyAuthBtn = document.createElement("button");
		applyAuthBtn.type = "submit";
		applyAuthBtn.className = "primary";
		applyAuthBtn.textContent = "Apply Token";
		authForm.append(authLbl, authInput, applyAuthBtn);
		authForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			client.setAuthToken?.(authInput.value.trim());
			try {
				if (typeof sessionStorage !== "undefined") {
					sessionStorage.setItem("bun_graph_db_token", authInput.value.trim());
				}
			} catch {
				// Ignore sandbox storage errors
			}
			authPop.hidePopover?.();
			await refresh();
			setStatus("Applied Bearer token.");
		});
		authPop.append(authForm);
		shell.append(authPop);
	}

	const refreshBtn = document.createElement("button");
	refreshBtn.type = "button";
	refreshBtn.textContent = "Refresh";
	actionToolbar.append(refreshBtn);
	installRovingFocusFallback(actionToolbar, "button", "horizontal");

	topRight.append(actionToolbar);
	header.append(topLeft, topCenter, topRight);

	// 2. Main 3-Zone Body
	const bodyGrid = document.createElement("div");
	bodyGrid.className = "workspace-body";

	const leftRail = document.createElement("aside");
	leftRail.className = "left-rail";
	leftRail.setAttribute("aria-label", "Tables, Topic Tree, and Saved Views");

	const centerStage = document.createElement("main");
	centerStage.className = "center-stage";

	// Center stage toolbar (search + KPIs)
	const stageToolbar = document.createElement("div");
	stageToolbar.className = "stage-toolbar";
	const searchForm = document.createElement("form");
	searchForm.className = "chip-list";
	const searchInput = document.createElement("input");
	searchInput.type = "search";
	searchInput.placeholder = "Search rows, titles, attributes (Cmd+K for Quick Capture)...";
	searchInput.setAttribute("aria-label", "Search active table");
	searchInput.style.minInlineSize = "240px";
	const searchBtn = document.createElement("button");
	searchBtn.type = "submit";
	searchBtn.textContent = "Search";
	const kpiStrip = document.createElement("div");
	kpiStrip.className = "kpi-strip";
	searchForm.append(searchInput, searchBtn);
	stageToolbar.append(searchForm, kpiStrip);

	const pluginCanvas = document.createElement("section");
	pluginCanvas.className = "stage-canvas";
	pluginCanvas.setAttribute("aria-label", "Active visualization panel");

	const footerBar = document.createElement("div");
	footerBar.className = "status-bar";
	const statusMsg = document.createElement("p");
	statusMsg.className = "status-message";
	statusMsg.setAttribute("role", "status");
	statusMsg.textContent = "Initializing workspace...";
	const footerMeta = document.createElement("span");
	footerMeta.className = "mono muted";
	footerBar.append(statusMsg, footerMeta);

	const rawDetails = document.createElement("details");
	const rawSummary = document.createElement("summary");
	rawSummary.textContent = "Raw Slice Inspector (JSON)";
	const rawPre = document.createElement("pre");
	rawPre.className = "raw-json";
	rawDetails.append(rawSummary, rawPre);

	centerStage.append(stageToolbar, pluginCanvas, footerBar, rawDetails);

	const inspectorEl = document.createElement("aside");
	inspectorEl.className = "inspector-drawer";
	inspectorEl.setAttribute("aria-label", "Node detail and relation composer");
	inspectorEl.hidden = true;

	bodyGrid.append(leftRail, centerStage, inspectorEl);
	shell.append(header, bodyGrid);
	root.append(shell);

	const setStatus = (message: string, isError = false): void => {
		statusMsg.textContent = message;
		statusMsg.classList.toggle("is-error", isError);
	};

	const inspector = mountRightInspectorDrawer(
		inspectorEl,
		editors,
		(intent) => {
			void handleIntent(intent);
		},
		() => {
			selectedNodeId = null;
			bodyGrid.classList.remove("has-inspector");
			inspector.render(null, currentSlice);
			renderActivePlugin();
		},
	);

	const quickCapture = mountQuickCaptureDialog(
		shell,
		client,
		editors,
		async (msg, focusTable) => {
			if (focusTable) activeTableIdentifier = focusTable;
			await refresh();
			setStatus(msg);
		},
		(errMsg) => setStatus(errMsg, true),
	);

	const renderLeftRail = (): void => {
		leftRail.replaceChildren();

		// Tables section
		const tableSec = document.createElement("section");
		const tableTitle = document.createElement("h2");
		tableTitle.className = "rail-section-title";
		tableTitle.textContent = "Tables";
		const tableList = document.createElement("ul");
		tableList.className = "nav-list";

		const visibleTables = tables.filter(
			(t) =>
				t.identifier !== UI_VIEWS_TABLE_IDENTIFIER ||
				activeTableIdentifier === UI_VIEWS_TABLE_IDENTIFIER,
		);
		for (const t of visibleTables) {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = `nav-item-btn${t.identifier === activeTableIdentifier ? " is-active" : ""}`;
			const nameSpan = document.createElement("span");
			nameSpan.textContent = t.identifier;
			const countBadge = document.createElement("span");
			countBadge.className = "badge";
			countBadge.textContent = String(t.nodeCount);
			btn.append(nameSpan, countBadge);
			btn.addEventListener("click", () => {
				void selectTable(t.identifier);
			});
			li.append(btn);
			tableList.append(li);
		}
		tableSec.append(tableTitle, tableList);
		leftRail.append(tableSec);

		// Topic Tree section
		if (currentTopicOutline && currentTopicOutline.roots.length > 0) {
			const topicSec = document.createElement("section");
			const topicTitle = document.createElement("h2");
			topicTitle.className = "rail-section-title";
			topicTitle.textContent = `Topics (${currentTopicOutline.tableIdentifier})`;
			const topicList = document.createElement("ul");
			topicList.className = "nav-list";

			const visitTopic = (node: IaOutlineNode): void => {
				const li = document.createElement("li");
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = `nav-item-btn${activeSubtreeRootId === node.id ? " is-active" : ""}`;
				btn.style.paddingInlineStart = `${0.55 + node.depth * 0.6}rem`;
				btn.textContent = node.title || node.content.slice(0, 24);
				btn.addEventListener("click", () => {
					activeSubtreeRootId =
						activeSubtreeRootId === node.id ? null : node.id;
					void refresh();
				});
				li.append(btn);
				topicList.append(li);
				for (const child of node.children) visitTopic(child);
			};
			for (const r of currentTopicOutline.roots) visitTopic(r);
			topicSec.append(topicTitle, topicList);
			leftRail.append(topicSec);
		}

		// Saved Views section
		const viewSec = document.createElement("section");
		const viewTitle = document.createElement("h2");
		viewTitle.className = "rail-section-title";
		viewTitle.textContent = "Saved Views";
		const viewList = document.createElement("ul");
		viewList.className = "nav-list";
		if (savedViews.length === 0) {
			const li = document.createElement("li");
			li.className = "muted";
			li.style.fontSize = "0.78rem";
			li.textContent = "No saved views yet.";
			viewList.append(li);
		} else {
			for (const sv of savedViews) {
				const li = document.createElement("li");
				li.className = "nav-item-row";
				const loadBtn = document.createElement("button");
				loadBtn.type = "button";
				loadBtn.className = "nav-item-btn";
				loadBtn.textContent = `${sv.name} (${sv.viewType})`;
				loadBtn.addEventListener("click", async () => {
					activeTableIdentifier = sv.tableIdentifier;
					activeViewId = sv.viewType;
					sortColumn = sv.sortColumn ?? "id";
					sortDirection = sv.sortDirection ?? "ascending";
					searchQuery = sv.searchQuery ?? "";
					searchInput.value = searchQuery;
					await refresh();
					setStatus(`Loaded saved view '${sv.name}'.`);
				});
				const delBtn = document.createElement("button");
				delBtn.type = "button";
				delBtn.className = "ghost danger";
				delBtn.textContent = "×";
				delBtn.setAttribute("aria-label", `Delete saved view ${sv.name}`);
				delBtn.addEventListener("click", async () => {
					await client.deleteSavedView(sv.id);
					await refresh();
					setStatus(`Deleted saved view '${sv.name}'.`);
				});
				li.append(loadBtn, delBtn);
				viewList.append(li);
			}
		}
		viewSec.append(viewTitle, viewList);
		leftRail.append(viewSec);

		// Presets section
		const presetSec = document.createElement("section");
		const presetTitle = document.createElement("h2");
		presetTitle.className = "rail-section-title";
		presetTitle.textContent = "Apply Preset";
		const presetList = document.createElement("div");
		presetList.className = "chip-list";
		for (const preset of [
			"knowledge",
			"product-spec",
			"decision-log",
		] as PresetBlueprintName[]) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "facet-chip";
			btn.textContent = preset;
			btn.addEventListener("click", () => {
				void handleIntent({ type: "apply-preset", preset });
			});
			presetList.append(btn);
		}
		presetSec.append(presetTitle, presetList);
		leftRail.append(presetSec);
	};

	const renderKpis = (): void => {
		kpiStrip.replaceChildren();
		const addPill = (label: string, val: string): void => {
			const span = document.createElement("span");
			span.className = "kpi-pill";
			span.textContent = `${label}: ${val}`;
			kpiStrip.append(span);
		};
		addPill("Tables", String(tables.length));
		addPill("Table", currentSlice.table?.identifier ?? "none");
		addPill("Rows", String(currentSlice.rows.length));
		addPill("Cols", String(currentSlice.columns.length));
		if (currentSlice.activeSubtreeRootId) {
			addPill("Subtree", `#${currentSlice.activeSubtreeRootId}`);
		}
		footerMeta.textContent = `${currentSlice.rows.length} rows · sorted by ${sortColumn ?? "id"} (${sortDirection})`;
		rawPre.textContent = JSON.stringify(
			{
				mode: currentSlice.mode,
				table: currentSlice.table,
				columns: currentSlice.columns.map((c) => ({
					identifier: c.identifier,
					role: c.config.role,
					enumValues: c.config.enumValues,
				})),
				rows: currentSlice.rows.slice(0, 20),
				relationsCount: currentSlice.relations.length,
			},
			null,
			2,
		);
	};

	const updateViewTabs = (): void => {
		for (const plugin of plugins) {
			const btn = tabButtons.get(plugin.id);
			if (!btn) continue;
			const supported = plugin.supports(
				currentSlice.table,
				currentSlice.columns,
				currentSlice,
			);
			btn.hidden = !supported;
			const isSelected = plugin.id === activeViewId;
			btn.setAttribute("aria-selected", isSelected ? "true" : "false");
			btn.toggleAttribute("focusgroupstart", isSelected);
		}
	};

	const renderActivePlugin = (): void => {
		updateViewTabs();
		const targetPlugin =
			plugins.find(
				(p) =>
					p.id === activeViewId &&
					p.supports(currentSlice.table, currentSlice.columns, currentSlice),
			) ?? plugins[0];
		if (!targetPlugin) return;
		activeViewId = targetPlugin.id;
		updateViewTabs();

		if (mountedPlugin !== targetPlugin) {
			mountedPlugin?.destroy();
			pluginCanvas.replaceChildren();
			targetPlugin.mount(pluginCanvas, (intent) => {
				void handleIntent(intent);
			});
			mountedPlugin = targetPlugin;
		}
		targetPlugin.update(currentSlice);

		const selectedRow =
			selectedNodeId !== null
				? currentSlice.rows.find((r) => r.id === selectedNodeId) ?? null
				: null;
		bodyGrid.classList.toggle("has-inspector", selectedRow !== null);
		inspector.render(selectedRow, currentSlice);
	};

	const refresh = async (): Promise<void> => {
		tables = await client.inspectArchitecture();
		if (
			!activeTableIdentifier ||
			!tables.some((t) => t.identifier === activeTableIdentifier)
		) {
			const nonMeta = tables.find(
				(t) => t.identifier !== UI_VIEWS_TABLE_IDENTIFIER,
			);
			activeTableIdentifier = nonMeta?.identifier ?? tables[0]?.identifier ?? null;
		}
		const activeTable =
			tables.find((t) => t.identifier === activeTableIdentifier) ?? null;

		const [
			columnProfile,
			queryRes,
			relations,
			relationTypes,
			audit,
			views,
			topicOutline,
		] = await Promise.all([
			activeTable
				? client.getTableColumns(activeTable.identifier).catch(() => null)
				: Promise.resolve(null),
			activeTable
				? client.queryTable({
						tableIdentifier: activeTable.identifier,
						underNodeId: activeSubtreeRootId ?? undefined,
						filterQuery: buildFilterQueryFromFacets(activeFacets),
						textQuery: searchQuery.trim() || undefined,
						limit: 100,
					})
				: Promise.resolve(null),
			client.listRelations(activeTable?.identifier).catch(() => []),
			client.listRelationTypes().catch(() => []),
			client.auditArchitecture().catch(() => undefined),
			client.listSavedViews().catch(() => []),
			tables.some((t) => t.identifier === "ia_topics")
				? client
						.getOutline({ tableIdentifier: "ia_topics", maxDepth: 4 })
						.catch(() => undefined)
				: Promise.resolve(undefined),
		]);

		currentRelations = relations;
		currentRelationTypes = relationTypes;
		currentAudit = audit;
		savedViews = views;
		currentTopicOutline = topicOutline;

		const rows: PlatformRow[] = (queryRes?.hits ?? []).map((hit) => ({
			id: hit.node.id,
			tableId: hit.node.tableId,
			tableIdentifier: queryRes?.tableIdentifier ?? activeTable?.identifier ?? "",
			title: hit.node.title ?? null,
			content: hit.node.content,
			description: hit.node.description ?? null,
			attributes: hit.node.attributes ?? {},
			createdAt: hit.node.createdAt,
			updatedAt: hit.node.updatedAt,
			score: hit.combinedScore,
			breadcrumbs: hit.breadcrumbs,
			topicBreadcrumbs: hit.topicBreadcrumbs,
		}));

		if (
			activeTable &&
			(activeViewId === "outline" ||
				(activeTable.treeValidation?.totalEdges ?? 0) > 0)
		) {
			currentOutline = await client
				.getOutline({ tableIdentifier: activeTable.identifier, maxDepth: 6 })
				.catch(() => undefined);
		} else {
			currentOutline = undefined;
		}

		if (activeTable) {
			currentGraph = await client
				.getDependencyGraph({
					tableIdentifier: activeTable.identifier,
					focusNodeId: focusGraphNodeId ?? selectedNodeId ?? undefined,
					relationTypes:
						graphRelationTypes.length > 0 ? graphRelationTypes : undefined,
				})
				.catch(() => undefined);
		} else {
			currentGraph = undefined;
		}

		if (
			activeTable?.identifier === "ai_memories" ||
			activeViewId === "timeline"
		) {
			const [recallRes, memStats] = await Promise.all([
				client
					.recall({
						query: searchQuery.trim() || undefined,
						includeSuperseded: true,
						limit: 30,
					})
					.catch(() => ({ hits: [], total: 0 })),
				client.getMemoryStats().catch(() => undefined),
			]);
			currentMemoryHits = recallRes.hits;
			currentMemoryStats = memStats;
		} else {
			currentMemoryHits = [];
			currentMemoryStats = undefined;
		}

		if (client.mode !== "local-headless" && activeViewId === "audit") {
			const [h, m, a] = await Promise.all([
				client.getHealth?.().catch(() => undefined),
				client.getMetricsJson?.().catch(() => undefined),
				client.getAuditLog?.(30).catch(() => undefined),
			]);
			opsHealth = h;
			opsMetrics = m;
			opsAuditLog = a;
		}

		const selection = new Set<string>();
		if (selectedNodeId) selection.add(selectedNodeId);

		currentSlice = {
			mode: client.mode,
			table: activeTable,
			tables,
			columns: columnProfile?.columns ?? [],
			columnProfile,
			rows,
			relations: currentRelations,
			relationTypes: currentRelationTypes,
			facets: queryRes?.facets ?? {},
			outline: currentOutline,
			graph: currentGraph,
			memoryHits: currentMemoryHits,
			memoryStats: currentMemoryStats,
			audit: currentAudit,
			opsHealth,
			opsMetrics,
			opsAuditLog,
			selection,
			activeSubtreeRootId,
			activeFacets: { ...activeFacets },
			sortColumn,
			sortDirection,
			searchQuery,
		};

		renderLeftRail();
		renderKpis();
		renderActivePlugin();
	};

	const selectTable = async (tableIdentifier: string): Promise<void> => {
		activeTableIdentifier = tableIdentifier;
		activeSubtreeRootId = null;
		activeFacets = {};
		selectedNodeId = null;
		focusGraphNodeId = null;
		await refresh();
		setStatus(`Loaded table '${tableIdentifier}'.`);
	};

	const selectView = (viewId: ViewPluginId): void => {
		activeViewId = viewId;
		if (
			viewId === "outline" ||
			viewId === "timeline" ||
			viewId === "audit"
		) {
			void refresh();
		} else {
			renderActivePlugin();
		}
	};

	const handleIntent = async (intent: ViewIntent): Promise<void> => {
		try {
			switch (intent.type) {
				case "select":
					selectedNodeId = intent.nodeIds[0] ?? null;
					renderActivePlugin();
					break;
				case "open-detail":
					selectedNodeId = intent.nodeId;
					focusGraphNodeId = intent.nodeId;
					await refresh();
					break;
				case "sort":
					sortColumn = intent.columnKey;
					sortDirection = intent.direction;
					currentSlice = { ...currentSlice, sortColumn, sortDirection };
					renderKpis();
					renderActivePlugin();
					break;
				case "filter-facet":
					if (intent.value === null) delete activeFacets[intent.key];
					else activeFacets[intent.key] = intent.value;
					await refresh();
					break;
				case "clear-facets":
					activeFacets = {};
					await refresh();
					break;
				case "inline-update": {
					const existing = currentSlice.rows.find(
						(r) => r.id === intent.nodeId,
					);
					const prevAttributes: Record<string, unknown> = {};
					if (existing && intent.patch.attributes) {
						for (const key of Object.keys(intent.patch.attributes)) {
							prevAttributes[key] = existing.attributes[key] ?? null;
						}
					}
					await commandStack.execute({
						label: `Update #${intent.nodeId}`,
						async execute() {
							return await client.updateRow(intent.nodeId, {
								tableId: currentSlice.table?.id,
								tableIdentifier: currentSlice.table?.identifier,
								...intent.patch,
							});
						},
						async undo() {
							if (!existing) return;
							await client.updateRow(intent.nodeId, {
								tableId: existing.tableId,
								tableIdentifier: existing.tableIdentifier,
								...(intent.patch.title !== undefined
									? { title: existing.title }
									: {}),
								...(intent.patch.content !== undefined
									? { content: existing.content }
									: {}),
								...(intent.patch.attributes
									? { attributes: prevAttributes }
									: {}),
							});
						},
					});
					await refresh();
					setStatus(`Updated node #${intent.nodeId}.`);
					break;
				}
				case "delete-row": {
					const backup = currentSlice.rows.find((r) => r.id === intent.nodeId);
					await commandStack.execute({
						label: `Delete #${intent.nodeId}`,
						async execute() {
							await client.deleteRow(intent.nodeId);
						},
						async undo() {
							if (!backup) return;
							await client.createRow({
								tableId: backup.tableId,
								tableIdentifier: backup.tableIdentifier,
								title: backup.title,
								content: backup.content,
								attributes: backup.attributes,
							});
						},
					});
					if (selectedNodeId === intent.nodeId) selectedNodeId = null;
					await refresh();
					setStatus(`Deleted node #${intent.nodeId}.`);
					break;
				}
				case "reparent":
					await client.moveHierarchyNode({
						nodeId: intent.nodeId,
						newParentId: intent.newParentId,
						relationType: intent.relationType ?? "parentOf",
					});
					await refresh();
					setStatus(
						`Reparented node #${intent.nodeId} -> ${intent.newParentId ?? "root"}.`,
					);
					break;
				case "focus-subtree":
					activeSubtreeRootId = intent.rootNodeId;
					await refresh();
					setStatus(`Scoped view to subtree #${intent.rootNodeId}.`);
					break;
				case "clear-subtree":
					activeSubtreeRootId = null;
					await refresh();
					setStatus("Cleared subtree scope.");
					break;
				case "create-relation":
					if (!currentSlice.table) break;
					await client.upsertRelation({
						tableId: currentSlice.table.id,
						sourceNodeId: intent.sourceNodeId,
						targetNodeId: intent.targetNodeId,
						relationType: intent.relationType,
						strength: intent.strength,
						confidence: intent.confidence,
					});
					await refresh();
					setStatus(
						`Linked #${intent.sourceNodeId} --[${intent.relationType}]--> #${intent.targetNodeId}.`,
					);
					break;
				case "delete-relation":
					await client.deleteRelation(intent.relationId);
					await refresh();
					setStatus(`Removed relation #${intent.relationId}.`);
					break;
				case "focus-graph-node":
					focusGraphNodeId = intent.nodeId;
					await refresh();
					break;
				case "filter-graph-relations":
					graphRelationTypes = intent.relationTypes;
					await refresh();
					break;
				case "consolidate-memory": {
					const activeIds = currentMemoryHits
						.filter((h) => h.memory.status === "active")
						.slice(0, 3)
						.map((h) => h.memory.id);
					if (activeIds.length < 2) {
						setStatus("Need at least 2 active memories to consolidate.", true);
						break;
					}
					const summaryContent = `Consolidated summary of memories #${activeIds.join(", #")}`;
					await client.consolidate({
						sourceMemoryIds: activeIds,
						content: summaryContent,
						kind: "semantic",
						markSourcesAsSuperseded: true,
					});
					await refresh();
					setStatus(`Consolidated ${activeIds.length} active memories.`);
					break;
				}
				case "apply-preset":
					await client.applyPreset(intent.preset);
					await refresh();
					setStatus(`Applied preset blueprint '${intent.preset}'.`);
					break;
				case "refresh-ops":
					if (client.mode !== "local-headless") {
						const [h, m, a] = await Promise.all([
							client.getHealth?.().catch(() => undefined),
							client.getMetricsJson?.().catch(() => undefined),
							client.getAuditLog?.(30).catch(() => undefined),
						]);
						opsHealth = h;
						opsMetrics = m;
						opsAuditLog = a;
					}
					await refresh();
					setStatus("Refreshed audit & ops telemetry.");
					break;
				case "refresh":
					await refresh();
					break;
			}
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error), true);
		}
	};

	// Wire top-level UI controls
	toggleRailBtn.addEventListener("click", () => {
		railCollapsed = !railCollapsed;
		leftRail.hidden = railCollapsed;
		bodyGrid.classList.toggle("is-rail-collapsed", railCollapsed);
		toggleRailBtn.setAttribute("aria-expanded", railCollapsed ? "false" : "true");
	});

	const unsubHistory = commandStack.subscribe((state) => {
		undoBtn.disabled = !state.canUndo;
		undoBtn.title = state.undoLabel ? `Undo: ${state.undoLabel}` : "Nothing to undo";
		redoBtn.disabled = !state.canRedo;
		redoBtn.title = state.redoLabel ? `Redo: ${state.redoLabel}` : "Nothing to redo";
	});

	undoBtn.addEventListener("click", async () => {
		try {
			const label = await commandStack.undo();
			if (label) {
				await refresh();
				setStatus(`Undid: ${label}`);
			}
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err), true);
		}
	});
	redoBtn.addEventListener("click", async () => {
		try {
			const label = await commandStack.redo();
			if (label) {
				await refresh();
				setStatus(`Redid: ${label}`);
			}
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err), true);
		}
	});

	newBtn.addEventListener("click", () => quickCapture.open(currentSlice, "row"));
	saveViewBtn.addEventListener("click", async () => {
		if (!currentSlice.table) return;
		const name = `${currentSlice.table.identifier} (${activeViewId})`;
		try {
			await client.saveView({
				id: `tmp-${Date.now()}`,
				name,
				tableIdentifier: currentSlice.table.identifier,
				viewType: activeViewId,
				sortColumn: sortColumn ?? undefined,
				sortDirection,
				searchQuery: searchQuery || undefined,
			});
			await refresh();
			setStatus(`Saved view '${name}'.`);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err), true);
		}
	});

	refreshBtn.addEventListener("click", async () => {
		try {
			await refresh();
			setStatus("Workspace refreshed.");
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err), true);
		}
	});

	searchForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		searchQuery = searchInput.value;
		await refresh();
		setStatus(
			searchQuery.trim()
				? `Filtered by "${searchQuery.trim()}".`
				: "Cleared search query.",
		);
	});

	const onWindowKeydown = (event: KeyboardEvent): void => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			quickCapture.open(currentSlice, "memory");
		}
	};
	if (typeof window !== "undefined") {
		window.addEventListener("keydown", onWindowKeydown);
	}

	const unsubClient = client.subscribe(() => {
		// External mutations keep workspace reactive when desired
	});

	void refresh()
		.then(() => {
			setStatus(`Ready (${client.mode}).`);
		})
		.catch((err) => {
			setStatus(err instanceof Error ? err.message : String(err), true);
		});

	return {
		refresh,
		selectTable,
		selectView,
		destroy() {
			unsubHistory();
			unsubClient();
			if (typeof window !== "undefined") {
				window.removeEventListener("keydown", onWindowKeydown);
			}
			mountedPlugin?.destroy();
			inspector.destroy();
			quickCapture.destroy();
			root.replaceChildren();
		},
	};
}
