import type {
	IVisualizationPlugin,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function createGraphViewPlugin(): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};
	let zoom = 1;
	let selectedTypes: Set<string> | null = null;

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		const graph = slice.graph;
		if (!graph || graph.nodes.length === 0) {
			const msg = document.createElement("p");
			msg.className = "muted";
			msg.textContent =
				"No nodes or relation graph data available for this table yet.";
			root.append(msg);
			return;
		}

		// Toolbar
		const toolbar = document.createElement("div");
		toolbar.className = "graph-toolbar";

		const zoomGroup = document.createElement("div");
		zoomGroup.setAttribute("role", "toolbar");
		zoomGroup.setAttribute("aria-label", "Graph zoom and focus controls");

		const zoomOutBtn = document.createElement("button");
		zoomOutBtn.type = "button";
		zoomOutBtn.textContent = "− Zoom";
		zoomOutBtn.addEventListener("click", () => {
			zoom = Math.max(0.6, Number((zoom - 0.15).toFixed(2)));
			render(slice);
		});

		const zoomInBtn = document.createElement("button");
		zoomInBtn.type = "button";
		zoomInBtn.textContent = "+ Zoom";
		zoomInBtn.addEventListener("click", () => {
			zoom = Math.min(2, Number((zoom + 0.15).toFixed(2)));
			render(slice);
		});

		const resetBtn = document.createElement("button");
		resetBtn.type = "button";
		resetBtn.textContent = "Reset Focus";
		resetBtn.addEventListener("click", () => {
			zoom = 1;
			emit({ type: "focus-graph-node", nodeId: null });
		});

		zoomGroup.append(zoomOutBtn, zoomInBtn, resetBtn);
		toolbar.append(zoomGroup);

		if (graph.relationTypes.length > 0) {
			const relFilterBar = document.createElement("div");
			relFilterBar.className = "chip-list";
			for (const relType of graph.relationTypes) {
				const isChecked = selectedTypes === null || selectedTypes.has(relType);
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "facet-chip";
				btn.setAttribute("aria-pressed", isChecked ? "true" : "false");
				btn.textContent = relType;
				btn.addEventListener("click", () => {
					const next = new Set(selectedTypes ?? graph.relationTypes);
					if (next.has(relType) && next.size > 1) {
						next.delete(relType);
					} else {
						next.add(relType);
					}
					selectedTypes = next;
					emit({ type: "filter-graph-relations", relationTypes: [...next] });
				});
				relFilterBar.append(btn);
			}
			toolbar.append(relFilterBar);
		}
		root.append(toolbar);

		const wrap = document.createElement("div");
		wrap.className = "graph-canvas-wrap";

		const width = Math.round(760 * zoom);
		const height = Math.round(380 * zoom);
		const svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("class", "graph-svg");
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		svg.setAttribute("role", "img");
		svg.setAttribute(
			"aria-label",
			`Graph visualization with ${graph.nodes.length} nodes and ${graph.edges.length} edges`,
		);

		const defs = document.createElementNS(SVG_NS, "defs");
		const marker = document.createElementNS(SVG_NS, "marker");
		marker.setAttribute("id", "graph-arrow");
		marker.setAttribute("viewBox", "0 0 10 10");
		marker.setAttribute("refX", "18");
		marker.setAttribute("refY", "5");
		marker.setAttribute("markerWidth", "6");
		marker.setAttribute("markerHeight", "6");
		marker.setAttribute("orient", "auto-start-reverse");
		const path = document.createElementNS(SVG_NS, "path");
		path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
		path.setAttribute("fill", "currentColor");
		marker.append(path);
		defs.append(marker);
		svg.append(defs);

		const cx = width / 2;
		const cy = height / 2;
		const radiusX = Math.max(110, width * 0.36);
		const radiusY = Math.max(90, height * 0.34);

		const coords = new Map<string, { x: number; y: number }>();
		const total = graph.nodes.length;
		graph.nodes.forEach((node, idx) => {
			const angle =
				total === 1 ? 0 : (2 * Math.PI * idx) / total - Math.PI / 2;
			coords.set(node.id, {
				x: cx + Math.cos(angle) * radiusX,
				y: cy + Math.sin(angle) * radiusY,
			});
		});

		const hasFocus = Boolean(graph.focusNodeId);

		for (const edge of graph.edges) {
			const src = coords.get(edge.sourceId);
			const dst = coords.get(edge.targetId);
			if (!src || !dst) continue;
			const line = document.createElementNS(SVG_NS, "line");
			line.setAttribute("x1", String(src.x));
			line.setAttribute("y1", String(src.y));
			line.setAttribute("x2", String(dst.x));
			line.setAttribute("y2", String(dst.y));
			const isImpactEdge =
				hasFocus &&
				graph.impactNodeIds.includes(edge.sourceId) &&
				graph.impactNodeIds.includes(edge.targetId);
			line.setAttribute(
				"class",
				`graph-edge${isImpactEdge ? " is-impact" : ""}`,
			);
			line.setAttribute("stroke-width", isImpactEdge ? "2.4" : "1.4");
			line.setAttribute("marker-end", "url(#graph-arrow)");
			const titleEl = document.createElementNS(SVG_NS, "title");
			titleEl.textContent = `${edge.sourceId} --[${edge.relationType}]--> ${edge.targetId}`;
			line.append(titleEl);
			svg.append(line);
		}

		for (const node of graph.nodes) {
			const pt = coords.get(node.id);
			if (!pt) continue;
			const g = document.createElementNS(SVG_NS, "g");
			const dimmed = hasFocus && !node.inImpactSet;
			g.setAttribute(
				"class",
				`graph-node${node.inImpactSet ? " is-impact" : ""}${dimmed ? " is-dimmed" : ""}`,
			);
			g.setAttribute("tabindex", "0");

			const r = Math.min(26, Math.max(12, Math.round(12 + node.pageRank * 24)));
			const circle = document.createElementNS(SVG_NS, "circle");
			circle.setAttribute("cx", String(pt.x));
			circle.setAttribute("cy", String(pt.y));
			circle.setAttribute("r", String(r));

			const label = document.createElementNS(SVG_NS, "text");
			label.setAttribute("x", String(pt.x));
			label.setAttribute("y", String(pt.y + r + 14));
			label.setAttribute("text-anchor", "middle");
			const shortLabel =
				node.label.length > 22 ? `${node.label.slice(0, 19)}...` : node.label;
			label.textContent = shortLabel;

			const tooltip = document.createElementNS(SVG_NS, "title");
			tooltip.textContent = `${node.label} (#${node.id}) · PR ${node.pageRank.toFixed(3)} · SCC #${node.sccClusterId} · degree ${node.degree}`;

			const triggerSelect = (): void => {
				emit({ type: "focus-graph-node", nodeId: node.id });
				emit({ type: "open-detail", nodeId: node.id });
			};
			g.addEventListener("click", triggerSelect);
			g.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					triggerSelect();
				}
			});

			g.append(tooltip, circle, label);
			svg.append(g);
		}

		wrap.append(svg);
		root.append(wrap);

		// Accessible metric summary under details
		const summaryDetails = document.createElement("details");
		summaryDetails.style.marginTop = "0.75rem";
		const sumLabel = document.createElement("summary");
		sumLabel.textContent = `Graph Analytics (${graph.nodes.length} nodes · ${graph.edges.length} edges · ${graph.impactNodeIds.length} in focus impact)`;
		summaryDetails.append(sumLabel);

		const metricList = document.createElement("ul");
		metricList.className = "relation-list";
		metricList.style.marginTop = "0.5rem";
		const ranked = [...graph.nodes].sort((a, b) => b.pageRank - a.pageRank);
		for (const n of ranked) {
			const li = document.createElement("li");
			li.className = "relation-item";
			li.textContent = `${n.label} (#${n.id}) — PageRank ${n.pageRank.toFixed(4)} · SCC #${n.sccClusterId} · Degree ${n.degree}`;
			metricList.append(li);
		}
		summaryDetails.append(metricList);
		root.append(summaryDetails);
	};

	return {
		id: "graph",
		label: "Graph",
		supports(table, _columns, slice) {
			if (!table) return false;
			return (slice?.relations.length ?? 0) > 0 || (slice?.rows.length ?? 0) > 0;
		},
		mount(container, onIntent) {
			root = container;
			emit = onIntent;
		},
		update(slice) {
			render(slice);
		},
		destroy() {
			zoom = 1;
			selectedTypes = null;
			root?.replaceChildren();
			root = null;
		},
	};
}
