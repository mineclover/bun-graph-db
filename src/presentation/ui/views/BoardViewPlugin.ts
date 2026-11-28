import type { TableColumnSummary } from "@/domain/value-objects/ColumnConfig.js";
import type {
	IVisualizationPlugin,
	PlatformRow,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

function findBoardColumns(
	columns: readonly TableColumnSummary[],
): TableColumnSummary[] {
	return columns.filter(
		(col) =>
			(col.config.enumValues && col.config.enumValues.length > 0) ||
			col.config.role === "status" ||
			col.config.role === "category" ||
			col.config.role === "priority",
	);
}

export function createBoardViewPlugin(): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};
	let activeGroupKey: string | null = null;
	let draggingNodeId: string | null = null;

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		const boardCols = findBoardColumns(slice.columns);
		if (boardCols.length === 0) {
			const msg = document.createElement("p");
			msg.className = "muted";
			msg.textContent =
				"Board view requires at least one status/category/enum column.";
			root.append(msg);
			return;
		}

		const chosenCol =
			boardCols.find((c) => c.identifier === activeGroupKey) ??
			boardCols.find((c) => c.config.role === "status") ??
			boardCols[0];
		if (!chosenCol) return;
		activeGroupKey = chosenCol.identifier;

		const controls = document.createElement("div");
		controls.className = "board-controls";
		const labelWrap = document.createElement("div");
		labelWrap.className = "chip-list";
		const lbl = document.createElement("label");
		lbl.htmlFor = "board-groupby-select";
		lbl.textContent = "Group by:";
		lbl.className = "muted";
		const groupSelect = document.createElement("select");
		groupSelect.id = "board-groupby-select";
		for (const c of boardCols) {
			const opt = document.createElement("option");
			opt.value = c.identifier;
			opt.textContent = c.name || c.identifier;
			if (c.identifier === chosenCol.identifier) opt.selected = true;
			groupSelect.append(opt);
		}
		groupSelect.addEventListener("change", () => {
			activeGroupKey = groupSelect.value;
			render(slice);
		});
		labelWrap.append(lbl, groupSelect);
		controls.append(labelWrap);
		root.append(controls);

		// Compute lane keys: explicit enumValues + observed distinct values + Unassigned
		const laneKeys: string[] = [...(chosenCol.config.enumValues ?? [])];
		for (const row of slice.rows) {
			const raw = row.attributes?.[chosenCol.identifier];
			const val =
				raw !== undefined && raw !== null && String(raw).trim() !== ""
					? String(raw)
					: "(Unassigned)";
			if (!laneKeys.includes(val)) laneKeys.push(val);
		}
		if (laneKeys.length === 0) laneKeys.push("(Unassigned)");

		const grouped = new Map<string, PlatformRow[]>();
		for (const k of laneKeys) grouped.set(k, []);
		for (const row of slice.rows) {
			const raw = row.attributes?.[chosenCol.identifier];
			const key =
				raw !== undefined && raw !== null && String(raw).trim() !== ""
					? String(raw)
					: "(Unassigned)";
			grouped.get(key)?.push(row);
		}

		const lanesEl = document.createElement("div");
		lanesEl.className = "board-lanes";

		for (const laneKey of laneKeys) {
			const lane = document.createElement("section");
			lane.className = "board-lane";
			lane.setAttribute("aria-label", `${laneKey} column`);

			lane.addEventListener("dragover", (event) => {
				if (!draggingNodeId) return;
				event.preventDefault();
				lane.classList.add("is-drag-over");
			});
			lane.addEventListener("dragleave", () => {
				lane.classList.remove("is-drag-over");
			});
			lane.addEventListener("drop", (event) => {
				event.preventDefault();
				lane.classList.remove("is-drag-over");
				const dragged =
					draggingNodeId ?? event.dataTransfer?.getData("text/plain");
				draggingNodeId = null;
				if (dragged) {
					emit({
						type: "inline-update",
						nodeId: dragged,
						patch: {
							attributes: {
								[chosenCol.identifier]:
									laneKey === "(Unassigned)" ? null : laneKey,
							},
						},
					});
				}
			});

			const laneHead = document.createElement("div");
			laneHead.className = "board-lane__header";
			const titleSpan = document.createElement("span");
			titleSpan.textContent = laneKey;
			const countBadge = document.createElement("span");
			countBadge.className = "badge";
			const laneRows = grouped.get(laneKey) ?? [];
			countBadge.textContent = String(laneRows.length);
			laneHead.append(titleSpan, countBadge);
			lane.append(laneHead);

			for (const row of laneRows) {
				const card = document.createElement("article");
				card.className = "board-card";
				if (slice.selection.has(row.id)) card.classList.add("is-selected");
				card.draggable = true;
				card.addEventListener("dragstart", (event) => {
					draggingNodeId = row.id;
					event.dataTransfer?.setData("text/plain", row.id);
				});

				const cardBtn = document.createElement("button");
				cardBtn.type = "button";
				cardBtn.className = "ghost";
				cardBtn.style.justifyContent = "flex-start";
				cardBtn.style.textAlign = "start";
				cardBtn.textContent =
					row.title || row.content.slice(0, 60) || `#${row.id}`;
				cardBtn.addEventListener("click", () =>
					emit({ type: "open-detail", nodeId: row.id }),
				);

				const excerpt = document.createElement("p");
				excerpt.className = "muted";
				excerpt.style.margin = "0";
				excerpt.style.fontSize = "0.78rem";
				excerpt.textContent =
					row.content.length > 90
						? `${row.content.slice(0, 87)}...`
						: row.content;

				const moveSelect = document.createElement("select");
				moveSelect.setAttribute(
					"aria-label",
					`Move #${row.id} ${chosenCol.identifier}`,
				);
				for (const targetKey of laneKeys) {
					const opt = document.createElement("option");
					opt.value = targetKey;
					opt.textContent = `→ ${targetKey}`;
					if (targetKey === laneKey) opt.selected = true;
					moveSelect.append(opt);
				}
				moveSelect.addEventListener("change", () => {
					emit({
						type: "inline-update",
						nodeId: row.id,
						patch: {
							attributes: {
								[chosenCol.identifier]:
									moveSelect.value === "(Unassigned)"
										? null
										: moveSelect.value,
							},
						},
					});
				});

				card.append(cardBtn, excerpt, moveSelect);
				lane.append(card);
			}

			lanesEl.append(lane);
		}

		root.append(lanesEl);
	};

	return {
		id: "board",
		label: "Board",
		supports(table, columns) {
			if (!table) return false;
			return (
				findBoardColumns(columns).length > 0 ||
				table.identifier === "ai_memories"
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
