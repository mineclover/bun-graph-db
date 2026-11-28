import type { IaOutlineNode } from "@/application/services/InformationArchitectureTypes.js";
import type {
	IVisualizationPlugin,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

function flattenNodes(
	nodes: readonly IaOutlineNode[],
): Array<{ id: string; label: string; depth: number }> {
	const flat: Array<{ id: string; label: string; depth: number }> = [];
	const visit = (list: readonly IaOutlineNode[]): void => {
		for (const item of list) {
			flat.push({
				id: item.id,
				label: item.title || item.content.slice(0, 40) || `#${item.id}`,
				depth: item.depth,
			});
			visit(item.children);
		}
	};
	visit(nodes);
	return flat;
}

export function createOutlineViewPlugin(): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};
	let draggingNodeId: string | null = null;

	const renderNode = (
		node: IaOutlineNode,
		allNodes: Array<{ id: string; label: string; depth: number }>,
	): HTMLElement => {
		const card = document.createElement("div");
		card.className = "outline-node";
		card.draggable = true;

		card.addEventListener("dragstart", (event) => {
			draggingNodeId = node.id;
			event.dataTransfer?.setData("text/plain", node.id);
		});
		card.addEventListener("dragover", (event) => {
			if (!draggingNodeId || draggingNodeId === node.id) return;
			event.preventDefault();
			card.classList.add("is-drop-target");
		});
		card.addEventListener("dragleave", () => {
			card.classList.remove("is-drop-target");
		});
		card.addEventListener("drop", (event) => {
			event.preventDefault();
			card.classList.remove("is-drop-target");
			const draggedId =
				draggingNodeId ?? event.dataTransfer?.getData("text/plain");
			draggingNodeId = null;
			if (draggedId && draggedId !== node.id) {
				emit({ type: "reparent", nodeId: draggedId, newParentId: node.id });
			}
		});

		const row = document.createElement("div");
		row.className = "outline-node__row";

		const left = document.createElement("div");
		left.className = "chip-list";
		const titleBtn = document.createElement("button");
		titleBtn.type = "button";
		titleBtn.className = "ghost";
		titleBtn.textContent = node.title || node.content.slice(0, 64) || `#${node.id}`;
		titleBtn.addEventListener("click", () =>
			emit({ type: "open-detail", nodeId: node.id }),
		);
		left.append(titleBtn);

		const meta = document.createElement("span");
		meta.className = "badge";
		meta.textContent = `d${node.depth} · ${node.subtreeNodeCount} nodes`;
		left.append(meta);

		for (const [relType, count] of Object.entries(node.linkedCounts ?? {})) {
			if (count > 0) {
				const linkBadge = document.createElement("span");
				linkBadge.className = "badge badge--accent";
				linkBadge.textContent = `${relType}: ${count}`;
				left.append(linkBadge);
			}
		}

		const right = document.createElement("div");
		right.className = "chip-list";

		const focusBtn = document.createElement("button");
		focusBtn.type = "button";
		focusBtn.textContent = "Scope Subtree";
		focusBtn.addEventListener("click", () =>
			emit({ type: "focus-subtree", rootNodeId: node.id }),
		);

		const parentSelect = document.createElement("select");
		parentSelect.setAttribute("aria-label", `Move ${node.title ?? node.id} under parent`);
		const defaultOpt = document.createElement("option");
		defaultOpt.value = "";
		defaultOpt.textContent = "Move to parent…";
		parentSelect.append(defaultOpt);

		const rootOpt = document.createElement("option");
		rootOpt.value = "__ROOT__";
		rootOpt.textContent = "(Promote to Root)";
		parentSelect.append(rootOpt);

		for (const candidate of allNodes) {
			if (candidate.id === node.id) continue;
			const opt = document.createElement("option");
			opt.value = candidate.id;
			opt.textContent = `${"  ".repeat(candidate.depth)}${candidate.label}`;
			parentSelect.append(opt);
		}
		parentSelect.addEventListener("change", () => {
			if (!parentSelect.value) return;
			emit({
				type: "reparent",
				nodeId: node.id,
				newParentId:
					parentSelect.value === "__ROOT__" ? null : parentSelect.value,
			});
		});

		right.append(focusBtn, parentSelect);
		row.append(left, right);
		card.append(row);

		if (node.children.length > 0) {
			const childrenWrap = document.createElement("div");
			childrenWrap.className = "outline-node__children";
			for (const child of node.children) {
				childrenWrap.append(renderNode(child, allNodes));
			}
			card.append(childrenWrap);
		}
		return card;
	};

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		const outline = slice.outline;
		if (!outline || outline.roots.length === 0) {
			const msg = document.createElement("p");
			msg.className = "muted";
			msg.textContent =
				"No hierarchical nodes (`parentOf`) found in this table. Add parent links in the Inspector Drawer to inspect an outline tree.";
			root.append(msg);
			return;
		}

		const header = document.createElement("div");
		header.className = "board-controls";
		const stats = document.createElement("span");
		stats.className = "muted";
		stats.textContent = `Relation: ${outline.relationType} · ${outline.totalNodes} nodes · max depth ${outline.maxDepthReached}`;
		header.append(stats);

		if (slice.activeSubtreeRootId) {
			const clearBtn = document.createElement("button");
			clearBtn.type = "button";
			clearBtn.textContent = `Clear Subtree Scope (#${slice.activeSubtreeRootId})`;
			clearBtn.addEventListener("click", () =>
				emit({ type: "clear-subtree" }),
			);
			header.append(clearBtn);
		}
		root.append(header);

		const allNodes = flattenNodes(outline.roots);
		const tree = document.createElement("div");
		tree.className = "outline-tree";
		for (const rootNode of outline.roots) {
			tree.append(renderNode(rootNode, allNodes));
		}
		root.append(tree);
	};

	return {
		id: "outline",
		label: "Outline",
		supports(table, _columns, slice) {
			if (!table) return false;
			return Boolean(
				(table.treeValidation?.totalEdges ?? 0) > 0 ||
					(slice?.outline?.roots.length ?? 0) > 0 ||
					table.identifier.includes("topic") ||
					table.identifier.includes("spec") ||
					table.identifier.includes("domain"),
			);
		},
		mount(container, onIntent) {
			root = container;
			emit = onIntent;
		},
		update(slice) {
			render(slice);
		},
		destroy() {
			draggingNodeId = null;
			root?.replaceChildren();
			root = null;
		},
	};
}
